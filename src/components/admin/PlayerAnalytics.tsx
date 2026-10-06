import { SelectionField } from '../ui/SelectionField';
import React,{useEffect,useState} from 'react';
import {apiRequest} from '../../utils/api';
import {t,useLocale,intlLocale} from '../../i18n/locale';
import {CLASSES,MONSTERS} from '../../data/gameData';
import type {CharacterClassId} from '../../types/game';

type PlayerRow={telegram_id:string;name:string;class_id:CharacterClassId;last_level:number;reached_level:number;sessions:number;active_ms:string;last_seen:string;first_seen:string;last_screen:string|null;last_state:string|null;energy:number|null;last_outcome:string|null;last_monster:string|null;preferred_interface:string|null;preferred_language:string|null;};
type Report={summary:{players:number;newcomers:number;returned:number;inactive_24h:number;stopped_early:number;first_minutes:string|null;total_minutes:string|null;collecting_since:string|null};
 funnel:Array<{level:number;eligible:number;reached:number;inactive_here:number}>;milestones:Array<{level:number;samples:number;minutes:string}>;
 interfaceUsage:Array<{interface_style:string|null;players:number}>;languageUsage:Array<{language:string|null;players:number}>;
 battles:Array<{level:number;battles:number;defeats:number;flees:number;seconds:string;rounds:string;exp:string}>;players:PlayerRow[];
 classes:Array<{class_id:CharacterClassId;players:number;level4:number;inactive_early:number}>};
const interfaces:Record<string,string>={modern:'Современный',fantasy:'Фэнтези','fantasy-beta':'Фэнтези — бета'};
const languages:Record<string,string>={ru:'Русский',uk:'Українська'};
const screens:Record<string,string>={hunter:'Охота',world:'Мир',character:'Герой',inventory:'Сумка',arena:'Арена',mine:'Шахта',fishing:'Рыбалка',alchemy:'Алхимия',blacksmith:'Кузница',crafting:'Ремесло',clan:'Клан',chat:'Чат',more:'Ещё',pets:'Питомцы',market:'Рынок',leaderboard:'Рейтинг'};
const states:Record<string,string>={idle:'Вне боя',combat:'Бой не завершён',victory:'Победа',defeat:'Поражение',flee:'Побег',dungeon:'Пещера'};
export function PlayerAnalytics(){
 useLocale();const [days,setDays]=useState(30),[data,setData]=useState<Report|null>(null),[error,setError]=useState(''),[version,setVersion]=useState(0),[busy,setBusy]=useState(false);
 useEffect(()=>{let active=true;setBusy(true);setError('');setData(null);
  apiRequest<Report>(`/api/admin/player-analytics?days=${days}`).then(r=>{if(active)setData(r);}).catch(e=>{if(active)setError(String(e));}).finally(()=>{if(active)setBusy(false);});
  return()=>{active=false;};
 },[days,version]);
 const pct=(n:number,total:number)=>total?`${(100*n/total).toFixed(0)}%`:'—';
 const when=(date:string)=>new Date(date).toLocaleString(intlLocale(),{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
 return <section className="rounded-xl border border-amber-700/50 p-3 space-y-3 text-xs" aria-label={t('Статистика игроков')}>
  <div className="flex flex-wrap gap-2 items-center justify-between"><h3 className="text-amber-200 font-bold">{t('Первые уровни и возвращаемость')}</h3>
   <div className="flex gap-2"><SelectionField aria-label={t('Период статистики')} value={days} onChange={e=>setDays(Number(e.target.value))} className="bg-slate-950 rounded p-2">{[7,30,90].map(n=><option key={n} value={n}>{n} {t('дней')}</option>)}</SelectionField>
   <button disabled={busy} onClick={()=>setVersion(v=>v+1)}>{t('Обновить')}</button></div></div>
  <p className="text-slate-400">{t('Период отбора — первый зафиксированный вход. Воронка считает только начавших с 1 уровня. Нет входа 24 часа — признак неактивности, а не доказательство ухода. История до начала сбора недоступна.')}</p>
  <p className="text-slate-400">{t('Ваш аккаунт администратора исключён из этой статистики.')}</p>
  {busy&&<p role="status">{t('Загрузка…')}</p>}{error&&<p role="alert">{error}</p>}
  {data&&<>
   <div className="grid grid-cols-2 gap-2">{[
    ['Наблюдаемых игроков',data.summary.players],['Новичков с 1 уровня',data.summary.newcomers],['Больше одной сессии',`${data.summary.returned} / ${data.summary.players}`],['Нет активности 24 ч',data.summary.inactive_24h],['Неактивны на ур. 1–3',data.summary.stopped_early],['Первая сессия, мин',data.summary.first_minutes??'—']
   ].map(([label,value])=><div key={label} className="rounded border border-slate-700 p-2"><div className="text-slate-400">{t(label)}</div><strong className="text-lg">{value}</strong></div>)}</div>
   <h4 className="font-bold text-amber-200">{t('Интерфейсы и языки игроков')}</h4>
   <p className="text-slate-400">{t('Последние сохранённые настройки игроков из выбранной выборки. Нет данных — игрок ещё не передал настройку.')}</p>
   <div className="grid grid-cols-2 gap-2">
    <div className="rounded border border-slate-700 p-2"><strong>{t('Интерфейс')}</strong>{(data.interfaceUsage||[]).map(row=><p key={row.interface_style||'unknown'}>{t(interfaces[row.interface_style||'']||'Нет данных')}: {row.players} ({pct(row.players,data.summary.players)})</p>)}</div>
    <div className="rounded border border-slate-700 p-2"><strong>{t('Язык')}</strong>{(data.languageUsage||[]).map(row=><p key={row.language||'unknown'}>{t(languages[row.language||'']||'Нет данных')}: {row.players} ({pct(row.players,data.summary.players)})</p>)}</div>
   </div>
   {data.summary.collecting_since&&<p className="text-slate-400">{t('Первое наблюдение в выборке')}: {when(data.summary.collecting_since)}</p>}
   <h4 className="font-bold text-amber-200">{t('Воронка уровней')}</h4>
   <div className="overflow-x-auto"><table className="w-full text-left"><thead><tr>{['Уровень','Дошли','Доля новичков','Неактивны здесь','Минут до уровня'].map(x=><th key={x} className="p-1">{t(x)}</th>)}</tr></thead><tbody>
    {data.funnel.map(row=>{const m=data.milestones.find(x=>x.level===row.level);return <tr key={row.level} className="border-t border-slate-800"><td className="p-1">{row.level}</td><td>{row.reached}/{row.eligible}</td><td>{pct(row.reached,row.eligible)}</td><td>{row.inactive_here}</td><td>{m?`${m.minutes} (n=${m.samples})`:'—'}</td></tr>;})}
   </tbody></table></div>
   <p className="text-slate-400">{t('Минуты — активное время в игре, без фона. Сессия начинается при открытии или возвращении после 30 минут вне игры. Последнее действие сохраняется каждые 20 секунд; причина ухода неизвестна.')}</p>
   <h4 className="font-bold text-amber-200">{t('Бои на первых уровнях')}</h4>
   <div className="overflow-x-auto"><table className="w-full text-left"><thead><tr>{['Уровень','Бои','Поражения','Побеги','Сек.','Ходы','XP'].map(x=><th key={x} className="p-1">{t(x)}</th>)}</tr></thead><tbody>{data.battles.map(row=><tr key={row.level} className="border-t border-slate-800"><td className="p-1">{row.level}</td><td>{row.battles}</td><td>{row.defeats} ({pct(row.defeats,row.battles)})</td><td>{row.flees}</td><td>{row.seconds}</td><td>{row.rounds}</td><td>{row.exp}</td></tr>)}</tbody></table></div>
   <h4 className="font-bold text-amber-200">{t('Новички по классам')}</h4>
   {data.classes.map(row=><p key={row.class_id}>{t(CLASSES[row.class_id]?.name||row.class_id)}: {row.players} · {t('Дошли до ур. 4')}: {row.level4} · {t('Неактивны на ур. 1–3')}: {row.inactive_early}</p>)}
   <details><summary className="font-bold text-amber-200 cursor-pointer">{t('Последние 50 игроков')}</summary><div className="mt-2 space-y-2">
   {!data.players.length&&<p>{t('Данные появятся после новых входов игроков.')}</p>}
   {data.players.map(p=><div key={p.telegram_id} className="border border-slate-700 rounded p-2 space-y-1">
    <p className="font-bold">{p.name||p.telegram_id} · {t(CLASSES[p.class_id]?.name||p.class_id)} · {t('Уровень')} {p.last_level} ({t('макс.')}: {p.reached_level})</p>
    <p>{t('Интерфейс')}: {t(interfaces[p.preferred_interface||'']||'Нет данных')} · {t('Язык')}: {t(languages[p.preferred_language||'']||'Нет данных')}</p>
    <p>{t('Сессий')}: {p.sessions} · {t('Активных минут')}: {(Number(p.active_ms)/60000).toFixed(1)} · {t('Последняя активность')}: {when(p.last_seen)}</p>
    <p>{t('Последний экран')}: {t(screens[p.last_screen||'']||'Нет данных')} · {t(states[p.last_state||'']||'Нет данных')} · {t('Энергия')}: {p.energy??'—'}</p>
    {p.last_outcome&&<p>{t('Последний бой')}: {t(MONSTERS[p.last_monster||'']?.name||p.last_monster||'—')} · {t(states[p.last_outcome]||p.last_outcome)}</p>}
   </div>)}
   </div></details>
  </>}
 </section>;
}
