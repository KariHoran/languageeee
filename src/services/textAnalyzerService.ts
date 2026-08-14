import type { WordToken } from '../types/domain';

/** Ключи уровней: HSK 1–6 и «7+» (без уровня / выше 6). */
export type HskStatLevelKey = '1' | '2' | '3' | '4' | '5' | '6' | '7+';

export const HSK_STAT_LEVEL_KEYS: HskStatLevelKey[] = [
  '1',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7+',
];

/** Снимок HSK-статистики по уникальным словам. */
export interface HskStatsResult {
  /** Число уникальных слов на уровень. */
  counts: Record<HskStatLevelKey, number>;
  /** Доля уникальных слов на уровень, 0–100. */
  percents: Record<HskStatLevelKey, number>;
  /** Суммарное покрытие «знаю ≤ N» (для 1–6 и 7+). */
  cumulativePercents: Record<HskStatLevelKey, number>;
  totalUnique: number;
  /**
   * Рекомендуемый HSK: минимальный уровень, при котором
   * суммарное покрытие слов с level ≤ N ≥ 80%.
   * 7 означает, что даже HSK 6 не даёт 80% (нужен запас 7+).
   */
  recommendedHskLevel: number;
}

export interface ReadingEstimates {
  totalWords: number;
  uniqueWords: number;
  /** Примерное время чтения (минуты). */
  estimatedMinutes: number;
}

/** Средняя скорость чтения для изучающих (иероглифов/мин). */
const CHARS_PER_MINUTE_MIN = 150;
const CHARS_PER_MINUTE_MAX = 200;
const CHARS_PER_MINUTE =
  (CHARS_PER_MINUTE_MIN + CHARS_PER_MINUTE_MAX) / 2;

const COVERAGE_THRESHOLD = 80;

function levelToKey(hskLevel: number): HskStatLevelKey {
  // Приводим к числу на случай строковых уровней из старых снепшотов
  const n = Math.round(Number(hskLevel));
  if (!Number.isFinite(n) || n <= 0 || n > 6) {
    return '7+';
  }
  // 1-based: HSK 5 → ключ '5' (не index+1 / не 0-based)
  return String(n) as HskStatLevelKey;
}

function emptyCounts(): Record<HskStatLevelKey, number> {
  return { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0, '6': 0, '7+': 0 };
}

/**
 * Уникальные слова по уровням HSK + проценты + рекомендуемый уровень (80% coverage).
 */
export function calculateHskStats(tokens: WordToken[]): HskStatsResult {
  const uniqueByHanzi = new Map<string, HskStatLevelKey>();

  for (const token of tokens) {
    const hanzi = token.hanzi?.trim();
    if (!hanzi) continue;
    // Более «сложный» уровень побеждает при дубликатах
    const key = levelToKey(token.hskLevel);
    const prev = uniqueByHanzi.get(hanzi);
    if (!prev) {
      uniqueByHanzi.set(hanzi, key);
      continue;
    }
    const prevRank = prev === '7+' ? 7 : Number(prev);
    const nextRank = key === '7+' ? 7 : Number(key);
    if (nextRank > prevRank) uniqueByHanzi.set(hanzi, key);
  }

  const counts = emptyCounts();
  for (const key of uniqueByHanzi.values()) {
    counts[key] += 1;
  }

  const totalUnique = uniqueByHanzi.size;
  const percents = emptyCounts();
  const cumulativePercents = emptyCounts();

  if (totalUnique === 0) {
    return {
      counts,
      percents,
      cumulativePercents,
      totalUnique: 0,
      recommendedHskLevel: 1,
    };
  }

  let cumulative = 0;
  let recommendedHskLevel = 7;

  for (const key of HSK_STAT_LEVEL_KEYS) {
    const pct = (counts[key] / totalUnique) * 100;
    percents[key] = Math.round(pct * 10) / 10;
    cumulative += pct;
    cumulativePercents[key] = Math.round(cumulative * 10) / 10;

    if (recommendedHskLevel === 7 && cumulative >= COVERAGE_THRESHOLD) {
      recommendedHskLevel = key === '7+' ? 7 : Number(key);
    }
  }

  return {
    counts,
    percents,
    cumulativePercents,
    totalUnique,
    recommendedHskLevel,
  };
}

/**
 * Оценка объёма и времени чтения.
 * Скорость: ~150–200 иероглифов/мин для изучающих (берём среднее 175).
 */
export function getReadingEstimates(
  textZh: string,
  tokens: WordToken[]
): ReadingEstimates {
  const totalWords = tokens.filter((t) => t.hanzi?.trim()).length;
  const uniqueWords = new Set(
    tokens.map((t) => t.hanzi?.trim()).filter(Boolean) as string[]
  ).size;

  const charCount = (textZh.match(/[\u4e00-\u9fff]/g) ?? []).length;
  const estimatedMinutes =
    charCount <= 0
      ? 0
      : Math.max(1, Math.ceil(charCount / CHARS_PER_MINUTE));

  return {
    totalWords,
    uniqueWords,
    estimatedMinutes,
  };
}

/** Собирает токены из абзацев и считает статистику + время чтения. */
export function analyzeBookText(
  textZh: string,
  tokens: WordToken[]
): { hskStats: HskStatsResult; reading: ReadingEstimates } {
  return {
    hskStats: calculateHskStats(tokens),
    reading: getReadingEstimates(textZh, tokens),
  };
}

export const TextAnalyzerService = {
  calculateHskStats,
  getReadingEstimates,
  analyzeBookText,
  HSK_STAT_LEVEL_KEYS,
  COVERAGE_THRESHOLD,
  CHARS_PER_MINUTE,
} as const;
