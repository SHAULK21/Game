import test from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {runNotificationBatch} from '../server/socialFeatures';

test('notification delivery coalesces existing energy backlog and enforces a cooldown in PostgreSQL',async()=>{
 const db=new PGlite();
 const query=async(sql:string,args:any[]=[])=>{const r=await db.query<Record<string,any>>(sql,args);return {...r,rowCount:r.affectedRows||r.rows.length};};
 const pool:any={connect:async()=>({query,release:()=>{}})};
 try {
  await db.exec(`CREATE TABLE players(telegram_id bigint PRIMARY KEY,notification_settings jsonb,bot_started boolean,preferred_language text);
   CREATE TABLE game_notifications(id bigserial PRIMARY KEY,telegram_id bigint,event_key text,category text,text text,due_at timestamptz DEFAULT NOW(),sent_at timestamptz,read_at timestamptz,attempts integer DEFAULT 0,next_attempt_at timestamptz DEFAULT NOW());
   INSERT INTO players VALUES(1,'{"enabled":true}',true,'ru'),(2,'{"enabled":false}',true,'ru');
   INSERT INTO game_notifications(telegram_id,event_key,category,text,due_at) VALUES
   (1,'energy_old','energy','old',NOW()-INTERVAL '5 minutes'),
   (1,'energy_latest','energy','latest',NOW()-INTERVAL '1 minute'),
   (2,'energy_disabled','energy','disabled',NOW()-INTERVAL '1 minute');`);
  const sent:string[]=[];
  const telegram:any=async(_method:string,payload:any)=>{sent.push(payload.text);return {};};
  await runNotificationBatch(()=>pool,telegram,'https://game.example');
  assert.deepEqual(sent,['latest']);
  await db.exec(`INSERT INTO game_notifications(telegram_id,event_key,category,text) VALUES(1,'energy_repeat','energy','repeat');`);
  await runNotificationBatch(()=>pool,telegram,'https://game.example');
  assert.deepEqual(sent,['latest'],'new keys within 30 minutes do not spam');
  await db.exec(`UPDATE players SET notification_settings='{"enabled":true}' WHERE telegram_id=2;`);
  await runNotificationBatch(()=>pool,telegram,'https://game.example');
  assert.deepEqual(sent,['latest'],'enabling notifications does not drain disabled backlog');
  assert.equal((await query('SELECT count(*)::int AS count FROM game_notifications WHERE sent_at IS NULL')).rows[0].count,0);
 }finally{await db.close();}
});
