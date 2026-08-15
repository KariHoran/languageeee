/**
 * Публичный профиль прогресса: Firestore `publicProfiles/{slug}`.
 * Шаринг стрика / выученных слов / недельной активности без приватных книг.
 */
import { doc, getDoc, setDoc } from 'firebase/firestore';
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

export function publicProfileUrl(slug: string): string {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}/u/${encodeURIComponent(slug)}`;
  }
  return `/u/${encodeURIComponent(slug)}`;
}

function defaultDisplayName(uid: string): string {
  return `Learner ${uid.slice(0, 6)}`;
}

function stripUndefined<T extends Record<string, unknown>>(obj: T): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) out[k] = v;
  }
  return out as T;
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
  const uid = await resolveFirestoreUid();
  if (!uid) throw new Error('Sign in to share your profile');

  const firebase = await getFirebase();
  if (!firebase) throw new Error('Cloud is not configured');
  if (firebase.auth.currentUser?.uid !== uid) {
    throw new Error('Sign in to share your profile');
  }

  const userRef = doc(firebase.db, 'users', uid);
  const userSnap = await getDoc(userRef);
  const savedSlug =
    typeof userSnap.data()?.publicProfileSlug === 'string'
      ? String(userSnap.data()?.publicProfileSlug).trim()
      : '';

  let slug = savedSlug;
  let prev: PublicProfileDoc | null = null;
  if (slug) {
    prev = await fetchPublicProfile(slug);
    if (prev && prev.userId !== uid) {
      slug = '';
      prev = null;
    }
  }
  if (!slug) {
    slug = generateShareSlug(options.displayName || 'progress');
  }

  const now = new Date().toISOString();
  const payload = stripUndefined({
    slug,
    userId: uid,
    ownerUserId: uid,
    authorId: uid,
    displayName:
      options.displayName?.trim() ||
      prev?.displayName ||
      defaultDisplayName(uid),
    isPublic: true as const,
    streak: Math.max(0, Math.round(options.streak)),
    wordsLearned: Math.max(0, Math.round(options.wordsLearned)),
    cardsCount: Math.max(0, Math.round(options.cardsCount)),
    weekWords: Math.max(0, Math.round(options.weekWords)),
    weekCards: Math.max(0, Math.round(options.weekCards)),
    recentActivity: Array.isArray(options.recentActivity)
      ? options.recentActivity.slice(0, 7)
      : prev?.recentActivity,
    createdAt: prev?.createdAt || now,
    updatedAt: now,
  }) as PublicProfileDoc;

  await setDoc(doc(firebase.db, 'publicProfiles', slug), payload);
  await setDoc(
    userRef,
    { publicProfileSlug: slug, updatedAt: Date.now() },
    { merge: true }
  );

  return { slug, url: publicProfileUrl(slug) };
}

export async function fetchPublicProfile(
  slug: string
): Promise<PublicProfileDoc | null> {
  if (!slug || !isFirebaseConfigured()) return null;
  const firebase = await getFirebase();
  if (!firebase) return null;
  try {
    const snap = await getDoc(doc(firebase.db, 'publicProfiles', slug));
    if (!snap.exists()) return null;
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
