import test from 'node:test';
import assert from 'node:assert/strict';
import { castFishing,hookFishing,landFishing,cancelFishing,upgradeFishingRod,initialFishing,migrateFishing,fishingPhase,fishingMovement,fightFishing,FISHING_RECIPES,FISHING_SPOTS,FISH } from '../src/utils/fishing';
import { translateText,ukrainianDictionary } from '../src/i18n/translate';
import type {PlayerCharacter} from '../src/types/game';
const player=()=>({level:1,stamina:100,silver:1000,inventory:[],maxInventorySlots:40,fishing:initialFishing()} as unknown as PlayerCharacter);
const reel=(p:PlayerCharacter,now:number)=>{for(let i=0;i<26&&fishingPhase(p.fishing!.cast,now)==='reel';i++){const c=p.fishing!.cast!,f=c.fight!,m=fishingMovement(c);const a=f.tension>=65?'slack':m.mood==='rush'&&f.tension>25&&f.energy>15?'brace':'pull';const result=fightFishing(p,c.id,a,f.step,now+(i+1)*600);assert(result.success);p=result.player;}return p;};
const catchFish=(p:PlayerCharacter,spot='river',rng=()=>.5)=>{const start=castFishing(p,spot,1000,rng);assert(start.success);const c=start.player.fishing!.cast!;const hook=hookFishing(start.player,c.id,c.biteAt);assert(hook.success);return landFishing(reel(hook.player,c.biteAt),c.id,c.biteAt+30000);};

test('fishing phases charge once, reject early/duplicate hooks and give one persisted catch',()=>{
 const p=player();const start=castFishing(p,'river',1000,()=>.5);assert(start.success);const c=start.player.fishing!.cast!;
 assert.equal(p.stamina,100);assert.equal(start.player.stamina,96);assert.equal(castFishing(start.player,'river').success,false);
 assert.equal(fishingPhase(c,c.biteAt-1),'wait');assert.equal(fishingPhase(c,c.biteAt),'bite');assert.equal(hookFishing(start.player,c.id,c.biteAt-1).success,false);
 const hooked=hookFishing(start.player,c.id,c.biteAt);assert(hooked.success);assert.equal(hookFishing(hooked.player,c.id,c.biteAt).success,false);
 assert.equal(landFishing(hooked.player,c.id,c.biteAt+1199).success,false);
 const restored={...hooked.player,fishing:migrateFishing(JSON.parse(JSON.stringify(hooked.player.fishing)))};const landed=landFishing(reel(restored,c.biteAt),c.id,c.biteAt+30000);assert(landed.success);
 assert.equal(landed.player.inventory[0].templateId,'fish_perch');assert.equal(landed.player.fishing!.catches,1);assert.equal(landed.player.fishing!.exp,30);assert.equal(landed.player.fishing!.collection.perch.recordGrams,c.grams);
 assert.equal(landFishing(landed.player,c.id,c.biteAt+1300).success,false);assert.equal(landed.player.stamina,96);
});
test('fish escape after the window; cancel consumes stamina and high zones enforce both levels',()=>{
 const p=player();assert.equal(castFishing(p,'forest').success,false);assert.equal(castFishing({...p,level:100},'forest').success,false);assert.equal(castFishing({...p,fishing:{...initialFishing(),exp:720,level:5}},'forest').success,false);
 assert.equal(castFishing({...p,stamina:3},'river').success,false);
 const start=castFishing(p,'river',1000,()=>.5);const c=start.player.fishing!.cast!;assert.equal(fishingPhase(c,c.expiresAt+1),'lost');assert.equal(hookFishing(start.player,c.id,c.expiresAt+1).success,false);
 const cancelled=cancelFishing(start.player);assert(cancelled.success);assert.equal(cancelled.player.stamina,96);assert.equal(cancelled.player.fishing!.cast,undefined);assert.equal(cancelled.player.fishing!.exp,0);
});
test('full bags preserve a hooked fish; stacks work and failed upgrades spend nothing',()=>{
 let p=player();let start=castFishing(p,'river',1000,()=>.5);let c=start.player.fishing!.cast!;let hook=hookFishing(start.player,c.id,c.biteAt);
 const full={...reel(hook.player,c.biteAt),maxInventorySlots:0};assert.equal(landFishing(full,c.id,c.biteAt+1200).success,false);assert(full.fishing!.cast);
 const result=landFishing({...full,maxInventorySlots:1},c.id,c.biteAt+1200);assert(result.success);
 const next=catchFish({...result.player,maxInventorySlots:1});assert(next.success);assert.equal(next.player.inventory.length,1);assert.equal(next.player.inventory[0].stackCount,2);
 assert.equal(upgradeFishingRod(p).success,false);assert.equal(p.silver,1000);
 p={...p,fishing:{...initialFishing(),exp:720,level:5},inventory:[{id:'ore1',name:'Медная руда',stackCount:2},{id:'ore2',name:'Медная руда',stackCount:5}] as any};
 const upgrade=upgradeFishingRod(p);assert(upgrade.success);assert.equal(upgrade.player.silver,920);assert.equal(upgrade.player.fishing!.rod,1);assert.equal(upgrade.player.inventory.length,1);assert.equal(upgrade.player.inventory[0].stackCount,1);
});
test('every fish is available in a gated pool and fish recipes/localization use actual inventory names',()=>{
 assert.deepEqual(migrateFishing(),initialFishing());const state=migrateFishing({exp:360,rod:9});assert.equal(state.level,3);assert.equal(state.rod,2);assert.deepEqual(migrateFishing(state),state);
 assert.equal(new Set(FISHING_SPOTS.flatMap(s=>[...s.fish])).size,FISH.length);
 for(const f of FISH){assert(ukrainianDictionary[f.name]);assert(translateText(f.name,'uk')!==f.name||f.name==='Речной окунь');}
 for(const recipe of FISHING_RECIPES){assert(recipe.ingredients.some(i=>FISH.some(f=>f.name===i.name)));assert(recipe.resultStats&&Object.keys(recipe.resultStats).length>0);assert(ukrainianDictionary[recipe.name]);}
 const p={...player(),level:100,fishing:{...initialFishing(),exp:10000,level:56}};for(const spot of FISHING_SPOTS){assert(catchFish(p,spot.id,()=>0).success);}
});


test('reeling requires choices, rejects stale/early steps and preserves progress across reloads',()=>{
 const started=castFishing(player(),'river',1000,()=>.5);const c=started.player.fishing!.cast!;let p=hookFishing(started.player,c.id,c.biteAt).player;
 assert.equal(fishingPhase(p.fishing!.cast,c.biteAt+999999),'reel');assert(!landFishing(p,c.id,c.biteAt+999999).success);
 assert(!fightFishing(p,c.id,'pull',0,c.biteAt+100).success);
 let r=fightFishing(p,c.id,'pull',0,c.biteAt+600);assert(r.success);p=r.player;assert.equal(p.fishing!.cast!.fight!.step,1);
 assert(!fightFishing(p,c.id,'pull',0,c.biteAt+1200).success);
 const saved=migrateFishing(JSON.parse(JSON.stringify(p.fishing)));assert.deepEqual(saved,p.fishing);assert.deepEqual(migrateFishing(saved),saved);
 p={...p,fishing:saved};p=reel(p,c.biteAt+2000);assert.equal(fishingPhase(p.fishing!.cast),'land');assert(landFishing(p,c.id).success);assert.equal(p.stamina,96);
 const legacy={...c,hookedAt:c.biteAt};const migrated=migrateFishing({...initialFishing(),cast:legacy});assert.equal(migrated.cast!.fight!.progress,0);assert.equal(fishingPhase(migrated.cast,c.biteAt+999999),'reel');
});
test('pulling or releasing blindly loses fish; rods make the same movements gentler',()=>{
 const started=castFishing(player(),'river',1000,()=>0);const c=started.player.fishing!.cast!;const hooked=hookFishing(started.player,c.id,c.biteAt).player;
 for(const action of ['pull','slack','brace'] as const){let p=hooked;for(let n=0;n<26&&fishingPhase(p.fishing!.cast)==='reel';n++){p=fightFishing(p,c.id,action,p.fishing!.cast!.fight!.step,c.biteAt+(n+1)*600).player;}assert.equal(fishingPhase(p.fishing!.cast),'lost',action);assert(!landFishing(p,c.id).success);assert.equal(p.fishing!.exp,0);}
 const plain=fightFishing(hooked,c.id,'pull',0,c.biteAt+600);const strong=fightFishing({...hooked,fishing:{...hooked.fishing!,rod:2}},c.id,'pull',0,c.biteAt+600);assert(strong.player.fishing!.cast!.fight!.tension<plain.player.fishing!.cast!.fight!.tension);
});
