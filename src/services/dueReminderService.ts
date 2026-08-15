/**
 * Локальные напоминания о due-карточках (Web Notification API).
 * Без push-сервера: срабатывает, когда вкладка открыта / PWA запущена.
 */
import { Platform } from 'react-native';

const LAST_KEY = '@languageeee/due_notify_day';

export function notificationPermission(): NotificationPermission | 'unsupported' {
  if (Platform.OS !== 'web' || typeof Notification === 'undefined') {
    return 'unsupported';
  }
  return Notification.permission;
}

export async function requestNotificationPermission(): Promise<
  NotificationPermission | 'unsupported'
> {
  if (Platform.OS !== 'web' || typeof Notification === 'undefined') {
    return 'unsupported';
  }
  if (Notification.permission === 'granted') return 'granted';
  if (Notification.permission === 'denied') return 'denied';
  try {
    return await Notification.requestPermission();
  } catch {
    return 'denied';
  }
}

/** Показать due-напоминание не чаще раза в календарный день. */
export async function maybeNotifyDueCards(
  due: number,
  title: string,
  body: string
): Promise<boolean> {
  if (due <= 0) return false;
  if (Platform.OS !== 'web' || typeof Notification === 'undefined') return false;
  if (Notification.permission !== 'granted') return false;

  const day = new Date().toISOString().slice(0, 10);
  try {
    const prev = localStorage.getItem(LAST_KEY);
    if (prev === day) return false;
    localStorage.setItem(LAST_KEY, day);
  } catch {
    /* private mode */
  }

  try {
    const reg = await navigator.serviceWorker?.ready;
    if (reg?.showNotification) {
      await reg.showNotification(title, {
        body,
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        tag: 'languageeee-due',
      });
      return true;
    }
    // eslint-disable-next-line no-new
    new Notification(title, { body, icon: '/icon-192.png', tag: 'languageeee-due' });
    return true;
  } catch {
    return false;
  }
}
