/**
 * Online / offline статус для web-шелла и sync (PWA offline-first).
 * Источник правды: navigator.onLine + события online/offline.
 */
import { Platform } from 'react-native';

export type NetworkStatus = 'online' | 'offline' | 'unknown';

type Listener = (status: NetworkStatus) => void;

const listeners = new Set<Listener>();

let current: NetworkStatus =
  typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean'
    ? navigator.onLine
      ? 'online'
      : 'offline'
    : 'unknown';

let started = false;
let goOnline: (() => void) | null = null;
let goOffline: (() => void) | null = null;

function emit(next: NetworkStatus) {
  if (current === next) return;
  current = next;
  listeners.forEach((fn) => fn(current));
}

function ensureStarted() {
  if (started || Platform.OS !== 'web' || typeof window === 'undefined') return;
  started = true;
  goOnline = () => emit('online');
  goOffline = () => emit('offline');
  window.addEventListener('online', goOnline);
  window.addEventListener('offline', goOffline);
  emit(navigator.onLine ? 'online' : 'offline');
}

function maybeStop() {
  if (!started || listeners.size > 0) return;
  if (typeof window !== 'undefined' && goOnline && goOffline) {
    window.removeEventListener('online', goOnline);
    window.removeEventListener('offline', goOffline);
  }
  goOnline = null;
  goOffline = null;
  started = false;
}

/** Текущий статус сети. */
export function getNetworkStatus(): NetworkStatus {
  if (Platform.OS === 'web' && typeof navigator !== 'undefined') {
    return navigator.onLine ? 'online' : 'offline';
  }
  return current;
}

export function isNetworkOnline(): boolean {
  return getNetworkStatus() !== 'offline';
}

export function subscribeNetworkStatus(listener: Listener): () => void {
  listeners.add(listener);
  ensureStarted();
  listener(getNetworkStatus());
  return () => {
    listeners.delete(listener);
    maybeStop();
  };
}

/**
 * Подписка на browser online/offline.
 * Безопасно вызывать из App + OfflineBanner — слушатели шарятся.
 */
export function initNetworkStatusMonitoring(
  onChange?: (status: NetworkStatus) => void
): () => void {
  if (Platform.OS !== 'web' || typeof window === 'undefined') {
    return () => undefined;
  }

  if (onChange) {
    return subscribeNetworkStatus(onChange);
  }

  ensureStarted();
  return () => maybeStop();
}
