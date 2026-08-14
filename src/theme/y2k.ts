/**
 * Y2K / WebCore / Aqua macOS design tokens.
 * Neon lime + violet accents, glassmorphism surfaces, midnight starfield.
 */

export type ThemeMode = 'aqua' | 'midnight';

export interface Y2kTheme {
  mode: ThemeMode;
  bg: string;
  bgAlt: string;
  surface: string;
  surfaceGlass: string;
  border: string;
  borderGlow: string;
  text: string;
  textMuted: string;
  textDim: string;
  accent: string;
  accentAlt: string;
  accentLime: string;
  accentViolet: string;
  accentPink: string;
  accentCyan: string;
  danger: string;
  success: string;
  folderYellow: string;
  folderBlue: string;
  folderPink: string;
  stickerYellow: string;
  stickerPink: string;
  stickerMint: string;
  stickerLavender: string;
  markerBa: string;
  markerBei: string;
  markerOther: string;
  gridPaper: string;
  cardShadow: string;
  neonGlow: string;
  statusBar: 'light' | 'dark';
}

export const AQUA_THEME: Y2kTheme = {
  mode: 'aqua',
  bg: '#F8F9FC',
  bgAlt: '#eef1f7',
  surface: '#ffffff',
  surfaceGlass: 'rgba(255,255,255,0.92)',
  border: '#e5e7eb',
  borderGlow: 'rgba(208,255,0,0.45)',
  text: '#111827',
  textMuted: '#4b5563',
  textDim: '#9ca3af',
  accent: '#7c3aed',
  accentAlt: '#D0FF00',
  accentLime: '#D0FF00',
  accentViolet: '#7c3aed',
  accentPink: '#ec4899',
  accentCyan: '#06b6d4',
  danger: '#ef4444',
  success: '#10b981',
  folderYellow: '#fbbf24',
  folderBlue: '#60a5fa',
  folderPink: '#f472b6',
  stickerYellow: '#fef3c7',
  stickerPink: '#fce7f3',
  stickerMint: '#d1fae5',
  stickerLavender: '#ede9fe',
  markerBa: 'rgba(244,114,182,0.35)',
  markerBei: 'rgba(124,58,237,0.3)',
  markerOther: 'rgba(208,255,0,0.35)',
  gridPaper: '#ffffff',
  cardShadow: 'rgba(15,23,42,0.08)',
  neonGlow: 'rgba(208,255,0,0.35)',
  statusBar: 'dark',
};

export const MIDNIGHT_THEME: Y2kTheme = {
  mode: 'midnight',
  bg: '#0D0D11',
  bgAlt: '#14141c',
  surface: 'rgba(30,30,40,0.88)',
  surfaceGlass: 'rgba(30,30,40,0.72)',
  border: '#2A2A3A',
  borderGlow: 'rgba(208,255,0,0.4)',
  text: '#e8e8f0',
  textMuted: '#a8a8b8',
  textDim: '#6e6e80',
  accent: '#8B5CF6',
  accentAlt: '#D0FF00',
  accentLime: '#D0FF00',
  accentViolet: '#8B5CF6',
  accentPink: '#FF6584',
  accentCyan: '#5ef0ff',
  danger: '#ff6b8a',
  success: '#5dffb8',
  folderYellow: '#e8c84a',
  folderBlue: '#5a9fff',
  folderPink: '#ff8ec8',
  stickerYellow: '#3d3818',
  stickerPink: '#3d1a2e',
  stickerMint: '#1a3d30',
  stickerLavender: '#2a2040',
  markerBa: 'rgba(255,122,217,0.55)',
  markerBei: 'rgba(139,92,246,0.55)',
  markerOther: 'rgba(208,255,0,0.35)',
  gridPaper: '#14141c',
  cardShadow: 'rgba(0,0,0,0.45)',
  neonGlow: 'rgba(208,255,0,0.22)',
  statusBar: 'light',
};

export type RadioPresetId = 'genshin' | 'lofi' | 'forest';

/** Пресет ambient или `user:<id>` для файла с устройства */
export type RadioPlaylistId = RadioPresetId | `user:${string}` | string;

export const RADIO_PLAYLISTS: Array<{
  id: RadioPresetId;
  label: string;
  emoji: string;
}> = [
  { id: 'genshin', label: 'Genshin / Honkai Ambient', emoji: '🌙' },
  { id: 'lofi', label: 'Chinese Lo-Fi Beats', emoji: '🎧' },
  { id: 'forest', label: 'Ночной лес', emoji: '🌲' },
];

const PRESET_IDS = new Set<string>(RADIO_PLAYLISTS.map((p) => p.id));

/** Миграция: rainy → forest; неизвестные id → lofi; user:* сохраняем */
export function normalizeRadioPlaylistId(id: string | undefined | null): RadioPlaylistId {
  if (!id || id === 'rainy') return 'forest';
  if (PRESET_IDS.has(id)) return id as RadioPresetId;
  if (id.startsWith('user:')) return id;
  return 'lofi';
}

export function isUserTrackPlaylistId(id: string): id is `user:${string}` {
  return id.startsWith('user:');
}

export function userTrackIdFromPlaylist(id: string): string | null {
  if (!isUserTrackPlaylistId(id)) return null;
  return id.slice('user:'.length);
}

export function playlistIdForUserTrack(trackId: string): RadioPlaylistId {
  return `user:${trackId}`;
}

export const STICKER_DECORS = ['🌸', '⭐', '💿', '🎀', '🧃', '🐱', '💫', '📎'] as const;

export function grammarMarkerKind(structure: string): 'ba' | 'bei' | 'other' {
  if (/把/.test(structure)) return 'ba';
  if (/被/.test(structure)) return 'bei';
  return 'other';
}

export function markerColor(theme: Y2kTheme, structure: string): string {
  const kind = grammarMarkerKind(structure);
  if (kind === 'ba') return theme.markerBa;
  if (kind === 'bei') return theme.markerBei;
  return theme.markerOther;
}
