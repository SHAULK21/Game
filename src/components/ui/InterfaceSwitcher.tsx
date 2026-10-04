import { t as localize, useLocale } from '../../i18n/locale';
import { LanguageSwitcher } from './LanguageSwitcher';
import React from 'react';
import { Monitor, ScrollText, Check } from 'lucide-react';
import { useInterface } from '../../context/InterfaceContext';

export const InterfaceSwitcher: React.FC<{ compact?: boolean; registration?: boolean }> = ({ compact = false, registration = false }) => {
  useLocale();
  const { style, setStyle } = useInterface();
  const showDescriptions = !compact && !registration;
  return <section className={registration ? 'registration-interface-switch rounded-xl border border-amber-400/60 bg-slate-900/90 p-2.5' : compact ? 'mx-auto mt-2 w-full max-w-lg' : 'rounded-2xl border-2 border-amber-400/70 bg-slate-900/90 p-3 shadow-lg'} aria-label={localize("Стиль интерфейса")}>
    {!compact && <>
      <h2 className={registration ? "mb-2 text-xs font-bold text-amber-200" : "text-base font-bold text-amber-200"}>{localize("Выберите свой интерфейс")}</h2>
      {showDescriptions && <p className="mb-3 mt-1 text-xs text-slate-300">{localize("Два оформления одной игры. Можно переключить в любой момент.")}</p>}
    </>}
    <div className="grid grid-cols-2 gap-2" role="group" aria-label={localize("Выбор оформления")}>
      {([{ id: 'modern', label: 'Современный', description: 'Лаконичные панели и привычная навигация', Icon: Monitor }, { id: 'fantasy', label: 'Фэнтези', description: 'Фолиант охотника, бестиарий и золотые акценты', Icon: ScrollText }] as const).map(({ id, label, description, Icon }) =>
        <button key={id} type="button" aria-pressed={style === id} onClick={() => setStyle(id)} className={`min-h-11 rounded-xl border px-2.5 py-2 text-left transition-colors ${style === id ? 'border-amber-400 bg-amber-950/60 text-amber-100' : 'border-slate-600 bg-slate-950 text-slate-300'}`}>
          <span className="flex items-center gap-1.5 text-xs font-bold"><Icon className="h-4 w-4 shrink-0" /><span>{localize(label)}</span>{style === id && <Check aria-hidden="true" className="ml-auto h-4 w-4 shrink-0" />}</span>
          {showDescriptions && <span className="mt-2 block text-[11px] leading-relaxed">{localize(description)}</span>}
        </button>
      )}
    </div>
  {!compact && <LanguageSwitcher />}</section>;
};
