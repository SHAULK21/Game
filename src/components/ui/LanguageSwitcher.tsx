import React from 'react';
import { useLocale } from '../../i18n/locale';
export const LanguageSwitcher: React.FC = () => {
  const { locale, setLocale } = useLocale();
  return <div className="mt-2 flex items-center justify-center gap-2" role="group" aria-label={locale === 'uk' ? 'Мова гри' : 'Язык игры'}>
    {([['uk', 'Українська'], ['ru', 'Русский']] as const).map(([id, label]) =>
      <button key={id} type="button" lang={id} aria-pressed={locale === id} onClick={() => setLocale(id)}
        className={`min-h-11 rounded-lg border px-3 py-2 text-xs font-semibold ${locale === id ? 'border-amber-400 bg-amber-950/40 text-amber-200' : 'border-slate-600 text-slate-300'}`}>
        {label}
      </button>)}
  </div>;
};
