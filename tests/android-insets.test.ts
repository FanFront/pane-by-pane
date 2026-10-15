import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const projectFile = (path: string) =>
  readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('Android hides phone status bar without changing game toolbar', () => {
  const config = JSON.parse(projectFile('capacitor.config.json'));
  assert.equal(config.plugins.SystemBars.insetsHandling, 'native');

  const build = projectFile('scripts/build-android.sh');
  assert.match(build, /EdgeToEdge\.enable\(this\)/);
  assert.match(build, /controller\.hide\(WindowInsetsCompat\.Type\.statusBars\(\)\)/);
  assert.doesNotMatch(build, /controller\.hide\(WindowInsetsCompat\.Type\.(?:systemBars|navigationBars)\(\)\)/);
  assert.match(build, /onWindowFocusChanged\(boolean hasFocus\)/);
  assert.match(build, /if \(hasFocus\) hideStatusBar\(\)/);

  const css = projectFile('src/web/style.css');
  assert.match(css, /#top\s*\{\s*position:\s*sticky;\s*top:\s*0;/);
  assert.doesNotMatch(css, /--safe-top/);
  assert.match(css, /env\(safe-area-inset-bottom,\s*0px\)/);
});
