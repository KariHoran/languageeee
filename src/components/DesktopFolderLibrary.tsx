import React, { useCallback, useState } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { useI18n } from '../i18n/useI18n';
import { isSupportedDropFile, readDroppedFile } from '../utils/pickTextFile';

export interface FolderInfo {
  id: string;
  title: string;
  color: string;
  count: number;
}

interface DesktopFolderLibraryProps {
  folders: FolderInfo[];
  selectedId: string | null;
  onSelectFolder: (id: string | null) => void;
  onOpenFolder: (id: string) => void;
  /** Drop → parse text and route to add-book flow */
  onFilesDropped: (payload: { text: string; fileName: string; folderId?: string }) => void;
}

/** Ретро macOS Finder / desktop folders + drag-drop зона */
export default function DesktopFolderLibrary({
  folders,
  selectedId,
  onSelectFolder,
  onOpenFolder,
  onFilesDropped,
}: DesktopFolderLibraryProps) {
  const theme = useTheme();
  const { t } = useI18n();
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const folderMeta = (id: string) => {
    const f = folders.find((x) => x.id === id);
    return {
      id,
      title: f?.title ?? id,
      description: '',
      color: f?.color ?? '#9ca3af',
      icon: '📁',
    };
  };

  const handleDropFiles = useCallback(
    async (fileList: FileList | File[]) => {
      setError(null);
      const files = Array.from(fileList).filter(isSupportedDropFile);
      if (files.length === 0) {
        setError(t('folder.needFile'));
        return;
      }
      try {
        const file = files[0];
        const result = await readDroppedFile(file);
        onFilesDropped({
          ...result,
          folderId: selectedId ?? undefined,
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : t('folder.readFail'));
      }
    },
    [onFilesDropped, selectedId, t]
  );

  const webDropHandlers =
    Platform.OS === 'web'
      ? ({
          onDragOver: (e: { preventDefault?: () => void }) => {
            e.preventDefault?.();
            setDragging(true);
          },
          onDragEnter: (e: { preventDefault?: () => void }) => {
            e.preventDefault?.();
            setDragging(true);
          },
          onDragLeave: () => setDragging(false),
          onDrop: (e: {
            preventDefault?: () => void;
            dataTransfer?: { files?: FileList };
            nativeEvent?: { dataTransfer?: { files?: FileList } };
          }) => {
            e.preventDefault?.();
            setDragging(false);
            const files =
              e.dataTransfer?.files ?? e.nativeEvent?.dataTransfer?.files;
            if (files?.length) void handleDropFiles(files);
          },
        } as object)
      : {};

  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: theme.text }]}>
        📂 {t('nav.library')}
      </Text>
      <Text style={[styles.sectionSub, { color: theme.textMuted }]}>
        {t('folder.retroTitle')}
      </Text>

      <View style={styles.desktop}>
        <Pressable
          style={[
            styles.folderIcon,
            selectedId === null && {
              backgroundColor: theme.accentLime + '33',
              borderColor: theme.accentLime,
            },
          ]}
          onPress={() => onSelectFolder(null)}
        >
          <Text style={styles.folderEmoji}>📚</Text>
          <Text style={[styles.folderLabel, { color: theme.text }]} numberOfLines={2}>
            {t('folder.all')}
          </Text>
        </Pressable>

        {folders.map((f) => {
          const meta = folderMeta(f.id);
          const selected = selectedId === f.id;
          return (
            <Pressable
              key={f.id}
              style={[
                styles.folderIcon,
                selected && {
                  backgroundColor: (f.color || theme.accent) + '33',
                  borderColor: f.color || theme.accent,
                },
              ]}
              onPress={() => onSelectFolder(f.id)}
              onLongPress={() => onOpenFolder(f.id)}
            >
              <Text style={styles.folderEmoji}>{meta.icon}</Text>
              <Text style={[styles.folderLabel, { color: theme.text }]} numberOfLines={2}>
                {f.title}
              </Text>
              <Text style={[styles.folderCount, { color: theme.textMuted }]}>
                {f.count}
              </Text>
            </Pressable>
          );
        })}

        {folders.length === 0 ? (
          <View
            style={[
              styles.emptyFoldersCard,
              {
                backgroundColor: theme.surfaceGlass,
                borderColor: theme.border,
              },
            ]}
          >
            <Text style={{ fontSize: 20, marginBottom: 4 }}>☁️</Text>
            <Text style={{ color: theme.accentPink, fontWeight: '700', fontSize: 13 }}>
              {t('folder.emptyTitle')}
            </Text>
            <Text style={[styles.emptyFolders, { color: theme.textMuted, marginTop: 4 }]}>
              {t('folder.emptyHint')}
            </Text>
          </View>
        ) : null}
      </View>

      <View
        style={[
          styles.dropZone,
          {
            borderColor: dragging ? theme.accentLime : theme.border,
            backgroundColor: dragging ? theme.accentLime + '22' : theme.surface,
          },
        ]}
        {...webDropHandlers}
      >
        <Text style={[styles.dropTitle, { color: theme.text }]}>
          {dragging ? t('folder.dropActive') : t('folder.dropIdle')}
        </Text>
        <Text style={[styles.dropHint, { color: theme.textMuted }]}>
          {t('folder.dropHint')}
        </Text>
        {error ? (
          <Text style={[styles.dropError, { color: theme.danger }]}>{error}</Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '800', marginBottom: 4 },
  sectionSub: { fontSize: 12, marginBottom: 12 },
  desktop: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 12,
  },
  folderIcon: {
    width: 88,
    minHeight: 88,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
  },
  folderEmoji: { fontSize: 28, marginBottom: 4 },
  folderLabel: { fontSize: 11, fontWeight: '700', textAlign: 'center' },
  folderCount: { fontSize: 10, marginTop: 2 },
  emptyFolders: { fontSize: 12, textAlign: 'center' },
  emptyFoldersCard: {
    minWidth: 160,
    maxWidth: 220,
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 14,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dropZone: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
  },
  dropTitle: { fontSize: 14, fontWeight: '700' },
  dropHint: { fontSize: 12, marginTop: 4 },
  dropError: { fontSize: 12, marginTop: 8 },
});
