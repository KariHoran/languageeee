/**
 * Привязка локальных сущностей (книги, коллекции) к владельцу.
 * Auth → Firebase uid; гость → 'guest'.
 */
import { getCloudUid, isCloudUser } from './authService';

export const GUEST_OWNER_ID = 'guest';

/** Текущий владелец данных для записи/чтения. */
export function getDataOwnerId(): string {
  const uid = getCloudUid();
  if (uid && isCloudUser()) return uid;
  return GUEST_OWNER_ID;
}

export function isAuthenticatedOwner(): boolean {
  return getDataOwnerId() !== GUEST_OWNER_ID;
}

/** Строгая проверка: сущность принадлежит текущему владельцу. */
export function belongsToCurrentOwner(
  ownerUserId: string | null | undefined
): boolean {
  const current = getDataOwnerId();
  return ownerUserId === current;
}
