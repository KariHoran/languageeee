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
