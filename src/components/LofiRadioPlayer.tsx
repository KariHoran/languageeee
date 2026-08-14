import React, { useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { ambientRadio, useAmbientRadio } from '../services/ambientRadio';
import { useAppStore } from '../store/useAppStore';
import { useTheme } from '../theme/ThemeContext';
import { RADIO_PLAYLISTS, normalizeRadioPlaylistId, type RadioPlaylistId } from '../theme/y2k';

/** Плавающий мини-плеер в стиле Winamp / кассеты */
export default function LofiRadioPlayer() {
  const theme = useTheme();
  const [expanded, setExpanded] = useState(false);
  const playlist = useAppStore((s) => s.radioPlaylist);
  const playing = useAppStore((s) => s.radioPlaying);
  const setPlaylist = useAppStore((s) => s.setRadioPlaylist);
  const togglePlaying = useAppStore((s) => s.toggleRadioPlaying);

  useAmbientRadio(playing, playlist);

  const current =
    RADIO_PLAYLISTS.find((p) => p.id === normalizeRadioPlaylistId(playlist)) ??
    RADIO_PLAYLISTS[1];

  return (
    <View
      style={[
        styles.wrap,
        {
          backgroundColor: theme.surfaceGlass,
          borderColor: playing ? theme.accentLime : theme.border,
          shadowColor: theme.accentViolet,
        },
      ]}
      pointerEvents="box-none"
    >
      <Pressable
        style={styles.cassette}
        onPress={() => setExpanded((e) => !e)}
        accessibilityRole="button"
        accessibilityLabel="Lofi radio"
      >
        <View style={[styles.reel, { borderColor: theme.accentViolet }]}>
          <View
            style={[
              styles.reelHub,
              {
                backgroundColor: playing ? theme.accentLime : theme.accentCyan,
              },
            ]}
          />
        </View>
        <View style={styles.meta}>
          <Text style={[styles.title, { color: theme.text }]} numberOfLines={1}>
            📻 {current.emoji} {playing ? 'ON AIR' : 'STANDBY'}
          </Text>
          <Text style={[styles.sub, { color: theme.textMuted }]} numberOfLines={1}>
            {current.label}
          </Text>
        </View>
        <Pressable
          style={[
            styles.playBtn,
            {
              backgroundColor: playing ? theme.accentPink : theme.accentLime,
            },
          ]}
          onPress={(e) => {
            e.stopPropagation?.();
            void ambientRadio.unlock();
            togglePlaying();
          }}
          hitSlop={8}
        >
          <Text style={styles.playBtnText}>{playing ? '❚❚' : '▶'}</Text>
        </Pressable>
      </Pressable>

      {expanded && (
        <View style={styles.playlist}>
          {RADIO_PLAYLISTS.map((p) => {
            const active = p.id === playlist;
            return (
              <Pressable
                key={p.id}
                style={[
                  styles.track,
                  active && {
                    backgroundColor: theme.neonGlow,
                    borderColor: theme.accentLime,
                  },
                ]}
                onPress={() => {
                  void ambientRadio.unlock();
                  setPlaylist(p.id as RadioPlaylistId);
                  if (!playing) togglePlaying();
                }}
              >
                <Text style={[styles.trackText, { color: theme.text }]}>
                  {p.emoji} {p.label}
                </Text>
              </Pressable>
            );
          })}
          <Text style={[styles.hint, { color: theme.textDim }]}>
            Ambient · procedural · Y2K radio
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    right: 14,
    bottom: 18,
    zIndex: 100,
    minWidth: 220,
    maxWidth: 300,
    borderRadius: 14,
    borderWidth: 1.5,
    padding: 8,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 10,
  },
  cassette: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  reel: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reelHub: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  meta: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  sub: {
    fontSize: 10,
    marginTop: 1,
  },
  playBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#1a1a1a',
  },
  playlist: {
    marginTop: 8,
    gap: 4,
  },
  track: {
    paddingVertical: 7,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  trackText: {
    fontSize: 11,
    fontWeight: '600',
  },
  hint: {
    fontSize: 9,
    textAlign: 'center',
    marginTop: 4,
  },
});
