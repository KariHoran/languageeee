import React, { useState } from 'react';
import { useI18n } from '../i18n/useI18n';
import { Button, Div, Span } from './dom';

interface DueCardsBannerProps {
  due: number;
  /** Когда сегодня 0 due — мягко напомнить про завтра */
  dueTomorrow?: number;
  onOpenFlashcards: () => void;
}

/** Мягкое напоминание: due сегодня или «завтра». */
export function DueCardsBanner({
  due,
  dueTomorrow = 0,
  onOpenFlashcards,
}: DueCardsBannerProps) {
  const { t } = useI18n();
  const [dismissed, setDismissed] = useState(false);

  const showToday = due > 0;
  const showTomorrow = !showToday && dueTomorrow > 0;
  if ((!showToday && !showTomorrow) || dismissed) return null;

  return (
    <Div
      className="relative z-50 shrink-0 px-3 sm:px-5 pt-2"
      role="status"
      aria-live="polite"
    >
      <Div
        className={`mx-auto max-w-3xl flex items-center gap-3 rounded-2xl px-3.5 py-2.5
          bg-[#1E1E28]/90 backdrop-blur-md shadow-[0_8px_32px_rgba(0,0,0,0.35)] border ${
            showToday ? 'border-[#D0FF00]/35' : 'border-[#8B5CF6]/40'
          }`}
      >
        <Span className="text-base" aria-hidden>
          {showToday ? '🃏' : '🌙'}
        </Span>
        <Div className="flex-1 min-w-0">
          <Div className="text-xs sm:text-sm font-bold text-white font-['Comfortaa'] leading-snug">
            {showToday
              ? t('progress.dueBannerTitle', { n: due })
              : t('progress.dueTomorrowTitle', { n: dueTomorrow })}
          </Div>
          <Div className="text-[10px] sm:text-[11px] text-white/55 font-semibold leading-snug mt-0.5">
            {showToday
              ? t('progress.dueBannerHint')
              : t('progress.dueTomorrowHint')}
          </Div>
        </Div>
        {showToday ? (
          <Button
            type="button"
            className="shrink-0 rounded-xl px-2.5 py-1.5 text-[11px] font-bold
              bg-[#D0FF00] text-[#0D0D11] hover:brightness-95 transition"
            onClick={onOpenFlashcards}
          >
            {t('progress.dueBannerCta')}
          </Button>
        ) : (
          <Button
            type="button"
            className="shrink-0 rounded-xl px-2.5 py-1.5 text-[11px] font-bold
              bg-[#8B5CF6]/25 text-[#c4b5fd] border border-[#8B5CF6]/40 hover:bg-[#8B5CF6]/35 transition"
            onClick={onOpenFlashcards}
          >
            {t('progress.dueTomorrowCta')}
          </Button>
        )}
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
