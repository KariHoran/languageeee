import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import CollectionWordPicker from '../components/CollectionWordPicker';
import HskStatsBadge from '../components/HskStatsBadge';
import StarfieldBackground from '../components/StarfieldBackground';
import {
  NotebookStickers,
  StickyNoteModal,
  StickyNotesLayer,
} from '../components/StickyNotes';
import { findGrammarMatches, GrammarMatch } from '../data/hskGrammarPatterns';
import {
  useLocalizedGrammarExplanation,
  useNativeParagraphTranslation,
} from '../hooks/useLocalizedText';
import { useI18n } from '../i18n/useI18n';
import { lookupBkrs } from '../services/bkrsService';
import { segmentChineseText } from '../services/chineseTokenizer';
import { addFlashcard, hasFlashcard } from '../services/flashcardsStore';
import {
  createLexiconPredicate,
  loadHskDictionary,
  pinyinFor,
} from '../services/hskLocalService';
import {
  resolveReadingProgress,
  saveReadingProgress,
} from '../services/readingProgressStore';
import { updateWordStatus, deleteBook } from '../services/storageService';
import { ttsService } from '../services/ttsService';
import {
  alignRussianParagraphs,
  isTranslationFailureText,
  stripTranslationFailureMarkers,
  translateParagraphsZhToRu,
} from '../services/translationService';
import { prefetchTranslationCache } from '../services/translationCache';
import {
  applyDomainCacheToLegacyBook,
  legacyBookToDomain,
  legacyParagraphsToDomain,
  parseZhTextToDomainParagraphs,
} from '../store/parseBook';
import { useAppStore } from '../store/useAppStore';
import { useTheme } from '../theme/ThemeContext';
import { grammarMarkerKind, markerColor } from '../theme/y2k';
import { Book, GrammarPoint, NativeLanguage, Paragraph, Word } from '../types';
import type { StickyNote } from '../types/stickyNote';
import { showConfirm, showAlert } from '../utils/alert';
import { formatBookTitleLine } from '../utils/bookTitle';
import { getHskBadgeColors } from '../utils/hskColors';

/** Вырезает предложение/окно контекста вокруг слова из абзаца */
function extractContextSentence(paragraphText: string, hanzi: string): string {
  const text = paragraphText.trim();
  if (!text || !hanzi) return text.slice(0, 80);
  const idx = text.indexOf(hanzi);
  if (idx < 0) return text.slice(0, 100);

  const boundaries = /[。！？；;\n]/;
  let start = 0;
  let end = text.length;
  for (let i = idx - 1; i >= 0; i--) {
    if (boundaries.test(text[i])) {
      start = i + 1;
      break;
    }
  }
  for (let i = idx + hanzi.length; i < text.length; i++) {
    if (boundaries.test(text[i])) {
      end = i + 1;
      break;
    }
  }
  const slice = text.slice(start, end).trim();
  return slice.length > 160 ? `${slice.slice(0, 157)}…` : slice;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const IS_TABLET = SCREEN_WIDTH >= 768;

interface ReaderScreenProps {
  book: Book;
  onBookUpdate?: (book: Book) => void;
  onBack?: () => void;
  onBookDeleted?: () => void;
}

interface PopoverState {
  word: Word;
  x: number;
  y: number;
}

interface GrammarPopoverState {
  point: GrammarPoint;
  x: number;
  y: number;
}

interface TokenSegment {
  text: string;
  word?: Word;
  grammar?: GrammarPoint;
}

/**
 * Токены читалки: Intl.Segmenter('zh-CN') + FMM по БКРС/HSK.
 * 成语 / составные слова — один токен; пиньинь — для целого слова (кэш).
 * Сеть не вызывается при сборке DOM.
 */
function tokenizeChineseText(
  chineseText: string,
  words: Word[],
  grammarMatches: GrammarMatch[],
  opts?: { withPinyin?: boolean }
): TokenSegment[] {
  const withPinyin = opts?.withPinyin ?? false;
  const hskMap = loadHskDictionary();
  const extraLex = new Set(
    words.map((w) => w.hanzi?.trim()).filter((h): h is string => !!h && [...h].length >= 2)
  );
  const isLexeme = createLexiconPredicate(
    extraLex.size > 0 ? { has: (k) => extraLex.has(k) } : undefined
  );

  const wordByHanzi = new Map<string, Word>();
  for (const w of words) {
    if (w.hanzi && !wordByHanzi.has(w.hanzi)) wordByHanzi.set(w.hanzi, w);
  }

  const resolveWord = (hanzi: string, pos: number): Word => {
    const existing = wordByHanzi.get(hanzi);
    const py = withPinyin
      ? existing?.pinyin?.trim() || pinyinFor(hanzi)
      : existing?.pinyin?.trim() || '';
    const translation =
      lookupBkrs(hanzi)?.trim() || existing?.translation?.trim() || '';
    const hskLevel = existing?.hskLevel ?? hskMap.get(hanzi)?.level;
    if (existing) {
      return {
        ...existing,
        pinyin: py || existing.pinyin,
        translation: translation || existing.translation,
        hskLevel: hskLevel ?? existing.hskLevel,
      };
    }
    return {
      id: `lex-${pos}-${hanzi}`,
      hanzi,
      pinyin: py,
      translation,
      status: 'new',
      hskLevel,
    };
  };

  const grammarAt = (pos: number): GrammarMatch | undefined =>
    grammarMatches.find((m) => pos >= m.start && pos < m.end);

  const lexSegs = segmentChineseText(chineseText, { isLexeme });
  const segments: TokenSegment[] = [];
  let pos = 0;
  let segIdx = 0;

  while (segIdx < lexSegs.length) {
    const gMatch = grammarAt(pos);
    if (gMatch && gMatch.start === pos) {
      const span = chineseText.slice(gMatch.start, gMatch.end);
      const word = /[\u4e00-\u9fff]/.test(span)
        ? resolveWord(
            isLexeme(span) ? span : (lexSegs[segIdx]?.text ?? span),
            pos
          )
        : undefined;
      segments.push({ text: span, word, grammar: gMatch.point });
      let covered = 0;
      while (segIdx < lexSegs.length && covered < span.length) {
        covered += lexSegs[segIdx]!.text.length;
        segIdx += 1;
      }
      pos = gMatch.end;
      continue;
    }

    const seg = lexSegs[segIdx]!;
    // Пунктуация / не-слова — без Pressable
    if (!seg.isChinese || !seg.isWordLike) {
      segments.push({ text: seg.text });
    } else {
      segments.push({ text: seg.text, word: resolveWord(seg.text, pos) });
    }
    pos += seg.text.length;
    segIdx += 1;
  }

  return segments;
}

function WordPopover({
  popover,
  onClose,
  onAddToDictionary,
  onMarkKnown,
  onAddToFlashcards,
  inFlashcards,
}: {
  popover: PopoverState;
  onClose: () => void;
  onAddToDictionary: (word: Word) => void;
  onMarkKnown: (word: Word) => void;
  onAddToFlashcards: (word: Word) => void;
  inFlashcards: boolean;
}) {
  const theme = useTheme();
  const { t } = useI18n();
  const { word, x, y } = popover;
  const popoverWidth = 280;
  const left = Math.min(Math.max(x - popoverWidth / 2, 16), SCREEN_WIDTH - popoverWidth - 16);
  const hskColors = word.hskLevel != null ? getHskBadgeColors(word.hskLevel) : null;
  const bkrsTranslation = lookupBkrs(word.hanzi)?.trim() || '';

  const handleClose = () => {
    ttsService.stop();
    onClose();
  };

  const handleSpeak = () => {
    if (ttsService.isSpeaking()) {
      ttsService.stop();
      return;
    }
    void ttsService.speak(word.hanzi);
  };

  return (
    <Modal transparent visible animationType="fade" onRequestClose={handleClose}>
      <Pressable style={styles.popoverOverlay} onPress={handleClose}>
        <Pressable
          style={[
            styles.popover,
            {
              top: Math.min(y + 12, Dimensions.get('window').height - 440),
              left,
              maxHeight: 420,
            },
          ]}
          onPress={(e) => e.stopPropagation()}
        >
          <ScrollView
            nestedScrollEnabled
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.popoverHeader}>
              <Text style={styles.popoverHanzi}>{word.hanzi}</Text>
              <Pressable
                style={styles.speakButton}
                onPress={handleSpeak}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={t('reader.ttsWord', { word: word.hanzi })}
              >
                <Text style={styles.speakButtonText}>🔊</Text>
              </Pressable>
              {word.hskLevel != null && hskColors && (
                <View style={[styles.hskLevelBadge, { backgroundColor: hskColors.background }]}>
                  <Text style={[styles.hskLevelBadgeText, { color: hskColors.text }]}>
                    HSK {word.hskLevel}
                  </Text>
                </View>
              )}
            </View>
            {word.pinyin?.trim() ? (
              <Text style={[styles.popoverPinyin, { color: theme.accentPink }]}>
                {word.pinyin}
              </Text>
            ) : null}
            {bkrsTranslation ? (
              <Text style={styles.popoverTranslation}>{bkrsTranslation}</Text>
            ) : null}

            <Pressable
              style={[
                styles.popoverButton,
                inFlashcards ? styles.popoverButtonDisabled : styles.popoverButtonFlashcard,
              ]}
              onPress={() => !inFlashcards && onAddToFlashcards(word)}
              disabled={inFlashcards}
            >
              <Text
                style={
                  inFlashcards
                    ? styles.popoverButtonTextDisabled
                    : styles.popoverButtonTextFlashcard
                }
              >
                {inFlashcards ? t('word.alreadyInCard') : t('word.addCard')}
              </Text>
            </Pressable>

            {word.status !== 'learning' && (
              <Pressable
                style={[styles.popoverButton, styles.popoverButtonPrimary]}
                onPress={() => onAddToDictionary(word)}
              >
                <Text style={styles.popoverButtonTextPrimary}>
                  {t('word.addToDict')}
                </Text>
              </Pressable>
            )}
            {word.status !== 'known' && (
              <Pressable
                style={[styles.popoverButton, styles.popoverButtonSecondary]}
                onPress={() => onMarkKnown(word)}
              >
                <Text style={styles.popoverButtonTextSecondary}>
                  {t('word.markKnown')}
                </Text>
              </Pressable>
            )}
            {word.status === 'learning' && (
              <Text style={styles.popoverStatusHint}>{t('word.inDict')}</Text>
            )}
            {word.status === 'known' && (
              <Text style={styles.popoverStatusHint}>
                {t('word.markedKnown')}
              </Text>
            )}

            <CollectionWordPicker
              hanzi={word.hanzi}
              pinyin={word.pinyin}
              translation={bkrsTranslation || word.translation}
              hskLevel={word.hskLevel}
              replaceMode
            />
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function GrammarPopover({
  popover,
  onClose,
  nativeLanguage,
}: {
  popover: GrammarPopoverState;
  onClose: () => void;
  nativeLanguage: NativeLanguage;
}) {
  const { point, x, y } = popover;
  const { t } = useI18n();
  const [grammarBusy, setGrammarBusy] = useState(false);
  const [grammarInDeck, setGrammarInDeck] = useState(false);
  const popoverWidth = 300;
  const left = Math.min(Math.max(x - popoverWidth / 2, 16), SCREEN_WIDTH - popoverWidth - 16);
  const explanation = useLocalizedGrammarExplanation(
    point.explanation,
    nativeLanguage
  );
  const badgeLabel =
    t('reader.grammarBadge') +
    (point.hskLevel != null ? ` HSK ${point.hskLevel}` : '');

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const { hasFlashcard } = await import('../services/flashcardsStore');
        const ok = await hasFlashcard(point.structure, 'zh');
        if (!cancelled) setGrammarInDeck(ok);
      } catch {
        if (!cancelled) setGrammarInDeck(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [point.structure]);

  return (
    <Modal transparent visible animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.popoverOverlay} onPress={onClose}>
        <Pressable
          style={[styles.popover, styles.grammarPopover, { top: Math.max(y - 40, 40), left }]}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={styles.grammarPopoverBadge}>
            <Text style={styles.grammarPopoverBadgeText}>{badgeLabel}</Text>
          </View>
          <Text style={styles.grammarPopoverStructure}>{point.structure}</Text>
          {explanation ? (
            <Text style={styles.grammarPopoverExplanation}>{explanation}</Text>
          ) : null}
          {point.example ? (
            <Text style={styles.grammarPopoverExample}>{point.example}</Text>
          ) : null}
          <Pressable
            disabled={grammarBusy || grammarInDeck}
            onPress={() => {
              void (async () => {
                setGrammarBusy(true);
                try {
                  const { addFlashcard } = await import('../services/flashcardsStore');
                  await addFlashcard({
                    hanzi: point.structure,
                    translation: explanation || point.explanation || '',
                    language: 'zh',
                    kind: 'grammar',
                    hskLevel: point.hskLevel,
                    contextSentence: point.example,
                  });
                  setGrammarInDeck(true);
                } finally {
                  setGrammarBusy(false);
                }
              })();
            }}
            style={{
              marginTop: 12,
              paddingVertical: 10,
              borderRadius: 10,
              backgroundColor: grammarInDeck ? '#e5e7eb' : '#D0FF00',
              alignItems: 'center',
            }}
          >
            <Text
              style={{
                fontWeight: '700',
                color: grammarInDeck ? '#9ca3af' : '#0D0D11',
                fontSize: 13,
              }}
            >
              {grammarInDeck
                ? t('flashcards.grammarAdded')
                : t('flashcards.addGrammar')}
            </Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function GrammarAccordionItem({
  point,
  index,
  nativeLanguage,
}: {
  point: GrammarPoint;
  index: number;
  nativeLanguage: NativeLanguage;
}) {
  const explanation = useLocalizedGrammarExplanation(
    point.explanation,
    nativeLanguage
  );
  return (
    <View key={`${point.structure}-${index}`} style={styles.grammarItem}>
      <View style={styles.grammarItemHeader}>
        <Text style={styles.grammarStructure}>{point.structure}</Text>
        {point.hskLevel != null && (
          <View style={styles.grammarLevelChip}>
            <Text style={styles.grammarLevelChipText}>HSK {point.hskLevel}</Text>
          </View>
        )}
      </View>
      {explanation ? (
        <Text style={styles.grammarExplanation}>{explanation}</Text>
      ) : null}
      {point.example ? (
        <Text style={styles.grammarExample}>{point.example}</Text>
      ) : null}
    </View>
  );
}

function GrammarAccordion({
  grammar,
  nativeLanguage,
}: {
  grammar: GrammarPoint[];
  nativeLanguage: NativeLanguage;
}) {
  const [expanded, setExpanded] = useState(false);
  const { t } = useI18n();
  if (grammar.length === 0) return null;

  const headerLabel = `${expanded ? '▼' : '▶'} ${t('reader.grammarToggle', {
    n: grammar.length,
  })}`;

  return (
    <View style={styles.grammarBlock}>
      <Pressable
        style={styles.grammarHeader}
        onPress={() => setExpanded((v) => !v)}
        accessibilityRole="button"
      >
        <Text style={styles.grammarHeaderText}>{headerLabel}</Text>
      </Pressable>
      {expanded && (
        <View style={styles.grammarContent}>
          {grammar.map((point, index) => (
            <GrammarAccordionItem
              key={`${point.structure}-${index}`}
              point={point}
              index={index}
              nativeLanguage={nativeLanguage}
            />
          ))}
        </View>
      )}
    </View>
  );
}

/** Одна строка: 50% китайский | 50% русский — общий скролл родителя */
function ParallelParagraphRow({
  paragraph,
  paragraphIndex,
  isRussianVisible,
  isParagraphRevealed,
  showPinyin,
  nativeLanguage,
  onToggleParagraphReveal,
  onWordPress,
  onGrammarPress,
  stickyNotes,
  onRequestSticky,
  onEditSticky,
  onRemoveSticky,
  onLayoutPara,
}: {
  paragraph: Paragraph;
  paragraphIndex: number;
  isRussianVisible: boolean;
  isParagraphRevealed: boolean;
  showPinyin: boolean;
  nativeLanguage: NativeLanguage;
  onToggleParagraphReveal: () => void;
  onWordPress: (word: Word, x: number, y: number, paragraphIndex: number) => void;
  onGrammarPress: (point: GrammarPoint, x: number, y: number) => void;
  stickyNotes: StickyNote[];
  onRequestSticky: (paragraphIndex: number, selectedText: string) => void;
  onEditSticky: (note: StickyNote) => void;
  onRemoveSticky: (id: string) => void;
  onLayoutPara?: (index: number, y: number, height: number) => void;
}) {
  const theme = useTheme();
  const { t } = useI18n();
  const grammarMatches = useMemo(
    () => findGrammarMatches(paragraph.chineseText),
    [paragraph.chineseText]
  );

  const grammarPoints = useMemo(() => {
    // Всегда берём актуальный разбор из словаря HSK (не устаревший stub в книге)
    const seen = new Set<string>();
    const points: GrammarPoint[] = [];
    for (const m of grammarMatches) {
      if (seen.has(m.patternId)) continue;
      seen.add(m.patternId);
      points.push(m.point);
    }
    return points.length > 0 ? points : paragraph.grammar;
  }, [paragraph.grammar, grammarMatches]);

  const segments = useMemo(
    () =>
      tokenizeChineseText(
        paragraph.chineseText,
        paragraph.words,
        grammarMatches,
        { withPinyin: showPinyin }
      ),
    [paragraph.chineseText, paragraph.words, grammarMatches, showPinyin]
  );

  const nativeRaw = useNativeParagraphTranslation(paragraph, nativeLanguage);
  const nativeText = isTranslationFailureText(nativeRaw)
    ? ''
    : stripTranslationFailureMarkers(nativeRaw);
  const displayText = nativeText || '—';
  const isHidden = !isRussianVisible && !isParagraphRevealed;
  const nativeColumnLabel =
    nativeLanguage === 'zh'
      ? t('catalog.lang.zh')
      : nativeLanguage === 'en'
        ? t('catalog.lang.en')
        : t('catalog.lang.ru');
  const peekHint = t('reader.peekHint');
  const peekA11y = t('reader.showParagraphTranslation');
  const hiddenSuffix = !isRussianVisible
    ? isParagraphRevealed
      ? t('reader.peekedSuffix')
      : t('reader.hiddenSuffix')
    : '';

  return (
    <View
      style={[
        styles.paragraphBlock,
        {
          // Светлая «страница» книги; chrome (хедер/тема) остаётся Dark Neon
          backgroundColor: '#FFFFFF',
          borderColor: '#E5E7EB',
          shadowColor: theme.accentViolet,
        },
      ]}
      onLayout={(e) => {
        const { y, height } = e.nativeEvent.layout;
        onLayoutPara?.(paragraphIndex, y, height);
      }}
    >
      <NotebookStickers />
      <View style={styles.parallelRow}>
        <View style={styles.zhColumn}>
          <View style={styles.columnLabelRow}>
            <Text style={[styles.columnLabel, styles.paperMuted]}>中文 · journal</Text>
            <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
              <Pressable
                style={[styles.stickyAddBtn, { borderColor: theme.accentPink }]}
                onPress={() =>
                  onRequestSticky(
                    paragraphIndex,
                    paragraph.chineseText.slice(0, 24) || '…'
                  )
                }
                hitSlop={6}
              >
                <Text style={{ fontSize: 11, fontWeight: '700', color: theme.accentPink }}>
                  🏷️ note
                </Text>
              </Pressable>
              <Pressable
                style={[styles.speakButton, { backgroundColor: theme.surfaceGlass }]}
                onPress={() => {
                  if (ttsService.isSpeaking()) {
                    ttsService.stop();
                    return;
                  }
                  void ttsService.speak(paragraph.chineseText);
                }}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={t('reader.ttsParagraph')}
              >
                <Text style={styles.speakButtonText}>🔊</Text>
              </Pressable>
            </View>
          </View>
          <View style={styles.chineseTextRow}>
            {segments.map((seg, idx) => {
              // Пиньинь уже посчитан для целого слова при withPinyin;
              // без повторного pinyinFor на каждый рендер (N+1 на планшетах).
              const py = showPinyin ? seg.word?.pinyin?.trim() || '' : '';

              if (seg.grammar) {
                const kind = grammarMarkerKind(seg.grammar.structure);
                const bg = markerColor(theme, seg.grammar.structure);
                const statusStyle = seg.word
                  ? seg.word.status === 'learning'
                    ? styles.wordLearning
                    : seg.word.status === 'known'
                      ? styles.wordKnown
                      : undefined
                  : undefined;

                return (
                  <Pressable
                    key={`grammar-${idx}-${seg.text}`}
                    onPress={(e) => {
                      onGrammarPress(seg.grammar!, e.nativeEvent.pageX, e.nativeEvent.pageY);
                    }}
                    onLongPress={() => onRequestSticky(paragraphIndex, seg.text)}
                    style={[
                      styles.grammarTokenWrap,
                      styles.wordBlock,
                      {
                        backgroundColor: bg,
                        borderColor:
                          kind === 'ba'
                            ? theme.accentPink
                            : kind === 'bei'
                              ? theme.accentViolet
                              : theme.accentLime,
                      },
                    ]}
                  >
                    {showPinyin && py ? (
                      <Text style={styles.rubyPinyin}>{py}</Text>
                    ) : null}
                    <Text
                      style={[
                        styles.wordToken,
                        styles.paperText,
                        statusStyle,
                      ]}
                    >
                      {seg.text}
                    </Text>
                  </Pressable>
                );
              }

              if (seg.word) {
                const statusStyle =
                  seg.word.status === 'learning'
                    ? styles.wordLearning
                    : seg.word.status === 'known'
                      ? styles.wordKnown
                      : styles.wordNew;
                const wordWithPy: Word = {
                  ...seg.word,
                  // На клик подгружаем пиньинь целого слова, если ещё пуст
                  pinyin:
                    py ||
                    seg.word.pinyin ||
                    pinyinFor(seg.word.hanzi),
                };

                return (
                  <Pressable
                    key={`${seg.word.id}-${idx}`}
                    style={styles.wordBlock}
                    onPress={(e) =>
                      onWordPress(
                        wordWithPy,
                        e.nativeEvent.pageX,
                        e.nativeEvent.pageY,
                        paragraphIndex
                      )
                    }
                    onLongPress={() => onRequestSticky(paragraphIndex, seg.word!.hanzi)}
                  >
                    {showPinyin && py ? (
                      <Text style={styles.rubyPinyin}>{py}</Text>
                    ) : null}
                    <Text style={[styles.wordToken, styles.paperText, statusStyle]}>
                      {seg.text}
                    </Text>
                  </Pressable>
                );
              }

              return (
                <Text key={`plain-${idx}`} style={[styles.chinesePlain, styles.paperText]}>
                  {seg.text}
                </Text>
              );
            })}
          </View>

          {grammarMatches.length > 0 && (
            <View style={styles.grammarInlineHints}>
              {[...new Map(grammarMatches.map((m) => [m.patternId, m.point])).values()].map(
                (point) => {
                  const kind = grammarMarkerKind(point.structure);
                  const label =
                    kind === 'ba' ? 'マーカー 把' : kind === 'bei' ? 'マーカー 被' : 'マーカー';
                  return (
                    <Pressable
                      key={point.structure}
                      style={[
                        styles.grammarHintChip,
                        {
                          backgroundColor: markerColor(theme, point.structure),
                          borderColor:
                            kind === 'ba'
                              ? theme.accentPink
                              : kind === 'bei'
                                ? theme.accentViolet
                                : theme.accentLime,
                        },
                      ]}
                      onPress={(e) =>
                        onGrammarPress(point, e.nativeEvent.pageX, e.nativeEvent.pageY)
                      }
                    >
                      <Text style={[styles.grammarHintChipText, styles.paperText]}>
                        {label}
                        {point.hskLevel != null ? ` HSK ${point.hskLevel}` : ''}:{' '}
                        {point.structure}
                      </Text>
                    </Pressable>
                  );
                }
              )}
            </View>
          )}

          <StickyNotesLayer
            notes={stickyNotes}
            paragraphIndex={paragraphIndex}
            onEdit={onEditSticky}
            onRemove={onRemoveSticky}
          />
        </View>

        <View style={[styles.ruColumn, { borderLeftColor: '#E5E7EB' }]}>
          <Text style={[styles.columnLabel, styles.columnLabelSolo, styles.paperMuted]}>
            {nativeColumnLabel}
            {hiddenSuffix}
          </Text>
          {/* Скрытый перевод полностью убираем из рендера — текст не остаётся видимым */}
          {isHidden ? (
            <Pressable
              onPress={onToggleParagraphReveal}
              accessibilityRole="button"
              accessibilityLabel={peekA11y}
              style={[
                styles.translationHiddenWrap,
                { backgroundColor: '#F3F4F6' },
              ]}
            >
              <Text style={[styles.translationPeekHintText, styles.paperMuted]}>
                {peekHint}
              </Text>
            </Pressable>
          ) : (
            <Pressable
              onPress={!isRussianVisible ? onToggleParagraphReveal : undefined}
              disabled={isRussianVisible}
              accessibilityRole={!isRussianVisible ? 'button' : undefined}
              accessibilityLabel={
                !isRussianVisible
                  ? t('reader.hideParagraphTranslation')
                  : undefined
              }
            >
              <Text style={[styles.translationText, styles.paperMuted]}>
                {displayText}
              </Text>
            </Pressable>
          )}
        </View>
      </View>

      <GrammarAccordion grammar={grammarPoints} nativeLanguage={nativeLanguage} />
    </View>
  );
}

export default function ReaderScreen({
  book: initialBook,
  onBookUpdate,
  onBack,
  onBookDeleted,
}: ReaderScreenProps) {
  const theme = useTheme();
  const { t } = useI18n();
  const [book, setBook] = useState(initialBook);
  const [popover, setPopover] = useState<PopoverState | null>(null);
  const [grammarPopover, setGrammarPopover] = useState<GrammarPopoverState | null>(null);
  const [popoverParagraphIndex, setPopoverParagraphIndex] = useState(0);
  const [inFlashcards, setInFlashcards] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [translateError, setTranslateError] = useState<string | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [revealedParagraphs, setRevealedParagraphs] = useState<Record<number, true>>({});
  const [showPinyin, setShowPinyin] = useState(true);
  const [stickyDraft, setStickyDraft] = useState<{
    paragraphIndex: number;
    selectedText: string;
    editing?: StickyNote;
  } | null>(null);
  const translateStarted = useRef(false);
  const parseStarted = useRef<string | null>(null);
  const scrollRef = useRef<ScrollView | null>(null);
  const paraLayouts = useRef<Record<number, { y: number; height: number }>>({});
  const lastSavedIndex = useRef(-1);
  const restoreDone = useRef<string | null>(null);
  const progressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingProgressIndex = useRef<number | null>(null);

  const isRussianHiddenGlobal = useAppStore((s) => s.isRussianHiddenGlobal);
  const toggleGlobalRussianVisibility = useAppStore((s) => s.toggleGlobalRussianVisibility);
  const midnightMode = useAppStore((s) => s.midnightMode);
  const toggleMidnightMode = useAppStore((s) => s.toggleMidnightMode);
  const stickyNotes = useAppStore((s) => s.stickyNotes);
  const addStickyNote = useAppStore((s) => s.addStickyNote);
  const updateStickyNote = useAppStore((s) => s.updateStickyNote);
  const removeStickyNote = useAppStore((s) => s.removeStickyNote);
  const upsertBook = useAppStore((s) => s.upsertBook);
  const setActiveBook = useAppStore((s) => s.setActiveBook);
  const cacheParsedParagraphs = useAppStore((s) => s.cacheParsedParagraphs);
  const deleteBookFromStore = useAppStore((s) => s.deleteBook);
  const storeBook = useAppStore((s) => s.books.find((b) => b.id === initialBook.id));
  const nativeLanguage = useAppStore((s) => s.nativeLanguage);

  useEffect(() => {
    prefetchTranslationCache();
  }, []);

  const bookNotes = useMemo(
    () => stickyNotes.filter((n) => n.bookId === initialBook.id),
    [stickyNotes, initialBook.id]
  );

  const isRussianVisible = !isRussianHiddenGlobal;
  const [storeHydrated, setStoreHydrated] = useState(() =>
    useAppStore.persist.hasHydrated()
  );

  const PROGRESS_SAVE_DEBOUNCE_MS = 700;

  const persistProgress = useCallback(
    (index: number) => {
      if (book.paragraphs.length === 0) return;
      if (index === lastSavedIndex.current) return;
      lastSavedIndex.current = index;
      void saveReadingProgress(book, index);
    },
    [book]
  );

  const handleScrollProgress = useCallback(
    (scrollY: number) => {
      const marker = scrollY + 80;
      let best = 0;
      const layouts = paraLayouts.current;
      for (const key of Object.keys(layouts)) {
        const idx = Number(key);
        const layout = layouts[idx];
        if (!layout) continue;
        if (layout.y <= marker) best = idx;
      }
      pendingProgressIndex.current = best;
      if (progressTimer.current) clearTimeout(progressTimer.current);
      progressTimer.current = setTimeout(() => {
        pendingProgressIndex.current = null;
        persistProgress(best);
      }, PROGRESS_SAVE_DEBOUNCE_MS);
    },
    [persistProgress]
  );

  // Restore reading position from local + Firestore
  useEffect(() => {
    if (!storeHydrated || book.paragraphs.length === 0) return;
    if (restoreDone.current === book.id) return;
    let cancelled = false;
    void resolveReadingProgress(book.id).then((saved) => {
      if (cancelled) return;
      restoreDone.current = book.id;
      if (!saved) {
        persistProgress(0);
        return;
      }
      lastSavedIndex.current = saved.paragraphIndex;
      const tryScroll = (attempt: number) => {
        if (cancelled) return;
        const layout = paraLayouts.current[saved.paragraphIndex];
        if (layout && scrollRef.current) {
          scrollRef.current.scrollTo({ y: Math.max(0, layout.y - 12), animated: false });
          return;
        }
        if (attempt < 12) {
          setTimeout(() => tryScroll(attempt + 1), 50);
        }
      };
      tryScroll(0);
    });
    return () => {
      cancelled = true;
    };
  }, [book.id, book.paragraphs.length, storeHydrated, persistProgress]);

  useEffect(() => {
    return () => {
      if (progressTimer.current) clearTimeout(progressTimer.current);
      const pending = pendingProgressIndex.current;
      if (pending != null && pending !== lastSavedIndex.current) {
        void saveReadingProgress(book, pending);
      }
    };
  }, [book]);

  useEffect(() => {
    restoreDone.current = null;
    lastSavedIndex.current = -1;
    paraLayouts.current = {};
    setShowPinyin(true);
  }, [book.id]);

  useEffect(() => {
    if (storeHydrated) return;
    const unsub = useAppStore.persist.onFinishHydration(() => setStoreHydrated(true));
    setStoreHydrated(useAppStore.persist.hasHydrated());
    return unsub;
  }, [storeHydrated]);

  /**
   * TextReader: при открытии книги — кеш парсинга из useAppStore.
   * isParsed === true → мгновенно parsedParagraphs, без analyzeText.
   * isParsed === false → токенизация + cacheParsedParagraphs.
   */
  useEffect(() => {
    if (!storeHydrated) return;

    setActiveBook(initialBook.id);

    const existing = useAppStore.getState().books.find((b) => b.id === initialBook.id);
    const domain = existing ?? legacyBookToDomain(initialBook);
    if (!existing) {
      upsertBook(domain);
    }

    if (parseStarted.current === initialBook.id) return;
    parseStarted.current = initialBook.id;

    if (domain.isParsed && domain.parsedParagraphs && domain.parsedParagraphs.length > 0) {
      const withCache = applyDomainCacheToLegacyBook(initialBook, domain.parsedParagraphs);
      setBook(withCache);
      onBookUpdate?.(withCache);
      return;
    }

    // Уже разобранная legacy-книга → кладём в кеш без повторного analyzeText
    const fromLegacy = legacyParagraphsToDomain(initialBook);
    if (fromLegacy) {
      cacheParsedParagraphs(initialBook.id, fromLegacy.paragraphs, fromLegacy.stats);
      setBook(initialBook);
      return;
    }

    let cancelled = false;
    setIsParsing(true);

    const timer = setTimeout(() => {
      try {
        const zh =
          domain.originalZhText?.trim() ||
          initialBook.sourceText?.trim() ||
          initialBook.paragraphs.map((p) => p.chineseText).join('\n\n');
        const ru = domain.russianText || initialBook.originalRussianText || undefined;

        const { paragraphs, stats } = parseZhTextToDomainParagraphs(
          zh,
          initialBook.targetHskLevel,
          ru
        );

        if (cancelled) return;

        cacheParsedParagraphs(initialBook.id, paragraphs, stats);
        const withCache = applyDomainCacheToLegacyBook(initialBook, paragraphs);
        setBook(withCache);
        onBookUpdate?.(withCache);
      } finally {
        if (!cancelled) setIsParsing(false);
      }
    }, 0);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      ttsService.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialBook.id, storeHydrated]);

  // Останавливаем озвучку при уходе с экрана
  useEffect(() => {
    return () => {
      ttsService.stop();
    };
  }, []);

  const toggleRussianVisible = useCallback(() => {
    toggleGlobalRussianVisibility();
    setRevealedParagraphs({});
  }, [toggleGlobalRussianVisibility]);

  const toggleParagraphReveal = useCallback((index: number) => {
    setRevealedParagraphs((prev) => {
      if (prev[index]) {
        const next = { ...prev };
        delete next[index];
        return next;
      }
      return { ...prev, [index]: true };
    });
  }, []);

  const handleDeleteBook = useCallback(() => {
    const title = formatBookTitleLine(book);
    showConfirm(
      t('alert.deleteFanfic'),
      t('alert.deleteFanficNamed', { title }),
      async () => {
        try {
          await deleteBook(book.id);
          deleteBookFromStore(book.id);
          onBookDeleted?.();
        } catch (e) {
          showAlert(
            t('alert.error'),
            e instanceof Error ? e.message : t('alert.deleteFail')
          );
        }
      }
    );
  }, [book, onBookDeleted, deleteBookFromStore, t]);

  const handleWordPress = useCallback(
    async (word: Word, x: number, y: number, paragraphIndex: number) => {
      setGrammarPopover(null);
      setPopover({ word, x, y });
      setPopoverParagraphIndex(paragraphIndex);
      const language = book.language === 'en' ? 'en' : 'zh';
      setInFlashcards(await hasFlashcard(word.hanzi, language));
    },
    [book.language]
  );

  const handleGrammarPress = useCallback((point: GrammarPoint, x: number, y: number) => {
    setPopover(null);
    setGrammarPopover({ point, x, y });
  }, []);

  const handleRequestSticky = useCallback(
    (paragraphIndex: number, selectedText: string) => {
      setStickyDraft({ paragraphIndex, selectedText });
    },
    []
  );

  const applyWordStatus = useCallback(
    async (word: Word, status: 'learning' | 'known') => {
      await updateWordStatus(word.id, status);
      const updatedBook: Book = {
        ...book,
        paragraphs: book.paragraphs.map((p) => ({
          ...p,
          words: p.words.map((w) => (w.id === word.id ? { ...w, status } : w)),
        })),
      };
      setBook(updatedBook);
      onBookUpdate?.(updatedBook);
      if (status === 'known') {
        try {
          const { markFlashcardKnown } = await import('../services/flashcardsStore');
          const language = book.language === 'en' ? 'en' : book.language === 'ru' ? 'ru' : 'zh';
          await markFlashcardKnown(word.hanzi, language, { remove: true });
        } catch {
          /* ignore */
        }
      }
      setPopover(null);
    },
    [book, onBookUpdate]
  );

  const handleAddToFlashcards = useCallback(
    async (word: Word) => {
      const translation = lookupBkrs(word.hanzi)?.trim() || word.translation || '';
      const para = book.paragraphs[popoverParagraphIndex];
      const contextSentence = para
        ? extractContextSentence(para.chineseText, word.hanzi)
        : undefined;
      const language = book.language === 'en' ? 'en' : 'zh';
      await addFlashcard({
        hanzi: word.hanzi,
        pinyin: language === 'en' ? '' : word.pinyin,
        translation:
          language === 'en'
            ? word.translation || translation
            : translation,
        hskLevel: language === 'en' ? undefined : word.hskLevel,
        language,
        contextSentence,
        sourceTitle: formatBookTitleLine(book),
        sourceBookId: book.id,
      });
      setInFlashcards(true);
    },
    [book, popoverParagraphIndex]
  );

  useEffect(() => {
    if (translateStarted.current) return;
    const needsFill = book.paragraphs.some((p) => !p.russianTranslation?.trim());
    if (!needsFill) return;

    translateStarted.current = true;
    let cancelled = false;

    const run = async () => {
      setIsTranslating(true);
      setTranslateError(null);
      try {
        const nextParagraphs = [...book.paragraphs];
        let changed = false;

        if (book.originalRussianText?.trim()) {
          const aligned = alignRussianParagraphs(
            book.originalRussianText,
            nextParagraphs.length
          );
          for (let i = 0; i < nextParagraphs.length; i += 1) {
            if (!nextParagraphs[i].russianTranslation?.trim() && aligned[i]?.trim()) {
              nextParagraphs[i] = {
                ...nextParagraphs[i],
                russianTranslation: aligned[i],
              };
              changed = true;
            }
          }
        }

        const emptyIndexes: number[] = [];
        const toTranslate: string[] = [];
        for (let i = 0; i < nextParagraphs.length; i += 1) {
          if (!nextParagraphs[i].russianTranslation?.trim()) {
            emptyIndexes.push(i);
            toTranslate.push(nextParagraphs[i].chineseText);
          }
        }

        if (toTranslate.length > 0) {
          const translations = await translateParagraphsZhToRu(toTranslate);
          for (let j = 0; j < emptyIndexes.length; j += 1) {
            const idx = emptyIndexes[j];
            const ru = translations[j]?.trim() ?? '';
            if (ru) {
              nextParagraphs[idx] = {
                ...nextParagraphs[idx],
                russianTranslation: ru,
              };
              changed = true;
            }
          }
        }

        if (!cancelled && changed) {
          const updatedBook: Book = { ...book, paragraphs: nextParagraphs };
          setBook(updatedBook);
          onBookUpdate?.(updatedBook);
        }
      } catch (err) {
        if (!cancelled) {
          setTranslateError(
            err instanceof Error ? err.message : t('reader.translateTextFail')
          );
        }
      } finally {
        if (!cancelled) setIsTranslating(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [book.id]);

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.bg }]}
      edges={['top', 'bottom']}
    >
      <StarfieldBackground />
      <View style={{ flex: 1, zIndex: 1 }}>
      <View
        style={[
          styles.header,
          IS_TABLET && styles.headerTablet,
          {
            backgroundColor: theme.surfaceGlass,
            borderBottomColor: theme.border,
          },
        ]}
      >
        <View style={styles.headerTopRow}>
          <View style={styles.headerTitleBlock}>
            {onBack && (
              <Pressable onPress={onBack} style={styles.backButton}>
                <Text style={[styles.backButtonText, { color: theme.accent }]}>
                  ← {t('nav.library')}
                </Text>
              </Pressable>
            )}
            <Text style={[styles.bookTitle, { color: theme.text }]}>
              {formatBookTitleLine(book)}
            </Text>
            <Text style={[styles.hskBadge, { color: theme.accent }]}>
              {t('reader.targetHskNotebook', { n: book.targetHskLevel })}
            </Text>
            {storeBook?.hskStats ? (
              <View style={styles.readerStatsWrap}>
                <HskStatsBadge
                  stats={storeBook.hskStats}
                  readingTime={storeBook.readingTime}
                  compact
                />
              </View>
            ) : null}
            {book.originalRussianText ? (
              <Text style={[styles.sourceHint, { color: theme.textDim }]}>
                {t('reader.sourceParallel')}
              </Text>
            ) : null}
          </View>

          <View style={styles.headerActions}>
            <Pressable
              style={[
                styles.russianToggle,
                {
                  backgroundColor: midnightMode ? theme.accentViolet : theme.surface,
                  borderColor: theme.accentLime,
                },
              ]}
              onPress={toggleMidnightMode}
            >
              <Text style={[styles.russianToggleText, { color: theme.text }]}>
                {midnightMode ? '🌙' : '☀️'}
              </Text>
            </Pressable>

            <Pressable
              style={[
                styles.russianToggle,
                {
                  borderColor: showPinyin ? theme.accentPink : theme.border,
                  backgroundColor: showPinyin
                    ? 'rgba(255,101,132,0.18)'
                    : theme.surfaceGlass,
                },
              ]}
              onPress={() => setShowPinyin((v) => !v)}
              accessibilityRole="switch"
              accessibilityState={{ checked: showPinyin }}
              accessibilityLabel={
                showPinyin ? t('reader.hidePinyin') : t('reader.showPinyin')
              }
            >
              <Text style={[styles.russianToggleText, { color: theme.accentPink }]}>
                {showPinyin ? t('reader.hidePinyin') : t('reader.showPinyin')}
              </Text>
            </Pressable>

            <Pressable
              style={[
                styles.russianToggle,
                !isRussianVisible && styles.russianToggleOff,
                {
                  borderColor: isRussianVisible ? theme.accent : theme.border,
                  backgroundColor: isRussianVisible ? theme.neonGlow : theme.surfaceGlass,
                },
              ]}
              onPress={toggleRussianVisible}
              accessibilityRole="switch"
              accessibilityState={{ checked: isRussianVisible }}
              accessibilityLabel={t('reader.showNativeTranslation')}
            >
              <Text style={styles.russianToggleIcon}>{isRussianVisible ? '👁️' : '🙈'}</Text>
              <Text
                style={[
                  styles.russianToggleText,
                  { color: theme.text },
                  !isRussianVisible && styles.russianToggleTextOff,
                ]}
              >
                {isRussianVisible ? t('action.hideText') : t('action.showText')}
              </Text>
            </Pressable>

            <Pressable
              style={styles.deleteBookHeaderButton}
              onPress={handleDeleteBook}
              accessibilityLabel={t('reader.delete')}
              accessibilityRole="button"
            >
              <Text style={styles.deleteBookHeaderIcon}>🗑️</Text>
            </Pressable>
          </View>
        </View>
      </View>

      {isParsing && (
        <View style={[styles.translateBanner, { backgroundColor: theme.surfaceGlass }]}>
          <ActivityIndicator color={theme.accent} />
          <Text style={[styles.translateBannerText, { color: theme.textMuted }]}>
            {t('reader.parsing')}
          </Text>
        </View>
      )}
      {isTranslating && (
        <View style={[styles.translateBanner, { backgroundColor: theme.surfaceGlass }]}>
          <ActivityIndicator color={theme.accent} />
          <Text style={[styles.translateBannerText, { color: theme.textMuted }]}>
            {t('reader.translatingParagraphs')}
          </Text>
        </View>
      )}
      {translateError && (
        <View style={styles.translateErrorBanner}>
          <Text style={styles.translateErrorText}>{translateError}</Text>
        </View>
      )}

      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          IS_TABLET && styles.scrollContentTablet,
          { paddingBottom: 120 },
        ]}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={100}
        onScroll={(e) => handleScrollProgress(e.nativeEvent.contentOffset.y)}
      >
        {book.paragraphs.map((paragraph, index) => (
          <ParallelParagraphRow
            key={`paragraph-${index}`}
            paragraph={paragraph}
            paragraphIndex={index}
            isRussianVisible={isRussianVisible}
            isParagraphRevealed={!!revealedParagraphs[index]}
            showPinyin={showPinyin}
            nativeLanguage={nativeLanguage}
            onToggleParagraphReveal={() => toggleParagraphReveal(index)}
            onWordPress={handleWordPress}
            onGrammarPress={handleGrammarPress}
            stickyNotes={bookNotes}
            onRequestSticky={handleRequestSticky}
            onEditSticky={(note) =>
              setStickyDraft({
                paragraphIndex: note.paragraphIndex,
                selectedText: note.selectedText,
                editing: note,
              })
            }
            onRemoveSticky={removeStickyNote}
            onLayoutPara={(idx, y, height) => {
              paraLayouts.current[idx] = { y, height };
            }}
          />
        ))}
      </ScrollView>

      {popover && (
        <WordPopover
          popover={popover}
          onClose={() => setPopover(null)}
          onAddToDictionary={(w) => applyWordStatus(w, 'learning')}
          onMarkKnown={(w) => applyWordStatus(w, 'known')}
          onAddToFlashcards={handleAddToFlashcards}
          inFlashcards={inFlashcards}
        />
      )}
      {grammarPopover && (
        <GrammarPopover
          popover={grammarPopover}
          onClose={() => setGrammarPopover(null)}
          nativeLanguage={nativeLanguage}
        />
      )}

      <StickyNoteModal
        visible={stickyDraft != null}
        selectedText={stickyDraft?.selectedText ?? ''}
        initialNote={stickyDraft?.editing?.note}
        initialColor={stickyDraft?.editing?.color}
        onClose={() => setStickyDraft(null)}
        onSave={(note, color) => {
          if (!stickyDraft) return;
          if (stickyDraft.editing) {
            updateStickyNote(stickyDraft.editing.id, { note, color });
          } else {
            addStickyNote({
              id: `note-${Date.now()}`,
              bookId: book.id,
              paragraphIndex: stickyDraft.paragraphIndex,
              selectedText: stickyDraft.selectedText,
              note,
              color,
              createdAt: Date.now(),
            });
          }
          setStickyDraft(null);
        }}
      />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f6f2',
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e8e4dc',
  },
  headerTablet: {
    paddingHorizontal: 40,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  headerTitleBlock: {
    flex: 1,
    marginBottom: 0,
    minWidth: 0,
  },
  backButton: {
    marginBottom: 8,
  },
  backButtonText: {
    fontSize: 15,
    color: '#4a90d9',
    fontWeight: '600',
  },
  bookTitle: {
    fontSize: IS_TABLET ? 28 : 22,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  hskBadge: {
    marginTop: 4,
    fontSize: 14,
    color: '#4a90d9',
    fontWeight: '600',
  },
  readerStatsWrap: {
    marginTop: 8,
    maxWidth: 280,
  },
  sourceHint: {
    marginTop: 4,
    fontSize: 12,
    color: '#888',
  },
  russianToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#eff6ff',
    borderWidth: 1.5,
    borderColor: '#4a90d9',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  russianToggleOff: {
    backgroundColor: '#f3f4f6',
    borderColor: '#d1d5db',
  },
  russianToggleIcon: {
    fontSize: 16,
  },
  russianToggleText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1a5fb4',
  },
  russianToggleTextOff: {
    color: '#6b7280',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
  },
  deleteBookHeaderButton: {
    width: 42,
    height: 42,
    borderRadius: 10,
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteBookHeaderIcon: {
    fontSize: 18,
  },
  translateBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#eff6ff',
  },
  translateBannerText: {
    fontSize: 14,
    color: '#1a5fb4',
  },
  translateErrorBanner: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#fef2f2',
  },
  translateErrorText: {
    fontSize: 14,
    color: '#b91c1c',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  scrollContentTablet: {
    paddingHorizontal: 40,
    paddingVertical: 28,
    maxWidth: 1100,
    alignSelf: 'center',
    width: '100%',
  },
  paragraphBlock: {
    marginBottom: 20,
    borderRadius: 14,
    padding: IS_TABLET ? 22 : 14,
    borderWidth: 1,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 3,
  },
  stickyAddBtn: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  parallelRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  zhColumn: {
    width: '50%',
    paddingRight: 12,
  },
  ruColumn: {
    width: '50%',
    paddingLeft: 12,
    borderLeftWidth: 1,
    borderLeftColor: '#e8e4dc',
  },
  columnLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    gap: 8,
  },
  columnLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  columnLabelSolo: {
    marginBottom: 8,
  },
  speakButton: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
  },
  speakButtonText: {
    fontSize: 16,
    lineHeight: 20,
  },
  chineseTextRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-end',
  },
  wordBlock: {
    alignItems: 'center',
    marginHorizontal: 1,
    marginBottom: 2,
  },
  rubyPinyin: {
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 1,
    letterSpacing: 0.3,
    color: '#FF6584',
  },
  paperText: {
    color: '#0D0D11',
  },
  paperMuted: {
    color: 'rgba(30, 30, 40, 0.62)',
  },
  chinesePlain: {
    fontSize: IS_TABLET ? 24 : 20,
    lineHeight: IS_TABLET ? 48 : 42,
    color: '#0D0D11',
  },
  wordToken: {
    fontSize: IS_TABLET ? 24 : 20,
    lineHeight: IS_TABLET ? 48 : 42,
    borderRadius: 4,
    paddingHorizontal: 2,
  },
  wordNew: {
    color: '#0D0D11',
    backgroundColor: 'transparent',
  },
  wordLearning: {
    color: '#1a5fb4',
    backgroundColor: '#dbeafe',
  },
  wordKnown: {
    color: '#6b7280',
    backgroundColor: '#f3f4f6',
  },
  grammarTokenWrap: {
    marginVertical: 2,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#EA580C',
    backgroundColor: '#fff7ed',
    borderRadius: 4,
    paddingHorizontal: 2,
  },
  grammarToken: {
    color: '#9a3412',
  },  grammarInlineHints: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 10,
  },
  grammarHintChip: {
    backgroundColor: '#fff7ed',
    borderWidth: 1,
    borderColor: '#fdba74',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  grammarHintChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#c2410c',
  },
  translationText: {
    fontSize: IS_TABLET ? 17 : 15,
    lineHeight: IS_TABLET ? 28 : 24,
    color: '#333',
  },
  translationHiddenWrap: {
    borderRadius: 8,
    paddingVertical: 14,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  translationTextHidden: {
    // legacy — перевод больше не рендерится в скрытом состоянии
    opacity: 0,
  },
  translationPeekHint: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  translationPeekHintText: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  grammarBlock: {
    marginTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    paddingTop: 10,
  },
  grammarHeader: {
    paddingVertical: 6,
  },
  grammarHeaderText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#4a90d9',
  },
  grammarContent: {
    marginTop: 8,
    gap: 12,
  },
  grammarItem: {
    backgroundColor: '#f0f7ff',
    borderRadius: 8,
    padding: 12,
  },
  grammarItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
    flexWrap: 'wrap',
  },
  grammarStructure: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a5fb4',
  },
  grammarLevelChip: {
    backgroundColor: '#fff7ed',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  grammarLevelChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#c2410c',
  },
  grammarExplanation: {
    fontSize: 14,
    lineHeight: 20,
    color: '#333',
    marginBottom: 4,
  },
  grammarExample: {
    fontSize: 13,
    lineHeight: 18,
    color: '#666',
    fontStyle: 'italic',
  },
  popoverOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  popover: {
    position: 'absolute',
    width: 280,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  grammarPopover: {
    width: 300,
    borderTopWidth: 3,
    borderTopColor: '#c2410c',
  },
  grammarPopoverBadge: {
    alignSelf: 'center',
    backgroundColor: '#fff7ed',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginBottom: 10,
  },
  grammarPopoverBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#c2410c',
  },
  grammarPopoverStructure: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1a1a1a',
    textAlign: 'center',
    marginBottom: 10,
  },
  grammarPopoverExplanation: {
    fontSize: 15,
    lineHeight: 22,
    color: '#333',
    marginBottom: 10,
  },
  grammarPopoverExample: {
    fontSize: 14,
    lineHeight: 20,
    color: '#666',
    fontStyle: 'italic',
  },
  popoverHanzi: {
    fontSize: 32,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  popoverHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 4,
  },
  hskLevelBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  hskLevelBadgeText: {
    fontSize: 13,
    fontWeight: '700',
  },
  popoverPinyin: {
    fontSize: 18,
    textAlign: 'center',
    color: '#FF6584',
    marginTop: 4,
    fontWeight: '600',
  },
  popoverTranslation: {
    fontSize: 16,
    textAlign: 'center',
    color: '#444',
    marginTop: 8,
    marginBottom: 12,
  },
  popoverButton: {
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  popoverButtonFlashcard: {
    backgroundColor: '#fff7ed',
    borderWidth: 1.5,
    borderColor: '#f97316',
  },
  popoverButtonDisabled: {
    backgroundColor: '#f3f4f6',
  },
  popoverButtonPrimary: {
    backgroundColor: '#4a90d9',
  },
  popoverButtonSecondary: {
    backgroundColor: '#f0f0f0',
  },
  popoverButtonTextFlashcard: {
    color: '#c2410c',
    fontSize: 15,
    fontWeight: '700',
  },
  popoverButtonTextDisabled: {
    color: '#9ca3af',
    fontSize: 15,
    fontWeight: '600',
  },
  popoverButtonTextPrimary: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  popoverButtonTextSecondary: {
    color: '#333',
    fontSize: 15,
    fontWeight: '600',
  },
  popoverStatusHint: {
    textAlign: 'center',
    fontSize: 13,
    color: '#888',
    marginTop: 8,
  },
});
