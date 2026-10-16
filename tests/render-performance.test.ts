import test from 'node:test';
import assert from 'node:assert/strict';
import {
  boardDevicePixelRatio, completionAnimationActive,
  COMPLETION_SHINE_MS,
} from '../src/web/renderPerformance.ts';

test('board backing resolution is capped without changing logical board geometry', () => {
  assert.equal(boardDevicePixelRatio(3), 2);
  assert.equal(boardDevicePixelRatio(2.75), 2);
  assert.equal(boardDevicePixelRatio(1.5), 1.5);
  assert.equal(boardDevicePixelRatio(0), 1);
  assert.equal(boardDevicePixelRatio(Number.NaN), 1);
});

test('completion animation stops after its transition and short shine', () => {
  const start = 1000;
  const rampMs = 1100;
  const shineStart = start + 400;
  const active = (now: number, complete = true, reduced = false, reveal = false) =>
    completionAnimationActive(now, start, rampMs, shineStart, complete, reduced, reveal);

  assert.equal(active(start), true);
  assert.equal(active(start + rampMs - 1), true);
  assert.equal(active(shineStart + COMPLETION_SHINE_MS - 1), true);
  assert.equal(active(shineStart + COMPLETION_SHINE_MS), false);
  assert.equal(active(shineStart + COMPLETION_SHINE_MS + 5000), false);
  assert.equal(active(start + rampMs, true, true), false);
  assert.equal(active(start + rampMs, true, false, true), false);
  assert.equal(active(start + rampMs, false), false);
});

test('exiting completion only animates the short fade-out', () => {
  assert.equal(completionAnimationActive(200, 0, 350, 0, false, false, false), true);
  assert.equal(completionAnimationActive(350, 0, 350, 0, false, false, false), false);
});
