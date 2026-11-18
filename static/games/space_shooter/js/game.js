document.addEventListener('DOMContentLoaded', () => {
    const game = document.getElementById('spaceShooterGame');

    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');

    const input = document.getElementById('typingInput');
    const target = document.getElementById('targetWord');

    const scoreElement = document.getElementById('score');
    const waveElement = document.getElementById('wave');
    const wpmElement = document.getElementById('wpm');
    const accuracyElement = document.getElementById('accuracy');

    const pauseButton = document.getElementById('pauseGame');
    const quitButton = document.getElementById('quitGame');

    const difficulty = game.dataset.difficulty;

    const wordBanks = {
        easy: ['cat', 'sun', 'book', 'tree', 'game', 'star', 'moon'],
        normal: ['planet', 'rocket', 'galaxy', 'typing', 'system', 'cosmic'],
        hard: ['asteroid', 'keyboard', 'velocity', 'mission', 'universe'],
        extreme: ['javascript', 'technology', 'development', 'programming']
    };

    let score = 0;
    let correctChars = 0;
    let totalChars = 0;
    let wordsDestroyed = 0;
    let mistakes = 0;
    let shotsFired = 0;
    let wave = 1;

    let currentWord = '';
    let startTime = Date.now();
    let timeLeft = 60;
    let paused = false;
    let ended = false;

    const stars = Array.from({ length: 70 }, () => ({
        x: Math.random(),
        y: Math.random(),
        speed: 0.0005 + Math.random() * 0.001
    }));

    function resizeCanvas() {
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width * devicePixelRatio;
        canvas.height = rect.height * devicePixelRatio;
        ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
    }

    function drawSpace() {
        const width = canvas.clientWidth;
        const height = canvas.clientHeight;

        ctx.fillStyle = '#080d1b';
        ctx.fillRect(0, 0, width, height);

        stars.forEach(star => {
            star.y += star.speed;

            if (star.y > 1) star.y = 0;

            ctx.fillStyle = '#ffffff';
            ctx.globalAlpha = 0.7;
            ctx.fillRect(star.x * width, star.y * height, 2, 2);
        });

        ctx.globalAlpha = 1;

        ctx.fillStyle = '#8b5cf6';
        ctx.font = '32px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('🚀', width / 2, height - 35);

        if (!ended && !paused) {
            requestAnimationFrame(drawSpace);
        }
    }

    function nextWord() {
        const words = wordBanks[difficulty] || wordBanks.normal;
        currentWord = words[Math.floor(Math.random() * words.length)];

        target.textContent = currentWord;
        input.value = '';
        input.focus();
    }

    function updateStats() {
        const elapsed = (Date.now() - startTime) / 60000;
        const wpm = elapsed > 0 ? Math.round((correctChars / 5) / elapsed) : 0;
        const accuracy = totalChars > 0
            ? Math.round((correctChars / totalChars) * 100)
            : 100;

        scoreElement.textContent = score;
        waveElement.textContent = wave;
        wpmElement.textContent = wpm;
        accuracyElement.textContent = `${accuracy}%`;
    }

    input.addEventListener('input', () => {
        if (paused || ended) return;

        const typed = input.value;
        totalChars += 1;

        if (currentWord.startsWith(typed)) {
            correctChars += 1;
        } else {
            mistakes += 1;
            input.value = '';
        }

        if (typed === currentWord) {
            score += currentWord.length * 10;
            wordsDestroyed += 1;
            shotsFired += 1;

            wave = Math.floor(wordsDestroyed / 5) + 1;

            nextWord();
        }

        updateStats();
    });

    function getCookie(name) {
        const cookies = document.cookie.split(';');

        for (const cookie of cookies) {
            const item = cookie.trim();

            if (item.startsWith(name + '=')) {
                return decodeURIComponent(item.substring(name.length + 1));
            }
        }

        return '';
    }

    async function endGame() {
        if (ended) return;

        ended = true;
        input.disabled = true;

        const duration = Math.max(
            1,
            Math.round((Date.now() - startTime) / 1000)
        );

        const elapsedMinutes = duration / 60;

        const wpm = Math.round(
            (correctChars / 5) / elapsedMinutes
        );

        const accuracy = totalChars > 0
            ? (correctChars / totalChars) * 100
            : 100;

        const result = {
            difficulty,
            score,
            wpm,
            accuracy,
            words_destroyed: wordsDestroyed,
            missed_words: 0,
            mistakes,
            shots_fired: shotsFired,
            highest_wave: wave,
            duration
        };

        try {
            const response = await fetch('/space-shooter/save/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': getCookie('csrftoken')
                },
                body: JSON.stringify(result)
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Could not save result');
            }

            window.location.href =
                `/space-shooter/result/${data.result_id}/`;

        } catch (error) {
            alert('Result save failed: ' + error.message);
            ended = false;
            input.disabled = false;
        }
    }

    pauseButton.addEventListener('click', () => {
        if (ended) return;

        paused = !paused;
        pauseButton.textContent = paused ? 'Resume' : 'Pause';

        if (!paused) {
            drawSpace();
            input.focus();
        }
    });

    quitButton.addEventListener('click', () => {
        if (confirm('Quit this game? Your current result will be saved.')) {
            endGame();
        }
    });

    const timer = setInterval(() => {
        if (paused || ended) return;

        timeLeft--;

        if (timeLeft <= 0) {
            clearInterval(timer);
            endGame();
        }
    }, 1000);

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    nextWord();
    drawSpace();
});