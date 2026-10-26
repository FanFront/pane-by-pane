import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { GUIDE, tipExample, type TipId } from '../src/web/beginnerTips.ts';

const ids: TipId[] = ['vertex', 'parity', 'exit', 'border', 'diagonal'];

test('beginner strategies are available in all three UI languages and in the same order', () => {
  for (const lang of ['zh', 'en', 'ko'] as const) {
    const guide = GUIDE[lang];
    assert.deepEqual(guide.tips.map((tip) => tip.id), ids);
    for (const tip of guide.tips) {
      for (const key of ['title', 'idea', 'premise', 'deduction', 'warning', 'example'] as const) {
        assert.ok(tip[key].trim().length > 10, 'missing ' + lang + ' ' + tip.id + '.' + key);
      }
    }
  }
});

test('tips distinguish mandatory deductions from their required preconditions', () => {
  const [vertex, parity, exit, border, diagonal] = GUIDE.zh.tips;
  assert.match(vertex.deduction, /三条.*第四条/);
  assert.match(parity.deduction, /奇数.*偶数/);
  assert.match(parity.warning, /不是格子数的奇偶/);
  assert.match(exit.premise, /4 格.*5 格/);
  assert.match(exit.warning, /不自动说明/);
  assert.match(border.premise, /先证明全盘恰好两个区域/);
  assert.match(border.warning, /未必错误/);
  assert.match(diagonal.deduction, /至少有一个归属假设错误/);
  assert.match(diagonal.warning, /三个或更多区域/);
});

test('each strategy includes a rectangular, non-empty illustrative board', () => {
  for (const id of ids) {
    const lines = tipExample(id);
    assert.ok(lines.length >= 2);
    assert.ok(lines.every((line) => line.length === lines[0].length));
    assert.ok(lines.every((line) => /^[ABCD01.]+$/.test(line)));
  }
  assert.deepEqual(tipExample('diagonal'), ['AB', 'BA']);
  assert.deepEqual(tipExample('parity')[2], '01010');
});

test('guide can be opened from Goal and Settings without changing puzzle state', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const main = readFileSync(new URL('../src/web/main.ts', import.meta.url), 'utf8');
  for (const id of ['tips-dialog', 'tips-content', 'tips-close', 'tips-from-goal', 'tips-from-settings']) {
    assert.ok(html.includes('id="' + id + '"'), 'missing accessible guide entry ' + id);
  }
  assert.match(main, /tipsDialog\.addEventListener\('close'/);
  assert.match(main, /renderBeginnerTips\(\$\('tips-content'\), lang\)/);
});
