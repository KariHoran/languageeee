import { useMemo } from 'react';
import { useAppStore } from '../store/useAppStore';

/** Web UI theme tokens — Dark Neon ↔ Soft Light */
export interface WebThemeClasses {
  isDark: boolean;
  /** Full-page shell background */
  shell: string;
  glowViolet: string;
  glowLime: string;
  /** Dense card / panel */
  card: string;
  surface: string;
  titlebar: string;
  border: string;
  text: string;
  textMuted: string;
  accent: string;
  hover: string;
  dock: string;
  dockIdle: string;
  /** Primary CTA — same brand lime in both themes */
  cta: string;
  danger: string;
  readerHanzi: string;
  translation: string;
  peekBtn: string;
  toolbar: string;
  modalOverlay: string;
  brandSub: string;
}

const DARK: Omit<WebThemeClasses, 'isDark'> = {
  shell: 'bg-[#0D0D11]',
  glowViolet: 'bg-[#8B5CF6]/15',
  glowLime: 'bg-[#D0FF00]/5',
  card: 'bg-[#1E1E28] border border-[#2A2A3A]',
  surface: 'bg-[#16161E] border border-[#2A2A3A]',
  titlebar: 'bg-[#1E1E28] border-b border-[#2A2A3A]',
  border: 'border-[#2A2A3A]',
  text: 'text-white',
  textMuted: 'text-white/50',
  accent: 'text-[#8B5CF6]',
  hover: 'hover:bg-[#2A2A3A]',
  dock: 'bg-[#16161E] border border-[#2A2A3A] shadow-lg',
  dockIdle: 'hover:bg-[#2A2A3A] text-slate-400',
  cta: 'bg-[#D0FF00] text-[#0D0D11] font-bold hover:bg-[#b8e600]',
  danger: 'text-red-400 hover:bg-red-500/15',
  readerHanzi: 'text-white',
  translation: 'text-white/70',
  peekBtn: 'bg-[#16161E] border border-[#2A2A3A] hover:border-[#8B5CF6]/50',
  toolbar: 'bg-[#1E1E28] border border-[#2A2A3A]',
  modalOverlay: 'rgba(13, 13, 17, 0.72)',
  brandSub: 'text-white/40',
};

const LIGHT: Omit<WebThemeClasses, 'isDark'> = {
  shell: 'bg-[#F8F9FC]',
  glowViolet: 'bg-purple-300/30',
  glowLime: 'bg-lime-200/40',
  card: 'bg-white border border-gray-200 shadow-sm',
  surface: 'bg-white border border-gray-200',
  titlebar: 'bg-white border-b border-gray-200',
  border: 'border-gray-200',
  text: 'text-gray-900',
  textMuted: 'text-gray-600',
  accent: 'text-purple-600',
  hover: 'hover:bg-gray-100',
  dock: 'bg-white border border-gray-200 shadow-lg',
  dockIdle: 'hover:bg-gray-100 text-gray-500',
  cta: 'bg-[#D0FF00] text-[#0D0D11] font-bold hover:bg-[#b8e600]',
  danger: 'text-red-500 hover:bg-red-50',
  readerHanzi: 'text-gray-900',
  translation: 'text-gray-600',
  peekBtn: 'bg-gray-50 border border-gray-200 hover:border-purple-300',
  toolbar: 'bg-white border border-gray-200 shadow-sm',
  modalOverlay: 'rgba(15, 23, 42, 0.35)',
  brandSub: 'text-gray-500',
};

export function getWebTheme(isDark: boolean): WebThemeClasses {
  return { isDark, ...(isDark ? DARK : LIGHT) };
}

/**
 * Persistable theme via zustand `midnightMode` (AsyncStorage / localStorage).
 * midnightMode === true → Dark Neon; false → Soft Light.
 */
export function useWebTheme(): WebThemeClasses & { toggle: () => void } {
  const isDark = useAppStore((s) => s.midnightMode);
  const toggle = useAppStore((s) => s.toggleMidnightMode);

  return useMemo(
    () => ({ ...getWebTheme(isDark), toggle }),
    [isDark, toggle]
  );
}

/** Apply theme to document root (CSS variables + body bg). */
export function applyDocumentTheme(isDark: boolean): void {
  if (typeof document === 'undefined') return;
  const mode = isDark ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', mode);
  document.body.style.background = isDark ? '#0D0D11' : '#F8F9FC';
}
