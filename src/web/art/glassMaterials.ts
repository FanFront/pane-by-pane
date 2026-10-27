/** Deterministic, bounded Canvas 2D textures for hand-rolled stained glass.
 *
 * One small repeated tile per theme/resolution bucket. Texture creation is NOT
 * part of the animation hot path; the cache is rebuilt only when the key changes.
 */
import type { Theme } from '../theme.ts';
import { boardDevicePixelRatio } from '../renderPerformance.ts';
import { workshopMaterial } from './workshopTokens.ts';

export interface GlassFleck {
  x: number;
  y: number;
  radius: number;
  light: boolean;
}

export function glassTextureKey(theme: Theme, deviceDpr: number, cellSize: number): string {
  const dpr = Math.round(boardDevicePixelRatio(deviceDpr) * 100) / 100;
  // Half-step buckets prevent a new tile for every tiny viewport resize.
  const scale = Number.isFinite(cellSize) && cellSize > 0
    ? Math.min(2, Math.max(0.5, Math.round(cellSize / 24) / 2))
    : 1;
  return `${theme}:${dpr}:${scale}`;
}

export function seededGlassNoise(seed: number): () => number {
  let state = seed >>> 0 || 1;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 0x100000000;
  };
}

/** Stable flecks with no DOM/Canvas dependency, convenient for unit tests. */
export function glassFlecks(seed: number, size: number, count: number): GlassFleck[] {
  const rng = seededGlassNoise(seed);
  const flecks: GlassFleck[] = [];
  for (let i = 0; i < count; i++) {
    flecks.push({
      x: rng() * size,
      y: rng() * size,
      radius: 1 + rng() * 6,
      light: rng() >= 0.35,
    });
  }
  return flecks;
}

function hashKey(key: string): number {
  let h = 2166136261;
  for (const char of key) {
    h ^= char.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export class GlassTextureCache {
  private key: string | null = null;
  private texture: CanvasPattern | null = null;

  invalidate(): void {
    this.key = null;
    this.texture = null;
  }

  get(ctx: CanvasRenderingContext2D, theme: Theme, deviceDpr: number, cellSize: number): CanvasPattern | null {
    const next = glassTextureKey(theme, deviceDpr, cellSize);
    if (next === this.key) return this.texture;
    this.key = next;
    this.texture = this.build(ctx, theme, next);
    return this.texture;
  }

  private build(ctx: CanvasRenderingContext2D, theme: Theme, key: string): CanvasPattern | null {
    const dpr = boardDevicePixelRatio(Number(key.split(':')[1]));
    const scale = Number(key.split(':')[2]);
    const side = 128;
    const tile = document.createElement('canvas');
    tile.width = Math.round(side * dpr);
    tile.height = Math.round(side * dpr);
    const p = tile.getContext('2d');
    if (!p) return null;
    p.scale(dpr, dpr);

    const strength = workshopMaterial(theme).glassTextureStrength;
    const rnd = seededGlassNoise(hashKey(key));
    p.lineCap = 'round';

    // Rare soft ripples from irregular hand-rolled glass. Wrap at tile edges.
    for (let i = 0; i < 12; i++) {
      const x = rnd() * side;
      const y = rnd() * side;
      const length = 12 + rnd() * 45;
      p.strokeStyle = `rgba(255,255,255,${(strength * (0.20 + rnd() * 0.32)).toFixed(3)})`;
      p.lineWidth = (0.8 + rnd() * 2.8) * scale;
      p.beginPath();
      for (const dx of [-side, 0, side]) for (const dy of [-side, 0, side]) {
        p.moveTo(x + dx, y + dy);
        p.lineTo(x + dx + length, y + dy - length * 0.46);
      }
      p.stroke();
    }

    // The same seeded flecks after every repaint, theme switch or application restart.
    for (const fleck of glassFlecks(hashKey(key) ^ 0x9e3779b9, side, 55)) {
      p.fillStyle = fleck.light
        ? `rgba(255,252,231,${(strength * 0.31).toFixed(3)})`
        : `rgba(18,12,35,${(strength * 0.22).toFixed(3)})`;
      for (const dx of [-side, 0, side]) for (const dy of [-side, 0, side]) {
        p.beginPath();
        p.arc(fleck.x + dx, fleck.y + dy, fleck.radius * scale, 0, Math.PI * 2);
        p.fill();
      }
    }

    const pattern = ctx.createPattern(tile, 'repeat');
    if (pattern && typeof DOMMatrix !== 'undefined' && 'setTransform' in pattern) {
      pattern.setTransform(new DOMMatrix().scale(1 / dpr));
    }
    return pattern;
  }
}
