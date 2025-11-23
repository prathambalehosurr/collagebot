import { useState, useEffect } from 'react';
import en from '../i18n/en.json';
import es from '../i18n/es.json';
import hi from '../i18n/hi.json';
import fr from '../i18n/fr.json';

const translations = { en, es, hi, fr };

// Get browser language or default to English
const getBrowserLanguage = () => {
    const lang = navigator.language.split('-')[0]; // Get 'en' from 'en-US'
    return translations[lang] ? lang : 'en';
};

// Create i18n context
export const useTranslation = () => {
    const [language, setLanguage] = useState(() => {
        return localStorage.getItem('language') || getBrowserLanguage();
    });

    const t = (key) => {
        const keys = key.split('.');
        let value = translations[language];

        for (const k of keys) {
            value = value?.[k];
        }

        return value || key;
    };

    const changeLanguage = (lang) => {
        setLanguage(lang);
        localStorage.setItem('language', lang);
    };

    return { t, language, changeLanguage, languages: Object.keys(translations) };
};

// Language names for display
export const languageNames = {
    en: 'English',
    es: 'Español',
    hi: 'हिंदी',
    fr: 'Français'
};
