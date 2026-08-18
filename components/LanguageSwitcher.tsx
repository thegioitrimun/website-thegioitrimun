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

    const changeLanguage = (code: string) => {
        i18n.changeLanguage(code);
        setIsOpen(false);
    };

    const triggerClass = `utility-trigger px-3 ${isOpen ? 'is-active' : ''}`;

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={triggerClass}
                aria-label={t('language.select', 'Chọn ngôn ngữ')}
                aria-expanded={isOpen}
                aria-haspopup="menu"
            >
                <span className="utility-trigger-label">{currentLang.label}</span>
                <ChevronDownIcon className={`h-4 w-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            <div
                className={`utility-popover absolute right-0 mt-2 w-40 text-popover-foreground z-[90] transition-all duration-200 ease-custom-bezier transform-origin-top-right ${isOpen ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'
                    }`}
                role="menu"
            >
                <div className="flex flex-col p-1.5">
                    {LANGUAGES.map((lang) => (
                        <button
                            key={lang.code}
                            onClick={() => changeLanguage(lang.code)}
                            className={`utility-popover-item ${i18n.language === lang.code ? 'is-active font-bold' : ''
                                }`}
                            role="menuitem"
                        >
                            <span className="w-8 text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">{lang.label}</span>
                            {lang.name}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default LanguageSwitcher;
