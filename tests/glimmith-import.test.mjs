import test from 'node:test';
import assert from 'node:assert/strict';
import { parsePresetPack } from '../src/presets.ts';
import { convertSV1 } from '../scripts/convert-glimmith-sv1.mjs';

function exampleSV1() {
  return [
    'SV1', 'W 3', 'H 3', 'ID 01234', 'DIFF 1',
    'CELL 0 0 number 3', 'CELL 0 1 number 3', 'CELL 0 2 number 3',
    'EMPTY 1 0', 'EMPTY 1 1', 'EMPTY 1 2',
    'EMPTY 2 0', 'EMPTY 2 1', 'EMPTY 2 2',
    'SEDGE v 0 1', 'SEDGE v 0 2',
    'SEDGE v 1 1', 'SEDGE v 1 2',
    'SEDGE v 2 1', 'SEDGE v 2 2',
    'IEDGE v 0 1',
  ].join('\n');
}

test('converts a basic Glimmith SV1 export into a playable level', () => {
  const level = convertSV1(exampleSV1());
  assert.equal(level.id, '01234');
  assert.deepEqual(level.solution, [0, 1, 2, 0, 1, 2, 0, 1, 2]);
  assert.deepEqual(level.puzzle.walls, [{ a: 0, b: 1 }]);
  const pack = parsePresetPack({ version: 1, name: 'personal', levels: [level] });
  assert.equal(pack.levels.length, 1);
});

test('does not drop unsupported original-game symbols or compass data', () => {
  assert.throws(() => convertSV1(exampleSV1() + '\nCELL 1 1 shape F0'), /Duplicate|Unsupported/);
  const extra = exampleSV1().replace('EMPTY 1 1', 'CELL 1 1 shape F0');
  assert.throws(() => convertSV1(extra), /Unsupported SV1 clues/);
  assert.throws(() => convertSV1(exampleSV1() + '\nCOMPASS 1 1 U 2 D - L - R -'), /Unsupported SV1 clues/);
});

test('rejects fake answers, duplicate IDs and out of bounds geometry', () => {
  const level = convertSV1(exampleSV1());
  const wrong = { ...level, solution: Array(9).fill(0) };
  assert.throws(() => parsePresetPack({ version: 1, name: 'x', levels: [wrong] }), /solution does not satisfy/);
  assert.throws(() => parsePresetPack({ version: 1, name: 'x', levels: [level, level] }), /Duplicate puzzle ID/);
  assert.throws(() => convertSV1(exampleSV1() + '\nEMPTY 99 1'), /Out-of-range cell/);
});

test('accepts CLI generator JSON output for importing personal puzzles', () => {
  const level = convertSV1(exampleSV1());
  const pack = parsePresetPack([{ puzzle: level.puzzle, solution: level.solution, stars: 1, difficulty: 0 }]);
  assert.equal(pack.levels[0].id, 'local-1');
});
