import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import {
  emptyDayActivity,
  localDayKey,
  mergeActivityByDay,
  normalizeDayActivity,
  pruneActivityByDay,
  yesterdayLocalKey,
  type ActivityByDay,
  type DayActivity,
} from '../services/activityAnalytics';
import {
  calculateNextReview,
  type ReviewGrade,
} from '../services/srsService';
import { analyzeBookText } from '../services/textAnalyzerService';
import type {
  Book,
  BookHskStats,
  Collection,
  Flashcard,
  LearningLanguage,
  NativeLanguage,
  Paragraph,
} from '../types/domain';
import {
  DEFAULT_LEARNING_LANGUAGE,
  DEFAULT_NATIVE_LANGUAGE,
} from '../types/domain';
import {
  normalizeLearningLanguage,
  normalizeNativeLanguage,
} from '../services/languageConfig';
import type { StickyNote } from '../types/stickyNote';
import type { RadioPlaylistId } from '../theme/y2k';
import { normalizeRadioPlaylistId } from '../theme/y2k';
import { createAppStorage } from './createAppStorage';

/** Сохранённая статистика книги из стора. */
export interface BookStatsSnapshot {
  hskStats: BookHskStats | undefined;
  readingTime: number | undefined;
  recommendedHskLevel: number | undefined;
  totalUnique: number | undefined;
}

const STORAGE_KEY = '@languageeee/app-store-v1';

/** Фоновая облачная синхронизация без блокировки UI (dynamic import — без цикла зависимостей). */
function queueCloudSync() {
  void import('../services/cloudSyncService').then((m) => m.scheduleSyncDebounced());
}

// ─── Slices ───────────────────────────────────────────────────────────────────

export interface BooksSlice {
  books: Book[];
  activeBookId: string | null;
  addBook: (book: Book) => void;
  updateBook: (bookId: string, patch: Partial<Book>) => void;
  deleteBook: (bookId: string) => void;
  setActiveBook: (bookId: string | null) => void;
  cacheParsedParagraphs: (
    bookId: string,
    paragraphs: Paragraph[],
    /** @deprecated Игнорируется — статистика считается через TextAnalyzerService. */
    _legacyStats?: Record<string, number>
  ) => void;
  /** Upsert книги (для гидрации из legacy storage / открытия ридера) */
  upsertBook: (book: Book) => void;
  getBook: (bookId: string) => Book | undefined;
  /** Сохранённая HSK-статистика и время чтения. */
  getBookStats: (bookId: string) => BookStatsSnapshot | null;
}

export interface CollectionsSlice {
  collections: Collection[];
  addCollection: (collection: Collection) => void;
  updateCollection: (collectionId: string, patch: Partial<Collection>) => void;
  deleteCollection: (collectionId: string) => void;
  addWordToCollection: (collectionId: string, wordId: string) => void;
  removeWordFromCollection: (collectionId: string, wordId: string) => void;
  addBookToCollection: (collectionId: string, bookId: string) => void;
  removeBookFromCollection: (collectionId: string, bookId: string) => void;
}

export interface FlashcardsSlice {
  flashcards: Record<string, Flashcard>;
  addFlashcard: (card: Flashcard) => void;
  updateFlashcard: (id: string, patch: Partial<Flashcard>) => void;
  removeFlashcard: (id: string) => void;
  /** SM-2: применить оценку и обновить карточку в сторе. */
  reviewCard: (cardId: string, grade: ReviewGrade | number) => Flashcard | null;
}

/** Фон контейнера текста в читалке (не путать с глобальным midnightMode). */
export type ReaderPageTheme = 'dark' | 'light' | 'sepia';

export const READER_FONT_SCALE_MIN = 0.8;
export const READER_FONT_SCALE_MAX = 1.5;
export const READER_FONT_SCALE_STEP = 0.1;

export interface SettingsSlice {
  isRussianHiddenGlobal: boolean;
  toggleGlobalRussianVisibility: () => void;
  setGlobalRussianHidden: (hidden: boolean) => void;
  midnightMode: boolean;
  toggleMidnightMode: () => void;
  setMidnightMode: (on: boolean) => void;
  radioPlaylist: RadioPlaylistId;
  radioPlaying: boolean;
  /** 0…1 громкость ambient / своих треков */
  radioVolume: number;
  setRadioPlaylist: (id: RadioPlaylistId) => void;
  setRadioPlaying: (playing: boolean) => void;
  toggleRadioPlaying: () => void;
  setRadioVolume: (volume: number) => void;
  /** Масштаб шрифта ханзи/пиньиня в читалке (1 = 100%). */
  readerFontScale: number;
  setReaderFontScale: (scale: number) => void;
  bumpReaderFontScale: (delta: number) => void;
  /** Тема фона абзацев: тёмный / светлый / сепия. */
  readerPageTheme: ReaderPageTheme;
  setReaderPageTheme: (theme: ReaderPageTheme) => void;
  /** Изучаемый язык (zh / ru / en) */
  learningLanguage: LearningLanguage;
  /** Родной язык — направление глосс / перевода */
  nativeLanguage: NativeLanguage;
  setLearningLanguage: (lang: LearningLanguage) => void;
  setNativeLanguage: (lang: NativeLanguage) => void;
  setLanguagePair: (
    learning: LearningLanguage,
    native: NativeLanguage
  ) => void;
}

export interface StickyNotesSlice {
  stickyNotes: StickyNote[];
  addStickyNote: (note: StickyNote) => void;
  updateStickyNote: (id: string, patch: Partial<StickyNote>) => void;
  removeStickyNote: (id: string) => void;
  getNotesForBook: (bookId: string) => StickyNote[];
}

/** Стрик + дневная активность (геймификация / аналитика). */
export interface ActivitySlice {
  streakCurrent: number;
  streakLastActiveDate: string | null;
  streakUpdatedAt: string;
  activityByDay: ActivityByDay;
  /** Дневная цель: слова прочитано */
  dailyWordsGoal: number;
  /** Дневная цель: карточки повторено */
  dailyCardsGoal: number;
  setDailyGoals: (goals: {
    words?: number;
    cards?: number;
  }) => void;
  /**
   * Целевое действие: чтение / карточки / минуты в приложении.
   * Обновляет счётчики дня и стрик (если день ещё не засчитан).
   */
  trackActivity: (delta: {
    wordsRead?: number;
    cardsReviewed?: number;
    minutes?: number;
  }) => void;
  /** Гидрация из Firestore / legacy streakStore. */
  setActivityFromCloud: (payload: {
    streak?: {
      current?: number;
      lastActiveDate?: string | null;
      updatedAt?: string;
    };
    activityByDay?: ActivityByDay;
  }) => void;
  getTodayActivity: () => DayActivity;
}

export type AppStore = BooksSlice &
  CollectionsSlice &
  FlashcardsSlice &
  SettingsSlice &
  StickyNotesSlice &
  ActivitySlice;

// ─── Store ────────────────────────────────────────────────────────────────────

export const useAppStore = create<AppStore>()(
  persist(
    (set, get) => ({
      // Books
      books: [],
      activeBookId: null,

      addBook: (book) => {
        set((state) => ({
          books: [book, ...state.books.filter((b) => b.id !== book.id)],
        }));
        queueCloudSync();
      },

      upsertBook: (book) => {
        set((state) => {
          const idx = state.books.findIndex((b) => b.id === book.id);
          if (idx === -1) return { books: [book, ...state.books] };
          const next = [...state.books];
          next[idx] = { ...next[idx], ...book };
          return { books: next };
        });
        queueCloudSync();
      },

      updateBook: (bookId, patch) => {
        set((state) => ({
          books: state.books.map((b) =>
            b.id === bookId ? { ...b, ...patch } : b
          ),
        }));
        queueCloudSync();
      },

      deleteBook: (bookId) => {
        set((state) => ({
          books: state.books.filter((b) => b.id !== bookId),
          activeBookId:
            state.activeBookId === bookId ? null : state.activeBookId,
          collections: state.collections.map((c) => ({
            ...c,
            bookIds: c.bookIds.filter((id) => id !== bookId),
          })),
        }));
        queueCloudSync();
      },

      setActiveBook: (bookId) => {
        set((state) => {
          if (!bookId) return { activeBookId: null };
          return {
            activeBookId: bookId,
            books: state.books.map((b) =>
              b.id === bookId ? { ...b, lastReadAt: Date.now() } : b
            ),
          };
        });
        if (bookId) queueCloudSync();
      },

      cacheParsedParagraphs: (bookId, paragraphs, _legacyStats) => {
        set((state) => {
          const book = state.books.find((b) => b.id === bookId);
          const tokens = paragraphs.flatMap((p) => p.tokens);
          const textZh =
            book?.originalZhText?.trim() ||
            paragraphs.map((p) => p.originalZh).join('\n\n');
          const { hskStats, reading } = analyzeBookText(textZh, tokens);

          const snapshot: BookHskStats = {
            counts: hskStats.counts,
            percents: hskStats.percents,
            cumulativePercents: hskStats.cumulativePercents,
            totalUnique: hskStats.totalUnique,
            recommendedHskLevel: hskStats.recommendedHskLevel,
          };

          return {
            books: state.books.map((b) =>
              b.id === bookId
                ? {
                    ...b,
                    parsedParagraphs: paragraphs,
                    hskStats: snapshot,
                    readingTime: reading.estimatedMinutes,
                    isParsed: true,
                    lastReadAt: Date.now(),
                  }
                : b
            ),
          };
        });
        queueCloudSync();
      },

      getBook: (bookId) => get().books.find((b) => b.id === bookId),

      getBookStats: (bookId) => {
        const book = get().books.find((b) => b.id === bookId);
        if (!book) return null;

        // Если есть абзацы, но нет свежей статистики — пересчитаем на лету
        if (
          (!book.hskStats || book.readingTime == null) &&
          book.parsedParagraphs?.length
        ) {
          const tokens = book.parsedParagraphs.flatMap((p) => p.tokens);
          const { hskStats, reading } = analyzeBookText(
            book.originalZhText ||
              book.parsedParagraphs.map((p) => p.originalZh).join('\n\n'),
            tokens
          );
          return {
            hskStats: {
              counts: hskStats.counts,
              percents: hskStats.percents,
              cumulativePercents: hskStats.cumulativePercents,
              totalUnique: hskStats.totalUnique,
              recommendedHskLevel: hskStats.recommendedHskLevel,
            },
            readingTime: reading.estimatedMinutes,
            recommendedHskLevel: hskStats.recommendedHskLevel,
            totalUnique: hskStats.totalUnique,
          };
        }

        return {
          hskStats: book.hskStats,
          readingTime: book.readingTime,
          recommendedHskLevel: book.hskStats?.recommendedHskLevel,
          totalUnique: book.hskStats?.totalUnique,
        };
      },

      // Collections
      collections: [],

      addCollection: (collection) => {
        set((state) => ({
          collections: [
            collection,
            ...state.collections.filter((c) => c.id !== collection.id),
          ],
        }));
        queueCloudSync();
      },

      updateCollection: (collectionId, patch) => {
        set((state) => ({
          collections: state.collections.map((c) =>
            c.id === collectionId ? { ...c, ...patch } : c
          ),
        }));
        queueCloudSync();
      },

      deleteCollection: (collectionId) => {
        set((state) => ({
          collections: state.collections.filter((c) => c.id !== collectionId),
          books: state.books.map((b) =>
            b.collectionId === collectionId
              ? { ...b, collectionId: undefined }
              : b
          ),
        }));
        queueCloudSync();
      },

      addWordToCollection: (collectionId, wordId) => {
        set((state) => ({
          collections: state.collections.map((c) =>
            c.id === collectionId && !c.wordIds.includes(wordId)
              ? { ...c, wordIds: [...c.wordIds, wordId] }
              : c
          ),
        }));
        queueCloudSync();
      },

      removeWordFromCollection: (collectionId, wordId) => {
        set((state) => ({
          collections: state.collections.map((c) =>
            c.id === collectionId
              ? { ...c, wordIds: c.wordIds.filter((id) => id !== wordId) }
              : c
          ),
        }));
        queueCloudSync();
      },

      addBookToCollection: (collectionId, bookId) => {
        set((state) => ({
          collections: state.collections.map((c) =>
            c.id === collectionId && !c.bookIds.includes(bookId)
              ? { ...c, bookIds: [...c.bookIds, bookId] }
              : c
          ),
          books: state.books.map((b) =>
            b.id === bookId ? { ...b, collectionId } : b
          ),
        }));
        queueCloudSync();
      },

      removeBookFromCollection: (collectionId, bookId) => {
        set((state) => ({
          collections: state.collections.map((c) =>
            c.id === collectionId
              ? { ...c, bookIds: c.bookIds.filter((id) => id !== bookId) }
              : c
          ),
          books: state.books.map((b) =>
            b.id === bookId && b.collectionId === collectionId
              ? { ...b, collectionId: undefined }
              : b
          ),
        }));
        queueCloudSync();
      },

      // Flashcards
      flashcards: {},

      addFlashcard: (card) => {
        set((state) => ({
          flashcards: { ...state.flashcards, [card.id]: card },
        }));
        queueCloudSync();
      },

      updateFlashcard: (id, patch) => {
        set((state) => {
          const existing = state.flashcards[id];
          if (!existing) return state;
          return {
            flashcards: {
              ...state.flashcards,
              [id]: { ...existing, ...patch },
            },
          };
        });
        queueCloudSync();
      },

      removeFlashcard: (id) => {
        set((state) => {
          const next = { ...state.flashcards };
          delete next[id];
          return { flashcards: next };
        });
        queueCloudSync();
      },

      reviewCard: (cardId, grade) => {
        const card = get().flashcards[cardId];
        if (!card) return null;

        const clamped = Math.min(
          5,
          Math.max(0, Math.round(Number(grade)))
        ) as ReviewGrade;
        const srs = calculateNextReview(
          {
            interval: card.interval,
            repetition: card.repetition,
            easeFactor: card.easeFactor,
          },
          clamped
        );
        const updated: Flashcard = { ...card, ...srs };

        set((state) => ({
          flashcards: { ...state.flashcards, [cardId]: updated },
        }));
        get().trackActivity({ cardsReviewed: 1 });
        queueCloudSync();

        return updated;
      },

      // Settings
      isRussianHiddenGlobal: true,
      midnightMode: false,
      radioPlaylist: 'lofi' as RadioPlaylistId,
      radioPlaying: false,
      radioVolume: 0.7,
      readerFontScale: 1,
      readerPageTheme: 'light' as ReaderPageTheme,
      learningLanguage: DEFAULT_LEARNING_LANGUAGE,
      nativeLanguage: DEFAULT_NATIVE_LANGUAGE,

      toggleGlobalRussianVisibility: () =>
        set((state) => ({
          isRussianHiddenGlobal: !state.isRussianHiddenGlobal,
        })),

      setGlobalRussianHidden: (hidden) =>
        set({ isRussianHiddenGlobal: hidden }),

      toggleMidnightMode: () =>
        set((state) => ({ midnightMode: !state.midnightMode })),

      setMidnightMode: (on) => set({ midnightMode: on }),

      setRadioPlaylist: (id) =>
        set({ radioPlaylist: normalizeRadioPlaylistId(id) }),

      setRadioPlaying: (playing) => set({ radioPlaying: playing }),

      toggleRadioPlaying: () =>
        set((state) => ({ radioPlaying: !state.radioPlaying })),

      setRadioVolume: (volume) =>
        set({ radioVolume: Math.max(0, Math.min(1, volume)) }),

      setReaderFontScale: (scale) =>
        set({
          readerFontScale:
            Math.round(
              Math.max(
                READER_FONT_SCALE_MIN,
                Math.min(READER_FONT_SCALE_MAX, scale)
              ) * 10
            ) / 10,
        }),

      bumpReaderFontScale: (delta) => {
        const cur = get().readerFontScale;
        get().setReaderFontScale(cur + delta);
      },

      setReaderPageTheme: (theme) => set({ readerPageTheme: theme }),

      setLearningLanguage: (lang) => {
        const learning = normalizeLearningLanguage(lang);
        set({ learningLanguage: learning });
        // Сначала prefs, потом cloud — иначе sync/reload мог откатить выбор.
        void import('../services/onboardingService')
          .then((m) =>
            m.syncLanguagePairFromStore(learning, get().nativeLanguage, {
              sync: true,
            })
          )
          .catch(() => undefined);
      },

      setNativeLanguage: (lang) => {
        const native = normalizeNativeLanguage(lang);
        set({ nativeLanguage: native });
        void import('../services/onboardingService')
          .then((m) =>
            m.syncLanguagePairFromStore(get().learningLanguage, native, {
              sync: true,
            })
          )
          .catch(() => undefined);
      },

      setLanguagePair: (learningRaw, nativeRaw) => {
        const learning = normalizeLearningLanguage(learningRaw);
        const native = normalizeNativeLanguage(nativeRaw);
        set({ learningLanguage: learning, nativeLanguage: native });
        void import('../services/onboardingService')
          .then((m) =>
            m.syncLanguagePairFromStore(learning, native, { sync: true })
          )
          .catch(() => undefined);
      },

      // Activity / streak
      streakCurrent: 0,
      streakLastActiveDate: null as string | null,
      streakUpdatedAt: new Date().toISOString(),
      activityByDay: {} as ActivityByDay,
      dailyWordsGoal: 50,
      dailyCardsGoal: 10,

      setDailyGoals: ({ words, cards }) => {
        set((state) => ({
          dailyWordsGoal:
            words != null
              ? Math.max(5, Math.min(2000, Math.floor(words)))
              : state.dailyWordsGoal,
          dailyCardsGoal:
            cards != null
              ? Math.max(1, Math.min(200, Math.floor(cards)))
              : state.dailyCardsGoal,
        }));
      },

      trackActivity: (delta) => {
        const words = Math.max(0, Math.floor(delta.wordsRead ?? 0));
        const cards = Math.max(0, Math.floor(delta.cardsReviewed ?? 0));
        const minutes = Math.max(0, Math.floor(delta.minutes ?? 0));
        if (words === 0 && cards === 0 && minutes === 0) return;

        const today = localDayKey();
        const yesterday = yesterdayLocalKey();
        const nowIso = new Date().toISOString();

        set((state) => {
          const prevDay = state.activityByDay[today] ?? emptyDayActivity();
          const nextDay: DayActivity = {
            wordsRead: prevDay.wordsRead + words,
            cardsReviewed: prevDay.cardsReviewed + cards,
            minutes: prevDay.minutes + minutes,
            updatedAt: nowIso,
          };

          let streakCurrent = state.streakCurrent;
          let streakLastActiveDate = state.streakLastActiveDate;
          let streakUpdatedAt = state.streakUpdatedAt;

          // Просроченный стрик (пропуск >1 дня) сбрасываем до инкремента
          if (
            streakLastActiveDate &&
            streakLastActiveDate !== today &&
            streakLastActiveDate !== yesterday
          ) {
            streakCurrent = 0;
          }

          // Стрик только от целевых действий: чтение или карточки (не просто минуты в UI)
          const meaningful = words > 0 || cards > 0;
          if (meaningful && streakLastActiveDate !== today) {
            if (streakLastActiveDate === yesterday) {
              streakCurrent = Math.max(1, streakCurrent + 1);
            } else {
              streakCurrent = 1;
            }
            streakLastActiveDate = today;
            streakUpdatedAt = nowIso;
          }

          return {
            activityByDay: pruneActivityByDay({
              ...state.activityByDay,
              [today]: nextDay,
            }),
            streakCurrent,
            streakLastActiveDate,
            streakUpdatedAt,
          };
        });
        queueCloudSync();
      },

      setActivityFromCloud: (payload) => {
        set((state) => {
          const next: Partial<ActivitySlice> = {};
          if (payload.streak) {
            if (typeof payload.streak.current === 'number') {
              next.streakCurrent = Math.max(0, Math.floor(payload.streak.current));
            }
            if (payload.streak.lastActiveDate !== undefined) {
              next.streakLastActiveDate = payload.streak.lastActiveDate;
            }
            if (payload.streak.updatedAt) {
              next.streakUpdatedAt = payload.streak.updatedAt;
            } else {
              next.streakUpdatedAt = new Date().toISOString();
            }
          }
          if (payload.activityByDay) {
            next.activityByDay = mergeActivityByDay(
              state.activityByDay,
              payload.activityByDay
            );
          }
          return next;
        });
      },

      getTodayActivity: () => {
        const map = get().activityByDay;
        return map[localDayKey()] ?? emptyDayActivity();
      },

      // Sticky notes
      stickyNotes: [],

      addStickyNote: (note) => {
        set((state) => ({
          stickyNotes: [note, ...state.stickyNotes.filter((n) => n.id !== note.id)],
        }));
        queueCloudSync();
      },

      updateStickyNote: (id, patch) => {
        set((state) => ({
          stickyNotes: state.stickyNotes.map((n) =>
            n.id === id ? { ...n, ...patch } : n
          ),
        }));
        queueCloudSync();
      },

      removeStickyNote: (id) => {
        set((state) => ({
          stickyNotes: state.stickyNotes.filter((n) => n.id !== id),
        }));
        void import('../services/syncService')
          .then(async (m) => {
            await m.recordTombstone('stickyNote', id);
            m.scheduleSyncDebounced();
          })
          .catch(() => queueCloudSync());
      },

      getNotesForBook: (bookId) =>
        get().stickyNotes.filter((n) => n.bookId === bookId),
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => createAppStorage()),
      partialize: (state) => ({
        books: state.books,
        collections: state.collections,
        flashcards: state.flashcards,
        isRussianHiddenGlobal: state.isRussianHiddenGlobal,
        midnightMode: state.midnightMode,
        radioPlaylist: normalizeRadioPlaylistId(state.radioPlaylist),
        radioVolume: state.radioVolume,
        readerFontScale: state.readerFontScale,
        readerPageTheme: state.readerPageTheme,
        // Языки НЕ в persist: SoT = onboarding prefs (@languageeee/user_prefs).
        // Иначе поздняя гидратация IndexedDB откатывала nativeLanguage после
        // LanguageSwitcher (карточки каталога «не переключаются» / мигают).
        stickyNotes: state.stickyNotes,
        activeBookId: state.activeBookId,
        streakCurrent: state.streakCurrent,
        streakLastActiveDate: state.streakLastActiveDate,
        streakUpdatedAt: state.streakUpdatedAt,
        activityByDay: state.activityByDay,
        dailyWordsGoal: state.dailyWordsGoal,
        dailyCardsGoal: state.dailyCardsGoal,
      }),
      // Старые снимки persist ещё содержат learning/native — игнорируем их.
      merge: (persistedState, currentState) => {
        if (!persistedState || typeof persistedState !== 'object') {
          return currentState;
        }
        const raw = persistedState as Record<string, unknown>;
        const {
          learningLanguage: _dropLearn,
          nativeLanguage: _dropNative,
          ...rest
        } = raw;
        return { ...currentState, ...rest };
      },
      onRehydrateStorage: () => (state, error) => {
        if (error) {
          console.error('[useAppStore] rehydrate failed', error);
          return;
        }
        if (state) {
          state.radioPlaylist = normalizeRadioPlaylistId(state.radioPlaylist);
          if (typeof state.radioVolume !== 'number') state.radioVolume = 0.7;
          if (typeof state.readerFontScale !== 'number') {
            state.readerFontScale = 1;
          } else {
            state.readerFontScale =
              Math.round(
                Math.max(
                  READER_FONT_SCALE_MIN,
                  Math.min(READER_FONT_SCALE_MAX, state.readerFontScale)
                ) * 10
              ) / 10;
          }
          if (
            state.readerPageTheme !== 'dark' &&
            state.readerPageTheme !== 'light' &&
            state.readerPageTheme !== 'sepia'
          ) {
            state.readerPageTheme = 'light';
          }
          // Языки подтянет hydrateStoreLanguagesFromPrefs (App boot / post-rehydrate)
          state.learningLanguage = normalizeLearningLanguage(
            state.learningLanguage
          );
          state.nativeLanguage = normalizeNativeLanguage(state.nativeLanguage);
          if (typeof state.streakCurrent !== 'number') state.streakCurrent = 0;
          if (state.streakLastActiveDate === undefined) {
            state.streakLastActiveDate = null;
          }
          if (typeof state.streakUpdatedAt !== 'string') {
            state.streakUpdatedAt = new Date().toISOString();
          }
          if (!state.activityByDay || typeof state.activityByDay !== 'object') {
            state.activityByDay = {};
          } else {
            const cleaned: ActivityByDay = {};
            for (const [k, v] of Object.entries(state.activityByDay)) {
              const n = normalizeDayActivity(v);
              if (n) cleaned[k] = n;
            }
            state.activityByDay = pruneActivityByDay(cleaned);
          }
          if (typeof state.dailyWordsGoal !== 'number' || state.dailyWordsGoal < 5) {
            state.dailyWordsGoal = 50;
          }
          if (typeof state.dailyCardsGoal !== 'number' || state.dailyCardsGoal < 1) {
            state.dailyCardsGoal = 10;
          }
          // Убрать только старые автосиднутые id — пользовательские названия не фильтруем
          if (Array.isArray(state.collections)) {
            const legacyIds = new Set([
              'col-favorites',
              'col-study',
              'col-fantasy',
              'col-drafts',
              'col-hsk-beginners',
              'col-genshin-danmei-kpop',
              'col-import-favorites',
              'col-uncategorized',
            ]);
            state.collections = state.collections.filter(
              (c) => !legacyIds.has(c.id)
            );
          }
          // Миграция legacy AsyncStorage streak → Zustand (один раз)
          void migrateLegacyStreakIntoZustand();
        }
      },
    }
  )
);

/** Один раз перенести legacy `@languageeee/streak` в Zustand ActivitySlice. */
async function migrateLegacyStreakIntoZustand(): Promise<void> {
  try {
    const state = useAppStore.getState();
    if (state.streakCurrent > 0 || state.streakLastActiveDate) return;
    const AsyncStorage = (
      await import('@react-native-async-storage/async-storage')
    ).default;
    const raw = await AsyncStorage.getItem('@languageeee/streak');
    if (!raw) return;
    const parsed = JSON.parse(raw) as {
      current?: number;
      lastActiveDate?: string | null;
      updatedAt?: string;
    };
    if (typeof parsed.current !== 'number') return;
    useAppStore.getState().setActivityFromCloud({
      streak: {
        current: parsed.current,
        lastActiveDate: parsed.lastActiveDate ?? null,
        updatedAt: parsed.updatedAt,
      },
    });
    await AsyncStorage.removeItem('@languageeee/streak');
  } catch {
    /* ignore */
  }
}
