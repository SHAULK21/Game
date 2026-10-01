import { useEffect, useRef } from 'react';
import type { Monster, PlayerCharacter } from '../types/game';
import { apiRequest } from '../utils/api';
import { createOperationId } from '../utils/operationId';

/** Bounded, retryable diagnostic events; never used to award currency. */
export function useBalanceTelemetry(player: PlayerCharacter | null, monster: Monster | null, inCombat: boolean,
  ended: boolean, outcome: string | null, rounds: number, difficulty?: string) {
  const latest = useRef({player,monster,inCombat,ended,outcome,rounds,difficulty});
  latest.current={player,monster,inCombat,ended,outcome,rounds,difficulty};
  const session=useRef<{id:string;user:string;activeMs:number;gold:number;silver:number;last:number;sequence:number;visible:boolean} | null>(null);
  const fight=useRef<{id:string;monster:Monster;level:number;classId:string;activeMs:number;gold:number;silver:number;exp:number;difficulty:string} | null>(null);
  const pending=useRef<any[]>([]);
  const busy=useRef(false);
  const queueKey=useRef('');
  const persist=()=>{try{localStorage.setItem(queueKey.current,JSON.stringify(pending.current.slice(-200)));}catch{/* diagnostic storage may be unavailable */}};
  const enqueue=(event:any)=>{pending.current=pending.current.filter(e=>!(event.kind==='session' && e.kind==='session' && e.id===event.id));pending.current.push(event);pending.current=pending.current.slice(-200);persist();};
  const flush=async()=>{
    if(busy.current || !pending.current.length)return;
    busy.current=true;
    const batch=pending.current.slice(0,25);
    try {
      await apiRequest('/api/telemetry',{method:'POST',keepalive:true,body:JSON.stringify({events:batch})});
      pending.current=pending.current.filter(e=>!batch.some(b=>b.id===e.id && b.sequence===e.sequence));persist();
    }catch{/* Retry on the next heartbeat; gameplay continues. */}finally{busy.current=false;}
  };
  const tick=()=>{
    const s=session.current;if(!s)return;
    const now=Date.now(),elapsed=Math.min(15000,Math.max(0,now-s.last));s.last=now;
    if(s.visible){s.activeMs=Math.min(86400000,s.activeMs+elapsed);if(fight.current)fight.current.activeMs=Math.min(86400000,fight.current.activeMs+elapsed);}
    s.visible=document.visibilityState==='visible';
  };
  const snapshot=()=>{
    const s=session.current,p=latest.current.player;if(!s||!p)return;
    tick();enqueue({kind:'session',id:s.id,sequence:++s.sequence,level:p.level,durationMs:Math.round(s.activeMs),
      netGold:Math.round(p.gold-s.gold),netSilver:Math.round(p.silver-s.silver)});
  };
  useEffect(()=>{
    if(!player?.userId)return;
    queueKey.current='balance_telemetry_'+player.userId;
    try{const old=JSON.parse(localStorage.getItem(queueKey.current)||'[]');pending.current=Array.isArray(old)?old.slice(-200):[];}catch{pending.current=[];}
    session.current={id:createOperationId(),user:player.userId,activeMs:0,gold:player.gold,silver:player.silver,last:Date.now(),sequence:0,visible:document.visibilityState==='visible'};
    snapshot();void flush();
    const timer=window.setInterval(tick,10000);
    const heartbeat=window.setInterval(()=>{snapshot();void flush();},60000);
    const visibility=()=>{snapshot();void flush();};
    document.addEventListener('visibilitychange',visibility);window.addEventListener('pagehide',visibility);
    return ()=>{snapshot();void flush();window.clearInterval(timer);window.clearInterval(heartbeat);document.removeEventListener('visibilitychange',visibility);window.removeEventListener('pagehide',visibility);session.current=null;fight.current=null;};
  },[player?.userId]);
  useEffect(()=>{
    if(!inCombat) {fight.current=null;return;}
    if(!player||!monster||!session.current)return;
    if(!ended && !fight.current){tick();fight.current={id:createOperationId(),monster,level:player.level,classId:player.classId,activeMs:0,gold:0,silver:0,exp:0,difficulty:difficulty||monster.huntingModeId||'standard'};}
    if(ended && outcome && fight.current){
      tick();const f=fight.current;fight.current=null;
      enqueue({kind:'battle',id:f.id,sessionId:session.current.id,level:f.level,classId:f.classId,region:f.monster.regionId,
        monster:f.monster.id,role:f.monster.isBoss?'boss':f.monster.isElite?'elite':'normal',difficulty:f.difficulty,outcome,rounds,durationMs:Math.round(f.activeMs),gold:f.gold,silver:f.silver,exp:f.exp});
      snapshot();void flush();
    }
  },[inCombat,ended,outcome,monster?.id,player?.userId]);
  return (gold:number,silver:number,exp:number)=>{const f=fight.current;if(f){f.gold+=gold;f.silver+=silver;f.exp+=exp;}};
}
