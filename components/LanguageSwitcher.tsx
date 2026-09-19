import SurfacePresence from './motion/SurfacePresence';
import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDownIcon } from './icons';

const LANGUAGES = [
    { code: 'vi', label: 'VI', name: 'Tiếng Việt' },
    { code: 'en', label: 'EN', name: 'English' },
    { code: 'ru', label: 'RU', name: 'Русский' },
    { code: 'cn', label: 'CN', name: '中文' },
];

const LanguageSwitcher: React.FC = () => {
    const { t, i18n } = useTranslation();
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const currentLang = LANGUAGES.find((lang) => lang.code === i18n.language) || LANGUAGES[0];

    useEffect(() => {
        if (!isOpen) return;
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setIsOpen(false); dropdownRef.current?.querySelector<HTMLButtonElement>('button')?.focus(); }
    };
    document.addEventListener('keydown', onEscape);
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
            document.removeEventListener('keydown', onEscape);
            document.removeEventListener('click', handleClickOutside);
        };
    }, [isOpen]);

    const changeLanguage = (code: string) => {
        i18n.changeLanguage(code);
        setIsOpen(false);
    };

    const triggerClass = `utility-trigger px-3 ${isOpen ? 'is-active' : ''}`;

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className={`${triggerClass} cursor-pointer touch-manipulation select-none`}
                aria-label={t('language.select', 'Chọn ngôn ngữ')}
                aria-expanded={isOpen}
                aria-haspopup="menu"
            >
                <span className="utility-trigger-label pointer-events-none">{currentLang.label}</span>
                <ChevronDownIcon className={`h-4 w-4 pointer-events-none transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            <SurfacePresence>{isOpen && <div
                data-motion-surface="true" data-origin="top-right" className="t-dropdown utility-popover absolute right-0 mt-2 w-40 text-popover-foreground z-[90]"
                role="menu"
            >
                <div className="flex flex-col p-1.5">
                    {LANGUAGES.map((lang) => (
                        <button
                            type="button"
                            key={lang.code}
                            onClick={() => changeLanguage(lang.code)}
                            className={`utility-popover-item cursor-pointer touch-manipulation ${i18n.language === lang.code ? 'is-active font-bold' : ''
                                }`}
                            role="menuitem"
                        >
                            <span className="w-8 text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">{lang.label}</span>
                            {lang.name}
                        </button>
                    ))}
                </div>
            </div>}</SurfacePresence>
        </div>
    );
};

export default LanguageSwitcher;
