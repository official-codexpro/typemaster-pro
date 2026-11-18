document.addEventListener('DOMContentLoaded', () => {
    const root = document.getElementById('typeFighterGame');
    if (!root) return;

    const $ = id => document.getElementById(id);

    const arena = $('gameArena');
    const input = $('typingInput');
    const enemyLayer = $('enemyLayer');

    const scoreEl = $('score');
    const roundEl = $('round') || $('wave');
    const wpmEl = $('wpm');
    const accuracyEl = $('accuracy');
    const comboEl = $('combo');

    const timerEl = $('missionTimer') || $('matchTimer');
    const statusEl = $('arenaStatus');
    const messageEl = $('gameMessage');

    const playerStatus = $('shipStatus') || $('playerStatus');
    const knockoutsEl = $('destroyedCount') || $('knockouts');

    const pauseButton = $('pauseGame');
    const quitButton = $('quitGame');

    if (!arena || !input) {
        console.error('Type Fighter: Required game elements missing.');
        return;
    }

    const difficulty = root.dataset.difficulty || 'normal';
    const saveUrl = root.dataset.saveUrl;
    const homeUrl = root.dataset.homeUrl || '/type-fighter/';

    // ======================================
    // DIFFICULTY
    // ======================================

    const DIFFICULTY = {
        easy: {
            words: [
                'fire', 'kick', 'punch', 'move', 'fast',
                'jump', 'fight', 'power', 'block', 'hero'
            ],
            aiDelay: 7,
            aiDamage: 8
        },

        normal: {
            words: [
                'dragon', 'strike', 'combat', 'warrior',
                'attack', 'defense', 'fighter', 'shadow',
                'counter', 'victory', 'battle', 'danger'
            ],
            aiDelay: 5,
            aiDamage: 12
        },

        hard: {
            words: [
                'counterattack', 'uppercut', 'combination',
                'devastating', 'powerstrike', 'defensive',
                'unbreakable', 'masterstrike', 'finishing'
            ],
            aiDelay: 3.5,
            aiDamage: 16
        },

        extreme: {
            words: [
                'function(){return 404}',
                'const fighter=2026',
                'player.hp-=100',
                'if(enemy.alive){attack()}',
                'class Warrior extends Hero',
                'while(opponent.hp>0){fight()}'
            ],
            aiDelay: 2.3,
            aiDamage: 22
        }
    };

    const config = DIFFICULTY[difficulty] || DIFFICULTY.normal;

    // ======================================
    // GAME STATE
    // ======================================

    const GAME_DURATION = 60;

    let score = 0;
    let combo = 0;
    let knockouts = 0;

    let correctChars = 0;
    let totalChars = 0;
    let mistakes = 0;

    let remainingTime = GAME_DURATION;
    let elapsedTime = 0;

    let playerHealth = 100;
    let enemyHealth = 100;

    let currentWord = '';
    let typedWord = '';

    let paused = false;
    let ended = false;
    let saving = false;

    let aiTimer = 0;
    let lastFrame = 0;
    let animationId = null;

    let wordElement = null;
    let recentWords = [];

    // ======================================
    // HELPERS
    // ======================================

    function randomWord() {
        let word;

        do {
            word = config.words[
                Math.floor(Math.random() * config.words.length)
            ];
        } while (
            recentWords.includes(word) &&
            recentWords.length < config.words.length
        );

        recentWords.push(word);

        if (recentWords.length > 5) {
            recentWords.shift();
        }

        return word;
    }

    function clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }

    function setText(element, value) {
        if (element) element.textContent = value;
    }

    function showStatus(message) {
        setText(statusEl, message);
    }

    // ======================================
    // ENEMY WORD DISPLAY
    // ======================================

    function createWordDisplay() {
        if (!enemyLayer) return;

        enemyLayer.replaceChildren();

        wordElement = document.createElement('div');
        wordElement.className = 'enemy-word type-fighter-word';

        Object.assign(wordElement.style, {
            position: 'absolute',
            left: '50%',
            top: '42%',
            transform: 'translate(-50%, -50%)',
            zIndex: '5',
            fontSize: 'clamp(18px, 2vw, 30px)',
            fontWeight: '800',
            letterSpacing: '3px',
            color: '#ffffff',
            textShadow: '0 0 15px rgba(255, 60, 80, 0.7)',
            whiteSpace: 'nowrap',
            pointerEvents: 'none'
        });

        enemyLayer.appendChild(wordElement);
    }

    function renderWord() {
        if (!wordElement) return;

        wordElement.replaceChildren();

        [...currentWord].forEach((character, index) => {
            const span = document.createElement('span');

            span.textContent = character;

            if (index < typedWord.length) {
                span.style.color = '#42e8ff';
                span.style.textShadow = '0 0 12px #42e8ff';
            } else {
                span.style.color = '#ffffff';
            }

            wordElement.appendChild(span);
        });
    }

    function nextWord() {
        currentWord = randomWord();
        typedWord = '';

        renderWord();

        if (input) {
            input.value = '';
            input.focus();
        }
    }

    // ======================================
    // PLAYER ATTACK
    // ======================================

    function playerAttack() {
        const damage = Math.min(
            8 + combo * 1.5,
            25
        );

        enemyHealth = clamp(enemyHealth - damage, 0, 100);

        score += Math.round(damage * 10);

        combo++;
        knockouts += enemyHealth <= 0 ? 1 : 0;

        if (enemyHealth <= 0) {
            score += 500;
            enemyHealth = 100;

            showStatus('KNOCKOUT!');
        } else {
            showStatus('PLAYER ATTACK!');
        }

        updateStats();
    }

    // ======================================
    // TYPING INPUT
    // ======================================

    function handleTyping(event) {
        if (paused || ended || saving) return;

        if (event.inputType === 'insertFromPaste') {
            input.value = typedWord;
            return;
        }

        const value = input.value;

        if (value.length < typedWord.length) {
            typedWord = value;
            renderWord();
            return;
        }

        const newCharacters = value.slice(typedWord.length);

        for (const character of newCharacters) {
            const expected = currentWord[typedWord.length];

            totalChars++;

            if (
                character.toLowerCase() ===
                expected.toLowerCase()
            ) {
                typedWord += character;
                correctChars++;

                if (typedWord.length === currentWord.length) {
                    playerAttack();
                    nextWord();
                }
            } else {
                mistakes++;
                combo = 0;

                showStatus('WRONG INPUT!');
            }
        }

        input.value = typedWord;
        renderWord();
        updateStats();
    }

    input.addEventListener('input', handleTyping);

    // ======================================
    // AI OPPONENT
    // ======================================

    function aiAttack() {
        const damage = config.aiDamage;

        playerHealth = clamp(
            playerHealth - damage,
            0,
            100
        );

        combo = 0;

        showStatus('ENEMY ATTACK!');

        if (playerHealth <= 0) {
            endGame('loss');
            return;
        }

        updateStats();
    }

    function updateAI(dt) {
        aiTimer += dt;

        if (aiTimer >= config.aiDelay) {
            aiTimer = 0;
            aiAttack();
        }
    }

    // ======================================
    // STATS
    // ======================================

    function updateStats() {
        const minutes = Math.max(elapsedTime / 60, 1 / 60);

        const wpm = Math.round(
            (correctChars / 5) / minutes
        );

        const accuracy = totalChars > 0
            ? Math.round((correctChars / totalChars) * 100)
            : 100;

        setText(scoreEl, String(score).padStart(6, '0'));
        setText(roundEl, '01');
        setText(wpmEl, String(wpm).padStart(3, '0'));
        setText(accuracyEl, `${accuracy}%`);
        setText(comboEl, `×${combo}`);

        setText(knockoutsEl, knockouts);

        const seconds = Math.ceil(remainingTime);

        setText(
            timerEl,
            `00:${String(seconds).padStart(2, '0')}`
        );

        // Update health bars if present in HTML.
        const playerBar = $('playerHealthBar');
        const enemyBar = $('enemyHealthBar');

        if (playerBar) {
            playerBar.style.width = `${playerHealth}%`;
        }

        if (enemyBar) {
            enemyBar.style.width = `${enemyHealth}%`;
        }

        setText($('playerHealth'), `${playerHealth}%`);
        setText($('enemyHealth'), `${enemyHealth}%`);
    }

    // ======================================
    // GAME END
    // ======================================

    async function endGame(result = 'draw') {
        if (ended || saving) return;

        ended = true;
        saving = true;

        cancelAnimationFrame(animationId);

        input.disabled = true;

        if (playerHealth <= 0) {
            result = 'loss';
        } else if (enemyHealth <= 0) {
            result = 'win';
        }

        showStatus('MATCH FINISHED');
        setText(playerStatus, 'MATCH ENDED');

        const duration = Math.max(1, Math.round(elapsedTime));

        const accuracy = totalChars > 0
            ? (correctChars / totalChars) * 100
            : 100;

        const wpm = Math.round(
            (correctChars / 5) /
            Math.max(elapsedTime / 60, 1 / 60)
        );

        const payload = {
            difficulty,
            result,
            score,
            wpm,
            accuracy,
            words_typed: knockouts,
            mistakes,
            wins: result === 'win' ? 1 : 0,
            losses: result === 'loss' ? 1 : 0,
            knockouts,
            duration
        };

        try {
            if (!saveUrl) {
                throw new Error('Result save URL is missing.');
            }

            const response = await fetch(saveUrl, {
                method: 'POST',

                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': getCookie('csrftoken')
                },

                body: JSON.stringify(payload)
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(
                    data.error || 'Unable to save match result.'
                );
            }

            window.location.href =
                `/type-fighter/result/${data.result_id}/`;

        } catch (error) {
            console.error(error);

            saving = false;

            showStatus('RESULT SAVE FAILED');

            alert(error.message);
        }
    }

    // ======================================
    // CSRF
    // ======================================

    function getCookie(name) {
        const cookies = document.cookie.split(';');

        for (const cookie of cookies) {
            const item = cookie.trim();

            if (item.startsWith(name + '=')) {
                return decodeURIComponent(
                    item.substring(name.length + 1)
                );
            }
        }

        return '';
    }

    // ======================================
    // PAUSE / RESUME
    // ======================================

    function pauseGame() {
        if (ended || saving) return;

        paused = !paused;

        if (pauseButton) {
            pauseButton.textContent = paused
                ? '▶ RESUME'
                : 'Ⅱ PAUSE';
        }

        if (messageEl) {
            messageEl.style.display = paused ? 'flex' : 'none';

            const title = messageEl.querySelector('strong');
            const subtitle = messageEl.querySelector('small');

            if (title) {
                title.textContent = 'MATCH PAUSED';
            }

            if (subtitle) {
                subtitle.textContent = 'Resume when ready';
            }
        }

        if (paused) {
            cancelAnimationFrame(animationId);
        } else {
            lastFrame = 0;
            input.focus();
            startLoop();
        }
    }

    pauseButton?.addEventListener('click', pauseGame);

    // ======================================
    // QUIT MATCH
    // ======================================

    quitButton?.addEventListener('click', () => {
        if (
            confirm('End this match and save your result?')
        ) {
            endGame('draw');
        }
    });

    // ======================================
    // GAME LOOP
    // ======================================

    function gameLoop(timestamp) {
        if (paused || ended) return;

        const dt = lastFrame
            ? Math.min((timestamp - lastFrame) / 1000, 0.05)
            : 0;

        lastFrame = timestamp;

        elapsedTime += dt;
        remainingTime = Math.max(0, remainingTime - dt);

        updateAI(dt);
        updateStats();

        if (remainingTime <= 0) {
            if (playerHealth > 0 && playerHealth > enemyHealth) {
                endGame('win');
            } else if (playerHealth < enemyHealth) {
                endGame('loss');
            } else {
                endGame('draw');
            }

            return;
        }

        animationId = requestAnimationFrame(gameLoop);
    }

    function startLoop() {
        lastFrame = 0;

        cancelAnimationFrame(animationId);

        animationId = requestAnimationFrame(gameLoop);
    }

    // ======================================
    // INITIALIZE
    // ======================================

    createWordDisplay();
    nextWord();

    if (messageEl) {
        messageEl.style.display = 'none';
    }

    setText(playerStatus, 'READY');
    showStatus('FIGHT MODE ACTIVE');

    updateStats();

    arena.addEventListener('click', () => {
        if (!paused && !ended) input.focus();
    });

    input.focus();

    startLoop();

    console.log('Type Fighter combat system initialized.');
});
