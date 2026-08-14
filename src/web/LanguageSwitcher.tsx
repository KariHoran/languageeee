import React from 'react';
import { directionLabel } from '../services/languageConfig';
import { useAppStore } from '../store/useAppStore';
import type { LearningLanguage, NativeLanguage } from '../types';
import {
  LEARNING_LANGUAGE_OPTIONS,
  NATIVE_LANGUAGE_OPTIONS,
} from '../types';
import { useI18n } from '../i18n/useI18n';
import { Button, Div, Span } from './dom';
import { useWebTheme } from './webTheme';

interface LanguageSwitcherProps {
  /** Компактный режим для шапки */
  compact?: boolean;
  className?: string;
  onLearningChange?: (lang: LearningLanguage) => void;
  onNativeChange?: (lang: NativeLanguage) => void;
}

/**
 * Селектор направления: Learning ↔ Native.
 * zh / ru / en freely selectable on both sides (including same language).
 */
export function LanguageSwitcher({
  compact = false,
  className = '',
  onLearningChange,
  onNativeChange,
}: LanguageSwitcherProps) {
  const theme = useWebTheme();
  const { t } = useI18n();
  const learningLanguage = useAppStore((s) => s.learningLanguage);
  const nativeLanguage = useAppStore((s) => s.nativeLanguage);
  const setLearningLanguage = useAppStore((s) => s.setLearningLanguage);
  const setNativeLanguage = useAppStore((s) => s.setNativeLanguage);

  const pairHint = directionLabel(learningLanguage, nativeLanguage);

  return (
    <Div
      className={`flex flex-col gap-1.5 ${className}`}
      data-tour="language-switcher"
    >
      <Div className="flex items-center gap-2 flex-wrap">
        <Span
          className={`${compact ? 'text-[9px]' : 'text-[10px]'} font-bold uppercase tracking-wide ${theme.textMuted}`}
        >
          {t('lang.learn')}
        </Span>
        <Div
          className={`flex rounded-2xl overflow-hidden border ${theme.border}`}
          role="group"
          aria-label={t('lang.learn')}
        >
          {LEARNING_LANGUAGE_OPTIONS.map((opt) => {
            const active = learningLanguage === opt.id;
            return (
              <Button
                key={`learn-${opt.id}`}
                type="button"
                className={`${
                  compact ? 'px-2 py-1 text-[10px]' : 'px-2.5 py-1.5 text-[11px]'
                } font-bold transition ${
                  active
                    ? 'bg-[#D0FF00] text-[#0D0D11]'
                    : `${theme.card} ${theme.textMuted} hover:opacity-90`
                }`}
                onClick={() => {
                  setLearningLanguage(opt.id);
                  onLearningChange?.(opt.id);
                }}
                title={opt.label}
                aria-pressed={active}
              >
                {opt.shortLabel}
              </Button>
            );
          })}
        </Div>
        <Span className="text-[10px] font-bold text-[#FF6584]">→</Span>
        <Span
          className={`${compact ? 'text-[9px]' : 'text-[10px]'} font-bold uppercase tracking-wide ${theme.textMuted}`}
        >
          {t('lang.native')}
        </Span>
        <Div
          className={`flex rounded-2xl overflow-hidden border ${theme.border}`}
          role="group"
          aria-label={t('lang.native')}
        >
          {NATIVE_LANGUAGE_OPTIONS.map((opt) => {
            const active = nativeLanguage === opt.id;
            return (
              <Button
                key={`native-${opt.id}`}
                type="button"
                className={`${
                  compact ? 'px-2 py-1 text-[10px]' : 'px-2.5 py-1.5 text-[11px]'
                } font-bold transition ${
                  active
                    ? 'bg-[#FF6584] text-white'
                    : `${theme.card} ${theme.textMuted} hover:opacity-90`
                }`}
                onClick={() => {
                  setNativeLanguage(opt.id);
                  onNativeChange?.(opt.id);
                }}
                title={opt.label}
                aria-pressed={active}
              >
                {opt.shortLabel}
              </Button>
            );
          })}
        </Div>
      </Div>
      {!compact ? (
        <Div className={`text-[10px] font-semibold ${theme.textMuted}`}>
          {pairHint}
        </Div>
      ) : null}
    </Div>
  );
}
