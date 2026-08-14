import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ambientRadio, useAmbientRadio } from '../services/ambientRadio';
import {
  addUserTrackFromFile,
  getUserTracks,
  removeUserTrack,
  USER_TRACK_MAX_BYTES,
  type UserTrack,
} from '../services/userTracksStore';
import { subscribeSyncState } from '../services/syncService';
import { subscribeLocalDataReset } from '../services/localDataResetService';
import { useAppStore } from '../store/useAppStore';
import { useI18n } from '../i18n/useI18n';
import {
  isUserTrackPlaylistId,
  normalizeRadioPlaylistId,
  playlistIdForUserTrack,
  RADIO_PLAYLISTS,
  userTrackIdFromPlaylist,
  type RadioPlaylistId,
  type RadioPresetId,
} from '../theme/y2k';
import { Button, Div, Span } from './dom';
import { GlassWindow } from './GlassWindow';
import { useWebTheme } from './webTheme';

function formatTime(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return '0:00';
  const s = Math.floor(sec % 60);
  const m = Math.floor(sec / 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

function formatMb(bytes: number): string {
  return (bytes / (1024 * 1024)).toFixed(0);
}

export function MiniPlayPanel({
  widthClass = 'w-[250px] shrink-0',
  compact = false,
}: {
  widthClass?: string;
  /** Ужать обложку / отступы для мобильного sheet */
  compact?: boolean;
}) {
  const theme = useWebTheme();
  const { t } = useI18n();
  const playlist = useAppStore((s) => normalizeRadioPlaylistId(s.radioPlaylist));
  const playing = useAppStore((s) => s.radioPlaying);
  const volume = useAppStore((s) => s.radioVolume ?? 0.7);
  const setPlaylist = useAppStore((s) => s.setRadioPlaylist);
  const setPlaying = useAppStore((s) => s.setRadioPlaying);
  const togglePlaying = useAppStore((s) => s.toggleRadioPlaying);
  const setVolume = useAppStore((s) => s.setRadioVolume);

  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [seekable, setSeekable] = useState(false);
  const [scrubbing, setScrubbing] = useState(false);
  const [scrubValue, setScrubValue] = useState(0);

  const [userTracks, setUserTracks] = useState<UserTrack[]>([]);
  const [addError, setAddError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const scrubbingRef = useRef(false);

  useAmbientRadio(playing, playlist, volume);

  const reloadTracks = useCallback(async () => {
    // Только файлы с устройства — URL-треки скрываем
    const all = await getUserTracks();
    setUserTracks(all.filter((t) => t.source !== 'url'));
  }, []);

  useEffect(() => {
    void reloadTracks();
  }, [reloadTracks]);

  useEffect(() => {
    return subscribeSyncState((state) => {
      if (state.status === 'synced') void reloadTracks();
    });
  }, [reloadTracks]);

  useEffect(() => {
    return subscribeLocalDataReset(() => {
      setUserTracks([]);
      void reloadTracks();
    });
  }, [reloadTracks]);

  // Если сохранён старый URL-трек или битый id — сбросить на lofi
  useEffect(() => {
    const tid = userTrackIdFromPlaylist(playlist);
    if (!tid) return;
    // Список ещё грузится — не сбрасываем преждевременно
    if (userTracks.length === 0 && busy) return;
    if (userTracks.some((t) => t.id === tid)) return;

    let cancelled = false;
    void getUserTracks().then((all) => {
      if (cancelled) return;
      const found = all.find((t) => t.id === tid && t.source !== 'url');
      if (!found) {
        setPlaylist('lofi');
        setPlaying(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [playlist, userTracks, busy, setPlaylist, setPlaying]);

  useEffect(() => {
    const tick = () => {
      const st = ambientRadio.getPlaybackState();
      setSeekable(st.seekable);
      setDuration(st.duration);
      if (!scrubbingRef.current) {
        setPosition(st.currentTime);
      }
    };
    tick();
    const id = window.setInterval(tick, 200);
    return () => window.clearInterval(id);
  }, [playlist, playing]);

  useEffect(() => {
    setPosition(0);
    setDuration(0);
    setScrubbing(false);
    scrubbingRef.current = false;
  }, [playlist]);

  const allIds = useMemo(() => {
    const presets = RADIO_PLAYLISTS.map((p) => p.id as RadioPlaylistId);
    const customs = userTracks.map((t) => playlistIdForUserTrack(t.id));
    return [...presets, ...customs];
  }, [userTracks]);

  const currentLabel = useMemo(() => {
    const preset = RADIO_PLAYLISTS.find((p) => p.id === playlist);
    if (preset) return { emoji: preset.emoji, label: preset.label };
    const tid = userTrackIdFromPlaylist(playlist);
    const track = tid ? userTracks.find((t) => t.id === tid) : null;
    if (track) return { emoji: '🎵', label: track.title };
    return { emoji: '🎧', label: 'Ambient' };
  }, [playlist, userTracks]);

  const displayTime = scrubbing ? scrubValue : position;
  const canSeek = seekable && duration > 0 && isUserTrackPlaylistId(playlist);

  const unlock = () => {
    void ambientRadio.unlock();
  };

  const commitSeek = async (seconds: number) => {
    scrubbingRef.current = false;
    setScrubbing(false);
    await ambientRadio.seekTo(seconds);
    setPosition(seconds);
  };

  const skip = (dir: -1 | 1) => {
    unlock();
    if (allIds.length === 0) return;
    const i = Math.max(0, allIds.indexOf(playlist));
    const next = allIds[(i + dir + allIds.length) % allIds.length]!;
    setPlaylist(next);
    if (!playing) setPlaying(true);
  };

  const handleToggle = () => {
    unlock();
    togglePlaying();
  };

  const handleSelectPreset = (id: RadioPresetId) => {
    unlock();
    setPlaylist(id);
    if (!playing) setPlaying(true);
  };

  const handleSelectTrack = (trackId: string) => {
    unlock();
    setPlaylist(playlistIdForUserTrack(trackId));
    if (!playing) setPlaying(true);
  };

  const handleFile = async (file: File | null | undefined) => {
    if (!file || busy) return;
    setBusy(true);
    setAddError(null);

    let settled = false;
    const safetyTimer = window.setTimeout(() => {
      if (settled) return;
      setBusy(false);
      setAddError(t('mini.uploadTimeout'));
      void reloadTracks();
    }, 60_000);

    try {
      const track = await addUserTrackFromFile(file);
      await reloadTracks();
      unlock();
      setPlaylist(playlistIdForUserTrack(track.id));
      setPlaying(true);
    } catch (err) {
      console.error('[MiniPlay] file upload failed', err);
      setAddError(err instanceof Error ? err.message : String(err));
      void reloadTracks();
    } finally {
      settled = true;
      window.clearTimeout(safetyTimer);
      setBusy(false);
    }
  };

  const handleRemoveTrack = async (trackId: string) => {
    await removeUserTrack(trackId);
    if (userTrackIdFromPlaylist(playlist) === trackId) {
      setPlaylist('lofi');
      setPlaying(false);
    }
    await reloadTracks();
  };

  return (
    <GlassWindow
      title="MiniPlay"
      widthClass={widthClass}
      className="h-full max-h-full"
    >
      <Div className={`flex flex-col items-center ${compact ? 'gap-2' : 'gap-3'}`}>
        <Div
          className={`relative rounded-2xl bg-gradient-to-br from-teal-400/30 via-transparent to-[#D0FF00]/25 border ${theme.border} shadow-md flex items-center justify-center overflow-hidden ${
            compact ? 'w-24 h-24' : 'w-28 h-28 sm:w-36 sm:h-36'
          }`}
        >
          <Span
            className={`${compact ? 'text-3xl' : 'text-4xl sm:text-5xl'} ${
              playing ? 'animate-[shimmer_2.4s_ease-in-out_infinite]' : ''
            }`}
          >
            {currentLabel.emoji}
          </Span>
        </Div>

        <Div className="w-full text-center px-1">
          <Div className={`font-['Comfortaa'] font-bold ${theme.accent} text-sm truncate`}>
            {currentLabel.label}
          </Div>
          <Div className={`text-xs ${theme.textMuted} mt-0.5 font-semibold`}>
            {playing ? t('mini.nowPlaying') : t('mini.paused')}
          </Div>
        </Div>

        <Div className="w-full px-1 space-y-1">
          <input
            type="range"
            min={0}
            max={canSeek ? duration : 1}
            step={0.1}
            disabled={!canSeek}
            value={canSeek ? Math.min(displayTime, duration || 0) : 0}
            className="w-full accent-[#D0FF00] disabled:opacity-40"
            title={canSeek ? t('mini.seek') : t('mini.seekOwnTracks')}
            onPointerDown={() => {
              if (!canSeek) return;
              scrubbingRef.current = true;
              setScrubbing(true);
            }}
            onChange={(e) => {
              if (!canSeek) return;
              const v = Number(e.target.value);
              scrubbingRef.current = true;
              setScrubbing(true);
              setScrubValue(v);
            }}
            onPointerUp={(e) => {
              if (!canSeek) return;
              const v = Number((e.target as HTMLInputElement).value);
              void commitSeek(v);
            }}
            onKeyUp={(e) => {
              if (!canSeek) return;
              if (
                e.key === 'ArrowLeft' ||
                e.key === 'ArrowRight' ||
                e.key === 'Home' ||
                e.key === 'End'
              ) {
                const v = Number((e.target as HTMLInputElement).value);
                void commitSeek(v);
              }
            }}
          />
          <Div className={`flex justify-between text-[10px] font-semibold ${theme.textMuted}`}>
            <Span>{canSeek ? formatTime(displayTime) : '—:—'}</Span>
            <Span>
              {canSeek
                ? formatTime(duration)
                : isUserTrackPlaylistId(playlist)
                  ? t('mini.loadingShort')
                  : '∞'}
            </Span>
          </Div>
        </Div>

        <Div className="flex items-center gap-3">
          <Button
            type="button"
            className={`w-9 h-9 rounded-full ${theme.card} ${theme.accent} text-sm font-bold transition`}
            onClick={() => skip(-1)}
            title={t('action.back')}
          >
            ⏮
          </Button>
          <Button
            type="button"
            className="w-12 h-12 rounded-full bg-[#D0FF00] text-[#0D0D11] text-lg font-bold hover:bg-[#b8e600] transition"
            onClick={handleToggle}
            title={playing ? t('mini.paused') : t('mini.nowPlaying')}
          >
            {playing ? '❚❚' : '▶'}
          </Button>
          <Button
            type="button"
            className={`w-9 h-9 rounded-full ${theme.card} ${theme.accent} text-sm font-bold transition`}
            onClick={() => skip(1)}
            title={t('action.next')}
          >
            ⏭
          </Button>
        </Div>

        <Div className="w-full px-1 space-y-1">
          <Div className={`flex justify-between text-[10px] font-bold ${theme.textMuted}`}>
            <Span>{t('mini.volume')}</Span>
            <Span>{Math.round(volume * 100)}%</Span>
          </Div>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={volume}
            onChange={(e) => setVolume(Number(e.target.value))}
            className="w-full accent-[#D0FF00]"
          />
        </Div>

        <Div
          className={`w-full flex flex-col gap-1.5 mt-1 overflow-y-auto ${
            compact ? 'max-h-28' : 'max-h-40'
          }`}
        >
          <Div className={`text-[10px] font-bold uppercase tracking-wide ${theme.textMuted} px-1`}>
            Ambient
          </Div>
          {RADIO_PLAYLISTS.map((p) => {
            const active = p.id === playlist;
            return (
              <Button
                key={p.id}
                type="button"
                className={`text-left px-2.5 py-2 rounded-xl text-xs font-semibold transition border ${
                  active
                    ? 'bg-[#D0FF00] border-[#D0FF00] text-[#0D0D11]'
                    : `${theme.card} ${theme.textMuted}`
                }`}
                onClick={() => handleSelectPreset(p.id)}
              >
                {p.emoji} {p.label}
              </Button>
            );
          })}

          <Div className={`text-[10px] font-bold uppercase tracking-wide ${theme.textMuted} px-1 mt-1`}>
            {t('mini.title')}
          </Div>
          <Div className={`text-[10px] px-1 ${theme.textMuted}`}>
            {t('mini.localHint', { n: formatMb(USER_TRACK_MAX_BYTES) })}
          </Div>
          {userTracks.length === 0 ? (
            <Div className={`text-[11px] px-1 ${theme.textMuted}`}>
              {t('mini.empty')}
            </Div>
          ) : (
            userTracks.map((track) => {
              const id = playlistIdForUserTrack(track.id);
              const active = playlist === id;
              return (
                <Div key={track.id} className="flex gap-1 items-stretch">
                  <Button
                    type="button"
                    className={`flex-1 text-left px-2.5 py-2 rounded-xl text-xs font-semibold transition border truncate ${
                      active
                        ? 'bg-[#D0FF00] border-[#D0FF00] text-[#0D0D11]'
                        : `${theme.card} ${theme.textMuted}`
                    }`}
                    onClick={() => handleSelectTrack(track.id)}
                    title={t('mini.localDevice', { title: track.title })}
                  >
                    📱 {track.title}
                  </Button>
                  <Button
                    type="button"
                    className={`shrink-0 w-8 rounded-xl text-xs border ${theme.border} ${theme.danger}`}
                    onClick={() => void handleRemoveTrack(track.id)}
                    title={t('mini.delete')}
                  >
                    ✕
                  </Button>
                </Div>
              );
            })
          )}
        </Div>

        <input
          ref={fileRef as React.RefObject<HTMLInputElement>}
          type="file"
          accept="audio/*,.mp3,.ogg,.wav,.m4a,.aac"
          className="hidden"
          onChange={(e) => {
            const f = (e.target as HTMLInputElement).files?.[0];
            void handleFile(f);
            (e.target as HTMLInputElement).value = '';
          }}
        />
        <Button
          type="button"
          disabled={busy}
          className={`w-full rounded-xl py-2 text-xs font-bold border transition ${theme.border} ${theme.text} ${theme.hover} disabled:opacity-50`}
          onClick={() => {
            setAddError(null);
            fileRef.current?.click();
          }}
        >
          {busy
            ? t('library.loading')
            : t('mini.upload', { n: formatMb(USER_TRACK_MAX_BYTES) })}
        </Button>
        {addError ? (
          <Div className="w-full text-[11px] text-red-400 leading-snug px-1">{addError}</Div>
        ) : null}
      </Div>
    </GlassWindow>
  );
}
