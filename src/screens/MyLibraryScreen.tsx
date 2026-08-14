import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { useI18n } from '../i18n/useI18n';
import {
  createUserCollection,
  deleteBook,
  getBooks,
  getCollections,
  UNCATEGORIZED_COLLECTION_ID,
  updateBookMeta,
} from '../services/storageService';
import { canEditCollection } from '../services/rbac';
import { canEditBook } from '../services/rbac';
import { subscribeLocalDataReset } from '../services/localDataResetService';
import { subscribeSyncState } from '../services/syncService';
import { useTheme } from '../theme/ThemeContext';
import type { Book, Collection, LearningLanguage } from '../types';
import { bookMatchesQuery } from '../utils/bookSearch';
import {
  resolveBookDisplayTitles,
} from '../utils/bookTitle';
import { showAlert, showConfirm } from '../utils/alert';
import { HighlightTextNative } from '../utils/searchHighlight';

const SEARCH_DEBOUNCE_MS = 400;

interface MyLibraryScreenProps {
  preferredLanguage?: LearningLanguage;
  onBack: () => void;
  onOpenBook: (book: Book) => void;
  onAddBook: (collectionId?: string) => void;
}

/** Нативный экран «Моя библиотека» */
export default function MyLibraryScreen({
  preferredLanguage = 'zh',
  onBack,
  onOpenBook,
  onAddBook,
}: MyLibraryScreenProps) {
  const theme = useTheme();
  const { t, lang } = useI18n();
  const [books, setBooks] = useState<Book[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [categoryId, setCategoryId] = useState<string | 'all'>('all');
  const [langFilter, setLangFilter] = useState<LearningLanguage | 'all'>(
    preferredLanguage
  );
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebouncedValue(query, SEARCH_DEBOUNCE_MS);
  const [newCat, setNewCat] = useState('');

  const reload = useCallback(async () => {
    const [b, c] = await Promise.all([getBooks(), getCollections()]);
    setBooks(b);
    setCollections(c);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    return subscribeSyncState((state) => {
      if (state.status === 'synced') void reload();
    });
  }, [reload]);

  useEffect(() => {
    return subscribeLocalDataReset(() => {
      setBooks([]);
      setCollections([]);
      setCategoryId('all');
      void reload();
    });
  }, [reload]);

  useEffect(() => {
    setLangFilter(preferredLanguage);
  }, [preferredLanguage]);

  const visible = useMemo(() => {
    const q = debouncedQuery.trim();
    return books.filter((book) => {
      const lang =
        book.language === 'en'
          ? 'en'
          : book.language === 'ru'
            ? 'ru'
            : 'zh';
      if (langFilter !== 'all' && lang !== langFilter) return false;
      const cid = book.collectionId || UNCATEGORIZED_COLLECTION_ID;
      if (categoryId !== 'all' && cid !== categoryId) return false;
      return bookMatchesQuery(book, q);
    });
  }, [books, langFilter, categoryId, debouncedQuery]);

  const colTitle = (id?: string) =>
    collections.find((c) => c.id === (id || UNCATEGORIZED_COLLECTION_ID))?.title ??
    t('library.allBooks');

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable onPress={onBack}>
          <Text style={[styles.back, { color: theme.accent }]}>
            ← {t('action.back')}
          </Text>
        </Pressable>
        <Text style={[styles.title, { color: theme.text }]}>{t('nav.library')}</Text>
      </View>

      <View style={styles.actions}>
        <Pressable
          style={[styles.primary, { backgroundColor: theme.accentLime }]}
          onPress={() =>
            onAddBook(categoryId !== 'all' ? categoryId : undefined)
          }
        >
          <Text style={styles.primaryText}>+ {t('action.addFanfic')}</Text>
        </Pressable>
      </View>

      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder={t('library.searchPlaceholder')}
        placeholderTextColor={theme.textDim}
        style={[
          styles.search,
          { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text },
        ]}
      />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        <Pressable
          onPress={() => setCategoryId('all')}
          style={[
            styles.chip,
            {
              borderColor: categoryId === 'all' ? theme.accentLime : theme.border,
              backgroundColor:
                categoryId === 'all' ? theme.accentLime : 'transparent',
            },
          ]}
        >
          <Text
            style={{
              color: categoryId === 'all' ? '#0D0D11' : theme.textMuted,
              fontWeight: '700',
              fontSize: 12,
            }}
          >
            {t('folder.all')}
          </Text>
        </Pressable>
        {collections.map((col) => (
          <Pressable
            key={col.id}
            onPress={() => setCategoryId(col.id)}
            style={[
              styles.chip,
              {
                borderColor: categoryId === col.id ? theme.accentLime : theme.border,
                backgroundColor:
                  categoryId === col.id ? theme.accentLime : 'transparent',
              },
            ]}
          >
            <Text
              style={{
                color: categoryId === col.id ? '#0D0D11' : theme.textMuted,
                fontWeight: '700',
                fontSize: 12,
              }}
            >
              {col.title}
              {col.isPublic ? t('library.publicShort') : ''}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
      <View style={styles.newCatRow}>
        <TextInput
          value={newCat}
          onChangeText={setNewCat}
          placeholder={t('library.newCategory')}
          placeholderTextColor={theme.textDim}
          style={[
            styles.newCatInput,
            { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text },
          ]}
        />
        <Pressable
          style={[styles.newCatBtn, { backgroundColor: theme.accentViolet }]}
          onPress={() => {
            void (async () => {
              if (!newCat.trim()) return;
              const col = await createUserCollection(newCat.trim());
              setNewCat('');
              setCategoryId(col.id);
              await reload();
            })();
          }}
        >
          <Text style={styles.newCatBtnText}>+</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.list}>
        {visible.length === 0 ? (
          <View
            style={[
              styles.emptyState,
              {
                backgroundColor: theme.surfaceGlass,
                borderColor: theme.border,
                borderWidth: 1,
              },
            ]}
          >
            <Text style={styles.emptyEmoji}>☁️</Text>
            <Text style={[styles.emptyTitle, { color: theme.accentPink }]}>
              {t('empty.libraryTitle')}
            </Text>
            <Text style={[styles.emptyText, { color: theme.textMuted }]}>
              {books.length === 0
                ? t('empty.libraryDesc')
                : t('library.nothingFoundHint')}
            </Text>
            <Pressable
              style={[styles.emptyButton, { backgroundColor: theme.accentLime }]}
              onPress={() =>
                books.length === 0
                  ? onAddBook(
                      categoryId !== 'all' ? categoryId : undefined
                    )
                  : setCategoryId('all')
              }
            >
              <Text style={styles.emptyButtonText}>
                {books.length === 0
                  ? t('empty.libraryAction')
                  : t('library.resetFilters')}
              </Text>
            </Pressable>
          </View>
        ) : (
          visible.map((book) => (
          <View
            key={book.id}
            style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}
          >
            <Pressable onPress={() => onOpenBook(book)}>
              {(() => {
                const { original, native } = resolveBookDisplayTitles(book, lang);
                return (
                  <>
                    <HighlightTextNative
                      text={original}
                      query={debouncedQuery}
                      style={[styles.cardTitle, { color: theme.text }]}
                    />
                    {native ? (
                      <HighlightTextNative
                        text={native}
                        query={debouncedQuery}
                        style={[styles.meta, { color: theme.textMuted }]}
                      />
                    ) : null}
                  </>
                );
              })()}
              <Text style={[styles.meta, { color: theme.textMuted }]}>
                {(book.language ?? 'zh').toUpperCase()} · {colTitle(book.collectionId)} ·{' '}
                {t('library.paragraphs', { n: book.paragraphs.length })}
              </Text>
            </Pressable>
            <View style={styles.row}>
              <Pressable
                style={[styles.smallBtn, { backgroundColor: theme.accentLime }]}
                onPress={() => onOpenBook(book)}
              >
                <Text style={styles.smallBtnText}>{t('action.read')}</Text>
              </Pressable>
              {canEditBook(book) ? (
                <Pressable
                  style={[styles.smallBtnOutline, { borderColor: theme.border }]}
                  onPress={() => {
                    showConfirm(
                      t('alert.deleteFanfic'),
                      t('alert.deleteFanficBody'),
                      () => {
                      void (async () => {
                        await deleteBook(book.id);
                        await reload();
                      })();
                    });
                  }}
                >
                  <Text style={{ color: theme.danger, fontWeight: '700' }}>
                    {t('action.delete')}
                  </Text>
                </Pressable>
              ) : null}
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
              {collections.filter((col) => canEditCollection(col)).map((col) => (
                <Pressable
                  key={col.id}
                  onPress={() => {
                    void updateBookMeta(book.id, { collectionId: col.id }).then(reload);
                  }}
                  style={[
                    styles.moveChip,
                    {
                      borderColor: theme.border,
                      backgroundColor:
                        (book.collectionId || UNCATEGORIZED_COLLECTION_ID) === col.id
                          ? 'rgba(208,255,0,0.2)'
                          : 'transparent',
                    },
                  ]}
                >
                  <Text style={{ color: theme.textMuted, fontSize: 11 }}>
                    {col.title}
                    {col.isPublic ? t('library.publicShort') : ''}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingTop: 8 },
  back: { fontSize: 15, fontWeight: '600', marginBottom: 6 },
  title: { fontSize: 24, fontWeight: '800', marginBottom: 10 },
  actions: { paddingHorizontal: 20, marginBottom: 8 },
  primary: { borderRadius: 14, paddingVertical: 12, alignItems: 'center' },
  primaryText: { color: '#0D0D11', fontWeight: '800' },
  search: {
    marginHorizontal: 20,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
  },
  chips: { paddingHorizontal: 20, gap: 8, paddingBottom: 8 },
  chip: {
    borderWidth: 1.5,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  newCatRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 8,
    marginBottom: 8,
  },
  newCatInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  newCatBtn: {
    width: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  newCatBtnText: { color: '#fff', fontWeight: '800', fontSize: 18 },
  list: { padding: 20, gap: 12, paddingBottom: 40 },
  card: { borderRadius: 16, borderWidth: 1, padding: 14 },
  cardTitle: { fontSize: 16, fontWeight: '700' },
  meta: { fontSize: 12, marginTop: 4 },
  row: { flexDirection: 'row', gap: 8, marginTop: 10 },
  smallBtn: {
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  smallBtnText: { color: '#0D0D11', fontWeight: '800', fontSize: 13 },
  smallBtnOutline: {
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
  },
  moveChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginRight: 6,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 24,
    borderRadius: 24,
  },
  emptyEmoji: { fontSize: 40, marginBottom: 12 },
  emptyTitle: { fontSize: 20, fontWeight: '700', marginBottom: 8, textAlign: 'center' },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 20,
  },
  emptyButton: {
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 14,
  },
  emptyButtonText: { color: '#0D0D11', fontSize: 15, fontWeight: '700' },
});
