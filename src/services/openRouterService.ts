/**
 * Сервис для работы с API OpenRouter.
 * Ключ берётся только из переменных окружения — не храните его в коде.
 */

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const DEFAULT_MODEL = 'openai/gpt-4o';

/** Сообщение в формате Chat Completions */
export interface OpenRouterMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/** Успешный ответ OpenRouter (упрощённая форма) */
export interface OpenRouterResponse {
  id: string;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string | null;
    };
    finish_reason: string | null;
  }>;
}

/**
 * Читает API-ключ строго из окружения.
 * В Expo для клиента нужен префикс EXPO_PUBLIC_.
 */
function getApiKey(): string {
  const key =
    process.env.EXPO_PUBLIC_OPENROUTER_API_KEY ??
    process.env.OPENROUTER_API_KEY ??
    '';

  return key.trim();
}

/**
 * Отправляет POST-запрос к OpenRouter Chat Completions.
 *
 * @param messages — список сообщений диалога
 * @param model — модель (по умолчанию openai/gpt-4o)
 * @returns ответ API или выбрасывает Error с понятным текстом на русском
 */
export async function sendOpenRouterChat(
  messages: OpenRouterMessage[],
  model: string = DEFAULT_MODEL
): Promise<OpenRouterResponse> {
  const apiKey = getApiKey();

  if (!apiKey) {
    throw new Error(
      'Не задан ключ OpenRouter. Установите EXPO_PUBLIC_OPENROUTER_API_KEY (или OPENROUTER_API_KEY) в файле .env.'
    );
  }

  if (!messages?.length) {
    throw new Error('Список сообщений пуст. Передайте хотя бы одно сообщение.');
  }

  try {
    const response = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        // Рекомендуемые заголовки OpenRouter (необязательные, но полезные)
        'HTTP-Referer': 'https://languageeee.app',
        'X-Title': 'Languageeee',
      },
      body: JSON.stringify({
        model,
        messages,
      }),
    });

    const rawText = await response.text();

    if (!response.ok) {
      let detail = rawText;
      try {
        const errJson = JSON.parse(rawText) as { error?: { message?: string } };
        detail = errJson.error?.message ?? rawText;
      } catch {
        // оставляем rawText
      }
      throw new Error(
        `Ошибка OpenRouter (${response.status}): ${detail || 'неизвестная ошибка'}`
      );
    }

    let data: OpenRouterResponse;
    try {
      data = JSON.parse(rawText) as OpenRouterResponse;
    } catch {
      throw new Error('Не удалось разобрать JSON-ответ от OpenRouter.');
    }

    if (!data.choices?.length) {
      throw new Error('OpenRouter вернул пустой список choices.');
    }

    return data;
  } catch (err) {
    // Уже наши Error — пробрасываем как есть
    if (err instanceof Error) {
      throw err;
    }
    throw new Error(`Сбой запроса к OpenRouter: ${String(err)}`);
  }
}

/**
 * Удобный хелпер: возвращает только текст ответа ассистента.
 */
export async function getOpenRouterReply(
  messages: OpenRouterMessage[],
  model: string = DEFAULT_MODEL
): Promise<string> {
  const data = await sendOpenRouterChat(messages, model);
  const content = data.choices[0]?.message?.content;

  if (!content) {
    throw new Error('Пустой ответ от модели OpenRouter.');
  }

  return content;
}

/**
 * Пример вызова: вопрос от роли "user".
 * Можно вызвать из отладки: await exampleOpenRouterCall()
 */
export async function exampleOpenRouterCall(): Promise<string> {
  try {
    const reply = await getOpenRouterReply(
      [
        {
          role: 'user',
          content: 'Привет! Кратко объясни, что такое HSK 3.0 на русском языке.',
        },
      ],
      'openai/gpt-4o'
    );
    console.log('Ответ OpenRouter:', reply);
    return reply;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('Пример вызова OpenRouter не удался:', message);
    throw new Error(message);
  }
}
