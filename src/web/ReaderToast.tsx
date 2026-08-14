import React, { useEffect } from 'react';
import { useI18n } from '../i18n/useI18n';
import { Button, Div, Span } from './dom';

interface ReaderToastProps {
  message: string;
  onClose: () => void;
  durationMs?: number;
}

/**
 * Короткий toast в стиле Dark Neon glass (успех скачивания и т.п.).
 */
export function ReaderToast({
  message,
  onClose,
  durationMs = 2800,
}: ReaderToastProps) {
  const { t } = useI18n();
  useEffect(() => {
    const timer = window.setTimeout(onClose, durationMs);
    return () => window.clearTimeout(timer);
  }, [onClose, durationMs, message]);

  return (
    <Div
      className="fixed bottom-24 sm:bottom-8 left-1/2 -translate-x-1/2 z-[80] px-3 w-[min(92vw,22rem)]"
      role="status"
      aria-live="polite"
    >
      <Div
        className="flex items-center gap-2.5 rounded-2xl px-3.5 py-2.5
          bg-[#1E1E28]/95 backdrop-blur-md border border-[#2A2A3A]
          shadow-[0_12px_40px_rgba(0,0,0,0.45)]"
      >
        <Span
          className="shrink-0 w-2 h-2 rounded-full bg-[#D0FF00]"
          aria-hidden
        />
        <Div className="flex-1 min-w-0 text-xs sm:text-sm font-semibold text-white/90 font-['Comfortaa'] leading-snug">
          {message}
        </Div>
        <Button
          type="button"
          className="shrink-0 text-[11px] font-bold text-[#c4b5fd] hover:text-[#D0FF00] transition px-1"
          onClick={onClose}
          aria-label={t('action.close')}
        >
          ✕
        </Button>
      </Div>
    </Div>
  );
}
