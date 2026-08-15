/**
 * Публичный профиль прогресса: Firestore `publicProfiles/{slug}`.
 * Шаринг стрика / выученных слов / недельной активности без приватных книг.
 */
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { getCloudUid } from './authService';
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
  const uid = getCloudUid();
  if (!uid) throw new Error('Sign in to share your profile');

  const firebase = await getFirebase();
  if (!firebase) throw new Error('Cloud is not configured');

  const existingSlug = await findOwnProfileSlug(uid);
  const slug =
    existingSlug || generateShareSlug(options.displayName || 'progress');
  const now = new Date().toISOString();
  const prev = existingSlug ? await fetchPublicProfile(existingSlug) : null;

  const payload: PublicProfileDoc = {
    slug,
    userId: uid,
    ownerUserId: uid,
    authorId: uid,
    displayName:
      options.displayName?.trim() ||
      prev?.displayName ||
      defaultDisplayName(uid),
    isPublic: true,
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
  };

  await setDoc(doc(firebase.db, 'publicProfiles', slug), payload);
  return { slug, url: publicProfileUrl(slug) };
}

async function findOwnProfileSlug(uid: string): Promise<string | null> {
  try {
    const firebase = await getFirebase();
    if (!firebase) return null;
    const { collection, getDocs, query, where, limit } = await import(
      'firebase/firestore'
    );
    const q = query(
      collection(firebase.db, 'publicProfiles'),
      where('userId', '==', uid),
      limit(1)
    );
    const snap = await getDocs(q);
    const first = snap.docs[0];
    return first ? first.id : null;
  } catch {
    return null;
  }
}

export async function fetchPublicProfile(
  slug: string
): Promise<PublicProfileDoc | null> {
  if (!slug || !isFirebaseConfigured()) return null;
  const firebase = await getFirebase();
  if (!firebase) return null;
  const snap = await getDoc(doc(firebase.db, 'publicProfiles', slug));
  if (!snap.exists()) return null;
  const data = snap.data() as PublicProfileDoc;
  if (!data?.isPublic && data?.userId !== getCloudUid()) return null;
  return {
    ...data,
    slug: data.slug || slug,
  };
}
