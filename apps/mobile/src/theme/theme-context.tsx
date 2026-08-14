import { createContext, ReactNode, useContext, useMemo } from 'react';
import { useThemeStore } from '../stores/theme-store';
import { AppColors, darkColors, lightColors } from './colors';
import { AppShadows, createShadows } from './shadows';

export type Theme = {
  colors: AppColors;
  shadows: AppShadows;
  isDark: boolean;
};

const ThemeContext = createContext<Theme | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const darkMode = useThemeStore((s) => s.darkMode);

  const theme = useMemo<Theme>(() => {
    const colors = darkMode ? darkColors : lightColors;
    return {
      colors,
      shadows: createShadows(colors),
      isDark: darkMode,
    };
  }, [darkMode]);

  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  const theme = useContext(ThemeContext);
  if (!theme) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return theme;
}
