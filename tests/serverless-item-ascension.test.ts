import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {NativePool} from '../server/native/pool';
import {GameStore} from '../server/gameStore';
import {validateNativeWorld} from '../server/native/invariants';
import {createMarketListing, returnMarketListing} from '../server/marketListings';

const now=1792272000000;
const helmet={templateId:'test_helm',name:'Шолом',type:'helmet',rarity:'rare',level:10,upgradeLevel:2,stats:{defense:100,maxHp:200},icon:'',sellPrice:100,disassembleYield:{silver:20}};
async function fixture(){
  const world={tables:{}}, pool=new NativePool(world,()=>now), identity={id:9701,displayName:'Коваль'}, token=crypto.randomUUID();
  pool.ensurePlayer(identity);const store=new GameStore(pool.asPool(),{now:()=>now});
  let view=await store.acquire(identity,token,0,false);
  const operation=()=>({sessionToken:token,operationId:crypto.randomUUID(),expectedVersion:view.version,resetVersion:view.resetVersion,sessionGeneration:view.sessionGeneration});
  view=await store.create(identity,operation(),{name:'Коваль',classId:'warrior'});
  pool.table('players')[0].progress_json.player.worldPlace='settlement';
  const issue=(extra:any={},owner=identity.id)=>{
    const id=crypto.randomUUID();pool.table('owned_items').push({id,owner_telegram_id:owner,item_json:{...helmet,...extra.item},quantity:extra.quantity??1,
      equipped_slot:extra.slot??null,locked:extra.locked??false,bound_clan_id:extra.boundToClan??null,origin:extra.origin??'game_command',created_at:new Date(now).toISOString()});return id;
  };
  return {world,pool,store,identity,token,issue,operation,get view(){return view;},async load(){view=await store.load(identity,token);return view;},async act(command:any,op=operation()){const result=await store.operation(identity,op,command);view=result;return result;}};
}

test('serverless merge persists canonical equipment and a retried operation consumes its donor once',async()=>{
  const f=await fixture(),base=f.issue({slot:'helmet'}),donor=f.issue({item:{upgradeLevel:8}});
  await f.load();const op=f.operation(),command={type:'mergeItems',itemId:base,materialId:donor,ascensionLevel:5,stats:{defense:999999}};
  const first=await f.act(command,op);assert.equal(first.operation.outcome,'applied');assert.equal((first.operation.result as any).success,true);
  assert.equal(first.game!.player!.equipped.helmet!.ascensionLevel,1);assert.equal(first.game!.player!.equipped.helmet!.upgradeLevel,8);
  assert.equal(first.game!.player!.equipped.helmet!.stats.defense,100);assert.equal(first.game!.player!.equipped.helmet!.id,base);
  assert.equal(f.pool.table('owned_items').some(row=>row.id===donor),false);
  const rows=structuredClone(f.pool.table('owned_items'));
  const replay=await f.act(command,op);assert.equal(replay.operation.replayed,true);assert.deepEqual(f.pool.table('owned_items'),rows);
  const restored=await f.load();assert.equal(restored.game!.player!.equipped.helmet!.ascensionLevel,1);
  validateNativeWorld(f.world);
});

test('serverless rejects foreign, locked and worn donors without deleting equipment',async()=>{
  const f=await fixture(),base=f.issue();f.pool.ensurePlayer({id:9702,displayName:'Інший'});
  const donors=[f.issue({},9702),f.issue({locked:true}),f.issue({slot:'helmet'}),f.issue({item:{rarity:'epic'}}),base];
  await f.load();
  for(const donor of donors){
    const rows=structuredClone(f.pool.table('owned_items'));
    const result=await f.act({type:'mergeItems',itemId:base,materialId:donor});
    assert.ok(result.operation.outcome==='rejected'||(result.operation.result as any).success===false);
    assert.deepEqual(f.pool.table('owned_items'),rows);
  }
});

test('serverless stack splitting preserves quantities, rank and ownership across reload',async()=>{
  const f=await fixture(),base=f.issue({quantity:4});await f.load();
  const first=await f.act({type:'mergeItems',itemId:base,materialId:base});assert.equal((first.operation.result as any).success,true);
  const result=f.pool.table('owned_items').find(row=>row.id===base)!;assert.equal(result.item_json.ascensionLevel,1);assert.equal(result.quantity,1);
  const rest=f.pool.table('owned_items').find(row=>row.id!==base&&row.item_json.templateId===helmet.templateId)!;
  assert.equal(rest.quantity,2);assert.notEqual(rest.id,base);assert.equal(rest.item_json.ascensionLevel,undefined);
  await f.load();validateNativeWorld(f.world);
});

test('ascension follows an actual market listing and return without losing its rank',async()=>{
  const f=await fixture(),base=f.issue(),donor=f.issue();await f.load();await f.act({type:'mergeItems',itemId:base,materialId:donor});
  const listing=await createMarketListing(f.pool.asPool(),f.identity.id,{itemId:base,quantity:1,price_gold:100,operationId:crypto.randomUUID()},0);
  assert.equal(listing.item_json.ascensionLevel,1);
  await returnMarketListing(f.pool.asPool(),f.identity.id,listing.id,0);
  const view=await f.load();assert.ok(view.game!.player!.inventory.some(item=>item.templateId===helmet.templateId&&item.ascensionLevel===1));
  validateNativeWorld(f.world);
});

test('a split legacy stack remains untradable and a field merge does not consume anything',async()=>{
  const f=await fixture(),base=f.issue({quantity:4,origin:'legacy_character'});await f.load();
  await f.act({type:'mergeItems',itemId:base,materialId:base});
  const rest=f.pool.table('owned_items').find(row=>row.id!==base&&row.item_json.templateId===helmet.templateId)!;
  assert.equal(rest.origin,'legacy_character');
  await assert.rejects(createMarketListing(f.pool.asPool(),f.identity.id,{itemId:rest.id,quantity:1,price_gold:5,operationId:crypto.randomUUID()},0));
  f.pool.table('players')[0].progress_json.player.worldPlace='field';await f.load();
  const rows=structuredClone(f.pool.table('owned_items'));
  const denied=await f.act({type:'mergeItems',itemId:rest.id,materialId:rest.id});
  assert.equal((denied.operation.result as any).success,false);assert.deepEqual(f.pool.table('owned_items'),rows);
});

test('canonical sharpening accepts equipped ascended gear and preserves the independent rank',async()=>{
  const f=await fixture(),base=f.issue({slot:'helmet',item:{ascensionLevel:2}});
  const player=f.pool.table('players')[0].progress_json.player;player.gold=100000;player.silver=100000;
  for(const name of ['Железная руда','Сердцевина склепного стража'])f.issue({quantity:50,item:{name,templateId:'test_'+name,type:'material',stats:{}}});
  await f.load();const result=await f.act({type:'upgradeItem',itemId:base,useProtection:false});
  assert.equal(result.operation.outcome,'applied');assert.equal((result.operation.result as any).success,true);
  const worn=result.game!.player!.equipped.helmet!;
  assert.equal(worn.ascensionLevel,2);assert.equal(worn.upgradeLevel,3);assert.equal(worn.id,base);
});
