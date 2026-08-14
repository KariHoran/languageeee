/**
 * Принудительная очистка локальных данных пользователя
 * (Zustand / AsyncStorage / localStorage / IndexedDB) при logout
 * и перед загрузкой облака другого аккаунта.
 *
 * Не трогаем ключи Firebase Auth (firebase:*), чтобы сессия
 * корректно завершалась через firebase.auth.signOut().
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { useAppStore } from '../store/useAppStore';

const APP_PREFIX = '@languageeee/';
const ZUSTAND_KEY = '@languageeee/app-store-v1';
const AUDIO_IDB = 'languageeee-audio-v1';

/** Явный список ключей (на случай, если getAllKeys недоступен). */
const KNOWN_KEYS = [
  '@languageeee/books',
  '@languageeee/collections',
  '@languageeee/collection_words',
  '@languageeee/flashcards',
  '@languageeee/saved_words',
  '@languageeee/sync_tombstones',
  '@languageeee/sync_last_at',
  '@languageeee/reading_progress_v1',
  '@languageeee/user_radio_tracks_v2',
  '@languageeee/user_radio_tracks_v1',
  '@languageeee/user_prefs',
  '@languageeee/streak',
  '@languageeee/collections_initialized',
  '@languageeee/demo_flashcards_seeded',
  '@languageeee/translation-cache-v1',
  ZUSTAND_KEY,
  `persist:${ZUSTAND_KEY}`,
];

type ResetListener = () => void;
const resetListeners = new Set<ResetListener>();

/** UI подписывается, чтобы мгновенно обнулить локальный React state. */
export function subscribeLocalDataReset(listener: ResetListener): () => void {
  resetListeners.add(listener);
  return () => {
    resetListeners.delete(listener);
  };
}

function notifyLocalDataReset(): void {
  resetListeners.forEach((fn) => {
    try {
      fn();
    } catch (err) {
      console.warn('[localDataReset] listener failed:', err);
    }
  });
}

function isAppStorageKey(key: string): boolean {
  if (key.startsWith(APP_PREFIX)) return true;
  if (key.includes('languageeee')) return true;
  if (key === ZUSTAND_KEY || key === `persist:${ZUSTAND_KEY}`) return true;
  return false;
}

async function clearAsyncStorageAppKeys(): Promise<void> {
  try {
    const all = await AsyncStorage.getAllKeys();
    const toRemove = all.filter(isAppStorageKey);
    const union = Array.from(new Set([...toRemove, ...KNOWN_KEYS]));
    if (union.length) {
      await AsyncStorage.multiRemove(union);
    }
  } catch (err) {
    console.warn('[localDataReset] AsyncStorage multiRemove failed, fallback:', err);
    await Promise.all(
      KNOWN_KEYS.map((k) => AsyncStorage.removeItem(k).catch(() => undefined))
    );
  }
}

function clearWebLocalStorage(): void {
  if (Platform.OS !== 'web' || typeof localStorage === 'undefined') return;
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const k = localStorage.key(i);
      if (k && isAppStorageKey(k)) keys.push(k);
    }
    for (const k of keys) {
      try {
        localStorage.removeItem(k);
      } catch {
        /* ignore */
      }
    }
  } catch (err) {
    console.warn('[localDataReset] localStorage clear failed:', err);
  }
}

function clearWebSessionStorage(): void {
  if (Platform.OS !== 'web' || typeof sessionStorage === 'undefined') return;
  try {
    const keys: string[] = [];
    for (let i = 0; i < sessionStorage.length; i += 1) {
      const k = sessionStorage.key(i);
      if (k && isAppStorageKey(k)) keys.push(k);
    }
    for (const k of keys) {
      try {
        sessionStorage.removeItem(k);
      } catch {
        /* ignore */
      }
    }
  } catch {
    /* ignore */
  }
}

function deleteIndexedDb(name: string): Promise<void> {
  return new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') {
      resolve();
      return;
    }
    try {
      const req = indexedDB.deleteDatabase(name);
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
      req.onblocked = () => resolve();
    } catch {
      resolve();
    }
  });
}

/** Пустое пользовательское состояние в Zustand (фанфики, коллекции, SRS…). */
export function resetZustandUserState(): void {
  try {
    useAppStore.setState({
      books: [],
      collections: [],
      flashcards: {},
      stickyNotes: [],
      activeBookId: null,
      radioPlaying: false,
      streakCurrent: 0,
      streakLastActiveDate: null,
      streakUpdatedAt: new Date().toISOString(),
      activityByDay: {},
    });
    try {
      void useAppStore.persist?.clearStorage?.();
    } catch {
      /* ignore */
    }
  } catch (err) {
    console.warn('[localDataReset] zustand reset failed:', err);
  }
}

async function resetAudioRuntime(): Promise<void> {
  try {
    const { revokeAllPlayableUrls } = await import('./userTracksStore');
    revokeAllPlayableUrls();
  } catch {
    /* ignore */
  }
  try {
    const { ambientRadio } = await import('./ambientRadio');
    ambientRadio.pause();
  } catch {
    /* ignore */
  }
}

/**
 * Полный сброс локальных данных приложения.
 * Вызывать при logout и перед pull облака другого аккаунта.
 */
export async function clearUserLocalData(): Promise<void> {
  console.log('[localDataReset] clearing local user data…');

  // Сразу глушим облачный sync и UI — чтобы не подтянуть данные обратно
  try {
    const { cancelPendingSync, markLocalDataCleared } = await import('./cloudSyncService');
    cancelPendingSync();
    markLocalDataCleared();
  } catch {
    /* ignore */
  }

  // Сначала память: UI/sync не должны читать старые книги из Zustand
  resetZustandUserState();
  notifyLocalDataReset();

  await resetAudioRuntime();
  await clearAsyncStorageAppKeys();

  // Явно затираем критичные ключи пустыми структурами
  const emptyMap = '{}';
  const emptyList = '[]';
  const wipeKeys: Array<[string, string]> = [
    ['@languageeee/books', emptyMap],
    ['@languageeee/collections', emptyMap],
    ['@languageeee/collection_words', emptyMap],
    ['@languageeee/flashcards', emptyMap],
    ['@languageeee/saved_words', emptyMap],
    ['@languageeee/sync_tombstones', emptyList],
    ['@languageeee/reading_progress_v1', emptyMap],
    ['@languageeee/user_radio_tracks_v2', emptyList],
    ['@languageeee/user_radio_tracks_v1', emptyList],
  ];
  await Promise.all(
    wipeKeys.map(([k, v]) => AsyncStorage.setItem(k, v).catch(() => undefined))
  );
  await AsyncStorage.removeItem('@languageeee/collections_initialized').catch(
    () => undefined
  );
  await AsyncStorage.removeItem('@languageeee/sync_last_at').catch(() => undefined);
  await AsyncStorage.removeItem(ZUSTAND_KEY).catch(() => undefined);
  await AsyncStorage.removeItem(`persist:${ZUSTAND_KEY}`).catch(() => undefined);

  clearWebLocalStorage();
  clearWebSessionStorage();
  // Повторно пишем пустые карты после clear localStorage (web AsyncStorage ↔ localStorage)
  await Promise.all(
    wipeKeys.map(([k, v]) => AsyncStorage.setItem(k, v).catch(() => undefined))
  );
  if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
    for (const [k, v] of wipeKeys) {
      try {
        localStorage.setItem(k, v);
      } catch {
        /* ignore */
      }
    }
    try {
      localStorage.removeItem(ZUSTAND_KEY);
      localStorage.removeItem(`persist:${ZUSTAND_KEY}`);
    } catch {
      /* ignore */
    }
  }

  await deleteIndexedDb(AUDIO_IDB);

  // Финальный сброс памяти (persist мог что-то дописать)
  resetZustandUserState();
  notifyLocalDataReset();

  console.log('[localDataReset] done');
}
