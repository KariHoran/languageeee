/**
 * RBAC для подборок / книг / профилей.
 * Владелец: auth.currentUser.uid === resource.userId (с фолбэком authorId / ownerUserId).
 * Write строго автору; публичные подборки — read для авторизованных.
 */
import type { Book, Collection, PublicCollectionDoc } from '../types';
import { getCloudUid } from './authService';
import { getDataOwnerId, GUEST_OWNER_ID } from './dataOwner';

export type OwnershipFields = {
  authorId?: string | null;
  userId?: string | null;
  ownerUserId?: string | null;
};

export type CollectionOwnershipFields = Pick<
  Collection,
  'authorId' | 'userId' | 'ownerUserId'
>;

/** Канонический authorId / userId документа. */
export function getDocumentOwnerId(
  doc: OwnershipFields | null | undefined
): string | null {
  if (!doc) return null;
  const id =
    doc.userId?.trim() ||
    doc.authorId?.trim() ||
    (doc.ownerUserId && doc.ownerUserId !== GUEST_OWNER_ID
      ? doc.ownerUserId.trim()
      : '') ||
    '';
  return id || null;
}

/** @deprecated use getDocumentOwnerId */
export function getCollectionAuthorId(
  doc: CollectionOwnershipFields | null | undefined
): string | null {
  return getDocumentOwnerId(doc);
}

/**
 * Текущий пользователь — владелец?
 * `auth.currentUser.uid === doc.userId` (с фолбэком authorId/ownerUserId).
 */
export function isDocumentOwner(
  doc: OwnershipFields | null | undefined
): boolean {
  const uid = getCloudUid() || getDataOwnerId();
  if (!uid || uid === GUEST_OWNER_ID) {
    const owner = doc?.ownerUserId || doc?.authorId || doc?.userId;
    return owner === GUEST_OWNER_ID || owner == null;
  }
  const ownerId = getDocumentOwnerId(doc);
  if (!ownerId) {
    return (doc?.ownerUserId ?? GUEST_OWNER_ID) === uid;
  }
  return ownerId === uid;
}

export function isCollectionOwner(
  doc: CollectionOwnershipFields | null | undefined
): boolean {
  return isDocumentOwner(doc);
}

/** Кнопки edit / delete / publish — только владелец. */
export function canEditCollection(
  doc: CollectionOwnershipFields | null | undefined
): boolean {
  return isDocumentOwner(doc);
}

/** Кнопки edit / delete книги (фанфика) — только владелец. */
export function canEditBook(
  book: Pick<Book, 'userId' | 'ownerUserId' | 'authorId'> | null | undefined
): boolean {
  return isDocumentOwner(book);
}

export function isPublicCollectionOwner(
  doc: Pick<PublicCollectionDoc, 'userId' | 'ownerUserId' | 'authorId'> | null
): boolean {
  if (!doc) return false;
  return isDocumentOwner({
    authorId: doc.authorId,
    userId: doc.userId,
    ownerUserId: doc.ownerUserId,
  });
}

/** Поля владельца для записи в Firestore / локальный store. */
export function stampOwnerFields(uid: string | null | undefined): {
  authorId?: string;
  userId?: string;
  ownerUserId: string;
} {
  if (uid && uid !== GUEST_OWNER_ID) {
    return { authorId: uid, userId: uid, ownerUserId: uid };
  }
  return { ownerUserId: GUEST_OWNER_ID };
}

/** @deprecated use stampOwnerFields */
export function stampCollectionOwnerFields(uid: string | null | undefined) {
  return stampOwnerFields(uid);
}
