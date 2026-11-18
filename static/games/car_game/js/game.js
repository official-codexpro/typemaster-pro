
document.addEventListener('DOMContentLoaded', () => {
    const root = document.getElementById('carRacingGame');
    if (!root) return;

    // ELEMENTS
    const canvas = document.getElementById('racingCanvas');
    const ctx = canvas.getContext('2d');

    const scoreEl = document.getElementById('scoreValue');
    const wpmEl = document.getElementById('wpmValue');
    const accuracyEl = document.getElementById('accuracyValue');
    const distanceEl = document.getElementById('distanceValue');
    const collisionEl = document.getElementById('collisionValue');

    const targetEl = document.getElementById('targetWord');
    const input = document.getElementById('typingInput');
    const feedback = document.getElementById('typingFeedback');

    const startOverlay = document.getElementById('startOverlay');
    const pauseOverlay = document.getElementById('pauseOverlay');
    const countdownOverlay = document.getElementById('countdownOverlay');
    const countdownValue = document.getElementById('countdownValue');

    const startButton = document.getElementById('startButton');
    const pauseButton = document.getElementById('pauseButton');
    const resumeButton = document.getElementById('resumeButton');
    const raceMessage = document.getElementById('raceMessage');

    // CONFIGURATION
    const difficulty = root.dataset.difficulty || 'normal';

    const CONFIG = {
        easy: {
            speed: 0.24,
            spawnRate: 2.5,
            words: ['road', 'drive', 'speed', 'green', 'light', 'car', 'race']
        },
        normal: {
            speed: 0.34,
            spawnRate: 2,
            words: ['engine', 'racing', 'driver', 'street', 'corner', 'traffic']
        },
        hard: {
            speed: 0.44,
            spawnRate: 1.55,
            words: ['velocity', 'highway', 'overtake', 'traction', 'racer', 'distance']
        },
        extreme: {
            speed: 0.56,
            spawnRate: 1.2,
            words: ['acceleration', 'transmission', 'competition', 'performance', 'navigation']
        }
    };

    const settings = CONFIG[difficulty] || CONFIG.normal;

    // GAME STATE
    let width = 0;
    let height = 0;
    let animationId = null;
    let previousTime = 0;

    let running = false;
    let paused = false;
    let ended = false;
    let saving = false;

    let elapsed = 0;
    let remainingTime = 90;
    let spawnTimer = 0;

    let score = 0;
    let wordsTyped = 0;
    let correctCharacters = 0;
    let totalCharacters = 0;
    let mistakes = 0;
    let collisions = 0;
    let distance = 0;

    let typedWord = '';
    let traffic = [];
    let particles = [];
    let roadOffset = 0;
    let shake = 0;

    const MAX_COLLISIONS = 10;
    const RACE_DURATION = 90;
    const WORD_TARGET = 30;

    // CANVAS SIZE
    function resizeCanvas() {
        const rect = canvas.getBoundingClientRect();
        const dpr = Math.min(window.devicePixelRatio || 1, 2);

        width = rect.width;
        height = rect.height;

        canvas.width = Math.round(width * dpr);
        canvas.height = Math.round(height * dpr);

        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        if (!running) drawScene();
    }

    window.addEventListener('resize', resizeCanvas);

    // ROAD GEOMETRY
    function roadPosition(progress) {
        const horizon = height * 0.36;
        const bottom = height;
        const y = horizon + progress * (bottom - horizon);

        const roadTop = width * 0.12;
        const roadBottom = width * 0.91;

        const roadWidth = roadTop + (roadBottom - roadTop) * progress;

        const center = width / 2;

        return {
            y,
            left: center - roadWidth / 2,
            right: center + roadWidth / 2,
            width: roadWidth,
            center
        };
    }

    // DRAW BACKGROUND
    function drawBackground() {
        const sky = ctx.createLinearGradient(0, 0, 0, height * 0.5);
        sky.addColorStop(0, '#182a48');
        sky.addColorStop(1, '#e58b70');

        ctx.fillStyle = sky;
        ctx.fillRect(0, 0, width, height * 0.5);

        // Sun
        ctx.beginPath();
        ctx.arc(width * 0.75, height * 0.19, Math.min(width, height) * 0.065, 0, Math.PI * 2);
        ctx.fillStyle = '#ffd78b';
        ctx.fill();

        // Mountains
        ctx.fillStyle = '#34445a';
        ctx.beginPath();
        ctx.moveTo(0, height * 0.38);
        ctx.lineTo(width * 0.13, height * 0.18);
        ctx.lineTo(width * 0.26, height * 0.38);
        ctx.lineTo(width * 0.42, height * 0.22);
        ctx.lineTo(width * 0.62, height * 0.39);
        ctx.lineTo(width * 0.8, height * 0.2);
        ctx.lineTo(width, height * 0.38);
        ctx.closePath();
        ctx.fill();

        // Ground
        ctx.fillStyle = '#416b43';
        ctx.fillRect(0, height * 0.36, width, height * 0.64);
    }

    // ROAD
    function drawRoad() {
        const horizon = height * 0.36;
        const top = roadPosition(0);
        const bottom = roadPosition(1);

        // Road surface
        ctx.fillStyle = '#333b48';
        ctx.beginPath();
        ctx.moveTo(top.left, horizon);
        ctx.lineTo(top.right, horizon);
        ctx.lineTo(bottom.right, height);
        ctx.lineTo(bottom.left, height);
        ctx.closePath();
        ctx.fill();

        // Road edges
        ctx.strokeStyle = '#f5f0d9';
        ctx.lineWidth = 3;

        ctx.beginPath();
        ctx.moveTo(top.left, horizon);
        ctx.lineTo(bottom.left, height);
        ctx.moveTo(top.right, horizon);
        ctx.lineTo(bottom.right, height);
        ctx.stroke();

        // Roadside stripes
        for (let i = 0; i < 18; i++) {
            const p = ((i / 18) + roadOffset) % 1;
            const pos = roadPosition(p);
            const stripeWidth = 3 + p * 9;

            ctx.fillStyle = i % 2 ? '#f8f1d7' : '#d94b4b';

            ctx.fillRect(
                pos.left - stripeWidth,
                pos.y,
                stripeWidth,
                8 + p * 18
            );

            ctx.fillRect(
                pos.right,
                pos.y,
                stripeWidth,
                8 + p * 18
            );
        }

        // Lane dividers
        for (let lane = 1; lane <= 2; lane++) {
            for (let i = 0; i < 15; i++) {
                const p = ((i / 15) + roadOffset) % 1;
                const pos = roadPosition(p);

                const x = pos.left + pos.width * (lane / 3);
                const dashHeight = 3 + p * 18;
                const dashWidth = 1 + p * 3;

                ctx.fillStyle = '#fff5cc';
                ctx.fillRect(
                    x - dashWidth / 2,
                    pos.y,
                    dashWidth,
                    dashHeight
                );
            }
        }
    }

    // TREES
    function drawTrees() {
        for (let i = 0; i < 13; i++) {
            const p = ((i / 13) + roadOffset * 0.8) % 1;
            const pos = roadPosition(p);

            const size = 8 + p * 35;
            const sides = [
                pos.left - size * 2.2,
                pos.right + size * 2.2
            ];

            sides.forEach((x, side) => {
                const treeX = x + (side === 0 ? -1 : 1) * p * 10;

                ctx.fillStyle = '#59402e';
                ctx.fillRect(
                    treeX - size * 0.09,
                    pos.y - size * 0.25,
                    size * 0.18,
                    size * 0.7
                );

                ctx.fillStyle = i % 2 ? '#174b35' : '#22623c';

                ctx.beginPath();
                ctx.arc(
                    treeX,
                    pos.y - size * 0.5,
                    size * 0.5,
                    0,
                    Math.PI * 2
                );
                ctx.fill();
            });
        }
    }

    // DRAW PLAYER CAR
    function drawPlayerCar() {
        const carWidth = Math.min(width * 0.13, 100);
        const carHeight = carWidth * 1.55;

        const x = width / 2;
        const y = height - carHeight * 0.78;

        ctx.save();
        ctx.translate(x, y);

        // Shadow
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.beginPath();
        ctx.ellipse(0, carHeight * 0.45, carWidth * 0.62, carHeight * 0.18, 0, 0, Math.PI * 2);
        ctx.fill();

        // Wheels
        ctx.fillStyle = '#111';
        ctx.fillRect(-carWidth * 0.55, -carHeight * 0.05, carWidth * 0.2, carHeight * 0.48);
        ctx.fillRect(carWidth * 0.35, -carHeight * 0.05, carWidth * 0.2, carHeight * 0.48);

        // Body
        ctx.fillStyle = '#e84545';
        ctx.beginPath();
        ctx.moveTo(-carWidth * 0.43, carHeight * 0.48);
        ctx.lineTo(-carWidth * 0.35, -carHeight * 0.3);
        ctx.lineTo(-carWidth * 0.2, -carHeight * 0.48);
        ctx.lineTo(carWidth * 0.2, -carHeight * 0.48);
        ctx.lineTo(carWidth * 0.35, -carHeight * 0.3);
        ctx.lineTo(carWidth * 0.43, carHeight * 0.48);
        ctx.closePath();
        ctx.fill();

        // Windshield
        ctx.fillStyle = '#a8d9ec';
        ctx.beginPath();
        ctx.moveTo(-carWidth * 0.27, -carHeight * 0.18);
        ctx.lineTo(-carWidth * 0.16, -carHeight * 0.38);
        ctx.lineTo(carWidth * 0.16, -carHeight * 0.38);
        ctx.lineTo(carWidth * 0.27, -carHeight * 0.18);
        ctx.closePath();
        ctx.fill();

        // Front lights
        ctx.fillStyle = '#fff1a8';
        ctx.fillRect(-carWidth * 0.34, carHeight * 0.31, carWidth * 0.16, carHeight * 0.07);
        ctx.fillRect(carWidth * 0.18, carHeight * 0.31, carWidth * 0.16, carHeight * 0.07);

        // Center stripe
        ctx.fillStyle = '#ffd166';
        ctx.fillRect(-carWidth * 0.035, -carHeight * 0.43, carWidth * 0.07, carHeight * 0.82);

        ctx.restore();
    }

    // TRAFFIC CARS
    function drawTrafficCar(car) {
        const pos = roadPosition(car.progress);
        const laneX = pos.left + pos.width * ((car.lane + 0.5) / 3);

        const carWidth = 15 + car.progress * 48;
        const carHeight = carWidth * 1.45;

        ctx.save();
        ctx.translate(laneX, pos.y);

        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.fillRect(-carWidth * 0.55, carHeight * 0.25, carWidth * 1.1, carHeight * 0.15);

        ctx.fillStyle = '#151515';
        ctx.fillRect(-carWidth * 0.55, -carHeight * 0.1, carWidth * 0.16, carHeight * 0.5);
        ctx.fillRect(carWidth * 0.39, -carHeight * 0.1, carWidth * 0.16, carHeight * 0.5);

        ctx.fillStyle = car.color;
        ctx.beginPath();
        ctx.roundRect(
            -carWidth * 0.45,
            -carHeight * 0.35,
            carWidth * 0.9,
            carHeight * 0.85,
            carWidth * 0.12
        );
        ctx.fill();

        ctx.fillStyle = '#b9dce8';
        ctx.fillRect(-carWidth * 0.3, -carHeight * 0.27, carWidth * 0.6, carHeight * 0.25);

        ctx.fillStyle = '#fff0a0';
        ctx.fillRect(-carWidth * 0.35, carHeight * 0.3, carWidth * 0.17, carHeight * 0.08);
        ctx.fillRect(carWidth * 0.18, carHeight * 0.3, carWidth * 0.17, carHeight * 0.08);

        // Word label
        if (car.progress > 0.18) {
            const labelWidth = Math.max(65, car.word.length * 9 + 22);
            const labelY = -carHeight * 0.9;

            ctx.fillStyle = 'rgba(10,13,22,0.92)';
            ctx.beginPath();
            ctx.roundRect(-labelWidth / 2, labelY - 15, labelWidth, 25, 6);
            ctx.fill();

            ctx.strokeStyle = '#a78bfa';
            ctx.lineWidth = 1;
            ctx.stroke();

            ctx.fillStyle = '#ffffff';
            ctx.font = `bold ${Math.max(10, 9 + car.progress * 4)}px monospace`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(car.word, 0, labelY - 2);
        }

        ctx.restore();
    }

    // PARTICLES
    function drawParticles() {
        particles.forEach(p => {
            ctx.globalAlpha = Math.max(0, p.life);
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
        });

        ctx.globalAlpha = 1;
    }

    function createParticles(x, y, color) {
        for (let i = 0; i < 15; i++) {
            particles.push({
                x,
                y,
                vx: (Math.random() - 0.5) * 160,
                vy: (Math.random() - 0.5) * 160,
                life: 1,
                size: Math.random() * 4 + 2,
                color
            });
        }
    }

    // COMPLETE SCENE
    function drawScene() {
        if (!width || !height) return;

        ctx.clearRect(0, 0, width, height);

        ctx.save();

        if (shake > 0) {
            ctx.translate(
                (Math.random() - 0.5) * shake,
                (Math.random() - 0.5) * shake
            );
        }

        drawBackground();
        drawRoad();
        drawTrees();

        traffic
            .slice()
            .sort((a, b) => a.progress - b.progress)
            .forEach(drawTrafficCar);

        drawParticles();
        drawPlayerCar();

        ctx.restore();
    }

    // TRAFFIC SPAWNING
    function spawnTraffic() {
        const availableLanes = [0, 1, 2];

        const occupied = traffic
            .filter(car => car.progress < 0.3)
            .map(car => car.lane);

        const lanes = availableLanes.filter(lane => !occupied.includes(lane));

        if (!lanes.length) return;

        const lane = lanes[Math.floor(Math.random() * lanes.length)];
        const words = settings.words;

        const word = words[Math.floor(Math.random() * words.length)];

        const colors = ['#2878b9', '#e0a12d', '#3d9a72', '#9a69c8', '#d85b45'];

        traffic.push({
            lane,
            word,
            progress: 0.02,
            color: colors[Math.floor(Math.random() * colors.length)],
            speed: settings.speed
        });

        updateTarget();
    }

    // CURRENT TARGET
    function getTargetCar() {
        return traffic
            .filter(car => car.progress < 0.95)
            .sort((a, b) => b.progress - a.progress)[0] || null;
    }

    function updateTarget() {
        const target = getTargetCar();

        targetEl.textContent = target ? target.word : 'WAIT...';
    }

    // LIVE STATS
    function updateStats() {
        const minutes = Math.max(elapsed / 60, 1 / 60);

        const wpm = Math.round((correctCharacters / 5) / minutes);

        const accuracy = totalCharacters > 0
            ? Math.round((correctCharacters / totalCharacters) * 100)
            : 100;

        scoreEl.textContent = score;
        wpmEl.textContent = wpm;
        accuracyEl.textContent = accuracy + '%';
        distanceEl.textContent = Math.floor(distance);
        collisionEl.textContent = collisions;
    }

    // MESSAGE
    function showMessage(message, color = '#ffffff') {
        raceMessage.textContent = message;
        raceMessage.style.color = color;

        clearTimeout(showMessage.timeout);

        showMessage.timeout = setTimeout(() => {
            raceMessage.textContent = '';
        }, 900);
    }

    // WORD TYPING
    input.addEventListener('input', () => {
        if (!running || paused || ended) return;

        const value = input.value.toLowerCase();

        // Only accept letters
        if (/[^a-z]/.test(value)) {
            input.value = value.replace(/[^a-z]/g, '');
            return;
        }

        const target = getTargetCar();

        if (!target) {
            typedWord = value;
            return;
        }

        typedWord = value;

        if (!target.word.startsWith(typedWord)) {
            input.classList.add('typing-error');
            feedback.textContent = 'Wrong letters! Try again.';
            feedback.style.color = '#f87171';
        } else {
            input.classList.remove('typing-error');
            feedback.textContent = 'Keep going...';
            feedback.style.color = '#4ade80';
        }
    });

    input.addEventListener('keydown', event => {
        if (event.key !== ' ' && event.key !== 'Enter') return;

        event.preventDefault();

        if (!running || paused || ended) return;

        const typed = input.value.trim().toLowerCase();
        const target = getTargetCar();

        if (!typed) return;

        totalCharacters += typed.length;

        if (target && typed === target.word) {
            correctCharacters += typed.length;
            wordsTyped++;

            score += 100 + Math.round(target.progress * 100);
            distance += 1;

            const pos = roadPosition(target.progress);
            const x = pos.left + pos.width * ((target.lane + 0.5) / 3);

            createParticles(x, pos.y, '#4ade80');

            traffic = traffic.filter(car => car !== target);

            showMessage('OVERTAKE! +100', '#4ade80');
            feedback.textContent = 'Perfect! Next target incoming.';
            feedback.style.color = '#4ade80';

        } else {
            mistakes++;
            score = Math.max(0, score - 20);

            showMessage('WRONG WORD!', '#f87171');
            feedback.textContent = 'Incorrect word. Try the next target.';
            feedback.style.color = '#f87171';
        }

        input.value = '';
        typedWord = '';

        updateTarget();
        updateStats();

        if (wordsTyped >= WORD_TARGET) {
            endGame('FINISH LINE!');
        }
    });

    // GAME UPDATE
    function updateGame(dt) {
        elapsed += dt;
        remainingTime = Math.max(0, RACE_DURATION - elapsed);

        roadOffset = (roadOffset + dt * settings.speed * 0.8) % 1;
        shake = Math.max(0, shake - dt * 30);

        spawnTimer += dt;

        if (spawnTimer >= settings.spawnRate) {
            spawnTimer = 0;
            spawnTraffic();
        }

        traffic.forEach(car => {
            car.progress += dt * car.speed;
        });

        // Collision when traffic reaches the player
        const missed = traffic.filter(car => car.progress >= 0.96);

        missed.forEach(car => {
            collisions++;
            mistakes++;
            shake = 12;

            showMessage('CRASH! -1 LIFE', '#f87171');

            createParticles(width / 2, height * 0.82, '#f87171');

            traffic = traffic.filter(item => item !== car);
        });

        particles.forEach(p => {
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.life -= dt * 1.8;
        });

        particles = particles.filter(p => p.life > 0);

        updateTarget();
        updateStats();

        if (collisions >= MAX_COLLISIONS) {
            endGame('RACE OVER!');
        } else if (remainingTime <= 0) {
            endGame('TIME UP!');
        }
    }

    // GAME LOOP
    function gameLoop(timestamp) {
        if (!running || paused || ended) return;

        const dt = previousTime
            ? Math.min((timestamp - previousTime) / 1000, 0.05)
            : 0;

        previousTime = timestamp;

        updateGame(dt);
        drawScene();

        if (running && !paused && !ended) {
            animationId = requestAnimationFrame(gameLoop);
        }
    }

    function startLoop() {
        cancelAnimationFrame(animationId);
        previousTime = 0;
        animationId = requestAnimationFrame(gameLoop);
    }

    // COUNTDOWN
    function countdown() {
        let count = 3;

        countdownOverlay.classList.remove('hidden');
        countdownValue.textContent = count;

        const timer = setInterval(() => {
            count--;

            if (count <= 0) {
                clearInterval(timer);
                countdownOverlay.classList.add('hidden');
                beginRace();
                return;
            }

            countdownValue.textContent = count;
        }, 800);
    }

    // START
    function beginRace() {
        running = true;
        paused = false;

        startOverlay.classList.add('hidden');
        pauseOverlay.classList.add('hidden');

        input.disabled = false;
        input.value = '';
        input.focus();

        pauseButton.disabled = false;
        pauseButton.textContent = 'PAUSE';

        feedback.textContent = 'Type the target word and press space.';
        feedback.style.color = '';

        spawnTraffic();
        startLoop();
    }

    startButton.addEventListener('click', () => {
        if (running || ended) return;
        countdown();
    });

    // PAUSE / RESUME
    function pauseRace() {
        if (!running || ended) return;

        paused = !paused;

        if (paused) {
            cancelAnimationFrame(animationId);
            pauseOverlay.classList.remove('hidden');
            input.disabled = true;
            pauseButton.textContent = 'RESUME';
        } else {
            pauseOverlay.classList.add('hidden');
            input.disabled = false;
            input.focus();
            pauseButton.textContent = 'PAUSE';
            startLoop();
        }
    }

    pauseButton.addEventListener('click', () => {
        if (paused) {
            pauseRace();
        } else if (running) {
            pauseRace();
        }
    });

    resumeButton.addEventListener('click', () => {
        if (paused) pauseRace();
    });

    // CSRF
    function getCookie(name) {
        const cookies = document.cookie.split(';');

        for (const cookie of cookies) {
            const item = cookie.trim();

            if (item.startsWith(name + '=')) {
                return decodeURIComponent(item.slice(name.length + 1));
            }
        }

        return '';
    }

    // END GAME + SAVE RESULT
    async function endGame(reason) {
        if (ended || saving) return;

        ended = true;
        running = false;
        saving = true;

        cancelAnimationFrame(animationId);

        input.disabled = true;
        pauseButton.disabled = true;

        showMessage(reason, '#ffd166');
        feedback.textContent = 'Saving your race result...';

        const duration = Math.max(1, Math.round(elapsed));

        const accuracy = totalCharacters > 0
            ? (correctCharacters / totalCharacters) * 100
            : 100;

        const wpm = Math.round(
            (correctCharacters / 5) / Math.max(elapsed / 60, 1 / 60)
        );

        const result = {
            difficulty,
            score,
            wpm,
            accuracy,
            words_typed: wordsTyped,
            distance: Math.floor(distance),
            collisions,
            mistakes,
            duration
        };

        try {
            const response = await fetch(root.dataset.saveUrl, {
                method: 'POST',
                credentials: 'same-origin',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': getCookie('csrftoken')
                },
                body: JSON.stringify(result)
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Unable to save race result.');
            }

            window.location.href =
                `/car-racing/result/${data.result_id}/`;

        } catch (error) {
            saving = false;
            feedback.textContent = 'Could not save result. Please try again.';
            feedback.style.color = '#f87171';

            console.error('Car Racing save error:', error);
        }
    }

    // INITIALIZE
    resizeCanvas();
    updateStats();
    updateTarget();
    drawScene();
});
