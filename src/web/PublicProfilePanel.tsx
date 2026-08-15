import React, { useCallback, useEffect, useState } from 'react';
import { useI18n } from '../i18n/useI18n';
import {
  fetchPublicProfile,
  type PublicProfileDoc,
} from '../services/publicProfilesService';
import { Button, Div, Span } from './dom';
import { useWebTheme } from './webTheme';

interface PublicProfilePanelProps {
  slug: string;
  onClose: () => void;
}

/** Публичный профиль по ссылке `/u/{slug}`. */
export function PublicProfilePanel({ slug, onClose }: PublicProfilePanelProps) {
  const theme = useWebTheme();
  const { t } = useI18n();
  const [profile, setProfile] = useState<PublicProfileDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const doc = await fetchPublicProfile(slug);
      if (!doc) {
        setError(t('profile.notFound'));
        setProfile(null);
      } else {
        setProfile(doc);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t('profile.notFound'));
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }, [slug, t]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <Div
      className={`flex-1 min-h-0 overflow-y-auto rounded-3xl border p-5 ${
        theme.isDark
          ? 'bg-[#1E1E28]/90 border-[#2A2A3A]'
          : 'bg-white/90 border-gray-200'
      }`}
    >
      <Div className="flex items-start justify-between gap-3 mb-4">
        <Div>
          <Div className={`text-xs font-bold uppercase tracking-wide ${theme.accent}`}>
            {t('profile.title')}
          </Div>
          <Div className={`mt-1 text-xl font-extrabold font-['Comfortaa'] ${theme.text}`}>
            {profile?.displayName || slug}
          </Div>
        </Div>
        <Button
          type="button"
          onClick={onClose}
          className={`text-sm font-semibold ${theme.textMuted}`}
        >
          {t('action.close')}
        </Button>
      </Div>

      {loading ? (
        <Div className={`text-sm ${theme.textMuted}`}>{t('profile.loading')}</Div>
      ) : error ? (
        <Div>
          <Div className={`text-sm ${theme.textMuted}`}>{error}</Div>
          <Button
            type="button"
            className={`mt-4 rounded-xl px-4 py-2 text-xs font-bold ${theme.cta}`}
            onClick={onClose}
          >
            {t('profile.goHome')}
          </Button>
        </Div>
      ) : profile ? (
        <Div className="grid grid-cols-2 gap-3 max-w-md">
          <Div
            className={`rounded-2xl px-3 py-3 border ${
              theme.isDark ? 'border-[#2A2A3A] bg-[#16161f]' : 'border-gray-100 bg-gray-50'
            }`}
          >
            <Span className="text-lg">🔥</Span>
            <Div className={`mt-1 text-[11px] font-bold uppercase ${theme.accent}`}>
              {t('progress.streak')}
            </Div>
            <Div className={`text-2xl font-extrabold font-['Comfortaa'] ${theme.text}`}>
              {profile.streak}
              <Span className={`text-xs font-semibold ${theme.textMuted} ml-1`}>
                {t('progress.streakDays')}
              </Span>
            </Div>
          </Div>
          <Div
            className={`rounded-2xl px-3 py-3 border ${
              theme.isDark ? 'border-[#2A2A3A] bg-[#16161f]' : 'border-gray-100 bg-gray-50'
            }`}
          >
            <Span className="text-lg">⭐</Span>
            <Div className={`mt-1 text-[11px] font-bold uppercase ${theme.accent}`}>
              {t('progress.wordsLearned')}
            </Div>
            <Div className="text-2xl font-extrabold text-[#0D0D11] bg-[#D0FF00] inline-block px-1.5 rounded-md font-['Comfortaa']">
              {profile.wordsLearned}
            </Div>
          </Div>
          <Div
            className={`col-span-2 rounded-2xl px-3 py-3 border ${
              theme.isDark ? 'border-[#2A2A3A] bg-[#16161f]' : 'border-gray-100 bg-gray-50'
            }`}
          >
            <Div className={`text-[11px] font-bold uppercase ${theme.accent}`}>
              {t('progress.weekTitle')}
            </Div>
            <Div className={`mt-1 text-sm ${theme.text}`}>
              {t('profile.weekLine', {
                words: profile.weekWords,
                cards: profile.weekCards,
              })}
            </Div>
            <Div className={`mt-2 text-xs ${theme.textMuted}`}>
              {t('profile.cardsInDeck', { n: profile.cardsCount })}
            </Div>
          </Div>
          {profile.recentActivity && profile.recentActivity.length > 0 ? (
            <Div
              className={`col-span-2 rounded-2xl px-3 py-3 border ${
                theme.isDark ? 'border-[#2A2A3A] bg-[#16161f]' : 'border-gray-100 bg-gray-50'
              }`}
            >
              <Div className={`text-[11px] font-bold uppercase ${theme.accent}`}>
                {t('profile.activityTitle')}
              </Div>
              <Div className="mt-2 space-y-1.5">
                {profile.recentActivity.map((day) => (
                  <Div
                    key={day.date}
                    className="flex items-center justify-between gap-2 text-xs"
                  >
                    <Span className={theme.textMuted}>{day.date}</Span>
                    <Span className={theme.text}>
                      {t('profile.activityDay', {
                        words: day.wordsRead,
                        cards: day.cardsReviewed,
                      })}
                    </Span>
                  </Div>
                ))}
              </Div>
            </Div>
          ) : null}
        </Div>
      ) : null}
    </Div>
  );
}
