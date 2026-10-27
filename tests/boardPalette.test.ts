import assert from 'node:assert/strict';
import { test } from 'node:test';
import { HUES } from '../src/web/model.ts';
import { boardPalette, tintedPane } from '../src/web/boardPalette.ts';

function luminance(hex: string): number {
  const channels = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}
function contrast(a: string, b: string): number {
  const x = luminance(a) + 0.05;
  const y = luminance(b) + 0.05;
  return Math.max(x, y) / Math.min(x, y);
}

test('classic workshop uses warm unpainted glass and lead while preserving hue indices', () => {
  const classic = boardPalette('classic');
  assert.equal(classic.clearGlass, '#e6dfd0');
  assert.equal(classic.lead, '#30262a');
  assert.equal(classic.ink, '#201b1a');
  assert.equal(boardPalette('modern').clearGlass, '#dfe9f8');
  for (const hue of HUES) assert.equal(tintedPane(hue, classic), hue);
});

test('night board has genuinely dark empty glass and readable light lead/grid/clues', () => {
  const night = boardPalette('dark');
  const day = boardPalette('modern');
  assert.ok(luminance(night.clearGlass) < luminance(day.clearGlass) * 0.15);
  assert.ok(contrast(night.clearGlass, night.lead) >= 5);
  assert.ok(contrast(night.clearGlass, night.ink) >= 7);
  assert.match(night.emptySheen, /0\.1\)/);
  assert.notEqual(night.undecided, boardPalette('classic').undecided);
  assert.notEqual(night.markerFill, boardPalette('classic').markerFill);
});

test('night colours remain distinguishable and clue text stays legible on painted glass', () => {
  const night = boardPalette('dark');
  const panes = HUES.map((hue) => tintedPane(hue, night));
  assert.equal(new Set(panes).size, HUES.length);
  for (const [i, pane] of panes.entries()) {
    assert.match(pane, /^#[0-9a-f]{6}$/);
    assert.notEqual(pane, HUES[i]);
    assert.ok(contrast(night.ink, pane) >= 4.5, `Clue ink must contrast with pane ${i}: ${pane}`);
  }
});
