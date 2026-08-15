/**
 * Регистрация Service Worker + PWA install prompt (web only).
 */
import { Platform } from 'react-native';
import { warmOfflineShellCache } from '../services/offlineSyncQueue';

export type BeforeInstallPromptEventLike = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

type InstallListener = () => void;

let deferredPrompt: BeforeInstallPromptEventLike | null = null;
const installListeners = new Set<InstallListener>();

function emitInstall() {
  installListeners.forEach((fn) => fn());
}

export function canPromptPwaInstall(): boolean {
  return deferredPrompt != null;
}

/** Уже запущено как установленное приложение (домашний экран). */
export function isPwaInstalled(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    if (window.matchMedia('(display-mode: standalone)').matches) return true;
    if (window.matchMedia('(display-mode: fullscreen)').matches) return true;
  } catch {
    /* ignore */
  }
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return nav.standalone === true;
}

export function subscribePwaInstallAvailability(
  listener: InstallListener
): () => void {
  installListeners.add(listener);
  listener();
  return () => {
    installListeners.delete(listener);
  };
}

export async function promptPwaInstall(): Promise<
  'accepted' | 'dismissed' | 'unavailable'
> {
  if (!deferredPrompt) return 'unavailable';
  const event = deferredPrompt;
  deferredPrompt = null;
  emitInstall();
  try {
    await event.prompt();
    const { outcome } = await event.userChoice;
    return outcome;
  } catch {
    return 'unavailable';
  }
}

export function registerPwaServiceWorker(): void {
  if (typeof window === 'undefined') return;
  if (Platform.OS !== 'web') return;

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEventLike;
    emitInstall();
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    emitInstall();
  });

  if (!('serviceWorker' in navigator)) return;

  const run = () => {
    void navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then((reg) => {
        console.log('[pwa] SW ready:', reg.scope);

        const askSkipWaiting = (worker: ServiceWorker | null | undefined) => {
          worker?.postMessage?.({ type: 'SKIP_WAITING' });
        };

        if (reg.waiting) askSkipWaiting(reg.waiting);

        reg.addEventListener('updatefound', () => {
          const worker = reg.installing;
          if (!worker) return;
          worker.addEventListener('statechange', () => {
            if (worker.state === 'installed' && navigator.serviceWorker.controller) {
              askSkipWaiting(worker);
              console.log('[pwa] New SW installed — activating');
            }
          });
        });

        void warmOfflineShellCache([
          window.location.href,
          window.location.pathname,
        ]);
      })
      .catch((err) => {
        console.warn('[pwa] SW register failed:', err);
      });

    navigator.serviceWorker.addEventListener('message', (event) => {
      const data = event.data;
      if (!data || data.type !== 'FLUSH_SYNC') return;
      void (async () => {
        try {
          const { flushSyncNow } = await import('../services/cloudSyncService');
          await flushSyncNow();
        } catch (err) {
          console.warn('[pwa] FLUSH_SYNC failed:', err);
        }
      })();
    });
  };

  if (document.readyState === 'complete') {
    run();
  } else {
    window.addEventListener('load', run, { once: true });
  }
}
