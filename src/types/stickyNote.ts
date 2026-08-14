/** Пользовательская sticky-заметка на сегменте текста */
export interface StickyNote {
  id: string;
  bookId: string;
  paragraphIndex: number;
  selectedText: string;
  note: string;
  color: string;
  createdAt: number;
}
