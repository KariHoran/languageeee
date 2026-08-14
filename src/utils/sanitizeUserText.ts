/**
 * Базовая санитизация пользовательского текста (защита от XSS).
 * React рендерит текст как text nodes, но мы чистим вход при загрузке .txt
 * и перед сохранением в книгу — defense in depth.
 */

const SCRIPT_BLOCK_RE = /<\s*script\b[^>]*>[\s\S]*?<\s*\/\s*script\s*>/gi;
const STYLE_BLOCK_RE = /<\s*style\b[^>]*>[\s\S]*?<\s*\/\s*style\s*>/gi;
const HTML_TAG_RE = /<\/?[a-zA-Z][^>]*>/g;
const DANGEROUS_PROTO_RE = /(?:javascript|vbscript|data\s*:\s*text\/html)\s*:/gi;
const EVENT_HANDLER_RE = /\bon[a-z]+\s*=\s*(?:'[^']*'|"[^"]*"|[^\s>]+)/gi;
const NULL_BYTES_RE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

/**
 * Убирает HTML/скрипты/опасные протоколы из загруженного текста.
 * Сохраняет обычный plain text (иероглифы, перевод, переносы строк).
 */
export function sanitizeUserText(input: string | null | undefined): string {
  if (input == null) return '';
  let text = String(input);

  // Нормализация переносов и управляющих символов
  text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  text = text.replace(NULL_BYTES_RE, '');

  // Блоки script/style целиком
  text = text.replace(SCRIPT_BLOCK_RE, '');
  text = text.replace(STYLE_BLOCK_RE, '');

  // Инлайн-обработчики и javascript:
  text = text.replace(EVENT_HANDLER_RE, '');
  text = text.replace(DANGEROUS_PROTO_RE, '');

  // Любые HTML-теги → пусто (текст остаётся)
  text = text.replace(HTML_TAG_RE, '');

  // Частые HTML-entities, которые могли остаться после вырезания тегов
  text = text
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&amp;/gi, '&');

  // Повторный проход: если после decode снова появились теги
  text = text.replace(SCRIPT_BLOCK_RE, '');
  text = text.replace(HTML_TAG_RE, '');
  text = text.replace(DANGEROUS_PROTO_RE, '');

  return text;
}

/** Безопасный фрагмент для атрибутов/имён файлов (без path traversal). */
export function sanitizePlainLabel(input: string | null | undefined, maxLen = 200): string {
  const cleaned = sanitizeUserText(input)
    .replace(/[\\/<>:"|?*\u0000-\u001F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned.slice(0, maxLen);
}
