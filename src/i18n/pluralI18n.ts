import type { NativeLanguage } from '../types';
import { translateUi, type UiMessageKey } from './uiMessages';

export type CountUnit = 'word' | 'card' | 'minute' | 'text';

type PluralForm = 'one' | 'few' | 'many';

/** Русские формы: 1/21 слово, 2–4 слова, 5–20/0 слов (11–14 → many). */
function russianPluralForm(n: number): PluralForm {
  const abs = Math.abs(Math.floor(n));
  const mod10 = abs % 10;
  const mod100 = abs % 100;
  if (mod100 >= 11 && mod100 <= 14) return 'many';
  if (mod10 === 1) return 'one';
  if (mod10 >= 2 && mod10 <= 4) return 'few';
  return 'many';
}

function pluralForm(n: number, lang: NativeLanguage): PluralForm {
  if (lang === 'ru') return russianPluralForm(n);
  // en / zh: one vs many (zh-юнит одинаковый во всех ключах)
  return Math.abs(Math.floor(n)) === 1 ? 'one' : 'many';
}

const UNIT_KEYS: Record<CountUnit, Record<PluralForm, UiMessageKey>> = {
  word: {
    one: 'unit.word.one',
    few: 'unit.word.few',
    many: 'unit.word.many',
  },
  card: {
    one: 'unit.card.one',
    few: 'unit.card.few',
    many: 'unit.card.many',
  },
  minute: {
    one: 'unit.minute.one',
    few: 'unit.minute.few',
    many: 'unit.minute.many',
  },
  text: {
    one: 'unit.text.one',
    few: 'unit.text.few',
    many: 'unit.text.many',
  },
};

/** «1 карточка» / «2 карточки» / «5 карточек» (и аналоги для слов, минут, текстов). */
export function formatUnitCount(
  n: number,
  unit: CountUnit,
  lang: NativeLanguage
): string {
  const count = Math.max(0, Math.floor(Number(n) || 0));
  const form = pluralForm(count, lang);
  const label = translateUi(UNIT_KEYS[unit][form], lang);
  return `${count} ${label}`;
}
