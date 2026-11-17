
(() => {
    "use strict";

    const $ = id => document.getElementById(id);
    const canvas = $("cv");
    const ctx = canvas.getContext("2d");

    const difficultySettings = {
        easy:    { speed: 24, spawn: 3.2, words: "code space laser orbit pixel focus speed galaxy rocket typing planet".split(" ") },
        normal:  { speed: 38, spawn: 2.5, words: "python javascript keyboard function gravity asteroid mission developer algorithm database terminal".split(" ") },
        hard:    { speed: 55, spawn: 1.8, words: "authentication infrastructure optimization encryption debugging architecture framework protocol".split(" ") },
        extreme: { speed: 78, spawn: 1.2, words: ["const", "=>", "async", "404", "HTTP", "0xFF", "sudo", "&&", "!= ", "JSON.parse"] }
    };

    let W, H, dpr;
    let stars = [];
    let words = [];
    let bullets = [];
    let particles = [];

    let score = 0;
    let combo = 0;
    let wave = 1;
    let shots = 0;
    let kills = 0;
    let missed = 0;
    let mistakes = 0;
    let correctChars = 0;
    let totalChars = 0;
    let typed = "";
    let targetId = null;
    let nextId = 0;
    let spawnTimer = 0;
    let elapsed = 0;
    let startTime = 0;
    let lastTime = 0;
    let active = false;
    let paused = false;
    let ended = false;
    let saving = false;
    let selectedDifficulty = "normal";
    let animationId = null;

    const ship = { x: 0, y: 0, recoil: 0 };

    function resize() {
        W = canvas.clientWidth;
        H = canvas.clientHeight;
        dpr = Math.min(window.devicePixelRatio || 1, 2);

        canvas.width = W * dpr;
        canvas.height = H * dpr;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        ship.x = W / 2;
        ship.y = H - 105;

        stars = Array.from(
            { length: Math.max(60, Math.floor(W * H / 1800)) },
            () => ({
                x: Math.random() * W,
                y: Math.random() * H,
                size: Math.random() * 1.5 + .3,
                speed: Math.random() * 25 + 8
            })
        );
    }

    window.addEventListener("resize", resize);
    resize();

    function getTarget() {
        return words.find(word => word.id === targetId);
    }

    function updateTarget() {
        const word = getTarget();

        $("target").innerHTML = word
            ? word.text.split("").map((char, index) => {
                const cls = index < typed.length
                    ? "done"
                    : index === typed.length
                        ? "next"
                        : "rest";

                return `<span class="${cls}">${char}</span>`;
            }).join("")
            : '<span class="rest">SCANNING FOR TARGETS...</span>';

        $("progress").style.width = word
            ? `${typed.length / word.text.length * 100}%`
            : "0%";
    }

    function selectTarget(word) {
        targetId = word ? word.id : null;
        typed = "";
        updateTarget();
    }

    function spawnWord() {
        const settings = difficultySettings[selectedDifficulty];
        const pool = settings.words;

        const text = pool[Math.floor(Math.random() * pool.length)];
        const margin = Math.min(100, W * .15);

        const word = {
            id: ++nextId,
            text,
            x: margin + Math.random() * Math.max(10, W - margin * 2),
            y: -35,
            speed: settings.speed + Math.random() * 12 + wave * 2,
            phase: Math.random() * 7
        };

        words.push(word);

        if (targetId === null) {
            selectTarget(word);
        }
    }

    function fire(word) {
        bullets.push({
            x: ship.x,
            y: ship.y - 25,
            startX: ship.x,
            startY: ship.y - 25,
            targetX: word.x,
            targetY: word.y,
            progress: 0,
            duration: Math.max(
                .12,
                Math.hypot(word.x - ship.x, word.y - ship.y) / 1000
            ),
            wordId: word.id
        });

        shots++;
        ship.recoil = 1;
    }

    function burst(x, y, color = "#63e8ff", count = 15) {
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 150 + 30;

            particles.push({
                x, y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: .6,
                color
            });
        }
    }

    function updateHUD() {
        $("score").textContent = String(score).padStart(5, "0");
        $("combo").textContent = `×${combo}`;
        $("wave").textContent = String(wave).padStart(2, "0");
    }

    function calculateStats() {
        const duration = Math.max(1, Math.floor(elapsed));
        const minutes = Math.max(elapsed / 60, 1 / 60);

        const accuracy = totalChars
            ? (correctChars / totalChars) * 100
            : 0;

        const wpm = Math.round((correctChars / 5) / minutes);

        return {
            duration,
            accuracy: Math.round(accuracy * 10) / 10,
            wpm
        };
    }

    function getCookie(name) {
        const cookies = document.cookie.split(";");

        for (const cookie of cookies) {
            const value = cookie.trim();

            if (value.startsWith(name + "=")) {
                return decodeURIComponent(value.substring(name.length + 1));
            }
        }

        return "";
    }

    async function saveResult() {
        if (saving) return;
        saving = true;

        const stats = calculateStats();

        const payload = {
            difficulty: selectedDifficulty,
            score,
            wpm: stats.wpm,
            accuracy: stats.accuracy,
            words_destroyed: kills,
            missed_words: missed,
            mistakes,
            shots_fired: shots,
            highest_wave: wave,
            duration: stats.duration
        };

        try {
            const response = await fetch("/space-shooter/save/", {
                method: "POST",
                credentials: "same-origin",
                headers: {
                    "Content-Type": "application/json",
                    "X-CSRFToken": getCookie("csrftoken")
                },
                body: JSON.stringify(payload)
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || "Could not save result");
            }

            $("stats").textContent =
                `${kills} destroyed · ${stats.wpm} WPM · ${stats.accuracy}% accuracy · Saved`;

        } catch (error) {
            console.error("Result save failed:", error);

            $("stats").textContent =
                `${kills} destroyed · ${stats.wpm} WPM · ${stats.accuracy}% accuracy · Save failed`;
        }
    }

    function endGame() {
        if (ended) return;

        ended = true;
        active = false;

        const stats = calculateStats();

        $("final").textContent = score.toLocaleString();
        $("stats").textContent =
            `${kills} destroyed · ${stats.wpm} WPM · ${stats.accuracy}% accuracy`;

        $("over").classList.remove("hide");

        cancelAnimationFrame(animationId);
        saveResult();
    }

    function resetGame() {
        score = 0;
        combo = 0;
        wave = 1;
        shots = 0;
        kills = 0;
        missed = 0;
        mistakes = 0;
        correctChars = 0;
        totalChars = 0;

        words = [];
        bullets = [];
        particles = [];

        typed = "";
        targetId = null;
        nextId = 0;
        spawnTimer = 0;
        elapsed = 0;

        paused = false;
        ended = false;
        saving = false;
        active = true;

        selectedDifficulty = $("difficulty").value;

        ship.x = W / 2;
        ship.y = H - 105;

        $("over").classList.add("hide");
        $("paused").classList.add("hide");
        $("pause").textContent = "Ⅱ PAUSE";

        updateHUD();
        spawnWord();
        updateTarget();

        startTime = performance.now();
        lastTime = startTime;

        cancelAnimationFrame(animationId);
        animationId = requestAnimationFrame(loop);
    }

    function pauseGame() {
        if (!active || ended) return;

        paused = !paused;

        $("paused").classList.toggle("hide", !paused);
        $("pause").textContent = paused ? "▶ RESUME" : "Ⅱ PAUSE";

        if (!paused) {
            lastTime = performance.now();
            animationId = requestAnimationFrame(loop);
        } else {
            cancelAnimationFrame(animationId);
        }
    }

    window.addEventListener("keydown", event => {
        if (event.key === "Escape") {
            pauseGame();
            return;
        }

        if (
            !active || paused || ended ||
            event.ctrlKey || event.metaKey || event.altKey ||
            event.key.length !== 1 ||
            !/^[a-z0-9]$/i.test(event.key)
        ) return;

        event.preventDefault();

        const word = getTarget();

        if (!word) return;

        totalChars++;

        const expected = word.text[typed.length];

        if (event.key.toLowerCase() === expected.toLowerCase()) {
            correctChars++;
            fire(word);
            typed += expected;

            updateTarget();

            if (typed.length === word.text.length) {
                const points = word.text.length * 12 + (combo + 1) * 3;

                score += points;
                combo++;
                kills++;

                burst(word.x, word.y, "#63e8ff", 25);
                updateHUD();

                word.destroyed = true;

                const remaining = words
                    .filter(item => item.id !== word.id)
                    .sort((a, b) => b.y - a.y);

                selectTarget(remaining[0] || null);

                wave = 1 + Math.floor(kills / 8);
                updateHUD();
            }
        } else {
            mistakes++;
            combo = 0;
            updateHUD();
        }
    }, { passive: false });

    function drawBackground(dt) {
        ctx.clearRect(0, 0, W, H);

        const gradient = ctx.createRadialGradient(
            W / 2, H * .85, 0,
            W / 2, H * .85, Math.max(W, H) * .8
        );

        gradient.addColorStop(0, "#172e60");
        gradient.addColorStop(.5, "#09142f");
        gradient.addColorStop(1, "#030611");

        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, W, H);

        stars.forEach(star => {
            ctx.fillStyle = "#dff7ff";
            ctx.globalAlpha = .7;
            ctx.beginPath();
            ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
            ctx.fill();

            star.y += star.speed * dt;

            if (star.y > H) {
                star.y = 0;
                star.x = Math.random() * W;
            }
        });

        ctx.globalAlpha = 1;
    }

    function drawShip() {
        ctx.save();
        ctx.translate(ship.x, ship.y + ship.recoil * 5);

        ctx.fillStyle = "#63e8ff";
        ctx.shadowColor = "#63e8ff";
        ctx.shadowBlur = 20;

        ctx.beginPath();
        ctx.moveTo(0, -28);
        ctx.lineTo(28, 17);
        ctx.lineTo(0, 10);
        ctx.lineTo(-28, 17);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(0, 0, 4, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }

    function drawWords() {
        words.forEach(word => {
            if (word.destroyed) return;

            ctx.save();
            ctx.font = "bold 17px monospace";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";

            const width = ctx.measureText(word.text).width;

            ctx.fillStyle = word.id === targetId ? "#0d2d4b" : "#08122b";
            ctx.strokeStyle = word.id === targetId ? "#63e8ff" : "#526b9b";

            ctx.shadowColor = "#63e8ff";
            ctx.shadowBlur = word.id === targetId ? 15 : 5;

            ctx.fillRect(word.x - width / 2 - 10, word.y - 17, width + 20, 34);
            ctx.strokeRect(word.x - width / 2 - 10, word.y - 17, width + 20, 34);

            ctx.shadowBlur = 0;
            ctx.fillStyle = "#ffffff";
            ctx.fillText(word.text, word.x, word.y);

            ctx.restore();
        });
    }

    function drawEffects() {
        bullets.forEach(bullet => {
            const progress = Math.min(bullet.progress, 1);

            const x = bullet.startX + (bullet.targetX - bullet.startX) * progress;
            const y = bullet.startY + (bullet.targetY - bullet.startY) * progress;

            ctx.strokeStyle = "#9df5ff";
            ctx.lineWidth = 3;
            ctx.shadowColor = "#63e8ff";
            ctx.shadowBlur = 15;

            ctx.beginPath();
            ctx.moveTo(x, y + 10);
            ctx.lineTo(x, y - 10);
            ctx.stroke();
        });

        particles.forEach(particle => {
            ctx.globalAlpha = Math.max(0, particle.life / .6);
            ctx.fillStyle = particle.color;
            ctx.beginPath();
            ctx.arc(particle.x, particle.y, 2, 0, Math.PI * 2);
            ctx.fill();
        });

        ctx.globalAlpha = 1;
        ctx.shadowBlur = 0;
    }

    function update(dt) {
        elapsed += dt;

        const settings = difficultySettings[selectedDifficulty];

        spawnTimer += dt;

        const spawnGap = Math.max(
            .65,
            settings.spawn - wave * .08
        );

        if (spawnTimer >= spawnGap) {
            spawnTimer = 0;
            spawnWord();
        }

        ship.recoil = Math.max(0, ship.recoil - dt * 7);

        for (let i = words.length - 1; i >= 0; i--) {
            const word = words[i];

            if (word.destroyed) {
                words.splice(i, 1);
                continue;
            }

            word.y += word.speed * dt;

            if (word.y > H - 76) {
                missed++;
                burst(word.x, word.y, "#ff557c", 20);
                endGame();
                return;
            }
        }

        bullets.forEach(bullet => {
            bullet.progress += dt / bullet.duration;
        });

        bullets = bullets.filter(bullet => bullet.progress < 1);

        particles.forEach(particle => {
            particle.life -= dt;
            particle.x += particle.vx * dt;
            particle.y += particle.vy * dt;
            particle.vx *= .94;
            particle.vy *= .94;
        });

        particles = particles.filter(particle => particle.life > 0);
    }

    function render(dt) {
        drawBackground(dt);
        drawWords();
        drawEffects();
        drawShip();
    }

    function loop(timestamp) {
        if (!active || paused || ended) return;

        const dt = Math.min((timestamp - lastTime) / 1000, .035);
        lastTime = timestamp;

        update(dt);
        render(dt);

        if (active && !paused && !ended) {
            animationId = requestAnimationFrame(loop);
        }
    }

    $("launch").addEventListener("click", () => {
        $("start").classList.add("hide");
        resetGame();
    });

    $("retry").addEventListener("click", resetGame);
    $("pause").addEventListener("click", pauseGame);
    $("resume").addEventListener("click", pauseGame);

    $("sound").addEventListener("click", () => {
        // Sound control will be added in the next improvement.
        $("sound").textContent = "♫ SOUND OFF";
    });

    render(0);

})();
