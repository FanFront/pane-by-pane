import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { GUIDE } from '../src/web/beginnerTips.ts';
import { EXTRA_TIPS, GROUPS, TOOL_LABELS } from '../src/web/tipCatalog.ts';
import { allLessons, levelTipIds } from '../src/web/tipGallery.ts';
import { SCENES, validateScenes } from '../src/web/tipScenes.ts';
import type { Puzzle } from '../src/engine/types.ts';

test('all three languages contain exactly twenty unique techniques, organized in three groups', () => {
  assert.equal(EXTRA_TIPS.length, 15);
  for (const lang of ['zh','en','ko'] as const) {
    const lessons = allLessons(lang);
    assert.equal(lessons.length, 20);
    assert.equal(new Set(lessons.map(x=>x.id)).size,20);
    assert.deepEqual(lessons.map(x=>x.id), allLessons('zh').map(x=>x.id));
    assert.deepEqual([...new Set(lessons.map(x=>x.group))], ['basics','rules','advanced']);
    for (const lesson of lessons) {
      for (const value of Object.values(lesson.copy)) assert.ok(value.trim().length >= 4, lang + '/' + lesson.id);
      assert.ok(lesson.rules.length > 0, 'missing relevant rule ' + lesson.id);
    }
    assert.equal(Object.keys(GROUPS[lang]).length,3);
    assert.ok(TOOL_LABELS[lang].next);
    assert.equal(GUIDE[lang].tips.length,5);
  }
});

test('each lesson has three geometrically valid illustrated stages, including borders and joins', () => {
  assert.ok(validateScenes());
  assert.deepEqual(Object.keys(SCENES).sort(), allLessons('en').map(x=>x.id).sort());
  for (const [id, stages] of Object.entries(SCENES)) {
    assert.equal(stages.length,3,id);
    assert.ok(stages.some(s=>s.focus?.length || s.walls?.length || s.open?.length),id);
  }
  assert.equal(SCENES.vertex[2].walls?.length, 4);
  assert.equal(SCENES.brickyThree[2].walls?.length, 3);
  assert.deepEqual(SCENES.brickyThree[2].open, ['1,0,R']);
  assert.equal(SCENES.diagonal[2].invalid,true);
  assert.equal(SCENES.areaRemainder[2].invalid,true);
});

test('current-level filtering matches only rules actually in this puzzle', () => {
  const simple: Puzzle = {width:4,height:4,clues:[{type:'boxy'}]};
  const ids = levelTipIds(simple);
  assert.ok(ids.includes('boxyBounds'));
  assert.ok(!ids.includes('vertex'));
  const mixed: Puzzle = {width:4,height:4,clues:[{type:'loopy'}, {type:'fenceShape',cell:5,sides:3}]};
  const subset = levelTipIds(mixed);
  for (const id of ['vertex','parity','fenceRotate','fenceOpen','parityFence']) assert.ok(subset.includes(id as typeof subset[number]),id);
  assert.ok(!subset.includes('brickyThree'));
  assert.ok(!levelTipIds({width:3,height:3,clues:[{type:'loopy'}]}).includes('parityFence'));
  assert.ok(!levelTipIds({width:3,height:3,clues:[{type:'areaNumber',cell:0,value:3}]}).includes('areaRemainder'));
});

test('important deductions are explicitly conditional, not a promise of unique solutions', () => {
  const zh = allLessons('zh');
  const byId = new Map(zh.map(x=>[x.id,x.copy]));
  assert.match(byId.get('areaRemainder')!.warning,/全盘统一的固定面积/);
  assert.match(byId.get('brickyCorner')!.warning,/并不总违反砖纹/);
  assert.match(byId.get('roseSeparate')!.warning,/不同符号/);
  assert.match(byId.get('compassCount')!.warning,/重复计数/);
  assert.match(byId.get('fenceRotate')!.warning,/定向围栏/);
  assert.match(TOOL_LABELS.zh.note,/不以“题目只有唯一解”/);
});

test('stepper controls are interactive and the current puzzle is passed to tutorial on open', () => {
  const main = readFileSync(new URL('../src/web/main.ts',import.meta.url),'utf8');
  const gallery = readFileSync(new URL('../src/web/tipGallery.ts',import.meta.url),'utf8');
  assert.match(main,/renderBeginnerTips\(\$\('tips-content'\), lang, current\?\.puzzle\)/);
  assert.match(gallery,/states\.set\(lesson\.id/);
  assert.match(gallery,/next\.addEventListener\('click'/);
  assert.match(gallery,/levelTipIds/);
  assert.match(gallery,/aria-pressed/);
});
