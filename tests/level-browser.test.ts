import test from 'node:test';
import assert from 'node:assert/strict';
import { organizeLevels, flattenedLevels, levelLocation, compareChapters, type LevelEntry } from '../src/web/levelCatalog.ts';
import { readLevelProgress, saveLevelProgress, completeLevel, chapterProgress } from '../src/web/levelProgress.ts';
import type { PresetLevel } from '../src/presets.ts';

const make = (id: string, origin = 'betaller'): LevelEntry => ({
  key: `${origin}:${id}`, label: id, packName: origin,
  level: { id, title: id, puzzle: {width:2,height:2,clues:[]},solution:[0,0,0,0],stars:1,difficulty:1 } as PresetLevel,
});

test('Zone 1/2/3, numbered chapters 1/2/10, then numerically sorted file names', () => {
  const raw = [
    make('Zone2/10-mixed/1000'), make('Zone1/10-mixed/0100'),
    make('Zone1/2-shape/0527'), make('Zone3/1-tatami/0021'),
    make('Zone1/1-single/0067B'), make('Zone1/1-single/0008'),
    make('Zone1/2-shape/0049'), make('Zone1/1-single/0067'),
  ];
  const zones = organizeLevels(raw);
  assert.deepEqual(zones.map(z => z.key), ['Zone1','Zone2','Zone3']);
  assert.deepEqual(zones[0].chapters.map(c => c.name), ['1-single','2-shape','10-mixed']);
  assert.deepEqual(zones[0].chapters[0].levels.map(l => l.level.id.split('/').at(-1)), ['0008','0067','0067B']);
  assert.deepEqual(flattenedLevels(zones).map(e => e.key).slice(0,3), [
    'betaller:Zone1/1-single/0008','betaller:Zone1/1-single/0067','betaller:Zone1/1-single/0067B',
  ]);
  assert.ok(compareChapters('2-foo','10-bar') < 0);
});

test('custom imports are still selectable and never mistaken for a Zone', () => {
  const extra = make('custom1','personal');
  extra.level.chapter = 'My work';
  const zone = organizeLevels([extra])[0];
  assert.equal(zone.key, 'custom:personal');
  assert.equal(zone.chapters[0].name, 'My work');
  assert.equal(levelLocation(make('Zone1/1-single/0008')).zone, 'Zone1');
});

test('completion persists by stable ID across restart and reordered packs', () => {
  const kv = new Map<string,string>();
  const storage = {getItem: (k: string) => kv.get(k) ?? null, setItem:(k:string,v:string) => {kv.set(k,v)}};
  const state = readLevelProgress(storage);
  const key = 'betaller:Zone1/1-single/0008';
  assert.equal(completeLevel(state,key),true);
  assert.equal(completeLevel(state,key),false);
  state.recent = key;
  assert.ok(saveLevelProgress(storage,state));
  const restored = readLevelProgress(storage);
  assert.equal(restored.completed.has(key),true);
  assert.equal(restored.recent,key);
  assert.equal(chapterProgress(['other',key],restored.completed),1);
  assert.equal(readLevelProgress({getItem:()=>'{bad json'}).completed.size,0);
});
