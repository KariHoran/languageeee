import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AuthStatusBar from '../components/AuthStatusBar';
import DesktopFolderLibrary from '../components/DesktopFolderLibrary';
import EditCollectionModal from '../components/EditCollectionModal';
import HskStatsBadge from '../components/HskStatsBadge';
import StarfieldBackground from '../components/StarfieldBackground';
import { useI18n } from '../i18n/useI18n';
import { resolveBookDisplayTitles } from '../utils/bookTitle';
import {
  deleteBook,
  deleteCollection,
  getBooks,
  getCollections,
  UNCATEGORIZED_COLLECTION_ID,
  updateCollection,
} from '../services/storageService';
import { subscribeLocalDataReset } from '../services/localDataResetService';
import { subscribeSyncState } from '../services/syncService';
import { useAppStore } from '../store/useAppStore';
import { useTheme } from '../theme/ThemeContext';
import { Book, Collection } from '../types';
import { softShadow } from '../utils/shadow';
import { showAlert, showConfirm } from '../utils/alert';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const IS_TABLET = SCREEN_WIDTH >= 768;

interface HomeScreenProps {
  onOpenBook: (bookId: string) => void;
  onAddBook: (opts?: {
    collectionId?: string;
    draftText?: string;
    draftTitle?: string;
  }) => void;
  onOpenFlashcards: () => void;
  onOpenCollection: (collectionId: string) => void;
  onOpenCatalog?: () => void;
  onOpenMyLibrary?: () => void;
}

export default function HomeScreen({
  onOpenBook,
  onAddBook,
  onOpenFlashcards,
  onOpenCollection,
  onOpenCatalog,
  onOpenMyLibrary,
}: HomeScreenProps) {
  const theme = useTheme();
  const { t, lang } = useI18n();
  const midnightMode = useAppStore((s) => s.midnightMode);
  const toggleMidnightMode = useAppStore((s) => s.toggleMidnightMode);
  const getBookStats = useAppStore((s) => s.getBookStats);

  const [books, setBooks] = useState<Book[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [menuCollection, setMenuCollection] = useState<Collection | null>(null);
  const [editCollection, setEditCollection] = useState<Collection | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    const [allBooks, allCollections] = await Promise.all([getBooks(), getCollections()]);
    setBooks(allBooks);
    setCollections(allCollections);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    return subscribeSyncState((state) => {
      if (state.status === 'synced') void loadData();
    });
  }, [loadData]);

  useEffect(() => {
    return subscribeLocalDataReset(() => {
      setBooks([]);
      setCollections([]);
      setSelectedCollectionId(null);
      setMenuCollection(null);
      setEditCollection(null);
      void loadData();
    });
  }, [loadData]);

  const folderInfos = useMemo(() => {
    return collections.map((col) => ({
      id: col.id,
      title: col.title,
      color: col.color ?? '#9ca3af',
      count: books.filter((b) => b.collectionId === col.id).length,
    }));
  }, [books, collections]);

  const filteredBooks =
    selectedCollectionId === null
      ? books
      : books.filter((b) => b.collectionId === selectedCollectionId);

  const getCollectionTitle = (collectionId?: string) => {
    if (!collectionId) return t('library.noCollection');
    return collections.find((c) => c.id === collectionId)?.title ?? t('library.noCollection');
  };

  const getCollectionColor = (collectionId?: string) => {
    if (!collectionId) return '#9ca3af';
    return collections.find((c) => c.id === collectionId)?.color ?? '#9ca3af';
  };

  const handleEditSave = async (patch: {
    title: string;
    color: string;
    isPublic?: boolean;
  }) => {
    if (!editCollection) return;
    await updateCollection(editCollection.id, {
      title: patch.title,
      color: patch.color,
    });
    if (typeof patch.isPublic === 'boolean') {
      try {
        const { setCollectionPublic } = await import(
          '../services/publicCollectionsService'
        );
        await setCollectionPublic(editCollection.id, patch.isPublic);
      } catch (err) {
        showAlert(
          t('alert.publish'),
          err instanceof Error ? err.message : String(err)
        );
      }
    }
    setEditCollection(null);
    await loadData();
  };

  const handleDelete = (col: Collection) => {
    setMenuCollection(null);
    if (col.id === UNCATEGORIZED_COLLECTION_ID) {
      showAlert(t('alert.noAccess'), t('alert.cannotDeleteSystem'));
      return;
    }

    showConfirm(
      t('alert.deleteCategory'),
      t('alert.deleteCategoryBody', { title: col.title }),
      async () => {
        try {
          await deleteCollection(col.id);
          if (selectedCollectionId === col.id) setSelectedCollectionId(null);
          await loadData();
        } catch (e) {
          showAlert(
            t('alert.error'),
            e instanceof Error ? e.message : t('alert.deleteFail')
          );
        }
      }
    );
  };

  const handleDeleteBook = (book: Book) => {
    showConfirm(
      t('alert.deleteFanfic'),
      t('alert.deleteFanficNamed', { title: book.title }),
      async () => {
        try {
          await deleteBook(book.id);
          await loadData();
        } catch (e) {
          showAlert(
            t('alert.error'),
            e instanceof Error ? e.message : t('alert.deleteFail')
          );
        }
      }
    );
  };

  const renderBookCard = ({ item }: { item: Book }) => {
    const bookStats = getBookStats(item.id);
    const recommended = bookStats?.recommendedHskLevel ?? item.targetHskLevel;
    const { original, native } = resolveBookDisplayTitles(item, lang);

    return (
      <View
        style={[
          styles.bookCard,
          {
            backgroundColor: theme.surface,
            borderColor: theme.border,
          },
          softShadow({
            color: theme.accentViolet,
            y: 4,
            blur: 10,
            opacity: 0.12,
            elevation: 3,
          }),
        ]}
      >
        <Pressable style={styles.bookCardPressable} onPress={() => onOpenBook(item.id)}>
          <View style={styles.bookCardHeader}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[styles.bookTitle, { color: theme.text }]} numberOfLines={2}>
                {original}
              </Text>
              {native ? (
                <Text
                  style={[styles.collectionName, { color: theme.textMuted, marginTop: 2 }]}
                  numberOfLines={1}
                >
                  {native}
                </Text>
              ) : null}
            </View>
            <View style={[styles.hskTag, { backgroundColor: theme.neonGlow }]}>
              <Text style={[styles.hskTagText, { color: theme.accent }]}>
                {t('catalog.hskLevel', {
                  n: recommended >= 7 ? '7+' : recommended,
                })}
              </Text>
            </View>
          </View>

          {bookStats?.hskStats ? (
            <View style={styles.bookStatsWrap}>
              <HskStatsBadge
                stats={bookStats.hskStats}
                readingTime={bookStats.readingTime}
                compact
              />
            </View>
          ) : null}

          <View style={styles.bookMeta}>
            <View
              style={[
                styles.collectionDot,
                { backgroundColor: getCollectionColor(item.collectionId) },
              ]}
            />
            <Text style={[styles.collectionName, { color: theme.textMuted }]}>
              {getCollectionTitle(item.collectionId)}
            </Text>
            <Text style={[styles.paragraphCount, { color: theme.textDim }]}>
              {t('library.paragraphs', { n: item.paragraphs.length })}
            </Text>
          </View>
        </Pressable>

        <Pressable
          style={[styles.deleteBookButton, { backgroundColor: theme.stickerPink }]}
          onPress={() => handleDeleteBook(item)}
          hitSlop={8}
        >
          <Text style={styles.deleteBookButtonText}>🗑️</Text>
        </Pressable>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
        <ActivityIndicator size="large" color={theme.accent} style={styles.loader} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.bg }]}
      edges={['top', 'bottom']}
    >
      <StarfieldBackground />
      <View style={{ flex: 1, zIndex: 1 }}>
        <View style={[styles.header, IS_TABLET && styles.headerTablet]}>
          <View style={styles.headerMain}>
            <View>
              <Text style={[styles.brand, { color: theme.accentViolet }]}>languageeee</Text>
              <Text style={[styles.screenTitle, { color: theme.text }]}>
                {t('nav.library')}
              </Text>
              <Text style={[styles.screenSubtitle, { color: theme.textMuted }]}>
                {t('home.tagline')}
              </Text>
            </View>
            <AuthStatusBar />
          </View>
          <View style={styles.headerActions}>
            <Pressable
              style={[
                styles.midnightBtn,
                {
                  backgroundColor: midnightMode ? theme.accentViolet : theme.surfaceGlass,
                  borderColor: theme.accentLime,
                },
              ]}
              onPress={toggleMidnightMode}
            >
              <Text style={[styles.midnightBtnText, { color: theme.text }]}>
                {midnightMode ? '🌙 Midnight' : '☀️ Aqua'}
              </Text>
            </Pressable>
            {onOpenMyLibrary ? (
              <Pressable
                style={[styles.flashcardsButton, { borderColor: theme.accentViolet }]}
                onPress={onOpenMyLibrary}
              >
                <Text style={[styles.flashcardsButtonText, { color: theme.accentViolet }]}>
                  📚 {t('nav.library')}
                </Text>
              </Pressable>
            ) : null}
            {onOpenCatalog ? (
              <Pressable
                style={[styles.flashcardsButton, { borderColor: theme.accentLime }]}
                onPress={onOpenCatalog}
              >
                <Text style={[styles.flashcardsButtonText, { color: theme.accentLime }]}>
                  ✨ {t('nav.explore')}
                </Text>
              </Pressable>
            ) : null}
            <Pressable
              style={[styles.flashcardsButton, { borderColor: theme.accentPink }]}
              onPress={onOpenFlashcards}
            >
              <Text style={[styles.flashcardsButtonText, { color: theme.accentPink }]}>
                🌸 {t('nav.flashcards')}
              </Text>
            </Pressable>
            <Pressable
              style={[styles.addButton, { backgroundColor: theme.accent }]}
              onPress={() =>
                onAddBook({ collectionId: selectedCollectionId ?? undefined })
              }
            >
              <Text style={styles.addButtonText}>+ {t('action.addFanfic')}</Text>
            </Pressable>
          </View>
        </View>

        <FlatList
          data={filteredBooks}
          keyExtractor={(item) => item.id}
          renderItem={renderBookCard}
          numColumns={IS_TABLET ? 2 : 1}
          key={IS_TABLET ? 'tablet' : 'phone'}
          columnWrapperStyle={IS_TABLET ? styles.bookRow : undefined}
          contentContainerStyle={styles.bookList}
          ListHeaderComponent={
            <DesktopFolderLibrary
              folders={folderInfos}
              selectedId={selectedCollectionId}
              onSelectFolder={setSelectedCollectionId}
              onOpenFolder={onOpenCollection}
              onFilesDropped={({ text, fileName, folderId }) => {
                const title = fileName.replace(/\.(txt|md|pdf)$/i, '') || t('home.importTitle');
                onAddBook({
                  collectionId: folderId ?? undefined,
                  draftText: text,
                  draftTitle: title,
                });
              }}
            />
          }
          ListEmptyComponent={
            <View
              style={[
                styles.emptyState,
                {
                  backgroundColor: theme.surfaceGlass,
                  borderColor: theme.border,
                  borderWidth: 1,
                  borderRadius: 24,
                  marginHorizontal: 8,
                },
              ]}
            >
              <Text style={styles.emptyEmoji}>☁️</Text>
              <Text style={[styles.emptyTitle, { color: theme.accentPink }]}>
                {t('empty.libraryTitle')}
              </Text>
              <Text style={[styles.emptyText, { color: theme.textMuted }]}>
                {t('empty.libraryDesc')}
              </Text>
              <Pressable
                style={[styles.emptyButton, { backgroundColor: theme.accentLime }]}
                onPress={() => onAddBook()}
              >
                <Text style={[styles.emptyButtonText, { color: '#0D0D11' }]}>
                  {t('empty.libraryAction')}
                </Text>
              </Pressable>
            </View>
          }
        />
      </View>

      <Modal
        visible={menuCollection != null}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuCollection(null)}
      >
        <Pressable style={styles.menuOverlay} onPress={() => setMenuCollection(null)}>
          <Pressable
            style={[styles.menuSheet, { backgroundColor: theme.surface }]}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={[styles.menuTitle, { color: theme.textMuted }]} numberOfLines={1}>
              {menuCollection?.title}
            </Text>
            <Pressable
              style={styles.menuItem}
              onPress={() => {
                if (!menuCollection) return;
                const id = menuCollection.id;
                setMenuCollection(null);
                onOpenCollection(id);
              }}
            >
              <Text style={[styles.menuItemText, { color: theme.text }]}>
                {t('action.open')}
              </Text>
            </Pressable>
            <Pressable
              style={styles.menuItem}
              onPress={() => {
                if (!menuCollection) return;
                setEditCollection(menuCollection);
                setMenuCollection(null);
              }}
            >
              <Text style={[styles.menuItemText, { color: theme.text }]}>
                {t('action.edit')}
              </Text>
            </Pressable>
            {menuCollection?.id !== UNCATEGORIZED_COLLECTION_ID && (
                <Pressable
                  style={styles.menuItem}
                  onPress={() => menuCollection && handleDelete(menuCollection)}
                >
                  <Text style={[styles.menuItemText, { color: theme.danger }]}>
                    {t('action.delete')}
                  </Text>
                </Pressable>
              )}
            <Pressable style={styles.menuCancel} onPress={() => setMenuCollection(null)}>
              <Text style={[styles.menuCancelText, { color: theme.textMuted }]}>
                {t('action.cancel')}
              </Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <EditCollectionModal
        visible={editCollection != null}
        collection={editCollection}
        onClose={() => setEditCollection(null)}
        onSave={handleEditSave}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loader: { flex: 1, justifyContent: 'center' },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    gap: 16,
  },
  headerTablet: { paddingHorizontal: 40 },
  headerMain: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  brand: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  screenTitle: {
    fontSize: IS_TABLET ? 32 : 26,
    fontWeight: '800',
  },
  screenSubtitle: { fontSize: 13, marginTop: 4 },
  headerActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    alignItems: 'center',
  },
  midnightBtn: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1.5,
  },
  midnightBtnText: { fontSize: 13, fontWeight: '700' },
  flashcardsButton: {
    backgroundColor: 'transparent',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1.5,
  },
  flashcardsButtonText: { fontSize: 14, fontWeight: '700' },
  addButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  addButtonText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  bookList: { padding: 20, paddingTop: 4, paddingBottom: 100 },
  bookRow: { gap: 16 },
  bookCard: {
    flex: 1,
    flexDirection: 'row',
    borderRadius: 14,
    marginBottom: 14,
    borderWidth: 1,
    overflow: 'hidden',
  },
  bookCardPressable: { flex: 1, padding: 18, paddingRight: 12 },
  bookCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 8,
  },
  bookStatsWrap: { marginBottom: 10 },
  bookTitle: { flex: 1, fontSize: 17, fontWeight: '700' },
  hskTag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  hskTagText: { fontSize: 12, fontWeight: '700' },
  deleteBookButton: {
    width: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteBookButtonText: { fontSize: 18 },
  bookMeta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  collectionDot: { width: 8, height: 8, borderRadius: 4 },
  collectionName: { fontSize: 13, flex: 1 },
  paragraphCount: { fontSize: 12 },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 32,
  },
  emptyEmoji: { fontSize: 40, marginBottom: 12 },
  emptyTitle: { fontSize: 20, fontWeight: '700', marginBottom: 8 },
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
  emptyButtonText: { fontSize: 15, fontWeight: '700' },
  menuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
    padding: 16,
  },
  menuSheet: {
    borderRadius: 16,
    paddingVertical: 8,
    paddingHorizontal: 8,
    maxWidth: 420,
    width: '100%',
    alignSelf: 'center',
    marginBottom: 24,
  },
  menuTitle: {
    fontSize: 15,
    fontWeight: '700',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  menuItem: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 10,
  },
  menuItemText: { fontSize: 17, fontWeight: '600' },
  menuCancel: {
    marginTop: 4,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  menuCancelText: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
});
