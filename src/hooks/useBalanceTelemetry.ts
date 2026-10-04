import { useEffect, useRef } from 'react';
import type { Monster, PlayerCharacter } from '../types/game';
import { apiRequest } from '../utils/api';
import { createOperationId } from '../utils/operationId';

/** Bounded, retryable diagnostic events; never used to award currency. */
export function useBalanceTelemetry(player: PlayerCharacter | null, monster: Monster | null, inCombat: boolean,
  ended: boolean, outcome: string | null, rounds: number, difficulty?: string) {
  const latest = useRef({player,monster,inCombat,ended,outcome,rounds,difficulty});
  latest.current={player,monster,inCombat,ended,outcome,rounds,difficulty};
  const session=useRef<{id:string;user:string;activeMs:number;gold:number;silver:number;last:number;sequence:number;visible:boolean;startLevel:number;maxLevel:number;hiddenAt?:number} | null>(null);
  const screen=useRef('hunter');
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
    s.maxLevel=Math.max(s.maxLevel,p.level);
    tick();enqueue({kind:'session',id:s.id,sequence:++s.sequence,level:p.level,durationMs:Math.round(s.activeMs),startLevel:s.startLevel,maxLevel:s.maxLevel,screen:screen.current,
      state:latest.current.inCombat?(latest.current.ended?latest.current.outcome||'idle':'combat'):'idle',energy:Math.round(p.energy),
      netGold:Math.round(p.gold-s.gold),netSilver:Math.round(p.silver-s.silver)});
  };
  useEffect(()=>{
    if(!player?.userId)return;
    queueKey.current='balance_telemetry_'+player.userId;
    try{const old=JSON.parse(localStorage.getItem(queueKey.current)||'[]');pending.current=Array.isArray(old)?old.slice(-200):[];}catch{pending.current=[];}
    const beginSession=()=>{
      const p=latest.current.player;if(!p)return;
      session.current={id:createOperationId(),user:p.userId,activeMs:0,gold:p.gold,silver:p.silver,last:Date.now(),sequence:0,visible:document.visibilityState==='visible',startLevel:p.level,maxLevel:p.level};
    };
    beginSession();
    snapshot();void flush();
    const timer=window.setInterval(tick,10000);
    const heartbeat=window.setInterval(()=>{if(document.visibilityState==='visible'){snapshot();void flush();}},20000);
    const visibility=()=>{
      const s=session.current;
      if(document.visibilityState==='visible'&&s?.hiddenAt&&Date.now()-s.hiddenAt>=1800000&&!latest.current.inCombat)beginSession();
      snapshot();
      if(session.current)session.current.hiddenAt=document.visibilityState==='hidden'?Date.now():undefined;
      void flush();
    };
    const navigation=(event:Event)=>{screen.current=(event as CustomEvent<string>).detail;snapshot();void flush();};
    window.addEventListener('aethelgard:screen',navigation);
    document.addEventListener('visibilitychange',visibility);window.addEventListener('pagehide',visibility);
    return ()=>{snapshot();void flush();window.clearInterval(timer);window.clearInterval(heartbeat);document.removeEventListener('visibilitychange',visibility);window.removeEventListener('pagehide',visibility);window.removeEventListener('aethelgard:screen',navigation);session.current=null;fight.current=null;};
  },[player?.userId]);
  useEffect(()=>{if(session.current){snapshot();void flush();}},[player?.level]);
  useEffect(()=>{
    if(!inCombat) {fight.current=null;return;}
    if(!player||!monster||!session.current)return;
    if(!ended && !fight.current){tick();fight.current={id:createOperationId(),monster,level:player.level,classId:player.classId,activeMs:0,gold:0,silver:0,exp:0,difficulty:difficulty||monster.huntingModeId||'standard'};snapshot();void flush();}
    if(ended && outcome && fight.current){
      tick();const f=fight.current;fight.current=null;
      enqueue({kind:'battle',id:f.id,sessionId:session.current.id,level:f.level,classId:f.classId,region:f.monster.regionId,
        monster:f.monster.id,role:f.monster.isBoss?'boss':f.monster.isElite?'elite':'normal',difficulty:f.difficulty,outcome,rounds,durationMs:Math.round(f.activeMs),gold:f.gold,silver:f.silver,exp:f.exp});
      snapshot();void flush();
    }
  },[inCombat,ended,outcome,monster?.id,player?.userId]);
  return (gold:number,silver:number,exp:number)=>{const f=fight.current;if(f){f.gold+=gold;f.silver+=silver;f.exp+=exp;}};
}
