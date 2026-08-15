import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { getCatalogTagOptions } from '../data/catalogStories';
import {
  catalogCategoryOptions,
  catalogLanguageOptions,
  catalogLevelOptions,
  catalogStoryCardTitles,
  catalogStoryDescription,
  catalogStoryLevelLabel,
  catalogTagLabel,
  catalogTextsCountLabel,
} from '../i18n/catalogI18n';
import { useI18n } from '../i18n/useI18n';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import {
  findImportedCatalogBook,
  getCatalogStories,
  importCatalogStory,
} from '../services/catalogService';
import { listPublicCollections } from '../services/publicCollectionsService';
import {
  listPublicDecks,
  type PublicDeckDoc,
} from '../services/publicDecksService';
import { getAllReadingProgress } from '../services/readingProgressStore';
import { isPublicCollectionOwner } from '../services/rbac';
import { getBooks } from '../services/storageService';
import { useAppStore } from '../store/useAppStore';
import type {
  Book,
  CatalogCategoryId,
  CatalogLevelId,
  CatalogStory,
  LearningLanguage,
  PublicCollectionDoc,
} from '../types';
import { HighlightText } from '../utils/searchHighlight';
import { showAlert } from '../utils/alert';
import { StoryList, type StoryShelfTab } from './StoryList';
import { Button, Div, Input, Span } from './dom';
import { useWebTheme } from './webTheme';

const SEARCH_DEBOUNCE_MS = 400;

const TONE_GRADIENT: Record<CatalogStory['coverTone'], string> = {
  sky: 'linear-gradient(145deg, #0ea5e9 0%, #0369a1 55%, #0f172a 100%)',
  rose: 'linear-gradient(145deg, #fb7185 0%, #be123c 55%, #1c1917 100%)',
  lime: 'linear-gradient(145deg, #bef264 0%, #65a30d 50%, #14532d 100%)',
  amber: 'linear-gradient(145deg, #fbbf24 0%, #d97706 55%, #451a03 100%)',
  violet: 'linear-gradient(145deg, #a78bfa 0%, #6d28d9 55%, #1e1b4b 100%)',
  teal: 'linear-gradient(145deg, #2dd4bf 0%, #0f766e 55%, #042f2e 100%)',
};

const GLASS_CARD =
  'rounded-2xl bg-[#1E1E28]/80 backdrop-blur-md border border-[#2A2A3A] overflow-hidden flex flex-col transition hover:border-[#8B5CF6]/40';

const BADGE_PUBLIC =
  'text-[9px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-[#D0FF00]/15 text-[#D0FF00] border border-[#D0FF00]/25';
const BADGE_OWNER =
  'text-[9px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-[#8B5CF6]/25 text-[#c4b5fd] border border-[#8B5CF6]/35';

const SHELF_TABS: Array<{ id: StoryShelfTab; labelKey: 'stories.tab.new' | 'stories.tab.reading' | 'stories.tab.completed' }> = [
  { id: 'new', labelKey: 'stories.tab.new' },
  { id: 'reading', labelKey: 'stories.tab.reading' },
  { id: 'completed', labelKey: 'stories.tab.completed' },
];

interface StoriesPageProps {
  preferredLanguage?: LearningLanguage;
  ownedBookIds?: Set<string>;
  onBack?: () => void;
  onOpenMyLibrary?: () => void;
  onOpenBook: (book: Book) => void;
  onOpenPublicCollection?: (slug: string) => void;
  onOpenPublicDeck?: (slug: string) => void;
}

function Chip({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  const theme = useWebTheme();
  return (
    <Button
      type="button"
      className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold border transition ${
        active
          ? 'bg-[#D0FF00] border-[#D0FF00] text-[#0D0D11]'
          : theme.isDark
            ? 'bg-[#1E1E28]/80 border-[#2A2A3A] text-white/55 backdrop-blur-md'
            : `${theme.card} ${theme.textMuted}`
      }`}
      onClick={onClick}
    >
      {label}
    </Button>
  );
}

/** Каталог 小说: заголовок, полки (новинки/читаю/прочитано), карточки через i18n. */
export function StoriesPage({
  preferredLanguage = 'zh',
  ownedBookIds,
  onBack,
  onOpenMyLibrary,
  onOpenBook,
  onOpenPublicCollection,
  onOpenPublicDeck,
}: StoriesPageProps) {
  const theme = useWebTheme();
  const { t } = useI18n();
  // Прямая подписка — UI каталога следует за nativeLanguage без залипания
  const uiLang = useAppStore((s) => s.nativeLanguage);
  const [shelfTab, setShelfTab] = useState<StoryShelfTab>('new');
  const [language, setLanguage] = useState<LearningLanguage | 'all'>(
    preferredLanguage
  );
  const [level, setLevel] = useState<CatalogLevelId | 'all'>('all');
  const [category, setCategory] = useState<CatalogCategoryId | 'all'>('all');
  const [tag, setTag] = useState<string | 'all'>('all');
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebouncedValue(query, SEARCH_DEBOUNCE_MS);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [owned, setOwned] = useState<Set<string>>(ownedBookIds ?? new Set());
  const [selected, setSelected] = useState<CatalogStory | null>(null);
  const [publicCols, setPublicCols] = useState<PublicCollectionDoc[]>([]);
  const [publicDecks, setPublicDecks] = useState<PublicDeckDoc[]>([]);
  const [publicLoading, setPublicLoading] = useState(true);
  const [publicError, setPublicError] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [progressByCatalogId, setProgressByCatalogId] = useState<
    Record<string, { percent: number }>
  >({});

  const tagOptions = useMemo(() => getCatalogTagOptions(), []);
  const languageOptions = useMemo(() => catalogLanguageOptions(uiLang), [uiLang]);
  const levelOptions = useMemo(() => catalogLevelOptions(uiLang), [uiLang]);
  const categoryOptions = useMemo(() => catalogCategoryOptions(uiLang), [uiLang]);

  useEffect(() => {
    setLanguage(preferredLanguage);
  }, [preferredLanguage]);

  useEffect(() => {
    if (ownedBookIds) setOwned(ownedBookIds);
  }, [ownedBookIds]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const books = await getBooks();
        const progressList = await getAllReadingProgress();
        if (cancelled) return;
        const byCatalog: Record<string, { percent: number }> = {};
        const catalogByBook = new Map(
          books.filter((b) => b.catalogId).map((b) => [b.id, b.catalogId!])
        );
        for (const p of progressList) {
          const catalogId = catalogByBook.get(p.bookId);
          if (catalogId) {
            byCatalog[catalogId] = { percent: p.percent };
          }
        }
        setProgressByCatalogId(byCatalog);
      } catch (err) {
        console.warn('[StoriesPage] progress load failed', err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [owned]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setPublicLoading(true);
      setPublicError(false);
      try {
        const [cols, decks] = await Promise.all([
          listPublicCollections(debouncedQuery),
          listPublicDecks(debouncedQuery),
        ]);
        if (!cancelled) {
          setPublicCols(cols);
          setPublicDecks(decks);
        }
      } catch (err) {
        console.warn('[StoriesPage] public collections failed', err);
        if (!cancelled) {
          setPublicCols([]);
          setPublicError(true);
        }
      } finally {
        if (!cancelled) setPublicLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [debouncedQuery]);

  const stories = useMemo(
    () =>
      getCatalogStories({
        language,
        level,
        category,
        tag,
        query: debouncedQuery,
      }),
    [language, level, category, tag, debouncedQuery]
  );

  const refreshOwned = useCallback(async (storyId: string) => {
    const book = await findImportedCatalogBook(storyId);
    if (book) {
      setOwned((prev) => new Set(prev).add(storyId));
    }
  }, []);

  const handleImport = async (story: CatalogStory, open: boolean) => {
    if (busyId) return;
    setBusyId(story.id);
    try {
      const book = await importCatalogStory(story.id);
      setOwned((prev) => new Set(prev).add(story.id));
      setSelected(null);
      if (open) {
        onOpenBook(book);
      }
    } catch (err) {
      console.error('[StoriesPage] import failed', err);
      showAlert(
        t('alert.error'),
        err instanceof Error ? err.message : t('catalog.importFail')
      );
    } finally {
      setBusyId(null);
    }
  };

  const activeFilterCount =
    (language !== 'all' && language !== preferredLanguage ? 1 : 0) +
    (level !== 'all' ? 1 : 0) +
    (category !== 'all' ? 1 : 0) +
    (tag !== 'all' ? 1 : 0);

  const shellBg = theme.isDark ? 'bg-[#0D0D11]' : theme.card;
  const glassCard = theme.isDark
    ? GLASS_CARD
    : 'rounded-2xl bg-white/80 backdrop-blur-md border border-gray-200 overflow-hidden flex flex-col';

  return (
    <Div
      className={`${shellBg} border ${
        theme.isDark ? 'border-[#2A2A3A]' : 'border-gray-200'
      } rounded-2xl flex-1 min-w-0 overflow-hidden flex flex-col`}
      data-ui-lang={uiLang}
      key={`stories-ui-${uiLang}`}
    >
      <Div
        className={`px-3 py-2 flex items-center gap-2 border-b ${
          theme.isDark
            ? 'bg-[#1E1E28]/80 border-[#2A2A3A] backdrop-blur-md'
            : theme.titlebar
        }`}
      >
        {onBack ? (
          <Button
            type="button"
            className={`shrink-0 w-7 h-7 rounded-lg flex items-center justify-center ${theme.accent} ${theme.hover} transition font-bold text-base`}
            onClick={onBack}
            title={t('action.back')}
            aria-label={t('action.back')}
          >
            ←
          </Button>
        ) : null}
        <Span
          className={`flex-1 text-center text-sm font-semibold ${theme.accent} font-['Comfortaa'] ${
            onBack ? 'pr-7' : ''
          }`}
        >
          {t('stories.pageTitle')}
        </Span>
      </Div>

      <Div
        className={`px-3 pt-2 pb-2 space-y-1.5 border-b shrink-0 ${
          theme.isDark ? 'border-[#2A2A3A]/80' : 'border-gray-100'
        }`}
      >
        <Div className="flex items-center gap-2">
          <Div className="flex gap-1.5 overflow-x-auto flex-1 min-w-0 pb-0.5">
            {SHELF_TABS.map((tab) => (
              <Chip
                key={tab.id}
                active={shelfTab === tab.id}
                label={t(tab.labelKey)}
                onClick={() => setShelfTab(tab.id)}
              />
            ))}
          </Div>
          {onOpenMyLibrary ? (
            <Button
              type="button"
              className={`shrink-0 text-[10px] font-bold ${theme.textMuted} ${theme.hover} px-1.5 py-1 rounded-lg`}
              onClick={onOpenMyLibrary}
            >
              → {t('catalog.myLibrary')}
            </Button>
          ) : null}
        </Div>

        <Div className="flex items-center gap-1.5">
          <Input
            type="search"
            value={query}
            onChange={(e: { target: { value: string } }) => setQuery(e.target.value)}
            placeholder={t('catalog.searchPlaceholder')}
            className={`flex-1 min-w-0 rounded-lg px-2.5 py-1.5 text-xs outline-none border ${
              theme.isDark
                ? 'bg-[#1E1E28]/80 border-[#2A2A3A] text-white placeholder:text-white/35 backdrop-blur-md focus:border-[#8B5CF6]/50'
                : 'bg-white border-gray-200 text-gray-900 placeholder:text-gray-400'
            }`}
            aria-label={t('catalog.searchAria')}
          />
          <Button
            type="button"
            className={`shrink-0 rounded-lg px-2.5 py-1.5 text-[10px] font-bold border transition ${
              filtersOpen || activeFilterCount > 0
                ? 'bg-[#D0FF00]/15 border-[#D0FF00]/40 text-[#D0FF00]'
                : theme.isDark
                  ? 'border-[#2A2A3A] text-white/60'
                  : 'border-gray-200 text-gray-500'
            }`}
            onClick={() => setFiltersOpen((v) => !v)}
            aria-expanded={filtersOpen}
          >
            {filtersOpen
              ? t('catalog.hideFilters')
              : activeFilterCount > 0
                ? t('catalog.filtersActive', { n: activeFilterCount })
                : t('catalog.filters')}
          </Button>
        </Div>

        {filtersOpen ? (
          <Div className="space-y-1.5 pt-0.5">
            <Div className="flex gap-1.5 overflow-x-auto pb-0.5">
              {languageOptions.map((opt) => (
                <Chip
                  key={opt.id}
                  active={language === opt.id}
                  label={opt.label}
                  onClick={() => setLanguage(opt.id)}
                />
              ))}
            </Div>
            <Div className="flex gap-1.5 overflow-x-auto pb-0.5">
              {levelOptions.map((opt) => (
                <Chip
                  key={opt.id}
                  active={level === opt.id}
                  label={opt.label}
                  onClick={() => setLevel(opt.id)}
                />
              ))}
            </Div>
            <Div className="flex gap-1.5 overflow-x-auto pb-0.5">
              {categoryOptions.map((opt) => (
                <Chip
                  key={opt.id}
                  active={category === opt.id}
                  label={opt.label}
                  onClick={() => setCategory(opt.id)}
                />
              ))}
            </Div>
            {tagOptions.length > 0 ? (
              <Div className="flex gap-1.5 overflow-x-auto pb-0.5">
                <Chip
                  active={tag === 'all'}
                  label={t('catalog.allTags')}
                  onClick={() => setTag('all')}
                />
                {tagOptions.map((tagId) => (
                  <Chip
                    key={tagId}
                    active={tag === tagId}
                    label={catalogTagLabel(tagId, uiLang)}
                    onClick={() => setTag(tag === tagId ? 'all' : tagId)}
                  />
                ))}
              </Div>
            ) : null}
          </Div>
        ) : null}
      </Div>

      <Div className="flex-1 overflow-y-auto p-3 space-y-4">
        <Div className="space-y-2">
          <Div
            className={`text-[10px] font-bold uppercase tracking-wider ${theme.accent}`}
          >
            {t('catalog.readyTexts')}
          </Div>
          <Div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-2 gap-3 content-start">
            <StoryList
              stories={stories}
              shelfTab={shelfTab}
              owned={owned}
              progressByCatalogId={progressByCatalogId}
              query={debouncedQuery}
              activeTag={tag}
              busyId={busyId}
              disabled={!!busyId}
              cardClassName={glassCard}
              onOpen={(s) => {
                setSelected(s);
                void refreshOwned(s.id);
              }}
              onTagClick={(tagId) =>
                setTag(tag === tagId ? 'all' : tagId)
              }
              onPrimaryAction={(s, open) => void handleImport(s, open)}
            />
          </Div>
        </Div>

        {!publicLoading && publicCols.length > 0 ? (
          <Div className="space-y-2">
            <Div
              className={`text-[10px] font-bold uppercase tracking-wider ${theme.accent}`}
            >
              {t('catalog.publicCollections')}
            </Div>
            <Div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {publicCols.map((col) => {
                const isMine = isPublicCollectionOwner(col);
                return (
                  <Button
                    key={col.slug}
                    type="button"
                    className={`${glassCard} text-left p-2.5 hover:border-[#8B5CF6]/50 transition`}
                    onClick={() => onOpenPublicCollection?.(col.slug)}
                    disabled={!onOpenPublicCollection}
                  >
                    <Div className="flex items-start gap-2.5">
                      <Div
                        className="w-8 h-8 rounded-lg shrink-0"
                        style={{ background: col.color || '#8B5CF6' }}
                      />
                      <Div className="min-w-0 flex-1 space-y-0.5">
                        <Div className="flex flex-wrap gap-1">
                          <Span className={BADGE_PUBLIC}>
                            {t('catalog.badgePublic')}
                          </Span>
                          {isMine ? (
                            <Span className={BADGE_OWNER}>
                              {t('catalog.badgeOwner')}
                            </Span>
                          ) : null}
                        </Div>
                        <HighlightText
                          text={col.title}
                          query={debouncedQuery}
                          className={`font-bold text-sm font-['Comfortaa'] line-clamp-2 block ${theme.text}`}
                        />
                        <Div
                          className={`text-[10px] font-semibold ${theme.textMuted}`}
                        >
                          {catalogTextsCountLabel(col.books?.length ?? 0, uiLang)}
                          {' · '}
                          {isMine
                            ? t('catalog.youAreAuthor')
                            : t('catalog.readOnly')}
                        </Div>
                      </Div>
                    </Div>
                  </Button>
                );
              })}
            </Div>
          </Div>
        ) : null}

        {!publicLoading && publicDecks.length > 0 ? (
          <Div className="space-y-2">
            <Div
              className={`text-[10px] font-bold uppercase tracking-wider ${theme.accent}`}
            >
              {t('catalog.publicDecks')}
            </Div>
            <Div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {publicDecks.map((deck) => (
                <Button
                  key={deck.slug}
                  type="button"
                  className={`${glassCard} text-left p-2.5 hover:border-[#D0FF00]/40 transition`}
                  onClick={() => onOpenPublicDeck?.(deck.slug)}
                  disabled={!onOpenPublicDeck}
                >
                  <Div className="flex items-start gap-2.5">
                    <Div className="w-8 h-8 rounded-lg shrink-0 bg-[#D0FF00]/20 flex items-center justify-center text-sm">
                      🃏
                    </Div>
                    <Div className="min-w-0 flex-1 space-y-0.5">
                      <Span className={BADGE_PUBLIC}>
                        {t('catalog.badgePublic')}
                      </Span>
                      <HighlightText
                        text={deck.title}
                        query={debouncedQuery}
                        className={`font-bold text-sm font-['Comfortaa'] line-clamp-2 block ${theme.text}`}
                      />
                      <Div
                        className={`text-[10px] font-semibold ${theme.textMuted}`}
                      >
                        {t('catalog.deckCardsCount', {
                          n: deck.cardCount || deck.cards.length,
                        })}
                        {' · '}
                        {String(deck.language || 'all').toUpperCase()}
                      </Div>
                    </Div>
                  </Div>
                </Button>
              ))}
            </Div>
          </Div>
        ) : null}
      </Div>

      {selected ? (
        <Div
          className="fixed inset-0 z-[70] flex items-center justify-center p-4"
          style={{ background: theme.modalOverlay }}
          onClick={() => setSelected(null)}
          role="dialog"
          aria-label={t('catalog.bookCardAria')}
        >
          <Div
            className={`rounded-2xl w-full max-w-md overflow-hidden shadow-2xl border ${
              theme.isDark
                ? 'bg-[#1E1E28]/95 border-[#2A2A3A] backdrop-blur-xl'
                : 'bg-white border-gray-200'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <Div
              className="h-40 px-5 py-4 flex flex-col justify-between"
              style={{ background: TONE_GRADIENT[selected.coverTone] }}
            >
              <Div className="flex justify-between items-start">
                <Span className="text-4xl">{selected.coverEmoji}</Span>
                <Button
                  type="button"
                  className="text-white/90 font-bold text-sm px-2"
                  onClick={() => setSelected(null)}
                  aria-label={t('action.close')}
                >
                  ✕
                </Button>
              </Div>
              <Div>
                {(() => {
                  const { primary, secondary } = catalogStoryCardTitles(
                    selected,
                    uiLang
                  );
                  return (
                    <>
                      <Div className="text-white font-bold text-lg font-['Comfortaa'] leading-snug">
                        {primary}
                      </Div>
                      {secondary ? (
                        <Div className="text-white/90 text-sm mt-1 leading-snug">
                          {secondary}
                        </Div>
                      ) : null}
                    </>
                  );
                })()}
                <Div className="text-white/80 text-xs mt-1.5">
                  {catalogStoryLevelLabel(selected, uiLang)}
                </Div>
              </Div>
            </Div>
            <Div className="p-4 space-y-3">
              <Div className={`text-sm leading-relaxed ${theme.text}`}>
                {catalogStoryDescription(selected, uiLang)}
              </Div>
              <Div className="flex flex-col gap-2">
                {owned.has(selected.id) ? (
                  <Button
                    type="button"
                    className={`w-full rounded-2xl py-2.5 text-sm font-bold ${theme.cta}`}
                    disabled={!!busyId}
                    onClick={() => void handleImport(selected, true)}
                  >
                    {t('catalog.openInReader')}
                  </Button>
                ) : (
                  <>
                    <Button
                      type="button"
                      className={`w-full rounded-2xl py-2.5 text-sm font-bold ${theme.cta}`}
                      disabled={!!busyId}
                      onClick={() => void handleImport(selected, false)}
                    >
                      {busyId === selected.id
                        ? t('catalog.adding')
                        : t('catalog.addToLibrary')}
                    </Button>
                    <Button
                      type="button"
                      className={`w-full rounded-2xl py-2.5 text-sm font-bold border ${
                        theme.isDark
                          ? 'border-[#2A2A3A] text-white/80 hover:bg-[#2A2A3A]'
                          : `${theme.border} ${theme.text}`
                      }`}
                      disabled={!!busyId}
                      onClick={() => void handleImport(selected, true)}
                    >
                      {t('catalog.addAndRead')}
                    </Button>
                  </>
                )}
              </Div>
            </Div>
          </Div>
        </Div>
      ) : null}
    </Div>
  );
}
