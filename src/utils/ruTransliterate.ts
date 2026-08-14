/**
 * Простая научная транслитерация кириллицы (ISO 9–подобная) для подсказок
 * на месте пиньиня при изучении русского.
 */
const CYR_MAP: Record<string, string> = {
  а: 'a',
  б: 'b',
  в: 'v',
  г: 'g',
  д: 'd',
  е: 'e',
  ё: 'yo',
  ж: 'zh',
  з: 'z',
  и: 'i',
  й: 'y',
  к: 'k',
  л: 'l',
  м: 'm',
  н: 'n',
  о: 'o',
  п: 'p',
  р: 'r',
  с: 's',
  т: 't',
  у: 'u',
  ф: 'f',
  х: 'kh',
  ц: 'ts',
  ч: 'ch',
  ш: 'sh',
  щ: 'shch',
  ъ: '',
  ы: 'y',
  ь: '',
  э: 'e',
  ю: 'yu',
  я: 'ya',
};

export function transliterateRussian(text: string): string {
  const raw = text?.trim() ?? '';
  if (!raw) return '';
  let out = '';
  for (const ch of raw) {
    const lower = ch.toLowerCase();
    const mapped = CYR_MAP[lower];
    if (mapped == null) {
      if (/[A-Za-z0-9-]/.test(ch)) out += ch;
      continue;
    }
    if (!mapped) continue;
    const isUpper = ch !== lower;
    out += isUpper ? mapped.charAt(0).toUpperCase() + mapped.slice(1) : mapped;
  }
  return out.trim();
}
