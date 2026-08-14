/** Цвета бейджа уровня HSK 3.0 — отдельный цвет на каждый уровень 1–9 (без смещения). */

const HSK_BADGE_BY_LEVEL: Record<number, { background: string; text: string }> = {
  1: { background: '#dcfce7', text: '#166534' },
  2: { background: '#bbf7d0', text: '#15803d' },
  3: { background: '#dbeafe', text: '#1e40af' },
  4: { background: '#bfdbfe', text: '#1d4ed8' },
  5: { background: '#ffedd5', text: '#c2410c' },
  6: { background: '#fed7aa', text: '#9a3412' },
  7: { background: '#ede9fe', text: '#6d28d9' },
  8: { background: '#ddd6fe', text: '#5b21b6' },
  9: { background: '#c4b5fd', text: '#4c1d95' },
};

/**
 * Нормализует уровень HSK 3.0 к целому 1…9.
 * Важно: шкала 1-based (HSK 1 = 1), без смещения ±1.
 */
export function normalizeHskLevelValue(level: number | string | null | undefined): number | null {
  if (level == null || level === '') return null;

  if (typeof level === 'number' && Number.isFinite(level)) {
    const n = Math.round(level);
    if (n < 1 || n > 9) return null;
    return n;
  }

  const raw = String(level).trim();
  // Полоса 7–9 в словаре HSK 3.0
  if (/^7\s*[-–—]\s*9$/.test(raw)) return 7;

  const match = raw.match(/(\d+)/);
  if (!match) return null;
  const n = parseInt(match[1]!, 10);
  if (!Number.isFinite(n) || n < 1 || n > 9) return null;
  return n;
}

export function formatHskLevelLabel(level: number | string | null | undefined): string {
  const n = normalizeHskLevelValue(level);
  if (n == null) return '';
  if (n >= 7) return 'HSK 7+';
  return `HSK ${n}`;
}

export function getHskBadgeColors(level: number): { background: string; text: string } {
  const n = normalizeHskLevelValue(level) ?? 9;
  return HSK_BADGE_BY_LEVEL[n] ?? HSK_BADGE_BY_LEVEL[9]!;
}
