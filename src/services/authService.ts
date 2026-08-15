import {
  createUserWithEmailAndPassword,
  getRedirectResult,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInAnonymously,
  signInWithEmailAndPassword,
  signInWithRedirect,
  signOut as firebaseSignOut,
  type Auth,
} from 'firebase/auth';
import {
  getFirebase,
  getFirebaseInitError,
  getFirebaseSetupHint,
  isFirebaseConfigured,
} from './firebaseClient';
import { Platform } from 'react-native';

export type AuthUser = {
  uid: string;
  email: string | null;
  isAnonymous: boolean;
};

export type AuthStatus = 'loading' | 'guest' | 'authenticated' | 'unconfigured';

export interface AuthState {
  status: AuthStatus;
  user: AuthUser | null;
  error?: string;
}

/** Ошибка Auth с кодом Firebase — UI может отличить login от register. */
export class AuthError extends Error {
  readonly code: string;
  readonly action: 'login' | 'register' | 'other';

  constructor(
    code: string,
    message: string,
    action: 'login' | 'register' | 'other' = 'other'
  ) {
    super(message);
    this.name = 'AuthError';
    this.code = code;
    this.action = action;
  }
}

type AuthListener = (state: AuthState) => void;

const listeners = new Set<AuthListener>();

let currentState: AuthState = {
  status: isFirebaseConfigured() ? 'loading' : 'unconfigured',
  user: null,
};

let authUnsub: (() => void) | null = null;
let initPromise: Promise<void> | null = null;

/** Пользователь после возврата с Google redirect — App делает bootstrapCloudAfterAuth. */
let pendingGoogleBootstrap: AuthUser | null = null;

const GOOGLE_REDIRECT_FLAG = 'languageeee_google_redirect';

/** Забрать и сбросить пользователя после Google redirect (один раз). */
export function consumePendingGoogleBootstrap(): AuthUser | null {
  const user = pendingGoogleBootstrap;
  pendingGoogleBootstrap = null;
  return user;
}

/**
 * Дождаться initAuth (включая getRedirectResult), затем отдать Google-пользователя.
 * Нужен App boot: короткий timeout не должен оборвать redirect до bootstrap.
 */
export async function waitAndConsumeGoogleBootstrap(): Promise<AuthUser | null> {
  if (initPromise) {
    try {
      await initPromise;
    } catch (err) {
      console.warn('[auth] waitAndConsumeGoogleBootstrap: initPromise', err);
    }
  }
  return consumePendingGoogleBootstrap();
}

function logGoogleAuthError(where: string, e: unknown): void {
  const code =
    e && typeof e === 'object' && 'code' in e
      ? String((e as { code: unknown }).code)
      : undefined;
  const message = e instanceof Error ? e.message : String(e);
  const origin =
    typeof window !== 'undefined' ? window.location.origin : undefined;
  console.error(`[auth] Google ${where} FAILED`, {
    code: code ?? 'auth/unknown',
    message,
    origin,
    raw: e,
  });
}

function setState(patch: Partial<AuthState>) {
  currentState = { ...currentState, ...patch };
  listeners.forEach((fn) => fn(currentState));
}

function toAuthUser(user: {
  uid: string;
  email: string | null;
  isAnonymous: boolean;
}): AuthUser {
  return {
    uid: user.uid,
    email: user.email,
    isAnonymous: user.isAnonymous,
  };
}

/** Сообщение, когда getFirebase() вернул null. */
function unconfiguredMessage(): string {
  if (!isFirebaseConfigured()) {
    return getFirebaseSetupHint();
  }
  const detail = getFirebaseInitError();
  return detail
    ? `Firebase не запустился: ${detail}`
    : getFirebaseSetupHint();
}

export function getAuthState(): AuthState {
  return currentState;
}

export function subscribeAuthState(listener: AuthListener): () => void {
  listeners.add(listener);
  listener(currentState);
  return () => listeners.delete(listener);
}

/** true, если есть аккаунт с email (не гость и не anonymous). */
export function isCloudUser(state: AuthState = currentState): boolean {
  return (
    state.status === 'authenticated' &&
    Boolean(state.user?.uid) &&
    !state.user?.isAnonymous &&
    Boolean(state.user?.email)
  );
}

/**
 * Анонимный Firebase Auth только для чтения публичных ссылок (/c|/d|/u).
 * Не трогает уже залогиненного пользователя и не делает isCloudUser() true
 * (anonymous → status guest, без email).
 */
export async function ensureAnonymousAuthForPublicView(): Promise<boolean> {
  if (!isFirebaseConfigured()) {
    console.warn(
      '[auth] ensureAnonymousAuthForPublicView: Firebase не настроен'
    );
    return false;
  }

  try {
    await initAuth();
  } catch (err) {
    console.warn('[auth] ensureAnonymousAuthForPublicView: initAuth', err);
  }

  const firebase = await getFirebase();
  if (!firebase) {
    console.warn(
      '[auth] ensureAnonymousAuthForPublicView: getFirebase() вернул null'
    );
    return false;
  }

  if (firebase.auth.currentUser) {
    return true;
  }

  try {
    const cred = await signInAnonymously(firebase.auth);
    if (!cred.user?.uid) {
      console.warn(
        '[auth] ensureAnonymousAuthForPublicView: пустой anonymous uid'
      );
      return false;
    }
    // onAuthStateChanged выставит guest + user.isAnonymous; не форсим authenticated
    return true;
  } catch (err) {
    const code =
      err && typeof err === 'object' && 'code' in err
        ? String((err as { code: unknown }).code)
        : 'unknown';
    console.warn(
      '[auth] ensureAnonymousAuthForPublicView failed:',
      code,
      err
    );
    return false;
  }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Перед сменой аккаунта — выгрузить данные текущего пользователя в его Firestore. */
async function flushCurrentUserBeforeAuthSwitch(): Promise<void> {
  if (!isCloudUser()) return;
  try {
    const { flushSyncNow } = await import('./cloudSyncService');
    await withTimeout(flushSyncNow(), 2500, 'flush before account switch');
  } catch (err) {
    console.warn('[auth] flush before account switch failed:', err);
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${label}: превышен лимит ${ms} мс`));
    }, ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

/** Локальная валидация до вызова Firebase. */
export function validateCredentials(
  email: string,
  password: string,
  action: 'login' | 'register'
): void {
  const trimmed = email.trim();
  if (!trimmed) {
    throw new AuthError('validation/empty-email', 'Введите Email.', action);
  }
  if (!EMAIL_RE.test(trimmed)) {
    throw new AuthError(
      'auth/invalid-email',
      'Некорректный формат Email.',
      action
    );
  }
  if (!password) {
    throw new AuthError('validation/empty-password', 'Введите пароль.', action);
  }
  if (password.length < 6) {
    throw new AuthError(
      'auth/weak-password',
      'Пароль слишком простой (минимум 6 символов).',
      action
    );
  }
}

function mapAuthError(
  e: unknown,
  action: 'login' | 'register' | 'other'
): AuthError {
  if (e instanceof AuthError) return e;

  const code =
    e && typeof e === 'object' && 'code' in e
      ? String((e as { code: string }).code)
      : 'auth/unknown';

  let message: string;
  switch (code) {
    case 'auth/email-already-in-use':
      message =
        'Этот Email уже зарегистрирован. Перейдите на вкладку «Вход».';
      break;
    case 'auth/invalid-email':
      message = 'Некорректный формат Email.';
      break;
    case 'auth/weak-password':
      message = 'Пароль слишком простой (минимум 6 символов).';
      break;
    case 'auth/user-not-found':
      message =
        'Аккаунт с таким Email не найден. Откройте вкладку «Регистрация».';
      break;
    case 'auth/wrong-password':
      message = 'Неверный пароль.';
      break;
    case 'auth/invalid-credential':
      message =
        action === 'login'
          ? 'Неверный email или пароль. Если аккаунта ещё нет — откройте вкладку «Регистрация».'
          : 'Не удалось создать аккаунт. Проверьте email и пароль.';
      break;
    case 'auth/operation-not-allowed':
      message =
        'В Firebase Console включите Authentication → Email/Password.';
      break;
    case 'auth/too-many-requests':
      message = 'Слишком много попыток. Попробуйте позже.';
      break;
    case 'auth/network-request-failed':
      message = 'Нет сети. Проверьте подключение.';
      break;
    case 'auth/popup-closed-by-user':
      message = 'Окно входа закрыто. Попробуйте ещё раз.';
      break;
    case 'auth/cancelled-popup-request':
      message = 'Вход через Google отменён.';
      break;
    case 'auth/popup-blocked':
      message =
        'Браузер заблокировал всплывающее окно. Обновите страницу — вход идёт через перенаправление.';
      break;
    case 'auth/unauthorized-domain': {
      const origin =
        typeof window !== 'undefined' ? window.location.origin : '(unknown)';
      message =
        `Домен не разрешён в Firebase Auth (${origin}). ` +
        'Firebase Console → Authentication → Settings → Authorized domains — добавьте этот хост.';
      break;
    }
    case 'auth/redirect-cancelled-by-user':
      message = 'Вход через Google отменён.';
      break;
    case 'auth/redirect-operation-pending':
    case 'auth/redirect-pending':
      message = 'Перенаправление на Google…';
      break;
    case 'auth/account-exists-with-different-credential':
      message =
        'Этот Email уже зарегистрирован через Email/пароль. Войдите с паролем.';
      break;
    default:
      message = e instanceof Error ? e.message : 'Ошибка авторизации';
  }

  return new AuthError(code, message, action);
}

export function parseAuthError(
  e: unknown,
  action: 'login' | 'register' | 'other' = 'other'
): AuthError {
  return mapAuthError(e, action);
}

/** Подписка на Firebase Auth. Вызывать один раз при старте. */
export async function initAuth(): Promise<AuthState> {
  if (!isFirebaseConfigured()) {
    setState({ status: 'unconfigured', user: null });
    return currentState;
  }

  if (initPromise) {
    await initPromise;
    return currentState;
  }

  initPromise = (async () => {
    const firebase = await getFirebase();
    if (!firebase) {
      setState({ status: 'unconfigured', user: null });
      return;
    }

    // Сначала результат Google redirect (до подписки) — иначе ошибки redirect теряются
    if (Platform.OS === 'web' || typeof window !== 'undefined') {
      await completeGoogleRedirectResult(firebase.auth);
    }

    await new Promise<void>((resolve) => {
      const AUTH_WAIT_MS = 3500;
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve();
      };

      const timer = setTimeout(() => {
        console.error(
          `[auth] onAuthStateChanged не ответил за ${AUTH_WAIT_MS}ms — продолжаем как guest`
        );
        if (currentState.status === 'loading') {
          setState({ status: 'guest', user: null });
        }
        finish();
      }, AUTH_WAIT_MS);

      authUnsub?.();
      authUnsub = onAuthStateChanged(firebase.auth, (user) => {
        if (user && !user.isAnonymous) {
          setState({
            status: 'authenticated',
            user: toAuthUser(user),
            error: undefined,
          });
        } else {
          setState({
            status: 'guest',
            user: user ? toAuthUser(user) : null,
            error: undefined,
          });
        }
        finish();
      });
    });
  })();

  await initPromise;
  return currentState;
}

/**
 * Обработка возврата с Google (signInWithRedirect).
 * Вызывать один раз при старте приложения.
 */
async function completeGoogleRedirectResult(auth: Auth): Promise<void> {
  try {
    console.log('[auth] getRedirectResult…', {
      origin: typeof window !== 'undefined' ? window.location.origin : undefined,
    });
    const result = await getRedirectResult(auth);
    if (result?.user) {
      const user = toAuthUser(result.user);
      console.log('[auth] Google redirect OK', {
        uid: user.uid,
        email: user.email,
        providerId: result.providerId,
      });
      setState({ status: 'authenticated', user, error: undefined });
      pendingGoogleBootstrap = user;
      try {
        sessionStorage.removeItem(GOOGLE_REDIRECT_FLAG);
      } catch {
        /* ignore */
      }
      return;
    }
    console.log('[auth] getRedirectResult: нет результата redirect');
  } catch (e) {
    logGoogleAuthError('getRedirectResult', e);
    try {
      sessionStorage.removeItem(GOOGLE_REDIRECT_FLAG);
    } catch {
      /* ignore */
    }
    const err = mapAuthError(e, 'login');
    // Не роняем boot — показываем ошибку в auth state
    setState({
      status: currentState.status === 'loading' ? 'guest' : currentState.status,
      error: err.message,
    });
  }
}

/**
 * РЕГИСТРАЦИЯ — создаёт пользователя в Firebase Auth.
 * Вызывает ТОЛЬКО `createUserWithEmailAndPassword`. Никогда не вызывает signIn.
 */
export async function register(
  email: string,
  password: string
): Promise<AuthUser> {
  validateCredentials(email, password, 'register');
  await flushCurrentUserBeforeAuthSwitch();

  const trimmed = email.trim().toLowerCase();
  const firebase = await getFirebase();
  if (!firebase) {
    throw new AuthError('auth/unconfigured', unconfiguredMessage(), 'register');
  }

  console.log(
    '[auth] REGISTER → createUserWithEmailAndPassword (НЕ signIn)',
    trimmed
  );

  try {
    const cred = await createUserWithEmailAndPassword(
      firebase.auth,
      trimmed,
      password
    );

    if (!cred.user?.uid) {
      throw new AuthError(
        'auth/unknown',
        'Регистрация не создала пользователя. Попробуйте ещё раз.',
        'register'
      );
    }

    console.log('[auth] REGISTER OK, uid=', cred.user.uid);
    const user = toAuthUser(cred.user);
    setState({ status: 'authenticated', user, error: undefined });
    return user;
  } catch (e) {
    console.error('[auth] REGISTER FAILED', e);
    const err = mapAuthError(e, 'register');
    setState({ error: err.message });
    throw err;
  }
}

/**
 * ВХОД — только для уже существующего аккаунта.
 * Вызывает ТОЛЬКО `signInWithEmailAndPassword`. Никогда не вызывает createUser.
 */
export async function login(
  email: string,
  password: string
): Promise<AuthUser> {
  validateCredentials(email, password, 'login');
  await flushCurrentUserBeforeAuthSwitch();

  const trimmed = email.trim().toLowerCase();
  const firebase = await getFirebase();
  if (!firebase) {
    throw new AuthError('auth/unconfigured', unconfiguredMessage(), 'login');
  }

  console.log(
    '[auth] LOGIN → signInWithEmailAndPassword (НЕ createUser)',
    trimmed
  );

  try {
    const cred = await signInWithEmailAndPassword(
      firebase.auth,
      trimmed,
      password
    );
    console.log('[auth] LOGIN OK, uid=', cred.user.uid);
    const user = toAuthUser(cred.user);
    setState({ status: 'authenticated', user, error: undefined });
    return user;
  } catch (e) {
    console.error('[auth] LOGIN FAILED', e);
    const err = mapAuthError(e, 'login');
    setState({ error: err.message });
    throw err;
  }
}

/** @deprecated Используйте `register` */
export const registerWithEmail = register;

/** @deprecated Используйте `login` */
export const signInWithEmail = login;

/**
 * Вход через Google (Firebase Auth) — только signInWithRedirect.
 * Страница уходит на Google; после возврата initAuth → getRedirectResult
 * и App вызывает consumePendingGoogleBootstrap() + bootstrapCloudAfterAuth.
 */
export async function loginWithGoogle(): Promise<AuthUser> {
  await flushCurrentUserBeforeAuthSwitch();

  const firebase = await getFirebase();
  if (!firebase) {
    throw new AuthError('auth/unconfigured', unconfiguredMessage(), 'login');
  }

  if (typeof window === 'undefined') {
    throw new AuthError(
      'auth/operation-not-allowed',
      'Вход через Google доступен в веб-версии.',
      'login'
    );
  }

  const provider = new GoogleAuthProvider();
  provider.addScope('email');
  provider.addScope('profile');
  provider.setCustomParameters({ prompt: 'select_account' });

  const origin = window.location.origin;
  console.log('[auth] LOGIN → Google signInWithRedirect', { origin });

  try {
    try {
      sessionStorage.setItem(GOOGLE_REDIRECT_FLAG, '1');
    } catch {
      /* private mode — ок */
    }

    await signInWithRedirect(firebase.auth, provider);
    // Обычно страница уже ушла на Google. Если нет — сообщаем UI.
    throw new AuthError(
      'auth/redirect-pending',
      'Перенаправление на Google… Если страница не обновилась — обновите вкладку.',
      'login'
    );
  } catch (e) {
    if (e instanceof AuthError && e.code === 'auth/redirect-pending') {
      throw e;
    }
    logGoogleAuthError('signInWithRedirect', e);
    try {
      sessionStorage.removeItem(GOOGLE_REDIRECT_FLAG);
    } catch {
      /* ignore */
    }
    const err = mapAuthError(e, 'login');
    setState({ error: err.message });
    throw err;
  }
}

/**
 * Выход из аккаунта.
 * Не блокируется навечно: flush / Firebase / очистка — с таймаутами.
 * В finally всегда сбрасываем локальный auth-стейт в guest.
 */
export async function signOut(): Promise<void> {
  const FLUSH_MS = 6000;
  const FIREBASE_MS = 3000;
  const CLEAR_MS = 2500;

  try {
    // 1) Стоп фонового sync / in-flight apply (аналог unsubscribe слушателей)
    try {
      const { cancelPendingSync } = await import('./cloudSyncService');
      cancelPendingSync();
    } catch {
      /* ignore */
    }

    // 2) Best-effort выгрузка, пока ещё залогинены — но не дольше FLUSH_MS
    try {
      if (isCloudUser()) {
        const { flushSyncNow } = await import('./cloudSyncService');
        await withTimeout(flushSyncNow(), FLUSH_MS, 'flushSyncNow');
      }
    } catch (err) {
      console.warn('[auth] flushSyncNow before signOut skipped:', err);
    }

    // 3) Снова стоп sync — на случай, если flush успел запустить новый цикл
    try {
      const { cancelPendingSync } = await import('./cloudSyncService');
      cancelPendingSync();
    } catch {
      /* ignore */
    }

    // 4) Локальный стейт → guest сразу (UI разблокируется)
    setState({ status: 'guest', user: null, error: undefined });

    // 5) Firebase Auth signOut с таймаутом
    try {
      const firebase = await withTimeout(getFirebase(), 2000, 'getFirebase');
      if (firebase) {
        await withTimeout(
          firebaseSignOut(firebase.auth),
          FIREBASE_MS,
          'firebaseSignOut'
        );
      }
    } catch (err) {
      console.warn('[auth] firebaseSignOut failed/timeout:', err);
      // Локально уже guest — продолжаем очистку
    }

    // 6) Очистка локальных данных (AsyncStorage / Zustand / IDB)
    try {
      const { clearUserLocalData } = await import('./localDataResetService');
      await withTimeout(clearUserLocalData(), CLEAR_MS, 'clearUserLocalData');
    } catch (err) {
      console.warn('[auth] clearUserLocalData failed/timeout:', err);
      try {
        const { resetZustandUserState } = await import('./localDataResetService');
        resetZustandUserState();
      } catch {
        /* ignore */
      }
      try {
        const { markLocalDataCleared, cancelPendingSync } = await import(
          './cloudSyncService'
        );
        cancelPendingSync();
        markLocalDataCleared();
      } catch {
        /* ignore */
      }
    }
  } catch (err) {
    console.warn('[auth] signOut unexpected error:', err);
  } finally {
    // Гарантия: UI всегда видит гостя, даже если Firebase завис
    setState({ status: 'guest', user: null, error: undefined });
    try {
      const { cancelPendingSync, markLocalDataCleared } = await import(
        './cloudSyncService'
      );
      cancelPendingSync();
      markLocalDataCleared();
    } catch {
      /* ignore */
    }
  }
}

/** Текущий UID для облачной синхронизации (только email-аккаунт). */
export function getCloudUid(): string | null {
  if (!isCloudUser()) return null;
  return currentState.user?.uid ?? null;
}

/**
 * Ждёт, пока Auth выйдет из `loading` (первый onAuthStateChanged или timeout).
 * Не бросает — возвращает текущее состояние.
 */
export async function waitUntilAuthReady(timeoutMs = 8000): Promise<AuthState> {
  if (!isFirebaseConfigured()) {
    return currentState;
  }
  if (currentState.status !== 'loading') {
    return currentState;
  }

  try {
    await initAuth();
  } catch (err) {
    console.warn('[auth] waitUntilAuthReady: initAuth failed:', err);
  }

  if (currentState.status !== 'loading') {
    return currentState;
  }

  return new Promise<AuthState>((resolve) => {
    const timer = setTimeout(() => {
      unsub();
      console.warn(
        `[auth] waitUntilAuthReady: timeout ${timeoutMs}ms, status=${currentState.status}`
      );
      resolve(currentState);
    }, timeoutMs);

    const unsub = subscribeAuthState((state) => {
      if (state.status !== 'loading') {
        clearTimeout(timer);
        unsub();
        resolve(state);
      }
    });
  });
}

/**
 * UID для путей Firestore `users/{uid}/...`.
 * Источник правды — `auth.currentUser.uid` (как в Security Rules),
 * зеркало `getCloudUid()` — только запасной вариант.
 * Возвращает null, если пользователь ещё не готов (не бросает).
 */
export async function resolveFirestoreUid(): Promise<string | null> {
  await waitUntilAuthReady();

  try {
    const firebase = await getFirebase();
    const current = firebase?.auth.currentUser;
    if (current?.uid && !current.isAnonymous) {
      // Подтянуть зеркало, если SDK уже знает пользователя
      if (
        currentState.status !== 'authenticated' ||
        currentState.user?.uid !== current.uid
      ) {
        setState({
          status: 'authenticated',
          user: toAuthUser(current),
          error: undefined,
        });
      }
      return current.uid;
    }
  } catch (err) {
    console.warn('[auth] resolveFirestoreUid: не удалось прочитать currentUser:', err);
  }

  const mirrored = getCloudUid();
  if (!mirrored) {
    console.warn(
      '[auth] resolveFirestoreUid: auth.currentUser=null, зеркало тоже пусто — sync отложен'
    );
  }
  return mirrored;
}
