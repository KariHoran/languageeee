import type { Book } from '../types';
import { resolveBookTitles } from './bookTitle';

/** Полнотекстовый haystack: название + тело абзацев. */
export function bookSearchHaystack(book: Book): string {
  const { original, russian } = resolveBookTitles(book);
  const paras = (book.paragraphs ?? [])
    .map((p) =>
      [
        p.originalText,
        p.chineseText,
        p.englishText,
        p.russianTranslation,
      ]
        .filter(Boolean)
        .join(' ')
    )
    .join(' ');
  return [
    original,
    russian,
    book.russianTitle,
    book.sourceText,
    book.originalRussianText,
    paras,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

export function bookMatchesQuery(book: Book, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return bookSearchHaystack(book).includes(q);
}
