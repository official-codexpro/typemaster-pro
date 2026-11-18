document.addEventListener('DOMContentLoaded', () => {
    const startButton = document.getElementById('startGame');
    const difficulty = document.getElementById('difficulty');

    startButton.addEventListener('click', () => {
        const selectedDifficulty = difficulty.value;

        window.location.href =
            `/space-shooter/play/?difficulty=${selectedDifficulty}`;
    });
});