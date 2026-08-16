import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAppStore } from '../store/useAppStore';
import type { Book, Paragraph } from '../types';

const PROGRESS_KEY = '@languageeee/reading_progress_v1';

/** Сериализация записей: bookmark и dwell не должны затирать друг друга. */
let saveQueue: Promise<unknown> = Promise.resolve();

function enqueueSave<T>(fn: () => Promise<T>): Promise<T> {
  const next = saveQueue.then(fn, fn);
  saveQueue = next.then(
    () => undefined,
    () => undefined
  );
  return next;
}

function totalActivityWordsRead(): number {
  try {
    const map = useAppStore.getState().activityByDay;
    let n = 0;
    for (const row of Object.values(map || {})) {
      n += row?.wordsRead || 0;
    }
    return n;
  } catch {
    return 0;
  }
}

/**
 * Счётчик «слов» в абзаце для геймификации.
 * После cloud sync `words` часто пустой (slim payload) — тогда считаем по тексту.
 */
export function paragraphActivityWordCount(
  paragraph: Paragraph | undefined,
  language?: Book['language']
): number {
  if (!paragraph) return 0;
  const tagged = paragraph.words?.length ?? 0;
  if (tagged > 0) return tagged;

  const text = (
    paragraph.chineseText ||
    paragraph.originalText ||
    paragraph.englishText ||
    ''
  ).trim();
  if (!text) return 0;

  const lang = language === 'en' || language === 'ru' ? language : 'zh';
  if (lang === 'zh') {
    return (text.match(/[\u4e00-\u9fff]/g) ?? []).length;
  }
  return text.split(/\s+/).filter(Boolean).length;
}

/** Сохранённая позиция чтения в книге */
export interface ReadingProgress {
  bookId: string;
  /** 0-based индекс абзаца (верхняя видимая / последняя достигнутая) */
  paragraphIndex: number;
  paragraphsTotal: number;
  /** Уникальные слова в абзацах 0…paragraphIndex включительно */
  wordsSeen: number;
  /** Доля прочитанных абзацев 0…100 */
  percent: number;
  updatedAt: string;
  /**
   * До какого абзаца слова уже засчитаны в дневную активность (legacy high-water).
   * Новые сохранения используют activityCreditedIndices.
   */
  activityThroughIndex?: number;
  /** Индексы абзацев, уже засчитанных в дневную активность (после dwell). */
  activityCreditedIndices?: number[];
}

export type ProgressMap = Record<string, ReadingProgress>;

async function loadMap(): Promise<ProgressMap> {
  try {
    const raw = await AsyncStorage.getItem(PROGRESS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as ProgressMap;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

async function saveMap(map: ProgressMap): Promise<void> {
  await AsyncStorage.setItem(PROGRESS_KEY, JSON.stringify(map));
}

function queueCloudSync() {
  // Локальная запись уже сделана; в облако — только online (reconnect flush).
  void import('./cloudSyncService')
    .then((m) => m.scheduleReadingProgressSync())
    .catch(() => undefined);
}

export function countUniqueWordsUpTo(
  book: Book,
  paragraphIndex: number
): number {
  const seen = new Set<string>();
  const lang =
    book.language === 'en' || book.language === 'ru' ? book.language : 'zh';
  const max = Math.max(0, Math.min(paragraphIndex, book.paragraphs.length - 1));
  for (let i = 0; i <= max; i++) {
    const p = book.paragraphs[i];
    if (!p) continue;
    const words = p.words ?? [];
    if (words.length > 0) {
      for (const w of words) {
        const surface = w.hanzi?.trim();
        if (!surface) continue;
        seen.add(lang === 'en' || lang === 'ru' ? surface.toLowerCase() : surface);
      }
      continue;
    }
    // Slim cloud book: приближённый unique-счётчик по токенам текста
    const text = (p.chineseText || p.originalText || p.englishText || '').trim();
    if (!text) continue;
    if (lang === 'zh') {
      for (const ch of text.match(/[\u4e00-\u9fff]/g) ?? []) seen.add(ch);
    } else {
      for (const tok of text.split(/\s+/).filter(Boolean)) {
        seen.add(tok.toLowerCase());
      }
    }
  }
  return seen.size;
}

export function buildReadingProgress(
  book: Book,
  paragraphIndex: number,
  now = new Date()
): ReadingProgress {
  const total = Math.max(1, book.paragraphs.length);
  const idx = Math.max(0, Math.min(paragraphIndex, total - 1));
  const percent = Math.round(((idx + 1) / total) * 1000) / 10;
  return {
    bookId: book.id,
    paragraphIndex: idx,
    paragraphsTotal: book.paragraphs.length,
    wordsSeen: countUniqueWordsUpTo(book, idx),
    percent,
    updatedAt: now.toISOString(),
  };
}

export async function getReadingProgress(
  bookId: string
): Promise<ReadingProgress | null> {
  if (!bookId) return null;
  const map = await loadMap();
  return map[bookId] ?? null;
}

/**
 * Позиция для открытия книги: сначала подтянуть/смержить Firestore,
 * затем вернуть локальный результат (кросс-девайс resume).
 */
export async function resolveReadingProgress(
  bookId: string
): Promise<ReadingProgress | null> {
  if (!bookId) return null;
  try {
    const { pullAndMergeReadingProgress } = await import('./cloudSyncService');
    await pullAndMergeReadingProgress();
  } catch {
    // офлайн / гость — остаёмся на локальном кэше
  }
  return getReadingProgress(bookId);
}

export async function getAllReadingProgress(): Promise<ReadingProgress[]> {
  const map = await loadMap();
  return Object.values(map).sort(
    (a, b) =>
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
}

export async function getReadingProgressMap(): Promise<ProgressMap> {
  return loadMap();
}

export async function replaceReadingProgressMap(
  map: ProgressMap
): Promise<void> {
  await saveMap(map && typeof map === 'object' ? map : {});
}

export type SaveReadingProgressOptions = {
  /**
   * Засчитать слова текущего абзаца в дневную активность (после dwell).
   * По умолчанию false: быстрый скролл только двигает закладку.
   */
  creditWords?: boolean;
};

/**
 * Какие абзацы уже засчитаны в дневную активность.
 * Важно: НЕ путать с bookmark `paragraphIndex` — иначе после сохранения
 * позиции все пролистанные абзацы считаются «уже учтёнными» и слова = 0.
 *
 * Если в activity всё ещё 0 слов, индексы игнорируем (legacy fill / сброс
 * накрутки) — иначе dwell никогда не засчитает чтение.
 */
function creditedParagraphSet(prev: ReadingProgress | undefined): Set<number> {
  if (!prev?.activityCreditedIndices?.length) return new Set();
  if (totalActivityWordsRead() === 0) return new Set();
  return new Set(
    prev.activityCreditedIndices.filter((n) => Number.isFinite(n) && n >= 0)
  );
}

export async function saveReadingProgress(
  book: Book,
  paragraphIndex: number,
  opts?: SaveReadingProgressOptions
): Promise<ReadingProgress> {
  return enqueueSave(async () => {
    const creditWords = opts?.creditWords === true;
    const progress = buildReadingProgress(book, paragraphIndex);
    const map = await loadMap();
    const prev = map[book.id];

    let activityCreditedIndices = prev?.activityCreditedIndices
      ? [...prev.activityCreditedIndices]
      : undefined;
    // Закладка ≠ засчитанные слова: без явного списка индексов high-water = -1
    let activityThroughIndex =
      typeof prev?.activityThroughIndex === 'number'
        ? prev.activityThroughIndex
        : -1;
    let wordsDelta = 0;

    if (creditWords) {
      const credited = creditedParagraphSet(prev);
      // Сбрасываем «залипший» legacy-fill в сохранённых данных
      if (
        (prev?.activityCreditedIndices?.length ?? 0) > 0 &&
        credited.size === 0
      ) {
        activityCreditedIndices = undefined;
        activityThroughIndex = -1;
      }
      const i = progress.paragraphIndex;
      if (!credited.has(i)) {
        credited.add(i);
        wordsDelta = paragraphActivityWordCount(
          book.paragraphs[i],
          book.language
        );
      }
      activityCreditedIndices = [...credited].sort((a, b) => a - b);
      activityThroughIndex =
        activityCreditedIndices.length > 0
          ? Math.max(...activityCreditedIndices)
          : -1;
    }

    const next: ReadingProgress = {
      ...progress,
      activityThroughIndex,
      ...(activityCreditedIndices && activityCreditedIndices.length > 0
        ? { activityCreditedIndices }
        : {}),
    };
    map[book.id] = next;
    await saveMap(map);
    queueCloudSync();

    if (wordsDelta > 0) {
      try {
        useAppStore.getState().trackActivity({ wordsRead: wordsDelta });
      } catch {
        /* ignore */
      }
    }

    return next;
  });
}

export async function clearReadingProgress(bookId: string): Promise<void> {
  const map = await loadMap();
  delete map[bookId];
  await saveMap(map);
  try {
    const { recordTombstone, scheduleSyncDebounced } = await import(
      './syncService'
    );
    await recordTombstone('readingProgress', bookId);
    scheduleSyncDebounced();
  } catch {
    queueCloudSync();
  }
}

/** Самая свежая позиция среди списка книг пользователя */
export async function getContinueReading(
  books: Book[]
): Promise<{ book: Book; progress: ReadingProgress } | null> {
  if (!books.length) return null;
  const byId = new Map(books.map((b) => [b.id, b]));
  const all = await getAllReadingProgress();
  for (const p of all) {
    const book = byId.get(p.bookId);
    if (!book) continue;
    if (p.paragraphsTotal <= 0) continue;
    return { book, progress: p };
  }
  return null;
}
