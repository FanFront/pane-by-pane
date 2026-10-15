import test from 'node:test';
import assert from 'node:assert/strict';
import { pointOnBoard, sizeBoard } from '../src/web/boardGeometry.ts';

test('oversized square board fits the mobile viewport without stretching', () => {
  const size = sizeBoard(16, 16, 310, 390, 12);
  assert.equal(size.cell, 30); // drawing stays legible before uniform display scaling
  assert.ok(size.displayWidth <= 310);
  assert.ok(size.displayHeight <= 390);
  assert.ok(Math.abs(size.displayWidth / size.displayHeight - 1) < 1e-10);
  assert.ok(size.displayWidth < size.logicalWidth);
});

test('rectangular boards use the width and height independently', () => {
  const size = sizeBoard(5, 12, 360, 660, 12);
  assert.equal(size.cell, 52);
  assert.equal(size.displayWidth, size.logicalWidth);
  assert.equal(size.displayHeight, size.logicalHeight);
});

test('touch coordinates are mapped through the rendered canvas scale', () => {
  const size = sizeBoard(16, 16, 310, 390, 12);
  const rect = { left: 20, top: 100, width: size.displayWidth, height: size.displayHeight };
  const cellX = 14;
  const cellY = 12;
  const logicalX = 12 + (cellX + 0.5) * size.cell;
  const logicalY = 12 + (cellY + 0.5) * size.cell;
  const p = pointOnBoard(
    rect.left + logicalX * rect.width / size.logicalWidth,
    rect.top + logicalY * rect.height / size.logicalHeight,
    rect,
    size.logicalWidth,
    size.logicalHeight,
  );
  assert.ok(Math.abs(p[0] - logicalX) < 1e-8);
  assert.ok(Math.abs(p[1] - logicalY) < 1e-8);
  assert.equal(Math.floor((p[0] - 12) / size.cell), cellX);
  assert.equal(Math.floor((p[1] - 12) / size.cell), cellY);
});

test('client-to-board conversion handles nonuniform CSS scaling and viewport offsets', () => {
  const rect = { left: 48, top: 123, width: 150, height: 320 };
  assert.deepEqual(pointOnBoard(123, 283, rect, 450, 400), [225, 200]);
  assert.deepEqual(pointOnBoard(48, 123, rect, 450, 400), [0, 0]);
  assert.deepEqual(pointOnBoard(123, 283, { ...rect, width: 0 }, 450, 400), [-1, -1]);
});

test('taps still hit the right logical cell after a pinched zoom and pan', () => {
  const size = sizeBoard(16, 16, 320, 420, 12);
  const zoom = 3.25;
  const panX = -48;
  const panY = 65;
  const stageLeft = 30;
  const stageTop = 120;
  const rect = {
    left: stageLeft + (1 - zoom) * size.displayWidth / 2 + panX,
    top: stageTop + (1 - zoom) * size.displayHeight / 2 + panY,
    width: size.displayWidth * zoom,
    height: size.displayHeight * zoom,
  };
  for (const [col, row] of [[0, 0], [7, 11], [15, 15]]) {
    const x = 12 + (col + .5) * size.cell;
    const y = 12 + (row + .5) * size.cell;
    const clientX = rect.left + x * rect.width / size.logicalWidth;
    const clientY = rect.top + y * rect.height / size.logicalHeight;
    const [px, py] = pointOnBoard(clientX, clientY, rect, size.logicalWidth, size.logicalHeight);
    assert.equal(Math.floor((px - 12) / size.cell), col);
    assert.equal(Math.floor((py - 12) / size.cell), row);
  }
});
