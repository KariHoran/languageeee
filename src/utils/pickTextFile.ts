import { Platform } from 'react-native';
import { sanitizeUserText } from './sanitizeUserText';

const TEXT_ACCEPT = '.txt,.md,.pdf,text/plain,application/pdf';

function isPdfName(name: string): boolean {
  return /\.pdf$/i.test(name);
}

/** Грубая попытка вытащить строки из PDF (без pdf.js). */
function extractTextFromPdfBytes(bytes: Uint8Array): string {
  const decoder = new TextDecoder('latin1');
  const raw = decoder.decode(bytes);
  const chunks: string[] = [];

  const tjRe = /\((?:\\.|[^\\)])+\)\s*Tj/g;
  let m: RegExpExecArray | null;
  while ((m = tjRe.exec(raw))) {
    const inner = m[0].slice(1, m[0].lastIndexOf(')'));
    const decoded = inner
      .replace(/\\n/g, '\n')
      .replace(/\\r/g, '')
      .replace(/\\t/g, '\t')
      .replace(/\\\(/g, '(')
      .replace(/\\\)/g, ')')
      .replace(/\\\\/g, '\\');
    if (decoded.trim()) chunks.push(decoded);
  }

  const tjArrayRe = /\[(.*?)\]\s*TJ/gs;
  while ((m = tjArrayRe.exec(raw))) {
    const parts = m[1].match(/\((?:\\.|[^\\)])+\)/g) ?? [];
    for (const p of parts) {
      const inner = p.slice(1, -1);
      if (inner.trim()) chunks.push(inner);
    }
  }

  // UTF-16BE hex strings often used for CJK
  const hexRe = /<([0-9A-Fa-f]{4,})>\s*Tj/g;
  while ((m = hexRe.exec(raw))) {
    const hex = m[1];
    if (hex.length % 4 !== 0) continue;
    let s = '';
    for (let i = 0; i < hex.length; i += 4) {
      const code = parseInt(hex.slice(i, i + 4), 16);
      if (code) s += String.fromCharCode(code);
    }
    if (/[\u4e00-\u9fff]/.test(s)) chunks.push(s);
  }

  return chunks.join('').replace(/\s+/g, ' ').trim();
}

async function readFileAsText(file: File): Promise<string> {
  if (isPdfName(file.name) || file.type === 'application/pdf') {
    const buf = await file.arrayBuffer();
    const extracted = extractTextFromPdfBytes(new Uint8Array(buf));
    if (extracted.length >= 8) return sanitizeUserText(extracted);
    throw new Error(
      'Не удалось извлечь текст из PDF. Сохраните файл как .txt и попробуйте снова.'
    );
  }
  return sanitizeUserText(await file.text());
}

export interface PickedFileResult {
  text: string;
  fileName: string;
}

/**
 * Открывает диалог выбора .txt/.md/.pdf и возвращает содержимое.
 * На web использует нативный input[type=file].
 */
export function pickTextFile(): Promise<string | null> {
  return pickTextFileDetailed().then((r) => r?.text ?? null);
}

export function pickTextFileDetailed(): Promise<PickedFileResult | null> {
  if (Platform.OS === 'web') {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = TEXT_ACCEPT;
      input.onchange = async () => {
        const file = input.files?.[0];
        if (!file) {
          resolve(null);
          return;
        }
        try {
          const text = await readFileAsText(file);
          resolve({ text, fileName: file.name });
        } catch (e) {
          console.error('[pickTextFile]', e);
          resolve(null);
        }
      };
      input.click();
    });
  }

  return Promise.resolve(null);
}

/** Читает File из drag-and-drop (web). */
export async function readDroppedFile(file: File): Promise<PickedFileResult> {
  const ok =
    /\.(txt|md|pdf)$/i.test(file.name) ||
    file.type.startsWith('text/') ||
    file.type === 'application/pdf';
  if (!ok) {
    throw new Error('Поддерживаются только .txt, .md и .pdf');
  }
  const text = await readFileAsText(file);
  if (!text.trim()) {
    throw new Error('Файл пустой или текст не извлечён');
  }
  return { text, fileName: file.name };
}

export function isSupportedDropFile(file: File): boolean {
  return (
    /\.(txt|md|pdf)$/i.test(file.name) ||
    file.type.startsWith('text/') ||
    file.type === 'application/pdf'
  );
}
