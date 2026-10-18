import {compactGameReply} from './gameProjection';
import type {ProgressEnvelope} from '../types/progress';
export type CacheScheduler=(work:()=>void)=>()=>void;
/** Optional display cache only. The exact operation journal stays synchronous. */
export function serializeProjectionCache(snapshot:ProgressEnvelope){
 return JSON.stringify({cacheVersion:2,reply:compactGameReply({status:200,body:snapshot})});
}
export const scheduleProjectionCache:CacheScheduler=work=>{
 if(typeof window.requestIdleCallback==='function'){
  const timer=window.requestIdleCallback(work,{timeout:1500});return()=>window.cancelIdleCallback(timer);
 }
 const timer=window.setTimeout(work,100);return()=>window.clearTimeout(timer);
};
