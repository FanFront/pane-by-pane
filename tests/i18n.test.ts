import { test } from 'node:test';
import assert from 'node:assert/strict';
import { M } from '../src/web/i18n.ts';
import { zh } from '../src/web/zh.ts';

test('Simplified Chinese has every UI key (including rule labels and hint techniques)', () => {
  // Node loads English by default. Deep checks also cover nested rule/help keys.
  const check = (english: unknown, translated: unknown, path: string) => {
    assert.equal(typeof translated, typeof english, path);
    if (english && typeof english === 'object') {
      for (const key of Object.keys(english)) {
        const v = translated as Record<string, unknown>;
        assert.ok(key in v, `Missing translation: ${path}.${key}`);
        check((english as Record<string, unknown>)[key], v[key], `${path}.${key}`);
      }
    }
  };
  check(M, zh, 'messages');
  assert.equal(Object.keys(zh.rule).length, Object.keys(M.rule).length);
});

test('Chinese descriptions and hints interpolate variable values', () => {
  assert.match(zh.desc.precision(5), /5/);
  assert.match(zh.desc.range(3), /3/);
  assert.match(zh.desc.range(undefined, 6), /6/);
  assert.match(zh.desc.range(3, 6), /3.*6/);
  assert.match(zh.h.cellAt(2, 4), /2.*4/);
  assert.match(zh.h.mergeConflict('甲区域', '乙区域'), /甲区域.*乙区域/);
  assert.match(zh.warnStarsMissed(2, 4, 5), /2.*4.*5/);
  assert.match(zh.checkResult(2, 1), /2.*1/);
});
