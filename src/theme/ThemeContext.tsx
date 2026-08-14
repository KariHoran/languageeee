import React, { createContext, useContext, useMemo } from 'react';
import { useAppStore } from '../store/useAppStore';
import { AQUA_THEME, MIDNIGHT_THEME, Y2kTheme } from './y2k';

const ThemeContext = createContext<Y2kTheme>(AQUA_THEME);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const midnightMode = useAppStore((s) => s.midnightMode);
  const theme = useMemo(
    () => (midnightMode ? MIDNIGHT_THEME : AQUA_THEME),
    [midnightMode]
  );
  return (
    <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>
  );
}

export function useTheme(): Y2kTheme {
  return useContext(ThemeContext);
}
