/**
 * Lightweight DOM helpers for the web desktop shell.
 * Avoids RN View/Text so Tailwind + .glass CSS apply as real CSS.
 */
import {
  createElement,
  forwardRef,
  type CSSProperties,
  type MouseEventHandler,
  type ReactNode,
  type UIEventHandler,
} from 'react';

type DomProps = {
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
  onClick?: MouseEventHandler<HTMLElement>;
  onScroll?: UIEventHandler<HTMLElement>;
  title?: string;
  role?: string;
  id?: string;
  'aria-label'?: string;
  'aria-expanded'?: boolean;
  'aria-haspopup'?: boolean | 'dialog' | 'menu' | 'listbox' | 'tree' | 'grid';
  'aria-pressed'?: boolean;
  'data-para-index'?: number | string;
};

function el(tag: string, props: DomProps & Record<string, unknown> = {}) {
  const { children, ...rest } = props;
  return createElement(tag, rest as Record<string, unknown>, children as ReactNode);
}

export const Div = forwardRef<HTMLDivElement, DomProps>(function Div(
  { children, ...rest },
  ref
) {
  return createElement(
    'div',
    { ...(rest as Record<string, unknown>), ref },
    children
  );
});

export const Span = (p: DomProps) => el('span', p);
export const Button = (
  p: DomProps & { type?: 'button' | 'submit'; disabled?: boolean }
) => el('button', { type: 'button', ...p });
export const Ruby = (p: DomProps) => el('ruby', p);
export const Rt = (p: DomProps) => el('rt', p);
export const Rp = (p: DomProps) => el('rp', p);
export const Img = (p: DomProps & { src?: string; alt?: string }) => el('img', p);
export const Input = (
  p: DomProps & {
    type?: string;
    value?: string | number;
    min?: number;
    max?: number;
    step?: number;
    disabled?: boolean;
    placeholder?: string;
    onChange?: (e: { target: { value: string } }) => void;
    onPointerDown?: MouseEventHandler<HTMLElement>;
    onPointerUp?: MouseEventHandler<HTMLElement>;
    onKeyUp?: (e: { key: string; target: EventTarget | null }) => void;
  }
) => el('input', p);
