
import React, { useState, useRef, useEffect } from 'react';
import { useFont } from '../hooks/useFont';
import { FontIcon } from './icons';
import { FONT_OPTIONS, Font } from '../contexts/FontContext';
import { useTranslation } from 'react-i18next';

const FontSwitcher: React.FC = () => {
  const { font, setFont } = useFont();
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

  const handleFontSelect = (selectedFont: Font) => {
    setFont(selectedFont);
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 rounded-full text-muted-foreground hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-ring dark:focus:ring-offset-background transition-all-smooth btn-press"
        aria-label={t('theme.font_select', 'Chọn font chữ')}
        aria-expanded={isOpen}
        title={t('theme.font_select', 'Chọn font chữ')}
      >
        <FontIcon className="w-6 h-6" />
      </button>

      <div
        className={`absolute right-0 mt-2 w-48 bg-popover text-popover-foreground rounded-md shadow-lg py-1 z-50 ring-1 ring-black ring-opacity-5 transition-all duration-200 ease-custom-bezier transform-origin-top-right ${isOpen ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'
          }`}
        role="menu"
        aria-orientation="vertical"
        aria-labelledby="font-switcher-button"
      >
        {Object.keys(FONT_OPTIONS).map((fontKey) => (
          <button
            key={fontKey}
            onClick={() => handleFontSelect(fontKey as Font)}
            className={`text-left w-full px-4 py-2 text-sm transition-colors duration-150 rounded-sm ${font === fontKey
                ? 'bg-accent text-accent-foreground'
                : 'text-popover-foreground'
              } hover:bg-accent/50`}
            style={{ fontFamily: FONT_OPTIONS[fontKey as Font].stack }}
            role="menuitem"
          >
            {FONT_OPTIONS[fontKey as Font].label}
          </button>
        ))}
      </div>
    </div>
  );
};

export default FontSwitcher;
