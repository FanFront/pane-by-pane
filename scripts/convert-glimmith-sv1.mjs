#!/usr/bin/env node
/**
 * Convert SV1 text exported from a personally owned copy of The Artisan of
 * Glimmith into pane-by-pane's level-pack JSON. No original game data shipped.
 *
 * SV1 contains cell/edge clues and the answer boundaries, but not the global
 * rules shown in the original UI. Supply those via --meta when required.
 *
 * Usage:
 * node scripts/convert-glimmith-sv1.mjs --input ./my-exports --output ./public/presets/glimmith.json --meta ./my-metadata.json
 */
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { basename, extname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parsePresetPack } from '../src/presets.ts';

const EDGE_TYPES = new Set(['=', '!', '<', '>']);
const GLOBAL_RULES = new Set([
  'sizeSeparation', 'solitude', 'boxy', 'nonBoxy', 'mingle', 'match',
  'mismatch', 'bricky', 'loopy',
]);

const isInteger = (n) => Number.isSafeInteger(n);
const coord = (r, c, w) => r * w + c;
const edgeKey = (a, b) => (a < b ? `${a}:${b}` : `${b}:${a}`);

/** Maps a horizontal/vertical SV1 grid edge to its two neighbouring cells. */
function internalEdge(dir, row, col, w, h) {
  if (!isInteger(row) || !isInteger(col)) throw new Error('Non-integer edge coordinate');
  if (dir === 'h' && row > 0 && row < h && col >= 0 && col < w) {
    return [coord(row - 1, col, w), coord(row, col, w)];
  }
  if (dir === 'v' && col > 0 && col < w && row >= 0 && row < h) {
    return [coord(row, col - 1, w), coord(row, col, w)];
  }
  if (dir === 'h' && row >= 0 && row <= h && col >= 0 && col < w) return null;
  if (dir === 'v' && col >= 0 && col <= w && row >= 0 && row < h) return null;
  throw new Error(`Out-of-range edge ${dir} ${row} ${col}`);
}

/** Parse just the structured SV1 model; never guess missing original rule types. */
export function convertSV1(source, options = {}) {
  const lines = source.replace(/\r/g, '').split('\n').map((s) => s.trim()).filter(Boolean);
  if (lines[0] !== 'SV1') throw new Error('Expected SV1 export (not raw SaveToString)');
  const header = {}, cells = [], active = new Set(), solutionEdges = new Set();
  const initEdges = new Set(), eclues = [], vclues = [], unsupported = [];
  for (const line of lines.slice(1)) {
    const [kind, ...parts] = line.split(/\s+/);
    const n = (i) => Number(parts[i]);
    if (kind === 'W' || kind === 'H' || kind === 'DIFF') {
      header[kind] = n(0);
    } else if (kind === 'ID') {
      header.ID = parts[0];
    } else if (kind === 'CELL') {
      cells.push({ row: n(0), col: n(1), type: parts[2], text: parts.slice(3).join('') });
    } else if (kind === 'EMPTY') {
      cells.push({ row: n(0), col: n(1), type: 'empty', text: '' });
    } else if (kind === 'COMPASS') {
      // There is no compass rule in the pane-by-pane engine.
      unsupported.push(line);
    } else if (kind === 'SEDGE' || kind === 'IEDGE') {
      const item = [parts[0], n(1), n(2)];
      (kind === 'SEDGE' ? solutionEdges : initEdges).add(item.join(':'));
    } else if (kind === 'ECLUE') {
      eclues.push({ dir: parts[0], row: n(1), col: n(2), sym: parts[3] });
    } else if (kind === 'VCLUE') {
      vclues.push({ x: n(0), y: n(1), sym: parts[2] });
    } else {
      unsupported.push(line);
    }
  }

  const w = header.W, h = header.H;
  if (!isInteger(w) || !isInteger(h) || w < 2 || h < 2 || w > 20 || h > 20) {
    throw new Error('Invalid SV1 board size');
  }
  const id = String(options.id ?? header.ID ?? '?');
  const cell = (r, c) => {
    if (!isInteger(r) || !isInteger(c) || r < 0 || c < 0 || r >= h || c >= w) {
      throw new Error(`Out-of-range cell ${r},${c}`);
    }
    return coord(r, c, w);
  };
  const clues = [];
  for (const item of cells) {
    const c = cell(item.row, item.col);
    if (active.has(c)) throw new Error(`Duplicate SV1 cell ${c}`);
    active.add(c);
    if (item.type === 'number' && /^\d+$/.test(item.text)) {
      clues.push({ type: 'areaNumber', cell: c, value: Number(item.text) });
    } else if (item.type === 'empty' || item.type === 'region') {
      // P1–P5 region labels are not playable clues.
    } else {
      // Unknown cell symbols, shapes and compass data must not be silently dropped.
      unsupported.push(`CELL ${item.row} ${item.col} ${item.type} ${item.text}`);
    }
  }
  if (active.size === 0) throw new Error('SV1 has no active cells');
  const holes = [];
  for (let c = 0; c < w * h; c++) if (!active.has(c)) holes.push(c);

  const boundaries = new Set();
  const walls = [];
  const sv1Edge = (spec) => {
    const [d, rs, cs] = spec.split(':');
    return internalEdge(d, Number(rs), Number(cs), w, h);
  };
  for (const spec of solutionEdges) {
    const e = sv1Edge(spec);
    if (e) {
      if (!active.has(e[0]) || !active.has(e[1])) throw new Error('Answer edge crosses a hole');
      boundaries.add(edgeKey(...e));
    }
  }
  for (const spec of initEdges) {
    const e = sv1Edge(spec);
    if (e) {
      if (!boundaries.has(edgeKey(...e))) throw new Error('Fixed wall not in solution');
      walls.push({ a: e[0], b: e[1] });
    }
  }
  for (const e of eclues) {
    const pair = internalEdge(e.dir, e.row, e.col, w, h);
    if (!pair || !active.has(pair[0]) || !active.has(pair[1])) throw new Error('Clue on a boundary or hole');
    const edge = { a: pair[0], b: pair[1] };
    if (e.sym === '=') clues.push({ type: 'gemini', edge });
    else if (e.sym === '!') clues.push({ type: 'delta', edge });
    else if (e.sym === '<' || e.sym === '>') clues.push({
      type: 'inequality', edge, larger: e.sym === '>' ? 'a' : 'b',
    });
    else if (/^\d+$/.test(e.sym)) clues.push({ type: 'difference', edge, value: Number(e.sym) });
    else unsupported.push(`ECLUE ${e.dir} ${e.row} ${e.col} ${e.sym}`);
  }
  for (const v of vclues) {
    if (/^\d+$/.test(v.sym)) clues.push({ type: 'watchtower', x: v.x, y: v.y, count: Number(v.sym) });
    else unsupported.push(`VCLUE ${v.x} ${v.y} ${v.sym}`);
  }
  if (unsupported.length) {
    throw new Error(`Unsupported SV1 clues (needs manual mapping): ${unsupported.slice(0, 3).join('; ')}${unsupported.length > 3 ? ' ...' : ''}`);
  }

  // Metadata adds global rules and parameters that SV1 does not encode.
  if (options.clues !== undefined) {
    if (!Array.isArray(options.clues)) throw new Error('metadata.clues must be an array');
    clues.push(...options.clues);
  }
  if (options.rules) for (const rule of options.rules) {
    if (!GLOBAL_RULES.has(rule)) throw new Error(`Unsupported global rule: ${rule}`);
    clues.push({ type: rule });
  }
  const parent = Array.from({ length: w * h }, (_, i) => i);
  const find = (i) => {
    while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; }
    return i;
  };
  for (const c of active) {
    const x = c % w, y = Math.floor(c / w);
    for (const adjacent of [x + 1 < w ? c + 1 : -1, y + 1 < h ? c + w : -1]) {
      if (adjacent < 0 || !active.has(adjacent) || boundaries.has(edgeKey(c, adjacent))) continue;
      parent[find(c)] = find(adjacent);
    }
  }
  const names = new Map();
  const solution = Array.from({ length: w * h }, (_, i) => {
    if (!active.has(i)) return -1;
    const root = find(i);
    if (!names.has(root)) names.set(root, names.size);
    return names.get(root);
  });
  const puzzle = { width: w, height: h, clues };
  if (holes.length) puzzle.holes = holes;
  if (walls.length) puzzle.walls = walls;
  return {
    id, title: options.title ?? `Glimmith #${id}`,
    ...(options.chapter ? { chapter: options.chapter } : {}),
    source: 'local SV1 export (user provided)',
    stars: options.stars ?? Math.max(0, Math.min(7, header.DIFF ?? 0)),
    difficulty: options.difficulty ?? 0,
    puzzle,
    solution,
  };
}

function args(argv) {
  const o = {};
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith('--')) throw new Error(`Unexpected argument: ${argv[i]}`);
    const key = argv[i].slice(2);
    const value = argv[++i];
    if (!value || value.startsWith('--')) throw new Error(`Missing value for --${key}`);
    o[key] = value;
  }
  return o;
}

export function convertDirectory(input, output, metaPath) {
  const root = resolve(input);
  const paths = statSync(root).isDirectory()
    ? readdirSync(root).filter((name) => ['.sv1', '.txt'].includes(extname(name).toLowerCase())).sort().map((name) => join(root, name))
    : [root];
  const metadata = metaPath ? JSON.parse(readFileSync(resolve(metaPath), 'utf8')) : {};
  const levels = [], failures = [];
  for (const file of paths) {
    const text = readFileSync(file, 'utf8');
    const records = text.split(/(?=^SV1\s*$)/m).filter((s) => s.trim());
    for (const [index, record] of records.entries()) {
      const id = record.match(/^ID\s+(\S+)/m)?.[1] ?? `${basename(file)}-${index + 1}`;
      try {
        const extra = metadata[id] ?? {};
        levels.push(convertSV1(record, { id, ...extra }));
      } catch (err) {
        failures.push(`${basename(file)} [${id}]: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }
  const pack = parsePresetPack({ version: 1, name: '私人导入 · Glimmith 关卡', levels });
  writeFileSync(resolve(output), JSON.stringify(pack, null, 2) + '\n');
  return { converted: levels.length, skipped: failures.length, failures };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const o = args(process.argv.slice(2));
    if (!o.input || !o.output) throw new Error('Usage: --input <SV1 file or folder> --output <JSON file> [--meta metadata.json]');
    const report = convertDirectory(o.input, o.output, o.meta);
    console.log(`Converted ${report.converted}; skipped ${report.skipped}; output: ${o.output}`);
    for (const failure of report.failures.slice(0, 30)) console.error('SKIP', failure);
    if (report.failures.length > 30) console.error(`... ${report.failures.length - 30} more skips`);
    if (!report.converted) process.exitCode = 1;
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    process.exitCode = 1;
  }
}
