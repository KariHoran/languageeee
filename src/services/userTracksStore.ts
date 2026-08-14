/**
 * Пользовательские треки MiniPlay.
 * Аудиофайлы — только локально (IndexedDB на web).
 * В Firestore уходят лишь метаданные (название, размер) — без Firebase Storage.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { getCloudUid } from './authService';
import { getDataOwnerId } from './dataOwner';

const USER_TRACKS_KEY = '@languageeee/user_radio_tracks_v2';
const LEGACY_TRACKS_KEY = '@languageeee/user_radio_tracks_v1';
const IDB_NAME = 'languageeee-audio-v1';
const IDB_STORE = 'track-blobs';

/** Лимит на один файл: 100 МБ (локальный кэш IndexedDB) */
export const USER_TRACK_MAX_BYTES = 100 * 1024 * 1024;

export interface UserTrack {
  id: string;
  title: string;
  /** Пусто для локальных file-треков; blob: только во время воспроизведения */
  url: string;
  source: 'url' | 'file';
  mimeType?: string;
  sizeBytes?: number;
  createdAt: string;
  updatedAt?: string;
  /** @deprecated Firebase Storage отключён — поле игнорируется */
  storagePath?: string;
  /** @deprecated Firebase Storage отключён — поле игнорируется */
  remoteUrl?: string;
  /** Firebase uid владельца (изоляция аккаунтов) */
  ownerUserId?: string;
}

type TrackMeta = UserTrack;

function openIdb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB недоступен в этом окружении'));
      return;
    }
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB open failed'));
  });
}

async function idbPutBlob(id: string, blob: Blob): Promise<void> {
  const db = await openIdb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).put(blob, id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB put failed'));
  });
  db.close();
}

async function idbGetBlob(id: string): Promise<Blob | null> {
  const db = await openIdb();
  const blob = await new Promise<Blob | null>((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readonly');
    const req = tx.objectStore(IDB_STORE).get(id);
    req.onsuccess = () => resolve((req.result as Blob | undefined) ?? null);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB get failed'));
  });
  db.close();
  return blob;
}

async function idbDeleteBlob(id: string): Promise<void> {
  try {
    const db = await openIdb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error('IndexedDB delete failed'));
    });
    db.close();
  } catch {
    /* ignore */
  }
}

export async function getLocalTrackBlob(id: string): Promise<Blob | null> {
  if (Platform.OS !== 'web' || typeof indexedDB === 'undefined') return null;
  try {
    return await idbGetBlob(id);
  } catch {
    return null;
  }
}

/** Есть ли локальный файл для воспроизведения на этом устройстве. */
export async function hasLocalTrackBlob(id: string): Promise<boolean> {
  const blob = await getLocalTrackBlob(id);
  return Boolean(blob && blob.size > 0);
}

async function loadMetas(): Promise<TrackMeta[]> {
  try {
    let raw = await AsyncStorage.getItem(USER_TRACKS_KEY);
    if (!raw) {
      raw = await AsyncStorage.getItem(LEGACY_TRACKS_KEY);
      if (raw) {
        await AsyncStorage.setItem(USER_TRACKS_KEY, raw);
      }
    }
    if (!raw) return [];
    const parsed = JSON.parse(raw) as TrackMeta[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function saveMetas(tracks: TrackMeta[]): Promise<void> {
  await AsyncStorage.setItem(USER_TRACKS_KEY, JSON.stringify(tracks));
}

function queueCloudSync() {
  void import('./syncService')
    .then((m) => m.scheduleSyncDebounced())
    .catch(() => undefined);
}

/** Метаданные для Firestore — без бинарных данных и без Storage-полей. */
export function trackMetaForCloud(track: UserTrack): UserTrack {
  const ownerUserId = track.ownerUserId || getDataOwnerId();
  return {
    id: track.id,
    title: track.title,
    url: '',
    source: 'file',
    mimeType: track.mimeType,
    sizeBytes: track.sizeBytes,
    createdAt: track.createdAt,
    updatedAt: track.updatedAt || track.createdAt,
    ownerUserId,
  };
}

export async function getUserTracksMap(): Promise<Record<string, UserTrack>> {
  const list = await loadMetas();
  const map: Record<string, UserTrack> = {};
  for (const t of list) {
    map[t.id] = trackMetaForCloud(t);
  }
  return map;
}

/**
 * Применить облачный снимок треков (только метаданные).
 * Локальные файлы (IndexedDB) и треки «только на этом устройстве» сохраняются.
 */
export async function applyUserTracksFromCloud(
  remote: Record<string, UserTrack>
): Promise<void> {
  const ownerUserId = getCloudUid() || getDataOwnerId();
  const local = await loadMetas();
  const localById = new Map(local.map((t) => [t.id, t]));
  const nextById = new Map<string, UserTrack>();

  // Сначала локальные file-треки — музыка живёт на устройстве
  for (const t of local) {
    if (t.source === 'url') continue;
    nextById.set(t.id, {
      ...t,
      url: '',
      source: 'file',
      storagePath: undefined,
      remoteUrl: undefined,
      ownerUserId: t.ownerUserId || ownerUserId,
    });
  }

  // Облачные метаданные дополняют/обновляют названия, не стирая локальные blob'ы
  for (const [id, cloud] of Object.entries(remote)) {
    const existing = localById.get(id) || nextById.get(id);
    nextById.set(id, {
      id,
      title: cloud.title || existing?.title || 'Трек',
      url: '',
      source: 'file',
      mimeType: cloud.mimeType || existing?.mimeType,
      sizeBytes: cloud.sizeBytes ?? existing?.sizeBytes,
      createdAt:
        cloud.createdAt || existing?.createdAt || new Date().toISOString(),
      updatedAt: cloud.updatedAt || existing?.updatedAt,
      ownerUserId: cloud.ownerUserId || existing?.ownerUserId || ownerUserId,
    });
  }

  await saveMetas([...nextById.values()]);
}

/** @deprecated Storage отключён — no-op для совместимости импортов. */
export async function uploadPendingTracksToCloud(): Promise<void> {
  /* Firebase Storage не используем */
}

export async function getUserTracks(): Promise<UserTrack[]> {
  const list = await loadMetas();
  const owner = getDataOwnerId();
  return list
    .filter((t) => !t.ownerUserId || t.ownerUserId === owner)
    .filter((t) => t.source !== 'url')
    .sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
}

export async function getUserTrack(id: string): Promise<UserTrack | null> {
  const list = await loadMetas();
  return list.find((t) => t.id === id) ?? null;
}

const liveObjectUrls = new Map<string, string>();

export function revokePlayableUrl(trackId: string): void {
  const u = liveObjectUrls.get(trackId);
  if (u) {
    try {
      URL.revokeObjectURL(u);
    } catch {
      /* ignore */
    }
    liveObjectUrls.delete(trackId);
  }
}

export function revokeAllPlayableUrls(): void {
  for (const id of [...liveObjectUrls.keys()]) revokePlayableUrl(id);
}

/**
 * src для <audio> только из локального IndexedDB.
 * На другом устройстве файл нужно загрузить заново.
 */
export async function resolvePlayableUrl(track: UserTrack): Promise<string> {
  if (track.source === 'url') {
    throw new Error(
      'Воспроизведение по произвольной ссылке отключено. Загрузите файл с устройства.'
    );
  }

  if (track.url?.startsWith('blob:')) {
    return track.url;
  }

  if (Platform.OS !== 'web') {
    throw new Error(
      'Локальные аудиофайлы доступны в веб-версии. Загрузите трек с этого устройства.'
    );
  }

  const existing = liveObjectUrls.get(track.id);
  if (existing) return existing;

  const blob = await idbGetBlob(track.id);
  if (!blob) {
    throw new Error(
      'Аудиофайл не найден на этом устройстве. Загрузите файл снова (музыка хранится локально, без облака).'
    );
  }
  const objectUrl = URL.createObjectURL(blob);
  liveObjectUrls.set(track.id, objectUrl);
  return objectUrl;
}

/** Добавление по произвольной URL-ссылке строго отключено. */
export async function addUserTrackFromUrl(
  _title: string,
  _url: string
): Promise<UserTrack> {
  throw new Error(
    'Добавление музыки по ссылке отключено. Загрузите аудиофайл с устройства (до 100 МБ).'
  );
}

function formatMb(bytes: number): string {
  return (bytes / (1024 * 1024)).toFixed(1);
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${label} превысило ${Math.round(ms / 1000)} с`));
    }, ms);
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

/**
 * Сохраняет File в IndexedDB. Воспроизведение сразу с этого устройства.
 * Метаданные (название) уходят в Firestore при синке аккаунта.
 */
export async function addUserTrackFromFile(file: File): Promise<UserTrack> {
  if (Platform.OS !== 'web') {
    throw new Error('Загрузка файлов доступна в веб-версии приложения');
  }
  if (typeof indexedDB === 'undefined') {
    throw new Error('Браузер не поддерживает хранение больших аудиофайлов');
  }

  const okType =
    file.type.startsWith('audio/') ||
    /\.(mp3|ogg|wav|m4a|aac|flac|webm|opus)$/i.test(file.name);
  if (!okType) {
    throw new Error('Выберите аудиофайл (mp3, wav, m4a, ogg…)');
  }
  if (file.size <= 0) {
    throw new Error('Пустой файл');
  }
  if (file.size > USER_TRACK_MAX_BYTES) {
    throw new Error(
      `Файл слишком большой (${formatMb(file.size)} МБ). Максимум ${formatMb(USER_TRACK_MAX_BYTES)} МБ.`
    );
  }

  const id = `ut-${Date.now()}`;
  const mimeType = file.type || guessMime(file.name);

  try {
    await withTimeout(idbPutBlob(id, file), 30_000, 'Сохранение в браузере');
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(
      `Не удалось сохранить файл в браузере (${msg}). Освободите место на диске и попробуйте снова.`
    );
  }

  const title = file.name.replace(/\.[^.]+$/, '') || 'Мой трек';
  const now = new Date().toISOString();
  const track: UserTrack = {
    id,
    title,
    url: '',
    source: 'file',
    mimeType,
    sizeBytes: file.size,
    createdAt: now,
    updatedAt: now,
    ownerUserId: getDataOwnerId(),
  };

  const list = await loadMetas();
  list.unshift(track);
  await saveMetas(list);
  queueCloudSync();
  void import('./syncService')
    .then((m) => m.flushSyncNow())
    .catch(() => undefined);

  return track;
}

function guessMime(name: string): string {
  const lower = name.toLowerCase();
  if (lower.endsWith('.mp3')) return 'audio/mpeg';
  if (lower.endsWith('.wav')) return 'audio/wav';
  if (lower.endsWith('.m4a') || lower.endsWith('.aac')) return 'audio/mp4';
  if (lower.endsWith('.ogg') || lower.endsWith('.opus')) return 'audio/ogg';
  if (lower.endsWith('.flac')) return 'audio/flac';
  return 'audio/*';
}

export async function removeUserTrack(id: string): Promise<void> {
  const list = await loadMetas();
  revokePlayableUrl(id);
  await idbDeleteBlob(id);
  await saveMetas(list.filter((t) => t.id !== id));
  try {
    const { recordTombstone, scheduleSyncDebounced, flushSyncNow } = await import(
      './syncService'
    );
    await recordTombstone('userTrack', id);
    scheduleSyncDebounced();
    void flushSyncNow();
  } catch {
    queueCloudSync();
  }
}

export async function renameUserTrack(
  id: string,
  title: string
): Promise<UserTrack | null> {
  const list = await loadMetas();
  const idx = list.findIndex((t) => t.id === id);
  if (idx < 0) return null;
  const updated = {
    ...list[idx]!,
    title: title.trim() || list[idx]!.title,
    updatedAt: new Date().toISOString(),
  };
  list[idx] = updated;
  await saveMetas(list);
  queueCloudSync();
  void import('./syncService')
    .then((m) => m.flushSyncNow())
    .catch(() => undefined);
  return updated;
}
