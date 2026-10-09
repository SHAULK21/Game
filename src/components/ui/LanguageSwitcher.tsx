import React from 'react';
import { Languages } from 'lucide-react';
import { useLocale } from '../../i18n/locale';
export const LanguageSwitcher: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const { locale, setLocale } = useLocale();
  if (compact) {
    const next = locale === 'uk' ? 'ru' : 'uk';
    const label = locale === 'uk' ? 'Мова гри: українська. Перемкнути на російську' : 'Язык игры: русский. Переключить на украинский';
    return <button type="button" aria-label={label} title={label} onClick={() => setLocale(next)}
      className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg border border-amber-400/40 px-2.5 py-1 text-xs font-semibold text-amber-200 transition-colors hover:bg-amber-950/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400">
      <Languages aria-hidden="true" className="h-4 w-4" /><span>{locale === 'uk' ? 'UA' : 'RU'}</span>
    </button>;
  }
  return <div className="mt-2 flex items-center justify-center gap-2" role="group" aria-label={locale === 'uk' ? 'Мова гри' : 'Язык игры'}>
    {([['uk', 'Українська'], ['ru', 'Русский']] as const).map(([id, label]) =>
      <button key={id} type="button" lang={id} aria-pressed={locale === id} onClick={() => setLocale(id)}
        className={`min-h-11 rounded-lg border px-3 py-2 text-xs font-semibold ${locale === id ? 'border-amber-400 bg-amber-950/40 text-amber-200' : 'border-slate-600 text-slate-300'}`}>
        {label}
      </button>)}
  </div>;
};
