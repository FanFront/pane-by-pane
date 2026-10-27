import test from 'node:test';
import assert from 'node:assert/strict';
import { WORKSHOP_COLORS, THEME_MATERIALS, workshopMaterial } from '../src/web/art/workshopTokens.ts';

test('workshop theme tokens define distinct light, modern and dark materials', () => {
  assert.deepEqual(Object.keys(THEME_MATERIALS).sort(), ['classic', 'dark', 'modern']);
  assert.equal(workshopMaterial('classic').surface, WORKSHOP_COLORS.walnut);
  assert.equal(workshopMaterial('classic').metal, WORKSHOP_COLORS.brass);
  assert.notEqual(workshopMaterial('dark').paper, workshopMaterial('classic').paper);
  assert.notEqual(workshopMaterial('modern').surface, workshopMaterial('classic').surface);
});

test('glass texture strengths are bounded and appropriate for dark mode', () => {
  for (const material of Object.values(THEME_MATERIALS)) {
    assert.ok(material.glassTextureStrength >= 0 && material.glassTextureStrength <= 0.2);
    assert.match(material.outline, /^#[0-9a-f]{6}$/i);
  }
  assert.ok(workshopMaterial('dark').glassTextureStrength < workshopMaterial('classic').glassTextureStrength);
});
