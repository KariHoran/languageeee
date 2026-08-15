import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  Flashcard,
  FlashcardGrade,
  FlashcardSrsStatus,
  LearningLanguage,
} from '../types';
import {
  calculateNextReview,
  DEFAULT_EASE_FACTOR,
  type ReviewGrade,
} from './srsService';

const FLASHCARDS_KEY = '@languageeee/flashcards';
export const DEFAULT_SESSION_SIZE = 10;

/** Ключ хранения: zh — иероглиф; en/ru — префикс + lower-case; grammar — отдельный namespace. */
export function flashcardStorageId(
  surface: string,
  language: LearningLanguage,
  kind: 'word' | 'grammar' = 'word'
): string {
  const trimmed = surface.trim();
  if (!trimmed) return '';
  if (kind === 'grammar') {
    const slug = trimmed.toLowerCase().replace(/\s+/g, '_').replace(/[^\w\u4e00-\u9fff\-_:]+/g, '');
    return `grammar:${language}:${slug || 'pattern'}`;
  }
  if (language === 'en') {
    return `en:${trimmed.toLowerCase().replace(/\//g, '_')}`;
  }
  if (language === 'ru') {
    return `ru:${trimmed.toLowerCase().replace(/\//g, '_')}`;
  }
  return trimmed.replace(/\//g, '_');
}

export function inferFlashcardLanguage(
  surface: string,
  explicit?: LearningLanguage | null
): LearningLanguage {
  if (explicit === 'en' || explicit === 'zh' || explicit === 'ru') {
    return explicit;
  }
  if (/[\u4e00-\u9fff]/.test(surface)) return 'zh';
  if (/[А-Яа-яЁё]/.test(surface)) return 'ru';
  if (/[A-Za-z]/.test(surface)) return 'en';
  return 'zh';
}

function candidateIds(surface: string, language: LearningLanguage): string[] {
  const trimmed = surface.trim();
  const primary = flashcardStorageId(trimmed, language);
  const ids = new Set<string>();
  if (primary) ids.add(primary);
  if (language === 'en' || language === 'ru') {
    ids.add(trimmed);
    ids.add(trimmed.toLowerCase());
  }
  return [...ids];
}

export function normalizeCard(card: Flashcard): Flashcard {
  const language = inferFlashcardLanguage(card.hanzi, card.language);
  const kind = card.kind === 'grammar' || card.id?.startsWith('grammar:')
    ? 'grammar'
    : 'word';
  const id =
    kind === 'grammar' && card.id?.startsWith('grammar:')
      ? card.id
      : flashcardStorageId(card.hanzi, language, kind);
  const ease =
    typeof card.easeFactor === 'number' && card.easeFactor > 0
      ? card.easeFactor
      : DEFAULT_EASE_FACTOR;
  return {
    ...card,
    id: id || card.id,
    hanzi: card.hanzi.trim(),
    language,
    kind,
    suspended: Boolean(card.suspended),
    againCount: Math.max(0, Math.floor(Number(card.againCount) || 0)),
    lastGrade: card.lastGrade,
    lastReviewedAt: card.lastReviewedAt,
    pinyin: language === 'en' ? '' : card.pinyin ?? '',
    easeFactor: ease,
    interval: Number.isFinite(card.interval) ? card.interval : 0,
    repetition: Number.isFinite(card.repetition) ? card.repetition : 0,
  };
}

/** Миграция ключей + language + easeFactor. */
function migrateMap(raw: Record<string, Flashcard>): {
  map: Record<string, Flashcard>;
  changed: boolean;
} {
  const map: Record<string, Flashcard> = {};
  let changed = false;

  for (const [key, rawCard] of Object.entries(raw)) {
    if (!rawCard?.hanzi) {
      changed = true;
      continue;
    }
    const card = normalizeCard(rawCard);
    const id = card.id;
    if (
      key !== id ||
      rawCard.language !== card.language ||
      rawCard.id !== id ||
      rawCard.easeFactor !== card.easeFactor
    ) {
      changed = true;
    }
    const prev = map[id];
    if (!prev) {
      map[id] = card;
      continue;
    }
    const prevTs = new Date(prev.updatedAt || prev.createdAt || 0).getTime();
    const nextTs = new Date(card.updatedAt || card.createdAt || 0).getTime();
    map[id] = nextTs >= prevTs ? card : prev;
    changed = true;
  }

  return { map, changed };
}

async function loadMap(): Promise<Record<string, Flashcard>> {
  const raw = await AsyncStorage.getItem(FLASHCARDS_KEY);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, Flashcard>;
    const { map, changed } = migrateMap(parsed);
    if (changed) {
      await saveMap(map);
    }
    return map;
  } catch {
    return {};
  }
}

async function saveMap(map: Record<string, Flashcard>): Promise<void> {
  await AsyncStorage.setItem(FLASHCARDS_KEY, JSON.stringify(map));
}

/** again/forgot → 1, hard → 3, good/remembered → 4, easy → 5 */
export function gradeToSm2(grade: FlashcardGrade): ReviewGrade {
  switch (grade) {
    case 'again':
    case 'forgot':
      return 1;
    case 'hard':
      return 3;
    case 'easy':
      return 5;
    case 'good':
    case 'remembered':
    default:
      return 4;
  }
}

/**
 * SM-2 через srsService: Again / Hard / Good / Easy.
 */
export function applySm2(
  card: Flashcard,
  grade: FlashcardGrade,
  now = new Date()
): Flashcard {
  const normalized = normalizeCard(card);
  const result = calculateNextReview(
    {
      interval: normalized.interval,
      repetition: normalized.repetition,
      easeFactor: normalized.easeFactor,
    },
    gradeToSm2(grade)
  );
  return {
    ...normalized,
    interval: result.interval,
    repetition: result.repetition,
    easeFactor: result.easeFactor,
    nextReviewDate: new Date(result.nextReviewDate).toISOString(),
    updatedAt: now.toISOString(),
  };
}

/**
 * new — ещё не выучили (repetition === 0)
 * learning — на грани: срок наступил или скоро / короткий интервал
 * learned — выученные: не due и interval ≥ 21
 */
export function getCardSrsStatus(
  card: Flashcard,
  now = new Date()
): FlashcardSrsStatus {
  const c = normalizeCard(card);
  const due = new Date(c.nextReviewDate).getTime() <= now.getTime();
  if (c.repetition === 0) return 'new';
  if (due || c.interval < 21) return 'learning';
  return 'learned';
}

export interface FlashcardQuery {
  language?: LearningLanguage | 'all';
  /** Фильтр по книге: id или title */
  sourceBookId?: string | null;
  sourceTitle?: string | null;
}

export function filterFlashcards(
  cards: Flashcard[],
  query: FlashcardQuery = {}
): Flashcard[] {
  let list = cards.map(normalizeCard);
  const lang = query.language;
  if (lang && lang !== 'all') {
    list = list.filter((c) => (c.language ?? 'zh') === lang);
  }
  if (query.sourceBookId) {
    list = list.filter((c) => c.sourceBookId === query.sourceBookId);
  } else if (query.sourceTitle) {
    const title = query.sourceTitle.trim().toLowerCase();
    list = list.filter(
      (c) => (c.sourceTitle ?? '').trim().toLowerCase() === title
    );
  }
  return list;
}

export interface DeckStats {
  total: number;
  due: number;
  new: number;
  learning: number;
  learned: number;
}

export function computeDeckStats(
  cards: Flashcard[],
  now = new Date()
): DeckStats {
  const ts = now.getTime();
  let due = 0;
  let neu = 0;
  let learning = 0;
  let learned = 0;
  for (const raw of cards) {
    const c = normalizeCard(raw);
    if (c.suspended) continue;
    const status = getCardSrsStatus(c, now);
    if (status === 'new') neu += 1;
    else if (status === 'learning') learning += 1;
    else learned += 1;
    if (new Date(c.nextReviewDate).getTime() <= ts) due += 1;
  }
  return {
    total: cards.filter((c) => !normalizeCard(c).suspended).length,
    due,
    new: neu,
    learning,
    learned,
  };
}

/**
 * Очередь сессии.
 * mode:
 *  - default — due learning, затем new
 *  - weak — карточки с Again / низким ease / learning
 *  - mixed — чередование word / grammar / с контекстом (cloze-friendly)
 */
export function buildReviewSession(
  cards: Flashcard[],
  limit = DEFAULT_SESSION_SIZE,
  now = new Date(),
  mode: 'default' | 'weak' | 'mixed' = 'default'
): Flashcard[] {
  const ts = now.getTime();
  const normalized = cards.map(normalizeCard).filter((c) => !c.suspended);

  if (mode === 'weak') {
    const weak = normalized
      .filter(
        (c) =>
          (c.againCount ?? 0) > 0 ||
          c.lastGrade === 'again' ||
          c.lastGrade === 'forgot' ||
          c.easeFactor < 2.2 ||
          getCardSrsStatus(c, now) === 'learning'
      )
      .sort((a, b) => (b.againCount ?? 0) - (a.againCount ?? 0));
    return weak.slice(0, limit);
  }

  const dueLearning = normalized
    .filter(
      (c) =>
        new Date(c.nextReviewDate).getTime() <= ts && c.repetition > 0
    )
    .sort(
      (a, b) =>
        new Date(a.nextReviewDate).getTime() -
        new Date(b.nextReviewDate).getTime()
    );
  const dueNew = normalized
    .filter(
      (c) =>
        new Date(c.nextReviewDate).getTime() <= ts && c.repetition === 0
    )
    .sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

  if (mode === 'mixed') {
    const pool = [...dueLearning, ...dueNew];
    const grammar = pool.filter((c) => c.kind === 'grammar');
    const clozeReady = pool.filter(
      (c) => c.kind !== 'grammar' && Boolean(c.contextSentence?.includes(c.hanzi))
    );
    const words = pool.filter(
      (c) => c.kind !== 'grammar' && !clozeReady.includes(c)
    );
    const out: Flashcard[] = [];
    const seen = new Set<string>();
    const take = (list: Flashcard[]) => {
      for (const c of list) {
        if (seen.has(c.id)) continue;
        seen.add(c.id);
        out.push(c);
        if (out.length >= limit) return true;
      }
      return false;
    };
    // 1 grammar : 1 cloze : 2 words, round-robin
    while (out.length < limit) {
      const before = out.length;
      if (take(grammar.slice(0, 1))) break;
      grammar.shift();
      if (out.length >= limit) break;
      if (take(clozeReady.slice(0, 1))) break;
      clozeReady.shift();
      if (out.length >= limit) break;
      if (take(words.slice(0, 2))) break;
      words.splice(0, 2);
      if (out.length === before) break;
    }
    if (out.length < limit) {
      for (const c of pool) {
        if (seen.has(c.id)) continue;
        out.push(c);
        if (out.length >= limit) break;
      }
    }
    return out;
  }

  const seen = new Set<string>();
  const out: Flashcard[] = [];
  for (const c of [...dueLearning, ...dueNew]) {
    if (seen.has(c.id)) continue;
    seen.add(c.id);
    out.push(c);
    if (out.length >= limit) break;
  }
  return out;
}

/** Карточки для weak deck (счётчик для UI). */
export function filterWeakCards(
  cards: Flashcard[],
  now = new Date()
): Flashcard[] {
  return buildReviewSession(cards, 10_000, now, 'weak');
}

export function listSourceFilters(cards: Flashcard[]): Array<{
  bookId?: string;
  title: string;
  count: number;
}> {
  const map = new Map<string, { bookId?: string; title: string; count: number }>();
  for (const c of cards) {
    const title = c.sourceTitle?.trim();
    if (!title) continue;
    const key = c.sourceBookId || title.toLowerCase();
    const prev = map.get(key);
    if (prev) {
      prev.count += 1;
    } else {
      map.set(key, { bookId: c.sourceBookId, title, count: 1 });
    }
  }
  return [...map.values()].sort((a, b) => a.title.localeCompare(b.title, 'ru'));
}

export interface AddFlashcardInput {
  hanzi: string;
  pinyin?: string;
  translation?: string;
  hskLevel?: number;
  language?: LearningLanguage;
  kind?: 'word' | 'grammar';
  contextSentence?: string;
  sourceTitle?: string;
  sourceBookId?: string;
}

async function scheduleSyncSafe(): Promise<void> {
  try {
    const { scheduleSyncDebounced } = await import('./syncService');
    scheduleSyncDebounced();
  } catch (err) {
    console.warn('[flashcards] scheduleSync failed:', err);
  }
}

function findExisting(
  map: Record<string, Flashcard>,
  surface: string,
  language: LearningLanguage
): { key: string; card: Flashcard } | null {
  for (const id of candidateIds(surface, language)) {
    const card = map[id];
    if (card) return { key: id, card };
  }
  return null;
}

/** Добавляет слово в колоду. EN и ZH хранятся раздельно по language / id. */
export async function addFlashcard(input: AddFlashcardInput): Promise<Flashcard> {
  const surface = input.hanzi.trim();
  if (!surface) throw new Error('Пустое слово для карточки');

  const language = inferFlashcardLanguage(surface, input.language);
  const kind = input.kind === 'grammar' ? 'grammar' : 'word';
  const id = flashcardStorageId(surface, language, kind);
  if (!id) throw new Error('Пустое слово для карточки');

  const map = await loadMap();
  const existing =
    kind === 'grammar'
      ? map[id]
        ? { key: id, card: map[id]! }
        : null
      : findExisting(map, surface, language);
  const now = new Date().toISOString();

  if (existing) {
    if (existing.key !== id) {
      delete map[existing.key];
    }
    const updated: Flashcard = {
      ...normalizeCard(existing.card),
      id,
      hanzi: surface,
      language,
      kind,
      suspended: false,
      pinyin:
        language === 'zh'
          ? input.pinyin?.trim() || existing.card.pinyin
          : language === 'ru'
            ? input.pinyin?.trim() || existing.card.pinyin || ''
            : '',
      translation: input.translation?.trim() || existing.card.translation,
      hskLevel:
        language === 'zh' ? input.hskLevel ?? existing.card.hskLevel : undefined,
      contextSentence:
        input.contextSentence?.trim() || existing.card.contextSentence,
      sourceTitle: input.sourceTitle?.trim() || existing.card.sourceTitle,
      sourceBookId: input.sourceBookId?.trim() || existing.card.sourceBookId,
      updatedAt: now,
    };
    map[id] = updated;
    await saveMap(map);
    await scheduleSyncSafe();
    return updated;
  }

  const card: Flashcard = {
    id,
    hanzi: surface,
    pinyin:
      language === 'zh' || language === 'ru'
        ? input.pinyin?.trim() ?? ''
        : '',
    translation: input.translation?.trim() ?? '',
    hskLevel: language === 'zh' ? input.hskLevel : undefined,
    language,
    kind,
    contextSentence: input.contextSentence?.trim(),
    sourceTitle: input.sourceTitle?.trim(),
    sourceBookId: input.sourceBookId?.trim(),
    interval: 0,
    repetition: 0,
    easeFactor: DEFAULT_EASE_FACTOR,
    nextReviewDate: now,
    createdAt: now,
    updatedAt: now,
  };

  map[id] = card;
  await saveMap(map);
  await scheduleSyncSafe();
  return card;
}

export async function getFlashcards(
  language?: LearningLanguage | 'all',
  query?: Omit<FlashcardQuery, 'language'>
): Promise<Flashcard[]> {
  const map = await loadMap();
  const list = filterFlashcards(Object.values(map), {
    language,
    ...query,
  });
  return list.sort(
    (a, b) =>
      new Date(a.nextReviewDate).getTime() - new Date(b.nextReviewDate).getTime()
  );
}

export async function getFlashcard(
  hanzi: string,
  language?: LearningLanguage
): Promise<Flashcard | null> {
  const map = await loadMap();
  const lang = inferFlashcardLanguage(hanzi, language);
  const found = findExisting(map, hanzi, lang);
  return found ? normalizeCard(found.card) : null;
}

export async function hasFlashcard(
  hanzi: string,
  language?: LearningLanguage,
  kind: 'word' | 'grammar' = 'word'
): Promise<boolean> {
  const map = await loadMap();
  const lang = inferFlashcardLanguage(hanzi, language);
  if (kind === 'grammar') {
    const id = flashcardStorageId(hanzi, lang, 'grammar');
    return Boolean(id && map[id]);
  }
  return Boolean(findExisting(map, hanzi, lang));
}

export async function getDueFlashcards(
  now = new Date(),
  language?: LearningLanguage | 'all',
  query?: Omit<FlashcardQuery, 'language'>
): Promise<Flashcard[]> {
  const all = await getFlashcards(language, query);
  const ts = now.getTime();
  return all.filter(
    (c) => !c.suspended && new Date(c.nextReviewDate).getTime() <= ts
  );
}

/** Убрать из очереди SRS, но оставить в колоде (знаю / не повторять). */
export async function suspendFlashcard(
  cardIdOrHanzi: string,
  language?: LearningLanguage
): Promise<void> {
  const map = await loadMap();
  let key = cardIdOrHanzi;
  if (!map[key]) {
    const lang = inferFlashcardLanguage(cardIdOrHanzi, language);
    const found = findExisting(map, cardIdOrHanzi, lang);
    if (found) key = found.key;
  }
  const card = map[key];
  if (!card) return;
  map[key] = {
    ...normalizeCard(card),
    suspended: true,
    updatedAt: new Date().toISOString(),
  };
  await saveMap(map);
  await scheduleSyncSafe();
}

/**
 * «Уже знаю»: убрать из повторений (suspend) и удалить из колоды по желанию.
 * По умолчанию — suspend + remove, чтобы не таскать бесполезные.
 */
export async function markFlashcardKnown(
  cardIdOrHanzi: string,
  language?: LearningLanguage,
  options: { remove?: boolean } = { remove: true }
): Promise<void> {
  if (options.remove !== false) {
    await removeFlashcard(cardIdOrHanzi, language);
    return;
  }
  await suspendFlashcard(cardIdOrHanzi, language);
}

/** Сессия из до `limit` карточек с фильтрами языка/книги */
export async function getReviewSession(
  options: {
    language?: LearningLanguage | 'all';
    sourceBookId?: string | null;
    sourceTitle?: string | null;
    limit?: number;
    now?: Date;
    mode?: 'default' | 'weak' | 'mixed';
  } = {}
): Promise<Flashcard[]> {
  const all = await getFlashcards(options.language, {
    sourceBookId: options.sourceBookId,
    sourceTitle: options.sourceTitle,
  });
  const withContext = await ensureContextsFromBooks(all);
  return buildReviewSession(
    withContext,
    options.limit ?? DEFAULT_SESSION_SIZE,
    options.now ?? new Date(),
    options.mode ?? 'default'
  );
}

/** Если нет цитаты — взять предложение из книги-источника. */
export async function ensureContextsFromBooks(
  cards: Flashcard[]
): Promise<Flashcard[]> {
  const need = cards.filter(
    (c) => c.sourceBookId && !c.contextSentence?.trim() && c.kind !== 'grammar'
  );
  if (need.length === 0) return cards;

  let books: Array<{ id: string; paragraphs?: Array<{ chineseText?: string; originalText?: string; words?: Array<{ hanzi?: string }> }> }> = [];
  try {
    const { useAppStore } = await import('../store/useAppStore');
    books = useAppStore.getState().books ?? [];
  } catch {
    return cards;
  }

  const byId = new Map(books.map((b) => [b.id, b]));
  return cards.map((card) => {
    if (card.contextSentence?.trim() || !card.sourceBookId || card.kind === 'grammar') {
      return card;
    }
    const book = byId.get(card.sourceBookId);
    if (!book?.paragraphs?.length) return card;
    const needle = card.hanzi.trim();
    for (const p of book.paragraphs) {
      const text = (p.chineseText || p.originalText || '').trim();
      if (text && text.includes(needle)) {
        return { ...card, contextSentence: text.slice(0, 180) };
      }
      if (p.words?.some((w) => w.hanzi === needle) && text) {
        return { ...card, contextSentence: text.slice(0, 180) };
      }
    }
    return card;
  });
}

export async function reviewFlashcard(
  cardIdOrHanzi: string,
  grade: FlashcardGrade,
  language?: LearningLanguage
): Promise<Flashcard | null> {
  const map = await loadMap();
  let key = cardIdOrHanzi;
  let card = map[key];

  if (!card) {
    const lang = inferFlashcardLanguage(cardIdOrHanzi, language);
    const found = findExisting(map, cardIdOrHanzi, lang);
    if (found) {
      key = found.key;
      card = found.card;
    }
  }
  if (!card) return null;

  const base = normalizeCard(card);
  const isAgain = grade === 'again' || grade === 'forgot';
  const sm2 = applySm2(base, grade);
  const nowIso = new Date().toISOString();
  const updated: Flashcard = {
    ...sm2,
    againCount: isAgain
      ? Math.max(0, (base.againCount ?? 0) + 1)
      : base.againCount ?? 0,
    lastGrade: grade,
    lastReviewedAt: nowIso,
  };
  const canonical = updated.id;
  if (key !== canonical) {
    delete map[key];
  }
  map[canonical] = updated;
  await saveMap(map);
  await scheduleSyncSafe();
  try {
    const { useAppStore } = await import('../store/useAppStore');
    useAppStore.getState().trackActivity({ cardsReviewed: 1 });
  } catch {
    /* ignore */
  }
  return updated;
}

export async function removeFlashcard(
  cardIdOrHanzi: string,
  language?: LearningLanguage
): Promise<void> {
  const map = await loadMap();
  let key = cardIdOrHanzi;
  if (!map[key]) {
    const lang = inferFlashcardLanguage(cardIdOrHanzi, language);
    const found = findExisting(map, cardIdOrHanzi, lang);
    if (found) key = found.key;
  }
  if (!map[key]) return;

  const idForTombstone = map[key]!.id || key;
  delete map[key];
  await saveMap(map);
  try {
    const { recordTombstone, scheduleSyncDebounced } = await import('./syncService');
    await recordTombstone('flashcard', idForTombstone);
    scheduleSyncDebounced();
  } catch (err) {
    console.warn('[flashcards] remove sync failed:', err);
  }
  try {
    const { useAppStore } = await import('../store/useAppStore');
    useAppStore.setState((state) => {
      if (!state.flashcards[idForTombstone] && !state.flashcards[key]) {
        return state;
      }
      const next = { ...state.flashcards };
      delete next[idForTombstone];
      delete next[key];
      return { flashcards: next };
    });
  } catch {
    /* ignore */
  }
}

export async function getFlashcardsCount(
  language?: LearningLanguage | 'all',
  query?: Omit<FlashcardQuery, 'language'>
): Promise<DeckStats> {
  const all = await getFlashcards(language, query);
  return computeDeckStats(all);
}

export async function getFlashcardSources(
  language?: LearningLanguage | 'all'
): Promise<Array<{ bookId?: string; title: string; count: number }>> {
  const all = await getFlashcards(language);
  return listSourceFilters(all);
}
