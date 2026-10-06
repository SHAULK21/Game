import { SelectionField } from '../ui/SelectionField';
import { localizeDuelLog } from '../../i18n/duelLog';
import { t as localize, useLocale, intlLocale } from '../../i18n/locale';
import { createOperationId } from '../../utils/operationId';
import React,{useEffect,useState} from 'react';
import {apiRequest} from '../../utils/api';
import {useGame} from '../../context/GameContext';
import {STANCE_LABELS,PVP_CLASS_NAMES,type PvpStance} from '../../utils/pvp';
type Result={matchId:string;winner:string;attackerName:string;defenderName:string;attackerRating:number;delta:number;log:string[]};
type Data={profile:{enrolled:boolean;stance:PvpStance;rating:number;tickets:number;wins:number;losses:number};opponents:{telegram_id:string;name:string;rating:number;class_id:string;stance:PvpStance}[];history:{id:string;attacker:string;result:Result}[];resetAt:string;leaders:{name:string;rating:number;wins:number}[]};
export const PvpArena:React.FC=()=>{
  useLocale();
  const {player}=useGame();const [data,setData]=useState<Data|null>(null),[stance,setStance]=useState<PvpStance>('balanced'),[error,setError]=useState(''),[busy,setBusy]=useState(false),[result,setResult]=useState<Result|null>(null);
  const load=async()=>{try{if(player)await apiRequest('/api/profile/sync',{method:'POST',body:JSON.stringify({characterName:player.name,level:player.level,classId:player.classId,arenaRating:player.arenaRating})});const next=await apiRequest<Data>('/api/pvp');setData(next);setStance(next.profile.stance);}catch(e){setError(String(e));}};
  useEffect(()=>{void load();const timer=setInterval(()=>void load(),60000);return()=>clearInterval(timer);},[]);
  const enroll=async()=>{setBusy(true);setError('');try{await apiRequest('/api/pvp/enroll',{method:'POST',body:JSON.stringify({stance,enrolled:!data?.profile.enrolled})});await load();}catch(e){setError(String(e));}finally{setBusy(false);}};
  const fight=async(target:string)=>{
    if(busy)return;setBusy(true);setError('');
    const key='aethelgard_pvp_pending_'+player?.userId;
    let pending:{matchId:string;targetId:string}|null=null;
    try{pending=JSON.parse(localStorage.getItem(key)||'null');}catch{localStorage.removeItem(key);}
    if(!pending){pending={matchId:createOperationId(),targetId:target};localStorage.setItem(key,JSON.stringify(pending));}
    try{const next=await apiRequest<Result>('/api/pvp/challenge',{method:'POST',body:JSON.stringify(pending)});setResult(next);localStorage.removeItem(key);await load();}
    catch(e){const message=String(e);setError(message);if(/HTTP 400|HTTP 403/.test(message))localStorage.removeItem(key);}
    finally{setBusy(false);}
  };
  return <div className="space-y-3">
    <section className="ui-panel p-3 rounded-xl border space-y-2"><h3 className="font-bold">{localize("⚔️ PvP — дуэли игроков")}</h3><p className="text-xs text-slate-400">{localize("Асинхронный бой с настоящим игроком. Уровни и снаряжение уравнены; класс и тактика влияют на исход. HP вне арены не расходуется. Без зелий и автобоя.")}</p><p className="text-xs text-slate-400">{localize("5 попыток в день, отдых 1 минута. Один бой с парой за 24 часа. Соклановцы исключены. Рейтинг Elo меняется у обоих; награда — рейтинг и место в таблице PvP.")}</p><p className="text-xs text-slate-400">{localize("Натиск сильнее обороны, оборона сильнее контроля, контроль сильнее натиска. Каждый третий ход — классовый приём. До 30 раундов, затем победа по доле оставшегося HP.")}</p>
    <details className="text-xs text-slate-400"><summary>{localize("Приёмы и особенности классов")}</summary><p className="mt-2">{localize("Воин и рыцарь получают щит; воин пробивает броню. Берсерк усиливает удар при низком HP. Разбойник чаще уклоняется. Убийца пробивает броню и усиливает третий удар. Лучник чаще критует и уклоняется. Маг пробивает броню заклинанием. Некромант восстанавливает 12% нанесённого урона. Паладин и друид лечатся на каждом третьем ходу.")}</p></details>
    {data&&<><p className="text-sm text-amber-200">{localize("Рейтинг: ")}{localize(data.profile.rating)} · {localize(data.profile.wins)}{localize(" побед / ")}{localize(data.profile.losses)}{localize(" поражений")}</p><p className="text-xs">{localize("Попытки: ")}{localize(data.profile.tickets)}{localize("/5 · восстановление ")}{localize(new Date(data.resetAt).toLocaleTimeString(intlLocale(), {hour:'2-digit',minute:'2-digit'}))}</p><label className="text-xs">{localize("Тактика")}<SelectionField aria-label={localize("Тактика")} value={stance} disabled={busy} onChange={e=>setStance(e.target.value as PvpStance)} className="ml-2 bg-slate-950 rounded p-2">{Object.entries(STANCE_LABELS).map(([key,name])=><option key={key} value={key}>{localize(name)}</option>)}</SelectionField></label><div className="flex gap-2"><button disabled={busy} onClick={()=>void enroll()} className="rounded-lg bg-cyan-900 p-2 text-xs">{localize(data.profile.enrolled?'Отключить участие':'Участвовать в PvP')}</button>{data.profile.enrolled&&<button disabled={busy} onClick={async()=>{setBusy(true);try{await apiRequest('/api/pvp/enroll',{method:'POST',body:JSON.stringify({stance,enrolled:true})});await load();}catch(e){setError(String(e));}finally{setBusy(false);}}} className="rounded-lg bg-slate-800 p-2 text-xs">{localize("Сохранить тактику")}</button>}</div></>}
    </section>
    {error&&<p role="alert" className="text-xs text-rose-300">{localize(error)}</p>}
    <button disabled={busy} onClick={()=>void load()} className="text-xs text-cyan-300">{localize("Обновить соперников")}</button>
    {data?.opponents.map(o=><div key={o.telegram_id} className="flex gap-2 rounded-xl border border-slate-800 p-3"><div className="flex-1 text-xs"><b>{o.name}</b><p>{localize(o.rating)} PTS · {localize(PVP_CLASS_NAMES[o.class_id] || o.class_id)} · {localize(STANCE_LABELS[o.stance])}</p></div><button disabled={busy||!data.profile.enrolled||data.profile.tickets<1} onClick={()=>void fight(o.telegram_id)} className="rounded-lg bg-amber-700 px-3 text-xs disabled:opacity-40">{localize("Дуэль")}</button></div>)}
    {data&&!data.opponents.length&&<p className="text-xs text-slate-400">{localize("Пока нет подходящих участников. Игроки появятся, когда включат участие в PvP.")}</p>}
    {result&&<section className="rounded-xl border border-amber-500/40 p-3 text-xs space-y-2"><b>{localize(result.winner==='draw'?'Ничья':result.winner==='attacker'?'Победа!':'Поражение')} · {localize(result.delta>0?'+':'')}{localize(result.delta)} PTS</b><p>{result.attackerName}{localize(" против ")}{result.defenderName}</p><details><summary>{localize("Ход боя")}</summary><div className="max-h-64 overflow-auto space-y-1">{result.log.map((line,i)=><p key={i}>{localizeDuelLog(line,result.attackerName,result.defenderName)}</p>)}</div></details></section>}
    <section className="rounded-xl border p-3 space-y-2"><h4 className="text-xs font-bold">{localize("История дуэлей")}</h4>{data?.history.map(h=><button key={h.id} onClick={()=>setResult(h.result)} className="block text-xs text-slate-400">{h.result.attackerName} — {h.result.defenderName} · {h.result.winner==='draw'?localize('ничья'):h.result.winner==='attacker'?h.result.attackerName:h.result.defenderName}</button>)}</section>
    <details className="rounded-xl border p-3 text-xs"><summary>{localize("Рейтинг PvP")}</summary>{data?.leaders.map((l,i)=><p key={i} className="mt-2">{localize(i+1)}. {l.name} · {localize(l.rating)} PTS · {localize(l.wins)}{localize(" побед")}</p>)}</details>
  </div>;
};
