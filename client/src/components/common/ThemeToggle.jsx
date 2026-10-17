import React from 'react';
import { HiSun, HiMoon } from 'react-icons/hi2';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';

export default function ThemeToggle({ className = '' }) {
  const { theme, toggleTheme, isDark } = useTheme();
  const { t } = useLanguage();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`relative p-2 rounded-xl border transition-all duration-200 flex items-center justify-center focus:outline-none ${
        isDark
          ? 'bg-slate-800 border-slate-700 text-amber-400 hover:bg-slate-700 hover:text-amber-300 shadow-sm'
          : 'bg-gray-100 border-gray-200 text-slate-700 hover:bg-gray-200 hover:text-slate-900 shadow-sm'
      } ${className}`}
      title={isDark ? (t('theme_light') || 'Switch to Light Mode') : (t('theme_dark') || 'Switch to Dark Mode')}
      aria-label="Toggle dark/light theme"
    >
      {isDark ? (
        <HiSun className="w-5 h-5 transition-transform duration-300 rotate-0 hover:rotate-45" />
      ) : (
        <HiMoon className="w-5 h-5 transition-transform duration-300 hover:-rotate-12" />
      )}
    </button>
  );
}
