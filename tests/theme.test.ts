import assert from 'node:assert/strict';
import { test } from 'node:test';
import { THEME_KEY, THEMES, getTheme, parseTheme, readSavedTheme, setTheme } from '../src/web/theme.ts';

test('theme choices remain stable and unsupported preferences fall back to classic', () => {
  assert.deepEqual([...THEMES], ['classic', 'modern', 'dark']);
  for (const theme of THEMES) assert.equal(parseTheme(theme), theme);
  for (const invalid of [null, '', 'system', 'Dark', 1, undefined]) {
    assert.equal(parseTheme(invalid), 'classic');
  }
});

test('saved theme is restored and unavailable storage does not crash', () => {
  assert.equal(readSavedTheme({ getItem: (key) => key === THEME_KEY ? 'dark' : null }), 'dark');
  assert.equal(readSavedTheme({ getItem: () => 'modern' }), 'modern');
  assert.equal(readSavedTheme({ getItem: () => 'unknown' }), 'classic');
  assert.equal(readSavedTheme({ getItem: () => { throw new Error('Storage denied'); } }), 'classic');
  assert.equal(readSavedTheme(null), 'classic');
});

test('theme module is safe to load without a browser', () => {
  assert.equal(getTheme(), 'classic');
  assert.doesNotThrow(() => setTheme('dark'));
});
