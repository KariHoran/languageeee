/**
 * Геймификация: дневная активность + helpers для heatmap / streak.
 * Источник правды — Zustand ActivitySlice (persist + Firestore prefs).
 */

export const ACTIVITY_HISTORY_DAYS = 120;

export interface DayActivity {
  wordsRead: number;
  cardsReviewed: number;
  minutes: number;
  updatedAt: string;
}

export type ActivityByDay = Record<string, DayActivity>;

export function emptyDayActivity(now = new Date()): DayActivity {
  return {
    wordsRead: 0,
    cardsReviewed: 0,
    minutes: 0,
    updatedAt: now.toISOString(),
  };
}

/** Локальный календарный день YYYY-MM-DD (не UTC — чтобы стрик не «ломался» ночью). */
export function localDayKey(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function yesterdayLocalKey(d = new Date()): string {
  const y = new Date(d);
  y.setDate(y.getDate() - 1);
  return localDayKey(y);
}

/** Стрик «жив», если активность была сегодня или вчера. */
export function isStreakAlive(
  lastActiveDate: string | null | undefined,
  now = new Date()
): boolean {
  if (!lastActiveDate) return false;
  return (
    lastActiveDate === localDayKey(now) ||
    lastActiveDate === yesterdayLocalKey(now)
  );
}

/** Число для UI: просроченный стрик показываем как 0. */
export function displayStreak(
  current: number,
  lastActiveDate: string | null | undefined,
  now = new Date()
): number {
  if (!isStreakAlive(lastActiveDate, now)) return 0;
  return Math.max(0, Math.floor(current) || 0);
}

export function normalizeDayActivity(raw: unknown): DayActivity | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  return {
    wordsRead: Math.max(0, Math.floor(Number(o.wordsRead) || 0)),
    cardsReviewed: Math.max(0, Math.floor(Number(o.cardsReviewed) || 0)),
    minutes: Math.max(0, Math.floor(Number(o.minutes) || 0)),
    updatedAt:
      typeof o.updatedAt === 'string' && o.updatedAt
        ? o.updatedAt
        : new Date().toISOString(),
  };
}

/** Оставить последние N дней (по ключу даты). */
export function pruneActivityByDay(
  map: ActivityByDay,
  keepDays = ACTIVITY_HISTORY_DAYS,
  now = new Date()
): ActivityByDay {
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - keepDays);
  const cutoffKey = localDayKey(cutoff);
  const next: ActivityByDay = {};
  for (const [key, val] of Object.entries(map)) {
    if (key >= cutoffKey) next[key] = val;
  }
  return next;
}

/** Merge двух карт: по дню — max счётчиков, updatedAt — более свежий. */
export function mergeActivityByDay(
  local: ActivityByDay | undefined,
  remote: ActivityByDay | undefined
): ActivityByDay {
  const keys = new Set([
    ...Object.keys(local ?? {}),
    ...Object.keys(remote ?? {}),
  ]);
  const out: ActivityByDay = {};
  for (const key of keys) {
    const a = local?.[key];
    const b = remote?.[key];
    if (a && b) {
      out[key] = {
        wordsRead: Math.max(a.wordsRead, b.wordsRead),
        cardsReviewed: Math.max(a.cardsReviewed, b.cardsReviewed),
        minutes: Math.max(a.minutes, b.minutes),
        updatedAt: a.updatedAt >= b.updatedAt ? a.updatedAt : b.updatedAt,
      };
    } else {
      out[key] = (a ?? b)!;
    }
  }
  return pruneActivityByDay(out);
}

export function getDayActivity(
  map: ActivityByDay,
  day = localDayKey()
): DayActivity {
  return map[day] ?? emptyDayActivity();
}

/** Ячейки heatmap: weeks колонок × 7 строк (вс→сб или пн→вс). GitHub-style: колонки = недели. */
export interface HeatmapCell {
  date: string;
  wordsRead: number;
  /** 0 = пусто, 1..4 = интенсивность */
  level: number;
}

export function buildActivityHeatmap(
  map: ActivityByDay,
  weeks = 16,
  now = new Date()
): HeatmapCell[] {
  const cells: HeatmapCell[] = [];
  const end = new Date(now);
  end.setHours(12, 0, 0, 0);
  // Выравниваем конец на субботу (как GitHub: колонка = вс…сб)
  const endDow = end.getDay(); // 0=Sun
  const start = new Date(end);
  start.setDate(end.getDate() - endDow - (weeks - 1) * 7);

  const maxWords = Math.max(
    1,
    ...Object.values(map).map((d) => d.wordsRead || 0)
  );

  const total = weeks * 7;
  for (let i = 0; i < total; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const key = localDayKey(d);
    const words = map[key]?.wordsRead ?? 0;
    let level = 0;
    if (words > 0) {
      const ratio = words / maxWords;
      if (ratio >= 0.75) level = 4;
      else if (ratio >= 0.45) level = 3;
      else if (ratio >= 0.2) level = 2;
      else level = 1;
    }
    cells.push({ date: key, wordsRead: words, level });
  }
  return cells;
}

/** Интенсивность → Tailwind / inline background (Dark Neon → lime). */
export function heatmapLevelColor(level: number, isDark: boolean): string {
  if (level <= 0) return isDark ? '#2A2A3A' : '#e5e7eb';
  if (level === 1) return isDark ? '#3d4a1a' : '#d9f99d';
  if (level === 2) return isDark ? '#6b8a14' : '#bef264';
  if (level === 3) return isDark ? '#a3c91a' : '#a3e635';
  return '#D0FF00';
}
