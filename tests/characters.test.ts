import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {handleProgressRequest} from '../server/native/progressApi';
import {NativePool, type NativeWorld} from '../server/native/pool';
import {validateNativeWorld} from '../server/native/invariants';
import {GameStore} from '../server/gameStore';
import {addCharacter, listCharacters, resolveCharacter, characterSlot} from '../server/characters';
import {claimDeliveries} from '../server/native/deliveries';
import {activateCharacter, selectedCharacter} from '../src/utils/characterSession';

const identity = {id: 9001, displayName: 'Player'};
const request = (world: NativeWorld, path: string, slot=0, body?: any, user=identity) => handleProgressRequest(world,
  {path, method:body===undefined?'GET':'POST', headers:{'x-game-character':String(slot)}, body},user);

test('slots are owner checked, retry safe, bounded and preserve the original character',async()=>{
  const world: NativeWorld={tables:{}};
  const first=await request(world,'/api/characters');
  assert.equal(first.body.characters[0].id,'9001');
  const added=await request(world,'/api/characters',0,{slot:1});
  const id=added.body.characters[1].id;
  assert(Number(id)<0);
  assert.deepEqual((await request(world,'/api/characters',0,{slot:1})).body,added.body);
  assert.equal((await request(world,'/api/progress',1)).body.ownerId,id);
  assert.equal((await request(world,'/api/progress',0)).body.ownerId,'9001');
  assert.equal((await request(world,'/api/progress',1,undefined,{id:9002,displayName:'Other'})).status,404);
  assert.equal((await request(world,'/api/progress',-1)).status,400);
  assert.equal((await request(world,'/api/characters',0,{slot:5})).status,400);
  for(let slot=2;slot<5;slot++) assert.equal((await request(world,'/api/characters',0,{slot})).status,200);
  assert.equal((await request(world,'/api/characters')).body.characters.length,5);
  validateNativeWorld(world);
});

test('real characters keep separate inventory, names, progress and writer sessions',async()=>{
  const world: NativeWorld={tables:{}};
  const list=await request(world,'/api/characters',0,{slot:1});
  const second={...identity,id:Number(list.body.characters[1].id)};
  const pool=new NativePool(world),store=new GameStore(pool.asPool());
  const tokens=[crypto.randomUUID(),crypto.randomUUID()];
  for(const [index,owner] of [identity,second].entries()){
    const session=await store.acquire(owner,tokens[index],0,false);
    await store.create(owner,{sessionToken:tokens[index],operationId:crypto.randomUUID(),expectedVersion:session.version,resetVersion:0,sessionGeneration:session.sessionGeneration},{name:index?'Mage':'Warrior',classId:index?'mage':'warrior'});
  }
  const a=await store.load(identity,tokens[0]),b=await store.load(second,tokens[1]);
  assert.equal(a.save!.player.name,'Warrior');assert.equal(b.save!.player.name,'Mage');
  assert.notEqual(a.save!.player.userId,b.save!.player.userId);
  assert.equal(a.activeHere,true);assert.equal(b.activeHere,true);
  const firstItems=pool.table('owned_items').filter(row=>Number(row.owner_telegram_id)===identity.id);
  const secondItems=pool.table('owned_items').filter(row=>Number(row.owner_telegram_id)===second.id);
  assert(firstItems.length>0);assert(secondItems.length>0);
  assert(!firstItems.some(a=>secondItems.some(b=>a.id===b.id)));
  validateNativeWorld(world);
});

test('Premium and invoices use real Telegram owner; character notifications never target a negative chat',async()=>{
  const world: NativeWorld={tables:{}};
  const list=await request(world,'/api/characters',0,{slot:1});
  const pool=new NativePool(world),owner=pool.table('players').find(row=>Number(row.telegram_id)===9001)!;
  const id=Number(list.body.characters[1].id);
  const invoice=await request(world,'/api/premium/invoice',1,{});
  assert.equal(invoice.effect!.payload.payload,'aethelgard_premium:9001');
  owner.premium_until=new Date(Date.now()+86400000).toISOString();
  assert.equal((await request(world,'/api/premium/status',1)).body.active,true);
  await request(world,'/api/progress',1);
  assert.equal(pool.table('players').find(row=>Number(row.telegram_id)===id)!.premium_until,owner.premium_until);
  owner.bot_started=true;owner.notification_settings={enabled:true};
  pool.table('game_notifications').push({id:1,telegram_id:id,category:'market',text:'Sold',due_at:new Date(0).toISOString()});
  assert.equal(claimDeliveries(world,'worker').jobs[0].payload.chat_id,9001);
});

test('Postgres migration and character allocation are compatible and idempotent',async()=>{
  const db=new PGlite();
  try {
    await db.exec('CREATE TABLE players(telegram_id BIGINT PRIMARY KEY,username TEXT,display_name TEXT,character_name TEXT,progress_json JSONB,level INTEGER DEFAULT 1,class_id TEXT)');
    const migration=await fs.readFile('server/migrations/20261022_characters.sql','utf8');
    await db.exec(migration);await db.exec(migration);
    await db.query('INSERT INTO players(telegram_id,character_name) VALUES(9001,$1)',['Existing']);
    const query=(sql:string,args:any[]=[])=>db.query(sql,args);
    const pool:any={query,connect:async()=>({query,release(){}})};
    await addCharacter(pool,9001,1,identity);await addCharacter(pool,9001,1,identity);
    const list=await listCharacters(pool,9001);
    assert.equal(list.characters.length,2);assert.equal(list.characters[0].name,'Existing');
    assert.equal(await resolveCharacter(pool,9001,1),Number(list.characters[1].id));
    await assert.rejects(resolveCharacter(pool,9002,1),{code:'CHARACTER_NOT_FOUND'});
    assert.throws(()=>characterSlot('1e0'));assert.throws(()=>characterSlot(5));
  } finally {await db.close();}
});

test('browser character selection is scoped to the Telegram account',()=>{
  activateCharacter(9001,{slot:1,id:'-1',name:'Mage',level:1,classId:'mage'});
  assert.equal(selectedCharacter(9001)?.id,'-1');assert.equal(selectedCharacter(9002),null);
});
