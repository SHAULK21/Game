import {fixture, uuid, handleProgressRequest, now} from './fixture.mjs';
const f = await fixture();
const call = (u, path, method='GET', body) => handleProgressRequest(f.world, {path, method, headers: {'x-game-reset-version':'0','x-game-language':'ru'}, projectionProtocol:1, ...(body?{body}:{})}, u.identity, {now: () => now});
let r = await call(f.users[0], '/api/premium/status'); console.log('premium', r.status, JSON.stringify(r.body).slice(0,200));
r = await call(f.users[0], '/api/clan/create', 'POST', {name: 'Native Clan', tag: 'NTV', description: 'd', operationId: uuid(), gold: 150000, expectedPriceGold: 100000});
console.log('create', r.status, JSON.stringify(r.body).slice(0,300));
r = await call(f.users[0], '/api/clan/me'); console.log('me', r.status, JSON.stringify(r.body).slice(0,300));
r = await call(f.users[0], '/api/clans'); console.log('clans', r.status, JSON.stringify(r.body).slice(0,300));
