import { lookupBkrs } from '../services/bkrsService';

/**
 * @deprecated Используйте lookupBkrs из bkrsService.
 * Оставлено для совместимости импортов.
 */
export function lookupZhRuGloss(hanzi: string): string | undefined {
  return lookupBkrs(hanzi);
}
