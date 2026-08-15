/**
 * Persist-хранилище для Zustand (offline-first PWA):
 * - web → IndexedDB `languageeee-app-v1` (основное) + localStorage (быстрый фолбэк)
 * - native → AsyncStorage
 *
 * Книги / фанфики / словарь / прогресс чтения живут в AsyncStorage
 * (на web ≈ localStorage) через storageService / readingProgressStore /
 * flashcardsStore — читалка и словарь работают без сети.
 * Service Worker кэширует shell (HTML/CSS/JS/шрифты); данные — локально.
 */
import { Platform } from 'react-native';
import type { StateStorage } from 'zustand/middleware';

const IDB_NAME = 'languageeee-app-v1';
const IDB_STORE = 'kv';

function openIdb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IDB open failed'));
  });
}

async function idbGet(key: string): Promise<string | null> {
  const db = await openIdb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readonly');
    const store = tx.objectStore(IDB_STORE);
    const req = store.get(key);
    req.onsuccess = () => {
      const v = req.result;
      resolve(typeof v === 'string' ? v : v == null ? null : String(v));
    };
    req.onerror = () => reject(req.error);
  });
}

async function idbSet(key: string, value: string): Promise<void> {
  const db = await openIdb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function idbRemove(key: string): Promise<void> {
  const db = await openIdb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Web: localStorage = источник свежести (синхронная запись),
 * IndexedDB = вместилище для больших снимков.
 * Раньше getItem предпочитал IDB → устаревшая запись могла пережить
 * более новый localStorage (гонка async put) и вернуть раздутый activityByDay.
 */
function createWebStorage(): StateStorage {
  /** Цепочка put, чтобы старый idbSet не затирал более новый. */
  let idbWriteChain: Promise<void> = Promise.resolve();

  return {
    getItem: async (name) => {
      try {
        if (typeof localStorage !== 'undefined') {
          const fromLs = localStorage.getItem(name);
          if (fromLs != null) {
            idbWriteChain = idbWriteChain
              .then(() => idbSet(name, fromLs))
              .catch(() => undefined);
            return fromLs;
          }
        }
      } catch {
        /* private mode / quota */
      }
      try {
        return await idbGet(name);
      } catch {
        return null;
      }
    },
    setItem: async (name, value) => {
      try {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem(name, value);
        }
      } catch {
        /* quota */
      }
      idbWriteChain = idbWriteChain
        .then(() => idbSet(name, value))
        .catch(() => undefined);
      await idbWriteChain;
    },
    removeItem: async (name) => {
      try {
        if (typeof localStorage !== 'undefined') {
          localStorage.removeItem(name);
        }
      } catch {
        /* ignore */
      }
      idbWriteChain = idbWriteChain
        .then(() => idbRemove(name))
        .catch(() => undefined);
      await idbWriteChain;
    },
  };
}

export function createAppStorage(): StateStorage {
  if (Platform.OS === 'web') {
    return createWebStorage();
  }

  // Lazy require — не тянем AsyncStorage на web-пути
  const AsyncStorage =
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('@react-native-async-storage/async-storage').default as StateStorage;
  return AsyncStorage;
}
