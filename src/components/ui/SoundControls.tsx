import React,{useState,useSyncExternalStore} from 'react';
import {sound} from '../../utils/audio';
import {t,useLocale} from '../../i18n/locale';

export function SoundControls(){
 useLocale();const muted=useSyncExternalStore(sound.subscribe,()=>sound.getIsMuted(),()=>false);
 const [result,setResult]=useState<boolean|null>(null),[busy,setBusy]=useState(false);
 return <section className="ui-panel rounded-lg border border-current/20 p-2 space-y-2 text-xs">
  <div className="flex flex-wrap gap-2 items-center justify-between">
   <button className="min-h-10 px-2" aria-pressed={!muted} onClick={()=>{sound.toggleMute();setResult(null);}}>{t(muted?'Звук: выключен':'Звук: включён')}</button>
   <button className="min-h-10 px-2 underline" disabled={busy} onClick={()=>{setBusy(true);setResult(null);void sound.testSound().then(setResult).finally(()=>setBusy(false));}}>{t('Проверить звук')}</button>
  </div>
  {result!==null&&<p role="status">{t(result?'Проверочный звук запущен. Если его не слышно, проверьте громкость мультимедиа телефона.':'Звук не запустился. Нажмите проверку ещё раз после открытия игры.')}</p>}
 </section>;
}
