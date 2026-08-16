import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  catalogLanguageLabel,
  catalogTextsCountLabel,
} from '../i18n/catalogI18n';
import { useI18n } from '../i18n/useI18n';
import { ensureAnonymousAuthForPublicView } from '../services/authService';
import {
  fetchPublicCollection,
  fetchPublicCollectionBook,
  importPublicCollection,
} from '../services/publicCollectionsService';
import { saveBook } from '../services/storageService';
import { useTheme } from '../theme/ThemeContext';
import type { Book, PublicCollectionDoc } from '../types';
import { resolveBookDisplayTitles } from '../utils/bookTitle';
import { showAlert } from '../utils/alert';

interface PublicCollectionScreenProps {
  slug: string;
  onBack: () => void;
  onOpenBook: (book: Book) => void;
  onImported?: (collectionId?: string) => void;
}

/** Нативный экран публичной подборки `/c/{slug}`. */
export default function PublicCollectionScreen({
  slug,
  onBack,
  onOpenBook,
  onImported,
}: PublicCollectionScreenProps) {
  const theme = useTheme();
  const { t, lang } = useI18n();
  const [doc, setDoc] = useState<PublicCollectionDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorKind, setErrorKind] = useState<'notFound' | 'auth' | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [importBusy, setImportBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setErrorKind(null);
      setDoc(null);
      const authOk = await ensureAnonymousAuthForPublicView();
      if (!authOk) {
        if (!cancelled) {
          setErrorKind('auth');
          setLoading(false);
        }
        return;
      }
      try {
        const data = await fetchPublicCollection(slug);
        if (cancelled) return;
        if (!data) {
          setErrorKind('notFound');
          setDoc(null);
        } else {
          setDoc(data);
        }
      } catch (err) {
        if (cancelled) return;
        console.warn('[PublicCollectionScreen] load failed:', err);
        setErrorKind('notFound');
        setDoc(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const openBook = useCallback(
    async (bookId: string, addToLibrary: boolean) => {
      if (busyId || importBusy) return;
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
          onImported?.();
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
    [busyId, importBusy, slug, onOpenBook, onImported, t]
  );

  const handleImportAll = useCallback(async () => {
    if (!doc || importBusy || busyId) return;
    if (!(doc.books?.length > 0)) {
      showAlert(t('alert.error'), t('public.importEmpty'));
      return;
    }
    setImportBusy(true);
    try {
      const result = await importPublicCollection(doc);
      showAlert(
        t('public.imported'),
        t('public.importedBody', {
          added: result.added,
          skipped: result.skipped,
        })
      );
      onImported?.(result.collectionId);
    } catch (err) {
      const empty =
        err instanceof Error && err.message === 'EMPTY_PUBLIC_COLLECTION';
      showAlert(
        t('alert.error'),
        empty
          ? t('public.importEmpty')
          : err instanceof Error
            ? err.message
            : t('public.importFail')
      );
    } finally {
      setImportBusy(false);
    }
  }, [doc, importBusy, busyId, onImported, t]);

  const errorTitle =
    errorKind === 'auth'
      ? t('public.loadFailAuthDisabled')
      : t('public.notFound');

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.bg }]}
      edges={['top', 'bottom']}
    >
      <View style={styles.header}>
        <Pressable onPress={onBack} hitSlop={8}>
          <Text style={[styles.back, { color: theme.accent }]}>
            ← {t('action.back')}
          </Text>
        </Pressable>
        <Text style={[styles.title, { color: theme.text }]}>
          {t('public.title')}
        </Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={theme.accent} />
          <Text style={[styles.muted, { color: theme.textMuted }]}>
            {t('public.loading')}
          </Text>
        </View>
      ) : errorKind ? (
        <View style={styles.center}>
          <Text style={[styles.errorText, { color: theme.text }]}>
            {errorTitle}
          </Text>
          <Pressable
            onPress={onBack}
            style={[styles.cta, { backgroundColor: theme.accentLime }]}
          >
            <Text style={styles.ctaText}>{t('public.goHome')}</Text>
          </Pressable>
        </View>
      ) : doc ? (
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
        >
          <View
            style={[
              styles.card,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}
          >
            <View
              style={[
                styles.swatch,
                { backgroundColor: doc.color || '#8B5CF6' },
              ]}
            />
            <Text style={[styles.docTitle, { color: theme.text }]}>
              {doc.title}
            </Text>
            {doc.description ? (
              <Text style={[styles.desc, { color: theme.textMuted }]}>
                {doc.description}
              </Text>
            ) : null}
            <Text style={[styles.meta, { color: theme.textMuted }]}>
              {catalogTextsCountLabel(doc.books?.length ?? 0, lang)}
              {' · '}
              {t('catalog.readOnly')}
            </Text>
            {(doc.books?.length ?? 0) > 0 ? (
              <Pressable
                disabled={importBusy || !!busyId}
                onPress={() => void handleImportAll()}
                style={[
                  styles.cta,
                  {
                    backgroundColor: theme.accentLime,
                    opacity: importBusy || busyId ? 0.5 : 1,
                    marginTop: 12,
                  },
                ]}
              >
                <Text style={styles.ctaText}>
                  {importBusy ? t('public.importBusy') : t('public.importAll')}
                </Text>
              </Pressable>
            ) : null}
          </View>

          <Text style={[styles.section, { color: theme.accent }]}>
            {t('public.texts')}
          </Text>

          {(doc.books ?? []).length === 0 ? (
            <Text style={[styles.muted, { color: theme.textMuted }]}>
              {t('public.emptyBooks')}
            </Text>
          ) : (
            (doc.books ?? []).map((b) => {
              const busy = busyId === b.id;
              const { original, native } = resolveBookDisplayTitles(b, lang);
              return (
                <View
                  key={b.id}
                  style={[
                    styles.bookCard,
                    {
                      backgroundColor: theme.surface,
                      borderColor: theme.border,
                    },
                  ]}
                >
                  <Text style={[styles.bookTitle, { color: theme.text }]}>
                    {original}
                  </Text>
                  {native ? (
                    <Text style={[styles.meta, { color: theme.textMuted }]}>
                      {native}
                    </Text>
                  ) : null}
                  <Text style={[styles.meta, { color: theme.textMuted }]}>
                    {catalogLanguageLabel(b.language, lang)}
                    {' · '}
                    {b.language === 'en'
                      ? t('catalog.cefrLevel', { n: b.targetHskLevel })
                      : t('catalog.hskLevel', { n: b.targetHskLevel })}
                  </Text>
                  <Pressable
                    disabled={!!busyId || importBusy}
                    onPress={() => void openBook(b.id, false)}
                    style={[
                      styles.secondaryBtn,
                      {
                        borderColor: theme.accentLime,
                        opacity: busyId || importBusy ? 0.5 : 1,
                      },
                    ]}
                  >
                    <Text style={[styles.secondaryBtnText, { color: theme.text }]}>
                      {busy ? t('catalog.opening') : t('action.read')}
                    </Text>
                  </Pressable>
                  <Pressable
                    disabled={!!busyId || importBusy}
                    onPress={() => void openBook(b.id, true)}
                    style={[
                      styles.secondaryBtn,
                      {
                        borderColor: theme.border,
                        opacity: busyId || importBusy ? 0.5 : 1,
                      },
                    ]}
                  >
                    <Text style={[styles.secondaryBtnText, { color: theme.text }]}>
                      {t('catalog.addToLibrary')}
                    </Text>
                  </Pressable>
                </View>
              );
            })
          )}
        </ScrollView>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12, gap: 4 },
  back: { fontSize: 15, fontWeight: '700' },
  title: { fontSize: 22, fontWeight: '800' },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 12,
  },
  muted: { fontSize: 13, marginTop: 8 },
  errorText: { fontSize: 15, fontWeight: '700', textAlign: 'center' },
  scroll: { padding: 16, paddingBottom: 40, gap: 12 },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 6,
  },
  swatch: { width: 40, height: 40, borderRadius: 12, marginBottom: 4 },
  docTitle: { fontSize: 20, fontWeight: '800' },
  desc: { fontSize: 13, lineHeight: 18 },
  meta: { fontSize: 11, fontWeight: '600' },
  section: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginTop: 8,
  },
  bookCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    gap: 6,
  },
  bookTitle: { fontSize: 15, fontWeight: '700' },
  cta: {
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
  },
  ctaText: { color: '#0D0D11', fontWeight: '800', fontSize: 14 },
  secondaryBtn: {
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 2,
  },
  secondaryBtnText: { fontSize: 12, fontWeight: '700' },
});
