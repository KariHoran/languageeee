import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import HskAnalysisView from '../components/HskAnalysisView';
import { useI18n } from '../i18n/useI18n';
import type { UiMessageKey } from '../i18n/uiMessages';
import {
  analyzeAndTranslateEnglish,
  analyzeEnglishText,
  type EnglishAnalysisResult,
} from '../services/englishAnalysisService';
import {
  analyzeText,
  buildBookFromAnalysis,
  normalizeForHskAnalysis,
} from '../services/hskLocalService';
import {
  getLearningLanguage,
  setLearningLanguage,
} from '../services/onboardingService';
import { getCollections, saveBook, saveCollection } from '../services/storageService';
import {
  isLikelyLanguage,
  translateBetweenLanguages,
} from '../services/translationService';
import {
  COLLECTION_COLORS,
  DEFAULT_COLLECTION_COLOR,
} from '../constants/colors';
import {
  Book,
  Collection,
  HskAnalysisResult,
  LEARNING_LANGUAGE_OPTIONS,
  LearningLanguage,
  NativeLanguage,
  TargetHskLevel,
} from '../types';
import { showAlert } from '../utils/alert';
import { pickTextFile } from '../utils/pickTextFile';
import { sanitizeUserText } from '../utils/sanitizeUserText';
import { useTheme } from '../theme/ThemeContext';
import { useAppStore } from '../store/useAppStore';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const IS_TABLET = SCREEN_WIDTH >= 768;

const HSK_LEVELS: TargetHskLevel[] = [1, 2, 3, 4, 5, 6];

type BusyKind = 'translate' | 'analyze' | 'save' | null;

interface AddBookScreenProps {
  initialCollectionId?: string;
  initialText?: string;
  initialTitle?: string;
  onBookCreated: (book: Book) => void;
  onBack: () => void;
}

function langLabelKey(lang: NativeLanguage | LearningLanguage): UiMessageKey {
  if (lang === 'zh') return 'catalog.lang.zh';
  if (lang === 'en') return 'catalog.lang.en';
  return 'catalog.lang.ru';
}

export default function AddBookScreen({
  initialCollectionId,
  initialText,
  initialTitle,
  onBookCreated,
  onBack,
}: AddBookScreenProps) {
  const theme = useTheme();
  const { t } = useI18n();
  const toggleMidnight = useAppStore((s) => s.toggleMidnightMode);
  const midnightMode = useAppStore((s) => s.midnightMode);
  const nativeLanguage = useAppStore((s) => s.nativeLanguage);
  const [title, setTitle] = useState(initialTitle?.trim() || '');
  const [text, setText] = useState(initialText ?? '');
  const [sourceLanguage, setSourceLanguage] = useState<LearningLanguage>('zh');
  const [targetHskLevel, setTargetHskLevel] = useState<TargetHskLevel>(2);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | undefined>(
    initialCollectionId
  );
  const [isLoading, setIsLoading] = useState(false);
  const [busyKind, setBusyKind] = useState<BusyKind>(null);
  const [loadingLabel, setLoadingLabel] = useState('');
  const [analysis, setAnalysis] = useState<HskAnalysisResult | null>(null);
  const [enAnalysis, setEnAnalysis] = useState<EnglishAnalysisResult | null>(null);
  const [showNewCollection, setShowNewCollection] = useState(false);
  const [newCollectionTitle, setNewCollectionTitle] = useState('');
  const [newCollectionColor, setNewCollectionColor] = useState(DEFAULT_COLLECTION_COLOR);
  /** Параллельный (родной) текст — legacy-поле originalRussianText */
  const [originalRussianText, setOriginalRussianText] = useState<string | undefined>();

  const isEnglish = sourceLanguage === 'en';
  const isRussian = sourceLanguage === 'ru';
  const isChinese = sourceLanguage === 'zh';
  const showTranslateButton = sourceLanguage !== nativeLanguage;

  const nativeName = t(langLabelKey(nativeLanguage));
  const sourceName = t(langLabelKey(sourceLanguage));

  const clearAnalysis = () => {
    setAnalysis(null);
    setEnAnalysis(null);
  };

  const loadCollections = useCallback(async () => {
    const cols = await getCollections();
    setCollections(cols);
    setSelectedCollectionId((current) => {
      if (current) return current;
      return cols.find((c) => c.id === 'col-uncategorized')?.id ?? cols[0]?.id;
    });
  }, []);

  useEffect(() => {
    loadCollections();
  }, [loadCollections]);

  useEffect(() => {
    void getLearningLanguage().then((lang) => setSourceLanguage(lang));
  }, []);

  const handleSelectSourceLanguage = async (lang: LearningLanguage) => {
    setSourceLanguage(lang);
    clearAnalysis();
    setOriginalRussianText(undefined);
    await setLearningLanguage(lang);
  };

  const handlePickFile = async () => {
    const content = await pickTextFile();
    if (content) {
      setText(sanitizeUserText(content));
      clearAnalysis();
      setOriginalRussianText(undefined);
      if (!title.trim()) {
        setTitle(t('addBook.defaultTitle'));
      }
    }
  };

  const handleCreateCollection = async () => {
    const trimmed = newCollectionTitle.trim();
    if (!trimmed) {
      showAlert(t('addBook.alert.error'), t('addBook.alert.enterCollection'));
      return;
    }

    const collection: Collection = {
      id: `col-${Date.now()}`,
      title: trimmed,
      color: newCollectionColor,
    };
    await saveCollection(collection);
    await loadCollections();
    setSelectedCollectionId(collection.id);
    setNewCollectionTitle('');
    setShowNewCollection(false);
  };

  /** Родной текст → язык контента (learning / sourceLanguage). */
  const handleTranslateFromNative = async () => {
    if (isLoading) return;

    if (nativeLanguage === sourceLanguage) {
      showAlert(
        t('addBook.alert.attention'),
        t('addBook.alert.unsupportedPair', {
          from: nativeName,
          to: sourceName,
        })
      );
      return;
    }

    const trimmedText = text.trim();
    if (!trimmedText) {
      showAlert(
        t('addBook.alert.attention'),
        t('addBook.alert.pasteForTranslate', { lang: nativeName })
      );
      return;
    }
    if (!isLikelyLanguage(trimmedText, nativeLanguage)) {
      showAlert(
        t('addBook.alert.attention'),
        t('addBook.alert.notLikely', { lang: nativeName })
      );
      return;
    }

    setIsLoading(true);
    setBusyKind('translate');
    setLoadingLabel(t('addBook.loading.translatePrep'));
    clearAnalysis();

    try {
      const translated = await translateBetweenLanguages(
        trimmedText,
        nativeLanguage,
        sourceLanguage,
        (progress) => {
          setLoadingLabel(progress.label);
        }
      );

      setOriginalRussianText(trimmedText);
      if (isEnglish) {
        setText(translated);
        setLoadingLabel(t('addBook.loading.analyzeEn'));
        const tokens = analyzeEnglishText(translated);
        setEnAnalysis({
          ...tokens,
          russianText: trimmedText,
          translationOk: true,
        });
      } else if (isChinese) {
        const chineseText = normalizeForHskAnalysis(translated);
        setText(chineseText);
        setLoadingLabel(t('addBook.loading.analyzeHsk'));
        setAnalysis(analyzeText(chineseText, targetHskLevel));
      } else {
        setText(translated);
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : t('addBook.unknownError');
      console.error('[AddBook] translate from native failed:', err);
      if (/не поддерживается|not supported/i.test(message)) {
        showAlert(
          t('addBook.alert.translateError'),
          t('addBook.alert.unsupportedPair', {
            from: nativeName,
            to: sourceName,
          })
        );
      } else {
        showAlert(t('addBook.alert.translateError'), message);
      }
    } finally {
      setIsLoading(false);
      setBusyKind(null);
      setLoadingLabel('');
    }
  };

  const handleSubmit = async () => {
    if (isLoading) return;

    const trimmedTitle = title.trim();
    const trimmedText = text.trim();

    if (!trimmedTitle) {
      showAlert(t('addBook.alert.attention'), t('addBook.alert.enterTitle'));
      return;
    }
    if (!trimmedText) {
      showAlert(t('addBook.alert.attention'), t('addBook.alert.enterText'));
      return;
    }

    setIsLoading(true);
    setBusyKind('analyze');
    try {
      if (isEnglish) {
        setLoadingLabel(t('addBook.loading.analyzeEn'));
        console.log('[AddBook] EN analyze start');
        const existingNative = originalRussianText?.trim();
        if (existingNative) {
          const tokens = analyzeEnglishText(trimmedText);
          setEnAnalysis({
            ...tokens,
            russianText: existingNative,
            translationOk: true,
          });
          setAnalysis(null);
        } else if (nativeLanguage === 'ru') {
          const result = await analyzeAndTranslateEnglish(
            trimmedText,
            (progress) => setLoadingLabel(progress.label)
          );
          setEnAnalysis(result);
          setAnalysis(null);
          if (result.russianText.trim()) {
            setOriginalRussianText(result.russianText);
          }
          if (!result.translationOk) {
            showAlert(
              t('addBook.alert.parallelTitle'),
              result.translationError ?? t('addBook.alert.parallelBody')
            );
          }
        } else {
          const tokens = analyzeEnglishText(trimmedText);
          setEnAnalysis({
            ...tokens,
            russianText: '',
            translationOk: false,
          });
          setAnalysis(null);
        }
        console.log('[AddBook] EN analyze done');
      } else if (isRussian) {
        setLoadingLabel(t('addBook.loading.prepareContent'));
        setAnalysis(null);
        setEnAnalysis(null);
        const parallel =
          nativeLanguage === 'ru'
            ? trimmedText
            : originalRussianText?.trim() || undefined;
        const book = buildBookFromAnalysis(
          trimmedTitle,
          trimmedText,
          targetHskLevel,
          {
            collectionId: selectedCollectionId,
            originalRussianText: parallel,
            language: sourceLanguage,
          }
        );
        await saveBook(book);
        await setLearningLanguage(sourceLanguage);
        onBookCreated(book);
      } else {
        setLoadingLabel(t('addBook.loading.analyzeHsk'));
        const normalized = normalizeForHskAnalysis(trimmedText);
        if (normalized !== trimmedText) {
          setText(normalized);
        }
        setAnalysis(analyzeText(normalized, targetHskLevel));
        setEnAnalysis(null);
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : t('addBook.unknownError');
      console.error('[AddBook] analyze failed:', err);
      showAlert(t('addBook.alert.analyzeError'), message);
    } finally {
      setIsLoading(false);
      setBusyKind(null);
      setLoadingLabel('');
    }
  };

  const handleSaveAndRead = async () => {
    const trimmedTitle = title.trim();
    const trimmedText = text.trim();
    if (!trimmedTitle || !trimmedText) return;

    setIsLoading(true);
    setBusyKind('save');
    try {
      let parallelSource =
        originalRussianText?.trim() || enAnalysis?.russianText?.trim();

      // Нет параллели — переводим learning → native (поле originalRussianText legacy)
      if (
        isEnglish &&
        !parallelSource &&
        nativeLanguage !== 'en'
      ) {
        setLoadingLabel(t('addBook.loading.translateParallel'));
        console.log('[AddBook] EN save → translate to native', nativeLanguage);
        try {
          parallelSource = await translateBetweenLanguages(
            trimmedText,
            'en',
            nativeLanguage,
            (progress) => {
              setLoadingLabel(progress.label);
            }
          );
          if (parallelSource?.includes('[Перевод временно недоступен')) {
            console.warn('[AddBook] EN save translation fallback marker');
            showAlert(
              t('addBook.alert.translateUnavailableTitle'),
              t('addBook.alert.translateUnavailableSave')
            );
            parallelSource = undefined;
          }
        } catch (err) {
          console.error('[AddBook] EN save translate failed:', err);
          showAlert(
            t('addBook.alert.translateUnavailableTitle'),
            err instanceof Error
              ? err.message
              : t('addBook.alert.translateUnavailableRetry')
          );
          parallelSource = undefined;
        }
      }

      const book = buildBookFromAnalysis(trimmedTitle, trimmedText, targetHskLevel, {
        collectionId: selectedCollectionId,
        originalRussianText: parallelSource,
        language: sourceLanguage,
      });
      await saveBook(book);
      await setLearningLanguage(sourceLanguage);
      onBookCreated(book);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : t('addBook.unknownError');
      console.error('[AddBook] save failed:', err);
      showAlert(t('addBook.alert.saveError'), message);
    } finally {
      setIsLoading(false);
      setBusyKind(null);
      setLoadingLabel('');
    }
  };

  const subtitleKey: UiMessageKey = isEnglish
    ? 'addBook.screenSubtitle.en'
    : isRussian
      ? 'addBook.screenSubtitle.ru'
      : 'addBook.screenSubtitle.zh';

  const placeholderKey: UiMessageKey = isEnglish
    ? 'addBook.placeholder.en'
    : isRussian
      ? 'addBook.placeholder.ru'
      : 'addBook.placeholder.zh';

  const primaryActionLabel = isEnglish
    ? t('addBook.analyzeEn')
    : isRussian
      ? t('addBook.saveLangText', { lang: sourceName })
      : t('addBook.analyzeText');

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]} edges={['top', 'bottom']}>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, IS_TABLET && styles.scrollContentTablet]}
        keyboardShouldPersistTaps="always"
      >
        <View style={styles.topRow}>
          <Pressable
            onPress={onBack}
            style={[
              styles.backButton,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}
            accessibilityLabel={t('addBook.a11y.back')}
          >
            <Text style={[styles.backButtonText, { color: theme.accentViolet }]}>←</Text>
          </Pressable>
          <Pressable
            onPress={toggleMidnight}
            style={[
              styles.themeToggle,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}
            accessibilityLabel={t('addBook.a11y.theme')}
          >
            <Text style={[styles.themeToggleText, { color: theme.accentViolet }]}>
              {midnightMode ? '☀️' : '🌙'}
            </Text>
          </Pressable>
        </View>

        <Text style={[styles.screenTitle, { color: theme.accentViolet }]}>
          {t('addBook.title')}
        </Text>
        <Text style={[styles.screenSubtitle, { color: theme.textMuted }]}>
          {t(subtitleKey)}
        </Text>

        <Text style={[styles.label, { color: theme.accentViolet }]}>
          {t('addBook.sourceLang')}
        </Text>
        <View style={styles.langSelector}>
          {LEARNING_LANGUAGE_OPTIONS.map((opt) => {
            const active = sourceLanguage === opt.id;
            return (
              <Pressable
                key={opt.id}
                style={[
                  styles.langOption,
                  {
                    backgroundColor: theme.surface,
                    borderColor: theme.border,
                  },
                  active && {
                    backgroundColor: theme.accentLime,
                    borderColor: theme.accentLime,
                  },
                ]}
                onPress={() => void handleSelectSourceLanguage(opt.id)}
                disabled={isLoading}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
              >
                <Text
                  style={[
                    styles.langOptionText,
                    { color: theme.text },
                    active && { color: theme.bg, fontWeight: '700' },
                  ]}
                >
                  {opt.emoji} {opt.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={[styles.label, { color: theme.accentViolet }]}>
          {t('addBook.fanficTitle')}
        </Text>
        <TextInput
          style={[
            styles.input,
            {
              backgroundColor: theme.surface,
              borderColor: theme.border,
              color: theme.text,
            },
          ]}
          value={title}
          onChangeText={(v) => {
            setTitle(v);
            clearAnalysis();
          }}
          placeholder={t('addBook.titlePlaceholder')}
          placeholderTextColor={theme.textDim}
          editable={!isLoading}
        />

        <View style={styles.textAreaHeader}>
          <Text style={[styles.label, { color: theme.accentViolet }]}>
            {t('addBook.fanficText')}
          </Text>
          <Pressable onPress={handlePickFile} disabled={isLoading}>
            <Text style={[styles.fileButton, { color: theme.accentLime }]}>
              {t('addBook.uploadTxt')}
            </Text>
          </Pressable>
        </View>
        <TextInput
          style={[
            styles.textArea,
            {
              backgroundColor: theme.surface,
              borderColor: theme.border,
              color: theme.text,
            },
          ]}
          value={text}
          onChangeText={(v) => {
            setText(v);
            clearAnalysis();
            if (isLikelyLanguage(v, nativeLanguage)) {
              setOriginalRussianText(undefined);
            }
          }}
          placeholder={t(placeholderKey)}
          placeholderTextColor={theme.textDim}
          multiline
          textAlignVertical="top"
          editable={!isLoading}
        />

        {showTranslateButton ? (
          <TouchableOpacity
            style={[
              styles.translateButton,
              { backgroundColor: theme.surface, borderColor: theme.accentViolet },
              isLoading && styles.generateButtonDisabled,
            ]}
            onPress={() => void handleTranslateFromNative()}
            disabled={isLoading}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={t('addBook.a11y.translate')}
          >
            {isLoading && busyKind === 'translate' ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator color={theme.accentViolet} />
                <Text style={[styles.translateProgressText, { color: theme.accentViolet }]}>
                  {loadingLabel}
                </Text>
              </View>
            ) : (
              <Text style={[styles.translateButtonText, { color: theme.accentViolet }]}>
                {t('addBook.translateFromTo', {
                  from: nativeName,
                  to: sourceName,
                })}
              </Text>
            )}
          </TouchableOpacity>
        ) : null}

        {!isEnglish && !isRussian ? (
          <>
            <Text style={[styles.label, { color: theme.accentViolet }]}>
              {t('addBook.hskLevel')}
            </Text>
            <View style={styles.hskSelector}>
              {HSK_LEVELS.map((level) => (
                <Pressable
                  key={level}
                  style={[
                    styles.hskOption,
                    {
                      backgroundColor: theme.surface,
                      borderColor: theme.border,
                    },
                    targetHskLevel === level && {
                      backgroundColor: theme.accentLime,
                      borderColor: theme.accentLime,
                    },
                  ]}
                  onPress={() => {
                    setTargetHskLevel(level);
                    clearAnalysis();
                  }}
                  disabled={isLoading}
                >
                  <Text
                    style={[
                      styles.hskOptionText,
                      { color: theme.text },
                      targetHskLevel === level && { color: theme.bg },
                    ]}
                  >
                    {level}
                  </Text>
                </Pressable>
              ))}
            </View>
          </>
        ) : null}

        <Text style={[styles.label, { color: theme.accentViolet }]}>
          {t('addBook.collection')}
        </Text>
        <View style={styles.collectionSelector}>
          {collections.map((col) => (
            <Pressable
              key={col.id}
              style={[
                styles.collectionOption,
                {
                  backgroundColor: theme.surface,
                  borderColor: theme.border,
                },
                selectedCollectionId === col.id && {
                  borderColor: theme.accentViolet,
                },
                { borderLeftColor: col.color ?? '#6b7280' },
              ]}
              onPress={() => setSelectedCollectionId(col.id)}
              disabled={isLoading}
            >
              <Text
                style={[
                  styles.collectionOptionText,
                  { color: theme.text },
                  selectedCollectionId === col.id && {
                    color: theme.accentViolet,
                    fontWeight: '600',
                  },
                ]}
              >
                {col.title}
              </Text>
            </Pressable>
          ))}
          <Pressable
            style={styles.newCollectionButton}
            onPress={() => setShowNewCollection(true)}
            disabled={isLoading}
          >
            <Text style={[styles.newCollectionButtonText, { color: theme.accentLime }]}>
              {t('addBook.createCollection')}
            </Text>
          </Pressable>
        </View>

        <TouchableOpacity
          style={[
            styles.generateButton,
            { backgroundColor: theme.accentLime },
            isLoading && styles.generateButtonDisabled,
          ]}
          onPress={() => void handleSubmit()}
          disabled={isLoading}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={t('addBook.a11y.analyze')}
        >
          {isLoading && busyKind === 'analyze' ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator color={theme.bg} />
              <Text style={[styles.generateButtonText, { color: theme.bg }]}>
                {loadingLabel}
              </Text>
            </View>
          ) : (
            <Text style={[styles.generateButtonText, { color: theme.bg }]}>
              {primaryActionLabel}
            </Text>
          )}
        </TouchableOpacity>

        {analysis && isChinese ? (
          <>
            <HskAnalysisView analysis={analysis} />
            <TouchableOpacity
              style={[
                styles.saveButton,
                { backgroundColor: theme.accentViolet },
                isLoading && styles.generateButtonDisabled,
              ]}
              onPress={() => void handleSaveAndRead()}
              disabled={isLoading}
              activeOpacity={0.7}
            >
              {isLoading && busyKind === 'save' ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.saveButtonText}>{t('addBook.saveAndRead')}</Text>
              )}
            </TouchableOpacity>
          </>
        ) : null}

        {enAnalysis && isEnglish ? (
          <>
            <View
              style={[
                styles.enPreview,
                { backgroundColor: theme.surface, borderColor: theme.border },
              ]}
            >
              <Text style={[styles.enPreviewTitle, { color: theme.accentPink }]}>
                {t('addBook.enPreviewTitle', { n: enAnalysis.uniqueCount })}
              </Text>
              <Text style={[styles.enPreviewMeta, { color: theme.textMuted }]}>
                {t('addBook.enPreviewMeta', { n: enAnalysis.tokenCount })}
              </Text>
              {enAnalysis.russianText ? (
                <View
                  style={[
                    styles.enRuBox,
                    { backgroundColor: theme.bgAlt, borderColor: theme.border },
                  ]}
                >
                  <Text style={[styles.enRuLabel, { color: theme.accentPink }]}>
                    {t('addBook.parallelLabel', { lang: nativeName })}
                  </Text>
                  <Text style={[styles.enRuText, { color: theme.text }]}>
                    {enAnalysis.russianText.slice(0, 600)}
                    {enAnalysis.russianText.length > 600 ? '…' : ''}
                  </Text>
                </View>
              ) : (
                <Text style={[styles.enPreviewMeta, { color: theme.textDim }]}>
                  {enAnalysis.translationError
                    ? t('addBook.parallelError', {
                        error: enAnalysis.translationError,
                      })
                    : t('addBook.parallelEmpty')}
                </Text>
              )}
              <View style={styles.enWordWrap}>
                {enAnalysis.words.slice(0, 48).map((w) => (
                  <View
                    key={w.key}
                    style={[
                      styles.enWordChip,
                      { backgroundColor: theme.bgAlt, borderColor: theme.border },
                    ]}
                  >
                    <Text style={[styles.enWordChipText, { color: theme.text }]}>
                      {w.text}
                    </Text>
                  </View>
                ))}
              </View>
              {enAnalysis.words.length > 48 ? (
                <Text style={[styles.enPreviewMeta, { color: theme.textDim }]}>
                  {t('addBook.moreItems', {
                    n: enAnalysis.words.length - 48,
                  })}
                </Text>
              ) : null}
              {enAnalysis.grammar && enAnalysis.grammar.length > 0 ? (
                <View style={styles.enGrammarSection}>
                  <Text style={[styles.enGrammarTitle, { color: theme.accentViolet }]}>
                    {t('addBook.grammarTitle', {
                      n: enAnalysis.grammar.length,
                    })}
                  </Text>
                  {enAnalysis.grammar.slice(0, 12).map((g, i) => (
                    <View
                      key={`${g.structure}-${i}`}
                      style={[
                        styles.enGrammarCard,
                        {
                          backgroundColor: theme.bgAlt,
                          borderColor: theme.border,
                        },
                      ]}
                    >
                      <Text style={[styles.enGrammarStructure, { color: theme.accentLime }]}>
                        {g.structure}
                      </Text>
                      <Text style={[styles.enGrammarExplanation, { color: theme.textMuted }]}>
                        {g.explanation}
                      </Text>
                      {g.example ? (
                        <Text style={[styles.enGrammarExample, { color: theme.textDim }]}>
                          {g.example}
                        </Text>
                      ) : null}
                    </View>
                  ))}
                  {enAnalysis.grammar.length > 12 ? (
                    <Text style={[styles.enPreviewMeta, { color: theme.textDim }]}>
                      {t('addBook.moreItems', {
                        n: enAnalysis.grammar.length - 12,
                      })}
                    </Text>
                  ) : null}
                </View>
              ) : null}
            </View>
            <TouchableOpacity
              style={[
                styles.saveButton,
                { backgroundColor: theme.accentViolet },
                isLoading && styles.generateButtonDisabled,
              ]}
              onPress={() => void handleSaveAndRead()}
              disabled={isLoading}
              activeOpacity={0.7}
            >
              {isLoading && busyKind === 'save' ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.saveButtonText}>{t('addBook.saveAndRead')}</Text>
              )}
            </TouchableOpacity>
          </>
        ) : null}
      </ScrollView>

      <Modal visible={showNewCollection} transparent animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => setShowNewCollection(false)}>
          <Pressable
            style={[
              styles.modalContent,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={[styles.modalTitle, { color: theme.accentViolet }]}>
              {t('addBook.newCollection')}
            </Text>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: theme.bg,
                  borderColor: theme.border,
                  color: theme.text,
                },
              ]}
              value={newCollectionTitle}
              onChangeText={setNewCollectionTitle}
              placeholder={t('addBook.collectionNamePlaceholder')}
              placeholderTextColor={theme.textDim}
              autoFocus
            />
            <Text style={[styles.colorLabel, { color: theme.accentViolet }]}>
              {t('addBook.color')}
            </Text>
            <View style={styles.colorRow}>
              {COLLECTION_COLORS.map((color) => (
                <Pressable
                  key={color}
                  style={[
                    styles.colorSwatch,
                    { backgroundColor: color },
                    newCollectionColor === color && {
                      borderColor: theme.accentLime,
                    },
                  ]}
                  onPress={() => setNewCollectionColor(color)}
                />
              ))}
            </View>
            <Pressable
              style={[styles.modalButton, { backgroundColor: theme.accentLime }]}
              onPress={() => void handleCreateCollection()}
            >
              <Text style={[styles.modalButtonText, { color: theme.bg }]}>
                {t('addBook.create')}
              </Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0D0D11',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  scrollContentTablet: {
    maxWidth: 720,
    alignSelf: 'center',
    width: '100%',
    paddingHorizontal: 40,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButtonText: {
    fontSize: 18,
    fontWeight: '700',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  themeToggle: {
    width: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  themeToggleText: {
    fontSize: 18,
  },
  screenTitle: {
    fontSize: IS_TABLET ? 28 : 24,
    fontWeight: '700',
    color: '#8B5CF6',
    marginBottom: 6,
  },
  screenSubtitle: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.55)',
    marginBottom: 28,
    lineHeight: 22,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8B5CF6',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#1E1E28',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#ffffff',
    borderWidth: 1,
    borderColor: '#2A2A3A',
    marginBottom: 20,
  },
  textAreaHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  fileButton: {
    fontSize: 14,
    color: '#D0FF00',
    fontWeight: '700',
  },
  textArea: {
    backgroundColor: '#1E1E28',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#ffffff',
    borderWidth: 1,
    borderColor: '#2A2A3A',
    minHeight: 200,
    marginBottom: 12,
    lineHeight: 24,
  },
  translateButton: {
    backgroundColor: '#16161E',
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    minHeight: 52,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#8B5CF6',
    marginBottom: 24,
  },
  translateButtonText: {
    color: '#8B5CF6',
    fontSize: 16,
    fontWeight: '700',
  },
  translateProgressText: {
    color: '#8B5CF6',
    fontSize: 14,
    fontWeight: '600',
    flexShrink: 1,
  },
  hskSelector: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 24,
  },
  langSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 24,
  },
  langOption: {
    flexGrow: 1,
    flexBasis: '45%',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 12,
    alignItems: 'center',
    borderWidth: 1,
  },
  langOptionText: {
    fontSize: 14,
    fontWeight: '600',
  },
  enPreview: {
    marginTop: 20,
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
  },
  enPreviewTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6,
  },
  enPreviewMeta: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 12,
  },
  enRuBox: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    marginBottom: 12,
  },
  enRuLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  enRuText: {
    fontSize: 14,
    lineHeight: 20,
  },
  enWordWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  enWordChip: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  enWordChipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  enGrammarSection: {
    marginTop: 16,
    gap: 8,
  },
  enGrammarTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 4,
  },
  enGrammarCard: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  enGrammarStructure: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 4,
  },
  enGrammarExplanation: {
    fontSize: 12,
    lineHeight: 17,
  },
  enGrammarExample: {
    fontSize: 11,
    fontStyle: 'italic',
    marginTop: 4,
    lineHeight: 15,
  },
  hskOption: {
    flex: 1,
    backgroundColor: '#1E1E28',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2A2A3A',
  },
  hskOptionText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
  },
  collectionSelector: {
    gap: 8,
    marginBottom: 32,
  },
  collectionOption: {
    backgroundColor: '#1E1E28',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: '#2A2A3A',
    borderLeftWidth: 4,
  },
  collectionOptionText: {
    fontSize: 16,
    color: '#ffffff',
  },
  newCollectionButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  newCollectionButtonText: {
    fontSize: 15,
    color: '#D0FF00',
    fontWeight: '700',
  },
  generateButton: {
    backgroundColor: '#D0FF00',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    minHeight: 56,
    justifyContent: 'center',
  },
  saveButton: {
    backgroundColor: '#8B5CF6',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    minHeight: 56,
    justifyContent: 'center',
    marginTop: 16,
  },
  generateButtonDisabled: {
    opacity: 0.85,
  },
  generateButtonText: {
    color: '#0D0D11',
    fontSize: 17,
    fontWeight: '700',
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '700',
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(13,13,17,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: '#1E1E28',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    borderWidth: 1,
    borderColor: '#2A2A3A',
    overflow: 'hidden',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#8B5CF6',
    marginBottom: 16,
  },
  colorLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8B5CF6',
    marginBottom: 10,
  },
  colorRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 20,
    width: '100%',
    maxWidth: '100%',
  },
  colorSwatch: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  modalButton: {
    backgroundColor: '#D0FF00',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  modalButtonText: {
    color: '#0D0D11',
    fontSize: 16,
    fontWeight: '700',
  },
});
