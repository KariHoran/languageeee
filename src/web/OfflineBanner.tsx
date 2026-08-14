import React, { useEffect, useState } from 'react';
import { useI18n } from '../i18n/useI18n';
import {
  getNetworkStatus,
  initNetworkStatusMonitoring,
  type NetworkStatus,
} from '../services/networkStatusService';
import { reportNetworkConnectivity } from '../services/syncService';
import { Button, Div, Span } from './dom';

/**
 * Баннер офлайна. Тексты — через i18n (nativeLanguage).
 */
export function OfflineBanner() {
  const { t } = useI18n();
  const [status, setStatus] = useState<NetworkStatus>(() => getNetworkStatus());
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    return initNetworkStatusMonitoring((next) => {
      setStatus(next);
      reportNetworkConnectivity(next !== 'offline');
      if (next === 'online') setDismissed(false);
    });
  }, []);

  if (status !== 'offline' || dismissed) return null;

  return (
    <Div
      className="relative z-50 shrink-0 px-3 sm:px-5 pt-2"
      role="status"
      aria-live="polite"
    >
      <Div
        className="mx-auto max-w-3xl flex items-center gap-3 rounded-2xl px-3.5 py-2.5
          bg-[#1E1E28]/90 backdrop-blur-md border border-[#2A2A3A]
          shadow-[0_8px_32px_rgba(0,0,0,0.35)]"
      >
        <Span
          className="shrink-0 w-2 h-2 rounded-full bg-[#D0FF00] animate-pulse"
          aria-hidden
        />
        <Div className="flex-1 min-w-0">
          <Div className="text-xs sm:text-sm font-bold text-white font-['Comfortaa'] leading-snug">
            {t('offline.title')}
          </Div>
          <Div className="text-[10px] sm:text-[11px] text-white/55 font-semibold leading-snug mt-0.5">
            {t('offline.hint')}
          </Div>
        </Div>
        <Button
          type="button"
          className="shrink-0 rounded-xl px-2.5 py-1 text-[11px] font-bold
            text-[#c4b5fd] border border-[#8B5CF6]/40 hover:bg-[#8B5CF6]/15 transition"
          onClick={() => setDismissed(true)}
          aria-label={t('offline.dismiss')}
        >
          {t('offline.dismiss')}
        </Button>
      </Div>
    </Div>
  );
}
