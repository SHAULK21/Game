import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {createPaidClan} from '../server/clanCreation';

test('paid clan creation uses server Premium, rejects insufficient funds and replays without creating twice',async()=>{
 const db=new PGlite();
 const query=async(sql:string,args:any[]=[])=>{const r=await db.query<Record<string,any>>(sql,args);return {...r,rowCount:r.affectedRows||r.rows.length};};
 const client={query,release:()=>{}};const pool={query,connect:async()=>client};
 try {
  const schema=(await fs.readFile('server/schema.sql','utf8')).replace('CREATE EXTENSION IF NOT EXISTS pgcrypto;','');
  await db.exec(schema);await db.exec(schema);
  await query("INSERT INTO players (telegram_id,display_name,character_name,premium_until) VALUES (1,'Real Name','  Ranger  ',NULL),(2,'Private Name',NULL,NOW()+INTERVAL '1 day'),(3,'Another Name','',NULL)");
  const normal={operationId:'00000000-0000-4000-8000-000000000061',name:'Стражи',tag:'GRD',description:'Первый клан',gold:100000,expectedPriceGold:100000};
  await assert.rejects(()=>createPaidClan(pool,1,{...normal,gold:99999}),/100000/);
  await assert.rejects(()=>createPaidClan(pool,1,{...normal,gold:50000,expectedPriceGold:50000}),/Стоимость изменилась/);
  assert.equal((await query('SELECT COUNT(*)::int AS count FROM clans')).rows[0].count,0);
  const result=await createPaidClan(pool,1,normal);assert.equal(result.priceGold,100000);
  assert.deepEqual(await createPaidClan(pool,1,normal),result);
  await assert.rejects(()=>createPaidClan(pool,1,{...normal,name:'Другая группа'}),/изменился/);
  await assert.rejects(()=>createPaidClan(pool,3,{...normal,operationId:'00000000-0000-4000-8000-000000000063'}),/занят/);
  assert.equal((await query('SELECT clan_id FROM players WHERE telegram_id=3')).rows[0].clan_id,null);
  const discounted={...normal,operationId:'00000000-0000-4000-8000-000000000062',name:'Следопыты',tag:'RNG',gold:50000,expectedPriceGold:50000};
  const premium=await createPaidClan(pool,2,discounted);assert.equal(premium.priceGold,50000);
  await query('UPDATE players SET premium_until=NULL WHERE telegram_id=2');
  assert.deepEqual(await createPaidClan(pool,2,discounted),premium,'a lost response can replay after Premium expires');
  assert.equal((await query('SELECT COUNT(*)::int AS count FROM clans')).rows[0].count,2);
  assert.equal((await query('SELECT COUNT(*)::int AS count FROM clan_creation_requests')).rows[0].count,2);
  const profile=await query("SELECT COALESCE(NULLIF(BTRIM(character_name), ''), 'Игрок') AS display_name FROM players ORDER BY telegram_id");
  assert.deepEqual(profile.rows.map(p=>p.display_name),['Ranger','Игрок','Игрок']);
  const server=await fs.readFile('server/index.ts','utf8');
  const market=server.slice(server.indexOf("app.get('/api/market/listings'"),server.indexOf("app.get('/api/market/income'"));
  assert.ok(market.includes("BTRIM(p.character_name)"));assert.ok(market.includes("BTRIM(character_name)"));
  assert.ok(!market.includes('p.display_name'));assert.ok(!market.includes('p.username'));assert.ok(!market.includes('authUser!.displayName'));
 } finally {await db.close();}
});
