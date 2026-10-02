import { t as localize, useLocale } from '../../i18n/locale';
import React, { useEffect, useState } from 'react';
import { apiRequest } from '../../utils/api';
type Report = { battles: Array<{band:string;class_id:string;role:string;region:string;difficulty:string;battles:number;seconds:string;rounds:string;win_rate:string;exp:string}>;
  sessions:{sessions:number;minutes:string|null;net_gold:string|null;net_silver:string|null};
  retention:{eligible_d1:number;returned_d1:number;eligible_d7:number;returned_d7:number}; };
export function BalanceReport() {
  useLocale();
  const [data,setData]=useState<Report|null>(null),[error,setError]=useState('');
  const load=()=>{setError('');apiRequest<Report>('/api/admin/balance').then(setData).catch(e=>setError(String(e)));};
  useEffect(load,[]);
  const rate=(returned:number,eligible:number)=>eligible?`${(100*returned/eligible).toFixed(1)}% (${returned}/${eligible})`:'Ещё нет зрелой когорты';
  return <section className="rounded-xl border border-cyan-800 p-3 space-y-2 text-xs">
    <div className="flex justify-between"><h3 className="text-cyan-200">{localize("Баланс · последние 30 дней")}</h3><button onClick={load} className="text-cyan-300">{localize("Обновить")}</button></div>
    <p className="text-slate-400">{localize("Диагностика клиента. Время учитывает активную вкладку; доход сессии — изменение кошелька после расходов. D1/D7 — возврат на 1-й/7-й день после первого наблюдения, UTC.")}</p>
    {error&&<p role="alert">{localize(error)}</p>}
    {data&&<>
      <p>{localize("Сессий ≥1 мин: ")}{localize(data.sessions.sessions)}{localize(" · средняя длительность: ")}{localize(data.sessions.minutes||'—')}{localize(" мин")}</p>
      <p>{localize("Средний чистый доход: ")}{localize(data.sessions.net_gold||'—')}{localize(" золота · ")}{localize(data.sessions.net_silver||'—')}{localize(" серебра")}</p>
      <p>D1: {localize(rate(data.retention.returned_d1,data.retention.eligible_d1))}<br/>D7: {localize(rate(data.retention.returned_d7,data.retention.eligible_d7))}</p>
      <div className="overflow-x-auto"><table className="w-full text-[10px]"><thead><tr>{['Ур. / класс / враг / зона / режим','Бои','Сек.','Ходы','Победы','XP'].map(x=><th key={x} className="p-1 text-left">{localize(x)}</th>)}</tr></thead><tbody>{data.battles.map(row=><tr key={row.band+row.class_id+row.role+row.region+row.difficulty} className="border-t border-slate-800"><td className="p-1">{localize(row.band)} · {localize(row.class_id)} · {localize(row.role === 'boss' ? 'босс' : row.role === 'elite' ? 'элита' : row.role === 'normal' ? 'обычный' : 'старые данные')} · {localize(row.region)} · {localize(row.difficulty)}</td><td>{localize(row.battles)}</td><td>{localize(row.seconds)}</td><td>{localize(row.rounds)}</td><td>{localize(row.win_rate)}%</td><td>{localize(row.exp)}</td></tr>)}</tbody></table></div>
      {!data.battles.length&&<p className="text-slate-400">{localize("Данные появятся после новых боёв.")}</p>}
    </>}
  </section>;
}
