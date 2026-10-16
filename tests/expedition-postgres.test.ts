import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {expeditionDatabase} from './helpers/expeditionDatabase';
import {ExpeditionStore, type Operation, type Command} from '../server/expeditions/store';
import {HOUR, materialItem} from '../src/game/expeditions/rules';
import {resetPlayerAccount} from '../server/accountReset';

test('production expedition transactions on PostgreSQL: ownership, retries, races, storage, orders, Premium, migration and reset', async t => {
  const {pool, query, close} = await expeditionDatabase();
  let now = Date.parse('2026-10-15T10:00:00Z');
  const store = new ExpeditionStore(pool, () => now);
  const token = crypto.randomUUID(), tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const selection = {route: 'old-mine', goal: 'balanced', duration: 1, preparation: 'none', crew: 'personal'} as const;
  async function seed(owner: number, options: {gold?: number; skill?: number; mining?: number; slots?: number; premium?: boolean; legacy?: boolean; authority?: string} = {}) {
    const player = {id: 'hero-' + owner, userId: String(owner), gold: options.gold ?? 2000000, worldPlace: 'settlement', inventory: [], equipped: {}, maxInventorySlots: options.slots ?? 20, miningLevel: options.mining ?? 1, miningExp: 0, energy: 17, lastActiveTimestamp: now, statsSummary: {oresMined: 0}, fishing: {}};
    if (options.legacy) Object.assign(player, {miningExpedition: {durationHours: 1, startedAt: now - HOUR / 2, endsAt: now + HOUR / 2, rewards: [{name: 'Уголь', type: 'ore', rarity: 'common', icon: '🪨', count: 4}]}});
    const save = {resetVersion: 0, player, quests: [], achievements: [], combat: {isInCombat: false, isCombatEnded: true, combatPlayerHp: 31, combatPlayerMp: 9}};
    await query('INSERT INTO players(telegram_id,progress_json,progress_session_hash,progress_session_generation,character_authority,premium_until) VALUES($1,$2::jsonb,$3,1,$4,$5)', [owner, JSON.stringify(save), tokenHash, options.authority ?? 'server-actions-v1', options.premium ? new Date(now + 48 * HOUR) : null]);
    if (options.skill) await query('INSERT INTO expedition_accounts(telegram_id,reset_version,state_json) VALUES($1,0,$2::jsonb)', [owner, JSON.stringify({skill: options.skill, active: null, warehouse: null, history: [], order: null, acceptedDay: null, premiumCursor: now, repeat: null})]);
    return player;
  }
  async function operation(owner: number): Promise<Operation> {return {ownerId: owner, resetVersion: 0, sessionToken: token, sessionGeneration: 1, operationId: crypto.randomUUID(), expectedVersion: Number((await query('SELECT progress_version FROM players WHERE telegram_id=$1', [owner])).rows[0].progress_version)};}
  async function act(owner: number, command: Command) {return store.mutate(await operation(owner), command);}
  const persisted = async (owner: number) => (await query('SELECT progress_json,progress_version FROM players WHERE telegram_id=$1', [owner])).rows[0];
  async function warehouse(owner: number, loot: {materialId: string; quantity: number}[], slots = 20) {
    await act(owner, {type: 'reconcile'});
    await query(`UPDATE expedition_accounts SET state_json=jsonb_set(state_json,'{warehouse}',$2::jsonb) WHERE telegram_id=$1`, [owner, JSON.stringify({runId: 'warehouse-' + owner, loot})]);
    const current = await persisted(owner); current.progress_json.player.maxInventorySlots = slots;
    await query('UPDATE players SET progress_json=$2::jsonb WHERE telegram_id=$1', [owner, JSON.stringify(current.progress_json)]);
  }
  try {
    await t.test('local wallets cannot access paid training or mint an item', async () => {
      await seed(10, {authority: 'legacy-local'});
      await assert.rejects(() => act(10, {type: 'train'}), {code: 'AUTHORITATIVE_PROGRESS_REQUIRED'});
      assert.equal(Number((await persisted(10)).progress_version), 0);
      assert.equal((await query('SELECT count(*)::int AS n FROM owned_items WHERE owner_telegram_id=10')).rows[0].n, 0);
    });
    await t.test('training, a lost response and a stale device never double spend or roll back', async () => {
      await seed(11);
      const request = await operation(11), first = await store.mutate(request, {type: 'train'});
      assert.equal(first.state.skill, 2); assert.equal(first.player.gold, 1999500);
      await act(11, {type: 'train'});
      const replay = await store.mutate(request, {type: 'train'});
      assert.equal(replay.replayed, true); assert.equal(replay.state.skill, 3); assert.equal(replay.progressVersion, 2);
      assert.equal(replay.player.gold, 1997500);
      await assert.rejects(() => store.mutate({...request, operationId: crypto.randomUUID()}, {type: 'train'}), {code: 'VERSION_CONFLICT'});
      await assert.rejects(() => store.mutate(request, {type: 'reconcile'}), {code: 'OPERATION_REUSED'});
    });
    await t.test('two database connections serialize simultaneous starts', async () => {
      await seed(12);
      const a = await operation(12), b = {...a, operationId: crypto.randomUUID()};
      const results = await Promise.allSettled([store.mutate(a, {type: 'start', selection}), store.mutate(b, {type: 'start', selection})]);
      assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
      assert.equal((results.find(result => result.status === 'rejected') as PromiseRejectedResult).reason.code, 'VERSION_CONFLICT');
      assert.equal((await query('SELECT count(*)::int AS n FROM game_notifications WHERE telegram_id=12')).rows[0].n, 1);
    });
    await t.test('definitive training refusals do not spend gold and persist negative receipts', async () => {
      await seed(13, {gold: 499});
      await assert.rejects(() => act(13, {type: 'train'}), {code: 'NOT_ENOUGH_GOLD'});
      assert.equal((await persisted(13)).progress_json.player.gold, 499);
      await seed(14, {skill: 20});
      await assert.rejects(() => act(14, {type: 'train'}), {code: 'MAX_SKILL'});
      assert.equal((await query("SELECT count(*)::int AS n FROM expedition_operations WHERE telegram_id IN (13,14) AND outcome='rejected'")).rows[0].n, 2);
    });
    await t.test('only the active writer and exact owner/reset can mutate', async () => {
      await seed(15); await seed(16);
      const stale = await operation(15);
      const nextToken = crypto.randomUUID();
      await query('UPDATE players SET progress_session_hash=$2,progress_session_generation=2 WHERE telegram_id=$1', [15, crypto.createHash('sha256').update(nextToken).digest('hex')]);
      await assert.rejects(() => store.mutate(stale, {type: 'train'}), {code: 'SESSION_TRANSFERRED'});
      const current = await store.mutate({...stale, sessionToken: nextToken, sessionGeneration: 2}, {type: 'train'});
      assert.equal(current.sessionGeneration, 2);
      assert.equal((await persisted(16)).progress_json.player.gold, 2000000);
      const badSave = (await persisted(16)).progress_json; badSave.player.userId = '15';
      await query('UPDATE players SET progress_json=$2 WHERE telegram_id=$1', [16, JSON.stringify(badSave)]);
      await assert.rejects(() => act(16, {type: 'train'}), {code: 'INVALID_OWNER'});
    });
    await t.test('full completion frees the hero without restoring resources, even with a full bag', async () => {
      await seed(17, {slots: 1});
      await query("INSERT INTO owned_items(owner_telegram_id,item_json,quantity,origin) VALUES(17,$1::jsonb,1,'fixture')", [JSON.stringify(materialItem('gem'))]);
      const active = (await act(17, {type: 'start', selection})).state.active!;
      assert.equal('seed' in active, false); assert.equal('snapshot' in active, false);
      now += HOUR;
      const returned = await act(17, {type: 'return', runId: active.id});
      assert.equal(returned.state.active, null); assert.ok(returned.state.warehouse!.loot.length);
      assert.equal(returned.player.worldPlace, 'settlement'); assert.equal(returned.player.energy, 17); assert.equal((await persisted(17)).progress_json.combat.combatPlayerHp, 31); assert.equal((await persisted(17)).progress_json.combat.combatPlayerMp, 9);
      assert.equal(returned.player.miningExp, 25);
      const claim = await act(17, {type: 'claim', runId: active.id});
      assert.ok(claim.state.warehouse!.loot.length); assert.equal(claim.player.miningExp, 25);
      await assert.rejects(() => act(17, {type: 'start', selection}), {code: 'WAREHOUSE_OCCUPIED'});
    });
    await t.test('partial warehouse transfer, 998/999/1000 and large stacks conserve every unit', async () => {
      for (const [index, quantity] of [998, 999, 1000, 1000000].entries()) {
        const owner = 20 + index; await seed(owner);
        await warehouse(owner, [{materialId: 'coal', quantity}, {materialId: 'copper', quantity: 7}], 1);
        const request = await operation(owner);
        const first = await store.mutate(request, {type: 'claim', runId: 'warehouse-' + owner});
        assert.deepEqual(first.state.warehouse!.loot, [{materialId: 'copper', quantity: 7}]);
        await store.mutate(request, {type: 'claim', runId: 'warehouse-' + owner});
        assert.equal(Number((await query('SELECT quantity FROM owned_items WHERE owner_telegram_id=$1', [owner])).rows[0].quantity), quantity);
        await query('DELETE FROM owned_items WHERE owner_telegram_id=$1', [owner]);
        const last = await act(owner, {type: 'claim', runId: 'warehouse-' + owner});
        assert.equal(last.state.warehouse, null);
        assert.equal(Number((await query('SELECT quantity FROM owned_items WHERE owner_telegram_id=$1', [owner])).rows[0].quantity), 7);
      }
    });
    await t.test('integer stack capacity transfers only what fits, retaining the remainder', async () => {
      await seed(24); await warehouse(24, [{materialId: 'coal', quantity: 1000}], 1);
      await query("INSERT INTO owned_items(owner_telegram_id,item_json,quantity,origin) VALUES(24,$1::jsonb,2147483640,'fixture')", [JSON.stringify(materialItem('coal'))]);
      const result = await act(24, {type: 'claim', runId: 'warehouse-24'});
      assert.deepEqual(result.state.warehouse!.loot, [{materialId: 'coal', quantity: 993}]);
      assert.equal(Number((await query('SELECT quantity FROM owned_items WHERE owner_telegram_id=24')).rows[0].quantity), 2147483647);
    });
    await t.test('early return cancels its notification and grants no forced rare item', async () => {
      await seed(25);
      const run = (await act(25, {type: 'start', selection})).state.active!;
      now += 299999;
      const result = await act(25, {type: 'return', runId: run.id});
      assert.equal(result.state.warehouse, null); assert.equal(result.player.miningExp, 0);
      assert.ok((await query('SELECT sent_at FROM game_notifications WHERE telegram_id=25')).rows[0].sent_at);
      const xp = result.player.miningExp;
      await act(25, {type: 'return', runId: run.id});
      assert.equal((await persisted(25)).progress_json.player.miningExp, xp);
    });
    await t.test('brigade snapshot survives training and charges preparation just once', async () => {
      await seed(26, {skill: 5, mining: 15});
      const request = await operation(26);
      const start = await store.mutate(request, {type: 'start', selection: {...selection, crew: 'hired', preparation: 'provisions', duration: 3}});
      assert.equal(start.player.gold, 2000000 - 39);
      await store.mutate(request, {type: 'start', selection: {...selection, crew: 'hired', preparation: 'provisions', duration: 3}});
      await act(26, {type: 'train'});
      const current = (await query('SELECT state_json FROM expedition_accounts WHERE telegram_id=26')).rows[0].state_json;
      assert.equal(current.skill, 6); assert.equal(current.active.snapshot.skill, 5);
      now += 3 * HOUR;
      const finish = await act(26, {type: 'return', runId: current.active.id});
      assert.equal(finish.player.miningExp, 0);
    });
    await t.test('order persists across midnight and actually consumes canonical items only once', async () => {
      await seed(27, {skill: 5, mining: 15});
      const accepted = await act(27, {type: 'accept-order'}), order = accepted.state.order!;
      const acceptedGold = accepted.player.gold;
      await assert.rejects(() => act(27, {type: 'deliver-order'}), {code: 'NOT_ENOUGH_ITEMS'});
      await query("INSERT INTO owned_items(owner_telegram_id,item_json,quantity,origin) VALUES(27,$1::jsonb,$2,'fixture')", [JSON.stringify(materialItem(order.materialId)), order.quantity]);
      now += 24 * HOUR;
      const request = await operation(27), delivered = await store.mutate(request, {type: 'deliver-order'});
      assert.equal(delivered.player.gold, acceptedGold + order.rewardGold);
      assert.equal(delivered.state.order, null);
      assert.equal((await query('SELECT count(*)::int AS n FROM owned_items WHERE owner_telegram_id=27')).rows[0].n, 0);
      assert.equal((await store.mutate(request, {type: 'deliver-order'})).player.gold, delivered.player.gold);
    });
    await t.test('basic Premium needs no brigade/skill and an occupied warehouse never banks more', async () => {
      await seed(28, {premium: true});
      await act(28, {type: 'reconcile'}); now += HOUR;
      const mined = await act(28, {type: 'reconcile'}), original = mined.state.warehouse;
      assert.equal(mined.state.skill, 1); assert.equal(original!.source, 'premium');
      now += 8 * HOUR;
      const blocked = await act(28, {type: 'reconcile'});
      assert.deepEqual(blocked.state.warehouse, original);
      const collected = await act(28, {type: 'claim', runId: original!.runId});
      assert.equal(collected.state.warehouse, null);
      const idle = await act(28, {type: 'reconcile'}); assert.equal(idle.state.warehouse, null);
    });
    await t.test('confirmed online activity is not counted as Premium offline time', async () => {
      await seed(35, {premium: true});
      await act(35, {type: 'reconcile'});
      for (let tick = 0; tick < 6; tick++) {
        now += 10 * 60_000;
        assert.equal((await act(35, {type: 'reconcile'})).state.warehouse, null);
      }
      now += HOUR;
      const offline = await act(35, {type: 'reconcile'});
      assert.equal(offline.state.warehouse!.source, 'premium');
      assert.equal(offline.state.skill, 1);
    });
    await t.test('legacy migration archives once, preserves the result and uses the warehouse', async () => {
      await seed(29, {legacy: true, slots: 1});
      await query("INSERT INTO owned_items(owner_telegram_id,item_json,quantity,origin) VALUES(29,$1::jsonb,1,'fixture')", [JSON.stringify(materialItem('gem'))]);
      const migrated = await act(29, {type: 'reconcile'});
      assert.equal(migrated.state.active!.legacy, true);
      assert.equal((await persisted(29)).progress_json.player.miningExpedition, undefined);
      now += HOUR;
      const completed = await act(29, {type: 'reconcile'});
      assert.deepEqual(completed.state.warehouse!.loot, [{materialId: 'coal', quantity: 4}]);
      assert.equal(completed.state.history[0].snapshot.cost, 0);
      assert.equal((await query('SELECT count(*)::int AS n FROM expedition_migration_backups WHERE telegram_id=29')).rows[0].n, 1);
    });
    await t.test('Premium repetition charges one brigade after collection, waits for the bag and stops after expiry', async () => {
      await seed(31, {premium: true, skill: 5, slots: 1});
      await query("INSERT INTO owned_items(owner_telegram_id,item_json,quantity,origin) VALUES(31,$1::jsonb,1,'fixture')", [JSON.stringify(materialItem('gem'))]);
      const hired = {...selection, crew: 'hired'} as const;
      await act(31, {type: 'repeat', selection: hired});
      const waiting = await act(31, {type: 'reconcile'});
      assert.equal(waiting.state.active, null); assert.equal(waiting.player.gold, 2000000);
      const started = await act(31, {type: 'start', selection: hired, repeat: true}), run = started.state.active!;
      assert.equal(started.player.gold, 1999995);
      now += HOUR;
      const finished = await act(31, {type: 'reconcile'});
      assert.equal(finished.state.active, null);
      assert.equal(finished.state.warehouse!.source, 'expedition');
      const blocked = await act(31, {type: 'claim', runId: run.id});
      assert.equal(blocked.state.active, null); assert.equal(blocked.player.gold, 1999995);
      const current = await persisted(31); current.progress_json.player.maxInventorySlots = 20;
      await query('UPDATE players SET progress_json=$2::jsonb WHERE telegram_id=$1', [31, JSON.stringify(current.progress_json)]);
      const request = await operation(31), collected = await store.mutate(request, {type: 'claim', runId: run.id});
      assert.ok(collected.state.active); assert.equal(collected.player.gold, 1999990);
      assert.equal((await store.mutate(request, {type: 'claim', runId: run.id})).player.gold, 1999990);
      assert.equal(collected.player.miningExp, 0);
      await query('UPDATE players SET premium_until=$2 WHERE telegram_id=$1', [31, new Date(now - 1)]);
      now += HOUR;
      const expired = await act(31, {type: 'reconcile'});
      assert.ok(expired.state.warehouse);
      const last = await act(31, {type: 'claim', runId: expired.state.warehouse!.runId});
      assert.equal(last.state.active, null); assert.equal(last.player.gold, 1999990);
    });
    await t.test('Premium repetition with insufficient funds commits collection and stops without a debit', async () => {
      await seed(32, {premium: true, skill: 5, gold: 39});
      const hired = {...selection, crew: 'hired', duration: 7} as const;
      const started = await act(32, {type: 'start', selection: hired, repeat: true});
      now += 7 * HOUR;
      await act(32, {type: 'reconcile'});
      const collected = await act(32, {type: 'claim', runId: started.state.active!.id});
      assert.equal(collected.state.warehouse, null); assert.equal(collected.state.active, null); assert.equal(collected.state.repeat, null);
      assert.equal(collected.player.gold, 4);
      assert.ok(Number((await query('SELECT sum(quantity)::text AS total FROM owned_items WHERE owner_telegram_id=32')).rows[0].total) > 0);
    });
    await t.test('warehouse integer overflow uses a free second slot without trimming', async () => {
      await seed(33); await warehouse(33, [{materialId: 'coal', quantity: 1000}], 2);
      await query("INSERT INTO owned_items(owner_telegram_id,item_json,quantity,origin) VALUES(33,$1::jsonb,2147483640,'fixture')", [JSON.stringify(materialItem('coal'))]);
      const collected = await act(33, {type: 'claim', runId: 'warehouse-33'});
      assert.equal(collected.state.warehouse, null);
      const totals = (await query('SELECT sum(quantity)::text AS total,count(*)::int AS slots FROM owned_items WHERE owner_telegram_id=33')).rows[0];
      assert.equal(Number(totals.total), 2147484640); assert.equal(totals.slots, 2);
    });
    await t.test('a failed database commit path rolls item delivery back; the same operation is safely retried', async () => {
      await seed(34); await warehouse(34, [{materialId: 'coal', quantity: 1000}]);
      await query(`CREATE FUNCTION reject_expedition_receipt() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.telegram_id=34 THEN RAISE EXCEPTION 'temporary database failure'; END IF; RETURN NEW; END $$`);
      await query('CREATE TRIGGER reject_expedition_receipt BEFORE INSERT ON expedition_operations FOR EACH ROW EXECUTE FUNCTION reject_expedition_receipt()');
      const request = await operation(34);
      await assert.rejects(() => store.mutate(request, {type: 'claim', runId: 'warehouse-34'}), /temporary database failure/);
      assert.equal((await query('SELECT count(*)::int AS n FROM owned_items WHERE owner_telegram_id=34')).rows[0].n, 0);
      assert.equal((await query('SELECT state_json FROM expedition_accounts WHERE telegram_id=34')).rows[0].state_json.warehouse.loot[0].quantity, 1000);
      await query('DROP TRIGGER reject_expedition_receipt ON expedition_operations');
      await store.mutate(request, {type: 'claim', runId: 'warehouse-34'});
      await store.mutate(request, {type: 'claim', runId: 'warehouse-34'});
      assert.equal(Number((await query('SELECT quantity FROM owned_items WHERE owner_telegram_id=34')).rows[0].quantity), 1000);
    });
    await t.test('administrative reset invalidates pending work and clears expedition state', async () => {
      await seed(30); const stale = await operation(30);
      await act(30, {type: 'train'});
      await resetPlayerAccount(pool, 11, 30, crypto.randomUUID(), 0);
      await assert.rejects(() => store.mutate(stale, {type: 'train'}), {code: 'ACCOUNT_RESET'});
      assert.equal((await query('SELECT count(*)::int AS n FROM expedition_accounts WHERE telegram_id=30')).rows[0].n, 0);
      assert.equal((await query('SELECT count(*)::int AS n FROM expedition_operations WHERE telegram_id=30')).rows[0].n, 0);
      assert.equal((await persisted(30)).progress_json, null);
      assert.equal((await persisted(11)).progress_json.player.gold, 1997500);
    });
  } finally {await close();}
});

test('signed early-return preview is exact despite network delay and cannot be moved into the future',async()=>{
 const db=await expeditionDatabase();let now=Date.parse('2026-10-16T11:00:00Z');const token=crypto.randomUUID(),hash=crypto.createHash('sha256').update(token).digest('hex');const store=new ExpeditionStore(db.pool,()=>now);
 const player={id:'preview',userId:'9901',gold:10000,worldPlace:'settlement',inventory:[],equipped:{},maxInventorySlots:20,miningLevel:10,miningExp:0,lastActiveTimestamp:now,statsSummary:{oresMined:0}};
 const selection={route:'old-mine',goal:'balanced',duration:1,preparation:'none',crew:'personal'} as const;
 const op=async()=>({ownerId:9901,resetVersion:0,sessionToken:token,sessionGeneration:1,operationId:crypto.randomUUID(),expectedVersion:Number((await db.query('SELECT progress_version FROM players WHERE telegram_id=9901')).rows[0].progress_version)});
 try{
  await db.query("INSERT INTO players(telegram_id,progress_json,progress_session_hash,progress_session_generation,character_authority) VALUES(9901,$1::jsonb,$2,1,'server-actions-v1')",[JSON.stringify({resetVersion:0,player,quests:[],achievements:[]}),hash]);
  await store.mutate(await op(),{type:'start',selection});now+=1800000;
  const preview=await store.mutate(await op(),{type:'reconcile'}),active=preview.state.active!;now+=10000;
  await assert.rejects(()=>op().then(request=>store.mutate(request,{type:'return',runId:active.id,quote:{at:now+10000,signature:active.returnQuote.signature}})),{code:'RETURN_QUOTE_EXPIRED'});
  const result=await store.mutate(await op(),{type:'return',runId:active.id,quote:active.returnQuote});
  assert.deepEqual(result.state.history[0].loot,active.earlyReturn);
 }finally{await db.close();}
});
