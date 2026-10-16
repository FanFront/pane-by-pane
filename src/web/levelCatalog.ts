import type { PresetLevel } from '../presets.ts';

export interface LevelEntry {
  key: string;
  label: string;
  level: PresetLevel;
  packName: string;
}

export interface LevelChapter {
  key: string;
  name: string;
  levels: LevelEntry[];
}

export interface LevelZone {
  key: string;
  name: string;
  chapters: LevelChapter[];
  count: number;
}

/** Folder path from Betaller: Zone1 / 1-single-shape / 0008.json. */
export function levelLocation(entry: LevelEntry): { zone: string; chapter: string } {
  const path = entry.level.id.replaceAll(' / ', '/');
  const match = /^(Zone[123])\/([^/]+)\/[^/]+$/i.exec(path);
  if (entry.key.startsWith('betaller:') && match) {
    return { zone: match[1].replace(/zone/i, 'Zone'), chapter: match[2] };
  }
  // Imported packs and handcrafted examples also get a browsable home.
  return {
    zone: `custom:${entry.key.split(':')[0]}`,
    chapter: entry.level.chapter || entry.packName,
  };
}

const chapterNumber = (name: string) => {
  const m = /^(\d+)[-_]/.exec(name);
  return m ? Number(m[1]) : Number.MAX_SAFE_INTEGER;
};

export function compareChapters(a: string, b: string): number {
  return chapterNumber(a) - chapterNumber(b) ||
    a.localeCompare(b, 'en', { numeric: true, sensitivity: 'base' });
}

/** Chapters remain numbered 1..10; levels within each chapter go from easiest to hardest. */
export function organizeLevels(entries: readonly LevelEntry[]): LevelZone[] {
  const zones = new Map<string, {name: string; chapters: Map<string, LevelEntry[]>}>();
  for (const entry of entries) {
    const { zone, chapter } = levelLocation(entry);
    let group = zones.get(zone);
    if (!group) {
      group = { name: zone.startsWith('custom:') ? entry.packName : zone.replace('Zone', 'Zone '), chapters: new Map() };
      zones.set(zone, group);
    }
    const rows = group.chapters.get(chapter) ?? [];
    rows.push(entry);
    group.chapters.set(chapter, rows);
  }
  return [...zones].sort(([a], [b]) => {
    const n = (s: string) => /^Zone[123]$/.test(s) ? Number(s.slice(-1)) : 100;
    return n(a) - n(b) || a.localeCompare(b);
  }).map(([key, group]): LevelZone => {
    const chapters = [...group.chapters].sort(([a], [b]) => compareChapters(a, b))
      .map(([name, levels]) => ({
        key: `${key}/${name}`, name,
        levels: levels.sort((a, b) => a.level.difficulty - b.level.difficulty ||
          a.level.id.split('/').at(-1)!.localeCompare(
            b.level.id.split('/').at(-1)!, 'en', {numeric:true, sensitivity:'base'},
          ) || a.key.localeCompare(b.key)),
      }));
    return { key, name: group.name, chapters, count: chapters.reduce((n, c) => n + c.levels.length, 0) };
  });
}

export function flattenedLevels(zones: readonly LevelZone[]): LevelEntry[] {
  return zones.flatMap((zone) => zone.chapters.flatMap((chapter) => chapter.levels));
}
