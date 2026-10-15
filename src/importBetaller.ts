import { canonical, type Pt } from './engine/shape.ts';
import type { Clue, Puzzle, EdgeRef } from './engine/types.ts';
import type { PresetLevel } from './presets.ts';

/**
 * Adapter for Betaller/SolverOfTheArtisanOfGlimmith JSON v1.0.
 * Deliberately strict: unknown clues/rules are rejected rather than silently discarded.
 * No third-party puzzle data is embedded in this file.
 */
type Obj = Record<string, unknown>;
const obj = (v: unknown): v is Obj => v !== null && typeof v === 'object' && !Array.isArray(v);
const int = (n: unknown): n is number => typeof n === 'number' && Number.isSafeInteger(n);
const need = (v: unknown, label: string): Obj => {
  if (!obj(v)) throw new Error(`${label} must be an object`);
  return v;
};
const num = (v: unknown, label: string): number => {
  if (!int(v)) throw new Error(`${label} must be an integer`);
  return v;
};
const points = (raw: unknown, label: string): Pt[] => {
  if (!Array.isArray(raw) || !raw.length || raw.length > 400) throw new Error(`Invalid ${label}`);
  return raw.map((p) => {
    if (!Array.isArray(p) || p.length !== 2 || !int(p[0]) || !int(p[1])) throw new Error(`Invalid point in ${label}`);
    return [p[1], p[0]] as const; // Betaller points are [row, col]; our keys use [x, y].
  });
};
const ruleNames = new Set([
  'shape_pool', 'rose_window', 'heterogeneous', 'homogeneous', 'precise',
  'puzzle_piece', 'mixed', 'area', 'same', 'range', 'fence', 'different',
  'solitary', 'block', 'non_block', 'differentiation', 'brick', 'ring',
  'inequality', 'difference', 'watchtower', 'compass',
]);
const globalClue: Record<string, Clue['type']> = {
  mixed: 'mingle', same: 'match', different: 'mismatch',
  solitary: 'solitude', block: 'boxy', non_block: 'nonBoxy',
  differentiation: 'sizeSeparation', brick: 'bricky', ring: 'loopy',
};

export function fromBetallerJSON(source: unknown, answer: unknown, name = 'puzzle'): PresetLevel {
  const data = need(source, 'puzzle');
  const grid = need(data.grid, 'grid');
  const w = num(grid.width, 'width'), h = num(grid.height, 'height');
  if (w < 2 || h < 2 || w > 20 || h > 20) throw new Error('Grid dimensions outside 2..20');
  const index = (r: unknown, c: unknown): number => {
    const row = num(r, 'row'), col = num(c, 'col');
    if (row < 0 || row >= h || col < 0 || col >= w) throw new Error(`Cell outside board: ${row},${col}`);
    return row * w + col;
  };
  if (!Array.isArray(data.cells) || !Array.isArray(data.rules) || !Array.isArray(data.edges)) {
    throw new Error('Missing cells, edges or rules');
  }
  const cellMap = new Map<number, Obj>();
  for (const v of data.cells) {
    const c = need(v, 'cell');
    const id = index(c.row, c.col);
    if (cellMap.has(id)) throw new Error('Duplicate cell coordinates');
    cellMap.set(id, c);
    for (const field of Object.keys(c)) {
      if (!['row', 'col', 'blocked', 'symbol', 'number', 'shape_pattern', 'fence_pattern', 'compass'].includes(field)) {
        throw new Error(`Unsupported cell field: ${field}`);
      }
    }
  }
  if (cellMap.size !== w * h) throw new Error('Puzzle is missing cell records');
  const holes: number[] = [];
  for (const [i, c] of cellMap) if (c.blocked === true) holes.push(i);
  const holeSet = new Set(holes);
  const active = (i: number) => !holeSet.has(i);
  const cellClues = new Set<number>();
  const mark = (i: number) => { if (!active(i)) throw new Error('Clue on blocked cell'); cellClues.add(i); };
  const clues: Clue[] = [];
  const seenRules = new Map<string, Obj>();
  for (const v of data.rules) {
    const rule = need(v, 'rule');
    if (typeof rule.type !== 'string' || !ruleNames.has(rule.type)) throw new Error(`Unknown rule: ${String(rule.type)}`);
    if (seenRules.has(rule.type)) throw new Error(`Duplicate rule: ${rule.type}`);
    seenRules.set(rule.type, rule);
    if (globalClue[rule.type]) clues.push({ type: globalClue[rule.type] } as Clue);
    else if (rule.type === 'range') {
      const p = need(rule.params, 'range params');
      const range: Extract<Clue, {type:'range'}> = { type: 'range' };
      if (p.min !== undefined && p.min !== null) range.min = num(p.min, 'range min');
      if (p.max !== undefined && p.max !== null) range.max = num(p.max, 'range max');
      if (range.min === undefined && range.max === undefined) throw new Error('Empty range');
      clues.push(range);
    } else if (rule.type === 'precise') {
      const a = num(need(rule.params, 'precise params').area, 'precise area');
      clues.push({ type: 'range', min: a, max: a });
    } else if (rule.type === 'shape_pool') {
      const raw = obj(rule.params) && Array.isArray(rule.params.shapes) ? rule.params.shapes : data.shape_pool;
      if (!Array.isArray(raw) || raw.length === 0) throw new Error('Empty shape pool');
      clues.push({ type: 'shapeBank', shapes: raw.map((p, i) => canonical(points(p, `pool ${i}`))) });
    }
  }
  const roseRule = seenRules.get('rose_window');
  const roseParams = roseRule && need(roseRule.params, 'rose window params');
  const roseNames = roseParams?.symbol_types;
  const roseTypes = Array.isArray(roseNames) ? roseNames.map(String) : [];
  if (roseRule && !roseTypes.length) throw new Error('Rose symbols unspecified');
  if (roseTypes.length > 6 || new Set(roseTypes).size !== roseTypes.length) throw new Error('Invalid rose symbol types');
  const roseSymbols: { cell: number; symbol: number }[] = [];
  for (const [id, c] of cellMap) {
    if (c.blocked === true) continue;
    if (c.number !== undefined && c.number !== null) {
      if (!seenRules.has('area')) throw new Error('Number clue without area rule');
      mark(id);
      clues.push({ type: 'areaNumber', cell: id, value: num(c.number, 'number') });
    }
    if (c.shape_pattern !== undefined && c.shape_pattern !== null) {
      if (!seenRules.has('puzzle_piece')) throw new Error('Shape clue without puzzle_piece rule');
      mark(id);
      clues.push({ type: 'polyomino', cell: id, shape: canonical(points(c.shape_pattern, 'shape_pattern')) });
    }
    if (c.symbol !== undefined && c.symbol !== null) {
      if (!roseRule) throw new Error('Symbol without rose_window rule');
      const symbol = roseTypes.indexOf(String(c.symbol));
      if (symbol < 0) throw new Error(`Unknown rose symbol: ${c.symbol}`);
      mark(id);
      roseSymbols.push({ cell: id, symbol });
    }
    if (c.fence_pattern !== undefined && c.fence_pattern !== null) {
      if (!seenRules.has('fence')) throw new Error('Fence clue without fence rule');
      mark(id);
      const pattern = points(c.fence_pattern, 'fence_pattern');
      const keys = new Set(pattern.map(([x, y]) => `${x},${y}`));
      if (!keys.has('1,1') || [...keys].some((k) => !['1,1','1,0','2,1','1,2','0,1'].includes(k))) {
        throw new Error('Invalid cross-shaped fence_pattern');
      }
      const sides = (keys.has('1,0') ? 1 : 0) |
        (keys.has('2,1') ? 2 : 0) |
        (keys.has('1,2') ? 4 : 0) |
        (keys.has('0,1') ? 8 : 0);
      clues.push({ type: 'fenceShape', cell: id, sides });
    }
    if (c.compass !== undefined && c.compass !== null) {
      if (!seenRules.has('compass')) throw new Error('Compass clue without compass rule');
      mark(id);
      const values = need(c.compass, 'compass');
      clues.push({
        type: 'compass', cell: id, up: num(values.up, 'compass up'),
        down: num(values.down, 'compass down'), left: num(values.left, 'compass left'),
        right: num(values.right, 'compass right'),
      });
    }
  }
  if (roseRule) {
    clues.push({ type: 'rose', symbolCount: roseTypes.length, symbols: roseSymbols });
  }
  const walls: EdgeRef[] = [];
  const wallKeys = new Set<string>();
  const edgeRef = (e: Obj): EdgeRef => {
    const a = index(e.r1, e.c1), b = index(e.r2, e.c2);
    if (Math.abs((a % w) - (b % w)) + Math.abs(Math.floor(a / w) - Math.floor(b / w)) !== 1) {
      throw new Error('Non-adjacent edge');
    }
    if (!active(a) || !active(b)) throw new Error('Edge touches blocked cell');
    return { a, b };
  };
  for (const v of data.edges) {
    const e = need(v, 'edge');
    const edge = edgeRef(e);
    const key = [edge.a, edge.b].sort((a, b) => a - b).join(':');
    if (e.is_boundary === true && e.constraint === undefined && !wallKeys.has(key)) {
      walls.push(edge);
      wallKeys.add(key);
    }
    if (e.constraint !== undefined && e.constraint !== null) {
      const mark = need(e.constraint, 'edge constraint');
      if (typeof mark.type !== 'string' || !seenRules.has(mark.type)) throw new Error('Edge clue missing corresponding rule');
      if (mark.type === 'homogeneous') clues.push({ type: 'gemini', edge });
      else if (mark.type === 'heterogeneous') clues.push({ type: 'delta', edge });
      else if (mark.type === 'difference') clues.push({ type: 'difference', edge, value: num(mark.value, 'difference') });
      else if (mark.type === 'inequality') {
        if (mark.value !== undefined && mark.value !== null && mark.value !== 0 && mark.value !== 1) {
          throw new Error('Unknown inequality orientation');
        }
        clues.push({ type: 'inequality', edge, larger: mark.value === 1 ? 'a' : 'b' });
      } else throw new Error(`Unsupported edge constraint: ${mark.type}`);
    }
  }
  if (data.vertices !== undefined) {
    if (!Array.isArray(data.vertices)) throw new Error('Bad vertices');
    for (const item of data.vertices) {
      const v = need(item, 'vertex');
      if (v.watchtower !== undefined && v.watchtower !== null) {
        if (!seenRules.has('watchtower')) throw new Error('Watchtower without rule');
        const x = num(v.col, 'vertex col'), y = num(v.row, 'vertex row');
        clues.push({ type: 'watchtower', x, y, count: num(v.watchtower, 'watchtower') });
      }
    }
  }
  const puzzle: Puzzle = { width: w, height: h, clues };
  if (holes.length) puzzle.holes = holes.sort((a, b) => a - b);
  if (walls.length) puzzle.walls = walls;

  const ans = need(answer, 'answer');
  if (!Array.isArray(ans.regions) || !obj(ans.grid) ||
      ans.grid.width !== w || ans.grid.height !== h) throw new Error('Missing or mismatched answer regions');
  const solution = new Array<number>(w * h).fill(-1);
  for (const [i, region] of ans.regions.entries()) {
    if (!Array.isArray(region) || !region.length) throw new Error('Empty answer region');
    for (const pos of region) {
      if (!Array.isArray(pos) || pos.length !== 2) throw new Error('Invalid answer cell');
      const c = index(pos[0], pos[1]);
      if (!active(c) || solution[c] >= 0) throw new Error('Overlapping / blocked answer region');
      solution[c] = i;
    }
  }
  if ([...cellMap.keys()].some((i) => active(i) && solution[i] < 0)) throw new Error('Answer has uncovered cells');
  const meta = obj(data._meta) ? data._meta : {};
  const id = String(meta.archive_id ?? name).slice(0, 80);
  const category = String(meta.archive_type ?? '').slice(0, 80);
  const score = int(meta.archive_difficulty) ? meta.archive_difficulty : 0;
  return {
    id: name,
    title: `#${id}${category ? ' · ' + category : ''}`,
    chapter: name.split('/').slice(0, -1).join(' / '),
    source: 'Betaller/SolverOfTheArtisanOfGlimmith · user-supplied',
    stars: Math.max(0, Math.min(7, score)),
    difficulty: score,
    puzzle, solution,
  };
}
