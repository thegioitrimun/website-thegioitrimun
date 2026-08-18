import { createContext, useState, useEffect, ReactNode } from 'react';

type Theme = 'light' | 'dark' | 'system';
export type ColorTheme = 'teal' | 'violet' | 'mint' | 'amber' | 'gold' | 'fuchsia' | 'purple' | 'pastel' | 'rose' | 'crimson' | 'green' | 'sky' | 'sunrise' | 'stone' | 'coral' | 'vinmec';

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  colorTheme: ColorTheme;
  setColorTheme: (theme: ColorTheme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: ReactNode;
  storageKey?: string;
  defaultTheme?: Theme;
  colorThemeStorageKey?: string;
  defaultColorTheme?: ColorTheme;
}

const colorThemes: ColorTheme[] = ['teal', 'violet', 'mint', 'amber', 'gold', 'fuchsia', 'purple', 'pastel', 'rose', 'crimson', 'green', 'sky', 'sunrise', 'stone', 'coral', 'vinmec'];

function ThemeProvider({
  children,
  storageKey = 'iskin-clinic-theme',
  defaultTheme = 'system',
  colorThemeStorageKey = 'iskin-clinic-color-theme',
  defaultColorTheme = 'vinmec',
}: ThemeProviderProps) {
  const [theme, setTheme] = useState<Theme>(
    () => (localStorage.getItem(storageKey) as Theme) || defaultTheme,
  );
  const [colorTheme, setColorTheme] = useState<ColorTheme>(
    () => (localStorage.getItem(colorThemeStorageKey) as ColorTheme) || defaultColorTheme,
  );

  useEffect(() => {
    const root = window.document.documentElement;

    // Handle light/dark mode
    const applyTheme = (currentTheme: Theme) => {
      const isDark =
        currentTheme === 'dark' ||
        (currentTheme === 'system' &&
          window.matchMedia('(prefers-color-scheme: dark)').matches);

      root.classList.toggle('dark', isDark);
    };

    applyTheme(theme);

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      if (localStorage.getItem(storageKey) === 'system') {
        applyTheme('system');
      }
    };

    mediaQuery.addEventListener('change', handleChange);

    // Handle color theme
    colorThemes.forEach(ct => root.classList.remove(`theme-${ct}`));
    root.classList.add(`theme-${colorTheme}`);


    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme, colorTheme, storageKey]);

  const value = {
    theme,
    setTheme: (newTheme: Theme) => {
      localStorage.setItem(storageKey, newTheme);
      setTheme(newTheme);
    },
    colorTheme,
    setColorTheme: (newColorTheme: ColorTheme) => {
      localStorage.setItem(colorThemeStorageKey, newColorTheme);
      setColorTheme(newColorTheme);
    }
  };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export { ThemeProvider, ThemeContext };