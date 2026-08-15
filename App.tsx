import { StatusBar } from 'expo-status-bar';
import React, { Component, useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import LofiRadioPlayer from './src/components/LofiRadioPlayer';
import StarfieldBackground from './src/components/StarfieldBackground';
import AddBookScreen from './src/screens/AddBookScreen';
import CatalogScreen from './src/screens/CatalogScreen';
import CollectionDetailScreen from './src/screens/CollectionDetailScreen';
import FlashcardsScreen from './src/screens/FlashcardsScreen';
import HomeScreen from './src/screens/HomeScreen';
import MyLibraryScreen from './src/screens/MyLibraryScreen';
import PublicCollectionScreen from './src/screens/PublicCollectionScreen';
import ReaderScreen from './src/screens/ReaderScreen';
import { initAuth, waitAndConsumeGoogleBootstrap } from './src/services/authService';
import {
  ensureGuestOnboarding,
  hydrateStoreLanguagesFromPrefs,
  setLearningLanguage,
} from './src/services/onboardingService';
import { getBook, saveBook } from './src/services/storageService';
import {
  initSync,
  scheduleSyncDebounced,
  flushSyncNow,
  bootstrapCloudAfterAuth,
  reportNetworkConnectivity,
} from './src/services/syncService';
import { initNetworkStatusMonitoring } from './src/services/networkStatusService';
import { useAppStore } from './src/store/useAppStore';
import { ThemeProvider, useTheme } from './src/theme/ThemeContext';
import { I18nProvider } from './src/i18n/useI18n';
import { AppScreen, Book } from './src/types';
import MacDesktopShell from './src/web/MacDesktopShell';
import { registerPwaServiceWorker } from './src/web/registerPwa';

// Soft Y2K / WebCore global stylesheet (Tailwind + exact .glass / ruby styles)
if (Platform.OS === 'web') {
  require('./src/styles/global.generated.css');
  registerPwaServiceWorker();
}

type BootErrorKind = 'store' | 'init' | null;

interface ErrorBoundaryProps {
  children: React.ReactNode;
  onStoreError?: (message: string) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
  isStoreError: boolean;
}

class AppErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = {
    hasError: false,
    message: '',
    isStoreError: false,
  };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    const message = error?.message ?? String(error);
    const isStoreError =
      /store|zustand|rehydrat|AsyncStorage|localStorage|persist/i.test(message) ||
      /useAppStore/i.test(error?.stack ?? '');
    return { hasError: true, message, isStoreError };
  }

  componentDidCatch(error: Error) {
    const message = error?.message ?? String(error);
    if (
      /store|zustand|rehydrat|AsyncStorage|localStorage|persist/i.test(message) ||
      /useAppStore/i.test(error?.stack ?? '')
    ) {
      this.props.onStoreError?.(message);
    }
    console.error('[AppErrorBoundary]', error);
  }

  private handleRetry = () => {
    this.setState({ hasError: false, message: '', isStoreError: false });
  };

  render() {
    if (this.state.hasError) {
      const title = this.state.isStoreError
        ? 'Ошибка загрузки стора'
        : 'Ошибка приложения';
      return (
        <View style={styles.errorScreen}>
          <Text style={styles.errorTitle}>{title}</Text>
          <Text style={styles.errorBody}>
            {this.state.message || 'Не удалось запустить приложение.'}
          </Text>
          <Pressable style={styles.retryButton} onPress={this.handleRetry}>
            <Text style={styles.retryText}>Повторить</Text>
          </Pressable>
        </View>
      );
    }
    return this.props.children;
  }
}

function AppRoot() {
  const theme = useTheme();
  const midnightMode = useAppStore((s) => s.midnightMode);
  const [screen, setScreen] = useState<AppScreen>({ name: 'home' });
  const [currentBook, setCurrentBook] = useState<Book | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [bootError, setBootError] = useState<{
    kind: BootErrorKind;
    message: string;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    /** Жёсткий лимит: UI всегда показывается; чуть выше из‑за Google redirect. */
    const BOOT_TIMEOUT_MS = 12000;

    const withStepTimeout = async <T,>(
      label: string,
      promise: Promise<T>,
      ms: number
    ): Promise<T | null> => {
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        return await Promise.race([
          promise,
          new Promise<null>((resolve) => {
            timer = setTimeout(() => {
              console.error(
                `[App] boot step hung: «${label}» > ${ms}ms — продолжаем без ожидания`
              );
              resolve(null);
            }, ms);
          }),
        ]);
      } catch (err) {
        console.error(`[App] boot step failed: «${label}»`, err);
        return null;
      } finally {
        if (timer) clearTimeout(timer);
      }
    };

    const finishBoot = () => {
      if (!cancelled) {
        setInitializing(false);
      }
    };

    const hardTimer = setTimeout(() => {
      if (cancelled) return;
      console.error(
        `[App] boot hard-timeout ${BOOT_TIMEOUT_MS}ms — принудительно скрываем лоадер`
      );
      finishBoot();
    }, BOOT_TIMEOUT_MS);

    (async () => {
      try {
        try {
          useAppStore.getState();
        } catch (storeErr) {
          if (!cancelled) {
            setBootError({
              kind: 'store',
              message:
                storeErr instanceof Error ? storeErr.message : String(storeErr),
            });
            finishBoot();
          }
          return;
        }

        // Каждый шаг с собственным таймаутом — один зависший await не блокирует UI
        await withStepTimeout(
          'ensureGuestOnboarding',
          ensureGuestOnboarding(),
          2500
        );
        // Сначала дождаться Zustand persist (IndexedDB), иначе поздний rehydrate
        // мог откатить nativeLanguage уже после hydrateLanguages / свитчера.
        await withStepTimeout(
          'persistHydrate',
          new Promise<void>((resolve) => {
            if (useAppStore.persist.hasHydrated()) {
              resolve();
              return;
            }
            const unsub = useAppStore.persist.onFinishHydration(() => {
              unsub();
              resolve();
            });
          }),
          2500
        );
        await withStepTimeout(
          'hydrateLanguages',
          hydrateStoreLanguagesFromPrefs(),
          2500
        );
        await withStepTimeout('initAuth', initAuth(), 10000);

        // Возврат с Google redirect → подтянуть облако
        try {
          const googleUser = await withStepTimeout(
            'googleRedirect',
            waitAndConsumeGoogleBootstrap(),
            12000
          );
          if (googleUser) {
            console.log('[App] bootstrap after Google redirect', googleUser.uid);
            await withStepTimeout(
              'bootstrapGoogle',
              bootstrapCloudAfterAuth(googleUser),
              12000
            );
          }
        } catch (err) {
          console.error('[App] Google redirect bootstrap failed:', err);
        }

        // autoSync на старте может долго ждать сеть — не блокируем shell
        await withStepTimeout(
          'initSync',
          initSync({ autoSync: false }),
          1500
        );

        if (!cancelled) {
          // Фоновая синхронизация после показа UI
          void initSync({ autoSync: true }).catch((err) => {
            console.error('[App] background initSync failed:', err);
          });
        }
      } catch (err) {
        console.error('[App] init failed', err);
        if (!cancelled) {
          setBootError({
            kind: 'init',
            message: err instanceof Error ? err.message : String(err),
          });
        }
      } finally {
        clearTimeout(hardTimer);
        finishBoot();
      }
    })();

    return () => {
      cancelled = true;
      clearTimeout(hardTimer);
    };
  }, []);

  // Перед закрытием вкладки — выгрузить локальные правки в Firestore
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const onHide = () => {
      void flushSyncNow();
    };
    window.addEventListener('pagehide', onHide);
    window.addEventListener('beforeunload', onHide);
    return () => {
      window.removeEventListener('pagehide', onHide);
      window.removeEventListener('beforeunload', onHide);
    };
  }, []);

  // PWA: online/offline → статус + фоновая синхронизация при reconnect
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    return initNetworkStatusMonitoring((status) => {
      reportNetworkConnectivity(status !== 'offline');
    });
  }, []);

  const openBook = useCallback((book: Book) => {
    setCurrentBook(book);
    setScreen({ name: 'reader', bookId: book.id });
  }, []);

  const openBookById = useCallback(
    async (bookId: string) => {
      const book = await getBook(bookId);
      if (book) {
        openBook(book);
      }
    },
    [openBook]
  );

  const handleBookUpdate = useCallback(async (book: Book) => {
    setCurrentBook(book);
    await saveBook(book);
    scheduleSyncDebounced();
  }, []);

  const goHome = useCallback(() => {
    setCurrentBook(null);
    setScreen({ name: 'home' });
  }, []);

  const retryBoot = useCallback(() => {
    setBootError(null);
    setInitializing(true);
    const BOOT_TIMEOUT_MS = 4000;
    const hardTimer = setTimeout(() => {
      console.error('[App] retry hard-timeout — скрываем лоадер');
      setInitializing(false);
    }, BOOT_TIMEOUT_MS);

    void (async () => {
      try {
        useAppStore.getState();
        await Promise.race([
          (async () => {
            await ensureGuestOnboarding();
            await initAuth();
            const googleUser = await waitAndConsumeGoogleBootstrap();
            if (googleUser) {
              const { bootstrapCloudAfterAuth: boot } = await import(
                './src/services/cloudSyncService'
              );
              await boot(googleUser);
            }
            await initSync({ autoSync: false });
          })(),
          new Promise<void>((resolve) =>
            setTimeout(() => {
              console.error('[App] retry boot steps timed out');
              resolve();
            }, BOOT_TIMEOUT_MS)
          ),
        ]);
      } catch (err) {
        console.error('[App] retry failed', err);
        setBootError({
          kind: /store|zustand|persist/i.test(String(err)) ? 'store' : 'init',
          message: err instanceof Error ? err.message : String(err),
        });
      } finally {
        clearTimeout(hardTimer);
        setInitializing(false);
      }
    })();
  }, []);

  if (bootError) {
    const title =
      bootError.kind === 'store'
        ? 'Ошибка загрузки стора'
        : 'Ошибка запуска';
    return (
      <View style={[styles.errorScreen, { backgroundColor: theme.bg }]}>
        <StatusBar style={theme.statusBar} />
        <Text style={styles.errorTitle}>{title}</Text>
        <Text style={[styles.errorBody, { color: theme.textMuted }]}>{bootError.message}</Text>
        <Pressable
          style={[styles.retryButton, { backgroundColor: theme.accent }]}
          onPress={retryBoot}
        >
          <Text style={styles.retryText}>Повторить</Text>
        </Pressable>
      </View>
    );
  }

  if (initializing) {
    return (
      <View style={[styles.loading, { backgroundColor: theme.bg }]}>
        <StatusBar style={theme.statusBar} />
        <ActivityIndicator size="large" color={theme.accent} />
      </View>
    );
  }

  // Web: themed desktop shell (Dark Neon ↔ Soft Light)
  if (Platform.OS === 'web') {
    return (
      <View style={[styles.container, styles.webShell, { backgroundColor: theme.bg }]}>
        <StatusBar style={theme.statusBar} />
        <MacDesktopShell />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <StatusBar style={theme.statusBar} />
      {midnightMode ? <StarfieldBackground /> : null}

      <View style={{ flex: 1, zIndex: 1 }}>
      {screen.name === 'home' && (
        <HomeScreen
          onOpenBook={openBookById}
          onAddBook={(opts) =>
            setScreen({
              name: 'addBook',
              collectionId: opts?.collectionId,
              draftText: opts?.draftText,
              draftTitle: opts?.draftTitle,
            })
          }
          onOpenFlashcards={() => setScreen({ name: 'flashcards' })}
          onOpenCatalog={() => setScreen({ name: 'catalog' })}
          onOpenMyLibrary={() => setScreen({ name: 'myLibrary' })}
          onOpenCollection={(collectionId) =>
            setScreen({ name: 'collectionDetail', collectionId })
          }
        />
      )}

      {screen.name === 'myLibrary' && (
        <MyLibraryScreen
          onBack={goHome}
          onOpenBook={(book) => {
            const lang =
              book.language === 'en'
                ? 'en'
                : book.language === 'ru'
                  ? 'ru'
                  : 'zh';
            void setLearningLanguage(lang);
            openBook(book);
          }}
          onAddBook={(collectionId) =>
            setScreen({
              name: 'addBook',
              collectionId,
            })
          }
        />
      )}

      {screen.name === 'catalog' && (
        <CatalogScreen
          onBack={goHome}
          onOpenBook={(book) => {
            const lang =
              book.language === 'en'
                ? 'en'
                : book.language === 'ru'
                  ? 'ru'
                  : 'zh';
            void setLearningLanguage(lang);
            scheduleSyncDebounced();
            openBook(book);
          }}
          onOpenPublicCollection={(slug) =>
            setScreen({ name: 'publicCollection', slug })
          }
          onLibraryChanged={() => setScreen({ name: 'myLibrary' })}
        />
      )}

      {screen.name === 'publicCollection' && (
        <PublicCollectionScreen
          slug={screen.slug}
          onBack={() => setScreen({ name: 'catalog' })}
          onOpenBook={(book) => {
            const lang =
              book.language === 'en'
                ? 'en'
                : book.language === 'ru'
                  ? 'ru'
                  : 'zh';
            void setLearningLanguage(lang);
            scheduleSyncDebounced();
            openBook(book);
          }}
          onImported={() => setScreen({ name: 'myLibrary' })}
        />
      )}

      {screen.name === 'addBook' && (
        <AddBookScreen
          initialCollectionId={screen.collectionId}
          initialText={screen.draftText}
          initialTitle={screen.draftTitle}
          onBack={goHome}
          onBookCreated={(book) => {
            scheduleSyncDebounced();
            openBook(book);
          }}
        />
      )}

      {screen.name === 'reader' && currentBook && (
        <ReaderScreen
          book={currentBook}
          onBookUpdate={handleBookUpdate}
          onBack={goHome}
          onBookDeleted={goHome}
        />
      )}

      {screen.name === 'flashcards' && (
        <FlashcardsScreen onBack={goHome} />
      )}

      {screen.name === 'collectionDetail' && (
        <CollectionDetailScreen
          collectionId={screen.collectionId}
          onBack={goHome}
          onOpenBook={openBookById}
        />
      )}
      </View>

      <LofiRadioPlayer />
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <I18nProvider>
          <AppErrorBoundary>
            <AppRoot />
          </AppErrorBoundary>
        </I18nProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f6f2',
  },
  webShell: {
    height: '100%' as unknown as number,
    width: '100%' as unknown as number,
    backgroundColor: 'transparent',
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f6f2',
  },
  errorScreen: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f6f2',
    paddingHorizontal: 28,
    gap: 12,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#b91c1c',
    textAlign: 'center',
  },
  errorBody: {
    fontSize: 14,
    lineHeight: 20,
    color: '#475569',
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 8,
    backgroundColor: '#4a90d9',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
  },
  retryText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
});
