import type { Clue } from '../engine/types.ts';

/**
 * Help explains each rule once. Cell/edge clues are instances of a rule, not
 * separate rules: a puzzle may have dozens of Palisade or Compass symbols.
 * Keep the first instance for rules with shared parameters (Range, Shape Bank,
 * Rose Window) to match the one-chip-per-kind goal strip.
 */
export function uniqueRuleClues(clues: readonly Clue[]): Clue[] {
  const seen = new Set<Clue['type']>();
  return clues.filter((clue) => {
    if (seen.has(clue.type)) return false;
    seen.add(clue.type);
    return true;
  });
}
