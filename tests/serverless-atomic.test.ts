import {test} from 'node:test';
import assert from 'node:assert/strict';
import {atomicDocument} from '../tgcloud/lib/atomicDocument.js';

function setup(state: any) {
  let row = {revision: 0, document: JSON.stringify({...state, receipts: {}})};
  const storage = {
    async read() {return {...row};},
    async compareAndSwap(_key: string, revision: number, document: string) {
      if (row.revision !== revision) return false;
      row = {revision: revision + 1, document}; return true;
    },
  };
  return atomicDocument(storage);
}
test('concurrent retries of one purchase charge once and retain ownership', async () => {
  const store = setup({buyer: 100, seller: 0, itemOwner: 'seller'});
  const purchase = (state: any) => {
    assert.equal(state.itemOwner, 'seller');
    state.buyer -= 10; state.seller += 10; state.itemOwner = 'buyer';
    return {purchased: true};
  };
  const results = await Promise.all(Array.from({length: 4}, () =>
    store.transact('world', {id: 'buyer:purchase-1', fingerprint: 'item-1:10'}, purchase)));
  assert.equal(results.filter(result => !result.replayed).length, 1);
  const {revision, state} = await store.read('world');
  assert.equal(revision, 1); assert.equal(state.buyer, 90);
  assert.equal(state.seller, 10); assert.equal(state.itemOwner, 'buyer');
});
test('concurrent distinct operations do not lose changes', async () => {
  const store = setup({value: 0});
  await Promise.all(Array.from({length: 4}, (_, index) => store.transact('world', {
    id: 'user:' + index, fingerprint: 'increment',
  }, (state: any) => ++state.value)));
  assert.equal((await store.read('world')).state.value, 4);
});
test('failure after a candidate balance change commits no partial changes', async () => {
  const store = setup({buyer: 100, seller: 0});
  await assert.rejects(store.transact('world', {id: 'buy', fingerprint: '10'}, (state: any) => {
    state.buyer -= 10; throw new Error('Unavailable item');
  }));
  const {revision, state} = await store.read('world');
  assert.equal(revision, 0); assert.equal(state.buyer, 100);
  assert.equal(state.seller, 0); assert.equal(Object.keys(state.receipts).length, 0);
});
test('an operation ID cannot be reused for a different request', async () => {
  const store = setup({value: 0});
  await store.transact('world', {id: 'one', fingerprint: 'increment'}, (state: any) => ++state.value);
  await assert.rejects(store.transact('world', {id: 'one', fingerprint: 'different'}, () => null),
    {code: 'OPERATION_CONFLICT'});
  assert.equal((await store.read('world')).state.value, 1);
});

test('gameplay updates keep private candidates, skip unchanged writes and retry concurrent revisions', async () => {
  const store = setup({value: 0});
  await store.update('world', (state: any) => state.value);
  assert.equal((await store.read('world')).revision, 0);
  await assert.rejects(store.update('world', (state: any) => {state.value = 999; throw new Error('abort');}));
  assert.equal((await store.read('world')).state.value, 0);
  await Promise.all(Array.from({length: 4}, () => store.update('world', (state: any) => ++state.value)));
  const saved = await store.read('world');
  assert.equal(saved.state.value, 4); assert.equal(saved.revision, 4);
});
