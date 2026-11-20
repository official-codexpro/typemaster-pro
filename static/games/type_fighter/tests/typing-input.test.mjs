import assert from 'node:assert/strict';
import test from 'node:test';
import {
  consumeParagraphCharacter,
  getParagraphWords,
  inspectTypingInput,
  normalizeMistakeWord,
} from '../src/typing-input.js';
import { paragraphsForDifficulty } from '../src/difficulty.js';

test('accepts exactly one appended character for each input event', () => {
  assert.deepEqual(inspectTypingInput('f', '', 'insertText'), {
    type: 'character',
    value: 'f',
  });
  assert.deepEqual(inspectTypingInput('fa', 'f', 'insertText'), {
    type: 'character',
    value: 'a',
  });
});

test('rejects multi-character insertion and duplicate input events', () => {
  assert.deepEqual(inspectTypingInput('fast', '', 'insertText'), {
    type: 'ignore',
    value: '',
  });
  assert.deepEqual(inspectTypingInput('fa', 'fa', 'insertText'), {
    type: 'ignore',
    value: 'fa',
  });
});

test('rejects input inserted into a stale or changed prefix', () => {
  assert.deepEqual(inspectTypingInput('xa', 'fa', 'insertText'), {
    type: 'ignore',
    value: 'fa',
  });
});

test('accepts a single backspace without treating it as a character attempt', () => {
  assert.deepEqual(inspectTypingInput('f', 'fa', 'deleteContentBackward'), {
    type: 'backspace',
    value: 'f',
  });
  assert.deepEqual(inspectTypingInput('', 'fast', 'deleteContentBackward'), {
    type: 'ignore',
    value: 'fast',
  });
});

test('accepts spaces and punctuation only at their exact paragraph positions', () => {
  const paragraph = 'Guard, then strike!';
  const spaceIndex = paragraph.indexOf(' ');
  assert.deepEqual(consumeParagraphCharacter(paragraph, spaceIndex, ' '), {
    accepted: true,
    expected: ' ',
    index: spaceIndex + 1,
    wordComplete: true,
    paragraphComplete: false,
  });
  assert.equal(consumeParagraphCharacter(paragraph, spaceIndex, 's').accepted, false);
  assert.equal(consumeParagraphCharacter(paragraph, paragraph.length - 1, '!').paragraphComplete, true);
  assert.equal(consumeParagraphCharacter(paragraph, paragraph.length - 1, '.').accepted, false);
});

test('a duplicated input event cannot consume another character or complete a word twice', () => {
  const accepted = inspectTypingInput('guard ', 'guard ', 'insertText');
  assert.deepEqual(accepted, { type: 'ignore', value: 'guard ' });
  const paragraph = 'guard the beast';
  assert.equal(consumeParagraphCharacter(paragraph, 6, 't').wordComplete, false);
  assert.equal(consumeParagraphCharacter(paragraph, 5, ' ').wordComplete, true);
});

test('paragraph word ranges preserve punctuation and exact offsets', () => {
  assert.deepEqual(getParagraphWords('Guard, then strike!'), [
    { text: 'Guard,', start: 0, end: 6 },
    { text: 'then', start: 7, end: 11 },
    { text: 'strike!', start: 12, end: 19 },
  ]);
});

test('mistake review words are normalized for result validation', () => {
  assert.equal(normalizeMistakeWord('attack,'), 'attack');
  assert.equal(normalizeMistakeWord("counter-sequence!"), 'countersequence');
  assert.equal(normalizeMistakeWord('...'), '');
});

test('typing a full paragraph consumes every separator and completes each word once', () => {
  const paragraph = 'Block, then strike!';
  let index = 0;
  let completedWords = 0;
  for (const character of paragraph) {
    const result = consumeParagraphCharacter(paragraph, index, character);
    assert.equal(result.accepted, true);
    index = result.index;
    if (result.wordComplete) completedWords += 1;
  }
  assert.equal(index, Array.from(paragraph).length);
  assert.equal(completedWords, 3);
  assert.equal(consumeParagraphCharacter(paragraph, index, '!').accepted, false);
});

test('paragraph content scales from simple to advanced combat vocabulary', () => {
  const easy = paragraphsForDifficulty('easy', {}).join(' ');
  const advanced = paragraphsForDifficulty('extreme', {}).join(' ');
  assert.ok(advanced.length > easy.length);
  assert.match(easy, /monster|beast/i);
  assert.match(advanced, /countersequence|reversal/i);
});
