import { CATALOG_STORIES } from '../data/catalogStories';
import { catalogStoryNativeTitle } from '../i18n/catalogI18n';
import type { Book, NativeLanguage } from '../types';

/** Разбор «Original / Русское» и снятие устаревшего суффикса (EN). */
export function splitCombinedTitle(title: string): {
  original: string;
  russianTitle?: string;
} {
  const cleaned = title.replace(/\s*\(EN\)\s*$/i, '').trim();
  const parts = cleaned.split(/\s+\/\s+/);
  if (parts.length >= 2) {
    const original = parts[0].trim();
    const russianTitle = parts.slice(1).join(' / ').trim();
    return {
      original,
      russianTitle: russianTitle || undefined,
    };
  }
  return { original: cleaned };
}

/** Оригинал + русский перевод названия (как в каталоге). */
export function resolveBookTitles(
  book: Pick<Book, 'title' | 'russianTitle'>
): { original: string; russian: string } {
  let original = book.title?.trim() || '';
  let russian = book.russianTitle?.trim() || '';

  if (!russian) {
    const split = splitCombinedTitle(original);
    original = split.original;
    russian = split.russianTitle || '';
  } else {
    original = original.replace(/\s*\(EN\)\s*$/i, '').trim();
  }

  return { original, russian };
}

/**
 * Заголовки для карточки с учётом UI-языка.
 * Книги из каталога берут `titles[lang]`; иначе русский подзаголовок только при lang === 'ru'.
 */
export function resolveBookDisplayTitles(
  book: Pick<Book, 'title' | 'russianTitle' | 'catalogId'>,
  lang: NativeLanguage
): { original: string; native?: string } {
  const { original, russian } = resolveBookTitles(book);

  if (book.catalogId) {
    const story = CATALOG_STORIES.find((s) => s.id === book.catalogId);
    if (story) {
      const native = catalogStoryNativeTitle(story, lang);
      if (native) return { original, native };
      return { original };
    }
  }

  if (lang === 'ru' && russian && russian !== original) {
    return { original, native: russian };
  }
  return { original };
}

/** Одна строка: «Original / Native» (диалоги, flashcards, continue). */
export function formatBookTitleLine(
  book: Pick<Book, 'title' | 'russianTitle' | 'catalogId'>,
  lang: NativeLanguage = 'ru'
): string {
  const { original, native } = resolveBookDisplayTitles(book, lang);
  if (!native || native === original) return original || native || '';
  if (!original) return native;
  return `${original} / ${native}`;
}
