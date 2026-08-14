import { Platform } from 'react-native';

const CACHE_STORAGE_KEY = '@languageeee/translation-cache-v1';
const MAX_CACHE_ENTRIES = 500;

type CacheMap = Record<string, string>;

let memoryCache: CacheMap = {};
let hydrated = false;
let hydratePromise: Promise<void> | null = null;
let persistTimer: ReturnType<typeof setTimeout> | null = null;

function getWebStorage(): Storage | null {
  if (typeof localStorage === 'undefined') return null;
  return localStorage;
}

async function readPersisted(): Promise<CacheMap> {
  try {
    if (Platform.OS === 'web') {
      const raw = getWebStorage()?.getItem(CACHE_STORAGE_KEY);
      if (!raw) return {};
      return JSON.parse(raw) as CacheMap;
    }
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    const raw = await AsyncStorage.getItem(CACHE_STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as CacheMap;
  } catch {
    return {};
  }
}

async function writePersisted(map: CacheMap): Promise<void> {
  try {
    const payload = JSON.stringify(map);
    if (Platform.OS === 'web') {
      getWebStorage()?.setItem(CACHE_STORAGE_KEY, payload);
      return;
    }
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    await AsyncStorage.setItem(CACHE_STORAGE_KEY, payload);
  } catch {
    // quota / private mode
  }
}

function schedulePersist(): void {
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    void writePersisted(memoryCache);
  }, 400);
}

function trimCache(map: CacheMap): CacheMap {
  const keys = Object.keys(map);
  if (keys.length <= MAX_CACHE_ENTRIES) return map;
  const next: CacheMap = {};
  for (const key of keys.slice(keys.length - MAX_CACHE_ENTRIES)) {
    next[key] = map[key]!;
  }
  return next;
}

/** Быстрый стабильный хэш строки (djb2a). */
export function hashTranslationKey(text: string, direction: string): string {
  const input = `${direction}::${text.trim()}`;
  let hash = 5381;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 33) ^ input.charCodeAt(i);
  }
  return `t_${(hash >>> 0).toString(16)}`;
}

async function ensureHydrated(): Promise<void> {
  if (hydrated) return;
  if (!hydratePromise) {
    hydratePromise = (async () => {
      const stored = await readPersisted();
      memoryCache = { ...stored, ...memoryCache };
      hydrated = true;
    })();
  }
  await hydratePromise;
}

export async function getCachedTranslation(
  text: string,
  direction: string
): Promise<string | null> {
  const trimmed = text.trim();
  if (!trimmed) return null;
  await ensureHydrated();
  const key = hashTranslationKey(trimmed, direction);
  const hit = memoryCache[key];
  return hit?.trim() ? hit : null;
}

export async function setCachedTranslation(
  text: string,
  direction: string,
  translation: string
): Promise<void> {
  const trimmed = text.trim();
  const value = translation.trim();
  if (!trimmed || !value) return;

  await ensureHydrated();
  const key = hashTranslationKey(trimmed, direction);
  memoryCache = trimCache({ ...memoryCache, [key]: value });
  schedulePersist();
}

/** Синхронный peek после гидрации (для тестов / отладки). */
export function peekTranslationCacheSize(): number {
  return Object.keys(memoryCache).length;
}

/**
 * Синхронный lookup (без await). Возвращает null, если кэш ещё не гидратирован.
 * Для повторного клика по слову — мгновенный ответ из memory/localStorage.
 */
export function getCachedTranslationSync(
  text: string,
  direction: string
): string | null {
  if (!hydrated) {
    // Ленивый старт гидрации без блокировки UI
    void ensureHydrated();
    return null;
  }
  const trimmed = text.trim();
  if (!trimmed) return null;
  const key = hashTranslationKey(trimmed, direction);
  const hit = memoryCache[key];
  return hit?.trim() ? hit : null;
}

/** Прогрев кэша из localStorage / AsyncStorage (вызвать при старте ридера). */
export function prefetchTranslationCache(): void {
  void ensureHydrated();
}

export async function clearTranslationCache(): Promise<void> {
  memoryCache = {};
  hydrated = true;
  await writePersisted({});
}
