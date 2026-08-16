import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  COLLECTION_COLORS,
  DEFAULT_COLLECTION_COLOR,
  FALLBACK_COLLECTION_COLOR,
} from '../constants/colors';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import {
  createUserCollection,
  deleteBook,
  deleteCollection,
  getBooks,
  getCollections,
  UNCATEGORIZED_COLLECTION_ID,
  updateBookMeta,
  updateCollection,
} from '../services/storageService';
import {
  publicCollectionUrl,
  setCollectionPublic,
} from '../services/publicCollectionsService';
import { getCloudUid } from '../services/authService';
import { canEditBook, canEditCollection } from '../services/rbac';
import {
  getAllReadingProgress,
  type ReadingProgress,
} from '../services/readingProgressStore';
import { subscribeLocalDataReset } from '../services/localDataResetService';
import { subscribeSyncState } from '../services/syncService';
import type { Book, Collection, LearningLanguage } from '../types';
import { showAlert, showConfirm } from '../utils/alert';
import { shareOrCopyUrl } from '../utils/shareUrl';
import { bookMatchesQuery } from '../utils/bookSearch';
import {
  formatBookTitleLine,
  resolveBookDisplayTitles,
  resolveBookTitles,
} from '../utils/bookTitle';
import { HighlightText } from '../utils/searchHighlight';
import { useI18n } from '../i18n/useI18n';
import { useAppStore } from '../store/useAppStore';
import { Button, Div, Input, Span } from './dom';
import { EmptyState } from './EmptyState';
import { useWebTheme } from './webTheme';

const SYSTEM_PROTECTED = new Set([UNCATEGORIZED_COLLECTION_ID]);
const SEARCH_DEBOUNCE_MS = 400;

const BADGE_PUBLIC =
  'text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-[#D0FF00]/15 text-[#D0FF00] border border-[#D0FF00]/25';
const BADGE_PRIVATE =
  'text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-white/8 text-white/50 border border-[#2A2A3A]';

type CategoryFilter = 'all' | string;

interface MyLibraryPanelProps {
  preferredLanguage?: LearningLanguage;
  activeBookId?: string | null;
  /** После импорта публичной подборки — сразу открыть эту категорию */
  focusCollectionId?: string | null;
  onFocusCollectionConsumed?: () => void;
  onBack?: () => void;
  onOpenBook: (book: Book) => void;
  onAddBook: (collectionId?: string) => void;
  onOpenExplore?: () => void;
  onLibraryChanged?: () => void;
}

function bookLang(book: Book): LearningLanguage {
  if (book.language === 'en') return 'en';
  if (book.language === 'ru') return 'ru';
  return 'zh';
}

/** Полноценная «Моя библиотека»: категории, CRUD книг, открытие в ридере */
export function MyLibraryPanel({
  preferredLanguage = 'zh',
  activeBookId,
  focusCollectionId = null,
  onFocusCollectionConsumed,
  onBack,
  onOpenBook,
  onAddBook,
  onOpenExplore,
  onLibraryChanged,
}: MyLibraryPanelProps) {
  const theme = useWebTheme();
  const { t } = useI18n();
  const lang = useAppStore((s) => s.nativeLanguage);
  const [books, setBooks] = useState<Book[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [progressByBook, setProgressByBook] = useState<
    Record<string, ReadingProgress>
  >({});
  const [categoryId, setCategoryId] = useState<CategoryFilter>('all');
  const [langFilter, setLangFilter] = useState<LearningLanguage | 'all'>(
    preferredLanguage
  );
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebouncedValue(query, SEARCH_DEBOUNCE_MS);
  const [loading, setLoading] = useState(true);

  const [showNewCategory, setShowNewCategory] = useState(false);
  const [newCatTitle, setNewCatTitle] = useState('');
  const [newCatColor, setNewCatColor] = useState(DEFAULT_COLLECTION_COLOR);

  const [editBook, setEditBook] = useState<Book | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editRussianTitle, setEditRussianTitle] = useState('');
  const [editCollectionId, setEditCollectionId] = useState<string>(
    UNCATEGORIZED_COLLECTION_ID
  );

  const [renameCat, setRenameCat] = useState<Collection | null>(null);
  const [renameTitle, setRenameTitle] = useState('');
  const [renamePublic, setRenamePublic] = useState(false);
  const [publishBusy, setPublishBusy] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [allBooks, allCols, allProgress] = await Promise.all([
        getBooks(),
        getCollections(),
        getAllReadingProgress(),
      ]);
      setBooks(allBooks);
      const progressMap: Record<string, ReadingProgress> = {};
      for (const p of allProgress) progressMap[p.bookId] = p;
      setProgressByBook(progressMap);
      setCollections(
        allCols.sort((a, b) => {
          if (a.id === UNCATEGORIZED_COLLECTION_ID) return 1;
          if (b.id === UNCATEGORIZED_COLLECTION_ID) return -1;
          return a.title.localeCompare(b.title, 'ru');
        })
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    return subscribeSyncState((state) => {
      if (state.status === 'synced') void reload();
    });
  }, [reload]);

  useEffect(() => {
    return subscribeLocalDataReset(() => {
      setBooks([]);
      setCollections([]);
      setProgressByBook({});
      setCategoryId('all');
      setEditBook(null);
      setRenameCat(null);
      void reload();
    });
  }, [reload]);

  useEffect(() => {
    setLangFilter(preferredLanguage);
  }, [preferredLanguage]);

  useEffect(() => {
    if (!focusCollectionId) return;
    if (!collections.some((c) => c.id === focusCollectionId)) {
      void reload();
      // Не крутим reload бесконечно, если id так и не появился
      const t = setTimeout(() => onFocusCollectionConsumed?.(), 2500);
      return () => clearTimeout(t);
    }
    setCategoryId(focusCollectionId);
    onFocusCollectionConsumed?.();
  }, [focusCollectionId, collections, reload, onFocusCollectionConsumed]);

  const collectionById = useMemo(() => {
    const map = new Map<string, Collection>();
    for (const c of collections) map.set(c.id, c);
    return map;
  }, [collections]);

  const userCollections = useMemo(
    () => collections.filter((c) => !SYSTEM_PROTECTED.has(c.id)),
    [collections]
  );

  const libraryIsEmpty = !loading && books.length === 0;

  const countsByCollection = useMemo(() => {
    const map = new Map<string, number>();
    for (const b of books) {
      const id = b.collectionId || UNCATEGORIZED_COLLECTION_ID;
      map.set(id, (map.get(id) ?? 0) + 1);
    }
    return map;
  }, [books]);

  const visibleBooks = useMemo(() => {
    const q = debouncedQuery.trim();
    return books.filter((b) => {
      if (langFilter !== 'all' && bookLang(b) !== langFilter) return false;
      const cid = b.collectionId || UNCATEGORIZED_COLLECTION_ID;
      if (categoryId !== 'all' && cid !== categoryId) return false;
      return bookMatchesQuery(b, q);
    });
  }, [books, langFilter, categoryId, debouncedQuery]);
  const notify = () => {
    onLibraryChanged?.();
    void reload();
  };

  const handleCreateCategory = async () => {
    try {
      const col = await createUserCollection(newCatTitle, newCatColor);
      setShowNewCategory(false);
      setNewCatTitle('');
      setCategoryId(col.id);
      notify();
    } catch (err) {
      showAlert(t('alert.category'), err instanceof Error ? err.message : String(err));
    }
  };

  const handleRenameCategory = async () => {
    if (!renameCat) return;
    if (!canEditCollection(renameCat)) {
      showAlert(t('alert.noAccess'), t('alert.editCollectionOwnerOnly'));
      return;
    }
    setPublishBusy(true);
    try {
      const updated = await updateCollection(renameCat.id, {
        title: renameTitle.trim() || renameCat.title,
      });
      if (!updated) return;

      const wantPublic = renamePublic;
      const wasPublic = !!renameCat.isPublic;
      let published = updated;

      if (wantPublic !== wasPublic) {
        if (wantPublic && !getCloudUid()) {
          showAlert(t('alert.publish'), t('alert.publishLoginRequired'));
          setRenamePublic(false);
        } else {
          const next = await setCollectionPublic(renameCat.id, wantPublic);
          if (next) published = next;
        }
      } else if (wantPublic) {
        const next = await setCollectionPublic(renameCat.id, true);
        if (next) published = next;
      }

      if (wantPublic && published.shareSlug) {
        const url = publicCollectionUrl(published.shareSlug);
        const mode = await shareOrCopyUrl(url, {
          title: published.title || 'languageeee',
          text: t('alert.published'),
        });
        if (mode === 'copied') {
          showAlert(t('alert.published'), t('alert.linkCopied', { url }));
        } else if (mode === 'shown') {
          showAlert(t('alert.published'), url);
        }
      }

      setRenameCat(null);
      notify();
    } catch (err) {
      showAlert(
        t('alert.publish'),
        err instanceof Error ? err.message : String(err)
      );
    } finally {
      setPublishBusy(false);
    }
  };

  const handleCopyShareLink = async () => {
    if (!renameCat?.shareSlug && !renamePublic) return;
    const slug = renameCat?.shareSlug;
    if (!slug) {
      showAlert(t('alert.linkTitle'), t('alert.linkAfterPublish'));
      return;
    }
    const url = publicCollectionUrl(slug);
    const mode = await shareOrCopyUrl(url, {
      title: renameCat?.title || 'languageeee',
    });
    if (mode === 'copied' || mode === 'shared') {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } else {
      showAlert(t('alert.linkTitle'), url);
    }
  };

  const handleDeleteCategory = (col: Collection) => {
    if (!canEditCollection(col)) {
      showAlert(t('alert.noAccess'), t('alert.editCollectionOnly'));
      return;
    }
    if (SYSTEM_PROTECTED.has(col.id)) {
      showAlert(t('alert.noAccess'), t('alert.cannotDeleteSystem'));
      return;
    }
    showConfirm(
      t('alert.deleteCategory'),
      t('alert.deleteCategoryBody', { title: col.title }),
      () => {
        void (async () => {
          const removedId = col.id;
          // Оптимистично убираем из UI сразу
          setCollections((prev) => prev.filter((c) => c.id !== removedId));
          setBooks((prev) =>
            prev.map((b) =>
              b.collectionId === removedId
                ? { ...b, collectionId: undefined }
                : b
            )
          );
          if (categoryId === removedId) setCategoryId('all');

          try {
            await deleteCollection(removedId);
            onLibraryChanged?.();
            // Синхронизируем с диском (без воскрешения удалённых)
            const [allBooks, allCols] = await Promise.all([
              getBooks(),
              getCollections(),
            ]);
            setBooks(allBooks);
            setCollections(
              allCols.sort((a, b) => {
                if (a.id === UNCATEGORIZED_COLLECTION_ID) return 1;
                if (b.id === UNCATEGORIZED_COLLECTION_ID) return -1;
                return a.title.localeCompare(b.title, 'ru');
              })
            );
          } catch (err) {
            showAlert(
              t('alert.error'),
              err instanceof Error ? err.message : String(err)
            );
            // Откат: полная перезагрузка
            await reload();
          }
        })();
      }
    );
  };

  const handleDeleteBook = (book: Book) => {
    if (!canEditBook(book)) {
      showAlert(t('alert.noAccess'), t('alert.deleteAuthorOnly'));
      return;
    }
    showConfirm(
      t('alert.deleteFanfic'),
      t('alert.deleteFanficNamed', {
        title: formatBookTitleLine(book, lang),
      }),
      () => {
        void (async () => {
          try {
            await deleteBook(book.id);
            notify();
          } catch (err) {
            showAlert(
              t('alert.error'),
              err instanceof Error ? err.message : String(err)
            );
          }
        })();
      }
    );
  };

  const openEditBook = (book: Book) => {
    if (!canEditBook(book)) {
      showAlert(t('alert.noAccess'), t('alert.editFanficOnly'));
      return;
    }
    const { original, russian } = resolveBookTitles(book);
    setEditBook(book);
    setEditTitle(original);
    setEditRussianTitle(russian);
    setEditCollectionId(book.collectionId || UNCATEGORIZED_COLLECTION_ID);
  };

  const saveEditBook = async () => {
    if (!editBook) return;
    if (!canEditBook(editBook)) {
      showAlert(t('alert.noAccess'), t('alert.editFanficOnly'));
      return;
    }
    await updateBookMeta(editBook.id, {
      title: editTitle.trim() || editBook.title,
      russianTitle: editRussianTitle.trim() || undefined,
      collectionId: editCollectionId,
    });
    setEditBook(null);
    notify();
  };

  return (
    <Div
      className={`${theme.card} rounded-2xl flex-1 min-w-0 overflow-hidden flex flex-col`}
    >
      <Div className={`${theme.titlebar} px-3 py-2.5 flex items-center gap-3`}>
        {onBack ? (
          <Button
            type="button"
            className={`shrink-0 w-8 h-8 rounded-xl flex items-center justify-center ${theme.accent} ${theme.hover} transition font-bold text-lg`}
            onClick={onBack}
            aria-label={t('action.back')}
          >
            ←
          </Button>
        ) : null}
        <Span
          className={`flex-1 text-center text-sm font-semibold ${theme.accent} font-['Comfortaa'] ${
            onBack ? 'pr-8' : ''
          }`}
        >
          {t('nav.library')}
        </Span>
      </Div>

      <Div className="px-4 pt-3 pb-2 space-y-2 border-b border-white/5">
        <Div className="flex flex-wrap gap-2">
          <Button
            type="button"
            className={`flex-1 min-w-[140px] rounded-2xl text-sm py-2.5 transition ${theme.cta}`}
            onClick={() =>
              onAddBook(
                categoryId !== 'all' ? categoryId : UNCATEGORIZED_COLLECTION_ID
              )
            }
          >
            + {t('action.addFanfic')}
          </Button>
          <Button
            type="button"
            className={`rounded-2xl px-3 py-2.5 text-sm font-bold border transition ${theme.border} ${theme.text} ${theme.hover}`}
            onClick={() => setShowNewCategory(true)}
          >
            {t('library.addCategory')}
          </Button>
          {onOpenExplore ? (
            <Button
              type="button"
              className={`rounded-2xl px-3 py-2.5 text-xs font-bold transition ${theme.hover} ${theme.textMuted}`}
              onClick={onOpenExplore}
            >
              {t('action.openExplore')} →
            </Button>
          ) : null}
        </Div>

        <Input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('library.searchPlaceholder')}
          className={`w-full rounded-xl px-3 py-2 text-sm outline-none border ${
            theme.isDark
              ? 'bg-[#1E1E28]/80 border-[#2A2A3A] text-white placeholder:text-white/35 backdrop-blur-md focus:border-[#8B5CF6]/50'
              : 'bg-white border-gray-200 text-gray-900 placeholder:text-gray-400'
          }`}
          aria-label={t('library.searchAria')}
        />
        {query !== debouncedQuery ? (
          <Div className={`text-[10px] ${theme.textMuted}`}>{t('library.searching')}</Div>
        ) : null}
        <Div className="flex gap-2 overflow-x-auto pb-0.5">
          {(
            [
              { id: 'all' as const, label: t('lang.all') },
              { id: 'zh' as const, label: t('lang.zh') },
              { id: 'ru' as const, label: t('lang.ru') },
              { id: 'en' as const, label: t('lang.en') },
            ] as const
          ).map((opt) => (
            <Button
              key={opt.id}
              type="button"
              className={`shrink-0 rounded-full px-3 py-1.5 text-[11px] font-bold border transition ${
                langFilter === opt.id
                  ? 'bg-[#D0FF00] border-[#D0FF00] text-[#0D0D11]'
                  : `${theme.card} ${theme.textMuted}`
              }`}
              onClick={() => setLangFilter(opt.id)}
            >
              {opt.label}
            </Button>
          ))}
        </Div>
      </Div>

      <Div className="flex-1 min-h-0 flex flex-col md:flex-row">
        {/* Categories */}
        <Div
          className={`md:w-52 shrink-0 border-b md:border-b-0 md:border-r ${theme.border} overflow-y-auto p-3 space-y-1 max-h-[28vh] md:max-h-none`}
        >
          <Button
            type="button"
            className={`w-full text-left rounded-xl px-3 py-2 text-xs font-bold transition ${
              categoryId === 'all'
                ? 'bg-[#D0FF00]/15 text-[#D0FF00]'
                : `${theme.textMuted} ${theme.hover}`
            }`}
            onClick={() => setCategoryId('all')}
          >
            {t('library.allBooks')}
            <Span className="opacity-60"> · {books.length}</Span>
          </Button>
          {userCollections.length === 0 ? (
            <EmptyState
              compact
              variant="collections"
              description={t('library.emptyCollectionsHint')}
              onAction={() => setShowNewCategory(true)}
            />
          ) : (
            userCollections.map((col) => {
              const count = countsByCollection.get(col.id) ?? 0;
              const active = categoryId === col.id;
              const isOwner = canEditCollection(col);
              return (
                <Div key={col.id} className="group relative">
                  <Button
                    type="button"
                    className={`w-full text-left rounded-xl px-3 py-2 text-xs font-semibold transition flex items-center gap-2 ${
                      active
                        ? 'bg-[#D0FF00]/15 text-[#D0FF00]'
                        : `${theme.textMuted} ${theme.hover}`
                    }`}
                    onClick={() => setCategoryId(col.id)}
                  >
                    <Span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ background: col.color || '#8b5cf6' }}
                    />
                    <Span className="truncate flex-1">{col.title}</Span>
                    <Span className="opacity-50">{count}</Span>
                  </Button>
                  <Div className="flex flex-wrap items-center gap-1 px-2 pb-1">
                    {col.isPublic ? (
                      <Span className={BADGE_PUBLIC}>{t('catalog.badgePublic')}</Span>
                    ) : (
                      <Span
                        className={
                          theme.isDark
                            ? BADGE_PRIVATE
                            : 'text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500 border border-gray-200'
                        }
                      >
                        {t('catalog.badgeOwner')}
                      </Span>
                    )}
                    {isOwner ? (
                      <>
                        <Button
                          type="button"
                          className={`text-[10px] font-bold ${theme.textMuted} ${theme.hover} rounded px-1.5 py-0.5`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setRenameCat(col);
                            setRenameTitle(col.title);
                            setRenamePublic(!!col.isPublic);
                            setCopiedLink(false);
                          }}
                          title={t('library.editOwner')}
                        >
                          ✎
                        </Button>
                        <Button
                          type="button"
                          className={`text-[10px] font-bold ${theme.danger} rounded px-1.5 py-0.5`}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteCategory(col);
                          }}
                          title={t('library.deleteOwner')}
                        >
                          ✕
                        </Button>
                      </>
                    ) : null}
                  </Div>
                </Div>
              );
            })
          )}
          {/* Системная «Без категории» — только если есть */}
          {collections
            .filter((c) => SYSTEM_PROTECTED.has(c.id))
            .map((col) => {
              const count = countsByCollection.get(col.id) ?? 0;
              const active = categoryId === col.id;
              return (
                <Button
                  key={col.id}
                  type="button"
                  className={`w-full text-left rounded-xl px-3 py-2 text-xs font-semibold transition flex items-center gap-2 ${
                    active
                      ? 'bg-[#D0FF00]/15 text-[#D0FF00]'
                      : `${theme.textMuted} ${theme.hover}`
                  }`}
                  onClick={() => setCategoryId(col.id)}
                >
                  <Span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ background: col.color || FALLBACK_COLLECTION_COLOR }}
                  />
                  <Span className="truncate flex-1">{col.title}</Span>
                  <Span className="opacity-50">{count}</Span>
                </Button>
              );
            })}
        </Div>

        {/* Books */}
        <Div className="flex-1 overflow-y-auto p-4 grid grid-cols-1 sm:grid-cols-2 gap-3 content-start">
          {loading ? (
            <Div className={`col-span-full text-center py-10 ${theme.textMuted}`}>
              {t('library.loading')}
            </Div>
          ) : libraryIsEmpty ? (
            <Div className="col-span-full flex items-center justify-center min-h-[280px]">
              <EmptyState
                variant="library"
                onAction={() => onAddBook()}
                secondaryLabel={onOpenExplore ? t('action.openExplore') : undefined}
                onSecondary={onOpenExplore}
              />
            </Div>
          ) : visibleBooks.length === 0 ? (
            <Div className="col-span-full flex items-center justify-center min-h-[200px]">
              <EmptyState
                icon="🔍"
                title={t('library.nothingFound')}
                description={t('library.nothingFoundHint')}
                actionLabel={t('library.resetFilters')}
                onAction={() => {
                  setCategoryId('all');
                  setLangFilter('all');
                  setQuery('');
                }}
              />
            </Div>
          ) : (
            visibleBooks.map((book) => {
              const col =
                collectionById.get(book.collectionId || UNCATEGORIZED_COLLECTION_ID) ??
                null;
              const isActive = activeBookId === book.id;
              const progress = progressByBook[book.id];
              const hasProgress =
                !!progress && progress.paragraphIndex > 0;
              return (
                  <Div
                    key={`${book.id}-${lang}`}
                    className={`rounded-2xl border px-3 py-3 flex flex-col gap-2 transition backdrop-blur-md ${
                      theme.isDark
                        ? 'bg-[#1E1E28]/80 border-[#2A2A3A]'
                        : 'bg-white'
                    } ${
                      isActive
                        ? 'border-[#D0FF00]/60'
                        : ''
                    }`}
                    data-ui-lang={lang}
                  >
                  <Button
                    type="button"
                    className="text-left w-full"
                    onClick={() => onOpenBook(book)}
                  >
                    {(() => {
                      const { original, native } = resolveBookDisplayTitles(
                        book,
                        lang
                      );
                      return (
                        <>
                          <HighlightText
                            text={original}
                            query={debouncedQuery}
                            className={`font-bold text-sm leading-snug block ${theme.text}`}
                          />
                          {native ? (
                            <HighlightText
                              text={native}
                              query={debouncedQuery}
                              className={`text-[11px] mt-0.5 leading-snug block ${theme.textMuted}`}
                            />
                          ) : null}
                        </>
                      );
                    })()}                    <Div className={`text-[11px] ${theme.textMuted} mt-1`}>
                      {(book.language ?? 'zh').toUpperCase()}
                      {book.catalogId
                        ? ` · ${t('library.fromCatalog')}`
                        : ''}
                      {' · '}
                      {t('library.paragraphs', {
                        n: book.paragraphs.length,
                      })}
                      {progress
                        ? ` · ${Math.round(progress.percent)}%`
                        : ''}
                    </Div>
                    {progress ? (
                      <Div
                        className={`mt-2 h-1.5 rounded-full overflow-hidden ${
                          theme.isDark ? 'bg-[#2A2A3A]' : 'bg-gray-100'
                        }`}
                      >
                        <Div
                          className="h-full rounded-full bg-[#D0FF00]"
                          style={{
                            width: `${Math.min(100, progress.percent)}%`,
                          }}
                        />
                      </Div>
                    ) : null}
                  </Button>
                  {col ? (
                    <Span
                      className="self-start text-[10px] font-bold px-2 py-0.5 rounded-full"
                      style={{
                        background: `${col.color || '#8b5cf6'}33`,
                        color: col.color || FALLBACK_COLLECTION_COLOR,
                      }}
                    >
                      {col.title}
                    </Span>
                  ) : null}
                  <Div className="flex gap-1.5 mt-auto pt-1">
                    <Button
                      type="button"
                      className={`flex-1 rounded-xl py-1.5 text-[11px] font-bold ${theme.cta}`}
                      onClick={() => onOpenBook(book)}
                    >
                      {hasProgress ? t('action.continue') : t('action.read')}
                    </Button>
                    {canEditBook(book) ? (
                      <>
                        <Button
                          type="button"
                          className={`rounded-xl px-2.5 py-1.5 text-[11px] font-bold border ${theme.border} ${theme.text} ${theme.hover}`}
                          onClick={() => openEditBook(book)}
                          title={t('library.editOwner')}
                        >
                          ✎
                        </Button>
                        <Button
                          type="button"
                          className={`rounded-xl px-2.5 py-1.5 text-[11px] font-bold border ${theme.border} ${theme.danger}`}
                          onClick={() => handleDeleteBook(book)}
                          title={t('library.deleteOwner')}
                        >
                          🗑
                        </Button>
                      </>
                    ) : null}
                  </Div>
                </Div>
              );
            })
          )}
        </Div>
      </Div>

      {/* New category modal */}
      {showNewCategory ? (
        <Div
          className="fixed inset-0 z-[70] flex items-center justify-center p-4"
          style={{ background: theme.modalOverlay }}
          onClick={() => setShowNewCategory(false)}
        >
          <Div
            className={`${theme.card} rounded-2xl w-full max-w-sm p-4 space-y-3 overflow-hidden`}
            onClick={(e) => e.stopPropagation()}
          >
            <Div className={`font-bold ${theme.accent}`}>{t('library.newCategory')}</Div>
            <Input
              value={newCatTitle}
              onChange={(e) => setNewCatTitle(e.target.value)}
              placeholder={t('library.newCategoryPlaceholder')}
              className={`w-full rounded-xl px-3 py-2 text-sm border outline-none ${
                theme.isDark
                  ? 'bg-[#16161E] border-[#2A2A3A] text-white'
                  : 'bg-white border-gray-200 text-gray-900'
              }`}
            />
            <Div className="flex flex-wrap gap-2 w-full max-w-full min-w-0">
              {COLLECTION_COLORS.map((c) => (
                <Button
                  key={c}
                  type="button"
                  className={`w-7 h-7 shrink-0 rounded-full border-2 ${
                    newCatColor === c ? 'border-white scale-110' : 'border-transparent'
                  }`}
                  style={{ background: c }}
                  onClick={() => setNewCatColor(c)}
                />
              ))}
            </Div>
            <Div className="flex gap-2">
              <Button
                type="button"
                className={`flex-1 rounded-xl py-2 text-sm font-bold ${theme.cta}`}
                onClick={() => void handleCreateCategory()}
              >
                {t('action.create')}
              </Button>
              <Button
                type="button"
                className={`rounded-xl px-4 py-2 text-sm ${theme.textMuted}`}
                onClick={() => setShowNewCategory(false)}
              >
                {t('action.cancel')}
              </Button>
            </Div>
          </Div>
        </Div>
      ) : null}

      {/* Rename / publish category */}
      {renameCat ? (
        <Div
          className="fixed inset-0 z-[70] flex items-center justify-center p-4"
          style={{ background: theme.modalOverlay }}
          onClick={() => !publishBusy && setRenameCat(null)}
        >
          <Div
            className={`rounded-2xl w-full max-w-sm p-4 space-y-3 border ${
              theme.isDark
                ? 'bg-[#1E1E28]/95 border-[#2A2A3A] backdrop-blur-xl'
                : theme.card
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <Div className={`font-bold ${theme.accent} font-['Comfortaa']`}>
              {t('public.title')}
            </Div>
            {renameCat && canEditCollection(renameCat) ? (
              <Div className="flex flex-wrap gap-1.5">
                {renameCat.isPublic || renamePublic ? (
                  <Span className={BADGE_PUBLIC}>{t('catalog.badgePublic')}</Span>
                ) : (
                  <Span className={BADGE_PRIVATE}>{t('catalog.badgeOwner')}</Span>
                )}
                <Span
                  className={`text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full ${
                    theme.isDark
                      ? 'bg-[#8B5CF6]/20 text-[#c4b5fd] border border-[#8B5CF6]/30'
                      : 'bg-purple-50 text-purple-700 border border-purple-100'
                  }`}
                >
                  {t('library.editOwner')}
                </Span>
              </Div>
            ) : (
              <Div className={`text-xs ${theme.textMuted}`}>
                {t('alert.noAccess')}
              </Div>
            )}
            <Input
              value={renameTitle}
              onChange={(e) => setRenameTitle(e.target.value)}
              disabled={!canEditCollection(renameCat)}
              className={`w-full rounded-xl px-3 py-2 text-sm border outline-none disabled:opacity-50 ${
                theme.isDark
                  ? 'bg-[#16161E] border-[#2A2A3A] text-white'
                  : 'bg-white border-gray-200 text-gray-900'
              }`}
            />            <Div
              className={`rounded-xl px-3 py-2.5 border space-y-2 ${
                theme.isDark
                  ? 'bg-[#16161E]/80 border-[#2A2A3A]'
                  : 'bg-gray-50 border-gray-200'
              }`}
            >
              <Div className="flex items-center justify-between gap-2">
                <Div>
                  <Div className={`text-xs font-bold ${theme.text}`}>
                    {t('public.title')}
                  </Div>
                  <Div className={`text-[10px] mt-0.5 ${theme.textMuted}`}>
                    {t('public.editHint')}
                  </Div>
                </Div>
                <Button
                  type="button"
                  disabled={publishBusy || !canEditCollection(renameCat)}
                  className={`shrink-0 rounded-full px-3 py-1.5 text-[11px] font-bold transition disabled:opacity-50 ${
                    renamePublic
                      ? 'bg-[#D0FF00] text-[#0D0D11]'
                      : theme.isDark
                        ? 'bg-[#2A2A3A] text-white/60'
                        : 'bg-gray-200 text-gray-600'
                  }`}
                  onClick={() => {
                    if (!canEditCollection(renameCat)) return;
                    setRenamePublic((v) => !v);
                  }}
                  aria-pressed={renamePublic}
                >
                  {renamePublic ? t('action.on') : t('action.off')}
                </Button>
              </Div>

              {(renamePublic || renameCat.isPublic) && renameCat.shareSlug ? (
                <Div className="space-y-1.5">
                  <Div
                    className={`text-[10px] font-mono break-all px-2 py-1.5 rounded-lg ${
                      theme.isDark
                        ? 'bg-[#0D0D11] text-[#D0FF00]/90'
                        : 'bg-white text-purple-700 border border-gray-200'
                    }`}
                  >
                    {publicCollectionUrl(renameCat.shareSlug)}
                  </Div>
                  <Button
                    type="button"
                    className={`w-full rounded-xl py-1.5 text-[11px] font-bold border ${
                      theme.isDark
                        ? 'border-[#2A2A3A] text-white/80 hover:bg-[#2A2A3A]'
                        : `${theme.border} ${theme.text}`
                    }`}
                    onClick={() => void handleCopyShareLink()}
                  >
                    {copiedLink ? t('action.copied') : t('action.copyLink')}
                  </Button>
                </Div>
              ) : renamePublic && !renameCat.shareSlug ? (
                <Div className={`text-[10px] ${theme.textMuted}`}>
                  {t('library.linkAfterSave')}
                </Div>
              ) : null}
            </Div>

            <Div className="flex gap-2">
              <Button
                type="button"
                disabled={publishBusy || !canEditCollection(renameCat)}
                className={`flex-1 rounded-xl py-2 text-sm font-bold ${theme.cta} disabled:opacity-50`}
                onClick={() => void handleRenameCategory()}
              >
                {publishBusy ? t('action.saving') : t('action.save')}
              </Button>
              <Button
                type="button"
                disabled={publishBusy}
                className={`rounded-xl px-4 py-2 text-sm ${theme.textMuted}`}
                onClick={() => setRenameCat(null)}
              >
                {t('action.cancel')}
              </Button>
            </Div>
          </Div>
        </Div>
      ) : null}

      {/* Edit book */}
      {editBook ? (
        <Div
          className="fixed inset-0 z-[70] flex items-center justify-center p-4"
          style={{ background: theme.modalOverlay }}
          onClick={() => setEditBook(null)}
        >
          <Div
            className={`${theme.card} rounded-2xl w-full max-w-sm p-4 space-y-3`}
            onClick={(e) => e.stopPropagation()}
          >
            <Div className={`font-bold ${theme.accent}`}>{t('library.editBook')}</Div>
            <Div className={`text-[10px] uppercase font-bold ${theme.textMuted}`}>
              {t('library.originalTitle')}
            </Div>
            <Input
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className={`w-full rounded-xl px-3 py-2 text-sm border outline-none ${
                theme.isDark
                  ? 'bg-[#16161E] border-[#2A2A3A] text-white'
                  : 'bg-white border-gray-200 text-gray-900'
              }`}
            />
            <Div className={`text-[10px] uppercase font-bold ${theme.textMuted}`}>
              {t('library.translatedTitle')}
            </Div>
            <Input
              value={editRussianTitle}
              onChange={(e) => setEditRussianTitle(e.target.value)}
              placeholder={t('library.optionalPlaceholder')}
              className={`w-full rounded-xl px-3 py-2 text-sm border outline-none ${
                theme.isDark
                  ? 'bg-[#16161E] border-[#2A2A3A] text-white'
                  : 'bg-white border-gray-200 text-gray-900'
              }`}
            />
            <Div className={`text-[10px] uppercase font-bold ${theme.textMuted}`}>
              {t('library.categoryLabel')}
            </Div>
            <Div className="flex flex-col gap-1.5 max-h-40 overflow-y-auto">
              {collections.map((col) => (
                <Button
                  key={col.id}
                  type="button"
                  className={`text-left rounded-xl px-3 py-2 text-xs font-semibold border transition ${
                    editCollectionId === col.id
                      ? 'bg-[#D0FF00] border-[#D0FF00] text-[#0D0D11]'
                      : `${theme.card} ${theme.text}`
                  }`}
                  onClick={() => setEditCollectionId(col.id)}
                >
                  {col.title}
                </Button>
              ))}
            </Div>
            <Div className={`text-xs ${theme.textMuted}`}>
              {t('library.languageHint', {
                lang: (editBook.language ?? 'zh').toUpperCase(),
              })}
            </Div>
            <Div className="flex gap-2">
              <Button
                type="button"
                className={`flex-1 rounded-xl py-2 text-sm font-bold ${theme.cta}`}
                onClick={() => void saveEditBook()}
              >
                {t('action.save')}
              </Button>
              <Button
                type="button"
                className={`rounded-xl px-4 py-2 text-sm ${theme.textMuted}`}
                onClick={() => setEditBook(null)}
              >
                {t('action.cancel')}
              </Button>
            </Div>
          </Div>
        </Div>
      ) : null}
    </Div>
  );
}
