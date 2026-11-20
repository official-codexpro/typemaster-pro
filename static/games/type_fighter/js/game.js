import { DIFFICULTIES, customConfiguration, paragraphsForDifficulty } from '../src/difficulty.js';
import {
  consumeParagraphCharacter,
  getParagraphWords,
  inspectTypingInput,
  normalizeMistakeWord,
} from '../src/typing-input.js';

document.addEventListener('DOMContentLoaded', () => {
  const root = document.getElementById('typeFighterGame');
  if (!root) return;

  const $ = (id) => document.getElementById(id);
  const arena = $('gameArena');
  const input = $('typingInput');
  const typingPassage = $('typingPassage');
  const attackUnitLabel = $('attackUnitLabel');
  const resultPanel = $('matchResult');
  const saveRetryButton = $('retrySaveResult');
  const guardButton = $('guardGame');
  const specialButton = $('specialGame');
  const difficulty = root.dataset.difficulty || 'normal';
  const mode = root.dataset.mode || 'arcade';
  const params = new URLSearchParams(window.location.search);
  const saveUrl = root.dataset.saveUrl;
  const homeUrl = root.dataset.homeUrl || '/type-fighter/';
  const restartUrl = root.dataset.restartUrl || `${homeUrl}play/`;

  if (!arena || !input || !typingPassage) {
    console.error('Type Fighter: Required game elements are missing.');
    return;
  }

  const config =
    difficulty === 'custom'
      ? customConfiguration(Object.fromEntries(params))
      : DIFFICULTIES[difficulty] || DIFFICULTIES.normal;
  const matchDuration = Math.max(30, Math.min(60, Number(params.get('duration')) || 60));
  const maximumRounds = 3;
  const roundsToWin = 2;
  const guardDuration = 1.65;
  const guardCooldown = 4.8;
  const comboWindow = config.comboWindow || 3.2;
  const specialRequirement = 40 + (config.specialWords || 4) * 5;

  let score = 0;
  let combo = 0;
  let bestCombo = 0;
  let knockouts = 0;
  let enemyRoundWins = 0;
  let damageDealt = 0;
  let damageReceived = 0;
  let failedAttacks = 0;
  let successfulAttacks = 0;
  let highestWpm = 0;
  let perfectInputs = 0;
  let wordsCompleted = 0;
  let correctCharacters = 0;
  let attemptedCharacters = 0;
  let correctCharacterTimes = [];
  let mistakes = 0;
  let elapsedTime = 0;
  let remainingTime = matchDuration;
  let playerHealth = 100;
  let enemyHealth = 100;
  let energy = 0;
  let currentWord = '';
  let typedWord = '';
  let typedParagraph = '';
  let sentenceWords = [];
  let paragraphIndex = 0;
  let activeWordIndex = 0;
  let lockedPrefixIndex = 0;
  let sentenceText = '';
  let wordMistakes = 0;
  let mistakeWords = [];
  let recentMoves = [];
  let paused = false;
  let ended = false;
  let saving = false;
  let timeExpired = false;
  let finalizingResult = false;
  let enemyDown = false;
  let playerDown = false;
  let roundOver = false;
  let fightStarted = false;
  let roundTransitionAt = 0;
  let guardActiveUntil = 0;
  let guardReadyAt = 0;
  let guardStartedAt = 0;
  let enemyGuardUntil = 0;
  let enemyActionState = 'approach';
  let enemyActionTimer = 0;
  let enemyRecoveryUntil = 0;
  let enemyNextDecisionAt = 1.3;
  let enemyComboLeft = 0;
  let enemyComboAt = 0;
  let enemyAttackCount = 0;
  let lastPlayerAttackAt = -10;
  let lastFrame = 0;
  let animationFrame = null;
  let wordElement = null;
  let moveLabel = null;
  let letterElements = [];
  let wordElements = [];
  let renderedParagraph = '';
  let renderedIndex = -1;
  let renderedWordIndex = -1;
  let renderedWrongIndex = -1;
  let lastWpmSampleAt = 0;
  let pendingResult = null;
  let audioContext = null;
  let soundEnabled = true;
  let movement = { forward: 0, lateral: 0, dash: false, crouch: false };
  let wrongLetterTimeout = null;
  let wrongLetterIndex = -1;
  let activeWordToken = 0;
  const scheduledTimeouts = new Set();
  const listenerController = new AbortController();
  const listenerOptions = { signal: listenerController.signal };

  function scheduleTimeout(callback, delay) {
    const timeout = window.setTimeout(() => {
      scheduledTimeouts.delete(timeout);
      callback();
    }, delay);
    scheduledTimeouts.add(timeout);
    return timeout;
  }

  function clearScheduledTimeouts() {
    scheduledTimeouts.forEach((timeout) => window.clearTimeout(timeout));
    scheduledTimeouts.clear();
  }

  function clearScheduledTimeout(timeout) {
    if (!timeout) return;
    window.clearTimeout(timeout);
    scheduledTimeouts.delete(timeout);
  }

  const moveProfiles = {
    jab: { title: 'QUICK JAB', damage: 8, energy: 7, recovery: 0.28, range: 4.2, score: 90 },
    kick: { title: 'ROUND KICK', damage: 11, energy: 9, recovery: 0.4, range: 4.45, score: 130 },
    launcher: {
      title: 'RISING LAUNCH',
      damage: 15,
      energy: 13,
      recovery: 0.58,
      range: 4.7,
      score: 190,
    },
    heavy: {
      title: 'HEAVY BREAKER',
      damage: 19,
      energy: 16,
      recovery: 0.72,
      range: 4.85,
      score: 250,
    },
    special: {
      title: 'NOVA BREAKER',
      damage: 32,
      energy: 0,
      recovery: 0.9,
      range: 5.1,
      score: 500,
    },
  };

  function createMatchId() {
    if (window.crypto?.randomUUID) return window.crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (character) => {
      const value = Math.floor(Math.random() * 16);
      return (character === 'x' ? value : (value & 0x3) | 0x8).toString(16);
    });
  }

  const matchId = createMatchId();

  function setText(id, value) {
    const element = typeof id === 'string' ? $(id) : id;
    const text = String(value);
    if (element && element.textContent !== text) element.textContent = text;
  }

  function setStatus(message) {
    setText('arenaStatus', message);
  }

  function clamp(value, minimum, maximum) {
    return Math.max(minimum, Math.min(maximum, value));
  }

  function getAccuracy() {
    return attemptedCharacters
      ? Number(((correctCharacters / attemptedCharacters) * 100).toFixed(1))
      : 100;
  }

  function getWpm() {
    return Math.round((correctCharacters / 5 / Math.max(elapsedTime, 1)) * 60);
  }

  function sound(kind = 'hit') {
    if (!soundEnabled) return;
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;
      audioContext ||= new AudioContextClass();
      if (audioContext.state === 'suspended') audioContext.resume();
      const now = audioContext.currentTime;
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      const presets = {
        hit: [150, 72, 0.12, 'triangle'],
        kick: [115, 54, 0.16, 'sawtooth'],
        block: [540, 260, 0.11, 'square'],
        special: [240, 880, 0.34, 'sawtooth'],
        wrong: [165, 95, 0.1, 'square'],
        perfect: [560, 1040, 0.18, 'sine'],
      };
      const [startHz, endHz, duration, wave] = presets[kind] || presets.hit;
      oscillator.type = wave;
      oscillator.frequency.setValueAtTime(startHz, now);
      oscillator.frequency.exponentialRampToValueAtTime(Math.max(30, endHz), now + duration);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(kind === 'special' ? 0.14 : 0.07, now + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
      oscillator.connect(gain).connect(audioContext.destination);
      oscillator.start(now);
      oscillator.stop(now + duration + 0.02);
    } catch (error) {
      console.debug('Type Fighter audio is unavailable.', error);
    }
  }

  function createWordDisplay() {
    wordElement = typingPassage;
    moveLabel = attackUnitLabel;
  }

  function getMoveForWord(word = currentWord) {
    const length = [...word].length;
    if (length <= 4) return moveProfiles.jab;
    if (length <= 7) return moveProfiles.kick;
    if (length <= 10) return moveProfiles.launcher;
    return moveProfiles.heavy;
  }

  function renderWord() {
    if (!wordElement) return;
    const rebuild = sentenceText !== renderedParagraph;
    if (rebuild) {
      const fragment = document.createDocumentFragment();
      letterElements = Array.from({ length: [...sentenceText].length });
      wordElements = [];
      sentenceWords.forEach((range, wordIndex) => {
        if (wordIndex > 0) {
          const separatorIndex = range.start - 1;
          const separator = document.createElement('span');
          separator.className = 'letter separator-character';
          separator.textContent = ' ';
          letterElements[separatorIndex] = separator;
          fragment.appendChild(separator);
        }
        const wordSpan = document.createElement('span');
        wordSpan.className = 'typing-word';
        wordElements.push(wordSpan);
        [...range.text].forEach((character, index) => {
          const characterIndex = range.start + index;
          const letter = document.createElement('span');
          letter.className = 'letter';
          letter.textContent = character;
          letterElements[characterIndex] = letter;
          wordSpan.appendChild(letter);
        });
        fragment.appendChild(wordSpan);
      });
      wordElement.replaceChildren(fragment);
      wordElement.setAttribute('aria-label', `Type: ${sentenceText}`);
      renderedParagraph = sentenceText;
      renderedIndex = 0;
      renderedWordIndex = -1;
      renderedWrongIndex = -1;
    }

    const previousIndex = renderedIndex;
    if (paragraphIndex > previousIndex) {
      for (let index = previousIndex; index < paragraphIndex; index += 1) {
        letterElements[index]?.classList.add('typed');
      }
    } else if (paragraphIndex < previousIndex) {
      for (let index = paragraphIndex; index < previousIndex; index += 1) {
        letterElements[index]?.classList.remove('typed');
      }
    }
    letterElements[previousIndex]?.classList.remove('current-character');
    letterElements[paragraphIndex]?.classList.add('current-character');

    if (renderedWrongIndex !== wrongLetterIndex) {
      letterElements[renderedWrongIndex]?.classList.remove('wrong');
      letterElements[wrongLetterIndex]?.classList.add('wrong');
    }

    if (renderedWordIndex !== activeWordIndex) {
      wordElements[renderedWordIndex]?.classList.remove('current');
      wordElements[renderedWordIndex]?.classList.toggle(
        'typed',
        Boolean(sentenceWords[renderedWordIndex]?.end <= paragraphIndex),
      );
      wordElements[activeWordIndex]?.classList.add('current');
      const move = getMoveForWord();
      if (moveLabel) moveLabel.textContent = `${move.title} · ${move.damage} BASE DMG`;
    }

    renderedIndex = paragraphIndex;
    renderedWordIndex = activeWordIndex;
    renderedWrongIndex = wrongLetterIndex;
  }

  function nextWord(newParagraph = false) {
    activeWordToken += 1;
    if (newParagraph || !sentenceText || paragraphIndex >= [...sentenceText].length) {
      const paragraphs = paragraphsForDifficulty(difficulty, config);
      sentenceText = paragraphs[Math.floor(Math.random() * paragraphs.length)];
      sentenceWords = getParagraphWords(sentenceText);
      paragraphIndex = 0;
      activeWordIndex = 0;
      lockedPrefixIndex = 0;
      typedParagraph = '';
    }
    currentWord = sentenceWords[activeWordIndex]?.text || '';
    const activeRange = sentenceWords[activeWordIndex];
    typedWord = activeRange
      ? [...sentenceText].slice(activeRange.start, paragraphIndex).join('')
      : '';
    wrongLetterIndex = -1;
    input.value = typedParagraph;
    input.maxLength = sentenceText.length;
    renderWord();
    if (!input.disabled) input.focus({ preventScroll: true });
  }

  function applyPlayerDamage(amount) {
    if (mode === 'training' || amount <= 0) return 0;
    const applied = Math.min(playerHealth, amount);
    playerHealth = clamp(playerHealth - applied, 0, 100);
    damageReceived += applied;
    return applied;
  }

  function addEnergy(value) {
    energy = clamp(energy + value, 0, 100);
  }

  function setMovement(nextMovement = {}) {
    movement = { ...movement, ...nextMovement };
    window.typeFighter3D?.move('player', movement);
  }

  function stopMovement() {
    movement = { forward: 0, lateral: 0, dash: false, crouch: false };
    window.typeFighter3D?.move('player', movement);
  }

  function updateControls() {
    const guardRemaining = Math.max(0, guardReadyAt - elapsedTime);
    const controlsDisabled = !fightStarted || ended || paused || roundOver || timeExpired;
    if (guardButton) {
      const disabled = controlsDisabled || guardRemaining > 0;
      if (guardButton.disabled !== disabled) guardButton.disabled = disabled;
      guardButton.setAttribute(
        'aria-label',
        guardRemaining > 0
          ? `Guard cooldown ${Math.ceil(guardRemaining)} seconds`
          : 'Guard for the next attack',
      );
      const label =
        guardRemaining > 0
          ? `⬡ GUARD <small>${Math.ceil(guardRemaining)}s</small>`
          : '⬡ GUARD <kbd>SHIFT</kbd>';
      if (guardButton.dataset.label !== label) {
        guardButton.innerHTML = label;
        guardButton.dataset.label = label;
      }
    }
    if (specialButton) {
      const disabled = controlsDisabled || energy < specialRequirement || enemyDown;
      if (specialButton.disabled !== disabled) specialButton.disabled = disabled;
      specialButton.setAttribute(
        'aria-label',
        `Special attack. ${Math.max(0, specialRequirement - Math.floor(energy))} energy required.`,
      );
    }
    document.querySelectorAll('[data-move]').forEach((button) => {
      button.disabled = controlsDisabled;
    });
  }

  function updateStats() {
    const wpm = getWpm();
    const accuracy = getAccuracy();
    const seconds = Math.max(0, Math.ceil(remainingTime));
    const roundNumber = Math.min(knockouts + enemyRoundWins + 1, maximumRounds);

    setText('score', String(score).padStart(6, '0'));
    setText('round', String(roundNumber).padStart(2, '0'));
    setText('wpm', String(wpm).padStart(3, '0'));
    setText('accuracy', `${accuracy}%`);
    setText('wordTimer', mode === 'training' ? 'PRACTICE' : 'NO RUSH');
    setText('combo', `×${combo}`);
    setText('destroyedCount', `${knockouts}–${enemyRoundWins}`);
    setText(
      'missionTimer',
      `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`,
    );
    setText('playerHealth', `${Math.round(playerHealth)}%`);
    setText('enemyHealth', `${Math.round(enemyHealth)}%`);
    setText('energyValue', `${Math.round(energy)}%`);

    const playerBar = $('playerHealthBar');
    const enemyBar = $('enemyHealthBar');
    const energyBar = $('energyBar');
    if (playerBar) playerBar.style.width = `${playerHealth}%`;
    if (enemyBar) enemyBar.style.width = `${enemyHealth}%`;
    if (energyBar) energyBar.style.width = `${energy}%`;
    root.classList.toggle('player-critical', playerHealth <= 25);
    updateControls();
  }

  function beginRoundTransition(winner) {
    if (roundOver || ended) return;
    roundOver = true;
    if (winner === 'player') {
      knockouts += 1;
      score += 500;
      setStatus(`ROUND ${knockouts} WON`);
      setText('shipStatus', 'OPPONENT DOWN');
    } else {
      enemyRoundWins += 1;
      playerDown = true;
      setStatus(`ROUND ${enemyRoundWins} LOST · RESETTING`);
      setText('shipStatus', 'RECOVERING');
    }
    const defeatedSide = winner === 'player' ? 'enemy' : 'player';
    const defeatDuration = window.typeFighter3D?.knockout?.(defeatedSide) || 1.05;
    stopMovement();
    input.disabled = true;
    if (knockouts >= roundsToWin || enemyRoundWins >= roundsToWin) {
      finalizingResult = true;
      updateStats();
      scheduleTimeout(
        () => finishMatch(knockouts >= roundsToWin ? 'win' : 'loss'),
        Math.round(defeatDuration * 1000),
      );
      return;
    }
    roundTransitionAt = elapsedTime + Math.max(1.05, defeatDuration);
    updateStats();
  }

  function applyPlayerAttack(moveType = null, isSpecial = false, mistakeFree = wordMistakes === 0) {
    if (ended || roundOver) return;
    const move = isSpecial ? moveProfiles.special : moveType || getMoveForWord();
    const type = isSpecial
      ? 'special'
      : Object.keys(moveProfiles).find((key) => moveProfiles[key] === move) || 'jab';
    const distance = window.typeFighter3D?.distance?.() ?? 3.4;
    if (distance > move.range + 0.25) {
      window.typeFighter3D?.move('player', { ...movement, forward: 1, dash: true });
    }

    const counterHit = enemyActionState === 'recover' || enemyActionState === 'attack';
    addEnergy(isSpecial ? -60 : move.energy + (mistakeFree ? 3 : 0));
    recentMoves.push(type);
    recentMoves = recentMoves.slice(-4);
    let impactResolved = false;
    const resolveImpact = (impact = {}) => {
      if (impactResolved) return;
      impactResolved = true;
      if (ended || roundOver) return;
      const targetHittable = !enemyDown && window.typeFighter3D?.canBeHit?.('enemy') === true;
      const targetEvading = window.typeFighter3D?.isEvading?.('enemy') === true;
      const impactDistance = window.typeFighter3D?.distance?.() ?? Infinity;
      if (!targetHittable || targetEvading || impactDistance > move.range) {
        failedAttacks += 1;
        combo = 0;
        setStatus(
          !targetHittable
            ? 'ATTACK MISSED · OPPONENT IS NOT VULNERABLE'
            : targetEvading
              ? 'ATTACK EVADED · RESET YOUR COMBO'
              : 'ATTACK OUT OF RANGE · CLOSE THE DISTANCE',
        );
        setText('shipStatus', 'ATTACK MISSED');
        updateStats();
        return;
      }
      const blocked = elapsedTime < enemyGuardUntil;
      const comboDamage = 1 + Math.min(0.38, combo * 0.055);
      const typingQuality =
        mistakeFree && getAccuracy() >= config.accuracy * 100 ? 1.12 : mistakeFree ? 0.9 : 0.72;
      const rawDamage = move.damage * comboDamage * typingQuality * (config.playerDamage || 1);
      const damage = Math.max(2, Math.round(rawDamage * (blocked ? 0.28 : 1)));
      const actualDamage = Math.min(enemyHealth, damage);
      damageDealt += actualDamage;
      enemyHealth = clamp(enemyHealth - actualDamage, 0, 100);
      if (blocked) {
        failedAttacks += 1;
        combo = 0;
      } else {
        successfulAttacks += 1;
        combo = elapsedTime - lastPlayerAttackAt <= comboWindow ? combo + 1 : 1;
        if (actualDamage > 0) {
          window.typeFighter3D?.react?.(
            'enemy',
            impact.reactionId,
            isSpecial ? 1.65 : type === 'launcher' ? 1.25 : 1,
          );
        }
      }
      lastPlayerAttackAt = elapsedTime;
      bestCombo = Math.max(bestCombo, combo);
      score += move.score + (mistakeFree ? 25 : 0) + (counterHit ? 80 : 0);
      enemyGuardUntil = Math.max(0, enemyGuardUntil - (blocked ? 0.3 : 0));
      sound(isSpecial ? 'special' : type === 'kick' || type === 'heavy' ? 'kick' : 'hit');

      if (isSpecial) {
        setStatus('NOVA BREAKER · SPECIAL ATTACK');
        setText('shipStatus', 'POWER RELEASED');
      } else if (blocked) {
        setStatus(`BLOCKED · ${damage} CHIP DAMAGE · FIND AN OPENING`);
        setText('shipStatus', 'ATTACK PARRIED');
        sound('block');
      } else if (counterHit) {
        setStatus(`COUNTER HIT · ${combo} HIT COMBO · ${damage} DAMAGE`);
        setText('shipStatus', combo >= 4 ? 'DEVASTATING COMBO' : 'COUNTER ATTACK');
      } else {
        setStatus(`${move.title} · ${combo} HIT COMBO · ${damage} DAMAGE`);
        setText('shipStatus', mistakeFree ? 'PERFECT INPUT' : 'ATTACK CONNECTED');
      }
      if (mistakeFree) sound('perfect');
      if (enemyHealth <= 0) {
        enemyDown = true;
        if (mode === 'training') {
          score += 250;
          const defeatDuration = window.typeFighter3D?.knockout?.('enemy') || 1.2;
          scheduleTimeout(
            () => {
              window.typeFighter3D?.resetFighter('enemy');
              enemyHealth = 100;
              enemyDown = false;
              updateStats();
            },
            Math.round(defeatDuration * 1000),
          );
          setStatus('PRACTICE HIT · TRY ANOTHER COMBINATION');
        } else beginRoundTransition('player');
      }
      updateStats();
    };
    const onInterrupted = () => {
      if (ended || roundOver || enemyDown) return;
      if (impactResolved) return;
      impactResolved = true;
      failedAttacks += 1;
      combo = 0;
      setStatus('ATTACK INTERRUPTED · RESET YOUR COMBO');
      updateStats();
    };
    if (!window.typeFighter3D?.attack?.('player', type, resolveImpact, onInterrupted)) {
      onInterrupted();
      setStatus('ATTACK UNAVAILABLE · ANIMATION ASSETS DID NOT LOAD');
    }
  }

  function handleWrongCharacter() {
    currentWord.split(/\s+/).forEach((word) => {
      const reviewWord = normalizeMistakeWord(word);
      if (reviewWord && !mistakeWords.includes(reviewWord)) mistakeWords.push(reviewWord);
    });
    mistakes += 1;
    wordMistakes += 1;
    combo = 0;
    const penalty = config.mistakeDamage || 1;
    applyPlayerDamage(penalty);
    wrongLetterIndex = paragraphIndex;
    renderWord();
    clearScheduledTimeout(wrongLetterTimeout);
    const errorWordToken = activeWordToken;
    wrongLetterTimeout = scheduleTimeout(() => {
      wrongLetterTimeout = null;
      if (activeWordToken === errorWordToken && !ended) {
        wrongLetterIndex = -1;
        renderWord();
      }
    }, 260);
    sound('wrong');
    setStatus('MISS · COMBO RESET · KEEP YOUR GUARD UP');
    setText('shipStatus', 'INPUT MISTAKE');
    if (playerHealth <= 0) beginRoundTransition('enemy');
    updateStats();
  }

  function handleTyping(event) {
    if (
      !fightStarted ||
      input.disabled ||
      paused ||
      ended ||
      saving ||
      roundOver ||
      timeExpired ||
      event.isComposing
    )
      return;
    if (event.inputType === 'insertFromPaste') {
      input.value = typedParagraph;
      return;
    }
    const acceptedText = typedParagraph;
    const edit = inspectTypingInput(input.value, acceptedText, event.inputType || '');
    if (edit.type === 'backspace') {
      if ([...edit.value].length < lockedPrefixIndex) {
        input.value = acceptedText;
        return;
      }
      const removedCharacters = acceptedText.length - edit.value.length;
      correctCharacters = Math.max(0, correctCharacters - removedCharacters);
      attemptedCharacters = Math.max(0, attemptedCharacters - removedCharacters);
      correctCharacterTimes.splice(-removedCharacters, removedCharacters);
      typedParagraph = edit.value;
      paragraphIndex = [...typedParagraph].length;
      const previousWordIndex = sentenceWords.findIndex((range) => paragraphIndex <= range.end);
      activeWordIndex = Math.max(0, previousWordIndex);
      currentWord = sentenceWords[activeWordIndex]?.text || '';
      typedWord = sentenceWords[activeWordIndex]
        ? [...sentenceText].slice(sentenceWords[activeWordIndex].start, paragraphIndex).join('')
        : '';
      input.value = typedParagraph;
      renderWord();
      updateStats();
      return;
    }
    if (edit.type !== 'character') {
      input.value = acceptedText;
      return;
    }
    const nextCharacter = edit.value;
    input.value = acceptedText;

    attemptedCharacters += 1;
    const consumed = consumeParagraphCharacter(sentenceText, paragraphIndex, nextCharacter);
    if (consumed.accepted) {
      const completedWord = currentWord;
      paragraphIndex = consumed.index;
      typedParagraph += nextCharacter;
      typedWord = sentenceWords[activeWordIndex]
        ? [...sentenceText].slice(sentenceWords[activeWordIndex].start, paragraphIndex).join('')
        : '';
      correctCharacters += 1;
      correctCharacterTimes.push(elapsedTime);
      highestWpm = Math.max(highestWpm, getWpm());
      wrongLetterIndex = -1;
      renderWord();
      if (consumed.wordComplete) {
        wordsCompleted += 1;
        if (wordMistakes === 0) perfectInputs += 1;
        const move = getMoveForWord(completedWord);
        if (nextCharacter === ' ') {
          lockedPrefixIndex = paragraphIndex;
          activeWordIndex += 1;
        }
        applyPlayerAttack(move, false, wordMistakes === 0);
        wordMistakes = 0;
        if (!ended) {
          nextWord(consumed.paragraphComplete);
          input.disabled = roundOver;
        }
      }
    } else {
      handleWrongCharacter();
    }
    input.value = typedParagraph;
    updateStats();
  }

  function activateGuard() {
    if (!fightStarted || ended || paused || roundOver || elapsedTime < guardReadyAt) return;
    guardStartedAt = elapsedTime;
    guardActiveUntil = elapsedTime + guardDuration;
    guardReadyAt = elapsedTime + guardCooldown;
    window.typeFighter3D?.guard('player', guardDuration);
    addEnergy(4);
    sound('block');
    setStatus('GUARD UP · TIME THE INCOMING STRIKE');
    setText('shipStatus', 'DEFENDING');
    updateControls();
  }

  function activateSpecial() {
    if (!fightStarted || ended || paused || roundOver || enemyDown || timeExpired) return;
    if (input.disabled) {
      setStatus('RECOVERING · FINISH YOUR BUFFERED STRIKES');
      return;
    }
    if (energy < specialRequirement) {
      setStatus(`SPECIAL NEEDS ENERGY · ${Math.floor(energy)}% READY`);
      return;
    }
    applyPlayerAttack(moveProfiles.special, true, true);
    if (!ended && !roundOver) {
      input.disabled = roundOver;
      nextWord();
    }
  }

  function enemyAttack() {
    if (ended || roundOver || enemyDown) return;
    const distance = window.typeFighter3D?.distance?.() ?? 3.4;
    if (distance > 4.3) {
      enemyActionState = 'approach';
      window.typeFighter3D?.move('enemy', { forward: 1, dash: true });
      setStatus('OPPONENT MISSED · CLOSE THE DISTANCE');
      enemyRecoveryUntil = elapsedTime + 0.55;
      return;
    }
    enemyActionState = 'recover';
    enemyRecoveryUntil = elapsedTime + config.recovery;
    const attackTypes = ['jab', 'kick', 'launcher', 'heavy', 'special'];
    const attackType = enemyComboLeft
      ? 'kick'
      : attackTypes[enemyAttackCount++ % attackTypes.length];
    let impactResolved = false;
    const resolveImpact = (impact = {}) => {
      if (impactResolved) return;
      impactResolved = true;
      if (ended || roundOver || enemyDown) return;
      const targetHittable = window.typeFighter3D?.canBeHit?.('player') === true;
      const targetEvading = window.typeFighter3D?.isEvading?.('player') === true;
      const impactDistance = window.typeFighter3D?.distance?.() ?? Infinity;
      if (!targetHittable || targetEvading || impactDistance > 4.3) {
        if (targetEvading) {
          addEnergy(8);
          sound('block');
          setStatus('SIDESTEP EVADE · COUNTER WINDOW OPEN');
          setText('shipStatus', 'ATTACK EVADED');
        } else {
          setStatus(
            !targetHittable
              ? 'OPPONENT STRIKE MISSED · TARGET NOT VULNERABLE'
              : 'OPPONENT STRIKE MISSED · OUT OF RANGE',
          );
          setText('shipStatus', 'OPPONENT MISSED');
        }
        updateStats();
        return;
      }
      const guarded = elapsedTime <= guardActiveUntil;
      const perfectGuard = guarded && elapsedTime - guardStartedAt <= 0.48;
      const damage = perfectGuard
        ? 0
        : guarded
          ? Math.ceil(config.aiDamage * 0.3)
          : config.aiDamage;
      const actualDamage = applyPlayerDamage(damage);
      combo = 0;
      guardActiveUntil = 0;
      if (actualDamage > 0) {
        window.typeFighter3D?.react?.('player', impact.reactionId, guarded ? 0.48 : 1.05);
      }
      if (perfectGuard) {
        addEnergy(18);
        score += 110;
        sound('perfect');
        setStatus('PERFECT GUARD · PUNISH WINDOW OPEN');
        setText('shipStatus', 'PERFECT DEFENSE');
      } else if (guarded) {
        addEnergy(9);
        sound('block');
        setStatus(`BLOCKED · ${damage} CHIP DAMAGE · COUNTER NOW`);
        setText('shipStatus', 'GUARD HELD');
      } else {
        setStatus(`OPPONENT STRIKE · ${damage} DAMAGE · TYPE TO RETALIATE`);
        setText('shipStatus', 'HIT TAKEN');
      }
      if (enemyComboLeft > 0) {
        enemyComboLeft -= 1;
        enemyComboAt = elapsedTime + 0.48;
      } else if (difficulty === 'hard' || difficulty === 'extreme' || difficulty === 'custom') {
        enemyComboLeft =
          Math.random() < (difficulty === 'extreme' ? 0.7 : difficulty === 'hard' ? 0.48 : 0.35)
            ? 1
            : 0;
        enemyComboAt = elapsedTime + 0.48;
      }
      if (playerHealth <= 0) beginRoundTransition('enemy');
      updateStats();
    };
    if (!window.typeFighter3D?.attack?.('enemy', attackType, resolveImpact)) {
      setStatus('OPPONENT ATTACK UNAVAILABLE · ANIMATION ASSETS DID NOT LOAD');
      setText('aiState', 'ANIMATION ERROR');
      updateStats();
    }
  }

  function updateAI(delta) {
    if (enemyDown || roundOver || ended) return;
    const distance = window.typeFighter3D?.distance?.() ?? 3.4;
    if (enemyActionState === 'windup') {
      enemyActionTimer -= delta;
      setText('aiState', `WIND UP · ${enemyActionTimer.toFixed(1)}s`);
      window.typeFighter3D?.move('enemy', { forward: distance > 2.9 ? 0.55 : 0 });
      if (enemyActionTimer <= 0) enemyAttack();
      return;
    }
    if (enemyActionState === 'recover') {
      setText('aiState', 'RECOVERING');
      if (enemyComboLeft > 0 && elapsedTime >= enemyComboAt && distance <= 4.35) {
        enemyActionState = 'attack';
        enemyAttack();
        return;
      }
      if (elapsedTime >= enemyRecoveryUntil) {
        enemyActionState = 'approach';
        enemyNextDecisionAt = Math.max(enemyNextDecisionAt, elapsedTime + 0.35);
      }
      window.typeFighter3D?.move('enemy', { forward: 0 });
      return;
    }
    if (elapsedTime < enemyGuardUntil) {
      enemyActionState = 'defend';
      setText('aiState', 'GUARDING');
      window.typeFighter3D?.move('enemy', { forward: 0 });
      return;
    }
    if (distance > 3.25) {
      enemyActionState = 'approach';
      setText('aiState', 'CLOSING DISTANCE');
      window.typeFighter3D?.move('enemy', { forward: 1, dash: distance > 4.2 });
      return;
    }
    window.typeFighter3D?.move('enemy', { forward: 0 });
    if (elapsedTime < enemyNextDecisionAt) return;
    const repeatCount = recentMoves
      .slice(-3)
      .filter((type) => type && type === recentMoves.at(-1)).length;
    const defenseChance = Math.min(
      0.75,
      config.defenseChance + Math.max(0, repeatCount - 1) * 0.16,
    );
    enemyNextDecisionAt = elapsedTime + config.aiInterval * (0.82 + Math.random() * 0.38);

    if (recentMoves.length >= 2 && Math.random() < defenseChance) {
      enemyActionState = 'defend';
      setText('aiState', 'READING PATTERN');
      enemyGuardUntil = elapsedTime + 0.85;
      window.typeFighter3D?.guard('enemy', 0.85);
      setStatus('OPPONENT READ YOUR PATTERN · CHANGE YOUR ATTACK');
      setText('shipStatus', 'AI GUARDING');
      return;
    }
    if (Math.random() < config.evadeChance) {
      enemyActionState = 'evade';
      setText('aiState', 'SIDESTEPPING');
      window.typeFighter3D?.move('enemy', { lateral: Math.random() < 0.5 ? -1 : 1, dash: true });
      enemyRecoveryUntil = elapsedTime + 0.6;
      enemyActionState = 'recover';
      setStatus('OPPONENT SIDESTEPS · RESET YOUR AIM');
      setText('shipStatus', 'EVADING');
      return;
    }
    enemyActionState = 'windup';
    setText('aiState', 'ATTACK TELEGRAPH');
    enemyActionTimer = config.reaction;
    setStatus('OPPONENT WINDING UP · GUARD OR SIDESTEP');
    setText('shipStatus', 'ATTACK TELEGRAPH');
  }

  function getCookie(name) {
    for (const cookie of document.cookie.split(';')) {
      const trimmedCookie = cookie.trim();
      if (trimmedCookie.startsWith(`${name}=`)) {
        return decodeURIComponent(trimmedCookie.slice(name.length + 1));
      }
    }
    return '';
  }

  function showResult(result) {
    const title = result === 'win' ? 'VICTORY' : result === 'loss' ? 'DEFEAT' : 'DRAW';
    setText('matchResultTitle', mode === 'training' ? 'PRACTICE COMPLETE' : title);
    setText(
      'matchResultSummary',
      `${knockouts}–${enemyRoundWins} rounds · ${successfulAttacks} landed / ${failedAttacks} failed · ${getWpm()} WPM · ${getAccuracy()}% accuracy · ${score.toLocaleString()} points`,
    );
    setText('matchSaveStatus', 'Saving your match…');
    if (resultPanel) resultPanel.hidden = false;
    $('restartMatch')?.focus({ preventScroll: true });
  }

  async function saveResult() {
    if (!pendingResult || !saveUrl || saving) return;
    saving = true;
    if (saveRetryButton) saveRetryButton.hidden = true;
    setText('matchSaveStatus', 'Saving your match…');
    try {
      const response = await fetch(saveUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCookie('csrftoken') },
        body: JSON.stringify(pendingResult),
      });
      const data = await response.json();
      if (!response.ok || !data.success)
        throw new Error(data.error || 'The match result could not be saved.');
      window.location.assign(`/type-fighter/result/${data.result_id}/`);
    } catch (error) {
      console.error('Type Fighter result save failed.', error);
      setText(
        'matchSaveStatus',
        `${error.message} Your match is safe here; retry the save or restart.`,
      );
      if (saveRetryButton) saveRetryButton.hidden = false;
      saving = false;
    }
  }

  function finishMatch(result) {
    if (ended) return;
    highestWpm = Math.max(highestWpm, getWpm());
    ended = true;
    paused = false;
    clearScheduledTimeouts();
    wrongLetterTimeout = null;
    stopMovement();
    cancelAnimationFrame(animationFrame);
    input.disabled = true;
    setStatus('MATCH FINISHED');
    setText('shipStatus', 'MATCH ENDED');
    pendingResult = {
      client_match_id: matchId,
      difficulty,
      mode,
      result,
      score,
      wpm: getWpm(),
      accuracy: attemptedCharacters ? (correctCharacters / attemptedCharacters) * 100 : 100,
      words_typed: wordsCompleted,
      mistakes,
      wins: result === 'win' ? 1 : 0,
      losses: result === 'loss' ? 1 : 0,
      knockouts,
      damage_dealt: Math.round(damageDealt),
      damage_received: Math.round(damageReceived),
      attacks_successful: successfulAttacks,
      attacks_failed: failedAttacks,
      highest_wpm: highestWpm,
      mistake_words: mistakeWords.slice(0, 30),
      best_combo: bestCombo,
      perfect_inputs: perfectInputs,
      duration: Math.min(matchDuration, Math.max(1, Math.round(elapsedTime))),
    };
    showResult(result);
    saveResult();
  }

  function updateRoundTransition() {
    if (!roundOver || elapsedTime < roundTransitionAt || ended) return;
    roundOver = false;
    enemyDown = false;
    playerDown = false;
    playerHealth = 100;
    enemyHealth = 100;
    energy = Math.max(energy, 20);
    guardActiveUntil = 0;
    enemyGuardUntil = 0;
    enemyComboLeft = 0;
    enemyAttackCount = 0;
    combo = 0;
    lastPlayerAttackAt = -10;
    enemyActionState = 'approach';
    setText('aiState', 'APPROACHING');
    enemyNextDecisionAt = elapsedTime + 1.4;
    window.typeFighter3D?.resetFighter('player');
    window.typeFighter3D?.resetFighter('enemy');
    input.disabled = false;
    setStatus(`ROUND ${knockouts + enemyRoundWins + 1} · FIGHT!`);
    setText('shipStatus', 'READY');
    nextWord();
    updateStats();
  }

  function pauseMatch() {
    if (!fightStarted || ended) return;
    paused = !paused;
    const pauseButton = $('pauseGame');
    if (pauseButton) pauseButton.textContent = paused ? '▶ RESUME' : 'Ⅱ PAUSE';
    if (paused) {
      stopMovement();
      cancelAnimationFrame(animationFrame);
      window.typeFighter3D?.setPaused(true);
      setText('arenaStatus', 'MATCH PAUSED');
      const message = root.querySelector('.game-message');
      if (message) {
        message.style.display = 'flex';
        setText(message.querySelector('strong'), 'MATCH PAUSED');
        setText(message.querySelector('small'), 'Resume when ready');
      }
    } else {
      window.typeFighter3D?.setPaused(false);
      const message = root.querySelector('.game-message');
      if (message) message.style.display = 'none';
      setStatus('FIGHT MODE ACTIVE');
      input.focus({ preventScroll: true });
      startLoop();
    }
    updateControls();
  }

  function finishOnTime() {
    if (finalizingResult) return;
    if (mode === 'training') return finishMatch('draw');
    if (knockouts > enemyRoundWins) return finishMatch('win');
    if (enemyRoundWins > knockouts) return finishMatch('loss');
    if (playerHealth > enemyHealth) return finishMatch('win');
    if (enemyHealth > playerHealth) return finishMatch('loss');
    finishMatch('draw');
  }

  function gameLoop(timestamp) {
    if (paused || ended) return;
    const delta = lastFrame ? Math.min((timestamp - lastFrame) / 1000, 0.05) : 0;
    lastFrame = timestamp;
    elapsedTime = Math.min(matchDuration, elapsedTime + delta);
    remainingTime = Math.max(0, matchDuration - elapsedTime);
    if (remainingTime <= 0 && !timeExpired) {
      timeExpired = true;
      input.disabled = true;
      stopMovement();
    }

    if (remainingTime > 0) updateAI(delta);
    updateRoundTransition();
    if (combo && elapsedTime - lastPlayerAttackAt > (config.comboWindow || comboWindow)) combo = 0;
    if (elapsedTime >= 10 && elapsedTime - lastWpmSampleAt >= 0.25) {
      lastWpmSampleAt = elapsedTime;
      const recentCorrectCharacters = correctCharacterTimes.filter(
        (characterTime) => characterTime >= elapsedTime - 10,
      ).length;
      highestWpm = Math.max(highestWpm, Math.round((recentCorrectCharacters / 5 / 10) * 60));
    }
    updateStats();
    if (remainingTime <= 0 && !finalizingResult) {
      finishOnTime();
      return;
    }
    animationFrame = requestAnimationFrame(gameLoop);
  }

  function startLoop() {
    lastFrame = 0;
    cancelAnimationFrame(animationFrame);
    animationFrame = requestAnimationFrame(gameLoop);
  }

  function handleGameKeyDown(event) {
    if (!fightStarted || ended || paused || roundOver) return;
    const keys = {
      ArrowUp: { forward: 1, dash: true },
      ArrowDown: { forward: -1 },
      ArrowLeft: { lateral: -1 },
      ArrowRight: { lateral: 1 },
    };
    if (keys[event.key]) {
      event.preventDefault();
      setMovement(keys[event.key]);
    } else if (event.key === 'Shift' && !event.repeat) {
      event.preventDefault();
      activateGuard();
    } else if (event.key === 'Enter') {
      event.preventDefault();
      activateSpecial();
    } else if (event.key === ' ' && event.target === input && event.ctrlKey) {
      event.preventDefault();
      window.typeFighter3D?.move('player', { ...movement, jump: true });
      setStatus('JUMP · BREAK THE OPPONENT’S LINE · TYPE SPACE WITHOUT CTRL');
    } else if (event.key === 'Control') {
      event.preventDefault();
      setMovement({ crouch: true });
    } else if (event.key === 'Escape') {
      event.preventDefault();
      pauseMatch();
    }
  }

  function handleGameKeyUp(event) {
    if (!fightStarted || ended || paused || roundOver) return;
    const keys = {
      ArrowUp: { forward: 0, dash: false },
      ArrowDown: { forward: 0 },
      ArrowLeft: { lateral: 0 },
      ArrowRight: { lateral: 0 },
    };
    if (keys[event.key]) setMovement(keys[event.key]);
    if (event.key === 'Control') setMovement({ crouch: false });
  }

  input.addEventListener('input', handleTyping, listenerOptions);
  input.addEventListener('paste', (event) => event.preventDefault(), listenerOptions);
  document.addEventListener('keydown', handleGameKeyDown, listenerOptions);
  document.addEventListener('keyup', handleGameKeyUp, listenerOptions);
  guardButton?.addEventListener('click', activateGuard, listenerOptions);
  specialButton?.addEventListener('click', activateSpecial, listenerOptions);
  document.querySelectorAll('[data-move]').forEach((button) => {
    const direction = button.dataset.move;
    const movementForButton = {
      advance: { forward: 1, dash: true },
      retreat: { forward: -1, dash: true },
      sidestepLeft: { lateral: -1 },
      sidestepRight: { lateral: 1 },
    }[direction];
    if (!movementForButton) return;
    const release = () =>
      setMovement(
        direction === 'advance' || direction === 'retreat'
          ? { forward: 0, dash: false }
          : { lateral: 0 },
      );
    button.addEventListener(
      'pointerdown',
      (event) => {
        event.preventDefault();
        button.setPointerCapture?.(event.pointerId);
        setMovement(movementForButton);
      },
      listenerOptions,
    );
    button.addEventListener('pointerup', release, listenerOptions);
    button.addEventListener('pointercancel', release, listenerOptions);
    button.addEventListener('lostpointercapture', release, listenerOptions);
    button.addEventListener('click', () => input.focus({ preventScroll: true }), listenerOptions);
  });
  $('pauseGame')?.addEventListener('click', pauseMatch, listenerOptions);
  $('quitGame')?.addEventListener(
    'click',
    () => {
      if (window.confirm('End this match and save your result?')) finishMatch('draw');
    },
    listenerOptions,
  );
  $('muteGame')?.addEventListener(
    'click',
    (event) => {
      soundEnabled = !soundEnabled;
      event.currentTarget.setAttribute('aria-pressed', String(!soundEnabled));
      event.currentTarget.textContent = soundEnabled ? '♫ SOUND' : '♫ MUTED';
    },
    listenerOptions,
  );
  saveRetryButton?.addEventListener('click', saveResult, listenerOptions);
  $('restartMatch')?.addEventListener('click', () => window.location.reload(), listenerOptions);
  arena.addEventListener(
    'click',
    () => {
      if (!paused && !ended && !input.disabled) input.focus({ preventScroll: true });
    },
    listenerOptions,
  );
  window.addEventListener(
    'pagehide',
    () => {
      listenerController.abort();
      clearScheduledTimeouts();
      audioContext?.close?.();
    },
    { once: true, signal: listenerController.signal },
  );

  input.disabled = true;
  createWordDisplay();
  nextWord(true);
  if (root.querySelector('.game-message'))
    root.querySelector('.game-message').style.display = 'flex';
  setText('shipStatus', 'READY');
  setStatus('LOADING 3D ARENA');
  updateStats();
  $('pauseGame').disabled = true;
  $('quitGame').disabled = true;
  setText('shipStatus', 'ARENA LOADING');
  setText('arenaStatus', 'LOADING 3D ARENA');
  setText($('gameMessage')?.querySelector('strong'), 'FIGHTERS ENTERING');
  setText($('gameMessage')?.querySelector('small'), 'Preparing the arena…');

  async function beginMatch() {
    try {
      await window.typeFighter3D?.ready;
    } catch (error) {
      console.error('Type Fighter arena setup failed; combat cannot start.', error);
      input.disabled = true;
      $('pauseGame').disabled = true;
      $('quitGame').disabled = true;
      setStatus('ARENA UNAVAILABLE · RELOAD MATCH');
      setText('shipStatus', 'ANIMATION ERROR');
      setText($('gameMessage')?.querySelector('strong'), 'ARENA UNAVAILABLE');
      setText(
        $('gameMessage')?.querySelector('small'),
        'Character or combat animation assets failed to load.',
      );
      return;
    }
    if (ended) return;
    setStatus('FIGHTERS ENTERING');
    setText($('gameMessage')?.querySelector('strong'), 'FIGHTERS ENTERING');
    setText(
      $('gameMessage')?.querySelector('small'),
      'The duel begins when both fighters take their marks',
    );
    await window.typeFighter3D?.enter?.();
    if (ended) return;
    const message = $('gameMessage');
    const heading = message?.querySelector('strong');
    const subheading = message?.querySelector('small');
    const tickDuration = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 250 : 850;
    for (let count = 3; count > 0; count -= 1) {
      setText(heading, mode === 'training' ? `PRACTICE · ${count}` : `ROUND ONE · ${count}`);
      setText(
        subheading,
        count === 3 ? 'Prepare to fight' : 'Type the paragraph exactly to attack',
      );
      await new Promise((resolve) => window.setTimeout(resolve, tickDuration));
      if (ended) return;
    }
    setText(heading, mode === 'training' ? 'PRACTICE!' : 'FIGHT!');
    setText(
      subheading,
      mode === 'training'
        ? 'No pressure · repeat words to build accuracy'
        : 'Type the paragraph · arrows move · Ctrl + Space jump · Shift guard · Enter special',
    );
    setStatus('FIGHT MODE ACTIVE');
    setText('shipStatus', 'FIGHTING');
    await new Promise((resolve) => window.setTimeout(resolve, tickDuration));
    if (ended) return;
    if (message) message.style.display = 'none';
    fightStarted = true;
    input.disabled = false;
    nextWord();
    $('pauseGame').disabled = false;
    $('quitGame').disabled = false;
    updateControls();
    input.focus({ preventScroll: true });
    startLoop();
  }

  beginMatch();
});
