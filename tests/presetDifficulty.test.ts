import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { fromBetallerJSON } from '../src/importBetaller.ts';
import { parsePresetPack, type PresetLevel } from '../src/presets.ts';
import { formatStars } from '../src/web/difficultyStars.ts';
import { flattenedLevels, organizeLevels, type LevelEntry } from '../src/web/levelCatalog.ts';

test('Betaller difficulty is preserved instead of capped at seven', () => {
  const cells = Array.from({ length: 4 }, (_, i) => ({ row: Math.floor(i / 2), col: i % 2 }));
  const source = {
    grid: { width: 2, height: 2 },
    cells,
    rules: [],
    edges: [],
    _meta: { archive_id: '0001', archive_difficulty: 12 },
  };
  const answer = {
    grid: { width: 2, height: 2 },
    regions: [[[0, 0], [0, 1], [1, 0], [1, 1]]],
  };
  const level = fromBetallerJSON(source, answer, 'Zone1/1-basic/0001');
  assert.equal(level.difficulty, 12);
  assert.equal(level.stars, 12);
});

test('preset packs allow star ratings above seven', () => {
  const source = JSON.parse(readFileSync(new URL('../public/presets/glimmith.json', import.meta.url), 'utf8'));
  source.levels[0].stars = 12;
  source.levels[0].difficulty = 12;
  assert.equal(parsePresetPack(source).levels[0].stars, 12);
  source.levels[0].stars = -1;
  assert.throws(() => parsePresetPack(source), /invalid difficulty/);
});

test('stars beyond seven render without losing their count', () => {
  assert.equal(formatStars(0), '☆☆☆☆☆☆☆');
  assert.equal(formatStars(2), '★★☆☆☆☆☆');
  assert.equal(formatStars(7), '★'.repeat(7));
  assert.equal(formatStars(12), '★'.repeat(12));
  assert.equal(formatStars(30), '★'.repeat(24) + ' +6★');
});

function entry(id: string, difficulty: number): LevelEntry {
  const level: PresetLevel = {
    id, title: id, stars: difficulty, difficulty,
    puzzle: { width: 2, height: 2, clues: [] },
    solution: [0, 0, 0, 0],
  };
  return { key: `betaller:${id}`, label: id, packName: 'Glimmith', level };
}

test('chapters keep numeric order; levels sort by raw difficulty, then natural file order', () => {
  const zones = organizeLevels([
    entry('Zone1/2-second/0001', 2),
    entry('Zone1/1-first/0100', 9),
    entry('Zone1/1-first/0010', 3),
    entry('Zone1/1-first/0002', 3),
    entry('Zone1/1-first/0001', 12),
    entry('Zone1/1-first/0003', 1),
    entry('Zone2/1-first/0001', 1),
  ]);
  assert.deepEqual(zones.map((zone) => zone.key), ['Zone1', 'Zone2']);
  assert.deepEqual(zones[0].chapters.map((chapter) => chapter.name), ['1-first', '2-second']);
  assert.deepEqual(zones[0].chapters[0].levels.map((e) => e.level.id.split('/').at(-1)), [
    '0003', '0002', '0010', '0100', '0001',
  ]);
  // The previous/next navigation uses the same flattened order as the grid.
  assert.deepEqual(flattenedLevels(zones).map((e) => e.level.difficulty), [1, 3, 3, 9, 12, 2, 1]);
});
