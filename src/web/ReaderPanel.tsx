import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { findGrammarMatches } from '../data/hskGrammarPatterns';
import {
  useLocalizedGrammarExplanation,
  useNativeParagraphTranslation,
} from '../hooks/useLocalizedText';
import { useI18n } from '../i18n/useI18n';
import type { UiMessageKey } from '../i18n/uiMessages';
import { lookupBkrs } from '../services/bkrsService';
import { segmentChineseText } from '../services/chineseTokenizer';
import {
  createLexiconPredicate,
  loadHskDictionary,
  pinyinFor,
} from '../services/hskLocalService';
import { prefetchTranslationCache } from '../services/translationCache';
import type { BookCoverage } from '../services/bookCoverageService';
import {
  resolveReadingProgress,
  saveReadingProgress,
  type ReadingProgress,
} from '../services/readingProgressStore';
import { ttsService } from '../services/ttsService';
import {
  READER_FONT_SCALE_MAX,
  READER_FONT_SCALE_MIN,
  READER_FONT_SCALE_STEP,
  useAppStore,
  type ReaderPageTheme,
} from '../store/useAppStore';
import { grammarMarkerKind } from '../theme/y2k';
import type {
  Book,
  GrammarPoint,
  LearningLanguage,
  NativeLanguage,
  Paragraph,
  Word,
} from '../types';
import { normalizeLearningLanguage } from '../services/languageConfig';
import { buildEnglishTokens, buildRussianTokens } from '../utils/englishTokens';
import { formatBookTitleLine } from '../utils/bookTitle';
import { downloadBookAsTextFile } from '../utils/downloadBookText';
import {
  isTranslationFailureText,
  stripTranslationFailureMarkers,
} from '../services/translationService';
import { Button, Div, Span } from './dom';
import { GlassWindow } from './GlassWindow';
import { ReaderToast } from './ReaderToast';
import {
  ParagraphNoteChips,
  ReaderNotebookPanel,
} from './ReaderNotebookPanel';
import { WordModalGlass } from './WordModalGlass';
import { useWebTheme, type WebThemeClasses } from './webTheme';

const PROGRESS_SAVE_DEBOUNCE_MS = 700;
/** Медленная автопрокрутка: px в секунду */
const AUTO_SCROLL_PX_PER_SEC = 28;

const PAGE_THEME_KEYS: Array<{
  id: ReaderPageTheme;
  labelKey: UiMessageKey;
  swatch: string;
}> = [
  { id: 'light', labelKey: 'reader.pageLight', swatch: '#F8F9FA' },
  { id: 'dark', labelKey: 'reader.pageDark', swatch: '#1E1E28' },
  { id: 'sepia', labelKey: 'reader.pageSepia', swatch: '#F3E6C8' },
];

interface ReaderToken {
  text: string;
  pinyin?: string;
  grammarClass?: string;
  isWord: boolean;
  word?: Word;
}

/**
 * Токены читалки: Intl.Segmenter('zh-CN') + FMM по БКРС/HSK.
 * Составные слова / 成语 — один кликабельный токен.
 * Сеть НЕ вызывается при рендере; пиньинь — локально для целого слова (с кэшем).
 */
function buildChineseTokens(
  chineseText: string,
  words: Word[],
  opts?: { withPinyin?: boolean }
): ReaderToken[] {
  const withPinyin = opts?.withPinyin ?? false;
  const grammarMatches = findGrammarMatches(chineseText);
  const hskMap = loadHskDictionary();
  // Слова книги (2+ иероглифа) усиливают склейку известных лексем / OOV 成语
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

  const grammarClassAt = (pos: number): string | undefined => {
    const m = grammarMatches.find((g) => pos >= g.start && pos < g.end);
    if (!m) return undefined;
    const kind = grammarMarkerKind(m.point.structure);
    if (kind === 'ba') return 'grammar-mark-ba';
    if (kind === 'bei') return 'grammar-mark-bei';
    return 'grammar-mark-other';
  };

  /**
   * Только локальные данные. Пиньинь — для ВСЕГО слова целиком,
   * и только если подсказки включены (lazy + Map-кэш в pinyinFor).
   * Сетевой перевод — только по клику в модалке.
   */
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

  const segments = segmentChineseText(chineseText, { isLexeme });
  const tokens: ReaderToken[] = [];
  let pos = 0;

  for (const seg of segments) {
    // Пунктуация / пробелы — обычный текст, без тяжёлых обработчиков
    if (!seg.isChinese || !seg.isWordLike) {
      tokens.push({ text: seg.text, isWord: false });
      pos += seg.text.length;
      continue;
    }

    const word = resolveWord(seg.text, pos);
    tokens.push({
      text: seg.text,
      pinyin: withPinyin ? word.pinyin : undefined,
      grammarClass: grammarClassAt(pos),
      isWord: true,
      word,
    });
    pos += seg.text.length;
  }

  return tokens;
}

type TokenLanguage = LearningLanguage;

function readingTextForParagraph(
  language: LearningLanguage,
  p: { chineseText: string; englishText?: string }
): string {
  if (language === 'en') {
    return (p.englishText || p.chineseText || '').trim();
  }
  // zh / ru: основной текст в chineseText (legacy-имя поля)
  return p.chineseText || '';
}

function extractContext(paragraphText: string, surface: string): string {
  const text = paragraphText.trim();
  if (!text || !surface) return text.slice(0, 80);
  const idx = text.toLowerCase().indexOf(surface.toLowerCase());
  if (idx < 0) return text.slice(0, 100);
  const boundaries = /[。！？；;.!?\n]/;
  let start = 0;
  let end = text.length;
  for (let i = idx - 1; i >= 0; i--) {
    if (boundaries.test(text[i]!)) {
      start = i + 1;
      break;
    }
  }
  for (let i = idx + surface.length; i < text.length; i++) {
    if (boundaries.test(text[i]!)) {
      end = i + 1;
      break;
    }
  }
  const slice = text.slice(start, end).trim();
  return slice.length > 160 ? `${slice.slice(0, 157)}…` : slice;
}

function NativeParagraphTranslationLine({
  paragraph,
  nativeLanguage,
  showTranslation,
  peeked,
  onPeek,
  theme,
  peekLabel,
}: {
  paragraph: Pick<Paragraph, 'russianTranslation' | 'translations'>;
  nativeLanguage: NativeLanguage;
  showTranslation: boolean;
  peeked: boolean;
  onPeek: () => void;
  theme: WebThemeClasses;
  peekLabel: string;
}) {
  const raw = useNativeParagraphTranslation(paragraph, nativeLanguage);
  const text = isTranslationFailureText(raw)
    ? ''
    : stripTranslationFailureMarkers(raw);
  const show = showTranslation || peeked;

  if (show && text) {
    return (
      <Div className="reader-translation-line mt-2 text-sm leading-relaxed">
        {text}
      </Div>
    );
  }

  if (!showTranslation) {
    return (
      <Button
        type="button"
        className={`mt-2 text-xs font-semibold text-[#ec4899] ${theme.hover} rounded-lg px-2 py-1`}
        onClick={(e) => {
          e.stopPropagation();
          onPeek();
        }}
      >
        {peekLabel}
      </Button>
    );
  }

  return null;
}

function LocalizedGrammarExplanation({
  explanation,
  nativeLanguage,
  className,
}: {
  explanation: string;
  nativeLanguage: NativeLanguage;
  className: string;
}) {
  const text = useLocalizedGrammarExplanation(explanation, nativeLanguage);
  if (!text) return null;
  return <Div className={className}>{text}</Div>;
}

function LocalizedGrammarCards({
  grammar,
  paraKey,
  nativeLanguage,
  theme,
  countLabel,
}: {
  grammar: GrammarPoint[];
  paraKey: string;
  nativeLanguage: NativeLanguage;
  theme: WebThemeClasses;
  countLabel: string;
}) {
  if (grammar.length === 0) return null;
  return (
    <Div className="mt-3 space-y-2">
      <Div className="text-[10px] font-bold uppercase tracking-wide text-sky-500">
        {countLabel}
      </Div>
      {grammar.map((g, gi) => (
        <Div
          key={`${paraKey}-g-${gi}`}
          className={`rounded-xl px-3 py-2 ${theme.surface}`}
        >
          <Div className={`text-xs font-bold ${theme.text}`}>{g.structure}</Div>
          <LocalizedGrammarExplanation
            explanation={g.explanation}
            nativeLanguage={nativeLanguage}
            className={`mt-0.5 text-[11px] leading-relaxed ${theme.textMuted}`}
          />
          {g.example ? (
            <Div className={`mt-1 text-[11px] italic ${theme.textMuted}`}>
              {g.example}
            </Div>
          ) : null}
        </Div>
      ))}
    </Div>
  );
}

interface ReaderPanelProps {
  book: Book | null;
  chapterTitle?: string;
  showPinyin?: boolean;
  /** Уровень текста / % в карточках — видно и без боковой Progress-панели */
  coverage?: BookCoverage | null;
  onNotes?: () => void;
  onBack?: () => void;
  onDelete?: () => void;
  /** Сохранённая позиция изменилась */
  onProgressChange?: (progress: ReadingProgress) => void;
}

/** Center panel — interactive reader (Dark Neon + pink pinyin) */
export function ReaderPanel({
  book,
  chapterTitle,
  showPinyin: showPinyinProp = true,
  coverage = null,
  onNotes: _onNotes,
  onBack,
  onDelete,
  onProgressChange,
}: ReaderPanelProps) {
  const theme = useWebTheme();
  const { t, lang: uiLang } = useI18n();
  const isRussianHidden = useAppStore((s) => s.isRussianHiddenGlobal);
  const toggleRussian = useAppStore((s) => s.toggleGlobalRussianVisibility);
  const readerFontScale = useAppStore((s) => s.readerFontScale);
  const bumpReaderFontScale = useAppStore((s) => s.bumpReaderFontScale);
  const readerPageTheme = useAppStore((s) => s.readerPageTheme);
  const setReaderPageTheme = useAppStore((s) => s.setReaderPageTheme);
  const nativeLanguage = useAppStore((s) => s.nativeLanguage);
  const showTranslation = !isRussianHidden;

  const language: LearningLanguage = normalizeLearningLanguage(book?.language);
  const isEnglish = language === 'en';

  const [showPinyin, setShowPinyin] = useState(showPinyinProp);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [autoScroll, setAutoScroll] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [selected, setSelected] = useState<{
    word: Word;
    contextSentence: string;
    tokenLanguage: TokenLanguage;
  } | null>(null);
  const [revealedParagraphs, setRevealedParagraphs] = useState<
    Record<number, true>
  >({});
  const [readPercent, setReadPercent] = useState(0);
  const [activeParaIndex, setActiveParaIndex] = useState(0);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [levelBannerDismissed, setLevelBannerDismissed] = useState(false);
  const [notebookOpen, setNotebookOpen] = useState(false);
  const [notebookEditId, setNotebookEditId] = useState<string | null>(null);
  const [seedSelectedText, setSeedSelectedText] = useState('');
  const [selectionQuote, setSelectionQuote] = useState<{
    text: string;
    paragraphIndex: number;
    x: number;
    y: number;
  } | null>(null);

  const stickyNotes = useAppStore((s) => s.stickyNotes);
  const bookNotes = useMemo(
    () => (book ? stickyNotes.filter((n) => n.bookId === book.id) : []),
    [stickyNotes, book?.id]
  );
  const notesByParagraph = useMemo(() => {
    const map = new Map<number, typeof bookNotes>();
    for (const n of bookNotes) {
      if (n.paragraphIndex < 0) continue;
      const list = map.get(n.paragraphIndex) ?? [];
      list.push(n);
      map.set(n.paragraphIndex, list);
    }
    return map;
  }, [bookNotes]);

  const openNotebook = useCallback((editId?: string | null, quote?: string) => {
    setNotebookEditId(editId ?? null);
    if (quote != null) setSeedSelectedText(quote);
    setNotebookOpen(true);
  }, []);

  const handleTextSelection = useCallback(
    (e: React.MouseEvent<HTMLElement>) => {
      if (typeof window === 'undefined') return;
      const sel = window.getSelection();
      const text = (sel?.toString() ?? '').trim();
      if (!text || text.length > 200 || !sel || sel.rangeCount === 0) {
        setSelectionQuote(null);
        return;
      }
      let node: Node | null = sel.anchorNode;
      let paraIndex = activeParaIndex;
      while (node) {
        if (node instanceof HTMLElement && node.dataset?.paraIndex != null) {
          const n = Number(node.dataset.paraIndex);
          if (Number.isFinite(n)) paraIndex = n;
          break;
        }
        node = node.parentNode;
      }
      try {
        const rect = sel.getRangeAt(0).getBoundingClientRect();
        setSelectionQuote({
          text: text.slice(0, 160),
          paragraphIndex: paraIndex,
          x: Math.min(
            Math.max(rect.left + rect.width / 2, 72),
            window.innerWidth - 72
          ),
          y: Math.max(rect.top - 8, 56),
        });
      } catch {
        setSelectionQuote({
          text: text.slice(0, 160),
          paragraphIndex: paraIndex,
          x: e.clientX,
          y: e.clientY,
        });
      }
    },
    [activeParaIndex]
  );

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const settingsRef = useRef<HTMLDivElement | null>(null);
  const paraRefs = useRef<Record<number, HTMLElement | null>>({});
  const lastSavedIndex = useRef<number>(-1);
  const restoreDone = useRef<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoScrollRaf = useRef<number | null>(null);

  const jumpToParagraph = useCallback((index: number) => {
    const el = paraRefs.current[index];
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setActiveParaIndex(index);
    }
  }, []);

  useEffect(() => ttsService.subscribeSpeaking(setIsPlaying), []);
  useEffect(() => () => ttsService.stop(), []);
  useEffect(() => {
    prefetchTranslationCache();
  }, []);
  useEffect(() => {
    setShowPinyin(showPinyinProp);
    setRevealedParagraphs({});
    setSelected(null);
    setSettingsOpen(false);
    setAutoScroll(false);
    lastSavedIndex.current = -1;
    restoreDone.current = null;
    setReadPercent(0);
    setActiveParaIndex(0);
    setLevelBannerDismissed(false);
    setNotebookOpen(false);
    setNotebookEditId(null);
    setSeedSelectedText('');
    setSelectionQuote(null);
  }, [book?.id, showPinyinProp]);

  // Закрытие панели настроек по клику снаружи / Escape
  useEffect(() => {
    if (!settingsOpen) return;
    const onPointer = (e: MouseEvent | TouchEvent) => {
      const el = settingsRef.current;
      if (el && e.target instanceof Node && !el.contains(e.target)) {
        setSettingsOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSettingsOpen(false);
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('touchstart', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('touchstart', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [settingsOpen]);

  const title =
    chapterTitle ||
    (book ? formatBookTitleLine(book, uiLang) : 'Chapter 1: The Encounter');

  const paragraphs = book?.paragraphs ?? [];

  const rendered = useMemo(
    () =>
      paragraphs.map((p, idx) => {
        const reading = readingTextForParagraph(language, p);
        // Язык токенов = язык книги; кириллический детект только если книга не en/zh
        // и текст явно русский (legacy-книги без language:'ru').
        const hasCyrillic = /[А-Яа-яЁё]/.test(reading);
        const tokenLanguage: TokenLanguage =
          language === 'ru' || (language !== 'en' && language !== 'zh' && hasCyrillic)
            ? 'ru'
            : language === 'en'
              ? 'en'
              : hasCyrillic && !/[\u4e00-\u9fff]/.test(reading)
                ? 'ru'
                : 'zh';
        const tokens =
          tokenLanguage === 'en'
            ? buildEnglishTokens(reading, p.words)
            : tokenLanguage === 'ru'
              ? buildRussianTokens(reading, {
                  withTranslit: showPinyin,
                  words: p.words,
                })
              : buildChineseTokens(reading, p.words, {
                  withPinyin: showPinyin,
                });
        return {
          key: `p-${idx}`,
          index: idx,
          readingText: reading,
          tokenLanguage,
          tokens,
          paragraph: p,
          grammar: p.grammar ?? [],
        };
      }),
    [paragraphs, language, showPinyin]
  );

  const persistProgress = useCallback(
    (index: number) => {
      if (!book || book.paragraphs.length === 0) return;
      setActiveParaIndex(index);
      if (index === lastSavedIndex.current) return;
      lastSavedIndex.current = index;
      void saveReadingProgress(book, index).then((p) => {
        setReadPercent(p.percent);
        onProgressChange?.(p);
      });
    },
    [book, onProgressChange]
  );

  const pendingIndexRef = useRef<number | null>(null);

  const detectVisibleParagraph = useCallback(() => {
    const root = scrollRef.current;
    if (!root || rendered.length === 0) return;
    const rootTop = root.getBoundingClientRect().top;
    const marker = rootTop + Math.min(120, root.clientHeight * 0.25);
    let best = 0;
    for (const para of rendered) {
      const el = paraRefs.current[para.index];
      if (!el) continue;
      if (el.getBoundingClientRect().top <= marker) {
        best = para.index;
      }
    }
    setActiveParaIndex(best);
    pendingIndexRef.current = best;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      pendingIndexRef.current = null;
      persistProgress(best);
    }, PROGRESS_SAVE_DEBOUNCE_MS);
  }, [rendered, persistProgress]);

  // Плавная автопрокрутка текста
  useEffect(() => {
    if (!autoScroll) {
      if (autoScrollRaf.current != null) {
        cancelAnimationFrame(autoScrollRaf.current);
        autoScrollRaf.current = null;
      }
      return;
    }

    let lastTs = 0;
    const tick = (ts: number) => {
      const root = scrollRef.current;
      if (!root) {
        autoScrollRaf.current = requestAnimationFrame(tick);
        return;
      }
      if (!lastTs) lastTs = ts;
      const dt = Math.min(0.05, (ts - lastTs) / 1000);
      lastTs = ts;
      const maxScroll = root.scrollHeight - root.clientHeight;
      if (maxScroll <= 0 || root.scrollTop >= maxScroll - 1) {
        setAutoScroll(false);
        return;
      }
      root.scrollTop += AUTO_SCROLL_PX_PER_SEC * dt;
      detectVisibleParagraph();
      autoScrollRaf.current = requestAnimationFrame(tick);
    };

    autoScrollRaf.current = requestAnimationFrame(tick);
    return () => {
      if (autoScrollRaf.current != null) {
        cancelAnimationFrame(autoScrollRaf.current);
        autoScrollRaf.current = null;
      }
    };
  }, [autoScroll, detectVisibleParagraph]);

  // Восстановить скролл: локально + облако (Firestore), затем к абзацу
  useEffect(() => {
    if (!book?.id || rendered.length === 0) return;
    if (restoreDone.current === book.id) return;
    let cancelled = false;
    void resolveReadingProgress(book.id).then((saved) => {
      if (cancelled) return;
      restoreDone.current = book.id;
      if (!saved) {
        persistProgress(0);
        return;
      }
      setReadPercent(saved.percent);
      setActiveParaIndex(saved.paragraphIndex);
      lastSavedIndex.current = saved.paragraphIndex;
      onProgressChange?.(saved);
      requestAnimationFrame(() => {
        const el = paraRefs.current[saved.paragraphIndex];
        if (el) {
          el.scrollIntoView({ behavior: 'auto', block: 'start' });
        }
      });
    });
    return () => {
      cancelled = true;
    };
  }, [book?.id, rendered.length, persistProgress, onProgressChange]);

  // Flush отложенного save при размонтировании / смене книги
  useEffect(() => {
    return () => {
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
        saveTimer.current = null;
      }
      const pending = pendingIndexRef.current;
      if (pending != null && book && pending !== lastSavedIndex.current) {
        pendingIndexRef.current = null;
        void saveReadingProgress(book, pending);
      }
    };
  }, [book]);

  const handleToggleAudio = () => {
    if (isPlaying || ttsService.isSpeaking()) {
      ttsService.stop();
      return;
    }
    const text = rendered.map((p) => p.readingText).join(isEnglish ? ' ' : '。');
    if (text.trim()) {
      void ttsService.speak(text, 0.85, isEnglish ? 'en-US' : 'zh-CN');
    }
  };

  const handleDownloadText = useCallback(() => {
    if (!book) {
      setToastMessage(t('reader.downloadEmpty'));
      return;
    }
    try {
      const filename = downloadBookAsTextFile(book);
      if (!filename) {
        setToastMessage(t('reader.downloadFail'));
        return;
      }
      setToastMessage(filename);
    } catch (err) {
      console.warn('[ReaderPanel] download failed', err);
      setToastMessage(t('reader.downloadError'));
    }
  }, [book, t]);

  const pinyinLabel = isEnglish
    ? showPinyin
      ? t('reader.hideHints')
      : t('reader.showHints')
    : showPinyin
      ? t('reader.hidePinyin')
      : t('reader.showPinyin');

  const fontScalePct = Math.round(readerFontScale * 100);
  const canShrinkFont = readerFontScale > READER_FONT_SCALE_MIN + 1e-6;
  const canGrowFont = readerFontScale < READER_FONT_SCALE_MAX - 1e-6;

  const settingsPanel = settingsOpen ? (
    <Div
      className={`absolute bottom-full right-0 mb-2 w-[min(100vw-2rem,280px)] z-50 rounded-2xl border backdrop-blur-xl shadow-2xl p-3.5 space-y-3.5 ${
        theme.isDark
          ? 'bg-[#1E1E28]/95 border-[#2A2A3A] shadow-[0_12px_40px_rgba(0,0,0,0.55)]'
          : 'bg-white/95 border-gray-200 shadow-[0_12px_40px_rgba(15,23,42,0.12)]'
      }`}
      role="dialog"
      aria-label={t('reader.settings')}
    >
      <Div className="flex items-center justify-between gap-2">
        <Span
          className={`text-[11px] font-bold uppercase tracking-wide ${theme.accent} font-['Comfortaa']`}
        >
          {t('reader.settings')}
        </Span>
        <Button
          type="button"
          className={`w-7 h-7 rounded-full text-xs font-bold ${theme.textMuted} ${theme.hover} transition`}
          onClick={() => setSettingsOpen(false)}
          title={t('action.close')}
          aria-label={t('action.close')}
        >
          ✕
        </Button>
      </Div>

      <Div>
        <Div className={`text-[10px] font-bold uppercase tracking-wide mb-1.5 ${theme.textMuted}`}>
          {t('reader.fontSmaller')} / {t('reader.fontLarger')}
        </Div>
        <Div className="flex items-center gap-2">
          <Button
            type="button"
            disabled={!canShrinkFont}
            className={`flex-1 py-1.5 rounded-full text-xs font-bold transition ${
              canShrinkFont
                ? `${theme.accent} ${theme.hover}`
                : `${theme.textMuted} opacity-40 cursor-not-allowed`
            } ${theme.isDark ? 'bg-[#16161E] border border-[#2A2A3A]' : 'bg-gray-50 border border-gray-200'}`}
            onClick={() => bumpReaderFontScale(-READER_FONT_SCALE_STEP)}
            title={t('reader.fontSmaller')}
            aria-label={t('reader.fontSmaller')}
          >
            A−
          </Button>
          <Span
            className={`min-w-[3.25rem] text-center text-xs font-bold tabular-nums ${theme.text}`}
          >
            {fontScalePct}%
          </Span>
          <Button
            type="button"
            disabled={!canGrowFont}
            className={`flex-1 py-1.5 rounded-full text-xs font-bold transition ${
              canGrowFont
                ? `${theme.accent} ${theme.hover}`
                : `${theme.textMuted} opacity-40 cursor-not-allowed`
            } ${theme.isDark ? 'bg-[#16161E] border border-[#2A2A3A]' : 'bg-gray-50 border border-gray-200'}`}
            onClick={() => bumpReaderFontScale(READER_FONT_SCALE_STEP)}
            title={t('reader.fontLarger')}
            aria-label={t('reader.fontLarger')}
          >
            A+
          </Button>
        </Div>
      </Div>

      <Div>
        <Div className={`text-[10px] font-bold uppercase tracking-wide mb-1.5 ${theme.textMuted}`}>
          {t('settings.theme')}
        </Div>
        <Div className="flex items-center gap-2">
          {PAGE_THEME_KEYS.map((opt) => {
            const active = readerPageTheme === opt.id;
            const label = t(opt.labelKey);
            return (
              <Button
                key={opt.id}
                type="button"
                className={`flex-1 flex flex-col items-center gap-1.5 py-2 px-1 rounded-xl transition border ${
                  active
                    ? 'border-[#D0FF00] ring-1 ring-[#D0FF00]/50'
                    : theme.isDark
                      ? 'border-[#2A2A3A] hover:border-[#8B5CF6]/50'
                      : 'border-gray-200 hover:border-purple-300'
                }`}
                onClick={() => setReaderPageTheme(opt.id)}
                title={label}
                aria-label={label}
                aria-pressed={active}
              >
                <Span
                  className="w-7 h-7 rounded-full border border-black/10 shadow-inner"
                  style={{ background: opt.swatch }}
                />
                <Span
                  className={`text-[10px] font-bold ${
                    active ? 'text-[#D0FF00]' : theme.textMuted
                  }`}
                >
                  {label}
                </Span>
              </Button>
            );
          })}
        </Div>
      </Div>

      <Div>
        <Div className={`text-[10px] font-bold uppercase tracking-wide mb-1.5 ${theme.textMuted}`}>
          {t('reader.autoScrollLabel')}
        </Div>
        <Button
          type="button"
          className={`w-full py-2 rounded-full text-xs font-bold transition ${
            autoScroll
              ? 'bg-[#D0FF00] text-[#0D0D11]'
              : theme.isDark
                ? `bg-[#16161E] border border-[#2A2A3A] ${theme.accent} ${theme.hover}`
                : `bg-gray-50 border border-gray-200 ${theme.accent} ${theme.hover}`
          }`}
          onClick={() => setAutoScroll((v) => !v)}
          title={
            autoScroll
              ? t('reader.autoScrollOn')
              : t('reader.autoScrollOff')
          }
          aria-pressed={autoScroll}
        >
          {autoScroll ? `⏸ ${t('reader.stop')}` : `↓ ${t('reader.autoScrollOff')}`}
        </Button>
      </Div>
    </Div>
  ) : null;

  const toolbar = (
    <Div className="mx-auto w-full max-w-full space-y-2 px-1">
      <Div
        className={`${theme.toolbar} rounded-2xl sm:rounded-full px-1.5 sm:px-2 py-1.5 flex items-center justify-center gap-0.5 sm:gap-1 flex-wrap`}
      >
        <Button
          type="button"
          className={`px-2 sm:px-3 py-1.5 rounded-full text-[11px] sm:text-xs font-bold transition ${
            showTranslation
              ? 'bg-[#D0FF00] text-[#0D0D11]'
              : `${theme.accent} ${theme.hover}`
          }`}
          onClick={() => {
            toggleRussian();
            setRevealedParagraphs({});
          }}
          title={t('reader.toggleRu')}
        >
          {showTranslation ? t('action.hideText') : t('action.showText')}
        </Button>
        <Button
          type="button"
          className={`px-2 sm:px-3 py-1.5 rounded-full text-[11px] sm:text-xs font-bold transition ${
            showPinyin
              ? theme.isDark
                ? 'bg-[#FF6584]/25 text-[#FF6584]'
                : 'bg-pink-100 text-pink-400'
              : `text-[#FF6584] ${theme.hover}`
          }`}
          onClick={() => setShowPinyin((v) => !v)}
          title={pinyinLabel}
        >
          {pinyinLabel}
        </Button>
        <Button
          type="button"
          className={`px-2 sm:px-3 py-1.5 rounded-full text-[11px] sm:text-xs font-bold transition ${
            isPlaying
              ? theme.isDark
                ? 'bg-red-500/20 text-red-300'
                : 'bg-red-50 text-red-600'
              : `${theme.accent} ${theme.hover}`
          }`}
          onClick={handleToggleAudio}
          title={isPlaying ? t('reader.ttsStop') : t('reader.ttsPlay')}
        >
          {isPlaying ? '⏹' : '🔊'}
          <Span className="hidden sm:inline">
            {' '}
            {isPlaying ? t('reader.stop') : t('reader.audio')}
          </Span>
        </Button>
        <Button
          type="button"
          className={`relative px-2 sm:px-3 py-1.5 rounded-full text-[11px] sm:text-xs font-bold transition ${
            notebookOpen || bookNotes.length > 0
              ? theme.isDark
                ? 'bg-[#D0FF00]/20 text-[#D0FF00]'
                : 'bg-lime-100 text-lime-800'
              : `${theme.textMuted} ${theme.hover}`
          }`}
          onClick={() => openNotebook()}
          title={t('notebook.title')}
          aria-label={t('notebook.title')}
          aria-expanded={notebookOpen}
        >
          📝
          {bookNotes.length > 0 ? (
            <Span className="absolute -top-1 -right-1 min-w-[1rem] h-4 px-1 rounded-full bg-[#8B5CF6] text-white text-[9px] font-bold flex items-center justify-center">
              {bookNotes.length > 99 ? '99+' : bookNotes.length}
            </Span>
          ) : null}
        </Button>
        <Div className="relative" ref={settingsRef}>
          <Button
            type="button"
            className={`px-2 sm:px-3 py-1.5 rounded-full text-[11px] sm:text-xs font-bold transition ${
              settingsOpen || autoScroll
                ? 'bg-[#8B5CF6]/25 text-[#8B5CF6]'
                : `${theme.accent} ${theme.hover}`
            }`}
            onClick={() => setSettingsOpen((v) => !v)}
            title={t('reader.settings')}
            aria-label={t('reader.settings')}
            aria-expanded={settingsOpen}
            aria-haspopup="dialog"
          >
            Aa
          </Button>
          {settingsPanel}
        </Div>
        {book ? (
          <Button
            type="button"
            className={`px-2 sm:px-3 py-1.5 rounded-full text-[11px] sm:text-xs font-bold transition border
              bg-[#1E1E28]/80 border-[#2A2A3A] text-[#8B5CF6]
              hover:text-[#D0FF00] hover:border-[#D0FF00]/50 hover:bg-[#8B5CF6]/15`}
            onClick={handleDownloadText}
            title={t('reader.download')}
            aria-label={t('reader.download')}
          >
            ⬇️
            <Span className="hidden sm:inline"> {t('action.save')}</Span>
          </Button>
        ) : null}
        {onDelete && book ? (
          <Button
            type="button"
            className={`px-2 sm:px-3 py-1.5 rounded-full text-[11px] sm:text-xs font-bold transition ${theme.danger}`}
            onClick={onDelete}
            title={t('reader.delete')}
            aria-label={t('reader.delete')}
          >
            🗑️
          </Button>
        ) : null}
      </Div>
    </Div>
  );

  return (
    <>
      <GlassWindow
        title={title}
        widthClass="flex-1 min-w-0"
        className="h-full max-h-full"
        footer={toolbar}
        onBack={onBack}
        showBackButton={!!onBack}
        bodyRef={scrollRef}
        onBodyScroll={detectVisibleParagraph}
      >
        {rendered.length === 0 ? (
          <Div className="h-full flex items-center justify-center text-center px-8">
            <Div>
              <Div className="text-4xl mb-3">📖</Div>
              <Div className={`font-['Comfortaa'] font-bold ${theme.accent} text-lg`}>
                {t('reader.noBook')}
              </Div>
              <Div className={`text-sm ${theme.textMuted} mt-2`}>
                {t('reader.clickWordHintNative')}
              </Div>
            </Div>
          </Div>
        ) : (
          <Div
            className={`reader-page-theme reader-page-${readerPageTheme} max-w-3xl mx-auto space-y-4 pb-4 transition-colors duration-300`}
            style={
              {
                ['--reader-font-scale' as string]: String(readerFontScale),
              } as React.CSSProperties
            }
            onMouseUp={handleTextSelection}
          >
            {coverage && !levelBannerDismissed ? (
              <Div
                className={`flex items-start justify-between gap-2 rounded-2xl px-3 py-2 text-[11px] border ${
                  theme.isDark
                    ? 'bg-[#1E1E28]/85 border-[#2A2A3A] text-white/90'
                    : 'bg-white/90 border-gray-200 text-gray-800'
                }`}
              >
                <Div>
                  <Span className={`font-bold ${theme.accent}`}>
                    {t('reader.levelFitTitle')}
                  </Span>
                  <Div className={`mt-0.5 leading-snug ${theme.textMuted}`}>
                    {t('reader.levelFitBody', {
                      label: coverage.recommendedLabel,
                      known: coverage.knownPercent,
                      unique: coverage.totalUniqueWords,
                    })}
                  </Div>
                </Div>
                <Button
                  type="button"
                  className={`shrink-0 text-xs font-bold px-2 py-0.5 rounded-lg ${theme.textMuted}`}
                  onClick={() => setLevelBannerDismissed(true)}
                  aria-label={t('action.close')}
                >
                  ×
                </Button>
              </Div>
            ) : null}
            {readPercent > 0 || rendered.length > 0 ? (
              <Div className="reader-chrome-muted text-center text-[11px] font-semibold">
                {t('reader.readProgressLine', {
                  pct: Math.round(readPercent),
                  current: activeParaIndex + 1,
                  total: rendered.length,
                })}
                {autoScroll ? t('reader.autoScrollBadge') : ''}
              </Div>
            ) : null}
            {!showTranslation ? (
              <Div className="text-center text-[11px] font-semibold text-[#ec4899] opacity-90 mb-1">
                {t('reader.practiceModeHint')}
              </Div>
            ) : null}

            {rendered.map((para) => {
              const peeked = !!revealedParagraphs[para.index];

              return (
                <Div
                  key={para.key}
                  data-para-index={para.index}
                  ref={(node) => {
                    paraRefs.current[para.index] = node as HTMLElement | null;
                  }}
                  className="reader-para-card rounded-2xl px-4 py-3"
                >
                  <Div
                    className={`reader-hanzi ${isEnglish ? 'reader-en' : ''} ${
                      showPinyin ? 'reader-pinyin-on' : ''
                    }`}
                  >
                    {para.tokens.map((tok, i) => {
                      // Пунктуация / пробелы — лёгкий текст без onClick
                      if (!tok.isWord || !tok.word) {
                        return (
                          <Span key={`${para.key}-t-${i}`}>{tok.text}</Span>
                        );
                      }

                      const wrapClass = `${tok.grammarClass ?? ''} reader-word-hit cursor-pointer rounded-sm`.trim();

                      const onWordClick = (e: {
                        stopPropagation?: () => void;
                      }) => {
                        e.stopPropagation?.();
                        // Пиньинь для модалки — целое слово, из кэша / pinyin-pro
                        const py =
                          tok.pinyin?.trim() ||
                          tok.word?.pinyin?.trim() ||
                          (para.tokenLanguage === 'zh'
                            ? pinyinFor(tok.word!.hanzi)
                            : '');
                        setSelected({
                          word: { ...tok.word!, pinyin: py || tok.word!.pinyin },
                          contextSentence: extractContext(
                            para.readingText,
                            tok.word!.hanzi
                          ),
                          tokenLanguage: para.tokenLanguage,
                        });
                      };

                      const annotation =
                        showPinyin &&
                        (para.tokenLanguage === 'zh' ||
                          para.tokenLanguage === 'ru')
                          ? tok.pinyin?.trim() || ''
                          : '';

                      if (!annotation) {
                        return (
                          <Span
                            key={`${para.key}-t-${i}`}
                            className={wrapClass}
                            onClick={onWordClick}
                            title={t('reader.openTranslation')}
                          >
                            {tok.text}
                          </Span>
                        );
                      }

                      return (
                        <Span
                          key={`${para.key}-t-${i}`}
                          className={`reader-word-stack ${wrapClass}`}
                          onClick={onWordClick}
                          title={t('reader.openTranslation')}
                        >
                          <Span
                            className="reader-pinyin text-[#FF6584]"
                            aria-hidden
                          >
                            {annotation}
                          </Span>
                          <Span className="reader-word-surface">{tok.text}</Span>
                        </Span>
                      );
                    })}
                  </Div>

                  <NativeParagraphTranslationLine
                    paragraph={para.paragraph}
                    nativeLanguage={nativeLanguage}
                    showTranslation={showTranslation}
                    peeked={peeked}
                    onPeek={() =>
                      setRevealedParagraphs((prev) => ({
                        ...prev,
                        [para.index]: true,
                      }))
                    }
                    theme={theme}
                    peekLabel={t('reader.peekTranslation')}
                  />

                  {isEnglish ? (
                    <LocalizedGrammarCards
                      grammar={para.grammar}
                      paraKey={para.key}
                      nativeLanguage={nativeLanguage}
                      theme={theme}
                      countLabel={t('reader.grammarCount', {
                        n: para.grammar.length,
                      })}
                    />
                  ) : null}

                  <Div className="mt-2 flex items-center gap-2 flex-wrap">
                    <Button
                      type="button"
                      className={`text-[10px] font-bold rounded-lg px-2 py-1 transition ${
                        theme.isDark
                          ? 'bg-white/8 text-white/70 hover:bg-[#D0FF00]/15 hover:text-[#D0FF00]'
                          : 'bg-black/5 text-gray-600 hover:bg-lime-50 hover:text-lime-800'
                      }`}
                      onClick={() => {
                        setActiveParaIndex(para.index);
                        setSeedSelectedText('');
                        openNotebook();
                      }}
                    >
                      {t('notebook.addToParagraph')}
                    </Button>
                  </Div>

                  <ParagraphNoteChips
                    notes={notesByParagraph.get(para.index) ?? []}
                    onOpen={(note) => {
                      setSeedSelectedText('');
                      openNotebook(note?.id ?? null);
                    }}
                  />
                </Div>
              );
            })}
          </Div>
        )}
      </GlassWindow>

      {selectionQuote ? (
        <Button
          type="button"
          className="fixed z-[65] -translate-x-1/2 -translate-y-full rounded-full px-3 py-1.5 text-[11px] font-bold shadow-lg border bg-[#D0FF00] text-[#0D0D11] border-[#0D0D11]/20"
          style={{ left: selectionQuote.x, top: selectionQuote.y }}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            setActiveParaIndex(selectionQuote.paragraphIndex);
            openNotebook(null, selectionQuote.text);
            setSelectionQuote(null);
            window.getSelection()?.removeAllRanges();
          }}
        >
          {t('notebook.fromSelection')}
        </Button>
      ) : null}

      <ReaderNotebookPanel
        open={notebookOpen}
        bookId={book?.id ?? null}
        bookTitle={book ? formatBookTitleLine(book, uiLang) : ''}
        paragraphIndex={activeParaIndex}
        paragraphPreview={
          rendered[activeParaIndex]?.readingText ??
          rendered[activeParaIndex]?.paragraph?.chineseText ??
          ''
        }
        seedSelectedText={seedSelectedText}
        editNoteId={notebookEditId}
        onClose={() => {
          setNotebookOpen(false);
          setNotebookEditId(null);
          setSeedSelectedText('');
        }}
        onJumpToParagraph={jumpToParagraph}
      />

      {selected ? (
        <WordModalGlass
          word={selected.word}
          contextSentence={selected.contextSentence}
          sourceTitle={book ? formatBookTitleLine(book, uiLang) : undefined}
          sourceBookId={book?.id}
          language={selected.tokenLanguage}
          nativeLanguage={nativeLanguage}
          onClose={() => setSelected(null)}
        />
      ) : null}

      {toastMessage ? (
        <ReaderToast
          message={toastMessage}
          onClose={() => setToastMessage(null)}
        />
      ) : null}
    </>
  );
}
