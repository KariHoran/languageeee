/**
 * Экспорт колоды: CSV (Excel) и TSV (Anki «Import»).
 */
import type { Flashcard } from '../types';
import { Platform } from 'react-native';

function escCsv(value: string): string {
  const s = String(value ?? '');
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function escTsv(value: string): string {
  return String(value ?? '')
    .replace(/\t/g, ' ')
    .replace(/\r?\n/g, '<br>');
}

export function flashcardsToCsv(cards: Flashcard[]): string {
  const header = [
    'id',
    'surface',
    'pinyin',
    'translation',
    'language',
    'kind',
    'hskLevel',
    'context',
    'source',
    'interval',
    'repetition',
    'easeFactor',
    'nextReviewDate',
  ];
  const rows = cards.map((c) =>
    [
      c.id,
      c.hanzi,
      c.pinyin ?? '',
      c.translation ?? '',
      c.language ?? 'zh',
      c.kind ?? 'word',
      c.hskLevel != null ? String(c.hskLevel) : '',
      c.contextSentence ?? '',
      c.sourceTitle ?? '',
      String(c.interval ?? 0),
      String(c.repetition ?? 0),
      String(c.easeFactor ?? 2.5),
      c.nextReviewDate ?? '',
    ]
      .map(escCsv)
      .join(',')
  );
  return [header.join(','), ...rows].join('\n');
}

/** Anki text import: Front \\t Back \\t Extra */
export function flashcardsToAnkiTsv(cards: Flashcard[]): string {
  return cards
    .map((c) => {
      const front =
        (c.kind === 'grammar' ? `[grammar] ${c.hanzi}` : c.hanzi) +
        (c.pinyin ? `<br><i>${c.pinyin}</i>` : '');
      const back = c.translation || '';
      const extra = [c.contextSentence, c.sourceTitle].filter(Boolean).join(' · ');
      return [escTsv(front), escTsv(back), escTsv(extra)].join('\t');
    })
    .join('\n');
}

export async function downloadTextFile(
  filename: string,
  content: string,
  mime = 'text/plain;charset=utf-8'
): Promise<boolean> {
  if (Platform.OS !== 'web' || typeof document === 'undefined') {
    console.warn('[flashcardsExport] download only on web');
    return false;
  }
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  return true;
}

export async function exportFlashcardsCsv(cards: Flashcard[]): Promise<boolean> {
  const stamp = new Date().toISOString().slice(0, 10);
  return downloadTextFile(
    `languageeee-cards-${stamp}.csv`,
    flashcardsToCsv(cards),
    'text/csv;charset=utf-8'
  );
}

export async function exportFlashcardsAnki(cards: Flashcard[]): Promise<boolean> {
  const stamp = new Date().toISOString().slice(0, 10);
  return downloadTextFile(
    `languageeee-anki-${stamp}.txt`,
    flashcardsToAnkiTsv(cards),
    'text/tab-separated-values;charset=utf-8'
  );
}

/** Парсинг Anki TXT / TSV: Front \\t Back [\\t Extra] */
export function parseAnkiTsv(raw: string): Array<{
  hanzi: string;
  translation: string;
  contextSentence?: string;
  pinyin?: string;
}> {
  const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const out: Array<{
    hanzi: string;
    translation: string;
    contextSentence?: string;
    pinyin?: string;
  }> = [];
  for (const line of lines) {
    if (line.startsWith('#') || line.startsWith('tags:')) continue;
    const parts = line.split('\t');
    if (parts.length < 2) continue;
    const frontHtml = parts[0] ?? '';
    const back = (parts[1] ?? '').replace(/<br\s*\/?>/gi, ' ').trim();
    const extra = (parts[2] ?? '').replace(/<br\s*\/?>/gi, ' ').trim();
    const frontParts = frontHtml.split(/<br\s*\/?>/i).map((s) =>
      s.replace(/<[^>]+>/g, '').trim()
    );
    const hanzi = frontParts[0] || '';
    const pinyin = frontParts[1]?.replace(/^\[grammar\]\s*/i, '') || undefined;
    const surface = hanzi.replace(/^\[grammar\]\s*/i, '').trim();
    if (!surface) continue;
    out.push({
      hanzi: surface,
      translation: back,
      pinyin,
      contextSentence: extra || undefined,
    });
  }
  return out;
}

export async function importFlashcardsFromAnkiText(
  raw: string
): Promise<{ added: number; skipped: number }> {
  const { addFlashcard, hasFlashcard, inferFlashcardLanguage } = await import(
    './flashcardsStore'
  );
  const rows = parseAnkiTsv(raw);
  let added = 0;
  let skipped = 0;
  for (const row of rows) {
    try {
      const language = inferFlashcardLanguage(row.hanzi);
      if (await hasFlashcard(row.hanzi, language)) {
        skipped += 1;
        continue;
      }
      await addFlashcard({
        hanzi: row.hanzi,
        translation: row.translation,
        pinyin: row.pinyin,
        language,
        contextSentence: row.contextSentence,
        sourceTitle: 'Anki import',
      });
      added += 1;
    } catch {
      skipped += 1;
    }
  }
  return { added, skipped };
}

/** Выбор файла на web → импорт Anki TSV/TXT. */
export async function pickAndImportAnkiFile(): Promise<{
  added: number;
  skipped: number;
} | null> {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return null;
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.txt,.tsv,.csv,text/plain';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) {
        resolve(null);
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        void importFlashcardsFromAnkiText(String(reader.result || '')).then(
          resolve,
          () => resolve(null)
        );
      };
      reader.onerror = () => resolve(null);
      reader.readAsText(file);
    };
    input.click();
  });
}
