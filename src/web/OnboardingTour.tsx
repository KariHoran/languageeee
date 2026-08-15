import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useI18n } from '../i18n/useI18n';
import { Button, Div, Span } from './dom';
import { useWebTheme } from './webTheme';

export type TourStepId =
  | 'welcome'
  | 'library'
  | 'click-word'
  | 'cards'
  | 'goals'
  | 'notebook'
  | 'install'
  | 'add-book'
  | 'language';

export interface TourStep {
  id: TourStepId;
  title: string;
  body: string;
  emoji: string;
}

interface OnboardingTourProps {
  open: boolean;
  steps?: TourStep[];
  onFinish: () => void;
  onSkip?: () => void;
}

/** Компактный Welcome Modal + пошаговый тур для первого входа. */
export function OnboardingTour({
  open,
  steps: stepsProp,
  onFinish,
  onSkip,
}: OnboardingTourProps) {
  const theme = useWebTheme();
  const { t } = useI18n();
  const [index, setIndex] = useState(0);

  const defaultSteps = useMemo<TourStep[]>(
    () => [
      {
        id: 'welcome',
        emoji: '✨',
        title: t('tour.welcomeTitle'),
        body: t('tour.welcomeBody'),
      },
      {
        id: 'library',
        emoji: '📚',
        title: t('tour.libraryTitle'),
        body: t('tour.libraryBody'),
      },
      {
        id: 'click-word',
        emoji: '👆',
        title: t('tour.clickWordTitle'),
        body: t('tour.clickWordBody'),
      },
      {
        id: 'cards',
        emoji: '🃏',
        title: t('tour.cardsTitle'),
        body: t('tour.cardsBody'),
      },
      {
        id: 'goals',
        emoji: '🎯',
        title: t('tour.goalsTitle'),
        body: t('tour.goalsBody'),
      },
      {
        id: 'notebook',
        emoji: '📝',
        title: t('tour.notebookTitle'),
        body: t('tour.notebookBody'),
      },
      {
        id: 'install',
        emoji: '📱',
        title: t('tour.installTitle'),
        body: t('tour.installBody'),
      },
      {
        id: 'add-book',
        emoji: '➕',
        title: t('tour.addBookTitle'),
        body: t('tour.addBookBody'),
      },
      {
        id: 'language',
        emoji: '🌐',
        title: t('tour.languageTitle'),
        body: t('tour.languageBody'),
      },
    ],
    [t]
  );

  const steps = stepsProp ?? defaultSteps;

  useEffect(() => {
    if (open) setIndex(0);
  }, [open]);

  const step = steps[index];
  const isLast = index >= steps.length - 1;
  const isWelcome = index === 0;

  const next = useCallback(() => {
    if (isLast) onFinish();
    else setIndex((i) => i + 1);
  }, [isLast, onFinish]);

  if (!open || !step) return null;

  return (
    <Div
      className="fixed inset-0 z-[80] flex items-center justify-center p-4"
      role="dialog"
      aria-modal
    >
      <Button
        type="button"
        className="absolute inset-0 bg-black/55 border-0"
        onClick={() => (onSkip ?? onFinish)()}
        aria-label={t('action.close')}
      />
      <Div
        className={`relative z-10 w-full max-w-md rounded-3xl p-5 sm:p-6 border shadow-2xl ${
          theme.isDark
            ? 'bg-[#1E1E28]/95 border-[#2A2A3A] text-white'
            : 'bg-white border-gray-200 text-gray-900'
        }`}
      >
        <Div className="text-3xl mb-2">{step.emoji}</Div>
        <Div className={`font-['Comfortaa'] font-bold text-lg ${theme.accent}`}>
          {step.title}
        </Div>
        <Div className={`text-sm mt-2 leading-relaxed ${theme.textMuted}`}>
          {step.body}
        </Div>
        <Div className="mt-5 flex items-center justify-between gap-2">
          <Span className={`text-[11px] font-bold ${theme.textMuted}`}>
            {index + 1} / {steps.length}
          </Span>
          <Div className="flex gap-2">
            {!isLast ? (
              <Button
                type="button"
                className={`rounded-xl px-3 py-2 text-xs font-bold ${theme.textMuted} ${theme.hover}`}
                onClick={() => (onSkip ?? onFinish)()}
              >
                {t('action.skip')}
              </Button>
            ) : null}
            <Button
              type="button"
              className={`rounded-xl px-4 py-2 text-xs font-bold ${theme.cta}`}
              onClick={next}
            >
              {isWelcome && !isLast
                ? t('action.start')
                : isLast
                  ? t('action.done')
                  : t('action.next')}
            </Button>
          </Div>
        </Div>
      </Div>
    </Div>
  );
}

/** @deprecated используйте шаги из OnboardingTour через i18n */
export const DEFAULT_TOUR_STEPS: TourStep[] = [];
