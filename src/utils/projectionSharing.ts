import type {ProgressEnvelope} from '../types/progress';
/** JSON projections are immutable. Reuse equal subtrees so inventory rows and
 * selectors do not rebuild when only combat clocks/logs or wallet values change. */
export function shareEqualJson<T>(previous:unknown,next:T):T{
 if(Object.is(previous,next))return next;
 if(!previous||!next||typeof previous!=='object'||typeof next!=='object')return next;
 if(Array.isArray(previous)!==Array.isArray(next))return next;
 if(Array.isArray(previous)&&Array.isArray(next)&&previous.length!==next.length)return next;
 const oldKeys=Object.keys(previous),keys=Object.keys(next);
 let equal=oldKeys.length===keys.length;
 const result:any=Array.isArray(next)?[]:{};
 for(const key of keys){
  const old=Object.hasOwn(previous,key)?(previous as any)[key]:undefined;
  const value=shareEqualJson(old,(next as any)[key]);
  Object.defineProperty(result,key,{value,enumerable:true,writable:true,configurable:true});
  if(!Object.hasOwn(previous,key)||!Object.is(value,old))equal=false;
 }
 return equal?previous as T:result;
}
export function shareProgressProjection(previous:ProgressEnvelope|null,next:ProgressEnvelope):ProgressEnvelope{
 if(!previous||previous.ownerId!==next.ownerId||previous.resetVersion!==next.resetVersion)return next;
 const game=shareEqualJson(previous.game,next.game),save=next.save&&next.game&&next.save.player===next.game.player&&game?.player?
  {...next.save,player:game.player,
   quests:next.save.quests===next.game.quests?game.quests:shareEqualJson(previous.save?.quests,next.save.quests),
   achievements:next.save.achievements===next.game.achievements?game.achievements:shareEqualJson(previous.save?.achievements,next.save.achievements),
   activeDungeonRun:next.save.activeDungeonRun===next.game.activeDungeonRun?game.activeDungeonRun:shareEqualJson(previous.save?.activeDungeonRun,next.save.activeDungeonRun)}:shareEqualJson(previous.save,next.save);
 return {...next,game,save};
}
