import AsyncStorage from '@react-native-async-storage/async-storage';
import { DEFAULT_COLLECTION_COLOR } from '../constants/colors';
import { Book, Collection, Word, WordStatus } from '../types';
import { splitCombinedTitle } from '../utils/bookTitle';
import { detachCollectionFromAllWords } from './collectionsStore';
import {
  belongsToCurrentOwner,
  getDataOwnerId,
} from './dataOwner';

const BOOKS_KEY = '@languageeee/books';
const WORDS_KEY = '@languageeee/saved_words';
const COLLECTIONS_KEY = '@languageeee/collections';

/** Маркер «без подборки» в UI (не создаём системную коллекцию в storage) */
export const UNCATEGORIZED_COLLECTION_ID = 'col-uncategorized';

/** Старые автосиднутые id подборок — не показываем и не поднимаем */
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

/** Только старые автосиднутые id — пользовательские названия (в т.ч. «минсоны») не трогаем */
function isLegacyPresetCollection(col: Pick<Collection, 'id' | 'title'>): boolean {
  return LEGACY_PRESET_COLLECTION_IDS.has(col.id);
}

/** Старые демо-книги из мок-файлов */
function isLegacyDemoBookId(id: string): boolean {
  return id.startsWith('demo-book');
}

const TOMBSTONES_KEY = '@languageeee/sync_tombstones';

async function getDeletedCollectionIds(): Promise<Set<string>> {
  try {
    const raw = await AsyncStorage.getItem(TOMBSTONES_KEY);
    if (!raw) return new Set();
    const list = JSON.parse(raw) as Array<{ entity?: string; id?: string }>;
    return new Set(
      list
        .filter((t) => t.entity === 'collection' && typeof t.id === 'string')
        .map((t) => t.id as string)
    );
  } catch {
    return new Set();
  }
}

// ─── Книги ───────────────────────────────────────────────────────────────────

async function loadBooksMap(): Promise<Record<string, Book>> {
  const raw = await AsyncStorage.getItem(BOOKS_KEY);
  if (!raw) return {};
  return JSON.parse(raw) as Record<string, Book>;
}

async function saveBooksMap(books: Record<string, Book>): Promise<void> {
  await AsyncStorage.setItem(BOOKS_KEY, JSON.stringify(books));
}

/** Миграция старых книг: hskLevel → targetHskLevel + ownerUserId / userId */
function migrateBook(book: Book & { hskLevel?: number }): Book {
  const legacy = book as Book & { hskLevel?: number };
  let title = book.title ?? '';
  let russianTitle = book.russianTitle?.trim() || undefined;

  if (!russianTitle && title) {
    const split = splitCombinedTitle(title);
    title = split.original;
    russianTitle = split.russianTitle;
  } else if (title) {
    title = title.replace(/\s*\(EN\)\s*$/i, '').trim();
  }

  const owner = book.ownerUserId || book.userId || book.authorId || undefined;
  const userId =
    book.userId || (owner && owner !== 'guest' ? owner : undefined);

  return {
    ...book,
    title,
    russianTitle,
    ownerUserId: owner,
    userId,
    authorId: book.authorId || userId,
    language: book.language === 'en' ? 'en' : 'zh',
    catalogId: book.catalogId,
    targetHskLevel: book.targetHskLevel ?? legacy.hskLevel ?? 2,
    collectionId: book.collectionId ?? undefined,
  };
}

export async function saveBook(book: Book): Promise<void> {
  const books = await loadBooksMap();
  const now = new Date().toISOString();
  const ownerUserId = book.ownerUserId || getDataOwnerId();
  const userId =
    book.userId ||
    (ownerUserId && ownerUserId !== 'guest' ? ownerUserId : undefined);
  books[book.id] = {
    ...migrateBook(book),
    ownerUserId,
    userId,
    authorId: book.authorId || userId,
    updatedAt: now,
    createdAt: book.createdAt ?? now,
  };
  await saveBooksMap(books);
  const { scheduleSyncDebounced, flushSyncNow } = await import('./syncService');
  scheduleSyncDebounced();
  // Не ждём — но сразу ставим выгрузку в users/{uid}/books
  void flushSyncNow();
}

export async function getBooks(): Promise<Book[]> {
  const books = await loadBooksMap();
  return Object.values(books)
    .map(migrateBook)
    .filter((b) => belongsToCurrentOwner(b.ownerUserId))
    .filter((b) => !isLegacyDemoBookId(b.id))
    .sort(
      (a, b) =>
        new Date(b.updatedAt ?? b.createdAt).getTime() -
        new Date(a.updatedAt ?? a.createdAt).getTime()
    );
}

export async function getBook(bookId: string): Promise<Book | null> {
  if (isLegacyDemoBookId(bookId)) return null;
  const books = await loadBooksMap();
  const book = books[bookId];
  if (!book) return null;
  const migrated = migrateBook(book);
  if (!belongsToCurrentOwner(migrated.ownerUserId)) return null;
  return migrated;
}

/** Обновляет метаданные книги (название, категория, язык) без переразбора текста */
export async function updateBookMeta(
  bookId: string,
  patch: Partial<
    Pick<Book, 'title' | 'russianTitle' | 'collectionId' | 'language' | 'targetHskLevel'>
  >
): Promise<Book | null> {
  const books = await loadBooksMap();
  const existing = books[bookId];
  if (!existing) return null;
  if (!belongsToCurrentOwner(migrateBook(existing).ownerUserId)) return null;

  const now = new Date().toISOString();
  const updated: Book = migrateBook({
    ...existing,
    ...patch,
    ownerUserId: existing.ownerUserId || getDataOwnerId(),
    userId:
      existing.userId ||
      ((existing.ownerUserId || getDataOwnerId()) !== 'guest'
        ? existing.ownerUserId || getDataOwnerId()
        : undefined),
    authorId: existing.authorId || existing.userId,
    title: patch.title != null ? patch.title.trim() || existing.title : existing.title,
    russianTitle:
      patch.russianTitle !== undefined
        ? patch.russianTitle.trim() || undefined
        : existing.russianTitle,
    language:
      patch.language === 'en' || patch.language === 'zh'
        ? patch.language
        : existing.language === 'en'
          ? 'en'
          : 'zh',
    collectionId:
      patch.collectionId !== undefined ? patch.collectionId || undefined : existing.collectionId,
    updatedAt: now,
  });
  books[bookId] = updated;
  await saveBooksMap(books);
  const { scheduleSyncDebounced, flushSyncNow } = await import('./syncService');
  scheduleSyncDebounced();
  void flushSyncNow();
  return updated;
}

export async function moveBookToCollection(
  bookId: string,
  collectionId: string | undefined
): Promise<Book | null> {
  return updateBookMeta(bookId, {
    collectionId: collectionId || undefined,
  });
}

/** Создаёт пользовательскую категорию */
export async function createUserCollection(
  title: string,
  color = DEFAULT_COLLECTION_COLOR,
  description?: string
): Promise<Collection> {
  const trimmed = title.trim();
  if (!trimmed) throw new Error('Введите название категории');
  const now = new Date().toISOString();
  const ownerUserId = getDataOwnerId();
  const userId = ownerUserId !== 'guest' ? ownerUserId : undefined;
  const collection: Collection = {
    id: `col-user-${Date.now()}`,
    title: trimmed,
    description: description?.trim() || undefined,
    color,
    ownerUserId,
    userId,
    authorId: userId,
    isPublic: false,
    shareSlug: null,
    importedFromSlug: null,
    publishedAt: null,
    createdAt: now,
    updatedAt: now,
  };
  await saveCollection(collection);
  return collection;
}

export async function deleteBook(bookId: string): Promise<void> {
  const books = await loadBooksMap();
  const book = books[bookId];
  if (!book) return;
  if (!belongsToCurrentOwner(migrateBook(book).ownerUserId)) return;

  // Собираем id слов этого фанфика (переводы абзацев живут внутри book.paragraphs)
  const wordIds = new Set<string>();
  for (const paragraph of migrateBook(book).paragraphs) {
    for (const word of paragraph.words) {
      wordIds.add(word.id);
    }
  }

  delete books[bookId];
  await saveBooksMap(books);

  // Убираем из словаря слова, которые больше ни в одной книге не встречаются
  if (wordIds.size > 0) {
    const remaining = await loadBooksMap();
    const stillUsed = new Set<string>();
    for (const b of Object.values(remaining)) {
      for (const p of migrateBook(b).paragraphs) {
        for (const w of p.words) {
          if (wordIds.has(w.id)) stillUsed.add(w.id);
        }
      }
    }

    const wordsMap = await loadWordsMap();
    let wordsChanged = false;
    for (const id of wordIds) {
      if (!stillUsed.has(id) && wordsMap[id]) {
        delete wordsMap[id];
        wordsChanged = true;
      }
    }
    if (wordsChanged) await saveWordsMap(wordsMap);
  }

  const { recordTombstone, scheduleSyncDebounced } = await import('./syncService');
  await recordTombstone('book', bookId);
  scheduleSyncDebounced();
}

export async function getBooksByCollection(collectionId: string): Promise<Book[]> {
  const books = await getBooks();
  return books.filter((b) => b.collectionId === collectionId);
}

// ─── Слова ───────────────────────────────────────────────────────────────────

async function loadWordsMap(): Promise<Record<string, Word>> {
  const raw = await AsyncStorage.getItem(WORDS_KEY);
  if (!raw) return {};
  return JSON.parse(raw) as Record<string, Word>;
}

async function saveWordsMap(words: Record<string, Word>): Promise<void> {
  await AsyncStorage.setItem(WORDS_KEY, JSON.stringify(words));
}

export async function updateWordStatus(
  wordId: string,
  status: Extract<WordStatus, 'learning' | 'known'>
): Promise<void> {
  const wordsMap = await loadWordsMap();
  const books = await loadBooksMap();
  let updatedWord: Word | null = null;

  for (const bookId of Object.keys(books)) {
    const book = migrateBook(books[bookId]);
    let changed = false;

    book.paragraphs = book.paragraphs.map((paragraph) => ({
      ...paragraph,
      words: paragraph.words.map((word) => {
        if (word.id === wordId) {
          changed = true;
          updatedWord = { ...word, status };
          return updatedWord;
        }
        return word;
      }),
    }));

    if (changed) {
      books[bookId] = { ...book, updatedAt: new Date().toISOString() };
    }
  }

  if (updatedWord) {
    wordsMap[wordId] = updatedWord;
    await saveWordsMap(wordsMap);
    await saveBooksMap(books);
    try {
      const { scheduleSyncDebounced } = await import('./syncService');
      scheduleSyncDebounced();
    } catch {
      /* sync optional */
    }
  }
}

export async function getSavedWords(): Promise<Word[]> {
  const wordsMap = await loadWordsMap();
  return Object.values(wordsMap).filter(
    (w) => w.status === 'learning' || w.status === 'known'
  );
}

// ─── Подборки ────────────────────────────────────────────────────────────────

async function loadCollectionsMap(): Promise<Record<string, Collection>> {
  const raw = await AsyncStorage.getItem(COLLECTIONS_KEY);
  if (!raw) return {};
  return JSON.parse(raw) as Record<string, Collection>;
}

async function saveCollectionsMap(map: Record<string, Collection>): Promise<void> {
  await AsyncStorage.setItem(COLLECTIONS_KEY, JSON.stringify(map));
}

/** Миграция старых подборок: name → title */
function migrateCollection(col: Collection & { name?: string }): Collection {
  const legacy = col as Collection & { name?: string };
  const owner = col.ownerUserId || col.userId || col.authorId || undefined;
  const userId =
    col.userId || (owner && owner !== 'guest' ? owner : undefined);
  const authorId = col.authorId || userId;
  return {
    ...col,
    title: col.title ?? legacy.name ?? 'Без названия',
    ownerUserId: owner,
    userId,
    authorId,
    isPublic: !!col.isPublic,
    shareSlug: col.shareSlug ?? null,
    importedFromSlug: col.importedFromSlug ?? null,
    publishedAt: col.publishedAt ?? null,
  };
}

export async function getCollections(): Promise<Collection[]> {
  const map = await loadCollectionsMap();
  return Object.values(map)
    .map(migrateCollection)
    .filter((c) => belongsToCurrentOwner(c.ownerUserId))
    .filter((c) => !isLegacyPresetCollection(c))
    .sort((a, b) => (a.title || '').localeCompare(b.title || '', 'ru'));
}

export async function getCollection(id: string): Promise<Collection | null> {
  if (LEGACY_PRESET_COLLECTION_IDS.has(id)) return null;
  const map = await loadCollectionsMap();
  const col = map[id];
  if (!col) return null;
  const migrated = migrateCollection(col);
  if (!belongsToCurrentOwner(migrated.ownerUserId)) return null;
  if (isLegacyPresetCollection(migrated)) return null;
  return migrated;
}

export async function saveCollection(collection: Collection): Promise<void> {
  const map = await loadCollectionsMap();
  const now = new Date().toISOString();
  const ownerUserId = collection.ownerUserId || getDataOwnerId();
  const userId =
    collection.userId ||
    (ownerUserId && ownerUserId !== 'guest' ? ownerUserId : undefined);
  const authorId = collection.authorId || userId;
  map[collection.id] = {
    ...migrateCollection(collection),
    ownerUserId,
    userId,
    authorId,
    createdAt: collection.createdAt ?? now,
    updatedAt: now,
  };
  await saveCollectionsMap(map);
  const { scheduleSyncDebounced, flushSyncNow } = await import('./syncService');
  scheduleSyncDebounced();
  void flushSyncNow();
}

export async function updateCollection(
  id: string,
  patch: Partial<
    Pick<
      Collection,
      | 'title'
      | 'description'
      | 'color'
      | 'isPublic'
      | 'shareSlug'
      | 'importedFromSlug'
      | 'publishedAt'
      | 'userId'
      | 'ownerUserId'
      | 'authorId'
    >
  >
): Promise<Collection | null> {
  const map = await loadCollectionsMap();
  const existing = map[id];
  if (!existing) return null;
  if (!belongsToCurrentOwner(migrateCollection(existing).ownerUserId)) return null;

  const base = migrateCollection(existing);
  const ownerUserId = (patch.ownerUserId ?? base.ownerUserId) || getDataOwnerId();
  const userId =
    patch.userId ??
    base.userId ??
    (ownerUserId && ownerUserId !== 'guest' ? ownerUserId : undefined);
  const authorId = patch.authorId ?? base.authorId ?? userId;

  const updated: Collection = {
    ...base,
    ...patch,
    id,
    ownerUserId,
    userId,
    authorId,
    title: (patch.title ?? base.title).trim() || base.title,
    updatedAt: new Date().toISOString(),
    createdAt: base.createdAt ?? new Date().toISOString(),
  };
  map[id] = updated;
  await saveCollectionsMap(map);
  const { scheduleSyncDebounced, flushSyncNow } = await import('./syncService');
  scheduleSyncDebounced();
  void flushSyncNow();
  return updated;
}

/**
 * Удаляет подборку. Книги НЕ удаляются — у них сбрасывается collectionId.
 */
export async function deleteCollection(id: string): Promise<void> {
  const map = await loadCollectionsMap();
  if (!map[id]) {
    try {
      const { recordTombstone, scheduleSyncDebounced } = await import('./syncService');
      await recordTombstone('collection', id);
      scheduleSyncDebounced();
    } catch {
      /* ignore */
    }
    return;
  }

  // Legacy системные id: просто вычищаем запись, без проверки владельца
  if (!LEGACY_PRESET_COLLECTION_IDS.has(id)) {
    if (!belongsToCurrentOwner(migrateCollection(map[id]).ownerUserId)) {
      return;
    }
  }

  const shareSlug = migrateCollection(map[id]).shareSlug;

  const refreshed = await loadCollectionsMap();

  delete refreshed[id];
  await saveCollectionsMap(refreshed);

  const books = await loadBooksMap();
  let booksChanged = false;
  for (const bookId of Object.keys(books)) {
    if (books[bookId].collectionId === id) {
      books[bookId] = {
        ...migrateBook(books[bookId]),
        collectionId: undefined,
        updatedAt: new Date().toISOString(),
      };
      booksChanged = true;
    }
  }
  if (booksChanged) await saveBooksMap(books);

  try {
    const { deletePublicCollectionMirror } = await import(
      './publicCollectionsService'
    );
    await deletePublicCollectionMirror(shareSlug);
  } catch (err) {
    console.warn('[storage] deletePublicCollectionMirror failed:', err);
  }

  try {
    const { recordTombstone, scheduleSyncDebounced, flushSyncNow } = await import(
      './syncService'
    );
    await recordTombstone('collection', id);
    scheduleSyncDebounced();
    void flushSyncNow();
  } catch (err) {
    console.warn('[storage] tombstone after deleteCollection failed:', err);
  }

  try {
    await detachCollectionFromAllWords(id);
  } catch (err) {
    console.warn('[storage] detachCollectionFromAllWords failed:', err);
  }
}
