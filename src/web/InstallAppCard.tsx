import React, { useEffect, useState } from 'react';
import { useI18n } from '../i18n/useI18n';
import { showAlert } from '../utils/alert';
import { Button, Div } from './dom';
import {
  canPromptPwaInstall,
  isPwaInstalled,
  promptPwaInstall,
  subscribePwaInstallAvailability,
} from './registerPwa';
import { useWebTheme } from './webTheme';

/**
 * Скачать / установить приложение прямо с сайта (PWA, без Play Store).
 */
export function InstallAppCard() {
  const theme = useWebTheme();
  const { t } = useI18n();
  const [canInstall, setCanInstall] = useState(() => canPromptPwaInstall());
  const [installed, setInstalled] = useState(() => isPwaInstalled());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    return subscribePwaInstallAvailability(() => {
      setCanInstall(canPromptPwaInstall());
      setInstalled(isPwaInstalled());
    });
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(display-mode: standalone)');
    const onChange = () => setInstalled(isPwaInstalled());
    mq.addEventListener?.('change', onChange);
    return () => mq.removeEventListener?.('change', onChange);
  }, []);

  const handleDownload = () => {
    if (busy) return;
    setBusy(true);
    void (async () => {
      try {
        if (isPwaInstalled()) {
          showAlert(t('install.alreadyTitle'), t('install.alreadyBody'));
          return;
        }
        const result = await promptPwaInstall();
        if (result === 'accepted') {
          setInstalled(true);
          return;
        }
        if (result === 'dismissed') return;
        showAlert(t('install.manualTitle'), t('install.manualBody'));
      } finally {
        setBusy(false);
        setCanInstall(canPromptPwaInstall());
        setInstalled(isPwaInstalled());
      }
    })();
  };

  if (installed) {
    return (
      <Div className={`rounded-2xl ${theme.card} px-4 py-3`}>
        <Div className={`font-bold ${theme.accent} text-sm`}>
          {t('install.alreadyTitle')}
        </Div>
        <Div className={`text-xs ${theme.textMuted} mt-0.5`}>
          {t('install.alreadyBody')}
        </Div>
      </Div>
    );
  }

  return (
    <Div className={`rounded-2xl ${theme.card} px-4 py-3 space-y-2.5`}>
      <Div>
        <Div className={`font-bold ${theme.accent} text-sm`}>
          {t('install.title')}
        </Div>
        <Div className={`text-xs ${theme.textMuted} mt-0.5 leading-snug`}>
          {t('install.subtitle')}
        </Div>
      </Div>

      <Button
        type="button"
        disabled={busy}
        className={`w-full rounded-xl px-3 py-2.5 text-xs font-bold transition ${theme.cta} disabled:opacity-50`}
        onClick={handleDownload}
      >
        {busy
          ? t('install.busy')
          : canInstall
            ? t('install.downloadCta')
            : t('install.showHow')}
      </Button>

      <Div className={`text-[11px] leading-relaxed ${theme.textMuted}`}>
        <Div className={`font-bold mb-1 ${theme.text}`}>{t('install.androidTitle')}</Div>
        <Div>1. {t('install.androidStep1')}</Div>
        <Div>2. {t('install.androidStep2')}</Div>
        <Div>3. {t('install.androidStep3')}</Div>
      </Div>
    </Div>
  );
}
