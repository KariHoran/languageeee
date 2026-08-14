import { CATALOG_STORIES } from '../data/catalogStories';
import { catalogStorySearchBlob } from '../i18n/catalogI18n';
import type {
  Book,
  CatalogCategoryId,
  CatalogLevelId,
  CatalogStory,
  LearningLanguage,
} from '../types';
import { formatBookTitleLine, resolveBookTitles } from '../utils/bookTitle';
import { buildBookFromAnalysis } from './hskLocalService';
import { getBook, getBooks, saveBook } from './storageService';

export interface CatalogFilters {
  language?: LearningLanguage | 'all';
  level?: CatalogLevelId | 'all';
  category?: CatalogCategoryId | 'all';
  /** Активный тег (точное совпадение в story.tags) */
  tag?: string | 'all';
  query?: string;
}

/** Стабильный id личной копии истории из каталога */
export function catalogBookId(storyId: string): string {
  return `catalog-${storyId}`;
}

export function getCatalogStories(filters: CatalogFilters = {}): CatalogStory[] {
  const language = filters.language ?? 'all';
  const level = filters.level ?? 'all';
  const category = filters.category ?? 'all';
  const tag = filters.tag ?? 'all';
  const q = filters.query?.trim().toLowerCase() ?? '';

  return CATALOG_STORIES.filter((story) => {
    if (!story.isPublic) return false;
    if (language !== 'all' && story.language !== language) return false;
    if (level !== 'all' && story.level !== level) return false;
    if (category !== 'all' && story.category !== category) return false;
    if (tag !== 'all') {
      const tags = (story.tags ?? []).map((t) => t.toLowerCase());
      if (!tags.includes(tag.toLowerCase())) return false;
    }
    if (!q) return true;
    return catalogStorySearchBlob(story).toLowerCase().includes(q);
  });
}

export function getCatalogStory(storyId: string): CatalogStory | null {
  return CATALOG_STORIES.find((s) => s.id === storyId) ?? null;
}

export async function findImportedCatalogBook(
  storyId: string
): Promise<Book | null> {
  const byId = await getBook(catalogBookId(storyId));
  if (byId) return byId;
  const all = await getBooks();
  return all.find((b) => b.catalogId === storyId) ?? null;
}

/**
 * Сохраняет историю из каталога в личную библиотеку
 * с разбором через buildBookFromAnalysis (zh HSK / en grammar).
 */
export async function importCatalogStory(storyId: string): Promise<Book> {
  const story = getCatalogStory(storyId);
  if (!story) {
    throw new Error(`Catalog story not found: ${storyId}`);
  }

  const existing = await findImportedCatalogBook(storyId);
  if (existing) {
    const titles = resolveBookTitles(existing);
    const needsTitleFix =
      !existing.russianTitle?.trim() ||
      existing.title.includes(' / ') ||
      /\(EN\)\s*$/i.test(existing.title);

    const enAligned = story.translation_en?.trim()
      ? story.translation_en
          .split(/\n\s*\n/)
          .map((p) => p.trim())
          .filter(Boolean)
      : null;
    const zhAligned = story.translation_zh?.trim()
      ? story.translation_zh
          .split(/\n\s*\n/)
          .map((p) => p.trim())
          .filter(Boolean)
      : null;

    const paragraphs =
      enAligned || zhAligned
        ? existing.paragraphs.map((p, i) => {
            const en = enAligned?.[i]?.trim() || p.translations?.en;
            const zh = zhAligned?.[i]?.trim() || p.translations?.zh;
            if (!en && !zh && !p.translations) return p;
            return {
              ...p,
              translations: {
                ...(p.translations ?? {}),
                ...(en ? { en } : {}),
                ...(zh ? { zh } : {}),
              },
            };
          })
        : existing.paragraphs;

    const patched: Book = {
      ...existing,
      title: needsTitleFix ? story.title : titles.original,
      russianTitle: story.russianTitle || titles.russian || undefined,
      paragraphs,
      updatedAt: new Date().toISOString(),
    };
    await saveBook(patched);
    try {
      const { useAppStore } = await import('../store/useAppStore');
      const { legacyBookToDomain } = await import('../store/parseBook');
      useAppStore.getState().upsertBook(legacyBookToDomain(patched));
    } catch {
      /* ignore */
    }
    return patched;
  }

  const book = buildBookFromAnalysis(
    story.title,
    story.content,
    story.targetHskLevel,
    {
      language: story.language,
      originalRussianText: story.russianTranslation,
      translationEn: story.translation_en,
      translationZh: story.translation_zh,
      russianTitle: story.russianTitle,
      collectionId: undefined,
    }
  );

  const now = new Date().toISOString();
  const saved: Book = {
    ...book,
    id: catalogBookId(story.id),
    catalogId: story.id,
    createdAt: now,
    updatedAt: now,
  };

  await saveBook(saved);
  try {
    const { useAppStore } = await import('../store/useAppStore');
    const { legacyBookToDomain } = await import('../store/parseBook');
    useAppStore.getState().upsertBook(legacyBookToDomain(saved));
  } catch {
    /* Zustand optional on native edge cases */
  }
  console.log('[catalog] imported', {
    id: saved.id,
    language: saved.language,
    title: formatBookTitleLine(saved),
    paragraphs: saved.paragraphs.length,
  });
  return saved;
}
