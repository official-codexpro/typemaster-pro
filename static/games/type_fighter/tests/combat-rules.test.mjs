import assert from 'node:assert/strict';
import test from 'node:test';

import { applyParagraphGatedDamage, chooseNonRepeatingAttack } from '../src/combat-rules.js';
import { DIFFICULTIES } from '../src/difficulty.js';

test('attack selection varies moves and never repeats consecutively when alternatives exist', () => {
  const moves = ['kick', 'launcher', 'heavy'];
  let previous = null;
  const selected = [];
  for (const roll of [0, 0, 0.99, 0, 0.5]) {
    previous = chooseNonRepeatingAttack(moves, previous, () => roll);
    selected.push(previous);
  }
  for (let index = 1; index < selected.length; index += 1) {
    assert.notEqual(selected[index], selected[index - 1]);
  }
  assert.deepEqual(new Set(selected.slice(0, 3)), new Set(moves));
});

test('paragraph-gated damage preserves one health and defers lethal damage', () => {
  assert.deepEqual(applyParagraphGatedDamage(12, 8), {
    health: 4,
    appliedDamage: 8,
    pendingDefeat: false,
  });
  assert.deepEqual(applyParagraphGatedDamage(7, 13), {
    health: 1,
    appliedDamage: 6,
    pendingDefeat: true,
  });
  assert.deepEqual(applyParagraphGatedDamage(1, 13), {
    health: 1,
    appliedDamage: 0,
    pendingDefeat: true,
  });
});

test('paragraph completion permits lethal damage', () => {
  assert.deepEqual(applyParagraphGatedDamage(7, 13, true), {
    health: 0,
    appliedDamage: 7,
    pendingDefeat: false,
  });
});

test('enemy attack pressure and combo timing scale with difficulty', () => {
  const levels = ['easy', 'normal', 'hard', 'extreme'].map((level) => DIFFICULTIES[level]);
  for (let index = 1; index < levels.length; index += 1) {
    assert.ok(levels[index].aiDamage > levels[index - 1].aiDamage);
    assert.ok(levels[index].aiInterval < levels[index - 1].aiInterval);
    assert.ok(levels[index].reaction < levels[index - 1].reaction);
    assert.ok(levels[index].comboChance > levels[index - 1].comboChance);
    assert.ok(levels[index].comboDelay < levels[index - 1].comboDelay);
    assert.ok(levels[index].comboMaxHits >= levels[index - 1].comboMaxHits);
  }
});
