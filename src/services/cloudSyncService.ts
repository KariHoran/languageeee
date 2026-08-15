import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  writeBatch,
} from 'firebase/firestore';
import type {
  Book as DomainBook,
  Collection as DomainCollection,
  Flashcard as DomainFlashcard,
} from '../types/domain';
import { Book, Collection, CollectionWord, Flashcard, Word } from '../types';
import { useAppStore, resetInflatedReadingStatsIfNeeded } from '../store/useAppStore';
import type { StickyNote } from '../types/stickyNote';
import { mergeActivityByDay, mergeActivityByDayWithEpoch, pruneActivityByDay } from './activityAnalytics';
import { getCloudUid, isCloudUser, resolveFirestoreUid, type AuthUser } from './authService';
import { GUEST_OWNER_ID, getDataOwnerId } from './dataOwner';
import { getFirebase, isFirebaseConfigured } from './firebaseClient';
import { isNetworkOnline } from './networkStatusService';
import {
  clearOfflinePending,
  markOfflinePending,
} from './offlineSyncQueue';
import { bookContentRichness } from './offlineLibraryService';
import type { ReadingProgress } from './readingProgressStore';
import type { UserTrack } from './userTracksStore';

/** Старые авто-сиднутые папки — не поднимаем из legacy meta / не тащим новым аккаунтам.
 *  Пользовательские подборки с любым названием (в т.ч. «минсоны») сохраняем как есть. */
const LEGACY_PRESET_COLLECTION_IDS = new Set([
  'col-favorites',
  'col-study',
  'col-fantasy',
  'col-drafts',
  'col-hsk-beginners',
  'col-genshin-danmei-kpop',
  'col-import-favorites',
  'col-uncategorized',
]);

function withoutLegacyPresetCollections(
  map: Record<string, Collection>
): Record<string, Collection> {
  return Object.fromEntries(
    Object.entries(map).filter(([id]) => !LEGACY_PRESET_COLLECTION_IDS.has(id))
  );
}

/** Ключи AsyncStorage, участвующие в облачной синхронизации */
export const SYNC_STORAGE_KEYS = {
  books: '@languageeee/books',
  collections: '@languageeee/collections',
  collectionWords: '@languageeee/collection_words',
  flashcards: '@languageeee/flashcards',
  savedWords: '@languageeee/saved_words',
  tombstones: '@languageeee/sync_tombstones',
  lastSyncedAt: '@languageeee/sync_last_at',
} as const;

export type SyncEntityType =
  | 'book'
  | 'collection'
  | 'collectionWord'
  | 'flashcard'
  | 'readingProgress'
  | 'userTrack'
  | 'stickyNote';

export interface SyncTombstone {
  id: string;
  entity: SyncEntityType;
  deletedAt: string;
}

/** Снимок данных пользователя для merge / upload */
export interface SyncSnapshot {
  books: Record<string, Book>;
  collections: Record<string, Collection>;
  collectionWords: Record<string, CollectionWord>;
  flashcards: Record<string, Flashcard>;
  savedWords: Record<string, Word>;
  /** Позиции чтения по bookId */
  readingProgress?: Record<string, ReadingProgress>;
  /** Метаданные треков (файлы — только локально в IndexedDB) */
  userTracks?: Record<string, UserTrack>;
  /** Sticky-заметки ридера */
  stickyNotes?: StickyNote[];
  /** Zustand domain-слой (книги / коллекции / SRS) */
  domain?: {
    books: DomainBook[];
    collections: DomainCollection[];
    flashcards: Record<string, DomainFlashcard>;
  };
  /** Профиль: стрик + пара языков + дневная активность */
  prefs?: {
    learningLanguage?: string;
    nativeLanguage?: string;
    streak?: { current: number; lastActiveDate: string | null; updatedAt: string };
    activityByDay?: Record<
      string,
      { wordsRead: number; cardsReviewed: number; minutes: number; updatedAt: string }
    >;
    /** Поколение сброса reading-счётчиков (words/minutes). */
    activityEpoch?: number;
  };
  tombstones: SyncTombstone[];
  updatedAt: string;
}

export type SyncStatus =
  | 'idle'
  | 'syncing'
  | 'synced'
  | 'offline'
  | 'error'
  | 'unconfigured'
  | 'guest';

export interface SyncState {
  status: SyncStatus;
  message: string;
  lastSyncedAt: string | null;
  userId: string | null;
  error?: string;
}

type SyncListener = (state: SyncState) => void;

const listeners = new Set<SyncListener>();

let currentState: SyncState = {
  status: 'idle',
  message: 'Локально',
  lastSyncedAt: null,
  userId: null,
};

const FIRESTORE_RULES_HINT = `
[Firestore] Permission denied — база отклонила запись/чтение.

Откройте Firebase Console → Firestore Database → Rules и вставьте:

rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;

      match /{document=**} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }
    }
  }
}

Затем нажмите Publish. Также убедитесь, что создана база Firestore (режим production или test).
Firebase Storage не используется — книги и подборки синхронизируются только через Firestore.
`.trim();

function setState(patch: Partial<SyncState>) {
  currentState = { ...currentState, ...patch };
  listeners.forEach((fn) => fn(currentState));
}

export function getSyncState(): SyncState {
  return currentState;
}

export function subscribeSyncState(listener: SyncListener): () => void {
  listeners.add(listener);
  listener(currentState);
  return () => listeners.delete(listener);
}

function isPermissionDenied(e: unknown): boolean {
  if (!e || typeof e !== 'object') return false;
  const code = 'code' in e ? String((e as { code: string }).code) : '';
  const message = e instanceof Error ? e.message : String(e);
  return (
    code === 'permission-denied' ||
    /permission[- ]?denied/i.test(message) ||
    /Missing or insufficient permissions/i.test(message)
  );
}

function handleSyncError(e: unknown, fallback: string): string {
  if (isPermissionDenied(e)) {
    console.error(FIRESTORE_RULES_HINT);
    return 'Нет доступа к Firestore. Проверьте Rules в Firebase Console.';
  }
  return e instanceof Error ? e.message : fallback;
}

/**
 * Сериализация для Firestore: без функций, Symbol, undefined, циклических ссылок.
 * Не бросает — битые ветки отбрасываются.
 */
function sanitizeForFirestore<T>(value: T): T {
  try {
    return sanitizeValue(value, 0) as T;
  } catch (err) {
    console.warn('[cloudSync] sanitizeForFirestore fallback:', err);
    try {
      return JSON.parse(
        JSON.stringify(value, (_k, v) => {
          if (typeof v === 'function' || typeof v === 'symbol') return undefined;
          if (typeof v === 'number' && !Number.isFinite(v)) return null;
          return v;
        })
      ) as T;
    } catch (err2) {
      console.error('[cloudSync] sanitizeForFirestore failed completely:', err2);
      return {} as T;
    }
  }
}

function sanitizeValue(value: unknown, depth: number): unknown {
  if (depth > 40) return null;
  if (value === undefined) return undefined;
  if (value === null) return null;

  const t = typeof value;
  if (t === 'string' || t === 'boolean') return value;
  if (t === 'number') return Number.isFinite(value as number) ? value : null;
  if (t === 'bigint') return String(value);
  if (t === 'function' || t === 'symbol' || t === 'undefined') return undefined;

  if (value instanceof Date) {
    const ms = value.getTime();
    return Number.isFinite(ms) ? value.toISOString() : null;
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => sanitizeValue(item, depth + 1))
      .filter((item) => item !== undefined);
  }

  if (t === 'object') {
    // Blob / File / и т.п. — не в Firestore
    if (typeof Blob !== 'undefined' && value instanceof Blob) return undefined;
    if (typeof File !== 'undefined' && value instanceof File) return undefined;

    const proto = Object.getPrototypeOf(value);
    if (proto !== Object.prototype && proto !== null) {
      try {
        return sanitizeValue(
          JSON.parse(
            JSON.stringify(value, (_k, v) => {
              if (typeof v === 'function' || typeof v === 'symbol') return undefined;
              return v;
            })
          ),
          depth + 1
        );
      } catch {
        return undefined;
      }
    }

    const out: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(
      value as Record<string, unknown>
    )) {
      if (!key || key.startsWith('__')) continue;
      const cleaned = sanitizeValue(nested, depth + 1);
      if (cleaned !== undefined) out[key] = cleaned;
    }
    return out;
  }

  return undefined;
}

/** Лимит документа Firestore ~1 MiB; оставляем запас. */
const FIRESTORE_SAFE_BYTES = 900_000;

function utf8ByteSize(value: unknown): number {
  try {
    if (typeof TextEncoder !== 'undefined') {
      return new TextEncoder().encode(JSON.stringify(value)).length;
    }
  } catch {
    /* fall through */
  }
  try {
    return JSON.stringify(value).length;
  } catch {
    return FIRESTORE_SAFE_BYTES + 1;
  }
}

/**
 * Облачный payload книги: без words/grammar (они раздувают документ >1MB).
 * Тексты абзацев + sourceText достаточно, чтобы ридер пересобрал токены на устройстве.
 * ownerUserId всегда = auth uid (путь users/{uid}/books/...).
 */
function bookPayloadForCloud(book: Book, uid: string): Record<string, unknown> {
  const slimParagraphs = (book.paragraphs ?? []).map((p) => ({
    originalText: String(p?.originalText ?? ''),
    chineseText: String(p?.chineseText ?? ''),
    englishText: String(p?.englishText ?? ''),
    russianTranslation: String(p?.russianTranslation ?? ''),
    words: [] as Word[],
    grammar: [] as Array<{
      structure: string;
      explanation: string;
      example: string;
      hskLevel?: number;
    }>,
  }));

  let payload: Record<string, unknown> = sanitizeForFirestore({
    id: book.id,
    title: book.title ?? '',
    russianTitle: book.russianTitle ?? null,
    ownerUserId: uid,
    userId: uid,
    authorId: uid,
    collectionId: book.collectionId ?? null,
    language: book.language === 'en' ? 'en' : 'zh',
    catalogId: book.catalogId ?? null,
    targetHskLevel: book.targetHskLevel ?? 2,
    createdAt: book.createdAt ?? new Date().toISOString(),
    updatedAt: book.updatedAt ?? book.createdAt ?? new Date().toISOString(),
    sourceText: book.sourceText ?? null,
    originalRussianText: book.originalRussianText ?? null,
    paragraphs: slimParagraphs,
  });

  if (utf8ByteSize(payload) <= FIRESTORE_SAFE_BYTES) return payload;

  // Убираем дублирующий sourceText — текст уже в абзацах
  payload = sanitizeForFirestore({ ...payload, sourceText: null });
  if (utf8ByteSize(payload) <= FIRESTORE_SAFE_BYTES) return payload;

  // Крайний случай: только мета + укороченные абзацы
  const maxParas = Math.max(1, Math.floor(slimParagraphs.length / 2));
  payload = sanitizeForFirestore({
    ...payload,
    paragraphs: slimParagraphs.slice(0, maxParas),
    sourceText: (book.sourceText || '').slice(0, 50_000) || null,
    cloudTruncated: true,
  });
  return payload;
}

/** Подборка → плоский документ users/{uid}/collections/{id} */
function collectionPayloadForCloud(
  col: Collection,
  uid: string
): Record<string, unknown> {
  return sanitizeForFirestore({
    id: col.id,
    title: col.title ?? '',
    description: col.description ?? null,
    color: col.color ?? null,
    ownerUserId: uid,
    userId: col.userId || uid,
    authorId: col.authorId || col.userId || uid,
    isPublic: !!col.isPublic,
    shareSlug: col.shareSlug ?? null,
    publishedAt: col.publishedAt ?? null,
    createdAt: col.createdAt ?? null,
    updatedAt: col.updatedAt ?? null,
  }) as Record<string, unknown>;
}

/** Карточка → плоский документ без лишних полей */
function flashcardPayloadForCloud(card: Flashcard): Record<string, unknown> {
  return sanitizeForFirestore({
    id: card.id,
    hanzi: card.hanzi ?? '',
    pinyin: card.pinyin ?? '',
    translation: card.translation ?? '',
    hskLevel: card.hskLevel ?? null,
    language:
      card.language === 'en' || card.language === 'ru' ? card.language : 'zh',
    kind: card.kind === 'grammar' ? 'grammar' : 'word',
    suspended: Boolean(card.suspended),
    againCount: Math.max(0, Math.floor(Number(card.againCount) || 0)),
    lastGrade: card.lastGrade ?? null,
    lastReviewedAt: card.lastReviewedAt ?? null,
    contextSentence: card.contextSentence ?? null,
    sourceTitle: card.sourceTitle ?? null,
    sourceBookId: card.sourceBookId ?? null,
    interval: card.interval ?? 0,
    repetition: card.repetition ?? 0,
    easeFactor: card.easeFactor ?? 2.5,
    nextReviewDate: card.nextReviewDate ?? null,
    createdAt: card.createdAt ?? null,
    updatedAt: card.updatedAt ?? null,
  }) as Record<string, unknown>;
}

/** Восстанавливает структуру книги после чтения из Firestore. */
function hydrateBookFromCloud(raw: Book, uid: string): Book {
  const paragraphs = (raw.paragraphs ?? []).map((p) => ({
    originalText: p.originalText ?? '',
    chineseText: p.chineseText ?? '',
    englishText: p.englishText ?? '',
    russianTranslation: p.russianTranslation ?? '',
    words: Array.isArray(p.words) ? p.words : [],
    grammar: Array.isArray(p.grammar) ? p.grammar : [],
  }));

  let sourceText = raw.sourceText;
  if (!sourceText?.trim() && paragraphs.length > 0) {
    sourceText = paragraphs
      .map((p) => p.chineseText || p.englishText || p.originalText || '')
      .filter(Boolean)
      .join('\n\n');
  }

  return {
    ...raw,
    ownerUserId: raw.ownerUserId || uid,
    language: raw.language === 'en' ? 'en' : 'zh',
    targetHskLevel: raw.targetHskLevel ?? 2,
    createdAt: raw.createdAt || new Date().toISOString(),
    paragraphs,
    sourceText,
  };
}

/** Domain в meta не тащим целиком — книги уже в users/{uid}/books. */
function domainPayloadForCloud(
  domain: SyncSnapshot['domain']
): SyncSnapshot['domain'] | null {
  if (!domain) return null;
  return {
    books: [],
    collections: domain.collections ?? [],
    flashcards: domain.flashcards ?? {},
  };
}

async function readJson<T>(key: string, fallback: T): Promise<T> {
  const raw = await AsyncStorage.getItem(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

async function writeJson(key: string, value: unknown): Promise<void> {
  await AsyncStorage.setItem(key, JSON.stringify(value));
}

function toMs(value: string | number | undefined | null): number {
  if (value == null) return 0;
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const t = new Date(value).getTime();
  return Number.isFinite(t) ? t : 0;
}

/** Книги: lastReadAt / updatedAt — побеждает более свежий. */
function bookTimestamp(item: {
  lastReadAt?: number | string;
  updatedAt?: string;
  createdAt?: string | number;
}): number {
  return Math.max(
    toMs(item.lastReadAt),
    toMs(item.updatedAt),
    toMs(item.createdAt)
  );
}

/**
 * Cloud meta часто новее по updatedAt, но paragraphs slim (words: []).
 * Для офлайн-ридера оставляем более «богатый» локальный текст.
 */
function mergeBookPair(local?: Book, remote?: Book): Book | undefined {
  if (!local) return remote;
  if (!remote) return local;
  const newer =
    bookTimestamp(local) >= bookTimestamp(remote) ? local : remote;
  const older = newer === local ? remote : local;
  const newerRich = bookContentRichness(newer);
  const olderRich = bookContentRichness(older);
  if (olderRich > newerRich + 50) {
    return {
      ...newer,
      paragraphs: older.paragraphs,
      sourceText: older.sourceText?.trim()
        ? older.sourceText
        : newer.sourceText,
    };
  }
  return newer;
}

function mergeBooksMaps(
  local: Record<string, Book>,
  remote: Record<string, Book>,
  tombstones: SyncTombstone[]
): Record<string, Book> {
  const result: Record<string, Book> = {};
  const ids = new Set([...Object.keys(local), ...Object.keys(remote)]);

  for (const id of ids) {
    const tomb = tombstones
      .filter((t) => t.entity === 'book' && t.id === id)
      .sort(
        (a, b) =>
          new Date(b.deletedAt).getTime() - new Date(a.deletedAt).getTime()
      )[0];

    const winner = mergeBookPair(local[id], remote[id]);
    if (!winner) continue;

    if (tomb && new Date(tomb.deletedAt).getTime() > bookTimestamp(winner)) {
      continue;
    }

    result[id] = winner;
  }

  return result;
}

/** SRS: nextReviewDate / updatedAt — побеждает более свежий прогресс. */
function flashcardTimestamp(item: {
  nextReviewDate?: string | number;
  updatedAt?: string;
  createdAt?: string | number;
}): number {
  return Math.max(
    toMs(item.updatedAt),
    toMs(item.nextReviewDate),
    toMs(item.createdAt)
  );
}

function entityUpdatedAt(item: {
  updatedAt?: string;
  createdAt?: string | number;
  lastReadAt?: number | string;
  nextReviewDate?: string | number;
}): number {
  return Math.max(
    toMs(item.updatedAt),
    toMs(item.lastReadAt),
    toMs(item.nextReviewDate),
    toMs(item.createdAt)
  );
}

function pickWinner<T>(
  localItem: T | undefined,
  remoteItem: T | undefined,
  score: (item: T) => number
): T | undefined {
  if (!localItem) return remoteItem;
  if (!remoteItem) return localItem;
  return score(localItem) >= score(remoteItem) ? localItem : remoteItem;
}

/** Двусторонний merge карт + учёт tombstones */
export function mergeRecords<T extends { updatedAt?: string; createdAt?: string }>(
  local: Record<string, T>,
  remote: Record<string, T>,
  tombstones: SyncTombstone[],
  entity: SyncEntityType,
  score: (item: T) => number = entityUpdatedAt
): Record<string, T> {
  const result: Record<string, T> = {};
  const ids = new Set([...Object.keys(local), ...Object.keys(remote)]);

  for (const id of ids) {
    const tomb = tombstones
      .filter((t) => t.entity === entity && t.id === id)
      .sort((a, b) => new Date(b.deletedAt).getTime() - new Date(a.deletedAt).getTime())[0];

    const winner = pickWinner(local[id], remote[id], score);
    if (!winner) continue;

    if (tomb && new Date(tomb.deletedAt).getTime() > score(winner)) {
      continue;
    }

    result[id] = winner;
  }

  return result;
}

export function mergeTombstones(a: SyncTombstone[], b: SyncTombstone[]): SyncTombstone[] {
  const map = new Map<string, SyncTombstone>();
  for (const t of [...a, ...b]) {
    const key = `${t.entity}:${t.id}`;
    const prev = map.get(key);
    if (!prev || new Date(t.deletedAt).getTime() > new Date(prev.deletedAt).getTime()) {
      map.set(key, t);
    }
  }
  return Array.from(map.values());
}

function readDomainFromZustand(): NonNullable<SyncSnapshot['domain']> {
  const state = useAppStore.getState();
  return {
    books: state.books,
    collections: state.collections,
    flashcards: state.flashcards,
  };
}

function applyDomainToZustand(domain: NonNullable<SyncSnapshot['domain']>): void {
  useAppStore.setState({
    books: domain.books,
    collections: domain.collections,
    flashcards: domain.flashcards,
  });
}

function readStickyNotesFromZustand(): StickyNote[] {
  return useAppStore.getState().stickyNotes ?? [];
}

function applyStickyNotesToZustand(notes: StickyNote[]): void {
  useAppStore.setState({ stickyNotes: notes });
}

function mergeStickyNotes(
  local: StickyNote[],
  remote: StickyNote[],
  tombstones: SyncTombstone[]
): StickyNote[] {
  const map = new Map<string, StickyNote>();
  for (const n of [...remote, ...local]) {
    const prev = map.get(n.id);
    if (!prev || (n.createdAt ?? 0) >= (prev.createdAt ?? 0)) {
      map.set(n.id, n);
    }
  }
  for (const tomb of tombstones) {
    if (tomb.entity !== 'stickyNote') continue;
    const note = map.get(tomb.id);
    if (!note) continue;
    if (new Date(tomb.deletedAt).getTime() > (note.createdAt ?? 0)) {
      map.delete(tomb.id);
    }
  }
  return Array.from(map.values()).sort(
    (a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0)
  );
}

function mergeDomainBooks(local: DomainBook[], remote: DomainBook[]): DomainBook[] {
  const map = new Map<string, DomainBook>();
  for (const book of [...remote, ...local]) {
    const prev = map.get(book.id);
    if (!prev || bookTimestamp(book) >= bookTimestamp(prev)) {
      map.set(book.id, book);
    }
  }
  return Array.from(map.values()).sort((a, b) => b.lastReadAt - a.lastReadAt);
}

function mergeDomainCollections(
  local: DomainCollection[],
  remote: DomainCollection[]
): DomainCollection[] {
  const map = new Map<string, DomainCollection>();
  for (const col of [...remote, ...local]) {
    const prev = map.get(col.id);
    if (!prev || col.createdAt >= prev.createdAt) {
      if (prev) {
        map.set(col.id, {
          ...col,
          wordIds: Array.from(new Set([...prev.wordIds, ...col.wordIds])),
          bookIds: Array.from(new Set([...prev.bookIds, ...col.bookIds])),
        });
      } else {
        map.set(col.id, col);
      }
    } else if (prev) {
      map.set(col.id, {
        ...prev,
        wordIds: Array.from(new Set([...prev.wordIds, ...col.wordIds])),
        bookIds: Array.from(new Set([...prev.bookIds, ...col.bookIds])),
      });
    }
  }
  return Array.from(map.values());
}

function mergeDomainFlashcards(
  local: Record<string, DomainFlashcard>,
  remote: Record<string, DomainFlashcard>
): Record<string, DomainFlashcard> {
  const result: Record<string, DomainFlashcard> = {};
  const ids = new Set([...Object.keys(local), ...Object.keys(remote)]);
  for (const id of ids) {
    const winner = pickWinner(local[id], remote[id], flashcardTimestamp);
    if (winner) result[id] = winner;
  }
  return result;
}

export function mergeSnapshots(local: SyncSnapshot, remote: SyncSnapshot): SyncSnapshot {
  const tombstones = mergeTombstones(local.tombstones, remote.tombstones);
  const localDomain = local.domain ?? { books: [], collections: [], flashcards: {} };
  const remoteDomain = remote.domain ?? { books: [], collections: [], flashcards: {} };

  // Стрик: берём больший current, или более свежий updatedAt
  const localStreak = local.prefs?.streak;
  const remoteStreak = remote.prefs?.streak;
  let streak = localStreak ?? remoteStreak;
  if (localStreak && remoteStreak) {
    const lMs = toMs(localStreak.updatedAt);
    const rMs = toMs(remoteStreak.updatedAt);
    streak =
      remoteStreak.current > localStreak.current
        ? remoteStreak
        : localStreak.current > remoteStreak.current
          ? localStreak
          : rMs >= lMs
            ? remoteStreak
            : localStreak;
  }

  const activityMerged = mergeActivityByDayWithEpoch(
    local.prefs?.activityByDay,
    local.prefs?.activityEpoch ?? 0,
    remote.prefs?.activityByDay,
    remote.prefs?.activityEpoch ?? 0
  );

  return {
    books: mergeBooksMaps(local.books, remote.books, tombstones),
    collections: mergeRecords(
      local.collections,
      remote.collections,
      tombstones,
      'collection'
    ),
    collectionWords: mergeRecords(
      local.collectionWords,
      remote.collectionWords,
      tombstones,
      'collectionWord'
    ),
    flashcards: mergeRecords(
      local.flashcards,
      remote.flashcards,
      tombstones,
      'flashcard',
      flashcardTimestamp
    ),
    savedWords: { ...remote.savedWords, ...local.savedWords },
    readingProgress: mergeRecords(
      local.readingProgress ?? {},
      remote.readingProgress ?? {},
      tombstones,
      'readingProgress',
      (item) => toMs(item.updatedAt)
    ),
    userTracks: mergeRecords(
      local.userTracks ?? {},
      remote.userTracks ?? {},
      tombstones,
      'userTrack',
      (item) => Math.max(toMs(item.updatedAt), toMs(item.createdAt))
    ),
    stickyNotes: mergeStickyNotes(
      local.stickyNotes ?? [],
      remote.stickyNotes ?? [],
      tombstones
    ),
    domain: {
      books: mergeDomainBooks(localDomain.books, remoteDomain.books),
      collections: mergeDomainCollections(
        localDomain.collections,
        remoteDomain.collections
      ),
      flashcards: mergeDomainFlashcards(
        localDomain.flashcards,
        remoteDomain.flashcards
      ),
    },
    prefs: {
      learningLanguage:
        local.prefs?.learningLanguage ?? remote.prefs?.learningLanguage ?? 'zh',
      nativeLanguage:
        local.prefs?.nativeLanguage ?? remote.prefs?.nativeLanguage ?? 'ru',
      streak,
      activityByDay: activityMerged.activityByDay,
      activityEpoch: activityMerged.activityEpoch,
    },
    tombstones,
    updatedAt: new Date().toISOString(),
  };
}

export async function loadLocalSnapshot(): Promise<SyncSnapshot> {
  const [books, collections, collectionWords, flashcards, savedWords, tombstones] =
    await Promise.all([
      readJson<Record<string, Book>>(SYNC_STORAGE_KEYS.books, {}),
      readJson<Record<string, Collection>>(SYNC_STORAGE_KEYS.collections, {}),
      readJson<Record<string, CollectionWord>>(SYNC_STORAGE_KEYS.collectionWords, {}),
      readJson<Record<string, Flashcard>>(SYNC_STORAGE_KEYS.flashcards, {}),
      readJson<Record<string, Word>>(SYNC_STORAGE_KEYS.savedWords, {}),
      readJson<SyncTombstone[]>(SYNC_STORAGE_KEYS.tombstones, []),
    ]);

  const { loadStreak } = await import('./streakStore');
  const { getLearningLanguage, getNativeLanguage } = await import('./onboardingService');
  const { getReadingProgressMap } = await import('./readingProgressStore');
  const { getUserTracksMap } = await import('./userTracksStore');

  // Не блокируем sync загрузкой аудио — файлы только в IndexedDB на устройстве
  const [streak, learningLanguage, nativeLanguage, readingProgress, userTracks] =
    await Promise.all([
      loadStreak(),
      getLearningLanguage(),
      getNativeLanguage(),
      getReadingProgressMap(),
      getUserTracksMap(),
    ]);

  const ownerId = getDataOwnerId();
  /** Книги/подборки, созданные как guest до логина, тоже уезжают в users/{uid}/ */
  const ownedBooks = Object.fromEntries(
    Object.entries(books).filter(([, b]) => {
      const owner = b.ownerUserId || ownerId;
      return owner === ownerId || owner === GUEST_OWNER_ID;
    })
  );
  const ownedCollections = Object.fromEntries(
    Object.entries(collections).filter(([, c]) => {
      const owner = c.ownerUserId || ownerId;
      return owner === ownerId || owner === GUEST_OWNER_ID;
    })
  );
  const ownedTracks = Object.fromEntries(
    Object.entries(userTracks).filter(([, t]) => {
      const owner = t.ownerUserId || ownerId;
      return owner === ownerId || owner === GUEST_OWNER_ID;
    })
  );

  const activityByDay = pruneActivityByDay(
    useAppStore.getState().activityByDay ?? {}
  );
  const activityEpoch = useAppStore.getState().activityEpoch ?? 0;

  return {
    books: ownedBooks,
    collections: ownedCollections,
    collectionWords,
    flashcards,
    savedWords,
    readingProgress,
    userTracks: ownedTracks,
    stickyNotes: readStickyNotesFromZustand(),
    domain: readDomainFromZustand(),
    prefs: {
      learningLanguage,
      nativeLanguage,
      streak,
      activityByDay,
      activityEpoch,
    },
    tombstones,
    updatedAt: new Date().toISOString(),
  };
}

export async function applyLocalSnapshot(snapshot: SyncSnapshot): Promise<void> {
  // После logout in-flight sync не должен вернуть книги предыдущего пользователя
  const uid = getCloudUid() || (await resolveFirestoreUid());
  if (!uid) {
    console.warn('[cloudSync] skip applyLocalSnapshot — нет auth uid');
    return;
  }

  const ownerUserId = uid;

  const stampBooks = Object.fromEntries(
    Object.entries(snapshot.books).map(([id, book]) => [
      id,
      hydrateBookFromCloud(
        { ...book, ownerUserId: book.ownerUserId || ownerUserId },
        ownerUserId
      ),
    ])
  );
  const stampCollections = Object.fromEntries(
    Object.entries(snapshot.collections).map(([id, col]) => [
      id,
      { ...col, ownerUserId: col.ownerUserId || ownerUserId },
    ])
  );

  await Promise.all([
    writeJson(SYNC_STORAGE_KEYS.books, stampBooks),
    writeJson(SYNC_STORAGE_KEYS.collections, stampCollections),
    writeJson(SYNC_STORAGE_KEYS.collectionWords, snapshot.collectionWords),
    writeJson(SYNC_STORAGE_KEYS.flashcards, snapshot.flashcards),
    writeJson(SYNC_STORAGE_KEYS.savedWords, snapshot.savedWords),
    writeJson(SYNC_STORAGE_KEYS.tombstones, snapshot.tombstones),
  ]);

  applyDomainToZustand(
    snapshot.domain ?? { books: [], collections: [], flashcards: {} }
  );
  applyStickyNotesToZustand(snapshot.stickyNotes ?? []);

  const { replaceReadingProgressMap } = await import('./readingProgressStore');
  await replaceReadingProgressMap(snapshot.readingProgress ?? {});

  const { applyUserTracksFromCloud } = await import('./userTracksStore');
  await applyUserTracksFromCloud(snapshot.userTracks ?? {});

  if (snapshot.prefs?.streak) {
    const { setStreakFromCloud } = await import('./streakStore');
    await setStreakFromCloud(snapshot.prefs.streak);
  }
  // Нет prefs.streak — не обнуляем локальный стрик (гость / старый meta).
  // Activity: epoch-aware merge, чтобы сброс words/minutes не затёрся pull-replace.
  if (snapshot.prefs?.activityByDay || typeof snapshot.prefs?.activityEpoch === 'number') {
    const current = useAppStore.getState();
    const merged = mergeActivityByDayWithEpoch(
      current.activityByDay,
      current.activityEpoch ?? 0,
      snapshot.prefs.activityByDay,
      snapshot.prefs.activityEpoch ?? 0
    );
    useAppStore.setState({
      activityByDay: merged.activityByDay,
      activityEpoch: merged.activityEpoch,
    });
  } else if (snapshot.prefs) {
    // prefs есть, но activity пустая — явная замена (pull-replace без истории)
    const current = useAppStore.getState();
    const localEpoch = current.activityEpoch ?? 0;
    if (localEpoch <= 0) {
      useAppStore.setState({ activityByDay: {}, activityEpoch: 0 });
    }
  }
  // После pull-replace/merge облако может вернуть раздутые слова — сброс здесь,
  // иначе миграция на гидрации уже отработала на пустом state до логина.
  resetInflatedReadingStatsIfNeeded();
  if (snapshot.prefs?.learningLanguage === 'zh' ||
      snapshot.prefs?.learningLanguage === 'en' ||
      snapshot.prefs?.learningLanguage === 'ru' ||
      snapshot.prefs?.nativeLanguage === 'zh' ||
      snapshot.prefs?.nativeLanguage === 'en' ||
      snapshot.prefs?.nativeLanguage === 'ru') {
    const learning =
      snapshot.prefs?.learningLanguage === 'zh' ||
      snapshot.prefs?.learningLanguage === 'en' ||
      snapshot.prefs?.learningLanguage === 'ru'
        ? snapshot.prefs.learningLanguage
        : undefined;
    const native =
      snapshot.prefs?.nativeLanguage === 'zh' ||
      snapshot.prefs?.nativeLanguage === 'en' ||
      snapshot.prefs?.nativeLanguage === 'ru'
        ? snapshot.prefs.nativeLanguage
        : undefined;
    const { syncLanguagePairFromStore } = await import('./onboardingService');
    const { useAppStore: store } = await import('../store/useAppStore');
    const state = store.getState();
    // Snapshot уже должен содержать live-языки (overlayLiveLanguagePrefs на merge/push).
    // Здесь не перечитываем prefs заново — на pull-replace нужен именно облачный снимок.
    const nextLearning = learning ?? state.learningLanguage;
    const nextNative = native ?? state.nativeLanguage;
    store.setState({
      learningLanguage: nextLearning,
      nativeLanguage: nextNative,
    });
    await syncLanguagePairFromStore(nextLearning, nextNative, { sync: false });
  }
}

export async function recordTombstone(entity: SyncEntityType, id: string): Promise<void> {
  const list = await readJson<SyncTombstone[]>(SYNC_STORAGE_KEYS.tombstones, []);
  const next = mergeTombstones(list, [
    { id, entity, deletedAt: new Date().toISOString() },
  ]);
  await writeJson(SYNC_STORAGE_KEYS.tombstones, next);
}

/**
 * UID для путей `users/{uid}/books|collections|...`.
 * Берёт auth.currentUser.uid; если Auth ещё не готов — null (без throw).
 */
async function resolveSyncUid(): Promise<string | null> {
  const uid = await resolveFirestoreUid();
  if (!uid) return null;

  const firebase = await getFirebase();
  const live = firebase?.auth.currentUser;
  if (!live?.uid || live.isAnonymous) {
    console.warn(
      '[cloudSync] auth.currentUser отсутствует после resolve — sync отложен'
    );
    return null;
  }
  if (live.uid !== uid) {
    console.warn('[cloudSync] uid mismatch, using auth.currentUser.uid', {
      resolved: uid,
      live: live.uid,
    });
  }
  return live.uid;
}

async function getDb() {
  const firebase = await getFirebase();
  if (!firebase) {
    throw new Error('Firebase не настроен');
  }
  return firebase;
}

/**
 * Создаёт `users/{userId}` при первом входе/регистрации.
 * @returns created=true если документ только что создан
 */
export async function ensureUserDocument(
  user: Pick<AuthUser, 'uid' | 'email'>
): Promise<{ created: boolean }> {
  const firebase = await getDb();
  const authUid = firebase.auth.currentUser?.uid;
  if (!authUid || authUid !== user.uid) {
    throw new Error(
      `ensureUserDocument: auth.currentUser.uid (${authUid ?? 'null'}) ≠ ${user.uid}`
    );
  }
  const ref = doc(firebase.db, 'users', authUid);

  try {
    const snap = await getDoc(ref);
    if (snap.exists()) {
      return { created: false };
    }

    const now = Date.now();
    await setDoc(ref, {
      createdAt: now,
      lastSync: now,
      email: user.email ?? null,
      learningLanguage: 'zh',
      streak: 0,
      onboardingCompleted: false,
      /** Welcome-тур ещё не пройден — покажем на этом и других устройствах */
      hasCompletedOnboarding: false,
    });
    console.log('[cloudSync] создан документ users/' + authUid);
    return { created: true };
  } catch (e) {
    handleSyncError(e, 'Не удалось создать профиль пользователя');
    throw e;
  }
}

async function updateUserLastSync(uid: string): Promise<void> {
  const firebase = await getDb();
  await setDoc(
    doc(firebase.db, 'users', uid),
    { lastSync: Date.now() },
    { merge: true }
  );
}

async function commitBatches(
  ops: Array<(batch: import('firebase/firestore').WriteBatch) => void>
): Promise<void> {
  if (ops.length === 0) return;
  const firebase = await getDb();

  const CHUNK = 400;
  for (let i = 0; i < ops.length; i += CHUNK) {
    const batch = writeBatch(firebase.db);
    for (const op of ops.slice(i, i + CHUNK)) {
      op(batch);
    }
    await batch.commit();
  }
}

/**
 * Пишет снимок в Firestore по частям:
 * 1) подборки / треки / карточки / meta — отдельно (лёгкие, всегда должны уходить);
 * 2) книги — по одной, в урезанном виде (без words/grammar);
 * 3) удаления — только по tombstone (пустой локальный кэш после clear не стирает облако).
 */
async function writeRemoteSnapshot(uid: string, snapshot: SyncSnapshot): Promise<void> {
  // Ещё раз сверяем с Auth — иначе rules дадут permission-denied
  const firebase = await getDb();
  const liveUid = firebase.auth.currentUser?.uid;
  if (!liveUid || liveUid !== uid) {
    throw new Error(
      `Auth uid не совпадает с путём sync (path=${uid}, auth=${liveUid ?? 'null'})`
    );
  }

  // Строго: users/{auth.uid}/books|collections|flashcards|tracks|meta
  const booksCol = collection(firebase.db, 'users', uid, 'books');
  const cardsCol = collection(firebase.db, 'users', uid, 'flashcards');
  const collectionsCol = collection(firebase.db, 'users', uid, 'collections');
  const tracksCol = collection(firebase.db, 'users', uid, 'tracks');

  console.log(
    `[cloudSync] write → users/${uid}/ (books=${Object.keys(snapshot.books).length}, collections=${Object.keys(snapshot.collections).length})`
  );

  const [remoteBooks, remoteCards, remoteCollections, remoteTracks] = await Promise.all([
    getDocs(booksCol),
    getDocs(cardsCol),
    getDocs(collectionsCol),
    getDocs(tracksCol),
  ]);

  const deletedBookIds = new Set(
    snapshot.tombstones.filter((t) => t.entity === 'book').map((t) => t.id)
  );
  const deletedCardIds = new Set(
    snapshot.tombstones.filter((t) => t.entity === 'flashcard').map((t) => t.id)
  );
  const deletedCollectionIds = new Set(
    snapshot.tombstones.filter((t) => t.entity === 'collection').map((t) => t.id)
  );
  const deletedTrackIds = new Set(
    snapshot.tombstones.filter((t) => t.entity === 'userTrack').map((t) => t.id)
  );

  // ── 1. Лёгкие сущности: подборки, треки, карточки ─────────────────────────
  const lightOps: Array<(batch: import('firebase/firestore').WriteBatch) => void> = [];

  for (const [id, col] of Object.entries(snapshot.collections)) {
    if (!id || deletedCollectionIds.has(id)) continue;
    const ref = doc(firebase.db, 'users', uid, 'collections', id);
    lightOps.push((batch) =>
      batch.set(ref, collectionPayloadForCloud(col, uid))
    );
  }

  const { trackMetaForCloud } = await import('./userTracksStore');
  for (const [id, track] of Object.entries(snapshot.userTracks ?? {})) {
    if (!id || deletedTrackIds.has(id)) continue;
    const ref = doc(firebase.db, 'users', uid, 'tracks', id);
    const payload = sanitizeForFirestore({
      ...trackMetaForCloud(track),
      ownerUserId: uid,
    });
    lightOps.push((batch) => batch.set(ref, payload));
  }

  for (const [id, card] of Object.entries(snapshot.flashcards)) {
    if (!id || deletedCardIds.has(id)) continue;
    const ref = doc(firebase.db, 'users', uid, 'flashcards', id);
    lightOps.push((batch) => batch.set(ref, flashcardPayloadForCloud(card)));
  }

  // Удаления только по tombstone — иначе пустой локальный снимок после clear
  // на втором устройстве стирал бы чужие/ещё не подтянутые книги.
  remoteCollections.forEach((d) => {
    if (deletedCollectionIds.has(d.id)) {
      lightOps.push((batch) => batch.delete(d.ref));
    }
  });
  remoteTracks.forEach((d) => {
    if (deletedTrackIds.has(d.id)) {
      lightOps.push((batch) => batch.delete(d.ref));
    }
  });
  remoteCards.forEach((d) => {
    if (deletedCardIds.has(d.id)) {
      lightOps.push((batch) => batch.delete(d.ref));
    }
  });
  remoteBooks.forEach((d) => {
    if (deletedBookIds.has(d.id)) {
      lightOps.push((batch) => batch.delete(d.ref));
    }
  });

  // Сначала подборки/треки/карточки — критично для кросс-устройства
  try {
    await commitBatches(lightOps);
  } catch (err) {
    console.error('[cloudSync] collections/tracks write failed:', err);
    throw err;
  }

  // Meta отдельно: если документ слишком большой — пишем урезанный, не валим sync
  const metaRef = doc(firebase.db, 'users', uid, 'meta', 'sync');
  try {
    await setDoc(
      metaRef,
      sanitizeForFirestore({
        collectionWords: snapshot.collectionWords,
        savedWords: snapshot.savedWords,
        readingProgress: snapshot.readingProgress ?? {},
        userTracks: {},
        stickyNotes: snapshot.stickyNotes ?? [],
        domain: domainPayloadForCloud(snapshot.domain),
        prefs: snapshot.prefs ?? null,
        tombstones: snapshot.tombstones,
        updatedAt: snapshot.updatedAt,
      }),
      { merge: true }
    );
  } catch (err) {
    console.warn('[cloudSync] meta write failed, retrying slim:', err);
    try {
      await setDoc(
        metaRef,
        sanitizeForFirestore({
          collectionWords: {},
          savedWords: {},
          readingProgress: snapshot.readingProgress ?? {},
          userTracks: {},
          stickyNotes: [],
          domain: null,
          prefs: snapshot.prefs ?? null,
          tombstones: snapshot.tombstones.slice(0, 200),
          updatedAt: snapshot.updatedAt,
        }),
        { merge: true }
      );
    } catch (err2) {
      console.warn('[cloudSync] slim meta write also failed:', err2);
    }
  }

  // ── 2. Книги по одной (ошибка одной не блокирует остальные / подборки) ───
  for (const [id, book] of Object.entries(snapshot.books)) {
    if (deletedBookIds.has(id)) continue;
    const ref = doc(firebase.db, 'users', uid, 'books', id);
    try {
      const payload = bookPayloadForCloud(book, uid);
      const size = utf8ByteSize(payload);
      if (size > FIRESTORE_SAFE_BYTES) {
        console.warn(
          `[cloudSync] book ${id} still too large (${size} bytes) — saving meta only`
        );
        await setDoc(
          ref,
          sanitizeForFirestore({
            id: book.id,
            title: book.title,
            russianTitle: book.russianTitle ?? null,
            ownerUserId: uid,
            userId: uid,
            authorId: uid,
            collectionId: book.collectionId ?? null,
            language: book.language === 'en' ? 'en' : 'zh',
            catalogId: book.catalogId ?? null,
            targetHskLevel: book.targetHskLevel ?? 2,
            createdAt: book.createdAt,
            updatedAt: book.updatedAt ?? book.createdAt,
            paragraphs: [],
            sourceText: (book.sourceText || '').slice(0, 100_000),
            originalRussianText:
              book.originalRussianText?.slice(0, 50_000) ?? null,
            cloudTruncated: true,
          })
        );
      } else {
        await setDoc(ref, payload);
      }
    } catch (err) {
      console.error(`[cloudSync] book write failed for ${id}:`, err);
      // Пробуем минимальный документ, чтобы книга хотя бы появилась в списке
      try {
        await setDoc(
          ref,
          sanitizeForFirestore({
            id: book.id,
            title: book.title || 'Без названия',
            russianTitle: book.russianTitle,
            ownerUserId: uid,
            userId: uid,
            authorId: uid,
            collectionId: book.collectionId,
            language: book.language === 'en' ? 'en' : 'zh',
            targetHskLevel: book.targetHskLevel ?? 2,
            createdAt: book.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            paragraphs: [],
            sourceText: (book.sourceText || '').slice(0, 80_000),
            cloudTruncated: true,
          })
        );
      } catch (err2) {
        console.error(`[cloudSync] book meta fallback failed for ${id}:`, err2);
      }
    }
  }

  await updateUserLastSync(uid);
}

async function readRemoteSnapshot(uid: string): Promise<SyncSnapshot> {
  const firebase = await getDb();

  const [booksSnap, cardsSnap, collectionsSnap, tracksSnap, metaSnap, legacySnap] =
    await Promise.all([
      getDocs(collection(firebase.db, 'users', uid, 'books')),
      getDocs(collection(firebase.db, 'users', uid, 'flashcards')),
      getDocs(collection(firebase.db, 'users', uid, 'collections')),
      getDocs(collection(firebase.db, 'users', uid, 'tracks')),
      getDoc(doc(firebase.db, 'users', uid, 'meta', 'sync')),
      getDoc(doc(firebase.db, 'users', uid, 'sync', 'data')),
    ]);

  const books: Record<string, Book> = {};
  booksSnap.forEach((d) => {
    books[d.id] = hydrateBookFromCloud(d.data() as Book, uid);
  });

  const flashcards: Record<string, Flashcard> = {};
  cardsSnap.forEach((d) => {
    flashcards[d.id] = d.data() as Flashcard;
  });

  const collectionsFromSub: Record<string, Collection> = {};
  collectionsSnap.forEach((d) => {
    collectionsFromSub[d.id] = {
      ...(d.data() as Collection),
      ownerUserId: uid,
    };
  });

  const tracksFromSub: Record<string, UserTrack> = {};
  tracksSnap.forEach((d) => {
    tracksFromSub[d.id] = {
      ...(d.data() as UserTrack),
      ownerUserId: uid,
    };
  });

  if (metaSnap.exists()) {
    const meta = metaSnap.data() as {
      collections?: Record<string, Collection>;
      collectionWords?: Record<string, CollectionWord>;
      savedWords?: Record<string, Word>;
      readingProgress?: Record<string, ReadingProgress>;
      userTracks?: Record<string, UserTrack>;
      stickyNotes?: StickyNote[];
      domain?: SyncSnapshot['domain'];
      prefs?: SyncSnapshot['prefs'];
      tombstones?: SyncTombstone[];
      updatedAt?: string;
    };
    // Подколлекция collections + legacy meta.collections (sub приоритетнее)
    const rawCollections = withoutLegacyPresetCollections({
      ...Object.fromEntries(
        Object.entries(meta.collections ?? {}).map(([id, col]) => [
          id,
          { ...col, ownerUserId: col.ownerUserId || uid },
        ])
      ),
      ...collectionsFromSub,
    });
    const collections = rawCollections;

    // Подколлекция tracks + legacy meta.userTracks (sub приоритетнее)
    const userTracks = {
      ...Object.fromEntries(
        Object.entries(meta.userTracks ?? {}).map(([id, track]) => [
          id,
          { ...track, ownerUserId: track.ownerUserId || uid },
        ])
      ),
      ...tracksFromSub,
    };

    return {
      books,
      flashcards,
      collections,
      collectionWords: meta.collectionWords ?? {},
      savedWords: meta.savedWords ?? {},
      readingProgress: meta.readingProgress ?? {},
      userTracks,
      stickyNotes: meta.stickyNotes ?? [],
      domain: meta.domain ?? { books: [], collections: [], flashcards: {} },
      prefs: meta.prefs,
      tombstones: meta.tombstones ?? [],
      updatedAt: meta.updatedAt ?? new Date(0).toISOString(),
    };
  }

  if (legacySnap.exists()) {
    const legacy = legacySnap.data() as SyncSnapshot;
    return {
      ...legacy,
      books: Object.keys(books).length ? books : legacy.books ?? {},
      flashcards: Object.keys(flashcards).length
        ? flashcards
        : legacy.flashcards ?? {},
      collections: withoutLegacyPresetCollections(
        Object.keys(collectionsFromSub).length > 0
          ? collectionsFromSub
          : legacy.collections ?? {}
      ),
      readingProgress: legacy.readingProgress ?? {},
      userTracks:
        Object.keys(tracksFromSub).length > 0
          ? tracksFromSub
          : legacy.userTracks ?? {},
      stickyNotes: legacy.stickyNotes ?? [],
    };
  }

  return {
    books,
    flashcards,
    collections: withoutLegacyPresetCollections(collectionsFromSub),
    collectionWords: {},
    savedWords: {},
    readingProgress: {},
    userTracks: tracksFromSub,
    stickyNotes: [],
    domain: { books: [], collections: [], flashcards: {} },
    tombstones: [],
    updatedAt: new Date(0).toISOString(),
  };
}

function markSynced(uid: string, now: string) {
  setState({
    status: 'synced',
    message: 'Синхронизировано',
    lastSyncedAt: now,
    userId: uid,
    error: undefined,
  });
  void clearOfflinePending();
}

/**
 * После login/register:
 * - сбрасываем локальный кэш предыдущего пользователя;
 * - новый аккаунт → онбординг + push;
 * - существующий → только pull из Firestore (без merge со старыми локальными копиями).
 */
export async function bootstrapCloudAfterAuth(user: AuthUser): Promise<SyncState> {
  setState({ status: 'syncing', message: 'Подготовка облака…', error: undefined });

  try {
    // Убираем остатки прошлого аккаунта / гостя до загрузки облака
    try {
      const { clearUserLocalData } = await import('./localDataResetService');
      await clearUserLocalData();
    } catch (err) {
      console.warn('[cloudSync] clear before bootstrap:', err);
    }

    const { created } = await ensureUserDocument(user);

    if (created) {
      console.log('[cloudSync] новый аккаунт — пустой профиль, без демо/дефолтных подборок');
      const { seedOnboardingContent } = await import('./onboardingService');
      await seedOnboardingContent(); // только prefs, tour ещё не пройден
      await markOnboardingCompleted(user.uid);
      // Пустой локальный снимок → пустые users/{uid}/books|collections|flashcards
      return await pushLocalToCloud();
    }

    // Существующий аккаунт: Firestore — единственный источник правды
    const pulled = await pullCloudToLocal({ replaceLocal: true });
    try {
      await syncHasCompletedOnboardingFromCloud(user.uid);
    } catch (err) {
      console.warn('[cloudSync] hasCompletedOnboarding pull:', err);
    }
    return pulled;
  } catch (e) {
    const message = handleSyncError(e, 'Ошибка инициализации облака');
    setState({
      status: 'error',
      message: 'Ошибка синхронизации',
      error: message,
    });
    return currentState;
  }
}

/** Ставит users/{uid}.onboardingCompleted = true после локального сида. */
export async function markOnboardingCompleted(uid: string): Promise<void> {
  const firebase = await getDb();
  await setDoc(
    doc(firebase.db, 'users', uid),
    { onboardingCompleted: true, lastSync: Date.now() },
    { merge: true }
  );
}

/**
 * Ставит users/{uid}.hasCompletedOnboarding = true после Welcome-тура.
 * Пишет в профиль текущего auth-пользователя.
 */
export async function markHasCompletedOnboarding(): Promise<void> {
  const uid = await resolveSyncUid();
  if (!uid) return;
  const firebase = await getDb();
  await setDoc(
    doc(firebase.db, 'users', uid),
    { hasCompletedOnboarding: true, lastSync: Date.now() },
    { merge: true }
  );
}

/**
 * Читает users/{uid}.hasCompletedOnboarding и применяет локально.
 * Legacy-профили без поля считаем уже прошедшими тур (не показываем повторно).
 */
export async function syncHasCompletedOnboardingFromCloud(
  uid: string
): Promise<boolean> {
  const firebase = await getDb();
  const snap = await getDoc(doc(firebase.db, 'users', uid));
  let completed = true;
  if (snap.exists()) {
    const raw = snap.data()?.hasCompletedOnboarding;
    if (raw === false) completed = false;
    else completed = true; // true или отсутствует (legacy)
  }
  const { applyHasCompletedOnboardingFromCloud } = await import(
    './onboardingService'
  );
  await applyHasCompletedOnboardingFromCloud(completed);
  return completed;
}


function withSyncTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${label}: превышен лимит ${Math.round(ms / 1000)} с`));
    }, ms);
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

function finishSyncRun(epoch: number, uid: string | null): void {
  if (!isSyncEpochCurrent(epoch)) {
    // Нас отменили (logout) — не трогаем статус, если уже guest
    if (currentState.status === 'syncing' && !uid && !isCloudUser()) {
      setState({
        status: 'guest',
        message: 'Гостевой режим',
        userId: null,
      });
    }
    return;
  }
  // uid из auth.currentUser важнее зеркала isCloudUser()
  if (!uid) {
    if (currentState.status === 'syncing' || currentState.status === 'error') {
      setState({
        status: isCloudUser() ? 'idle' : 'guest',
        message: isCloudUser() ? 'Ожидание входа…' : 'Гостевой режим',
        userId: null,
      });
    }
    return;
  }
  // Если всё ещё «syncing» — принудительно закрываем спиннер
  if (currentState.status === 'syncing') {
    markSynced(uid, new Date().toISOString());
  }
}

/**
 * Загружает локальные книги, коллекции и SRS в облако
 * (`users/{uid}/books`, `users/{uid}/flashcards`).
 */
export async function pushLocalToCloud(): Promise<SyncState> {
  return runExclusiveSync('push');
}

/**
 * Скачивает облачные данные и применяет локально.
 * @param options.replaceLocal — не мержить с локальным кэшем (вход в аккаунт).
 */
export async function pullCloudToLocal(options?: {
  replaceLocal?: boolean;
}): Promise<SyncState> {
  return runExclusiveSync(options?.replaceLocal ? 'pull-replace' : 'pull');
}

/**
 * Умная двухсторонняя синхронизация:
 * книги — по lastReadAt / updatedAt, SRS — по nextReviewDate / updatedAt.
 */
export async function syncData(): Promise<SyncState> {
  return runExclusiveSync('merge');
}

type SyncMode = 'push' | 'pull' | 'pull-replace' | 'merge';

const SYNC_TIMEOUT_MS = 60_000;

/** Один активный sync — параллельные merge/push схлопываются в один промис. */
let syncInFlight: Promise<SyncState> | null = null;
/** Пока шёл sync, пришёл ещё один запрос (смена языка и т.п.) — перезапустить после. */
let syncRerunRequested = false;

function preemptSyncForBootstrap(): void {
  const g = globalThis as unknown as {
    __languageeeeSyncTimer?: ReturnType<typeof setTimeout>;
  };
  if (g.__languageeeeSyncTimer) {
    clearTimeout(g.__languageeeeSyncTimer);
    g.__languageeeeSyncTimer = undefined;
  }
  syncEpoch += 1;
  syncInFlight = null;
  syncRerunRequested = false;
  if (currentState.status === 'syncing') {
    setState({
      status: 'idle',
      message: 'Готово к синхронизации',
      userId: getCloudUid(),
      error: undefined,
    });
  }
}

/**
 * Снимок мог быть собран до LanguageSwitcher / trackActivity: подставляем
 * живые языки и стрик из Zustand, чтобы apply/write не откатывали UI.
 */
function overlayLiveLanguagePrefs(snapshot: SyncSnapshot): SyncSnapshot {
  const {
    learningLanguage,
    nativeLanguage,
    streakCurrent,
    streakLastActiveDate,
    streakUpdatedAt,
    activityByDay,
    activityEpoch,
  } = useAppStore.getState();
  const liveStreak = {
    current: streakCurrent,
    lastActiveDate: streakLastActiveDate,
    updatedAt: streakUpdatedAt,
  };
  const snapStreak = snapshot.prefs?.streak;
  // Не затираем больший remote/local current живым меньшим значением
  let streak = liveStreak;
  if (snapStreak) {
    if (snapStreak.current > liveStreak.current) {
      streak = snapStreak;
    } else if (
      snapStreak.current === liveStreak.current &&
      toMs(snapStreak.updatedAt) > toMs(liveStreak.updatedAt)
    ) {
      streak = snapStreak;
    }
  }
  const activityMerged = mergeActivityByDayWithEpoch(
    activityByDay,
    activityEpoch ?? 0,
    snapshot.prefs?.activityByDay,
    snapshot.prefs?.activityEpoch ?? 0
  );
  return {
    ...snapshot,
    prefs: {
      ...snapshot.prefs,
      learningLanguage,
      nativeLanguage,
      streak,
      activityByDay: activityMerged.activityByDay,
      activityEpoch: activityMerged.activityEpoch,
    },
  };
}

async function runExclusiveSync(mode: SyncMode): Promise<SyncState> {
  // Вход в аккаунт: отменяем фоновый merge и делаем чистый pull
  if (mode === 'pull-replace') {
    preemptSyncForBootstrap();
  } else if (syncInFlight) {
    syncRerunRequested = true;
    return syncInFlight;
  }

  const run = (async (): Promise<SyncState> => {
    const epoch = syncEpoch;
    let uid: string | null = null;

    if (!isFirebaseConfigured()) {
      setState({
        status: 'unconfigured',
        message: 'Только локально',
        userId: null,
      });
      return currentState;
    }

    // Offline-first: не ходим в сеть и не показываем «ошибку сети»
    if (!isNetworkOnline()) {
      setState({
        status: 'offline',
        message: 'Офлайн · локальные данные',
        error: undefined,
      });
      return currentState;
    }

    // Auth ещё loading — ждём uid, не ставим «Ошибка синхр.»
    uid = await resolveSyncUid();
    if (!uid) {
      console.warn(
        '[cloudSync] пропуск sync: нет auth.currentUser.uid (режим=',
        mode,
        ')'
      );
      setState({
        status: 'idle',
        message: 'Ожидание входа…',
        userId: null,
        error: undefined,
      });
      return currentState;
    }

    if (!isCloudUser()) {
      // Зеркало ещё guest, но currentUser уже есть — продолжаем по uid из Auth
      console.warn(
        '[cloudSync] зеркало Auth не authenticated, пишем в users/' + uid
      );
    }

    const messages: Record<SyncMode, string> = {
      push: 'Отправка…',
      pull: 'Загрузка…',
      'pull-replace': 'Загрузка из облака…',
      merge: 'Синхронизация…',
    };
    setState({
      status: 'syncing',
      message: messages[mode],
      userId: uid,
      error: undefined,
    });

    try {
      await withSyncTimeout(
        (async () => {
          // Повторная проверка перед записью
          const liveUid = await resolveSyncUid();
          if (!liveUid || liveUid !== uid) {
            console.warn('[cloudSync] uid пропал mid-sync — выход без ошибки');
            return;
          }
          if (!isSyncEpochCurrent(epoch)) return;

          if (mode === 'pull-replace' || mode === 'pull') {
            const remote = await readRemoteSnapshot(uid);
            if (!isSyncEpochCurrent(epoch)) return;

            if (mode === 'pull-replace') {
              const fresh: SyncSnapshot = {
                books: remote.books ?? {},
                collections: remote.collections ?? {},
                collectionWords: remote.collectionWords ?? {},
                flashcards: remote.flashcards ?? {},
                savedWords: remote.savedWords ?? {},
                readingProgress: remote.readingProgress ?? {},
                userTracks: remote.userTracks ?? {},
                stickyNotes: remote.stickyNotes ?? [],
                domain: remote.domain ?? {
                  books: [],
                  collections: [],
                  flashcards: {},
                },
                prefs: remote.prefs ?? { learningLanguage: 'zh' },
                tombstones: remote.tombstones ?? [],
                updatedAt: new Date().toISOString(),
              };
              console.log(
                '[cloudSync] pull-replace users/' + uid + ':',
                Object.keys(fresh.books).length,
                'books,',
                Object.keys(fresh.collections).length,
                'collections'
              );
              await applyLocalSnapshot(fresh);
              try {
                await syncHasCompletedOnboardingFromCloud(uid);
              } catch (err) {
                console.warn('[cloudSync] hasCompletedOnboarding:', err);
              }
              // pull-replace не пишет обратно — иначе раздутый activity остаётся в Firestore
              if (!isSyncEpochCurrent(epoch)) return;
              await writeRemoteSnapshot(
                uid,
                overlayLiveLanguagePrefs(await loadLocalSnapshot())
              );
            } else {
              const local = await loadLocalSnapshot();
              if (!isSyncEpochCurrent(epoch)) return;
              const merged = overlayLiveLanguagePrefs(
                mergeSnapshots(local, remote)
              );
              await applyLocalSnapshot(merged);
              try {
                await syncHasCompletedOnboardingFromCloud(uid);
              } catch (err) {
                console.warn('[cloudSync] hasCompletedOnboarding:', err);
              }
              if (!isSyncEpochCurrent(epoch)) return;
              // Пишем актуальное локальное (после apply + возможного сброса слов)
              await writeRemoteSnapshot(
                uid,
                overlayLiveLanguagePrefs(await loadLocalSnapshot())
              );
            }
          } else if (mode === 'push') {
            const local = overlayLiveLanguagePrefs(await loadLocalSnapshot());
            if (!isSyncEpochCurrent(epoch)) return;
            console.log(
              '[cloudSync] push users/' + uid + ':',
              Object.keys(local.books).length,
              'books,',
              Object.keys(local.collections).length,
              'collections'
            );
            await writeRemoteSnapshot(uid, local);
          } else {
            const local = await loadLocalSnapshot();
            if (!isSyncEpochCurrent(epoch)) return;
            const remote = await readRemoteSnapshot(uid);
            if (!isSyncEpochCurrent(epoch)) return;
            const merged = overlayLiveLanguagePrefs(
              mergeSnapshots(local, remote)
            );
            await applyLocalSnapshot(merged);
            if (!isSyncEpochCurrent(epoch)) return;
            await writeRemoteSnapshot(
              uid,
              overlayLiveLanguagePrefs(await loadLocalSnapshot())
            );
          }

          if (!isSyncEpochCurrent(epoch)) return;

          const now = new Date().toISOString();
          await AsyncStorage.setItem(SYNC_STORAGE_KEYS.lastSyncedAt, now);
          markSynced(uid, now);
        })(),
        SYNC_TIMEOUT_MS,
        mode
      );
    } catch (e) {
      if (!isSyncEpochCurrent(epoch)) {
        /* cancelled */
      } else {
        const message = handleSyncError(e, 'Ошибка синхронизации');
        const looksOffline =
          /network|offline|Failed to fetch|unavailable|deadline|timeout|ERR_INTERNET/i.test(
            message
          );
        // Auth ещё не стабилен — не крашим UI в «Ошибка синхр.»
        if (
          /Auth uid не совпадает|currentUser|Войдите в аккаунт|Ожидание/i.test(
            message
          )
        ) {
          console.warn('[cloudSync]', mode, 'отложено (auth):', message);
          setState({
            status: 'idle',
            message: 'Ожидание входа…',
            userId: uid,
            error: undefined,
          });
        } else if (looksOffline) {
          console.warn('[cloudSync]', mode, 'офлайн — локальный кэш:', message);
          setState({
            status: 'offline',
            message: 'Офлайн · локальные данные',
            error: undefined,
            userId: uid,
          });
        } else {
          console.error('[cloudSync]', mode, 'failed:', message);
          setState({
            status: 'error',
            message: 'Ошибка синхронизации',
            error: message,
            userId: uid,
          });
        }
      }
    } finally {
      finishSyncRun(epoch, uid || getCloudUid());
    }

    return currentState;
  })().finally(() => {
    if (syncInFlight === run) syncInFlight = null;
    if (syncRerunRequested) {
      syncRerunRequested = false;
      // Догнать изменения, пришедшие во время in-flight (в т.ч. setNativeLanguage)
      void syncData();
    }
  });

  syncInFlight = run;
  return run;
}

/** Инициализация статуса (+ auto-sync для вошедшего пользователя). */
export async function initCloudSync(options?: { autoSync?: boolean }): Promise<void> {
  const last = await AsyncStorage.getItem(SYNC_STORAGE_KEYS.lastSyncedAt);

  if (!isFirebaseConfigured()) {
    setState({
      status: 'unconfigured',
      message: 'Только локально',
      lastSyncedAt: last,
    });
    return;
  }

  const uid = await resolveSyncUid();
  if (!uid) {
    setState({
      status: 'guest',
      message: 'Гостевой режим',
      lastSyncedAt: last,
      userId: null,
    });
    return;
  }

  setState({
    status: last ? 'synced' : 'idle',
    message: last ? 'Синхронизировано' : 'Готово к синхронизации',
    lastSyncedAt: last,
    userId: uid,
  });

  if (options?.autoSync !== false) {
    await syncData();
  }
}

/** Фоновая отправка после локальных изменений (не блокирует UI). */
export function scheduleSyncDebounced(): void {
  if (!isFirebaseConfigured()) return;
  // Офлайн: правки уже в AsyncStorage/IndexedDB — дошлём на `online`
  if (!isNetworkOnline()) {
    void markOfflinePending(['books', 'flashcards', 'other']);
    return;
  }
  const g = globalThis as unknown as {
    __languageeeeSyncTimer?: ReturnType<typeof setTimeout>;
  };
  if (g.__languageeeeSyncTimer) clearTimeout(g.__languageeeeSyncTimer);
  g.__languageeeeSyncTimer = setTimeout(() => {
    void (async () => {
      const uid = await resolveSyncUid();
      if (!uid) {
        console.warn('[cloudSync] scheduleSync: uid ещё нет — пропуск');
        return;
      }
      await syncData();
    })();
  }, 400);
}

const READING_PROGRESS_DEBOUNCE_MS = 800;

/**
 * Лёгкий debounce-пуш только readingProgress в users/{uid}/meta/sync.
 * Не гоняет полный syncData при каждом скролле.
 * Без сети — прогресс уже локально; push при reconnect.
 */
export function scheduleReadingProgressSync(): void {
  if (!isFirebaseConfigured()) return;
  if (!isNetworkOnline()) {
    void markOfflinePending('progress');
    return;
  }
  const g = globalThis as unknown as {
    __languageeeeProgressTimer?: ReturnType<typeof setTimeout>;
  };
  if (g.__languageeeeProgressTimer) clearTimeout(g.__languageeeeProgressTimer);
  g.__languageeeeProgressTimer = setTimeout(() => {
    void pushReadingProgressToCloud();
  }, READING_PROGRESS_DEBOUNCE_MS);
}

/** Записать локальную карту прогресса в Firestore (merge). */
export async function pushReadingProgressToCloud(): Promise<void> {
  if (!isFirebaseConfigured()) return;
  if (!isNetworkOnline()) return;
  try {
    const uid = await resolveSyncUid();
    if (!uid) return;
    const firebase = await getFirebase();
    if (!firebase) return;
    const { getReadingProgressMap } = await import('./readingProgressStore');
    const map = await getReadingProgressMap();
    const metaRef = doc(firebase.db, 'users', uid, 'meta', 'sync');
    await setDoc(
      metaRef,
      sanitizeForFirestore({
        readingProgress: map,
        updatedAt: new Date().toISOString(),
      }),
      { merge: true }
    );
  } catch (err) {
    console.warn('[cloudSync] pushReadingProgress failed:', err);
  }
}

/**
 * Считать readingProgress из Firestore, смержить с локальным по updatedAt,
 * записать обратно в AsyncStorage.
 */
export async function pullAndMergeReadingProgress(): Promise<void> {
  if (!isFirebaseConfigured()) return;
  try {
    const uid = await resolveSyncUid();
    if (!uid) return;
    const firebase = await getFirebase();
    if (!firebase) return;
    const metaRef = doc(firebase.db, 'users', uid, 'meta', 'sync');
    const snap = await getDoc(metaRef);
    if (!snap.exists()) return;
    const data = snap.data() as {
      readingProgress?: Record<string, ReadingProgress>;
      tombstones?: SyncTombstone[];
    };
    const remote = data.readingProgress ?? {};
    if (!remote || typeof remote !== 'object') return;

    const {
      getReadingProgressMap,
      replaceReadingProgressMap,
    } = await import('./readingProgressStore');
    const local = await getReadingProgressMap();
    const localTombs = await readJson<SyncTombstone[]>(
      SYNC_STORAGE_KEYS.tombstones,
      []
    );
    const tombs = mergeTombstones(localTombs, data.tombstones ?? []);
    const merged = mergeRecords(local, remote, tombs, 'readingProgress');
    await replaceReadingProgressMap(merged);
  } catch (err) {
    console.warn('[cloudSync] pullAndMergeReadingProgress failed:', err);
  }
}

/**
 * Немедленная выгрузка локальных данных в Firestore текущего пользователя.
 * Ждёт Auth и текущий sync; без uid — тихо выходит (без «Ошибка синхр.»).
 */
export async function flushSyncNow(): Promise<SyncState> {
  const g = globalThis as unknown as {
    __languageeeeSyncTimer?: ReturnType<typeof setTimeout>;
  };
  if (g.__languageeeeSyncTimer) {
    clearTimeout(g.__languageeeeSyncTimer);
    g.__languageeeeSyncTimer = undefined;
  }
  if (!isFirebaseConfigured()) {
    return currentState;
  }

  const uid = await resolveSyncUid();
  if (!uid) {
    console.warn('[cloudSync] flushSyncNow: нет auth.currentUser — отложено');
    setState({
      status: 'idle',
      message: 'Ожидание входа…',
      error: undefined,
    });
    return currentState;
  }

  if (syncInFlight) {
    try {
      await syncInFlight;
    } catch {
      /* ignore */
    }
  }
  return runExclusiveSync('push');
}

/** Поколение sync: увеличивается при logout, чтобы отменить in-flight apply. */
let syncEpoch = 0;

/** Отменяет отложенный sync (вызывать при logout). */
export function cancelPendingSync(): void {
  const g = globalThis as unknown as {
    __languageeeeSyncTimer?: ReturnType<typeof setTimeout>;
  };
  if (g.__languageeeeSyncTimer) {
    clearTimeout(g.__languageeeeSyncTimer);
    g.__languageeeeSyncTimer = undefined;
  }
  syncEpoch += 1;
  syncInFlight = null;
  syncRerunRequested = false;

  // Не оставляем UI на вечной «Синхронизация…»
  if (currentState.status === 'syncing') {
    setState({
      status: isCloudUser() ? 'idle' : 'guest',
      message: isCloudUser() ? 'Готово к синхронизации' : 'Гостевой режим',
      userId: isCloudUser() ? getCloudUid() : null,
      error: undefined,
    });
  }
}

/** Статус sync после очистки локальных данных / выхода. */
export function markLocalDataCleared(): void {
  setState({
    status: 'guest',
    message: 'Гостевой режим',
    userId: null,
    error: undefined,
  });
}

/** Обновить статус из network monitoring (online/offline баннер). */
export function reportNetworkConnectivity(online: boolean): void {
  if (!online) {
    setState({
      status: 'offline',
      message: 'Офлайн · локальные данные',
      error: undefined,
    });
    return;
  }

  const wasOffline = currentState.status === 'offline';

  // Не затираем syncing / synced / guest — только выходим из offline
  if (wasOffline) {
    if (!isFirebaseConfigured()) {
      setState({
        status: 'unconfigured',
        message: 'Облако не настроено',
        error: undefined,
      });
      return;
    }
    if (!isCloudUser()) {
      setState({
        status: 'guest',
        message: 'Гостевой режим',
        error: undefined,
      });
      return;
    }
    setState({
      status: 'idle',
      message: 'Сеть восстановлена · синхронизация…',
      error: undefined,
    });

    // Фоновая отложенная синхронизация только после офлайна
    scheduleReconnectSync();
  }
}

/**
 * После события `online`: дослать локальный прогресс чтения и
 * смержить остальные изменения в Firestore (не блокирует UI).
 */
function scheduleReconnectSync(): void {
  if (!isFirebaseConfigured()) return;
  const g = globalThis as unknown as {
    __languageeeeReconnectTimer?: ReturnType<typeof setTimeout>;
  };
  if (g.__languageeeeReconnectTimer) clearTimeout(g.__languageeeeReconnectTimer);
  // Небольшая пауза — сеть иногда «мигает»
  g.__languageeeeReconnectTimer = setTimeout(() => {
    void (async () => {
      try {
        if (!isNetworkOnline()) return;
        if (!isCloudUser() && !(await resolveSyncUid())) return;

        // 1) Лёгкий пуш прогресса чтения (офлайн-чтение → Firestore)
        await pushReadingProgressToCloud();

        // 2) Полный merge: книги, подборки, карточки…
        await syncData();
      } catch (err) {
        console.warn('[cloudSync] reconnect sync failed:', err);
        // Не показываем красную ошибку сети — остаёмся на локальных данных
        if (currentState.status === 'error') {
          setState({
            status: 'idle',
            message: 'Синхронизация отложена',
            error: undefined,
          });
        }
      }
    })();
  }, 600);
}

function isSyncEpochCurrent(epoch: number): boolean {
  return epoch === syncEpoch;
}
