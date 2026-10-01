import React,{useEffect,useState} from 'react';
import {apiRequest} from '../../utils/api';
import {getTelegramUser} from '../../utils/telegram';
import {BROADCAST_AUDIENCES,NOTIFICATION_TEMPLATES,renderBroadcast,type BroadcastAudience} from '../../utils/notificationTemplates';
type BroadcastRequest={operationId:string;templateId:string;audience:BroadcastAudience;details:string};
type Summary={audiences:Record<BroadcastAudience,{players:number;telegram:number}>;recent:{id:string;template_id:string;audience:BroadcastAudience;players_count:number;telegram_count:number;created_at:string}[]};
export const AdminBroadcasts:React.FC=()=>{
 const [templateId,setTemplateId]=useState<string>('update'),[audience,setAudience]=useState<BroadcastAudience>('all'),[details,setDetails]=useState('');
 const [summary,setSummary]=useState<Summary|null>(null),[preview,setPreview]=useState<BroadcastRequest|null>(null),[busy,setBusy]=useState(false),[feedback,setFeedback]=useState('');
 const key='aethelgard_admin_broadcast_'+getTelegramUser().id;
 const load=async()=>{try{setSummary(await apiRequest<Summary>('/api/admin/broadcasts'));}catch(e){setFeedback(String(e));}};
 useEffect(()=>{void load();try{const pending=JSON.parse(localStorage.getItem(key)||'null');if(pending)setPreview(pending);}catch{localStorage.removeItem(key);}},[key]);
 const openPreview=()=>{setFeedback('');setPreview({operationId:crypto.randomUUID(),templateId,audience,details});};
 const send=async()=>{
  if(!preview||busy)return;setBusy(true);setFeedback('');localStorage.setItem(key,JSON.stringify(preview));
  try{
   const result=await apiRequest<{players:number;telegram:number;replayed:boolean}>('/api/admin/broadcasts',{method:'POST',body:JSON.stringify(preview)});
   localStorage.removeItem(key);setPreview(null);
   setFeedback(`Объявление добавлено в игру для ${result.players} игроков. В очередь Telegram: ${result.telegram}.${result.replayed?' Повтор подтверждён, второй рассылки нет.':''}`);
   await load();
  }catch(e){setFeedback(String(e));}finally{setBusy(false);}
 };
 const pending=!!localStorage.getItem(key);
 return <section className="rounded-xl border border-purple-500/40 p-3 space-y-3">
  <h3 className="text-xs font-bold text-purple-200">📢 Оповещения по шаблону</h3>
  <p className="text-[11px] text-slate-400">В игре объявление увидит вся выбранная аудитория. В Telegram оно придёт тем, кто запустил бота, включил сообщения и разрешил объявления администрации.</p>
  {feedback&&<p role="status" className="rounded-lg bg-slate-950 p-2 text-xs text-purple-200">{feedback}</p>}
  <label className="block text-xs text-slate-300">Готовый шаблон<select aria-label="Шаблон оповещения" value={templateId} disabled={busy||pending} onChange={e=>setTemplateId(e.target.value)} className="w-full mt-1 rounded-lg bg-slate-950 p-2">{NOTIFICATION_TEMPLATES.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
  <label className="block text-xs text-slate-300">Кому<select aria-label="Аудитория оповещения" value={audience} disabled={busy||pending} onChange={e=>setAudience(e.target.value as BroadcastAudience)} className="w-full mt-1 rounded-lg bg-slate-950 p-2">{Object.entries(BROADCAST_AUDIENCES).map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label>
  <p className="text-xs text-slate-400">{summary?`В игре: ${summary.audiences[audience].players} · Telegram: ${summary.audiences[audience].telegram}`:'Загружаю количество получателей…'}</p>
  <label className="block text-xs text-slate-300">Дополнение — необязательно<textarea aria-label="Дополнение к оповещению" value={details} disabled={busy||pending} maxLength={1000} onChange={e=>setDetails(e.target.value)} placeholder="Например, время техработ. Можно оставить пустым." rows={2} className="w-full mt-1 rounded-lg bg-slate-950 p-2"/></label>
  <div className="rounded-lg bg-slate-950 p-3 text-xs text-slate-300 whitespace-pre-wrap">{renderBroadcast(templateId,details)}</div>
  <div className="flex gap-2"><button disabled={busy||!summary||pending} onClick={openPreview} className="rounded-lg bg-purple-700 p-2 text-xs disabled:opacity-40">Предпросмотр</button><button disabled={busy} onClick={()=>void load()} className="rounded-lg bg-slate-800 p-2 text-xs">Обновить аудиторию</button></div>
  {summary?.recent.length? <details className="text-xs text-slate-400"><summary>Последние рассылки</summary>{summary.recent.map(b=><p key={b.id} className="mt-2">{new Date(b.created_at).toLocaleString()} · {NOTIFICATION_TEMPLATES.find(t=>t.id===b.template_id)?.name || b.template_id} · {BROADCAST_AUDIENCES[b.audience]} · игра {b.players_count}, очередь Telegram {b.telegram_count}</p>)}</details>:null}
  {preview&&<div role="dialog" aria-modal="true" aria-label="Подтвердить оповещение" className="fixed inset-0 z-[60] bg-black/90 flex items-center justify-center p-4"><div className="w-full max-w-md rounded-xl bg-[#0c0d1c] border border-purple-500/50 p-4 space-y-3 max-h-[90vh] overflow-auto">
   <h4 className="text-sm font-bold text-purple-200">Предпросмотр рассылки</h4>
   <p className="text-xs">Аудитория: {BROADCAST_AUDIENCES[preview.audience]}</p>
   <p className="text-xs text-slate-400">{summary?`В игре: ${summary.audiences[preview.audience].players} · Telegram: ${summary.audiences[preview.audience].telegram}`:'Количество получателей уточнится при отправке.'}</p>
   <div className="rounded-lg bg-slate-950 p-3 text-xs whitespace-pre-wrap">{renderBroadcast(preview.templateId,preview.details)}{preview.templateId==='referral'?'\n\nКаждый игрок получит свою ссылку для приглашения друга.':''}</div>
   {feedback&&<p role="alert" className="text-xs text-amber-200">{feedback}</p>}
   {pending&&<p className="text-xs text-amber-200">Отправка ещё не подтверждена. Повторить можно безопасно: второй рассылки не будет.</p>}
   <div className="flex gap-2"><button disabled={busy||!summary} onClick={()=>void send()} className="flex-1 rounded-lg bg-purple-700 p-3 text-xs disabled:opacity-40">{busy?'Постановка в очередь…':pending?'Повторить отправку':'Отправить оповещение'}</button><button disabled={busy||pending} onClick={()=>setPreview(null)} className="rounded-lg bg-slate-800 p-3 text-xs disabled:opacity-40">Отмена</button></div>
  </div></div>}
 </section>;
};
