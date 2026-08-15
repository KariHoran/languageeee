import React, { useEffect, useMemo, useState } from 'react';
import { useLocalizedGrammarExplanation } from '../hooks/useLocalizedText';
import { lookupBkrs } from '../services/bkrsService';
import { analyzeEnglishWordGrammar } from '../services/englishGrammarService';
import { addFlashcard, hasFlashcard, markFlashcardKnown, removeFlashcard } from '../services/flashcardsStore';
import {
  learningToNativePair,
  ttsLocale,
} from '../services/languageConfig';
import {
  getCachedTranslationSync,
  translateWord,
} from '../services/translationService';
import { ttsService } from '../services/ttsService';
import { useAppStore } from '../store/useAppStore';
import { useI18n } from '../i18n/useI18n';
import { translateUi } from '../i18n/uiMessages';
import type { LearningLanguage, NativeLanguage, Word } from '../types';
import { getHskBadgeColors } from '../utils/hskColors';
import { Button, Div, Span } from './dom';
import { useWebTheme } from './webTheme';

function friendlyTranslateError(err: unknown, uiLanguage: NativeLanguage): string {
  const message = err instanceof Error ? err.message : String(err);
  if (
    /cors|недоступен|сеть|network|failed to fetch|таймаут|timeout|proxy/i.test(
      message
    )
  ) {
    return translateUi('word.serviceUnavailable', uiLanguage);
  }
  return translateUi('word.transFail', uiLanguage);
}

/** Локальный / кэшированный перевод без сети (learning → native). */
function resolveLocalTranslation(
  surface: string,
  learning: LearningLanguage,
  native: NativeLanguage,
  existing?: string
): string {
  const prev = existing?.trim() || '';
  const pair = learningToNativePair(learning, native);

  if (learning === 'zh' && native === 'ru') {
    const bkrs = lookupBkrs(surface)?.trim() || '';
    if (bkrs) return bkrs;
  }
  if (prev) return prev;
  if (learning === native) return prev;

  const cacheKey = learning === 'en' ? surface.toLowerCase() : surface;
  return getCachedTranslationSync(cacheKey, pair.cacheDirection)?.trim() || '';
}

interface WordModalGlassProps {
  word: Word;
  contextSentence?: string;
  sourceTitle?: string;
  sourceBookId?: string;
  /** Язык изучаемого токена */
  language?: LearningLanguage;
  /** Родной язык глоссы (если не передан — из Zustand) */
  nativeLanguage?: NativeLanguage;
  /** @deprecated UI язык = nativeLanguage */
  interfaceLanguage?: NativeLanguage;
  /** @deprecated — направление берётся из learning+native */
  translationDirection?: string;
  onClose: () => void;
  onAddedToFlashcards?: () => void;
  /** Добавить слово / цитату в блокнот книги */
  onAddToNotebook?: (payload: {
    selectedText: string;
    note: string;
  }) => void;
}

export function WordModalGlass({
  word,
  contextSentence,
  sourceTitle,
  sourceBookId,
  language = 'zh',
  nativeLanguage: nativeProp,
  onClose,
  onAddedToFlashcards,
  onAddToNotebook,
}: WordModalGlassProps) {
  const theme = useWebTheme();
  const { t } = useI18n();
  const storeNative = useAppStore((s) => s.nativeLanguage);
  const nativeLanguage = nativeProp ?? storeNative;
  const [inDeck, setInDeck] = useState(false);
  const [busy, setBusy] = useState(false);
  const [noteSaved, setNoteSaved] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const isEnglish = language === 'en';
  const isRussian = language === 'ru';
  const isChinese = language === 'zh';

  const targetLabel =
    nativeLanguage === 'zh'
      ? '中文'
      : nativeLanguage === 'en'
        ? 'English'
        : 'RU';

  const enGrammar = useMemo(
    () =>
      isEnglish
        ? analyzeEnglishWordGrammar(word.hanzi, contextSentence ?? '')
        : null,
    [isEnglish, word.hanzi, contextSentence]
  );
  const enGrammarExplanation = useLocalizedGrammarExplanation(
    enGrammar?.explanation,
    nativeLanguage
  );

  const localHit = resolveLocalTranslation(
    word.hanzi,
    language,
    nativeLanguage,
    word.translation
  );

  const [translation, setTranslation] = useState(localHit);
  const [translating, setTranslating] = useState(false);
  const [translateError, setTranslateError] = useState<string | null>(null);

  const hskColors =
    word.hskLevel != null ? getHskBadgeColors(word.hskLevel) : null;

  useEffect(() => {
    void hasFlashcard(word.hanzi, language).then(setInDeck);
  }, [word.hanzi, language]);

  useEffect(() => ttsService.subscribeSpeaking(setIsPlaying), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  /**
   * On-demand перевод ТОЛЬКО при открытии карточки (клик по слову).
   * Направление строго learning → nativeLanguage.
   */
  useEffect(() => {
    let cancelled = false;
    const surface = word.hanzi.trim();
    if (!surface) return;

    const local = resolveLocalTranslation(
      surface,
      language,
      nativeLanguage,
      word.translation
    );
    if (local) {
      setTranslation(local);
      setTranslating(false);
      setTranslateError(null);
      return;
    }

    setTranslation('');
    setTranslateError(null);
    setTranslating(true);

    void (async () => {
      try {
        const clean = (
          await translateWord(surface, language, nativeLanguage)
        ).trim();
        if (cancelled) return;
        if (clean) setTranslation(clean);
        else setTranslateError(t('word.transFail'));
      } catch (err) {
        if (cancelled) return;
        console.error('[WordCard] translate failed:', surface, err);
        setTranslateError(friendlyTranslateError(err, nativeLanguage));
      } finally {
        if (!cancelled) setTranslating(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    language,
    nativeLanguage,
    word.hanzi,
    word.translation,
    t,
  ]);

  const handleClose = () => {
    ttsService.stop();
    onClose();
  };

  const handleSpeak = () => {
    if (isPlaying || ttsService.isSpeaking()) {
      ttsService.stop();
      return;
    }
    void ttsService.speak(word.hanzi, isEnglish ? 1 : 0.9, ttsLocale(language));
  };

  const retryTranslate = () => {
    setTranslation('');
    setTranslateError(null);
    setTranslating(true);
    const surface = word.hanzi.trim();
    if (!surface) {
      setTranslateError(t('word.transFail'));
      setTranslating(false);
      return;
    }
    void (async () => {
      try {
        const clean = (
          await translateWord(surface, language, nativeLanguage)
        ).trim();
        if (clean) setTranslation(clean);
        else setTranslateError(t('word.transFail'));
      } catch (err) {
        setTranslateError(friendlyTranslateError(err, nativeLanguage));
      } finally {
        setTranslating(false);
      }
    })();
  };

  const displayTranslation = translation.trim();
  const translationLabel = translating
    ? t('word.translating')
    : displayTranslation
      ? displayTranslation
      : translateError
        ? translateError
        : t('word.searchTrans');

  const primaryStructureBare = enGrammar
    ? enGrammar.structure.replace(/^Фразовый глагол:\s*/, '')
    : '';

  const hintLabel = isChinese || isRussian ? word.pinyin : '';

  return (
    <Div
      className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-3 sm:p-4"
      style={{ background: theme.modalOverlay }}
      onClick={handleClose}
      role="dialog"
    >
      <Div
        className={`${
          theme.isDark
            ? 'bg-[#1E1E28]/95 border border-[#2A2A3A]'
            : theme.card
        } rounded-2xl w-full max-w-sm max-h-[min(90dvh,640px)] overflow-hidden shadow-lg flex flex-col`}
        onClick={(e) => e.stopPropagation()}
      >
        <Div className="px-4 pt-4 pb-2 flex items-start justify-between gap-3 shrink-0">
          <Div
            className={`text-xs font-bold uppercase tracking-wide ${theme.textMuted}`}
          >
            {t('word.cardTitle')}
          </Div>
          <Button
            type="button"
            className={`text-sm font-bold ${theme.textMuted} hover:opacity-80`}
            onClick={handleClose}
          >
            {t('word.close')}
          </Button>
        </Div>

        <Div className="px-4 pb-4 overflow-y-auto flex-1 min-h-0">
          <Div className="flex items-start gap-3">
            <Button
              type="button"
              className={`shrink-0 w-10 h-10 rounded-2xl flex items-center justify-center text-lg ${
                theme.isDark ? 'bg-[#2A2A3A]' : 'bg-gray-100'
              } ${isPlaying ? 'ring-2 ring-[#D0FF00]' : ''}`}
              onClick={handleSpeak}
              title="TTS"
            >
              {isPlaying ? '⏸' : '🔊'}
            </Button>
            <Div className="min-w-0 flex-1">
              <Div className={`text-2xl font-bold ${theme.text} break-words`}>
                {word.hanzi}
              </Div>
              {hintLabel?.trim() ? (
                <Div className="text-sm font-semibold text-[#FF6584] mt-0.5">
                  {hintLabel}
                </Div>
              ) : null}
              {isChinese && word.hskLevel != null && hskColors ? (
                <Span
                  className="inline-block mt-1 text-[10px] font-bold px-2 py-0.5 rounded-full"
                  style={{
                    background: hskColors.background,
                    color: hskColors.text,
                  }}
                >
                  HSK {word.hskLevel}
                </Span>
              ) : isChinese ? (
                <Span
                  className={`inline-block mt-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    theme.isDark
                      ? 'bg-[#2A2A3A] text-white/55'
                      : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  {t('word.hskUnlisted')}
                </Span>
              ) : null}
              {isEnglish ? (
                <Span
                  className={`inline-block mt-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    theme.isDark
                      ? 'bg-[#2A2A3A] text-[#D0FF00]'
                      : 'bg-lime-100 text-lime-800'
                  }`}
                >
                  EN
                </Span>
              ) : null}
              {isRussian ? (
                <Span
                  className={`inline-block mt-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    theme.isDark
                      ? 'bg-[#2A2A3A] text-[#FF6584]'
                      : 'bg-pink-100 text-pink-700'
                  }`}
                >
                  RU
                </Span>
              ) : null}
            </Div>
          </Div>

          <Div className="mt-4">
            <Div
              className={`text-[11px] font-bold uppercase tracking-wide ${theme.textMuted} mb-1`}
            >
              {isChinese && nativeLanguage === 'ru' && lookupBkrs(word.hanzi)
                ? t('word.dictRu')
                : `${t('word.translateLabel')} · ${targetLabel}`}
            </Div>
            <Div
              className={`text-base leading-relaxed ${
                translateError && !displayTranslation
                  ? theme.danger
                  : theme.text
              }`}
            >
              {translationLabel}
            </Div>
            {translateError && !displayTranslation ? (
              <Button
                type="button"
                className={`mt-2 text-xs font-bold ${theme.accent}`}
                onClick={retryTranslate}
              >
                {t('word.retry')}
              </Button>
            ) : null}
          </Div>

          {enGrammar ? (
            <Div className="mt-4">
              <Div
                className={`text-[11px] font-bold uppercase tracking-wide ${theme.textMuted} mb-1`}
              >
                {t('word.grammar')}
              </Div>
              <Div className={`text-sm font-semibold ${theme.text}`}>
                {primaryStructureBare || enGrammar.structure}
              </Div>
              {enGrammarExplanation ? (
                <Div
                  className={`mt-1 text-xs ${theme.textMuted} leading-relaxed`}
                >
                  {enGrammarExplanation}
                </Div>
              ) : null}
              {enGrammar.example ? (
                <Div className={`mt-2 text-xs italic ${theme.textMuted}`}>
                  · {enGrammar.example}
                </Div>
              ) : null}
            </Div>
          ) : null}

          {contextSentence ? (
            <Div
              className={`mt-3 text-xs ${theme.textMuted} italic leading-relaxed`}
            >
              「{contextSentence}」
              {sourceTitle ? (
                <Span className={`not-italic ${theme.accent}`}>
                  {' '}
                  · {sourceTitle}
                </Span>
              ) : null}
            </Div>
          ) : null}

          <Button
            type="button"
            className={`mt-4 w-full rounded-2xl py-2.5 text-sm font-bold transition ${
              inDeck
                ? theme.isDark
                  ? 'bg-[#2A2A3A] text-white/40 cursor-default'
                  : 'bg-gray-100 text-gray-400 cursor-default'
                : 'bg-[#D0FF00] text-[#0D0D11] hover:bg-[#b8e600]'
            }`}
            disabled={inDeck || busy || translating || !displayTranslation}
            onClick={async () => {
              if (inDeck || busy || !displayTranslation) return;
              setBusy(true);
              try {
                const surface = word.hanzi.trim();
                if (!surface) return;
                const saved = await addFlashcard({
                  hanzi: surface,
                  pinyin: isChinese || isRussian ? word.pinyin : '',
                  translation: displayTranslation,
                  hskLevel: isChinese ? word.hskLevel : undefined,
                  language,
                  contextSentence,
                  sourceTitle,
                  sourceBookId,
                });
                console.log('[WordCard] flashcard saved', {
                  id: saved.id,
                  language: saved.language,
                  hanzi: saved.hanzi,
                });
                setInDeck(true);
                onAddedToFlashcards?.();
              } catch (err) {
                console.error('[WordCard] addFlashcard failed:', err);
              } finally {
                setBusy(false);
              }
            }}
          >
            {inDeck
              ? t('word.alreadyInCard')
              : translating
                ? t('word.waitTranslate')
                : t('word.addCard')}
          </Button>

          {onAddToNotebook && sourceBookId ? (
            <Button
              type="button"
              className={`mt-2 w-full rounded-2xl py-2 text-sm font-bold transition ${
                noteSaved
                  ? theme.isDark
                    ? 'bg-[#2A2A3A] text-white/40 cursor-default'
                    : 'bg-gray-100 text-gray-400 cursor-default'
                  : theme.isDark
                    ? 'bg-[#8B5CF6]/20 text-[#c4b5fd] hover:bg-[#8B5CF6]/30'
                    : 'bg-violet-50 text-violet-700 hover:bg-violet-100'
              }`}
              disabled={busy || noteSaved}
              onClick={() => {
                const surface = word.hanzi.trim();
                if (!surface) return;
                const gloss = displayTranslation.trim();
                onAddToNotebook({
                  selectedText: surface,
                  note: gloss
                    ? `${surface}${word.pinyin ? ` (${word.pinyin})` : ''} — ${gloss}`
                    : surface,
                });
                setNoteSaved(true);
              }}
            >
              {noteSaved ? t('word.addedToNotebook') : t('word.addToNotebook')}
            </Button>
          ) : null}

          {inDeck ? (
            <Button
              type="button"
              className={`mt-2 w-full rounded-2xl py-2 text-sm font-bold transition ${
                theme.isDark
                  ? 'bg-[#2A2A3A] text-white/80 hover:bg-[#353545]'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await removeFlashcard(word.hanzi.trim(), language);
                  setInDeck(false);
                } finally {
                  setBusy(false);
                }
              }}
            >
              {t('word.removeFromDeck')}
            </Button>
          ) : null}

          <Button
            type="button"
            className={`mt-2 w-full rounded-2xl py-2 text-sm font-bold transition ${
              theme.isDark
                ? 'border border-[#FF6584]/50 text-[#FF6584]'
                : 'border border-rose-300 text-rose-600'
            }`}
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await markFlashcardKnown(word.hanzi.trim(), language, {
                  remove: true,
                });
                setInDeck(false);
                onAddedToFlashcards?.();
              } finally {
                setBusy(false);
              }
            }}
          >
            {t('word.knownRemoved')}
          </Button>

          {enGrammar ? (
            <Button
              type="button"
              className={`mt-2 w-full rounded-2xl py-2 text-sm font-bold transition ${
                theme.isDark
                  ? 'bg-[#2A2A3A] text-[#D0FF00]'
                  : 'bg-violet-50 text-violet-700'
              }`}
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await addFlashcard({
                    hanzi: enGrammar.structure,
                    translation: enGrammar.explanation || '',
                    language: 'en',
                    kind: 'grammar',
                    contextSentence: enGrammar.example || contextSentence,
                    sourceTitle,
                    sourceBookId,
                  });
                } finally {
                  setBusy(false);
                }
              }}
            >
              {t('flashcards.addGrammar')}
            </Button>
          ) : null}
        </Div>
      </Div>
    </Div>
  );
}
