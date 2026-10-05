import React, { useEffect, useRef, useState } from 'react';
import type { BattleLogEntry, CombatImpact } from '../../types/game';
import { useLocale } from '../../i18n/locale';

export const IMPACT_LIFETIME = 1600;
export function impactCaption(impact: CombatImpact, ukrainian = false) {
  if (impact.periodic) return ({bleed:ukrainian?'Кровотеча':'Кровотечение',poison:ukrainian?'Отруєння':'Отравление',burn:ukrainian?'Опік':'Ожог'})[impact.periodic];
  if (impact.evaded) return ukrainian?'Ухилення':'Уклонение';
  if (impact.empowered && impact.blocked) return ukrainian?'Щит проти потужного удару':'Щит против мощного удара';
  if (impact.empowered && impact.critical) return ukrainian?'Потужний критичний удар':'Мощный критический удар';
  if (impact.critical) return ukrainian?'Критичний удар':'Критический удар';
  if (impact.empowered) return ukrainian?'Потужний удар':'Мощный удар';
  if (impact.blocked) return ukrainian?'Блок щитом':'Блок щитом';
  return '';
}
export function impactStyle(impact: CombatImpact) {
  return impact.periodic || (impact.empowered && impact.blocked ? 'shield-super' : impact.empowered ? 'super' : impact.critical ? 'critical' : impact.blocked ? 'shield' : 'normal');
}

/** Presentation only: independent expiry even if no further turn is played. */
export function CombatDamageFeedback({battleLog}: {battleLog: BattleLogEntry[]}) {
  const {locale} = useLocale();
  const seen = useRef(new Set<string>());
  const [visible, setVisible] = useState<Array<{id:string;impact:CombatImpact;expiresAt:number}>>([]);
  useEffect(() => {
    // A new battle clears its journal; don't keep numbers from the previous opponent.
    if (seen.current.size && !battleLog.some(entry => seen.current.has(entry.id))) {
      setVisible([]); seen.current.clear();
    }
    const incoming = battleLog.filter(entry => !seen.current.has(entry.id) && entry.impact);
    for (const entry of battleLog) seen.current.add(entry.id);
    if (!incoming.length) return;
    setVisible(previous => [...previous, ...incoming.map(entry => ({id:entry.id,impact:entry.impact!,expiresAt:Date.now()+IMPACT_LIFETIME}))].slice(-8));
  }, [battleLog]);
  // Reschedule the nearest expiry without extending the lifetime of older hits.
  // Cleanup/re-setup is safe in React StrictMode and when the arena unmounts.
  useEffect(() => {
    if (!visible.length) return;
    const delay = Math.max(0, Math.min(...visible.map(entry => entry.expiresAt)) - Date.now());
    const timer = setTimeout(() => setVisible(previous => previous.filter(entry => entry.expiresAt > Date.now())), delay);
    return () => clearTimeout(timer);
  }, [visible]);
  return <div className="combat-damage-layer" aria-live="polite" aria-atomic="false">
    {(['player','monster'] as const).map(target => <div key={target} className={`combat-damage-stack combat-damage-${target}`}>
      {visible.filter(entry => entry.impact.target === target).map(({id,impact}) => <div key={id} className={`combat-damage-pop is-${impactStyle(impact)}`} data-impact={impactStyle(impact)}>
        <span className="combat-damage-caption">{impactCaption(impact,locale === 'uk')}</span>
        {!impact.evaded && <strong>{impact.amount > 0 ? `−${impact.amount}` : impact.blocked ? (locale === 'uk'?'Відбито':'Отбито') : '0'}</strong>}
        {!!impact.blocked && <small>Щит: {impact.blocked}</small>}
        {!!impact.critical && !!impact.empowered && !!impact.blocked && <small>{locale === 'uk'?'Критичний удар':'Критический удар'}</small>}
      </div>)}
    </div>)}
  </div>;
}
