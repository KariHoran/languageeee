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
  isLikelyRussian,
  translateEnToRu,
  translateRuToEn,
  translateRuToZh,
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

interface AddBookScreenProps {
  initialCollectionId?: string;
  initialText?: string;
  initialTitle?: string;
  onBookCreated: (book: Book) => void;
  onBack: () => void;
}

export default function AddBookScreen({
  initialCollectionId,
  initialText,
  initialTitle,
  onBookCreated,
  onBack,
}: AddBookScreenProps) {
  const theme = useTheme();
  const toggleMidnight = useAppStore((s) => s.toggleMidnightMode);
  const midnightMode = useAppStore((s) => s.midnightMode);
  const [title, setTitle] = useState(initialTitle?.trim() || '');
  const [text, setText] = useState(initialText ?? '');
  const [sourceLanguage, setSourceLanguage] = useState<LearningLanguage>('zh');
  const [targetHskLevel, setTargetHskLevel] = useState<TargetHskLevel>(2);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | undefined>(
    initialCollectionId
  );
  const [isLoading, setIsLoading] = useState(false);
  const [loadingLabel, setLoadingLabel] = useState('');
  const [analysis, setAnalysis] = useState<HskAnalysisResult | null>(null);
  const [enAnalysis, setEnAnalysis] = useState<EnglishAnalysisResult | null>(null);
  const [showNewCollection, setShowNewCollection] = useState(false);
  const [newCollectionTitle, setNewCollectionTitle] = useState('');
  const [newCollectionColor, setNewCollectionColor] = useState(DEFAULT_COLLECTION_COLOR);
  /** Русский оригинал до перевода — сохраняется в книгу как originalRussianText */
  const [originalRussianText, setOriginalRussianText] = useState<string | undefined>();

  const isEnglish = sourceLanguage === 'en';
  const isRussian = sourceLanguage === 'ru';
  const isChinese = sourceLanguage === 'zh';

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
        setTitle('Новый фанфик');
      }
    }
  };

  const handleCreateCollection = async () => {
    const trimmed = newCollectionTitle.trim();
    if (!trimmed) {
      showAlert('Ошибка', 'Введите название подборки.');
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

  const handleTranslateFromRussian = async () => {
    if (isLoading) return;

    const trimmedText = text.trim();
    if (!trimmedText) {
      showAlert('Внимание', 'Вставьте русский текст для перевода.');
      return;
    }
    if (!isLikelyRussian(trimmedText)) {
      showAlert(
        'Внимание',
        isEnglish
          ? 'Текст не похож на русский. Введите русский оригинал или вставьте английский и нажмите «Разобрать».'
          : 'Текст не похож на русский. Введите текст на русском или используйте «Проанализировать текст» для китайского.'
      );
      return;
    }

    setIsLoading(true);
    setLoadingLabel('Переводим: подготовка...');
    clearAnalysis();

    try {
      if (isEnglish) {
        const translated = await translateRuToEn(trimmedText, (progress) => {
          setLoadingLabel(progress.label);
        });
        setOriginalRussianText(trimmedText);
        setText(translated);
        setLoadingLabel('Разбираем английские слова…');
        // Русский уже есть (оригинал) — только токены, без второго сетевого вызова
        const tokens = analyzeEnglishText(translated);
        setEnAnalysis({
          ...tokens,
          russianText: trimmedText,
          translationOk: true,
        });
      } else {
        const translated = await translateRuToZh(trimmedText, (progress) => {
          setLoadingLabel(progress.label);
        });
        const chineseText = normalizeForHskAnalysis(translated);
        setOriginalRussianText(trimmedText);
        setText(chineseText);
        setLoadingLabel('Анализируем текст по словарю HSK...');
        setAnalysis(analyzeText(chineseText, targetHskLevel));
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Неизвестная ошибка';
      console.error('[AddBook] translate from Russian failed:', err);
      showAlert('Ошибка перевода', message);
    } finally {
      setIsLoading(false);
      setLoadingLabel('');
    }
  };

  const handleSubmit = async () => {
    if (isLoading) return;

    const trimmedTitle = title.trim();
    const trimmedText = text.trim();

    if (!trimmedTitle) {
      showAlert('Внимание', 'Введите название фанфика.');
      return;
    }
    if (!trimmedText) {
      showAlert('Внимание', 'Вставьте текст фанфика.');
      return;
    }

    setIsLoading(true);
    try {
      if (isEnglish) {
        // Only tokens + En→Ru. Without pinyin / HSK / OpenCC.
        setLoadingLabel('Разбираем слова…');
        console.log('[AddBook] EN analyze start');
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
            'Перевод на русский',
            result.translationError ??
              'API перевода не ответил вовремя. Разбор слов готов — можно сохранить без перевода или попробовать снова.'
          );
        }
        console.log('[AddBook] EN analyze done', {
          words: result.uniqueCount,
          translationOk: result.translationOk,
        });
      } else if (isRussian) {
        setLoadingLabel('Готовим русский текст…');
        setAnalysis(null);
        setEnAnalysis(null);
        setOriginalRussianText(trimmedText);
      } else {
        setLoadingLabel('Анализируем текст по словарю HSK...');
        const normalized = normalizeForHskAnalysis(trimmedText);
        if (normalized !== trimmedText) {
          setText(normalized);
        }
        setAnalysis(analyzeText(normalized, targetHskLevel));
        setEnAnalysis(null);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Неизвестная ошибка';
      console.error('[AddBook] analyze failed:', err);
      showAlert('Ошибка анализа', message);
    } finally {
      setIsLoading(false);
      setLoadingLabel('');
    }
  };

  const handleSaveAndRead = async () => {
    const trimmedTitle = title.trim();
    const trimmedText = text.trim();
    if (!trimmedTitle || !trimmedText) return;

    setIsLoading(true);
    try {
      let russianSource = originalRussianText?.trim() || enAnalysis?.russianText?.trim();

      // Повторный перевод только если ещё нет русского
      if (isEnglish && !russianSource) {
        setLoadingLabel('Переводим на русский…');
        console.log('[AddBook] EN save → translateEnToRu');
        try {
          russianSource = await translateEnToRu(trimmedText, (progress) => {
            setLoadingLabel(progress.label);
          });
          if (russianSource?.includes('[Перевод временно недоступен')) {
            console.warn('[AddBook] EN save translation fallback marker');
            showAlert(
              'Перевод недоступен',
              'Сохраняем английский текст без русского перевода. Попробуйте перевести позже.'
            );
            russianSource = undefined;
          }
        } catch (err) {
          console.error('[AddBook] EN save translate failed:', err);
          showAlert(
            'Перевод недоступен',
            err instanceof Error
              ? err.message
              : 'Не удалось перевести на русский. Книга сохранится без перевода.'
          );
          russianSource = undefined;
        }
      }

      const book = buildBookFromAnalysis(trimmedTitle, trimmedText, targetHskLevel, {
        collectionId: selectedCollectionId,
        originalRussianText: russianSource,
        language: sourceLanguage,
      });
      await saveBook(book);
      await setLearningLanguage(sourceLanguage);
      onBookCreated(book);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Неизвестная ошибка';
      console.error('[AddBook] save failed:', err);
      showAlert('Ошибка сохранения', message);
    } finally {
      setIsLoading(false);
      setLoadingLabel('');
    }
  };

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
            accessibilityLabel="Назад"
          >
            <Text style={[styles.backButtonText, { color: theme.accentViolet }]}>←</Text>
          </Pressable>
          <Pressable
            onPress={toggleMidnight}
            style={[
              styles.themeToggle,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}
            accessibilityLabel="Переключить тему"
          >
            <Text style={[styles.themeToggleText, { color: theme.accentViolet }]}>
              {midnightMode ? '☀️' : '🌙'}
            </Text>
          </Pressable>
        </View>

        <Text style={[styles.screenTitle, { color: theme.accentViolet }]}>Добавить фанфик</Text>
        <Text style={[styles.screenSubtitle, { color: theme.textMuted }]}>
          {isEnglish
            ? 'Язык: English. Вставьте английский или переведите с русского — слова станут кликабельными, перевод на русский сохранится в книгу.'
            : 'Язык: 中文. Вставьте китайский или переведите с русского — HSK 3.0 подсветит сложные слова и пиньинь.'}
        </Text>

        <Text style={[styles.label, { color: theme.accentViolet }]}>
          Язык исходного текста
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

        <Text style={[styles.label, { color: theme.accentViolet }]}>Название фанфика</Text>
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
          placeholder="Например: Гарри Поттер и Тайная комната"
          placeholderTextColor={theme.textDim}
          editable={!isLoading}
        />

        <View style={styles.textAreaHeader}>
          <Text style={[styles.label, { color: theme.accentViolet }]}>Текст фанфика</Text>
          <Pressable onPress={handlePickFile} disabled={isLoading}>
            <Text style={[styles.fileButton, { color: theme.accentLime }]}>Загрузить .txt</Text>
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
            if (isLikelyRussian(v)) {
              setOriginalRussianText(undefined);
            }
          }}
          placeholder={
            isEnglish
              ? 'Вставьте текст на русском (для перевода) или на английском...'
              : 'Вставьте текст на русском или китайском...'
          }
          placeholderTextColor={theme.textDim}
          multiline
          textAlignVertical="top"
          editable={!isLoading}
        />

        <TouchableOpacity
          style={[
            styles.translateButton,
            { backgroundColor: theme.surface, borderColor: theme.accentViolet },
            isLoading && styles.generateButtonDisabled,
          ]}
          onPress={handleTranslateFromRussian}
          disabled={isLoading}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Перевести с русского"
        >
          {isLoading && (loadingLabel.startsWith('Переводим') || loadingLabel.includes('/')) ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator color={theme.accentViolet} />
              <Text style={[styles.translateProgressText, { color: theme.accentViolet }]}>
                {loadingLabel}
              </Text>
            </View>
          ) : (
            <Text style={[styles.translateButtonText, { color: theme.accentViolet }]}>
              {isEnglish
                ? 'Перевести с русского → English'
                : 'Перевести с русского → 中文'}
            </Text>
          )}
        </TouchableOpacity>

        {!isEnglish && !isRussian ? (
          <>
            <Text style={[styles.label, { color: theme.accentViolet }]}>Целевой уровень HSK</Text>
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

        <Text style={[styles.label, { color: theme.accentViolet }]}>Подборка</Text>
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
              + Создать новую подборку
            </Text>
          </Pressable>
        </View>

        <TouchableOpacity
          style={[
            styles.generateButton,
            { backgroundColor: theme.accentLime },
            isLoading && styles.generateButtonDisabled,
          ]}
          onPress={handleSubmit}
          disabled={isLoading}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Проанализировать текст"
        >
          {isLoading &&
          (loadingLabel.startsWith('Анализируем') ||
            loadingLabel.startsWith('Разбираем')) ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator color={theme.bg} />
              <Text style={[styles.generateButtonText, { color: theme.bg }]}>
                {loadingLabel}
              </Text>
            </View>
          ) : (
            <Text style={[styles.generateButtonText, { color: theme.bg }]}>
              {isEnglish
                ? 'Разобрать английский текст'
                : isRussian
                  ? 'Сохранить русский текст'
                  : 'Проанализировать текст'}
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
              onPress={handleSaveAndRead}
              disabled={isLoading}
              activeOpacity={0.7}
            >
              {isLoading ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.saveButtonText}>Сохранить и начать чтение</Text>
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
                Разбор English · {enAnalysis.uniqueCount} слов
              </Text>
              <Text style={[styles.enPreviewMeta, { color: theme.textMuted }]}>
                Токенов: {enAnalysis.tokenCount}. Пиньинь не используется. language: en.
              </Text>
              {enAnalysis.russianText ? (
                <View
                  style={[
                    styles.enRuBox,
                    { backgroundColor: theme.bgAlt, borderColor: theme.border },
                  ]}
                >
                  <Text style={[styles.enRuLabel, { color: theme.accentPink }]}>
                    Русский перевод
                  </Text>
                  <Text style={[styles.enRuText, { color: theme.text }]}>
                    {enAnalysis.russianText.slice(0, 600)}
                    {enAnalysis.russianText.length > 600 ? '…' : ''}
                  </Text>
                </View>
              ) : (
                <Text style={[styles.enPreviewMeta, { color: theme.textDim }]}>
                  {enAnalysis.translationError
                    ? `Перевод: ${enAnalysis.translationError}`
                    : 'Русский перевод пока пуст — при сохранении попробуем ещё раз.'}
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
                  …и ещё {enAnalysis.words.length - 48}
                </Text>
              ) : null}
              {enAnalysis.grammar && enAnalysis.grammar.length > 0 ? (
                <View style={styles.enGrammarSection}>
                  <Text style={[styles.enGrammarTitle, { color: theme.accentViolet }]}>
                    Грамматика / Конструкции · {enAnalysis.grammar.length}
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
                      …и ещё {enAnalysis.grammar.length - 12} конструкций
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
              onPress={handleSaveAndRead}
              disabled={isLoading}
              activeOpacity={0.7}
            >
              {isLoading ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.saveButtonText}>Сохранить и начать чтение</Text>
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
            <Text style={[styles.modalTitle, { color: theme.accentViolet }]}>Новая подборка</Text>
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
              placeholder="Название подборки"
              placeholderTextColor={theme.textDim}
              autoFocus
            />
            <Text style={[styles.colorLabel, { color: theme.accentViolet }]}>Цвет</Text>
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
              onPress={handleCreateCollection}
            >
              <Text style={[styles.modalButtonText, { color: theme.bg }]}>Создать</Text>
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
  hskOptionActive: {
    backgroundColor: '#D0FF00',
    borderColor: '#D0FF00',
  },
  hskOptionText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
  },
  hskOptionTextActive: {
    color: '#0D0D11',
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
  collectionOptionActive: {
    backgroundColor: '#16161E',
    borderColor: '#8B5CF6',
  },
  collectionOptionText: {
    fontSize: 16,
    color: '#ffffff',
  },
  collectionOptionTextActive: {
    color: '#8B5CF6',
    fontWeight: '600',
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
  colorSwatchActive: {
    borderColor: '#D0FF00',
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
