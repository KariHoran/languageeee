/**
 * Обратная совместимость: прежний syncService делегирует в cloudSyncService + authService.
 * Предпочтительно импортировать из `cloudSyncService` / `authService` напрямую.
 */

export {
  SYNC_STORAGE_KEYS,
  mergeRecords,
  mergeTombstones,
  loadLocalSnapshot,
  applyLocalSnapshot,
  mergeSnapshots,
  recordTombstone,
  getSyncState,
  subscribeSyncState,
  scheduleSyncDebounced,
  scheduleReadingProgressSync,
  pushReadingProgressToCloud,
  pullAndMergeReadingProgress,
  flushSyncNow,
  syncData as syncNow,
  initCloudSync as initSync,
  pushLocalToCloud,
  pullCloudToLocal,
  syncData,
  ensureUserDocument,
  bootstrapCloudAfterAuth,
  cancelPendingSync,
  markLocalDataCleared,
  markHasCompletedOnboarding,
  syncHasCompletedOnboardingFromCloud,
  reportNetworkConnectivity,
  type SyncEntityType,
  type SyncTombstone,
  type SyncSnapshot,
  type SyncStatus,
  type SyncState,
} from './cloudSyncService';

export {
  clearUserLocalData,
  subscribeLocalDataReset,
  resetZustandUserState,
} from './localDataResetService';
