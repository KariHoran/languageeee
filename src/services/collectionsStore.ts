import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  COLLECTION_COLORS,
  DEFAULT_COLLECTION_COLOR,
} from '../constants/colors';
import { CollectionWord } from '../types';
import { lookupBkrs } from './bkrsService';

const COLLECTION_WORDS_KEY = '@languageeee/collection_words';

/** @deprecated Импортируйте из `constants/colors` — реэкспорт для совместимости */
export { COLLECTION_COLORS, DEFAULT_COLLECTION_COLOR };

async function loadMap(): Promise<Record<string, CollectionWord>> {
  const raw = await AsyncStorage.getItem(COLLECTION_WORDS_KEY);
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Record<string, CollectionWord>;
  } catch {
    return {};
  }
}

async function saveMap(map: Record<string, CollectionWord>): Promise<void> {
  await AsyncStorage.setItem(COLLECTION_WORDS_KEY, JSON.stringify(map));
}

export interface UpsertCollectionWordInput {
  hanzi: string;
  pinyin?: string;
  translation?: string;
  hskLevel?: number;
}

/** Добавляет слово в указанные подборки (мержит с уже выбранными). */
export async function addWordToCollections(
  input: UpsertCollectionWordInput,
  collectionIds: string[]
): Promise<CollectionWord> {
  const hanzi = input.hanzi.trim();
  if (!hanzi) throw new Error('Пустой иероглиф');
  if (collectionIds.length === 0) {
    throw new Error('Выберите хотя бы одну подборку');
  }

  const map = await loadMap();
  const now = new Date().toISOString();
  const existing = map[hanzi];
  const translation =
    input.translation?.trim() ||
    lookupBkrs(hanzi)?.trim() ||
    existing?.translation ||
    '';

  const mergedIds = Array.from(
    new Set([...(existing?.collectionIds ?? []), ...collectionIds])
  );

  const word: CollectionWord = {
    id: hanzi,
    hanzi,
    pinyin: input.pinyin?.trim() || existing?.pinyin || '',
    translation,
    hskLevel: input.hskLevel ?? existing?.hskLevel,
    collectionIds: mergedIds,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };

  map[hanzi] = word;
  await saveMap(map);
  const { scheduleSyncDebounced, flushSyncNow } = await import('./syncService');
  scheduleSyncDebounced();
  void flushSyncNow();
  return word;
}

/** Полностью заменяет список подборок для слова. */
export async function setWordCollections(
  input: UpsertCollectionWordInput,
  collectionIds: string[]
): Promise<CollectionWord | null> {
  const hanzi = input.hanzi.trim();
  if (!hanzi) return null;

  const map = await loadMap();
  const now = new Date().toISOString();
  const existing = map[hanzi];

  if (collectionIds.length === 0) {
    delete map[hanzi];
    await saveMap(map);
    const { recordTombstone, scheduleSyncDebounced, flushSyncNow } = await import(
      './syncService'
    );
    await recordTombstone('collectionWord', hanzi);
    scheduleSyncDebounced();
    void flushSyncNow();
    return null;
  }

  const translation =
    input.translation?.trim() ||
    lookupBkrs(hanzi)?.trim() ||
    existing?.translation ||
    '';

  const word: CollectionWord = {
    id: hanzi,
    hanzi,
    pinyin: input.pinyin?.trim() || existing?.pinyin || '',
    translation,
    hskLevel: input.hskLevel ?? existing?.hskLevel,
    collectionIds: Array.from(new Set(collectionIds)),
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };

  map[hanzi] = word;
  await saveMap(map);
  const { scheduleSyncDebounced, flushSyncNow } = await import('./syncService');
  scheduleSyncDebounced();
  void flushSyncNow();
  return word;
}

export async function removeWordFromCollection(
  hanzi: string,
  collectionId: string
): Promise<void> {
  const map = await loadMap();
  const word = map[hanzi];
  if (!word) return;

  const nextIds = word.collectionIds.filter((id) => id !== collectionId);
  if (nextIds.length === 0) {
    delete map[hanzi];
    await saveMap(map);
    const { recordTombstone, scheduleSyncDebounced, flushSyncNow } = await import(
      './syncService'
    );
    await recordTombstone('collectionWord', hanzi);
    scheduleSyncDebounced();
    void flushSyncNow();
  } else {
    map[hanzi] = {
      ...word,
      collectionIds: nextIds,
      updatedAt: new Date().toISOString(),
    };
    await saveMap(map);
    const { scheduleSyncDebounced, flushSyncNow } = await import('./syncService');
    scheduleSyncDebounced();
    void flushSyncNow();
  }
}

export async function getWordsInCollection(collectionId: string): Promise<CollectionWord[]> {
  const map = await loadMap();
  return Object.values(map)
    .filter((w) => w.collectionIds.includes(collectionId))
    .sort((a, b) => a.hanzi.localeCompare(b.hanzi, 'zh'));
}

export async function getWordCollectionIds(hanzi: string): Promise<string[]> {
  const map = await loadMap();
  return map[hanzi]?.collectionIds ?? [];
}

export async function getCollectionWord(hanzi: string): Promise<CollectionWord | null> {
  const map = await loadMap();
  return map[hanzi] ?? null;
}

/**
 * Убирает подборку из всех слов (при удалении подборки).
 * Слова не удаляются: если подборок не осталось — переносятся в fallbackCollectionId («Без категории»).
 */
export async function detachCollectionFromAllWords(
  collectionId: string,
  fallbackCollectionId?: string
): Promise<void> {
  const map = await loadMap();
  let changed = false;
  const now = new Date().toISOString();

  for (const key of Object.keys(map)) {
    const word = map[key];
    if (!word.collectionIds.includes(collectionId)) continue;

    const nextIds = word.collectionIds.filter((id) => id !== collectionId);
    changed = true;

    if (nextIds.length === 0) {
      if (fallbackCollectionId) {
        map[key] = {
          ...word,
          collectionIds: [fallbackCollectionId],
          updatedAt: now,
        };
      } else {
        delete map[key];
      }
    } else {
      map[key] = {
        ...word,
        collectionIds: nextIds,
        updatedAt: now,
      };
    }
  }

  if (changed) await saveMap(map);
}

export async function countWordsInCollection(collectionId: string): Promise<number> {
  const words = await getWordsInCollection(collectionId);
  return words.length;
}
