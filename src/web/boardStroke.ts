import { edgeBetween, type Grid } from '../engine/grid.ts';

export type BoardPoint = readonly [number, number];

function samples(from: BoardPoint, to: BoardPoint, step: number): BoardPoint[] {
  const n = Math.max(1, Math.ceil(Math.hypot(to[0] - from[0], to[1] - from[1]) / step));
  const out: BoardPoint[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    out.push([from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t]);
  }
  return out;
}

/** Interpolate skipped touch events, returning all active cells crossed in order. */
export function paintCellsOnStroke(grid: Grid, pad: number, cell: number, from: BoardPoint, to: BoardPoint): number[] {
  const out: number[] = [];
  for (const [px, py] of samples(from, to, Math.max(0.5, cell / 4))) {
    const x = Math.floor((px - pad) / cell), y = Math.floor((py - pad) / cell);
    if (x < 0 || y < 0 || x >= grid.w || y >= grid.h) continue;
    const index = y * grid.w + x;
    if (grid.active[index] && out.at(-1) !== index) out.push(index);
  }
  return out;
}

/** A valid interior border within finger tolerance; never an outer frame or hole. */
export function nearestBorder(
  grid: Grid, pad: number, cell: number, point: BoardPoint, tolerance: number,
  direction: 'vertical' | 'horizontal' | null = null,
): number {
  const x = (point[0] - pad) / cell, y = (point[1] - pad) / cell;
  if (x < 0 || y < 0 || x >= grid.w || y >= grid.h) return -1;
  const col = Math.floor(x), row = Math.floor(y);
  if (!grid.active[row * grid.w + col]) return -1;
  const fx = x - col, fy = y - row;
  const verticalDist = Math.min(fx, 1 - fx) * cell;
  const horizontalDist = Math.min(fy, 1 - fy) * cell;
  const c = row * grid.w + col;
  const vertical = () => {
    const other = fx < 0.5 ? c - 1 : c + 1;
    if ((fx < 0.5 && col === 0) || (fx >= 0.5 && col === grid.w - 1)) return -1;
    return edgeBetween(grid, c, other);
  };
  const horizontal = () => {
    const other = fy < 0.5 ? c - grid.w : c + grid.w;
    if ((fy < 0.5 && row === 0) || (fy >= 0.5 && row === grid.h - 1)) return -1;
    return edgeBetween(grid, c, other);
  };
  // During a line stroke, do not accidentally cut across the perpendicular
  // border at a grid intersection.
  if (direction === 'vertical') return verticalDist <= tolerance ? vertical() : -1;
  if (direction === 'horizontal') return horizontalDist <= tolerance ? horizontal() : -1;
  const axes = verticalDist <= horizontalDist
    ? [[verticalDist, vertical], [horizontalDist, horizontal]] as const
    : [[horizontalDist, horizontal], [verticalDist, vertical]] as const;
  for (const [distance, pick] of axes) {
    if (distance <= tolerance) {
      const edge = pick();
      if (edge >= 0) return edge;
    }
  }
  return -1;
}

/** Return consecutive line segments without duplicate toggles at pointer samples. */
export function borderEdgesOnStroke(
  grid: Grid, pad: number, cell: number, from: BoardPoint, to: BoardPoint, tolerance: number,
): number[] {
  const out: number[] = [];
  const seen = new Set<number>();
  const direction = Math.abs(to[1] - from[1]) >= Math.abs(to[0] - from[0])
    ? 'vertical' : 'horizontal';
  for (const point of samples(from, to, Math.max(0.5, cell / 5))) {
    const edge = nearestBorder(grid, pad, cell, point, tolerance, direction);
    if (edge >= 0 && !seen.has(edge)) {
      seen.add(edge);
      out.push(edge);
    }
  }
  return out;
}
