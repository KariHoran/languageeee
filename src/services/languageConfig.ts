import type {
  AppLanguage,
  LearningLanguage,
  NativeLanguage,
} from '../types';
import {
  DEFAULT_LEARNING_LANGUAGE,
  DEFAULT_NATIVE_LANGUAGE,
} from '../types';

/** Коды для gtx / MyMemory */
export type TranslateApiCode = 'zh-CN' | 'ru' | 'en';

export interface ResolvedLangPair {
  from: AppLanguage;
  to: AppLanguage;
  sl: TranslateApiCode;
  tl: TranslateApiCode;
  /** MyMemory langpair, напр. ru|zh-CN */
  mymemory: string;
  /** Ключ кэша, напр. ru->zh-CN */
  cacheDirection: string;
}

const API_CODE: Record<AppLanguage, TranslateApiCode> = {
  zh: 'zh-CN',
  ru: 'ru',
  en: 'en',
};

export function isAppLanguage(value: unknown): value is AppLanguage {
  return value === 'zh' || value === 'ru' || value === 'en';
}

export function normalizeLearningLanguage(
  value: unknown,
  fallback: LearningLanguage = DEFAULT_LEARNING_LANGUAGE
): LearningLanguage {
  return isAppLanguage(value) ? value : fallback;
}

export function normalizeNativeLanguage(
  value: unknown,
  fallback: NativeLanguage = DEFAULT_NATIVE_LANGUAGE
): NativeLanguage {
  return isAppLanguage(value) ? value : fallback;
}

/**
 * Если learning === native — для API-перевода подбираем другой язык глоссы.
 * UI-выбор nativeLanguage этим НЕ ограничивается.
 */
export function glossTargetForApi(
  learning: LearningLanguage,
  native: NativeLanguage
): NativeLanguage {
  if (learning !== native) return native;
  if (learning === 'zh') return 'ru';
  if (learning === 'ru') return 'zh';
  return 'ru';
}

/** @deprecated alias — не использовать для UI-ограничений */
export function ensureDistinctNative(
  learning: LearningLanguage,
  native: NativeLanguage
): NativeLanguage {
  return glossTargetForApi(learning, native);
}

export function toApiLang(lang: AppLanguage): TranslateApiCode {
  return API_CODE[lang];
}

export function resolveLangPair(
  from: AppLanguage,
  to: AppLanguage
): ResolvedLangPair {
  const sl = toApiLang(from);
  const tl = toApiLang(to);
  return {
    from,
    to,
    sl,
    tl,
    mymemory: `${sl}|${tl}`,
    cacheDirection: `${sl}->${tl}`,
  };
}

/** Пара перевода: изучаемый → родной (как выбрано в UI). */
export function learningToNativePair(
  learning: LearningLanguage,
  native: NativeLanguage
): ResolvedLangPair {
  return resolveLangPair(learning, native);
}

/** Короткий ярлык направления для UI */
export function directionLabel(
  learning: LearningLanguage,
  native: NativeLanguage
): string {
  const labels: Record<AppLanguage, string> = {
    zh: '中文',
    ru: 'Русский',
    en: 'English',
  };
  return `${labels[learning]} → ${labels[native]}`;
}

/** Locale для Intl.Segmenter */
export function segmenterLocale(lang: AppLanguage): string {
  if (lang === 'zh') return 'zh-CN';
  if (lang === 'ru') return 'ru';
  return 'en';
}

/** TTS BCP-47 */
export function ttsLocale(lang: AppLanguage): 'zh-CN' | 'en-US' | 'ru-RU' {
  if (lang === 'zh') return 'zh-CN';
  if (lang === 'ru') return 'ru-RU';
  return 'en-US';
}
