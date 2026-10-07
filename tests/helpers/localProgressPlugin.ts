import fs from 'node:fs/promises';
import type {Plugin} from 'esbuild';
/** UI gameplay fixtures use an explicit persistence adapter. Production has no local fallback. */
export const localProgressPlugin:Plugin={name:'test-progress-adapter',setup(build){
 build.onLoad({filter:/src\/utils\/api\.ts$/},async(args)=>({loader:'ts',contents:(await fs.readFile(args.path,'utf8')).replace(/const remoteMutation=.*?;\n/, 'const remoteMutation=false;\n')}));
 build.onLoad({filter:/src\/utils\/serverProgress\.ts$/},()=>({loader:'ts',contents:`
 import {readAccountSave,gameSaveKey,readResetVersion,applyAccountReset} from './accountReset';
 import {getTelegramUser} from './telegram';
 import {apiRequest} from './api';
 const read=()=>{let save=null;try{save=JSON.parse(readAccountSave(getTelegramUser().id)||'null');}catch{}return {ownerId:String(getTelegramUser().id),resetVersion:readResetVersion(getTelegramUser().id),version:0,save,activeHere:true,sessionGeneration:1,migrationOpen:true};};
 export const confirmedProgress=read;
 export const progressStatus=()=> 'ready';export const useProgressStatus=()=> 'ready';export const canChangeProgress=()=>true;
 export const setProgressStatus=()=>{};export const progressSessionToken=()=> '00000000-0000-4000-8000-000000000001';
 export const queueProgress=save=>{
 const gameplayFixture={...save,confirmedVersion:0};delete gameplayFixture.combat;delete gameplayFixture.travelState;localStorage.setItem(gameSaveKey(save.player.userId),JSON.stringify(gameplayFixture));
 for(const [prefix,field] of [['aethelgard_clan_creation_pending_','lastClanCreationOperation'],['aethelgard_residents_pending_','lastResidentSaleOperation'],['aethelgard_market_pending_','lastMarketListingOperation'],['aethelgard_bulk_pending_','lastBulkDisposalId']]){
 const key=prefix+save.player.userId;try{if(JSON.parse(localStorage.getItem(key)||'null')?.operationId===save.player[field])localStorage.removeItem(key);}catch{}}
 };
 export const waitForProgress=async()=>{};export const beginRemoteProgress=()=>()=>{};
 export const acceptProgress=(data,reload=false)=>{applyAccountReset(data.ownerId,data.resetVersion);if(data.save)queueProgress(data.save);if(reload)window.dispatchEvent(new CustomEvent('aethelgard-progress-reload',{detail:data}));};
 export const handleProgressConflict=()=>{};export const loadProgress=async()=>{const r=await apiRequest('/api/profile/state');if(Number.isSafeInteger(r.resetVersion))applyAccountReset(getTelegramUser().id,r.resetVersion);return read();};export const acquireProgress=async e=>e;
 export const migrateProgress=async save=>{queueProgress(save);return read();};export const retryProgress=async()=>{};export const recoverProgress=async()=>{};
 `}));
}};
