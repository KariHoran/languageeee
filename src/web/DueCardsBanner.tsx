import React, { useState } from 'react';
import { useI18n } from '../i18n/useI18n';
import { Button, Div, Span } from './dom';

interface DueCardsBannerProps {
  due: number;
  onOpenFlashcards: () => void;
}

/** Мягкое напоминание: due-карточки при входе. */
export function DueCardsBanner({ due, onOpenFlashcards }: DueCardsBannerProps) {
  const { t } = useI18n();
  const [dismissed, setDismissed] = useState(false);

  if (due <= 0 || dismissed) return null;

  return (
    <Div
      className="relative z-50 shrink-0 px-3 sm:px-5 pt-2"
      role="status"
      aria-live="polite"
    >
      <Div
        className="mx-auto max-w-3xl flex items-center gap-3 rounded-2xl px-3.5 py-2.5
          bg-[#1E1E28]/90 backdrop-blur-md border border-[#D0FF00]/35
          shadow-[0_8px_32px_rgba(0,0,0,0.35)]"
      >
        <Span className="text-base" aria-hidden>
          🃏
        </Span>
        <Div className="flex-1 min-w-0">
          <Div className="text-xs sm:text-sm font-bold text-white font-['Comfortaa'] leading-snug">
            {t('progress.dueBannerTitle', { n: due })}
          </Div>
          <Div className="text-[10px] sm:text-[11px] text-white/55 font-semibold leading-snug mt-0.5">
            {t('progress.dueBannerHint')}
          </Div>
        </Div>
        <Button
          type="button"
          className="shrink-0 rounded-xl px-2.5 py-1.5 text-[11px] font-bold
            bg-[#D0FF00] text-[#0D0D11] hover:brightness-95 transition"
          onClick={onOpenFlashcards}
        >
          {t('progress.dueBannerCta')}
        </Button>
        <Button
          type="button"
          className="shrink-0 rounded-xl px-2 py-1 text-[11px] font-bold text-white/50"
          onClick={() => setDismissed(true)}
          aria-label={t('action.close')}
        >
          ✕
        </Button>
      </Div>
    </Div>
  );
}
