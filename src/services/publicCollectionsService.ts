/**
 * Публичные подборки (RBAC): зеркало в Firestore `publicCollections/{slug}`.
 * Приватные docs остаются в `users/{uid}/collections/{id}`.
 */
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  setDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import type {
  Book,
  Collection,
  PublicCollectionBookSummary,
  PublicCollectionDoc,
} from '../types';
import { getCloudUid } from './authService';
import { getFirebase, isFirebaseConfigured } from './firebaseClient';
import {
  createUserCollection,
  getBook,
  getBooksByCollection,
  getCollection,
  getCollections,
  saveBook,
  updateCollection,
} from './storageService';
import { getDataOwnerId } from './dataOwner';

const PUBLIC_FETCH_TIMEOUT_MS = 12_000;

/** Не даём getDoc/getDocs висеть вечно (сеть / rules / offline). */
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${label}: превышено время ожидания (${ms}ms)`));
    }, ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

function isPermissionDenied(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const code = 'code' in err ? String((err as { code: unknown }).code) : '';
  return (
    code === 'permission-denied' ||
    /permission|insufficient|Missing or insufficient permissions/i.test(
      err instanceof Error ? err.message : String(err)
    )
  );
}

function sanitizeSlugPart(title: string): string {
  return (
    title
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\u0400-\u04ff]+/gi, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 28) || 'collection'
  );
}

/** Криптостойкий суффикс для share-slug (без Math.random). */
function randomSlugSuffix(length = 12): string {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
  const bytes = new Uint8Array(length);
  if (typeof globalThis.crypto?.getRandomValues === 'function') {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < length; i += 1) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += alphabet[bytes[i]! % alphabet.length];
  }
  return out;
}

/** Уникальный slug для `/c/{slug}` (также decks / profiles). */
export function generateShareSlug(title: string): string {
  const base = sanitizeSlugPart(title);
  return `${base}-${randomSlugSuffix(12)}`;
}

export function publicCollectionUrl(slug: string): string {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}/c/${slug}`;
  }
  return `/c/${slug}`;
}

function bookSummary(book: Book): PublicCollectionBookSummary {
  const first =
    book.paragraphs?.[0]?.chineseText ||
    book.paragraphs?.[0]?.englishText ||
    book.paragraphs?.[0]?.originalText ||
    '';
  const excerpt = first.trim().slice(0, 180);
  return {
    id: book.id,
    title: book.title,
    russianTitle: book.russianTitle,
    language: book.language === 'en' ? 'en' : 'zh',
    targetHskLevel: book.targetHskLevel ?? 2,
    excerpt: excerpt || undefined,
  };
}

function slimBookForPublic(book: Book): Record<string, unknown> {
  return {
    id: book.id,
    title: book.title,
    russianTitle: book.russianTitle ?? null,
    language: book.language === 'en' ? 'en' : 'zh',
    targetHskLevel: book.targetHskLevel ?? 2,
    paragraphs: (book.paragraphs ?? []).map((p) => ({
      originalText: p.originalText ?? '',
      chineseText: p.chineseText ?? '',
      englishText: p.englishText ?? '',
      russianTranslation: p.russianTranslation ?? '',
      words: Array.isArray(p.words) ? p.words : [],
      grammar: Array.isArray(p.grammar) ? p.grammar : [],
    })),
    sourceText: (book.sourceText || '').slice(0, 100_000) || null,
    catalogId: book.catalogId ?? null,
    updatedAt: book.updatedAt ?? new Date().toISOString(),
  };
}

/**
 * Опубликовать подборку: выставить isPublic + slug, записать publicCollections/{slug}.
 * Только для авторизованных (не guest).
 */
export async function publishCollection(
  collectionId: string
): Promise<Collection> {
  const uid = getCloudUid();
  if (!uid) {
    throw new Error('Войдите в аккаунт, чтобы сделать подборку публичной');
  }
  if (!isFirebaseConfigured()) {
    throw new Error('Firebase не настроен — публикация недоступна');
  }

  const { getCollection } = await import('./storageService');
  const col = await getCollection(collectionId);
  if (!col) throw new Error('Подборка не найдена');

  const slug = col.shareSlug?.trim() || generateShareSlug(col.title);
  const now = new Date().toISOString();
  const books = await getBooksByCollection(collectionId);
  const summaries = books.map(bookSummary);

  const updated = await updateCollection(collectionId, {
    isPublic: true,
    shareSlug: slug,
    publishedAt: col.publishedAt || now,
    userId: uid,
    ownerUserId: uid,
    authorId: uid,
  });
  if (!updated) throw new Error('Не удалось обновить подборку');

  const firebase = await getFirebase();
  if (!firebase) throw new Error('Firebase недоступен');

  const publicDoc: PublicCollectionDoc = {
    slug,
    collectionId,
    userId: uid,
    ownerUserId: uid,
    authorId: uid,
    title: updated.title,
    description: updated.description ?? null,
    color: updated.color ?? null,
    isPublic: true,
    books: summaries,
    publishedAt: updated.publishedAt || now,
    updatedAt: now,
  };

  const rootRef = doc(firebase.db, 'publicCollections', slug);
  await setDoc(rootRef, publicDoc, { merge: true });

  // Зеркало книг для гостевого чтения / «добавить к себе»
  const existing = await getDocs(collection(firebase.db, 'publicCollections', slug, 'books'));
  const keep = new Set(books.map((b) => b.id));

  let batch = writeBatch(firebase.db);
  let ops = 0;
  const flush = async () => {
    if (ops === 0) return;
    await batch.commit();
    batch = writeBatch(firebase.db);
    ops = 0;
  };

  for (const d of existing.docs) {
    if (!keep.has(d.id)) {
      batch.delete(d.ref);
      ops += 1;
      if (ops >= 400) await flush();
    }
  }
  for (const book of books) {
    const ref = doc(firebase.db, 'publicCollections', slug, 'books', book.id);
    batch.set(ref, slimBookForPublic(book), { merge: true });
    ops += 1;
    if (ops >= 400) await flush();
  }
  await flush();

  return updated;
}

/** Снять с публикации: удалить public doc + флаги локально */
export async function unpublishCollection(
  collectionId: string
): Promise<Collection | null> {
  const { getCollection } = await import('./storageService');
  const col = await getCollection(collectionId);
  if (!col) return null;

  const slug = col.shareSlug;
  const uid = getCloudUid();

  if (slug && isFirebaseConfigured() && uid) {
    try {
      const firebase = await getFirebase();
      if (firebase) {
        const booksSnap = await getDocs(
          collection(firebase.db, 'publicCollections', slug, 'books')
        );
        const batch = writeBatch(firebase.db);
        for (const d of booksSnap.docs) {
          batch.delete(d.ref);
        }
        batch.delete(doc(firebase.db, 'publicCollections', slug));
        await batch.commit();
      }
    } catch (err) {
      console.warn('[publicCollections] unpublish cloud failed:', err);
    }
  }

  return updateCollection(collectionId, {
    isPublic: false,
    // slug сохраняем — при повторной публикации URL не меняется
    publishedAt: null,
  });
}

/** Переключить публичность */
export async function setCollectionPublic(
  collectionId: string,
  isPublic: boolean
): Promise<Collection | null> {
  if (isPublic) return publishCollection(collectionId);
  return unpublishCollection(collectionId);
}

/**
 * Каталог / поиск публичных подборок.
 * Запрос обязательно с `where('isPublic', '==', true)` — иначе list для гостя
 * отклонят security rules. Гости ок; permission/сеть → [] (без падения UI).
 */
export async function listPublicCollections(
  searchQuery?: string
): Promise<PublicCollectionDoc[]> {
  try {
    if (!isFirebaseConfigured()) return [];
    const firebase = await withTimeout(
      getFirebase(),
      PUBLIC_FETCH_TIMEOUT_MS,
      'getFirebase'
    );
    if (!firebase) return [];

    const q = query(
      collection(firebase.db, 'publicCollections'),
      where('isPublic', '==', true),
      limit(80)
    );
    const snap = await withTimeout(
      getDocs(q),
      PUBLIC_FETCH_TIMEOUT_MS,
      'listPublicCollections'
    );
    let items: PublicCollectionDoc[] = snap.docs.map((d) => {
      const data = d.data() as PublicCollectionDoc;
      return {
        ...data,
        slug: data.slug || d.id,
        isPublic: true,
        books: Array.isArray(data.books) ? data.books : [],
      };
    });

    const needle = searchQuery?.trim().toLowerCase() ?? '';
    if (needle) {
      items = items.filter((col) => {
        const hay = [
          col.title,
          col.description ?? '',
          ...(col.books ?? []).flatMap((b) => [
            b.title,
            b.russianTitle ?? '',
            b.excerpt ?? '',
          ]),
        ]
          .join(' ')
          .toLowerCase();
        return hay.includes(needle);
      });
    }

    return items.sort((a, b) =>
      (b.updatedAt || b.publishedAt || '').localeCompare(
        a.updatedAt || a.publishedAt || ''
      )
    );
  } catch (err) {
    console.warn('[publicCollections] list failed:', err);
    // Неавторизованный / denied / timeout — каталог не падает
    return [];
  }
}

/** Загрузить публичную подборку по slug (гости ок, без auth). */
export async function fetchPublicCollection(
  slug: string
): Promise<PublicCollectionDoc | null> {
  const clean = slug.trim();
  if (!clean) return null;
  try {
    if (!isFirebaseConfigured()) return null;
    const firebase = await withTimeout(
      getFirebase(),
      PUBLIC_FETCH_TIMEOUT_MS,
      'getFirebase'
    );
    if (!firebase) return null;
    const snap = await withTimeout(
      getDoc(doc(firebase.db, 'publicCollections', clean)),
      PUBLIC_FETCH_TIMEOUT_MS,
      'fetchPublicCollection'
    );
    if (!snap.exists()) return null;
    const data = snap.data() as PublicCollectionDoc;
    const flag = (data as { isPublic?: unknown }).isPublic;
    if (flag !== true && flag !== 'true') return null;
    return { ...data, slug: data.slug || clean, isPublic: true };
  } catch (err) {
    console.warn('[publicCollections] fetch failed:', err);
    if (isPermissionDenied(err)) {
      throw new Error('Подборка не найдена или приватная');
    }
    throw err instanceof Error
      ? err
      : new Error('Подборка не найдена или приватная');
  }
}

/** Полная книга из публичного зеркала */
export async function fetchPublicCollectionBook(
  slug: string,
  bookId: string
): Promise<Book | null> {
  try {
    if (!isFirebaseConfigured()) return null;
    const firebase = await withTimeout(
      getFirebase(),
      PUBLIC_FETCH_TIMEOUT_MS,
      'getFirebase'
    );
    if (!firebase) return null;
    const snap = await withTimeout(
      getDoc(doc(firebase.db, 'publicCollections', slug, 'books', bookId)),
      PUBLIC_FETCH_TIMEOUT_MS,
      'fetchPublicCollectionBook'
    );
    if (!snap.exists()) return null;
    const raw = snap.data() as Book;
    return {
      ...raw,
      id: bookId,
      language: raw.language === 'en' ? 'en' : 'zh',
      targetHskLevel: raw.targetHskLevel ?? 2,
      createdAt: raw.createdAt || new Date().toISOString(),
      paragraphs: Array.isArray(raw.paragraphs) ? raw.paragraphs : [],
    };
  } catch (err) {
    console.warn('[publicCollections] fetch book failed:', err);
    throw err;
  }
}

const mirrorSyncTimers = new Map<string, ReturnType<typeof setTimeout>>();

/**
 * Если подборка публичная — перезаписать зеркало publicCollections/{slug}.
 * Debounce: при пакетном saveBook/move не долбим Firestore на каждую книгу.
 */
export function syncPublicCollectionMirror(
  collectionId: string | undefined | null
): void {
  const id = collectionId?.trim();
  if (!id) return;
  const prev = mirrorSyncTimers.get(id);
  if (prev) clearTimeout(prev);
  const timer = setTimeout(() => {
    mirrorSyncTimers.delete(id);
    void (async () => {
      try {
        const col = await getCollection(id);
        if (!col?.isPublic || !col.shareSlug) return;
        await publishCollection(id);
      } catch (err) {
        console.warn(
          '[publicCollections] syncPublicCollectionMirror failed:',
          err
        );
      }
    })();
  }, 700);
  mirrorSyncTimers.set(id, timer);
}

/** Slug'и публичных подборок, уже импортированных в локальную библиотеку. */
export async function getImportedPublicSlugs(): Promise<Set<string>> {
  const cols = await getCollections();
  const set = new Set<string>();
  for (const c of cols) {
    const slug = c.importedFromSlug?.trim();
    if (slug) set.add(slug);
  }
  return set;
}

/**
 * Импорт всей публичной подборки в «Мою библиотеку»:
 * новая локальная категория + копии всех текстов.
 * Уже сохранённые книги (тот же public-{slug}-{id}) пропускаются;
 * повторный импорт того же slug обновляет ту же категорию (importedFromSlug).
 */
export async function importPublicCollection(
  pub: PublicCollectionDoc
): Promise<{ added: number; skipped: number; collectionId: string }> {
  const slug = (pub.slug || '').trim();
  if (!slug) throw new Error('Missing collection slug');
  const summaries = Array.isArray(pub.books) ? pub.books : [];
  if (summaries.length === 0) {
    throw new Error('EMPTY_PUBLIC_COLLECTION');
  }

  const existingCols = await getCollections();
  let local =
    existingCols.find((c) => c.importedFromSlug === slug) ?? null;

  if (!local) {
    local = await createUserCollection(
      pub.title?.trim() || slug,
      pub.color || '#8B5CF6',
      pub.description ?? undefined,
      { importedFromSlug: slug }
    );
  } else {
    // Обновим метаданные при повторном импорте (название/описание могли измениться)
    const tagged = await updateCollection(local.id, {
      title: pub.title?.trim() || local.title,
      description: pub.description ?? local.description,
      color: pub.color || local.color,
      importedFromSlug: slug,
    });
    if (tagged) local = tagged;
  }

  const ownerUserId = getDataOwnerId();
  let added = 0;
  let skipped = 0;

  for (const summary of summaries) {
    const bookId = summary?.id?.trim();
    if (!bookId) {
      skipped += 1;
      continue;
    }
    const personalId = `public-${slug}-${bookId}`;
    try {
      const existing = await getBook(personalId);
      if (existing) {
        if (existing.collectionId !== local.id) {
          await saveBook({
            ...existing,
            collectionId: local.id,
            updatedAt: new Date().toISOString(),
          });
        }
        skipped += 1;
        continue;
      }

      const remote = await fetchPublicCollectionBook(slug, bookId);
      if (!remote || !Array.isArray(remote.paragraphs) || remote.paragraphs.length === 0) {
        skipped += 1;
        continue;
      }

      const now = new Date().toISOString();
      const personal: Book = {
        ...remote,
        id: personalId,
        catalogId: remote.catalogId,
        collectionId: local.id,
        ownerUserId,
        userId: ownerUserId !== 'guest' ? ownerUserId : undefined,
        authorId: ownerUserId !== 'guest' ? ownerUserId : undefined,
        createdAt: now,
        updatedAt: now,
      };
      await saveBook(personal);
      added += 1;
    } catch (err) {
      console.warn('[publicCollections] import book failed:', bookId, err);
      skipped += 1;
    }
  }

  return { added, skipped, collectionId: local.id };
}

/** Удалить публичное зеркало при удалении подборки */
export async function deletePublicCollectionMirror(
  slug: string | null | undefined
): Promise<void> {
  if (!slug || !isFirebaseConfigured()) return;
  const uid = getCloudUid();
  if (!uid) return;
  try {
    const firebase = await getFirebase();
    if (!firebase) return;
    const booksSnap = await getDocs(
      collection(firebase.db, 'publicCollections', slug, 'books')
    );
    const batch = writeBatch(firebase.db);
    for (const d of booksSnap.docs) batch.delete(d.ref);
    batch.delete(doc(firebase.db, 'publicCollections', slug));
    await batch.commit();
  } catch (err) {
    console.warn('[publicCollections] delete mirror failed:', err);
  }
}
