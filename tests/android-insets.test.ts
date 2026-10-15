import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const projectFile = (path: string) =>
  readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('Android edge-to-edge build reserves status-bar and gesture navigation insets', () => {
  const config = JSON.parse(projectFile('capacitor.config.json'));
  assert.equal(config.plugins.SystemBars.insetsHandling, 'native');
  assert.equal(config.plugins.SystemBars.initialViewportFitValueHint, 'cover');
  assert.equal(config.plugins.SystemBars.style, 'LIGHT');

  // The generated Android project is untracked, so its Activity must be
  // reconfigured in the build script after every Capacitor regeneration.
  assert.match(projectFile('scripts/build-android.sh'), /EdgeToEdge\.enable\(this\)/);
  assert.match(projectFile('index.html'), /viewport-fit=cover/);

  const css = projectFile('src/web/style.css');
  assert.match(css, /--safe-top:\s*env\(safe-area-inset-top,\s*0px\)/);
  assert.match(css, /body\s*\{\s*padding-top:\s*var\(--safe-top\)/);
  assert.match(css, /#top\s*\{\s*position:\s*sticky;\s*top:\s*var\(--safe-top\)/);
  assert.match(css, /top:\s*calc\(var\(--top\) \+ var\(--safe-top\)\)/);
  assert.match(css, /padding-bottom:\s*calc\(80px \+ var\(--safe-bottom\)\)/);
  assert.match(css, /calc\(7px \+ var\(--safe-bottom\)\)/);
});
