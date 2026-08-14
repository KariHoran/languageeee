/**
 * Production domain model — единый источник правды для стора и персистенции.
 */

/** Язык изучения / родной язык хаба */
export type AppLanguage = 'zh' | 'ru' | 'en';
export type LearningLanguage = AppLanguage;
export type NativeLanguage = AppLanguage;
export const DEFAULT_LEARNING_LANGUAGE: LearningLanguage = 'zh';
export const DEFAULT_NATIVE_LANGUAGE: NativeLanguage = 'ru';

/** Токен слова / грамматического фрагмента в абзаце */
export interface WordToken {
  id: string;
  hanzi: string;
  pinyin: string;
  translation: string;
  hskLevel: number;
  isGrammar: boolean;
  grammarRuleId: string;
}

/** Абзац с токенизацией и найденными грамматическими конструкциями */
export interface Paragraph {
  id: string;
  originalZh: string;
  textRu: string;
  tokens: WordToken[];
  isTranslationHidden?: boolean;
  grammarMatches: Array<{
    pattern: string;
    hskLevel: number;
    ruleId: string;
  }>;
}

/** Снимок HSK-статистики книги (уникальные слова). */
export interface BookHskStats {
  counts: Record<string, number>;
  percents: Record<string, number>;
  cumulativePercents?: Record<string, number>;
  totalUnique: number;
  recommendedHskLevel: number;
}

/** Книга / фанфик */
export interface Book {
  id: string;
  title: string;
  coverColor?: string;
  /** Язык изучаемого текста: сейчас zh, позже en и др. */
  language?: LearningLanguage;
  originalZhText: string;
  russianText?: string;
  collectionId?: string;
  targetHskLevel: number;
  createdAt: number;
  lastReadAt: number;
  isParsed: boolean;
  parsedParagraphs?: Paragraph[];
  /** Распределение уникальных слов по HSK + рекомендуемый уровень. */
  hskStats?: BookHskStats;
  /** Примерное время чтения в минутах. */
  readingTime?: number;
}

/** Подборка */
export interface Collection {
  id: string;
  name: string;
  color: string;
  createdAt: number;
  wordIds: string[];
  bookIds: string[];
}

/** Карточка интервального повторения (SRS) */
export interface Flashcard {
  /** Идентификатор = иероглиф (hanzi) */
  id: string;
  hanzi: string;
  pinyin: string;
  translation: string;
  hskLevel: number;
  language?: LearningLanguage;
  /** Цитата из фанфика, где встретилось слово */
  contextSentence?: string;
  sourceTitle?: string;
  interval: number;
  repetition: number;
  easeFactor: number;
  nextReviewDate: number;
  createdAt: number;
}

/** Облачный профиль пользователя */
export interface UserProfile {
  email: string | null;
  learningLanguage: LearningLanguage;
  streak: number;
  lastActiveDate: string | null;
  /** Локальный сид / init аккаунта завершён */
  onboardingCompleted: boolean;
  /**
   * UI Welcome/тур пройден.
   * Синхронизируется между устройствами — тур не показывают повторно.
   */
  hasCompletedOnboarding: boolean;
  createdAt: number;
  lastSync: number;
}
