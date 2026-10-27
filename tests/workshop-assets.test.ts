import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../src/web/style.css', import.meta.url), 'utf8');
const files = ['workshop-scene.svg', 'workshop-crest.svg', 'workshop-chapter.svg'];
test('workshop decorative assets are bundled vector images without remote dependencies', () => {
  for (const name of files) {
    const source = readFileSync(new URL('../src/web/assets/' + name, import.meta.url), 'utf8');
    assert.match(source, /<svg\b/);
    assert.match(source, /<\/svg>/);
    assert.doesNotMatch(source, /<script|foreignObject|<image|xlink:href|href\s*=\s*["']https?:\/\//i);
    assert.ok(source.length > 400, name + ' should contain actual illustration geometry');
    assert.ok(css.includes('./assets/' + name));
  }
});
test('workshop art cannot intercept board input and does not affect Modern/Dark themes', () => {
  assert.match(css, /#stage::after[\s\S]*?pointer-events:\s*none/);
  assert.match(css, /:root:not\(\[data-theme='modern'\]\):not\(\[data-theme='dark'\]\) #board-wrap/);
});
