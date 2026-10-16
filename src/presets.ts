import { createEngine, verify } from './engine/engine.ts';
import { RULE_KINDS, type Puzzle } from './engine/types.ts';

/** A local puzzle pack. Game-generated levels and personal exports share this schema. */
export interface PresetLevel {
  id: string;
  title: string;
  chapter?: string;
  source?: string;
  puzzle: Puzzle;
  solution: number[];
  stars: number;
  difficulty: number;
}

export interface PresetPack {
  version: 1;
  name: string;
  levels: PresetLevel[];
}

const record = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);
const integer = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v);
const requiredString = (v: unknown, field: string): string => {
  if (typeof v !== 'string' || !v.trim() || v.length > 160) throw new Error(`invalid ${field}`);
  return v.trim();
};

/** Validates untrusted imported data before handing it to the engine or saving it. */
export function parsePresetPack(data: unknown, fallbackName = '个人关卡'): PresetPack {
  let rows: unknown[];
  let name = fallbackName;
  if (Array.isArray(data)) {
    // Also accept the array written by `node src/cli.ts gen --json out.json`.
    rows = data;
  } else if (record(data) && data.version === 1 && Array.isArray(data.levels)) {
    rows = data.levels;
    name = requiredString(data.name, 'pack name');
  } else if (record(data) && record(data.puzzle)) {
    rows = [data];
  } else {
    throw new Error('Expected {version:1,name,levels:[...]} or an array of generated puzzles');
  }
  if (rows.length > 3000) throw new Error('Too many puzzles (max 3000 per pack)');

  const ids = new Set<string>();
  const levels = rows.map((raw, i): PresetLevel => {
    if (!record(raw) || !record(raw.puzzle) || !Array.isArray(raw.solution)) {
      throw new Error(`Level ${i + 1}: puzzle and solution are required`);
    }
    const p = raw.puzzle;
    if (!integer(p.width) || !integer(p.height) || p.width < 2 || p.height < 2 ||
        p.width > 20 || p.height > 20 || !Array.isArray(p.clues)) {
      throw new Error(`Level ${i + 1}: invalid board dimensions or clues`);
    }
    const width = p.width;
    const cellCount = p.width * p.height;
    if (p.clues.length > 600 || p.clues.some((c) => !record(c) || !RULE_KINDS.includes(c.type as never))) {
      throw new Error(`Level ${i + 1}: unknown clue kind`);
    }
    if (p.holes !== undefined && (!Array.isArray(p.holes) ||
        p.holes.some((n) => !integer(n) || n < 0 || n >= cellCount))) {
      throw new Error(`Level ${i + 1}: invalid holes`);
    }
    if (p.walls !== undefined && (!Array.isArray(p.walls) ||
        p.walls.some((edge) => !record(edge) || !integer(edge.a) || !integer(edge.b) ||
            Math.abs((edge.a % width) - (edge.b % width)) +
              Math.abs(Math.floor(edge.a / width) - Math.floor(edge.b / width)) !== 1))) {
      throw new Error(`Level ${i + 1}: invalid walls`);
    }
    const id = requiredString(raw.id ?? `local-${i + 1}`, `level ${i + 1} ID`);
    if (ids.has(id)) throw new Error(`Duplicate puzzle ID: ${id}`);
    ids.add(id);
    const solution = raw.solution;
    if (solution.length !== cellCount || solution.some((n) => !integer(n) || n < -1 || n > 399)) {
      throw new Error(`Level ${id}: invalid solution labels`);
    }
    const puzzle = p as unknown as Puzzle;
    try {
      if (!verify(createEngine(puzzle), Int32Array.from(solution))) {
        throw new Error('solution does not satisfy board rules');
      }
    } catch (err) {
      throw new Error(`Level ${id}: ${err instanceof Error ? err.message : String(err)}`);
    }
    const stars = raw.stars === undefined ? 0 : Number(raw.stars);
    const difficulty = raw.difficulty === undefined ? 0 : Number(raw.difficulty);
    if (!integer(stars) || stars < 0 ||
        !Number.isFinite(difficulty) || difficulty < 0) {
      throw new Error(`Level ${id}: invalid difficulty`);
    }
    return {
      id,
      title: requiredString(raw.title ?? `#${id}`, `level ${id} title`),
      ...(typeof raw.chapter === 'string' && raw.chapter.trim() ? { chapter: raw.chapter.trim().slice(0, 100) } : {}),
      ...(typeof raw.source === 'string' && raw.source.trim() ? { source: raw.source.trim().slice(0, 160) } : {}),
      puzzle,
      solution: solution as number[],
      stars,
      difficulty,
    };
  });
  return { version: 1, name, levels };
}
