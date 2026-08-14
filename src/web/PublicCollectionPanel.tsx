import React, { useCallback, useEffect, useState } from 'react';
import {
  catalogLanguageLabel,
  catalogTextsCountLabel,
} from '../i18n/catalogI18n';
import { useI18n } from '../i18n/useI18n';
import {
  fetchPublicCollection,
  fetchPublicCollectionBook,
} from '../services/publicCollectionsService';
import { saveBook } from '../services/storageService';
import type { Book, PublicCollectionDoc } from '../types';
import { formatBookTitleLine } from '../utils/bookTitle';
import { showAlert } from '../utils/alert';
import { Button, Div, Span } from './dom';
import { useWebTheme } from './webTheme';

interface PublicCollectionPanelProps {
  slug: string;
  onOpenBook: (book: Book) => void;
  onClose: () => void;
  onAddedToLibrary?: () => void;
}

/**
 * Публичная подборка по ссылке `/c/{slug}`.
 * Read-only для гостей; «Добавить к себе» копирует книгу в личную библиотеку.
 * Ридер (пиньинь #FF6584 + WordModalGlass) открывается через onOpenBook.
 */
export function PublicCollectionPanel({
  slug,
  onOpenBook,
  onClose,
  onAddedToLibrary,
}: PublicCollectionPanelProps) {
  const theme = useWebTheme();
  const { t, lang } = useI18n();
  const [doc, setDoc] = useState<PublicCollectionDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(false);
      setDoc(null);
      try {
        const data = await fetchPublicCollection(slug);
        if (cancelled) return;
        if (!data) {
          setError(true);
          setDoc(null);
          return;
        }
        setDoc(data);
      } catch (err) {
        if (cancelled) return;
        console.warn('[PublicCollectionPanel] load failed:', err);
        setError(true);
        setDoc(null);
      } finally {
        // Всегда снимаем лоадер — даже при permission-denied / timeout
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const openBook = useCallback(
    async (bookId: string, addToLibrary: boolean) => {
      if (busyId) return;
      setBusyId(bookId);
      try {
        const book = await fetchPublicCollectionBook(slug, bookId);
        if (!book) {
          showAlert(t('alert.error'), t('public.loadFail'));
          return;
        }
        if (addToLibrary) {
          const now = new Date().toISOString();
          const personal: Book = {
            ...book,
            id: `public-${slug}-${book.id}`,
            catalogId: book.catalogId,
            collectionId: undefined,
            ownerUserId: undefined,
            createdAt: now,
            updatedAt: now,
          };
          await saveBook(personal);
          onAddedToLibrary?.();
          onOpenBook(personal);
        } else {
          onOpenBook(book);
        }
      } catch (err) {
        showAlert(
          t('alert.error'),
          err instanceof Error ? err.message : String(err)
        );
      } finally {
        setBusyId(null);
      }
    },
    [busyId, slug, onOpenBook, onAddedToLibrary, t]
  );

  const glass =
    theme.isDark
      ? 'rounded-2xl bg-[#1E1E28]/80 backdrop-blur-md border border-[#2A2A3A]'
      : 'rounded-2xl bg-white/90 border border-gray-200';

  return (
    <Div
      className={`flex-1 min-w-0 min-h-0 flex flex-col rounded-2xl overflow-hidden border ${
        theme.isDark
          ? 'bg-[#0D0D11] border-[#2A2A3A]'
          : `${theme.card}`
      }`}
    >
      <Div
        className={`px-3 py-2.5 flex items-center gap-3 border-b shrink-0 ${
          theme.isDark
            ? 'bg-[#1E1E28]/80 border-[#2A2A3A] backdrop-blur-md'
            : theme.titlebar
        }`}
      >
        <Button
          type="button"
          className={`shrink-0 w-8 h-8 rounded-xl flex items-center justify-center ${theme.accent} ${theme.hover} transition font-bold text-lg`}
          onClick={onClose}
          title={t('action.close')}
          aria-label={t('action.close')}
        >
          ←
        </Button>
        <Span
          className={`flex-1 text-center text-sm font-semibold ${theme.accent} font-['Comfortaa'] pr-8`}
        >
          {t('public.title')}
        </Span>
      </Div>

      <Div className="flex-1 overflow-y-auto p-4 space-y-4">
        {loading ? (
          <Div className={`text-center py-16 text-sm ${theme.textMuted}`}>
            {t('public.loading')}
          </Div>
        ) : error ? (
          <Div className={`${glass} p-6 text-center space-y-3`}>
            <Div className={`font-bold ${theme.text}`}>{t('public.notFound')}</Div>
            <Button
              type="button"
              className={`rounded-xl px-4 py-2 text-sm font-bold ${theme.cta}`}
              onClick={onClose}
            >
              {t('public.goHome')}
            </Button>
          </Div>
        ) : doc ? (
          <>
            <Div className={`${glass} p-4 space-y-2`}>
              <Div
                className="w-10 h-10 rounded-xl"
                style={{ background: doc.color || '#8B5CF6' }}
              />
              <Div className={`text-xl font-extrabold font-['Comfortaa'] ${theme.text}`}>
                {doc.title}
              </Div>
              {doc.description ? (
                <Div className={`text-sm leading-relaxed ${theme.textMuted}`}>
                  {doc.description}
                </Div>
              ) : null}
              <Div className={`text-[11px] font-semibold ${theme.textMuted} flex flex-wrap gap-1.5 items-center`}>
                <Span className="text-[9px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-[#D0FF00]/15 text-[#D0FF00] border border-[#D0FF00]/25">
                  {t('catalog.badgePublic')}
                </Span>
                <Span>
                  {catalogTextsCountLabel(doc.books?.length ?? 0, lang)}
                  {' · '}
                  {t('catalog.readOnly')}
                </Span>
              </Div>
              <Div className={`text-[10px] ${theme.textMuted}`}>
                {t('public.editHint')}
              </Div>            </Div>

            <Div className={`text-[10px] font-bold uppercase tracking-wider ${theme.accent}`}>
              {t('public.texts')}
            </Div>

            {(doc.books ?? []).length === 0 ? (
              <Div className={`text-sm ${theme.textMuted}`}>
                {t('public.emptyBooks')}
              </Div>
            ) : (
              <Div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {(doc.books ?? []).map((b) => {
                  const busy = busyId === b.id;
                  return (
                    <Div key={b.id} className={`${glass} p-3.5 flex flex-col gap-2`}>
                      <Div className={`font-bold text-sm font-['Comfortaa'] ${theme.text} line-clamp-2`}>
                        {b.title}
                      </Div>
                      {b.russianTitle &&
                      lang === 'ru' &&
                      b.russianTitle !== b.title ? (
                        <Div className={`text-[11px] ${theme.textMuted} line-clamp-1`}>
                          {b.russianTitle}
                        </Div>
                      ) : null}
                      <Div className="flex flex-wrap gap-1.5">
                        <Span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            theme.isDark
                              ? 'bg-[#8B5CF6]/20 text-[#c4b5fd]'
                              : 'bg-purple-50 text-purple-700'
                          }`}
                        >
                          {catalogLanguageLabel(b.language, lang)}
                        </Span>
                        <Span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            theme.isDark
                              ? 'bg-[#D0FF00]/12 text-[#D0FF00]'
                              : 'bg-lime-50 text-lime-800'
                          }`}
                        >
                          {b.language === 'en'
                            ? t('catalog.cefrLevel', { n: b.targetHskLevel })
                            : t('catalog.hskLevel', { n: b.targetHskLevel })}
                        </Span>
                      </Div>
                      {b.excerpt ? (
                        <Div className={`text-xs leading-relaxed ${theme.textMuted} line-clamp-3`}>
                          {b.excerpt}
                        </Div>
                      ) : null}
                      <Div className="mt-auto flex flex-col gap-1.5 pt-1">
                        <Button
                          type="button"
                          disabled={!!busyId}
                          className={`w-full rounded-xl py-2 text-xs font-bold ${theme.cta} disabled:opacity-50`}
                          onClick={() => void openBook(b.id, false)}
                        >
                          {busy ? t('catalog.opening') : t('action.read')}
                        </Button>
                        <Button
                          type="button"
                          disabled={!!busyId}
                          className={`w-full rounded-xl py-2 text-xs font-bold border transition disabled:opacity-50 ${
                            theme.isDark
                              ? 'border-[#2A2A3A] text-white/80 hover:bg-[#2A2A3A]'
                              : `${theme.border} ${theme.text}`
                          }`}
                          onClick={() => void openBook(b.id, true)}
                        >
                          {t('catalog.addToLibrary')}
                        </Button>
                      </Div>
                    </Div>
                  );
                })}
              </Div>
            )}
          </>
        ) : null}
      </Div>
    </Div>
  );
}

/** Утилита: не используется в рендере, но полезна для отладки заголовков */
export function publicBookLabel(book: Book, lang: 'zh' | 'ru' | 'en' = 'ru'): string {
  return formatBookTitleLine(book, lang);
}
