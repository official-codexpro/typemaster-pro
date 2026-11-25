document.addEventListener('DOMContentLoaded', () => {
  const root = document.getElementById('carRacingGame');
  if (!root) return;

  const canvas = document.getElementById('racingCanvas');
  const $ = (id) => document.getElementById(id);
  const input = $('typingInput');
  const sentenceDisplay = $('sentenceDisplay');
  const feedback = $('typingFeedback');
  const difficulty = root.dataset.difficulty || 'normal';
  const mode = root.dataset.mode || 'paragraph';
  const language = root.dataset.language || 'python';
  const passageDifficulty = difficulty === 'extreme' ? 'hard' : difficulty;
  const raceSeconds = 60;
  const referenceWpm = 55;
  const maxProgressSpeed = 1.82;
  const aiSpeeds = {
    easy: [22, 26, 29, 33],
    normal: [33, 38, 43, 48],
    hard: [42, 47, 52, 57],
    extreme: [50, 55, 60, 68],
  }[difficulty] || [33, 38, 43, 48];
  const racers = [
    {
      name: 'YOU',
      color: '#20b95e',
      progress: 0,
      velocity: 0,
      throttle: 0,
      drivePulse: 0,
      player: true,
    },
    {
      name: 'NOVA RUSH',
      shortName: 'NOVA',
      color: '#bd71cb',
      progress: 0,
      wpm: aiSpeeds[0],
    },
    {
      name: 'NEON APEX',
      shortName: 'NEON',
      color: '#28bc70',
      progress: 0,
      wpm: aiSpeeds[1],
    },
    {
      name: 'MIDNIGHT GT',
      shortName: 'MIDNIGHT',
      color: '#171a1c',
      progress: 0,
      wpm: aiSpeeds[2],
    },
    {
      name: 'RAZORBACK CHARGER',
      shortName: 'RAZOR',
      color: '#32bd50',
      progress: 0,
      wpm: aiSpeeds[3],
    },
  ];
  let raf = 0,
    previous = 0,
    elapsed = 0,
    remaining = raceSeconds,
    raceEndTime = 0,
    pausedAt = 0;
  let running = false,
    paused = false,
    ended = false,
    saving = false,
    countdownTimer = null;
  let charIndex = 0,
    correctChars = 0,
    typedCharacters = 0,
    mistakes = 0,
    score = 0,
    wordsTyped = 0;
  let currentPassage = '',
    passageQueue = [],
    generatorPromise = null,
    wrongCurrent = false,
    codeErrorLocked = false,
    paragraphsCompleted = 0;
  let currentWpm = 0,
    recentCorrectKeys = [];
  let finishSequence = null;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finishCrossingDuration = 1600;
  const resultDelayAfterCrossing = 3500;
  let standingsSignature = '';
  let lastStandingsUpdate = 0;
  const standingsRows = new Map();
  const standingsList = $('raceStandingsList');

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }
  let world;
  try {
    if (!window.RaceWorld3D) throw new Error('3D race engine bundle did not load');
    world = new window.RaceWorld3D(canvas, racers, {
      reducedMotion,
      modelUrl: root.dataset.carModel,
    });
  } catch (error) {
    console.error('Unable to initialize the 3D race scene:', error);
    $('startButton').disabled = true;
    $('startOverlay').querySelector('h2').textContent = '3D GRAPHICS UNAVAILABLE';
    $('startOverlay').querySelector('p:last-of-type').textContent =
      'This race needs a browser with WebGL enabled. Try an updated browser or enable graphics acceleration.';
    feedback.textContent = 'Could not initialize the 3D racing scene.';
    return;
  }
  window.addEventListener('resize', () => world.resize());

  function splitIntoParagraphs(text) {
    const clean = (text || '').replace(/\r/g, '').trim();
    if (!clean) return [];
    if (mode === 'code') {
      const lines = clean.split('\n');
      const blocks = [];
      let block = [];
      lines.forEach((line) => {
        block.push(line);
        if (block.length >= 3) {
          blocks.push(block.join('\n'));
          block = [];
        }
      });
      if (block.length) blocks.push(block.join('\n'));
      return blocks.filter(Boolean);
    }
    const sentences = clean.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [clean];
    const blocks = [];
    let paragraph = '';
    let wordCount = 0;
    sentences.forEach((sentence) => {
      const parts = sentence.trim().split(/\s+/);
      let offset = 0;
      while (offset < parts.length) {
        const room = Math.max(1, 24 - wordCount),
          take = parts.slice(offset, offset + room);
        paragraph += (paragraph ? ' ' : '') + take.join(' ');
        wordCount += take.length;
        offset += take.length;
        if (wordCount >= 24) {
          blocks.push(paragraph);
          paragraph = '';
          wordCount = 0;
        }
      }
    });
    if (paragraph) blocks.push(paragraph);
    return blocks;
  }

  function fallbackPassage() {
    if (mode === 'code') {
      return (
        {
          django:
            '{% extends "base.html" %}\n{% load static %}\n{% block content %}\n<main class="race-card">\n  <h1>{{ title|default:"Race day" }}</h1>\n</main>\n{% endblock %}',
          python:
            'def race_step(speed, throttle):\n    acceleration = throttle * 0.8\n    return min(speed + acceleration, 240)\n\nfor lap in range(3):\n    print("Ready to race", lap)',
          javascript:
            'function raceStep(speed, throttle) {\n  const acceleration = throttle * 0.8;\n  return Math.min(speed + acceleration, 240);\n}\n\nfor (let lap = 0; lap < 3; lap++) {\n  console.log("Ready to race", lap);\n}',
          sql: 'SELECT driver_name, average_wpm\nFROM race_results\nWHERE accuracy >= 95\nORDER BY average_wpm DESC\nLIMIT 5;',
        }[language] || 'function raceStep(speed) {\n  return speed + 1;\n}'
      );
    }
    const easy =
      'a fast driver follows the road and keeps a steady pace as the bright green car moves through the open city circuit';
    const normal =
      'A focused driver watches the road, holds a steady pace, and accelerates smoothly through every turn.';
    const hard =
      'Precise acceleration, consistent rhythm, and deliberate focus help experienced racers maintain control through demanding corners.';
    return difficulty === 'easy'
      ? easy
      : difficulty === 'hard' || difficulty === 'extreme'
        ? hard
        : normal;
  }

  async function generatePassage() {
    if (mode === 'code' && language === 'django') return generateDjangoTemplate();
    const params = new URLSearchParams({
      difficulty: mode === 'code' ? 'code' : passageDifficulty,
    });
    if (mode === 'code') params.set('language', language);
    const response = await fetch(`/api/generate/?${params.toString()}`, {
      credentials: 'same-origin',
    });
    if (!response.ok) throw new Error(`Passage API returned ${response.status}`);
    const data = await response.json();
    if (!data.success || typeof data.text !== 'string' || !data.text.trim())
      throw new Error(data.message || 'No passage returned');
    return data.text;
  }

  function generateDjangoTemplate() {
    const templates = [
      '{% extends "base.html" %}\n{% load static %}\n{% block content %}\n<main class="race-card">\n  <h1>{{ title|default:"Night run" }}</h1>\n  <img src="{% static \'images/turn-marker.svg\' %}" alt="Circuit marker">\n</main>\n{% endblock %}',
      '{% for driver in drivers %}\n<article class="driver-card">\n  <h2>{{ driver.name }}</h2>\n  <span>{{ driver.wpm }} WPM</span>\n</article>\n{% empty %}\n<p>No drivers yet.</p>\n{% endfor %}',
      '{% if race.is_open %}\n<form method="post" action="{% url \'join_race\' race.id %}">\n  {% csrf_token %}\n  <button type="submit">Join race</button>\n</form>\n{% else %}\n<p>{{ race.status|title }}</p>\n{% endif %}',
      '{% with best=results|dictsortreversed:"wpm"|first %}\n<section class="best-result">\n  <h2>{{ best.driver|default:"Your best run" }}</h2>\n  <strong>{{ best.wpm|default:0 }} WPM</strong>\n</section>\n{% endwith %}',
      '{% include "games/partials/race_badge.html" with place=position %}\n{% if result.accuracy >= 95 %}\n<p class="clean-run">Excellent accuracy</p>\n{% else %}\n<p>{{ result.mistakes }} errors to improve</p>\n{% endif %}',
    ];
    return templates[Math.floor(Math.random() * templates.length)];
  }

  async function fillPassageQueue(minimum = 3) {
    while (passageQueue.length < minimum) {
      if (!generatorPromise) {
        generatorPromise = (async () => {
          let text;
          try {
            text = await generatePassage();
          } catch (error) {
            console.warn('Using local race passage fallback:', error);
            text = fallbackPassage();
          }
          const chunks = splitIntoParagraphs(text);
          passageQueue.push(...(chunks.length ? chunks : splitIntoParagraphs(fallbackPassage())));
        })();
      }
      await generatorPromise;
      generatorPromise = null;
    }
  }

  function syntaxClasses(text) {
    const classes = Array(text.length).fill('');
    if (mode !== 'code') return classes;
    const patterns = [
      ['syntax-django-tag', /{%[\s\S]*?%}|{#[\s\S]*?#}/g],
      ['syntax-django-variable', /{{[\s\S]*?}}/g],
      ['syntax-html-tag', /<\/?[a-z][^>\n]*>/gi],
      ['syntax-comment', /\/\/[^\n]*|#[^\n]*|--[^\n]*/g],
      ['syntax-string', /"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`/g],
      ['syntax-number', /\b\d+(?:\.\d+)?\b/g],
      [
        'syntax-keyword',
        /\b(?:abstract|async|await|break|case|catch|class|const|continue|def|else|enum|export|extends|false|finally|for|from|function|if|import|in|interface|let|new|null|private|public|return|self|static|true|try|var|while|yield|SELECT|FROM|WHERE|ORDER|BY|LIMIT|INSERT|INTO|VALUES|UPDATE|SET|DELETE)\b/g,
      ],
    ];
    patterns.forEach(([className, regex]) => {
      let match;
      while ((match = regex.exec(text))) {
        for (let i = match.index; i < match.index + match[0].length; i++)
          if (!classes[i]) classes[i] = className;
      }
    });
    return classes;
  }

  function renderSentence() {
    const frag = document.createDocumentFragment();
    const syntax = syntaxClasses(currentPassage);
    [...currentPassage].forEach((char, i) => {
      const span = document.createElement('span');
      span.textContent = char;
      const classes = [syntax[i]];
      if (i < charIndex) classes.push('typed-correct');
      else if (i === charIndex) {
        classes.push('current-char');
        if (wrongCurrent) classes.push('typing-wrong');
      } else classes.push('future-text');
      span.className = classes.filter(Boolean).join(' ');
      frag.appendChild(span);
    });
    sentenceDisplay.replaceChildren(frag);
    const current = sentenceDisplay.querySelector('.current-char');
    if (current) {
      const currentRect = current.getBoundingClientRect(),
        displayRect = sentenceDisplay.getBoundingClientRect();
      const currentLeft = currentRect.left - displayRect.left + sentenceDisplay.scrollLeft;
      sentenceDisplay.scrollLeft = Math.max(0, currentLeft - sentenceDisplay.clientWidth * 0.72);
      const currentTop = currentRect.top - displayRect.top + sentenceDisplay.scrollTop;
      if (currentTop > sentenceDisplay.scrollTop + sentenceDisplay.clientHeight - 28)
        sentenceDisplay.scrollTop = currentTop - sentenceDisplay.clientHeight + 34;
      else if (currentTop < sentenceDisplay.scrollTop) sentenceDisplay.scrollTop = currentTop;
    } else sentenceDisplay.scrollLeft = sentenceDisplay.scrollWidth;
    $('typingProgress').style.width =
      `${currentPassage.length ? (charIndex / currentPassage.length) * 100 : 0}%`;
    sentenceDisplay.classList.toggle('code-mode', mode === 'code');
  }

  async function loadNextParagraph() {
    if (!passageQueue.length) {
      if (running) input.disabled = true;
      feedback.textContent = 'Generating the next paragraph…';
      await fillPassageQueue(1);
      if (ended) return;
      input.disabled = !running || paused;
    }
    currentPassage = passageQueue.shift() || fallbackPassage();
    charIndex = 0;
    wrongCurrent = false;
    codeErrorLocked = false;
    $('passageLabel').textContent =
      mode === 'code'
        ? `${language.toUpperCase()} SYNTAX · PARAGRAPH ${paragraphsCompleted + 1}`
        : `${difficulty.toUpperCase()} PARAGRAPH ${paragraphsCompleted + 1}`;
    renderSentence();
    fillPassageQueue(3).catch((error) => console.error('Passage prefetch error:', error));
  }

  function formatTime(seconds) {
    const s = Math.max(0, Math.ceil(seconds));
    return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  }
  function updateHud() {
    const accuracy = typedCharacters ? Math.round((correctChars / typedCharacters) * 100) : 100;
    const minutes = elapsed > 0 ? elapsed / 60 : 0;
    currentWpm = minutes ? Math.round(correctChars / 5 / minutes) : 0;
    $('wpmValue').textContent = currentWpm;
    $('speedValue').textContent = currentWpm;
    $('timerValue').textContent = formatTime(remaining);
    $('accuracyValue').textContent = `${accuracy}%`;
    $('distanceValue').textContent = Math.floor(racers[0].progress);
    $('collisionValue').textContent = mistakes;
    $('scoreValue').textContent = score;
    $('lapValue').textContent = world.lapLabel(racers[0].progress);
    const place = [...racers].sort((a, b) => b.progress - a.progress).indexOf(racers[0]) + 1;
    $('positionValue').textContent = `P${place}/5`;
    $('dialNeedle').style.transform = `rotate(${-48 + clamp(currentWpm, 0, 100) * 1.28}deg)`;
    updateStandings();
  }

  function updateStandings() {
    const now = performance.now();
    if (now - lastStandingsUpdate < 140) return;
    lastStandingsUpdate = now;
    const ordered = [...racers].sort((a, b) => b.progress - a.progress);
    const signature = ordered.map((racer) => racer.name).join('|');
    if (signature !== standingsSignature) {
      standingsSignature = signature;
      ordered.forEach((racer) => {
        if (!standingsRows.has(racer.name)) {
          const row = document.createElement('li');
          row.className = 'standing-row';
          row.style.setProperty('--driver-color', racer.color);
          const place = document.createElement('span');
          place.className = 'standing-place';
          const car = document.createElement('span');
          car.className = 'standing-car';
          car.setAttribute('aria-hidden', 'true');
          car.textContent = '▰';
          const info = document.createElement('span');
          info.className = 'standing-info';
          const name = document.createElement('span');
          name.className = 'standing-name';
          name.textContent = racer.player ? 'YOU' : racer.shortName;
          const bar = document.createElement('span');
          bar.className = 'standing-bar';
          const barFill = document.createElement('i');
          bar.appendChild(barFill);
          info.append(name, bar);
          row.append(place, car, info);
          standingsRows.set(racer.name, { row, place, barFill });
        }
        standingsList.appendChild(standingsRows.get(racer.name).row);
      });
    }
    const leaderProgress = ordered[0].progress;
    ordered.forEach((racer, index) => {
      const entry = standingsRows.get(racer.name);
      entry.place.textContent = `P${index + 1}`;
      const gap = Math.max(0, leaderProgress - racer.progress);
      entry.barFill.style.width = `${clamp(100 - gap * 1.1, 12, 100)}%`;
      entry.row.classList.toggle('standing-player', racer.player);
    });
  }
  function message(text, color = '#fff') {
    $('raceMessage').textContent = text;
    $('raceMessage').style.color = color;
    clearTimeout(message.timer);
    message.timer = setTimeout(() => ($('raceMessage').textContent = ''), 1500);
  }

  function processCharacter(char) {
    if (
      !running ||
      paused ||
      ended ||
      !currentPassage ||
      performance.now() >= raceEndTime ||
      (mode === 'code' && codeErrorLocked)
    )
      return;
    typedCharacters++;
    if (char !== currentPassage[charIndex]) {
      const expected = currentPassage[charIndex];
      mistakes++;
      input.classList.add('typing-error');
      feedback.textContent = `Missed key · expected “${expected === ' ' ? 'space' : expected}”`;
      wrongCurrent = true;
      if (mode === 'code') codeErrorLocked = true;
      renderSentence();
      feedback.style.color = '#ff8a81';
      updateHud();
      return;
    }
    charIndex++;
    correctChars++;
    recentCorrectKeys.push(performance.now());
    racers[0].drivePulse = clamp(racers[0].drivePulse + 0.24, 0, 1);
    score += char === ' ' ? 2 : 5;
    wrongCurrent = false;
    input.classList.remove('typing-error');
    feedback.textContent = 'Clean typing · keep the momentum';
    feedback.style.color = '#7de6cf';
    renderSentence();
    updateHud();
    if (charIndex >= currentPassage.length) {
      wordsTyped += (currentPassage.match(/[A-Za-z0-9_$]+/g) || []).length;
      paragraphsCompleted++;
      feedback.textContent = 'Paragraph complete · next passage loading…';
      loadNextParagraph().catch((error) => {
        console.error('Next passage failed:', error);
      });
    }
  }
  input.addEventListener('keydown', (event) => {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (mode === 'code' && codeErrorLocked) {
      event.preventDefault();
      if (event.key === 'Backspace') {
        codeErrorLocked = false;
        wrongCurrent = false;
        input.classList.remove('typing-error');
        feedback.textContent = 'Error cleared · type the highlighted character';
        feedback.style.color = '#7de6cf';
        renderSentence();
      }
      return;
    }
    if (mode === 'code' && event.key === 'Enter') {
      event.preventDefault();
      processCharacter('\n');
      return;
    }
    if (mode === 'code' && event.key === 'Tab') {
      event.preventDefault();
      for (let i = 0; i < 4; i++) processCharacter(' ');
      return;
    }
    if (event.key.length !== 1) return;
    event.preventDefault();
    processCharacter(event.key);
  });
  input.addEventListener('input', () => {
    const chars = [...input.value];
    input.value = '';
    chars.forEach(processCharacter);
  });
  input.addEventListener('paste', (event) => event.preventDefault());
  sentenceDisplay.addEventListener('click', () => {
    if (running && !paused) input.focus();
  });
  canvas.addEventListener('click', () => {
    if (running && !paused) input.focus();
  });

  function tick(timestamp) {
    if ((!running && !finishSequence) || paused || ended) return;
    const dt = previous ? Math.min((timestamp - previous) / 1000, 0.1) : 0;
    previous = timestamp;
    if (finishSequence) {
      const progress = clamp((timestamp - finishSequence.startedAt) / finishCrossingDuration, 0, 1);
      const easedProgress = progress * progress * (3 - 2 * progress);
      const player = racers[0];
      player.progress =
        finishSequence.startProgress +
        (finishSequence.targetProgress - finishSequence.startProgress) * easedProgress;
      player.velocity =
        progress < 1
          ? ((finishSequence.targetProgress - finishSequence.startProgress) *
              6 *
              progress *
              (1 - progress)) /
            (finishCrossingDuration / 1000)
          : 0;
      player.throttle = progress < 1 ? 1 : 0;
      updateHud();
      world.render(racers, dt);
      if (progress >= 1) {
        const { reason, place } = finishSequence;
        finishSequence = null;
        window.setTimeout(() => endGame(reason, place), resultDelayAfterCrossing);
      } else {
        raf = requestAnimationFrame(tick);
      }
      return;
    }
    remaining = Math.max(0, (raceEndTime - performance.now()) / 1000);
    elapsed = raceSeconds - remaining;
    racers.slice(1).forEach((car, i) => {
      car.progress =
        car.baseProgress +
        (car.wpm / referenceWpm) * maxProgressSpeed * elapsed +
        0.3 * Math.sin(elapsed * 0.25 + i * 1.4);
    });
    const player = racers[0];
    const now = performance.now();
    while (recentCorrectKeys.length && recentCorrectKeys[0] < now - 3000) recentCorrectKeys.shift();
    let cadenceWpm = 0;
    if (recentCorrectKeys.length > 1) {
      const span = Math.max(0.75, (recentCorrectKeys.at(-1) - recentCorrectKeys[0]) / 1000);
      const idle = Math.max(0, (now - recentCorrectKeys.at(-1)) / 1000);
      cadenceWpm = clamp(
        ((recentCorrectKeys.length - 1) / span) * 12 * Math.exp(-idle / 1.1),
        0,
        72,
      );
    }
    const targetThrottle = clamp(cadenceWpm / referenceWpm, 0, 1.3);
    player.throttle += (targetThrottle - player.throttle) * Math.min(1, dt * 4.2);
    const targetSpeed = player.throttle * maxProgressSpeed;
    const response = targetSpeed > player.velocity ? 3.1 : 1.35;
    player.velocity += (targetSpeed - player.velocity) * Math.min(1, dt * response);
    player.progress += player.velocity * dt;
    player.drivePulse = Math.max(0, player.drivePulse - dt * 1.65);
    updateHud();
    if (remaining <= 0) {
      remaining = 0;
      elapsed = raceSeconds;
      updateHud();
      const ranking = [...racers].sort((a, b) => b.progress - a.progress);
      const place = ranking.indexOf(racers[0]) + 1;
      const reason = place === 1 ? 'YOU WIN THE RACE!' : `RACE COMPLETE · PLACE ${place}`;
      const startProgress = player.progress;
      finishSequence = {
        startedAt: timestamp,
        startProgress,
        targetProgress: startProgress + 1.1,
        reason,
        place,
      };
      running = false;
      input.disabled = true;
      $('pauseButton').disabled = true;
      world.showFinishLine(startProgress + 0.55);
      world.render(racers, 0);
      raf = requestAnimationFrame(tick);
    } else raf = requestAnimationFrame(tick);
  }
  function startLoop() {
    cancelAnimationFrame(raf);
    previous = 0;
    raf = requestAnimationFrame(tick);
  }
  function countdown() {
    if (countdownTimer) return;
    let count = 3;
    $('startButton').disabled = true;
    $('countdownOverlay').classList.remove('hidden');
    $('countdownValue').textContent = count;
    countdownTimer = setInterval(() => {
      count--;
      if (count <= 0) {
        clearInterval(countdownTimer);
        countdownTimer = null;
        $('countdownOverlay').classList.add('hidden');
        beginRace();
      } else $('countdownValue').textContent = count;
    }, 750);
  }
  function beginRace() {
    running = true;
    paused = false;
    elapsed = 0;
    remaining = raceSeconds;
    recentCorrectKeys = [];
    raceEndTime = performance.now() + raceSeconds * 1000;
    racers.slice(1).forEach((car) => (car.baseProgress = car.progress));
    $('startOverlay').classList.add('hidden');
    $('pauseOverlay').classList.add('hidden');
    input.disabled = false;
    input.focus();
    $('pauseButton').disabled = false;
    feedback.textContent = 'Type smoothly to build speed · release to coast';
    feedback.style.color = '';
    startLoop();
  }
  $('startButton').addEventListener('click', () => {
    if (!running && !ended && currentPassage) countdown();
  });
  function togglePause() {
    if (!running || ended) return;
    paused = !paused;
    if (paused) {
      pausedAt = performance.now();
      cancelAnimationFrame(raf);
      $('pauseOverlay').classList.remove('hidden');
      input.disabled = true;
      $('pauseButton').textContent = '▶';
    } else {
      $('pauseOverlay').classList.add('hidden');
      raceEndTime += performance.now() - pausedAt;
      input.disabled = false;
      input.focus();
      $('pauseButton').textContent = 'Ⅱ';
      startLoop();
    }
  }
  $('pauseButton').addEventListener('click', togglePause);
  $('resumeButton').addEventListener('click', togglePause);
  const fullscreenButton = $('fullscreenButton');
  fullscreenButton.addEventListener('click', async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await root.requestFullscreen();
    } catch (error) {
      console.warn('Fullscreen is unavailable:', error);
    }
  });
  document.addEventListener('fullscreenchange', () => {
    const active = document.fullscreenElement === root;
    fullscreenButton.textContent = active ? '⤢' : '⛶';
    fullscreenButton.title = active ? 'Exit fullscreen' : 'Enter fullscreen';
    fullscreenButton.setAttribute('aria-label', active ? 'Exit fullscreen' : 'Enter fullscreen');
    world.resize();
  });
  function cookie(name) {
    const item = document.cookie
      .split(';')
      .map((x) => x.trim())
      .find((x) => x.startsWith(name + '='));
    return item ? decodeURIComponent(item.slice(name.length + 1)) : '';
  }
  async function endGame(reason, finishPosition = 5) {
    if (ended || saving) return;
    ended = true;
    running = false;
    saving = true;
    cancelAnimationFrame(raf);
    input.disabled = true;
    $('pauseButton').disabled = true;
    message(reason, '#fff5c2');
    feedback.textContent = 'Saving race results…';
    const accuracy = typedCharacters ? (correctChars / typedCharacters) * 100 : 100;
    const result = {
      difficulty,
      mode,
      language: mode === 'code' ? language : '',
      finish_position: finishPosition,
      score,
      wpm: Math.round(correctChars / 5 / Math.max(elapsed / 60, 1 / 60)),
      accuracy,
      words_typed: wordsTyped,
      distance: Math.floor(racers[0].progress * 10),
      collisions: 0,
      mistakes,
      duration: raceSeconds,
    };
    try {
      const response = await fetch(root.dataset.saveUrl, {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': cookie('csrftoken'),
        },
        body: JSON.stringify(result),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to save race result.');
      window.location.href = `/car-racing/result/${data.result_id}/`;
    } catch (error) {
      saving = false;
      feedback.textContent = 'Result could not be saved. Refresh to retry.';
      feedback.style.color = '#ff8a81';
      console.error('Car Racing save error:', error);
    }
  }

  $('modeBadge').textContent = mode === 'code' ? 'CODE SYNTAX' : 'PARAGRAPH';
  $('timerValue').textContent = '01:00';
  if (mode === 'code') {
    document.querySelector('.typing-console').classList.add('code-mode');
    $('typingHint').innerHTML =
      '<span class="keycap">TAB</span> INDENTS · <span class="keycap">ENTER</span> NEW LINE';
  }
  renderSentence();
  world.resize();
  world.render(racers, 0);
  updateHud();
  $('startButton').disabled = true;
  feedback.textContent = 'Loading race passages and performance cars…';
  Promise.all([fillPassageQueue(3), world.ready])
    .then(() => loadNextParagraph())
    .then(() => {
      $('startButton').disabled = false;
      feedback.textContent = 'Generated passage ready · click start to race';
    })
    .catch((error) => {
      console.error('Could not prepare race passage:', error);
      feedback.textContent = 'Could not load a passage. Refresh to try again.';
    });
});
