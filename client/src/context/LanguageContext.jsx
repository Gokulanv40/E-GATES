import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import enTranslations from '../i18n/en.json';

const translations = {
  en: enTranslations,
};

const LanguageContext = createContext(null);

export const LanguageProvider = ({ children }) => {
  // Application is locked to English only
  const [language] = useState('en');

  useEffect(() => {
    localStorage.setItem('association_lang', 'en');
    document.documentElement.lang = 'en';
  }, []);

  const setLanguage = () => {};
  const toggleLanguage = () => {};

  const t = useCallback(
    (key, params = {}) => {
      let text = translations.en[key] || key;

      // Replace {param} placeholders if any
      if (params && typeof params === 'object') {
        Object.entries(params).forEach(([paramKey, paramVal]) => {
          text = text.replace(new RegExp(`\\{${paramKey}\\}`, 'g'), paramVal);
        });
      }

      return text;
    },
    []
  );

  return (
    <LanguageContext.Provider
      value={{
        language: 'en',
        setLanguage,
        toggleLanguage,
        t,
        isTamil: false,
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};

export default LanguageContext;
