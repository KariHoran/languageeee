/**
 * Недельный квест: N дней подряд с выполненной дневной целью по карточкам.
 */
import type { ActivityByDay } from './activityAnalytics';
import { localDayKey } from './activityAnalytics';

export interface WeeklyQuestState {
  /** Цель: дней с cardsReviewed >= dailyCardsGoal */
  targetDays: number;
  dailyCardsGoal: number;
  /** Сколько дней за последние 7 попали в цель */
  daysHit: number;
  /** Текущая серия дней с конца (включая сегодня, если цель закрыта) */
  streakDays: number;
  completed: boolean;
  /** daysHit / targetDays * 100 */
  percent: number;
}

const QUEST_DAYS = 7;

export function computeWeeklyQuest(
  activityByDay: ActivityByDay,
  dailyCardsGoal: number,
  targetDays = QUEST_DAYS
): WeeklyQuestState {
  const goal = Math.max(1, dailyCardsGoal);
  const today = localDayKey();
  const keys: string[] = [];
  for (let i = 0; i < targetDays; i += 1) {
    const d = new Date();
    d.setHours(12, 0, 0, 0);
    d.setDate(d.getDate() - i);
    keys.push(localDayKey(d));
  }

  let daysHit = 0;
  for (const k of keys) {
    const cards = activityByDay[k]?.cardsReviewed ?? 0;
    if (cards >= goal) daysHit += 1;
  }

  let streakDays = 0;
  for (const k of keys) {
    const cards = activityByDay[k]?.cardsReviewed ?? 0;
    if (cards >= goal) streakDays += 1;
    else break;
  }

  // Если сегодня ещё не выполнено — серия считается с вчера
  const todayCards = activityByDay[today]?.cardsReviewed ?? 0;
  if (todayCards < goal && streakDays === 0) {
    for (let i = 1; i < keys.length; i += 1) {
      const cards = activityByDay[keys[i]]?.cardsReviewed ?? 0;
      if (cards >= goal) streakDays += 1;
      else break;
    }
  }

  const completed = daysHit >= targetDays;
  return {
    targetDays,
    dailyCardsGoal: goal,
    daysHit,
    streakDays,
    completed,
    percent: Math.min(100, Math.round((daysHit / targetDays) * 100)),
  };
}
