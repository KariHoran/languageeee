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

/** Web: IndexedDB с зеркалом в localStorage для мгновенного гидрата. */
function createWebStorage(): StateStorage {
  return {
    getItem: async (name) => {
      try {
        const fromIdb = await idbGet(name);
        if (fromIdb != null) return fromIdb;
        try {
          if (typeof localStorage === 'undefined') return null;
          const fromLs = localStorage.getItem(name);
          if (fromLs != null) {
            void idbSet(name, fromLs).catch(() => undefined);
            return fromLs;
          }
        } catch {
          /* private mode */
        }
        return null;
      } catch {
        try {
          if (typeof localStorage === 'undefined') return null;
          return localStorage.getItem(name);
        } catch {
          return null;
        }
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
      try {
        await idbSet(name, value);
      } catch {
        /* IDB недоступен — localStorage уже записан */
      }
    },
    removeItem: async (name) => {
      try {
        if (typeof localStorage !== 'undefined') {
          localStorage.removeItem(name);
        }
      } catch {
        /* ignore */
      }
      try {
        await idbRemove(name);
      } catch {
        /* ignore */
      }
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
