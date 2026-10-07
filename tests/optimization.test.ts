import test from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {authenticatePlayer,heartbeatPlayer,communityStatsCache} from '../server/playerSession';
import {anchorSpentResources,refreshGameTimers,utcDay} from '../src/utils/gameCadence';
import {mergeGlobalMessages} from '../src/hooks/useGlobalChat';
import type {PlayerCharacter} from '../src/types/game';

test('authenticated reads preserve ranking and presence timestamps, reread resets and only write changed names',async()=>{
 const db=new PGlite();let writes=0;
 const pool:any={query:async(sql:string,args:any[])=>{if(/^(INSERT|UPDATE)/.test(sql))writes++;return db.query(sql,args);}};
 try{
  await db.exec(`CREATE TABLE players(telegram_id bigint primary key,username text,display_name text,reset_version int default 0,updated_at timestamptz default NOW(),last_seen_at timestamptz default NOW());`);
  const identity={id:7,username:'test',displayName:'Test'};
  assert.equal(await authenticatePlayer(pool,identity),0);assert.equal(writes,1);
  await db.exec("UPDATE players SET updated_at='2026-01-01T00:00:00Z',last_seen_at='2026-01-02T00:00:00Z',reset_version=4");
  for(let i=0;i<10;i++)assert.equal(await authenticatePlayer(pool,identity),4);
  assert.equal(writes,1);
  await authenticatePlayer(pool,{...identity,displayName:'New'});assert.equal(writes,2);
  const row=(await db.query<any>('SELECT * FROM players')).rows[0];assert.equal(row.display_name,'New');assert.equal(row.updated_at.toISOString(),'2026-01-01T00:00:00.000Z');assert.equal(row.last_seen_at.toISOString(),'2026-01-02T00:00:00.000Z');
  await heartbeatPlayer(pool,7);const seen=(await db.query<any>('SELECT last_seen_at FROM players')).rows[0].last_seen_at;
  await db.exec("UPDATE players SET last_seen_at=NOW()+INTERVAL '30 seconds'");const before=(await db.query<any>('SELECT last_seen_at FROM players')).rows[0].last_seen_at;
  await heartbeatPlayer(pool,7);assert.equal((await db.query<any>('SELECT last_seen_at FROM players')).rows[0].last_seen_at.getTime(),before.getTime());assert.ok(seen.getTime()>Date.parse('2026-01-02'));
 }finally{await db.close();}
});
test('community counts share an in-flight query and expire after 15 seconds',async()=>{
 let now=0,calls=0;let resolve:any;
 const get=communityStatsCache(()=>({query:()=>{calls++;return new Promise(r=>{resolve=r;});}} as any),()=>now);
 const first=get(),second=get();assert.equal(calls,1);resolve({rows:[{total_players:20,online_players:3}]});assert.deepEqual(await first,await second);
 now=14999;await get();assert.equal(calls,1);now=15000;const third=get();assert.equal(calls,2);resolve({rows:[{total_players:21,online_players:4}]});assert.equal((await third).onlinePlayers,4);
});
test('full resource timers are no-ops and spending cannot inherit idle regeneration credit',()=>{
 const now=Date.UTC(2026,9,7,12);
 const p={energy:60,maxEnergy:60,stamina:100,maxStamina:100,alchemyEnergy:100,maxAlchemyEnergy:100,lastActiveTimestamp:now-86400000,lastEnergyRegenTimestamp:now-86400000,lastArenaTicketRefresh:utcDay(now),arenaTickets:3} as PlayerCharacter;
 assert.equal(refreshGameTimers(p,now),p);
 const spent=anchorSpentResources(p,{...p,energy:59,stamina:98,alchemyEnergy:98},now);
 assert.equal(refreshGameTimers(spent,now+9999),spent);
 const next=refreshGameTimers(spent,now+20000);assert.equal(next.energy,59);assert.equal(next.stamina,100);assert.equal(next.alchemyEnergy,99);
 assert.equal(refreshGameTimers(spent,now+120000).energy,60);
});
test('chat merge preserves identity on empty polls, deduplicates sent messages and sorts bigint IDs',()=>{
 const message=(id:string)=>({id,text:id,display_name:'Test',created_at:'2026-10-07'});
 const first=[message('9007199254740993')];assert.equal(mergeGlobalMessages(first,[]),first);assert.equal(mergeGlobalMessages(first,[message('9007199254740993')]),first);
 const sent=mergeGlobalMessages(first,[message('9007199254740995')]);const polled=mergeGlobalMessages(sent,[message('9007199254740994'),message('9007199254740995')]);assert.deepEqual(polled.map(m=>m.id),['9007199254740993','9007199254740994','9007199254740995']);
 assert.equal(mergeGlobalMessages([],Array.from({length:100},(_,i)=>message(String(i)))).length,80);
});
