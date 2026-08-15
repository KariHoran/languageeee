/**
 * Локальный «офлайн-пин» книг: какие тексты точно лежат на устройстве.
 * Cloud sync пишет slim-параграфы без words — пин + richness-merge защищают ридер.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Book } from '../types';
import { saveBook } from './storageService';

const PINS_KEY = '@languageeee/offline_book_pins_v1';
const MAX_PINS = 40;

export function bookContentRichness(book: Book | null | undefined): number {
  if (!book) return 0;
  let n = 0;
  for (const p of book.paragraphs ?? []) {
    const text = (
      p.chineseText ||
      p.englishText ||
      p.originalText ||
      ''
    ).trim();
    if (text) n += Math.min(text.length, 800);
    n += (p.words?.length ?? 0) * 25;
    n += (p.grammar?.length ?? 0) * 8;
  }
  if (book.sourceText?.trim()) n += Math.min(book.sourceText.length, 400);
  return n;
}

export function isBookReadableOffline(book: Book | null | undefined): boolean {
  if (!book) return false;
  return (book.paragraphs ?? []).some((p) =>
    Boolean(
      (p.chineseText || p.englishText || p.originalText || '').trim()
    )
  );
}

async function readPins(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(PINS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((x): x is string => typeof x === 'string')
      : [];
  } catch {
    return [];
  }
}

async function writePins(ids: string[]): Promise<void> {
  await AsyncStorage.setItem(PINS_KEY, JSON.stringify(ids.slice(0, MAX_PINS)));
}

export async function listOfflinePinnedBookIds(): Promise<string[]> {
  return readPins();
}

export async function countOfflinePinnedBooks(): Promise<number> {
  return (await readPins()).length;
}

/**
 * Сохранить книгу локально и пометить доступной офлайн.
 * Вызывать при открытии в ридере.
 */
export async function pinBookForOffline(book: Book): Promise<void> {
  if (!isBookReadableOffline(book)) return;
  try {
    await saveBook(book);
  } catch (err) {
    console.warn('[offline] saveBook for pin failed:', err);
  }
  const pins = await readPins();
  const next = [book.id, ...pins.filter((id) => id !== book.id)];
  await writePins(next);
}
