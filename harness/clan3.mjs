import crypto from 'node:crypto';
const E = await import(process.env.ENGINE || './engine-patched.js');
const now = Date.UTC(2026,10,8,12);
const world = {tables:{}}, pool = new E.NativePool(world, () => now), store = new E.GameStore(pool.asPool(), {now:()=>now});
// canonical player
const can = {id: 9201, displayName:'C'}; pool.ensurePlayer(can); const tok=crypto.randomUUID(); const s=await store.acquire(can,tok,0,false);
await store.create(can,{sessionToken:tok,operationId:crypto.randomUUID(),expectedVersion:s.version,resetVersion:0,sessionGeneration:s.sessionGeneration},{name:'Can',classId:'warrior'});
pool.table('players').find(r=>r.telegram_id==9201).progress_json.player.gold=150000;
// legacy player
const leg = {id: 9301, displayName:'L'}; pool.ensurePlayer(leg);
const call=(u,path,method='GET',body)=>E.handleProgressRequest(world,{path,method,headers:{'x-game-reset-version':String(pool.table('players').find(r=>r.telegram_id==u.id).reset_version),'x-game-language':'ru'},projectionProtocol:1,...(body?{body}:{})},u,{now:()=>now});
for (const [u,name,tag] of [[can,'Can Clan','CAN'],[leg,'Leg Clan','LEG']]) {
  const r = await call(u,'/api/clan/create','POST',{name,tag,description:'d',operationId:crypto.randomUUID(),gold:150000,expectedPriceGold:100000});
  console.log(u.id, 'create', r.status, JSON.stringify(r.body).slice(0,250));
  const me = await call(u,'/api/clan/me'); console.log(u.id,'me',me.status,JSON.stringify(me.body).slice(0,150));
}
console.log('canonical gold after', pool.table('players').find(r=>r.telegram_id==9201).progress_json.player.gold);
E.validateNativeWorld(world); console.log('world valid');
