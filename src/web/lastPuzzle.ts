import type { Puzzle } from '../engine/types.ts';

/** The last opened window and its source level, persisted across app reloads. */
export interface LastPuzzle {
  puzzle: Puzzle;
  solution: number[];
  stars: number;
  difficulty: number;
  hash: string;
  presetKey?: string;
}

/** Keep the level identity when replaying a saved window, not just its marks. */
export function restoredPuzzleArgs(last: LastPuzzle): [
  puzzle: Puzzle, solution: Int32Array, stars: number, difficulty: number, presetKey?: string,
] {
  return [last.puzzle, Int32Array.from(last.solution), last.stars, last.difficulty, last.presetKey];
}
