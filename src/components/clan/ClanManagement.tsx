import React,{useEffect,useState} from 'react';
import {apiRequest} from '../../utils/api';
import {CLAN_ROLE_LABELS,canAssignRole,canManageMember,type ClanRole} from '../../utils/clanRoles';
type Props={clan:{role?:ClanRole;description:string;recruitment_open?:boolean;min_join_level?:number;level:number;treasury_gold:number};members:{telegram_id:number;display_name:string;role:ClanRole;raid_damage?:number}[];busy:boolean;run:(fn:()=>Promise<unknown>)=>Promise<void>};
export const ClanManagement:React.FC<Props>=({clan,members,busy,run})=>{
 const [description,setDescription]=useState(clan.description),[open,setOpen]=useState(clan.recruitment_open!==false),[level,setLevel]=useState(clan.min_join_level||1);
 const [events,setEvents]=useState<{text:string;created_at:string}[]>([]);
 useEffect(()=>{setDescription(clan.description);setOpen(clan.recruitment_open!==false);setLevel(clan.min_join_level||1);apiRequest<{events:typeof events}>('/api/clan/events').then(r=>setEvents(r.events)).catch(()=>undefined);},[clan]);
 const action=(body:Record<string,unknown>)=>run(()=>apiRequest('/api/clan/manage',{method:'POST',body:JSON.stringify(body)}));
 return <section className="rounded-xl border border-blue-500/30 p-3 space-y-3">
  <h3 className="font-bold text-sm">Устройство клана</h3>
  <p className="text-xs text-slate-400">Глава — руководство и улучшения. Офицер — набор и управление младшими ролями. Казначей — склад и распределение вещей. Ветеран и участник — рейды, чат и вклады. Новичок — испытательный срок, доступ к рейдам и вкладам. Забрать или обработать общий склад могут только глава, офицер и казначей.</p>
  <p className="text-xs text-slate-400">В рейде доступен один удар в сутки. Победа даёт опыт и золото в казну; каждые 1000 XP повышают уровень клана и вместимость. Максимум 15 уровней и 50 участников.</p>
  {['owner','officer'].includes(clan.role||'')&&<div className="space-y-2">
   <textarea aria-label="Правила клана" value={description} maxLength={280} onChange={e=>setDescription(e.target.value)} className="w-full p-2 rounded bg-slate-950 text-xs"/>
   <label className="text-xs flex gap-2"><input type="checkbox" checked={open} onChange={e=>setOpen(e.target.checked)}/>Открытый набор</label>
   <label className="text-xs">Минимальный уровень <input type="number" min={1} max={120} value={level} onChange={e=>setLevel(Number(e.target.value))} className="w-20 p-2 rounded bg-slate-950"/></label>
   <button disabled={busy} onClick={()=>void action({action:'settings',description,open,minLevel:level})} className="block p-2 rounded bg-blue-900 text-xs">Сохранить правила</button>
  </div>}
  {clan.role==='owner'&&<button disabled={busy||clan.level>=15||Number(clan.treasury_gold)<1000*clan.level} onClick={()=>{if(window.confirm(`Потратить ${1000*clan.level} золота казны на улучшение клана?`))void action({action:'upgrade'});}} className="text-xs p-2 rounded bg-amber-900 disabled:opacity-40">Улучшить клан · {1000*clan.level} золота казны</button>}
  <div className="space-y-2">{members.map(m=><div key={m.telegram_id} className="rounded-lg bg-slate-950 p-2 space-y-2 text-xs"><div><b>{m.display_name}</b> · {CLAN_ROLE_LABELS[m.role]} · урон рейдам: {m.raid_damage||0}</div>
    {canManageMember(clan.role||'',m.role)&&<div className="flex flex-wrap gap-2"><select aria-label={`Роль ${m.display_name}`} disabled={busy} value={m.role} onChange={e=>void action({action:'role',targetId:m.telegram_id,role:e.target.value})} className="bg-slate-900 rounded p-1">{Object.entries(CLAN_ROLE_LABELS).filter(([role])=>canAssignRole(clan.role||'',m.role,role)).map(([role,label])=><option key={role} value={role}>{label}</option>)}</select><button disabled={busy} onClick={()=>{if(window.confirm(`Исключить ${m.display_name}?`))void action({action:'kick',targetId:m.telegram_id});}} className="text-rose-300">Исключить</button>{clan.role==='owner'&&<button disabled={busy} onClick={()=>{if(window.confirm(`Передать руководство ${m.display_name}? Вы станете офицером.`))void action({action:'transfer',targetId:m.telegram_id});}} className="text-amber-300">Сделать главой</button>}</div>}
  </div>)}</div>
  <details className="text-xs"><summary>Журнал управления</summary><div className="space-y-1 max-h-48 overflow-auto mt-2">{events.map((e,i)=><p key={i} className="text-slate-400">{new Date(e.created_at).toLocaleString()} · {e.text}</p>)}{!events.length&&<p>Событий пока нет.</p>}</div></details>
 </section>;
};
