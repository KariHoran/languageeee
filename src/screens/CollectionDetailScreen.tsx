import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import EditCollectionModal from '../components/EditCollectionModal';
import { lookupBkrs } from '../services/bkrsService';
import {
  getWordsInCollection,
  removeWordFromCollection,
} from '../services/collectionsStore';
import { canEditCollection } from '../services/rbac';
import {
  deleteCollection,
  getBooksByCollection,
  getCollection,
  UNCATEGORIZED_COLLECTION_ID,
  updateCollection,
} from '../services/storageService';
import { Collection, CollectionWord } from '../types';
import { showAlert, showConfirm } from '../utils/alert';
import { getHskBadgeColors } from '../utils/hskColors';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const IS_TABLET = SCREEN_WIDTH >= 768;

interface CollectionDetailScreenProps {
  collectionId: string;
  onBack: () => void;
  onOpenBook?: (bookId: string) => void;
}

export default function CollectionDetailScreen({
  collectionId,
  onBack,
}: CollectionDetailScreenProps) {
  const [collection, setCollection] = useState<Collection | null>(null);
  const [words, setWords] = useState<CollectionWord[]>([]);
  const [bookCount, setBookCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [col, wordList, books] = await Promise.all([
      getCollection(collectionId),
      getWordsInCollection(collectionId),
      getBooksByCollection(collectionId),
    ]);
    setCollection(col);
    setWords(wordList);
    setBookCount(books.length);
    setLoading(false);
  }, [collectionId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleRemove = (hanzi: string) => {
    showConfirm(
      'Удалить из подборки?',
      `Слово «${hanzi}» будет убрано из этой подборки.`,
      async () => {
        await removeWordFromCollection(hanzi, collectionId);
        setWords((prev) => prev.filter((w) => w.hanzi !== hanzi));
      },
      'Удалить'
    );
  };

  const handleEditSave = async (patch: {
    title: string;
    color: string;
    isPublic?: boolean;
  }) => {
    if (!canEditCollection(collection)) {
      showAlert('Нет доступа', 'Изменять подборку может только автор.');
      return;
    }
    await updateCollection(collectionId, {
      title: patch.title,
      color: patch.color,
    });
    if (typeof patch.isPublic === 'boolean') {
      try {
        const { setCollectionPublic } = await import(
          '../services/publicCollectionsService'
        );
        await setCollectionPublic(collectionId, patch.isPublic);
      } catch (err) {
        showAlert(
          'Публикация',
          err instanceof Error ? err.message : String(err)
        );
      }
    }
    setEditOpen(false);
    await load();
  };

  const handleDeleteCollection = () => {
    if (!canEditCollection(collection)) {
      showAlert('Нет доступа', 'Удалять подборку может только автор.');
      return;
    }
    if (collectionId === UNCATEGORIZED_COLLECTION_ID) {
      showAlert('Нельзя удалить', 'Системную подборку «Без категории» удалить нельзя.');
      return;
    }

    showConfirm(
      'Вы уверены?',
      `Подборка «${collection?.title ?? ''}» будет удалена. Тексты останутся в библиотеке без категории.`,
      async () => {
        try {
          await deleteCollection(collectionId);
          onBack();
        } catch (e) {
          showAlert('Ошибка', e instanceof Error ? e.message : 'Не удалось удалить подборку');
        }
      }
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <ActivityIndicator size="large" color="#4a90d9" style={styles.loader} />
      </SafeAreaView>
    );
  }

  const isOwner = canEditCollection(collection);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Pressable onPress={onBack} style={styles.backButton}>
            <Text style={styles.backButtonText}>← Назад</Text>
          </Pressable>
          {isOwner ? (
            <View style={styles.headerActions}>
              <Pressable style={styles.headerAction} onPress={() => setEditOpen(true)}>
                <Text style={styles.headerActionText}>Изменить</Text>
              </Pressable>
              {collectionId !== UNCATEGORIZED_COLLECTION_ID && (
                <Pressable style={styles.headerAction} onPress={handleDeleteCollection}>
                  <Text style={[styles.headerActionText, styles.headerActionDanger]}>Удалить</Text>
                </Pressable>
              )}
            </View>
          ) : null}
        </View>
        <View style={styles.titleRow}>
          <View
            style={[
              styles.colorBar,
              { backgroundColor: collection?.color ?? '#6b7280' },
            ]}
          />
          <View style={styles.titleBlock}>
            <Text style={styles.title}>{collection?.title ?? 'Подборка'}</Text>
            <View style={styles.badgeRow}>
              {collection?.isPublic ? (
                <View style={styles.badgePublic}>
                  <Text style={styles.badgePublicText}>Публичная</Text>
                </View>
              ) : (
                <View style={styles.badgePrivate}>
                  <Text style={styles.badgePrivateText}>Авторская</Text>
                </View>
              )}
            </View>
            <Text style={styles.subtitle}>
              Слов: {words.length} · Фанфиков: {bookCount}
              {!isOwner ? ' · только чтение' : ''}
            </Text>
          </View>
        </View>
      </View>
      <FlatList
        data={words}
        keyExtractor={(item) => item.hanzi}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>Пока нет слов</Text>
            <Text style={styles.emptyText}>
              Добавляйте слова из ридера или анализа текста через «Добавить в подборку».
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const translation =
            lookupBkrs(item.hanzi)?.trim() || item.translation || '—';
          const hskColors =
            item.hskLevel != null ? getHskBadgeColors(item.hskLevel) : null;

          return (
            <View style={styles.wordCard}>
              <View style={styles.wordMain}>
                <View style={styles.wordHeader}>
                  <Text style={styles.hanzi}>{item.hanzi}</Text>
                  {item.hskLevel != null && hskColors && (
                    <View
                      style={[
                        styles.hskBadge,
                        { backgroundColor: hskColors.background },
                      ]}
                    >
                      <Text style={[styles.hskBadgeText, { color: hskColors.text }]}>
                        HSK {item.hskLevel}
                      </Text>
                    </View>
                  )}
                </View>
                {item.pinyin ? (
                  <Text style={styles.pinyin}>{item.pinyin}</Text>
                ) : null}
                <Text style={styles.translation}>{translation}</Text>
              </View>
              <Pressable
                style={styles.removeButton}
                onPress={() => handleRemove(item.hanzi)}
                accessibilityLabel="Удалить из подборки"
                accessibilityRole="button"
              >
                <Text style={styles.removeButtonText}>✕</Text>
              </Pressable>
            </View>
          );
        }}
      />

      <EditCollectionModal
        visible={editOpen && isOwner}
        collection={collection}
        onClose={() => setEditOpen(false)}
        onSave={handleEditSave}
        allowPublicToggle={isOwner}
      />    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f6f2',
  },
  loader: {
    marginTop: 80,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e8e4dc',
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  backButton: {
    paddingVertical: 4,
  },
  backButtonText: {
    fontSize: 15,
    color: '#4a90d9',
    fontWeight: '600',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 16,
  },
  headerAction: {
    paddingVertical: 4,
  },
  headerActionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4a90d9',
  },
  headerActionDanger: {
    color: '#b91c1c',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  colorBar: {
    width: 6,
    height: 44,
    borderRadius: 3,
  },
  titleBlock: {
    flex: 1,
  },
  title: {
    fontSize: IS_TABLET ? 26 : 22,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
  },
  badgePublic: {
    backgroundColor: 'rgba(208,255,0,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(208,255,0,0.35)',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  badgePublicText: {
    color: '#65a30d',
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  badgePrivate: {
    backgroundColor: 'rgba(139,92,246,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(139,92,246,0.35)',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  badgePrivateText: {
    color: '#7c3aed',
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  subtitle: {
    marginTop: 2,
    fontSize: 14,
    color: '#666',
  },
  list: {
    padding: 20,
    paddingBottom: 40,
  },
  empty: {
    alignItems: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
  },
  wordCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  wordMain: {
    flex: 1,
    paddingRight: 12,
  },
  wordHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 4,
  },
  hanzi: {
    fontSize: 26,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  hskBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  hskBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  pinyin: {
    fontSize: 15,
    color: '#4a90d9',
    marginBottom: 4,
  },
  translation: {
    fontSize: 15,
    color: '#444',
    lineHeight: 22,
  },
  removeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fef2f2',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  removeButtonText: {
    fontSize: 16,
    color: '#b91c1c',
    fontWeight: '700',
  },
});
