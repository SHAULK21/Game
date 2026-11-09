import {fixture, uuid} from './fixture.mjs';
const f = await fixture();
const r = await f.request(f.users[0], '/api/clan/create', {name: 'Native Clan', tag: 'NTV', description: '', expectedPriceGold: 100000, operationId: uuid()});
console.log(r.status, JSON.stringify(r.body).slice(0, 600));
