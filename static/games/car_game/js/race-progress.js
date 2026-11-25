const CarRaceProgress = Object.freeze({
  countCompletedWords(text, cursor = text.length) {
    const wordPattern = /[A-Za-z0-9_$]+/g;
    let count = 0;
    let match;
    while ((match = wordPattern.exec(text))) {
      if (wordPattern.lastIndex > cursor) break;
      count += 1;
    }
    return count;
  },
  progressFromWords(completedWords, currentText, cursor, progressPerWord) {
    const wordPattern = /[A-Za-z0-9_$]+/g;
    let partialWord = 0;
    let match;
    while ((match = wordPattern.exec(currentText))) {
      const start = match.index;
      const end = wordPattern.lastIndex;
      if (cursor <= start) break;
      if (cursor < end) {
        partialWord = (cursor - start) / match[0].length;
        break;
      }
    }
    return (Math.max(0, Number(completedWords) || 0) + partialWord) * progressPerWord;
  },
  progressAfterWpm(wpm, elapsedSeconds, progressPerWord) {
    return (
      (Math.max(0, Number(wpm) || 0) * Math.max(0, Number(elapsedSeconds) || 0) * progressPerWord) /
      60
    );
  },
  speedFromWpm(wpm, progressPerWord) {
    return (Math.max(0, Number(wpm) || 0) * progressPerWord) / 60;
  },
});

if (typeof module !== 'undefined' && module.exports) module.exports = CarRaceProgress;
if (typeof window !== 'undefined') window.CarRaceProgress = CarRaceProgress;
