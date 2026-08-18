
import React, { useState, useRef, useEffect } from 'react';
import { useTheme } from '../hooks/useTheme';
import { PaletteIcon } from './icons';
import type { ColorTheme } from '../contexts/ThemeContext';
import { useTranslation } from 'react-i18next';

const THEMES: { name: ColorTheme; color: string }[] = [
  { name: 'teal', color: 'hsl(190, 60%, 43%)' },
  { name: 'violet', color: 'hsl(231, 70%, 65%)' },
  { name: 'mint', color: 'hsl(155, 15%, 42%)' },
  { name: 'amber', color: 'hsl(27, 86%, 49%)' },
  { name: 'gold', color: 'hsl(30, 41%, 59%)' },
  { name: 'fuchsia', color: 'hsl(336, 71%, 57%)' },
  { name: 'purple', color: 'hsl(289, 44%, 46%)' },
  { name: 'pastel', color: 'hsl(309, 39%, 79%)' },
  { name: 'rose', color: 'hsl(350, 61%, 68%)' },
  { name: 'crimson', color: 'hsl(334, 66%, 61%)' },
  { name: 'green', color: 'hsl(119, 33%, 37%)' },
  { name: 'sky', color: 'hsl(223, 97%, 70%)' },
  { name: 'sunrise', color: 'hsl(261, 52%, 82%)' },
  { name: 'stone', color: 'hsl(231, 48%, 58%)' },
  { name: 'coral', color: 'hsl(5, 84%, 64%)' },
  { name: 'vinmec', color: 'hsl(186, 98%, 30%)' },
];

const ThemePicker: React.FC = () => {
  const { colorTheme, setColorTheme } = useTheme();
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleThemeSelect = (selectedTheme: ColorTheme) => {
    setColorTheme(selectedTheme);
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 rounded-full text-muted-foreground hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-ring dark:focus:ring-offset-background transition-all-smooth btn-press"
        aria-label={t('theme.select', 'Chọn theme màu')}
        aria-expanded={isOpen}
        title={t('theme.select', 'Chọn theme màu')}
      >
        <PaletteIcon className="w-6 h-6" />
      </button>

      <div
        className={`absolute right-0 mt-2 w-64 bg-popover text-popover-foreground rounded-md shadow-lg z-50 ring-1 ring-black ring-opacity-5 transition-all duration-200 ease-custom-bezier transform-origin-top-right ${isOpen ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'
          }`}
        role="menu"
        aria-orientation="vertical"
      >
        <div className="grid grid-cols-4 gap-2 px-3 py-2">
          {THEMES.map((themeInfo) => (
            <button
              key={themeInfo.name}
              onClick={() => handleThemeSelect(themeInfo.name)}
              className={`w-full h-10 rounded-md flex items-center justify-center transition-all-smooth btn-press focus:outline-none focus:ring-2 focus:ring-ring ${colorTheme === themeInfo.name ? 'ring-2 ring-ring ring-offset-2 ring-offset-popover' : ''
                }`}
              style={{ backgroundColor: themeInfo.color }}
              aria-label={t('theme.select_specific', { name: themeInfo.name, defaultValue: `Chọn theme ${themeInfo.name}` })}
              role="menuitem"
              title={themeInfo.name.charAt(0).toUpperCase() + themeInfo.name.slice(1)}
            >
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ThemePicker;