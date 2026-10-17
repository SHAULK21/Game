import {test} from 'node:test';
import assert from 'node:assert/strict';
import {telegramRequest, type ServerlessTransport} from '../src/utils/gameFetch';

test('SDK receives operation fencing headers without a client identity override', async () => {
  const transport: ServerlessTransport = {call(name, input, callback) {
    assert.equal(name, 'gameApi'); assert.equal(input.method, 'POST');
    assert.deepEqual(input.headers, {'x-game-operation': 'original-op', 'x-game-version': '17'});
    assert.deepEqual(input.body, {type: 'drinkBeer'});
    callback(null, {status: 200, body: {saved: true}});
  }};
  const response = await telegramRequest(transport, '/api/progress/command', {method: 'POST',
    headers: {'X-Game-Operation': 'original-op', 'X-Game-Version': '17', 'X-Telegram-Init-Data': 'secret'},
    body: JSON.stringify({type: 'drinkBeer'})});
  assert.equal(response.status, 200); assert.deepEqual(await response.json(), {saved: true});
});
test('conflict responses preserve reset versions and operation receipts', async () => {
  const body = {code: 'ACCOUNT_RESET', resetVersion: 9, operation: {id: 'same-op'}};
  const response = await telegramRequest({call(_name, _input, cb) {cb(null, {status: 409, body});}}, '/api/progress');
  assert.equal(response.status, 409); assert.deepEqual(await response.json(), body);
});
test('an ambiguous network failure performs no automatic mutation retry', async () => {
  let calls = 0;
  await assert.rejects(telegramRequest({call(_name, _input, cb) {
    calls++; cb({type: 'INTERNAL_ERROR', message: 'Unknown result'});
  }}, '/api/progress/command', {method: 'POST', body: '{}'}));
  assert.equal(calls, 1);
});
test('aborted requests do not invoke the SDK', async () => {
  const controller = new AbortController(); controller.abort();
  await assert.rejects(telegramRequest({call() {assert.fail('SDK called after abort');}}, '/api/progress', {signal: controller.signal}));
});
