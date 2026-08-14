import React, { type Ref } from 'react';
import { useI18n } from '../i18n/useI18n';
import { Button, Div, Span } from './dom';
import { useWebTheme } from './webTheme';

export function TrafficLights({ onClose }: { onClose?: () => void }) {
  const { t } = useI18n();
  return (
    <Div className="flex items-center gap-1.5 shrink-0">
      {onClose ? (
        <Button
          type="button"
          className="w-3 h-3 rounded-full bg-red-400 shadow-sm hover:brightness-110 p-0 border-0"
          onClick={onClose}
          title={`${t('action.close')} / ${t('action.back')}`}
          aria-label={t('action.back')}
        />
      ) : (
        <Span className="w-3 h-3 rounded-full bg-red-400 shadow-sm" />
      )}
      <Span className="w-3 h-3 rounded-full bg-yellow-400 shadow-sm" />
      <Span className="w-3 h-3 rounded-full bg-green-400 shadow-sm" />
    </Div>
  );
}

interface GlassWindowProps {
  title?: string;
  widthClass?: string;
  className?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  onBack?: () => void;
  showBackButton?: boolean;
  /** Ref на scroll-контейнер (для прогресса чтения) */
  bodyRef?: Ref<HTMLDivElement>;
  onBodyScroll?: () => void;
}

export function GlassWindow({
  title,
  widthClass = '',
  className = '',
  children,
  footer,
  onBack,
  showBackButton = false,
  bodyRef,
  onBodyScroll,
}: GlassWindowProps) {
  const theme = useWebTheme();
  const { t } = useI18n();

  return (
    <Div
      className={`${theme.card} rounded-2xl overflow-hidden flex flex-col ${widthClass} ${className}`}
    >
      <Div className={`${theme.titlebar} px-3 py-2.5 flex items-center gap-3 shrink-0`}>
        <TrafficLights onClose={onBack} />
        {showBackButton && onBack ? (
          <Button
            type="button"
            className={`shrink-0 w-8 h-8 rounded-xl flex items-center justify-center ${theme.accent} ${theme.hover} transition font-bold text-lg`}
            onClick={onBack}
            title={t('action.back')}
            aria-label={t('action.back')}
          >
            ←
          </Button>
        ) : null}
        {title ? (
          <Span
            className={`flex-1 text-center text-sm font-semibold ${theme.accent} font-['Comfortaa'] truncate pr-8`}
          >
            {title}
          </Span>
        ) : (
          <Span className="flex-1" />
        )}
      </Div>
      <Div
        ref={bodyRef}
        className={`flex-1 min-h-0 overflow-y-auto p-4 ${theme.text}`}
        onScroll={onBodyScroll}
      >
        {children}
      </Div>
      {footer ? (
        <Div className={`shrink-0 px-4 pb-4 pt-1 border-t ${theme.border}`}>
          {footer}
        </Div>
      ) : null}
    </Div>
  );
}
