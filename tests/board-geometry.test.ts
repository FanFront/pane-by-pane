import test from 'node:test';
import assert from 'node:assert/strict';
import { boardRotationTransform, pointOnBoard, pointOnRotatedBoard, sizeBoard, type BoardRotation } from '../src/web/boardGeometry.ts';

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

test('quarter turns fit rectangular puzzles using their rotated aspect ratio', () => {
  const normal = sizeBoard(12, 5, 360, 660, 12);
  const clockwise = sizeBoard(12, 5, 360, 660, 12, 90);
  const upsideDown = sizeBoard(12, 5, 360, 660, 12, 180);
  const counterclockwise = sizeBoard(12, 5, 360, 660, 12, 270);
  assert.ok(clockwise.cell > normal.cell, 'a wide puzzle gets larger in a portrait viewport after rotation');
  assert.equal(clockwise.cell, counterclockwise.cell);
  assert.equal(normal.cell, upsideDown.cell);
  assert.ok(clockwise.displayWidth <= 360 && clockwise.displayHeight <= 660);
  assert.equal(clockwise.logicalWidth, 12 * clockwise.cell + 24);
  assert.equal(clockwise.logicalHeight, 5 * clockwise.cell + 24);
  assert.equal(clockwise.displayWidth, clockwise.logicalHeight);
  assert.equal(clockwise.displayHeight, clockwise.logicalWidth);
});

test('the drawing transform and inverse pointer mapping agree at every rotation', () => {
  const rotations: BoardRotation[] = [0, 90, 180, 270];
  const width = 488;
  const height = 218;
  const dpr = 2.5;
  // Includes borders and interior points; target coordinates must stay tied
  // to the original grid even after rotation, zoom, and pan.
  for (const rotation of rotations) {
    const quarter = rotation === 90 || rotation === 270;
    const rotatedWidth = quarter ? height : width;
    const rotatedHeight = quarter ? width : height;
    const rect = { left: -38, top: 147, width: rotatedWidth * 1.75, height: rotatedHeight * 1.75 };
    const [a, b, c, d, e, f] = boardRotationTransform(rotation, width, height, dpr);
    for (const [x, y] of [[0, 0], [12, 12], [235, 111], [470, 200], [width, height]]) {
      const rotatedX = (a * x + c * y + e) / dpr;
      const rotatedY = (b * x + d * y + f) / dpr;
      const clientX = rect.left + rotatedX * rect.width / rotatedWidth;
      const clientY = rect.top + rotatedY * rect.height / rotatedHeight;
      const [actualX, actualY] = pointOnRotatedBoard(clientX, clientY, rect, width, height, rotation);
      assert.ok(Math.abs(actualX - x) < 1e-8, `${rotation}°: expected x ${x}, got ${actualX}`);
      assert.ok(Math.abs(actualY - y) < 1e-8, `${rotation}°: expected y ${y}, got ${actualY}`);
    }
    assert.deepEqual(pointOnRotatedBoard(1, 2, { ...rect, height: 0 }, width, height, rotation), [-1, -1]);
  }
});

test('rotating a non-square board preserves touch cell indices through viewport scaling', () => {
  for (const rotation of [0, 90, 180, 270] as const) {
    const size = sizeBoard(13, 7, 300, 550, 12, rotation);
    const rect = { left: 35, top: 95, width: size.displayWidth * 2.1, height: size.displayHeight * 2.1 };
    const transform = boardRotationTransform(rotation, size.logicalWidth, size.logicalHeight, 1);
    const [a, b, c, d, e, f] = transform;
    const rotatedWidth = rotation === 90 || rotation === 270 ? size.logicalHeight : size.logicalWidth;
    const rotatedHeight = rotation === 90 || rotation === 270 ? size.logicalWidth : size.logicalHeight;
    for (const [col, row] of [[0, 0], [6, 3], [12, 6]]) {
      const x = 12 + (col + 0.5) * size.cell;
      const y = 12 + (row + 0.5) * size.cell;
      const clientX = rect.left + (a * x + c * y + e) * rect.width / rotatedWidth;
      const clientY = rect.top + (b * x + d * y + f) * rect.height / rotatedHeight;
      const [px, py] = pointOnRotatedBoard(clientX, clientY, rect, size.logicalWidth, size.logicalHeight, rotation);
      assert.equal(Math.floor((px - 12) / size.cell), col);
      assert.equal(Math.floor((py - 12) / size.cell), row);
    }
  }
});
