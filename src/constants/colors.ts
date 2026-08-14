/**
 * Общие цветовые константы приложения.
 * Палитра подборок/категорий — единый источник для Library, AddBook, EditCollection.
 */

/** Цвета при создании и редактировании подборок / категорий */
export const COLLECTION_COLORS: string[] = [
  '#ff9ecf', // pink
  '#7eb8ff', // blue
  '#a78bfa', // violet
  '#ffe566', // yellow
  '#2dd4bf', // teal
  '#fb923c', // orange
  '#94a3b8', // slate
  '#f472b6', // rose
  '#f59e0b', // amber
  '#8b5cf6', // purple
  '#10b981', // emerald
  '#ef4444', // red
  '#3b82f6', // bright blue
  '#ec4899', // fuchsia
];

/** Цвет по умолчанию для новой подборки */
export const DEFAULT_COLLECTION_COLOR = COLLECTION_COLORS[0]!;

/** Fallback, если у подборки нет цвета */
export const FALLBACK_COLLECTION_COLOR = '#a78bfa';
