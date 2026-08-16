/**
 * PNG-карточка прогресса для Stories / портфолио (canvas, без внешних libs).
 * Скачивание синхронное (toDataURL), чтобы не терять user gesture в Safari.
 */
import { Platform } from 'react-native';
import { downloadTextFile } from './flashcardsExport';

export interface ProgressSharePayload {
  streak: number;
  wordsLearned: number;
  weekWords: number;
  weekCards: number;
  displayName?: string;
}

function hostLabel(): string {
  if (typeof window !== 'undefined' && window.location?.host) {
    return window.location.host;
  }
  return 'languageeee.app';
}

export async function downloadProgressShareImage(
  payload: ProgressSharePayload
): Promise<boolean> {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return false;

  const w = 1080;
  const h = 1080;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return false;

  const grad = ctx.createLinearGradient(0, 0, w, h);
  grad.addColorStop(0, '#0D0D11');
  grad.addColorStop(0.55, '#1a1030');
  grad.addColorStop(1, '#0D0D11');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  ctx.fillStyle = 'rgba(208,255,0,0.12)';
  ctx.beginPath();
  ctx.arc(860, 180, 220, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(139,92,246,0.18)';
  ctx.beginPath();
  ctx.arc(180, 900, 280, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#D0FF00';
  ctx.font = 'bold 48px Comfortaa, system-ui, sans-serif';
  ctx.fillText('languageeee', 80, 120);

  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.font = '28px system-ui, sans-serif';
  ctx.fillText(payload.displayName || 'My progress', 80, 175);

  const rows: Array<{ label: string; value: string }> = [
    { label: '🔥 Streak', value: `${payload.streak}` },
    { label: '⭐ Words', value: `${payload.wordsLearned}` },
    { label: '📖 Week words', value: `${payload.weekWords}` },
    { label: '🃏 Week cards', value: `${payload.weekCards}` },
  ];

  let y = 320;
  for (const row of rows) {
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    roundRect(ctx, 80, y - 70, w - 160, 120, 28);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.font = '26px system-ui, sans-serif';
    ctx.fillText(row.label, 120, y);
    ctx.fillStyle = '#D0FF00';
    ctx.font = 'bold 56px Comfortaa, system-ui, sans-serif';
    ctx.fillText(row.value, 120, y + 55);
    y += 160;
  }

  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.font = '22px system-ui, sans-serif';
  ctx.fillText(hostLabel(), 80, h - 60);

  let dataUrl: string;
  try {
    dataUrl = canvas.toDataURL('image/png');
  } catch {
    return false;
  }
  if (!dataUrl || dataUrl === 'data:,') return false;

  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = `languageeee-progress-${new Date().toISOString().slice(0, 10)}.png`;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  return true;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Fallback: текстовая карточка, если canvas недоступен */
export async function downloadProgressShareText(
  payload: ProgressSharePayload
): Promise<boolean> {
  const stamp = new Date().toISOString().slice(0, 10);
  const body = [
    'languageeee · progress',
    payload.displayName || '',
    `Streak: ${payload.streak}`,
    `Words learned: ${payload.wordsLearned}`,
    `Week: ${payload.weekWords} words · ${payload.weekCards} cards`,
    stamp,
  ]
    .filter(Boolean)
    .join('\n');
  return downloadTextFile(`languageeee-progress-${stamp}.txt`, body);
}
