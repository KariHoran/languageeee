import React, { useCallback, useEffect, useState } from 'react';
import { useI18n } from '../i18n/useI18n';
import {
  fetchPublicDeck,
  importPublicDeck,
  type PublicDeckDoc,
} from '../services/publicDecksService';
import { showAlert } from '../utils/alert';
import { Button, Div, Span } from './dom';
import { useWebTheme } from './webTheme';

interface PublicDeckPanelProps {
  slug: string;
  onClose: () => void;
  onImported?: () => void;
}

/** Публичная колода по ссылке `/d/{slug}`. */
export function PublicDeckPanel({
  slug,
  onClose,
  onImported,
}: PublicDeckPanelProps) {
  const theme = useWebTheme();
  const { t } = useI18n();
  const [deck, setDeck] = useState<PublicDeckDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const doc = await fetchPublicDeck(slug);
      if (!doc) {
        setError(t('flashcards.shareNotFound'));
        setDeck(null);
      } else {
        setDeck(doc);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t('flashcards.shareNotFound'));
      setDeck(null);
    } finally {
      setLoading(false);
    }
  }, [slug, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleImport = async () => {
    if (!deck || busy) return;
    setBusy(true);
    try {
      const result = await importPublicDeck(deck);
      showAlert(
        t('flashcards.shareImported'),
        t('flashcards.shareImportedBody', {
          added: result.added,
          skipped: result.skipped,
        })
      );
      onImported?.();
    } catch (e) {
      showAlert(
        t('alert.error'),
        e instanceof Error ? e.message : t('flashcards.shareFail')
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Div
      className={`flex-1 min-h-0 overflow-y-auto rounded-3xl border p-5 ${
        theme.isDark
          ? 'bg-[#1E1E28]/90 border-[#2A2A3A]'
          : 'bg-white/90 border-gray-200'
      }`}
    >
      <Div className="flex items-start justify-between gap-3 mb-4">
        <Div>
          <Div className={`text-xs font-bold uppercase tracking-wide ${theme.accent}`}>
            {t('flashcards.shareDeck')}
          </Div>
          <Div className={`mt-1 text-xl font-extrabold font-['Comfortaa'] ${theme.text}`}>
            {deck?.title || slug}
          </Div>
        </Div>
        <Button
          type="button"
          onClick={onClose}
          className={`text-sm font-semibold ${theme.textMuted}`}
        >
          {t('action.close')}
        </Button>
      </Div>

      {loading ? (
        <Div className={`text-sm ${theme.textMuted}`}>…</Div>
      ) : error ? (
        <Div className="text-sm text-rose-400 font-semibold">{error}</Div>
      ) : deck ? (
        <>
          <Div className={`text-sm ${theme.textMuted} mb-4`}>
            {t('flashcards.shareMeta', {
              n: deck.cardCount || deck.cards.length,
              lang: String(deck.language || 'all').toUpperCase(),
            })}
          </Div>
          <Div className="flex flex-col gap-2 mb-5 max-h-[50vh] overflow-y-auto">
            {deck.cards.slice(0, 40).map((card, i) => (
              <Div
                key={`${card.hanzi}-${i}`}
                className={`rounded-xl px-3 py-2 border ${
                  theme.isDark
                    ? 'border-[#2A2A3A] bg-[#16161f]'
                    : 'border-gray-100 bg-gray-50'
                }`}
              >
                <Div className={`font-bold ${theme.text}`}>
                  {card.kind === 'grammar' ? `📐 ${card.hanzi}` : card.hanzi}
                </Div>
                {card.translation ? (
                  <Div className={`text-xs mt-0.5 ${theme.textMuted}`}>
                    {card.translation}
                  </Div>
                ) : null}
              </Div>
            ))}
            {deck.cards.length > 40 ? (
              <Span className={`text-xs ${theme.textMuted}`}>
                +{deck.cards.length - 40}
              </Span>
            ) : null}
          </Div>
          <Button
            type="button"
            disabled={busy}
            onClick={() => void handleImport()}
            className="w-full rounded-2xl py-3 font-bold bg-[#D0FF00] text-[#0D0D11] disabled:opacity-60"
          >
            {busy ? '…' : t('flashcards.shareImport')}
          </Button>
        </>
      ) : null}
    </Div>
  );
}
