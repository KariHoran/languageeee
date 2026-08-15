import { addDict, pinyin } from 'pinyin-pro';
import ModernDict from '@pinyin-pro/data/modern';
import { detectGrammarPoints, getHskGrammarPatterns } from '../data/hskGrammarPatterns';
import hskWordsJson from '../data/hsk_words.json';
import { AnalyzedWord, Book, GrammarPoint, HskAnalysisResult, HskDictEntry, LearningLanguage, TargetHskLevel } from '../types';
import { toSimplified } from '../utils/chineseConvert';
import { sanitizeUserText } from '../utils/sanitizeUserText';
import { lookupBkrs, getBkrsKeys } from './bkrsService';
import {
  segmentChineseText,
  buildLexiconIndex,
  setGlobalLexiconIndex,
  clearSegmentCache,
  type LexiconPredicate,
  type LexiconIndex,
} from './chineseTokenizer';
import { detectEnglishGrammarPoints } from './englishGrammarService';
import { alignRussianParagraphs } from './translationService';
import { transliterateRussian } from '../utils/ruTransliterate';
import { buildRussianTokens } from '../utils/englishTokens';

const CHINESE_CHAR_RE = /[\u4e00-\u9fff]/;
const PURE_CHINESE_RE = /^[\u4e00-\u9fff]+$/;

/** Сколько самых частых иероглифов считаем «базовыми» для нормализации уровней. */
const BASIC_CHAR_LIMIT = 1000;
/** Потолок уровня для слова из одних базовых иероглифов с кривым HSK 7+. */
const BASIC_WORD_LEVEL_CAP = 3;

let dictReady = false;
/** Кэш пиньиня для целых слов (не посимвольно) — критично для планшетов. */
const pinyinCache = new Map<string, string>();

function ensurePinyinDict(): void {
  if (dictReady) return;
  addDict(ModernDict);
  dictReady = true;
}

/**
 * Пиньинь с тонами через pinyin-pro для ВСЕГО слова целиком.
 * Результат кэшируется в Map — без повторных вызовов на каждый рендер.
 */
export function pinyinFor(hanzi: string): string {
  const key = hanzi?.trim() ?? '';
  if (!key) return '';
  const cached = pinyinCache.get(key);
  if (cached != null) return cached;

  ensurePinyinDict();
  const parts = pinyin(key, {
    toneType: 'symbol',
    type: 'array',
    nonZh: 'consecutive',
  }) as string[];
  const result = parts.join(' ').trim();
  pinyinCache.set(key, result);
  return result;
}

export function normalizeHskLevel(level: number | string): number {
  if (typeof level === 'number' && Number.isFinite(level)) {
    const n = Math.round(level);
    // HSK 3.0: строго 1…9 (1-based). Значения вне диапазона → 9 (advanced).
    if (n < 1) return 1;
    if (n > 9) return 9;
    return n;
  }
  const raw = String(level).trim();
  // Полоса «7-9» в официальном словаре
  if (/^7\s*[-–—]\s*9$/.test(raw)) return 7;
  const match = raw.match(/(\d+)/);
  if (!match) return 9;
  const n = parseInt(match[1]!, 10);
  if (!Number.isFinite(n) || n < 1) return 9;
  return Math.min(9, n);
}

function makeKey(raw: unknown): string {
  return String(raw ?? '')
    .trim()
    .normalize('NFC')
    .replace(/[（(]\d+[）)]$/u, '')
    .replace(/[0-9０-９]+$/u, '')
    .trim();
}

function readPinyin(item: Record<string, unknown>): string {
  return String(item.pinyin || item['拼音'] || '').trim();
}

function readLevel(item: Record<string, unknown>): number {
  return normalizeHskLevel((item.level ?? item['等级'] ?? 9) as number | string);
}

interface HskLoadResult {
  map: Map<string, HskDictEntry>;
  basicChars: Set<string>;
  singleCharLevel: Map<string, number>;
}

/**
 * Частота иероглифов по HSK + БКРС → топ-N «базовых».
 * Слово из базовых иероглифов с уровнем ≥ 7 получает нормализованный уровень.
 */
function buildBasicCharSet(
  entries: Array<{ hanzi: string; level: number }>
): { basicChars: Set<string>; singleCharLevel: Map<string, number> } {
  const freq = new Map<string, number>();
  const singleCharLevel = new Map<string, number>();

  const bump = (ch: string, weight: number) => {
    if (!CHINESE_CHAR_RE.test(ch)) return;
    freq.set(ch, (freq.get(ch) ?? 0) + weight);
  };

  for (const { hanzi, level } of entries) {
    const chars = [...hanzi];
    const weight = level <= 3 ? 10 : level <= 6 ? 3 : 1;
    for (const ch of chars) bump(ch, weight);

    if (chars.length === 1 && level < 7) {
      const prev = singleCharLevel.get(hanzi);
      if (prev == null || level < prev) singleCharLevel.set(hanzi, level);
    }
  }

  // БКРС усиливает частоту «живых» иероглифов (в т.ч. служебных вроде «和»)
  for (const key of getBkrsKeys()) {
    for (const ch of key) bump(ch, 4);
    if ([...key].length === 1) {
      const prev = singleCharLevel.get(key);
      if (prev == null || prev >= 7) singleCharLevel.set(key, 1);
    }
  }

  const ranked = [...freq.entries()].sort((a, b) => b[1] - a[1]);
  const basicChars = new Set(ranked.slice(0, BASIC_CHAR_LIMIT).map(([ch]) => ch));
  return { basicChars, singleCharLevel };
}

/**
 * Если PDF дал HSK 7+ слову из одних частых иероглифов — опускаем уровень алгоритмически.
 */
function normalizeInflatedLevel(
  hanzi: string,
  rawLevel: number,
  basicChars: Set<string>,
  singleCharLevel: Map<string, number>
): number {
  if (rawLevel < 7) return rawLevel;

  const chars = [...hanzi];
  if (chars.length === 0) return rawLevel;
  if (!chars.every((ch) => basicChars.has(ch))) return rawLevel;

  const known = chars
    .map((ch) => singleCharLevel.get(ch))
    .filter((n): n is number => n != null && n < 7);

  if (known.length === chars.length) {
    return Math.max(...known);
  }

  return Math.min(rawLevel, BASIC_WORD_LEVEL_CAP);
}

let hskCache: HskLoadResult | null = null;
let lexiconIndexCache: LexiconIndex | null = null;

export function loadHskDictionary(): Map<string, HskDictEntry> {
  return loadHskData().map;
}

/**
 * Лексема есть в БКРС или HSK — составное слово / 成语 нельзя резать.
 * Пример: «身体», «不可思议» → единый токен.
 */
export function isKnownLexeme(hanzi: string): boolean {
  if (!hanzi) return false;
  return getLexiconIndex().has(hanzi);
}

/**
 * O(1) индекс БКРС + HSK для Longest Match First (4→3→2→1).
 * Кэшируется и прокидывается в chineseTokenizer.
 */
export function getLexiconIndex(): LexiconIndex {
  if (lexiconIndexCache) return lexiconIndexCache;

  const hsk = loadHskDictionary();
  const keys: string[] = [...getBkrsKeys()];
  for (const hanzi of hsk.keys()) keys.push(hanzi);

  lexiconIndexCache = buildLexiconIndex(keys);
  setGlobalLexiconIndex(lexiconIndexCache);
  return lexiconIndexCache;
}

/**
 * Предикат лексикона для жадной сегментации (LMF + optional extra).
 * Extra — слова уже разобранной книги (доп. compounds).
 */
export function createLexiconPredicate(
  extra?: { has: (key: string) => boolean }
): LexiconPredicate {
  const index = getLexiconIndex();
  if (!extra) return index.has;
  return (hanzi: string) => index.has(hanzi) || Boolean(extra.has(hanzi));
}

function loadHskData(): HskLoadResult {
  if (hskCache) return hskCache;

  const rawEntries: Array<{ hanzi: string; level: number; pinyin: string }> = [];
  const list: unknown[] = Array.isArray(hskWordsJson) ? hskWordsJson : [];

  for (const raw of list) {
    if (!raw || typeof raw !== 'object') continue;
    const item = raw as Record<string, unknown>;
    const key = makeKey(item.hanzi || item.word || item['词语'] || '');
    if (!key || !PURE_CHINESE_RE.test(key)) continue;
    rawEntries.push({
      hanzi: key,
      level: readLevel(item),
      pinyin: readPinyin(item),
    });
  }

  const { basicChars, singleCharLevel } = buildBasicCharSet(rawEntries);
  const map = new Map<string, HskDictEntry>();

  for (const entry of rawEntries) {
    const level = normalizeInflatedLevel(
      entry.hanzi,
      entry.level,
      basicChars,
      singleCharLevel
    );
    const existing = map.get(entry.hanzi);
    if (!existing) {
      map.set(entry.hanzi, { hanzi: entry.hanzi, level, pinyin: entry.pinyin });
      continue;
    }
    if (level < existing.level || (level === existing.level && !existing.pinyin && entry.pinyin)) {
      map.set(entry.hanzi, {
        hanzi: entry.hanzi,
        level,
        pinyin: entry.pinyin || existing.pinyin,
      });
    } else if (!existing.pinyin && entry.pinyin) {
      map.set(entry.hanzi, { ...existing, pinyin: entry.pinyin });
    }
  }

  hskCache = { map, basicChars, singleCharLevel };
  return hskCache;
}

export function resetHskDictionaryCache(): void {
  hskCache = null;
  lexiconIndexCache = null;
  setGlobalLexiconIndex(null);
  clearSegmentCache();
}

export function normalizeForHskAnalysis(text: string): string {
  return toSimplified(text).normalize('NFC');
}

function makeChineseToken(
  hanzi: string,
  py: string,
  data: HskLoadResult
): AnalyzedWord {
  const { map, basicChars, singleCharLevel } = data;
  const entry = map.get(hanzi);
  const gloss = lookupBkrs(hanzi);
  const resolvedPinyin = py || pinyinFor(hanzi) || entry?.pinyin || '';

  let level = entry?.level;
  if (level == null) {
    const chars = [...hanzi];
    const known = chars
      .map((ch) => map.get(ch)?.level ?? singleCharLevel.get(ch))
      .filter((n): n is number => n != null && n >= 1 && n <= 9);

    // Полное покрытие по иероглифам → max их уровней (без ручных списков слов)
    if (known.length === chars.length && chars.length > 0) {
      level = Math.max(...known);
    } else if (chars.every((ch) => basicChars.has(ch)) && known.length > 0) {
      level = Math.max(...known);
    }
  }

  // Страховка: уровень всегда 1…9, без смещения
  if (level != null) {
    level = normalizeHskLevel(level);
  }

  if (level != null) {
    return {
      text: hanzi,
      hanzi: entry?.hanzi ?? hanzi,
      pinyin: resolvedPinyin,
      level,
      translation: gloss,
      isAboveTarget: false,
      isChinese: true,
    };
  }

  return {
    text: hanzi,
    hanzi,
    pinyin: resolvedPinyin || undefined,
    translation: gloss,
    isAboveTarget: true,
    isChinese: true,
  };
}

/**
 * Токенизация: pinyin-pro / сегментатор + лексикон БКРС/HSK.
 * OOV 2–4 (成语 вне мини‑словаря) остаются единым словом;
 * пиньинь — pinyin-pro на весь токен; перевод по клику — translationService.
 */
export function analyzeText(text: string, targetLevel: TargetHskLevel): HskAnalysisResult {
  ensurePinyinDict();
  const data = loadHskData();
  // Прогрев O(1) лексикона БКРС+HSK (склейка известных лексем / HSK-уровни)
  getLexiconIndex();
  getHskGrammarPatterns();
  const normalized = toSimplified(text).normalize('NFC');

  const lexSegments = segmentChineseText(normalized, {
    isLexeme: createLexiconPredicate(),
  });

  const tokens: AnalyzedWord[] = lexSegments.map((seg) => {
    if (!seg.isChinese) {
      return {
        text: seg.text,
        isAboveTarget: false,
        isChinese: false,
      };
    }
    // Пиньинь целиком для токена (в т.ч. OOV): "mèn mèn bù lè", не посимвольно
    const py = pinyinFor(seg.text);
    return makeChineseToken(seg.text, py, data);
  });

  let aboveTargetCount = 0;
  let knownCount = 0;

  for (const word of tokens) {
    if (!word.isChinese) continue;

    if (word.level != null) {
      knownCount += 1;
      word.isAboveTarget = word.level > targetLevel;
    } else {
      word.isAboveTarget = true;
    }

    if (word.isAboveTarget) aboveTargetCount += 1;
  }

  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    console.log('Segmented tokens:', tokens);
  }

  return {
    targetLevel,
    words: tokens,
    aboveTargetCount,
    knownCount,
    grammar: detectGrammarPoints(normalized) as GrammarPoint[],
  };
}

/**
 * Оценка целевого HSK по словарному составу текста (readability).
 * Минимальный L ∈ 1..6, при котором ≥90% китайских токенов имеют уровень ≤ L.
 * OOV / HSK 7–9 → сложнее 6; одиночные OOV-иероглифы не штрафуют покрытие.
 */
export function estimateHskLevel(text: string): TargetHskLevel {
  const raw = text?.trim() ?? '';
  if (!raw || !CHINESE_CHAR_RE.test(raw)) return 2;

  ensurePinyinDict();
  const data = loadHskData();
  getLexiconIndex();
  const normalized = toSimplified(raw).normalize('NFC');
  const segments = segmentChineseText(normalized, {
    isLexeme: createLexiconPredicate(),
  });

  /** Эффективные уровни: 1..6 или 7 (= сложнее HSK6). */
  const scored: number[] = [];

  for (const seg of segments) {
    if (!seg.isChinese) continue;
    const hanzi = seg.text;
    const entry = data.map.get(hanzi);
    if (entry) {
      const lv = normalizeHskLevel(entry.level);
      scored.push(lv >= 7 ? 7 : lv);
      continue;
    }
    // Одиночный OOV — часто частица / имя; не штрафуем
    if ([...hanzi].length <= 1) continue;
    scored.push(7);
  }

  if (scored.length === 0) return 2;

  const COVERAGE = 0.9;
  for (let L = 1; L <= 6; L += 1) {
    const covered = scored.filter((lv) => lv <= L).length;
    if (covered / scored.length >= COVERAGE) {
      return L as TargetHskLevel;
    }
  }
  return 6;
}

export interface BuildBookOptions {
  collectionId?: string;
  /** Оригинальный русский текст (параллельный перевод пользователя) */
  originalRussianText?: string;
  /** Параллельный EN (абзацы через пустую строку) */
  translationEn?: string;
  /** Параллельный ZH (абзацы через пустую строку) */
  translationZh?: string;
  /** Язык изучаемого текста */
  language?: LearningLanguage;
  /** Русский перевод названия */
  russianTitle?: string;
}

export function buildBookFromAnalysis(
  title: string,
  text: string,
  targetLevel: TargetHskLevel,
  collectionIdOrOptions?: string | BuildBookOptions
): Book {
  const options: BuildBookOptions =
    typeof collectionIdOrOptions === 'string'
      ? { collectionId: collectionIdOrOptions }
      : collectionIdOrOptions ?? {};

  const language: LearningLanguage =
    options.language === 'en'
      ? 'en'
      : options.language === 'ru'
        ? 'ru'
        : 'zh';
  // EN/RU: без OpenCC / пиньиня / HSK — только нормализация пробелов
  // XSS: санитизация пользовательского текста перед разбором
  const rawSafe = sanitizeUserText(text);
  const sourceText =
    language === 'en' || language === 'ru'
      ? rawSafe.trim().normalize('NFC')
      : normalizeForHskAnalysis(rawSafe.trim());

  const paragraphs = sourceText
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  const content = paragraphs.length > 0 ? paragraphs : [sourceText];
  const now = new Date().toISOString();
  const originalRussian = options.originalRussianText?.trim() || undefined;
  const russianAligned = originalRussian
    ? alignRussianParagraphs(originalRussian, content.length)
    : null;
  const enAligned = options.translationEn?.trim()
    ? alignRussianParagraphs(options.translationEn.trim(), content.length)
    : null;
  const zhAligned = options.translationZh?.trim()
    ? alignRussianParagraphs(options.translationZh.trim(), content.length)
    : null;
  const russianTitle = options.russianTitle?.trim() || undefined;

  const paragraphTranslations = (
    paragraphIndex: number
  ): Partial<Record<'en' | 'zh', string>> | undefined => {
    const en = enAligned?.[paragraphIndex]?.trim() ?? '';
    const zh = zhAligned?.[paragraphIndex]?.trim() ?? '';
    if (!en && !zh) return undefined;
    return {
      ...(en ? { en } : {}),
      ...(zh ? { zh } : {}),
    };
  };

  return {
    id: `book-${Date.now()}`,
    title,
    russianTitle,
    ownerUserId: undefined, // проставится в saveBook через getDataOwnerId()
    language,
    targetHskLevel: targetLevel,
    collectionId: options.collectionId,
    createdAt: now,
    updatedAt: now,
    sourceText,
    originalRussianText: originalRussian,
    paragraphs: content.map((paragraphText, paragraphIndex) => {
      if (language === 'en') {
        const surfaceWords = paragraphText
          .split(/(\s+|[.,!?;:'"()-])/)
          .filter((t) => /[A-Za-z]/.test(t));
        const unique: string[] = [];
        for (const w of surfaceWords) {
          const key = w.toLowerCase();
          if (!unique.some((u) => u.toLowerCase() === key)) unique.push(w);
        }
        return {
          originalText: paragraphText,
          chineseText: paragraphText,
          englishText: paragraphText,
          russianTranslation: russianAligned?.[paragraphIndex]?.trim() ?? '',
          translations: paragraphTranslations(paragraphIndex),
          words: unique.slice(0, 60).map((w, wordIndex) => ({
            id: `w-${paragraphIndex}-${wordIndex}-${Date.now()}`,
            hanzi: w,
            pinyin: '',
            translation: '',
            status: 'new' as const,
          })),
          grammar: detectEnglishGrammarPoints(paragraphText),
        };
      }

      if (language === 'ru') {
        const ruTokens = buildRussianTokens(paragraphText, {
          withTranslit: true,
        });
        const unique: Array<{ surface: string; translit: string }> = [];
        for (const tok of ruTokens) {
          if (!tok.isWord || !tok.word) continue;
          const key = tok.word.hanzi.toLowerCase();
          if (unique.some((u) => u.surface.toLowerCase() === key)) continue;
          unique.push({
            surface: tok.word.hanzi,
            translit: tok.pinyin || transliterateRussian(tok.word.hanzi),
          });
        }
        return {
          originalText: paragraphText,
          chineseText: paragraphText,
          englishText: '',
          russianTranslation: russianAligned?.[paragraphIndex]?.trim() ?? '',
          translations: paragraphTranslations(paragraphIndex),
          words: unique.slice(0, 80).map((w, wordIndex) => ({
            id: `w-${paragraphIndex}-${wordIndex}-${Date.now()}`,
            hanzi: w.surface,
            pinyin: w.translit,
            translation: '',
            status: 'new' as const,
          })),
          grammar: [],
        };
      }

      const analysis = analyzeText(paragraphText, targetLevel);
      const grammar = detectGrammarPoints(paragraphText);

      return {
        originalText: paragraphText,
        chineseText: paragraphText,
        englishText: '',
        russianTranslation: russianAligned?.[paragraphIndex]?.trim() ?? '',
        translations: paragraphTranslations(paragraphIndex),
        words: analysis.words
          .filter((w) => w.isChinese && w.hanzi)
          .map((w, wordIndex) => ({
            id: `w-${paragraphIndex}-${wordIndex}-${Date.now()}`,
            hanzi: w.hanzi!,
            pinyin: w.pinyin ?? '',
            translation: lookupBkrs(w.hanzi!) ?? '',
            status: 'new' as const,
            hskLevel: w.level,
          })),
        grammar,
      };
    }),
  };
}
