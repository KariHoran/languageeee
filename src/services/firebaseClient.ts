/**
 * Ленивая инициализация Firebase App / Auth / Firestore.
 * Без EXPO_PUBLIC_FIREBASE_* приложение работает только локально.
 *
 * Firebase Storage НЕ используется (Spark / без привязки карты).
 * Музыка хранится локально (IndexedDB); книги/подборки — в Firestore.
 *
 * Источники конфига (по приоритету):
 * 1. process.env.EXPO_PUBLIC_* — Expo/Metro (expo/virtual/env)
 * 2. Constants.expoConfig.extra.firebase — из app.config.js
 *
 * Важно: статические import'ы Firebase (не await import) —
 * иначе Metro web отдаёт «Requiring unknown module N».
 */

import Constants from 'expo-constants';
import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import {
  getAuth,
  initializeAuth,
  type Auth,
} from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { Platform } from 'react-native';

export type FirebasePublicConfig = {
  apiKey: string;
  authDomain: string;
  projectId: string;
  /** Опционально в .env; SDK не вызывает Storage. */
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
};

function trimEnv(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * Динамический доступ к process.env — не ломается, если static rewrite
 * в expo/virtual/env расходится с HMR-инъекцией.
 */
function envGet(name: string): string {
  try {
    return trimEnv((process.env as Record<string, string | undefined>)[name]);
  } catch {
    return '';
  }
}

function readFromProcessEnv(): FirebasePublicConfig {
  return {
    apiKey: envGet('EXPO_PUBLIC_FIREBASE_API_KEY'),
    authDomain: envGet('EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN'),
    projectId: envGet('EXPO_PUBLIC_FIREBASE_PROJECT_ID'),
    storageBucket: envGet('EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET'),
    messagingSenderId: envGet('EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID'),
    appId: envGet('EXPO_PUBLIC_FIREBASE_APP_ID'),
  };
}

function readFromExpoExtra(): Partial<FirebasePublicConfig> {
  const extra = (Constants.expoConfig?.extra ??
    (Constants as { manifest?: { extra?: unknown } }).manifest?.extra) as
    | { firebase?: Partial<Record<keyof FirebasePublicConfig, unknown>> }
    | undefined;
  const fb = extra?.firebase;
  if (!fb) return {};
  return {
    apiKey: trimEnv(fb.apiKey),
    authDomain: trimEnv(fb.authDomain),
    projectId: trimEnv(fb.projectId),
    storageBucket: trimEnv(fb.storageBucket),
    messagingSenderId: trimEnv(fb.messagingSenderId),
    appId: trimEnv(fb.appId),
  };
}

/** Итоговый публичный конфиг Firebase для клиента. */
export function getFirebasePublicConfig(): FirebasePublicConfig {
  const fromEnv = readFromProcessEnv();
  const fromExtra = readFromExpoExtra();
  return {
    apiKey: fromEnv.apiKey || fromExtra.apiKey || '',
    authDomain: fromEnv.authDomain || fromExtra.authDomain || '',
    projectId: fromEnv.projectId || fromExtra.projectId || '',
    storageBucket: fromEnv.storageBucket || fromExtra.storageBucket || '',
    messagingSenderId:
      fromEnv.messagingSenderId || fromExtra.messagingSenderId || '',
    appId: fromEnv.appId || fromExtra.appId || '',
  };
}

export function isFirebaseConfigured(): boolean {
  const c = getFirebasePublicConfig();
  return Boolean(c.apiKey && c.authDomain && c.projectId && c.appId);
}

/** Какие обязательные переменные не заданы (для подсказки в UI). */
export function getMissingFirebaseEnvKeys(): string[] {
  const c = getFirebasePublicConfig();
  const required: Array<[string, string]> = [
    ['EXPO_PUBLIC_FIREBASE_API_KEY', c.apiKey],
    ['EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN', c.authDomain],
    ['EXPO_PUBLIC_FIREBASE_PROJECT_ID', c.projectId],
    ['EXPO_PUBLIC_FIREBASE_APP_ID', c.appId],
  ];
  return required.filter(([, value]) => !value).map(([key]) => key);
}

/** Текст подсказки, если Firebase не настроен. */
export function getFirebaseSetupHint(): string {
  const missing = getMissingFirebaseEnvKeys();
  if (missing.length === 0) {
    return (
      'Firebase не инициализирован.\n' +
      'Перезапустите: npx expo start --web --offline --clear\n' +
      (lastInitError ? `\nДетали: ${lastInitError}` : '')
    );
  }
  return (
    'Облако не настроено.\n\n' +
    '1. Скопируйте `.env.example` → `.env` в корне проекта\n' +
    '2. Firebase Console → Project settings → Your apps → Web app → скопируйте конфиг\n' +
    '3. Заполните в .env:\n' +
    missing.map((k) => `   • ${k}`).join('\n') +
    '\n4. Включите Authentication → Email/Password (+ Google)\n' +
    '5. Создайте Firestore Database (Spark — без Storage)\n' +
    '6. Перезапустите сервер: `npx expo start --web --offline --clear`'
  );
}

export type FirebaseBundle = {
  app: FirebaseApp;
  auth: Auth;
  db: Firestore;
};

let cached: FirebaseBundle | null | undefined;
let lastInitError: string | null = null;

/** Последняя ошибка инициализации (для UI). */
export function getFirebaseInitError(): string | null {
  return lastInitError;
}

/** Сброс кэша (после смены env / hot reload). */
export function resetFirebaseClientCache(): void {
  cached = undefined;
  lastInitError = null;
}

function createAuth(app: FirebaseApp): Auth {
  if (Platform.OS === 'web') {
    return getAuth(app);
  }

  // Native: пробуем AsyncStorage persistence без динамического import firebase/auth.
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const AsyncStorage =
      require('@react-native-async-storage/async-storage').default;
    const getReactNativePersistence = (
      require('firebase/auth') as {
        getReactNativePersistence?: (storage: unknown) => unknown;
      }
    ).getReactNativePersistence;

    if (typeof getReactNativePersistence === 'function') {
      return initializeAuth(app, {
        persistence: getReactNativePersistence(AsyncStorage) as never,
      });
    }
  } catch (e: unknown) {
    const code =
      e && typeof e === 'object' && 'code' in e
        ? String((e as { code: unknown }).code)
        : '';
    if (code === 'auth/already-initialized') {
      return getAuth(app);
    }
    console.warn('[firebaseClient] native auth persistence skipped:', e);
  }

  return getAuth(app);
}

/** Возвращает Firebase или null, если env не задан / инициализация не удалась. */
export async function getFirebase(): Promise<FirebaseBundle | null> {
  if (cached) return cached;
  if (!isFirebaseConfigured()) {
    cached = undefined;
    return null;
  }

  try {
    const config = getFirebasePublicConfig();
    // storageBucket в конфиге можно оставить пустым — Storage SDK не подключаем
    const app = getApps().length
      ? getApp()
      : initializeApp({
          apiKey: config.apiKey,
          authDomain: config.authDomain,
          projectId: config.projectId,
          messagingSenderId: config.messagingSenderId,
          appId: config.appId,
          ...(config.storageBucket
            ? { storageBucket: config.storageBucket }
            : {}),
        });
    const auth = createAuth(app);
    const db = getFirestore(app);

    cached = { app, auth, db };
    lastInitError = null;
    return cached;
  } catch (err) {
    lastInitError = err instanceof Error ? err.message : String(err);
    console.error('[firebaseClient] initialize failed:', err);
    cached = undefined;
    return null;
  }
}
