import { segment, OutputFormat } from 'pinyin-pro';

const PURE_CHINESE_RE = /^[\u4e00-\u9fff]+$/;
const HAS_CHINESE_RE = /[\u4e00-\u9fff]/;

/**
 * Longest Match First: сначала 成语 (4), затем 3 / 2, потом одиночные.
 * Длины 5…8 — только если есть в словаре (редкие составные).
 * LMF используется для склейки известных лексем и разбора длинных прогонов,
 * но НЕ для уничтожения OOV-токенов длины 2–4 от сегментатора.
 */
const LMF_LENGTHS = [4, 3, 2] as const;
const LONG_EXTRA_MAX = 8;

/**
 * Личные местоимения — расклейка явных склеек «местоимение + глагол/сказуемое»
 * (Intl.Segmenter иногда отдаёт「我是」「我要」одним куском).
 * Указательные 这/那/哪 не включаем — иначе рвём「这个」「那么».
 */
const GRAMMATICAL_PRONOUNS = new Set([
  '我',
  '你',
  '他',
  '她',
  '它',
  '您',
  '咱',
]);

export interface ChineseSegment {
  text: string;
  isChinese: boolean;
  /** Кликабельное слово (не пунктуация / пробелы) */
  isWordLike: boolean;
}

export type LexiconPredicate = (hanzi: string) => boolean;

export function isPureChinese(text: string): boolean {
  return Boolean(text) && PURE_CHINESE_RE.test(text);
}

function codePointLen(text: string): number {
  return [...text].length;
}

function makeSeg(
  text: string,
  isChinese: boolean,
  isWordLike?: boolean
): ChineseSegment {
  return {
    text,
    isChinese,
    isWordLike: isWordLike ?? (isChinese || /[A-Za-z0-9]/.test(text)),
  };
}

export interface LexiconIndex {
  has: LexiconPredicate;
  maxLen: number;
  size: number;
}

let cachedIndex: LexiconIndex | null = null;

/** Собирает O(1) индекс из ключей БКРС/HSK/extra. */
export function buildLexiconIndex(keys: Iterable<string>): LexiconIndex {
  const set = new Set<string>();
  let maxLen = 4;

  for (const raw of keys) {
    const key = String(raw ?? '').trim();
    if (!key || !PURE_CHINESE_RE.test(key)) continue;
    set.add(key);
    const n = codePointLen(key);
    if (n > maxLen) maxLen = n;
  }

  maxLen = Math.min(Math.max(maxLen, 4), LONG_EXTRA_MAX);

  return {
    has: (hanzi: string) => set.has(hanzi),
    maxLen,
    size: set.size,
  };
}

export function setGlobalLexiconIndex(index: LexiconIndex | null): void {
  cachedIndex = index;
}

export function getGlobalLexiconIndex(): LexiconIndex | null {
  return cachedIndex;
}

/**
 * Явная грамматическая склейка: односложное местоимение + остаток,
 * причём целое НЕ в лексиконе (иначе это реальное слово вроде «我们»).
 */
export function isGrammaticalPronounGlue(
  hanzi: string,
  isLexeme?: LexiconPredicate
): boolean {
  if (!isPureChinese(hanzi)) return false;
  const chars = [...hanzi];
  if (chars.length < 2 || chars.length > 4) return false;
  if (isLexeme?.(hanzi)) return false;
  return GRAMMATICAL_PRONOUNS.has(chars[0]!);
}

/**
 * Longest Match First по словарю (для длинных прогонов без границ токенизатора).
 * OOV длины 2–4 сохраняются выше — в refineSegments, если их выделил сегментатор.
 */
export function longestMatchSegment(
  text: string,
  isLexeme: LexiconPredicate,
  maxWordLen = LONG_EXTRA_MAX
): ChineseSegment[] {
  if (!text) return [];

  const out: ChineseSegment[] = [];
  const chars = [...text];
  let i = 0;
  const n = chars.length;
  const maxLen = Math.max(4, Math.min(maxWordLen, LONG_EXTRA_MAX));

  while (i < n) {
    const ch = chars[i]!;

    if (!HAS_CHINESE_RE.test(ch)) {
      let j = i + 1;
      while (j < n && !HAS_CHINESE_RE.test(chars[j]!)) j += 1;
      const surface = chars.slice(i, j).join('');
      out.push(makeSeg(surface, false, /[A-Za-z0-9]/.test(surface)));
      i = j;
      continue;
    }

    let matched = ch;
    const remain = n - i;

    for (const len of LMF_LENGTHS) {
      if (len > remain) continue;
      const candidate = chars.slice(i, i + len).join('');
      if (!PURE_CHINESE_RE.test(candidate)) continue;
      if (isLexeme(candidate)) {
        matched = candidate;
        break;
      }
    }

    if (matched === ch && remain >= 5) {
      const upper = Math.min(maxLen, remain);
      for (let len = upper; len >= 5; len -= 1) {
        const candidate = chars.slice(i, i + len).join('');
        if (!PURE_CHINESE_RE.test(candidate)) continue;
        if (isLexeme(candidate)) {
          matched = candidate;
          break;
        }
      }
    }

    out.push(makeSeg(matched, true, true));
    i += codePointLen(matched);
  }

  return out;
}

/** @deprecated alias */
export function segmentChineseFmm(
  text: string,
  isLexeme: LexiconPredicate,
  maxWordLen = LONG_EXTRA_MAX
): ChineseSegment[] {
  return longestMatchSegment(text, isLexeme, maxWordLen);
}

/** Сплит на китайские прогоны и прочее (пунктуация / латиница). */
function splitChineseRuns(text: string): ChineseSegment[] {
  const out: ChineseSegment[] = [];
  const chars = [...text];
  let i = 0;

  while (i < chars.length) {
    if (HAS_CHINESE_RE.test(chars[i]!)) {
      let j = i + 1;
      while (j < chars.length && HAS_CHINESE_RE.test(chars[j]!)) j += 1;
      out.push(makeSeg(chars.slice(i, j).join(''), true, true));
      i = j;
    } else {
      let j = i + 1;
      while (j < chars.length && !HAS_CHINESE_RE.test(chars[j]!)) j += 1;
      const surface = chars.slice(i, j).join('');
      out.push(makeSeg(surface, false, /[A-Za-z0-9]/.test(surface)));
      i = j;
    }
  }

  return out;
}

/** pinyin-pro: устойчивые слова / 成语 как целые origin-токены. */
function segmentWithPinyinPro(text: string): ChineseSegment[] | null {
  try {
    const raw = segment(text, {
      format: OutputFormat.AllSegment,
      nonZh: 'consecutive',
    }) as Array<{ origin: string; result?: string }>;

    if (!Array.isArray(raw) || raw.length === 0) return null;

    const out: ChineseSegment[] = [];
    for (const item of raw) {
      const origin = String(item?.origin ?? '');
      if (!origin) continue;
      if (isPureChinese(origin)) {
        out.push(makeSeg(origin, true, true));
      } else if (HAS_CHINESE_RE.test(origin)) {
        // смешанный кусок — разложим на прогоны
        out.push(...splitChineseRuns(origin));
      } else {
        out.push(makeSeg(origin, false, /[A-Za-z0-9]/.test(origin)));
      }
    }
    return out.length > 0 ? out : null;
  } catch {
    return null;
  }
}

/** Intl.Segmenter fallback (мобильные движки иногда рвут 成语). */
function segmentWithIntl(text: string): ChineseSegment[] | null {
  try {
    const Seg = (Intl as typeof Intl & { Segmenter?: typeof Intl.Segmenter })
      .Segmenter;
    if (typeof Seg !== 'function') return null;
    const segmenter = new Seg('zh-CN', { granularity: 'word' });
    const out: ChineseSegment[] = [];
    for (const { segment: surface } of segmenter.segment(text)) {
      if (!surface) continue;
      if (isPureChinese(surface)) {
        out.push(makeSeg(surface, true, true));
      } else if (HAS_CHINESE_RE.test(surface)) {
        out.push(...splitChineseRuns(surface));
      } else {
        out.push(makeSeg(surface, false, /[A-Za-z0-9]/.test(surface)));
      }
    }
    return out.length > 0 ? out : null;
  } catch {
    return null;
  }
}

/**
 * Расклеивает только «местоимение + X», если целого нет в словаре.
 * Реальные слова / OOV 成语 не трогаем.
 */
function ungluePronounCompounds(
  segments: ChineseSegment[],
  isLexeme?: LexiconPredicate
): ChineseSegment[] {
  const out: ChineseSegment[] = [];
  for (const seg of segments) {
    if (!seg.isChinese || !isPureChinese(seg.text)) {
      out.push(seg);
      continue;
    }
    if (!isGrammaticalPronounGlue(seg.text, isLexeme)) {
      out.push(seg);
      continue;
    }
    const chars = [...seg.text];
    out.push(makeSeg(chars[0]!, true, true));
    const rest = chars.slice(1).join('');
    if (rest) out.push(makeSeg(rest, true, true));
  }
  return out;
}

/**
 * Склеивает соседние китайские куски, если вместе они есть в БКРС/HSK
 * (чинит недосегментацию вроде「不可|思议」→「不可思议」).
 */
function mergeKnownLexemes(
  segments: ChineseSegment[],
  isLexeme: LexiconPredicate,
  maxWordLen: number
): ChineseSegment[] {
  const out: ChineseSegment[] = [];
  let i = 0;

  while (i < segments.length) {
    const seg = segments[i]!;
    if (!seg.isChinese || !isPureChinese(seg.text)) {
      out.push(seg);
      i += 1;
      continue;
    }

    let bestText = seg.text;
    let bestCount = 1;
    let acc = seg.text;

    for (let j = i + 1; j < segments.length; j += 1) {
      const next = segments[j]!;
      if (!next.isChinese || !isPureChinese(next.text)) break;
      const combined = acc + next.text;
      if (codePointLen(combined) > maxWordLen) break;
      acc = combined;
      if (isLexeme(combined)) {
        bestText = combined;
        bestCount = j - i + 1;
      }
    }

    out.push(makeSeg(bestText, true, true));
    i += bestCount;
  }

  return out;
}

/**
 * Пост-обработка сегментов токенизатора:
 * 1) расклейка местоимение+X
 * 2) склейка известных лексем
 * 3) длинные OOV-прогоны (>4) — LMF, но 2–4 OOV не пилим на символы
 * 4) токены 2–4 от сегментатора сохраняются целиком
 */
function refineSegments(
  segments: ChineseSegment[],
  isLexeme: LexiconPredicate | undefined,
  maxWordLen: number
): ChineseSegment[] {
  const lex: LexiconPredicate = isLexeme ?? (() => false);
  let refined = ungluePronounCompounds(segments, isLexeme);

  if (isLexeme) {
    refined = mergeKnownLexemes(refined, isLexeme, maxWordLen);
  }

  const out: ChineseSegment[] = [];
  for (const seg of refined) {
    if (!seg.isChinese || !isPureChinese(seg.text)) {
      out.push(makeSeg(seg.text, false, seg.isWordLike));
      continue;
    }

    const len = codePointLen(seg.text);

    // 2–4 иероглифа от токенизатора: словарь или OOV — единый токен
    // (кроме уже расклеенных местоимений)
    if (len >= 2 && len <= 4) {
      if (isGrammaticalPronounGlue(seg.text, isLexeme)) {
        const chars = [...seg.text];
        out.push(makeSeg(chars[0]!, true, true));
        const rest = chars.slice(1).join('');
        if (rest) out.push(makeSeg(rest, true, true));
      } else {
        out.push(makeSeg(seg.text, true, true));
      }
      continue;
    }

    if (len <= 1) {
      out.push(makeSeg(seg.text, true, true));
      continue;
    }

    // Длинный кусок: LMF по словарю + OOV 2–4 целиком
    if (isLexeme?.(seg.text)) {
      out.push(makeSeg(seg.text, true, true));
    } else {
      out.push(...longestMatchSegment(seg.text, lex, maxWordLen));
    }
  }

  return out;
}

export interface SegmentChineseOptions {
  isLexeme?: LexiconPredicate;
  maxWordLen?: number;
}

const SEGMENT_CACHE_MAX = 64;
const segmentCache = new Map<string, ChineseSegment[]>();

function cacheKey(text: string, maxWordLen: number, lexSizeHint: number): string {
  let h = 0;
  const n = Math.min(text.length, 48);
  for (let i = 0; i < n; i += 1) h = (h * 31 + text.charCodeAt(i)) | 0;
  return `${text.length}:${maxWordLen}:${lexSizeHint}:${h}:${text.slice(0, 24)}`;
}

/**
 * Токенизация:
 * 1) pinyin-pro segment (основной источник границ слов / 成语)
 * 2) Intl.Segmenter → китайские прогоны (fallback)
 * 3) Пост-обработка: не пилим OOV 2–4; расклеиваем только местоимение+X;
 *    склеиваем известные лексемы из словаря.
 */
export function segmentChineseText(
  text: string,
  options?: SegmentChineseOptions
): ChineseSegment[] {
  if (!text) return [];

  const global = getGlobalLexiconIndex();
  const isLexeme: LexiconPredicate | undefined =
    options?.isLexeme ?? global?.has;
  const maxWordLen =
    options?.maxWordLen ?? global?.maxLen ?? LONG_EXTRA_MAX;
  const lexHint = global?.size ?? (isLexeme ? 1 : 0);

  const key = cacheKey(text, maxWordLen, lexHint);
  const hit = segmentCache.get(key);
  if (hit) return hit;

  const primary =
    segmentWithPinyinPro(text) ??
    segmentWithIntl(text) ??
    splitChineseRuns(text);

  const finalResult = refineSegments(primary, isLexeme, maxWordLen);

  if (segmentCache.size >= SEGMENT_CACHE_MAX) {
    const first = segmentCache.keys().next().value;
    if (first != null) segmentCache.delete(first);
  }
  segmentCache.set(key, finalResult);
  return finalResult;
}

export function clearSegmentCache(): void {
  segmentCache.clear();
}

export function intlWordTokens(
  text: string,
  options?: SegmentChineseOptions
): string[] {
  return segmentChineseText(text, options).map((s) => s.text);
}

export function resetZhWordSegmenterCache(): void {
  clearSegmentCache();
}
