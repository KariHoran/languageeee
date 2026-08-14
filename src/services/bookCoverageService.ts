import type { Book, Flashcard, LearningLanguage } from '../types';
import type { WordToken } from '../types/domain';
import { getFlashcards } from './flashcardsStore';
import {
  calculateHskStats,
  type HskStatsResult,
} from './textAnalyzerService';

/** Частотные короткие EN-слова → «базовый» уровень */
const COMMON_EN = new Set(
  `
the be to of and a in that have i it for not on with he as you do at this but his by
from they we say her she or an will my one all would there their what so up out if about
who get which go me when make can like time no just him know take people into year your
good some could them see other than then now look only come its over think also back after
use two how our work first well way even new want because any these give day most us
`.split(/\s+/).filter(Boolean)
);

export type EnDifficultyKey = 'easy' | 'medium' | 'hard';

export interface EnCoverageStats {
  counts: Record<EnDifficultyKey, number>;
  percents: Record<EnDifficultyKey, number>;
  totalUnique: number;
}

export interface BookCoverage {
  language: LearningLanguage;
  totalParagraphs: number;
  totalUniqueWords: number;
  /** % уникальных слов книги, уже в колоде карточек */
  knownPercent: number;
  knownCount: number;
  /** HSK (zh) */
  hsk?: HskStatsResult;
  /** EN difficulty proxy */
  en?: EnCoverageStats;
  recommendedLabel: string;
}

function paragraphWords(book: Book): string[] {
  const out: string[] = [];
  for (const p of book.paragraphs) {
    for (const w of p.words ?? []) {
      const s = w.hanzi?.trim();
      if (s) out.push(s);
    }
  }
  return out;
}

function toWordTokens(book: Book): WordToken[] {
  return book.paragraphs.flatMap((p, pi) =>
    (p.words ?? [])
      .filter((w) => w.hanzi?.trim())
      .map((w, wi) => ({
        id: w.id || `tok-${pi}-${wi}`,
        hanzi: w.hanzi.trim(),
        pinyin: w.pinyin ?? '',
        translation: w.translation ?? '',
        hskLevel: w.hskLevel ?? 0,
        isGrammar: false,
        grammarRuleId: '',
      }))
  );
}

function classifyEn(word: string): EnDifficultyKey {
  const key = word.toLowerCase();
  if (COMMON_EN.has(key) || key.length <= 4) return 'easy';
  if (key.length <= 7) return 'medium';
  return 'hard';
}

export function computeEnCoverage(book: Book): EnCoverageStats {
  const unique = new Map<string, EnDifficultyKey>();
  for (const w of paragraphWords(book)) {
    const key = w.toLowerCase();
    if (!/^[a-z][a-z0-9'-]*$/i.test(w)) continue;
    if (w.length === 1 && !/^[Ia]$/.test(w)) continue;
    const bucket = classifyEn(w);
    const prev = unique.get(key);
    if (!prev) {
      unique.set(key, bucket);
      continue;
    }
    const rank = { easy: 1, medium: 2, hard: 3 };
    if (rank[bucket] > rank[prev]) unique.set(key, bucket);
  }
  const counts: Record<EnDifficultyKey, number> = {
    easy: 0,
    medium: 0,
    hard: 0,
  };
  for (const b of unique.values()) counts[b] += 1;
  const totalUnique = unique.size;
  const percents: Record<EnDifficultyKey, number> = {
    easy: 0,
    medium: 0,
    hard: 0,
  };
  if (totalUnique > 0) {
    for (const k of Object.keys(counts) as EnDifficultyKey[]) {
      percents[k] = Math.round((counts[k] / totalUnique) * 1000) / 10;
    }
  }
  return { counts, percents, totalUnique };
}

function knownOverlap(
  surfaces: string[],
  language: LearningLanguage,
  cards: Flashcard[]
): { knownCount: number; knownPercent: number; totalUnique: number } {
  const unique = new Set(
    surfaces
      .map((s) => (language === 'en' ? s.toLowerCase() : s.trim()))
      .filter(Boolean)
  );
  const deck = new Set(
    cards
      .filter((c) => (c.language ?? 'zh') === language)
      .map((c) =>
        language === 'en' ? c.hanzi.trim().toLowerCase() : c.hanzi.trim()
      )
  );
  let knownCount = 0;
  for (const s of unique) {
    if (deck.has(s)) knownCount += 1;
  }
  const totalUnique = unique.size;
  return {
    knownCount,
    totalUnique,
    knownPercent:
      totalUnique > 0
        ? Math.round((knownCount / totalUnique) * 1000) / 10
        : 0,
  };
}

/** Синхронный расчёт покрытия (карточки передать снаружи). */
export function computeBookCoverageSync(
  book: Book,
  cards: Flashcard[]
): BookCoverage {
  const language: LearningLanguage =
    book.language === 'en' ? 'en' : book.language === 'ru' ? 'ru' : 'zh';
  const surfaces = paragraphWords(book);
  const known = knownOverlap(surfaces, language, cards);

  if (language === 'en') {
    const en = computeEnCoverage(book);
    const hardShare = en.percents.hard;
    const recommendedLabel =
      hardShare >= 35
        ? 'EN · advanced'
        : hardShare >= 15
          ? 'EN · intermediate'
          : 'EN · beginner';
    return {
      language,
      totalParagraphs: book.paragraphs.length,
      totalUniqueWords: en.totalUnique || known.totalUnique,
      knownPercent: known.knownPercent,
      knownCount: known.knownCount,
      en,
      recommendedLabel,
    };
  }

  const hsk = calculateHskStats(toWordTokens(book));
  const recommendedLabel =
    hsk.recommendedHskLevel >= 7
      ? 'HSK 7+'
      : `HSK ${hsk.recommendedHskLevel}`;
  return {
    language,
    totalParagraphs: book.paragraphs.length,
    totalUniqueWords: hsk.totalUnique || known.totalUnique,
    knownPercent: known.knownPercent,
    knownCount: known.knownCount,
    hsk,
    recommendedLabel,
  };
}

export async function computeBookCoverage(book: Book): Promise<BookCoverage> {
  const language: LearningLanguage =
    book.language === 'en' ? 'en' : book.language === 'ru' ? 'ru' : 'zh';
  const cards = await getFlashcards(language);
  return computeBookCoverageSync(book, cards);
}
