document.addEventListener('DOMContentLoaded', () => {
  const root = document.getElementById('spaceShooterGame');
  if (!root) return;

  const $ = (id) => document.getElementById(id);
  const canvas = $('gameCanvas');
  const ctx = canvas.getContext('2d');
  const arena = $('gameArena');
  const enemyLayer = $('enemyLayer');
  const input = $('typingInput');

  const difficulty = root.dataset.difficulty || 'normal';
  const saveUrl = root.dataset.saveUrl;

  const CONFIG = {
    easy: {
      words: [
        'star',
        'moon',
        'ship',
        'orbit',
        'sun',
        'mars',
        'comet',
        'laser',
        'pilot',
        'nova',
        'earth',
        'cloud',
      ],
      speed: 32,
      spawn: 1.9,
      maxEnemies: 4,
    },
    normal: {
      words: [
        'planet',
        'rocket',
        'galaxy',
        'cosmic',
        'system',
        'meteor',
        'nebula',
        'orbit',
        'asteroid',
        'satellite',
        'captain',
        'mission',
        'engine',
        'oxygen',
        'module',
        'launch',
        'signal',
        'comet',
        'lunar',
        'gravity',
        'energy',
        'radar',
      ],
      speed: 42,
      spawn: 1.55,
      maxEnemies: 5,
    },
    hard: {
      words: [
        'velocity',
        'universe',
        'keyboard',
        'collision',
        'spaceship',
        'magnetic',
        'telescope',
        'astronaut',
        'radiation',
        'navigation',
        'dimension',
        'turbulence',
        'trajectory',
        'frequency',
        'propulsion',
        'hyperspace',
      ],
      speed: 54,
      spawn: 1.22,
      maxEnemies: 6,
    },
    extreme: {
      words: [
        'X9#code',
        '0rb1t$',
        'dev@2026',
        '7*space',
        'run!42',
        'AI_2049',
        'root#99',
        'Q3!nova',
        'ship@7',
        'neo%2026',
        'Z8&star',
        'H@ck5',
        'go2Mars!',
        'sys_404',
      ],
      speed: 64,
      spawn: 0.95,
      maxEnemies: 7,
    },
  };

  const config = CONFIG[difficulty] || CONFIG.normal;
  let width = 0;
  let height = 0;
  let dpr = 1;

  let score = 0;
  let correctChars = 0;
  let totalChars = 0;
  let mistakes = 0;
  let destroyed = 0;
  let missed = 0;
  let shots = 0;
  let combo = 0;
  let wave = 1;
  let elapsed = 0;
  let remaining = 60;
  let spawnClock = 0;
  let lastStats = 0;
  let wrongTimeout = null;

  let paused = false;
  let ended = false;
  let saving = false;
  let animationId = null;
  let previousFrame = 0;

  let activeEnemy = null;
  let targetX = null;
  let manualControl = false;
  let manualDirection = 0;

  let enemies = [];
  let bullets = [];
  let particles = [];
  let stars = [];
  let recentWords = [];

  const ship = {
    x: 0,
    y: 0,
    vx: 0,
    tilt: 0,
    pulse: 0,
  };

  const keys = new Set();

  const scoreEl = $('score');
  const waveEl = $('wave');
  const wpmEl = $('wpm');
  const accuracyEl = $('accuracy');
  const comboEl = $('combo');
  const timerEl = $('missionTimer');
  const statusEl = $('arenaStatus');
  const messageEl = $('gameMessage');
  const shipStatus = $('shipStatus');
  const destroyedEl = $('destroyedCount');
  const pauseButton = $('pauseGame');
  const quitButton = $('quitGame');

  function randomWord() {
    let word;
    let attempts = 0;
    do {
      word = config.words[Math.floor(Math.random() * config.words.length)];
      attempts++;
    } while (recentWords.includes(word) && attempts < 25);

    recentWords.push(word);
    if (recentWords.length > 14) recentWords.shift();
    return word;
  }

  function resize() {
    const rect = arena.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    width = rect.width;
    height = rect.height;
    dpr = Math.min(window.devicePixelRatio || 1, 2);

    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    if (!ship.x) ship.x = width / 2;
    ship.x = Math.max(42, Math.min(width - 42, ship.x));
    ship.y = height - 68;

    stars = Array.from({ length: Math.max(90, Math.floor((width * height) / 6000)) }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      size: Math.random() * 1.7 + 0.35,
      speed: Math.random() * 90 + 25,
      alpha: Math.random() * 0.6 + 0.25,
    }));

    enemies.forEach(updateEnemyPosition);
  }

  function createEnemy() {
    if (ended || enemies.length >= config.maxEnemies) return;

    const word = randomWord();
    const enemy = {
      id: String(Date.now()) + '-' + Math.random(),
      word,
      x: 55 + Math.random() * Math.max(1, width - 110),
      y: -55,
      speed: config.speed * (1 + (wave - 1) * 0.1),
      progress: 0,
      phase: Math.random() * Math.PI * 2,
      wrong: false,
      wrongIndex: -1,
      element: null,
      letters: [],
      pending: 0,
    };

    const element = document.createElement('div');
    element.className = 'ss-enemy';
    enemy.element = element;

    [...word].forEach((letter, index) => {
      const span = document.createElement('span');
      span.className = 'ss-letter';
      span.textContent = letter;
      enemy.letters[index] = span;
      element.appendChild(span);
    });

    enemyLayer.appendChild(element);
    enemies.push(enemy);
    updateEnemyPosition(enemy);
  }

  function updateEnemyPosition(enemy) {
    if (!enemy.element) return;
    enemy.element.style.left = enemy.x + 'px';
    enemy.element.style.top = enemy.y + 34 + 'px';
    enemy.element.style.transform = 'translateX(-50%)';
    enemy.element.classList.toggle('locked', enemy === activeEnemy);
  }

  function selectEnemy(enemy) {
    if (!enemy || activeEnemy) return;
    activeEnemy = enemy;
    manualControl = false;
    targetX = enemy.x;
    statusEl.textContent = 'TARGET LOCK';
    updateEnemyPosition(enemy);
  }

  function releaseEnemy(enemy) {
    if (activeEnemy !== enemy) return;
    activeEnemy = null;
    targetX = null;
    enemy.element?.classList.remove('locked');
  }

  function handleType(event) {
    if (paused || ended || saving) return;
    if (event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.key.length !== 1) return;

    const allowed =
      difficulty === 'extreme'
        ? /^[a-zA-Z0-9@#$%&*!?+\-_=]$/.test(event.key)
        : /^[a-zA-Z]$/.test(event.key);
    if (!allowed) return;

    event.preventDefault();
    const character = /^[a-zA-Z]$/.test(event.key) ? event.key.toLowerCase() : event.key;

    totalChars++;

    if (!activeEnemy) {
      const match = enemies
        .filter((enemy) => enemy.word.startsWith(character))
        .sort((a, b) => b.y - a.y)[0];

      if (!match) {
        mistakes++;
        combo = 0;
        statusEl.textContent = 'NO SIGNAL';
        updateStats();
        return;
      }
      selectEnemy(match);
    }

    if (!activeEnemy) return;

    const expected = activeEnemy.word[activeEnemy.progress];
    if (character !== expected) {
      mistakes++;
      combo = 0;
      statusEl.textContent = 'WRONG CHARACTER';
      showWrong(activeEnemy);
      updateStats();
      return;
    }

    const enemy = activeEnemy;
    const letter = enemy.letters[enemy.progress];
    enemy.progress++;
    enemy.pending++;
    correctChars++;
    enemy.wrong = false;

    fireBullet(enemy, letter);
    statusEl.textContent = 'ENGAGING';
    updateStats();
  }

  function showWrong(enemy) {
    const letter = enemy.letters[enemy.progress];
    if (!letter) return;
    letter.classList.remove('wrong');
    void letter.offsetWidth;
    letter.classList.add('wrong');
    clearTimeout(wrongTimeout);
    wrongTimeout = setTimeout(() => letter.classList.remove('wrong'), 280);
  }

  function getElementPosition(element) {
    const rect = element.getBoundingClientRect();
    const arenaRect = arena.getBoundingClientRect();
    return {
      x: rect.left + rect.width / 2 - arenaRect.left,
      y: rect.top + rect.height / 2 - arenaRect.top,
    };
  }

  function fireBullet(enemy, letter) {
    const target = getElementPosition(letter);
    shots++;
    bullets.push({
      x: ship.x,
      y: ship.y - 38,
      targetX: target.x,
      targetY: target.y,
      element: letter,
      enemy,
      progress: 0,
      duration: 0.11,
    });
  }

  function updateBullets(dt) {
    const impacts = [];

    for (const bullet of bullets) {
      bullet.progress += dt / bullet.duration;
      const t = Math.min(bullet.progress, 1);
      if (bullet.element?.isConnected) {
        const target = getElementPosition(bullet.element);
        bullet.targetX = target.x;
        bullet.targetY = target.y;
      }

      const eased = 1 - Math.pow(1 - t, 3);
      bullet.xVisual = bullet.x + (bullet.targetX - bullet.x) * eased;
      bullet.yVisual = bullet.y + (bullet.targetY - bullet.y) * eased;

      if (bullet.progress >= 1) impacts.push(bullet);
    }

    bullets = bullets.filter((bullet) => bullet.progress < 1);

    for (const bullet of impacts) {
      if (bullet.element?.isConnected) {
        bullet.element.classList.add('destroyed');
        createImpact(bullet.targetX, bullet.targetY);
      }
      bullet.enemy.pending = Math.max(0, bullet.enemy.pending - 1);

      if (bullet.enemy.progress === bullet.enemy.word.length && bullet.enemy.pending === 0) {
        destroyEnemy(bullet.enemy);
      }
    }
  }

  function destroyEnemy(enemy) {
    if (!enemies.includes(enemy)) return;
    createExplosion(enemy.x, enemy.y, 18);
    enemy.element?.remove();
    enemies = enemies.filter((item) => item !== enemy);
    releaseEnemy(enemy);

    destroyed++;
    combo++;
    score += enemy.word.length * 125 + combo * 35;
    wave = Math.floor(destroyed / 5) + 1;
    destroyedEl.textContent = destroyed;
    statusEl.textContent = 'TARGET DESTROYED';
    updateStats();
  }

  function updateEnemies(dt) {
    for (const enemy of [...enemies]) {
      enemy.y += enemy.speed * dt;
      enemy.phase += dt * 3.2;
      enemy.x += Math.sin(enemy.phase) * 7 * dt;
      enemy.x = Math.max(42, Math.min(width - 42, enemy.x));
      updateEnemyPosition(enemy);

      if (enemy.y >= ship.y - 28) {
        missed++;
        combo = 0;
        createExplosion(enemy.x, ship.y - 10, 28);
        enemy.element?.remove();
        enemies = enemies.filter((item) => item !== enemy);
        if (activeEnemy === enemy) releaseEnemy(enemy);
        shipStatus.textContent = missed >= 3 ? 'CRITICAL' : 'UNDER FIRE';
        statusEl.textContent = 'SHIELD HIT';
        updateStats();
      }
    }
  }

  function updateShip(dt) {
    if (keys.has('a') || keys.has('arrowleft')) manualDirection = -1;
    else if (keys.has('d') || keys.has('arrowright')) manualDirection = 1;
    else manualDirection = 0;

    if (manualDirection) {
      manualControl = true;
      targetX = null;
    }

    if (manualControl) {
      const desired = manualDirection * 820;
      ship.vx += (desired - ship.vx) * Math.min(1, 8 * dt);
      if (!manualDirection) ship.vx *= Math.max(0, 1 - 7 * dt);
    } else if (activeEnemy && enemies.includes(activeEnemy)) {
      targetX = activeEnemy.x;
      const difference = targetX - ship.x;
      const desired = Math.sign(difference) * Math.min(880, Math.abs(difference) * 9);
      ship.vx += (desired - ship.vx) * Math.min(1, 10 * dt);
    } else {
      targetX = null;
      ship.vx *= Math.max(0, 1 - 5.5 * dt);
    }

    ship.x += ship.vx * dt;
    ship.x = Math.max(42, Math.min(width - 42, ship.x));
    if (ship.x <= 42 || ship.x >= width - 42) ship.vx *= 0.35;

    const tiltTarget = Math.max(-0.28, Math.min(0.28, (ship.vx / 880) * 0.28));
    ship.tilt += (tiltTarget - ship.tilt) * Math.min(1, 11 * dt);
  }

  function createImpact(x, y) {
    for (let i = 0; i < 7; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 90 + Math.random() * 150;
      particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.25 + Math.random() * 0.25,
        maxLife: 0.5,
        size: 1 + Math.random() * 2,
        color: '#72e8ff',
      });
    }
  }

  function createExplosion(x, y, count = 16) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 70 + Math.random() * 240;
      particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.45 + Math.random() * 0.55,
        maxLife: 1,
        size: 2 + Math.random() * 4,
        color: i % 3 ? '#ff5b73' : '#72e8ff',
      });
    }
  }

  function updateParticles(dt) {
    for (const particle of particles) {
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.vx *= Math.pow(0.94, dt * 60);
      particle.vy *= Math.pow(0.94, dt * 60);
      particle.life -= dt;
    }
    particles = particles.filter((particle) => particle.life > 0);
  }

  function drawBackground(dt) {
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, '#020817');
    gradient.addColorStop(0.55, '#07132a');
    gradient.addColorStop(1, '#020611');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    const glow = ctx.createRadialGradient(
      width * 0.5,
      height * 0.45,
      10,
      width * 0.5,
      height * 0.45,
      width * 0.7,
    );
    glow.addColorStop(0, 'rgba(45, 116, 180, .16)');
    glow.addColorStop(1, 'rgba(2, 6, 17, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, width, height);

    ctx.save();
    ctx.strokeStyle = 'rgba(114, 232, 255, .035)';
    ctx.lineWidth = 1;
    for (let x = 0; x < width; x += 48) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y < height; y += 48) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
    ctx.restore();

    for (const star of stars) {
      star.y += star.speed * dt;
      if (star.y > height) {
        star.y = -5;
        star.x = Math.random() * width;
      }
      ctx.globalAlpha = star.alpha;
      ctx.fillStyle = '#d8efff';
      ctx.fillRect(star.x, star.y, star.size, star.size);
    }
    ctx.globalAlpha = 1;
  }

  function drawShip(dt) {
    ship.pulse += dt * 10;
    ctx.save();
    ctx.translate(ship.x, ship.y);
    ctx.rotate(ship.tilt);

    ctx.globalCompositeOperation = 'lighter';
    const flame = ctx.createLinearGradient(0, 10, 0, 54);
    flame.addColorStop(0, '#fff');
    flame.addColorStop(0.25, '#72e8ff');
    flame.addColorStop(1, 'rgba(34, 201, 239, 0)');
    ctx.fillStyle = flame;
    ctx.beginPath();
    ctx.moveTo(-8, 13);
    ctx.lineTo(0, 46 + Math.sin(ship.pulse) * 5);
    ctx.lineTo(8, 13);
    ctx.closePath();
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';

    ctx.shadowColor = '#72e8ff';
    ctx.shadowBlur = 22;

    const hull = ctx.createLinearGradient(-18, -35, 18, 25);
    hull.addColorStop(0, '#f1fbff');
    hull.addColorStop(0.28, '#72bde8');
    hull.addColorStop(0.65, '#275a91');
    hull.addColorStop(1, '#09172d');
    ctx.fillStyle = hull;
    ctx.beginPath();
    ctx.moveTo(0, -42);
    ctx.lineTo(14, -12);
    ctx.lineTo(31, 12);
    ctx.lineTo(11, 8);
    ctx.lineTo(0, 21);
    ctx.lineTo(-11, 8);
    ctx.lineTo(-31, 12);
    ctx.lineTo(-14, -12);
    ctx.closePath();
    ctx.fill();

    ctx.shadowBlur = 12;
    ctx.fillStyle = '#72e8ff';
    ctx.beginPath();
    ctx.ellipse(0, -13, 5, 12, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  function drawEnemy(enemy) {
    ctx.save();
    ctx.translate(enemy.x, enemy.y);
    ctx.rotate(Math.sin(enemy.phase) * 0.08);

    ctx.shadowColor = '#ff5b73';
    ctx.shadowBlur = 24;
    ctx.strokeStyle = 'rgba(255, 91, 115, .8)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 21, 0, Math.PI * 2);
    ctx.stroke();

    const core = ctx.createRadialGradient(-6, -7, 2, 0, 0, 20);
    core.addColorStop(0, '#ffc1cb');
    core.addColorStop(0.3, '#ed4768');
    core.addColorStop(1, '#4a1024');
    ctx.fillStyle = core;
    ctx.beginPath();
    ctx.arc(0, 0, 17, 0, Math.PI * 2);
    ctx.fill();

    ctx.shadowColor = '#72e8ff';
    ctx.shadowBlur = activeEnemy === enemy ? 18 : 8;
    ctx.fillStyle = activeEnemy === enemy ? '#72e8ff' : '#fff0f3';
    ctx.beginPath();
    ctx.arc(0, 0, activeEnemy === enemy ? 5 : 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    if (activeEnemy === enemy) {
      ctx.save();
      ctx.strokeStyle = 'rgba(114, 232, 255, .62)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 7]);
      ctx.beginPath();
      ctx.arc(enemy.x, enemy.y, 31, elapsed * 2, elapsed * 2 + Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawBullets() {
    for (const bullet of bullets) {
      if (bullet.progress >= 1) continue;
      const x = bullet.xVisual ?? bullet.x;
      const y = bullet.yVisual ?? bullet.y;

      ctx.save();
      ctx.shadowColor = '#72e8ff';
      ctx.shadowBlur = 18;
      ctx.strokeStyle = '#d8fbff';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(x, y + 18);
      ctx.lineTo(x, y - 18);
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawParticles() {
    for (const particle of particles) {
      const alpha = Math.max(0, particle.life / particle.maxLife);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = particle.color;
      ctx.shadowColor = particle.color;
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  function drawFrame(dt) {
    drawBackground(dt);
    enemies.forEach(drawEnemy);
    drawBullets();
    drawParticles();
    drawShip(dt);
  }

  function updateStats() {
    scoreEl.textContent = String(score).padStart(6, '0');
    waveEl.textContent = String(wave).padStart(2, '0');
    comboEl.textContent = '×' + combo;

    const wpm = Math.round(correctChars / 5 / Math.max(elapsed / 60, 1 / 60));
    wpmEl.textContent = String(wpm).padStart(3, '0');
    const accuracy = totalChars ? (correctChars / totalChars) * 100 : 100;
    accuracyEl.textContent = accuracy.toFixed(accuracy >= 99.95 ? 0 : 1) + '%';
  }

  function updateGame(dt) {
    elapsed += dt;
    remaining -= dt;
    spawnClock += dt;
    ship.pulse += dt;

    const interval = Math.max(
      difficulty === 'extreme' ? 0.72 : 0.82,
      config.spawn - (wave - 1) * 0.04,
    );
    if (spawnClock >= interval) {
      spawnClock = 0;
      createEnemy();
    }

    updateEnemies(dt);
    updateBullets(dt);
    updateParticles(dt);
    updateShip(dt);

    if (elapsed - lastStats >= 0.25) {
      lastStats = elapsed;
      updateStats();
    }

    const seconds = Math.max(0, Math.ceil(remaining));
    const minutes = Math.floor(seconds / 60);
    const secondsLeft = seconds % 60;
    timerEl.textContent =
      String(minutes).padStart(2, '0') + ':' + String(secondsLeft).padStart(2, '0');

    if (missed >= 3) {
      endGame();
      return;
    }
    if (remaining <= 0) {
      remaining = 0;
      endGame();
    }
  }

  function gameLoop(timestamp) {
    if (paused || ended) return;
    const dt = previousFrame ? Math.min((timestamp - previousFrame) / 1000, 0.05) : 0;
    previousFrame = timestamp;
    updateGame(dt);
    if (!ended) {
      drawFrame(dt);
      animationId = requestAnimationFrame(gameLoop);
    }
  }

  function startLoop() {
    previousFrame = 0;
    cancelAnimationFrame(animationId);
    animationId = requestAnimationFrame(gameLoop);
  }

  function cookie(name) {
    const pair = document.cookie
      .split(';')
      .map((item) => item.trim())
      .find((item) => item.startsWith(name + '='));
    return pair ? decodeURIComponent(pair.split('=').slice(1).join('=')) : '';
  }

  async function endGame() {
    if (ended || saving) return;
    ended = true;
    saving = true;
    cancelAnimationFrame(animationId);
    input.disabled = true;

    statusEl.textContent = 'MISSION COMPLETE';
    shipStatus.textContent = 'STABLE';

    const accuracy = totalChars ? (correctChars / totalChars) * 100 : 100;
    const wpm = Math.round(correctChars / 5 / Math.max(elapsed / 60, 1 / 60));
    const payload = {
      difficulty,
      score,
      wpm,
      accuracy,
      words_destroyed: destroyed,
      missed_words: missed,
      mistakes,
      shots_fired: shots,
      highest_wave: wave,
      duration: Math.max(1, Math.round(elapsed)),
    };

    try {
      const response = await fetch(saveUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': cookie('csrftoken'),
        },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to save result');
      window.location.href = '/space-shooter/result/' + data.result_id + '/';
    } catch (error) {
      ended = false;
      saving = false;
      input.disabled = false;
      statusEl.textContent = 'SAVE FAILED';
      alert(error.message);
    }
  }

  document.addEventListener('keydown', (event) => {
    const key = event.key.toLowerCase();
    if (['arrowleft', 'arrowright', 'a', 'd'].includes(key)) {
      event.preventDefault();
      keys.add(key);
      if (
        activeEnemy &&
        (key === 'arrowleft' || key === 'arrowright' || key === 'a' || key === 'd')
      ) {
        manualControl = true;
        targetX = null;
      }
    }
    handleType(event);
  });

  document.addEventListener('keyup', (event) => {
    keys.delete(event.key.toLowerCase());
    if (!keys.has('a') && !keys.has('d') && !keys.has('arrowleft') && !keys.has('arrowright')) {
      manualControl = false;
    }
  });

  pauseButton.addEventListener('click', () => {
    if (ended || saving) return;
    paused = !paused;
    pauseButton.innerHTML = paused ? '▶ &nbsp; RESUME' : 'Ⅱ &nbsp; PAUSE';

    if (paused) {
      cancelAnimationFrame(animationId);
      messageEl.style.display = 'flex';
      messageEl.querySelector('span').textContent = 'MISSION HOLD';
      messageEl.querySelector('strong').textContent = 'PAUSED';
    } else {
      messageEl.style.display = 'none';
      shipStatus.textContent = 'ONLINE';
      startLoop();
    }
  });

  quitButton.addEventListener('click', () => {
    if (confirm('End this mission and save your result?')) endGame();
  });

  window.addEventListener('resize', resize);
  arena.addEventListener('click', () => input.focus());

  resize();
  shipStatus.textContent = 'ONLINE';
  statusEl.textContent = 'ENEMY SCANNING';
  updateStats();
  createEnemy();
  input.focus();
  startLoop();
});
