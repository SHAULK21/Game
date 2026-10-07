import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {validateTelegramInitData} from '../server/telegramAuth';
const now=1791396000000,token='test-bot-secret';
function sign(user:any={id:1,first_name:'Actor'},authDate=Math.floor(now/1000)){
 const params=new URLSearchParams({auth_date:String(authDate),query_id:'signed-session',user:JSON.stringify(user)});
 const key=crypto.createHmac('sha256','WebAppData').update(token).digest();
 const payload=[...params.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>k+'='+v).join('\n');
 params.set('hash',crypto.createHmac('sha256',key).update(payload).digest('hex'));return params.toString();
}
test('Telegram identity comes from verified signed data; tampering, missing signatures and wrong secrets fail',()=>{
 const signed=sign();assert.equal(validateTelegramInitData(signed,token,now).id,1);
 const tampered=new URLSearchParams(signed);tampered.set('user',JSON.stringify({id:2,first_name:'Actor'}));assert.throws(()=>validateTelegramInitData(tampered.toString(),token,now),/verification/);
 assert.throws(()=>validateTelegramInitData(signed,'different-secret',now),/verification/);
 assert.throws(()=>validateTelegramInitData('user={"id":2}',token,now));
 assert.throws(()=>validateTelegramInitData('',token,now));
 const duplicate=new URLSearchParams(signed);duplicate.append('user','{"id":2}');assert.throws(()=>validateTelegramInitData(duplicate.toString(),token,now),/Duplicate/);
});
test('even correctly signed invalid IDs and expired authentication are rejected',()=>{
 for(const id of [0,-1,null,Number.MAX_SAFE_INTEGER+1])assert.throws(()=>validateTelegramInitData(sign({id}),token,now),/user ID/);
 assert.throws(()=>validateTelegramInitData(sign({id:1},Math.floor(now/1000)-8*86400),token,now),/expired/);
 assert.throws(()=>validateTelegramInitData(sign(),'',now),/token/);
});
