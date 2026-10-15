import test from 'node:test';
import assert from 'node:assert/strict';
import { createEngine, verify } from '../src/engine/engine.ts';
import { parsePresetPack } from '../src/presets.ts';
import { fromBetallerJSON } from '../src/importBetaller.ts';
import { fencePatternKey } from '../src/engine/rules/foreign.ts';

function fixture() {
  const cells = [];
  for (let row = 0; row < 3; row++) for (let col = 0; col < 3; col++) {
    const cell: Record<string, unknown> = { row, col };
    if (row === 0 && col === 0) cell.fence_pattern = [[1,1],[0,1],[1,0],[1,2]];
    if (row === 1 && col === 1) cell.compass = { up: 1, down: 1, left: 0, right: 0 };
    cells.push(cell);
  }
  return {
    version: '1.0',
    grid: { width: 3, height: 3 },
    cells, edges: [] as Record<string, unknown>[], vertices: [],
    rules: [{ type: 'fence' }, { type: 'compass' }],
    shape_pool: [],
    _meta: { archive_id: 'sample', archive_type: 'tests', archive_difficulty: 2 },
  };
}
function answer() {
  return {
    grid: { width: 3, height: 3 },
    regions: [
      [[0,0],[1,0],[2,0]],
      [[0,1],[1,1],[2,1]],
      [[0,2],[1,2],[2,2]],
    ],
  };
}

test('foreign fence and compass import validates real region geometry', () => {
  const level = fromBetallerJSON(fixture(), answer(), 'Zone1/tests/sample');
  assert.equal(level.puzzle.clues.filter((c) => c.type === 'fenceShape').length, 1);
  assert.equal(level.puzzle.clues.filter((c) => c.type === 'compass').length, 1);
  assert.equal(parsePresetPack({ version: 1, name: 'test', levels: [level] }).levels.length, 1);
  const wrong = Int32Array.from([0,0,0,1,1,1,2,2,2]);
  assert.equal(verify(createEngine(level.puzzle), wrong), false);
});

test('fence clues are rotational/reflection invariant', () => {
  assert.equal(fencePatternKey(1 | 2), fencePatternKey(2 | 4));
  assert.notEqual(fencePatternKey(1 | 4), fencePatternKey(1 | 2));
});

test('known global rules and source coordinates map correctly', () => {
  const src = fixture();
  src.rules.push({ type: 'area' });
  src.cells[0].number = 3;
  src.edges.push({ r1: 0, c1: 0, r2: 0, c2: 1, is_boundary: true, _glyph: true });
  const level = fromBetallerJSON(src, answer(), 'Zone1/0001');
  assert.deepEqual(level.puzzle.walls, [{a:0,b:1}]);
  assert.ok(level.puzzle.clues.some((c) => c.type === 'areaNumber' && c.cell === 0 && c.value === 3));
  assert.equal(parsePresetPack({ version: 1, name: 'test', levels: [level] }).levels.length, 1);
});

test('unsupported rules are rejected rather than silently dropped', () => {
  const src = fixture();
  src.rules.push({ type: 'unknown_gimmick' });
  assert.throws(() => fromBetallerJSON(src, answer()), /Unknown rule/);
  const bad = fixture();
  bad.cells[0].mystery = 1;
  assert.throws(() => fromBetallerJSON(bad, answer()), /Unsupported cell field/);
  assert.throws(() => fromBetallerJSON(fixture(), {grid:{width:3,height:3},regions:[]}), /uncovered/);
});

test('edge inequality orientation respects Betaller ordering', () => {
  const src = fixture();
  src.rules.push({ type: 'inequality' });
  src.edges.push({ r1: 0, c1: 0, r2: 0, c2: 1, constraint: {type:'inequality',value:1}, is_boundary:true });
  const level = fromBetallerJSON(src, answer());
  assert.deepEqual(level.puzzle.clues.find((c) => c.type === 'inequality'), {
    type: 'inequality', edge:{a:0,b:1}, larger:'a',
  });
});
