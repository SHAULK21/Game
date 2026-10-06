import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {registerBalanceTelemetry,validTelemetryEvent} from '../server/balanceTelemetry';

test('real PostgreSQL newcomer funnel, checkpoints, return sessions and admin access',async()=>{
 const db=new PGlite();
 const query=async(sql:string,args:any[]=[])=>{const r=await db.query<any>(sql,args);return {...r,rowCount:r.affectedRows||r.rows.length};};
 const pool:any={query,connect:async()=>({query,release(){}})};
 const routes=new Map<string,any[]>();const app:any={get:(p:string,...h:any[])=>routes.set('GET '+p,h),post:(p:string,...h:any[])=>routes.set('POST '+p,h)};
 registerBalanceTelemetry(app,()=>pool,(_req,_res,next)=>next(),(req,res,next)=>req.authUser!.id===1?next():res.status(403).json({error:'admin'}));
 const call=async(method:string,path:string,user=1,body:any={},params:any={})=>{
  let status=200,result:any;const req:any={authUser:{id:user},body,query:params};const res:any={status:(s:number)=>{status=s;return res;},json:(r:any)=>{result=r;return res;}};
  for(const h of routes.get(method+' '+path)!){let next=false;await h(req,res,()=>{next=true;});if(!next)break;}return {status,body:result};
 };
 const id=(n:number)=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
 const event=(n:number,level:number,sequence=1,durationMs=0,startLevel=1)=>({kind:'session',id:id(n),sequence,level,durationMs,netGold:0,netSilver:0,startLevel,maxLevel:level,screen:'hunter',state:'idle',energy:40});
 const send=(user:number,e:any)=>call('POST','/api/telemetry',user,{events:[e]});
 try {
  const schema=(await fs.readFile('server/schema.sql','utf8')).replace('CREATE EXTENSION IF NOT EXISTS pgcrypto;','');
  await db.exec(schema);await db.exec(schema);
  await query("INSERT INTO players(telegram_id,display_name) VALUES(1,'Admin'),(2,'Stopped'),(3,'Returned'),(4,'Legacy')");
  await query("UPDATE players SET preferred_interface=CASE telegram_id WHEN 1 THEN 'fantasy-beta' WHEN 2 THEN 'modern' WHEN 3 THEN 'fantasy' END, preferred_language=CASE telegram_id WHEN 1 THEN 'uk' WHEN 2 THEN 'ru' WHEN 3 THEN 'uk' END");
  await send(1,event(1,1));
  await send(2,event(2,1));await send(2,event(2,2,2,60000));await send(2,{...event(2,3,3,180000),state:'defeat',energy:0});
  await send(2,event(2,9,1,999999)); // stale snapshot must not invent a milestone
  await send(3,event(3,1));await send(3,event(3,2,2,120000));
  await query("UPDATE balance_sessions SET created_at=NOW()-INTERVAL '2 days',updated_at=NOW()-INTERVAL '2 days'");
  await send(3,event(5,4,1,60000,2));
  const legacy:any=event(4,3,1,60000);delete legacy.startLevel;delete legacy.maxLevel;await send(4,legacy);
  const battle={kind:'battle',id:id(20),sessionId:id(2),level:3,classId:'warrior',region:'reg_plains',monster:'m_wolf',difficulty:'standard',outcome:'defeat',rounds:5,durationMs:10000,gold:0,silver:0,exp:0};
  await send(2,battle);
  assert.equal((await call('GET','/api/admin/player-analytics',2)).status,403);
  assert.equal((await call('GET','/api/admin/player-analytics',1,{}, {days:365})).status,400);
  const r=await call('GET','/api/admin/player-analytics');assert.equal(r.status,200);
  assert.equal(r.body.summary.players,3);assert.equal(r.body.summary.newcomers,2);assert.equal(r.body.summary.returned,1);
  assert.equal(r.body.summary.stopped_early,1);
  assert.equal(r.body.funnel.find((x:any)=>x.level===3).reached,2);
  assert.equal(r.body.funnel.find((x:any)=>x.level===4).reached,1);
  assert.equal(r.body.funnel.find((x:any)=>x.level===9).reached,0);
  assert.equal(Number(r.body.milestones.find((x:any)=>x.level===4).minutes),3,'time across two sessions adds active time only');
  const p=r.body.players.find((x:any)=>String(x.telegram_id)==='2');assert.equal(p.last_level,3);assert.equal(p.energy,0);assert.equal(p.last_outcome,'defeat');
  assert.equal(p.preferred_interface,'modern');assert.equal(p.preferred_language,'ru');
  assert.deepEqual(Object.fromEntries(r.body.interfaceUsage.map((x:any)=>[x.interface_style??'unknown',x.players])),{modern:1,fantasy:1,unknown:1});
  assert.deepEqual(Object.fromEntries(r.body.languageUsage.map((x:any)=>[x.language??'unknown',x.players])),{ru:1,uk:1,unknown:1});
  await query("UPDATE players SET preferred_interface='fantasy-beta',preferred_language='ru' WHERE telegram_id=4");
  const updated=await call('GET','/api/admin/player-analytics');
  assert.equal(updated.body.interfaceUsage.find((x:any)=>x.interface_style==='fantasy-beta').players,1,'admin is excluded from preference counts');
  assert.equal(updated.body.players.find((x:any)=>String(x.telegram_id)==='4').preferred_interface,'fantasy-beta');
  assert.equal(updated.body.languageUsage.find((x:any)=>x.language==='ru').players,2);
  assert.equal(r.body.battles[0].defeats,1);
  assert.equal((await query('SELECT count(*)::int AS n FROM balance_progress WHERE level=9')).rows[0].n,0);
  assert.equal(validTelemetryEvent({...event(2,3),energy:-1}),false);
  assert.equal(validTelemetryEvent({...event(2,3),screen:'<script>'}),false);
 }finally{await db.close();}
});
