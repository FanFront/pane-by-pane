import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Clue } from '../src/engine/types.ts';
import { uniqueRuleClues } from '../src/web/ruleHelp.ts';
import { M } from '../src/web/i18n.ts';
import { zh } from '../src/web/zh.ts';

test('rule help lists each rule only once even with many grid clues', () => {
  const clues: Clue[] = [
    { type: 'fenceShape', cell: 0, sides: 3 },
    { type: 'fenceShape', cell: 1, sides: 12 },
    { type: 'compass', cell: 2, up: 0, down: 2, left: 1, right: 1 },
    { type: 'compass', cell: 3, up: 2, down: 0, left: 1, right: 1 },
    { type: 'areaNumber', cell: 4, value: 3 },
    { type: 'areaNumber', cell: 5, value: 4 },
    { type: 'polyomino', cell: 6, shape: '0,0' },
    { type: 'polyomino', cell: 7, shape: '0,0' },
    { type: 'range', min: 2, max: 5 },
    { type: 'solitude' },
  ];
  assert.deepEqual(uniqueRuleClues(clues).map((clue) => clue.type), [
    'fenceShape', 'compass', 'areaNumber', 'polyomino', 'range', 'solitude',
  ]);
  assert.equal(uniqueRuleClues(clues)[0], clues[0], 'retain the first clue for each rule');
  assert.deepEqual(uniqueRuleClues([]), []);
});

test('official-style rotating palisade is distinct from fixed custom clues', () => {
  assert.equal(zh.rule.fenceShape, '围栏');
  assert.notEqual(zh.rule.fenceShape, zh.rule.palisade);
  assert.match(zh.desc.fenceShape, /旋转/);
  assert.match(zh.desc.palisade, /不能旋转/);
  assert.match(zh.desc.compass, /不限于相邻格/);
  assert.match(zh.desc.solitude, /恰好包含一个/);
  assert.match(M.desc.fenceShape, /rotation/);
  assert.match(M.desc.compass, /not only adjacent/);
});
