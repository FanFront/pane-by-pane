import type { Puzzle, RuleKind } from '../engine/types.ts';
import type { Lang } from './i18n.ts';
import { GUIDE } from './beginnerTips.ts';
import { EXTRA_TIPS, GROUPS, ORIGINAL_METADATA, TOOL_LABELS, type TipGroup, type TipCopy } from './tipCatalog.ts';
import { SCENES, type LessonId, type Scene } from './tipScenes.ts';

type Lesson = { id: LessonId; group: TipGroup; rules: readonly RuleKind[]; copy: TipCopy };
type Mode = 'all' | 'relevant';
type GroupFilter = 'all' | TipGroup;

export function allLessons(language: Lang): Lesson[] {
  const old: Lesson[] = GUIDE[language].tips.map(tip => {
    const meta = ORIGINAL_METADATA[tip.id];
    return { id: tip.id, group: meta.group, rules: meta.rules, copy: tip };
  });
  const next: Lesson[] = EXTRA_TIPS.map(tip => ({
    id: tip.id, group: tip.group, rules: tip.rules, copy: tip.copy[language],
  }));
  const rank: Record<TipGroup, number> = { basics: 0, rules: 1, advanced: 2 };
  return [...old, ...next].sort((a,b) => rank[a.group] - rank[b.group]);
}

function relevant(tip: Lesson, puzzle: Puzzle): boolean {
  const kinds = new Set<RuleKind>(puzzle.clues.map(c => c.type));
  if (tip.id === 'parityFence') return kinds.has('loopy') && kinds.has('fenceShape');
  // Only a global exact-area clue makes the division argument unconditional.
  if (tip.id === 'areaRemainder') return puzzle.clues.some(c => c.type === 'range' && c.min !== undefined && c.min === c.max);
  return tip.rules.some(rule => kinds.has(rule));
}

export function levelTipIds(puzzle: Puzzle): LessonId[] {
  return allLessons('zh').filter(tip => relevant(tip,puzzle)).map(tip => tip.id);
}

function elt<K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', value = ''): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (value) node.textContent = value;
  return node;
}

function section(title: string, content: string, cls: string): HTMLElement {
  const p = elt('p', cls);
  p.append(elt('strong', '', title + '：'), document.createTextNode(content));
  return p;
}

function figure(scene: Scene, accessibleLabel: string): HTMLElement {
  const fig = elt('figure','tip-example');
  fig.setAttribute('aria-label', accessibleLabel);
  const board = elt('div', 'tip-board');
  const rows = scene.grid, height = rows.length, width = rows[0].length;
  board.style.gridTemplateColumns = 'repeat(' + width + ', minmax(0, 34px))';
  board.style.position = 'relative';
  board.setAttribute('role', 'img');
  board.setAttribute('aria-label', accessibleLabel);
  const walls = new Set(scene.walls ?? []), opens = new Set(scene.open ?? []), focus = new Set(scene.focus ?? []);
  for (let row = 0; row < height; row++) for (let col = 0; col < width; col++) {
    const char = rows[row][col], cell = elt('span','tip-cell');
    cell.textContent = char === '.' ? '' : char === '#' ? '×' : char;
    if (char === '.' || char === '#') cell.classList.add('tip-cell-blank');
    else if (/[01ABCD]/.test(char) && char.length === 1) cell.classList.add('tip-cell-' + char);
    else cell.classList.add('tip-cell-symbol');
    if (char === '#') cell.classList.add('tip-cell-blocked');
    if (focus.has(row + ',' + col)) cell.classList.add('tip-cell-focus');
    if (walls.has(row + ',' + col + ',R')) cell.classList.add('tip-wall-right');
    if (walls.has(row + ',' + col + ',D')) cell.classList.add('tip-wall-bottom');
    if (opens.has(row + ',' + col + ',R')) cell.classList.add('tip-open-right');
    if (opens.has(row + ',' + col + ',D')) cell.classList.add('tip-open-bottom');
    board.append(cell);
  }
  if (scene.vertex) board.append(elt('span','tip-vertex-clue', scene.vertex));
  if (scene.invalid) board.append(elt('span', 'tip-invalid-stamp','×'));
  fig.append(board);
  return fig;
}

const LINKS = [
  ['塞德莎 · 常用技巧', 'https://www.bilibili.com/video/BV1XAdJB7EgR/'],
  ['塞德莎 · 环纹奇偶染色', 'https://www.bilibili.com/video/BV1CrQUBgECk/'],
  ['塞德莎 · 围栏专题', 'https://www.bilibili.com/video/BV1zWdSBLEqo/'],
  ['Steam · Loopy / Bricky 讨论', 'https://steamcommunity.com/app/4160210/discussions/0/796716542888934780/'],
] as const;

export function renderTipGallery(container: HTMLElement, language: Lang, puzzle?: Puzzle): void {
  const ui = TOOL_LABELS[language];
  const groups = GROUPS[language];
  const lessons = allLessons(language);
  let mode: Mode = puzzle ? 'relevant' : 'all';
  let filter: GroupFilter = 'all';
  const states = new Map<LessonId, number>();
  container.replaceChildren();

  container.append(
    elt('p', 'muted', GUIDE[language].intro),
    elt('p', 'tip-guidance', ui.note),
    elt('p', 'tip-legend', language === 'zh'
      ? '图例：深色实线＝边界｜绿色虚线＝确定连通｜橙框＝关注位置｜红叉＝矛盾'
      : language === 'ko'
        ? '범례: 진한 실선=경계｜초록 점선=연결｜주황 테두리=주목｜빨간 X=모순'
        : 'Legend: dark line = border | green dash = join | orange = focus | red X = contradiction'),
  );

  const bar = elt('div','tip-filter-bar');
  const modes = elt('div','tip-filter-row');
  const categories = elt('div','tip-filter-row tip-categories');
  const collection = elt('div','tip-lessons');
  const counter = elt('p','small muted');
  bar.append(modes, categories);
  container.append(bar, counter, collection);

  function button(label: string, chosen: boolean, click: () => void, disabled = false): HTMLButtonElement {
    const b = elt('button', 'tip-filter' + (chosen ? ' is-active' : ''), label);
    b.type = 'button';
    b.setAttribute('aria-pressed', String(chosen));
    b.disabled = disabled;
    b.addEventListener('click', click);
    return b;
  }

  function lessonCard(lesson: Lesson): HTMLElement {
    const { title, idea, premise, deduction, warning } = lesson.copy;
    const details = elt('details','tip-card');
    const summary = elt('summary', '', title);
    details.append(summary);
    const content = elt('div','tip-content');
    const intro = elt('p','',idea);
    const exampleArea = elt('div','tip-step-area');
    const explanation = elt('p','tip-step-explanation');
    explanation.setAttribute('aria-live','polite');
    const controls = elt('div','tip-step-controls');
    const prev = elt('button','','');
    const next = elt('button','','');
    prev.type = 'button';
    next.type = 'button';
    const number = elt('span','tip-step-count');
    prev.addEventListener('click', () => { states.set(lesson.id, Math.max(0,(states.get(lesson.id) || 0)-1)); update(); });
    next.addEventListener('click', () => { states.set(lesson.id, Math.min(2,(states.get(lesson.id) || 0)+1)); update(); });
    controls.append(prev, number, next);

    function update(): void {
      const stage = states.get(lesson.id) || 0;
      const captions = [idea, premise, deduction];
      exampleArea.replaceChildren(figure(SCENES[lesson.id][stage], title + ' — ' + (stage+1) + '/3'));
      explanation.textContent = captions[stage];
      prev.textContent = ui.previous;
      next.textContent = ui.next;
      number.textContent = ui.step + ' ' + (stage + 1) + ' / 3';
      prev.disabled = stage === 0;
      next.disabled = stage === 2;
    }

    content.append(intro, exampleArea, explanation, controls,
      section(GUIDE[language].premise, premise, 'tip-condition'),
      section(GUIDE[language].deduction, deduction, 'tip-deduction'),
      section(GUIDE[language].warning, warning, 'tip-warning'));
    details.append(content);
    update();
    return details;
  }

  function repaint(): void {
    modes.replaceChildren(
      button(ui.all,mode === 'all',()=> { mode = 'all'; repaint(); }),
      button(ui.relevant,mode === 'relevant',()=> { mode = 'relevant'; repaint(); },!puzzle),
    );
    categories.replaceChildren(
      button(ui.all,filter === 'all',()=> { filter = 'all'; repaint(); }),
      ...(['basics','rules','advanced'] as TipGroup[]).map(group =>
        button(groups[group],filter === group,()=> { filter = group; repaint(); })),
    );
    const relevantIds = new Set(puzzle ? levelTipIds(puzzle) : []);
    const chosen = lessons.filter(tip => (filter === 'all' || tip.group === filter) &&
      (mode === 'all' || relevantIds.has(tip.id)));
    counter.textContent = language === 'zh' ? '共 ' + chosen.length + ' 项 · 点击标题展开 · 逐步查看示意' :
      language === 'ko' ? chosen.length + '개 · 제목을 눌러 펼친 뒤 단계별로 보기' :
      chosen.length + ' techniques · Open a title and advance step by step';
    collection.replaceChildren(...chosen.map(lessonCard));
    if (!chosen.length) collection.append(elt('p','muted',ui.empty));
  }
  repaint();

  const sources = elt('div', 'tip-sources');
  sources.append(elt('strong','',GUIDE[language].sources));
  for (const [name, url] of LINKS) {
    const a = elt('a','',name);
    a.href = url; a.target = '_blank'; a.rel = 'noopener noreferrer';
    sources.append(a);
  }
  container.append(sources);
}
