import type {
  CatalogCategoryId,
  CatalogLevelId,
  CatalogStory,
  LearningLanguage,
} from '../types';
import {
  catalogCategoryOptions,
  catalogLanguageLabel as catalogLanguageLabelI18n,
  catalogLanguageOptions,
  catalogLevelOptions,
} from '../i18n/catalogI18n';
import type { NativeLanguage } from '../types';

/**
 * Публичный каталог историй (статика / моки, без сети).
 * Стандарт названий:
 * - `title` — оригинал на языке текста (zh / en / ru)
 * - `titles` / `russianTitle` — перевод для карточек UI по nativeLanguage
 * - `descriptions` — описание карточки по nativeLanguage
 * - `russianTranslation` + `translation_en` / `translation_zh` — параллель в ридере
 * - `tags` — стабильные id (`hsk2`, `school`, …), подписи через i18n
 * - `isPublic: true` — видно в Explore
 */
export const CATALOG_STORIES: CatalogStory[] = [
  {
    id: 'zh-school-morning',
    title: '学校的早晨',
    russianTitle: 'Утро в школе',
    titles: {
      ru: 'Утро в школе',
      en: 'Morning at School',
      zh: '学校的早晨',
    },
    language: 'zh',
    level: 'beginner',
    levelLabel: 'HSK 2',
    category: 'school',
    categoryLabel: 'School',
    tags: ['hsk2', 'school', 'daily'],
    isPublic: true,
    author: 'languageeee original',
    description: 'Короткий китайский текст для HSK 2: утро школьника и друзья.',
    descriptions: {
      ru: 'Короткий китайский текст для HSK 2: утро школьника и друзья.',
      en: 'A short Chinese text for HSK 2: a school morning and friends.',
      zh: '适合 HSK 2 的短文：学生的早晨与朋友。',
    },
    coverEmoji: '🎒',
    coverTone: 'sky',
    chapterCount: 4,
    isComplete: false,
    targetHskLevel: 2,
    content:
      '今天早上，小明很早就起床了。他吃了早饭，然后去学校。\n\n在学校，他见到了好朋友。他们一起学习汉语。',
    russianTranslation:
      'Сегодня утром Сяо Мин встал очень рано. Он позавтракал и потом пошёл в школу.\n\nВ школе он встретил хорошего друга. Они вместе учат китайский.',
    translation_en:
      'This morning, Xiao Ming got up very early. He ate breakfast and then went to school.\n\nAt school he met a good friend. They study Chinese together.',
    translation_zh:
      '今天早上，小明很早起床。他吃了早饭，然后去了学校。\n\n在学校他见到了好朋友。他们一起学习汉语。',
  },
  {
    id: 'zh-cafe-meetup',
    title: '咖啡馆里的见面',
    russianTitle: 'Встреча в кафе',
    titles: {
      ru: 'Встреча в кафе',
      en: 'Meeting at the Café',
      zh: '咖啡馆里的见面',
    },
    language: 'zh',
    level: 'intermediate',
    levelLabel: 'HSK 3',
    category: 'slice-of-life',
    categoryLabel: 'Slice of life',
    tags: ['hsk3', 'cafe', 'dialogue'],
    isPublic: true,
    author: 'languageeee original',
    description: 'Друзья встречаются в кафе и обсуждают планы на выходные.',
    descriptions: {
      ru: 'Друзья встречаются в кафе и обсуждают планы на выходные.',
      en: 'Friends meet at a café and talk about weekend plans.',
      zh: '朋友在咖啡馆见面，聊周末的计划。',
    },
    coverEmoji: '☕',
    coverTone: 'rose',
    chapterCount: 4,
    isComplete: false,
    targetHskLevel: 3,
    content:
      '周末的时候，李娜约朋友去咖啡馆。她们点了咖啡和蛋糕，聊了很久。\n\n李娜说她想去旅行，可是最近工作太忙了。朋友听了以后，建议她先休息几天。',
    russianTranslation:
      'На выходных Ли На позвала подругу в кафе. Они заказали кофе и торт и долго болтали.\n\nЛи На сказала, что хочет путешествовать, но в последнее время слишком занята работой. Подруга, выслушав её, посоветовала сначала несколько дней отдохнуть.',
    translation_en:
      'On the weekend, Li Na invited a friend to a café. They ordered coffee and cake and talked for a long time.\n\nLi Na said she wanted to travel, but she had been too busy with work lately. After listening, her friend suggested she rest for a few days first.',
    translation_zh:
      '周末的时候，李娜约朋友去咖啡馆。她们点了咖啡和蛋糕，聊了很久。\n\n李娜说她想去旅行，可是最近工作太忙了。朋友听了以后，建议她先休息几天。',
  },
  {
    id: 'en-coffee-date',
    title: 'A Quiet Café',
    russianTitle: 'Тихое кафе',
    titles: {
      ru: 'Тихое кафе',
      en: 'A Quiet Café',
      zh: '安静的咖啡馆',
    },
    language: 'en',
    level: 'beginner',
    levelLabel: 'CEFR A2',
    category: 'romance',
    categoryLabel: 'Romance',
    tags: ['cefr-a2', 'romance', 'dialogue'],
    isPublic: true,
    author: 'languageeee original',
    description: 'Английский драббл в кафе — Present Simple и повседневная лексика.',
    descriptions: {
      ru: 'Английский драббл в кафе — Present Simple и повседневная лексика.',
      en: 'An English café drabble — Present Simple and everyday vocabulary.',
      zh: '咖啡馆题材的英语短文——一般现在时与日常词汇。',
    },
    coverEmoji: '💌',
    coverTone: 'rose',
    targetHskLevel: 1,
    content:
      'Maya sits by the window and waits for Leo. She drinks warm tea and looks at the rain.\n\nLeo comes in, smiles, and sits down. "Sorry I am late," he says. "The bus was slow today."',
    russianTranslation:
      'Майя сидит у окна и ждёт Лео. Она пьёт тёплый чай и смотрит на дождь.\n\nЛео входит, улыбается и садится. «Извини, что опоздал,» — говорит он. «Автобус сегодня шёл медленно.»',
    translation_en:
      'Maya sits by the window and waits for Leo. She drinks warm tea and looks at the rain.\n\nLeo comes in, smiles, and sits down. "Sorry I am late," he says. "The bus was slow today."',
    translation_zh:
      '玛雅坐在窗边等着利奥。她喝着热茶，看着雨。\n\n利奥走进来，微笑着坐下。「抱歉我迟到了，」他说。「今天公交车很慢。」',
  },
  {
    id: 'en-train-adventure',
    title: 'Night Train North',
    russianTitle: 'Ночной поезд на север',
    titles: {
      ru: 'Ночной поезд на север',
      en: 'Night Train North',
      zh: '北上的夜班火车',
    },
    language: 'en',
    level: 'intermediate',
    levelLabel: 'CEFR B1',
    category: 'adventure',
    categoryLabel: 'Adventure',
    tags: ['cefr-b1', 'travel', 'narrative'],
    isPublic: true,
    author: 'languageeee original',
    description: 'Короткий английский драббл: ночной поезд, Past Simple / Continuous.',
    descriptions: {
      ru: 'Короткий английский драббл: ночной поезд, Past Simple / Continuous.',
      en: 'A short English drabble: a night train, Past Simple / Continuous.',
      zh: '英语短文：夜班火车，一般过去时 / 过去进行时。',
    },
    coverEmoji: '🚂',
    coverTone: 'teal',
    targetHskLevel: 3,
    content:
      'Alex packed a small bag and caught the night train. The carriage was quiet, and most passengers were already sleeping.\n\nOutside, dark forests slipped past the window. Alex took out a notebook and started writing about the trip.',
    russianTranslation:
      'Алекс собрал небольшую сумку и успел на ночной поезд. Вагон был тихим, и большинство пассажиров уже спали.\n\nСнаружи мимо окна проплывали тёмные леса. Алекс достал блокнот и начал писать о поездке.',
    translation_en:
      'Alex packed a small bag and caught the night train. The carriage was quiet, and most passengers were already sleeping.\n\nOutside, dark forests slipped past the window. Alex took out a notebook and started writing about the trip.',
    translation_zh:
      '亚历克斯收拾好一个小包，赶上了夜班火车。车厢很安静，大多数乘客已经睡着了。\n\n窗外，黑暗的森林从窗边掠过。亚历克斯拿出笔记本，开始写下这次旅途。',
  },
  {
    id: 'ru-park-walk',
    title: 'Прогулка в парке',
    russianTitle: 'Прогулка в парке',
    titles: {
      ru: 'Прогулка в парке',
      en: 'A Walk in the Park',
      zh: '公园散步',
    },
    language: 'ru',
    level: 'beginner',
    levelLabel: 'A1–A2',
    category: 'slice-of-life',
    categoryLabel: 'Slice of life',
    tags: ['russian', 'daily', 'beginner'],
    isPublic: true,
    author: 'languageeee original',
    description: 'Короткий русский рассказ: утро, парк и простой диалог.',
    descriptions: {
      ru: 'Короткий русский рассказ: утро, парк и простой диалог.',
      en: 'A short Russian story: morning, a park, and a simple dialogue.',
      zh: '俄语短文：早晨、公园和简单对话。',
    },
    coverEmoji: '🌳',
    coverTone: 'lime',
    chapterCount: 2,
    isComplete: true,
    targetHskLevel: 1,
    content:
      'Утром Анна вышла из дома и пошла в парк. Воздух был свежий, а небо — голубое.\n\nВ парке она встретила друга. «Привет! Как дела?» — спросил он. «Хорошо, спасибо. А у тебя?» — ответила Анна.',
    translation_en:
      'In the morning Anna left home and went to the park. The air was fresh and the sky was blue.\n\nIn the park she met a friend. "Hi! How are you?" he asked. "Good, thanks. And you?" Anna replied.',
    translation_zh:
      '早上，安娜出了家门，去了公园。空气清新，天空湛蓝。\n\n在公园里，她遇见了朋友。「你好！最近怎么样？」他问。「很好，谢谢。你呢？」安娜回答。',
  },
  {
    id: 'ru-letter-home',
    title: 'Письмо домой',
    russianTitle: 'Письмо домой',
    titles: {
      ru: 'Письмо домой',
      en: 'A Letter Home',
      zh: '家书',
    },
    language: 'ru',
    level: 'intermediate',
    levelLabel: 'A2–B1',
    category: 'original',
    categoryLabel: 'Original',
    tags: ['russian', 'letter', 'narrative'],
    isPublic: true,
    author: 'languageeee original',
    description: 'Небольшой фанфик-отрывок: письмо студентки домой из другого города.',
    descriptions: {
      ru: 'Небольшой фанфик-отрывок: письмо студентки домой из другого города.',
      en: 'A short fanfic excerpt: a student writes home from another city.',
      zh: '同人短文节选：学生从另一座城市给家里写信。',
    },
    coverEmoji: '✉️',
    coverTone: 'amber',
    chapterCount: 2,
    isComplete: true,
    targetHskLevel: 2,
    content:
      'Дорогая мама! Я уже две недели живу в новом городе. Университет большой, а общежитие — шумное, но друзья здесь добрые.\n\nВчера мы вместе готовили ужин. Я пекла пирог, а Катя варила суп. Было весело, и я почти не скучала по дому.',
    translation_en:
      'Dear Mom! I have already been living in a new city for two weeks. The university is big and the dorm is noisy, but the friends here are kind.\n\nYesterday we cooked dinner together. I baked a pie, and Katya made soup. It was fun, and I almost did not miss home.',
    translation_zh:
      '亲爱的妈妈！我已经在新城市住了两个星期。大学很大，宿舍很吵，但这里的朋友都很友善。\n\n昨天我们一起做了晚饭。我烤了馅饼，卡佳煮了汤。很开心，我几乎没有想家。',
  },
];

/** Подпись карточки: «Original / Native title» */
export function catalogCardTitle(
  story: Pick<CatalogStory, 'title' | 'russianTitle' | 'titles'>,
  lang: NativeLanguage = 'ru'
): string {
  const original = story.title?.trim() || '';
  const native =
    story.titles?.[lang]?.trim() ||
    (lang === 'ru' ? story.russianTitle?.trim() : '') ||
    '';
  if (!native || native === original) return original;
  if (!original) return native;
  return `${original} / ${native}`;
}

/** @deprecated используйте catalogLanguageLabel(language, nativeLanguage) из catalogI18n */
export function catalogLanguageLabel(language: LearningLanguage): string {
  return catalogLanguageLabelI18n(language, 'ru');
}

/** Локализованные фильтры уровня (зависят от nativeLanguage). */
export function getCatalogLevelOptions(lang: NativeLanguage = 'ru') {
  return catalogLevelOptions(lang);
}

/** Локализованные фильтры жанра. */
export function getCatalogCategoryOptions(lang: NativeLanguage = 'ru') {
  return catalogCategoryOptions(lang);
}

/** Локализованные фильтры языка текста. */
export function getCatalogLanguageOptions(lang: NativeLanguage = 'ru') {
  return catalogLanguageOptions(lang);
}

/** @deprecated — статичные RU-лейблы; используйте getCatalogLevelOptions(lang) */
export const CATALOG_LEVEL_OPTIONS: Array<{
  id: CatalogLevelId | 'all';
  label: string;
}> = catalogLevelOptions('ru');

/** @deprecated — статичные RU-лейблы; используйте getCatalogCategoryOptions(lang) */
export const CATALOG_CATEGORY_OPTIONS: Array<{
  id: CatalogCategoryId | 'all';
  label: string;
}> = catalogCategoryOptions('ru');

/** @deprecated — статичные RU-лейблы; используйте getCatalogLanguageOptions(lang) */
export const CATALOG_LANGUAGE_OPTIONS: Array<{
  id: LearningLanguage | 'all';
  label: string;
}> = catalogLanguageOptions('ru');

/** Уникальные id тегов каталога для фильтрации */
export function getCatalogTagOptions(): string[] {
  const set = new Set<string>();
  for (const story of CATALOG_STORIES) {
    for (const tag of story.tags ?? []) {
      if (tag.trim()) set.add(tag.trim());
    }
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b, 'en'));
}
