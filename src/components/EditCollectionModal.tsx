import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { COLLECTION_COLORS, DEFAULT_COLLECTION_COLOR } from '../constants/colors';
import { Collection } from '../types';

interface EditCollectionModalProps {
  visible: boolean;
  collection: Collection | null;
  onClose: () => void;
  onSave: (patch: {
    title: string;
    color: string;
    isPublic?: boolean;
  }) => void | Promise<void>;
  /** Показать переключатель публичности (web-паритет / RBAC) */
  allowPublicToggle?: boolean;
}

export default function EditCollectionModal({
  visible,
  collection,
  onClose,
  onSave,
  allowPublicToggle = true,
}: EditCollectionModalProps) {
  const [title, setTitle] = useState('');
  const [color, setColor] = useState(DEFAULT_COLLECTION_COLOR);
  const [isPublic, setIsPublic] = useState(false);
  const [saving, setSaving] = useState(false);

  const colors = useMemo(() => {
    const list = [...COLLECTION_COLORS];
    if (collection?.color && !list.includes(collection.color)) {
      list.push(collection.color);
    }
    return list;
  }, [collection]);

  useEffect(() => {
    if (collection && visible) {
      setTitle(collection.title);
      setColor(collection.color ?? DEFAULT_COLLECTION_COLOR);
      setIsPublic(!!collection.isPublic);
      setSaving(false);
    }
  }, [collection, visible]);

  const handleSave = async () => {
    const trimmed = title.trim();
    if (!trimmed || saving) return;
    setSaving(true);
    try {
      await onSave({
        title: trimmed,
        color,
        isPublic: allowPublicToggle ? isPublic : undefined,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.content} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title}>Редактировать подборку</Text>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder="Название подборки"
            placeholderTextColor="#888"
            autoFocus
          />
          <Text style={styles.colorLabel}>Цвет</Text>
          <View style={styles.colorRow}>
            {colors.map((c) => (
              <Pressable
                key={c}
                style={[
                  styles.colorSwatch,
                  { backgroundColor: c },
                  color === c && styles.colorSwatchActive,
                ]}
                onPress={() => setColor(c)}
              />
            ))}
          </View>

          {allowPublicToggle ? (
            <View style={styles.publicRow}>
              <View style={styles.publicTextCol}>
                <Text style={styles.publicTitle}>Публичная подборка</Text>
                <Text style={styles.publicHint}>
                  Доступ по ссылке. Изменять может только автор.
                </Text>
              </View>
              <Pressable
                style={[styles.toggle, isPublic && styles.toggleOn]}
                onPress={() => setIsPublic((v) => !v)}
              >
                <Text style={[styles.toggleText, isPublic && styles.toggleTextOn]}>
                  {isPublic ? 'ON' : 'OFF'}
                </Text>
              </Pressable>
            </View>
          ) : null}

          {collection?.isPublic && collection.shareSlug ? (
            <Text style={styles.shareHint} selectable>
              /c/{collection.shareSlug}
            </Text>
          ) : null}

          <Pressable
            style={[styles.saveButton, (!title.trim() || saving) && styles.saveButtonDisabled]}
            onPress={() => void handleSave()}
            disabled={!title.trim() || saving}
          >
            {saving ? (
              <ActivityIndicator color="#0D0D11" />
            ) : (
              <Text style={styles.saveButtonText}>Сохранить</Text>
            )}
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(13,13,17,0.72)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  content: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#1E1E28',
    borderRadius: 16,
    padding: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#2A2A3A',
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: '#8B5CF6',
    marginBottom: 14,
  },
  input: {
    borderWidth: 1,
    borderColor: '#2A2A3A',
    backgroundColor: '#16161E',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: '#fff',
    marginBottom: 14,
  },
  colorLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.5)',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  colorRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
  },
  colorSwatch: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  colorSwatchActive: {
    borderColor: '#D0FF00',
    transform: [{ scale: 1.1 }],
  },
  publicRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#16161E',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2A2A3A',
    padding: 12,
    marginBottom: 12,
  },
  publicTextCol: { flex: 1 },
  publicTitle: { color: '#fff', fontWeight: '700', fontSize: 13 },
  publicHint: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 11,
    marginTop: 2,
    lineHeight: 15,
  },
  toggle: {
    backgroundColor: '#2A2A3A',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  toggleOn: { backgroundColor: '#D0FF00' },
  toggleText: { color: 'rgba(255,255,255,0.55)', fontWeight: '800', fontSize: 11 },
  toggleTextOn: { color: '#0D0D11' },
  shareHint: {
    color: '#D0FF00',
    fontSize: 11,
    fontFamily: 'monospace',
    marginBottom: 12,
  },
  saveButton: {
    backgroundColor: '#D0FF00',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveButtonDisabled: { opacity: 0.45 },
  saveButtonText: { color: '#0D0D11', fontWeight: '800', fontSize: 15 },
});
