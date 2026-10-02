import { createOperationId } from '../../../../utils/operationId';
import React,{useEffect,useState} from 'react';
import {apiRequest} from '../../../../utils/api';
import {useGame} from '../../../../context/GameContext';
import {STANCE_LABELS,PVP_CLASS_NAMES,type PvpStance} from '../../../../utils/pvp';
import { RpgIcon } from '../ui/RpgIcon';
import { BestiaryPanel, RpgButton } from '../ui/BestiaryUI';
type Result={matchId:string;winner:string;attackerName:string;defenderName:string;attackerRating:number;delta:number;log:string[]};
type Data={profile:{enrolled:boolean;stance:PvpStance;rating:number;tickets:number;wins:number;losses:number};opponents:{telegram_id:string;name:string;rating:number;class_id:string;stance:PvpStance}[];history:{id:string;attacker:string;result:Result}[];resetAt:string;leaders:{name:string;rating:number;wins:number}[]};
export const PvpArena:React.FC=()=>{
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
    <BestiaryPanel className="space-y-2 p-3"><h3 className="flex items-center gap-2 font-bold"><RpgIcon kind="arena" size={19}/> PvP — дуэли игроков</h3><p className="text-xs text-slate-400">Асинхронный бой с настоящим игроком. Уровни и снаряжение уравнены; класс и тактика влияют на исход. HP вне арены не расходуется. Без зелий и автобоя.</p><p className="text-xs text-slate-400">5 попыток в день, отдых 1 минута. Один бой с парой за 24 часа. Соклановцы исключены. Рейтинг Elo меняется у обоих; награда — рейтинг и место в таблице PvP.</p><p className="text-xs text-slate-400">Натиск сильнее обороны, оборона сильнее контроля, контроль сильнее натиска. Каждый третий ход — классовый приём. До 30 раундов, затем победа по доле оставшегося HP.</p>
    <details className="text-xs text-slate-400"><summary className="min-h-11 cursor-pointer py-3">Приёмы и особенности классов</summary><p className="mt-2">Воин и рыцарь получают щит; воин пробивает броню. Берсерк усиливает удар при низком HP. Разбойник чаще уклоняется. Убийца пробивает броню и усиливает третий удар. Лучник чаще критует и уклоняется. Маг пробивает броню заклинанием. Некромант восстанавливает 12% нанесённого урона. Паладин и друид лечатся на каждом третьем ходу.</p></details>
    {data&&<><p className="text-sm text-amber-200">Рейтинг: {data.profile.rating} · {data.profile.wins} побед / {data.profile.losses} поражений</p><p className="text-xs">Попытки: {data.profile.tickets}/5 · восстановление {new Date(data.resetAt).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</p><label className="block text-xs">Тактика<select value={stance} disabled={busy} onChange={e=>setStance(e.target.value as PvpStance)} className="ml-2 min-h-11 rounded border border-slate-700 bg-slate-950 p-2">{Object.entries(STANCE_LABELS).map(([key,name])=><option key={key} value={key}>{name}</option>)}</select></label><div className="flex gap-2"><RpgButton variant="primary" disabled={busy} onClick={()=>void enroll()}>{data.profile.enrolled?'Отключить участие':'Участвовать в PvP'}</RpgButton>{data.profile.enrolled&&<RpgButton variant="secondary" disabled={busy} onClick={async()=>{setBusy(true);try{await apiRequest('/api/pvp/enroll',{method:'POST',body:JSON.stringify({stance,enrolled:true})});await load();}catch(e){setError(String(e));}finally{setBusy(false);}}}>Сохранить тактику</RpgButton>}</div></>}
    </BestiaryPanel>
    {error&&<p role="alert" className="text-xs text-rose-300">{error}</p>}
    <RpgButton variant="secondary" disabled={busy} onClick={()=>void load()}>Обновить соперников</RpgButton>
    {data?.opponents.map(o=><BestiaryPanel key={o.telegram_id} className="flex items-center gap-2 p-3"><div className="flex-1 text-xs"><b>{o.name}</b><p>{o.rating} PTS · {PVP_CLASS_NAMES[o.class_id] || o.class_id} · {STANCE_LABELS[o.stance]}</p></div><RpgButton variant="primary" disabled={busy||!data.profile.enrolled||data.profile.tickets<1} onClick={()=>void fight(o.telegram_id)}>Дуэль</RpgButton></BestiaryPanel>)}
    {data&&!data.opponents.length&&<p className="text-xs text-slate-400">Пока нет подходящих участников. Игроки появятся, когда включат участие в PvP.</p>}
    {result&&<BestiaryPanel className="space-y-2 p-3 text-xs"><b>{result.winner==='draw'?'Ничья':result.winner==='attacker'?'Победа!':'Поражение'} · {result.delta>0?'+':''}{result.delta} PTS</b><p>{result.attackerName} против {result.defenderName}</p><details><summary className="min-h-11 cursor-pointer py-3">Ход боя</summary><div className="max-h-64 space-y-1 overflow-auto">{result.log.map((line,i)=><p key={i}>{line}</p>)}</div></details></BestiaryPanel>}
    <BestiaryPanel className="space-y-2 p-3"><h4 className="text-xs font-bold">История дуэлей</h4>{data?.history.map(h=><button key={h.id} onClick={()=>setResult(h.result)} className="block min-h-11 text-left text-xs text-slate-400">{h.result.attackerName} — {h.result.defenderName} · {h.result.winner==='draw'?'ничья':h.result.winner==='attacker'?h.result.attackerName:h.result.defenderName}</button>)}</BestiaryPanel>
    <details className="leather-panel p-3 text-xs"><summary className="min-h-11 cursor-pointer py-3">Рейтинг PvP</summary>{data?.leaders.map((l,i)=><p key={i} className="mt-2">{i+1}. {l.name} · {l.rating} PTS · {l.wins} побед</p>)}</details>
  </div>;
};
