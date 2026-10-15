import type { Grid } from '../grid.ts';
import { canonical, type Pt } from '../shape.ts';
import type { CompassClue, FenceShapeClue, Labels } from '../types.ts';
import type { Rule } from './rule.ts';
import type { State } from '../state.ts';

export function fencePatternKey(sides: number): string {
  const p: Pt[] = [[1, 1]];
  if (sides & 1) p.push([1, 0]);
  if (sides & 2) p.push([2, 1]);
  if (sides & 4) p.push([1, 2]);
  if (sides & 8) p.push([0, 1]);
  return canonical(p);
}

/** Original Glimmith fence clues compare the cross up to rotation/reflection. */
export class FenceShapeRule implements Rule {
  readonly kind = 'fenceShape';
  constructor(private readonly clues: FenceShapeClue[]) {}
  init(_state: State): boolean { return true; }
  propagate(_state: State): boolean { return true; }

  check(grid: Grid, labels: Labels): boolean {
    const { w, h } = grid;
    for (const { cell, sides } of this.clues) {
      const x = cell % w, y = Math.floor(cell / w), region = labels[cell];
      let mask = 0;
      for (const [dx, dy, bit] of [[0, -1, 1], [1, 0, 2], [0, 1, 4], [-1, 0, 8]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || nx >= w || ny < 0 || ny >= h || !grid.active[ny * w + nx] ||
            labels[ny * w + nx] !== region) mask |= bit;
      }
      if (fencePatternKey(mask) !== fencePatternKey(sides)) return false;
    }
    return true;
  }
}

/** Original Glimmith compass counts cells of its region anywhere on each side. */
export class CompassRule implements Rule {
  readonly kind = 'compass';
  constructor(private readonly clues: CompassClue[]) {}
  init(_state: State): boolean { return true; }
  propagate(_state: State): boolean { return true; }

  check(grid: Grid, labels: Labels): boolean {
    for (const clue of this.clues) {
      const x = clue.cell % grid.w, y = Math.floor(clue.cell / grid.w);
      const counts = { up: 0, down: 0, left: 0, right: 0 };
      for (let c = 0; c < grid.cells; c++) {
        if (c === clue.cell || labels[c] !== labels[clue.cell]) continue;
        const px = c % grid.w, py = Math.floor(c / grid.w);
        if (py < y) counts.up++;
        if (py > y) counts.down++;
        if (px < x) counts.left++;
        if (px > x) counts.right++;
      }
      for (const d of ['up', 'down', 'left', 'right'] as const) {
        if (clue[d] >= 0 && clue[d] !== counts[d]) return false;
      }
    }
    return true;
  }
}
