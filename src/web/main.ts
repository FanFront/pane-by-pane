import { createEngine } from '../engine/engine.ts';
import { shapeName } from '../engine/shape.ts';
import { RULE_KINDS, type Puzzle, type RuleKind } from '../engine/types.ts';
import { ruleConflict, type GenerateOptions } from '../engine/generator/generate.ts';
import { checkCompletion, findViolations, nextHint } from './analysis.ts';
import { Board, shapeIcon, solutionView } from './board.ts';
import { PlayerState, WALL, type PlayerCheckpoint } from './model.ts';
import type { WorkerIn, WorkerOut } from './worker.ts';
import { M, applyStatic, lang, setLang } from './i18n.ts';
import { parsePresetPack, type PresetLevel, type PresetPack } from '../presets.ts';
import { readPersonalPack, savePersonalPack } from './presetStore.ts';
import { organizeLevels, flattenedLevels, levelLocation, type LevelEntry, type LevelZone } from './levelCatalog.ts';
import { readLevelProgress, saveLevelProgress, completeLevel, chapterProgress } from './levelProgress.ts';
import { restoredPuzzleArgs, type LastPuzzle } from './lastPuzzle.ts';
import { formatStars } from './difficultyStars.ts';
import { uniqueRuleClues } from './ruleHelp.ts';
import { renderBeginnerTips } from './beginnerTips.ts';
import { chooseBackAction, installAndroidBack, type CapacitorBridge } from './androidBack.ts';

applyStatic();

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const form = $<HTMLFormElement>('gen-form');
const genBtn = $<HTMLButtonElement>('generate');
const genStatus = $('gen-status');
const info = $('info');
const starsEl = $('stars');
const rulesInfo = $('rules-info');
const statusEl = $('status');
const doneEl = $('done');
const errorMode = $<HTMLSelectElement>('error-mode');
const goalDialog = $<HTMLDialogElement>('goal-dialog');
const goalArea = $('goal-area');
const goalBar = $('goal-bar');
const coach = $('coach');
const revealDialog = $<HTMLDialogElement>('reveal-dialog');
const revealBtn = $<HTMLButtonElement>('reveal');
const warnDialog = $<HTMLDialogElement>('warn-dialog');
const settingsDialog = $<HTMLDialogElement>('settings-dialog');
const tipsDialog = $<HTMLDialogElement>('tips-dialog');
renderBeginnerTips($('tips-content'), lang);

let returnAfterTips: HTMLDialogElement | null = null;
function openTips(from: HTMLDialogElement): void {
  if (tipsDialog.open) return;
  renderBeginnerTips($('tips-content'), lang, current?.puzzle);
  from.close();
  returnAfterTips = from;
  tipsDialog.showModal();
}
$('tips-from-goal').addEventListener('click', () => openTips(goalDialog));
$('tips-from-settings').addEventListener('click', () => openTips(settingsDialog));
$('tips-close').addEventListener('click', () => tipsDialog.close());
tipsDialog.addEventListener('click', (event) => {
  if (event.target === tipsDialog) tipsDialog.close();
});
// Also handles Escape and the Android Back button. Restore the previous dialog.
tipsDialog.addEventListener('close', () => {
  const previous = returnAfterTips;
  returnAfterTips = null;
  if (previous && (previous !== goalDialog || current)) previous.showModal();
});

// The board keeps only playing controls. All infrequent actions live in Settings.
$('settings-entry').addEventListener('click', () => {
  dismissCoach();
  if (!settingsDialog.open) settingsDialog.showModal();
});
$('settings-close').addEventListener('click', () => settingsDialog.close());
settingsDialog.addEventListener('click', (event) => {
  if (event.target === settingsDialog) settingsDialog.close();
});

/** A warning the user has to see: shown as a modal, not a status line. */
function warn(text: string, title = M.warnTitle): void {
  $('warn-title').textContent = title;
  $('warn-text').textContent = text;
  warnDialog.showModal();
}
$('warn-close').addEventListener('click', () => warnDialog.close());
// Cycle through Korean → English → Simplified Chinese; chosen language persists.
$('lang').addEventListener('click', () => {
  setLang(lang === 'ko' ? 'en' : lang === 'en' ? 'zh' : 'ko');
  refreshPresetUi();
});

interface Current {
  puzzle: Puzzle;
  solution: Int32Array;
  engine: ReturnType<typeof createEngine>;
  ps: PlayerState;
  key: string;
  presetKey?: string;
}
let current: Current | null = null;
let worker: Worker | null = null;
let hypothesis: { key: string; checkpoint: PlayerCheckpoint } | null = null;

const board = new Board($<HTMLCanvasElement>('board'), {
  onChange: () => onChange(),
  onArea: (info) => {
    if (info) setStatus(M.areaOf(info.count));
    else refreshStatus();
  },
});

// -- options / URL -------------------------------------------------------------

function readOptions(): GenerateOptions {
  const num = (id: string) => Number($<HTMLInputElement>(id).value);
  const rules = [...form.querySelectorAll<HTMLInputElement>('#rules input:checked')].map((i) => i.value as RuleKind);
  const seedText = $<HTMLInputElement>('seed').value.trim();
  return {
    width: num('w'),
    height: num('h'),
    rules,
    stars: [num('starLo'), num('starHi')],
    seed: seedText ? Number(seedText) >>> 0 : undefined,
    mask: $<HTMLInputElement>('mask').checked ? 'symmetric' : 'rect',
    walls: $<HTMLInputElement>('walls').checked,
    roseSymbols: Math.min(4, Math.max(1, num('rose') || 2)),
    attempts: 300,
  };
}

function writeOptions(o: GenerateOptions): void {
  $<HTMLInputElement>('w').value = String(o.width);
  $<HTMLInputElement>('h').value = String(o.height);
  $<HTMLInputElement>('starLo').value = String(o.stars?.[0] ?? 1);
  $<HTMLInputElement>('starHi').value = String(o.stars?.[1] ?? 7);
  $<HTMLInputElement>('mask').checked = o.mask === 'symmetric';
  $<HTMLInputElement>('walls').checked = !!o.walls;
  $<HTMLInputElement>('rose').value = String(o.roseSymbols ?? 2);
  for (const i of form.querySelectorAll<HTMLInputElement>('#rules input')) i.checked = o.rules.includes(i.value as RuleKind);
  $('rose-row').hidden = !o.rules.includes('rose');
}

function optionsToHash(o: GenerateOptions): string {
  const q = new URLSearchParams({
    w: String(o.width),
    h: String(o.height),
    rules: o.rules.join(','),
    stars: `${o.stars?.[0] ?? 1}-${o.stars?.[1] ?? 7}`,
    mask: o.mask === 'symmetric' ? '1' : '0',
    walls: o.walls ? '1' : '0',
    rose: String(o.roseSymbols ?? 2),
    seed: String(o.seed ?? ''),
  });
  // region size is chosen by the generator; kept in the link only when set explicitly (older links)
  if (o.minSize !== undefined) q.set('min', String(o.minSize));
  if (o.maxSize !== undefined) q.set('max', String(o.maxSize));
  return `#${q}`;
}

function optionsFromHash(): GenerateOptions | null {
  if (!location.hash || location.hash.length < 2) return null;
  const q = new URLSearchParams(location.hash.slice(1));
  const rules = (q.get('rules') ?? '').split(',').filter((r): r is RuleKind => RULE_KINDS.includes(r as RuleKind));
  if (!rules.length || !q.get('seed')) return null;
  const [lo, hi] = (q.get('stars') ?? '1-7').split('-').map(Number);
  return {
    width: Number(q.get('w') ?? 6),
    height: Number(q.get('h') ?? 6),
    rules,
    stars: [lo, hi ?? lo],
    mask: q.get('mask') === '1' ? 'symmetric' : 'rect',
    walls: q.get('walls') === '1',
    roseSymbols: Number(q.get('rose') ?? 2),
    seed: Number(q.get('seed')),
    attempts: 300,
    ...(q.has('min') ? { minSize: Number(q.get('min')) } : {}),
    ...(q.has('max') ? { maxSize: Number(q.get('max')) } : {}),
  };
}

// -- generation ------------------------------------------------------------------

function startGenerate(opts: GenerateOptions, scrollUp = false): void {
  if (worker) worker.terminate();
  worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
  genBtn.disabled = true;
  genStatus.textContent = M.generating;
  const t0 = Date.now();
  worker.onmessage = (ev: MessageEvent<WorkerOut>) => {
    const m = ev.data;
    if (m.type === 'progress') {
      genStatus.textContent = M.generatingAttempt(m.attempt);
      return;
    }
    genBtn.disabled = false;
    if (m.type === 'none') {
      genStatus.textContent = '';
      warn(M.warnNoPuzzle);
      return;
    }
    genStatus.textContent = M.generatedIn(((Date.now() - t0) / 1000).toFixed(1), m.seed);
    const shared = { ...opts, seed: m.seed };
    history.replaceState(null, '', optionsToHash(shared));
    loadPuzzle(m.puzzle, Int32Array.from(m.solution), m.analysis.stars, m.analysis.difficulty);
    // asked for from the form at the bottom of a phone screen: bring the new window into view
    if (scrollUp) window.scrollTo({ top: 0, behavior: 'smooth' });
    saveLast({ puzzle: m.puzzle, solution: m.solution, stars: m.analysis.stars, difficulty: m.analysis.difficulty, hash: location.hash });
    // The requested difficulty was not reached: say so instead of passing the
    // closest miss off as what was asked for.
    const [lo, hi] = opts.stars ?? [1, 7];
    if (m.missed) warn(M.warnStarsMissed(lo, hi, m.analysis.stars), M.warnStarsMissedTitle);
  };
  worker.onerror = (e) => {
    genBtn.disabled = false;
    genStatus.textContent = M.error(e.message);
  };
  worker.postMessage({ type: 'generate', opts } satisfies WorkerIn);
}

// -- persistence -----------------------------------------------------------------

function saveLast(l: LastPuzzle): void {
  try {
    localStorage.setItem('pbp:last', JSON.stringify(l));
  } catch {
    /* ignore */
  }
}

function loadLast(): LastPuzzle | null {
  try {
    const t = localStorage.getItem('pbp:last');
    return t ? (JSON.parse(t) as LastPuzzle) : null;
  } catch {
    return null;
  }
}

function puzzleKey(p: Puzzle): string {
  const s = JSON.stringify(p);
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return `pbp:marks:${(h >>> 0).toString(36)}`;
}

function saveMarks(): void {
  if (!current) return;
  try {
    localStorage.setItem(current.key, current.ps.serialize());
  } catch {
    /* ignore */
  }
}

// -- personal and bundled preset levels -------------------------------------------

let bundledPack: PresetPack | null = null;
let betallerPack: PresetPack | null = null;
let privatePack: PresetPack | null = null;
let personalPack: PresetPack | null = null;
let presetEntries: LevelEntry[] = [];
let levelZones: LevelZone[] = [];
const progress = readLevelProgress(localStorage);
const levelsDialog = $<HTMLDialogElement>('levels-dialog');
const presetStatus = $('preset-status');
const presetPrev = $<HTMLButtonElement>('preset-prev');
const presetNext = $<HTMLButtonElement>('preset-next');
const presetFile = $<HTMLInputElement>('preset-file');
let selectedZone = '';
let selectedChapter: string | null = null;

function presetText(zh: string, en: string, ko: string): string {
  return lang === 'zh' ? zh : lang === 'ko' ? ko : en;
}

/** Hypothesis marks remain in memory until accepted. Leaving a level drops them. */
function updateHypothesisUi(): void {
  const active = hypothesis !== null;
  const bar = $('hypothesis-bar');
  const wasVisible = !bar.hidden;
  bar.hidden = !active;
  $('board-wrap').classList.toggle('hypothesis-active', active);
  const button = $<HTMLButtonElement>('hypothesis');
  button.textContent = active
    ? presetText('假设中', 'Testing', '가설 중')
    : presetText('假设', 'Hypothesis', '가설');
  button.classList.toggle('active', active);
  button.disabled = active || !current || Boolean(board.reveal);
  $('hypothesis-label').textContent = presetText(
    '假设模式 · 修改暂不写入存档', 'Hypothesis · changes are not saved yet', '가설 · 아직 저장되지 않음',
  );
  $('hypothesis-commit').textContent = presetText('采纳', 'Apply', '적용');
  $('hypothesis-discard').textContent = presetText('放弃', 'Discard', '취소');
  if (wasVisible !== active && current) board.layout();
}

function countComplete(entries: readonly LevelEntry[]): number {
  return chapterProgress(entries.map((entry) => entry.key), progress.completed);
}

/** Update completion and navigation without rebuilding/sorting the full level catalog. */
function refreshCurrentPresetUi(): void {
  const index = presetEntries.findIndex((e) => e.key === current?.presetKey);
  presetPrev.disabled = index <= 0;
  presetNext.disabled = index < 0 || index >= presetEntries.length - 1;
  $('preset-current').textContent = index < 0
    ? presetText('尚未选择关卡', 'No level selected', '선택한 레벨 없음')
    : `${presetEntries[index].label} · ${progress.completed.has(presetEntries[index].key)
      ? presetText('✓ 已完成', '✓ Completed', '✓ 완료')
      : presetText('○ 未完成', '○ Not completed', '○ 미완료')}`;
}

/** Rebuild only when an imported or bundled level pack actually changes. */
function rebuildPresetCatalog(): void {
  const packs: { origin: string; pack: PresetPack }[] = [];
  if (betallerPack) packs.push({ origin: 'betaller', pack: betallerPack });
  if (bundledPack) packs.push({ origin: 'bundled', pack: bundledPack });
  if (privatePack) packs.push({ origin: 'private', pack: privatePack });
  if (personalPack) packs.push({ origin: 'personal', pack: personalPack });
  const all = packs.flatMap(({ origin, pack }) =>
    pack.levels.map((level): LevelEntry => ({
      key: `${origin}:${level.id}`,
      label: `${pack.name} / ${level.chapter ? level.chapter + ' / ' : ''}${level.title}`,
      level,
      packName: pack.name,
    })),
  );
  levelZones = organizeLevels(all);
  presetEntries = flattenedLevels(levelZones);
}

function refreshPresetUi(): void {
  $('preset-heading').textContent = presetText('关卡模式', 'Level mode', '스테이지 모드');
  $('preset-intro').textContent = presetText(
    '按 Zone 和章节挑选关卡；完成情况自动保存在此设备。随机生成器在下方高级工具中。',
    'Browse zones and chapters. Your completed levels stay saved on this device.',
    '구역과 챕터별로 퍼즐을 고르세요. 완료 기록은 이 기기에 저장됩니다.',
  );
  $('levels-entry-label').textContent = presetText('关卡', 'Levels', '레벨');
  $('settings-title').textContent = presetText('设置', 'Settings', '설정');
  $('settings-entry-label').textContent = presetText('设置', 'Settings', '설정');
  $('settings-entry').setAttribute('aria-label', $('settings-title').textContent || 'Settings');
  $('settings-entry').title = $('settings-title').textContent || 'Settings';
  $('settings-gameplay-heading').textContent = presetText('游玩选项', 'Play options', '게임 설정');
  $('settings-error-label').textContent = presetText('错误提示', 'Show errors', '오류 표시');
  $('settings-close').setAttribute('aria-label', presetText('关闭设置', 'Close settings', '설정 닫기'));
  $('tips-title').textContent = presetText('推理技巧大全', 'Solving guide', '풀이 가이드');
  $('tips-close').setAttribute('aria-label', presetText('关闭技巧', 'Close tips', '팁 닫기'));
  $('tips-close').title = $('tips-close').getAttribute('aria-label') || '';
  for (const entry of [$('tips-from-goal'), $('tips-from-settings')]) {
    entry.textContent = presetText('推理技巧大全 · 分步演示', 'Solving guide · step-by-step', '풀이 가이드 · 단계별 예시');
  }
  $('levels-title').textContent = presetText('关卡选择', 'Select a level', '레벨 선택');
  $('levels-back').textContent = presetText('← 章节', '← Chapters', '← 챕터');
  $('levels-legend').textContent = presetText('✓ 已完成 · ○ 未完成 · ◆ 当前关卡', '✓ Completed · ○ Not completed · ◆ Current', '✓ 완료 · ○ 미완료 · ◆ 현재');
  $('preset-open').textContent = presetText('选择 Zone / 章节 / 关卡', 'Browse zones / chapters / levels', '구역 / 챕터 / 레벨 선택');
  $('preset-import-label').textContent = presetText('导入本地 JSON 关卡包', 'Import a local JSON pack', '로컬 JSON 퍼즐 팩 가져오기');
  $('generator-heading').textContent = presetText('高级工具：随机生成关卡', 'Advanced: Generate random puzzles', '고급: 무작위 퍼즐 만들기');
  presetPrev.textContent = presetText('← 上一关', '← Previous', '← 이전');
  presetNext.textContent = presetText('下一关 →', 'Next →', '다음 →');

  refreshCurrentPresetUi();
  updateHypothesisUi();
  if (!presetEntries.length) {
    presetStatus.textContent = presetText('正在加载关卡…', 'Loading levels…', '레벨 로딩 중…');
  }
  if (levelsDialog.open) renderLevelBrowser();
}

function renderLevelBrowser(): void {
  const zoneButtons = $('level-zones');
  const chapterList = $('level-chapters');
  const tiles = $('level-grid');
  const title = $('levels-subtitle');
  const subprogress = $('levels-subprogress');
  zoneButtons.replaceChildren();
  chapterList.replaceChildren();
  tiles.replaceChildren();
  $('chapter-complete').hidden = true;

  $('levels-total').textContent = presetText(
    `共 ${countComplete(presetEntries)} / ${presetEntries.length} 关完成`,
    `${countComplete(presetEntries)} / ${presetEntries.length} levels completed`,
    `총 ${countComplete(presetEntries)} / ${presetEntries.length}개 완료`,
  );
  if (!levelZones.some((z) => z.key === selectedZone)) selectedZone = levelZones[0]?.key ?? '';
  const zone = levelZones.find((z) => z.key === selectedZone);
  if (!zone) {
    title.textContent = presetText('暂无关卡', 'No levels available', '레벨이 없습니다');
    $('levels-back').hidden = true;
    chapterList.hidden = true;
    tiles.hidden = true;
    subprogress.textContent = '';
    return;
  }

  for (const row of levelZones) {
    const complete = row.chapters.reduce((n, c) => n + countComplete(c.levels), 0);
    const btn = document.createElement('button');
    btn.type = 'button';
    const allDone = row.count > 0 && complete === row.count;
    btn.textContent = `${allDone ? '✓ ' : ''}${row.name} (${complete}/${row.count})`;
    btn.classList.toggle('is-complete', allDone);
    btn.setAttribute('aria-pressed', String(row.key === zone.key));
    btn.addEventListener('click', () => {
      selectedZone = row.key;
      selectedChapter = null;
      renderLevelBrowser();
    });
    zoneButtons.append(btn);
  }

  const chapter = zone.chapters.find((c) => c.key === selectedChapter);
  $('levels-back').hidden = !chapter;
  chapterList.hidden = !!chapter;
  tiles.hidden = !chapter;
  if (!chapter) {
    title.textContent = zone.name;
    subprogress.textContent = presetText('选择章节', 'Choose a chapter', '챕터 선택');
    for (const row of zone.chapters) {
      const done = countComplete(row.levels);
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'level-chapter';
      const allDone = row.levels.length > 0 && done === row.levels.length;
      btn.classList.toggle('is-complete', allDone);
      const name = document.createElement('strong');
      name.textContent = `${allDone ? '✦ ' : ''}${row.name}`;
      const count = document.createElement('span');
      count.className = 'level-count';
      count.textContent = allDone
        ? presetText('✓ 章节全部完成', '✓ Chapter complete', '✓ 챕터 완료')
        : presetText(
          `${done} / ${row.levels.length} 已完成`,
          `${done} / ${row.levels.length} completed`,
          `${done} / ${row.levels.length} 완료`,
        );
      const meter = document.createElement('span');
      meter.className = 'level-meter';
      const fill = document.createElement('span');
      fill.style.width = `${100 * done / row.levels.length}%`;
      meter.append(fill);
      btn.append(name, count, meter);
      btn.addEventListener('click', () => {
        selectedChapter = row.key;
        renderLevelBrowser();
      });
      chapterList.append(btn);
    }
    return;
  }
  title.textContent = chapter.name;
  const finished = chapter.levels.length > 0 && countComplete(chapter.levels) === chapter.levels.length;
  subprogress.textContent = `${countComplete(chapter.levels)} / ${chapter.levels.length}`;
  $('chapter-complete').hidden = !finished;
  $('chapter-complete').textContent = finished
    ? presetText('✦ 本章节已全部通关！', '✦ Every level in this chapter is complete!', '✦ 이 챕터의 모든 퍼즐 완료!')
    : '';
  for (const row of chapter.levels) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'level-tile';
    const completed = progress.completed.has(row.key);
    if (completed) btn.classList.add('is-complete');
    if (row.key === current?.presetKey) btn.classList.add('is-current');
    const name = document.createElement('strong');
    name.textContent = '#' + row.level.id.split('/').at(-1);
    const state = document.createElement('small');
    state.textContent = completed
      ? presetText('✓ 已完成', '✓ Complete', '✓ 완료')
      : row.key === progress.recent
        ? presetText('◆ 进行中', '◆ In progress', '◆ 진행 중')
        : presetText('○ 未完成', '○ Not done', '○ 미완료');
    const rating = document.createElement('small');
    rating.className = 'level-difficulty';
    rating.textContent = row.level.stars ? `★ ${row.level.stars}` : '☆ 0';
    rating.title = M.difficultyLabel(String(row.level.stars), String(row.level.difficulty));
    btn.setAttribute('aria-label', `${row.label}, ${rating.title}, ${state.textContent}`);
    btn.append(name, rating, state);
    btn.addEventListener('click', () => {
      const index = presetEntries.findIndex((e) => e.key === row.key);
      levelsDialog.close();
      playPreset(index);
    });
    tiles.append(btn);
  }
}

function openLevelBrowser(): void {
  const key = current?.presetKey ?? progress.recent;
  const entry = presetEntries.find((e) => e.key === key);
  if (entry) {
    const location = levelLocation(entry);
    selectedZone = location.zone;
    selectedChapter = `${location.zone}/${location.chapter}`;
  }
  renderLevelBrowser();
  // Do not leave Settings underneath the level picker on Android.
  if (settingsDialog.open) settingsDialog.close();
  if (!levelsDialog.open) levelsDialog.showModal();
}

function playPreset(index: number): void {
  const entry = presetEntries[index];
  if (!entry) return;
  if (settingsDialog.open) settingsDialog.close();
  if (worker) {
    worker.terminate();
    worker = null;
    genBtn.disabled = false;
  }
  const { puzzle, solution, stars, difficulty } = entry.level;
  history.replaceState(null, '', location.pathname + location.search);
  progress.recent = entry.key;
  saveLevelProgress(localStorage, progress);
  loadPuzzle(puzzle, Int32Array.from(solution), stars, difficulty, entry.key);
  saveLast({ puzzle, solution, stars, difficulty, hash: '', presetKey: entry.key });
  presetStatus.textContent = entry.label;
  refreshPresetUi();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

$('levels-entry').addEventListener('click', openLevelBrowser);
$('preset-open').addEventListener('click', openLevelBrowser);
$('levels-close').addEventListener('click', () => levelsDialog.close());
$('levels-back').addEventListener('click', () => {
  selectedChapter = null;
  renderLevelBrowser();
});
levelsDialog.addEventListener('click', (event) => {
  if (event.target === levelsDialog) levelsDialog.close();
});
// Escape goes up from a level grid to its chapter list before closing the dialog.
levelsDialog.addEventListener('cancel', (event) => {
  if (selectedChapter !== null) {
    event.preventDefault();
    selectedChapter = null;
    renderLevelBrowser();
  }
});
presetPrev.addEventListener('click', () => playPreset(presetEntries.findIndex((e) => e.key === current?.presetKey) - 1));
presetNext.addEventListener('click', () => playPreset(presetEntries.findIndex((e) => e.key === current?.presetKey) + 1));
presetFile.addEventListener('change', async () => {
  const file = presetFile.files?.[0];
  if (!file) return;
  try {
    if (file.size > 20 * 1024 * 1024) throw new Error('JSON file exceeds 20 MiB');
    const pack = parsePresetPack(JSON.parse(await file.text()), file.name.endsWith('.json') ? file.name.slice(0, -5) : file.name);
    await savePersonalPack(pack);
    personalPack = pack;
    rebuildPresetCatalog();
    refreshPresetUi();
    presetStatus.textContent = presetText(
      `已导入并离线保存 ${pack.levels.length} 关`,
      `Imported and saved ${pack.levels.length} puzzles offline`,
      `${pack.levels.length}개 퍼즐을 오프라인에 저장했습니다`,
    );
  } catch (err) {
    warn(presetText('导入失败：', 'Import failed: ', '가져오기 실패: ') + (err instanceof Error ? err.message : String(err)));
  } finally {
    presetFile.value = '';
  }
});

async function initPresets(openOnFirstVisit = false): Promise<void> {
  try {
    const response = await fetch('./presets/glimmith.json');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    bundledPack = parsePresetPack(await response.json(), '内置关卡');
  } catch (err) {
    presetStatus.textContent = `Bundled presets unavailable: ${err instanceof Error ? err.message : String(err)}`;
  }
  // Build-time generated puzzle bundle (fetched from Betaller, available offline in APK).
  // Missing in a source-only checkout until scripts/pull-betaller-puzzles.sh runs.
  try {
    const response = await fetch('./presets/betaller.json');
    if (response.ok) {
      betallerPack = parsePresetPack(await response.json(), 'Glimmith');
    }
  } catch (err) {
    presetStatus.textContent = `Glimmith presets unavailable: ${err instanceof Error ? err.message : String(err)}`;
  }
  // Optional local-only bundled data. This file is gitignored and never published.
  try {
    const privateResponse = await fetch('./presets/private.json');
    if (privateResponse.ok) privatePack = parsePresetPack(await privateResponse.json(), '本地私有预设');
  } catch (err) {
    presetStatus.textContent = `Private presets unavailable: ${err instanceof Error ? err.message : String(err)}`;
  }
  try {
    const imported = await readPersonalPack();
    if (imported) personalPack = parsePresetPack(imported);
  } catch (err) {
    presetStatus.textContent = `Local presets unavailable: ${err instanceof Error ? err.message : String(err)}`;
  }
  rebuildPresetCatalog();
  refreshPresetUi();
  if (openOnFirstVisit) openLevelBrowser();
  if (betallerPack?.levels.length) {
    presetStatus.textContent = presetText(
      `已内置 ${betallerPack.levels.length} 道 Glimmith 关卡，可离线游玩`,
      `${betallerPack.levels.length} Glimmith puzzles ready offline`,
      `글리미스 퍼즐 ${betallerPack.levels.length}개를 오프라인으로 플레이할 수 있습니다`,
    );
  }
}

// -- puzzle screen ----------------------------------------------------------------

function loadPuzzle(p: Puzzle, solution: Int32Array, stars: number, difficulty: number, presetKey?: string): void {
  const ps = new PlayerState(p);
  const key = puzzleKey(p);
  try {
    const saved = localStorage.getItem(key);
    if (saved) ps.deserialize(saved);
  } catch {
    /* ignore */
  }
  // Unsaved hypothetical edits never bleed into the next puzzle.
  hypothesis = null;
  current = { puzzle: p, solution, engine: createEngine(p), ps, key, presetKey };
  board.eraser = false;
  $('eraser').classList.remove('active');
  board.setPuzzle(p, ps);
  updateHypothesisUi();
  resetHint();
  revealBtn.textContent = M.reveal;
  info.hidden = false;
  const starsLabel = formatStars(stars);
  starsEl.textContent = starsLabel;
  starsEl.title = M.difficultyLabel(String(stars), String(difficulty));
  $('goal-stars').textContent = M.difficultyLabel(starsLabel, String(difficulty));
  rulesInfo.replaceChildren();
  const add = (name: string, text: string, extra?: HTMLElement[]) => {
    const div = document.createElement('div');
    div.className = 'rule';
    const b = document.createElement('b');
    b.textContent = name;
    div.append(b, text, ...(extra ?? []));
    rulesInfo.append(div);
  };
  const kinds = new Set(p.clues.map((c) => c.type));
  if (p.walls?.length) add(M.rule.fixedWalls, M.desc.fixedWalls);
  if (kinds.has('areaNumber')) add(M.rule.areaNumber, M.desc.areaNumber);
  // One explanation per rule kind, even when several cells carry the same clue.
  for (const c of uniqueRuleClues(p.clues)) {
    if (c.type === 'range') {
      const lo = c.min;
      const hi = c.max;
      if (lo !== undefined && hi !== undefined && lo === hi) add(M.rule.precision, M.desc.precision(lo));
      else add(M.rule.range, M.desc.range(lo, hi));
    } else if (c.type === 'shapeBank') {
      const icons = c.shapes.map((k) => {
        const el = shapeIcon(k);
        el.title = shapeName(k);
        return el;
      });
      add(M.rule.shapeBank, M.desc.shapeBank, icons);
    } else if (c.type === 'rose') {
      add(M.rule.rose, M.desc.rose(['○', '△', '□', '☆'].slice(0, c.symbolCount).join(' ')));
    } else if (c.type === 'fenceShape') {
      add(M.rule.fenceShape, M.desc.fenceShape);
    } else if (c.type === 'compass') {
      add(M.rule.compass, M.desc.compass);
    } else if (c.type === 'sizeSeparation') {
      add(M.rule.sizeSeparation, M.desc.sizeSeparation);
    } else if (c.type === 'solitude') {
      add(M.rule.solitude, M.desc.solitude);
    } else if (c.type === 'boxy') {
      add(M.rule.boxy, M.desc.boxy);
    } else if (c.type === 'nonBoxy') {
      add(M.rule.nonBoxy, M.desc.nonBoxy);
    } else if (c.type === 'mingle') {
      add(M.rule.mingle, M.desc.mingle);
    } else if (c.type === 'match') {
      add(M.rule.match, M.desc.match);
    } else if (c.type === 'mismatch') {
      add(M.rule.mismatch, M.desc.mismatch);
    } else if (c.type === 'bricky') {
      add(M.rule.bricky, M.desc.bricky);
    } else if (c.type === 'loopy') {
      add(M.rule.loopy, M.desc.loopy);
    }
  }
  if (kinds.has('polyomino')) add(M.rule.polyomino, M.desc.polyomino);
  if (kinds.has('gemini')) add(M.rule.gemini, M.desc.gemini);
  if (kinds.has('delta')) add(M.rule.delta, M.desc.delta);
  if (kinds.has('inequality')) add(M.rule.inequality, M.desc.inequality);
  if (kinds.has('difference')) add(M.rule.difference, M.desc.difference);
  if (kinds.has('palisade')) add(M.rule.palisade, M.desc.palisade);
  if (kinds.has('watchtower')) add(M.rule.watchtower, M.desc.watchtower);
  buildGoalBar(p, stars);
  refreshStatus();
  updateButtons();
  if (!coachSeen()) showCoach();
}

/** The goal strip: one short chip per rule so the goal is in view without opening the dialog. */
function buildGoalBar(p: Puzzle, stars: number): void {
  goalBar.replaceChildren();
  const chip = (text: string, extra?: HTMLElement[], cls = ''): HTMLButtonElement => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `chip ${cls}`.trim();
    b.title = M.chip.open;
    b.append(text, ...(extra ?? []));
    b.addEventListener('click', openGoal);
    goalBar.append(b);
    return b;
  };
  chip(formatStars(stars), [], 'stars');
  // one chip per rule kind, in a fixed order (area first, then shapes, then relations)
  const specs = new Map<string, () => void>();
  for (const c of p.clues) {
    if (c.type === 'areaNumber') specs.set('areaNumber', () => chip(M.chip.areaNumber));
    else if (c.type === 'range') {
      const { min, max } = c;
      specs.set('range', () => chip(min !== undefined && min === max ? M.chip.precision(min) : M.chip.range(min, max)));
    } else if (c.type === 'shapeBank') specs.set('shapeBank', () => chip(M.chip.shapeBank, c.shapes.map((k) => shapeIcon(k, 5, '#f3eee6'))));
    else if (c.type === 'rose') specs.set('rose', () => chip(M.chip.rose(['○', '△', '□', '☆'].slice(0, c.symbolCount).join(''))));
    else if (c.type === 'polyomino') specs.set('polyomino', () => chip(M.chip.polyomino));
    else if (c.type === 'gemini') specs.set('gemini', () => chip(M.chip.gemini));
    else if (c.type === 'delta') specs.set('delta', () => chip(M.chip.delta));
    else if (c.type === 'fenceShape') specs.set('fenceShape', () => chip(M.chip.fenceShape));
    else if (c.type === 'compass') specs.set('compass', () => chip(M.chip.compass));
    else if (c.type === 'sizeSeparation') specs.set('sizeSeparation', () => chip(M.chip.sizeSeparation));
    else if (c.type === 'solitude') specs.set('solitude', () => chip(M.chip.solitude));
    else if (c.type === 'boxy') specs.set('boxy', () => chip(M.chip.boxy));
    else if (c.type === 'nonBoxy') specs.set('nonBoxy', () => chip(M.chip.nonBoxy));
    else if (c.type === 'inequality') specs.set('inequality', () => chip(M.chip.inequality));
    else if (c.type === 'difference') specs.set('difference', () => chip(M.chip.difference));
    else if (c.type === 'mingle') specs.set('mingle', () => chip(M.chip.mingle));
    else if (c.type === 'match') specs.set('match', () => chip(M.chip.match));
    else if (c.type === 'mismatch') specs.set('mismatch', () => chip(M.chip.mismatch));
    else if (c.type === 'palisade') specs.set('palisade', () => chip(M.chip.palisade));
    else if (c.type === 'bricky') specs.set('bricky', () => chip(M.chip.bricky));
    else if (c.type === 'loopy') specs.set('loopy', () => chip(M.chip.loopy));
    else if (c.type === 'watchtower') specs.set('watchtower', () => chip(M.chip.watchtower));
  }
  for (const k of ['areaNumber', 'range', 'shapeBank', 'rose', 'solitude', 'polyomino', 'boxy', 'nonBoxy', 'gemini', 'delta', 'inequality', 'difference', 'mingle', 'match', 'mismatch', 'palisade', 'watchtower', 'fenceShape', 'compass', 'bricky', 'loopy', 'sizeSeparation']) specs.get(k)?.();
  chip('?', [], 'info').setAttribute('aria-label', M.chip.open);
  goalArea.hidden = false;
  board.layout();
}

function openGoal(): void {
  if (!current) return;
  dismissCoach();
  goalDialog.showModal();
}

// -- first-visit note ------------------------------------------------------------

function coachSeen(): boolean {
  try {
    return localStorage.getItem('pbp:coach') === '1';
  } catch {
    return true;
  }
}

function showCoach(): void {
  coach.hidden = false;
}

function dismissCoach(): void {
  if (coach.hidden) return;
  coach.hidden = true;
  try {
    localStorage.setItem('pbp:coach', '1');
  } catch {
    /* ignore */
  }
}
$('coach-ok').addEventListener('click', dismissCoach);

function setStatus(text: string, cls = ''): void {
  statusEl.textContent = text;
  statusEl.className = cls;
}

function refreshStatus(): void {
  if (!current) return;
  const c = checkCompletion(current.engine, current.ps);
  board.setComplete(c.done && !board.reveal && !hypothesis);
  const wasDone = !doneEl.hidden;
  const showDone = c.done && !hypothesis;
  doneEl.hidden = !showDone;
  if (wasDone !== showDone) board.layout();
  if (c.done && current.presetKey && !board.reveal && !hypothesis) {
    if (completeLevel(progress, current.presetKey)) {
      saveLevelProgress(localStorage, progress);
      refreshCurrentPresetUi();
      // The picker is normally closed during play; only refresh it if visible.
      if (levelsDialog.open) renderLevelBrowser();
    }
  }
  $('done-new').textContent = current.presetKey
    ? presetText('下一关 →', 'Next level →', '다음 레벨 →')
    : M.newWindow;
  $('done-share').textContent = current.presetKey
    ? presetText('查看关卡地图', 'Browse levels', '레벨 선택')
    : M.share;
  // Completing every level in a chapter gets an unmistakable but compact reward.
  const chapterBanner = $('chapter-done');
  chapterBanner.hidden = true;
  if (c.done && current.presetKey && !hypothesis) {
    const entry = presetEntries.find((row) => row.key === current?.presetKey);
    if (entry) {
      const loc = levelLocation(entry);
      const chapter = levelZones.find((z) => z.key === loc.zone)
        ?.chapters.find((ch) => ch.key === `${loc.zone}/${loc.chapter}`);
      if (chapter?.levels.length && countComplete(chapter.levels) === chapter.levels.length) {
        chapterBanner.hidden = false;
        chapterBanner.textContent = presetText(
          '✦ 本章节全部通关！', '✦ Chapter complete!', '✦ 챕터 완료!',
        );
      }
    }
  }
  if (c.done) setStatus(hypothesis
    ? presetText('假设满足规则，可采纳结果', 'Hypothesis is valid · apply to save', '가설이 성립합니다 · 적용하여 저장')
    : M.complete, 'ok');
  else if (c.reason === 'dangling') setStatus(M.dangling);
  else if (c.reason === 'wrong') setStatus(M.wrong);
  else setStatus('');
}

function onChange(): void {
  if (!current) return;
  dismissCoach();
  if (board.reveal) hideSolution();
  resetHint();
  const v = errorMode.value === 'always' ? findViolations(current.puzzle, current.ps) : { cells: new Set<number>(), edges: new Set<number>() };
  board.errors = v.cells;
  board.errorEdges = v.edges;
  board.requestDraw();
  refreshStatus();
  updateButtons();
  if (!hypothesis) saveMarks();
}

function updateButtons(): void {
  for (const id of ['undo', 'redo', 'clear', 'undo-mobile', 'redo-mobile', 'reveal']) $<HTMLButtonElement>(id).disabled = !current;
  if (!current) return;
  $<HTMLButtonElement>('undo').disabled = !current.ps.canUndo;
  $<HTMLButtonElement>('redo').disabled = !current.ps.canRedo;
  $<HTMLButtonElement>('undo-mobile').disabled = !current.ps.canUndo;
  $<HTMLButtonElement>('redo-mobile').disabled = !current.ps.canRedo;
  $<HTMLButtonElement>('clear').disabled = current.ps.isEmpty();
  revealBtn.disabled = hypothesis !== null;
  $<HTMLButtonElement>('hypothesis').disabled = hypothesis !== null || board.reveal !== null;
}

// -- wiring --------------------------------------------------------------------------

const bankBox = form.querySelector<HTMLInputElement>('#rules input[value="shapeBank"]')!;
const roseBox = form.querySelector<HTMLInputElement>('#rules input[value="rose"]')!;
const syncRows = () => {
  $('rose-row').hidden = !roseBox.checked;
};
bankBox.addEventListener('change', syncRows);
roseBox.addEventListener('change', syncRows);
syncRows();

form.addEventListener('submit', (e) => {
  e.preventDefault();
  generateFromForm();
});

/** Build a window from the form, after the checks that need a word from the user. */
function generateFromForm(): void {
  const o = readOptions();
  if (!o.rules.length) {
    warn(M.warnNoRules);
    return;
  }
  const conflict = ruleConflict(o.rules);
  if (conflict) {
    warn({ 'gemini-sizeSeparation': M.warnGeminiSizeSep, 'rose-solitude': M.warnRoseSolitude, 'boxy-nonBoxy': M.warnBoxyNonBoxy, 'solitude-needs-symbols': M.warnSolitudeNeedsSymbols, 'boxy-needs-size': M.warnBoxyNeedsSize, 'gemini-mingle': M.warnGeminiMingle, 'match-mismatch': M.warnMatchMismatch, 'match-shapes': M.warnMatchShapes, 'mismatch-gemini': M.warnMismatchGemini, 'loopy-needs-size': M.warnLoopyNeedsSize }[conflict]);
    return;
  }
  if (settingsDialog.open) settingsDialog.close();
  startGenerate(o, true);
}

// The finished window offers the next one (same settings, fresh seed) and a share.
$('done-new').addEventListener('click', () => {
  if (current?.presetKey) {
    const index = presetEntries.findIndex((entry) => entry.key === current?.presetKey);
    if (index >= 0 && index + 1 < presetEntries.length) playPreset(index + 1);
    else openLevelBrowser();
    return;
  }
  $<HTMLInputElement>('seed').value = '';
  generateFromForm();
});
$('done-share').addEventListener('click', async () => {
  if (current?.presetKey) {
    openLevelBrowser();
    return;
  }
  const url = location.href;
  const btn = $<HTMLButtonElement>('done-share');
  try {
    if (navigator.share) {
      await navigator.share({ title: 'pane by pane', url });
      return;
    }
    await navigator.clipboard.writeText(url);
  } catch {
    return; // cancelled, or no clipboard: the address bar still has the link
  }
  const label = btn.textContent;
  btn.textContent = M.copied;
  setTimeout(() => (btn.textContent = label), 1500);
});

$('goal-close').addEventListener('click', () => goalDialog.close());
goalDialog.addEventListener('click', (e) => {
  if (e.target === goalDialog) goalDialog.close();
});
$('undo').addEventListener('click', () => {
  if (current?.ps.undo()) onChange();
});
$('redo').addEventListener('click', () => {
  if (current?.ps.redo()) onChange();
});
// A single undo/redo action path for desktop header and the fixed mobile toolbar.
$('undo-mobile').addEventListener('click', () => $<HTMLButtonElement>('undo').click());
$('redo-mobile').addEventListener('click', () => $<HTMLButtonElement>('redo').click());
$('clear').addEventListener('click', () => {
  if (!current) return;
  current.ps.clear();
  onChange();
  settingsDialog.close();
});
$('eraser').addEventListener('click', () => {
  board.eraser = !board.eraser;
  $('eraser').classList.toggle('active', board.eraser);
});

$('hypothesis').addEventListener('click', () => {
  if (!current || hypothesis || board.reveal) return;
  hypothesis = { key: current.key, checkpoint: current.ps.checkpoint() };
  resetHint();
  updateHypothesisUi();
  updateButtons();
  refreshStatus();
});
$('hypothesis-commit').addEventListener('click', () => {
  if (!current || !hypothesis || current.key !== hypothesis.key) return;
  current.ps.commitFrom(hypothesis.checkpoint);
  hypothesis = null;
  updateHypothesisUi();
  onChange(); // Only now do autosave and completion accounting.
});
$('hypothesis-discard').addEventListener('click', () => {
  if (!current || !hypothesis || current.key !== hypothesis.key) return;
  current.ps.rollbackTo(hypothesis.checkpoint);
  hypothesis = null;
  updateHypothesisUi();
  onChange();
});
$('check').addEventListener('click', () => {
  if (!current) return;
  const v = findViolations(current.puzzle, current.ps);
  board.errors = v.cells;
  board.errorEdges = v.edges;
  board.requestDraw();
  setStatus(M.checkResult(v.cells.size, v.edges.size));
});
errorMode.addEventListener('change', () => onChange());
// Hints come in stages: where to look → what follows and why → apply it.
const hintBtn = $<HTMLButtonElement>('hint');
function resetHint(): void {
  board.hint = null;
  board.hintStage = 1;
  hintBtn.textContent = M.hint;
}
hintBtn.addEventListener('click', () => {
  if (!current) return;
  const h = board.hint;
  if (h?.kind === 'step' && board.hintStage === 1) {
    board.hintStage = 2;
    board.requestDraw();
    setStatus(h.reason);
    hintBtn.textContent = M.hintApply;
    return;
  }
  if (h?.kind === 'step' && board.hintStage === 2) {
    const ps = current.ps;
    ps.beginChange();
    if (h.value === 'wall') ps.setEdge(h.edge, WALL);
    else {
      const g = ps.grid;
      const a = g.edgeA[h.edge];
      const b = g.edgeB[h.edge];
      const from = h.focus === a ? b : a;
      const id = ps.paint[from] || ps.newRegion(from);
      if (ps.paint[h.focus] !== id) ps.extend(h.focus, id);
    }
    onChange();
    return;
  }
  const next = nextHint(current.engine, current.ps, current.solution);
  if (!next) {
    resetHint();
    board.requestDraw();
    setStatus(checkCompletion(current.engine, current.ps).done ? M.hintDone : M.hintNone);
    return;
  }
  board.hint = next;
  board.hintStage = 1;
  board.requestDraw();
  if (next.kind === 'mistake') {
    setStatus(next.edge >= 0 ? M.mistakeWall : next.cells.length ? M.mistakeCells : M.mistakeOther);
    hintBtn.textContent = M.hint;
    return;
  }
  setStatus(next.where);
  hintBtn.textContent = M.hintMore;
});
function showSolution(): void {
  if (!current) return;
  board.reveal = solutionView(current.puzzle, current.solution);
  board.setComplete(false);
  resetHint();
  board.errors = new Set();
  board.errorEdges = new Set();
  board.requestDraw();
  revealBtn.textContent = M.hideSolution;
  for (const id of ['eraser', 'check', 'hint']) $<HTMLButtonElement>(id).disabled = true;
  setStatus(M.revealing);
}

function hideSolution(): void {
  board.reveal = null;
  revealBtn.textContent = M.reveal;
  for (const id of ['eraser', 'check', 'hint']) $<HTMLButtonElement>(id).disabled = false;
}

revealBtn.addEventListener('click', () => {
  if (!current) return;
  if (settingsDialog.open) settingsDialog.close();
  if (board.reveal) {
    hideSolution();
    onChange();
    return;
  }
  revealDialog.showModal();
});
$('reveal-cancel').addEventListener('click', () => revealDialog.close());
$('reveal-confirm').addEventListener('click', () => {
  revealDialog.close();
  showSolution();
});
revealDialog.addEventListener('click', (e) => {
  if (e.target === revealDialog) revealDialog.close();
});

document.addEventListener('keydown', (e) => {
  if (!current) return;
  if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
    e.preventDefault();
    if (e.shiftKey) {
      if (current.ps.redo()) onChange();
    } else if (current.ps.undo()) onChange();
  }
});

// Safari pinch-zoom gesture events and double-tap zoom anywhere on the page.
for (const t of ['gesturestart', 'gesturechange', 'gestureend']) document.addEventListener(t, (e) => e.preventDefault(), { passive: false });
document.addEventListener('dblclick', (e) => e.preventDefault(), { passive: false });

// -- Android hardware Back / modal navigation --------------------------------------------

/** Return true when an in-app back action was consumed. */
function navigateBack(): boolean {
  const dialogs = [...document.querySelectorAll<HTMLDialogElement>('dialog[open]')];
  // A warning can appear over Settings. The focused modal is the topmost one
  // even when its element occurs earlier in the document than Settings.
  const active = document.activeElement;
  const focusedDialog = dialogs.find((dialog) => active !== null && dialog.contains(active));
  const opened = focusedDialog ?? dialogs.at(-1) ?? null;
  const action = chooseBackAction(opened?.id ?? null, selectedChapter !== null, !coach.hidden);
  if (action === 'chapter') {
    selectedChapter = null;
    renderLevelBrowser();
  } else if (action === 'dialog') {
    opened?.close();
  } else if (action === 'coach') {
    dismissCoach();
  } else {
    return false;
  }
  return true;
}

// No native plugin is loaded in browsers; Capacitor injects its bridge in Android.
installAndroidBack(navigateBack, (window as Window & { Capacitor?: CapacitorBridge }).Capacitor);

// -- boot ---------------------------------------------------------------------------------

const fromHash = optionsFromHash();
const last = loadLast();
if (fromHash && last && last.hash === location.hash) {
  writeOptions(fromHash);
  loadPuzzle(...restoredPuzzleArgs(last));
  genStatus.textContent = `seed ${fromHash.seed}`;
} else if (fromHash) {
  writeOptions(fromHash);
  startGenerate(fromHash);
} else if (last) {
  history.replaceState(null, '', last.hash);
  const o = optionsFromHash();
  if (o) writeOptions(o);
  loadPuzzle(...restoredPuzzleArgs(last));
} else {
  // First launch opens the built-in level catalogue rather than generating a random puzzle.
  const intro: GenerateOptions = { width: 7, height: 7, rules: ['shapeBank'], minSize: 2, maxSize: 6, stars: [3, 4], seed: 125, mask: 'symmetric', walls: true, roseSymbols: 2, attempts: 300 };
  writeOptions(intro);
}
updateButtons();
void initPresets(!fromHash && !last);
