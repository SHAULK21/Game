import {GameActor,actorHashMode} from '../lib/gameEngine.js';
export default async function(input={}){
 const clock=typeof performance!=='undefined'&&typeof performance.now==='function'?()=>performance.now():()=>Date.now();
 const config={user:{id:9701,first_name:'Synthetic'},locale:'ru',resetVersion:0,admin:false,premium:{active:true,premiumUntil:'2030-01-01T00:00:00.000Z',priceStars:150,periodDays:30},now:()=>1800000000000};
 const started=clock();let snapshot=input.snapshot;
 if(!snapshot){const seed=await new GameActor(config).initialize();await seed.invoke('createCharacter','Synthetic','warrior',true);snapshot=seed.snapshot();}
 const coldCreateMs=clock()-started,samples=[];
 const iterations=Math.min(12,Math.max(1,input.iterations||12));
 for(let n=0;n<iterations;n++){
  const start=clock(),actor=await new GameActor({...config,snapshot}).initialize();
  actor.tick();await actor.invoke('performPlayerAction','defend');actor.replacePlayer({...actor.current.player,lastActiveTimestamp:config.now()});
  samples.push(clock()-start);
 }
 samples.sort((a,b)=>a-b);
 const restored=await new GameActor({...config,snapshot}).initialize();
 return {coldCreateMs,medianCommandMs:samples[Math.floor(samples.length/2)],maxCommandMs:samples[samples.length-1],samples,
  timerCompatible:JSON.stringify(restored.snapshot().timers)===JSON.stringify(snapshot.timers),clockAvailable:typeof performance!=='undefined',hashMode:actorHashMode()};
}
