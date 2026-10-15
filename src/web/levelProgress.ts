/** Persist completions by stable origin + puzzle ID, never by array index. */
export const LEVEL_PROGRESS_KEY = 'pbp:level-progress:v1';

export interface LevelProgress {
  completed: Set<string>;
  recent: string | null;
}

type ReadStorage = Pick<Storage, 'getItem'>;
type WriteStorage = Pick<Storage, 'setItem'>;

export function readLevelProgress(storage: ReadStorage): LevelProgress {
  try {
    const raw = storage.getItem(LEVEL_PROGRESS_KEY);
    if (!raw) return { completed: new Set(), recent: null };
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Invalid save');
    const value = parsed as Record<string, unknown>;
    if (value.version !== 1 || !Array.isArray(value.completed)) throw new Error('Invalid version');
    return {
      completed: new Set(value.completed.filter((key): key is string => typeof key === 'string' && key.length < 200)),
      recent: typeof value.recent === 'string' ? value.recent : null,
    };
  } catch {
    return { completed: new Set(), recent: null };
  }
}

export function saveLevelProgress(storage: WriteStorage, state: LevelProgress): boolean {
  try {
    storage.setItem(LEVEL_PROGRESS_KEY, JSON.stringify({
      version: 1,
      completed: [...state.completed].sort(),
      recent: state.recent,
    }));
    return true;
  } catch {
    return false;
  }
}

export function completeLevel(state: LevelProgress, key: string): boolean {
  if (state.completed.has(key)) return false;
  state.completed.add(key);
  return true;
}

export function chapterProgress(levelKeys: readonly string[], completed: ReadonlySet<string>): number {
  return levelKeys.reduce((sum, key) => sum + Number(completed.has(key)), 0);
}
