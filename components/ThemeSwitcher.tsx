
import React, { useState, useRef, useEffect } from 'react';
import { useTheme } from '../hooks/useTheme';
import { useFont } from '../hooks/useFont';
import { FONT_OPTIONS, Font } from '../contexts/FontContext';
import { CogIcon, SunIcon, MoonIcon, SystemIcon, CheckIcon } from './icons';
import { useTranslation } from 'react-i18next';

const SettingsDropdown: React.FC = () => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const { theme, setTheme } = useTheme();
    const { font, setFont } = useFont();
    const { t } = useTranslation();

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

    const triggerClass = `utility-trigger ${isOpen ? 'is-active' : ''}`;

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={triggerClass}
                aria-label={t('account.settings')}
                aria-expanded={isOpen}
                aria-haspopup="menu"
                title={t('account.settings')}
            >
                <CogIcon className="utility-trigger-icon" />
            </button>

            <div
                className={`utility-popover absolute right-0 mt-2 w-72 text-popover-foreground py-1 z-[90] transition-all duration-200 ease-custom-bezier transform-origin-top-right ${isOpen ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'
                    }`}
                role="menu"
                aria-orientation="vertical"
            >
                <div className="p-3">
                    {/* Theme Mode Section */}
                    <div className="mb-4">
                        <h4 className="text-sm font-semibold text-muted-foreground px-1 mb-2">{t('account.theme_mode')}</h4>
                        <div className="grid grid-cols-3 gap-2">
                            <button
                                onClick={() => setTheme('light')}
                                className={`flex flex-col items-center justify-center gap-1 rounded-xl p-2 transition-colors text-sm ${theme === 'light' ? 'bg-accent text-accent-foreground ring-1 ring-ring/20' : 'hover:bg-accent/50'}`}
                            >
                                <SunIcon className="w-5 h-5" />
                                <span>{t('account.light')}</span>
                            </button>
                            <button
                                onClick={() => setTheme('dark')}
                                className={`flex flex-col items-center justify-center gap-1 rounded-xl p-2 transition-colors text-sm ${theme === 'dark' ? 'bg-accent text-accent-foreground ring-1 ring-ring/20' : 'hover:bg-accent/50'}`}
                            >
                                <MoonIcon className="w-5 h-5" />
                                <span>{t('account.dark')}</span>
                            </button>
                            <button
                                onClick={() => setTheme('system')}
                                className={`flex flex-col items-center justify-center gap-1 rounded-xl p-2 transition-colors text-sm ${theme === 'system' ? 'bg-accent text-accent-foreground ring-1 ring-ring/20' : 'hover:bg-accent/50'}`}
                            >
                                <SystemIcon className="w-5 h-5" />
                                <span>{t('account.system')}</span>
                            </button>
                        </div>
                    </div>

                    {/* Font Section */}
                    <div>
                        <h4 className="text-sm font-semibold text-muted-foreground px-1 mb-2">{t('account.font')}</h4>
                        <div className="space-y-1">
                            {Object.keys(FONT_OPTIONS).map((fontKey) => (
                                <button
                                    key={fontKey}
                                    onClick={() => setFont(fontKey as Font)}
                                    className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm transition-colors duration-150 ${font === fontKey
                                        ? 'bg-accent text-accent-foreground'
                                        : 'text-popover-foreground'
                                        } hover:bg-accent/50`}
                                    style={{ fontFamily: FONT_OPTIONS[fontKey as Font].stack }}
                                    role="menuitem"
                                >
                                    <span>{FONT_OPTIONS[fontKey as Font].label}</span>
                                    {font === fontKey && <CheckIcon className="w-4 h-4" />}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SettingsDropdown;
