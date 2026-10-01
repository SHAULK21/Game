import test from 'node:test';
import assert from 'node:assert/strict';
import { refreshGameTimers,nextArenaReset } from '../src/utils/gameCadence';
import { canAssignRole,canManageMember,canUseVault } from '../src/utils/clanRoles';
import { PVP_CLASSES,PVP_STANCES,pvpRatingDelta,simulateDuel } from '../src/utils/pvp';
import type {PlayerCharacter} from '../src/types/game';
const now=Date.UTC(2026,9,1,0,0,1);
test('arena refresh catches midnight immediately, preserves extra tickets and never refills twice',()=>{
 const p={energy:60,maxEnergy:60,lastEnergyRegenTimestamp:now,arenaTickets:0,lastArenaTicketRefresh:'2026-09-30'} as PlayerCharacter;
 const next=refreshGameTimers(p,now);assert.equal(next.arenaTickets,5);
 assert.equal(refreshGameTimers({...next,arenaTickets:2},now+60000).arenaTickets,2);
 assert.equal(refreshGameTimers({...p,arenaTickets:8},now).arenaTickets,8);
 assert.equal(nextArenaReset(now),Date.UTC(2026,9,2));
});
test('energy catches up after offline periods at 120 seconds and preserves incomplete ticks',()=>{
 const p={energy:20,maxEnergy:60,lastEnergyRegenTimestamp:now-250000,arenaTickets:3,lastArenaTicketRefresh:'2026-10-01'} as PlayerCharacter;
 const next=refreshGameTimers(p,now);assert.equal(next.energy,22);assert.equal(next.lastEnergyRegenTimestamp,now-10000);
 assert.equal(refreshGameTimers(next,now+109999).energy,22);
 assert.equal(refreshGameTimers(next,now+110000).energy,23);
 assert.equal(refreshGameTimers({...p,lastEnergyRegenTimestamp:now-86400000},now).energy,60);
 assert.equal(refreshGameTimers({...p,lastEnergyRegenTimestamp:now+86400000},now).energy,20);
});
test('clan role permissions protect hierarchy and reserve the vault for accountable roles',()=>{
 for(const role of ['owner','officer','quartermaster'])assert.equal(canUseVault(role),true);
 for(const role of ['member','recruit','veteran','unknown'])assert.equal(canUseVault(role),false);
 assert.equal(canManageMember('officer','owner'),false);assert.equal(canManageMember('officer','officer'),false);
 assert.equal(canManageMember('quartermaster','recruit'),false);assert.equal(canManageMember('officer','recruit'),true);
 assert.equal(canAssignRole('officer','recruit','officer'),false);assert.equal(canAssignRole('officer','recruit','veteran'),true);
 assert.equal(canAssignRole('owner','officer','quartermaster'),true);assert.equal(canAssignRole('owner','member','owner'),false);
});
test('server PvP simulation terminates for every class and tactic, with bounded HP and no client damage',()=>{
 for(const classId of PVP_CLASSES)for(const stance of PVP_STANCES){
   const r=simulateDuel({classId,stance,name:'A'},{classId:'paladin',stance:'guard',name:'B'},()=>0.5);
   assert.ok(r.rounds>=1&&r.rounds<=30);assert.ok(r.log.length<=60);assert.ok(r.hp.every(h=>h>=0));assert.ok(['attacker','defender','draw'].includes(r.winner));
 }
 const same=simulateDuel({classId:'warrior',stance:'balanced',name:'A'},{classId:'warrior',stance:'balanced',name:'B'},()=>0.5);
 assert.equal(same.rounds<=30,true);
 assert.equal(pvpRatingDelta(1000,1000,'attacker'),12);assert.equal(pvpRatingDelta(1000,1000,'defender'),-12);assert.equal(pvpRatingDelta(1000,1000,'draw'),0);
 assert.ok(pvpRatingDelta(1000,1300,'attacker')>pvpRatingDelta(1000,700,'attacker'));
});
test('equalized PvP has no class that dominates or loses almost all neutral matchups',()=>{
 let seed=1321;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 for(const a of PVP_CLASSES){let wins=0,total=0;for(const b of PVP_CLASSES)if(a!==b)for(let i=0;i<75;i++){
  const r=simulateDuel({classId:a,stance:'balanced',name:'A'},{classId:b,stance:'balanced',name:'B'},random);wins+=r.winner==='attacker'?1:r.winner==='draw'?0.5:0;total++;
 }assert.ok(wins/total>0.25&&wins/total<0.75,`${a}: ${wins/total}`);}
});
