/** Язык изучения / родной язык хаба */
export type AppLanguage = 'zh' | 'ru' | 'en';
export type LearningLanguage = AppLanguage;
export type NativeLanguage = AppLanguage;

export const DEFAULT_LEARNING_LANGUAGE: LearningLanguage = 'zh';
export const DEFAULT_NATIVE_LANGUAGE: NativeLanguage = 'ru';

/** Подписи для UI выбора языка изучения */
export const LEARNING_LANGUAGE_OPTIONS: Array<{
  id: LearningLanguage;
  label: string;
  shortLabel: string;
  emoji: string;
  ready: boolean;
}> = [
  { id: 'zh', label: '中文 · Китайский', shortLabel: '中文', emoji: '🇨🇳', ready: true },
  { id: 'ru', label: 'Русский', shortLabel: 'RU', emoji: '🇷🇺', ready: true },
  { id: 'en', label: 'English · Английский', shortLabel: 'EN', emoji: '🇬🇧', ready: true },
];

/** Родной язык (язык глосс / UI-перевода) */
export const NATIVE_LANGUAGE_OPTIONS: Array<{
  id: NativeLanguage;
  label: string;
  shortLabel: string;
}> = [
  { id: 'ru', label: 'Русский', shortLabel: 'RU' },
  { id: 'zh', label: '中文', shortLabel: '中文' },
  { id: 'en', label: 'English', shortLabel: 'EN' },
];

/** Статус изучения слова в словарике */
export type WordStatus = 'new' | 'learning' | 'known';

/** Целевой уровень HSK при генерации текста (классическая шкала 1–6) */
export type TargetHskLevel = 1 | 2 | 3 | 4 | 5 | 6;

/**
 * Слово изучаемого языка с переводом на русский.
 * Поле `hanzi` — поверхностная форма (иероглифы или английское слово/фраза).
 * `pinyin` — транскрипция (для zh) или фонетическая подсказка (для en, опционально).
 */
export interface Word {
  id: string;
  hanzi: string;
  pinyin: string;
  /** Перевод слова на русский язык */
  translation: string;
  status: WordStatus;
  /** Уровень слова по новой системе HSK 3.0 (1–9), только для zh */
  hskLevel?: number;
}

/** Грамматическая конструкция с объяснением на русском */
export interface GrammarPoint {
  structure: string;
  explanation: string;
  example: string;
  /** Уровень HSK конструкции, если известен */
  hskLevel?: number;
}

/** Абзац адаптированного текста с параллельными переводами */
export interface Paragraph {
  originalText: string;
  chineseText: string;
  englishText: string;
  /** Параллельный перевод на русский (legacy / источник для Ru→En/Zh) */
  russianTranslation: string;
  /**
   * Параллельные переводы на другие родные языки (en / zh).
   * Если нет — ридер переводит `russianTranslation` через translationService.
   */
  translations?: Partial<Record<'en' | 'zh', string>>;
  words: Word[];
  grammar: GrammarPoint[];
}

/** Подборка (коллекция) фанфиков */
export interface Collection {
  id: string;
  /** Название подборки, напр. «Фэнтези», «Гарри Поттер» */
  title: string;
  description?: string;
  /** Цвет карточки подборки */
  color?: string;
  /**
   * Firebase uid владельца или `'guest'` для гостевого режима.
   * Обязателен при сохранении. В Firestore дублируется как `userId` для RBAC.
   */
  ownerUserId?: string;
  /**
   * Alias владельца для Security Rules: `auth.uid === resource.data.userId`.
   * Обычно совпадает с ownerUserId (не guest).
   */
  userId?: string;
  /**
   * Автор-владелец (RBAC): `auth.currentUser.uid === collection.authorId`.
   * Совпадает с userId / ownerUserId для облачных пользователей.
   */
  authorId?: string;
  /** Публичная подборка — доступна по share-ссылке */
  isPublic?: boolean;
  /** Уникальный slug публичной ссылки `/c/{shareSlug}` */
  shareSlug?: string | null;
  /** Когда подборка была опубликована */
  publishedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

/** Публичный снимок подборки (Firestore `publicCollections/{slug}`) */
export interface PublicCollectionDoc {
  slug: string;
  collectionId: string;
  /** Владелец — для RBAC write */
  userId: string;
  ownerUserId: string;
  /** Alias владельца: auth.uid === authorId */
  authorId?: string;
  title: string;
  description?: string | null;
  color?: string | null;
  isPublic: true;
  books: PublicCollectionBookSummary[];
  publishedAt: string;
  updatedAt: string;
}

export interface PublicCollectionBookSummary {
  id: string;
  title: string;
  russianTitle?: string;
  language: LearningLanguage;
  targetHskLevel: number;
  /** Короткий превью-текст (первый абзац) */
  excerpt?: string;
}

/** Книга / фанфик с абзацами */
export interface Book {
  id: string;
  /**
   * Оригинальное название на языке изучаемого текста
   * (中文 для zh, English для en).
   */
  title: string;
  /** Русский перевод названия — как у карточек каталога */
  russianTitle?: string;
  /**
   * Firebase uid владельца или `'guest'` для гостевого режима.
   * Обязателен при сохранении.
   */
  ownerUserId?: string;
  /**
   * Alias владельца для Security Rules: `auth.uid === resource.data.userId`.
   * Совпадает с ownerUserId для облачных пользователей.
   */
  userId?: string;
  /** Alias автора (RBAC): обычно = userId */
  authorId?: string;
  /** ID подборки, к которой принадлежит фанфик */
  collectionId?: string;
  /**
   * Язык изучаемого текста: 'zh' | 'en'.
   */
  language?: LearningLanguage;
  /** ID истории из публичного каталога (если книга добавлена из Explore) */
  catalogId?: string;
  /** Выбранный целевой уровень HSK при генерации (1–6) */
  targetHskLevel: number;
  createdAt: string;
  paragraphs: Paragraph[];
  /** Исходный текст до обработки ИИ */
  sourceText?: string;
  /**
   * Оригинальный русский текст, если пользователь загружал параллельный перевод
   * (до перевода Ru→Zh). Имеет приоритет над автопереводом в ридере.
   */
  originalRussianText?: string;
  updatedAt?: string;
}

/** Ответ одного абзаца от OpenAI */
export interface AIParagraphResponse {
  chineseText: string;
  englishText: string;
  russianTranslation: string;
  words: Array<{
    hanzi: string;
    pinyin: string;
    translation: string;
    /** Уровень слова по HSK 3.0 (1–9) */
    hskLevel: number;
  }>;
  grammar: GrammarPoint[];
}

/** Полный ответ от OpenAI при обработке текста */
export interface AIProcessResponse {
  paragraphs: AIParagraphResponse[];
}

/** Маршруты навигации приложения */
export type AppScreen =
  | { name: 'home' }
  | {
      name: 'addBook';
      collectionId?: string;
      draftText?: string;
      draftTitle?: string;
    }
  | { name: 'reader'; bookId: string }
  | { name: 'flashcards' }
  | { name: 'catalog' }
  | { name: 'myLibrary' }
  | { name: 'collectionDetail'; collectionId: string };

/** Уровень сложности в публичном каталоге */
export type CatalogLevelId = 'beginner' | 'intermediate' | 'advanced';

/** Жанр / категория каталога */
export type CatalogCategoryId =
  | 'fantasy'
  | 'romance'
  | 'slice-of-life'
  | 'adventure'
  | 'harry-potter'
  | 'school'
  | 'original';

/** Карточка истории в публичной библиотеке */
export interface CatalogStory {
  id: string;
  /**
   * Оригинальное название на языке изучаемого текста
   * (中文 для zh, English для en).
   */
  title: string;
  /**
   * Русский перевод названия (legacy / fallback для `titles.ru`).
   * В UI предпочитайте `titles` + `catalogStoryNativeTitle`.
   */
  russianTitle: string;
  /**
   * Локализованные названия для карточки по `nativeLanguage`
   * (оригинал остаётся в `title`).
   */
  titles?: Partial<Record<NativeLanguage, string>>;
  language: LearningLanguage;
  /** Общий уровень: beginner / intermediate / advanced */
  level: CatalogLevelId;
  /** Каноническая подпись уровня (HSK 2, CEFR A2, …); UI через catalogStoryLevelLabel */
  levelLabel: string;
  category: CatalogCategoryId;
  /** @deprecated UI: catalogCategoryLabel(category, lang) */
  categoryLabel: string;
  /** 2–3 тега категорий для карточки */
  tags: string[];
  /** Публичная книга каталога (мок / будущий Firestore) */
  isPublic: boolean;
  author: string;
  /**
   * Короткое описание (legacy / fallback для `descriptions.ru`).
   * В UI предпочитайте `descriptions` + `catalogStoryDescription`.
   */
  description: string;
  /** Локализованные описания карточки по `nativeLanguage` */
  descriptions?: Partial<Record<NativeLanguage, string>>;
  /** Эмодзи-обложка */
  coverEmoji: string;
  /** Акцент обложки для градиента */
  coverTone: 'sky' | 'rose' | 'lime' | 'amber' | 'violet' | 'teal';
  /** Текст изучаемого языка (абзацы через пустую строку) */
  content: string;
  /** Параллельный русский перевод (абзацы через пустую строку) */
  russianTranslation?: string;
  /**
   * Параллельные переводы для nativeLanguage en/zh
   * (те же абзацы, что `content` / `russianTranslation`).
   * Алиасы в демо-данных: translation_en / translation_zh.
   */
  translation_en?: string;
  translation_zh?: string;
  /** Целевой HSK для пайплайна анализа */
  targetHskLevel: TargetHskLevel;
  /** Явное число глав (иначе считается из `content`) */
  chapterCount?: number;
  /** Завершена ли история (для бейджа на карточке) */
  isComplete?: boolean;
}

/** Карточка интервального повторения (SRS) */
export interface Flashcard {
  /** Идентификатор = иероглиф / en:слово */
  id: string;
  hanzi: string;
  pinyin: string;
  translation: string;
  hskLevel?: number;
  /** Язык изучаемого слова (по умолчанию zh) */
  language?: LearningLanguage;
  /** Цитата из фанфика, где встретилось слово */
  contextSentence?: string;
  /** Название книги-источника */
  sourceTitle?: string;
  /** ID книги-источника (для фильтра SRS) */
  sourceBookId?: string;
  /** Интервал до следующего повторения в днях */
  interval: number;
  /** Сколько раз подряд успешно ответили */
  repetition: number;
  /** Коэффициент лёгкости SM-2 (по умолчанию 2.5) */
  easeFactor: number;
  /** ISO-дата следующего повторения */
  nextReviewDate: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Оценка ответа в сессии SRS.
 * Legacy: `forgot` ≈ again, `remembered` ≈ good.
 */
export type FlashcardGrade =
  | 'again'
  | 'hard'
  | 'good'
  | 'easy'
  | 'forgot'
  | 'remembered';

/** Статус карточки для очереди / UI */
export type FlashcardSrsStatus = 'new' | 'learning' | 'learned';

/** Слово, сохранённое в одну или несколько подборок */
export interface CollectionWord {
  /** Ключ = иероглиф */
  id: string;
  hanzi: string;
  pinyin: string;
  translation: string;
  hskLevel?: number;
  /** ID подборок, в которые добавлено слово */
  collectionIds: string[];
  createdAt: string;
  updatedAt: string;
}

/** Запись в локальном словаре HSK 3.0 */
export interface HskDictEntry {
  hanzi: string;
  level: number;
  pinyin: string;
}

/** Результат анализа одного токена текста */
export interface AnalyzedWord {
  /** Текст токена (иероглифы или знак препинания) */
  text: string;
  hanzi?: string;
  pinyin?: string;
  /** Перевод на русский (если уже известен) */
  translation?: string;
  /** Уровень HSK 3.0 (1–9), если слово найдено в словаре */
  level?: number;
  /** Сложнее ли слово, чем выбранный целевой уровень */
  isAboveTarget: boolean;
  /** Является ли токен китайским словом/иероглифом */
  isChinese: boolean;
}

/** Результат локального анализа текста */
export interface HskAnalysisResult {
  targetLevel: number;
  words: AnalyzedWord[];
  aboveTargetCount: number;
  knownCount: number;
  /** Найденные грамматические конструкции HSK */
  grammar: GrammarPoint[];
}
