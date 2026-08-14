import type { NativeLanguage, Paragraph } from '../types';
import { getCachedTranslationSync } from './translationCache';
import { translateRuToEn, translateRuToZh } from './translationService';

/** Направления кэша, совпадающие с translateParagraphResilient. */
const RU_TO_NATIVE_DIRECTION: Record<'en' | 'zh', string> = {
  en: 'ru->en',
  zh: 'ru->zh-CN',
};

/**
 * Синхронный перевод абзаца на nativeLanguage (статика книги или memory-кэш).
 * Для en/zh без готового текста возвращает null — нужен async resolve.
 */
export function getParagraphNativeTranslationSync(
  paragraph: Pick<Paragraph, 'russianTranslation' | 'translations'>,
  nativeLanguage: NativeLanguage
): string | null {
  if (nativeLanguage === 'ru') {
    const ru = paragraph.russianTranslation?.trim() ?? '';
    return ru || null;
  }

  const staticNative = paragraph.translations?.[nativeLanguage]?.trim();
  if (staticNative) return staticNative;

  const ru = paragraph.russianTranslation?.trim() ?? '';
  if (!ru) return null;

  const direction = RU_TO_NATIVE_DIRECTION[nativeLanguage];
  return getCachedTranslationSync(ru, direction);
}

/**
 * Перевод абзаца на родной язык пользователя.
 * Источник истины для демо — russianTranslation + translations.en/zh;
 * если en/zh нет в данных — Ru→En / Ru→Zh через translationService (с кэшем).
 * Для en/zh при ошибке НЕ возвращаем русский текст.
 */
export async function resolveParagraphNativeTranslation(
  paragraph: Pick<Paragraph, 'russianTranslation' | 'translations'>,
  nativeLanguage: NativeLanguage
): Promise<string> {
  if (nativeLanguage === 'ru') {
    return paragraph.russianTranslation?.trim() ?? '';
  }

  const staticNative = paragraph.translations?.[nativeLanguage]?.trim();
  if (staticNative) return staticNative;

  const ru = paragraph.russianTranslation?.trim() ?? '';
  if (!ru) return '';

  try {
    const translated =
      nativeLanguage === 'zh'
        ? await translateRuToZh(ru)
        : await translateRuToEn(ru);
    return translated.trim();
  } catch (err) {
    console.warn('[nativeTranslation] paragraph translate failed:', err);
    return '';
  }
}

/**
 * Синхронный peek объяснения грамматики (RU или кэш).
 */
export function getGrammarExplanationSync(
  explanationRu: string,
  nativeLanguage: NativeLanguage
): string | null {
  const trimmed = explanationRu.trim();
  if (!trimmed) return null;
  if (nativeLanguage === 'ru') return trimmed;

  const direction = RU_TO_NATIVE_DIRECTION[nativeLanguage];
  return getCachedTranslationSync(trimmed, direction);
}

/**
 * Объяснение грамматического правила на nativeLanguage.
 * Русский текст переводится через translateRuToZh / translateRuToEn и кэшируется.
 */
export async function resolveGrammarExplanation(
  explanationRu: string,
  nativeLanguage: NativeLanguage
): Promise<string> {
  const trimmed = explanationRu.trim();
  if (!trimmed) return '';
  if (nativeLanguage === 'ru') return trimmed;

  try {
    const translated =
      nativeLanguage === 'zh'
        ? await translateRuToZh(trimmed)
        : await translateRuToEn(trimmed);
    return translated.trim();
  } catch (err) {
    console.warn('[nativeTranslation] grammar translate failed:', err);
    return '';
  }
}
