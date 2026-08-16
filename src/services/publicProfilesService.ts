/**
 * Публичный профиль прогресса: Firestore `publicProfiles/{slug}`.
 * Шаринг стрика / выученных слов / недельной активности без приватных книг.
 *
 * Важно: не ждём getDoc без таймаута — при «полу-offline» Firestore
 * может висеть бесконечно (кнопка «Публикуем…» не отпускается).
 */
import { doc, setDoc } from 'firebase/firestore';
import { Platform } from 'react-native';
import { stripUndefinedDeep } from '../utils/stripUndefined';
import { resolveFirestoreUid } from './authService';
import { getFirebase, isFirebaseConfigured } from './firebaseClient';
import { generateShareSlug } from './publicCollectionsService';

export interface PublicProfileActivityDay {
  date: string;
  wordsRead: number;
  cardsReviewed: number;
}

export interface PublicProfileDoc {
  slug: string;
  userId: string;
  ownerUserId: string;
  authorId: string;
  displayName: string;
  isPublic: true;
  streak: number;
  wordsLearned: number;
  cardsCount: number;
  weekWords: number;
  weekCards: number;
  recentActivity?: PublicProfileActivityDay[];
  createdAt: string;
  updatedAt: string;
}

const LOCAL_SLUG_KEY = (uid: string) =>
  `@languageeee/publicProfileSlug/${uid}`;
const LOCAL_CREATED_KEY = (uid: string) =>
  `@languageeee/publicProfileCreatedAt/${uid}`;

const WRITE_TIMEOUT_MS = 12_000;

export function publicProfileUrl(slug: string): string {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}/u/${encodeURIComponent(slug)}`;
  }
  return `/u/${encodeURIComponent(slug)}`;
}

function defaultDisplayName(uid: string): string {
  return `Learner ${uid.slice(0, 6)}`;
}

export function isFirestoreOfflineError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const code = 'code' in err ? String((err as { code: unknown }).code) : '';
  const msg = err instanceof Error ? err.message : String(err);
  return (
    code === 'unavailable' ||
    code === 'deadline-exceeded' ||
    /client is offline|Failed to get document because the client is offline|network|offline|ERR_INTERNET|timeout|превышено время/i.test(
      msg
    )
  );
}

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

function readLocalSlug(uid: string): string {
  if (Platform.OS !== 'web' || typeof localStorage === 'undefined') return '';
  try {
    return String(localStorage.getItem(LOCAL_SLUG_KEY(uid)) || '').trim();
  } catch {
    return '';
  }
}

function readLocalCreatedAt(uid: string): string {
  if (Platform.OS !== 'web' || typeof localStorage === 'undefined') return '';
  try {
    return String(localStorage.getItem(LOCAL_CREATED_KEY(uid)) || '').trim();
  } catch {
    return '';
  }
}

function writeLocalMeta(uid: string, slug: string, createdAt: string): void {
  if (Platform.OS !== 'web' || typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(LOCAL_SLUG_KEY(uid), slug);
    localStorage.setItem(LOCAL_CREATED_KEY(uid), createdAt);
  } catch {
    /* ignore quota */
  }
}

export async function publishPublicProfile(options: {
  displayName?: string;
  streak: number;
  wordsLearned: number;
  cardsCount: number;
  weekWords: number;
  weekCards: number;
  recentActivity?: PublicProfileActivityDay[];
}): Promise<{ slug: string; url: string }> {
  if (!isFirebaseConfigured()) {
    throw new Error('Cloud is not configured');
  }
  const uid = await withTimeout(resolveFirestoreUid(), 8_000, 'resolveFirestoreUid');
  if (!uid) throw new Error('Sign in to share your profile');

  const firebase = await withTimeout(getFirebase(), 5_000, 'getFirebase');
  if (!firebase) throw new Error('Cloud is not configured');
  if (firebase.auth.currentUser?.uid !== uid) {
    throw new Error('Sign in to share your profile');
  }

  // Без getDoc: при полу-offline чтение может висеть бесконечно.
  // Стабильный slug берём из localStorage (тот же URL при повторной публикации).
  const savedSlug = readLocalSlug(uid);
  const slug = savedSlug || generateShareSlug(options.displayName || 'progress');
  const createdAt = readLocalCreatedAt(uid) || new Date().toISOString();
  const now = new Date().toISOString();

  const payload = stripUndefinedDeep({
    slug,
    userId: uid,
    ownerUserId: uid,
    authorId: uid,
    displayName: options.displayName?.trim() || defaultDisplayName(uid),
    isPublic: true as const,
    streak: Math.max(0, Math.round(options.streak)),
    wordsLearned: Math.max(0, Math.round(options.wordsLearned)),
    cardsCount: Math.max(0, Math.round(options.cardsCount)),
    weekWords: Math.max(0, Math.round(options.weekWords)),
    weekCards: Math.max(0, Math.round(options.weekCards)),
    recentActivity: Array.isArray(options.recentActivity)
      ? options.recentActivity.slice(0, 7)
      : undefined,
    createdAt,
    updatedAt: now,
  }) as PublicProfileDoc;

  const userRef = doc(firebase.db, 'users', uid);

  try {
    await withTimeout(
      setDoc(doc(firebase.db, 'publicProfiles', slug), payload),
      WRITE_TIMEOUT_MS,
      'setDoc publicProfiles'
    );
    await withTimeout(
      setDoc(
        userRef,
        { publicProfileSlug: slug, updatedAt: Date.now() },
        { merge: true }
      ),
      WRITE_TIMEOUT_MS,
      'setDoc users'
    );
  } catch (err) {
    if (isFirestoreOfflineError(err)) {
      throw new Error('OFFLINE_SHARE');
    }
    throw err;
  }

  writeLocalMeta(uid, slug, createdAt);
  return { slug, url: publicProfileUrl(slug) };
}

export async function fetchPublicProfile(
  slug: string
): Promise<PublicProfileDoc | null> {
  if (!slug || !isFirebaseConfigured()) return null;
  const firebase = await getFirebase();
  if (!firebase) return null;
  try {
    const { getDoc, getDocFromCache } = await import('firebase/firestore');
    const ref = doc(firebase.db, 'publicProfiles', slug);
    let snap;
    try {
      snap = await withTimeout(getDoc(ref), 10_000, 'getDoc publicProfiles');
    } catch (err) {
      if (!isFirestoreOfflineError(err)) throw err;
      try {
        snap = await getDocFromCache(ref);
      } catch {
        return null;
      }
    }
    if (!snap?.exists()) return null;
    const data = snap.data() as PublicProfileDoc;
    const uid = firebase.auth.currentUser?.uid ?? null;
    if (!data?.isPublic && data?.userId !== uid) return null;
    return {
      ...data,
      slug: data.slug || slug,
    };
  } catch (err) {
    console.warn('[publicProfiles] fetch failed:', err);
    return null;
  }
}
