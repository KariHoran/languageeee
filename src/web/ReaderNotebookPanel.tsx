import React, { useEffect, useMemo, useState } from 'react';
import { useI18n } from '../i18n/useI18n';
import { downloadTextFile } from '../services/flashcardsExport';
import { useAppStore } from '../store/useAppStore';
import type { StickyNote } from '../types/stickyNote';
import { Button, Div, Span } from './dom';
import { useWebTheme } from './webTheme';

const NOTE_COLORS = ['#fff3a0', '#ffc2e0', '#b8ffe0', '#dcc8ff', '#c2e0ff'];

interface ReaderNotebookPanelProps {
  open: boolean;
  bookId: string | null;
  /** Абзац, к которому привяжется новая заметка */
  paragraphIndex: number;
  paragraphPreview?: string;
  /** Цитата из выделения текста */
  seedSelectedText?: string;
  /** Открыть сразу в режиме редактирования этой заметки */
  editNoteId?: string | null;
  bookTitle?: string;
  onClose: () => void;
  onJumpToParagraph?: (index: number) => void;
}

/**
 * Блокнот заметок при чтении (web).
 * Данные — stickyNotes в Zustand (persist + cloud sync).
 */
export function ReaderNotebookPanel({
  open,
  bookId,
  paragraphIndex,
  paragraphPreview = '',
  seedSelectedText = '',
  editNoteId = null,
  bookTitle = '',
  onClose,
  onJumpToParagraph,
}: ReaderNotebookPanelProps) {
  const theme = useWebTheme();
  const { t } = useI18n();
  const stickyNotes = useAppStore((s) => s.stickyNotes);
  const addStickyNote = useAppStore((s) => s.addStickyNote);
  const updateStickyNote = useAppStore((s) => s.updateStickyNote);
  const removeStickyNote = useAppStore((s) => s.removeStickyNote);

  const [draft, setDraft] = useState('');
  const [color, setColor] = useState(NOTE_COLORS[0]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [attachToParagraph, setAttachToParagraph] = useState(true);
  const [boundParagraphIndex, setBoundParagraphIndex] = useState(paragraphIndex);
  const [quote, setQuote] = useState('');

  const notes = useMemo(() => {
    if (!bookId) return [] as StickyNote[];
    return stickyNotes
      .filter((n) => n.bookId === bookId)
      .slice()
      .sort((a, b) => b.createdAt - a.createdAt);
  }, [stickyNotes, bookId]);

  useEffect(() => {
    if (!open) {
      setDraft('');
      setEditingId(null);
      setColor(NOTE_COLORS[0]);
      setAttachToParagraph(true);
      setBoundParagraphIndex(paragraphIndex);
      setQuote('');
      return;
    }
    if (editNoteId) {
      const note = stickyNotes.find((n) => n.id === editNoteId);
      if (note) {
        setEditingId(note.id);
        setDraft(note.note);
        setColor(note.color || NOTE_COLORS[0]);
        setAttachToParagraph(note.paragraphIndex >= 0);
        setBoundParagraphIndex(
          note.paragraphIndex >= 0 ? note.paragraphIndex : paragraphIndex
        );
        setQuote(note.selectedText || '');
        return;
      }
    }
    setDraft('');
    setEditingId(null);
    setColor(NOTE_COLORS[0]);
    setAttachToParagraph(true);
    setBoundParagraphIndex(paragraphIndex);
    setQuote(seedSelectedText.trim().slice(0, 160));
  }, [open, bookId, editNoteId, stickyNotes, paragraphIndex, seedSelectedText]);

  if (!open || !bookId) return null;

  const startEdit = (note: StickyNote) => {
    setEditingId(note.id);
    setDraft(note.note);
    setColor(note.color || NOTE_COLORS[0]);
    setAttachToParagraph(note.paragraphIndex >= 0);
    setBoundParagraphIndex(
      note.paragraphIndex >= 0 ? note.paragraphIndex : paragraphIndex
    );
    setQuote(note.selectedText || '');
  };

  const clearForm = () => {
    setDraft('');
    setEditingId(null);
    setColor(NOTE_COLORS[0]);
    setBoundParagraphIndex(paragraphIndex);
    setQuote('');
  };

  const resolveSelectedText = () => {
    if (!attachToParagraph) return '';
    if (quote.trim()) return quote.trim().slice(0, 160);
    return paragraphPreview.slice(0, 80);
  };

  const handleSave = () => {
    const text = draft.trim();
    if (!text) return;
    const paraIdx = attachToParagraph ? boundParagraphIndex : -1;
    const selectedText = resolveSelectedText();

    if (editingId) {
      updateStickyNote(editingId, {
        note: text,
        color,
        paragraphIndex: paraIdx,
        selectedText,
      });
    } else {
      addStickyNote({
        id: `note-${Date.now()}`,
        bookId,
        paragraphIndex: paraIdx,
        selectedText,
        note: text,
        color,
        createdAt: Date.now(),
      });
    }
    clearForm();
  };

  const handleExport = () => {
    if (notes.length === 0) return;
    const stamp = new Date().toISOString().slice(0, 10);
    const title = bookTitle.trim() || bookId;
    const body = [
      `# ${title}`,
      `# languageeee notebook · ${stamp}`,
      '',
      ...notes.map((n, i) => {
        const head =
          n.paragraphIndex >= 0
            ? `## ${i + 1}. §${n.paragraphIndex + 1}`
            : `## ${i + 1}. ${t('notebook.general')}`;
        const quoteLine = n.selectedText
          ? `> ${n.selectedText.replace(/\n/g, ' ')}`
          : '';
        return [head, quoteLine, n.note, ''].filter(Boolean).join('\n');
      }),
    ].join('\n');
    void downloadTextFile(
      `languageeee-notes-${stamp}.md`,
      body,
      'text/markdown;charset=utf-8'
    );
  };

  return (
    <Div
      className="fixed inset-0 z-[70] flex justify-end"
      role="dialog"
      aria-modal
      aria-label={t('notebook.title')}
    >
      <Button
        type="button"
        className="absolute inset-0 bg-black/45 border-0"
        onClick={onClose}
        aria-label={t('action.close')}
      />
      <Div
        className={`relative z-10 h-full w-full max-w-md flex flex-col border-l shadow-2xl ${
          theme.isDark
            ? 'bg-[#16161f] border-[#2A2A3A] text-white'
            : 'bg-[#faf8f4] border-gray-200 text-gray-900'
        }`}
      >
        <Div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-black/10">
          <Div>
            <Div className={`font-['Comfortaa'] font-bold text-base ${theme.accent}`}>
              {t('notebook.title')}
            </Div>
            <Div className={`text-[11px] mt-0.5 ${theme.textMuted}`}>
              {t('notebook.subtitle', { n: notes.length })}
            </Div>
          </Div>
          <Div className="flex items-center gap-2">
            {notes.length > 0 ? (
              <Button
                type="button"
                className={`rounded-xl px-3 py-1.5 text-xs font-bold ${theme.cta}`}
                onClick={handleExport}
              >
                {t('notebook.export')}
              </Button>
            ) : null}
            <Button
              type="button"
              className={`rounded-xl px-3 py-1.5 text-xs font-bold ${theme.textMuted}`}
              onClick={onClose}
            >
              {t('action.close')}
            </Button>
          </Div>
        </Div>

        <Div className="px-4 py-3 border-b border-black/10 space-y-2">
          <label className={`flex items-center gap-2 text-[11px] font-semibold ${theme.textMuted}`}>
            <input
              type="checkbox"
              checked={attachToParagraph}
              onChange={(e) => setAttachToParagraph(e.target.checked)}
            />
            {t('notebook.attachParagraph', { n: boundParagraphIndex + 1 })}
          </label>
          {attachToParagraph && (quote || paragraphPreview) ? (
            <Div
              className={`text-[11px] italic line-clamp-2 rounded-xl px-2.5 py-1.5 ${
                theme.isDark ? 'bg-white/5' : 'bg-black/5'
              }`}
            >
              「{(quote || paragraphPreview).slice(0, 120)}
              {(quote || paragraphPreview).length > 120 ? '…' : ''}」
            </Div>
          ) : null}
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={4}
            placeholder={t('notebook.placeholder')}
            className={`w-full rounded-2xl px-3 py-2.5 text-sm resize-y border outline-none ${
              theme.isDark
                ? 'bg-[#1E1E28] border-[#2A2A3A] text-white placeholder:text-white/35'
                : 'bg-white border-gray-200 text-gray-900 placeholder:text-gray-400'
            }`}
          />
          <Div className="flex items-center gap-2 flex-wrap">
            {NOTE_COLORS.map((c) => (
              <Button
                key={c}
                type="button"
                className={`w-7 h-7 rounded-full border-2 ${
                  color === c ? 'border-[#0D0D11] scale-110' : 'border-transparent'
                }`}
                style={{ background: c }}
                onClick={() => setColor(c)}
                aria-label={c}
              />
            ))}
            <Div className="flex-1" />
            {editingId ? (
              <Button
                type="button"
                className={`rounded-xl px-3 py-1.5 text-xs font-bold ${theme.textMuted}`}
                onClick={clearForm}
              >
                {t('action.cancel')}
              </Button>
            ) : null}
            <Button
              type="button"
              className={`rounded-xl px-3 py-1.5 text-xs font-bold ${theme.cta} disabled:opacity-40`}
              disabled={!draft.trim()}
              onClick={handleSave}
            >
              {editingId ? t('notebook.save') : t('notebook.add')}
            </Button>
          </Div>
        </Div>

        <Div className="flex-1 min-h-0 overflow-y-auto px-4 py-3 space-y-2.5">
          {notes.length === 0 ? (
            <Div className={`text-sm text-center py-10 ${theme.textMuted}`}>
              {t('notebook.empty')}
            </Div>
          ) : (
            notes.map((note) => (
              <Div
                key={note.id}
                className="rounded-2xl px-3 py-2.5 shadow-sm"
                style={{ background: note.color || NOTE_COLORS[0] }}
              >
                {note.selectedText ? (
                  <Div className="text-[10px] font-bold text-black/60 mb-1 line-clamp-1">
                    「{note.selectedText}」
                    {note.paragraphIndex >= 0
                      ? ` · §${note.paragraphIndex + 1}`
                      : ''}
                  </Div>
                ) : note.paragraphIndex >= 0 ? (
                  <Div className="text-[10px] font-bold text-black/60 mb-1">
                    §{note.paragraphIndex + 1}
                  </Div>
                ) : (
                  <Div className="text-[10px] font-bold text-black/60 mb-1">
                    {t('notebook.general')}
                  </Div>
                )}
                <Div className="text-sm text-black/90 whitespace-pre-wrap leading-snug">
                  {note.note}
                </Div>
                <Div className="mt-2 flex items-center gap-2">
                  {note.paragraphIndex >= 0 && onJumpToParagraph ? (
                    <Button
                      type="button"
                      className="text-[10px] font-bold text-black/55 hover:text-black"
                      onClick={() => {
                        onJumpToParagraph(note.paragraphIndex);
                        onClose();
                      }}
                    >
                      {t('notebook.jump')}
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    className="text-[10px] font-bold text-black/55 hover:text-black"
                    onClick={() => startEdit(note)}
                  >
                    {t('notebook.edit')}
                  </Button>
                  <Button
                    type="button"
                    className="text-[10px] font-bold text-rose-700/80 hover:text-rose-800"
                    onClick={() => removeStickyNote(note.id)}
                  >
                    {t('notebook.delete')}
                  </Button>
                </Div>
              </Div>
            ))
          )}
        </Div>
      </Div>
    </Div>
  );
}

/** Мини-стикеры под абзацем в ридере */
export function ParagraphNoteChips({
  notes,
  onOpen,
}: {
  notes: StickyNote[];
  onOpen: (note?: StickyNote) => void;
}) {
  if (notes.length === 0) return null;
  return (
    <Div className="mt-2 flex flex-wrap gap-1.5">
      {notes.slice(0, 4).map((note) => (
        <Button
          key={note.id}
          type="button"
          className="max-w-[10rem] rounded-lg px-2 py-1 text-left text-[10px] font-semibold text-black/80 shadow-sm line-clamp-2"
          style={{ background: note.color || NOTE_COLORS[0] }}
          onClick={() => onOpen(note)}
          title={note.note}
        >
          {note.note}
        </Button>
      ))}
      {notes.length > 4 ? (
        <Button
          type="button"
          className="rounded-lg px-2 py-1 text-[10px] font-bold bg-black/10 text-black/60"
          onClick={() => onOpen()}
        >
          +{notes.length - 4}
        </Button>
      ) : null}
    </Div>
  );
}
