import { findGrammarMatches } from '../data/hskGrammarPatterns';
import { lookupBkrs } from '../services/bkrsService';
import { analyzeText } from '../services/hskLocalService';
import type { Book as LegacyBook, Paragraph as LegacyParagraph, Word } from '../types';
import type {
  Book as DomainBook,
  Paragraph as DomainParagraph,
  WordToken,
} from '../types/domain';
import type { TargetHskLevel } from '../types';

/**
 * Токенизация исходного китайского текста в domain Paragraph[] + HSK-статистика.
 * Используется при первом открытии книги (isParsed === false).
 */
export function parseZhTextToDomainParagraphs(
  zhText: string,
  targetHskLevel: number,
  russianText?: string
): { paragraphs: DomainParagraph[]; stats: Record<string, number> } {
  const level = Math.min(6, Math.max(1, targetHskLevel)) as TargetHskLevel;
  const chunks = zhText
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
  const content = chunks.length > 0 ? chunks : [zhText.trim()].filter(Boolean);

  const ruChunks = (russianText ?? '')
    .split(/\n\s*\n/)
    .map((p) => p.trim());

  const stats: Record<string, number> = {};
  const paragraphs: DomainParagraph[] = content.map((originalZh, pi) => {
    const analysis = analyzeText(originalZh, level);
    const grammarHits = findGrammarMatches(originalZh);

    const grammarMatches = dedupeGrammarMatches(
      grammarHits.map((m) => ({
        pattern: m.point.structure,
        hskLevel: m.point.hskLevel ?? 0,
        ruleId: m.patternId,
      }))
    );

    const tokens: WordToken[] = analysis.words
      .filter((w) => w.isChinese && w.hanzi)
      .map((w, wi) => {
        const levelKey = String(w.level ?? 0);
        stats[levelKey] = (stats[levelKey] ?? 0) + 1;
        return {
          id: `tok-${pi}-${wi}-${w.hanzi}`,
          hanzi: w.hanzi!,
          pinyin: w.pinyin ?? '',
          translation: lookupBkrs(w.hanzi!) ?? w.translation ?? '',
          hskLevel: w.level ?? 0,
          isGrammar: false,
          grammarRuleId: '',
        };
      });

    // помечаем токены, попавшие в grammar span
    for (const hit of grammarHits) {
      const span = originalZh.slice(hit.start, hit.end);
      for (const token of tokens) {
        if (
          !token.isGrammar &&
          (span === token.hanzi || span.includes(token.hanzi))
        ) {
          // только если токен целиком внутри span по тексту — грубая пометка
          token.isGrammar = span.includes(token.hanzi);
          if (token.isGrammar) token.grammarRuleId = hit.patternId;
        }
      }
    }

    return {
      id: `para-${pi}`,
      originalZh,
      textRu: ruChunks[pi] ?? '',
      tokens,
      grammarMatches,
    };
  });

  return { paragraphs, stats };
}

function dedupeGrammarMatches(
  matches: DomainParagraph['grammarMatches']
): DomainParagraph['grammarMatches'] {
  const seen = new Set<string>();
  const out: DomainParagraph['grammarMatches'] = [];
  for (const m of matches) {
    if (seen.has(m.ruleId)) continue;
    seen.add(m.ruleId);
    out.push(m);
  }
  return out;
}

/** Если legacy-книга уже содержит слова — конвертируем в domain без повторного analyzeText. */
export function legacyParagraphsToDomain(
  book: LegacyBook
): { paragraphs: DomainParagraph[]; stats: Record<string, number> } | null {
  if (!book.paragraphs.some((p) => p.words.length > 0)) return null;

  const stats: Record<string, number> = {};
  const paragraphs: DomainParagraph[] = book.paragraphs.map((p, pi) => {
    const tokens: WordToken[] = p.words.map((w, wi) => {
      const levelKey = String(w.hskLevel ?? 0);
      stats[levelKey] = (stats[levelKey] ?? 0) + 1;
      return {
        id: w.id || `tok-${pi}-${wi}-${w.hanzi}`,
        hanzi: w.hanzi,
        pinyin: w.pinyin,
        translation: w.translation,
        hskLevel: w.hskLevel ?? 0,
        isGrammar: false,
        grammarRuleId: '',
      };
    });

    const grammarMatches = (p.grammar ?? []).map((g, gi) => ({
      pattern: g.structure,
      hskLevel: g.hskLevel ?? 0,
      ruleId: `${g.structure}-hsk${g.hskLevel ?? 0}-${gi}`,
    }));

    return {
      id: `para-${pi}`,
      originalZh: p.chineseText || p.originalText,
      textRu: p.russianTranslation ?? '',
      tokens,
      grammarMatches,
    };
  });

  return { paragraphs, stats };
}

/** Legacy Book → Domain Book (без повторного парсинга; isParsed=false если нет кеша). */
export function legacyBookToDomain(book: LegacyBook): DomainBook {
  const zh =
    book.sourceText?.trim() ||
    book.paragraphs.map((p) => p.chineseText).join('\n\n');
  const ru =
    book.originalRussianText?.trim() ||
    book.paragraphs.map((p) => p.russianTranslation).join('\n\n') ||
    undefined;

  const createdAt = Date.parse(book.createdAt) || Date.now();
  const lastReadAt = Date.parse(book.updatedAt ?? book.createdAt) || createdAt;

  return {
    id: book.id,
    title: book.title,
    originalZhText: zh,
    russianText: ru || undefined,
    collectionId: book.collectionId,
    targetHskLevel: book.targetHskLevel,
    createdAt,
    lastReadAt,
    isParsed: false,
    parsedParagraphs: undefined,
    hskStats: undefined,
  };
}

/** Domain Paragraph → Legacy Paragraph для существующего UI ридера. */
export function domainParagraphToLegacy(
  paragraph: DomainParagraph
): LegacyParagraph {
  const words: Word[] = paragraph.tokens
    .filter((t) => t.hanzi)
    .map((t) => ({
      id: t.id,
      hanzi: t.hanzi,
      pinyin: t.pinyin,
      translation: t.translation,
      status: 'new' as const,
      hskLevel: t.hskLevel || undefined,
    }));

  return {
    originalText: paragraph.originalZh,
    chineseText: paragraph.originalZh,
    englishText: '',
    russianTranslation: paragraph.textRu,
    translations: undefined,
    words,
    grammar: paragraph.grammarMatches.map((g) => ({
      structure: g.pattern,
      explanation: `Грамматическая конструкция HSK ${g.hskLevel}: «${g.pattern}».`,
      example: '',
      hskLevel: g.hskLevel || undefined,
    })),
  };
}

/** Смержить domain-кеш обратно в legacy Book для saveBook / sync. */
export function applyDomainCacheToLegacyBook(
  book: LegacyBook,
  paragraphs: DomainParagraph[]
): LegacyBook {
  return {
    ...book,
    paragraphs: paragraphs.map((p, i) => {
      const legacy = domainParagraphToLegacy(p);
      const prev = book.paragraphs[i];
      if (prev?.russianTranslation?.trim() && !legacy.russianTranslation.trim()) {
        return {
          ...legacy,
          russianTranslation: prev.russianTranslation,
          translations: prev.translations ?? legacy.translations,
        };
      }
      // сохраняем статусы слов, если уже были
      if (prev?.words?.length) {
        const statusByHanzi = new Map(prev.words.map((w) => [w.hanzi, w.status]));
        return {
          ...legacy,
          translations: prev.translations ?? legacy.translations,
          words: legacy.words.map((w) => ({
            ...w,
            status: statusByHanzi.get(w.hanzi) ?? w.status,
          })),
        };
      }
      return {
        ...legacy,
        translations: prev?.translations ?? legacy.translations,
      };
    }),
    updatedAt: new Date().toISOString(),
  };
}
