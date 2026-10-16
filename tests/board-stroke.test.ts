import test from 'node:test';
import assert from 'node:assert/strict';
import { makeGrid, edgeBetween } from '../src/engine/grid.ts';
import { nearestBorder, borderEdgesOnStroke, paintCellsOnStroke } from '../src/web/boardStroke.ts';
import { PlayerState, WALL } from '../src/web/model.ts';

const grid = makeGrid(6, 6, []);
const PAD = 12, SIZE = 40;
const center = (x: number, y: number): [number, number] =>
  [PAD + (x + 0.5) * SIZE, PAD + (y + 0.5) * SIZE];

test('fast horizontal and vertical drags do not skip intermediate cells', () => {
  assert.deepEqual(paintCellsOnStroke(grid, PAD, SIZE, center(0, 1), center(5, 1)), [6, 7, 8, 9, 10, 11]);
  assert.deepEqual(paintCellsOnStroke(grid, PAD, SIZE, center(3, 1), center(3, 4)), [9, 15, 21, 27]);
});

test('continuous border drag catches every segment once', () => {
  const x = PAD + 2 * SIZE;
  const edges = borderEdgesOnStroke(grid, PAD, SIZE, [x + 4, PAD + 0.5 * SIZE], [x + 4, PAD + 4.5 * SIZE], 10);
  const expected = Array.from({ length: 5 }, (_, y) => edgeBetween(grid, 1 + y * 6, 2 + y * 6));
  assert.deepEqual(edges, expected);
  assert.equal(new Set(edges).size, edges.length);
});

test('finger tolerance selects near borders but not cell centers', () => {
  const x = PAD + 2 * SIZE;
  assert.equal(nearestBorder(grid, PAD, SIZE, [x + 9, PAD + 1.5 * SIZE], 10), edgeBetween(grid, 7, 8));
  assert.equal(nearestBorder(grid, PAD, SIZE, [x + 13, PAD + 1.5 * SIZE], 10), -1);
  assert.equal(nearestBorder(grid, PAD, SIZE, center(2, 1), 10), -1);
});

test('no edge is returned for holes or positions beyond the board', () => {
  const hole = makeGrid(3, 3, [4]);
  assert.equal(nearestBorder(hole, PAD, SIZE, [PAD + SIZE, PAD + 1.5 * SIZE], 10), -1);
  assert.deepEqual(borderEdgesOnStroke(hole, PAD, SIZE, [-100, -100], [-90, -90], 10), []);
});

test('discard restores board marks, undo and redo', () => {
  const ps = new PlayerState({ width: 3, height: 3, clues: [] });
  ps.beginChange(); ps.newRegion(0);
  const original = ps.serialize();
  ps.beginChange(); ps.newRegion(1);
  assert.equal(ps.undo(), true);
  const save = ps.checkpoint();
  ps.beginChange(); ps.newRegion(2);
  ps.rollbackTo(save);
  assert.equal(ps.serialize(), original);
  assert.equal(ps.canRedo, true);
  assert.equal(ps.redo(), true);
  assert.ok(ps.paint[1]);
});

test('applying a hypothesis is one undoable step', () => {
  const ps = new PlayerState({ width: 3, height: 3, clues: [] });
  const save = ps.checkpoint();
  const edge = edgeBetween(ps.grid, 0, 1);
  ps.beginChange(); ps.setEdge(edge, WALL);
  ps.beginChange(); ps.newRegion(0);
  ps.commitFrom(save);
  assert.equal(ps.undo(), true);
  assert.equal(ps.paint[0], 0);
  assert.equal(ps.edge[edge], 0);
  assert.equal(ps.canUndo, false);
  assert.equal(ps.redo(), true);
  assert.equal(ps.edge[edge], WALL);
  assert.ok(ps.paint[0]);
});
