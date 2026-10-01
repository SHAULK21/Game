import React, { useEffect, useState } from 'react';
import { apiRequest } from '../../utils/api';
type Report = { battles: Array<{band:string;region:string;difficulty:string;battles:number;seconds:string;rounds:string;win_rate:string;exp:string}>;
  sessions:{sessions:number;minutes:string|null;net_gold:string|null;net_silver:string|null};
  retention:{eligible_d1:number;returned_d1:number;eligible_d7:number;returned_d7:number}; };
export function BalanceReport() {
  const [data,setData]=useState<Report|null>(null),[error,setError]=useState('');
  const load=()=>{setError('');apiRequest<Report>('/api/admin/balance').then(setData).catch(e=>setError(String(e)));};
  useEffect(load,[]);
  const rate=(returned:number,eligible:number)=>eligible?`${(100*returned/eligible).toFixed(1)}% (${returned}/${eligible})`:'Ещё нет зрелой когорты';
  return <section className="rounded-xl border border-cyan-800 p-3 space-y-2 text-xs">
    <div className="flex justify-between"><h3 className="text-cyan-200">Баланс · последние 30 дней</h3><button onClick={load} className="text-cyan-300">Обновить</button></div>
    <p className="text-slate-400">Диагностика клиента. Время учитывает активную вкладку; доход сессии — изменение кошелька после расходов. D1/D7 — возврат на 1-й/7-й день после первого наблюдения, UTC.</p>
    {error&&<p role="alert">{error}</p>}
    {data&&<>
      <p>Сессий ≥1 мин: {data.sessions.sessions} · средняя длительность: {data.sessions.minutes||'—'} мин</p>
      <p>Средний чистый доход: {data.sessions.net_gold||'—'} золота · {data.sessions.net_silver||'—'} серебра</p>
      <p>D1: {rate(data.retention.returned_d1,data.retention.eligible_d1)}<br/>D7: {rate(data.retention.returned_d7,data.retention.eligible_d7)}</p>
      <div className="overflow-x-auto"><table className="w-full text-[10px]"><thead><tr>{['Ур. / зона / режим','Бои','Сек.','Ходы','Победы','XP'].map(x=><th key={x} className="p-1 text-left">{x}</th>)}</tr></thead><tbody>{data.battles.map(row=><tr key={row.band+row.region+row.difficulty} className="border-t border-slate-800"><td className="p-1">{row.band} · {row.region} · {row.difficulty}</td><td>{row.battles}</td><td>{row.seconds}</td><td>{row.rounds}</td><td>{row.win_rate}%</td><td>{row.exp}</td></tr>)}</tbody></table></div>
      {!data.battles.length&&<p className="text-slate-400">Данные появятся после новых боёв.</p>}
    </>}
  </section>;
}
