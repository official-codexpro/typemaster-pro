document.addEventListener('DOMContentLoaded', () => {
    const root = document.getElementById('spaceShooterGame');
    if (!root) return;

    const $ = id => document.getElementById(id);

    const canvas = $('gameCanvas');
    const ctx = canvas.getContext('2d');

    const arena = $('gameArena');
    const input = $('typingInput');
    const enemyLayer = $('enemyLayer');

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

    const difficulty = root.dataset.difficulty || 'normal';
    const saveUrl = root.dataset.saveUrl;
    const homeUrl = root.dataset.homeUrl;

    const CONFIG = {
        easy: {
            words: [
                'cat', 'dog', 'sun', 'moon', 'star', 'ship', 'fire',
                'book', 'game', 'tree', 'fish', 'bird', 'home', 'road',
                'water', 'happy', 'green', 'light', 'smile', 'cloud',
                'apple', 'music', 'river', 'plant', 'dream', 'space'
            ],
            speed: 27,
            spawn: 2.7,
            maxEnemies: 4
        },

        normal: {
            words: [
                'planet', 'rocket', 'galaxy', 'cosmic', 'system', 'meteor',
                'nebula', 'orbit', 'asteroid', 'satellite', 'captain',
                'mission', 'engine', 'oxygen', 'module', 'launch',
                'signal', 'comet', 'lunar', 'gravity', 'energy', 'radar'
            ],
            speed: 37,
            spawn: 2.05,
            maxEnemies: 5
        },

        hard: {
            words: [
                'cat', 'orbit', 'ship', 'rocket', 'gravity', 'mission',
                'asteroid', 'velocity', 'universe', 'keyboard', 'collision',
                'spaceship', 'magnetic', 'telescope', 'astronaut',
                'radiation', 'navigation', 'dimension', 'turbulence',
                'trajectory', 'frequency', 'propulsion'
            ],
            speed: 46,
            spawn: 1.65,
            maxEnemies: 6
        },

        extreme: {
            words: [
                'dev@2026', 'X9#code', '7*space', 'run!42', 'AI_2049',
                'root#99', 'Q3!nova', '0rb1t$', 'ship@7', '4x+2=10',
                'neo%2026', 'Z8&star', 'go2Mars!', 'sys_404', 'H@ck5'
            ],
            speed: 53,
            spawn: 1.4,
            maxEnemies: 7
        }
    };

    const config = CONFIG[difficulty] || CONFIG.normal;

    const recentWords = [];
    const RECENT_WORD_LIMIT = 12;

    function generateExtremeWord() {
        const letters = 'abcdefghijklmnopqrstuvwxyz';
        const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        const digits = '0123456789';
        const symbols = '@#$%&*!?+-_=';

        const pick = pool =>
            pool[Math.floor(Math.random() * pool.length)];

        const patterns = [
            () => `${pick(letters)}${pick(letters)}${pick(digits)}${pick(symbols)}${pick(letters)}${pick(digits)}`,
            () => `${pick(upper)}${pick(digits)}${pick(symbols)}${pick(letters)}${pick(letters)}${pick(digits)}`,
            () => `${pick(letters)}${pick(letters)}${pick(letters)}${pick(symbols)}${pick(digits)}${pick(digits)}`,
            () => `${pick(digits)}${pick(symbols)}${pick(letters)}${pick(letters)}${pick(digits)}${pick(symbols)}`,
            () => `${pick(letters)}${pick(digits)}${pick(letters)}${pick(digits)}${pick(symbols)}${pick(letters)}${pick(digits)}`
        ];

        return pick(patterns)();
    }

    function getRandomWord() {
        let candidate = '';
        let attempts = 0;

        do {
            if (difficulty === 'extreme' && Math.random() < 0.65) {
                candidate = generateExtremeWord();
            } else {
                candidate = config.words[
                    Math.floor(Math.random() * config.words.length)
                ];
            }

            attempts++;
        } while (
            recentWords.includes(candidate) &&
            attempts < 40
        );

        recentWords.push(candidate);

        if (recentWords.length > RECENT_WORD_LIMIT) {
            recentWords.shift();
        }

        return candidate;
    }

    // GAME STATE

    let width = 0;
    let height = 0;
    let dpr = 1;

    let score = 0;
    let correctChars = 0;
    let totalChars = 0;
    let mistakes = 0;

    let wordsDestroyed = 0;
    let missedWords = 0;
    let shotsFired = 0;

    let combo = 0;
    let wave = 1;

    let remainingTime = 60;
    let elapsedTime = 0;
    let spawnTimer = 0;

    let enemies = [];
    let bullets = [];
    let particles = [];
    let stars = [];

    let activeEnemy = null;

    let paused = false;
    let ended = false;
    let saving = false;

    let animationId = null;
    let previousFrame = 0;
    let lastStatsUpdate = 0;

    let wrongTimeout = null;

    const ship = {
        x: 0,
        y: 0
    };

    // CANVAS SIZE

    function resizeCanvas() {
        const rect = arena.getBoundingClientRect();

        if (!rect.width || !rect.height) return;

        width = rect.width;
        height = rect.height;

        dpr = Math.min(window.devicePixelRatio || 1, 2);

        canvas.width = Math.round(width * dpr);
        canvas.height = Math.round(height * dpr);

        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        ship.x = width / 2;
        ship.y = height - 65;

        stars = Array.from({ length: 130 }, () => ({
            x: Math.random() * width,
            y: Math.random() * height,
            size: Math.random() * 1.8 + 0.3,
            speed: Math.random() * 35 + 12,
            alpha: Math.random() * 0.7 + 0.2
        }));

        enemies.forEach(updateEnemyPosition);
    }

    window.addEventListener('resize', resizeCanvas);

    // BACKGROUND

    function drawBackground(dt) {
        const gradient = ctx.createLinearGradient(
            0, 0, 0, height
        );

        gradient.addColorStop(0, '#030714');
        gradient.addColorStop(0.55, '#09152b');
        gradient.addColorStop(1, '#050a19');

        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);

        const glow = ctx.createRadialGradient(
            width * 0.5,
            height * 0.35,
            5,
            width * 0.5,
            height * 0.35,
            width * 0.55
        );

        glow.addColorStop(0, 'rgba(35, 80, 155, 0.18)');
        glow.addColorStop(1, 'rgba(3, 7, 20, 0)');

        ctx.fillStyle = glow;
        ctx.fillRect(0, 0, width, height);

        stars.forEach(star => {
            star.y += star.speed * dt;

            if (star.y > height) {
                star.y = 0;
                star.x = Math.random() * width;
            }

            ctx.globalAlpha = star.alpha;
            ctx.fillStyle = '#d9edff';

            ctx.fillRect(
                star.x,
                star.y,
                star.size,
                star.size
            );
        });

        ctx.globalAlpha = 1;

        ctx.strokeStyle = 'rgba(74, 151, 255, 0.055)';
        ctx.lineWidth = 1;

        for (let y = 0; y < height; y += 55) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();
        }

        for (let x = 0; x < width; x += 55) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
            ctx.stroke();
        }
    }

    // SPACESHIP

    function drawShip() {
        ctx.save();
        ctx.translate(ship.x, ship.y);

        const flame = ctx.createLinearGradient(0, 15, 0, 55);

        flame.addColorStop(0, '#ffffff');
        flame.addColorStop(0.3, '#42e8ff');
        flame.addColorStop(1, 'rgba(40, 110, 255, 0)');

        ctx.fillStyle = flame;

        ctx.beginPath();
        ctx.moveTo(-9, 17);
        ctx.lineTo(0, 53 + Math.random() * 8);
        ctx.lineTo(9, 17);
        ctx.closePath();
        ctx.fill();

        ctx.shadowBlur = 25;
        ctx.shadowColor = '#249bff';

        ctx.fillStyle = '#173c77';

        ctx.beginPath();
        ctx.moveTo(-31, 12);
        ctx.lineTo(-13, -15);
        ctx.lineTo(-8, -30);
        ctx.lineTo(8, -30);
        ctx.lineTo(13, -15);
        ctx.lineTo(31, 12);
        ctx.lineTo(10, 7);
        ctx.lineTo(0, 18);
        ctx.lineTo(-10, 7);
        ctx.closePath();
        ctx.fill();

        ctx.shadowBlur = 0;

        const hull = ctx.createLinearGradient(
            -20, -25, 20, 20
        );

        hull.addColorStop(0, '#e7f7ff');
        hull.addColorStop(0.35, '#5fa7e8');
        hull.addColorStop(1, '#152f59');

        ctx.fillStyle = hull;

        ctx.beginPath();
        ctx.moveTo(0, -39);
        ctx.lineTo(13, -7);
        ctx.lineTo(10, 14);
        ctx.lineTo(0, 20);
        ctx.lineTo(-10, 14);
        ctx.lineTo(-13, -7);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#42e8ff';
        ctx.shadowColor = '#42e8ff';
        ctx.shadowBlur = 14;

        ctx.beginPath();
        ctx.ellipse(0, -13, 5, 13, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.shadowBlur = 0;

        ctx.fillStyle = '#3577ba';

        ctx.beginPath();
        ctx.moveTo(-10, -4);
        ctx.lineTo(-34, 13);
        ctx.lineTo(-13, 10);
        ctx.closePath();
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(10, -4);
        ctx.lineTo(34, 13);
        ctx.lineTo(13, 10);
        ctx.closePath();
        ctx.fill();

        ctx.restore();
    }

    // ENEMY CREATION

    function createEnemy() {
        const word = getRandomWord();

        const enemy = {
            id: Math.random().toString(36).slice(2),
            word,

            x: 45 + Math.random() * Math.max(1, width - 90),
            y: -45,

            speed: config.speed * (1 + (wave - 1) * 0.09),
            phase: Math.random() * Math.PI * 2,

            progress: 0,
            pendingShots: 0,

            wrong: false,
            wrongIndex: -1,

            element: null,
            characterElements: []
        };

        const element = document.createElement('div');

        element.className = 'enemy-word';
        element.dataset.enemyId = enemy.id;

        enemy.element = element;

        enemyLayer.appendChild(element);
        enemies.push(enemy);

        renderEnemyWord(enemy);
        updateEnemyPosition(enemy);

        return enemy;
    }

    // CHARACTER RENDERING

    function renderEnemyWord(enemy) {
        if (!enemy.element) return;

        enemy.element.replaceChildren();

        enemy.characterElements = [];

        [...enemy.word].forEach((character, index) => {
            const span = document.createElement('span');

            span.className = 'letter';
            span.textContent = character;

            enemy.characterElements.push(span);

            if (index < enemy.progress) {
                span.classList.add('destroyed');
            }

            if (enemy.wrong && index === enemy.wrongIndex) {
                span.classList.add('wrong');
            }

            enemy.element.appendChild(span);
        });

        enemy.element.classList.toggle(
            'locked',
            enemy === activeEnemy
        );
    }

    function updateEnemyPosition(enemy) {
        if (!enemy.element) return;

        enemy.element.style.left = `${enemy.x}px`;
        enemy.element.style.top = `${enemy.y + 38}px`;
        enemy.element.style.transform = 'translateX(-50%)';
    }

    // ENEMY DRAWING

    function drawEnemy(enemy) {
        const pulse = 1 + Math.sin(enemy.phase) * 0.05;

        ctx.save();
        ctx.translate(enemy.x, enemy.y);
        ctx.scale(pulse, pulse);

        ctx.shadowBlur = 25;
        ctx.shadowColor = '#ff416d';

        ctx.strokeStyle = 'rgba(255, 76, 113, 0.65)';
        ctx.lineWidth = 2;

        ctx.beginPath();
        ctx.arc(0, 0, 25, 0, Math.PI * 2);
        ctx.stroke();

        const body = ctx.createRadialGradient(
            -7, -8, 2, 0, 0, 25
        );

        body.addColorStop(0, '#ffb2bd');
        body.addColorStop(0.3, '#ed4768');
        body.addColorStop(1, '#5d112d');

        ctx.fillStyle = body;

        ctx.beginPath();
        ctx.arc(0, 0, 20, 0, Math.PI * 2);
        ctx.fill();

        ctx.shadowBlur = 0;

        ctx.fillStyle = '#fff2f4';
        ctx.shadowColor = '#ff456d';
        ctx.shadowBlur = 15;

        ctx.beginPath();
        ctx.arc(0, 0, 6, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();

        if (enemy === activeEnemy) {
            ctx.save();

            ctx.strokeStyle = '#42e8ff';
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 5]);

            ctx.beginPath();

            ctx.arc(
                enemy.x,
                enemy.y,
                34,
                elapsedTime * 2,
                elapsedTime * 2 + Math.PI * 2
            );

            ctx.stroke();
            ctx.restore();
        }
    }

    // TARGET LOCK

    function selectTarget(enemy) {
        if (!enemy || !enemies.includes(enemy)) return;
        if (activeEnemy) return;

        activeEnemy = enemy;

        enemies.forEach(item => {
            item.element.classList.toggle(
                'locked',
                item === activeEnemy
            );
        });

        statusEl.textContent = 'TARGET LOCKED';
    }

    function releaseTarget(enemy) {
        if (activeEnemy !== enemy) return;

        activeEnemy = null;

        enemy.element?.classList.remove('locked');
    }

    // WRONG CHARACTER

    function showWrongCharacter(enemy) {
        const index = enemy.progress;
        const character = enemy.characterElements[index];

        if (!character) return;

        enemy.wrong = true;
        enemy.wrongIndex = index;

        character.classList.remove('wrong');
        void character.offsetWidth;
        character.classList.add('wrong');

        clearTimeout(wrongTimeout);

        wrongTimeout = setTimeout(() => {
            enemy.wrong = false;
            enemy.wrongIndex = -1;

            character.classList.remove('wrong');
        }, 350);
    }

    // CHARACTER BULLET TARGET POSITION

    function getCharacterPosition(character) {
        const rect = character.getBoundingClientRect();
        const arenaRect = arena.getBoundingClientRect();

        return {
            x: rect.left + rect.width / 2 - arenaRect.left,
            y: rect.top + rect.height / 2 - arenaRect.top
        };
    }

    // FIRE ONE BULLET PER CHARACTER

    function fireCharacterBullet(enemy, character) {
        const target = getCharacterPosition(character);

        shotsFired++;

        bullets.push({
            x: ship.x,
            y: ship.y - 35,

            targetElement: character,

            targetX: target.x,
            targetY: target.y,

            progress: 0,
            duration: 0.18
        });
    }

    // BULLET ANIMATION

    function drawBullets(dt) {
        const completedBullets = [];

        bullets.forEach(bullet => {
            bullet.progress += dt / bullet.duration;

            const t = Math.min(bullet.progress, 1);

            if (bullet.targetElement?.isConnected) {
                const target = getCharacterPosition(
                    bullet.targetElement
                );

                bullet.targetX = target.x;
                bullet.targetY = target.y;
            }

            const x = bullet.x +
                (bullet.targetX - bullet.x) * t;

            const y = bullet.y +
                (bullet.targetY - bullet.y) * t;

            ctx.save();

            ctx.shadowColor = '#42e8ff';
            ctx.shadowBlur = 20;

            ctx.strokeStyle = '#aaf8ff';
            ctx.lineWidth = 3;

            ctx.beginPath();
            ctx.moveTo(x, y + 15);
            ctx.lineTo(x, y - 15);
            ctx.stroke();

            ctx.fillStyle = '#ffffff';

            ctx.beginPath();
            ctx.arc(x, y, 3, 0, Math.PI * 2);
            ctx.fill();

            ctx.restore();

            if (bullet.progress >= 1) {
                completedBullets.push(bullet);
            }
        });

        bullets = bullets.filter(
            bullet => !completedBullets.includes(bullet)
        );

        completedBullets.forEach(handleBulletImpact);
    }

    // BULLET IMPACT

    function handleBulletImpact(bullet) {
        const character = bullet.targetElement;

        if (!character || !character.isConnected) return;

        const rect = character.getBoundingClientRect();
        const arenaRect = arena.getBoundingClientRect();

        const x = rect.left + rect.width / 2 - arenaRect.left;
        const y = rect.top + rect.height / 2 - arenaRect.top;

        createCharacterImpact(x, y);

        character.classList.add('destroyed');

        const enemy = enemies.find(item =>
            item.characterElements.includes(character)
        );

        if (!enemy) return;

        enemy.pendingShots = Math.max(
            0,
            enemy.pendingShots - 1
        );

        if (
            enemy.progress === enemy.word.length &&
            enemy.pendingShots === 0
        ) {
            destroyEnemy(enemy);
        }
    }

    // CHARACTER IMPACT EFFECT

    function createCharacterImpact(x, y) {
        for (let i = 0; i < 9; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 100 + 35;

            particles.push({
                x,
                y,

                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,

                life: 0.2 + Math.random() * 0.2,
                maxLife: 0.4,

                size: Math.random() * 2.5 + 1
            });
        }
    }

    // WORD EXPLOSION

    function createExplosion(x, y) {
        for (let i = 0; i < 32; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 180 + 45;

            particles.push({
                x,
                y,

                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,

                life: 0.7 + Math.random() * 0.5,
                maxLife: 1.2,

                size: Math.random() * 4 + 1
            });
        }
    }

    function updateParticles(dt) {
        particles.forEach(particle => {
            particle.x += particle.vx * dt;
            particle.y += particle.vy * dt;

            particle.vx *= 0.98;
            particle.vy *= 0.98;

            particle.life -= dt;

            const alpha = Math.max(
                0,
                particle.life / particle.maxLife
            );

            ctx.globalAlpha = alpha;
            ctx.fillStyle = '#56eaff';
            ctx.shadowBlur = 12;
            ctx.shadowColor = '#42e8ff';

            ctx.beginPath();

            ctx.arc(
                particle.x,
                particle.y,
                particle.size,
                0,
                Math.PI * 2
            );

            ctx.fill();
        });

        ctx.globalAlpha = 1;
        ctx.shadowBlur = 0;

        particles = particles.filter(
            particle => particle.life > 0
        );
    }

    // DESTROY COMPLETE WORD

    function destroyEnemy(enemy) {
        if (!enemies.includes(enemy)) return;

        createExplosion(enemy.x, enemy.y);

        enemy.element?.remove();

        enemies = enemies.filter(item => item !== enemy);

        releaseTarget(enemy);

        score += enemy.word.length * 100 + combo * 20;

        wordsDestroyed++;
        combo++;

        wave = Math.floor(wordsDestroyed / 5) + 1;

        destroyedEl.textContent = wordsDestroyed;

        statusEl.textContent = 'ENEMY DESTROYED';

        updateStats();
    }

    // KEYBOARD COMBAT

    function handleKeydown(event) {
        if (paused || ended || saving) return;

        if (event.repeat) return;

        if (
            event.ctrlKey ||
            event.metaKey ||
            event.altKey
        ) return;

        if (event.key.length !== 1) return;

        if (difficulty === 'extreme') {
            if (!/^[a-zA-Z0-9@#$%&*!?+\-_=]$/.test(event.key)) {
                return;
            }
        } else if (!/^[a-zA-Z]$/.test(event.key)) {
            return;
        }

        event.preventDefault();

        const character = /^[a-zA-Z]$/.test(event.key)
            ? event.key.toLowerCase()
            : event.key;

        totalChars++;

        if (!activeEnemy) {
            const matchingEnemy = enemies
                .filter(enemy =>
                    enemy.word.startsWith(character)
                )
                .sort((a, b) => b.y - a.y)[0];

            if (!matchingEnemy) {
                mistakes++;
                combo = 0;

                statusEl.textContent = 'NO TARGET MATCH';

                updateStats();
                return;
            }

            selectTarget(matchingEnemy);
        }

        const expectedCharacter =
            activeEnemy.word[activeEnemy.progress];

        if (character !== expectedCharacter) {
            mistakes++;
            combo = 0;

            showWrongCharacter(activeEnemy);

            statusEl.textContent = 'WRONG CHARACTER';

            updateStats();
            return;
        }

        const enemy = activeEnemy;
        const characterElement =
            enemy.characterElements[enemy.progress];

        if (!characterElement) return;

        enemy.progress++;
        enemy.pendingShots++;

        correctChars++;

        enemy.wrong = false;

        fireCharacterBullet(enemy, characterElement);

        statusEl.textContent = 'FIRING';

        updateStats();
    }

    document.addEventListener('keydown', handleKeydown);

    // ENEMY MOVEMENT

    function updateEnemies(dt) {
        for (const enemy of [...enemies]) {
            enemy.y += enemy.speed * dt;
            enemy.phase += dt * 2;

            updateEnemyPosition(enemy);

            if (enemy.y >= ship.y - 35) {
                missedWords++;

                createExplosion(enemy.x, ship.y - 15);

                enemy.element?.remove();

                enemies = enemies.filter(
                    item => item !== enemy
                );

                bullets = bullets.filter(
                    bullet =>
                        !enemy.characterElements.includes(
                            bullet.targetElement
                        )
                );

                if (enemy === activeEnemy) {
                    releaseTarget(enemy);
                }

                combo = 0;

                shipStatus.textContent = 'UNDER ATTACK';
                statusEl.textContent = 'ENEMY BREACHED';
            }
        }
    }

    // GAME UPDATE

    function updateGame(dt) {
        elapsedTime += dt;
        remainingTime -= dt;

        spawnTimer += dt;

        const spawnInterval = Math.max(
            difficulty === 'extreme' ? 0.95 : 1.0,
            config.spawn - (wave - 1) * 0.045
        );

        if (
            spawnTimer >= spawnInterval &&
            enemies.length < config.maxEnemies
        ) {
            spawnTimer = 0;
            createEnemy();
        }

        updateEnemies(dt);

        if (missedWords >= 3) {
            endGame();
            return;
        }

        if (remainingTime <= 0) {
            remainingTime = 0;
            endGame();
            return;
        }

        if (elapsedTime - lastStatsUpdate >= 0.5) {
            lastStatsUpdate = elapsedTime;
            updateStats();
        }
    }

    // DRAW FRAME

    function drawFrame(dt) {
        drawBackground(dt);

        enemies.forEach(drawEnemy);

        drawBullets(dt);

        updateParticles(dt);

        drawShip();

        const danger = ctx.createLinearGradient(
            0,
            ship.y - 45,
            0,
            height
        );

        danger.addColorStop(0, 'rgba(255, 60, 90, 0)');
        danger.addColorStop(1, 'rgba(255, 60, 90, 0.08)');

        ctx.fillStyle = danger;

        ctx.fillRect(
            0,
            ship.y - 45,
            width,
            height
        );
    }

    // STATS

    function updateStats() {
        const minutes = Math.max(
            elapsedTime / 60,
            1 / 60
        );

        const wpm = Math.round(
            (correctChars / 5) / minutes
        );

        const accuracy = totalChars
            ? Math.round((correctChars / totalChars) * 100)
            : 100;

        scoreEl.textContent = String(score).padStart(6, '0');
        waveEl.textContent = String(wave).padStart(2, '0');
        wpmEl.textContent = String(wpm).padStart(3, '0');

        accuracyEl.textContent = `${accuracy}%`;
        comboEl.textContent = `×${combo}`;

        destroyedEl.textContent = wordsDestroyed;

        const seconds = Math.ceil(remainingTime);

        timerEl.textContent =
            `00:${String(seconds).padStart(2, '0')}`;
    }

    // GAME LOOP

    function gameLoop(timestamp) {
        if (ended || paused) return;

        const dt = previousFrame
            ? Math.min((timestamp - previousFrame) / 1000, 0.05)
            : 0;

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

    // CSRF

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

    // END GAME AND SAVE

    async function endGame() {
        if (ended || saving) return;

        ended = true;
        saving = true;

        cancelAnimationFrame(animationId);

        input.disabled = true;

        statusEl.textContent = 'MISSION COMPLETED';
        shipStatus.textContent = 'MISSION ENDED';

        const duration = Math.max(
            1,
            Math.round(elapsedTime)
        );

        const accuracy = totalChars
            ? (correctChars / totalChars) * 100
            : 100;

        const wpm = Math.round(
            (correctChars / 5) /
            Math.max(elapsedTime / 60, 1 / 60)
        );

        const result = {
            difficulty,
            score,
            wpm,
            accuracy,
            words_destroyed: wordsDestroyed,
            missed_words: missedWords,
            mistakes,
            shots_fired: shotsFired,
            highest_wave: wave,
            duration
        };

        try {
            const response = await fetch(saveUrl, {
                method: 'POST',

                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': getCookie('csrftoken')
                },

                body: JSON.stringify(result)
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(
                    data.error || 'Unable to save result'
                );
            }

            window.location.href =
                `/space-shooter/result/${data.result_id}/`;

        } catch (error) {
            saving = false;
            ended = false;

            input.disabled = false;

            statusEl.textContent = 'SAVE FAILED';

            alert(error.message);
        }
    }

    // PAUSE / RESUME

    pauseButton.addEventListener('click', () => {
        if (ended || saving) return;

        paused = !paused;

        pauseButton.innerHTML = paused
            ? '▶ RESUME'
            : 'Ⅱ PAUSE';

        if (paused) {
            cancelAnimationFrame(animationId);

            messageEl.querySelector('strong').textContent =
                'MISSION PAUSED';

            messageEl.querySelector('small').textContent =
                'Resume when ready';

            messageEl.style.display = 'flex';

        } else {
            messageEl.style.display = 'none';

            shipStatus.textContent = 'OPERATIONAL';

            startLoop();
        }
    });

    // QUIT MISSION

    quitButton.addEventListener('click', () => {
        if (
            confirm('End this mission and save your result?')
        ) {
            endGame();
        }
    });

    // INITIALIZE

    resizeCanvas();

    messageEl.style.display = 'none';

    shipStatus.textContent = 'OPERATIONAL';
    statusEl.textContent = 'ENEMY SCANNING';

    updateStats();

    createEnemy();

    input.focus();

    arena.addEventListener('click', () => {
        input.focus();
    });

    startLoop();
});