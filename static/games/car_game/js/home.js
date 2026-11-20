document.addEventListener('DOMContentLoaded', () => {
  const startButton = document.getElementById('startGame');
  const difficulty = document.getElementById('difficulty');
  const mode = document.getElementById('gameMode');
  const language = document.getElementById('codeLanguage');
  if (!startButton || !difficulty || !mode || !language) return;

  function syncMode() {
    const codeMode = mode.value === 'code';
    language.classList.toggle('hidden', !codeMode);
    startButton.textContent = codeMode ? 'START CODE RACE →' : 'START RACE →';
  }
  mode.addEventListener('change', syncMode);
  startButton.addEventListener('click', () => {
    const params = new URLSearchParams({
      difficulty: difficulty.value,
      mode: mode.value,
      language: language.value,
    });
    window.location.href = `/car-racing/play/?${params.toString()}`;
  });
  syncMode();
});
