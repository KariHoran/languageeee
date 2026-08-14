import OpenAI from 'openai';
import {
  AIProcessResponse,
  AIParagraphResponse,
  Book,
  Paragraph,
  TargetHskLevel,
} from '../types';

const openai = new OpenAI({
  apiKey: process.env.EXPO_PUBLIC_OPENAI_API_KEY ?? '',
  dangerouslyAllowBrowser: true,
});

/**
 * Формирует системный промпт для GPT с учётом целевого уровня HSK.
 * Для каждого слова требуется уровень по новой системе HSK 3.0 (1–9).
 */
function buildSystemPrompt(targetHskLevel: number): string {
  return `
Ты — профессиональный преподаватель китайского языка для русскоязычных студентов.
Переведи и адаптируй предоставленный текст фанфика на китайский язык строго под уровень HSK ${targetHskLevel}.

Разбей текст на абзацы и для каждого абзаца верни JSON со следующей структурой:
1. "chineseText": адаптированный текст на китайском.
2. "englishText": параллельный перевод на английский язык.
3. "russianTranslation": параллельный перевод на русский язык.
4. "words": список всех слов в этом абзаце. Для каждого слова укажи:
   - "hanzi": иероглифы
   - "pinyin": пиньинь с тонами
   - "translation": точный перевод слова на русский язык
   - "hskLevel": целое число от 1 до 9 — уровень этого слова по НОВОЙ системе HSK 3.0 (не путать с целевым уровнем адаптации текста)
5. "grammar": список ВСЕХ грамматических конструкций, использованных в этом абзаце. Для каждой:
   - "structure": иероглифическая схема/конструкция (например, "还是... 还是...", "一边... 一边...")
   - "explanation": подробное объяснение этой грамматики на русском языке
   - "example": короткий пример использования с переводом на русский язык.

Вся грамматика и переводы слов должны быть полностью на русском языке.
Поле hskLevel для каждого слова обязательно. Ответ должен быть strictly valid JSON.

Формат ответа:
{
  "paragraphs": [
    {
      "chineseText": "...",
      "englishText": "...",
      "russianTranslation": "...",
      "words": [
        { "hanzi": "...", "pinyin": "...", "translation": "...", "hskLevel": 2 }
      ],
      "grammar": [...]
    }
  ]
}
`.trim();
}

function generateWordId(hanzi: string, index: number): string {
  return `${hanzi}-${index}-${Date.now()}`;
}

function clampHskLevel(level: number): number {
  return Math.min(9, Math.max(1, Math.round(level)));
}

function mapAIResponse(
  aiParagraphs: AIParagraphResponse[],
  originalParagraphs: string[]
): Paragraph[] {
  return aiParagraphs.map((p, paragraphIndex) => ({
    originalText: originalParagraphs[paragraphIndex] ?? '',
    chineseText: p.chineseText,
    englishText: p.englishText,
    russianTranslation: p.russianTranslation,
    words: p.words.map((w, wordIndex) => ({
      id: generateWordId(w.hanzi, paragraphIndex * 1000 + wordIndex),
      hanzi: w.hanzi,
      pinyin: w.pinyin,
      translation: w.translation,
      hskLevel: clampHskLevel(w.hskLevel ?? 1),
      status: 'new' as const,
    })),
    grammar: p.grammar,
  }));
}

export interface ProcessFanficOptions {
  text: string;
  targetHskLevel: TargetHskLevel;
  title: string;
  collectionId?: string;
}

/**
 * Обрабатывает текст фанфика через OpenAI GPT-4o-mini.
 * Возвращает книгу с адаптированными абзацами и уровнями HSK 3.0 для каждого слова.
 */
export async function processFanficText(
  text: string,
  targetHskLevel: TargetHskLevel,
  title: string,
  collectionId?: string
): Promise<Book> {
  if (!process.env.EXPO_PUBLIC_OPENAI_API_KEY) {
    throw new Error(
      'Не задан ключ API OpenAI. Установите переменную EXPO_PUBLIC_OPENAI_API_KEY.'
    );
  }

  const originalParagraphs = text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  const userContent =
    originalParagraphs.length > 0
      ? originalParagraphs.join('\n\n')
      : text.trim();

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: buildSystemPrompt(targetHskLevel) },
      { role: 'user', content: userContent },
    ],
    temperature: 0.3,
  });

  const raw = response.choices[0]?.message?.content;
  if (!raw) {
    throw new Error('Пустой ответ от OpenAI.');
  }

  let parsed: AIProcessResponse;
  try {
    parsed = JSON.parse(raw) as AIProcessResponse;
  } catch {
    throw new Error('Не удалось разобрать JSON-ответ от OpenAI.');
  }

  if (!parsed.paragraphs?.length) {
    throw new Error('OpenAI не вернул ни одного абзаца.');
  }

  const now = new Date().toISOString();

  return {
    id: `book-${Date.now()}`,
    title,
    targetHskLevel,
    collectionId,
    paragraphs: mapAIResponse(parsed.paragraphs, originalParagraphs),
    sourceText: text.trim(),
    createdAt: now,
    updatedAt: now,
  };
}
