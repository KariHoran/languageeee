import React, { useMemo } from 'react';
import type { ReadingProgress } from '../services/readingProgressStore';
import { translateUi } from '../i18n/uiMessages';
import { useAppStore } from '../store/useAppStore';
import type { CatalogStory } from '../types';
import { StoryCard } from './StoryCard';
import { Div } from './dom';
import { useWebTheme } from './webTheme';

export type StoryShelfTab = 'new' | 'reading' | 'completed';

type CatalogProgress = Pick<ReadingProgress, 'percent'>;

export interface StoryListProps {
  stories: CatalogStory[];
  shelfTab: StoryShelfTab;
  owned: Set<string>;
  progressByCatalogId?: Record<string, CatalogProgress>;
  query?: string;
  activeTag?: string | 'all';
  busyId?: string | null;
  disabled?: boolean;
  cardClassName?: string;
  onOpen: (story: CatalogStory) => void;
  onTagClick: (tagId: string) => void;
  onPrimaryAction: (story: CatalogStory, open: boolean) => void;
}

function filterStoriesByShelf(
  stories: CatalogStory[],
  shelfTab: StoryShelfTab,
  owned: Set<string>,
  progressByCatalogId: Record<string, CatalogProgress>
): CatalogStory[] {
  return stories.filter((story) => {
    const isOwned = owned.has(story.id);
    const pct = progressByCatalogId[story.id]?.percent ?? 0;
    if (shelfTab === 'new') return !isOwned;
    if (shelfTab === 'reading') return isOwned && pct > 0 && pct < 100;
    return isOwned && (pct >= 100 || story.isComplete === true);
  });
}

/** Сетка карточек 小说 с фильтром по полке. Язык — только Zustand nativeLanguage. */
export function StoryList({
  stories,
  shelfTab,
  owned,
  progressByCatalogId = {},
  query = '',
  activeTag = 'all',
  busyId = null,
  disabled,
  cardClassName = '',
  onOpen,
  onTagClick,
  onPrimaryAction,
}: StoryListProps) {
  const theme = useWebTheme();
  const uiLang = useAppStore((s) => s.nativeLanguage);

  const visible = useMemo(
    () => filterStoriesByShelf(stories, shelfTab, owned, progressByCatalogId),
    [stories, shelfTab, owned, progressByCatalogId]
  );

  if (visible.length === 0) {
    return (
      <Div
        className={`col-span-full text-center py-8 ${theme.textMuted}`}
        data-ui-lang={uiLang}
      >
        {translateUi('catalog.noStories', uiLang)}
      </Div>
    );
  }

  return (
    <>
      {visible.map((story) => (
        <StoryCard
          key={`${story.id}-${uiLang}`}
          story={story}
          query={query}
          activeTag={activeTag}
          isOwned={owned.has(story.id)}
          busy={busyId === story.id}
          disabled={disabled}
          readPercent={progressByCatalogId[story.id]?.percent}
          className={cardClassName}
          onOpen={onOpen}
          onTagClick={onTagClick}
          onPrimaryAction={onPrimaryAction}
        />
      ))}
    </>
  );
}
