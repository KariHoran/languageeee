import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getCatalogTagOptions } from '../data/catalogStories';
import {
  catalogCategoryOptions,
  catalogLanguageLabel,
  catalogLanguageOptions,
  catalogLevelOptions,
  catalogStoryCardTitles,
  catalogStoryDescription,
  catalogStoryLevelLabel,
  catalogTagLabel,
} from '../i18n/catalogI18n';
import { useI18n } from '../i18n/useI18n';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import {
  getCatalogStories,
  importCatalogStory,
} from '../services/catalogService';
import { getBooks } from '../services/storageService';
import { useAppStore } from '../store/useAppStore';
import { useTheme } from '../theme/ThemeContext';
import type {
  Book,
  CatalogCategoryId,
  CatalogLevelId,
  CatalogStory,
  LearningLanguage,
} from '../types';
import { HighlightTextNative } from '../utils/searchHighlight';

const SEARCH_DEBOUNCE_MS = 400;

interface CatalogScreenProps {
  preferredLanguage?: LearningLanguage;
  onBack: () => void;
  onOpenBook: (book: Book) => void;
}

const TONE: Record<CatalogStory['coverTone'], string> = {
  sky: '#0369a1',
  rose: '#be123c',
  lime: '#65a30d',
  amber: '#d97706',
  violet: '#6d28d9',
  teal: '#0f766e',
};

/** Нативный экран публичного каталога историй */
export default function CatalogScreen({
  preferredLanguage = 'zh',
  onBack,
  onOpenBook,
}: CatalogScreenProps) {
  const theme = useTheme();
  const { t } = useI18n();
  const uiLang = useAppStore((s) => s.nativeLanguage);
  const [language, setLanguage] = useState<LearningLanguage | 'all'>(
    preferredLanguage
  );
  const [level, setLevel] = useState<CatalogLevelId | 'all'>('all');
  const [category, setCategory] = useState<CatalogCategoryId | 'all'>('all');
  const [tag, setTag] = useState<string | 'all'>('all');
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebouncedValue(query, SEARCH_DEBOUNCE_MS);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [owned, setOwned] = useState<Set<string>>(new Set());

  const tagOptions = useMemo(() => getCatalogTagOptions(), []);
  const languageOptions = useMemo(() => catalogLanguageOptions(uiLang), [uiLang]);
  const levelOptions = useMemo(() => catalogLevelOptions(uiLang), [uiLang]);
  const categoryOptions = useMemo(() => catalogCategoryOptions(uiLang), [uiLang]);

  useEffect(() => {
    setLanguage(preferredLanguage);
  }, [preferredLanguage]);

  useEffect(() => {
    void (async () => {
      const books = await getBooks();
      const ids = new Set<string>();
      for (const b of books) {
        if (b.catalogId) ids.add(b.catalogId);
      }
      setOwned(ids);
    })();
  }, []);

  const stories = useMemo(
    () =>
      getCatalogStories({
        language,
        level,
        category,
        tag,
        query: debouncedQuery,
      }),
    [language, level, category, tag, debouncedQuery]
  );
  const handleImport = useCallback(
    async (story: CatalogStory, open: boolean) => {
      if (busyId) return;
      setBusyId(story.id);
      try {
        const book = await importCatalogStory(story.id);
        setOwned((prev) => new Set(prev).add(story.id));
        if (open) onOpenBook(book);
      } catch (err) {
        console.error('[CatalogScreen] import failed', err);
      } finally {
        setBusyId(null);
      }
    },
    [busyId, onOpenBook]
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable onPress={onBack}>
          <Text style={[styles.back, { color: theme.accent }]}>
            ← {t('action.back')}
          </Text>
        </Pressable>
        <Text style={[styles.title, { color: theme.text }]}>{t('catalog.title')}</Text>
        <Text style={[styles.sub, { color: theme.textMuted }]}>
          {t('catalog.subtitle')}
        </Text>
      </View>

      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder={t('catalog.searchPlaceholder')}
        placeholderTextColor={theme.textDim}
        style={[
          styles.search,
          {
            backgroundColor: theme.surface,
            borderColor: theme.border,
            color: theme.text,
          },
        ]}
      />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsRow} contentContainerStyle={styles.chipsContent}>
        {languageOptions.map((opt) => (
          <Pressable
            key={opt.id}
            onPress={() => setLanguage(opt.id)}
            style={[
              styles.chip,
              {
                borderColor: language === opt.id ? theme.accentLime : theme.border,
                backgroundColor:
                  language === opt.id ? theme.accentLime : 'transparent',
              },
            ]}
          >
            <Text
              style={{
                color: language === opt.id ? '#0D0D11' : theme.textMuted,
                fontWeight: '700',
                fontSize: 12,
              }}
            >
              {opt.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsRow} contentContainerStyle={styles.chipsContent}>
        {levelOptions.map((opt) => (
          <Pressable
            key={opt.id}
            onPress={() => setLevel(opt.id)}
            style={[
              styles.chip,
              {
                borderColor: level === opt.id ? theme.accentPink : theme.border,
                backgroundColor:
                  level === opt.id ? 'rgba(236,72,153,0.15)' : 'transparent',
              },
            ]}
          >
            <Text
              style={{
                color: level === opt.id ? theme.accentPink : theme.textMuted,
                fontWeight: '700',
                fontSize: 12,
              }}
            >
              {opt.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsRow} contentContainerStyle={styles.chipsContent}>
        {categoryOptions.map((opt) => (
          <Pressable
            key={opt.id}
            onPress={() => setCategory(opt.id)}
            style={[
              styles.chip,
              {
                borderColor: category === opt.id ? theme.accentViolet : theme.border,
                backgroundColor:
                  category === opt.id ? 'rgba(139,92,246,0.15)' : 'transparent',
              },
            ]}
          >
            <Text
              style={{
                color: category === opt.id ? theme.accentViolet : theme.textMuted,
                fontWeight: '700',
                fontSize: 12,
              }}
            >
              {opt.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {tagOptions.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.chipsRow}
          contentContainerStyle={styles.chipsContent}
        >
          <Pressable
            onPress={() => setTag('all')}
            style={[
              styles.chip,
              {
                borderColor: tag === 'all' ? theme.accentLime : theme.border,
                backgroundColor:
                  tag === 'all' ? 'rgba(208,255,0,0.2)' : 'transparent',
              },
            ]}
          >
            <Text
              style={{
                color: tag === 'all' ? theme.accentLime : theme.textMuted,
                fontWeight: '700',
                fontSize: 12,
              }}
            >
              {t('catalog.allTags')}
            </Text>
          </Pressable>
          {tagOptions.map((tagId) => (
            <Pressable
              key={tagId}
              onPress={() => setTag(tag === tagId ? 'all' : tagId)}
              style={[
                styles.chip,
                {
                  borderColor: tag === tagId ? theme.accentLime : theme.border,
                  backgroundColor:
                    tag === tagId ? theme.accentLime : 'transparent',
                },
              ]}
            >
              <Text
                style={{
                  color: tag === tagId ? '#0D0D11' : theme.textMuted,
                  fontWeight: '700',
                  fontSize: 12,
                }}
              >
                {catalogTagLabel(tagId, uiLang)}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      ) : null}
      <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
        {stories.map((story) => {
          const isOwned = owned.has(story.id);
          const busy = busyId === story.id;
          const { primary, secondary } = catalogStoryCardTitles(story, uiLang);
          const description = catalogStoryDescription(story, uiLang);
          return (
            <View
              key={`${story.id}-${uiLang}`}
              style={[
                styles.card,
                { backgroundColor: theme.surface, borderColor: theme.border },
              ]}
            >
              <View style={[styles.cover, { backgroundColor: TONE[story.coverTone] }]}>
                <Text style={styles.coverEmoji}>{story.coverEmoji}</Text>
                <Text style={styles.coverLang}>
                  {catalogLanguageLabel(story.language, uiLang)}
                </Text>
              </View>
              <View style={styles.body}>
                <HighlightTextNative
                  text={primary}
                  query={debouncedQuery}
                  style={[styles.cardTitle, { color: theme.text }]}
                />
                {secondary ? (
                  <HighlightTextNative
                    text={secondary}
                    query={debouncedQuery}
                    style={[styles.cardTitleRu, { color: theme.textMuted }]}
                  />
                ) : null}
                <Text style={[styles.meta, { color: theme.textMuted }]}>
                  {catalogStoryLevelLabel(story, uiLang)}
                  {isOwned ? ` · ${t('catalog.inLibrary')}` : ''}
                </Text>
                <View style={styles.tagsRow}>
                  {(story.tags ?? []).slice(0, 3).map((tagId) => (
                    <Pressable
                      key={tagId}
                      onPress={() => setTag(tag === tagId ? 'all' : tagId)}
                      style={[
                        styles.tag,
                        {
                          borderColor:
                            tag === tagId ? theme.accentLime : theme.border,
                          backgroundColor:
                            tag === tagId
                              ? 'rgba(208,255,0,0.2)'
                              : 'transparent',
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.tagText,
                          {
                            color: theme.accentLime,
                          },
                        ]}
                      >
                        {catalogTagLabel(tagId, uiLang)}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                {description ? (
                  <HighlightTextNative
                    text={description}
                    query={debouncedQuery}
                    style={[styles.desc, { color: theme.textMuted }]}
                  />
                ) : null}
                <View style={styles.actions}>
                  <Pressable
                    style={[styles.primaryBtn, { backgroundColor: theme.accentLime }]}
                    disabled={!!busyId}
                    onPress={() => void handleImport(story, !isOwned ? false : true)}
                  >
                    {busy ? (
                      <ActivityIndicator color="#0D0D11" />
                    ) : (
                      <Text style={styles.primaryBtnText}>
                        {isOwned ? t('action.read') : t('catalog.addToLibrary')}
                      </Text>
                    )}
                  </Pressable>
                  {!isOwned ? (
                    <Pressable
                      style={[styles.secondaryBtn, { borderColor: theme.border }]}
                      disabled={!!busyId}
                      onPress={() => void handleImport(story, true)}
                    >
                      <Text style={[styles.secondaryBtnText, { color: theme.text }]}>
                        {t('catalog.addAndRead')}
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
              </View>
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4 },
  back: { fontSize: 15, fontWeight: '600', marginBottom: 6 },
  title: { fontSize: 24, fontWeight: '800' },
  sub: { marginTop: 4, fontSize: 13, marginBottom: 8 },
  search: {
    marginHorizontal: 20,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    marginBottom: 8,
  },
  chipsRow: { maxHeight: 44, marginBottom: 6 },
  chipsContent: { paddingHorizontal: 20, gap: 8, alignItems: 'center' },
  chip: {
    borderWidth: 1.5,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  list: { padding: 20, paddingBottom: 40, gap: 12 },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  cover: {
    height: 88,
    padding: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  coverEmoji: { fontSize: 32 },
  coverLang: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 11,
    backgroundColor: 'rgba(0,0,0,0.35)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    overflow: 'hidden',
  },
  body: { padding: 14, gap: 6 },
  cardTitle: { fontSize: 16, fontWeight: '700' },
  cardTitleRu: { fontSize: 13, fontWeight: '600', marginTop: -2 },
  meta: { fontSize: 12, fontWeight: '600' },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  tagText: { fontSize: 10, fontWeight: '700' },
  desc: { fontSize: 13, lineHeight: 18 },
  actions: { marginTop: 8, gap: 8 },
  primaryBtn: {
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryBtnText: { color: '#0D0D11', fontWeight: '800', fontSize: 14 },
  secondaryBtn: {
    borderRadius: 12,
    paddingVertical: 11,
    alignItems: 'center',
    borderWidth: 1,
  },
  secondaryBtnText: { fontWeight: '700', fontSize: 13 },
});
