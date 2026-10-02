import test from 'node:test';
import assert from 'node:assert/strict';
import { gameMessagePayload, gameMenuButton } from '../server/telegramGameMessages';
import { runNotificationBatch } from '../server/socialFeatures';

const url='https://game.example/play';
const keyboard={inline_keyboard:[[{text:'⚔️ Играть',web_app:{url}}]]};

test('bot messages open the Mini App inline; the composer menu opens the same game',()=>{
 assert.deepEqual(gameMessagePayload(123,'⚡ Энергия восстановлена.',url),{chat_id:123,text:'⚡ Энергия восстановлена.',reply_markup:keyboard});
 assert.deepEqual(gameMenuButton(url),{type:'web_app',text:'🎮 Играть',web_app:{url}});
 for(const invalid of ['', 'not a URL', 'http://game.example', 'javascript:alert(1)', 'https://user:secret@game.example']) {
  assert.deepEqual(gameMessagePayload(123,'Сообщение',invalid),{chat_id:123,text:'Сообщение'});
  assert.equal(gameMenuButton(invalid),null);
 }
});

function harness(rows:any[]) {
 const writes:Array<{sql:string;args:any[]}>=[];
 const client:any={query:async(sql:string,args:any[]=[])=>{
  if(sql.startsWith('SELECT n.*'))return {rows};
  if(sql.startsWith('SELECT premium_until'))return {rows:[{active:false}]};
  writes.push({sql,args});return {rows:[],rowCount:1};
 },release:()=>{}};
 const pool:any={connect:async()=>client};
 return {pool,writes};
}
const notice=(id:number,category:string,settings:any={enabled:true})=>({id,telegram_id:123,category,event_key:category+'_'+id,text:'Событие '+category,bot_started:true,notification_settings:settings});

test('energy, mining and other queued notifications carry a play button; delivered notices are marked',async()=>{
 const rows=['energy','mining','arena','market','clan','pvp','premium','referral','announcements'].map((category,i)=>notice(i+1,category));
 const {pool,writes}=harness(rows);const sent:any[]=[];
 await runNotificationBatch(()=>pool,async(method,payload)=>{sent.push({method,payload});return {} as any;},url);
 assert.equal(sent.length,rows.length);
 for(const [i,request] of sent.entries()) {
  assert.equal(request.method,'sendMessage');
  assert.deepEqual(request.payload,{chat_id:123,text:rows[i].text,reply_markup:keyboard});
 }
 assert.equal(writes.filter(w=>w.sql.startsWith('UPDATE game_notifications SET sent_at')).length,rows.length);
 assert(writes.some(w=>w.sql==='COMMIT'));
});

test('notification subscription and category opt-outs are respected',async()=>{
 const rows=[notice(1,'energy',{enabled:false}),notice(2,'mining',{enabled:true,mining:false}),{...notice(3,'arena'),bot_started:false}];
 const {pool,writes}=harness(rows);let sent=0;
 await runNotificationBatch(()=>pool,async()=>{sent++;return {} as any;},url);
 assert.equal(sent,0);
 assert.equal(writes.filter(w=>w.sql.includes("INTERVAL '1 hour'")).length,3);
});

test('failed Telegram deliveries are retried and blocked bots are recorded without marking delivery',async()=>{
 for(const error of ['temporary network error','Forbidden: bot was blocked by the user']) {
  const {pool,writes}=harness([notice(1,'energy')]);
  await runNotificationBatch(()=>pool,async()=>{throw new Error(error);},url);
  assert(writes.some(w=>w.sql.includes('attempts=attempts+1')));
  assert.equal(writes.some(w=>w.sql.startsWith('UPDATE game_notifications SET sent_at')),false);
  assert.equal(writes.some(w=>w.sql.includes('bot_started=FALSE')),error.includes('blocked'));
 }
});
