import type { GrammarPoint } from '../types';
import { detectEnglishGrammarPoints } from './englishGrammarService';
import {
  translateEnToRu,
  isTranslationFailureText,
  type TranslateProgressCallback,
} from './translationService';

/**
 * Локальный разбор английского текста: токены-слова + En→Ru перевод абзацев
 * + грамматические конструкции / времена / фразовые глаголы.
 * Пиньинь / HSK / OpenCC сюда не вызываются.
 */

export interface EnglishAnalyzedWord {
  text: string;
  /** Нижний регистр-ключ для дедупа */
  key: string;
}

export interface EnglishAnalysisResult {
  words: EnglishAnalyzedWord[];
  /** Уникальные слова (A–Z) */
  uniqueCount: number;
  /** Всего буквенных токенов */
  tokenCount: number;
  /** Параллельный русский перевод всего текста (по абзацам) */
  russianText: string;
  translationOk: boolean;
  translationError?: string;
  /** Найденные конструкции (времена, phrasals и т.п.) */
  grammar: GrammarPoint[];
}

/** Проверяет, похож ли текст на английский (латиница преобладает). */
export function isLikelyEnglish(text: string): boolean {
  const letters = (text.match(/[A-Za-z]/g) ?? []).length;
  const cyrillic = (text.match(/[\u0400-\u04FF]/g) ?? []).length;
  const chinese = (text.match(/[\u4e00-\u9fff]/g) ?? []).length;
  return letters > 0 && letters >= cyrillic && letters >= chinese;
}

/**
 * Простой word-split: буквенные токены + сохранение порядка первых вхождений.
 * Синхронно, без сети и без пиньиня.
 */
export function analyzeEnglishText(text: string): EnglishAnalysisResult {
  const trimmed = text.trim();
  if (!trimmed) {
    return {
      words: [],
      uniqueCount: 0,
      tokenCount: 0,
      russianText: '',
      translationOk: true,
      grammar: [],
    };
  }

  const re = /[A-Za-z][A-Za-z0-9'-]*/g;
  const seen = new Set<string>();
  const words: EnglishAnalyzedWord[] = [];
  let tokenCount = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(trimmed)) !== null) {
    tokenCount += 1;
    const surface = m[0];
    const key = surface.toLowerCase();
    if (seen.has(key)) continue;
    if (surface.length === 1 && !/^[Ia]$/.test(surface)) continue;
    seen.add(key);
    words.push({ text: surface, key });
  }

  return {
    words,
    uniqueCount: words.length,
    tokenCount,
    russianText: '',
    translationOk: true,
    grammar: detectEnglishGrammarPoints(trimmed),
  };
}

/**
 * Разбор слов + перевод En→Ru.
 * При сбое API всё равно возвращает токены; russianText может быть пустым / с маркером.
 */
export async function analyzeAndTranslateEnglish(
  text: string,
  onProgress?: TranslateProgressCallback
): Promise<EnglishAnalysisResult> {
  const base = analyzeEnglishText(text);
  const trimmed = text.trim();
  if (!trimmed) return base;

  onProgress?.({
    current: 0,
    total: 1,
    label: 'Переводим En→Ru…',
  });

  try {
    console.log('[englishAnalysis] En→Ru start, chars=', trimmed.length);
    const russianText = await translateEnToRu(trimmed, onProgress);
    const cleaned = russianText.trim();
    const failed = !cleaned || isTranslationFailureText(cleaned);

    if (failed) {
      console.warn('[englishAnalysis] En→Ru partial/failed:', cleaned.slice(0, 120));
      return {
        ...base,
        russianText: '',
        translationOk: false,
        translationError:
          'Не удалось полностью перевести на русский. Можно сохранить текст и перевести позже.',
      };
    }

    console.log('[englishAnalysis] En→Ru ok, chars=', russianText.length);
    return {
      ...base,
      russianText: russianText.trim(),
      translationOk: true,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[englishAnalysis] En→Ru error:', err);
    return {
      ...base,
      russianText: '',
      translationOk: false,
      translationError: message,
    };
  }
}
