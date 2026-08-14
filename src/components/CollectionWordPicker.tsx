import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  addWordToCollections,
  setWordCollections,
  getWordCollectionIds,
} from '../services/collectionsStore';
import { getCollections } from '../services/storageService';
import { Collection } from '../types';

interface CollectionWordPickerProps {
  hanzi: string;
  pinyin?: string;
  translation?: string;
  hskLevel?: number;
  /** Если true — заменяет набор подборок; иначе добавляет к существующим при «Сохранить» */
  replaceMode?: boolean;
  onSaved?: (collectionIds: string[]) => void;
}

/**
 * Мультивыбор подборок для слова (чекбоксы + сохранить).
 */
export default function CollectionWordPicker({
  hanzi,
  pinyin,
  translation,
  hskLevel,
  replaceMode = true,
  onSaved,
}: CollectionWordPickerProps) {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedHint, setSavedHint] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [cols, ids] = await Promise.all([getCollections(), getWordCollectionIds(hanzi)]);
      if (cancelled) return;
      setCollections(cols);
      setSelectedIds(ids);
    })();
    return () => {
      cancelled = true;
    };
  }, [hanzi]);

  const toggle = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
    setSavedHint(false);
  };

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const input = { hanzi, pinyin, translation, hskLevel };
      if (replaceMode) {
        await setWordCollections(input, selectedIds);
      } else if (selectedIds.length > 0) {
        await addWordToCollections(input, selectedIds);
        const ids = await getWordCollectionIds(hanzi);
        setSelectedIds(ids);
      }
      setSavedHint(true);
      onSaved?.(selectedIds);
    } finally {
      setSaving(false);
    }
  };

  const label =
    selectedIds.length === 0
      ? 'Добавить в подборку'
      : `В подборках: ${selectedIds.length}`;

  return (
    <View style={styles.wrap}>
      <Pressable
        style={styles.toggle}
        onPress={() => setExpanded((v) => !v)}
        accessibilityRole="button"
      >
        <Text style={styles.toggleText}>
          {expanded ? '▼' : '▶'} {label}
        </Text>
      </Pressable>

      {expanded && (
        <View style={styles.panel}>
          <ScrollView
            style={styles.list}
            nestedScrollEnabled
            keyboardShouldPersistTaps="handled"
          >
            {collections.map((col) => {
              const checked = selectedIds.includes(col.id);
              return (
                <Pressable
                  key={col.id}
                  style={[styles.row, checked && styles.rowChecked]}
                  onPress={() => toggle(col.id)}
                >
                  <View
                    style={[styles.checkbox, checked && styles.checkboxChecked]}
                  >
                    {checked ? <Text style={styles.checkMark}>✓</Text> : null}
                  </View>
                  <View
                    style={[styles.dot, { backgroundColor: col.color ?? '#6b7280' }]}
                  />
                  <Text style={styles.rowTitle} numberOfLines={1}>
                    {col.title}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <Pressable
            style={[styles.saveButton, saving && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={saving}
          >
            <Text style={styles.saveButtonText}>
              {saving ? 'Сохраняем…' : savedHint ? 'Сохранено' : 'Сохранить в подборки'}
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 10,
    width: '100%',
  },
  toggle: {
    paddingVertical: 10,
    paddingHorizontal: 4,
  },
  toggleText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#4a90d9',
  },
  panel: {
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    maxHeight: 220,
  },
  list: {
    maxHeight: 140,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: 8,
  },
  rowChecked: {
    backgroundColor: '#eff6ff',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: '#94a3b8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#4a90d9',
    borderColor: '#4a90d9',
  },
  checkMark: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  rowTitle: {
    flex: 1,
    fontSize: 14,
    color: '#334155',
  },
  saveButton: {
    marginTop: 8,
    backgroundColor: '#4a90d9',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
});
