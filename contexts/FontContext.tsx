import { createContext, useState, useEffect, ReactNode } from 'react';

export const FONT_OPTIONS = {
  'Be Vietnam Pro': {
    label: 'Be Vietnam Pro',
    stack: '"Segoe UI", system-ui, -apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif',
  },
  'Roboto': {
    label: 'Roboto',
    stack: 'Roboto, "Segoe UI", system-ui, -apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif',
  },
  'Open Sans': {
    label: 'Open Sans',
    stack: '"Open Sans", "Segoe UI", Arial, sans-serif',
  },
  'Noto Sans': {
    label: 'Noto Sans',
    stack: '"Noto Sans", "Segoe UI", Arial, sans-serif',
  },
};
export type Font = keyof typeof FONT_OPTIONS;

interface FontContextType {
  font: Font;
  setFont: (font: Font) => void;
}

const FontContext = createContext<FontContextType | undefined>(undefined);

interface FontProviderProps {
  children: ReactNode;
  storageKey?: string;
  defaultFont?: Font;
}

const resolveStoredFont = (value: string | null, fallback: Font): Font =>
  value && value in FONT_OPTIONS ? (value as Font) : fallback;

function FontProvider({
  children,
  storageKey = 'iskin-clinic-font',
  defaultFont = 'Be Vietnam Pro',
}: FontProviderProps) {
  const [font, setFont] = useState<Font>(
    () => resolveStoredFont(localStorage.getItem(storageKey), defaultFont),
  );

  useEffect(() => {
    const root = window.document.documentElement;
    const selectedFont = FONT_OPTIONS[font] || FONT_OPTIONS[defaultFont];
    root.style.setProperty('--font-sans', selectedFont.stack);
    root.style.setProperty('--font-heading', selectedFont.stack);
  }, [defaultFont, font]);

  const value = {
    font,
    setFont: (newFont: Font) => {
      localStorage.setItem(storageKey, newFont);
      setFont(newFont);
    },
  };

  return <FontContext.Provider value={value}>{children}</FontContext.Provider>;
}

export { FontProvider, FontContext };
