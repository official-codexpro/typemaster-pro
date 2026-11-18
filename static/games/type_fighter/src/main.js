
document.addEventListener('DOMContentLoaded', () => {
    const root = document.getElementById('typeFighterGame');
    const arena = document.getElementById('gameArena');

    if (!root || !arena) {
        console.error('Type Fighter arena not found.');
        return;
    }

    // ==========================================
    // BACKGROUND IMAGE
    // ==========================================

    arena.style.position = 'relative';
    arena.style.overflow = 'hidden';
    arena.style.isolation = 'isolate';

    // Remove previous Three.js canvas if present.
    document.getElementById('fighter3DCanvas')?.remove();

    // Remove previous background if script runs again.
    document.getElementById('typeFighterBackground')?.remove();

    const background = document.createElement('div');
    background.id = 'typeFighterBackground';

    Object.assign(background.style, {
        position: 'absolute',
        inset: '-3%',
        width: '106%',
        height: '106%',
        zIndex: '0',
        pointerEvents: 'none',
        overflow: 'hidden',
        backgroundImage: "url('/static/games/type_fighter/assets/environments/back.jpeg')",
        backgroundSize: 'cover',
        backgroundPosition: 'center center',
        backgroundRepeat: 'no-repeat',
        transform: 'scale(1.04)',
        willChange: 'transform'
    });

    // Dark cinematic overlay.
    const overlay = document.createElement('div');

    Object.assign(overlay.style, {
        position: 'absolute',
        inset: '0',
        background: `
            linear-gradient(
                to bottom,
                rgba(10, 8, 12, 0.12),
                rgba(10, 8, 12, 0.05) 45%,
                rgba(10, 8, 12, 0.48)
            )
        `,
        zIndex: '1',
        pointerEvents: 'none'
    });

    background.appendChild(overlay);
    arena.prepend(background);

    // ==========================================
    // ATMOSPHERIC PARTICLES
    // ==========================================

    const atmosphere = document.createElement('div');
    atmosphere.id = 'fighterAtmosphere';

    Object.assign(atmosphere.style, {
        position: 'absolute',
        inset: '0',
        zIndex: '2',
        overflow: 'hidden',
        pointerEvents: 'none'
    });

    arena.appendChild(atmosphere);

    const particles = [];

    for (let i = 0; i < 24; i++) {
        const particle = document.createElement('span');

        const size = Math.random() * 3 + 1;

        Object.assign(particle.style, {
            position: 'absolute',
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            width: `${size}px`,
            height: `${size}px`,
            borderRadius: '50%',
            background: '#ffd6a0',
            opacity: String(Math.random() * 0.35 + 0.1),
            boxShadow: '0 0 8px rgba(255, 185, 110, 0.7)'
        });

        atmosphere.appendChild(particle);

        particles.push({
            element: particle,
            x: Math.random() * 100,
            y: Math.random() * 100,
            speed: Math.random() * 0.018 + 0.006,
            drift: Math.random() * 0.012 - 0.006
        });
    }

    // ==========================================
    // CAMERA MOVEMENT
    // ==========================================

    let targetX = 0;
    let currentX = 0;
    let zoom = 1.04;
    let targetZoom = 1.04;

    window.typeFighterCamera = {
        setTarget(x) {
            targetX = Math.max(-1, Math.min(1, x / 12));
        },

        setZoom(value) {
            targetZoom = Math.max(1.02, Math.min(1.16, value));
        },

        reset() {
            targetX = 0;
            targetZoom = 1.04;
        }
    };

    // ==========================================
    // ANIMATION LOOP
    // ==========================================

    let animationId;
    let previousTime = 0;

    function animate(time) {
        animationId = requestAnimationFrame(animate);

        const delta = previousTime
            ? Math.min((time - previousTime) / 16.67, 2)
            : 1;

        previousTime = time;

        // Smooth camera follow.
        currentX += (targetX - currentX) * 0.025 * delta;
        zoom += (targetZoom - zoom) * 0.018 * delta;

        const movement = currentX * 2.5;

        background.style.transform = `
            scale(${zoom})
            translateX(${-movement}%)
        `;

        // Floating atmospheric particles.
        particles.forEach((particle) => {
            particle.y -= particle.speed * delta;
            particle.x += particle.drift * delta;

            if (particle.y < -3) {
                particle.y = 103;
                particle.x = Math.random() * 100;
            }

            if (particle.x < -2) particle.x = 102;
            if (particle.x > 102) particle.x = -2;

            particle.element.style.left = `${particle.x}%`;
            particle.element.style.top = `${particle.y}%`;
        });
    }

    // ==========================================
    // RESIZE
    // ==========================================

    const resizeObserver = new ResizeObserver(() => {
        background.style.backgroundSize = 'cover';
    });

    resizeObserver.observe(arena);

    animate(0);

    console.log('Type Fighter image environment initialized.');
});
