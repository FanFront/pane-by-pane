import test from 'node:test';
import assert from 'node:assert/strict';
import { restoredPuzzleArgs, type LastPuzzle } from '../src/web/lastPuzzle.ts';
import { chooseBackAction, installAndroidBack, type CapacitorBridge, type NativeAppPlugin } from '../src/web/androidBack.ts';

test('restart preserves preset identity as well as puzzle and solution', () => {
  const saved: LastPuzzle = {
    puzzle: { width: 2, height: 2, clues: [] },
    solution: [0, 0, 1, 1],
    stars: 2,
    difficulty: 3,
    hash: '',
    presetKey: 'betaller:Zone1/1-single-shape/0008',
  };
  const [puzzle, solution, stars, difficulty, presetKey] = restoredPuzzleArgs(saved);
  assert.equal(puzzle, saved.puzzle);
  assert.deepEqual([...solution], saved.solution);
  assert.equal(stars, 2);
  assert.equal(difficulty, 3);
  assert.equal(presetKey, saved.presetKey);

  // Generated puzzles never accidentally acquire a preset identity.
  assert.equal(restoredPuzzleArgs({ ...saved, presetKey: undefined })[4], undefined);
});

test('back prioritizes chapter navigation, then modals and the coach', () => {
  assert.equal(chooseBackAction('levels-dialog', true, false), 'chapter');
  assert.equal(chooseBackAction('levels-dialog', false, false), 'dialog');
  assert.equal(chooseBackAction('goal-dialog', true, false), 'dialog');
  assert.equal(chooseBackAction('reveal-dialog', false, false), 'dialog');
  assert.equal(chooseBackAction('warn-dialog', false, false), 'dialog');
  assert.equal(chooseBackAction(null, false, true), 'coach');
  assert.equal(chooseBackAction(null, false, false), 'minimize');
});

test('Android native Back consumes UI state and minimizes only at the root', async () => {
  let callback: (() => void) | undefined;
  let minimized = 0;
  let calls = 0;
  const app: NativeAppPlugin = {
    addListener: async (name, fn) => {
      assert.equal(name, 'backButton');
      callback = fn;
      return {};
    },
    minimizeApp: async () => { minimized++; },
  };
  const cap: CapacitorBridge = {
    isNativePlatform: () => true,
    getPlatform: () => 'android',
    registerPlugin: (name) => {
      assert.equal(name, 'App');
      return app;
    },
  };
  assert.equal(installAndroidBack(() => ++calls === 1, cap), true);
  assert.ok(callback);
  callback();
  await Promise.resolve();
  assert.equal(minimized, 0);
  callback();
  await Promise.resolve();
  assert.equal(minimized, 1);
  assert.equal(calls, 2);
});

test('web and non-Android platforms keep their native browser back behavior', () => {
  assert.equal(installAndroidBack(() => true, undefined), false);
  assert.equal(installAndroidBack(() => true, {
    isNativePlatform: () => false,
    getPlatform: () => 'web',
  }), false);
});
