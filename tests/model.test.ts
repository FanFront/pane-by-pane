import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PlayerState, WALL } from '../src/web/model.ts';
import { edgeBetween } from '../src/engine/grid.ts';

const puzzle = { width: 4, height: 1, clues: [] };

test('dragging over another region absorbs it whole', () => {
  const ps = new PlayerState(puzzle);
  const a = ps.newRegion(0);
  const b = ps.newRegion(3);
  assert.ok(ps.extend(2, b)); // b = {2,3}
  assert.ok(ps.extend(1, a)); // a = {0,1}
  assert.ok(ps.extend(2, a)); // touches b -> b absorbed
  assert.deepEqual(Array.from(ps.paint), [a, a, a, a]);
  assert.equal(ps.hue[b], undefined);
});

test('a wall blocks extending and splits a region', () => {
  const ps = new PlayerState(puzzle);
  const a = ps.newRegion(0);
  ps.extend(1, a);
  ps.extend(2, a);
  const e = edgeBetween(ps.grid, 1, 2);
  ps.setEdge(e, WALL);
  assert.notEqual(ps.paint[2], a, 'cell beyond the wall gets a new id');
  assert.equal(ps.paint[1], a);
  assert.ok(!ps.extend(3, a), 'cannot extend across the wall');
});

test('undo restores the previous snapshot', () => {
  const ps = new PlayerState(puzzle);
  ps.beginChange();
  ps.newRegion(0);
  assert.ok(ps.undo());
  assert.equal(ps.paint[0], 0);
  assert.ok(ps.redo());
  assert.notEqual(ps.paint[0], 0);
});

test('a fixed wall blocks the brush like a drawn one', () => {
  const ps = new PlayerState({ ...puzzle, walls: [{ a: 1, b: 2 }] });
  const a = ps.newRegion(0);
  assert.ok(ps.extend(1, a));
  assert.ok(!ps.extend(2, a), 'cannot paint across a fixed wall');
  assert.equal(ps.paint[2], 0);
  const b = ps.newRegion(3);
  assert.ok(ps.extend(2, b), 'the other side is reachable from its own region');
  assert.ok(!ps.extend(1, b), 'nor can the brush cross back and absorb a region');
  assert.equal(ps.paint[1], a);
});

test('areaOf: a painted region as a whole, or the empty cells joined without crossing walls or paint', () => {
  const ps = new PlayerState({ width: 4, height: 4, clues: [] });
  const id = ps.newRegion(0);
  ps.extend(1, id);
  ps.extend(4, id);
  ps.setEdge(edgeBetween(ps.grid, 2, 3), WALL);
  assert.deepEqual(ps.areaOf(1), { count: 3, cells: [0, 1, 4] });
  // every empty cell is still joined (3 is reached through 7), never through the paint
  assert.equal(ps.areaOf(5).count, 13);
  assert.equal(ps.areaOf(2).count, 13);
  ps.setEdge(edgeBetween(ps.grid, 3, 7), WALL);
  assert.deepEqual(ps.areaOf(3), { count: 1, cells: [3] });
});

test('wallAround: walls every border of a region, and takes them away again when they are all there', () => {
  const ps = new PlayerState({ width: 4, height: 4, clues: [] });
  const id = ps.newRegion(0);
  ps.extend(1, id);
  ps.extend(4, id);
  const border = [[1, 2], [1, 5], [4, 5], [4, 8]].map(([a, b]) => edgeBetween(ps.grid, a, b));
  assert.equal(ps.wallAround(id), 4);
  assert.ok(border.every((e) => ps.isWall(e)));
  assert.deepEqual(Array.from(ps.paint).filter((x) => x === id).length, 3, 'the region itself is untouched');
  // one wall removed by hand: the next call completes the ring rather than clearing it
  ps.setEdge(border[0], 0);
  assert.equal(ps.wallAround(id), 1);
  assert.ok(border.every((e) => ps.isWall(e)));
  // fully walled: toggles the drawn walls off
  assert.equal(ps.wallAround(id), 4);
  assert.ok(border.every((e) => !ps.isWall(e)));
});


test('finishing a solved wall partition fills panes and preserves the winning gesture in undo', () => {
  const ps = new PlayerState({ width: 4, height: 2, clues: [] });
  const left = ps.newRegion(0);
  ps.extend(4, left);
  const leftHue = ps.hue[left];

  // One border-drawing gesture wins the puzzle; auto-completion belongs to it.
  ps.beginChange();
  ps.setEdge(edgeBetween(ps.grid, 1, 2), WALL);
  ps.setEdge(edgeBetween(ps.grid, 5, 6), WALL);
  assert.equal(ps.finishSolvedPartition(ps.labelsByWalls()), true);

  assert.ok(ps.paint.every((id) => id > 0), 'every cell is now painted');
  assert.equal(ps.paint[0], left, 'keep the player-painted region ID');
  assert.equal(ps.hue[left], leftHue, 'keep the original colour');
  assert.equal(ps.paint[0], ps.paint[1]);
  assert.equal(ps.paint[0], ps.paint[4]);
  assert.equal(ps.paint[0], ps.paint[5]);
  assert.notEqual(ps.paint[1], ps.paint[2]);
  assert.equal(ps.paint[2], ps.paint[3]);
  assert.equal(ps.paint[2], ps.paint[6]);
  assert.equal(ps.paint[2], ps.paint[7]);
  assert.notEqual(ps.hue[ps.paint[0]], ps.hue[ps.paint[2]]);
  assert.equal(ps.finishSolvedPartition(ps.labelsByWalls()), false, 'rechecking a win changes nothing');

  assert.ok(ps.undo(), 'undo reverses the winning walls and the automatic paint together');
  assert.ok(ps.edge.every((mark) => mark === 0));
  assert.equal(ps.paint[0], left);
  assert.equal(ps.paint[4], left);
  assert.equal(ps.paint[2], 0);
  assert.ok(ps.redo(), 'redo brings the finished board back');
  assert.ok(ps.paint.every((id) => id > 0));
});

test('finishing a painted partition draws missing boundaries but respects fixed walls', () => {
  const ps = new PlayerState({ width: 4, height: 2, clues: [], walls: [{ a: 1, b: 2 }] });
  const a = ps.newRegion(0);
  ps.extend(1, a);
  ps.extend(4, a);
  ps.extend(5, a);
  const b = ps.newRegion(2);
  ps.extend(3, b);
  ps.extend(6, b);
  ps.extend(7, b);
  const hueA = ps.hue[a];
  const hueB = ps.hue[b];
  const top = edgeBetween(ps.grid, 1, 2);
  const bottom = edgeBetween(ps.grid, 5, 6);
  assert.equal(ps.edge[top], 0);
  assert.equal(ps.edge[bottom], 0);

  ps.beginChange();
  assert.equal(ps.finishSolvedPartition(ps.labelsByPaint()), true);
  assert.ok(ps.isWall(top), 'predefined border is still present');
  assert.equal(ps.edge[top], 0, 'fixed border must not be turned into a player mark');
  assert.equal(ps.edge[bottom], WALL, 'missing player border is drawn');
  assert.equal(ps.paint[0], a);
  assert.equal(ps.paint[2], b);
  assert.equal(ps.hue[a], hueA);
  assert.equal(ps.hue[b], hueB);
  assert.equal(ps.finishSolvedPartition(ps.labelsByPaint()), false);

  assert.ok(ps.undo());
  assert.equal(ps.edge[bottom], 0);
  assert.ok(ps.paint.every((id) => id > 0), 'undo leaves the original painted solution intact');
});

test('completion handles holes and repairs inconsistent partial paint', () => {
  const ps = new PlayerState({ width: 3, height: 2, holes: [1], clues: [] });
  const id = ps.newRegion(0);
  ps.extend(3, id);
  ps.extend(4, id);
  // Previous paint marks should not spread into a different winning wall region.
  ps.paint[5] = id;
  const labels = Int32Array.from([0, -1, 1, 0, 0, 1]);
  assert.equal(ps.finishSolvedPartition(labels), true);
  assert.equal(ps.paint[1], 0, 'a hole must stay unpainted');
  assert.equal(ps.paint[0], id);
  assert.notEqual(ps.paint[5], id, 'an inconsistent paint ID is split at the solved border');
  assert.equal(ps.paint[2], ps.paint[5]);
  assert.ok(ps.isWall(edgeBetween(ps.grid, 4, 5)));
  assert.equal(ps.finishSolvedPartition(labels), false);
});
