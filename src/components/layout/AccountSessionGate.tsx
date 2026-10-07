import React,{useEffect,useState} from 'react';
import {getTelegramUser} from '../../utils/telegram';
import {readAccountSave,readResetVersion,applyAccountReset} from '../../utils/accountReset';
import {acceptProgress,acquireProgress,loadProgress,migrateProgress,setProgressStatus,useProgressStatus,retryProgress,confirmedProgress,recoverProgress,progressStatus} from '../../utils/serverProgress';
import {apiRequest} from '../../utils/api';
import type {ProgressEnvelope} from '../../../server/progressStore';
import type {ProgressSave} from '../../../server/progressValidation';

/** No character creation and no offline fallback until an authenticated read succeeds. */
export const AccountSessionGate:React.FC<React.PropsWithChildren>=({children})=>{
 const userId=getTelegramUser().id;
 const [envelope,setEnvelope]=useState<ProgressEnvelope|null>(null);
 const [candidate,setCandidate]=useState<ProgressSave|null>(null);
 const [ready,setReady]=useState(false);
 const [error,setError]=useState('');
 const [revision,setRevision]=useState(0);
 const [notice,setNotice]=useState('');
 const state=useProgressStatus();
 const boot=async()=>{
  setReady(false);setError('');
  try{
   const raw=readAccountSave(userId);
   const local=raw?JSON.parse(raw):null;
   const deviceEpoch=readResetVersion(userId);
   if(local && local.resetVersion===undefined)local.resetVersion=deviceEpoch;
   let remote=await loadProgress();
   if(remote.ownerId!==String(userId))throw new Error('Неверный владелец сохранения.');
   applyAccountReset(userId,remote.resetVersion);
   setEnvelope(remote);
   // A confirmed cache is never an import candidate.
   const localCandidate=local?.player && !Number.isSafeInteger(local.confirmedVersion) && String(local.player.userId)===String(userId)
     && (local.resetVersion ?? 0)===remote.resetVersion ? local : null;
   setCandidate(localCandidate);
   if(!remote.activeHere){
    try{remote=await acquireProgress(remote);setEnvelope(remote);}
    catch(e){setError(e instanceof Error?e.message:String(e));return;}
   }else acceptProgress(remote);
   if(localCandidate){
    localStorage.setItem('aethelgard_migration_backup_'+userId+'_'+Date.now(),raw!);
    setReady(false);return;
   }
   setReady(true);setRevision(v=>v+1);
  }catch(e){setError(e instanceof Error?e.message:String(e));setProgressStatus('offline');}
 };
 useEffect(()=>{
  void boot();
  const reload=(event:Event)=>{const data=(event as CustomEvent<ProgressEnvelope>).detail;setEnvelope(data);setNotice('Сохранение изменилось или активная сессия перенесена. Загружены последние подтверждённые данные.');setRevision(v=>v+1);setReady(data.activeHere);};
  const online=()=>{if(confirmedProgress())void retryProgress();else void boot();};
  const offline=()=>setProgressStatus('offline');
  const reset=()=>void boot();
  const verify=async()=>{
    if(!confirmedProgress() || ['saving','loading','offline'].includes(progressStatus()))return;
    try{const next=await apiRequest<ProgressEnvelope>('/api/progress');const before=confirmedProgress();
      if(before && (next.version!==before.version || next.resetVersion!==before.resetVersion || next.activeHere!==before.activeHere))acceptProgress(next,true);
    }catch{setProgressStatus('offline');}
  };
  const timer=setInterval(()=>{if(document.visibilityState==='visible')void verify();},15000);
  window.addEventListener('focus',verify);
  const visible=()=>{if(document.visibilityState==='visible')void verify();};document.addEventListener('visibilitychange',visible);
  window.addEventListener('aethelgard-progress-reload',reload);window.addEventListener('online',online);window.addEventListener('offline',offline);window.addEventListener('aethelgard-account-reset',reset);
  return()=>{clearInterval(timer);window.removeEventListener('focus',verify);document.removeEventListener('visibilitychange',visible);window.removeEventListener('aethelgard-progress-reload',reload);window.removeEventListener('online',online);window.removeEventListener('offline',offline);window.removeEventListener('aethelgard-account-reset',reset);};
 },[userId]);
 const choose=async(local:boolean)=>{
  try{
   if(local && candidate){const data=await migrateProgress(candidate,Boolean(envelope?.save));setEnvelope(data);}
   else if(envelope)acceptProgress(envelope);
   setCandidate(null);setReady(true);setRevision(v=>v+1);setError('');
  }catch(e){setError(e instanceof Error?e.message:String(e));}
 };
 const transfer=async()=>{
  try{const latest=await loadProgress();const data=await acquireProgress(latest,true);setEnvelope(data);setError('');if(!candidate || data.save){setReady(true);setRevision(v=>v+1);}}
  catch(e){setError(e instanceof Error?e.message:String(e));}
 };
 const panel=(content:React.ReactNode)=><div className="fixed inset-0 z-[100] grid place-items-center bg-slate-950/95 p-6 text-slate-100"><div className="max-w-md space-y-4 text-center" role="status">{content}{error&&<p role="alert">{error}</p>}</div></div>;
 if(envelope && envelope.ownerId!==String(userId))return panel(<p>Загрузка нового аккаунта…</p>);
 if(!ready){
  if(envelope && !envelope.activeHere)return panel(<><p>Персонаж открыт на другом устройстве. Перенос остановит изменения в прежней сессии.</p><button className="rounded bg-amber-700 p-3" onClick={()=>void transfer()}>Перенести активную сессию сюда</button><button className="block w-full p-3" onClick={()=>void boot()}>Обновить данные</button></>);
  if(candidate)return panel(<><p>{envelope?.save?'На устройстве и сервере разные персонажи. Их валюты и предметы не объединяются.':'Найден локальный персонаж. Перед переносом сохранена резервная копия.'}</p><p>Устройство: {candidate.player.name}, ур. {candidate.player.level}</p>{envelope?.save&&<p>Сервер: {envelope.save.player.name}, ур. {envelope.save.player.level}</p>}<button className="rounded bg-amber-700 p-3" disabled={Boolean(envelope?.save&&!envelope.migrationOpen)} onClick={()=>void choose(true)}>Перенести персонажа устройства</button><button className="block w-full p-3" onClick={()=>void choose(false)}>{envelope?.save?'Оставить серверного персонажа':'Создать нового персонажа'}</button>{envelope?.save&&!envelope.migrationOpen&&<p>Однократный перенос уже завершён. Локальная копия сохранена для ручного восстановления администратором.</p>}</>);
  return panel(<><p>Загрузка серверного персонажа…</p>{error&&<button className="rounded bg-amber-700 p-3" onClick={()=>void boot()}>Повторить загрузку</button>}</>);
 }
 return <React.Fragment key={`${userId}:${revision}`}>
  {children}
  <div role="status" className="fixed right-2 bottom-2 z-[80] rounded bg-slate-950/90 px-3 py-1 text-xs text-slate-100">{state==='ready'?'Сохранено на сервере':state==='saving'?'Сохранение…':'Изменения остановлены'}</div>
  {notice&&<div role="alert" className="fixed inset-x-2 top-2 z-[90] rounded bg-amber-950 p-3 text-white">{notice}<button className="ml-3 underline" onClick={()=>setNotice('')}>Понятно</button></div>}
  {['offline','conflict','readonly'].includes(state)&&panel(<><p>{state==='offline'?'Нет подтверждения сервера. Последнее подтверждённое сохранение защищено.':'Сессия или версия сохранения изменилась. Продолжение остановлено.'}</p><button className="rounded bg-amber-700 p-3" onClick={()=>state==='offline'?void recoverProgress().catch(e=>setError(String(e))):void boot()}>Загрузить актуальные данные</button></>)}
 </React.Fragment>;
};
