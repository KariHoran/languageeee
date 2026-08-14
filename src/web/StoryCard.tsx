import React from 'react';
import {
  catalogLanguageLabel,
  catalogStoryCardTitles,
  catalogStoryChaptersLabel,
  catalogStoryDescription,
  catalogStoryLevelLabel,
  catalogStoryStatusLabel,
  catalogTagLabel,
} from '../i18n/catalogI18n';
import { translateUi } from '../i18n/uiMessages';
import { useAppStore } from '../store/useAppStore';
import type { CatalogStory, NativeLanguage } from '../types';
import { HighlightText } from '../utils/searchHighlight';
import { Button, Div, Span } from './dom';
import { useWebTheme } from './webTheme';

const TONE_GRADIENT: Record<CatalogStory['coverTone'], string> = {
  sky: 'linear-gradient(145deg, #0ea5e9 0%, #0369a1 55%, #0f172a 100%)',
  rose: 'linear-gradient(145deg, #fb7185 0%, #be123c 55%, #1c1917 100%)',
  lime: 'linear-gradient(145deg, #bef264 0%, #65a30d 50%, #14532d 100%)',
  amber: 'linear-gradient(145deg, #fbbf24 0%, #d97706 55%, #451a03 100%)',
  violet: 'linear-gradient(145deg, #a78bfa 0%, #6d28d9 55%, #1e1b4b 100%)',
  teal: 'linear-gradient(145deg, #2dd4bf 0%, #0f766e 55%, #042f2e 100%)',
};

export interface StoryCardProps {
  story: CatalogStory;
  /** @deprecated Игнорируется — UI-язык всегда из Zustand nativeLanguage */
  lang?: NativeLanguage;
  query?: string;
  activeTag?: string | 'all';
  isOwned: boolean;
  busy: boolean;
  disabled?: boolean;
  readPercent?: number;
  className?: string;
  onOpen: (story: CatalogStory) => void;
  onTagClick: (tagId: string) => void;
  onPrimaryAction: (story: CatalogStory, open: boolean) => void;
}

/**
 * Карточка 小说 в каталоге.
 * Все подписи — только через translateUi(nativeLanguage). Никакого RU в JSX.
 * Подписка на Zustand напрямую: смена nativeLanguage → мгновенный ререндер.
 */
export function StoryCard({
  story,
  query = '',
  activeTag = 'all',
  isOwned,
  busy,
  disabled,
  readPercent,
  className = '',
  onOpen,
  onTagClick,
  onPrimaryAction,
}: StoryCardProps) {
  const theme = useWebTheme();
  // Прямая подписка на store — не через проп (проп мог залипнуть на 'ru')
  const uiLang = useAppStore((s) => s.nativeLanguage);
  const t = (key: Parameters<typeof translateUi>[0], vars?: Record<string, string | number>) =>
    translateUi(key, uiLang, vars);

  const tags = (story.tags ?? []).slice(0, 3);
  const { primary, secondary } = catalogStoryCardTitles(story, uiLang);
  const description = catalogStoryDescription(story, uiLang);
  const chaptersLabel = catalogStoryChaptersLabel(story, uiLang);
  const statusValue = catalogStoryStatusLabel(story, uiLang, readPercent);

  return (
    <Div
      className={className}
      data-ui-lang={uiLang}
      data-story-id={story.id}
      key={`story-card-${story.id}-${uiLang}`}
    >
      <Button
        type="button"
        className="text-left w-full"
        onClick={() => onOpen(story)}
      >
        <Div
          className="h-32 px-4 py-3 flex flex-col justify-between"
          style={{ background: TONE_GRADIENT[story.coverTone] }}
        >
          <Div className="flex items-start justify-between gap-2">
            <Span className="text-3xl leading-none drop-shadow">
              {story.coverEmoji}
            </Span>
            <Span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-black/40 text-white backdrop-blur-sm">
              {catalogLanguageLabel(story.language, uiLang)}
            </Span>
          </Div>
          <Div>
            <HighlightText
              text={primary}
              query={query}
              className="text-white font-bold text-sm leading-snug font-['Comfortaa'] drop-shadow line-clamp-2 block"
            />
            {secondary ? (
              <HighlightText
                text={secondary}
                query={query}
                className="text-white/90 text-[11px] mt-0.5 leading-snug drop-shadow line-clamp-1 block"
              />
            ) : null}
          </Div>
        </Div>
      </Button>

      <Div className="px-3 py-2.5 flex-1 flex flex-col gap-2">
        <Div className={`text-[11px] ${theme.textMuted}`}>
          {chaptersLabel}
          {' · '}
          {t('stories.statusLabel')} {statusValue}
        </Div>

        <Div className="flex flex-wrap gap-1.5">
          <Span
            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
              theme.isDark
                ? 'bg-[#8B5CF6]/20 text-[#c4b5fd]'
                : 'bg-purple-50 text-purple-700'
            }`}
          >
            {catalogStoryLevelLabel(story, uiLang)}
          </Span>
          {tags.map((tagId) => (
            <Button
              key={tagId}
              type="button"
              className={`text-[10px] font-bold px-2 py-0.5 rounded-full transition ${
                activeTag === tagId
                  ? 'bg-[#D0FF00] text-[#0D0D11]'
                  : theme.isDark
                    ? 'bg-[#D0FF00]/12 text-[#D0FF00] hover:bg-[#D0FF00]/25'
                    : 'bg-lime-50 text-lime-800'
              }`}
              onClick={(e) => {
                e.stopPropagation();
                onTagClick(tagId);
              }}
            >
              {catalogTagLabel(tagId, uiLang)}
            </Button>
          ))}
          {isOwned ? (
            <Span
              className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                theme.isDark
                  ? 'bg-white/10 text-white/60'
                  : 'bg-gray-100 text-gray-600'
              }`}
            >
              {t('catalog.inLibrary')}
            </Span>
          ) : null}
        </Div>
        {description ? (
          <HighlightText
            text={description}
            query={query}
            className={`text-xs leading-relaxed line-clamp-2 block ${theme.textMuted}`}
          />
        ) : null}
        <Div className="mt-auto flex flex-col gap-1.5 pt-1">
          {isOwned ? (
            <Button
              type="button"
              disabled={disabled}
              className={`w-full rounded-xl py-2 text-xs font-bold transition ${theme.cta} disabled:opacity-50`}
              onClick={() => onPrimaryAction(story, true)}
            >
              {busy ? t('catalog.opening') : t('action.read')}
            </Button>
          ) : (
            <Button
              type="button"
              disabled={disabled}
              className={`w-full rounded-xl py-2 text-xs font-bold transition ${theme.cta} disabled:opacity-50`}
              onClick={() => onPrimaryAction(story, false)}
            >
              {busy ? t('catalog.adding') : t('catalog.addToLibrary')}
            </Button>
          )}
        </Div>
      </Div>
    </Div>
  );
}
