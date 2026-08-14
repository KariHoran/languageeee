import React from 'react';
import { useI18n } from '../i18n/useI18n';
import type { UiMessageKey } from '../i18n/uiMessages';
import { Button, Div, Span } from './dom';
import { useWebTheme } from './webTheme';

export type EmptyStateVariant = 'library' | 'collections' | 'generic';

interface EmptyStateProps {
  icon?: string;
  title?: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
  /** library | collections — готовые тексты под бренд */
  variant?: EmptyStateVariant;
  /** Компактный блок для боковой панели подборок */
  compact?: boolean;
}

const VARIANT_KEYS: Record<
  EmptyStateVariant,
  {
    icon: string;
    title: UiMessageKey;
    description: UiMessageKey;
    actionLabel: UiMessageKey;
  }
> = {
  library: {
    icon: '☁️',
    title: 'empty.libraryTitle',
    description: 'empty.libraryDesc',
    actionLabel: 'empty.libraryAction',
  },
  collections: {
    icon: '📁',
    title: 'empty.collectionsTitle',
    description: 'empty.collectionsDesc',
    actionLabel: 'empty.collectionsAction',
  },
  generic: {
    icon: '✨',
    title: 'empty.genericTitle',
    description: 'empty.genericDesc',
    actionLabel: 'empty.genericAction',
  },
};

/** Фирменная заглушка: стекло + lime CTA + pink акцент */
export function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  secondaryLabel,
  onSecondary,
  variant = 'generic',
  compact = false,
}: EmptyStateProps) {
  const theme = useWebTheme();
  const { t } = useI18n();
  const keys = VARIANT_KEYS[variant];
  const resolvedIcon = icon ?? keys.icon;
  const resolvedTitle = title ?? t(keys.title);
  const resolvedDescription = description ?? t(keys.description);
  const resolvedAction =
    actionLabel ?? (onAction ? t(keys.actionLabel) : undefined);

  const glass = theme.isDark
    ? 'bg-[#1E1E28]/80 backdrop-blur-md border border-[#2A2A3A]'
    : 'bg-white/80 backdrop-blur-md border border-gray-200 shadow-sm';

  if (compact) {
    return (
      <Div
        className={`${glass} rounded-2xl px-3 py-4 flex flex-col items-center text-center gap-2`}
      >
        <Span className="text-2xl leading-none">{resolvedIcon}</Span>
        <Div className={`font-['Comfortaa'] font-bold text-xs text-pink-400`}>
          {resolvedTitle}
        </Div>
        {resolvedDescription ? (
          <Div className={`text-[10px] ${theme.textMuted} leading-snug`}>
            {resolvedDescription}
          </Div>
        ) : null}
        {resolvedAction && onAction ? (
          <Button
            type="button"
            className={`mt-1 w-full rounded-xl px-3 py-2 text-[11px] transition ${theme.cta}`}
            onClick={onAction}
          >
            {resolvedAction}
          </Button>
        ) : null}
      </Div>
    );
  }

  return (
    <Div
      className={`${glass} rounded-3xl px-6 py-10 sm:px-10 sm:py-12 flex flex-col items-center justify-center text-center gap-3 max-w-md mx-auto`}
    >
      <Span
        className="text-5xl leading-none mb-1 select-none"
        aria-hidden
      >
        {resolvedIcon}
      </Span>
      <Div className={`font-['Comfortaa'] font-bold text-xl text-pink-400`}>
        {resolvedTitle}
      </Div>
      <Div className={`text-sm ${theme.textMuted} max-w-sm leading-relaxed`}>
        {resolvedDescription}
      </Div>
      {resolvedAction && onAction ? (
        <Button
          type="button"
          className={`mt-4 rounded-2xl px-6 py-3 text-sm transition shadow-[0_0_24px_rgba(208,255,0,0.18)] ${theme.cta}`}
          onClick={onAction}
        >
          {resolvedAction}
        </Button>
      ) : null}
      {secondaryLabel && onSecondary ? (
        <Button
          type="button"
          className={`rounded-2xl px-4 py-2 text-xs font-bold transition text-pink-400 ${theme.hover}`}
          onClick={onSecondary}
        >
          {secondaryLabel}
        </Button>
      ) : null}
    </Div>
  );
}
