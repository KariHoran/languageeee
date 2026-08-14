import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { BookHskStats } from '../types/domain';
import {
  HSK_STAT_LEVEL_KEYS,
  type HskStatLevelKey,
} from '../services/textAnalyzerService';

const LEVEL_COLORS: Record<HskStatLevelKey, string> = {
  '1': '#22c55e',
  '2': '#14b8a6',
  '3': '#3b82f6',
  '4': '#6366f1',
  '5': '#f59e0b',
  '6': '#ea580c',
  '7+': '#a855f7',
};

interface HskStatsBadgeProps {
  stats?: BookHskStats | null;
  readingTime?: number | null;
  /** Компактный вид для карточки книги / шапки ридера. */
  compact?: boolean;
  /** Показать подпись с рекомендуемым уровнем и временем. */
  showMeta?: boolean;
}

function hasAnyCounts(stats: BookHskStats): boolean {
  return HSK_STAT_LEVEL_KEYS.some((k) => (stats.counts?.[k] ?? 0) > 0);
}

export default function HskStatsBadge({
  stats,
  readingTime,
  compact = true,
  showMeta = true,
}: HskStatsBadgeProps) {
  const segments = useMemo(() => {
    if (!stats || !hasAnyCounts(stats)) return [];
    const total = stats.totalUnique || 1;
    return HSK_STAT_LEVEL_KEYS.map((key) => {
      const count = stats.counts?.[key] ?? 0;
      const flex = count / total;
      return { key, count, flex, color: LEVEL_COLORS[key] };
    }).filter((s) => s.count > 0);
  }, [stats]);

  if (!stats || segments.length === 0) {
    return null;
  }

  const recommended = stats.recommendedHskLevel;
  const recommendedLabel =
    recommended >= 7 ? 'HSK 7+' : `HSK ${recommended}`;

  return (
    <View style={[styles.wrap, compact && styles.wrapCompact]}>
      <View
        style={[styles.bar, compact ? styles.barCompact : styles.barTall]}
        accessibilityRole="progressbar"
        accessibilityLabel={`Сложность: ${recommendedLabel}`}
      >
        {segments.map((seg) => (
          <View
            key={seg.key}
            style={[
              styles.segment,
              { flex: Math.max(seg.flex, 0.02), backgroundColor: seg.color },
            ]}
          />
        ))}
      </View>

      {showMeta && (
        <View style={styles.metaRow}>
          <Text style={styles.metaText}>
            Рек. {recommendedLabel}
            {stats.totalUnique > 0 ? ` · ${stats.totalUnique} сл.` : ''}
            {readingTime != null && readingTime > 0
              ? ` · ~${readingTime} мин`
              : ''}
          </Text>
        </View>
      )}

      {!compact && (
        <View style={styles.legend}>
          {HSK_STAT_LEVEL_KEYS.map((key) => {
            const pct = stats.percents?.[key] ?? 0;
            if (pct <= 0) return null;
            return (
              <View key={key} style={styles.legendItem}>
                <View
                  style={[styles.legendDot, { backgroundColor: LEVEL_COLORS[key] }]}
                />
                <Text style={styles.legendText}>
                  {key === '7+' ? '7+' : key}: {pct}%
                </Text>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 6,
    minWidth: 120,
  },
  wrapCompact: {
    gap: 4,
    minWidth: 96,
  },
  bar: {
    flexDirection: 'row',
    width: '100%',
    borderRadius: 999,
    overflow: 'hidden',
    backgroundColor: '#e2e8f0',
  },
  barCompact: {
    height: 6,
  },
  barTall: {
    height: 10,
  },
  segment: {
    height: '100%',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748b',
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 2,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  legendText: {
    fontSize: 10,
    color: '#64748b',
    fontWeight: '500',
  },
});
