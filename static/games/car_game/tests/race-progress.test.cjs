const assert = require('node:assert/strict');
const test = require('node:test');

const raceProgress = require('../js/race-progress.js');

const finishProgress = 60;
const finishWords = 40;
const progressPerWord = finishProgress / finishWords;

test('slow, average, and fast typing produce proportional race progress', () => {
  const slow = raceProgress.progressAfterWpm(20, 60, progressPerWord);
  const average = raceProgress.progressAfterWpm(40, 60, progressPerWord);
  const fast = raceProgress.progressAfterWpm(80, 60, progressPerWord);

  assert.ok(slow < finishProgress);
  assert.equal(average, finishProgress);
  assert.ok(fast > finishProgress);
  assert.equal(raceProgress.progressAfterWpm(80, 30, progressPerWord), finishProgress);
});

test('completed words and the current partial word produce one continuous progress value', () => {
  assert.ok(Math.abs(raceProgress.progressFromWords(39, 'racer', 3, progressPerWord) - 59.4) < 1e-9);
  assert.equal(raceProgress.progressFromWords(40, 'racer', 5, progressPerWord), finishProgress);
  assert.equal(raceProgress.progressFromWords(0, 'racer', 0, progressPerWord), 0);
});

test('word totals include only fully typed words', () => {
  assert.equal(raceProgress.countCompletedWords('slow typing continues', 4), 1);
  assert.equal(raceProgress.countCompletedWords('slow typing continues', 8), 1);
  assert.equal(raceProgress.countCompletedWords('slow typing continues'), 3);
});
