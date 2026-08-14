import React, { useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { StickyNote } from '../types/stickyNote';
import { useTheme } from '../theme/ThemeContext';

const NOTE_COLORS = ['#fff3a0', '#ffc2e0', '#b8ffe0', '#dcc8ff', '#c2e0ff'];

interface StickyNotesLayerProps {
  notes: StickyNote[];
  paragraphIndex: number;
  onEdit: (note: StickyNote) => void;
  onRemove: (id: string) => void;
}

/** Стикер-заметки на абзаце (journal aesthetic) */
export function StickyNotesLayer({
  notes,
  paragraphIndex,
  onEdit,
  onRemove,
}: StickyNotesLayerProps) {
  const theme = useTheme();
  const local = notes.filter((n) => n.paragraphIndex === paragraphIndex);
  if (local.length === 0) return null;

  return (
    <View style={styles.layer}>
      {local.map((note, i) => (
        <Pressable
          key={note.id}
          style={[
            styles.sticker,
            {
              backgroundColor: note.color || theme.stickerYellow,
              transform: [{ rotate: `${(i % 3) * 2 - 2}deg` }],
            },
          ]}
          onPress={() => onEdit(note)}
          onLongPress={() => onRemove(note.id)}
        >
          <Text style={styles.stickerQuote} numberOfLines={1}>
            「{note.selectedText}」
          </Text>
          <Text style={styles.stickerBody} numberOfLines={3}>
            {note.note}
          </Text>
          <Text style={styles.stickerHint}>hold to delete</Text>
        </Pressable>
      ))}
    </View>
  );
}

interface StickyNoteModalProps {
  visible: boolean;
  selectedText: string;
  initialNote?: string;
  initialColor?: string;
  onSave: (note: string, color: string) => void;
  onClose: () => void;
}

export function StickyNoteModal({
  visible,
  selectedText,
  initialNote = '',
  initialColor,
  onSave,
  onClose,
}: StickyNoteModalProps) {
  const theme = useTheme();
  const [text, setText] = useState(initialNote);
  const [color, setColor] = useState(initialColor || NOTE_COLORS[0]);

  React.useEffect(() => {
    if (visible) {
      setText(initialNote);
      setColor(initialColor || NOTE_COLORS[0]);
    }
  }, [visible, initialNote, initialColor]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable
          style={[
            styles.sheet,
            { backgroundColor: color, borderColor: theme.accentViolet },
          ]}
          onPress={(e) => e.stopPropagation()}
        >
          <Text style={styles.modalTitle}>🏷️ Sticky note</Text>
          <Text style={styles.quote} numberOfLines={2}>
            {selectedText}
          </Text>
          <TextInput
            style={styles.input}
            placeholder="Объяснение / перевод / мнемоника…"
            placeholderTextColor="#888"
            value={text}
            onChangeText={setText}
            multiline
            autoFocus
          />
          <View style={styles.colors}>
            {NOTE_COLORS.map((c) => (
              <Pressable
                key={c}
                style={[
                  styles.swatch,
                  { backgroundColor: c },
                  color === c && styles.swatchActive,
                ]}
                onPress={() => setColor(c)}
              />
            ))}
          </View>
          <View style={styles.actions}>
            <Pressable style={styles.cancel} onPress={onClose}>
              <Text style={styles.cancelText}>Отмена</Text>
            </Pressable>
            <Pressable
              style={[styles.save, { backgroundColor: theme.accentViolet }]}
              onPress={() => {
                if (!text.trim()) return;
                onSave(text.trim(), color);
              }}
            >
              <Text style={styles.saveText}>Прикрепить</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/** Декор-стикеры вокруг «блокнота» */
export function NotebookStickers() {
  return (
    <View pointerEvents="none" style={styles.decors}>
      <Text style={[styles.decor, { top: 4, right: 8 }]}>🌸</Text>
      <Text style={[styles.decor, { top: 28, left: 6, fontSize: 14 }]}>⭐</Text>
      <Text style={[styles.decor, { bottom: 8, right: 16, fontSize: 16 }]}>💿</Text>
      <Text style={[styles.decor, { bottom: 24, left: 10, fontSize: 13 }]}>🎀</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  layer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  sticker: {
    width: 140,
    minHeight: 72,
    padding: 8,
    borderRadius: 4,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 3,
    shadowOffset: { width: 1, height: 2 },
    elevation: 3,
  },
  stickerQuote: {
    fontSize: 10,
    fontWeight: '700',
    color: '#444',
    marginBottom: 4,
  },
  stickerBody: {
    fontSize: 12,
    color: '#222',
    lineHeight: 16,
  },
  stickerHint: {
    marginTop: 4,
    fontSize: 8,
    color: '#888',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(10,16,40,0.55)',
    justifyContent: 'center',
    padding: 24,
  },
  sheet: {
    borderRadius: 8,
    borderWidth: 2,
    padding: 16,
    transform: [{ rotate: '-1deg' }],
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 8,
    color: '#1a1a1a',
  },
  quote: {
    fontSize: 13,
    fontStyle: 'italic',
    color: '#444',
    marginBottom: 10,
  },
  input: {
    minHeight: 80,
    backgroundColor: 'rgba(255,255,255,0.55)',
    borderRadius: 6,
    padding: 10,
    fontSize: 14,
    color: '#111',
    textAlignVertical: 'top',
  },
  colors: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  swatch: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  swatchActive: {
    borderColor: '#1a1a1a',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 14,
  },
  cancel: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  cancelText: {
    color: '#555',
    fontWeight: '600',
  },
  save: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  saveText: {
    color: '#fff',
    fontWeight: '700',
  },
  decors: {
    ...StyleSheet.absoluteFillObject,
  },
  decor: {
    position: 'absolute',
    fontSize: 18,
  },
});
