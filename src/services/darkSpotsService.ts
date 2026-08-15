/**
 * «Тёмные места»: источники (книги), где много Again / слабых карточек.
 */
import type { LearningLanguage } from '../types';
import {
  filterWeakCards,
  getFlashcards,
  listSourceFilters,
  normalizeCard,
} from './flashcardsStore';

export interface DarkSpot {
  key: string;
  title: string;
  bookId?: string;
  cardCount: number;
  weakCount: number;
  againSum: number;
}

export async function getDarkSpots(
  language?: LearningLanguage | 'all',
  limit = 5
): Promise<DarkSpot[]> {
  const cards = await getFlashcards(language);
  const sources = listSourceFilters(cards);
  const weakSet = new Set(
    filterWeakCards(cards).map((c) => normalizeCard(c).id)
  );

  const spots: DarkSpot[] = sources.map((s) => {
    const related = cards.filter((raw) => {
      const c = normalizeCard(raw);
      if (s.bookId) return c.sourceBookId === s.bookId;
      return (c.sourceTitle ?? '').trim() === s.title;
    });
    let againSum = 0;
    let weakCount = 0;
    for (const raw of related) {
      const c = normalizeCard(raw);
      againSum += c.againCount ?? 0;
      if (weakSet.has(c.id)) weakCount += 1;
    }
    return {
      key: s.bookId || s.title,
      title: s.title,
      bookId: s.bookId,
      cardCount: related.length,
      weakCount,
      againSum,
    };
  });

  return spots
    .filter((s) => s.weakCount > 0 || s.againSum > 0)
    .sort(
      (a, b) =>
        b.weakCount - a.weakCount ||
        b.againSum - a.againSum ||
        b.cardCount - a.cardCount
    )
    .slice(0, limit);
}
