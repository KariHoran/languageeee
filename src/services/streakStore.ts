/**
 * Streak API — мост к Zustand ActivitySlice (persist + Firestore).
 * Реальный рост стрика: useAppStore.trackActivity (чтение / карточки / минуты).
 */
import {
  emptyDayActivity,
  localDayKey,
  pruneActivityByDay,
  yesterdayLocalKey,
  displayStreak,
} from './activityAnalytics';
import { useAppStore } from '../store/useAppStore';

export interface StreakState {
  current: number;
  lastActiveDate: string | null;
  updatedAt: string;
}

export async function loadStreak(): Promise<StreakState> {
  const s = useAppStore.getState();
  return {
    current: displayStreak(s.streakCurrent, s.streakLastActiveDate),
    lastActiveDate: s.streakLastActiveDate,
    updatedAt: s.streakUpdatedAt,
  };
}

export async function saveStreak(state: StreakState): Promise<void> {
  useAppStore.getState().setActivityFromCloud({
    streak: {
      current: state.current,
      lastActiveDate: state.lastActiveDate,
      updatedAt: state.updatedAt,
    },
  });
}

/**
 * Явно отметить день в стрике (без счётчиков слов/карточек).
 * Основной путь — trackActivity; эта функция для bootstrap / legacy callers.
 */
export async function recordDailyActivity(): Promise<StreakState> {
  const today = localDayKey();
  const yesterday = yesterdayLocalKey();
  const nowIso = new Date().toISOString();

  useAppStore.setState((state) => {
    if (state.streakLastActiveDate === today) return state;

    let streakCurrent = 1;
    if (state.streakLastActiveDate === yesterday) {
      streakCurrent = Math.max(1, state.streakCurrent + 1);
    }
    const prevDay = state.activityByDay[today] ?? emptyDayActivity();
    return {
      activityByDay: pruneActivityByDay({
        ...state.activityByDay,
        [today]: { ...prevDay, updatedAt: nowIso },
      }),
      streakCurrent,
      streakLastActiveDate: today,
      streakUpdatedAt: nowIso,
    };
  });

  try {
    const { scheduleSyncDebounced } = await import('./cloudSyncService');
    scheduleSyncDebounced();
  } catch {
    /* ignore */
  }
  return loadStreak();
}

export async function setStreakFromCloud(partial: {
  current?: number;
  lastActiveDate?: string | null;
  updatedAt?: string;
}): Promise<StreakState> {
  useAppStore.getState().setActivityFromCloud({ streak: partial });
  return loadStreak();
}
