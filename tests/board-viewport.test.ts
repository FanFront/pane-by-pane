import test from 'node:test';
import assert from 'node:assert/strict';
import {
  clampBoardView, defaultBoardView, MAX_BOARD_ZOOM, movePinch, startPinch,
} from '../src/web/boardViewport.ts';

const close = (value: number, expected: number) => assert.ok(
  Math.abs(value - expected) < 1e-8,
  `expected ${value} ≈ ${expected}`,
);

test('pinch out zooms around the midpoint, pinch in returns to centered 1x', () => {
  const initial = startPinch([100, 200], [200, 200], defaultBoardView(), [150, 200]);
  const enlarged = movePinch(initial, [50, 200], [250, 200], 280, 280, 300, 300);
  close(enlarged.zoom, 2);
  close(enlarged.panX, 0);
  close(enlarged.panY, 0);

  const shrunk = movePinch(startPinch([50, 200], [250, 200], enlarged, [150, 200]),
    [120, 200], [180, 200], 280, 280, 300, 300);
  assert.deepEqual(shrunk, defaultBoardView());
});

test('two fingers moving together pan without changing the zoom', () => {
  const start = startPinch([100, 100], [200, 100], { zoom: 3, panX: 10, panY: -10 }, [150, 150]);
  const moved = movePinch(start, [130, 130], [230, 130], 280, 280, 300, 300);
  close(moved.zoom, 3);
  close(moved.panX, 40);
  close(moved.panY, 20);
});

test('pinch keeps the board point beneath an off-center focal point', () => {
  const view = { zoom: 2, panX: -15, panY: 18 };
  const stageCenter = [200, 300] as const;
  const start = startPinch([235, 245], [305, 245], view, stageCenter);
  const next = movePinch(start, [215, 225], [325, 225], 320, 360, 250, 350);
  const x0 = (start.midpoint[0] - stageCenter[0] - view.panX) / view.zoom;
  const y0 = (start.midpoint[1] - stageCenter[1] - view.panY) / view.zoom;
  const midpointNow = [270, 225];
  close((midpointNow[0] - stageCenter[0] - next.panX) / next.zoom, x0);
  close((midpointNow[1] - stageCenter[1] - next.panY) / next.zoom, y0);
});

test('camera clamps pan at boundaries and never exposes blank regions', () => {
  assert.deepEqual(clampBoardView({ zoom: 1, panX: 200, panY: 50 }, 280, 280, 300, 300), defaultBoardView());
  assert.deepEqual(clampBoardView({ zoom: 2, panX: 999, panY: -999 }, 280, 180, 300, 300),
    { zoom: 2, panX: 130, panY: -30 });
  assert.deepEqual(clampBoardView({ zoom: 2, panX: 20, panY: 20 }, 100, 100, 300, 300),
    { zoom: 2, panX: 0, panY: 0 });
  const limited = clampBoardView({ zoom: 100, panX: 0, panY: 0 }, 280, 280, 300, 300);
  assert.equal(limited.zoom, MAX_BOARD_ZOOM);
});

test('pinch is cumulative from the prior zoom without jumping on restart', () => {
  const view = { zoom: 2.4, panX: 24, panY: -12 };
  const start = startPinch([110, 120], [210, 120], view, [160, 170]);
  const same = movePinch(start, [110, 120], [210, 120], 300, 300, 320, 340);
  assert.deepEqual(same, view);
});
