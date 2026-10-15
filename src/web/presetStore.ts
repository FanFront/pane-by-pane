import type { PresetPack } from '../presets.ts';

const DB_NAME = 'pane-by-pane-presets';
const STORE = 'packs';
const PERSONAL_KEY = 'personal';

/** IndexedDB avoids the ~5 MiB localStorage quota when importing many puzzles. */
function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Cannot open local puzzle storage'));
  });
}

export async function readPersonalPack(): Promise<PresetPack | null> {
  const db = await openDb();
  try {
    return await new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE, 'readonly');
      const request = transaction.objectStore(STORE).get(PERSONAL_KEY);
      request.onsuccess = () => resolve((request.result as PresetPack | undefined) ?? null);
      request.onerror = () => reject(request.error ?? new Error('Cannot read local puzzle pack'));
    });
  } finally {
    db.close();
  }
}

export async function savePersonalPack(pack: PresetPack): Promise<void> {
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE, 'readwrite');
      transaction.objectStore(STORE).put(pack, PERSONAL_KEY);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error('Cannot save local puzzle pack'));
      transaction.onabort = () => reject(transaction.error ?? new Error('Puzzle pack write aborted'));
    });
  } finally {
    db.close();
  }
}
