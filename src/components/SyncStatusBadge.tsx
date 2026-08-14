import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  getSyncState,
  subscribeSyncState,
  syncData,
  SyncState,
} from '../services/cloudSyncService';
import { useI18n } from '../i18n/useI18n';

interface SyncStatusBadgeProps {
  compact?: boolean;
}

export default function SyncStatusBadge({ compact = false }: SyncStatusBadgeProps) {
  const { t } = useI18n();
  const [state, setState] = useState<SyncState>(getSyncState);

  useEffect(() => subscribeSyncState(setState), []);

  const isSyncing = state.status === 'syncing';
  const isOk = state.status === 'synced';
  const isError = state.status === 'error';
  const isOffline = state.status === 'offline';
  const isLocal =
    state.status === 'unconfigured' ||
    state.status === 'idle' ||
    state.status === 'guest';

  const label = isOffline
    ? t('sync.offline')
    : isOk
      ? `✓ ${t('sync.synced')}`
      : state.message;

  return (
    <Pressable
      style={[
        styles.badge,
        isOk && styles.badgeOk,
        isSyncing && styles.badgeSyncing,
        isError && styles.badgeError,
        isOffline && styles.badgeOffline,
        isLocal && !isOffline && styles.badgeLocal,
        compact && styles.badgeCompact,
      ]}
      onPress={() => {
        if (
          !isSyncing &&
          !isOffline &&
          state.status !== 'guest' &&
          state.status !== 'unconfigured'
        ) {
          void syncData();
        }
      }}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <View style={styles.iconSlot}>
        {isSyncing ? (
          <ActivityIndicator size="small" color="#D0FF00" />
        ) : (
          <View
            style={[
              styles.dot,
              isOk && styles.dotOk,
              isError && styles.dotError,
              isOffline && styles.dotOffline,
              isLocal && !isOffline && styles.dotLocal,
            ]}
          />
        )}
      </View>
      {!compact && (
        <Text
          style={[
            styles.text,
            isOk && styles.textOk,
            isError && styles.textError,
            isOffline && styles.textOffline,
            isLocal && !isOffline && styles.textLocal,
            styles.label,
          ]}
          numberOfLines={1}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    width: 188,
    overflow: 'hidden',
    backgroundColor: 'rgba(30, 30, 40, 0.8)',
    borderColor: '#2A2A3A',
  },
  badgeCompact: {
    width: 40,
    paddingHorizontal: 10,
    paddingVertical: 8,
    justifyContent: 'center',
  },
  badgeOk: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderColor: 'rgba(16, 185, 129, 0.45)',
  },
  badgeSyncing: {
    backgroundColor: 'rgba(139, 92, 246, 0.18)',
    borderColor: 'rgba(139, 92, 246, 0.45)',
  },
  badgeError: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderColor: 'rgba(239, 68, 68, 0.45)',
  },
  badgeOffline: {
    backgroundColor: 'rgba(208, 255, 0, 0.1)',
    borderColor: 'rgba(208, 255, 0, 0.35)',
  },
  badgeLocal: {
    backgroundColor: 'rgba(30, 30, 40, 0.8)',
    borderColor: '#2A2A3A',
  },
  iconSlot: {
    width: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#94a3b8',
  },
  dotOk: {
    backgroundColor: '#10b981',
  },
  dotError: {
    backgroundColor: '#ef4444',
  },
  dotOffline: {
    backgroundColor: '#D0FF00',
  },
  dotLocal: {
    backgroundColor: '#8B5CF6',
  },
  label: {
    flex: 1,
    minWidth: 0,
  },
  text: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.7)',
  },
  textOk: {
    color: '#6ee7b7',
  },
  textError: {
    color: '#fca5a5',
  },
  textOffline: {
    color: '#D0FF00',
  },
  textLocal: {
    color: 'rgba(255,255,255,0.55)',
  },
});
