import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  getAuthState,
  isCloudUser,
  subscribeAuthState,
  type AuthState,
} from '../services/authService';
import {
  getSyncState,
  subscribeSyncState,
  type SyncState,
} from '../services/cloudSyncService';
import { useI18n } from '../i18n/useI18n';
import { useTheme } from '../theme/ThemeContext';
import AuthModal from '../screens/AuthModal';

interface AuthStatusBarProps {
  compact?: boolean;
}

/**
 * Статус аккаунта в шапке.
 * Подписи синхронизации / гостя — через i18n (nativeLanguage).
 */
export default function AuthStatusBar({ compact = false }: AuthStatusBarProps) {
  const theme = useTheme();
  const { t } = useI18n();
  const isDark = theme.mode === 'midnight';
  const [auth, setAuth] = useState<AuthState>(getAuthState);
  const [sync, setSync] = useState<SyncState>(getSyncState);
  const [modalVisible, setModalVisible] = useState(false);

  useEffect(() => subscribeAuthState(setAuth), []);
  useEffect(() => subscribeSyncState(setSync), []);

  const loggedIn = isCloudUser(auth);
  const isSyncing = sync.status === 'syncing';

  const syncLabel =
    sync.status === 'synced'
      ? t('sync.synced')
      : sync.status === 'syncing'
        ? t('sync.syncing')
        : sync.status === 'error'
          ? t('sync.error')
          : t('sync.ready');

  const syncDetail =
    sync.status === 'error' && sync.error
      ? `${syncLabel}: ${sync.error}`
      : syncLabel;

  return (
    <>
      <Pressable
        style={[
          styles.bar,
          {
            backgroundColor: loggedIn
              ? isDark
                ? 'rgba(16,185,129,0.15)'
                : '#ecfdf5'
              : theme.surface,
            borderColor: loggedIn
              ? isDark
                ? 'rgba(52,211,153,0.45)'
                : '#6ee7b7'
              : theme.border,
          },
          compact ? styles.barCompact : styles.barFull,
        ]}
        onPress={() => setModalVisible(true)}
        accessibilityRole="button"
        accessibilityLabel={
          loggedIn
            ? `${auth.user?.email ?? t('auth.account')}, ${syncDetail}`
            : `${t('auth.guest')}. ${t('auth.loginForSync')}`
        }
      >
        <Text style={styles.dot}>{loggedIn ? '🟢' : '⚪'}</Text>
        <View style={styles.textCol}>
          {loggedIn ? (
            <>
              <Text style={[styles.primary, { color: theme.text }]} numberOfLines={1}>
                {auth.user?.email}
              </Text>
              <View style={styles.syncRow}>
                <View style={styles.spinnerSlot}>
                  {isSyncing ? (
                    <ActivityIndicator size="small" color={theme.success} />
                  ) : (
                    <View style={styles.spinnerPlaceholder} />
                  )}
                </View>
                <Text
                  style={[styles.secondary, { color: theme.success }, styles.syncLabel]}
                  numberOfLines={1}
                >
                  {syncLabel}
                </Text>
              </View>
            </>
          ) : (
            <>
              <Text style={[styles.primary, { color: theme.text }]} numberOfLines={1}>
                {t('auth.guest')}
              </Text>
              <Text style={[styles.link, { color: theme.accent }]} numberOfLines={1}>
                {t('auth.loginForSync')}
              </Text>
            </>
          )}
        </View>
      </Pressable>

      <AuthModal visible={modalVisible} onClose={() => setModalVisible(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
  },
  barFull: {
    width: 220,
  },
  barCompact: {
    width: 168,
    paddingHorizontal: 10,
  },
  dot: {
    fontSize: 12,
    lineHeight: 16,
    width: 14,
    textAlign: 'center',
  },
  textCol: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  syncRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 16,
  },
  spinnerSlot: {
    width: 14,
    height: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  spinnerPlaceholder: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'transparent',
  },
  syncLabel: {
    flex: 1,
    minWidth: 0,
  },
  primary: {
    fontSize: 13,
    fontWeight: '700',
  },
  secondary: {
    fontSize: 12,
    fontWeight: '600',
  },
  link: {
    fontSize: 12,
    fontWeight: '700',
  },
});
