import hskGrammarJson from './hsk_grammar.json';
import { GrammarPoint } from '../types';

/**
 * Грамматический паттерн HSK, загруженный из словаря (не статический stub).
 * `parts` — фрагменты в порядке появления; между ними допускается текст.
 * Внутри части альтернативы через «/», опциональные куски в «（…）».
 */
export interface HskGrammarPattern {
  id: string;
  structure: string;
  parts: string[];
  explanation: string;
  example: string;
  hskLevel: number;
}

export interface GrammarMatch {
  start: number;
  end: number;
  point: GrammarPoint & { hskLevel?: number };
  patternId: string;
}

const SENTENCE_SPLIT_RE = /[。！？；;\n]/;
/** Границы придаточного: парные A…B не переходят через эти знаки. */
const CLAUSE_BOUNDARY_RE = /[,，.。!！?？;；]/;
/** «Сильные» границы — никогда не пересекаем, даже если в схеме есть «，». */
const HARD_CLAUSE_BOUNDARY_RE = /[.。!！?？;；]/;
const CHINESE_RE = /[\u4e00-\u9fff]/;
/** Союзы уступки: «即使是…还是» ≠ выбор «是…还是». */
const CONCESSIVE_BEFORE_SHI = ['即使', '哪怕', '就算'] as const;

interface RawGrammarEntry {
  hanzi?: string;
  structure?: string;
  parts?: string[];
  level?: number | string;
  type?: string;
  category?: string;
  词语?: string;
  等级?: number | string;
  explanation?: string;
  example?: string;
}

function normalizeLevel(level: number | string | undefined): number {
  if (typeof level === 'number' && Number.isFinite(level)) {
    const n = Math.round(level);
    if (n < 1) return 1;
    if (n > 9) return 9;
    return n;
  }
  const raw = String(level ?? '').trim();
  if (/^7\s*[-–—]\s*9$/.test(raw)) return 7;
  const match = raw.match(/(\d+)/);
  if (!match) return 9;
  const n = parseInt(match[1]!, 10);
  if (!Number.isFinite(n) || n < 1) return 9;
  return Math.min(9, n);
}

function hasEllipsis(text: string): boolean {
  return /……|\.\.\.|…|⋯/.test(text);
}

function normalizeStructure(raw: string): string {
  return raw
    .trim()
    .replace(/……|\.\.\.|⋯{1,2}/g, '…')
    .replace(/\s+/g, '');
}

function splitStructureParts(structure: string): string[] {
  return structure
    .split('…')
    .map((p) => p.replace(/^[,，、；;\s]+|[,，、；;\s]+$/g, ''))
    .filter((p) => CHINESE_RE.test(p) && !/^[XYAB\d]+$/.test(p));
}

/**
 * Загружает ВСЕ грамматические конструкции из hsk_grammar.json
 * (записи type=grammar / с троеточием в схеме).
 */
function loadGrammarPatternsFromDictionary(): HskGrammarPattern[] {
  const byKey = new Map<string, HskGrammarPattern>();

  const add = (raw: RawGrammarEntry, sourceHint?: string) => {
    const structureRaw = String(
      raw.structure || raw.hanzi || raw.词语 || ''
    ).trim();
    if (!structureRaw) return;

    const structure = normalizeStructure(structureRaw);
    if (!CHINESE_RE.test(structure)) return;

    const parts =
      Array.isArray(raw.parts) && raw.parts.length > 0
        ? raw.parts.map((p) => String(p).trim().replace(/[？?]$/, '')).filter(Boolean)
        : splitStructureParts(structure);

    if (parts.length === 0) return;
    // отбрасываем формулы с «+动词» и т.п.
    if (parts.some((p) => /\+|动词|名词|形容词/.test(p))) return;
    if (/^[，,、；;]/.test(structure)) return;
    if (parts.length === 1 && longestAltLen(parts[0]) <= 2) {
      const allowFixed = new Set([
        '越来越',
        '来得及',
        '来不及',
        '有的是',
        '说不定',
        '怪不得',
        '恨不得',
        '巴不得',
        '不一会儿',
        '动不动就',
      ]);
      if (!allowFixed.has(parts[0])) return;
    }

    // паттерн из одних односложных частиц без кураторского белого списка — шум
    const nonOptional = parts.filter((p) => !expandPartAlternatives(p).includes(''));
    if (nonOptional.length === 0) return;
    if (
      nonOptional.every((p) => longestAltLen(p) <= 1) &&
      !isAllowedShortPair(nonOptional)
    ) {
      return;
    }
    if (nonOptional[0] === '了' || nonOptional[0] === '的') return;

    const hskLevel = normalizeLevel(raw.level ?? raw.等级);
    const cleanStructure = structure.replace(/^[，,、]+/, '').replace(/[？?]$/, '');
    const idBase = cleanStructure.replace(/[^\u4e00-\u9fffA-Za-z0-9]/g, '-');
    const id = `${idBase}-hsk${hskLevel}${sourceHint ? `-${sourceHint}` : ''}`;

    const existing = byKey.get(cleanStructure);
    if (existing && existing.hskLevel <= hskLevel) return;

    byKey.set(cleanStructure, {
      id,
      structure: cleanStructure,
      parts,
      explanation:
        raw.explanation?.trim() ||
        `Грамматическая конструкция HSK ${hskLevel}: «${cleanStructure}».`,
      example: raw.example?.trim() || '',
      hskLevel,
    });
  };

  const grammarList: unknown[] = Array.isArray(hskGrammarJson) ? hskGrammarJson : [];
  for (const item of grammarList) {
    if (!item || typeof item !== 'object') continue;
    const row = item as RawGrammarEntry;
    const type = String(row.type || row.category || '').toLowerCase();
    const structure = String(row.structure || row.hanzi || row.词语 || '');
    const isGrammar =
      type.includes('grammar') ||
      type.includes('语法') ||
      hasEllipsis(structure) ||
      (Array.isArray(row.parts) && row.parts.length > 0);
    if (!isGrammar) continue;
    add(row, 'grammar');
  }

  const patterns = [...byKey.values()];
  patterns.sort((a, b) => patternScore(b) - patternScore(a));
  return patterns;
}

function longestAltLen(part: string): number {
  const alts = expandPartAlternatives(part).filter((a) => a.length > 0);
  if (alts.length === 0) return 0;
  return Math.max(...alts.map((a) => a.length));
}

function isAllowedShortPair(parts: string[]): boolean {
  const key = parts.map((p) => expandPartAlternatives(p).filter(Boolean)[0] ?? p).join('+');
  return new Set([
    '一+就',
    '又+又',
    '越+越',
    '不+不',
    '再+也',
    '既+又',
    '连+都',
    '连+也',
  ]).has(key);
}

/** Специфичность: больше частей и более длинные альтернативы — выше приоритет. */
function patternScore(p: HskGrammarPattern): number {
  return (
    p.parts.length * 100 +
    p.parts.reduce((s, part) => s + longestAltLen(part) * 10, 0) +
    (p.structure.includes('…') ? 5 : 0)
  );
}

let cachedPatterns: HskGrammarPattern[] | null = null;

export function getHskGrammarPatterns(): HskGrammarPattern[] {
  if (!cachedPatterns) {
    cachedPatterns = loadGrammarPatternsFromDictionary();
    console.log('HSK grammar patterns loaded:', cachedPatterns.length);
  }
  return cachedPatterns;
}

export function resetGrammarPatternsCache(): void {
  cachedPatterns = null;
}

/** Для обратной совместимости — всегда актуальный список из словаря. */
export function getHSK_GRAMMAR_PATTERNS(): HskGrammarPattern[] {
  return getHskGrammarPatterns();
}

function toGrammarPoint(pattern: HskGrammarPattern): GrammarPoint & { hskLevel?: number } {
  return {
    structure: pattern.structure,
    explanation: pattern.explanation,
    example: pattern.example,
    hskLevel: pattern.hskLevel,
  };
}

/** Варианты одной части: «也/都» → [也, 都]; «（就）」 → [, 就] (пусто = опционально). */
function expandPartAlternatives(part: string): string[] {
  const optionalMatch = part.match(/^（([^）]+)）$/) || part.match(/^\(([^)]+)\)$/);
  if (optionalMatch) {
    const inner = expandPartAlternatives(optionalMatch[1]);
    return ['', ...inner];
  }

  if (part.includes('/')) {
    return part
      .split('/')
      .map((p) => p.trim())
      .filter((p) => p.length > 0)
      .flatMap((p) => expandPartAlternatives(p));
  }

  // вложенные опциональные куски: 为（了） → 为了 | 为
  if (/[（(][^）)]+[）)]/.test(part)) {
    const full = part.replace(/[（）()]/g, '');
    const without = part.replace(/[（(][^）)]+[）)]/g, '');
    return [...new Set([full, without].filter((x) => x.length > 0))];
  }

  return [part];
}

function findTokenInSentence(
  sentence: string,
  token: string,
  fromIndex: number
): number {
  if (!token) return fromIndex;
  return sentence.indexOf(token, fromIndex);
}

/**
 * Ищет parts паттерна внутри одного предложения (относительные индексы).
 * Возвращает диапазоны каждой найденной части или null.
 */
function matchPartsInSentence(
  sentence: string,
  parts: string[]
): Array<{ start: number; end: number }> | null {
  const ranges: Array<{ start: number; end: number }> = [];
  let cursor = 0;
  let matchedRequired = 0;

  for (let pi = 0; pi < parts.length; pi += 1) {
    const alternatives = expandPartAlternatives(parts[pi]);
    const isOptional = alternatives.includes('');
    // более длинные альтернативы раньше; пустую опцию пробуем последней
    const sortedAlts = [...alternatives].sort((a, b) => {
      if (a === '' && b !== '') return 1;
      if (b === '' && a !== '') return -1;
      return b.length - a.length;
    });

    let best: { start: number; end: number; optionalEmpty: boolean } | null = null;

    for (const alt of sortedAlts) {
      if (alt === '') {
        if (!best) best = { start: cursor, end: cursor, optionalEmpty: true };
        continue;
      }
      const idx = findTokenInSentence(sentence, alt, cursor);
      if (idx < 0) continue;
      // для парных одинаковых частей (又…又) требуем зазор
      if (
        ranges.length > 0 &&
        parts.length >= 2 &&
        parts[pi] === parts[pi - 1] &&
        idx < ranges[ranges.length - 1].end + 1
      ) {
        continue;
      }
      best = { start: idx, end: idx + alt.length, optionalEmpty: false };
      break;
    }

    if (!best) return null;
    if (!best.optionalEmpty) {
      ranges.push({ start: best.start, end: best.end });
      cursor = best.end;
      if (!isOptional) matchedRequired += 1;
    }
  }

  if (ranges.length === 0) return null;

  const requiredCount = parts.filter((p) => !expandPartAlternatives(p).includes('')).length;
  if (matchedRequired < requiredCount) return null;
  // не считаем матч, если поймали только короткий хвост при «пустых» опциональных частях
  const solidLen = ranges.reduce((s, r) => s + (r.end - r.start), 0);
  if (solidLen < 2 && requiredCount < 2) return null;

  return ranges;
}

/** Разбивает текст на предложения с абсолютными смещениями. */
function splitSentences(text: string): Array<{ text: string; offset: number }> {
  const result: Array<{ text: string; offset: number }> = [];
  let start = 0;
  for (let i = 0; i < text.length; i += 1) {
    if (SENTENCE_SPLIT_RE.test(text[i])) {
      const slice = text.slice(start, i + 1);
      if (slice.trim()) result.push({ text: slice, offset: start });
      start = i + 1;
    }
  }
  if (start < text.length) {
    const slice = text.slice(start);
    if (slice.trim()) result.push({ text: slice, offset: start });
  }
  return result;
}

function isRangeCovered(covered: Set<number>, start: number, end: number): boolean {
  for (let i = start; i < end; i += 1) {
    if (covered.has(i)) return true;
  }
  return false;
}

function markCovered(covered: Set<number>, start: number, end: number): void {
  for (let i = start; i < end; i += 1) covered.add(i);
}

/** В схеме явно есть запятая между частями, либо части — многосложные союзы (虽然…但是). */
function structureAllowsCommaBetweenParts(
  structure: string,
  parts: string[]
): boolean {
  if (/…\s*[,，]/.test(structure) || /[,，]\s*…/.test(structure)) return true;
  const required = parts.filter((p) => !expandPartAlternatives(p).includes(''));
  // односложные связки (不…不, 又…又, 一…就) — только внутри клаузы
  return required.some((p) => longestAltLen(p) >= 2);
}

/**
 * Между частями A…B не должно быть границ придаточного.
 * Если запятая допустима для схемы — одна «，» в зазоре ок, но не .!? и не несколько «，».
 */
function gapCrossesClauseBoundary(
  sentence: string,
  ranges: Array<{ start: number; end: number }>,
  pattern: HskGrammarPattern
): boolean {
  if (ranges.length < 2) return false;
  const allowComma = structureAllowsCommaBetweenParts(pattern.structure, pattern.parts);

  for (let i = 1; i < ranges.length; i += 1) {
    const gap = sentence.slice(ranges[i - 1].end, ranges[i].start);
    if (HARD_CLAUSE_BOUNDARY_RE.test(gap)) return true;
    if (allowComma) {
      const commas = gap.match(/[,，]/g);
      if (commas && commas.length > 1) return true;
    } else if (CLAUSE_BOUNDARY_RE.test(gap)) {
      return true;
    }
  }
  return false;
}

/**
 * «不，谢谢» / «是，我知道» — вводное перед запятой, не первая часть A…B.
 * Отсекаем, если сразу после первой найденной части идёт запятая (без китайского текста между).
 */
function isLeadingInterjectionBeforeComma(
  sentence: string,
  ranges: Array<{ start: number; end: number }>
): boolean {
  if (ranges.length === 0) return false;
  const first = ranges[0];
  const token = sentence.slice(first.start, first.end);
  if (token.length > 2) return false;

  let i = first.end;
  while (i < sentence.length && /\s/.test(sentence[i])) i += 1;
  return sentence[i] === '，' || sentence[i] === ',';
}

function isShiHaishiPattern(pattern: HskGrammarPattern): boolean {
  return /是/.test(pattern.structure) && /还是/.test(pattern.structure);
}

/** «即使是…还是» / «哪怕是…» — не выбор «是…还是». */
function isShiBlockedByConcessive(
  text: string,
  absRanges: Array<{ start: number; end: number }>,
  pattern: HskGrammarPattern
): boolean {
  if (!isShiHaishiPattern(pattern)) return false;

  for (const r of absRanges) {
    const token = text.slice(r.start, r.end);
    if (token !== '是') continue;
    for (const conj of CONCESSIVE_BEFORE_SHI) {
      if (r.start >= conj.length && text.slice(r.start - conj.length, r.start) === conj) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Ищет грамматические конструкции в тексте.
 * Для «A…B» требуется A, затем B в пределах одного придаточного (без перехода через ，.!? и т.п.,
 * кроме схем, где запятая явно входит в конструкцию).
 */
export function findGrammarMatches(text: string): GrammarMatch[] {
  const patterns = getHskGrammarPatterns();
  const matches: GrammarMatch[] = [];
  const covered = new Set<number>();
  const sentences = splitSentences(text);

  for (const pattern of patterns) {
    const point = toGrammarPoint(pattern);

    // спец-случай: 越…越 не должен ловить 越来越
    const isYueYue =
      pattern.parts.length === 2 &&
      pattern.parts[0] === '越' &&
      pattern.parts[1] === '越';

    for (const { text: sentence, offset } of sentences) {
      if (isYueYue && sentence.includes('越来越') && !/越(?!来越).{1,20}越/.test(sentence)) {
        continue;
      }

      // «一…就» — не цепляем 一起/一边/一定/一样
      const isYiJiu =
        pattern.parts.length === 2 &&
        pattern.parts[0] === '一' &&
        pattern.parts[1] === '就';

      let searchFrom = 0;
      while (searchFrom < sentence.length) {
        const window = sentence.slice(searchFrom);
        const local = matchPartsInSentence(window, pattern.parts);
        if (!local) break;

        const localInSentence = local.map((r) => ({
          start: searchFrom + r.start,
          end: searchFrom + r.end,
        }));
        const absRanges = localInSentence.map((r) => ({
          start: offset + r.start,
          end: offset + r.end,
        }));

        const advance = () => {
          searchFrom += Math.max(local[0]?.end ?? 1, 1);
        };

        if (isYiJiu) {
          const yiStart = absRanges[0]?.start ?? -1;
          const after = text.slice(yiStart, yiStart + 2);
          if (after === '一起' || after === '一边' || after === '一定' || after === '一样') {
            advance();
            continue;
          }
          const gap = absRanges[1].start - absRanges[0].end;
          if (gap < 1 || gap > 12) {
            advance();
            continue;
          }
        }

        if (isYueYue) {
          const first = absRanges[0];
          if (text.slice(first.start, first.start + 3) === '越来越') {
            advance();
            continue;
          }
        }

        // 1) не переходим через знаки препинания между частями
        if (gapCrossesClauseBoundary(sentence, localInSentence, pattern)) {
          advance();
          continue;
        }

        // 2) вводные «不，…» / «是，…» не начинают парную конструкцию
        if (
          pattern.parts.length >= 2 &&
          isLeadingInterjectionBeforeComma(sentence, localInSentence)
        ) {
          advance();
          continue;
        }

        // 3) «即使/哪怕/就算» + «是…还是» — не выбор
        if (isShiBlockedByConcessive(text, absRanges, pattern)) {
          advance();
          continue;
        }

        if (absRanges.every((r) => !isRangeCovered(covered, r.start, r.end))) {
          for (const r of absRanges) {
            markCovered(covered, r.start, r.end);
            matches.push({
              start: r.start,
              end: r.end,
              point,
              patternId: pattern.id,
            });
          }
        }

        // продолжаем поиск после первой части
        advance();
      }
    }
  }

  return matches.sort((a, b) => a.start - b.start);
}

/** Уникальные грамматические пункты, найденные в тексте */
export function detectGrammarPoints(text: string): Array<GrammarPoint & { hskLevel?: number }> {
  const matches = findGrammarMatches(text);
  const seen = new Set<string>();
  const points: Array<GrammarPoint & { hskLevel?: number }> = [];

  for (const m of matches) {
    if (seen.has(m.patternId)) continue;
    seen.add(m.patternId);
    points.push(m.point);
  }

  return points;
}
