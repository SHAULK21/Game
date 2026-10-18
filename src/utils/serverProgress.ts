import type {ProgressEnvelope,ProgressOperationResult} from '../types/progress';
import {serializeProjectionCache,type CacheScheduler} from './projectionCache';
import {shareProgressProjection} from './projectionSharing';
export interface Journal {ownerId:string;resetVersion:number;sessionGeneration:number;expectedVersion:number;sessionToken:string;operationId:string;path:string;body:any}
interface Storage {getItem(key:string):string|null;setItem(key:string,value:string):void;removeItem(key:string):void}
export class ProgressRequestError extends Error {constructor(public data:any,public status:number){super(data?.error||'Сервер недоступен.');}}
export type ProgressStatus='loading'|'saved'|'saving'|'offline'|'readonly'|'conflict';
/** The browser is a projection of confirmed server state. Its only write-ahead
 * record is an exact replayable operation, never an optimistic character. */
export class ServerProgress {
 receivedAt=Date.now(); roundTripMs=0;
 current:ProgressEnvelope|null=null; status:ProgressStatus='loading'; message=''; pending:Journal|null=null; candidate:any=null;
 private generation=0;private listeners=new Set<()=>void>();private activeRequest=false;
 private revision=0;
 private cacheStamp='';private cancelCache:(()=>void)|undefined;
 getSnapshot=()=>this.revision;
 private loading:Promise<boolean>|null=null;private acquiring=false;private resolving=false;
 get requestInFlight(){return this.activeRequest||!!this.loading||this.acquiring||this.resolving;}
 constructor(readonly ownerId:string,readonly token:string,private storage:Storage,private request:(path:string,init:RequestInit)=>Promise<any>,private scheduleCache:CacheScheduler=work=>{work();return()=>{};}){
  const read=(key:string)=>{try{return JSON.parse(storage.getItem(key)||'null');}catch{return null;}};
  const journal=read(this.key('pending'));
  if(journal?.ownerId===ownerId)this.pending=journal;
  if(!this.pending){
    const legacy=read('aethelgard_rpc_pending_'+ownerId);
    try{const request=JSON.parse(legacy?.request||'null');if(request&&typeof request.path==='string'&&/^[0-9a-f-]{36}$/i.test(legacy.operationId)){
      this.pending={ownerId,resetVersion:request.resetVersion??0,sessionGeneration:0,expectedVersion:-1,sessionToken:token,operationId:legacy.operationId,path:request.path,body:JSON.parse(request.body||'{}')};
      storage.setItem(this.key('pending'),JSON.stringify(this.pending));
    }}catch{/* Retain unknown old data for manual recovery. */}
  }
  // Preserve the source before any cache/session operation, including reload.
  const old=read('aethelgard_save_v1_data_'+ownerId)||read('aethelgard_save_v1_data');
  if(String(old?.player?.userId)===ownerId){
   const epoch=old.resetVersion??0, key=this.key('candidate',epoch);
   if(!storage.getItem(key)&&!storage.getItem(this.key('choice-resolved',epoch))&&!Number.isSafeInteger(old.confirmedVersion))storage.setItem(key,JSON.stringify(old));
   if(!storage.getItem(this.key('backup',epoch)))storage.setItem(this.key('backup',epoch),JSON.stringify(old));
  }
 }
 private key(kind:string,epoch?:number){return 'aethelgard_server_'+kind+'_'+this.ownerId+(epoch===undefined?'':'_'+epoch);}
 subscribe=(fn:()=>void)=>{this.listeners.add(fn);return()=>{this.listeners.delete(fn);};};
 private emit(){this.revision++;for(const fn of this.listeners)fn();}
 disposeCache(){this.cancelCache?.();this.cancelCache=undefined;this.cacheStamp='';}
 private queueCache(snapshot:ProgressEnvelope){
  const stamp=snapshot.resetVersion+':'+snapshot.version+':'+snapshot.sessionGeneration;
  if(stamp===this.cacheStamp)return;
  this.cacheStamp=stamp;this.cancelCache?.();
  try{this.cancelCache=this.scheduleCache(()=>{
   this.cancelCache=undefined;
   try{this.storage.setItem(this.key('cache',snapshot.resetVersion),serializeProjectionCache(snapshot));}catch{/* Optional cache cannot invalidate a confirmed save. */}
  });}catch{this.cancelCache=undefined;this.cacheStamp='';}
 }
 private headers(journal?:Journal){const current=this.current;return {'X-Game-Session':journal?.sessionToken||this.token,'X-Game-Generation':String(journal?.sessionGeneration??current?.sessionGeneration??0),'X-Game-Reset-Version':String(journal?.resetVersion??current?.resetVersion??0),'X-Game-Version':String(journal?.expectedVersion??current?.version??0),...(journal?{'X-Game-Operation':journal.operationId}:{})};}
 /** Called after await. A response belongs to a specific active-session context. */
 accept(next:ProgressEnvelope,context=this.generation,requestStartedAt?:number):boolean {
  if(context!==this.generation||next?.protocol!=='server-actions-v1'||next.ownerId!==this.ownerId||![next.resetVersion,next.version,next.sessionGeneration].every(n=>Number.isSafeInteger(n)&&n>=0))return false;
  const previous=this.current;
  if(previous&&(next.resetVersion<previous.resetVersion||next.resetVersion===previous.resetVersion&&(next.sessionGeneration<previous.sessionGeneration||next.version<previous.version)))return false;
  if(previous&&(next.resetVersion>previous.resetVersion||next.sessionGeneration>previous.sessionGeneration))this.generation++;
  if(previous&&next.resetVersion>previous.resetVersion&&this.pending && this.pending.resetVersion<next.resetVersion){this.storage.removeItem(this.key('pending'));this.storage.removeItem('aethelgard_rpc_pending_'+this.ownerId);this.pending=null;}
  // Equal versions may update presence and timing but cannot replace game data.
  this.current=previous&&next.resetVersion===previous.resetVersion&&next.version===previous.version?{...next,game:previous.game,save:previous.save,expeditions:previous.expeditions}:shareProgressProjection(previous,next);
  try{this.candidate=JSON.parse(this.storage.getItem(this.key('candidate',next.resetVersion))||'null');if(!this.candidate){const legacy=JSON.parse(this.storage.getItem('aethelgard_migration_candidate_'+this.ownerId+'_'+next.resetVersion)||'null');if(legacy?.ownerId===this.ownerId&&legacy.resetVersion===next.resetVersion){this.candidate=legacy.save;this.storage.setItem(this.key('candidate',next.resetVersion),JSON.stringify(legacy.save));this.storage.setItem(this.key('backup',next.resetVersion),legacy.raw||JSON.stringify(legacy.save));}}}catch{this.candidate=null;}
  if(String(this.candidate?.player?.userId)!==this.ownerId||(this.candidate?.resetVersion??0)!==next.resetVersion)this.candidate=null;
  this.receivedAt=Date.now();
  if(requestStartedAt!==undefined)this.roundTripMs=Math.max(0,this.receivedAt-requestStartedAt);
  this.queueCache(this.current);
  if(!this.pending)this.message='';
  this.status=this.pending?'offline':next.activeHere?'saved':'readonly';this.emit();return true;
 }
 load():Promise<boolean>{
  if(this.loading)return this.loading;
  if(this.activeRequest)return Promise.resolve(false);
  const context=this.generation,started=Date.now();
  const task=(async()=>{try{const result=await this.request('/api/progress',{headers:this.headers()});if(context===this.generation&&result.ownerId!==this.ownerId)throw new Error('Аккаунт Telegram изменился. Откройте игру заново из бота.');return this.accept(result,context,started);}catch(error){if(context===this.generation){this.status='offline';this.message=(error as Error).message;this.emit();}return false;}})();
  this.loading=task;this.emit();
  return task.finally(()=>{if(this.loading===task)this.loading=null;this.emit();});
 }
 async acquire(transfer=false){if(!this.current)await this.load();if(!this.current||this.acquiring)return;const context=++this.generation,started=Date.now();this.acquiring=true;this.emit();try{const result=await this.request('/api/progress/session',{method:'POST',headers:this.headers(),body:JSON.stringify({generation:this.current.sessionGeneration,transfer})});this.accept(result,context,started);}catch(error){if(context===this.generation){this.message=(error as Error).message;this.status='readonly';this.emit();}}finally{this.acquiring=false;this.emit();}}
 async mutate(path:string,body:any){
  if(this.loading)await this.loading;
  if(this.activeRequest||this.pending)throw new Error('Сначала восстановите незавершённую операцию.');
  if(!this.current?.activeHere||this.status!=='saved')throw new Error('Изменения остановлены. Загрузите актуальные данные и активируйте сессию.');
  this.pending={ownerId:this.ownerId,resetVersion:this.current.resetVersion,sessionGeneration:this.current.sessionGeneration,expectedVersion:this.current.version,sessionToken:this.token,operationId:crypto.randomUUID(),path,body};
  try{this.storage.setItem(this.key('pending'),JSON.stringify(this.pending));}catch{this.pending=null;throw new Error('Не удалось записать запрос для безопасного повтора. Освободите место на устройстве.');}
  return this.recover();
 }
 async recover(){
  const pending=this.pending;if(!pending||this.activeRequest)return;
  const context=this.generation,started=Date.now();this.activeRequest=true;this.status='saving';this.emit();
  try{
   let data:any,error:ProgressRequestError|undefined;
   try{data=await this.request(pending.path,{method:'POST',headers:this.headers(pending),body:JSON.stringify(pending.body)});}catch(caught){if(!(caught instanceof ProgressRequestError))throw caught;error=caught;data=caught.data;}
   const envelope=data._progress||data,proof=data._operation||data.operation;
   const accepted=this.accept(envelope,context,started);
   const terminal=proof?.id===pending.operationId&&['applied','rejected'].includes(proof.outcome)||data.code==='FEATURE_UNAVAILABLE'&&data.outcome==='rejected';
   // A confirmed reset can invalidate an old operation. A session/version conflict
   // stops writes; it is never treated as a completed unknown financial request.
   if(accepted&&terminal||context===this.generation&&data.code==='FEATURE_UNAVAILABLE'&&data.outcome==='rejected'){
    if(this.pending?.operationId===pending.operationId){this.storage.removeItem(this.key('pending'));this.storage.removeItem('aethelgard_rpc_pending_'+this.ownerId);this.pending=null;}
    if(['/api/progress/migrate','/api/progress/keep-server','/api/progress/create'].includes(pending.path)&&proof?.outcome==='applied'){
     this.storage.setItem(this.key('choice-resolved',pending.resetVersion),'true');this.storage.removeItem(this.key('candidate',pending.resetVersion));this.storage.removeItem('aethelgard_migration_candidate_'+this.ownerId+'_'+pending.resetVersion);this.candidate=null;
    }
    this.status=this.current?.activeHere?'saved':'readonly';this.message=proof?.outcome==='rejected'?proof.result?.error||data.error||'Действие отклонено.':'';this.emit();
    if(error||proof?.outcome==='rejected')throw new ProgressRequestError(proof?.result||data,error?.status||409);
    return proof?.result??data;
   }
   if(context===this.generation&&['VERSION_CONFLICT','SESSION_LOST','SESSION_TRANSFERRED','ACCOUNT_RESET'].includes(data.code)){
    this.status='conflict';this.message=data.error;this.emit();
    // Receipt lookup is safe even if the writer has transferred. Absence is not
    // proof of failure while an old request may still be committing.
    throw error||new ProgressRequestError(data,409);
   }
   if(error)throw error;
   if(!accepted)return;
   throw new Error('Подтверждение операции пока не получено. Повторите восстановление.');
  }catch(error){if(this.pending&&context===this.generation&&this.status!=='conflict'){this.status='offline';this.message=(error as Error).message;this.emit();}throw error;}
  finally{this.activeRequest=false;this.emit();}
 }
 async resolveConflict(){
  if(this.activeRequest||this.resolving)return;
  const pending=this.pending;if(!pending){await this.load();return;}
  if(pending.path==='/api/clan/donate'){await this.recover().catch(()=>{});return;}
  const context=this.generation,started=Date.now();this.resolving=true;this.emit();
  try{
   const data=await this.request('/api/progress/operations/'+pending.operationId,{headers:this.headers(pending)});
   if(!this.accept(data,context,started))return;
   if(data.operation&&data.operation.id===pending.operationId){if(data.operation.outcome==='applied'&&['/api/progress/migrate','/api/progress/keep-server','/api/progress/create'].includes(pending.path)){this.storage.setItem(this.key('choice-resolved',pending.resetVersion),'true');this.storage.removeItem(this.key('candidate',pending.resetVersion));this.storage.removeItem('aethelgard_migration_candidate_'+this.ownerId+'_'+pending.resetVersion);this.candidate=null;}this.storage.removeItem(this.key('pending'));this.storage.removeItem('aethelgard_rpc_pending_'+this.ownerId);this.pending=null;this.status=data.activeHere?'saved':'readonly';this.emit();return;}
   if(data.sessionGeneration>pending.sessionGeneration||data.version>pending.expectedVersion){
    // Holding the player lock for the lookup proves the old request is finished;
    // changed version/generation prevents any later attempt from committing.
    this.storage.removeItem(this.key('pending'));this.storage.removeItem('aethelgard_rpc_pending_'+this.ownerId);this.pending=null;this.status=data.activeHere?'saved':'readonly';this.message='Прогресс обновлён. Повторите нужное действие.';this.emit();
   } else await this.recover();
  }catch(error){this.message=(error as Error).message;this.emit();}
  finally{this.resolving=false;this.emit();}
 }
}
