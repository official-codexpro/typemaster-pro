
document.addEventListener('DOMContentLoaded', () => {
    const startButton = document.getElementById('startGame');
    const difficulty = document.getElementById('difficulty');

    if (!startButton || !difficulty) return;

    startButton.addEventListener('click', () => {
        const selectedDifficulty = difficulty.value;

        window.location.href =
            `/car-racing/play/?difficulty=${selectedDifficulty}`;
    });
});
