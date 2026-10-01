import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import {PGlite} from '@electric-sql/pglite';import {leavePlayerClan} from '../server/clanLeave';
test('members leave; an owner hands leadership to an officer; the last owner must confirm disband',async()=>{
 const db=new PGlite();const query=async(sql:string,args:any[]=[])=>db.query<Record<string,any>>(sql,args);const pool={connect:async()=>({query,release:()=>{}})};
 try{
 await db.exec((await fs.readFile('server/schema.sql','utf8')).replace('CREATE EXTENSION IF NOT EXISTS pgcrypto;',''));
 await query("INSERT INTO players (telegram_id) VALUES (1),(2),(3),(4)");
 const clan=(await query("INSERT INTO clans (tag,name,owner_telegram_id) VALUES ('GRD','Стражи',1) RETURNING id")).rows[0].id;
 await query("INSERT INTO clan_members (clan_id,telegram_id,role) VALUES ($1,1,'owner'),($1,2,'member'),($1,3,'officer'),($1,4,'recruit')",[clan]);await query('UPDATE players SET clan_id=$1',[clan]);
 await leavePlayerClan(pool,4,clan,false);assert.equal((await query('SELECT clan_id FROM players WHERE telegram_id=4')).rows[0].clan_id,null);
 await leavePlayerClan(pool,1,clan,false);assert.equal(Number((await query('SELECT owner_telegram_id FROM clans WHERE id=$1',[clan])).rows[0].owner_telegram_id),3);assert.equal((await query('SELECT role FROM clan_members WHERE telegram_id=3')).rows[0].role,'owner');
 await leavePlayerClan(pool,2,clan,false);await assert.rejects(()=>leavePlayerClan(pool,3,clan,false),/Подтвердите/);assert.equal((await query('SELECT COUNT(*)::int AS n FROM clans')).rows[0].n,1);
 assert.deepEqual(await leavePlayerClan(pool,3,clan,true),{ok:true,disbanded:true});assert.equal((await query('SELECT COUNT(*)::int AS n FROM clans')).rows[0].n,0);assert.equal((await query('SELECT clan_id FROM players WHERE telegram_id=3')).rows[0].clan_id,null);
 }finally{await db.close();}
});
