import zhRuDictJson from '../data/zh_ru_dict.json';
import { intlWordTokens, isGrammaticalPronounGlue } from './chineseTokenizer';

/**
 * Локальный китайско-русский словарь (БКРС-глоссы в zh_ru_dict.json).
 * Без сети: нет записи → UI показывает только иероглиф / пиньинь / HSK.
 */
const BKRS_DICT: Record<string, string> = zhRuDictJson as Record<string, string>;

/** Русский перевод из БКРС по точному ключу (иероглифы). */
export function lookupBkrs(hanzi: string): string | undefined {
  if (!hanzi) return undefined;
  const gloss = BKRS_DICT[hanzi]?.trim();
  return gloss || undefined;
}

/** Есть ли слово в локальном БКРС. */
export function hasBkrsEntry(hanzi: string): boolean {
  return Boolean(lookupBkrs(hanzi));
}

export function getBkrsDictSize(): number {
  return Object.keys(BKRS_DICT).length;
}

/** Все ключи БКРС (для частотной нормализации HSK). */
export function getBkrsKeys(): string[] {
  return Object.keys(BKRS_DICT);
}

/**
 * Режет строку на слова через segmentChineseText (pinyin-pro + лексикон).
 * OOV 2–4 иероглифа (например 闷闷不乐) не пилятся на одиночные знаки
 * только из‑за отсутствия в мини‑БКРС — остаются единым токеном.
 * Расклеиваем лишь явные склейки «местоимение + X».
 */
export function splitByBkrs(
  hanzi: string,
  extraLexicon?: { has: (key: string) => boolean }
): string[] {
  if (!hanzi) return [];

  const isLexeme = (key: string) =>
    hasBkrsEntry(key) || Boolean(extraLexicon?.has(key));

  if (isLexeme(hanzi)) return [hanzi];

  const chars = [...hanzi];
  if (
    chars.length >= 2 &&
    chars.length <= 4 &&
    /^[\u4e00-\u9fff]+$/.test(hanzi) &&
    !isGrammaticalPronounGlue(hanzi, isLexeme)
  ) {
    return [hanzi];
  }

  return intlWordTokens(hanzi, { isLexeme });
}
