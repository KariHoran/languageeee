import type {
  CatalogCategoryId,
  CatalogLevelId,
  CatalogStory,
  LearningLanguage,
  NativeLanguage,
} from '../types';
import { translateUi, type UiMessageKey } from './uiMessages';
import { formatUnitCount } from './pluralI18n';

/** Стабильные id тегов в данных каталога (не локализованные строки). */
export type CatalogTagId =
  | 'hsk2'
  | 'hsk3'
  | 'cefr-a2'
  | 'cefr-b1'
  | 'school'
  | 'daily'
  | 'cafe'
  | 'dialogue'
  | 'romance'
  | 'travel'
  | 'narrative';

const TAG_KEYS: Record<CatalogTagId, UiMessageKey> = {
  hsk2: 'catalog.tag.hsk2',
  hsk3: 'catalog.tag.hsk3',
  'cefr-a2': 'catalog.tag.cefr-a2',
  'cefr-b1': 'catalog.tag.cefr-b1',
  school: 'catalog.tag.school',
  daily: 'catalog.tag.daily',
  cafe: 'catalog.tag.cafe',
  dialogue: 'catalog.tag.dialogue',
  romance: 'catalog.tag.romance',
  travel: 'catalog.tag.travel',
  narrative: 'catalog.tag.narrative',
};

const CATEGORY_KEYS: Record<CatalogCategoryId, UiMessageKey> = {
  fantasy: 'catalog.cat.fantasy',
  romance: 'catalog.cat.romance',
  adventure: 'catalog.cat.adventure',
  'slice-of-life': 'catalog.cat.slice-of-life',
  school: 'catalog.cat.school',
  original: 'catalog.cat.original',
  'harry-potter': 'catalog.cat.harry-potter',
};

const LEVEL_FILTER_KEYS: Record<CatalogLevelId | 'all', UiMessageKey> = {
  all: 'catalog.allLevels',
  beginner: 'catalog.levelBeginner',
  intermediate: 'catalog.levelIntermediate',
  advanced: 'catalog.levelAdvanced',
};

export function isCatalogTagId(value: string): value is CatalogTagId {
  return value in TAG_KEYS;
}

export function catalogTagLabel(
  tagId: string,
  lang: NativeLanguage
): string {
  if (isCatalogTagId(tagId)) {
    return translateUi(TAG_KEYS[tagId], lang);
  }
  return tagId;
}

export function catalogCategoryLabel(
  category: CatalogCategoryId,
  lang: NativeLanguage
): string {
  return translateUi(CATEGORY_KEYS[category], lang);
}

export function catalogLevelFilterLabel(
  level: CatalogLevelId | 'all',
  lang: NativeLanguage
): string {
  return translateUi(LEVEL_FILTER_KEYS[level], lang);
}

export function catalogLanguageLabel(
  language: LearningLanguage | 'all',
  lang: NativeLanguage
): string {
  if (language === 'all') return translateUi('lang.all', lang);
  if (language === 'zh') return translateUi('catalog.lang.zh', lang);
  if (language === 'ru') return translateUi('catalog.lang.ru', lang);
  return translateUi('catalog.lang.en', lang);
}

/** Подпись уровня на карточке (HSK / CEFR). */
export function catalogStoryLevelLabel(
  story: Pick<CatalogStory, 'language' | 'levelLabel' | 'targetHskLevel'>,
  lang: NativeLanguage
): string {
  if (story.language === 'en') {
    // Prefer explicit CEFR label from data when present
    if (/CEFR/i.test(story.levelLabel)) {
      return lang === 'zh'
        ? story.levelLabel.replace(/CEFR\s*/i, 'CEFR ')
        : story.levelLabel;
    }
    return translateUi('catalog.cefrLevel', lang, {
      n: story.targetHskLevel,
    });
  }
  if (/HSK/i.test(story.levelLabel)) {
    const m = story.levelLabel.match(/HSK\s*(\d+)/i);
    const n = m ? m[1] : String(story.targetHskLevel);
    return translateUi('catalog.hskLevel', lang, { n });
  }
  return translateUi('catalog.hskLevel', lang, {
    n: story.targetHskLevel,
  });
}

export function catalogTextsCountLabel(
  count: number,
  lang: NativeLanguage
): string {
  return formatUnitCount(count, 'text', lang);
}

/**
 * Подпись названия на родном языке (под оригиналом на карточке).
 * Не возвращает русский, если UI-язык en/zh и перевода нет.
 * Не дублирует `title`, если локаль совпадает с оригиналом.
 */
export function catalogStoryNativeTitle(
  story: Pick<CatalogStory, 'title' | 'russianTitle' | 'titles'>,
  lang: NativeLanguage
): string | undefined {
  const original = story.title?.trim() || '';
  const fromMap = story.titles?.[lang]?.trim();
  if (fromMap && fromMap !== original) return fromMap;
  if (lang === 'ru') {
    const ru = story.russianTitle?.trim();
    if (ru && ru !== original) return ru;
  }
  return undefined;
}

/**
 * Заголовки карточки: оригинал (язык текста) + перевод UI-языка.
 * При смене nativeLanguage secondary мгновенно меняется.
 */
export function catalogStoryCardTitles(
  story: Pick<CatalogStory, 'title' | 'russianTitle' | 'titles'>,
  lang: NativeLanguage
): { primary: string; secondary?: string } {
  const primary = story.title?.trim() || catalogStoryNativeTitle(story, lang) || '';
  const secondary = catalogStoryNativeTitle(story, lang);
  return { primary, secondary };
}

/** Описание карточки каталога на UI-языке. */
export function catalogStoryDescription(
  story: Pick<CatalogStory, 'description' | 'descriptions'>,
  lang: NativeLanguage
): string {
  const fromMap = story.descriptions?.[lang]?.trim();
  if (fromMap) return fromMap;
  if (lang === 'ru') return story.description?.trim() || '';
  // en/zh без перевода — не показываем русский legacy
  return (
    story.descriptions?.en?.trim() ||
    story.descriptions?.zh?.trim() ||
    ''
  );
}

/** Все локализованные строки карточки для поиска. */
export function catalogStorySearchBlob(
  story: Pick<
    CatalogStory,
    | 'title'
    | 'russianTitle'
    | 'titles'
    | 'description'
    | 'descriptions'
    | 'author'
    | 'categoryLabel'
    | 'levelLabel'
    | 'content'
    | 'russianTranslation'
    | 'translation_en'
    | 'translation_zh'
    | 'tags'
  >
): string {
  const titleVals = Object.values(story.titles ?? {});
  const descVals = Object.values(story.descriptions ?? {});
  return [
    story.title,
    story.russianTitle,
    ...titleVals,
    story.author,
    story.description,
    ...descVals,
    story.categoryLabel,
    story.levelLabel,
    story.content,
    story.russianTranslation ?? '',
    story.translation_en ?? '',
    story.translation_zh ?? '',
    ...(story.tags ?? []),
  ].join(' ');
}

export function catalogLevelOptions(lang: NativeLanguage): Array<{
  id: CatalogLevelId | 'all';
  label: string;
}> {
  return (['all', 'beginner', 'intermediate', 'advanced'] as const).map(
    (id) => ({
      id,
      label: catalogLevelFilterLabel(id, lang),
    })
  );
}

export function catalogCategoryOptions(lang: NativeLanguage): Array<{
  id: CatalogCategoryId | 'all';
  label: string;
}> {
  const ids: Array<CatalogCategoryId | 'all'> = [
    'all',
    'fantasy',
    'romance',
    'adventure',
    'slice-of-life',
    'school',
    'original',
  ];
  return ids.map((id) => ({
    id,
    label:
      id === 'all'
        ? translateUi('catalog.allGenres', lang)
        : catalogCategoryLabel(id, lang),
  }));
}

export function catalogLanguageOptions(lang: NativeLanguage): Array<{
  id: LearningLanguage | 'all';
  label: string;
}> {
  return (['all', 'zh', 'ru', 'en'] as const).map((id) => ({
    id,
    label: catalogLanguageLabel(id, lang),
  }));
}

/** Число глав/частей истории для мета на карточке. */
export function catalogStoryChapterCount(
  story: Pick<CatalogStory, 'content' | 'chapterCount'>
): number {
  if (typeof story.chapterCount === 'number' && story.chapterCount > 0) {
    return story.chapterCount;
  }
  const parts = story.content.split(/\n\n+/).filter((p) => p.trim());
  return Math.max(1, parts.length);
}

export function catalogStoryChaptersLabel(
  story: Pick<CatalogStory, 'content' | 'chapterCount'>,
  lang: NativeLanguage
): string {
  return translateUi('stories.chaptersCount', lang, {
    n: catalogStoryChapterCount(story),
  });
}

export function catalogStoryStatusLabel(
  story: Pick<CatalogStory, 'isComplete'>,
  lang: NativeLanguage,
  readPercent?: number
): string {
  const complete =
    story.isComplete === true ||
    (typeof readPercent === 'number' && readPercent >= 100);
  return translateUi(
    complete ? 'stories.status.complete' : 'stories.status.incomplete',
    lang
  );
}
