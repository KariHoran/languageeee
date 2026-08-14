import { useEffect, useState } from 'react';
import type { NativeLanguage, Paragraph } from '../types';
import {
  getGrammarExplanationSync,
  getParagraphNativeTranslationSync,
  resolveGrammarExplanation,
  resolveParagraphNativeTranslation,
} from '../services/nativeTranslationService';
import { prefetchTranslationCache } from '../services/translationCache';

/**
 * Текст параллельного перевода абзаца на nativeLanguage пользователя.
 */
export function useNativeParagraphTranslation(
  paragraph:
    | Pick<Paragraph, 'russianTranslation' | 'translations'>
    | null
    | undefined,
  nativeLanguage: NativeLanguage
): string {
  const [text, setText] = useState(() => {
    if (!paragraph) return '';
    return getParagraphNativeTranslationSync(paragraph, nativeLanguage) ?? '';
  });

  const ru = paragraph?.russianTranslation ?? '';
  const en = paragraph?.translations?.en ?? '';
  const zh = paragraph?.translations?.zh ?? '';

  useEffect(() => {
    prefetchTranslationCache();
    if (!paragraph) {
      setText('');
      return;
    }

    const hasStaticNative =
      nativeLanguage === 'ru' ||
      !!(nativeLanguage === 'en' ? en : nativeLanguage === 'zh' ? zh : false);

    const sync = getParagraphNativeTranslationSync(paragraph, nativeLanguage);
    if (sync != null) {
      setText(sync);
      if (hasStaticNative || sync) return;
    } else {
      setText('');
    }

    if (nativeLanguage === 'ru') return;

    let cancelled = false;
    void resolveParagraphNativeTranslation(paragraph, nativeLanguage).then(
      (resolved) => {
        if (!cancelled) setText(resolved);
      }
    );
    return () => {
      cancelled = true;
    };
  }, [paragraph, ru, en, zh, nativeLanguage]);

  return text;
}

/**
 * Локализованное объяснение грамматики (HSK / EN constructions).
 */
export function useLocalizedGrammarExplanation(
  explanationRu: string | null | undefined,
  nativeLanguage: NativeLanguage
): string {
  const source = explanationRu?.trim() ?? '';
  const [text, setText] = useState(() => {
    if (!source) return '';
    return (
      getGrammarExplanationSync(source, nativeLanguage) ??
      (nativeLanguage === 'ru' ? source : '')
    );
  });

  useEffect(() => {
    prefetchTranslationCache();
    if (!source) {
      setText('');
      return;
    }

    if (nativeLanguage === 'ru') {
      setText(source);
      return;
    }

    const sync = getGrammarExplanationSync(source, nativeLanguage);
    if (sync) {
      setText(sync);
      return;
    }

    setText('');
    let cancelled = false;
    void resolveGrammarExplanation(source, nativeLanguage).then((resolved) => {
      if (!cancelled) setText(resolved);
    });
    return () => {
      cancelled = true;
    };
  }, [source, nativeLanguage]);

  return text;
}
