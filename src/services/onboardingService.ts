import AsyncStorage from '@react-native-async-storage/async-storage';
import type { LearningLanguage, NativeLanguage } from '../types';
import {
  DEFAULT_LEARNING_LANGUAGE,
  DEFAULT_NATIVE_LANGUAGE,
} from '../types';
import {
  directionLabel,
  learningToNativePair,
  normalizeLearningLanguage,
  normalizeNativeLanguage,
} from './languageConfig';

const PREFS_KEY = '@languageeee/user_prefs';

/** @deprecated Используйте nativeLanguage; оставлено для совместимости UI. */
export type InterfaceLanguage = 'ru' | 'zh' | 'en';

/** @deprecated Вычисляется из learning+native; legacy-значения для старых prefs. */
export type TranslationDirection =
  | 'zh-ru'
  | 'zh-en'
  | 'en-ru'
  | 'ru-zh'
  | 'ru-en'
  | 'en-zh';

export interface UserPrefs {
  learningLanguage: LearningLanguage;
  /** Родной язык (глоссы / перевод) */
  nativeLanguage: NativeLanguage;
  /** Язык интерфейса — зеркало nativeLanguage для старого UI */
  interfaceLanguage: InterfaceLanguage;
  /** Направление перевода — вычисляется из пары, хранится для legacy */
  translationDirection: TranslationDirection;
  onboardingCompleted: boolean;
  tourCompleted: boolean;
}

const DEFAULT_PREFS: UserPrefs = {
  learningLanguage: DEFAULT_LEARNING_LANGUAGE,
  nativeLanguage: DEFAULT_NATIVE_LANGUAGE,
  interfaceLanguage: DEFAULT_NATIVE_LANGUAGE,
  translationDirection: 'zh-ru',
  onboardingCompleted: false,
  tourCompleted: false,
};

function pairToDirection(
  learning: LearningLanguage,
  native: NativeLanguage
): TranslationDirection {
  const pair = learningToNativePair(learning, native);
  const key = `${pair.from}-${pair.to === 'zh' ? 'zh' : pair.to}` as TranslationDirection;
  return key;
}

function directionToNative(
  direction: TranslationDirection | undefined,
  learning: LearningLanguage
): NativeLanguage {
  if (!direction) return DEFAULT_NATIVE_LANGUAGE;
  const to = direction.split('-')[1];
  if (to === 'zh' || to === 'ru' || to === 'en') return to;
  return DEFAULT_NATIVE_LANGUAGE;
}

async function loadPrefs(): Promise<UserPrefs> {
  try {
    const raw = await AsyncStorage.getItem(PREFS_KEY);
    if (!raw) return { ...DEFAULT_PREFS };
    const parsed = JSON.parse(raw) as Partial<UserPrefs>;
    const learningLanguage = normalizeLearningLanguage(
      parsed.learningLanguage,
      DEFAULT_LEARNING_LANGUAGE
    );
    const nativeLanguage = normalizeNativeLanguage(
      parsed.nativeLanguage ??
        (parsed.interfaceLanguage === 'en' ||
        parsed.interfaceLanguage === 'ru' ||
        parsed.interfaceLanguage === 'zh'
          ? parsed.interfaceLanguage
          : directionToNative(parsed.translationDirection, learningLanguage)),
      DEFAULT_NATIVE_LANGUAGE
    );
    const interfaceLanguage: InterfaceLanguage =
      parsed.interfaceLanguage === 'ru' ||
      parsed.interfaceLanguage === 'zh' ||
      parsed.interfaceLanguage === 'en'
        ? parsed.interfaceLanguage
        : nativeLanguage;
    const translationDirection =
      parsed.translationDirection &&
      /^(zh|ru|en)-(zh|ru|en)$/.test(parsed.translationDirection)
        ? (parsed.translationDirection as TranslationDirection)
        : pairToDirection(learningLanguage, nativeLanguage);
    return {
      learningLanguage,
      nativeLanguage,
      interfaceLanguage,
      translationDirection,
      onboardingCompleted: Boolean(parsed.onboardingCompleted),
      tourCompleted: Boolean(parsed.tourCompleted),
    };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

async function savePrefs(prefs: UserPrefs): Promise<void> {
  await AsyncStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
}

function queueSync(): void {
  void import('./cloudSyncService')
    .then((m) => m.scheduleSyncDebounced())
    .catch(() => undefined);
}

export async function getUserPrefs(): Promise<UserPrefs> {
  return loadPrefs();
}

export async function getLearningLanguage(): Promise<LearningLanguage> {
  const prefs = await loadPrefs();
  return prefs.learningLanguage ?? DEFAULT_LEARNING_LANGUAGE;
}

export async function getNativeLanguage(): Promise<NativeLanguage> {
  const prefs = await loadPrefs();
  return prefs.nativeLanguage ?? DEFAULT_NATIVE_LANGUAGE;
}

export async function setLearningLanguage(
  language: LearningLanguage,
  opts?: { sync?: boolean }
): Promise<void> {
  const prefs = await loadPrefs();
  const learning = normalizeLearningLanguage(language);
  await savePrefs({
    ...prefs,
    learningLanguage: learning,
    translationDirection: pairToDirection(learning, prefs.nativeLanguage),
  });
  // Зеркало в Zustand
  try {
    const { useAppStore } = await import('../store/useAppStore');
    useAppStore.setState({
      learningLanguage: learning,
    });
  } catch {
    /* ignore */
  }
  if (opts?.sync !== false) queueSync();
}

export async function setNativeLanguage(
  language: NativeLanguage,
  opts?: { sync?: boolean }
): Promise<void> {
  const prefs = await loadPrefs();
  const native = normalizeNativeLanguage(language);
  await savePrefs({
    ...prefs,
    nativeLanguage: native,
    interfaceLanguage: native,
    translationDirection: pairToDirection(prefs.learningLanguage, native),
  });
  try {
    const { useAppStore } = await import('../store/useAppStore');
    useAppStore.setState({ nativeLanguage: native });
  } catch {
    /* ignore */
  }
  if (opts?.sync !== false) queueSync();
}

/** Запись пары из Zustand без обратной записи в store. */
export async function syncLanguagePairFromStore(
  learning: LearningLanguage,
  native: NativeLanguage,
  opts?: { sync?: boolean }
): Promise<void> {
  const prefs = await loadPrefs();
  const learningNorm = normalizeLearningLanguage(learning);
  const nativeNorm = normalizeNativeLanguage(native);
  await savePrefs({
    ...prefs,
    learningLanguage: learningNorm,
    nativeLanguage: nativeNorm,
    interfaceLanguage: nativeNorm,
    translationDirection: pairToDirection(learningNorm, nativeNorm),
  });
  if (opts?.sync !== false) queueSync();
}

export async function getInterfaceLanguage(): Promise<InterfaceLanguage> {
  const prefs = await loadPrefs();
  return prefs.interfaceLanguage;
}

export async function setInterfaceLanguage(
  language: InterfaceLanguage,
  opts?: { sync?: boolean }
): Promise<void> {
  await setNativeLanguage(normalizeNativeLanguage(language), opts);
}

export async function getTranslationDirection(): Promise<TranslationDirection> {
  const prefs = await loadPrefs();
  return prefs.translationDirection;
}

export async function setTranslationDirection(
  direction: TranslationDirection,
  opts?: { sync?: boolean }
): Promise<void> {
  const prefs = await loadPrefs();
  const learning = prefs.learningLanguage;
  const native = directionToNative(direction, learning);
  await savePrefs({
    ...prefs,
    nativeLanguage: native,
    translationDirection: pairToDirection(learning, native),
  });
  try {
    const { useAppStore } = await import('../store/useAppStore');
    useAppStore.setState({ nativeLanguage: native });
  } catch {
    /* ignore */
  }
  if (opts?.sync !== false) queueSync();
}

export function describeLanguagePair(
  learning: LearningLanguage,
  native: NativeLanguage
): string {
  return directionLabel(learning, native);
}

export async function isTourCompleted(): Promise<boolean> {
  const prefs = await loadPrefs();
  return prefs.tourCompleted;
}

export async function hasCompletedOnboarding(): Promise<boolean> {
  return isTourCompleted();
}

export async function applyHasCompletedOnboardingFromCloud(
  completed: boolean
): Promise<void> {
  const prefs = await loadPrefs();
  if (prefs.tourCompleted === completed) return;
  await savePrefs({ ...prefs, tourCompleted: completed });
}

export async function markTourCompleted(): Promise<void> {
  const prefs = await loadPrefs();
  await savePrefs({ ...prefs, tourCompleted: true });
  try {
    const { markHasCompletedOnboarding } = await import('./cloudSyncService');
    await markHasCompletedOnboarding();
  } catch (err) {
    console.warn('[onboarding] не удалось сохранить hasCompletedOnboarding:', err);
  }
}

export async function seedOnboardingContent(): Promise<{
  bookSeeded: boolean;
  cardsSeeded: number;
}> {
  const prefs = await loadPrefs();
  await savePrefs({
    ...prefs,
    onboardingCompleted: true,
    tourCompleted: false,
  });
  return { bookSeeded: false, cardsSeeded: 0 };
}

export async function ensureGuestOnboarding(): Promise<void> {
  const prefs = await loadPrefs();
  if (!prefs.onboardingCompleted) {
    await savePrefs({
      ...prefs,
      onboardingCompleted: true,
      tourCompleted: true,
    });
  }
}

/** Гидрация Zustand из AsyncStorage prefs при старте. */
export async function hydrateStoreLanguagesFromPrefs(): Promise<void> {
  const prefs = await loadPrefs();
  try {
    const { useAppStore } = await import('../store/useAppStore');
    useAppStore.setState({
      learningLanguage: prefs.learningLanguage,
      nativeLanguage: prefs.nativeLanguage,
    });
  } catch {
    /* ignore */
  }
}
