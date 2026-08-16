/**
 * Публичные колоды карточек: Firestore `publicDecks/{slug}`.
 * Шаринг своей колоды + импорт чужой по ссылке `/d/{slug}`.
 */
import { doc, getDoc, setDoc } from 'firebase/firestore';
import type { Flashcard, LearningLanguage } from '../types';
import { getCloudUid, resolveFirestoreUid } from './authService';
import { addFlashcard, hasFlashcard, normalizeCard } from './flashcardsStore';
import { getFirebase, isFirebaseConfigured } from './firebaseClient';
import { generateShareSlug } from './publicCollectionsService';
import { stripUndefinedDeep } from '../utils/stripUndefined';

const MAX_PUBLIC_CARDS = 300;

export interface PublicDeckCard {
  hanzi: string;
  pinyin?: string;
  translation?: string;
  language?: LearningLanguage;
  kind?: 'word' | 'grammar';
  hskLevel?: number;
  contextSentence?: string;
  sourceTitle?: string;
}

export interface PublicDeckDoc {
  slug: string;
  title: string;
  userId: string;
  ownerUserId: string;
  authorId: string;
  isPublic: true;
  language: LearningLanguage | 'all';
  cardCount: number;
  cards: PublicDeckCard[];
  createdAt: string;
  updatedAt: string;
}

export function publicDeckUrl(slug: string): string {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}/d/${encodeURIComponent(slug)}`;
  }
  return `/d/${encodeURIComponent(slug)}`;
}

function slimCard(card: Flashcard): PublicDeckCard {
  const c = normalizeCard(card);
  return stripUndefinedDeep({
    hanzi: c.hanzi,
    pinyin: c.pinyin || undefined,
    translation: c.translation || undefined,
    language: c.language,
    kind: c.kind === 'grammar' ? ('grammar' as const) : ('word' as const),
    hskLevel: c.hskLevel,
    contextSentence: c.contextSentence || undefined,
    sourceTitle: c.sourceTitle || undefined,
  });
}

/** Опубликовать колоду; возвращает slug + url. */
export async function publishPublicDeck(options: {
  title: string;
  language: LearningLanguage | 'all';
  cards: Flashcard[];
}): Promise<{ slug: string; url: string }> {
  if (!isFirebaseConfigured()) {
    throw new Error('Firebase is not configured');
  }
  const uid = await resolveFirestoreUid();
  if (!uid) {
    throw new Error('Sign in to share a deck');
  }

  const active = options.cards
    .map(normalizeCard)
    .filter((c) => !c.suspended && c.hanzi.trim());
  if (active.length === 0) {
    throw new Error('Deck is empty');
  }

  const slug = generateShareSlug(options.title || 'deck');
  const now = new Date().toISOString();
  const cards = active.slice(0, MAX_PUBLIC_CARDS).map(slimCard);
  const payload = stripUndefinedDeep({
    slug,
    title: (options.title || 'Deck').trim().slice(0, 80),
    userId: uid,
    ownerUserId: uid,
    authorId: uid,
    isPublic: true as const,
    language: options.language,
    cardCount: cards.length,
    cards,
    createdAt: now,
    updatedAt: now,
  }) as PublicDeckDoc;

  const firebase = await getFirebase();
  if (!firebase) throw new Error('Firebase is not configured');
  if (firebase.auth.currentUser?.uid !== uid) {
    throw new Error('Sign in to share a deck');
  }
  await setDoc(doc(firebase.db, 'publicDecks', slug), payload);
  return { slug, url: publicDeckUrl(slug) };
}

export async function fetchPublicDeck(
  slug: string
): Promise<PublicDeckDoc | null> {
  if (!slug || !isFirebaseConfigured()) return null;
  const firebase = await getFirebase();
  if (!firebase) return null;
  const snap = await getDoc(doc(firebase.db, 'publicDecks', slug));
  if (!snap.exists()) return null;
  const data = snap.data() as PublicDeckDoc;
  if (!data?.isPublic && data?.userId !== getCloudUid()) return null;
  return {
    ...data,
    slug: data.slug || slug,
    cards: Array.isArray(data.cards) ? data.cards : [],
  };
}

/** Импорт карточек публичной колоды в личную SRS-колоду. */
export async function importPublicDeck(
  deck: PublicDeckDoc
): Promise<{ added: number; skipped: number }> {
  let added = 0;
  let skipped = 0;
  for (const card of deck.cards) {
    const surface = card.hanzi?.trim();
    if (!surface) {
      skipped += 1;
      continue;
    }
    try {
      const lang = card.language;
      const exists = await hasFlashcard(surface, lang);
      if (exists && card.kind !== 'grammar') {
        skipped += 1;
        continue;
      }
      await addFlashcard({
        hanzi: surface,
        pinyin: card.pinyin,
        translation: card.translation,
        language: lang,
        kind: card.kind === 'grammar' ? 'grammar' : 'word',
        hskLevel: card.hskLevel,
        contextSentence: card.contextSentence,
        sourceTitle: card.sourceTitle || deck.title,
      });
      added += 1;
    } catch {
      skipped += 1;
    }
  }
  return { added, skipped };
}

/** Каталог публичных колод (Explore). */
export async function listPublicDecks(
  searchQuery?: string
): Promise<PublicDeckDoc[]> {
  try {
    if (!isFirebaseConfigured()) return [];
    const firebase = await getFirebase();
    if (!firebase) return [];
    const { collection, getDocs, query, where, limit } = await import(
      'firebase/firestore'
    );
    const q = query(
      collection(firebase.db, 'publicDecks'),
      where('isPublic', '==', true),
      limit(60)
    );
    const snap = await getDocs(q);
    let items: PublicDeckDoc[] = snap.docs.map((d) => {
      const data = d.data() as PublicDeckDoc;
      return {
        ...data,
        slug: data.slug || d.id,
        isPublic: true,
        cards: Array.isArray(data.cards) ? data.cards : [],
        cardCount: data.cardCount ?? (data.cards?.length || 0),
      };
    });
    const needle = searchQuery?.trim().toLowerCase() ?? '';
    if (needle) {
      items = items.filter((deck) => {
        const hay = [deck.title, deck.language, ...(deck.cards ?? []).map((c) => c.hanzi)]
          .join(' ')
          .toLowerCase();
        return hay.includes(needle);
      });
    }
    return items.sort((a, b) =>
      (b.updatedAt || b.createdAt || '').localeCompare(a.updatedAt || a.createdAt || '')
    );
  } catch (err) {
    console.warn('[publicDecks] list failed:', err);
    return [];
  }
}
