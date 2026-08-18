import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Import translation files
import translationVI from './locales/vi/translation.json';
import translationEN from './locales/en/translation.json';
import translationRU from './locales/ru/translation.json';
import translationCN from './locales/cn/translation.json';

const resources = {
    vi: {
        translation: translationVI
    },
    en: {
        translation: translationEN
    },
    ru: {
        translation: translationRU
    },
    cn: {
        translation: translationCN
    }
};

i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
        resources,
        lng: 'vi',
        fallbackLng: 'vi',
        supportedLngs: ['vi', 'en', 'ru', 'cn'],
        debug: false,
        interpolation: {
            escapeValue: false, // not needed for react as it escapes by default
        },
        detection: {
            order: ['querystring', 'localStorage', 'navigator'],
            lookupQuerystring: 'lang',
            caches: ['localStorage'],
        }
    });

export default i18n;
