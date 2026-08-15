import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import AuthStatusBar from '../components/AuthStatusBar';
import AddBookScreen from '../screens/AddBookScreen';
import FlashcardsScreen from '../screens/FlashcardsScreen';
import { getFlashcardsCount } from '../services/flashcardsStore';
import {
  computeBookCoverage,
  type BookCoverage,
} from '../services/bookCoverageService';
import {
  clearReadingProgress,
  getContinueReading,
  resolveReadingProgress,
  type ReadingProgress,
} from '../services/readingProgressStore';
import {
  isTourCompleted,
  markTourCompleted,
  setLearningLanguage,
} from '../services/onboardingService';
import { loadStreak } from '../services/streakStore';
import { useActivitySessionTimer } from './useActivitySessionTimer';
import { deleteBook, getBooks } from '../services/storageService';
import {
  getAuthState,
  subscribeAuthState,
  type AuthState,
} from '../services/authService';
import { subscribeLocalDataReset } from '../services/localDataResetService';
import { subscribeSyncState } from '../services/syncService';
import { ttsService } from '../services/ttsService';
import { canEditBook } from '../services/rbac';
import { normalizeLearningLanguage } from '../services/languageConfig';
import { useAppStore } from '../store/useAppStore';
import type { Book, LearningLanguage } from '../types';
import { formatBookTitleLine } from '../utils/bookTitle';
import { showAlert, showConfirm } from '../utils/alert';
import { BottomDock, type DockTab } from './BottomDock';
import { CatalogPanel } from './CatalogPanel';
import { Button, Div, Span } from './dom';
import { InstallAppCard } from './InstallAppCard';
import { LanguageSwitcher } from './LanguageSwitcher';
import { useI18n } from '../i18n/useI18n';
import { MiniPlayPanel } from './MiniPlayPanel';
import { MyLibraryPanel } from './MyLibraryPanel';
import { OfflineBanner } from './OfflineBanner';
import { DueCardsBanner } from './DueCardsBanner';
import { OnboardingTour } from './OnboardingTour';
import { ProgressPanel } from './ProgressPanel';
import { PublicCollectionPanel } from './PublicCollectionPanel';
import { PublicDeckPanel } from './PublicDeckPanel';
import { PublicProfilePanel } from './PublicProfilePanel';
import { ReaderPanel } from './ReaderPanel';
import { StarryBackground } from './StarryBackground';
import { applyDocumentTheme, useWebTheme } from './webTheme';
import { pinBookForOffline } from '../services/offlineLibraryService';

type ShellView = DockTab | 'addBook' | 'publicShare';

function parseShareSlugFromPath(): string | null {
  if (typeof window === 'undefined') return null;
  const m = window.location.pathname.match(/^\/c\/([^/]+)\/?$/i);
  if (!m?.[1]) return null;
  try {
    return decodeURIComponent(m[1]);
  } catch {
    return m[1];
  }
}

function parseDeckSlugFromPath(): string | null {
  if (typeof window === 'undefined') return null;
  const m = window.location.pathname.match(/^\/d\/([^/]+)\/?$/i);
  if (!m?.[1]) return null;
  try {
    return decodeURIComponent(m[1]);
  } catch {
    return m[1];
  }
}

function parseProfileSlugFromPath(): string | null {
  if (typeof window === 'undefined') return null;
  const m = window.location.pathname.match(/^\/u\/([^/]+)\/?$/i);
  if (!m?.[1]) return null;
  try {
    return decodeURIComponent(m[1]);
  } catch {
    return m[1];
  }
}

function clearSharePath() {
  if (typeof window === 'undefined') return;
  if (
    /^\/c\//i.test(window.location.pathname) ||
    /^\/d\//i.test(window.location.pathname) ||
    /^\/u\//i.test(window.location.pathname)
  ) {
    window.history.replaceState({}, '', '/');
  }
}

function bookLanguage(book: Book): LearningLanguage {
  return normalizeLearningLanguage(book.language);
}

function pickBookForLang(list: Book[], lang: LearningLanguage): Book | null {
  if (!list.length) return null;
  return list.find((b) => bookLanguage(b) === lang) ?? list[0] ?? null;
}

/**
 * Desktop shell: auth, library, theme, multilingual learning hub.
 */
export default function MacDesktopShell() {
  const { t } = useI18n();
  const [tab, setTab] = useState<ShellView>('home');
  const [books, setBooks] = useState<Book[]>([]);
  const [activeBook, setActiveBook] = useState<Book | null>(null);
  const [wordsLearned, setWordsLearned] = useState(0);
  const [cardsDue, setCardsDue] = useState(0);
  const [streak, setStreak] = useState(0);
  const [bookCoverage, setBookCoverage] = useState<BookCoverage | null>(null);
  const [readingProgress, setReadingProgress] =
    useState<ReadingProgress | null>(null);
  const [continueTarget, setContinueTarget] = useState<{
    book: Book;
    progress: ReadingProgress;
  } | null>(null);
  const learningLanguage = useAppStore((s) => s.learningLanguage);
  const nativeLanguage = useAppStore((s) => s.nativeLanguage);
  const setLearningLanguageStore = useAppStore((s) => s.setLearningLanguage);
  const [tourOpen, setTourOpen] = useState(false);
  const [addBookCollectionId, setAddBookCollectionId] = useState<
    string | undefined
  >(undefined);
  const [mobileSheet, setMobileSheet] = useState<null | 'progress' | 'music'>(
    null
  );
  const [shareSlug, setShareSlug] = useState<string | null>(() =>
    parseShareSlugFromPath()
  );
  const [deckSlug, setDeckSlug] = useState<string | null>(() =>
    parseDeckSlugFromPath()
  );
  const [profileSlug, setProfileSlug] = useState<string | null>(() =>
    parseProfileSlugFromPath()
  );

  const theme = useWebTheme();
  useActivitySessionTimer(true);
  const isRussianHidden = useAppStore((s) => s.isRussianHiddenGlobal);
  const toggleRussian = useAppStore((s) => s.toggleGlobalRussianVisibility);
  const deleteBookFromStore = useAppStore((s) => s.deleteBook);

  useEffect(() => {
    applyDocumentTheme(theme.isDark);
  }, [theme.isDark]);

  const ownedCatalogIds = useMemo(() => {
    const ids = new Set<string>();
    for (const b of books) {
      if (b.catalogId) ids.add(b.catalogId);
    }
    return ids;
  }, [books]);

  const refreshContinue = useCallback(async (list: Book[]) => {
    setContinueTarget(await getContinueReading(list));
  }, []);

  const reloadLibrary = useCallback(async () => {
    try {
      // Не подмешиваем чужие/демо данные: только книги текущего ownerUserId
      const list = await getBooks();
      setBooks(list);
      await refreshContinue(list);
      const [streakState, tourDone, auth] = await Promise.all([
        loadStreak(),
        isTourCompleted(),
        Promise.resolve(getAuthState()),
      ]);
      // Языки не перечитываем здесь: hydrate на каждый reload сбрасывал
      // только что выбранный nativeLanguage (в т.ч. zh) из-за гонки с prefs/sync.
      const lang = useAppStore.getState().learningLanguage;
      const langCounts = await getFlashcardsCount(lang);
      setWordsLearned(langCounts.total);
      setCardsDue(langCounts.due);
      setStreak(streakState.current);
      // Welcome-тур только для зарегистрированных пользователей, ещё не прошедших онбординг
      const isAuthed =
        auth.status === 'authenticated' && auth.user != null && !auth.user.isAnonymous;
      if (isAuthed && !tourDone) setTourOpen(true);
      else setTourOpen(false);
    } catch {
      setBooks([]);
    }
  }, [refreshContinue]);

  useEffect(() => {
    return subscribeSyncState((state) => {
      if (state.status === 'synced') {
        void reloadLibrary();
      }
    });
  }, [reloadLibrary]);

  // После login / logout перечитываем библиотеку (локальные данные уже сброшены / подтянуты из Firestore)
  useEffect(() => {
    let prevUid = getAuthState().user?.uid ?? null;
    return subscribeAuthState((state: AuthState) => {
      const uid = state.user?.uid ?? null;
      if (uid === prevUid) return;
      const wasLoggedIn = prevUid != null;
      prevUid = uid;

      // Мгновенный сброс UI при выходе — не ждём async reload
      if (wasLoggedIn && uid == null) {
        setBooks([]);
        setActiveBook(null);
        setBookCoverage(null);
        setReadingProgress(null);
        setContinueTarget(null);
      }

      void (async () => {
        await reloadLibrary();
        const list = await getBooks();
        const lang = useAppStore.getState().learningLanguage;
        setActiveBook(pickBookForLang(list, lang));
      })();
    });
  }, [reloadLibrary]);

  // Явный сигнал от clearUserLocalData (logout / смена аккаунта)
  useEffect(() => {
    return subscribeLocalDataReset(() => {
      setBooks([]);
      setActiveBook(null);
      setBookCoverage(null);
      setReadingProgress(null);
      setContinueTarget(null);
      void reloadLibrary();
    });
  }, [reloadLibrary]);

  useEffect(() => {
    if (!activeBook) {
      setBookCoverage(null);
      setReadingProgress(null);
      return;
    }
    let cancelled = false;
    void computeBookCoverage(activeBook).then((c) => {
      if (!cancelled) setBookCoverage(c);
    });
    void resolveReadingProgress(activeBook.id).then((p) => {
      if (!cancelled) setReadingProgress(p);
    });
    return () => {
      cancelled = true;
    };
  }, [activeBook?.id]);

  const handleContinueReading = useCallback(() => {
    if (!continueTarget) return;
    const { book } = continueTarget;
    const lang = normalizeLearningLanguage(book.language);
    setLearningLanguageStore(lang);
    void setLearningLanguage(lang);
    setActiveBook(book);
    void pinBookForOffline(book);
    setTab('home');
  }, [continueTarget, setLearningLanguageStore]);

  const handleOpenCatalogBook = useCallback(
    async (book: Book) => {
      const lang = normalizeLearningLanguage(book.language);
      setLearningLanguageStore(lang);
      await setLearningLanguage(lang);
      setActiveBook(book);
      void pinBookForOffline(book);
      await reloadLibrary();
      setTab('home');
    },
    [reloadLibrary, setLearningLanguageStore]
  );

  const handleOpenLibraryBook = useCallback(
    async (book: Book) => {
      const lang = normalizeLearningLanguage(book.language);
      setLearningLanguageStore(lang);
      await setLearningLanguage(lang);
      setActiveBook(book);
      void pinBookForOffline(book);
      setTab('home');
    },
    [setLearningLanguageStore]
  );

  const openAddBook = useCallback((collectionId?: string) => {
    setAddBookCollectionId(collectionId || undefined);
    setTab('addBook');
  }, []);

  useEffect(() => {
    const onPop = () => {
      setShareSlug(parseShareSlugFromPath());
      setDeckSlug(parseDeckSlugFromPath());
      setProfileSlug(parseProfileSlugFromPath());
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const refreshCardsDue = useCallback(async () => {
    try {
      const lang = useAppStore.getState().learningLanguage;
      const counts = await getFlashcardsCount(lang);
      setCardsDue(counts.due);
      setWordsLearned(counts.total);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (tab !== 'flashcards') {
      void refreshCardsDue();
    }
  }, [tab, refreshCardsDue]);

  const closePublicShare = useCallback(() => {
    clearSharePath();
    setShareSlug(null);
    setDeckSlug(null);
    setProfileSlug(null);
    setTab('home');
  }, []);

  const openPublicShare = useCallback((slug: string) => {
    const clean = slug.trim();
    if (!clean || typeof window === 'undefined') return;
    const path = `/c/${encodeURIComponent(clean)}`;
    window.history.pushState({}, '', path);
    setShareSlug(clean);
    setDeckSlug(null);
    setProfileSlug(null);
  }, []);

  const openPublicDeck = useCallback((slug: string) => {
    const clean = slug.trim();
    if (!clean || typeof window === 'undefined') return;
    const path = `/d/${encodeURIComponent(clean)}`;
    window.history.pushState({}, '', path);
    setDeckSlug(clean);
    setShareSlug(null);
    setProfileSlug(null);
  }, []);

  const openPublicProfile = useCallback((slug: string) => {
    const clean = slug.trim();
    if (!clean || typeof window === 'undefined') return;
    const path = `/u/${encodeURIComponent(clean)}`;
    window.history.pushState({}, '', path);
    setProfileSlug(clean);
    setShareSlug(null);
    setDeckSlug(null);
  }, []);

  const handleOpenPublicBook = useCallback(
    (book: Book) => {
      const lang = normalizeLearningLanguage(book.language);
      setLearningLanguageStore(lang);
      void setLearningLanguage(lang);
      setActiveBook(book);
      void pinBookForOffline(book);
      clearSharePath();
      setShareSlug(null);
      setTab('home');
    },
    [setLearningLanguageStore]
  );

  useEffect(() => {
    void (async () => {
      await reloadLibrary();
      try {
        const lang = useAppStore.getState().learningLanguage;
        const list = await getBooks();
        // Не перетираем книгу, открытую из публичной ссылки
        if (!parseShareSlugFromPath()) {
          setActiveBook(pickBookForLang(list, lang));
        }
        const s = await loadStreak();
        setStreak(s.current);
      } catch {
        if (!parseShareSlugFromPath()) setActiveBook(null);
      }
    })();
  }, [reloadLibrary]);

  useEffect(() => () => ttsService.stop(), []);

  const chapterTitle = useMemo(() => {
    if (!activeBook) return t('reader.noBook');
    return activeBook.title.includes('—')
      ? activeBook.title
      : activeBook.title;
  }, [activeBook, t]);

  const handleDeleteBook = useCallback(
    (book: Book) => {
      if (!canEditBook(book)) {
        showAlert(t('alert.noAccess'), t('alert.deleteAuthorOnly'));
        return;
      }
      showConfirm(
        t('alert.deleteFanfic'),
        `«${formatBookTitleLine(book, nativeLanguage)}» — ${t('alert.deleteFanficBody')}`,
        () => {
          void (async () => {
            try {
              await deleteBook(book.id);
              deleteBookFromStore(book.id);
              await clearReadingProgress(book.id);
              await reloadLibrary();
              setActiveBook((prev) =>
                prev?.id !== book.id
                  ? prev
                  : pickBookForLang(books, learningLanguage)
              );
              setTab('library');
            } catch (e) {
              showAlert(
                t('alert.error'),
                e instanceof Error ? e.message : t('alert.deleteFail')
              );
            }
          })();
        }
      );
    },
    [deleteBookFromStore, learningLanguage, reloadLibrary, books, t]
  );

  /** Только смена активной книги: язык уже пишет LanguageSwitcher → Zustand. */
  const handleSelectLanguage = useCallback(
    (lang: LearningLanguage) => {
      setActiveBook((prev) => {
        if (prev && bookLanguage(prev) === lang) return prev;
        return pickBookForLang(books, lang);
      });
    },
    [books]
  );

  const finishTour = useCallback(() => {
    setTourOpen(false);
    void markTourCompleted();
  }, []);

  const goBack = useCallback((to: ShellView = 'library') => {
    ttsService.stop();
    setMobileSheet(null);
    setTab(to);
  }, []);

  useEffect(() => {
    setMobileSheet(null);
  }, [tab]);

  const dockTab: DockTab =
    tab === 'addBook' ? 'library' : tab === 'publicShare' ? 'home' : (tab as DockTab);
  const themeAttr = theme.isDark ? 'dark' : 'light';

  const ThemeToggleBtn = (
    <Button
      type="button"
      className={`rounded-2xl w-10 h-10 flex items-center justify-center text-base font-bold transition border ${theme.card}`}
      onClick={theme.toggle}
      title={t('action.theme')}
      aria-label={t('action.theme')}
    >
      {theme.isDark ? '☀️' : '🌙'}
    </Button>
  );

  if (tab === 'addBook') {
    return (
      <Div
        className={`neon-bg relative w-full h-full overflow-hidden flex flex-col ${theme.shell}`}
        data-theme={themeAttr}
      >
        {theme.isDark ? <StarryBackground /> : null}
        <Div className="relative z-10 px-5 pt-4 pb-2 flex items-center gap-3 shrink-0">
          <Button
            type="button"
            className={`w-10 h-10 rounded-2xl flex items-center justify-center ${theme.card} ${theme.accent} ${theme.hover} transition font-bold text-lg`}
            onClick={() => goBack('library')}
            title={t('action.back')}
            aria-label={t('action.back')}
          >
            ←
          </Button>
          <Div className="flex-1 min-w-0">
            <Div className={`font-['Comfortaa'] font-bold ${theme.accent} text-base`}>
              {t('addBook.title')}
            </Div>
            <Div className={`text-[11px] ${theme.brandSub} font-semibold`}>
              {theme.isDark ? t('settings.themeDark') : t('settings.themeLight')} ·{' '}
              {t('addBook.subtitle')}
            </Div>
          </Div>
          {ThemeToggleBtn}
        </Div>
        <Div className="relative z-10 flex-1 min-h-0">
          <View style={styles.legacyFill}>
            <AddBookScreen
              initialCollectionId={addBookCollectionId}
              onBack={() => goBack('library')}
              onBookCreated={(book) => {
                const lang = normalizeLearningLanguage(book.language);
                setLearningLanguageStore(lang);
                void setLearningLanguage(lang);
                setActiveBook(book);
                void reloadLibrary();
                setTab('home');
              }}
            />
          </View>
        </Div>
      </Div>
    );
  }

  if (tab === 'flashcards') {
    return (
      <Div
        className={`neon-bg relative w-full h-full overflow-hidden ${theme.shell}`}
        data-theme={themeAttr}
      >
        {theme.isDark ? <StarryBackground /> : null}
        <Div className="relative z-10 h-full">
          <View style={styles.legacyFill}>
            <FlashcardsScreen
              onBack={() => {
                void refreshCardsDue();
                goBack('home');
              }}
            />
          </View>
        </Div>
        <BottomDock
          active="flashcards"
          flashcardsDue={cardsDue}
          onSelect={(t) => {
            if (shareSlug || deckSlug || profileSlug) {
              clearSharePath();
              setShareSlug(null);
              setDeckSlug(null);
              setProfileSlug(null);
            }
            setTab(t);
          }}
        />
      </Div>
    );
  }

  return (
    <Div
      className={`neon-bg relative w-full h-full overflow-hidden flex flex-col ${theme.shell}`}
      data-theme={themeAttr}
    >
      {theme.isDark ? <StarryBackground /> : null}
      <Div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        <Div
          className={`absolute -top-10 left-[8%] w-64 h-28 rounded-full ${theme.glowViolet} blur-3xl`}
        />
        <Div
          className={`absolute top-[12%] right-[10%] w-72 h-32 rounded-full ${theme.glowLime} blur-3xl`}
        />
      </Div>

      <OfflineBanner />
      <DueCardsBanner
        due={cardsDue}
        onOpenFlashcards={() => setTab('flashcards')}
      />

      <Div className="relative z-10 shrink-0 px-3 sm:px-6 pt-3 sm:pt-4 pb-2 flex items-center justify-between gap-2 sm:gap-3 flex-wrap">
        <Div className="min-w-0">
          <Div className={`font-['Comfortaa'] font-bold ${theme.accent} text-base sm:text-lg tracking-wide`}>
            languageeee
          </Div>
          <Div className={`text-[10px] sm:text-[11px] ${theme.brandSub} font-semibold truncate`}>
            {theme.isDark ? t('settings.themeDark') : t('settings.themeLight')} ·{' '}
            {learningLanguage === 'zh'
              ? t('lang.zh')
              : learningLanguage === 'ru'
                ? t('lang.ru')
                : t('lang.en')}
            {' → '}
            {nativeLanguage === 'zh'
              ? t('lang.zh')
              : nativeLanguage === 'en'
                ? t('lang.en')
                : t('lang.ru')}
            <Span className="hidden sm:inline"> · {t('brand.hub')}</Span>
          </Div>
        </Div>
        <Div className="flex items-center gap-1.5 sm:gap-2 flex-wrap justify-end">
          <LanguageSwitcher
            compact
            onLearningChange={(lang) => void handleSelectLanguage(lang)}
          />
          <View style={styles.authWrap}>
            <AuthStatusBar compact />
          </View>
          <Button
            type="button"
            className={`hidden md:inline-flex rounded-2xl px-3 py-1.5 text-xs font-bold transition border ${
              isRussianHidden
                ? `${theme.card} ${theme.accent}`
                : 'bg-[#D0FF00] text-[#0D0D11] border-transparent'
            }`}
            onClick={toggleRussian}
            title={t('action.toggleTranslation')}
          >
            {isRussianHidden ? t('action.showText') : t('action.hideText')}
          </Button>
          <Button
            type="button"
            className={`hidden sm:inline-flex rounded-2xl px-3 py-1.5 text-xs ${theme.cta} transition`}
            onClick={() => openAddBook()}
          >
            + {t('action.addFanfic')}
          </Button>
          {ThemeToggleBtn}
        </Div>
      </Div>

      <Div className="relative z-10 flex flex-col xl:flex-row gap-3 xl:gap-4 px-3 sm:px-5 flex-1 min-h-0 pb-[calc(5.75rem+env(safe-area-inset-bottom,0px))]">
        {shareSlug ? (
          <Div className="flex-1 min-w-0 min-h-0 flex flex-col">
            <PublicCollectionPanel
              slug={shareSlug}
              onOpenBook={handleOpenPublicBook}
              onClose={closePublicShare}
              onAddedToLibrary={() => void reloadLibrary()}
            />
          </Div>
        ) : deckSlug ? (
          <Div className="flex-1 min-w-0 min-h-0 flex flex-col">
            <PublicDeckPanel
              slug={deckSlug}
              onClose={closePublicShare}
              onImported={() => {
                void refreshCardsDue();
                void reloadLibrary();
              }}
            />
          </Div>
        ) : profileSlug ? (
          <Div className="flex-1 min-w-0 min-h-0 flex flex-col">
            <PublicProfilePanel slug={profileSlug} onClose={closePublicShare} />
          </Div>
        ) : tab === 'home' || tab === 'explore' || tab === 'library' ? (
          <>
            <Div className="hidden xl:block h-full shrink-0">
              <ProgressPanel
                streak={streak}
                wordsLearned={wordsLearned}
                dueCards={cardsDue}
                coverage={bookCoverage}
                readingProgress={
                  activeBook && readingProgress?.bookId === activeBook.id
                    ? readingProgress
                    : null
                }
                continueReading={
                  continueTarget
                    ? {
                        title: formatBookTitleLine(continueTarget.book, nativeLanguage),
                        progress: continueTarget.progress,
                        language: continueTarget.book.language,
                      }
                    : null
                }
                onContinueReading={handleContinueReading}
              />
            </Div>

            <Div className="flex-1 min-w-0 min-h-0 flex flex-col">
              {tab === 'explore' ? (
                <CatalogPanel
                  key={`explore-${nativeLanguage}`}
                  preferredLanguage={learningLanguage}
                  ownedBookIds={ownedCatalogIds}
                  onBack={() => goBack('home')}
                  onOpenMyLibrary={() => setTab('library')}
                  onOpenBook={(book) => void handleOpenCatalogBook(book)}
                  onOpenPublicCollection={openPublicShare}
                  onOpenPublicDeck={openPublicDeck}
                />
              ) : tab === 'library' ? (
                <MyLibraryPanel
                  key={`library-${nativeLanguage}`}
                  preferredLanguage={learningLanguage}
                  activeBookId={activeBook?.id}
                  onBack={() => goBack('home')}
                  onOpenBook={(book) => void handleOpenLibraryBook(book)}
                  onAddBook={(collectionId) => openAddBook(collectionId)}
                  onOpenExplore={() => setTab('explore')}
                  onLibraryChanged={() => {
                    void reloadLibrary();
                  }}
                />
              ) : (
                <ReaderPanel
                  book={activeBook}
                  chapterTitle={chapterTitle}
                  coverage={bookCoverage}
                  onBack={() => goBack('library')}
                  onDelete={
                    activeBook && canEditBook(activeBook)
                      ? () => handleDeleteBook(activeBook)
                      : undefined
                  }
                  onProgressChange={(p) => {
                    setReadingProgress(p);
                    void refreshContinue(books);
                  }}
                />
              )}
            </Div>

            <Div className="hidden xl:block h-full shrink-0">
              <MiniPlayPanel />
            </Div>
          </>
        ) : null}

        {tab === 'settings' ? (
          <Div
            className={`${theme.card} rounded-2xl flex-1 overflow-hidden flex flex-col mx-auto max-w-lg w-full`}
          >
            <Div className={`${theme.titlebar} px-3 py-2.5 flex items-center gap-3`}>
              <Button
                type="button"
                className={`shrink-0 w-8 h-8 rounded-xl flex items-center justify-center ${theme.accent} ${theme.hover} transition font-bold text-lg`}
                onClick={() => goBack('home')}
                title={t('action.back')}
                aria-label={t('action.back')}
              >
                ←
              </Button>
              <Span
                className={`flex-1 text-center text-sm font-semibold ${theme.accent} font-['Comfortaa'] pr-8`}
              >
                {t('settings.title')}
              </Span>
            </Div>
            <Div className="p-4 sm:p-5 space-y-3 overflow-y-auto min-h-0 flex-1">
              <Div className={`rounded-2xl ${theme.card} px-4 py-3`}>
                <Div className={`font-bold ${theme.accent} text-sm mb-2`}>
                  {t('settings.direction')}
                </Div>
                <Div className={`text-xs ${theme.textMuted} mb-3`}>
                  {t('settings.directionHint')}
                </Div>
                <LanguageSwitcher
                  onLearningChange={(lang) => void handleSelectLanguage(lang)}
                />
              </Div>

              <Button
                type="button"
                className={`w-full text-left rounded-2xl ${theme.card} px-4 py-3 transition`}
                onClick={toggleRussian}
              >
                <Div className={`font-bold ${theme.accent} text-sm`}>
                  {t('settings.russianTranslation')}
                </Div>
                <Div className={`text-xs ${theme.textMuted} mt-0.5`}>
                  {isRussianHidden
                    ? t('settings.translationHidden')
                    : t('settings.translationShown')}
                </Div>
              </Button>
              <Button
                type="button"
                className={`w-full text-left rounded-2xl ${theme.card} px-4 py-3 transition`}
                onClick={theme.toggle}
              >
                <Div className={`font-bold ${theme.accent} text-sm`}>
                  {t('settings.theme')}
                </Div>
                <Div className={`text-xs ${theme.textMuted} mt-0.5`}>
                  {theme.isDark
                    ? `🌙 ${t('settings.themeDark')}`
                    : `☀️ ${t('settings.themeLight')}`}
                </Div>
              </Button>

              <InstallAppCard />

              <Button
                type="button"
                className={`w-full text-left rounded-2xl px-4 py-3 transition ${theme.cta}`}
                onClick={() => openAddBook()}
              >
                <Div className="font-bold text-sm">+ {t('action.addFanfic')}</Div>
                <Div className="text-xs opacity-70 mt-0.5">
                  {t('settings.addBookHint')}
                </Div>
              </Button>
            </Div>
          </Div>
        ) : null}
      </Div>

      {/* Мобильные / планшетные панели Progress / Music (< xl) */}
      {mobileSheet ? (
        <Div
          className="xl:hidden fixed inset-0 z-[60] flex flex-col justify-end"
          style={{ background: theme.modalOverlay }}
          onClick={() => setMobileSheet(null)}
        >
          <Div
            className="h-[min(78dvh,640px)] w-full max-w-lg mx-auto px-3 pb-[calc(5.25rem+env(safe-area-inset-bottom,0px))] pt-2"
            onClick={(e) => e.stopPropagation()}
          >
            <Button
              type="button"
              className={`mb-2 ml-auto block rounded-full px-3 py-1 text-xs font-bold ${theme.card} ${theme.textMuted}`}
              onClick={() => setMobileSheet(null)}
            >
              {t('action.close')}
            </Button>
            {mobileSheet === 'progress' ? (
              <ProgressPanel
                widthClass="w-full h-full"
                streak={streak}
                wordsLearned={wordsLearned}
                dueCards={cardsDue}
                coverage={bookCoverage}
                readingProgress={
                  activeBook && readingProgress?.bookId === activeBook.id
                    ? readingProgress
                    : null
                }
                continueReading={
                  continueTarget
                    ? {
                        title: formatBookTitleLine(continueTarget.book, nativeLanguage),
                        progress: continueTarget.progress,
                        language: continueTarget.book.language,
                      }
                    : null
                }
                onContinueReading={() => {
                  setMobileSheet(null);
                  handleContinueReading();
                }}
              />
            ) : (
              <MiniPlayPanel widthClass="w-full h-full" compact />
            )}
          </Div>
        </Div>
      ) : null}

      {(tab === 'home' || tab === 'explore' || tab === 'library') && (
        <Div
          className="xl:hidden pointer-events-none absolute z-40 flex flex-col gap-2"
          style={{
            right: 'max(0.75rem, env(safe-area-inset-right, 0px))',
            bottom: 'calc(5.5rem + env(safe-area-inset-bottom, 0px))',
          }}
        >
          <Button
            type="button"
            className={`pointer-events-auto rounded-full px-3 py-2 text-xs font-bold shadow-lg border ${theme.card} ${theme.border} ${theme.text}`}
            onClick={() =>
              setMobileSheet((s) => (s === 'progress' ? null : 'progress'))
            }
          >
            📊
          </Button>
          <Button
            type="button"
            className={`pointer-events-auto rounded-full px-3 py-2 text-xs font-bold shadow-lg border ${theme.card} ${theme.border} ${theme.text}`}
            onClick={() =>
              setMobileSheet((s) => (s === 'music' ? null : 'music'))
            }
          >
            🎵
          </Button>
        </Div>
      )}

      <BottomDock
        active={dockTab}
        flashcardsDue={cardsDue}
        onSelect={(t) => {
          if (shareSlug || deckSlug || profileSlug) {
            clearSharePath();
            setShareSlug(null);
            setDeckSlug(null);
            setProfileSlug(null);
          }
          setTab(t);
        }}
      />
      <OnboardingTour
        open={tourOpen}
        onFinish={finishTour}
        onSkip={finishTour}
      />
    </Div>
  );
}

const styles = StyleSheet.create({
  legacyFill: {
    flex: 1,
    height: '100%' as unknown as number,
    width: '100%' as unknown as number,
  },
  authWrap: {
    width: 168,
    flexShrink: 0,
  },
});
