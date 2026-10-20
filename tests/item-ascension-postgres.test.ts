import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {GameStore} from '../server/gameStore';
import {GameActor} from '../server/gameActor';
import {validateLegacyProgress} from '../server/progressValidation';
import {expeditionDatabase} from './helpers/expeditionDatabase';

test('production SQL merges the locked ledger once under concurrent retries and retains rank after reconstruction',async()=>{
  const db=await expeditionDatabase(),identity={id:9751,displayName:'Коваль'},token=crypto.randomUUID(),now=1792272000000;
  try{
    await db.query('INSERT INTO players(telegram_id) VALUES($1)',[identity.id]);
    const store=new GameStore(db.pool,{now:()=>now});let view=await store.acquire(identity,token,0,false);
    const operation=()=>({sessionToken:token,operationId:crypto.randomUUID(),expectedVersion:view.version,resetVersion:view.resetVersion,sessionGeneration:view.sessionGeneration});
    view=await store.create(identity,operation(),{name:'Коваль',classId:'warrior'});
    await db.query("UPDATE players SET progress_json=jsonb_set(progress_json,'{player,worldPlace}','\"settlement\"') WHERE telegram_id=$1",[identity.id]);
    const base=crypto.randomUUID(),donor=crypto.randomUUID();
    const item={templateId:'sql_helm',name:'Шолом',type:'helmet',rarity:'rare',level:10,upgradeLevel:0,stats:{defense:100},icon:'',sellPrice:100,disassembleYield:{silver:10}};
    for(const id of [base,donor])await db.query("INSERT INTO owned_items(id,owner_telegram_id,item_json,quantity,origin) VALUES($1,$2,$3::jsonb,1,'game_command')",[id,identity.id,JSON.stringify(item)]);
    view=await store.load(identity,token);
    const op=operation(),command={type:'mergeItems',itemId:base,materialId:donor};
    const results=await Promise.all([store.operation(identity,op,command),store.operation(identity,op,command)]);
    assert.equal(results.filter(result=>result.operation.replayed).length,1);
    const rows=(await db.query('SELECT * FROM owned_items WHERE owner_telegram_id=$1',[identity.id])).rows;
    assert.equal(rows.find((row:any)=>row.id===base)!.item_json.ascensionLevel,1);assert.equal(rows.some((row:any)=>row.id===donor),false);
    await assert.rejects(store.operation(identity,{...op,operationId:crypto.randomUUID()},command),{code:'VERSION_CONFLICT'});
    const restored=await new GameStore(db.pool,{now:()=>now}).load(identity,token);
    assert.equal(restored.game!.player!.inventory.find(item=>item.id===base)!.ascensionLevel,1);
  }finally{await db.close();}
});

test('one-time legacy migration cannot import a forged ascension rank',async()=>{
  const actor=await new GameActor({user:{id:9752,first_name:'Коваль'},locale:'uk',resetVersion:0,admin:false,
    premium:{active:false,premiumUntil:null,priceStars:150,periodDays:30},now:()=>1792272000000}).initialize();
  await actor.invoke('createCharacter','Коваль','warrior');
  const original={resetVersion:0,player:structuredClone(actor.current.player!),quests:actor.current.quests,achievements:actor.current.achievements,activeDungeonRun:null};
  for(const item of [...original.player.inventory,...Object.values(original.player.equipped).filter(Boolean)]) item!.ascensionLevel=5;
  const migrated=validateLegacyProgress(original,9752,0,actor.catalog);
  assert([...migrated.player.inventory,...Object.values(migrated.player.equipped).filter(Boolean)].every(item=>item!.ascensionLevel===undefined));
  assert([...original.player.inventory,...Object.values(original.player.equipped).filter(Boolean)].every(item=>item!.ascensionLevel===5),'backup source remains untouched');
});
