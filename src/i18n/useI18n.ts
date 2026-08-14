import React, {
  createContext,
  createElement,
  useCallback,
  useContext,
  useMemo,
  type ReactNode,
} from 'react';
import { useAppStore } from '../store/useAppStore';
import type { NativeLanguage } from '../types';
import { translateUi, type UiMessageKey } from './uiMessages';

export type I18nApi = {
  /** Текущий UI-язык (= nativeLanguage в Zustand) */
  lang: NativeLanguage;
  t: (key: UiMessageKey, vars?: Record<string, string | number>) => string;
};

const I18nContext = createContext<I18nApi | null>(null);

/** Провайдер: форсирует обновление дерева при смене nativeLanguage. */
export function I18nProvider({ children }: { children: ReactNode }) {
  const lang = useAppStore((s) => s.nativeLanguage);

  const t = useCallback(
    (key: UiMessageKey, vars?: Record<string, string | number>) =>
      translateUi(key, lang, vars),
    [lang]
  );

  const value = useMemo<I18nApi>(() => ({ lang, t }), [lang, t]);

  return createElement(I18nContext.Provider, { value }, children);
}

/**
 * UI-переводы. lang всегда = Zustand `nativeLanguage` (подписка на store).
 * Не кэшируем язык из Context — только из store.
 */
export function useI18n(): I18nApi {
  useContext(I18nContext); // держит Provider-подписку живой
  const lang = useAppStore((s) => s.nativeLanguage);

  const t = useCallback(
    (key: UiMessageKey, vars?: Record<string, string | number>) =>
      translateUi(key, lang, vars),
    [lang]
  );

  return useMemo<I18nApi>(() => ({ lang, t }), [lang, t]);
}
