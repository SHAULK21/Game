import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {GameStore, type GameOperation} from '../server/gameStore';
import {ExpeditionStore} from '../server/expeditions/store';
import {GameActor} from '../server/gameActor';
import {expeditionDatabase} from './helpers/expeditionDatabase';

test('real character service, shared actor and SQL inventory across two devices', async t => {
 const db = await expeditionDatabase(); let now = Date.parse('2026-10-16T08:00:00Z');
 const store = new GameStore(db.pool, {now: () => now});
 const identity = {id: 801, displayName: 'Проверка'}, pc = crypto.randomUUID(), phone = crypto.randomUUID();
 let state: Awaited<ReturnType<GameStore['load']>>;
 const operation = (): GameOperation => ({operationId: crypto.randomUUID(), sessionToken: pc, sessionGeneration: state.sessionGeneration, resetVersion: state.resetVersion, expectedVersion: state.version});
 async function act(command: any) {const result = await store.operation(identity, operation(), command); state = result; return result;}
 try {
  await db.query('INSERT INTO players(telegram_id) VALUES($1)', [identity.id]);
  await t.test('server confirms absence before creation; SQL owns all real items', async () => {
   state = await store.load(identity, pc); assert.equal(state.save, null);
   state = await store.acquire(identity, pc, state.sessionGeneration, false);
   state = await store.create(identity, operation(), {name: 'Страж', classId: 'warrior'});
   assert.equal(state.save!.player.gold, 120); assert.equal(state.canonical, true);
   const row = (await db.query('SELECT progress_json FROM players WHERE telegram_id=$1', [identity.id])).rows[0];
   assert.deepEqual(row.progress_json.player.inventory, []); assert.deepEqual(row.progress_json.player.equipped, {});
   assert.ok((await db.query('SELECT * FROM owned_items WHERE owner_telegram_id=$1', [identity.id])).rows.length > 0);
  });
  await t.test('unchanged reload never changes the version or timers', async () => {
   state = await store.load(identity, pc); const v = state.version;
   for(let n=0;n<3;n++) state = await store.load(identity, pc);
   assert.equal(state.version, v);
  });
  await t.test('travel, real shop price, lost reply and exact replay', async () => {
   await act({type:'returnToSettlement'}); now += 20000; state = await store.load(identity, pc);
   assert.equal(state.save!.player.worldPlace, 'settlement');
   const request = operation(), gold = state.save!.player.gold;
   const first = await store.operation(identity, request, {type:'buyBasicConsumable', templateId:'pot_hp_small', priceGold:0});
   assert.equal(first.save!.player.gold, gold - 35); state = first;
   const replay = await store.operation(identity, request, {type:'buyBasicConsumable', templateId:'pot_hp_small', priceGold:0});
   assert.equal(replay.operation.replayed, true); assert.equal(replay.save!.player.gold, first.save!.player.gold);
   await assert.rejects(() => store.operation(identity, {...request,operationId:crypto.randomUUID()}, {type:'buyBasicConsumable',templateId:'pot_hp_small'}), {code:'VERSION_CONFLICT'});
  });
  await t.test('unknown snapshots and administrative cheats are refused durably', async () => {
   const gold = state.save!.player.gold;
   const rejected = await act({type:'setPlayerState',gold:999999}); assert.equal(rejected.operation.outcome,'rejected');
   await act({type:'adminAddGold', amount:100000}); assert.equal(state.save!.player.gold,gold);
  });
  await t.test('phone sees the same progress; transfer is explicit and blocks the PC', async () => {
   const view = await store.load(identity, phone); assert.equal(view.activeHere,false); assert.equal(view.save!.player.id,state.save!.player.id);
   await assert.rejects(() => store.acquire(identity,phone,view.sessionGeneration,false), {code:'SESSION_ACTIVE'});
   const stale = operation(); const next = await store.acquire(identity,phone,view.sessionGeneration,true);
   assert.equal(next.activeHere,true); assert.equal(next.sessionGeneration,view.sessionGeneration+1);
   await assert.rejects(() => store.operation(identity,stale,{type:'drinkBeer'}),{code:'SESSION_LOST'});
   state = await store.acquire(identity,pc,next.sessionGeneration,true);
  });
  await t.test('simultaneous identical mutations execute once', async () => {
   const request = operation(), command = {type:'buyBasicConsumable',templateId:'pot_hp_small'}, gold = state.save!.player.gold;
   const results = await Promise.all([store.operation(identity,request,command),store.operation(identity,request,command)]);
   assert.equal(results.filter(r=>r.operation.replayed).length,1); assert.equal(results[1].save!.player.gold,gold-35); state=results[1];
  });
  await t.test('legacy migration preserves 1000+ quantities and keeps ledger references unique', async () => {
   const owner = {id:802,displayName:'Перенос'}; await db.query('INSERT INTO players(telegram_id) VALUES(802)');
   const actor = await new GameActor({user:{id:802,first_name:'Перенос'},locale:'ru',resetVersion:0,admin:false,premium:{active:false,premiumUntil:null,priceStars:150,periodDays:30},now:()=>now}).initialize();
   await actor.invoke('createCharacter','Копатель','warrior');
   const source = {resetVersion:0,player:structuredClone(actor.current.player!),quests:actor.current.quests,achievements:actor.current.achievements};
   source.player.inventory.push({id:'old-ore',templateId:'coal',name:'Уголь',type:'ore',rarity:'common',level:1,icon:'ore',stats:{},upgradeLevel:0,sellPrice:5,disassembleYield:{ore:1},stackCount:100000});
   let view = await store.acquire(owner,phone,0,false);
   view = await store.migrate(owner,{operationId:crypto.randomUUID(),sessionToken:phone,sessionGeneration:view.sessionGeneration,resetVersion:0,expectedVersion:view.version},source);
   assert.equal(view.save!.player.inventory.filter(i=>i.templateId==='coal').reduce((n,i)=>n+(i.stackCount||1),0),100000);
   assert.ok((await db.query('SELECT * FROM character_migration_backups WHERE telegram_id=802')).rows.length);
  });
  await t.test('known expedition rejection is a permanent tombstone, never a delayed debit', async () => {
   const exp = new ExpeditionStore(db.pool,()=>now), request = {...operation(),ownerId:identity.id};
   await assert.rejects(()=>exp.mutate(request,{type:'train'}),{code:'NOT_ENOUGH_GOLD'});
   await db.query("UPDATE players SET progress_json=jsonb_set(progress_json,'{player,gold}','10000') WHERE telegram_id=$1",[identity.id]);
   await assert.rejects(()=>exp.mutate(request,{type:'train'}),{code:'NOT_ENOUGH_GOLD'});
   state=await store.load(identity,pc); assert.equal(state.expeditions!.skill,1); assert.equal(state.save!.player.gold,10000);
  });
 } finally {await db.close();}
});

test('canonical personal expedition blocks actions and completion survives a rejected command',async()=>{
 const db=await expeditionDatabase();let now=Date.parse('2026-10-16T11:00:00Z');const identity={id:804,displayName:'В пути'},token=crypto.randomUUID();const store=new GameStore(db.pool,{now:()=>now});
 try{
  await db.query('INSERT INTO players(telegram_id) VALUES(804)');let view=await store.acquire(identity,token,0,false);
  const op=()=>({operationId:crypto.randomUUID(),sessionToken:token,sessionGeneration:view.sessionGeneration,resetVersion:0,expectedVersion:view.version});
  view=await store.create(identity,op(),{name:'Шахтёр',classId:'warrior'});
  view=await store.operation(identity,op(),{type:'returnToSettlement'});now+=20000;view=await store.load(identity,token);
  const energy=view.save!.player.energy;
  const exp=new ExpeditionStore(db.pool,()=>now);const started=await exp.mutate({...op(),ownerId:804},{type:'start',selection:{route:'old-mine',goal:'balanced',duration:1,preparation:'none',crew:'personal'}});
  view=await store.load(identity,token);assert.ok(view.save!.player.expeditionPresence);
  const denied=await store.operation(identity,op(),{type:'mineNode',nodeId:'ore_coal'});view=denied;assert.equal(denied.operation.outcome,'rejected');assert.equal(denied.operation.result.code,'PERSONAL_EXPEDITION');
  now+=3600000;
  const final=await store.operation(identity,op(),{type:'not-a-game-action'});
  assert.equal(final.operation.outcome,'rejected');assert.equal(final.expeditions!.active,null);assert.equal(final.expeditions!.history[0].id,started.state.active!.id);assert.equal(final.save!.player.worldPlace,'settlement');
  assert.ok(final.save!.player.energy>=energy);const xp=final.save!.player.miningExp;
  view=await store.load(identity,token);assert.equal(view.save!.player.miningExp,xp);assert.equal(view.expeditions!.history.length,1);
 }finally{await db.close();}
});
