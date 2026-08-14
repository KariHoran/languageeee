import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  getAuthState,
  login,
  loginWithGoogle,
  parseAuthError,
  register,
  signOut,
  subscribeAuthState,
  type AuthState,
} from '../services/authService';
import { bootstrapCloudAfterAuth, syncData } from '../services/cloudSyncService';
import { getFirebaseSetupHint, isFirebaseConfigured } from '../services/firebaseClient';
import { softShadow } from '../utils/shadow';

interface AuthModalProps {
  visible: boolean;
  onClose: () => void;
  onAuthenticated?: () => void;
}

/** Локальная проверка до запроса в Firebase. Возвращает текст ошибки или null. */
function validateForm(email: string, password: string): string | null {
  if (!email.trim()) {
    return 'Введите Email.';
  }
  if (!password) {
    return 'Введите пароль.';
  }
  if (password.length < 6) {
    return 'Пароль должен быть не короче 6 символов.';
  }
  return null;
}

export default function AuthModal({
  visible,
  onClose,
  onAuthenticated,
}: AuthModalProps) {
  const [auth, setAuth] = useState<AuthState>(getAuthState);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** true = Вход, false = Регистрация */
  const [isLogin, setIsLogin] = useState(true);
  const isLoginRef = useRef(true);

  useEffect(() => subscribeAuthState(setAuth), []);

  useEffect(() => {
    if (visible) {
      setError(null);
      setPassword('');
      setIsLogin(true);
      isLoginRef.current = true;
      setBusy(false);
    }
  }, [visible]);

  useEffect(() => {
    isLoginRef.current = isLogin;
  }, [isLogin]);

  const isLoggedIn =
    auth.status === 'authenticated' && Boolean(auth.user?.email);

  const selectLogin = () => {
    isLoginRef.current = true;
    setIsLogin(true);
    setError(null);
  };

  const selectRegister = () => {
    isLoginRef.current = false;
    setIsLogin(false);
    setError(null);
  };

  /** ВХОД — через authService.login */
  const submitLogin = async () => {
    const validationError = validateForm(email, password);
    if (validationError) {
      setError(validationError);
      return;
    }

    setBusy(true);
    setError(null);

    try {
      if (!isFirebaseConfigured()) {
        setError(getFirebaseSetupHint());
        return;
      }
      const user = await login(email, password);
      await bootstrapCloudAfterAuth(user);
      onAuthenticated?.();
      onClose();
    } catch (e) {
      setError(parseAuthError(e, 'login').message);
    } finally {
      setBusy(false);
    }
  };

  /** РЕГИСТРАЦИЯ — через authService.register (+ онбординг в bootstrap) */
  const submitRegister = async () => {
    const validationError = validateForm(email, password);
    if (validationError) {
      setError(validationError);
      return;
    }

    setBusy(true);
    setError(null);

    try {
      if (!isFirebaseConfigured()) {
        setError(getFirebaseSetupHint());
        return;
      }
      const user = await register(email, password);
      await bootstrapCloudAfterAuth(user);
      onAuthenticated?.();
      onClose();
    } catch (e) {
      setError(parseAuthError(e, 'register').message);
    } finally {
      setBusy(false);
    }
  };

  const submitGoogle = async () => {
    setBusy(true);
    setError(null);
    try {
      if (!isFirebaseConfigured()) {
        setError(getFirebaseSetupHint());
        return;
      }
      // signInWithRedirect — страница уйдёт на Google; bootstrap после возврата в App.
      await loginWithGoogle();
    } catch (e) {
      const err = parseAuthError(e, 'login');
      // Ожидаемо, пока идёт redirect — не показываем как фатальную ошибку
      if (
        err.code === 'auth/redirect-pending' ||
        err.code === 'auth/redirect-operation-pending'
      ) {
        setError('Перенаправление на Google…');
        return;
      }
      console.error('[AuthModal] Google login error', {
        code: err.code,
        message: err.message,
      });
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  /** Enter в поле пароля — вызывает метод текущей вкладки (через ref). */
  const submitCurrentMode = () => {
    if (isLoginRef.current) {
      void submitLogin();
    } else {
      void submitRegister();
    }
  };

  const handleSignOut = async () => {
    setBusy(true);
    setError(null);
    const UI_TIMEOUT_MS = 8000;
    try {
      await Promise.race([
        signOut(),
        new Promise<void>((_, reject) => {
          setTimeout(
            () => reject(new Error('Выход занял слишком много времени')),
            UI_TIMEOUT_MS
          );
        }),
      ]);
    } catch (e) {
      // signOut сам сбрасывает стейт в finally — всё равно закрываем модалку
      console.warn('[AuthModal] signOut:', e);
    } finally {
      setBusy(false);
      onAuthenticated?.();
      onClose();
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.keyboard}
        >
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            {isLoggedIn ? (
              <>
                <Text style={styles.title}>Аккаунт</Text>
                <Text style={styles.subtitle}>
                  Ваши фанфики и карточки синхронизируются между устройствами.
                </Text>
                <View style={styles.accountBlock}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>
                      {(auth.user?.email?.[0] ?? '?').toUpperCase()}
                    </Text>
                  </View>
                  <Text style={styles.emailText} numberOfLines={1}>
                    {auth.user?.email}
                  </Text>
                  <Pressable
                    style={[styles.secondaryButton, busy && styles.disabled]}
                    onPress={handleSignOut}
                    disabled={busy}
                  >
                    {busy ? (
                      <ActivityIndicator color="#b91c1c" />
                    ) : (
                      <Text style={styles.secondaryDangerText}>Выйти</Text>
                    )}
                  </Pressable>
                  <Pressable
                    style={styles.syncNowButton}
                    onPress={async () => {
                      setBusy(true);
                      setError(null);
                      try {
                        await Promise.race([
                          syncData(),
                          new Promise<never>((_, reject) =>
                            setTimeout(
                              () =>
                                reject(
                                  new Error(
                                    'Синхронизация заняла слишком много времени'
                                  )
                                ),
                              65000
                            )
                          ),
                        ]);
                      } catch (e) {
                        setError(
                          e instanceof Error
                            ? e.message
                            : 'Ошибка синхронизации'
                        );
                      } finally {
                        setBusy(false);
                      }
                    }}
                    disabled={busy}
                  >
                    <Text style={styles.syncNowText}>Синхронизировать сейчас</Text>
                  </Pressable>
                </View>
              </>
            ) : (
              <>
                <Text style={styles.title}>
                  {isLogin ? 'Вход' : 'Регистрация'}
                </Text>
                <Text style={styles.subtitle}>
                  {isLogin
                    ? 'Войдите в существующий аккаунт.'
                    : 'Создайте новый аккаунт для синхронизации.'}
                </Text>

                {/* Вкладки: isLogin = true → Вход, isLogin = false → Регистрация */}
                <View style={styles.tabs}>
                  <Pressable
                    style={[styles.tab, isLogin && styles.tabActive]}
                    onPress={selectLogin}
                    disabled={busy}
                  >
                    <Text style={[styles.tabText, isLogin && styles.tabTextActive]}>
                      Вход
                    </Text>
                  </Pressable>
                  <Pressable
                    style={[styles.tab, !isLogin && styles.tabActive]}
                    onPress={selectRegister}
                    disabled={busy}
                  >
                    <Text
                      style={[styles.tabText, !isLogin && styles.tabTextActive]}
                    >
                      Регистрация
                    </Text>
                  </Pressable>
                </View>

                <View
                  style={[
                    styles.modeBadge,
                    isLogin ? styles.modeBadgeLogin : styles.modeBadgeRegister,
                  ]}
                >
                  <Text style={styles.modeBadgeText}>
                    {isLogin
                      ? 'Режим: Вход (signIn)'
                      : 'Режим: Регистрация (createUser)'}
                  </Text>
                </View>

                <TextInput
                  style={styles.input}
                  value={email}
                  onChangeText={(v) => {
                    setEmail(v);
                    setError(null);
                  }}
                  placeholder="Email"
                  placeholderTextColor="#94a3b8"
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  textContentType="emailAddress"
                  autoComplete="email"
                  editable={!busy}
                />

                <TextInput
                  style={styles.input}
                  value={password}
                  onChangeText={(v) => {
                    setPassword(v);
                    setError(null);
                  }}
                  placeholder="Пароль (минимум 6 символов)"
                  placeholderTextColor="#94a3b8"
                  secureTextEntry
                  textContentType={isLogin ? 'password' : 'newPassword'}
                  autoComplete={isLogin ? 'password' : 'new-password'}
                  editable={!busy}
                  onSubmitEditing={submitCurrentMode}
                />

                {error ? (
                  <View style={styles.errorBox}>
                    <Text style={styles.error}>{error}</Text>
                  </View>
                ) : null}

                {isLogin ? (
                  <Pressable
                    style={[styles.primaryButton, busy && styles.disabled]}
                    onPress={() => void submitLogin()}
                    disabled={busy}
                  >
                    {busy ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.primaryButtonText}>Войти</Text>
                    )}
                  </Pressable>
                ) : (
                  <Pressable
                    style={[styles.registerButton, busy && styles.disabled]}
                    onPress={() => void submitRegister()}
                    disabled={busy}
                  >
                    {busy ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.primaryButtonText}>
                        Зарегистрироваться
                      </Text>
                    )}
                  </Pressable>
                )}

                <Pressable
                  style={[styles.googleButton, busy && styles.disabled]}
                  onPress={() => void submitGoogle()}
                  disabled={busy}
                >
                  <Text style={styles.googleButtonText}>🔵 Войти через Google</Text>
                </Pressable>

                <Pressable
                  style={styles.switchMode}
                  onPress={isLogin ? selectRegister : selectLogin}
                  disabled={busy}
                >
                  <Text style={styles.switchModeText}>
                    {isLogin
                      ? 'Ещё нет аккаунта? Перейти к регистрации'
                      : 'Уже есть аккаунт? Перейти ко входу'}
                  </Text>
                </Pressable>
              </>
            )}

            <Pressable
              style={styles.guestButton}
              onPress={onClose}
              disabled={busy}
            >
              <Text style={styles.guestButtonText}>
                {isLoggedIn ? 'Закрыть' : 'Продолжить без входа'}
              </Text>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'center',
    padding: 20,
  },
  keyboard: {
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
  },
  sheet: {
    backgroundColor: '#fffaf5',
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: '#f1e4d8',
    ...softShadow({ color: '#0f172a', y: 12, blur: 24, opacity: 0.12, elevation: 8 }),
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1c1917',
    letterSpacing: -0.3,
  },
  subtitle: {
    marginTop: 8,
    marginBottom: 16,
    fontSize: 14,
    lineHeight: 20,
    color: '#78716c',
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: '#f5f5f4',
    borderRadius: 12,
    padding: 4,
    marginBottom: 10,
    gap: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e7e5e4',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#78716c',
  },
  tabTextActive: {
    color: '#1d4ed8',
    fontWeight: '700',
  },
  modeBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    marginBottom: 14,
  },
  modeBadgeLogin: {
    backgroundColor: '#eff6ff',
  },
  modeBadgeRegister: {
    backgroundColor: '#ecfdf5',
  },
  modeBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: '#e7e5e4',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 16,
    color: '#1c1917',
    marginBottom: 12,
  },
  errorBox: {
    backgroundColor: '#fef2f2',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  error: {
    color: '#b91c1c',
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  primaryButton: {
    backgroundColor: '#2563eb',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  googleButton: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 12,
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
  },
  googleButtonText: {
    color: '#1f2937',
    fontSize: 15,
    fontWeight: '700',
  },
  registerButton: {
    backgroundColor: '#059669',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  switchMode: {
    marginTop: 14,
    paddingVertical: 8,
    alignItems: 'center',
  },
  switchModeText: {
    color: '#2563eb',
    fontSize: 14,
    fontWeight: '600',
  },
  guestButton: {
    marginTop: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  guestButtonText: {
    color: '#78716c',
    fontSize: 15,
    fontWeight: '600',
  },
  disabled: {
    opacity: 0.65,
  },
  accountBlock: {
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#dbeafe',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#93c5fd',
  },
  avatarText: {
    fontSize: 26,
    fontWeight: '800',
    color: '#1d4ed8',
  },
  emailText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1c1917',
    maxWidth: '100%',
  },
  secondaryButton: {
    marginTop: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#fecaca',
    backgroundColor: '#fef2f2',
    minWidth: 140,
    alignItems: 'center',
  },
  secondaryDangerText: {
    color: '#b91c1c',
    fontSize: 15,
    fontWeight: '700',
  },
  syncNowButton: {
    paddingVertical: 10,
  },
  syncNowText: {
    color: '#2563eb',
    fontSize: 14,
    fontWeight: '700',
  },
});
