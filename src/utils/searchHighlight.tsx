import React, { type ReactNode } from 'react';
import { Text, type TextStyle, type StyleProp } from 'react-native';

export type HighlightPart = { text: string; match: boolean };

/** Разбить строку на сегменты с совпадениями query (case-insensitive). */
export function splitHighlightParts(
  text: string,
  query: string | null | undefined
): HighlightPart[] {
  const raw = text ?? '';
  const q = query?.trim();
  if (!q || !raw) return [{ text: raw, match: false }];

  const lower = raw.toLowerCase();
  const needle = q.toLowerCase();
  const parts: HighlightPart[] = [];
  let cursor = 0;

  while (cursor < raw.length) {
    const idx = lower.indexOf(needle, cursor);
    if (idx === -1) {
      parts.push({ text: raw.slice(cursor), match: false });
      break;
    }
    if (idx > cursor) {
      parts.push({ text: raw.slice(cursor, idx), match: false });
    }
    parts.push({ text: raw.slice(idx, idx + needle.length), match: true });
    cursor = idx + needle.length;
  }

  return parts.length ? parts : [{ text: raw, match: false }];
}

const WEB_MARK =
  'rounded-[3px] bg-[#D0FF00]/35 text-inherit font-semibold px-[1px]';

/** Подсветка для web (Tailwind / Dark Neon). */
export function HighlightText({
  text,
  query,
  className = '',
  markClassName = WEB_MARK,
  as: Tag = 'span',
}: {
  text: string;
  query?: string | null;
  className?: string;
  markClassName?: string;
  as?: 'span' | 'div';
}): ReactNode {
  const parts = splitHighlightParts(text, query);
  if (!query?.trim()) {
    return <Tag className={className}>{text}</Tag>;
  }
  return (
    <Tag className={className}>
      {parts.map((p, i) =>
        p.match ? (
          <mark key={i} className={markClassName}>
            {p.text}
          </mark>
        ) : (
          <React.Fragment key={i}>{p.text}</React.Fragment>
        )
      )}
    </Tag>
  );
}

/** Подсветка для React Native. */
export function HighlightTextNative({
  text,
  query,
  style,
  markStyle,
}: {
  text: string;
  query?: string | null;
  style?: StyleProp<TextStyle>;
  markStyle?: StyleProp<TextStyle>;
}): ReactNode {
  const parts = splitHighlightParts(text, query);
  const defaultMark: TextStyle = {
    backgroundColor: 'rgba(208,255,0,0.35)',
    fontWeight: '700',
  };
  if (!query?.trim()) {
    return <Text style={style}>{text}</Text>;
  }
  return (
    <Text style={style}>
      {parts.map((p, i) =>
        p.match ? (
          <Text key={i} style={markStyle ?? defaultMark}>
            {p.text}
          </Text>
        ) : (
          <Text key={i}>{p.text}</Text>
        )
      )}
    </Text>
  );
}
