import test from 'node:test';
import assert from 'node:assert/strict';
import { glassTextureKey, glassFlecks, seededGlassNoise, GlassTextureCache } from '../src/web/art/glassMaterials.ts';

test('glass texture keys are stable and distinguish theme, DPR and scale buckets', () => {
  assert.equal(glassTextureKey('classic', 3, 48), glassTextureKey('classic', 2, 48));
  assert.notEqual(glassTextureKey('classic', 2, 48), glassTextureKey('dark', 2, 48));
  assert.notEqual(glassTextureKey('classic', 1, 48), glassTextureKey('classic', 2, 48));
  assert.notEqual(glassTextureKey('classic', 2, 24), glassTextureKey('classic', 2, 96));
  assert.equal(glassTextureKey('classic', Number.NaN, -1), 'classic:1:1');
});

test('seeded flecks stay deterministic and inside their tile', () => {
  const a = glassFlecks(26, 128, 55);
  assert.deepEqual(a, glassFlecks(26, 128, 55));
  assert.notDeepEqual(a, glassFlecks(27, 128, 55));
  assert.equal(a.length, 55);
  for (const f of a) {
    assert.ok(f.x >= 0 && f.x < 128);
    assert.ok(f.y >= 0 && f.y < 128);
    assert.ok(f.radius >= 1 && f.radius <= 7);
  }
  const rng = seededGlassNoise(123);
  assert.notEqual(rng(), rng());
});

test('texture creation is cached until invalidated or theme/scale changes', () => {
  const cache = new GlassTextureCache();
  let patterns = 0;
  const canvas = {
    getContext: () => ({
      scale: () => {},
      beginPath: () => {},
      moveTo: () => {},
      lineTo: () => {},
      stroke: () => {},
      arc: () => {},
      fill: () => {},
      set lineCap(_v: string) {},
      set strokeStyle(_v: string) {},
      set lineWidth(_v: number) {},
      set fillStyle(_v: string) {},
    }),
  };
  const prevDocument = globalThis.document;
  const fakeDocument = { createElement: () => canvas } as unknown as Document;
  Object.defineProperty(globalThis, 'document', { configurable: true, value: fakeDocument });
  const ctx = { createPattern: () => ({ id: ++patterns }) } as unknown as CanvasRenderingContext2D;
  try {
    const first = cache.get(ctx, 'classic', 2, 48);
    assert.equal(cache.get(ctx, 'classic', 2, 48), first);
    assert.equal(patterns, 1);
    assert.notEqual(cache.get(ctx, 'dark', 2, 48), first);
    assert.equal(patterns, 2);
    cache.invalidate();
    cache.get(ctx, 'dark', 2, 48);
    assert.equal(patterns, 3);
  } finally {
    if (prevDocument === undefined) Reflect.deleteProperty(globalThis, 'document');
    else Object.defineProperty(globalThis, 'document', { configurable: true, value: prevDocument });
  }
});
