/**
 * Регистрация Service Worker для PWA (web only).
 * Дублирует inline-скрипт в public/index.html на случай hot-reload / SPA.
 * Кэширует shell (HTML/CSS/JS/шрифты) — см. public/sw.js.
 */
export function registerPwaServiceWorker(): void {
  if (typeof window === 'undefined') return;
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
      })
      .catch((err) => {
        console.warn('[pwa] SW register failed:', err);
      });
  };

  if (document.readyState === 'complete') {
    run();
  } else {
    window.addEventListener('load', run, { once: true });
  }
}
