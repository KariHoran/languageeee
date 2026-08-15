import React, { useEffect, useMemo, useState } from 'react';
import {
  buildActivityHeatmap,
  displayStreak,
  getDayActivity,
  heatmapLevelColor,
  localDayKey,
  sumActivityRange,
} from '../services/activityAnalytics';
import type { BookCoverage } from '../services/bookCoverageService';
import { getDarkSpots, type DarkSpot } from '../services/darkSpotsService';
import {
  maybeNotifyDueCards,
  notificationPermission,
  requestNotificationPermission,
} from '../services/dueReminderService';
import { publishPublicProfile } from '../services/publicProfilesService';
import type { ReadingProgress } from '../services/readingProgressStore';
import {
  downloadProgressShareImage,
  downloadProgressShareText,
} from '../services/shareProgressImage';
import { computeWeeklyQuest } from '../services/weeklyQuestService';
import { useAppStore } from '../store/useAppStore';
import { useI18n } from '../i18n/useI18n';
import { formatUnitCount } from '../i18n/pluralI18n';
import type { UiMessageKey } from '../i18n/uiMessages';
import { showAlert } from '../utils/alert';
import { Button, Div, Span } from './dom';
import { GlassWindow } from './GlassWindow';
import { useWebTheme } from './webTheme';

const HSK_COLORS = [
  { level: 1, bar: 'bg-pink-400', trackDark: 'bg-[#2A2A3A]', trackLight: 'bg-gray-100' },
  { level: 2, bar: 'bg-[#8B5CF6]', trackDark: 'bg-[#2A2A3A]', trackLight: 'bg-gray-100' },
  { level: 3, bar: 'bg-sky-400', trackDark: 'bg-[#2A2A3A]', trackLight: 'bg-gray-100' },
  { level: 4, bar: 'bg-[#D0FF00]', trackDark: 'bg-[#2A2A3A]', trackLight: 'bg-gray-100' },
  { level: 5, bar: 'bg-amber-400', trackDark: 'bg-[#2A2A3A]', trackLight: 'bg-gray-100' },
  { level: 6, bar: 'bg-rose-400', trackDark: 'bg-[#2A2A3A]', trackLight: 'bg-gray-100' },
];

const EN_BARS: Array<{
  key: 'easy' | 'medium' | 'hard';
  labelKey: UiMessageKey;
  bar: string;
}> = [
  { key: 'easy', labelKey: 'progress.easy', bar: 'bg-emerald-400' },
  { key: 'medium', labelKey: 'progress.medium', bar: 'bg-sky-400' },
  { key: 'hard', labelKey: 'progress.hard', bar: 'bg-rose-400' },
];

const GLASS_CARD =
  'rounded-2xl bg-[#1E1E28]/80 backdrop-blur-md border border-[#2A2A3A]';

interface ContinuePayload {
  title: string;
  progress: ReadingProgress;
  language?: string;
}

interface ProgressPanelProps {
  /** @deprecated Берётся из Zustand; prop оставлен для совместимости */
  streak?: number;
  wordsLearned?: number;
  /** Карточек due сегодня — для CTA Continue */
  dueCards?: number;
  coverage?: BookCoverage | null;
  readingProgress?: ReadingProgress | null;
  continueReading?: ContinuePayload | null;
  onContinueReading?: () => void;
  widthClass?: string;
}

export function ProgressPanel({
  streak: _streakProp,
  wordsLearned = 0,
  dueCards = 0,
  coverage = null,
  readingProgress = null,
  continueReading = null,
  onContinueReading,
  widthClass = 'w-[250px] shrink-0',
}: ProgressPanelProps) {
  const theme = useWebTheme();
  const { t, lang } = useI18n();
  const streakCurrent = useAppStore((s) => s.streakCurrent);
  const streakLastActiveDate = useAppStore((s) => s.streakLastActiveDate);
  const activityByDay = useAppStore((s) => s.activityByDay);
  const dailyWordsGoal = useAppStore((s) => s.dailyWordsGoal);
  const dailyCardsGoal = useAppStore((s) => s.dailyCardsGoal);
  const setDailyGoals = useAppStore((s) => s.setDailyGoals);
  const [shareBusy, setShareBusy] = useState(false);
  const [imageBusy, setImageBusy] = useState(false);
  const [darkSpots, setDarkSpots] = useState<DarkSpot[]>([]);
  const learningLanguage = useAppStore((s) => s.learningLanguage);
  const streak = useMemo(
    () => displayStreak(streakCurrent, streakLastActiveDate),
    [streakCurrent, streakLastActiveDate]
  );

  const today = useMemo(
    () => getDayActivity(activityByDay, localDayKey()),
    [activityByDay]
  );

  const week = useMemo(
    () => sumActivityRange(activityByDay, 7),
    [activityByDay]
  );

  const weeklyQuest = useMemo(
    () => computeWeeklyQuest(activityByDay, dailyCardsGoal),
    [activityByDay, dailyCardsGoal]
  );

  const recentActivity = useMemo(() => {
    const keys: string[] = [];
    for (let i = 0; i < 7; i += 1) {
      const d = new Date();
      d.setHours(12, 0, 0, 0);
      d.setDate(d.getDate() - i);
      keys.push(localDayKey(d));
    }
    return keys.map((date) => ({
      date,
      wordsRead: activityByDay[date]?.wordsRead ?? 0,
      cardsReviewed: activityByDay[date]?.cardsReviewed ?? 0,
    }));
  }, [activityByDay]);

  useEffect(() => {
    let cancelled = false;
    void getDarkSpots(learningLanguage, 4).then((spots) => {
      if (!cancelled) setDarkSpots(spots);
    });
    return () => {
      cancelled = true;
    };
  }, [learningLanguage, wordsLearned]);

  useEffect(() => {
    if (dueCards <= 0) return;
    if (notificationPermission() === 'denied') return;
    void (async () => {
      if (notificationPermission() === 'default') {
        await requestNotificationPermission();
      }
      await maybeNotifyDueCards(
        dueCards,
        t('progress.dueBannerTitle', { n: dueCards }),
        t('progress.dueBannerHint')
      );
    })();
  }, [dueCards, t]);

  const wordsGoalPct = Math.min(
    100,
    Math.round((today.wordsRead / Math.max(1, dailyWordsGoal)) * 100)
  );
  const cardsGoalPct = Math.min(
    100,
    Math.round((today.cardsReviewed / Math.max(1, dailyCardsGoal)) * 100)
  );
  const goalMet =
    today.wordsRead >= dailyWordsGoal && today.cardsReviewed >= dailyCardsGoal;

  const heatmap = useMemo(
    () => buildActivityHeatmap(activityByDay, 14),
    [activityByDay]
  );

  const hskBars = useMemo(() => {
    if (!coverage?.hsk) return null;
    return HSK_COLORS.map((row) => {
      const key = String(row.level) as '1' | '2' | '3' | '4' | '5' | '6';
      const fromStats = coverage.hsk?.percents?.[key];
      return {
        ...row,
        pct:
          typeof fromStats === 'number'
            ? Math.round(Math.min(100, Math.max(0, fromStats)))
            : 0,
      };
    });
  }, [coverage]);

  const readPct = readingProgress?.percent ?? 0;

  const glassCard = theme.isDark
    ? GLASS_CARD
    : 'rounded-2xl bg-white/80 backdrop-blur-md border border-gray-200';

  return (
    <GlassWindow
      title={t('progress.title')}
      widthClass={widthClass}
      className="h-full max-h-full"
    >
      {continueReading ? (
        <Button
          type="button"
          className="w-full mb-3 rounded-2xl px-3 py-3 text-left bg-[#D0FF00] text-[#0D0D11] transition hover:brightness-95"
          onClick={onContinueReading}
        >
          <Div className="text-[10px] font-bold uppercase tracking-wide opacity-70">
            {t('progress.continueReading')}
          </Div>
          <Div className="font-['Comfortaa'] font-bold text-sm leading-snug mt-0.5 line-clamp-2">
            {continueReading.title}
          </Div>
          <Div className="mt-1.5 text-[11px] font-semibold opacity-80">
            {t('progress.readingLine', {
              pct: Math.round(continueReading.progress.percent),
              current: continueReading.progress.paragraphIndex + 1,
              total: continueReading.progress.paragraphsTotal,
            })}
            {continueReading.language
              ? ` · ${continueReading.language.toUpperCase()}`
              : ''}
          </Div>
          {dueCards > 0 ? (
            <Div className="mt-1 text-[10px] font-bold opacity-75">
              {t('progress.continueWithDue', { n: dueCards })}
            </Div>
          ) : null}
          <Div className="mt-2 h-1.5 rounded-full bg-black/15 overflow-hidden">
            <Div
              className="h-full rounded-full bg-[#0D0D11]/70"
              style={{
                width: `${Math.min(100, continueReading.progress.percent)}%`,
              }}
            />
          </Div>
        </Button>
      ) : null}

      <Div className="grid grid-cols-2 gap-2.5 mb-3">
        <Div className={`${glassCard} px-3 py-3`}>
          <Span className="text-lg leading-none">🔥</Span>
          <Div className={`mt-1.5 text-[11px] uppercase tracking-wide ${theme.accent} font-bold`}>
            {t('progress.streak')}
          </Div>
          <Div className={`text-xl font-extrabold ${theme.text} font-['Comfortaa']`}>
            {streak}
            <Span className={`text-xs font-semibold ${theme.textMuted} ml-1`}>
              {t('progress.streakDays')}
            </Span>
          </Div>
        </Div>
        <Div className={`${glassCard} px-3 py-3`}>
          <Span className="text-lg leading-none">⭐</Span>
          <Div className={`mt-1.5 text-[11px] uppercase tracking-wide ${theme.accent} font-bold`}>
            {t('progress.wordsLearned')}
          </Div>
          <Div className="text-xl font-extrabold text-[#0D0D11] bg-[#D0FF00] inline-block px-1.5 rounded-md font-['Comfortaa']">
            {wordsLearned}
          </Div>
        </Div>
      </Div>

      <Div className={`text-[10px] font-bold uppercase tracking-wider ${theme.accent} mb-1.5`}>
        {t('progress.weekTitle')}
      </Div>
      <Div className={`${glassCard} px-3 py-2.5 mb-3`}>
        <Div className={`text-xs font-semibold ${theme.text}`}>
          {t('progress.weekStats', {
            words: formatUnitCount(week.wordsRead, 'word', lang),
            cards: formatUnitCount(week.cardsReviewed, 'card', lang),
            min: formatUnitCount(week.minutes, 'minute', lang),
          })}
        </Div>
      </Div>

      <Button
        type="button"
        disabled={shareBusy}
        className={`w-full mb-3 rounded-xl px-3 py-2 text-xs font-bold transition ${theme.cta} disabled:opacity-50`}
        onClick={() => {
          if (shareBusy) return;
          setShareBusy(true);
          void (async () => {
            try {
              const { url } = await publishPublicProfile({
                streak,
                wordsLearned,
                cardsCount: wordsLearned,
                weekWords: week.wordsRead,
                weekCards: week.cardsReviewed,
                recentActivity,
              });
              try {
                await navigator.clipboard.writeText(url);
                showAlert(
                  t('progress.shareProfileOk'),
                  t('progress.shareProfileCopied', { url })
                );
              } catch {
                showAlert(t('progress.shareProfileOk'), url);
              }
            } catch (e) {
              showAlert(
                t('alert.error'),
                e instanceof Error ? e.message : t('progress.shareProfileFail')
              );
            } finally {
              setShareBusy(false);
            }
          })();
        }}
      >
        {shareBusy ? t('progress.shareProfileBusy') : t('progress.shareProfile')}
      </Button>

      <Button
        type="button"
        disabled={imageBusy}
        className={`w-full mb-3 rounded-xl px-3 py-2 text-xs font-bold transition border ${
          theme.isDark
            ? 'border-[#2A2A3A] text-white/80 hover:bg-white/5'
            : 'border-gray-200 text-gray-800 hover:bg-gray-50'
        } disabled:opacity-50`}
        onClick={() => {
          if (imageBusy) return;
          setImageBusy(true);
          void (async () => {
            try {
              const payload = {
                streak,
                wordsLearned,
                weekWords: week.wordsRead,
                weekCards: week.cardsReviewed,
              };
              const ok = await downloadProgressShareImage(payload);
              if (!ok) await downloadProgressShareText(payload);
            } finally {
              setImageBusy(false);
            }
          })();
        }}
      >
        {imageBusy ? t('progress.shareImageBusy') : t('progress.shareImage')}
      </Button>

      <Div className={`${glassCard} px-3 py-2.5 mb-3`}>
        <Div className="flex items-center justify-between gap-2 mb-1">
          <Span className={`text-[11px] font-bold uppercase ${theme.accent}`}>
            {t('progress.weeklyQuest')}
          </Span>
          {weeklyQuest.completed ? (
            <Span className="text-[10px] font-bold text-[#D0FF00]">
              {t('progress.weeklyQuestDone')}
            </Span>
          ) : null}
        </Div>
        <Div className={`text-xs font-semibold ${theme.text}`}>
          {t('progress.weeklyQuestStats', {
            hit: weeklyQuest.daysHit,
            target: weeklyQuest.targetDays,
            goal: weeklyQuest.dailyCardsGoal,
            streak: weeklyQuest.streakDays,
          })}
        </Div>
        <Div
          className={`mt-2 h-1.5 rounded-full overflow-hidden ${
            theme.isDark ? 'bg-[#2A2A3A]' : 'bg-gray-100'
          }`}
        >
          <Div
            className="h-full rounded-full bg-[#8B5CF6] transition-all"
            style={{ width: `${weeklyQuest.percent}%` }}
          />
        </Div>
      </Div>

      <Div className={`text-[10px] font-bold uppercase tracking-wider ${theme.accent} mb-1.5`}>
        {t('progress.dailyGoal')}
      </Div>
      <Div className={`${glassCard} px-3 py-2.5 mb-3`}>
        <Div className="flex items-center justify-between gap-2 mb-1.5">
          <Span className={`text-[11px] font-semibold ${theme.textMuted}`}>
            {t('progress.wordsGoal', {
              n: today.wordsRead,
              goal: dailyWordsGoal,
            })}
          </Span>
          <Div className="flex items-center gap-1">
            <Button
              type="button"
              className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${theme.textMuted}`}
              onClick={() => setDailyGoals({ words: dailyWordsGoal - 10 })}
            >
              −
            </Button>
            <Button
              type="button"
              className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${theme.textMuted}`}
              onClick={() => setDailyGoals({ words: dailyWordsGoal + 10 })}
            >
              +
            </Button>
          </Div>
        </Div>
        <Div
          className={`h-1.5 rounded-full overflow-hidden mb-2.5 ${
            theme.isDark ? 'bg-[#2A2A3A]' : 'bg-gray-100'
          }`}
        >
          <Div
            className="h-full rounded-full bg-[#D0FF00] transition-all"
            style={{ width: `${wordsGoalPct}%` }}
          />
        </Div>
        <Div className="flex items-center justify-between gap-2 mb-1.5">
          <Span className={`text-[11px] font-semibold ${theme.textMuted}`}>
            {t('progress.cardsGoal', {
              n: today.cardsReviewed,
              goal: dailyCardsGoal,
            })}
          </Span>
          <Div className="flex items-center gap-1">
            <Button
              type="button"
              className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${theme.textMuted}`}
              onClick={() => setDailyGoals({ cards: dailyCardsGoal - 1 })}
            >
              −
            </Button>
            <Button
              type="button"
              className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${theme.textMuted}`}
              onClick={() => setDailyGoals({ cards: dailyCardsGoal + 1 })}
            >
              +
            </Button>
          </Div>
        </Div>
        <Div
          className={`h-1.5 rounded-full overflow-hidden ${
            theme.isDark ? 'bg-[#2A2A3A]' : 'bg-gray-100'
          }`}
        >
          <Div
            className="h-full rounded-full bg-[#FF6584] transition-all"
            style={{ width: `${cardsGoalPct}%` }}
          />
        </Div>
        {goalMet ? (
          <Div className="mt-2 text-[11px] font-bold text-[#D0FF00]">
            {t('progress.goalMet')}
          </Div>
        ) : null}
        {dueCards > 0 ? (
          <Div className={`mt-1.5 text-[10px] font-semibold ${theme.accent}`}>
            {t('progress.dueCards', { n: dueCards })}
          </Div>
        ) : null}
      </Div>

      {darkSpots.length > 0 ? (
        <>
          <Div className={`text-[10px] font-bold uppercase tracking-wider ${theme.accent} mb-1.5`}>
            {t('progress.darkSpots')}
          </Div>
          <Div className={`${glassCard} px-3 py-2.5 mb-3 space-y-2`}>
            <Div className={`text-[10px] ${theme.textMuted}`}>
              {t('progress.darkSpotsHint')}
            </Div>
            {darkSpots.map((spot) => (
              <Div
                key={spot.key}
                className="flex items-start justify-between gap-2"
              >
                <Span className={`text-[11px] font-semibold line-clamp-2 ${theme.text}`}>
                  {spot.title}
                </Span>
                <Span className="shrink-0 text-[10px] font-bold text-[#FF6584]">
                  {t('progress.darkSpotStat', {
                    weak: spot.weakCount,
                    again: spot.againSum,
                  })}
                </Span>
              </Div>
            ))}
          </Div>
        </>
      ) : null}

      <Div className={`text-[10px] font-bold uppercase tracking-wider ${theme.accent} mb-1.5`}>
        {t('progress.today')}
      </Div>
      <Div className="grid grid-cols-1 gap-2 mb-4">
        <Div className={`${glassCard} px-3 py-2.5 flex items-center justify-between gap-2`}>
          <Span className={`text-[11px] font-semibold ${theme.textMuted}`}>
            {t('progress.wordsReadToday')}
          </Span>
          <Span className={`text-sm font-extrabold font-['Comfortaa'] ${theme.text}`}>
            {today.wordsRead}
          </Span>
        </Div>
        <Div className={`${glassCard} px-3 py-2.5 flex items-center justify-between gap-2`}>
          <Span className={`text-[11px] font-semibold ${theme.textMuted}`}>
            {t('progress.cardsReviewedToday')}
          </Span>
          <Span className={`text-sm font-extrabold font-['Comfortaa'] ${theme.text}`}>
            {today.cardsReviewed}
          </Span>
        </Div>
        <Div className={`${glassCard} px-3 py-2.5 flex items-center justify-between gap-2`}>
          <Span className={`text-[11px] font-semibold ${theme.textMuted}`}>
            {t('progress.minutesInApp')}
          </Span>
          <Span className={`text-sm font-extrabold font-['Comfortaa'] text-[#D0FF00]`}>
            {today.minutes}
          </Span>
        </Div>
      </Div>

      <Div className={`text-[10px] font-bold uppercase tracking-wider ${theme.accent} mb-1.5`}>
        {t('progress.activity')}
      </Div>
      <Div className={`${glassCard} px-2.5 py-2.5 mb-4`}>
        <Div
          className="grid gap-[3px]"
          style={{
            gridTemplateColumns: `repeat(${Math.ceil(heatmap.length / 7)}, minmax(0, 1fr))`,
            gridTemplateRows: 'repeat(7, minmax(0, 1fr))',
            gridAutoFlow: 'column',
          }}
          title={t('progress.activityHint')}
        >
          {heatmap.map((cell) => (
            <Div
              key={cell.date}
              className="aspect-square rounded-[3px] transition-colors"
              style={{
                background: heatmapLevelColor(cell.level, theme.isDark),
              }}
              title={t('progress.activityDay', {
                date: cell.date,
                n: formatUnitCount(cell.wordsRead, 'word', lang),
              })}
            />
          ))}
        </Div>
        <Div className="mt-2 flex items-center justify-between gap-2">
          <Span className={`text-[9px] ${theme.textMuted}`}>{t('progress.less')}</Span>
          <Div className="flex items-center gap-[3px]">
            {[0, 1, 2, 3, 4].map((lvl) => (
              <Div
                key={lvl}
                className="w-2.5 h-2.5 rounded-[2px]"
                style={{ background: heatmapLevelColor(lvl, theme.isDark) }}
              />
            ))}
          </Div>
          <Span className={`text-[9px] ${theme.textMuted}`}>{t('progress.more')}</Span>
        </Div>
      </Div>

      {readingProgress ? (
        <Div className={`${glassCard} px-3 py-3 mb-4`}>
          <Div className={`text-[11px] uppercase tracking-wide ${theme.accent} font-bold`}>
            {t('progress.reading')}
          </Div>
          <Div className={`mt-1 text-sm font-bold ${theme.text}`}>
            {t('progress.readingWords', {
              pct: Math.round(readPct),
              n: formatUnitCount(readingProgress.wordsSeen, 'word', lang),
            })}
          </Div>
          <Div
            className={`mt-2 h-2 rounded-full overflow-hidden ${
              theme.isDark ? 'bg-[#2A2A3A]' : 'bg-gray-100'
            }`}
          >
            <Div
              className="h-full rounded-full bg-[#D0FF00] transition-all duration-500"
              style={{ width: `${Math.min(100, readPct)}%` }}
            />
          </Div>
        </Div>
      ) : null}

      {coverage ? (
        <>
          <Div className={`text-xs font-bold uppercase tracking-wider ${theme.accent} mb-1`}>
            {coverage.language === 'en'
              ? t('progress.enCoverage')
              : t('progress.hskLevels')}
          </Div>
          <Div className={`text-[11px] ${theme.textMuted} mb-2.5`}>
            {coverage.recommendedLabel}
            {' · '}
            {t('progress.uniqueShort', { n: coverage.totalUniqueWords })}
            {' · '}
            {t('progress.inFlashcards', { n: coverage.knownPercent })}
          </Div>

          {coverage.language === 'zh' && hskBars ? (
            <Div className="flex flex-col gap-2.5">
              {hskBars.map((row) => (
                <Div key={row.level}>
                  <Div className="flex justify-between items-center mb-1">
                    <Span className={`text-xs font-bold ${theme.text}`}>
                      HSK {row.level}
                    </Span>
                    <Span className={`text-[11px] font-semibold ${theme.textMuted}`}>
                      {row.pct}%
                    </Span>
                  </Div>
                  <Div
                    className={`h-2 rounded-full overflow-hidden ${
                      theme.isDark ? row.trackDark : row.trackLight
                    }`}
                  >
                    <Div
                      className={`h-full rounded-full ${row.bar} transition-all duration-500`}
                      style={{ width: `${row.pct}%` }}
                    />
                  </Div>
                </Div>
              ))}
            </Div>
          ) : null}

          {coverage.language === 'en' && coverage.en ? (
            <Div className="flex flex-col gap-2.5">
              {EN_BARS.map((row) => {
                const pct = Math.round(coverage.en?.percents[row.key] ?? 0);
                return (
                  <Div key={row.key}>
                    <Div className="flex justify-between items-center mb-1">
                      <Span className={`text-xs font-bold ${theme.text}`}>
                        {t(row.labelKey)}
                      </Span>
                      <Span className={`text-[11px] font-semibold ${theme.textMuted}`}>
                        {pct}%
                      </Span>
                    </Div>
                    <Div
                      className={`h-2 rounded-full overflow-hidden ${
                        theme.isDark ? 'bg-[#2A2A3A]' : 'bg-gray-100'
                      }`}
                    >
                      <Div
                        className={`h-full rounded-full ${row.bar} transition-all duration-500`}
                        style={{ width: `${pct}%` }}
                      />
                    </Div>
                  </Div>
                );
              })}
            </Div>
          ) : null}
        </>
      ) : (
        <>
          <Div className={`text-xs font-bold uppercase tracking-wider ${theme.accent} mb-2.5`}>
            {t('progress.coverage')}
          </Div>
          <Div className={`text-[11px] ${theme.textMuted}`}>
            {t('progress.coverageHint')}
          </Div>
        </>
      )}
    </GlassWindow>
  );
}
