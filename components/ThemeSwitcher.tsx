
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
        if (!isOpen) return;
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        const timer = setTimeout(() => {
            document.addEventListener('click', handleClickOutside);
        }, 0);
        return () => {
            clearTimeout(timer);
            document.removeEventListener('click', handleClickOutside);
        };
    }, [isOpen]);

    const triggerClass = `utility-trigger ${isOpen ? 'is-active' : ''}`;

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className={`${triggerClass} cursor-pointer touch-manipulation select-none`}
                aria-label={t('account.settings')}
                aria-expanded={isOpen}
                aria-haspopup="menu"
                title={t('account.settings')}
            >
                <CogIcon className="utility-trigger-icon pointer-events-none" />
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
                                type="button"
                                onClick={() => setTheme('light')}
                                className={`flex flex-col items-center justify-center gap-1 rounded-xl p-2 transition-colors text-sm cursor-pointer touch-manipulation ${theme === 'light' ? 'bg-primary/10 text-primary ring-1 ring-primary/25 font-semibold' : 'text-popover-foreground hover:bg-black/5 dark:hover:bg-white/10'}`}
                            >
                                <SunIcon className="w-5 h-5 pointer-events-none" />
                                <span className="pointer-events-none">{t('account.light')}</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setTheme('dark')}
                                className={`flex flex-col items-center justify-center gap-1 rounded-xl p-2 transition-colors text-sm cursor-pointer touch-manipulation ${theme === 'dark' ? 'bg-primary/10 text-primary ring-1 ring-primary/25 font-semibold' : 'text-popover-foreground hover:bg-black/5 dark:hover:bg-white/10'}`}
                            >
                                <MoonIcon className="w-5 h-5 pointer-events-none" />
                                <span className="pointer-events-none">{t('account.dark')}</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setTheme('system')}
                                className={`flex flex-col items-center justify-center gap-1 rounded-xl p-2 transition-colors text-sm cursor-pointer touch-manipulation ${theme === 'system' ? 'bg-primary/10 text-primary ring-1 ring-primary/25 font-semibold' : 'text-popover-foreground hover:bg-black/5 dark:hover:bg-white/10'}`}
                            >
                                <SystemIcon className="w-5 h-5 pointer-events-none" />
                                <span className="pointer-events-none">{t('account.system')}</span>
                            </button>
                        </div>
                    </div>

                    {/* Font Section */}
                    <div>
                        <h4 className="text-sm font-semibold text-muted-foreground px-1 mb-2">{t('account.font')}</h4>
                        <div className="space-y-1">
                            {Object.keys(FONT_OPTIONS).map((fontKey) => (
                                <button
                                    type="button"
                                    key={fontKey}
                                    onClick={() => setFont(fontKey as Font)}
                                    className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm transition-colors duration-150 cursor-pointer touch-manipulation ${font === fontKey
                                        ? 'bg-primary/10 text-primary font-bold'
                                        : 'text-popover-foreground hover:bg-black/5 dark:hover:bg-white/10'
                                        }`}
                                    style={{ fontFamily: FONT_OPTIONS[fontKey as Font].stack }}
                                    role="menuitem"
                                >
                                    <span className="pointer-events-none">{FONT_OPTIONS[fontKey as Font].label}</span>
                                    {font === fontKey && <CheckIcon className="w-4 h-4 pointer-events-none" />}
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
