document.addEventListener('DOMContentLoaded', () => {
  const root = document.getElementById('typeFighterHome');
  const startButton = document.getElementById('startGame');
  const difficulty = document.getElementById('difficulty');
  const customSettings = document.getElementById('customSettings');

  if (!root || !startButton || !difficulty) return;

  const wpm = document.getElementById('customWpm');
  const complexity = document.getElementById('customComplexity');
  const aggression = document.getElementById('customAggression');
  const reaction = document.getElementById('customReaction');
  const duration = document.getElementById('customDuration');
  const practiceMode = document.getElementById('practiceMode');

  const updateOutputs = () => {
    wpm.nextElementSibling.value = wpm.value;
    complexity.nextElementSibling.value =
      Number(complexity.value) < 34
        ? 'Simple'
        : Number(complexity.value) > 66
          ? 'Complex'
          : 'Medium';
    aggression.nextElementSibling.value = `${aggression.value}%`;
    reaction.nextElementSibling.value = `${reaction.value}%`;
  };

  difficulty.addEventListener('change', () => {
    customSettings.hidden = difficulty.value !== 'custom';
  });
  [wpm, complexity, aggression, reaction].forEach((control) =>
    control.addEventListener('input', updateOutputs),
  );

  startButton.addEventListener('click', () => {
    const playUrl = new URL(root.dataset.playUrl, window.location.href);
    playUrl.searchParams.set('difficulty', difficulty.value);
    playUrl.searchParams.set('mode', practiceMode.checked ? 'training' : 'arcade');
    if (difficulty.value === 'custom') {
      playUrl.searchParams.set('target_wpm', wpm.value);
      playUrl.searchParams.set('complexity', complexity.value);
      playUrl.searchParams.set('aggression', aggression.value);
      playUrl.searchParams.set('reaction', reaction.value);
      playUrl.searchParams.set('duration', duration.value);
    }
    window.location.assign(playUrl.href);
  });
});
