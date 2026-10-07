import {migrationCandidateKey,readMigrationCandidate} from './migrationCandidate';
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
/** Request identity also detects a save starting while a background GET is in flight. */
export const captureProgressRequest=()=>({owner:String(getTelegramUser().id),token:progressSessionToken(),current,pending,queued});
export const isProgressRequestCurrent=(request:ReturnType<typeof captureProgressRequest>)=>request.owner===String(getTelegramUser().id)&&request.token===progressSessionToken()&&request.current===current&&request.pending===pending&&request.queued===queued;
export function acceptProgress(envelope:ProgressEnvelope, reload=false) {
  if(String(envelope?.ownerId)!==String(getTelegramUser().id))return false;
  if(![envelope.version,envelope.resetVersion,envelope.sessionGeneration].every(n=>Number.isSafeInteger(n)&&n>=0))throw new Error('Некорректная версия серверного сохранения.');
  if(envelope.resetVersion<readResetVersion(envelope.ownerId))return false;
  const before=current?.ownerId===envelope.ownerId?current:null;
  if(before && (envelope.resetVersion<before.resetVersion || envelope.resetVersion===before.resetVersion && (envelope.version<before.version || envelope.sessionGeneration<before.sessionGeneration)))return false;
  const superseded=current && current.ownerId!==envelope.ownerId || before && (envelope.resetVersion>before.resetVersion || envelope.sessionGeneration>before.sessionGeneration);
  if(superseded){pending=null;queued=null;}
  applyAccountReset(envelope.ownerId,envelope.resetVersion);
  current=envelope;
  localStorage.setItem(resetVersionKey(envelope.ownerId),String(envelope.resetVersion));
  if(envelope.save)localStorage.setItem(gameSaveKey(envelope.ownerId),JSON.stringify({...envelope.save,confirmedVersion:envelope.version}));
  else localStorage.removeItem(gameSaveKey(envelope.ownerId));
  lastFingerprint=envelope.save ? fingerprint(envelope.save) : '';
  setProgressStatus(envelope.activeHere?(pending||queued||remoteOperations?'saving':'ready'):'readonly');
  if(reload)window.dispatchEvent(new CustomEvent('aethelgard-progress-reload',{detail:envelope}));
  return true;
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
  if(!acceptProgress(data))throw new Error('Ответ получения сессии устарел.');return data;
}
export async function migrateProgress(save:ProgressSave,replaceExisting=false) {
  if(!current)throw new Error('Дождитесь загрузки сервера.');
  const record=readMigrationCandidate(current.ownerId,current.resetVersion);
  // Preserve the exact migration request across a lost response and a full restart.
  const request=record?.request??{operationId:createOperationId(),expectedVersion:current.version,resetVersion:current.resetVersion,save,replaceExisting};
  if(record)localStorage.setItem(migrationCandidateKey(current.ownerId,current.resetVersion),JSON.stringify({...record,request}));
  const data=await apiRequest<ProgressEnvelope>('/api/progress/migrate',{method:'POST',body:JSON.stringify(request)});
  if(!acceptProgress(data))throw new Error('Ответ переноса устарел. Загрузите актуальные данные.');return data;
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
      const sent=pending;
      try {
        const data=await apiRequest<ProgressEnvelope>('/api/progress/'+sent.mode,{method:'POST',body:JSON.stringify(sent),signal:AbortSignal.timeout(15000)});
        if(pending!==sent)return;
        if(!acceptProgress(data)){if(status==='saving')setProgressStatus('offline');return;}
        pending=null;
        const nextQueued=queued;
        // An older replay returns the current server version; discard speculative descendants.
        if(data.version!==sent.expectedVersion+1){queued=null;acceptProgress(data,true);return;}
        queued=nextQueued && fingerprint(nextQueued)!==lastFingerprint?nextQueued:null;
        if(!queued)setProgressStatus('ready');
      } catch(error) {
        if(pending!==sent)return;
        if(status!=='conflict' && status!=='readonly')setProgressStatus('offline');
        return;
      }
    }
  })().finally(()=>{running=null;if(queued&&['ready','saving'].includes(status))void drain();});
  return running;
}
export const retryProgress=()=>drain();
export function handleProgressConflict(envelope:ProgressEnvelope,code:string) {
  if(!acceptProgress(envelope,true))return;
  pending=null;queued=null;
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
    if(!acceptProgress(result.latest))return;
    if(result.completed){localStorage.removeItem(key);acceptProgress(result.latest,true);return;}
    const request=JSON.parse(rpc.request);
    if((request.resetVersion??0)!==result.latest.resetVersion){localStorage.removeItem(key);acceptProgress(result.latest,true);return;}
    await apiRequest(request.path,{method:'POST',body:request.body});
    return;
  }
  const latest=await apiRequest<ProgressEnvelope>('/api/progress');acceptProgress(latest,true);
}
