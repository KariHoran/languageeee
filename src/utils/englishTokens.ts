import {
  englishGrammarClassAt,
  findEnglishGrammarMatches,
} from '../services/englishGrammarService';
import { segmenterLocale } from '../services/languageConfig';
import type { LearningLanguage, Word } from '../types';
import { transliterateRussian } from './ruTransliterate';

export interface ReaderToken {
  text: string;
  /** Пиньинь (zh) / транслит (ru) / фонетика (en) */
  pinyin?: string;
  grammarClass?: string;
  /** Кликабельный токен изучаемого языка */
  isWord: boolean;
  word?: Word;
}

function segmentWordsIntl(
  text: string,
  locale: string
): Array<{ segment: string; isWordLike: boolean }> {
  try {
    const Seg = (Intl as typeof Intl & { Segmenter?: typeof Intl.Segmenter })
      .Segmenter;
    if (typeof Seg === 'function') {
      const segmenter = new Seg(locale, { granularity: 'word' });
      return [...segmenter.segment(text)].map((s) => ({
        segment: s.segment,
        isWordLike: Boolean(s.isWordLike),
      }));
    }
  } catch {
    /* fallback below */
  }
  return [];
}

/**
 * Токенизация английского: Intl.Segmenter('en') + словарь фраз,
 * иначе — слово / пробел / пунктуация. Подсветка времён / фразовых глаголов.
 */
export function buildEnglishTokens(
  text: string,
  words: Word[]
): ReaderToken[] {
  const sorted = [...words].sort((a, b) => b.hanzi.length - a.hanzi.length);
  const grammarMatches = findEnglishGrammarMatches(text);
  const intl = segmentWordsIntl(text, segmenterLocale('en'));

  if (intl.length > 0) {
    const tokens: ReaderToken[] = [];
    let pos = 0;
    for (const { segment: surface, isWordLike } of intl) {
      if (!surface) continue;
      if (!isWordLike || !/[A-Za-z]/.test(surface)) {
        tokens.push({ text: surface, isWord: false });
        pos += surface.length;
        continue;
      }

      let matched: Word | undefined;
      for (const w of sorted) {
        if (!w.hanzi) continue;
        if (surface.toLowerCase() === w.hanzi.toLowerCase()) {
          matched = w;
          break;
        }
        if (
          text
            .slice(pos, pos + w.hanzi.length)
            .toLowerCase() === w.hanzi.toLowerCase()
        ) {
          matched = w;
          break;
        }
      }

      const word: Word = matched ?? {
        id: `en-${pos}-${surface.toLowerCase()}`,
        hanzi: surface,
        pinyin: '',
        translation: '',
        status: 'new',
      };

      tokens.push({
        text: matched ? text.slice(pos, pos + matched.hanzi.length) : surface,
        pinyin: word.pinyin || undefined,
        grammarClass: englishGrammarClassAt(grammarMatches, pos),
        isWord: true,
        word,
      });
      pos += matched ? matched.hanzi.length : surface.length;
    }
    return tokens;
  }

  // Fallback без Segmenter
  const tokens: ReaderToken[] = [];
  let i = 0;
  while (i < text.length) {
    const ch = text[i]!;
    if (/\s/.test(ch)) {
      tokens.push({ text: ch, isWord: false });
      i += 1;
      continue;
    }

    let matched: Word | undefined;
    for (const w of sorted) {
      if (!w.hanzi) continue;
      if (
        text.slice(i, i + w.hanzi.length).toLowerCase() ===
        w.hanzi.toLowerCase()
      ) {
        const after = text[i + w.hanzi.length];
        if (
          after &&
          /[A-Za-z0-9']/.test(after) &&
          /[A-Za-z0-9']/.test(w.hanzi.slice(-1))
        ) {
          continue;
        }
        matched = w;
        break;
      }
    }

    if (matched) {
      tokens.push({
        text: text.slice(i, i + matched.hanzi.length),
        pinyin: matched.pinyin || undefined,
        grammarClass: englishGrammarClassAt(grammarMatches, i),
        isWord: true,
        word: matched,
      });
      i += matched.hanzi.length;
      continue;
    }

    if (/[A-Za-z]/.test(ch)) {
      let j = i + 1;
      while (j < text.length && /[A-Za-z0-9'-]/.test(text[j]!)) j += 1;
      const surface = text.slice(i, j);
      tokens.push({
        text: surface,
        grammarClass: englishGrammarClassAt(grammarMatches, i),
        isWord: true,
        word: {
          id: `en-${i}-${surface.toLowerCase()}`,
          hanzi: surface,
          pinyin: '',
          translation: '',
          status: 'new',
        },
      });
      i = j;
      continue;
    }

    tokens.push({ text: ch, isWord: false });
    i += 1;
  }
  return tokens;
}

/**
 * Токенизация русского: Intl.Segmenter('ru') → кликабельные слова.
 * На месте пиньиня — транслитерация (розовый стиль в ридере).
 */
export function buildRussianTokens(
  text: string,
  opts?: { withTranslit?: boolean; words?: Word[] }
): ReaderToken[] {
  const withTranslit = opts?.withTranslit ?? true;
  const known = new Map(
    (opts?.words ?? [])
      .filter((w) => w.hanzi)
      .map((w) => [w.hanzi.toLowerCase(), w] as const)
  );

  const intl = segmentWordsIntl(text, segmenterLocale('ru'));
  if (intl.length > 0) {
    const tokens: ReaderToken[] = [];
    let pos = 0;
    for (const { segment: surface, isWordLike } of intl) {
      if (!surface) continue;
      const isRuWord =
        isWordLike && /[А-Яа-яЁё]/.test(surface);
      if (!isRuWord) {
        tokens.push({ text: surface, isWord: false });
        pos += surface.length;
        continue;
      }
      const existing = known.get(surface.toLowerCase());
      const translit =
        existing?.pinyin?.trim() ||
        (withTranslit ? transliterateRussian(surface) : '');
      tokens.push({
        text: surface,
        pinyin: translit || undefined,
        isWord: true,
        word: existing ?? {
          id: `ru-${pos}-${surface.toLowerCase()}`,
          hanzi: surface,
          pinyin: translit,
          translation: '',
          status: 'new',
        },
      });
      pos += surface.length;
    }
    return tokens;
  }

  // Fallback regex
  const tokens: ReaderToken[] = [];
  const re = /[А-Яа-яЁё0-9]+(?:[-'][А-Яа-яЁё0-9]+)*/g;
  let cursor = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const start = m.index;
    if (start > cursor) {
      tokens.push({ text: text.slice(cursor, start), isWord: false });
    }
    const surface = m[0]!;
    const existing = known.get(surface.toLowerCase());
    const translit =
      existing?.pinyin?.trim() ||
      (withTranslit ? transliterateRussian(surface) : '');
    tokens.push({
      text: surface,
      pinyin: translit || undefined,
      isWord: true,
      word: existing ?? {
        id: `ru-${start}-${surface.toLowerCase()}`,
        hanzi: surface,
        pinyin: translit,
        translation: '',
        status: 'new',
      },
    });
    cursor = start + surface.length;
  }
  if (cursor < text.length) {
    tokens.push({ text: text.slice(cursor), isWord: false });
  }
  return tokens;
}

/** Универсальная токенизация по языку изучения. */
export function buildTokensForLanguage(
  language: LearningLanguage,
  text: string,
  words: Word[],
  opts?: { withHints?: boolean }
): ReaderToken[] {
  if (language === 'en') return buildEnglishTokens(text, words);
  if (language === 'ru') {
    return buildRussianTokens(text, {
      withTranslit: opts?.withHints ?? true,
      words,
    });
  }
  return [];
}
