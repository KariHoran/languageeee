import React, { useEffect, useState } from 'react';
import {
  Dimensions,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import CollectionWordPicker from './CollectionWordPicker';
import { lookupBkrs } from '../services/bkrsService';
import { addFlashcard, hasFlashcard } from '../services/flashcardsStore';
import { translateWordZhToRu } from '../services/translationService';
import { useTheme } from '../theme/ThemeContext';
import { AnalyzedWord, HskAnalysisResult } from '../types';
import { getHskBadgeColors } from '../utils/hskColors';
import { softShadow } from '../utils/shadow';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const IS_TABLET = SCREEN_WIDTH >= 768;

interface HskAnalysisViewProps {
  analysis: HskAnalysisResult;
}

/** Отображает текст с подсветкой слов выше целевого уровня HSK */
export default function HskAnalysisView({ analysis }: HskAnalysisViewProps) {
  const theme = useTheme();
  const isDark = theme.mode === 'midnight';
  const [selected, setSelected] = useState<AnalyzedWord | null>(null);
  const [popoverPos, setPopoverPos] = useState({ x: 0, y: 0 });
  const [inFlashcards, setInFlashcards] = useState(false);
  const [adding, setAdding] = useState(false);

  const [remoteTranslation, setRemoteTranslation] = useState('');
  const [translating, setTranslating] = useState(false);

  const handlePress = async (word: AnalyzedWord, x: number, y: number) => {
    if (!word.isChinese) return;
    setSelected(word);
    setPopoverPos({ x, y });
    setRemoteTranslation('');
    setInFlashcards(await hasFlashcard(word.hanzi ?? word.text, 'zh'));
  };

  const surface = selected ? (selected.hanzi ?? selected.text).trim() : '';
  const bkrsTranslation = surface ? lookupBkrs(surface)?.trim() || '' : '';
  const selectedTranslation =
    bkrsTranslation ||
    selected?.translation?.trim() ||
    remoteTranslation;

  // OOV (нет в БКРС): перевод всего токена через translationService по клику
  useEffect(() => {
    if (!selected || !surface || bkrsTranslation) {
      setTranslating(false);
      return;
    }
    let cancelled = false;
    setTranslating(true);
    void (async () => {
      try {
        const ru = (await translateWordZhToRu(surface)).trim();
        if (!cancelled && ru) setRemoteTranslation(ru);
      } catch (err) {
        console.warn('[HskAnalysisView] OOV translate failed:', surface, err);
      } finally {
        if (!cancelled) setTranslating(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selected, surface, bkrsTranslation]);

  const handleAddToFlashcards = async () => {
    if (!selected || adding) return;
    setAdding(true);
    try {
      const hanzi = selected.hanzi ?? selected.text;
      await addFlashcard({
        hanzi,
        pinyin: selected.pinyin,
        translation: selectedTranslation || selected.translation,
        hskLevel: selected.level,
        language: 'zh',
      });
      setInFlashcards(true);
    } finally {
      setAdding(false);
    }
  };

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.surface,
          borderColor: theme.border,
        },
      ]}
    >
      <View style={styles.statsRow}>
        <Text style={[styles.statsText, { color: theme.textMuted }]}>
          Целевой HSK {analysis.targetLevel} · в словаре: {analysis.knownCount} · сложнее
          уровня: {analysis.aboveTargetCount}
        </Text>
      </View>

      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View
            style={[
              styles.legendDot,
              {
                backgroundColor: isDark ? 'rgba(208,255,0,0.25)' : 'rgba(208,255,0,0.4)',
                borderColor: theme.accentLime,
              },
            ]}
          />
          <Text style={[styles.legendLabel, { color: theme.textMuted }]}>
            В пределах уровня
          </Text>
        </View>
        <View style={styles.legendItem}>
          <View
            style={[
              styles.legendDot,
              {
                backgroundColor: isDark ? 'rgba(239,68,68,0.25)' : '#fee2e2',
                borderColor: isDark ? '#f87171' : '#fca5a5',
              },
            ]}
          />
          <Text style={[styles.legendLabel, { color: theme.textMuted }]}>
            Сложнее целевого уровня
          </Text>
        </View>
      </View>

      <View style={styles.textRow}>
        {analysis.words.map((word, index) => {
          if (!word.isChinese) {
            return (
              <Text
                key={`plain-${index}`}
                style={[styles.plainText, { color: theme.text }]}
              >
                {word.text}
              </Text>
            );
          }

          const isHard = word.isAboveTarget;
          const showRuby = word.pinyin && isHard;

          return (
            <Pressable
              key={`word-${index}-${word.text}`}
              onPress={(e) => handlePress(word, e.nativeEvent.pageX, e.nativeEvent.pageY)}
              style={styles.wordBlock}
            >
              {showRuby ? (
                <Text style={[styles.rubyPinyin, { color: theme.accentViolet }]}>
                  {word.pinyin}
                </Text>
              ) : null}
              <Text
                style={[
                  styles.wordText,
                  isHard
                    ? {
                        color: isDark ? '#fca5a5' : '#b91c1c',
                        backgroundColor: isDark
                          ? 'rgba(239,68,68,0.2)'
                          : '#fee2e2',
                        fontWeight: '700',
                      }
                    : {
                        color: isDark ? '#D0FF00' : '#166534',
                        backgroundColor: isDark
                          ? 'rgba(208,255,0,0.12)'
                          : '#f0fdf4',
                      },
                  word.level != null &&
                    !isHard && {
                      backgroundColor: getHskBadgeColors(word.level).background,
                    },
                ]}
              >
                {word.text}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {analysis.grammar && analysis.grammar.length > 0 ? (
        <View
          style={[styles.grammarSection, { borderTopColor: theme.border }]}
        >
          <Text style={[styles.grammarTitle, { color: theme.accentViolet }]}>
            Грамматические конструкции ({analysis.grammar.length})
          </Text>
          {analysis.grammar.map((g, i) => (
            <View
              key={`${g.structure}-${i}`}
              style={[
                styles.grammarCard,
                {
                  backgroundColor: isDark ? '#16161E' : '#f9fafb',
                  borderColor: theme.border,
                },
              ]}
            >
              <Text style={[styles.grammarStructure, { color: theme.accentLime }]}>
                {g.structure}
                {g.hskLevel != null ? ` · HSK ${g.hskLevel}` : ''}
              </Text>
              <Text style={[styles.grammarExplanation, { color: theme.textMuted }]}>
                {g.explanation}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      {selected ? (
        <Modal transparent visible animationType="fade" onRequestClose={() => setSelected(null)}>
          <Pressable
            style={[
              styles.overlay,
              {
                backgroundColor: isDark
                  ? 'rgba(13,13,17,0.6)'
                  : 'rgba(15,23,42,0.35)',
              },
            ]}
            onPress={() => setSelected(null)}
          >
            <Pressable
              style={[
                styles.popover,
                {
                  top: Math.min(popoverPos.y + 10, Dimensions.get('window').height - 420),
                  left: Math.min(Math.max(popoverPos.x - 140, 16), SCREEN_WIDTH - 296),
                  backgroundColor: theme.surface,
                  borderColor: theme.border,
                },
              ]}
              onPress={(e) => e.stopPropagation()}
            >
              <ScrollView
                nestedScrollEnabled
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                <Text style={[styles.popoverHanzi, { color: theme.text }]}>
                  {selected.hanzi ?? selected.text}
                </Text>
                {selected.pinyin?.trim() ? (
                  <Text style={[styles.popoverPinyin, { color: theme.accentViolet }]}>
                    {selected.pinyin}
                  </Text>
                ) : null}
                {selected.level != null ? (
                  <Text style={[styles.popoverLevel, { color: theme.textMuted }]}>
                    HSK {selected.level}
                  </Text>
                ) : null}
                {selectedTranslation ? (
                  <Text style={[styles.popoverTranslation, { color: theme.text }]}>
                    {selectedTranslation}
                  </Text>
                ) : translating ? (
                  <Text style={[styles.popoverTranslation, { color: theme.textMuted }]}>
                    Перевод…
                  </Text>
                ) : null}
                <Text style={[styles.popoverHint, { color: theme.danger }]}>
                  {selected.isAboveTarget
                    ? 'Сложнее выбранного целевого уровня'
                    : 'В пределах целевого уровня'}
                </Text>

                <Pressable
                  style={[
                    styles.studyButton,
                    { backgroundColor: theme.accentLime },
                    inFlashcards && {
                      backgroundColor: isDark ? '#2A2A3A' : '#e5e7eb',
                    },
                  ]}
                  onPress={handleAddToFlashcards}
                  disabled={inFlashcards || adding}
                >
                  <Text
                    style={[
                      styles.studyButtonText,
                      inFlashcards && {
                        color: isDark ? 'rgba(255,255,255,0.4)' : '#9ca3af',
                      },
                    ]}
                  >
                    {inFlashcards ? 'Уже в карточках' : adding ? 'Добавляем…' : '+ Учить'}
                  </Text>
                </Pressable>

                <CollectionWordPicker
                  hanzi={selected.hanzi ?? selected.text}
                  pinyin={selected.pinyin}
                  translation={selectedTranslation || selected.translation}
                  hskLevel={selected.level}
                  replaceMode
                />
              </ScrollView>
            </Pressable>
          </Pressable>
        </Modal>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    padding: IS_TABLET ? 24 : 16,
    borderWidth: 1,
    marginTop: 24,
  },
  statsRow: {
    marginBottom: 12,
  },
  statsText: {
    fontSize: 14,
    fontWeight: '600',
  },
  legend: {
    flexDirection: 'row',
    gap: 20,
    marginBottom: 16,
    flexWrap: 'wrap',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 1,
  },
  legendLabel: {
    fontSize: 13,
  },
  textRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-end',
  },
  plainText: {
    fontSize: IS_TABLET ? 24 : 20,
    lineHeight: IS_TABLET ? 40 : 34,
  },
  wordBlock: {
    alignItems: 'center',
    marginHorizontal: 1,
    marginBottom: 4,
  },
  rubyPinyin: {
    fontSize: 11,
    marginBottom: 2,
    fontWeight: '600',
  },
  wordText: {
    fontSize: IS_TABLET ? 26 : 22,
    lineHeight: IS_TABLET ? 38 : 32,
    paddingHorizontal: 3,
    borderRadius: 4,
  },
  overlay: {
    flex: 1,
  },
  popover: {
    position: 'absolute',
    width: 280,
    maxHeight: 400,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    ...softShadow({ y: 4, blur: 10, opacity: 0.2, elevation: 6 }),
  },
  popoverHanzi: {
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
  },
  popoverPinyin: {
    fontSize: 18,
    textAlign: 'center',
    marginTop: 6,
  },
  popoverLevel: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
    fontWeight: '600',
  },
  popoverTranslation: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 22,
    marginTop: 10,
  },
  popoverHint: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 10,
    fontWeight: '600',
  },
  studyButton: {
    marginTop: 14,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  studyButtonText: {
    color: '#0D0D11',
    fontSize: 15,
    fontWeight: '700',
  },
  grammarSection: {
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    gap: 10,
  },
  grammarTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  grammarCard: {
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  grammarStructure: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  grammarExplanation: {
    fontSize: 13,
    lineHeight: 19,
  },
});
