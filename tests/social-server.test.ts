import test from 'node:test';
import assert from 'node:assert/strict';
import {registerSocialFeatures} from '../server/socialFeatures';
function harness(query:(sql:string,args:any[])=>Promise<any>){
 const routes=new Map<string,any[]>();const app:any={get:(p:string,...h:any[])=>routes.set('GET '+p,h),post:(p:string,...h:any[])=>routes.set('POST '+p,h)};
 const client={query:(sql:string,args:any[]=[])=>query(sql,args),release:()=>{}};
 const pool:any={...client,connect:async()=>client};registerSocialFeatures(app,()=>pool,(_req,_res,next)=>next(),async()=>({username:'game_bot'}) as any,'https://game.test');
 return async(method:string,path:string,body:any={},user=1,allowsWriteToPm=false)=>{
  let status=200,response:any;const req:any={body,authUser:{id:user,allowsWriteToPm},headers:{},params:{}};const res:any={status:(code:number)=>{status=code;return res;},json:(value:any)=>{response=value;return res;}};
  for(const handler of routes.get(method+' '+path)!){let next=false;await handler(req,res,()=>{next=true;});if(!next)break;}
  return {status,body:response};
 };
}
const empty={rows:[],rowCount:0};
test('admin self Premium is authenticated and retries do not extend it twice',async()=>{
 const old=process.env.ADMIN_TELEGRAM_ID;process.env.ADMIN_TELEGRAM_ID='1';let grant=false,updates=0;
 const call=harness(async(sql,args)=>{
  if(sql.startsWith('INSERT INTO admin_premium_grants')){if(grant)return empty;grant=true;return {rows:[{id:args[0]}],rowCount:1};}
  if(sql.startsWith('UPDATE players SET premium_until'))updates++;
  if(sql.startsWith('SELECT premium_until'))return {rows:[{premium_until:'2026-11-01T00:00:00Z'}]};return empty;
 });
 try{
  const body={days:30,operationId:'00000000-0000-4000-8000-000000000001'};
  assert.equal((await call('POST','/api/admin/premium/self',body,2)).status,403);assert.equal(updates,0);
  assert.equal((await call('POST','/api/admin/premium/self',body)).status,200);await call('POST','/api/admin/premium/self',body);assert.equal(updates,1);
  assert.equal((await call('POST','/api/admin/premium/self',{...body,days:Infinity})).status,400);
 }finally{if(old===undefined)delete process.env.ADMIN_TELEGRAM_ID;else process.env.ADMIN_TELEGRAM_ID=old;}
});
test('PvP consumes one ticket and updates both ratings once; retries return the same receipt',async()=>{
 let cached:any=null,updates=0,inserts=0,notice=0;
 const call=harness(async(sql,args)=>{
   if(sql.startsWith('SELECT * FROM pvp_matches'))return {rows:cached?[cached]:[]};
   if(sql.startsWith('SELECT v.*,p.class_id'))return {rows:[{telegram_id:'1',class_id:'warrior',stance:'balanced',name:'A',enrolled:true,rating:1000,tickets:5,ticket_day:new Date().toISOString().slice(0,10)},{telegram_id:'2',class_id:'archer',stance:'assault',name:'B',enrolled:true,rating:1000}]};
   if(sql.startsWith('UPDATE pvp_profiles'))updates++;
   if(sql.startsWith('INSERT INTO pvp_matches')){inserts++;cached={attacker:args[1],defender:args[2],result:JSON.parse(args[3])};}
   if(sql.startsWith('INSERT INTO game_notifications'))notice++;
   return empty;
 });
 const body={targetId:2,matchId:'00000000-0000-4000-8000-000000000010'};
 const first=await call('POST','/api/pvp/challenge',body);assert.equal(first.status,200);assert.equal(updates,2);assert.equal(inserts,1);assert.equal(notice,1);
 const retry=await call('POST','/api/pvp/challenge',body);assert.deepEqual(retry.body,first.body);assert.equal(updates,2);
 assert.equal((await call('POST','/api/pvp/challenge',body,3)).status,400);
 assert.equal((await call('POST','/api/pvp/challenge',{...body,stars:50})).status,400);
});
test('PvP rejects self fights, clan farming, empty tickets and duplicate opponents before any rating mutation',async()=>{
 for(const reason of ['clan','tickets','cooldown','pair']){
  let writes=0;
  const call=harness(async(sql)=>{
   if(sql.startsWith('SELECT v.*,p.class_id'))return {rows:[{telegram_id:1,name:'A',enrolled:true,rating:1000,tickets:reason==='tickets'?0:5,ticket_day:new Date().toISOString().slice(0,10),clan_id:reason==='clan'?'same':null,last_fight_at:reason==='cooldown'?new Date():null},{telegram_id:2,name:'B',enrolled:true,rating:1000,clan_id:reason==='clan'?'same':null}]};
   if(sql.startsWith('SELECT id FROM pvp_matches'))return {rows:reason==='pair'?[{id:'old'}]:[],rowCount:reason==='pair'?1:0};
   if(sql.startsWith('UPDATE pvp_profiles'))writes++;return empty;
  });
  assert.equal((await call('POST','/api/pvp/challenge',{targetId:2,matchId:'00000000-0000-4000-8000-000000000011'})).status,400,reason);assert.equal(writes,0);
 }
});
test('notification settings whitelist events and schedules cannot use unbounded energy',async()=>{
 let saved:any,inserted:any[]=[];
 const call=harness(async(sql,args)=>{if(sql.startsWith('UPDATE players SET notification_settings'))saved=JSON.parse(args[0]);if(sql.startsWith('INSERT INTO game_notifications'))inserted.push(args);return empty;});
 await call('POST','/api/notifications/settings',{enabled:true,market:false,unknown:true});assert.equal(saved.market,false);assert.equal(saved.energy,true);assert.equal(saved.unknown,undefined);
 assert.equal((await call('POST','/api/notifications/schedule',{energy:1,maxEnergy:Infinity})).status,400);
 assert.equal((await call('POST','/api/notifications/schedule',{energy:50,maxEnergy:60,regenAt:Date.now()})).status,200);
 assert.deepEqual(inserted.map(i=>i[2]).sort(),['arena','energy']);
});
test('referral grants both players once at level 10 and never for an unqualified friend',async()=>{
 let claimed=false,updates=0,level=9;
 const call=harness(async(sql,args)=>{
  if(sql.startsWith('SELECT level,referred_by'))return {rows:[{level,referred_by:2}]};
  if(sql.startsWith('INSERT INTO referral_rewards')){if(claimed)return empty;claimed=true;return {rows:[{invitee:1}],rowCount:1};}
  if(sql.startsWith('UPDATE players SET premium_until'))updates++;
  if(sql.startsWith('SELECT telegram_id,premium_until'))return {rows:[]};return empty;
 });
 assert.equal((await call('POST','/api/referrals/check')).body.rewarded,false);assert.equal(updates,0);
 level=10;assert.equal((await call('POST','/api/referrals/check')).body.rewarded,true);assert.equal(updates,2);
 assert.equal((await call('POST','/api/referrals/check')).body.rewarded,false);assert.equal(updates,2);
});
test('clan management refuses promotion above officer rights and transfers owner and clan together',async()=>{
 let role='officer';const writes:string[]=[];
 const call=harness(async(sql,args)=>{
  if(sql.startsWith('SELECT c.* FROM clans'))return {rows:[{id:'clan',level:1,treasury_gold:2000}]};
  if(sql.startsWith('SELECT * FROM clan_members'))return {rows:[{telegram_id:1,role},{telegram_id:2,role:'recruit'}]};
  if(sql.startsWith('UPDATE')||sql.startsWith('INSERT INTO clan_management'))writes.push(sql);return empty;
 });
 assert.equal((await call('POST','/api/clan/manage',{action:'role',targetId:2,role:'officer'})).status,400);assert.equal(writes.length,0);
 assert.equal((await call('POST','/api/clan/manage',{action:'transfer',targetId:2})).status,400);
 role='owner';assert.equal((await call('POST','/api/clan/manage',{action:'transfer',targetId:2})).status,200);
 assert.ok(writes.some(s=>s.startsWith('UPDATE clan_members SET role=CASE')));assert.ok(writes.some(s=>s.startsWith('UPDATE clans SET owner_telegram_id')));
});

test('notification enablement trusts signed write access, not a client body claim',async()=>{
 const grants:boolean[]=[];
 const call=harness(async(sql,args)=>{if(sql.startsWith('UPDATE players SET notification_settings'))grants.push(args[2]);return empty;});
 await call('POST','/api/notifications/settings',{enabled:true,allowsWriteToPm:true},1,false);
 await call('POST','/api/notifications/settings',{enabled:true},1,true);
 await call('POST','/api/notifications/settings',{enabled:false},1,true);
 assert.deepEqual(grants,[false,true,false]);
});
