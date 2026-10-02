import { t as localize, useLocale, intlLocale } from '../../i18n/locale';
import React, { useEffect, useState } from 'react';
import { apiRequest } from '../../utils/api';
import { getTelegramWebApp } from '../../utils/telegram';
const LABELS:Record<string,string>={energy:'Энергия восстановлена',arena:'Билеты арены',mining:'Экспедиция завершена',market:'Покупка ваших вещей',clan:'События клана',pvp:'Результаты PvP',premium:'Статус Premium',referral:'Награда за друга',announcements:'Объявления администрации'};
type Notice={id:number;text:string;read_at:string|null;due_at:string};
export const NotificationsPanel:React.FC=()=>{
  useLocale();
  const [settings,setSettings]=useState<Record<string,boolean>>({});
  const [notices,setNotices]=useState<Notice[]>([]);
  const [referral,setReferral]=useState<{url:string;count:number}|null>(null);
  const [started,setStarted]=useState(false),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  const load=async()=>{
    try{const data=await apiRequest<{settings:Record<string,boolean>;notifications:Notice[];botStarted:boolean}>('/api/notifications');setSettings(data.settings);setNotices(data.notifications);setStarted(data.botStarted);setError('');}
    catch(e){setError(e instanceof Error?e.message:'Ошибка загрузки.');}
    try{setReferral(await apiRequest('/api/referrals'));}catch{/* Notifications work even if getMe is temporarily unavailable. */}
  };
  useEffect(()=>{void load();const timer=setInterval(()=>void load(),30000);return()=>clearInterval(timer);},[]);
  const save=async(next:Record<string,boolean>)=>{
    setBusy(true);try{await apiRequest('/api/notifications/settings',{method:'POST',body:JSON.stringify(next)});setSettings(next);}catch(e){setError(String(e));}finally{setBusy(false);}
  };
  const enable=async()=>{
    const tg=getTelegramWebApp();
    if(tg?.requestWriteAccess) {
      const granted=await new Promise<boolean>(resolve=>tg.requestWriteAccess!(resolve));
      if(!granted){setError('Для сообщений в Telegram разрешите боту писать вам.');return;}
    }
    await save({...settings,enabled:true});
    if(!started && referral?.url){getTelegramWebApp()?.openTelegramLink?.(referral.url.replace(/\?start=.*/, '?start=notifications'));}
  };
  return <section className="ui-panel rounded-xl border p-3 space-y-3">
    <h3 className="font-bold text-sm">{localize("🔔 Оповещения")}</h3>
    {error&&<p role="alert" className="text-xs text-rose-300">{localize(error)}</p>}
    <p className="text-xs text-slate-400">{localize("Уведомления приходят в личный чат игрового бота, даже когда игра закрыта. Под каждым сообщением есть кнопка «⚔️ Играть». Сначала нажмите «Старт» в боте.")}</p>
    <button disabled={busy} onClick={()=>settings.enabled?void save({...settings,enabled:false}):void enable()} className="w-full rounded-lg bg-cyan-950 border p-2 text-xs">{localize(settings.enabled?'Выключить сообщения в Telegram':'Включить сообщения в Telegram')}</button>
    {!started&&<p className="text-xs text-amber-300">{localize("Бот ещё не запущен. После «Старт» нажмите «Обновить».")}</p>}
    <div className="grid grid-cols-2 gap-2">{Object.entries(LABELS).map(([key,label])=><label key={key} className="text-xs text-slate-300 flex gap-2"><input type="checkbox" disabled={busy} checked={settings[key]!==false} onChange={e=>void save({...settings,[key]:e.target.checked})}/>{localize(label)}</label>)}</div>
    <div className="rounded-lg border border-amber-500/30 p-3 space-y-2">
      <p className="text-sm font-bold text-amber-200">{localize("🎁 Приведи друга — Premium на 3 дня обоим")}</p>
      <p className="text-xs text-slate-400">{localize("Новый друг должен зайти по вашей ссылке и достичь 10 уровня. Награда начисляется один раз за друга и продлевает игровой Premium.")}</p>
      {referral&&<><input aria-label={localize("Ссылка для друга")} readOnly value={referral.url} className="w-full rounded bg-slate-950 p-2 text-xs"/><button onClick={()=>{const url='https://t.me/share/url?url='+encodeURIComponent(referral.url)+'&text='+encodeURIComponent(localize('Играй со мной в Аэтельгард! На 10 уровне получим игровой Premium на 3 дня.'));const tg=getTelegramWebApp();if(tg?.openTelegramLink)tg.openTelegramLink(url);else window.open(url,'_blank','noopener,noreferrer');}} className="rounded bg-amber-700 px-3 py-2 text-xs">{localize("Пригласить друга")}</button><p className="text-xs text-slate-400">{localize("Друзей с наградой: ")}{localize(referral.count)}</p></>}
    </div>
    <div className="flex gap-3 text-xs"><button onClick={()=>void load()}>{localize("Обновить")}</button><button onClick={async()=>{try{await apiRequest('/api/notifications/read',{method:'POST',body:'{}'});await load();}catch(e){setError(String(e));}}}>{localize("Прочитать все")}</button></div>
    <div className="space-y-2 max-h-72 overflow-auto">{notices.map(n=><div key={n.id} className={`rounded-lg p-2 text-xs ${n.read_at?'bg-slate-950 text-slate-400':'bg-cyan-950/30 text-slate-100'}`}>{localize(n.text)}<p className="text-[10px] text-slate-500 mt-1">{localize(new Date(n.due_at).toLocaleString(intlLocale()))}</p></div>)}{!notices.length&&<p className="text-xs text-slate-500">{localize("Новых событий пока нет.")}</p>}</div>
  </section>;
};
