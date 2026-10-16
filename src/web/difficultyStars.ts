/** Presentation-only compaction: preserve the actual star count in puzzle data. */
const MAX_VISIBLE_STARS = 24;

/**
 * Show every star for ordinary ratings, including ratings above seven.
 * For extreme imported values, keep the UI usable while showing the exact
 * remaining count instead of allocating an unbounded number of glyphs.
 */
export function formatStars(stars: number): string {
  if (!Number.isSafeInteger(stars) || stars < 0) return '—';
  const visible = Math.min(stars, MAX_VISIBLE_STARS);
  return '★'.repeat(visible) +
    (stars > visible ? ` +${stars - visible}★` : '☆'.repeat(Math.max(0, 7 - stars)));
}
