import type { Book, Paragraph } from '../types';
import { formatBookTitleLine, resolveBookTitles } from './bookTitle';

/** Безопасное имя файла из названия фанфика. */
export function sanitizeDownloadFilename(title: string): string {
  const base =
    title
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\w\u0400-\u04ff\u4e00-\u9fff\-]+/gi, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 80) || 'fanfic';
  return `${base}_translated.txt`;
}

function paragraphOriginal(p: Paragraph, isEnglish: boolean): string {
  if (isEnglish) {
    return (
      p.englishText?.trim() ||
      p.originalText?.trim() ||
      p.chineseText?.trim() ||
      ''
    );
  }
  return (
    p.chineseText?.trim() ||
    p.originalText?.trim() ||
    p.englishText?.trim() ||
    ''
  );
}

function paragraphRussian(p: Paragraph): string {
  return p.russianTranslation?.trim() || '';
}

/**
 * Собирает .txt: заголовок + абзацы (оригинал / перевод / ключевые слова).
 */
export function buildBookExportText(book: Book): string {
  const isEnglish = book.language === 'en';
  const titles = resolveBookTitles(book);
  const lines: string[] = [];

  lines.push(formatBookTitleLine(book));
  if (titles.russian && titles.russian !== titles.original) {
    lines.push(`Оригинал: ${titles.original}`);
    lines.push(`Перевод названия: ${titles.russian}`);
  }
  lines.push(
    `Язык: ${isEnglish ? 'English' : '中文'} · HSK/уровень: ${book.targetHskLevel}`
  );
  lines.push(`Экспорт: ${new Date().toLocaleString('ru-RU')}`);
  lines.push('');
  lines.push('═'.repeat(40));
  lines.push('');

  const paragraphs = book.paragraphs ?? [];
  paragraphs.forEach((p, i) => {
    const original = paragraphOriginal(p, isEnglish);
    const ru = paragraphRussian(p);
    lines.push(`── Абзац ${i + 1} ──`);
    if (original) {
      lines.push(isEnglish ? 'Original:' : '原文:');
      lines.push(original);
      lines.push('');
    }
    if (ru) {
      lines.push('Перевод:');
      lines.push(ru);
      lines.push('');
    }

    const words = (p.words ?? []).filter(
      (w) => w.hanzi?.trim() && (w.translation?.trim() || w.pinyin?.trim())
    );
    if (words.length > 0) {
      lines.push('Слова:');
      for (const w of words.slice(0, 40)) {
        const py = w.pinyin?.trim() ? ` (${w.pinyin.trim()})` : '';
        const tr = w.translation?.trim() || '—';
        lines.push(`  • ${w.hanzi}${py} — ${tr}`);
      }
      if (words.length > 40) {
        lines.push(`  … и ещё ${words.length - 40}`);
      }
      lines.push('');
    }

    if ((p.grammar ?? []).length > 0) {
      lines.push('Грамматика:');
      for (const g of p.grammar) {
        lines.push(`  • ${g.structure}: ${g.explanation}`);
        if (g.example?.trim()) lines.push(`    пр.: ${g.example.trim()}`);
      }
      lines.push('');
    }

    lines.push('');
  });

  lines.push('═'.repeat(40));
  lines.push('Скачано из Languageeee');
  return lines.join('\n').trim() + '\n';
}

/**
 * Скачивание через Blob + временный `<a download>` (web).
 * @returns имя файла или null, если не удалось
 */
export function downloadBookAsTextFile(book: Book): string | null {
  if (typeof document === 'undefined' || typeof URL === 'undefined') {
    return null;
  }
  const text = buildBookExportText(book);
  if (!text.trim()) return null;

  const filename = sanitizeDownloadFilename(
    resolveBookTitles(book).original || book.title || 'fanfic'
  );
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
  return filename;
}
