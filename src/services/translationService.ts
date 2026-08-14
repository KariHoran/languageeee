import { Platform } from 'react-native';
import { toSimplified } from '../utils/chineseConvert';
import {
  getCachedTranslation,
  setCachedTranslation,
} from './translationCache';

/** Пауза между абзацами */
const PARAGRAPH_DELAY_MS = 300;
/** Лимит длины одного GET-запроса к gtx (осторожный запас) */
const GTX_MAX_QUERY_LENGTH = 1500;

const MYMEMORY_URL = 'https://api.mymemory.translated.net/get';

const LINGVA_HOSTS = [
  'https://lingva.ml',
  'https://lingva.thedaviddelta.com',
  'https://translate.plausibility.cloud',
];

const FAILED_PARAGRAPH_MARKER = '[Ошибка перевода абзаца]';

/**
 * Короткий статус для UI / ошибок (не вставлять в текст книги целиком).
 * Старый длинный CORS-текст распознаём для уже сохранённых книг.
 */
export const WEB_CORS_FALLBACK = 'Перевод временно недоступен';
const LEGACY_CORS_FALLBACK =
  '[Перевод временно недоступен в Web-режиме из-за CORS]';

const IS_WEB = Platform.OS === 'web';

/** Таймаут одного HTTP-запроса к переводчику (мс) */
const FETCH_TIMEOUT_MS = 12_000;
/** Жёсткий лимит на весь текст En↔Ru / Ru↔En (мс) */
const TRANSLATE_JOB_TIMEOUT_MS = 45_000;

/** Публичные CORS-прокси (запасной путь, если Metro-прокси недоступен) */
const CORS_PROXIES = [
  (target: string) => `https://corsproxy.io/?${encodeURIComponent(target)}`,
  (target: string) =>
    `https://api.allorigins.win/raw?url=${encodeURIComponent(target)}`,
];

export interface TranslateProgress {
  current: number;
  total: number;
  label: string;
}

export type TranslateProgressCallback = (progress: TranslateProgress) => void;

/** Есть ли в строке маркер сбоя перевода (для UI). */
export function isTranslationFailureText(
  text: string | null | undefined
): boolean {
  if (!text) return false;
  return (
    text.includes(WEB_CORS_FALLBACK) ||
    text.includes(LEGACY_CORS_FALLBACK) ||
    text.includes(FAILED_PARAGRAPH_MARKER)
  );
}

/** Убрать маркеры сбоя из текста абзаца. */
export function stripTranslationFailureMarkers(text: string): string {
  return text
    .replace(LEGACY_CORS_FALLBACK, '')
    .replace(WEB_CORS_FALLBACK, '')
    .replace(FAILED_PARAGRAPH_MARKER, '')
    .replace(/^\s*\n+/, '')
    .trim();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Promise.race с таймаутом — не даём лоадеру висеть вечно. */
export async function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label = 'Операция'
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => {
          reject(
            new Error(
              `${label}: превышено время ожидания (${Math.round(ms / 1000)} с)`
            )
          );
        }, ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function fetchWithTimeout(
  url: string,
  ms: number = FETCH_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { signal: controller.signal });
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error(`Таймаут запроса (${Math.round(ms / 1000)} с)`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

function isLikelyCorsOrNetworkError(err: unknown): boolean {
  if (!(err instanceof Error)) return true;
  const msg = err.message.toLowerCase();
  return (
    err.name === 'TypeError' ||
    msg.includes('failed to fetch') ||
    msg.includes('network') ||
    msg.includes('cors') ||
    msg.includes('load failed') ||
    msg.includes('aborted') ||
    msg.includes('таймаут')
  );
}

/**
 * fetch для переводчиков:
 * - native / RN: прямой запрос к upstream
 * - web: сначала same-origin Metro `/api/translate`, затем публичные CORS-прокси
 */
async function fetchTranslation(url: string): Promise<Response> {
  if (!IS_WEB) {
    return fetchWithTimeout(url);
  }

  // Прямой запрос редко проходит из браузера — пробуем коротко, потом прокси
  try {
    const direct = await fetchWithTimeout(url);
    if (direct.ok) return direct;
  } catch (err) {
    console.warn('[translation] direct fetch failed:', err);
  }

  let lastError: unknown;
  for (const build of CORS_PROXIES) {
    try {
      const proxied = await fetchWithTimeout(build(url));
      if (proxied.ok) return proxied;
      lastError = new Error(`CORS proxy HTTP ${proxied.status}`);
    } catch (err) {
      lastError = err;
      console.warn('[translation] proxy fetch failed:', err);
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error('Web: перевод недоступен');
}

/**
 * Same-origin прокси Metro (`scripts/translateProxy.js`).
 * Обходит CORS: браузер → /api/translate → Google/MyMemory на стороне сервера.
 */
async function translateViaMetroProxy(
  text: string,
  sl: string,
  tl: string,
  provider: 'gtx' | 'mymemory' = 'gtx'
): Promise<string> {
  const url =
    `/api/translate?q=${encodeURIComponent(text)}` +
    `&sl=${encodeURIComponent(sl)}` +
    `&tl=${encodeURIComponent(tl)}` +
    `&provider=${provider}`;

  const response = await fetchWithTimeout(url);
  let data: { translation?: string; error?: string } = {};
  try {
    data = (await response.json()) as { translation?: string; error?: string };
  } catch {
    throw new Error(`Metro proxy: неверный JSON (${response.status})`);
  }

  if (!response.ok) {
    throw new Error(data.error || `Metro proxy HTTP ${response.status}`);
  }

  const translated = data.translation?.trim();
  if (!translated) throw new Error('Metro proxy: пустой перевод');
  return translated;
}

type LangPair = { sl: string; tl: string; mymemory: string };

const RU_ZH: LangPair = { sl: 'ru', tl: 'zh-CN', mymemory: 'ru|zh-CN' };
const ZH_RU: LangPair = { sl: 'zh-CN', tl: 'ru', mymemory: 'zh-CN|ru' };
const RU_EN: LangPair = { sl: 'ru', tl: 'en', mymemory: 'ru|en' };
const EN_RU: LangPair = { sl: 'en', tl: 'ru', mymemory: 'en|ru' };

function pairFromCodes(sl: string, tl: string): LangPair {
  return { sl, tl, mymemory: `${sl}|${tl}` };
}

/**
 * Google Translate Client API (gtx) — без жёстких лимитов и CORS-блоков в RN.
 * На Web идёт через CORS-прокси.
 * Ответ: data[0].map(item => item[0]).join('')
 */
export async function translateViaGoogleGtx(
  text: string,
  sl: string,
  tl: string
): Promise<string> {
  const trimmed = text.trim();
  if (!trimmed) return '';

  const url =
    `https://translate.googleapis.com/translate_a/single` +
    `?client=gtx&sl=${encodeURIComponent(sl)}&tl=${encodeURIComponent(tl)}` +
    `&dt=t&q=${encodeURIComponent(trimmed)}`;

  const response = await fetchTranslation(url);
  if (!response.ok) {
    throw new Error(`Google gtx HTTP ${response.status}`);
  }

  let data: unknown;
  try {
    data = await response.json();
  } catch {
    throw new Error('Google gtx: не удалось разобрать JSON');
  }

  if (!Array.isArray(data) || !Array.isArray(data[0])) {
    throw new Error('Google gtx: неожиданный формат ответа');
  }

  const translated = (data[0] as unknown[])
    .map((item) => {
      if (Array.isArray(item) && typeof item[0] === 'string') return item[0];
      return '';
    })
    .join('');

  const result = translated.trim();
  if (!result) {
    throw new Error('Google gtx: пустой перевод');
  }

  return result;
}

async function translateViaLingva(
  text: string,
  source: string,
  target: string
): Promise<string> {
  const encoded = encodeURIComponent(text);
  let lastError: unknown;

  for (const host of LINGVA_HOSTS) {
    try {
      const response = await fetchTranslation(
        `${host}/api/v1/${source}/${target}/${encoded}`
      );
      if (!response.ok) {
        lastError = new Error(`Lingva HTTP ${response.status}`);
        continue;
      }
      const data = (await response.json()) as { translation?: string };
      const translated = data.translation?.trim();
      if (translated) return translated;
      lastError = new Error('Lingva: пустой ответ');
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Lingva недоступен');
}

async function translateViaMyMemory(text: string, langpair: string): Promise<string> {
  const url = `${MYMEMORY_URL}?q=${encodeURIComponent(text)}&langpair=${langpair}`;
  const response = await fetchTranslation(url);
  if (!response.ok) {
    throw new Error(`MyMemory HTTP ${response.status}`);
  }

  const data = (await response.json()) as {
    responseData?: { translatedText?: string };
    responseStatus?: number;
    responseDetails?: string;
  };

  if (data.responseStatus && data.responseStatus !== 200) {
    throw new Error(data.responseDetails ?? `MyMemory status ${data.responseStatus}`);
  }

  const translated = data.responseData?.translatedText?.trim();
  if (!translated) throw new Error('MyMemory: пустой ответ');
  if (/^\s*MYMEMORY WARNING/i.test(translated)) {
    throw new Error(translated);
  }

  return translated;
}

/** Режет слишком длинный абзац на куски для GET-запроса */
function splitLongParagraph(text: string, maxLen = GTX_MAX_QUERY_LENGTH): string[] {
  if (text.length <= maxLen) return [text];

  const parts: string[] = [];
  const sentences = text.split(/(?<=[.!?…。！？；;\n])\s*/);
  let buffer = '';

  const flush = () => {
    if (buffer.trim()) {
      parts.push(buffer.trim());
      buffer = '';
    }
  };

  for (const sentence of sentences) {
    const s = sentence.trim();
    if (!s) continue;
    if (s.length > maxLen) {
      flush();
      for (let i = 0; i < s.length; i += maxLen) {
        parts.push(s.slice(i, i + maxLen));
      }
      continue;
    }
    const next = buffer ? `${buffer} ${s}` : s;
    if (next.length > maxLen) {
      flush();
      buffer = s;
    } else {
      buffer = next;
    }
  }
  flush();
  return parts.length > 0 ? parts : [text.slice(0, maxLen)];
}

/**
 * Один кусок текста:
 * - Web: Metro `/api/translate` (gtx → mymemory), затем публичные прокси
 * - Native: прямой gtx → Lingva → MyMemory
 */
async function translatePiece(text: string, pair: LangPair): Promise<string> {
  const trimmed = text.trim();
  if (!trimmed) return '';

  if (IS_WEB) {
    const errors: unknown[] = [];
    try {
      return await translateViaMetroProxy(trimmed, pair.sl, pair.tl, 'gtx');
    } catch (err) {
      errors.push(err);
      console.warn('[translation] metro gtx failed:', err);
    }
    try {
      const mmTl = pair.tl.startsWith('zh') ? 'zh-CN' : pair.tl;
      const mmSl = pair.sl.startsWith('zh') ? 'zh-CN' : pair.sl;
      return await translateViaMetroProxy(trimmed, mmSl, mmTl, 'mymemory');
    } catch (err) {
      errors.push(err);
      console.warn('[translation] metro mymemory failed:', err);
    }
    // Последний шанс — старый путь через публичные CORS-прокси
    try {
      return await translateViaGoogleGtx(trimmed, pair.sl, pair.tl);
    } catch (err) {
      errors.push(err);
    }
    try {
      return await translateViaMyMemory(trimmed, pair.mymemory);
    } catch (err) {
      errors.push(err);
    }
    const cors = errors.some(isLikelyCorsOrNetworkError);
    throw new Error(
      cors
        ? WEB_CORS_FALLBACK
        : errors.find((e) => e instanceof Error)?.message || 'Перевод недоступен'
    );
  }

  try {
    return await translateViaGoogleGtx(trimmed, pair.sl, pair.tl);
  } catch (errGtx) {
    try {
      const lingvaTarget = pair.tl.startsWith('zh') ? 'zh' : pair.tl;
      const lingvaSource = pair.sl.startsWith('zh') ? 'zh' : pair.sl;
      return await translateViaLingva(trimmed, lingvaSource, lingvaTarget);
    } catch (errLingva) {
      try {
        return await translateViaMyMemory(trimmed, pair.mymemory);
      } catch (errMem) {
        throw errMem instanceof Error ? errMem : new Error('Перевод недоступен');
      }
    }
  }
}

/** При сбое абзаца оставляем оригинал — без длинных CORS-заглушек в тексте книги. */
function paragraphFallback(paragraph: string): string {
  return paragraph;
}

/**
 * Один абзац (с подрезкой длинных). При полном провале — маркер, без throw наружу.
 * Сначала смотрит умный кэш переводов (AsyncStorage / localStorage).
 */
async function translateParagraphResilient(
  paragraph: string,
  pair: LangPair,
  toZh: boolean
): Promise<string> {
  const trimmed = paragraph.trim();
  if (!trimmed) return '';

  const direction = `${pair.sl}->${pair.tl}`;
  const cached = await getCachedTranslation(trimmed, direction);
  if (cached) {
    return toZh ? toSimplified(cached) : cached;
  }

  const pieces = splitLongParagraph(trimmed);
  const out: string[] = [];
  let sawCorsFallback = false;

  for (let i = 0; i < pieces.length; i += 1) {
    try {
      let translated = await translatePiece(pieces[i], pair);
      if (translated.includes(WEB_CORS_FALLBACK)) {
        sawCorsFallback = true;
        out.push(pieces[i]);
      } else {
        if (toZh) translated = toSimplified(translated);
        out.push(translated);
      }
    } catch (err) {
      if (
        IS_WEB &&
        (isLikelyCorsOrNetworkError(err) ||
          (err instanceof Error && err.message.includes(WEB_CORS_FALLBACK)))
      ) {
        sawCorsFallback = true;
      }
      // Кусок не переведён — сохраняем оригинал этого куска
      out.push(pieces[i]);
    }
    if (i < pieces.length - 1) {
      await sleep(PARAGRAPH_DELAY_MS);
    }
  }

  const joined = out.join('').trim();
  if (!joined) {
    return paragraphFallback(trimmed);
  }

  if (sawCorsFallback && joined === trimmed) {
    return paragraphFallback(trimmed);
  }

  // Ru→Zh: если перевод не дал китайских иероглифов — считаем сбоем абзаца
  if (toZh) {
    const hasChinese = /[\u4e00-\u9fff]/.test(joined);
    if (!hasChinese) {
      return paragraphFallback(trimmed);
    }
  }

  // Не кэшируем ошибочные маркеры
  if (
    !joined.includes(WEB_CORS_FALLBACK) &&
    !joined.includes(FAILED_PARAGRAPH_MARKER)
  ) {
    await setCachedTranslation(trimmed, direction, joined);
  }

  return joined;
}

/** Делит текст на абзацы по переводам строк */
export function splitIntoParagraphs(text: string): string[] {
  return text
    .split(/\n+/)
    .map((p) => p.trim())
    .filter(Boolean);
}

async function translateByParagraphs(
  text: string,
  pair: LangPair,
  toZh: boolean,
  onProgress?: TranslateProgressCallback
): Promise<string> {
  const paragraphs = splitIntoParagraphs(text);
  if (paragraphs.length === 0) {
    throw new Error('Введите текст для перевода.');
  }

  const results: string[] = [];

  for (let i = 0; i < paragraphs.length; i += 1) {
    onProgress?.({
      current: i + 1,
      total: paragraphs.length,
      label: `Переводим: ${i + 1}/${paragraphs.length} абзацев...`,
    });

    const translated = await translateParagraphResilient(paragraphs[i], pair, toZh);
    results.push(translated);

    if (i < paragraphs.length - 1) {
      await sleep(PARAGRAPH_DELAY_MS);
    }
  }

  return results.join('\n\n');
}

/** Проверяет, похож ли текст на русский */
export function isLikelyRussian(text: string): boolean {
  const cyrillic = (text.match(/[\u0400-\u04FF]/g) ?? []).length;
  const chinese = (text.match(/[\u4e00-\u9fff]/g) ?? []).length;
  return cyrillic > 0 && cyrillic >= chinese;
}

/**
 * Ru → Zh. Сбойные абзацы остаются оригиналом (без CORS-заглушек в тексте).
 */
export async function translateRuToZh(
  text: string,
  onProgress?: TranslateProgressCallback
): Promise<string> {
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error('Введите текст для перевода.');
  }

  try {
    const joined = await translateByParagraphs(trimmed, RU_ZH, true, onProgress);
    return toSimplified(joined);
  } catch (err) {
    if (IS_WEB && isLikelyCorsOrNetworkError(err)) {
      throw new Error(WEB_CORS_FALLBACK);
    }
    throw err;
  }
}

/**
 * Zh → Ru. Та же устойчивая схема по абзацам.
 */
export async function translateZhToRu(
  text: string,
  onProgress?: TranslateProgressCallback
): Promise<string> {
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error('Введите текст для перевода.');
  }

  try {
    return (await translateByParagraphs(trimmed, ZH_RU, false, onProgress)).trim();
  } catch (err) {
    if (IS_WEB && isLikelyCorsOrNetworkError(err)) {
      throw new Error(WEB_CORS_FALLBACK);
    }
    throw err;
  }
}

/**
 * Ru → En. Для английских фанфиков из русского оригинала.
 */
export async function translateRuToEn(
  text: string,
  onProgress?: TranslateProgressCallback
): Promise<string> {
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error('Введите текст для перевода.');
  }

  try {
    return await withTimeout(
      translateByParagraphs(trimmed, RU_EN, false, onProgress),
      TRANSLATE_JOB_TIMEOUT_MS,
      'Ru→En'
    );
  } catch (err) {
    console.error('[translation] translateRuToEn failed:', err);
    if (IS_WEB && isLikelyCorsOrNetworkError(err)) {
      throw new Error(WEB_CORS_FALLBACK);
    }
    throw err instanceof Error ? err : new Error('Не удалось перевести Ru→En');
  }
}

/**
 * En → Ru. Параллельный перевод для ридера.
 * Всегда завершается за TRANSLATE_JOB_TIMEOUT_MS (или раньше с ошибкой/фолбэком).
 */
export async function translateEnToRu(
  text: string,
  onProgress?: TranslateProgressCallback
): Promise<string> {
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error('Введите текст для перевода.');
  }

  try {
    const result = await withTimeout(
      translateByParagraphs(trimmed, EN_RU, false, onProgress),
      TRANSLATE_JOB_TIMEOUT_MS,
      'En→Ru'
    );
    return result.trim();
  } catch (err) {
    console.error('[translation] translateEnToRu failed:', err);
    if (IS_WEB && isLikelyCorsOrNetworkError(err)) {
      throw new Error(WEB_CORS_FALLBACK);
    }
    throw err instanceof Error ? err : new Error('Не удалось перевести En→Ru');
  }
}

/**
 * Быстрый перевод одного китайского слова/фразы на русский (карточка слова).
 * Только по клику: кэш → gtx/Lingva/MyMemory. Не вызывать при рендере абзацев.
 */
export async function translateWordZhToRu(word: string): Promise<string> {
  return translateWord(word, 'zh', 'ru');
}

/**
 * Быстрый перевод одного английского слова/фразы на русский (карточка слова).
 * Использует кэш + тот же pipeline gtx/Lingva/MyMemory, с коротким таймаутом.
 */
export async function translateWordEnToRu(word: string): Promise<string> {
  return translateWord(word, 'en', 'ru');
}

/**
 * Универсальный перевод слова: learning → native.
 * Кэш по направлению (ru->zh-CN и т.д.), без спама API.
 */
export async function translateWord(
  word: string,
  from: 'zh' | 'ru' | 'en',
  to: 'zh' | 'ru' | 'en'
): Promise<string> {
  const trimmed = word.trim();
  if (!trimmed) return '';
  if (from === to) return trimmed;

  const { resolveLangPair } = await import('./languageConfig');
  const resolved = resolveLangPair(from, to);
  const pair = pairFromCodes(resolved.sl, resolved.tl);
  const cacheKey =
    from === 'en' ? trimmed.toLowerCase() : trimmed;
  const direction = resolved.cacheDirection;

  const cached = await getCachedTranslation(cacheKey, direction);
  if (cached?.trim()) return cached.trim();

  try {
    const raw = await withTimeout(
      translatePiece(trimmed, pair),
      10_000,
      `${from}→${to} слово`
    );
    let clean = raw.trim();
    if (clean.includes(WEB_CORS_FALLBACK)) {
      clean = clean.replace(WEB_CORS_FALLBACK, '').trim();
    }
    if (clean.includes(FAILED_PARAGRAPH_MARKER)) {
      clean = clean.replace(FAILED_PARAGRAPH_MARKER, '').trim();
    }
    if (!clean || clean === trimmed) {
      throw new Error('Пустой или невалидный перевод слова');
    }
    // EN→X: не принимать «перевод», который остался латиницей-копией
    if (
      from === 'en' &&
      to !== 'en' &&
      clean.toLowerCase() === cacheKey &&
      /^[A-Za-z][A-Za-z0-9' -]*$/.test(clean)
    ) {
      throw new Error('Пустой или невалидный перевод слова');
    }
    await setCachedTranslation(cacheKey, direction, clean);
    return clean;
  } catch (err) {
    console.error('[translation] translateWord failed:', from, to, trimmed, err);
    throw err instanceof Error ? err : new Error('Не удалось перевести слово');
  }
}

/** Ru → Zh слово (клик в модалке). */
export async function translateWordRuToZh(word: string): Promise<string> {
  return translateWord(word, 'ru', 'zh');
}

/** Ru → En слово. */
export async function translateWordRuToEn(word: string): Promise<string> {
  return translateWord(word, 'ru', 'en');
}

/** Zh → En слово. */
export async function translateWordZhToEn(word: string): Promise<string> {
  return translateWord(word, 'zh', 'en');
}

/** En → Zh слово. */
export async function translateWordEnToZh(word: string): Promise<string> {
  return translateWord(word, 'en', 'zh');
}

/**
 * Переводит массив китайских абзацев на русский по очереди.
 * Ошибки одного абзаца не роняют весь список.
 */
export async function translateParagraphsZhToRu(
  paragraphs: string[],
  onProgress?: TranslateProgressCallback
): Promise<string[]> {
  return translateParagraphsWithPair(paragraphs, ZH_RU, onProgress);
}

/** Переводит массив английских абзацев на русский по очереди. */
export async function translateParagraphsEnToRu(
  paragraphs: string[],
  onProgress?: TranslateProgressCallback
): Promise<string[]> {
  return translateParagraphsWithPair(paragraphs, EN_RU, onProgress);
}

export async function translateParagraphsRuToZh(
  paragraphs: string[],
  onProgress?: TranslateProgressCallback
): Promise<string[]> {
  return translateParagraphsWithPair(paragraphs, RU_ZH, onProgress);
}

export async function translateParagraphsRuToEn(
  paragraphs: string[],
  onProgress?: TranslateProgressCallback
): Promise<string[]> {
  return translateParagraphsWithPair(paragraphs, RU_EN, onProgress);
}

async function translateParagraphsWithPair(
  paragraphs: string[],
  pair: LangPair,
  onProgress?: TranslateProgressCallback
): Promise<string[]> {
  const results: string[] = [];
  const nonEmptyCount = paragraphs.filter((p) => p?.trim()).length;
  let done = 0;

  for (let i = 0; i < paragraphs.length; i += 1) {
    const text = paragraphs[i]?.trim() ?? '';
    if (!text) {
      results.push('');
      continue;
    }

    done += 1;
    onProgress?.({
      current: done,
      total: Math.max(nonEmptyCount, 1),
      label: `Переводим: ${done}/${nonEmptyCount} абзацев...`,
    });

    try {
      results.push(await translateParagraphResilient(text, pair, false));
    } catch (err) {
      console.warn('[translation] paragraph failed, keeping original:', err);
      results.push(text);
    }

    if (i < paragraphs.length - 1) {
      await sleep(PARAGRAPH_DELAY_MS);
    }
  }

  return results;
}

export function alignRussianParagraphs(
  originalRussianText: string,
  chineseParagraphCount: number
): string[] {
  const ruParts = originalRussianText
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  if (chineseParagraphCount <= 0) return [];
  if (ruParts.length === chineseParagraphCount) return ruParts;
  if (ruParts.length === 0) return Array(chineseParagraphCount).fill('');

  if (ruParts.length === 1 && chineseParagraphCount > 1) {
    const lines = originalRussianText
      .split(/\n+/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length === chineseParagraphCount) return lines;
  }

  if (ruParts.length > chineseParagraphCount) {
    const aligned = ruParts.slice(0, chineseParagraphCount - 1);
    aligned.push(ruParts.slice(chineseParagraphCount - 1).join('\n\n'));
    return aligned;
  }

  return [...ruParts, ...Array(chineseParagraphCount - ruParts.length).fill('')];
}

/** @deprecated используйте splitIntoParagraphs; оставлено для совместимости */
export function splitIntoChunks(text: string): string[] {
  return splitIntoParagraphs(text);
}

export {
  clearTranslationCache,
  getCachedTranslation,
  getCachedTranslationSync,
  peekTranslationCacheSize,
  prefetchTranslationCache,
  setCachedTranslation,
} from './translationCache';

