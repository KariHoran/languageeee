/**
 * Копирование URL после публикации.
 * На десктопе НЕ зовём navigator.share — диалог Windows/Chrome может
 * держать Promise бесконечно («Публикуем…» не заканчивается).
 * Share sheet — только на явном touch/mobile.
 */

export type ShareUrlResult = 'shared' | 'copied' | 'shown';

function prefersNativeShare(): boolean {
  if (typeof navigator === 'undefined') return false;
  if (typeof navigator.share !== 'function') return false;
  if (typeof window === 'undefined') return false;
  try {
    if (window.matchMedia('(pointer: coarse)').matches) return true;
  } catch {
    /* ignore */
  }
  const ua = navigator.userAgent || '';
  return /Android|iPhone|iPad|iPod/i.test(ua);
}

export async function shareOrCopyUrl(
  url: string,
  opts?: { title?: string; text?: string; preferShare?: boolean }
): Promise<ShareUrlResult> {
  const title = opts?.title?.trim() || 'languageeee';
  const text = opts?.text?.trim() || url;
  const tryShare = opts?.preferShare === true || prefersNativeShare();

  if (tryShare && typeof navigator.share === 'function') {
    try {
      await navigator.share({ title, text, url });
      return 'shared';
    } catch (err) {
      const name =
        err && typeof err === 'object' && 'name' in err
          ? String((err as { name: unknown }).name)
          : '';
      if (name === 'AbortError') return 'shown';
    }
  }

  if (
    typeof navigator !== 'undefined' &&
    navigator.clipboard &&
    typeof navigator.clipboard.writeText === 'function'
  ) {
    try {
      await navigator.clipboard.writeText(url);
      return 'copied';
    } catch {
      /* fall through */
    }
  }

  return 'shown';
}
