/**
 * Очередь «есть локальные правки, ждём сеть».
 * Данные уже в AsyncStorage — это флаги для UI и Background Sync.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const QUEUE_KEY = '@languageeee/offline_sync_queue_v1';

export type OfflinePendingKind =
  | 'books'
  | 'flashcards'
  | 'progress'
  | 'prefs'
  | 'other';

export interface OfflineQueueState {
  pending: OfflinePendingKind[];
  updatedAt: number;
}

type Listener = (state: OfflineQueueState) => void;

const listeners = new Set<Listener>();

let memory: OfflineQueueState = { pending: [], updatedAt: 0 };
let loaded = false;

function emit() {
  listeners.forEach((fn) => fn(memory));
}

async function persist(): Promise<void> {
  try {
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(memory));
  } catch {
    /* quota */
  }
}

async function ensureLoaded(): Promise<void> {
  if (loaded) return;
  loaded = true;
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as OfflineQueueState;
      if (parsed && Array.isArray(parsed.pending)) {
        memory = {
          pending: parsed.pending,
          updatedAt: parsed.updatedAt || 0,
        };
      }
    }
  } catch {
    /* ignore */
  }
}

export function getOfflineQueueSnapshot(): OfflineQueueState {
  return memory;
}

export function subscribeOfflineQueue(listener: Listener): () => void {
  listeners.add(listener);
  void ensureLoaded().then(() => listener(memory));
  return () => {
    listeners.delete(listener);
  };
}

export async function markOfflinePending(
  kinds: OfflinePendingKind | OfflinePendingKind[]
): Promise<void> {
  await ensureLoaded();
  const list = Array.isArray(kinds) ? kinds : [kinds];
  const next = new Set(memory.pending);
  for (const k of list) next.add(k);
  memory = { pending: Array.from(next), updatedAt: Date.now() };
  emit();
  await persist();
  void requestBackgroundSync();
}

export async function clearOfflinePending(): Promise<void> {
  await ensureLoaded();
  if (memory.pending.length === 0) return;
  memory = { pending: [], updatedAt: Date.now() };
  emit();
  await persist();
}

/** Background Sync API — разбудит SW, когда сеть появится. */
export async function requestBackgroundSync(): Promise<void> {
  if (Platform.OS !== 'web' || typeof navigator === 'undefined') return;
  try {
    if (!('serviceWorker' in navigator)) return;
    const reg = await navigator.serviceWorker.ready;
    const syncManager = (
      reg as ServiceWorkerRegistration & {
        sync?: { register: (tag: string) => Promise<void> };
      }
    ).sync;
    if (syncManager?.register) {
      await syncManager.register('languageeee-sync');
    }
  } catch {
    /* unsupported / permission */
  }
}

/** Прогрев Cache Storage текущими shell-URL (после первого онлайн-визита). */
export async function warmOfflineShellCache(urls: string[] = []): Promise<void> {
  if (Platform.OS !== 'web' || typeof caches === 'undefined') return;
  try {
    const cache = await caches.open('languageeee-v6');
    const list = [
      '/',
      '/index.html',
      '/manifest.json',
      ...urls,
      typeof window !== 'undefined' ? window.location.pathname : '/',
    ].filter(Boolean);
    await Promise.all(
      list.map((u) =>
        cache.add(u).catch(() => undefined)
      )
    );
  } catch {
    /* private mode */
  }
}
