import {canonicalJson} from './canonicalJson';
import { createOperationId } from './operationId';
import { gameSaveKey, readResetVersion, resetVersionKey,applyAccountReset } from './accountReset';
import { apiRequest } from './api';
import { getTelegramUser } from './telegram';
import { useSyncExternalStore } from 'react';
import type { ProgressEnvelope } from '../../server/progressStore';
import type { ProgressSave } from '../../server/progressValidation';
export type ProgressStatus = 'loading'|'ready'|'saving'|'offline'|'conflict'|'readonly';
let status:ProgressStatus='loading';
let current:ProgressEnvelope|null=null;
let pending: null | {operationId:string;expectedVersion:number;resetVersion:number;save:ProgressSave;mode:string}=null;
let queued: ProgressSave|null=null;
let running:Promise<void>|null=null;
let lastFingerprint='';
let remoteOperations=0;
export function beginRemoteProgress(){remoteOperations++;setProgressStatus('saving');let done=false;return()=>{if(done)return;done=true;remoteOperations--;if(!remoteOperations&&!pending&&!queued&&status==='saving')setProgressStatus('ready');};}
const listeners=new Set<()=>void>();
const notify=()=>listeners.forEach(f=>f());
export const progressStatus=()=>status;
export const useProgressStatus=()=>useSyncExternalStore(f=>{listeners.add(f);return()=>{listeners.delete(f);};},progressStatus,()=> 'loading' as ProgressStatus);
export function setProgressStatus(next:ProgressStatus) {status=next;notify();}
export function progressSessionToken() {
  const key='aethelgard_writer_'+getTelegramUser().id;
  let token=sessionStorage.getItem(key);
  if(!token){token=createOperationId();sessionStorage.setItem(key,token);}
  return token;
}
export const confirmedProgress=()=>current;
export function acceptProgress(envelope:ProgressEnvelope, reload=false) {
  if(String(envelope?.ownerId)!==String(getTelegramUser().id) || !Number.isSafeInteger(envelope.version) || !Number.isSafeInteger(envelope.resetVersion))throw new Error('Сервер вернул сохранение другого аккаунта.');
  applyAccountReset(envelope.ownerId,envelope.resetVersion);
  current=envelope;pending=null;queued=null;
  localStorage.setItem(resetVersionKey(envelope.ownerId),String(envelope.resetVersion));
  if(envelope.save)localStorage.setItem(gameSaveKey(envelope.ownerId),JSON.stringify({...envelope.save,confirmedVersion:envelope.version}));
  else localStorage.removeItem(gameSaveKey(envelope.ownerId));
  lastFingerprint=envelope.save ? fingerprint(envelope.save) : '';
  setProgressStatus(envelope.activeHere?'ready':'readonly');
  if(reload)window.dispatchEvent(new CustomEvent('aethelgard-progress-reload',{detail:envelope}));
}
function fingerprint(save:ProgressSave) {
  const p:Record<string,any>={...save.player};delete p.lastActiveTimestamp;delete p.marketGold;delete p.clanId;
  p.inventory=p.inventory.filter((i:any)=>!i.serverOwned);
  p.equipped=Object.fromEntries(Object.entries(p.equipped).filter(([,i])=>!(i as any)?.serverOwned));
  return canonicalJson({...save,player:p});
}
export async function loadProgress() {
  setProgressStatus('loading');
  const data=await apiRequest<ProgressEnvelope>('/api/progress',{signal:AbortSignal.timeout(15000)});
  return data;
}
export async function acquireProgress(envelope:ProgressEnvelope,transfer=false) {
  const data=await apiRequest<ProgressEnvelope>('/api/progress/session',{method:'POST',body:JSON.stringify({expectedGeneration:envelope.sessionGeneration,transfer})});
  acceptProgress(data);return data;
}
export async function migrateProgress(save:ProgressSave,replaceExisting=false) {
  if(!current)throw new Error('Дождитесь загрузки сервера.');
  const data=await apiRequest<ProgressEnvelope>('/api/progress/migrate',{method:'POST',body:JSON.stringify({operationId:createOperationId(),expectedVersion:current.version,resetVersion:current.resetVersion,save,replaceExisting})});
  acceptProgress(data);return data;
}
/** One request in flight. Lost responses retain the exact same operation ID and payload. */
export function queueProgress(save:ProgressSave) {
  if(remoteOperations || !current?.activeHere || save.resetVersion!==current.resetVersion || String(save.player.userId)!==current.ownerId || ['conflict','readonly','loading'].includes(status))return;
  if(!pending && fingerprint(save)===lastFingerprint)return;
  queued=structuredClone(save);
  void drain();
}
async function drain() {
  if(running)return running;
  running=(async()=>{
    while(current?.activeHere && (pending || queued)) {
      if(!pending){const save=queued!;queued=null;pending={operationId:createOperationId(),expectedVersion:current.version,resetVersion:current.resetVersion,save,mode:current.save?'checkpoint':'create'};}
      setProgressStatus('saving');
      try {
        const sent=pending;
        const data=await apiRequest<ProgressEnvelope>('/api/progress/'+sent.mode,{method:'POST',body:JSON.stringify(sent),signal:AbortSignal.timeout(15000)});
        const nextQueued=queued;
        acceptProgress(data);
        // An older replay returns the current server version; discard speculative descendants.
        if(data.version!==sent.expectedVersion+1){acceptProgress(data,true);return;}
        if(nextQueued && fingerprint(nextQueued)!==lastFingerprint)queued=nextQueued;
      } catch(error) {
        if(status!=='conflict' && status!=='readonly')setProgressStatus('offline');
        return;
      }
    }
  })().finally(()=>{running=null;});
  return running;
}
export const retryProgress=()=>drain();
export function handleProgressConflict(envelope:ProgressEnvelope,code:string) {
  pending=null;queued=null;
  acceptProgress(envelope,true);
  setProgressStatus(code==='SESSION_LOST'?'readonly':'conflict');
}
export async function waitForProgress() {
  await drain();
  if(pending || queued || status!=='ready')throw new Error('Прогресс ещё не подтверждён сервером. Дождитесь сохранения.');
}
export const canChangeProgress=()=>status==='ready' && navigator.onLine;

export async function recoverProgress() {
  if(pending){await drain();if(pending)return;}
  const key='aethelgard_rpc_pending_'+getTelegramUser().id;
  let rpc:any;try{rpc=JSON.parse(localStorage.getItem(key)||'null');}catch{localStorage.removeItem(key);}
  if(rpc){
    const result=await apiRequest<{completed:boolean;latest:ProgressEnvelope}>('/api/progress/operations/'+rpc.operationId);
    if(result.completed){localStorage.removeItem(key);acceptProgress(result.latest,true);return;}
    acceptProgress(result.latest);
    const request=JSON.parse(rpc.request);
    await apiRequest(request.path,{method:'POST',body:request.body});
    return;
  }
  const latest=await apiRequest<ProgressEnvelope>('/api/progress');acceptProgress(latest,true);
}
