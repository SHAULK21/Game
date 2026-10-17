import test from 'node:test';
import assert from 'node:assert/strict';
import {compactGameReply, expandGameReply} from '../src/utils/gameProjection';
import {telegramRequest} from '../src/utils/gameFetch';
function envelope() {
  const shared = {player: {userId: '9601', gold: 120, inventory: [{id: 'one', name: 'sword', description: 'x'.repeat(3000)}]}, quests: [{id: 'quest', progress: 3}], achievements: [], activeDungeonRun: null};
  return {canonical: true, ownerId: '9601', version: 9, resetVersion: 2, game: {...shared, turnPhase: 'player'}, save: {...shared, resetVersion: 2}};
}
test('compact progress preserves the complete projection and receipt across JSON transport',()=>{
  for(const body of [envelope(), {_progress: envelope(), _operation: {id:'original',outcome:'applied',replayed:true},itemId:'one'}]) {
    const original=JSON.stringify(body), compact=compactGameReply({status:200,body});
    assert.ok(JSON.stringify(compact).length<original.length*0.7);
    assert.deepEqual(expandGameReply(JSON.parse(JSON.stringify(compact))).body,body);
    assert.equal(JSON.stringify(body),original,'packing never mutates the saved result');
  }
});
test('SDK negotiates compact progress and restores the ordinary response body',async()=>{
  const body=envelope();
  const response=await telegramRequest({call(_name,input,callback){assert.equal(input.projectionProtocol,1);callback(null,JSON.parse(JSON.stringify(compactGameReply({status:200,body}))));}},'/api/progress');
  assert.deepEqual(await response.json(),body);
});
test('legacy saves, distinct values and replies from older deployments remain unchanged',()=>{
  const body=envelope();body.game.player={...body.game.player,gold:99};
  const result=expandGameReply(JSON.parse(JSON.stringify(compactGameReply({status:409,body}))));
  assert.equal(result.body.game.player.gold,99);assert.equal(result.body.save.player.gold,120);
  const legacy={status:200,body:{canonical:false,save:{player:{userId:'9601'}},game:null}};
  assert.equal(compactGameReply(legacy),legacy);assert.equal(expandGameReply(legacy),legacy);
});
