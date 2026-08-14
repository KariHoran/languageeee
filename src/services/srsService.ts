import type { Flashcard } from '../types/domain';

/** Оценка ответа по шкале SM-2 (0–5). */
export type ReviewGrade = 0 | 1 | 2 | 3 | 4 | 5;

/** @deprecated Используйте `ReviewGrade`. */
export type Sm2Grade = ReviewGrade;

export interface SRSCardState {
  interval: number;
  repetition: number;
  easeFactor: number;
}

export interface SRSCalculationResult {
  /** Интервал до следующего повторения (дни). */
  interval: number;
  repetition: number;
  easeFactor: number;
  /** Timestamp следующего повторения. */
  nextReviewDate: number;
}

export const MIN_EASE_FACTOR = 1.3;
export const ONE_DAY_MS = 24 * 60 * 60 * 1000;
export const DEFAULT_EASE_FACTOR = 2.5;

function normalizeEaseFactor(easeFactor: number): number {
  return Number.isFinite(easeFactor) && easeFactor > 0
    ? easeFactor
    : DEFAULT_EASE_FACTOR;
}

/**
 * SuperMemo-2: чистый пересчёт interval / repetition / EF / nextReviewDate.
 *
 * grade:
 * - 0–2 — забыл / сложно (сброс)
 * - 3 — с трудом
 * - 4 — хорошо
 * - 5 — отлично
 */
export function calculateNextReview(
  currentCard: SRSCardState,
  grade: ReviewGrade
): SRSCalculationResult {
  const { interval, repetition } = currentCard;
  const easeFactor = normalizeEaseFactor(currentCard.easeFactor);

  // 1. Новый Ease Factor по формуле SM-2
  let newEaseFactor =
    easeFactor + (0.1 - (5 - grade) * (0.08 + (5 - grade) * 0.02));
  if (newEaseFactor < MIN_EASE_FACTOR) newEaseFactor = MIN_EASE_FACTOR;

  let newInterval = 1;
  let newRepetition = 0;

  // 2. Оценка < 3 → сброс прогресса
  if (grade < 3) {
    newRepetition = 0;
    newInterval = 1;
  } else {
    // 3. Успешное повторение
    if (repetition === 0) {
      newInterval = 1;
    } else if (repetition === 1) {
      newInterval = 6;
    } else {
      const previousInterval = Math.max(1, interval || 1);
      newInterval = Math.max(1, Math.round(previousInterval * newEaseFactor));
    }
    newRepetition = repetition + 1;
  }

  // 4. Следующая дата = сейчас + interval (мс)
  const nextReviewDate = Date.now() + newInterval * ONE_DAY_MS;

  return {
    interval: newInterval,
    repetition: newRepetition,
    easeFactor: Number(newEaseFactor.toFixed(2)),
    nextReviewDate,
  };
}

/** Карточки, срок повторения которых уже наступил. */
export function getDueCards(
  cards: Record<string, Flashcard> | Flashcard[],
  now = Date.now()
): Flashcard[] {
  const list = Array.isArray(cards) ? cards : Object.values(cards);
  return list
    .filter((card) => (card.nextReviewDate ?? 0) <= now)
    .sort((a, b) => a.nextReviewDate - b.nextReviewDate);
}

/** Модуль SM-2 движка (удобный неймспейс). */
export const SRSService = {
  calculateNextReview,
  getDueCards,
  MIN_EASE_FACTOR,
  DEFAULT_EASE_FACTOR,
  ONE_DAY_MS,
} as const;
