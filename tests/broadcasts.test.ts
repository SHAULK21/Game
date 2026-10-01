import test from 'node:test';
import assert from 'node:assert/strict';
import {renderBroadcast,NOTIFICATION_TEMPLATES} from '../src/utils/notificationTemplates';
import {registerSocialFeatures} from '../server/socialFeatures';
test('notification templates are ready without manual text and validate edits',()=>{
 assert.equal(NOTIFICATION_TEMPLATES.length,10);
 for(const template of NOTIFICATION_TEMPLATES)assert.equal(renderBroadcast(template.id),template.text);
 assert.ok(renderBroadcast('maintenance','В 12:00 по Киеву.').endsWith('В 12:00 по Киеву.'));
 assert.throws(()=>renderBroadcast('unknown'));assert.throws(()=>renderBroadcast('update','x'.repeat(1001)));
});
test('only a server-authorized administrator can inspect or enqueue broadcasts',async()=>{
 const old=process.env.ADMIN_TELEGRAM_ID;process.env.ADMIN_TELEGRAM_ID='1';let queries=0;
 const app:any={routes:new Map(),get(p:string,...h:any[]){this.routes.set('GET '+p,h);},post(p:string,...h:any[]){this.routes.set('POST '+p,h);}};
 const pool:any={query:async()=>{queries++;return {rows:[]};}};
 registerSocialFeatures(app,()=>pool,(_r,_s,next)=>next(),async()=>({username:'bot'}) as any,'https://game.test');
 try{for(const path of ['GET /api/admin/broadcasts','POST /api/admin/broadcasts']){
  let status=200;const req:any={authUser:{id:2},body:{}};const res:any={status:(s:number)=>{status=s;return res;},json:()=>res};
  for(const handler of app.routes.get(path)){let next=false;await handler(req,res,()=>{next=true;});if(!next)break;}
  assert.equal(status,403);
 }assert.equal(queries,0);}finally{if(old===undefined)delete process.env.ADMIN_TELEGRAM_ID;else process.env.ADMIN_TELEGRAM_ID=old;}
});
