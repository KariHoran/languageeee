import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import StarfieldBackground from '../components/StarfieldBackground';
import { useI18n } from '../i18n/useI18n';
import type { UiMessageKey } from '../i18n/uiMessages';
import {
  DEFAULT_SESSION_SIZE,
  addFlashcard,
  getFlashcardSources,
  getFlashcards,
  getFlashcardsCount,
  getReviewSession,
  markFlashcardKnown,
  removeFlashcard,
  reviewFlashcard,
  type DeckStats,
} from '../services/flashcardsStore';
import {
  exportFlashcardsAnki,
  exportFlashcardsCsv,
  pickAndImportAnkiFile,
} from '../services/flashcardsExport';
import { seedDemoDeck } from '../services/demoDeckService';
import { publishPublicDeck } from '../services/publicDecksService';
import { getAuthState } from '../services/authService';
import { getLearningLanguage } from '../services/onboardingService';
import { ttsService } from '../services/ttsService';
import { useTheme } from '../theme/ThemeContext';
import type { Flashcard, FlashcardGrade, LearningLanguage } from '../types';
import { showAlert, showConfirm } from '../utils/alert';
import { getHskBadgeColors } from '../utils/hskColors';
import { softShadow } from '../utils/shadow';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const IS_TABLET = SCREEN_WIDTH >= 768;

interface FlashcardsScreenProps {
  onBack: () => void;
}

type DeckFilter = LearningLanguage | 'all';
type Phase = 'hub' | 'browse' | 'create' | 'session' | 'done';
type StudyMode = 'recognition' | 'recall' | 'cloze' | 'listen';
type QueueMode = 'default' | 'weak' | 'mixed';

type SourceOpt = { bookId?: string; title: string; count: number };

type GradeButton = {
  id: FlashcardGrade;
  label: string;
  hint: string;
};

function clozeFront(card: Flashcard): string {
  const ctx = card.contextSentence?.trim();
  if (!ctx || !card.hanzi) return '';
  return ctx.split(card.hanzi).join('____');
}

function buildGradeButtons(
  t: (key: UiMessageKey, vars?: Record<string, string | number>) => string
): GradeButton[] {
  return [
    {
      id: 'again',
      label: t('flashcards.grade.again'),
      hint: t('flashcards.grade.againHint'),
    },
    {
      id: 'hard',
      label: t('flashcards.grade.hard'),
      hint: t('flashcards.grade.hardHint'),
    },
    {
      id: 'good',
      label: t('flashcards.grade.good'),
      hint: t('flashcards.grade.goodHint'),
    },
    {
      id: 'easy',
      label: t('flashcards.grade.easy'),
      hint: t('flashcards.grade.easyHint'),
    },
  ];
}

function sourceQueryFromKey(
  sources: SourceOpt[],
  sourceKey: string | null
): { sourceBookId?: string | null; sourceTitle?: string | null } {
  const selected =
    sourceKey != null
      ? sources.find((s) => (s.bookId || s.title) === sourceKey) ?? null
      : null;
  if (!selected) return {};
  return {
    sourceBookId: selected.bookId ?? null,
    sourceTitle: selected.bookId ? null : selected.title,
  };
}

function ttsLangForCard(card: Flashcard): 'zh-CN' | 'en-US' | 'ru-RU' {
  if (card.language === 'en') return 'en-US';
  if (card.language === 'ru') return 'ru-RU';
  return 'zh-CN';
}

/** SRS · сессия из 10 карточек + фильтры языка / книги */
export default function FlashcardsScreen({ onBack }: FlashcardsScreenProps) {
  const theme = useTheme();
  const { t } = useI18n();
  const gradeButtons = useMemo(() => buildGradeButtons(t), [t]);
  const [phase, setPhase] = useState<Phase>('hub');
  const [queue, setQueue] = useState<Flashcard[]>([]);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [grading, setGrading] = useState(false);
  const [stats, setStats] = useState<DeckStats>({
    total: 0,
    due: 0,
    dueTomorrow: 0,
    new: 0,
    learning: 0,
    learned: 0,
  });
  const [sessionDone, setSessionDone] = useState(0);
  const [gradeCounts, setGradeCounts] = useState({
    again: 0,
    hard: 0,
    good: 0,
    easy: 0,
  });
  const [filter, setFilter] = useState<DeckFilter>('all');
  const [filterReady, setFilterReady] = useState(false);
  const [sources, setSources] = useState<SourceOpt[]>([]);
  const [sourceKey, setSourceKey] = useState<string | null>(null);
  const [studyMode, setStudyMode] = useState<StudyMode>('recognition');
  const [queueMode, setQueueMode] = useState<QueueMode>('default');
  const [deckCards, setDeckCards] = useState<Flashcard[]>([]);
  const [browseQuery, setBrowseQuery] = useState('');
  const [weakCount, setWeakCount] = useState(0);
  const [createFront, setCreateFront] = useState('');
  const [createBack, setCreateBack] = useState('');
  const [createReading, setCreateReading] = useState('');
  const [createContext, setCreateContext] = useState('');
  const [createKind, setCreateKind] = useState<'word' | 'grammar'>('word');
  const [createLang, setCreateLang] = useState<LearningLanguage>('zh');
  const [createBusy, setCreateBusy] = useState(false);

  useEffect(() => {
    void (async () => {
      const lang = await getLearningLanguage();
      const deckLang: DeckFilter = lang === 'en' ? 'en' : lang === 'ru' ? 'ru' : 'zh';
      setFilter(deckLang);
      setCreateLang(lang === 'en' || lang === 'ru' || lang === 'zh' ? lang : 'zh');
      setFilterReady(true);
    })();
  }, []);

  const reloadHub = useCallback(async () => {
    if (!filterReady) return;
    setLoading(true);
    const src = await getFlashcardSources(filter);
    setSources(src);
    const selected =
      sourceKey != null
        ? src.find((s) => (s.bookId || s.title) === sourceKey) ?? null
        : null;
    if (sourceKey && !selected) {
      setSourceKey(null);
    }
    const query = selected
      ? {
          sourceBookId: selected.bookId ?? null,
          sourceTitle: selected.bookId ? null : selected.title,
        }
      : {};
    const counts = await getFlashcardsCount(filter, query);
    setStats(counts);
    const allForWeak = await getFlashcards(filter, query);
    const { filterWeakCards } = await import('../services/flashcardsStore');
    setWeakCount(filterWeakCards(allForWeak).length);
    setLoading(false);
  }, [filter, filterReady, sourceKey]);

  useEffect(() => {
    if (phase === 'hub') void reloadHub();
  }, [phase, reloadHub]);

  const reloadBrowse = useCallback(async () => {
    if (!filterReady) return;
    const query = sourceQueryFromKey(sources, sourceKey);
    const cards = await getFlashcards(filter, query);
    setDeckCards(cards);
  }, [filter, filterReady, sourceKey, sources]);

  useEffect(() => {
    if (phase === 'browse') void reloadBrowse();
  }, [phase, reloadBrowse]);

  const filteredBrowseCards = useMemo(() => {
    const q = browseQuery.trim().toLowerCase();
    if (!q) return deckCards;
    return deckCards.filter((card) => {
      const hay = [
        card.hanzi,
        card.translation,
        card.pinyin,
        card.sourceTitle,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [deckCards, browseQuery]);

  const emptyHintKeyEarly: UiMessageKey =
    filter === 'en'
      ? 'flashcards.emptyHint.en'
      : filter === 'zh'
        ? 'flashcards.emptyHint.zh'
        : 'flashcards.emptyHint.other';

  const startSession = async (modeOverride?: QueueMode) => {
    setLoading(true);
    const mode = modeOverride ?? queueMode;
    const query = sourceQueryFromKey(sources, sourceKey);
    const cards = await getReviewSession({
      language: filter,
      limit: DEFAULT_SESSION_SIZE,
      mode,
      ...query,
    });
    setQueue(cards);
    setIndex(0);
    setRevealed(false);
    setSessionDone(0);
    setGradeCounts({ again: 0, hard: 0, good: 0, easy: 0 });
    setLoading(false);
    if (cards.length === 0) {
      setPhase('hub');
      showAlert(t('flashcards.nothingToReview'), t(emptyHintKeyEarly));
      return;
    }
    setPhase('session');
  };

  const handleExport = async (kind: 'csv' | 'anki') => {
    const query = sourceQueryFromKey(sources, sourceKey);
    const cards = await getFlashcards(filter, query);
    if (kind === 'csv') {
      await exportFlashcardsCsv(cards);
    } else {
      await exportFlashcardsAnki(cards);
    }
  };

  const handleShareDeck = async () => {
    const auth = getAuthState();
    const loggedIn =
      auth.status === 'authenticated' &&
      auth.user != null &&
      !auth.user.isAnonymous;
    if (!loggedIn) {
      showAlert(t('alert.error'), t('flashcards.shareLoginRequired'));
      return;
    }
    try {
      const query = sourceQueryFromKey(sources, sourceKey);
      const cards = await getFlashcards(filter, query);
      const title =
        sources.find((s) => (s.bookId || s.title) === sourceKey)?.title ||
        t('flashcards.title.hub');
      const { url } = await publishPublicDeck({
        title,
        language: filter,
        cards,
      });
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      }
      showAlert(t('flashcards.shareCopied'), url);
    } catch (e) {
      showAlert(
        t('alert.error'),
        e instanceof Error ? e.message : t('flashcards.shareFail')
      );
    }
  };

  const handleDemoDeck = async () => {
    const lang = filter === 'all' ? 'zh' : filter;
    const result = await seedDemoDeck(lang);
    showAlert(
      t('flashcards.demoDeck'),
      t('flashcards.demoDeckDone', { n: result.added })
    );
    await reloadHub();
  };

  const resetCreateForm = () => {
    setCreateFront('');
    setCreateBack('');
    setCreateReading('');
    setCreateContext('');
    setCreateKind('word');
  };

  const openCreate = () => {
    resetCreateForm();
    if (filter === 'en' || filter === 'zh' || filter === 'ru') {
      setCreateLang(filter);
    }
    setPhase('create');
  };

  const handleCreateCard = async (stayOpen: boolean) => {
    const front = createFront.trim();
    const back = createBack.trim();
    if (!front) {
      showAlert(t('alert.error'), t('flashcards.createNeedFront'));
      return;
    }
    if (!back) {
      showAlert(t('alert.error'), t('flashcards.createNeedBack'));
      return;
    }
    if (createBusy) return;
    setCreateBusy(true);
    try {
      await addFlashcard({
        hanzi: front,
        translation: back,
        pinyin: createReading.trim() || undefined,
        contextSentence: createContext.trim() || undefined,
        language: createLang,
        kind: createKind,
        sourceTitle: 'Manual',
      });
      if (stayOpen) {
        resetCreateForm();
        showAlert(t('flashcards.createOk'), t('flashcards.createSaveAnother'));
      } else {
        resetCreateForm();
        setPhase('hub');
        void reloadHub();
        showAlert(t('flashcards.createOk'), front);
      }
    } catch (e) {
      showAlert(
        t('alert.error'),
        e instanceof Error ? e.message : t('flashcards.createFail')
      );
    } finally {
      setCreateBusy(false);
    }
  };

  const handleImportAnki = async () => {
    const result = await pickAndImportAnkiFile();
    if (!result) return;
    showAlert(
      t('flashcards.importAnki'),
      t('flashcards.importAnkiDone', {
        added: result.added,
        skipped: result.skipped,
      })
    );
    await reloadHub();
  };

  const current = queue[index] ?? null;
  const isEnglish = (current?.language ?? 'zh') === 'en';
  const isRussian = (current?.language ?? 'zh') === 'ru';

  const effectiveMode: StudyMode = useMemo(() => {
    if (!current) return studyMode;
    if (studyMode === 'cloze' && !clozeFront(current)) return 'recognition';
    return studyMode;
  }, [current, studyMode]);

  useEffect(() => {
    if (phase !== 'session' || effectiveMode !== 'listen' || !current) return;
    void ttsService.speak(current.hanzi, 0.9, ttsLangForCard(current));
    return () => {
      ttsService.stop();
    };
  }, [phase, effectiveMode, index, current?.id, current?.hanzi, current?.language]);

  const handleGrade = async (grade: FlashcardGrade) => {
    if (!current || grading) return;
    setGrading(true);
    try {
      await reviewFlashcard(current.id || current.hanzi, grade, current.language);
      setSessionDone((n) => n + 1);
      const bucket =
        grade === 'forgot'
          ? 'again'
          : grade === 'remembered'
            ? 'good'
            : grade;
      setGradeCounts((g) => ({ ...g, [bucket]: g[bucket] + 1 }));
      setRevealed(false);
      if (index + 1 >= queue.length) {
        setPhase('done');
      } else {
        setIndex((i) => i + 1);
      }
    } finally {
      setGrading(false);
    }
  };

  // Клавиатура: Space = flip, 1–4 = Again/Hard/Good/Easy
  useEffect(() => {
    if (phase !== 'session' || typeof window === 'undefined') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.code === 'Space') {
        e.preventDefault();
        if (!revealed) setRevealed(true);
        return;
      }
      if (!revealed || grading) return;
      const map: Record<string, FlashcardGrade> = {
        Digit1: 'again',
        Numpad1: 'again',
        Digit2: 'hard',
        Numpad2: 'hard',
        Digit3: 'good',
        Numpad3: 'good',
        Digit4: 'easy',
        Numpad4: 'easy',
      };
      const grade = map[e.code];
      if (grade) {
        e.preventDefault();
        void handleGrade(grade);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, revealed, grading, current?.id]);

  const advanceAfterRemove = (fromIndex: number, nextQueue: Flashcard[]) => {
    setRevealed(false);
    if (nextQueue.length === 0) {
      setQueue([]);
      setIndex(0);
      setPhase('done');
      return;
    }
    if (fromIndex >= nextQueue.length) {
      setQueue(nextQueue);
      setIndex(0);
      setPhase('done');
      return;
    }
    setQueue(nextQueue);
    setIndex(fromIndex);
  };

  const handleDelete = () => {
    if (!current || grading) return;
    const card = current;
    const at = index;
    showConfirm(
      t('flashcards.deleteConfirm'),
      t('flashcards.deleteConfirmBody', { word: card.hanzi }),
      () => {
        void (async () => {
          setGrading(true);
          try {
            await removeFlashcard(card.id || card.hanzi, card.language);
            const nextQueue = queue.filter((_, i) => i !== at);
            advanceAfterRemove(at, nextQueue);
          } finally {
            setGrading(false);
          }
        })();
      },
      t('action.delete'),
      t('action.cancel')
    );
  };

  const handleMarkKnown = () => {
    if (!current || grading) return;
    const card = current;
    const at = index;
    showConfirm(
      t('word.markKnown'),
      t('word.knownRemoved'),
      () => {
        void (async () => {
          setGrading(true);
          try {
            await markFlashcardKnown(card.id || card.hanzi, card.language);
            const nextQueue = queue.filter((_, i) => i !== at);
            advanceAfterRemove(at, nextQueue);
          } finally {
            setGrading(false);
          }
        })();
      },
      t('word.markKnown'),
      t('action.cancel')
    );
  };

  const handleBrowseDelete = (card: Flashcard) => {
    showConfirm(
      t('flashcards.deleteConfirm'),
      t('flashcards.deleteConfirmBody', { word: card.hanzi }),
      () => {
        void (async () => {
          await removeFlashcard(card.id || card.hanzi, card.language);
          await reloadBrowse();
        })();
      },
      t('action.delete'),
      t('action.cancel')
    );
  };

  const speakCurrent = () => {
    if (!current) return;
    void ttsService.speak(current.hanzi, 0.9, ttsLangForCard(current));
  };

  const titleKey: UiMessageKey =
    phase === 'browse'
      ? 'flashcards.browseTitle'
      : phase === 'create'
        ? 'flashcards.createTitle'
        : phase === 'session'
          ? 'flashcards.title.session'
          : phase === 'done'
            ? 'flashcards.title.done'
            : 'flashcards.title.hub';

  const emptyHintKey: UiMessageKey =
    filter === 'en'
      ? 'flashcards.emptyHint.en'
      : filter === 'zh'
        ? 'flashcards.emptyHint.zh'
        : 'flashcards.emptyHint.other';

  const studyModes: Array<{ id: StudyMode; labelKey: UiMessageKey }> = [
    { id: 'recognition', labelKey: 'flashcards.mode.recognition' },
    { id: 'recall', labelKey: 'flashcards.mode.recall' },
    { id: 'cloze', labelKey: 'flashcards.mode.cloze' },
    { id: 'listen', labelKey: 'flashcards.mode.listen' },
  ];

  if (loading || !filterReady) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: theme.bg }]}
        edges={['top', 'bottom']}
      >
        <ActivityIndicator
          size="large"
          color={theme.accent}
          style={styles.loader}
        />
      </SafeAreaView>
    );
  }

  const frontPrimary = (() => {
    if (!current) return '';
    if (effectiveMode === 'recall') {
      return current.translation || t('flashcards.noTranslation');
    }
    if (effectiveMode === 'cloze') {
      return clozeFront(current);
    }
    if (effectiveMode === 'listen') {
      return '🔊 …';
    }
    return current.hanzi;
  })();

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.bg }]}
      edges={['top', 'bottom']}
    >
      {theme.mode === 'midnight' ? <StarfieldBackground /> : null}
      <View style={{ flex: 1, zIndex: 1 }}>
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <Pressable
              onPress={() => {
                if (
                  phase === 'session' ||
                  phase === 'done' ||
                  phase === 'browse' ||
                  phase === 'create'
                ) {
                  setPhase('hub');
                  void reloadHub();
                  return;
                }
                onBack();
              }}
              style={styles.backButton}
            >
              <Text style={[styles.backButtonText, { color: theme.accent }]}>
                ←{' '}
                {phase === 'hub'
                  ? t('flashcards.back')
                  : t('flashcards.backToDeck')}
              </Text>
            </Pressable>
          </View>
          <Text style={[styles.brand, { color: theme.accentPink }]}>
            {t('flashcards.brand')}
          </Text>
          <Text style={[styles.title, { color: theme.text }]}>
            {t(titleKey)}
          </Text>
        </View>

        {phase === 'hub' ? (
          <ScrollView
            contentContainerStyle={styles.hubScroll}
            showsVerticalScrollIndicator={false}
          >
            <Text style={[styles.subtitle, { color: theme.textMuted }]}>
              {t('flashcards.dueTotal', {
                due: stats.due,
                total: stats.total,
              })}
            </Text>

            <View style={styles.statRow}>
              <StatChip
                label={t('flashcards.stat.new')}
                value={stats.new}
                color={theme.accentPink}
                theme={theme}
              />
              <StatChip
                label={t('flashcards.stat.learning')}
                value={stats.learning}
                color={theme.accent}
                theme={theme}
              />
              <StatChip
                label={t('flashcards.stat.learned')}
                value={stats.learned}
                color={theme.success}
                theme={theme}
              />
            </View>

            <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>
              {t('flashcards.modeLabel')}
            </Text>
            <View style={styles.filterRow}>
              {studyModes.map((opt) => {
                const active = studyMode === opt.id;
                return (
                  <Pressable
                    key={opt.id}
                    onPress={() => setStudyMode(opt.id)}
                    style={[
                      styles.filterChip,
                      {
                        borderColor: active ? theme.accent : theme.border,
                        backgroundColor: active
                          ? theme.mode === 'midnight'
                            ? 'rgba(100,200,180,0.18)'
                            : 'rgba(16,185,129,0.12)'
                          : 'transparent',
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.filterChipText,
                        {
                          color: active ? theme.accent : theme.textMuted,
                        },
                      ]}
                    >
                      {t(opt.labelKey)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>
              {t('flashcards.queueLabel')}
            </Text>
            <View style={styles.filterRow}>
              {(
                [
                  { id: 'default' as const, labelKey: 'flashcards.queue.default' as UiMessageKey },
                  {
                    id: 'weak' as const,
                    labelKey: 'flashcards.queue.weak' as UiMessageKey,
                  },
                  {
                    id: 'mixed' as const,
                    labelKey: 'flashcards.queue.mixed' as UiMessageKey,
                  },
                ] as const
              ).map((opt) => {
                const active = queueMode === opt.id;
                return (
                  <Pressable
                    key={opt.id}
                    onPress={() => setQueueMode(opt.id)}
                    style={[
                      styles.filterChip,
                      {
                        borderColor: active ? theme.accentPink : theme.border,
                        backgroundColor: active
                          ? 'rgba(255,101,132,0.15)'
                          : 'transparent',
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.filterChipText,
                        {
                          color: active ? theme.accentPink : theme.textMuted,
                        },
                      ]}
                    >
                      {t(opt.labelKey)}
                      {opt.id === 'weak' && weakCount > 0 ? ` · ${weakCount}` : ''}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>
              {t('flashcards.langLabel')}
            </Text>
            <View style={styles.filterRow}>
              {(
                [
                  { id: 'zh' as const, label: '中文' },
                  { id: 'ru' as const, label: 'RU' },
                  { id: 'en' as const, label: 'EN' },
                  { id: 'all' as const, label: t('flashcards.langAll') },
                ] as const
              ).map((opt) => {
                const active = filter === opt.id;
                return (
                  <Pressable
                    key={opt.id}
                    onPress={() => {
                      setFilter(opt.id);
                      setSourceKey(null);
                    }}
                    style={[
                      styles.filterChip,
                      {
                        borderColor: active ? theme.accentPink : theme.border,
                        backgroundColor: active
                          ? theme.mode === 'midnight'
                            ? 'rgba(255,122,217,0.18)'
                            : 'rgba(236,72,153,0.12)'
                          : 'transparent',
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.filterChipText,
                        {
                          color: active ? theme.accentPink : theme.textMuted,
                        },
                      ]}
                    >
                      {opt.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {sources.length > 0 ? (
              <>
                <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>
                  {t('flashcards.sourceLabel')}
                </Text>
                <View style={styles.filterRow}>
                  <Pressable
                    onPress={() => setSourceKey(null)}
                    style={[
                      styles.filterChip,
                      {
                        borderColor:
                          sourceKey == null ? theme.accentPink : theme.border,
                        backgroundColor:
                          sourceKey == null
                            ? theme.mode === 'midnight'
                              ? 'rgba(255,122,217,0.18)'
                              : 'rgba(236,72,153,0.12)'
                            : 'transparent',
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.filterChipText,
                        {
                          color:
                            sourceKey == null
                              ? theme.accentPink
                              : theme.textMuted,
                        },
                      ]}
                    >
                      {t('flashcards.allBooks')}
                    </Text>
                  </Pressable>
                  {sources.map((s) => {
                    const key = s.bookId || s.title;
                    const active = sourceKey === key;
                    return (
                      <Pressable
                        key={key}
                        onPress={() => setSourceKey(key)}
                        style={[
                          styles.filterChip,
                          {
                            borderColor: active
                              ? theme.accentPink
                              : theme.border,
                            backgroundColor: active
                              ? theme.mode === 'midnight'
                                ? 'rgba(255,122,217,0.18)'
                                : 'rgba(236,72,153,0.12)'
                              : 'transparent',
                            maxWidth: 180,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.filterChipText,
                            {
                              color: active
                                ? theme.accentPink
                                : theme.textMuted,
                            },
                          ]}
                          numberOfLines={1}
                        >
                          {s.title} ({s.count})
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </>
            ) : null}

            <View style={styles.hubActions}>
              <Pressable
                style={[
                  styles.secondaryButton,
                  { borderColor: theme.accentPink },
                ]}
                onPress={openCreate}
              >
                <Text
                  style={[
                    styles.secondaryButtonText,
                    { color: theme.accentPink },
                  ]}
                >
                  {t('flashcards.create')}
                </Text>
              </Pressable>
              <Pressable
                style={[
                  styles.secondaryButton,
                  { borderColor: theme.accent },
                ]}
                onPress={() => {
                  setBrowseQuery('');
                  setPhase('browse');
                }}
              >
                <Text
                  style={[styles.secondaryButtonText, { color: theme.accent }]}
                >
                  {t('flashcards.browse')}
                </Text>
              </Pressable>
              <Pressable
                style={[
                  styles.secondaryButton,
                  { borderColor: theme.border },
                ]}
                onPress={() => void handleExport('csv')}
              >
                <Text
                  style={[
                    styles.secondaryButtonText,
                    { color: theme.textMuted },
                  ]}
                >
                  {t('flashcards.exportCsv')}
                </Text>
              </Pressable>
              <Pressable
                style={[
                  styles.secondaryButton,
                  { borderColor: theme.border },
                ]}
                onPress={() => void handleExport('anki')}
              >
                <Text
                  style={[
                    styles.secondaryButtonText,
                    { color: theme.textMuted },
                  ]}
                >
                  {t('flashcards.exportAnki')}
                </Text>
              </Pressable>
              <Pressable
                style={[
                  styles.secondaryButton,
                  { borderColor: theme.accentPink },
                ]}
                onPress={() => void handleShareDeck()}
              >
                <Text
                  style={[
                    styles.secondaryButtonText,
                    { color: theme.accentPink },
                  ]}
                >
                  {t('flashcards.shareDeck')}
                </Text>
              </Pressable>
              <Pressable
                style={[
                  styles.secondaryButton,
                  { borderColor: theme.border },
                ]}
                onPress={() => void handleImportAnki()}
              >
                <Text
                  style={[
                    styles.secondaryButtonText,
                    { color: theme.textMuted },
                  ]}
                >
                  {t('flashcards.importAnki')}
                </Text>
              </Pressable>
              {stats.total === 0 ? (
                <Pressable
                  style={[
                    styles.secondaryButton,
                    { borderColor: theme.accent },
                  ]}
                  onPress={() => void handleDemoDeck()}
                >
                  <Text
                    style={[
                      styles.secondaryButtonText,
                      { color: theme.accent },
                    ]}
                  >
                    {t('flashcards.demoDeck')}
                  </Text>
                </Pressable>
              ) : null}
            </View>

            <Pressable
              style={[
                styles.sessionButton,
                {
                  backgroundColor:
                    stats.due > 0 ? theme.accent : theme.border,
                  opacity: stats.due > 0 ? 1 : 0.55,
                },
              ]}
              disabled={stats.due <= 0}
              onPress={() => void startSession()}
            >
              <Text style={styles.sessionButtonText}>
                {stats.due > 0
                  ? t('flashcards.startSession', {
                      n: Math.min(DEFAULT_SESSION_SIZE, stats.due),
                    })
                  : t('flashcards.nothingToReview')}
              </Text>
            </Pressable>

            {stats.due <= 0 ? (
              <Text style={[styles.emptyHint, { color: theme.textMuted }]}>
                {t(emptyHintKey)}
              </Text>
            ) : (
              <Text style={[styles.emptyHint, { color: theme.textDim }]}>
                {t('flashcards.sessionHint')}
              </Text>
            )}
          </ScrollView>
        ) : null}

        {phase === 'browse' ? (
          <View style={styles.browseWrap}>
            <TextInput
              value={browseQuery}
              onChangeText={setBrowseQuery}
              placeholder={t('flashcards.searchPlaceholder')}
              placeholderTextColor={theme.textDim}
              style={[
                styles.searchInput,
                {
                  color: theme.text,
                  borderColor: theme.border,
                  backgroundColor:
                    theme.mode === 'midnight'
                      ? 'rgba(255,255,255,0.04)'
                      : 'rgba(0,0,0,0.03)',
                },
              ]}
            />
            <Pressable
              style={[
                styles.secondaryButton,
                {
                  borderColor: theme.accentPink,
                  alignSelf: 'flex-start',
                  marginBottom: 12,
                },
              ]}
              onPress={openCreate}
            >
              <Text
                style={[
                  styles.secondaryButtonText,
                  { color: theme.accentPink },
                ]}
              >
                {t('flashcards.create')}
              </Text>
            </Pressable>
            {filteredBrowseCards.length === 0 ? (
              <Text style={[styles.emptyHint, { color: theme.textMuted }]}>
                {t('flashcards.emptyBrowse')}
              </Text>
            ) : (
              <ScrollView
                contentContainerStyle={styles.browseList}
                showsVerticalScrollIndicator={false}
              >
                {filteredBrowseCards.map((card) => (
                  <View
                    key={card.id || `${card.language}:${card.hanzi}`}
                    style={[
                      styles.browseRow,
                      {
                        borderColor: theme.border,
                        backgroundColor:
                          theme.mode === 'midnight'
                            ? 'rgba(255,255,255,0.04)'
                            : 'rgba(0,0,0,0.03)',
                      },
                    ]}
                  >
                    <View style={styles.browseRowText}>
                      <Text
                        style={[styles.browseHanzi, { color: theme.text }]}
                        numberOfLines={1}
                      >
                        {card.hanzi}
                      </Text>
                      <Text
                        style={[
                          styles.browseTranslation,
                          { color: theme.textMuted },
                        ]}
                        numberOfLines={2}
                      >
                        {card.translation || t('flashcards.noTranslation')}
                      </Text>
                    </View>
                    <Pressable
                      onPress={() => handleBrowseDelete(card)}
                      hitSlop={8}
                      accessibilityRole="button"
                      accessibilityLabel={t('flashcards.delete')}
                    >
                      <Text
                        style={[
                          styles.deleteLinkText,
                          { color: theme.danger },
                        ]}
                      >
                        {t('flashcards.delete')}
                      </Text>
                    </Pressable>
                  </View>
                ))}
              </ScrollView>
            )}
          </View>
        ) : null}

        {phase === 'create' ? (
          <ScrollView
            contentContainerStyle={styles.hubScroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Text style={[styles.sectionLabel, { color: theme.textDim }]}>
              {t('flashcards.langLabel')}
            </Text>
            <View style={styles.filterRow}>
              {(['zh', 'en', 'ru'] as LearningLanguage[]).map((lang) => {
                const active = createLang === lang;
                const label =
                  lang === 'zh'
                    ? '中文'
                    : lang === 'en'
                      ? 'EN'
                      : 'RU';
                return (
                  <Pressable
                    key={lang}
                    onPress={() => setCreateLang(lang)}
                    style={[
                      styles.filterChip,
                      {
                        borderColor: active ? theme.accentPink : theme.border,
                        backgroundColor: active
                          ? theme.mode === 'midnight'
                            ? 'rgba(255,122,217,0.18)'
                            : 'rgba(236,72,153,0.12)'
                          : 'transparent',
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.filterChipText,
                        {
                          color: active ? theme.accentPink : theme.textMuted,
                        },
                      ]}
                    >
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={[styles.sectionLabel, { color: theme.textDim }]}>
              {t('flashcards.createKindWord')}
            </Text>
            <View style={styles.filterRow}>
              {(
                [
                  { id: 'word' as const, key: 'flashcards.createKindWord' },
                  {
                    id: 'grammar' as const,
                    key: 'flashcards.createKindGrammar',
                  },
                ] as const
              ).map((opt) => {
                const active = createKind === opt.id;
                return (
                  <Pressable
                    key={opt.id}
                    onPress={() => setCreateKind(opt.id)}
                    style={[
                      styles.filterChip,
                      {
                        borderColor: active ? theme.accent : theme.border,
                        backgroundColor: active
                          ? theme.mode === 'midnight'
                            ? 'rgba(99,102,241,0.18)'
                            : 'rgba(99,102,241,0.1)'
                          : 'transparent',
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.filterChipText,
                        {
                          color: active ? theme.accent : theme.textMuted,
                        },
                      ]}
                    >
                      {t(opt.key)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={[styles.sectionLabel, { color: theme.textDim }]}>
              {t('flashcards.createFront')}
            </Text>
            <TextInput
              value={createFront}
              onChangeText={setCreateFront}
              placeholder={t('flashcards.createFrontPlaceholder')}
              placeholderTextColor={theme.textDim}
              autoCapitalize="none"
              style={[
                styles.searchInput,
                {
                  color: theme.text,
                  borderColor: theme.border,
                  backgroundColor:
                    theme.mode === 'midnight'
                      ? 'rgba(255,255,255,0.04)'
                      : 'rgba(0,0,0,0.03)',
                },
              ]}
            />

            <Text style={[styles.sectionLabel, { color: theme.textDim }]}>
              {t('flashcards.createBack')}
            </Text>
            <TextInput
              value={createBack}
              onChangeText={setCreateBack}
              placeholder={t('flashcards.createBackPlaceholder')}
              placeholderTextColor={theme.textDim}
              style={[
                styles.searchInput,
                {
                  color: theme.text,
                  borderColor: theme.border,
                  backgroundColor:
                    theme.mode === 'midnight'
                      ? 'rgba(255,255,255,0.04)'
                      : 'rgba(0,0,0,0.03)',
                },
              ]}
            />

            {createLang === 'zh' || createLang === 'ru' ? (
              <>
                <Text style={[styles.sectionLabel, { color: theme.textDim }]}>
                  {t('flashcards.createReading')}
                </Text>
                <TextInput
                  value={createReading}
                  onChangeText={setCreateReading}
                  placeholder={t('flashcards.createReadingPlaceholder')}
                  placeholderTextColor={theme.textDim}
                  autoCapitalize="none"
                  style={[
                    styles.searchInput,
                    {
                      color: theme.text,
                      borderColor: theme.border,
                      backgroundColor:
                        theme.mode === 'midnight'
                          ? 'rgba(255,255,255,0.04)'
                          : 'rgba(0,0,0,0.03)',
                    },
                  ]}
                />
              </>
            ) : null}

            <Text style={[styles.sectionLabel, { color: theme.textDim }]}>
              {t('flashcards.createContext')}
            </Text>
            <TextInput
              value={createContext}
              onChangeText={setCreateContext}
              placeholder={t('flashcards.createContextPlaceholder')}
              placeholderTextColor={theme.textDim}
              multiline
              style={[
                styles.searchInput,
                styles.createMultiline,
                {
                  color: theme.text,
                  borderColor: theme.border,
                  backgroundColor:
                    theme.mode === 'midnight'
                      ? 'rgba(255,255,255,0.04)'
                      : 'rgba(0,0,0,0.03)',
                },
              ]}
            />

            <Pressable
              style={[
                styles.sessionButton,
                {
                  backgroundColor: theme.accent,
                  opacity: createBusy ? 0.6 : 1,
                  marginTop: 8,
                },
              ]}
              disabled={createBusy}
              onPress={() => void handleCreateCard(false)}
            >
              <Text style={styles.sessionButtonText}>
                {t('flashcards.createSave')}
              </Text>
            </Pressable>
            <Pressable
              style={[
                styles.secondaryButton,
                {
                  borderColor: theme.border,
                  alignSelf: 'center',
                  marginTop: 10,
                },
              ]}
              disabled={createBusy}
              onPress={() => void handleCreateCard(true)}
            >
              <Text
                style={[
                  styles.secondaryButtonText,
                  { color: theme.textMuted },
                ]}
              >
                {t('flashcards.createSaveAnother')}
              </Text>
            </Pressable>
          </ScrollView>
        ) : null}

        {phase === 'done' ? (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyEmoji}>✨</Text>
            <Text style={[styles.emptyTitle, { color: theme.text }]}>
              {t('flashcards.sessionDone')}
            </Text>
            <Text style={[styles.emptyText, { color: theme.textMuted }]}>
              {t('flashcards.reviewedSummary', {
                done: sessionDone,
                again: gradeCounts.again,
                hard: gradeCounts.hard,
                good: gradeCounts.good,
                easy: gradeCounts.easy,
              })}
            </Text>
            <Pressable
              style={[styles.sessionButton, { backgroundColor: theme.accent }]}
              onPress={() => {
                setPhase('hub');
                void reloadHub();
              }}
            >
              <Text style={styles.sessionButtonText}>
                {t('flashcards.backToDeck')}
              </Text>
            </Pressable>
            <Pressable
              style={[
                styles.refreshButton,
                { borderColor: theme.accent, marginTop: 12 },
              ]}
              onPress={() => void startSession()}
            >
              <Text style={[styles.refreshButtonText, { color: theme.accent }]}>
                {t('flashcards.anotherSession')}
              </Text>
            </Pressable>
          </View>
        ) : null}

        {phase === 'session' && current ? (
          <View style={styles.cardArea}>
            <Text style={[styles.progress, { color: theme.textDim }]}>
              {t('flashcards.progress', {
                i: index + 1,
                total: queue.length,
              })}
              {sessionDone > 0
                ? t('flashcards.progressWithAnswers', { n: sessionDone })
                : ''}
            </Text>
            <Text style={[styles.keyboardHint, { color: theme.textDim }]}>
              {t('flashcards.keyboardHint')}
            </Text>

            <View style={styles.cardActions}>
              <Pressable
                onPress={handleMarkKnown}
                disabled={grading}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={t('word.markKnown')}
                style={styles.deleteLink}
              >
                <Text
                  style={[styles.deleteLinkText, { color: theme.accent }]}
                >
                  {t('word.markKnown')}
                </Text>
              </Pressable>
              <Pressable
                onPress={handleDelete}
                disabled={grading}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={t('flashcards.delete')}
                style={styles.deleteLink}
              >
                <Text style={[styles.deleteLinkText, { color: theme.danger }]}>
                  {t('flashcards.delete')}
                </Text>
              </Pressable>
              {effectiveMode === 'listen' ? (
                <Pressable
                  onPress={speakCurrent}
                  disabled={grading}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={t('flashcards.speakCard')}
                  style={styles.deleteLink}
                >
                  <Text
                    style={[styles.deleteLinkText, { color: theme.accentPink }]}
                  >
                    {t('flashcards.speakCard')}
                  </Text>
                </Pressable>
              ) : null}
            </View>

            <Pressable
              onPress={() => setRevealed(true)}
              style={[
                styles.card,
                {
                  backgroundColor: theme.gridPaper,
                  borderColor: theme.accentViolet,
                },
                softShadow({
                  color: theme.accentPink,
                  y: 8,
                  blur: 16,
                  opacity: 0.2,
                  elevation: 5,
                }),
              ]}
            >
              <View pointerEvents="none" style={styles.gridOverlay}>
                {Array.from({ length: 12 }).map((_, i) => (
                  <View
                    key={`h-${i}`}
                    style={[
                      styles.gridH,
                      {
                        top: 24 + i * 28,
                        borderColor:
                          theme.mode === 'midnight'
                            ? 'rgba(100,140,255,0.12)'
                            : 'rgba(180,160,120,0.25)',
                      },
                    ]}
                  />
                ))}
              </View>

              <Text style={styles.stickerTL}>⭐</Text>
              <Text style={styles.stickerTR}>🎀</Text>
              <Text style={styles.stickerBL}>🌸</Text>
              <Text style={styles.stickerBR}>💿</Text>

              {isEnglish ? (
                <View
                  style={[
                    styles.langBadge,
                    {
                      backgroundColor:
                        theme.mode === 'midnight'
                          ? 'rgba(255,122,217,0.2)'
                          : 'rgba(236,72,153,0.15)',
                    },
                  ]}
                >
                  <Text
                    style={[styles.langBadgeText, { color: theme.accentPink }]}
                  >
                    EN
                  </Text>
                </View>
              ) : current.hskLevel != null ? (
                <View
                  style={[
                    styles.hskBadge,
                    {
                      backgroundColor: getHskBadgeColors(current.hskLevel)
                        .background,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.hskBadgeText,
                      { color: getHskBadgeColors(current.hskLevel).text },
                    ]}
                  >
                    HSK {current.hskLevel}
                  </Text>
                </View>
              ) : null}

              <Text
                style={[
                  effectiveMode === 'recall' || effectiveMode === 'cloze'
                    ? styles.surfaceEn
                    : isEnglish
                      ? styles.surfaceEn
                      : styles.hanzi,
                  { color: theme.text },
                ]}
              >
                {frontPrimary}
              </Text>

              {effectiveMode === 'recognition' && current.contextSentence ? (
                <View
                  style={[
                    styles.contextBox,
                    {
                      backgroundColor: theme.stickerLavender,
                      borderColor: theme.accentViolet,
                    },
                  ]}
                >
                  <Text style={[styles.contextLabel, { color: theme.accent }]}>
                    📖 {t('flashcards.fromFanfic')}
                    {current.sourceTitle ? ` · ${current.sourceTitle}` : ''}
                  </Text>
                  <Text style={[styles.contextQuote, { color: theme.text }]}>
                    「{current.contextSentence}」
                  </Text>
                </View>
              ) : effectiveMode === 'recognition' ? (
                <Text style={[styles.noContext, { color: theme.textDim }]}>
                  {t('flashcards.noContextYet')}
                </Text>
              ) : null}

              {revealed ? (
                <View style={styles.answerBlock}>
                  {effectiveMode === 'recognition' ? (
                    <>
                      {!isEnglish && current.pinyin ? (
                        <Text
                          style={[
                            styles.pinyin,
                            {
                              color:
                                isRussian || theme.mode === 'midnight'
                                  ? '#FF6584'
                                  : theme.accentPink,
                            },
                          ]}
                        >
                          {current.pinyin}
                        </Text>
                      ) : null}
                      <Text style={[styles.translation, { color: theme.text }]}>
                        {current.translation || t('flashcards.noTranslation')}
                      </Text>
                    </>
                  ) : null}

                  {effectiveMode === 'recall' ? (
                    <>
                      <Text
                        style={[
                          isEnglish ? styles.surfaceEn : styles.hanzi,
                          { color: theme.text, fontSize: isEnglish ? 36 : 44 },
                        ]}
                      >
                        {current.hanzi}
                      </Text>
                      {!isEnglish && current.pinyin ? (
                        <Text
                          style={[
                            styles.pinyin,
                            {
                              color:
                                isRussian || theme.mode === 'midnight'
                                  ? '#FF6584'
                                  : theme.accentPink,
                            },
                          ]}
                        >
                          {current.pinyin}
                        </Text>
                      ) : null}
                    </>
                  ) : null}

                  {effectiveMode === 'cloze' ? (
                    <>
                      <Text
                        style={[
                          isEnglish ? styles.surfaceEn : styles.hanzi,
                          { color: theme.text, fontSize: isEnglish ? 36 : 44 },
                        ]}
                      >
                        {current.hanzi}
                      </Text>
                      <Text style={[styles.translation, { color: theme.text }]}>
                        {current.translation || t('flashcards.noTranslation')}
                      </Text>
                    </>
                  ) : null}

                  {effectiveMode === 'listen' ? (
                    <>
                      <Text
                        style={[
                          isEnglish ? styles.surfaceEn : styles.hanzi,
                          { color: theme.text, fontSize: isEnglish ? 36 : 44 },
                        ]}
                      >
                        {current.hanzi}
                      </Text>
                      {!isEnglish && current.pinyin ? (
                        <Text
                          style={[
                            styles.pinyin,
                            {
                              color:
                                isRussian || theme.mode === 'midnight'
                                  ? '#FF6584'
                                  : theme.accentPink,
                            },
                          ]}
                        >
                          {current.pinyin}
                        </Text>
                      ) : null}
                      <Text style={[styles.translation, { color: theme.text }]}>
                        {current.translation || t('flashcards.noTranslation')}
                      </Text>
                    </>
                  ) : null}
                </View>
              ) : (
                <Text style={[styles.hiddenHint, { color: theme.textDim }]}>
                  {t('flashcards.tapToReveal')}
                </Text>
              )}
            </Pressable>

            {!revealed ? (
              <Pressable
                style={[styles.revealButton, { backgroundColor: theme.accent }]}
                onPress={() => setRevealed(true)}
              >
                <Text style={styles.revealButtonText}>
                  {t('flashcards.showAnswer')}
                </Text>
              </Pressable>
            ) : (
              <View style={styles.gradeRow}>
                {gradeButtons.map((btn) => {
                  const isAgain = btn.id === 'again';
                  const isHard = btn.id === 'hard';
                  const isEasy = btn.id === 'easy';
                  return (
                    <Pressable
                      key={btn.id}
                      disabled={grading}
                      onPress={() => void handleGrade(btn.id)}
                      style={[
                        styles.gradeButton,
                        isAgain || isHard
                          ? {
                              backgroundColor: 'transparent',
                              borderWidth: 1.5,
                              borderColor: isAgain
                                ? theme.danger
                                : theme.accentViolet,
                            }
                          : {
                              backgroundColor: isEasy
                                ? theme.success
                                : theme.accent,
                            },
                      ]}
                    >
                      <Text
                        style={[
                          styles.gradeLabel,
                          {
                            color:
                              isAgain
                                ? theme.danger
                                : isHard
                                  ? theme.accentViolet
                                  : '#0a1a12',
                          },
                        ]}
                      >
                        {btn.label}
                      </Text>
                      <Text
                        style={[
                          styles.gradeHint,
                          {
                            color:
                              isAgain || isHard
                                ? theme.textDim
                                : 'rgba(10,26,18,0.65)',
                          },
                        ]}
                      >
                        {btn.hint}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            )}
          </View>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

function StatChip({
  label,
  value,
  color,
  theme,
}: {
  label: string;
  value: number;
  color: string;
  theme: ReturnType<typeof useTheme>;
}) {
  return (
    <View
      style={[
        styles.statChip,
        {
          borderColor: theme.border,
          backgroundColor:
            theme.mode === 'midnight'
              ? 'rgba(255,255,255,0.04)'
              : 'rgba(0,0,0,0.03)',
        },
      ]}
    >
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: theme.textMuted }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loader: { marginTop: 80 },
  header: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 4 },
  headerTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  backButton: { marginBottom: 8 },
  backButtonText: { fontSize: 15, fontWeight: '600' },
  brand: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1,
    marginBottom: 2,
  },
  title: {
    fontSize: IS_TABLET ? 28 : 24,
    fontWeight: '800',
  },
  subtitle: { marginTop: 4, fontSize: 13 },
  hubScroll: {
    paddingHorizontal: 20,
    paddingBottom: 120,
    maxWidth: 640,
    width: '100%',
    alignSelf: 'center',
  },
  sectionLabel: {
    marginTop: 16,
    marginBottom: 8,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1.5,
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  hubActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 20,
  },
  secondaryButton: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1.5,
  },
  secondaryButtonText: {
    fontSize: 13,
    fontWeight: '700',
  },
  statRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
  statChip: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  statValue: { fontSize: 22, fontWeight: '900' },
  statLabel: { fontSize: 11, fontWeight: '700', marginTop: 2 },
  sessionButton: {
    marginTop: 24,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  sessionButtonText: { color: '#0a1a12', fontSize: 16, fontWeight: '800' },
  emptyHint: {
    marginTop: 14,
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
  },
  browseWrap: {
    flex: 1,
    paddingHorizontal: 20,
    maxWidth: 640,
    width: '100%',
    alignSelf: 'center',
  },
  searchInput: {
    marginTop: 8,
    marginBottom: 12,
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    fontWeight: '600',
  },
  createMultiline: {
    minHeight: 88,
    textAlignVertical: 'top',
  },
  browseList: {
    paddingBottom: 100,
    gap: 10,
  },
  browseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  browseRowText: { flex: 1, minWidth: 0 },
  browseHanzi: { fontSize: 18, fontWeight: '800' },
  browseTranslation: { fontSize: 13, fontWeight: '600', marginTop: 2 },
  emptyWrap: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 32,
    alignItems: 'center',
  },
  emptyEmoji: { fontSize: 40, marginBottom: 12 },
  emptyTitle: { fontSize: 22, fontWeight: '700', marginBottom: 10 },
  emptyText: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 24,
  },
  refreshButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1.5,
  },
  refreshButtonText: { fontWeight: '700', fontSize: 15 },
  cardArea: {
    flex: 1,
    paddingHorizontal: IS_TABLET ? 48 : 20,
    paddingBottom: 100,
    justifyContent: 'center',
    maxWidth: 640,
    width: '100%',
    alignSelf: 'center',
  },
  progress: {
    textAlign: 'center',
    fontSize: 14,
    marginBottom: 4,
    fontWeight: '600',
  },
  keyboardHint: {
    textAlign: 'center',
    fontSize: 11,
    marginBottom: 8,
    fontWeight: '600',
    opacity: 0.85,
  },
  cardActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 4,
    marginBottom: 4,
  },
  deleteLink: {
    alignSelf: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginBottom: 10,
  },
  deleteLinkText: {
    fontSize: 13,
    fontWeight: '700',
  },
  card: {
    borderRadius: 8,
    borderWidth: 2,
    paddingVertical: 40,
    paddingHorizontal: 24,
    alignItems: 'center',
    minHeight: 320,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  gridOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  gridH: {
    position: 'absolute',
    left: 12,
    right: 12,
    borderTopWidth: 1,
  },
  stickerTL: { position: 'absolute', top: 10, left: 12, fontSize: 18 },
  stickerTR: { position: 'absolute', top: 10, right: 12, fontSize: 18 },
  stickerBL: { position: 'absolute', bottom: 10, left: 12, fontSize: 16 },
  stickerBR: { position: 'absolute', bottom: 10, right: 14, fontSize: 16 },
  hskBadge: {
    position: 'absolute',
    top: 40,
    right: 16,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  hskBadgeText: { fontSize: 12, fontWeight: '700' },
  langBadge: {
    position: 'absolute',
    top: 40,
    right: 16,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  langBadgeText: { fontSize: 12, fontWeight: '800', letterSpacing: 0.5 },
  hanzi: {
    fontSize: IS_TABLET ? 68 : 52,
    fontWeight: '800',
    zIndex: 1,
  },
  surfaceEn: {
    fontSize: IS_TABLET ? 44 : 36,
    fontWeight: '800',
    zIndex: 1,
    textAlign: 'center',
    paddingHorizontal: 8,
  },
  contextBox: {
    marginTop: 18,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    maxWidth: '100%',
    zIndex: 1,
  },
  contextLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.4,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  contextQuote: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '600',
    textAlign: 'center',
  },
  noContext: {
    marginTop: 14,
    fontSize: 12,
    zIndex: 1,
  },
  hiddenHint: { marginTop: 22, fontSize: 14, zIndex: 1 },
  answerBlock: { marginTop: 20, alignItems: 'center', gap: 8, zIndex: 1 },
  pinyin: { fontSize: 22, fontWeight: '700' },
  translation: {
    fontSize: 19,
    textAlign: 'center',
    lineHeight: 28,
    fontWeight: '600',
  },
  revealButton: {
    marginTop: 24,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  revealButtonText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  gradeRow: { flexDirection: 'row', gap: 8, marginTop: 20 },
  gradeButton: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 4,
    alignItems: 'center',
  },
  gradeLabel: { fontSize: 13, fontWeight: '800' },
  gradeHint: { fontSize: 10, fontWeight: '600', marginTop: 2 },
});
