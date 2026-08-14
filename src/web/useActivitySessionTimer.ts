/**
 * Учёт минут в приложении (visible tab) → ActivitySlice.
 */
import { useEffect, useRef } from 'react';
import { useAppStore } from '../store/useAppStore';

const FLUSH_MS = 60_000;

function isDocumentVisible(): boolean {
  if (typeof document === 'undefined') return true;
  return document.visibilityState !== 'hidden';
}

/** Пока вкладка видима — каждую минуту +1 к «Минут в приложении». */
export function useActivitySessionTimer(enabled = true): void {
  const trackActivity = useAppStore((s) => s.trackActivity);
  const accruedMs = useRef(0);
  const lastTs = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const flush = () => {
      if (accruedMs.current < FLUSH_MS) return;
      const minutes = Math.floor(accruedMs.current / FLUSH_MS);
      if (minutes <= 0) return;
      trackActivity({ minutes });
      accruedMs.current -= minutes * FLUSH_MS;
    };

    const tick = () => {
      const now = Date.now();
      if (lastTs.current != null && isDocumentVisible()) {
        accruedMs.current += now - lastTs.current;
        flush();
      }
      lastTs.current = isDocumentVisible() ? now : null;
    };

    lastTs.current = isDocumentVisible() ? Date.now() : null;
    const id = window.setInterval(tick, 5_000);

    const onVis = () => {
      if (isDocumentVisible()) {
        lastTs.current = Date.now();
      } else {
        tick();
        flush();
        lastTs.current = null;
      }
    };

    document.addEventListener('visibilitychange', onVis);

    return () => {
      tick();
      flush();
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [enabled, trackActivity]);
}
