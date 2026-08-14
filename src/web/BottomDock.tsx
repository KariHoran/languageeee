import React from 'react';
import { useI18n } from '../i18n/useI18n';
import type { UiMessageKey } from '../i18n/uiMessages';
import { Button, Div, Span } from './dom';
import { useWebTheme } from './webTheme';

export type DockTab = 'home' | 'explore' | 'library' | 'flashcards' | 'settings';

interface BottomDockProps {
  active: DockTab;
  onSelect: (tab: DockTab) => void;
}

const ITEMS: Array<{ id: DockTab; icon: string; labelKey: UiMessageKey }> = [
  { id: 'home', icon: '🏠', labelKey: 'nav.home' },
  { id: 'explore', icon: '✨', labelKey: 'nav.explore' },
  { id: 'library', icon: '📚', labelKey: 'nav.library' },
  { id: 'flashcards', icon: '🌸', labelKey: 'nav.flashcards' },
  { id: 'settings', icon: '⚙️', labelKey: 'nav.settings' },
];

export function BottomDock({ active, onSelect }: BottomDockProps) {
  const theme = useWebTheme();
  const { t } = useI18n();

  return (
    <Div
      className="pointer-events-none absolute inset-x-0 z-50 flex justify-center"
      style={{
        bottom: 'max(0.75rem, env(safe-area-inset-bottom, 0px))',
      }}
    >
      <Div
        className={`pointer-events-auto rounded-full px-1.5 sm:px-2 py-1.5 sm:py-2 flex items-center gap-0.5 max-w-[min(100%,calc(100dvw-1.5rem))] overflow-x-auto overscroll-x-contain touch-pan-x ${theme.dock}`}
      >
        {ITEMS.map((item) => {
          const isActive = item.id === active;
          const label = t(item.labelKey);
          return (
            <Button
              key={item.id}
              type="button"
              className={`dock-btn flex flex-col items-center justify-center w-12 h-12 sm:w-14 sm:h-14 shrink-0 rounded-full transition ${
                isActive ? 'bg-[#D0FF00] text-[#0D0D11]' : theme.dockIdle
              }`}
              onClick={() => onSelect(item.id)}
              title={label}
            >
              <Span className="text-base sm:text-lg leading-none">{item.icon}</Span>
              <Span className="text-[8px] sm:text-[9px] font-bold mt-0.5 tracking-wide">
                {label}
              </Span>
            </Button>
          );
        })}
      </Div>
    </Div>
  );
}
