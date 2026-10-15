import crypto from 'node:crypto';
import type {Pool, PoolClient} from 'pg';
import type {PlayerCharacter, Quest, Achievement} from '../../src/types/game';
import {dailyOrder, ExpeditionRuleError, HOUR, legacyPremiumLoot, MATERIALS, materialItem, outcome, resolveExpedition, trainingCost, type ExpeditionSnapshot, type Loot, type Selection} from '../../src/game/expeditions/rules';
import {residentMarketDay} from '../../src/utils/localMarket';
import {queueNotification} from '../socialFeatures';

export class ExpeditionError extends Error {
  constructor(public code: string, message: string, public status = 409) {super(message);}
}
interface Save {resetVersion: number; player: PlayerCharacter; quests: Quest[]; achievements: Achievement[]; activeDungeonRun?: unknown; combat?: {isInCombat?: boolean; isCombatEnded?: boolean}}
interface ActiveRun {id: string; startedAt: number; endsAt: number; seed: string; snapshot: ExpeditionSnapshot; legacy?: boolean}
interface Report {id: string; startedAt: number; finishedAt: number; complete: boolean; legacy?: boolean; snapshot: ExpeditionSnapshot; loot: Loot[]; miningXp: number}
interface Warehouse {runId: string; loot: Loot[]; source?: 'premium' | 'expedition'}
export interface ExpeditionState {
  skill: number;
  active: ActiveRun | null;
  warehouse: Warehouse | null;
  history: Report[];
  order: ReturnType<typeof dailyOrder> | null;
  acceptedDay: string | null;
  premiumCursor: number;
  repeat: Selection | null;
}
export interface Writer {ownerId: number; resetVersion: number; sessionToken: string; sessionGeneration: number}
export interface Operation extends Writer {operationId: string; expectedVersion: number}
export type Command = {type: 'train'} | {type: 'start'; selection: Selection} | {type: 'return'; runId: string} | {type: 'claim'; runId: string} | {type: 'accept-order'} | {type: 'deliver-order'} | {type: 'abandon-order'} | {type: 'repeat'; selection: Selection | null} | {type: 'reconcile'};
const empty = (now: number): ExpeditionState => ({skill: 1, active: null, warehouse: null, history: [], order: null, acceptedDay: null, premiumCursor: now, repeat: null});
const uuid = (value: unknown) => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const hash = (value: string) => crypto.createHash('sha256').update(value).digest('hex');
function canonical(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, val]) => JSON.stringify(key) + ':' + canonical(val)).join(',') + '}';
  return JSON.stringify(value);
}
function town(save: Save, state: ExpeditionState) {
  const player = save.player;
  if (player.worldPlace !== 'settlement' || player.worldJourney || save.activeDungeonRun || save.combat?.isInCombat && !save.combat.isCombatEnded || player.fishing?.cast || state.active?.snapshot.crew === 'personal') throw new ExpeditionError('SETTLEMENT_REQUIRED', 'Сначала вернитесь в поселение и завершите текущее занятие.');
}
function debit(save: Save, gold: number) {
  if (!Number.isSafeInteger(save.player.gold) || save.player.gold < gold) throw new ExpeditionError('NOT_ENOUGH_GOLD', 'Недостаточно золота.');
  save.player.gold -= gold;
}
function advanceMining(save: Save, xp: number, count: number) {
  const player = save.player;
  player.miningExp += xp;
  while (player.miningLevel < 100 && player.miningExp >= player.miningLevel * 175) player.miningLevel++;
  player.statsSummary.oresMined += count;
  for (const quest of save.quests) if (quest.category === 'mining') {quest.currentCount = Math.min(quest.targetCount, quest.currentCount + count); quest.completed = quest.currentCount >= quest.targetCount;}
  for (const achievement of save.achievements) if (achievement.id === 'ach_4') {achievement.progress = Math.min(achievement.maxProgress, achievement.progress + count); achievement.completed = achievement.progress >= achievement.maxProgress;}
}
function finish(save: Save, state: ExpeditionState, now: number) {
  const run = state.active;
  if (!run) throw new ExpeditionError('NO_ACTIVE_RUN', 'Нет активной экспедиции.');
  if (state.warehouse?.loot.length) throw new ExpeditionError('WAREHOUSE_OCCUPIED', 'Сначала заберите предыдущую добычу.');
  const result = outcome(run.snapshot, now - run.startedAt);
  if (run.legacy && !result.complete) result.miningXp = Math.max(0, Math.round(run.snapshot.duration * 25 * Math.min(.85, .85 * Math.max(0, now - run.startedAt) / (run.endsAt - run.startedAt))));
  if (run.legacy && !result.complete && now - run.startedAt >= 300_000 && !result.loot.length && run.snapshot.base.length) result.loot.push({...run.snapshot.base[0], quantity: 1});
  state.warehouse = result.loot.length ? {runId: run.id, loot: result.loot, source: 'expedition'} : null;
  advanceMining(save, result.miningXp, result.loot.reduce((sum, item) => sum + item.quantity, 0));
  if (run.snapshot.crew === 'personal') {save.player.worldPlace = 'settlement'; delete save.player.worldJourney;}
  delete save.player.miningExpedition;
  state.history.unshift({id: run.id, startedAt: run.startedAt, finishedAt: result.complete ? run.endsAt : now, complete: result.complete, legacy: run.legacy, snapshot: run.snapshot, loot: result.loot.map(item => ({...item})), miningXp: result.miningXp});
  state.history = state.history.slice(0, 20);
  state.active = null;
  // An occupied warehouse discards elapsed idle time; it is never a hidden bank.
  state.premiumCursor = now;
}
/** Called inside the same player lock as every other award. Never banks blocked time. */
function accruePremium(save: Save, state: ExpeditionState, premiumUntil: number, now: number) {
  if (state.active || state.warehouse?.loot.length || !Number.isFinite(premiumUntil)) {state.premiumCursor = now; return;}
  const end = Math.min(now, premiumUntil), start = Math.max(state.premiumCursor, Number(save.player.lastActiveTimestamp) || state.premiumCursor);
  if (end - start < 30 * 60_000) {if (premiumUntil <= now) state.premiumCursor = now; return;}
  const hours = Math.max(1, Math.min(8, Math.floor((end - start) / 60_000) / 60));
  const loot = legacyPremiumLoot(hours, save.player.miningLevel, crypto.randomBytes(32).toString('hex'));
  state.warehouse = {runId: crypto.randomUUID(), loot, source: 'premium'};
  advanceMining(save, Math.max(5, Math.round(hours * 12)), loot.reduce((count, item) => count + item.quantity, 0));
  state.premiumCursor = now;
}
/** Only a previously verified, server-owned save reaches this internal migration.
 * There is deliberately no HTTP endpoint accepting legacy rewards or save JSON. */
async function migrateVerifiedSave(client: PoolClient, owner: number, save: Save, now: number, premiumUntil: number) {
  await client.query('INSERT INTO expedition_migration_backups(telegram_id,reset_version,save_json,cutover_at) VALUES($1,$2,$3::jsonb,$4) ON CONFLICT DO NOTHING', [owner, save.resetVersion, JSON.stringify(save), new Date(now)]);
  const state = empty(now), legacy = save.player.miningExpedition;
  state.premiumCursor = Math.min(now, Math.max(now - 8 * HOUR, Number(save.player.lastActiveTimestamp) || now));
  if (legacy) {
    if (![1, 3, 7].includes(legacy.durationHours) || !Number.isSafeInteger(legacy.startedAt) || !Number.isSafeInteger(legacy.endsAt) || legacy.endsAt - legacy.startedAt !== legacy.durationHours * HOUR || legacy.startedAt > now || !Array.isArray(legacy.rewards) || legacy.rewards.length > MATERIALS.length) throw new ExpeditionError('INVALID_LEGACY_EXPEDITION', 'Старая экспедиция не прошла проверку. Исходные данные не изменены.');
    const base: Loot[] = [];
    for (const reward of legacy.rewards) {
      const material = MATERIALS.find(item => item.name === reward.name && item.type === reward.type && item.rarity === reward.rarity && item.minLevel <= save.player.miningLevel);
      const maximum = (legacy.durationHours >= 7 ? 4 : legacy.durationHours >= 3 ? 3 : 2) * Math.ceil(Math.max(1, Math.round(legacy.durationHours * .45)) + legacy.durationHours + 2);
      if (!material || !Number.isInteger(reward.count) || reward.count < 1 || reward.count > maximum || base.some(item => item.materialId === material.id)) throw new ExpeditionError('INVALID_LEGACY_EXPEDITION', 'Некорректная награда старой экспедиции.');
      base.push({materialId: material.id, quantity: reward.count});
    }
    const snapshot: ExpeditionSnapshot = {route: 'old-mine', goal: 'balanced', preparation: 'none', crew: 'personal', duration: legacy.durationHours, skill: 1, mining: save.player.miningLevel, day: residentMarketDay(new Date(legacy.startedAt)), balanceVersion: 'legacy', cost: 0, base, event: null};
    state.active = {id: crypto.randomUUID(), startedAt: legacy.startedAt, endsAt: legacy.endsAt, snapshot, seed: '', legacy: true};
    // Never award the overlapping old Premium interval a second time.
    state.premiumCursor = now;
    delete save.player.miningExpedition;
  } else accruePremium(save, state, premiumUntil, now);
  return state;
}
async function start(client: PoolClient, owner: number, save: Save, state: ExpeditionState, selection: Selection, now: number, automated = false) {
  if (!automated) town(save, state);
  if (state.active) throw new ExpeditionError('RUN_ACTIVE', 'На аккаунте уже идёт экспедиция.');
  if (state.warehouse?.loot.length) throw new ExpeditionError('WAREHOUSE_OCCUPIED', 'Сначала заберите добычу со склада.');
  if (automated && selection.crew !== 'hired') throw new ExpeditionError('INVALID_REPEAT', 'Повтор доступен только для бригады.');
  const seed = crypto.randomBytes(32).toString('hex');
  const snapshot = resolveExpedition({...selection, skill: state.skill, mining: save.player.miningLevel, day: residentMarketDay(new Date(now))}, seed);
  debit(save, snapshot.cost);
  state.active = {id: crypto.randomUUID(), seed, snapshot, startedAt: now, endsAt: now + selection.duration * HOUR};
  state.premiumCursor = now;
  // Existing notification settings, delivery worker and unique event key.
  await queueNotification(client, owner, 'expedition_' + state.active.id, 'mining', 'Экспедиция завершена. Добыча ждёт на складе.', new Date(state.active.endsAt));
}
async function claim(client: PoolClient, owner: number, save: Save, state: ExpeditionState, runId: string) {
  const warehouse = state.warehouse;
  if (!warehouse || warehouse.runId !== runId) throw new ExpeditionError('NO_WAREHOUSE', 'Эта добыча уже получена либо относится к другому отправлению.');
  const rows = (await client.query('SELECT id,item_json,quantity,bound_clan_id FROM owned_items WHERE owner_telegram_id=$1 AND equipped_slot IS NULL FOR UPDATE', [owner])).rows;
  let free = Math.max(0, save.player.maxInventorySlots - rows.length);
  const remainder: Loot[] = [], transferred: Loot[] = [];
  for (const loot of warehouse.loot) {
    const item = materialItem(loot.materialId);
    let remaining = loot.quantity;
    while (remaining > 0) {
      const stack = rows.find(row => !row.bound_clan_id && Number(row.quantity) < 2_147_483_647 && row.item_json.templateId === item.templateId && row.item_json.type === item.type && row.item_json.rarity === item.rarity && row.item_json.level === item.level && row.item_json.upgradeLevel === item.upgradeLevel && canonical(row.item_json.stats || {}) === canonical(item.stats));
      if (!stack && free <= 0) break;
      const quantity = Math.min(remaining, stack ? 2_147_483_647 - Number(stack.quantity) : 2_147_483_647);
      if (stack) {await client.query('UPDATE owned_items SET quantity=quantity+$1,updated_at=NOW() WHERE id=$2', [quantity, stack.id]); stack.quantity = Number(stack.quantity) + quantity;}
      else {const inserted = (await client.query("INSERT INTO owned_items(owner_telegram_id,item_json,quantity,origin) VALUES($1,$2::jsonb,$3,'expedition') RETURNING id", [owner, JSON.stringify(item), quantity])).rows[0]; rows.push({id: inserted.id, item_json: item, quantity}); free--;}
      remaining -= quantity;
    }
    if (remaining < loot.quantity) transferred.push({...loot, quantity: loot.quantity - remaining});
    if (remaining > 0) remainder.push({...loot, quantity: remaining});
  }
  state.warehouse = remainder.length ? {...warehouse, loot: remainder} : null;
  return {transferred, remainder};
}
async function deliverOrder(client: PoolClient, owner: number, save: Save, state: ExpeditionState) {
  town(save, state);
  if (!state.order) throw new ExpeditionError('NO_ORDER', 'Нет принятого заказа.');
  const order = state.order, item = materialItem(order.materialId);
  const rows = (await client.query('SELECT id,quantity FROM owned_items WHERE owner_telegram_id=$1 AND item_json->>\'templateId\'=$2 AND equipped_slot IS NULL AND NOT locked ORDER BY created_at,id FOR UPDATE', [owner, item.templateId])).rows;
  if (rows.reduce((total, row) => total + Number(row.quantity), 0) < order.quantity) throw new ExpeditionError('NOT_ENOUGH_ITEMS', 'Недостаточно незаблокированных материалов для заказа.');
  let remaining = order.quantity;
  for (const row of rows) {
    const count = Math.min(remaining, Number(row.quantity));
    if (count === Number(row.quantity)) await client.query('DELETE FROM owned_items WHERE id=$1', [row.id]);
    else await client.query('UPDATE owned_items SET quantity=quantity-$1,updated_at=NOW() WHERE id=$2', [count, row.id]);
    remaining -= count;
    if (!remaining) break;
  }
  if (save.player.gold + order.rewardGold > 2_147_483_647) throw new ExpeditionError('GOLD_LIMIT', 'Сначала потратьте часть накопленного золота.');
  save.player.gold += order.rewardGold;
  state.order = null;
  return {rewardGold: order.rewardGold};
}
/** Real PostgreSQL implementation. It cannot import a wallet from a request. */
export class ExpeditionStore {
  constructor(private pool: Pick<Pool, 'connect'>, private clock: () => number = Date.now) {}

  async mutate(operation: Operation, command: Command) {
    if (!uuid(operation.operationId) || !Number.isSafeInteger(operation.expectedVersion) || operation.expectedVersion < 0 || !uuid(operation.sessionToken) || !Number.isSafeInteger(operation.sessionGeneration) || !Number.isSafeInteger(operation.resetVersion)) throw new ExpeditionError('INVALID_OPERATION', 'Некорректная операция.', 400);
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const row = (await client.query('SELECT * FROM players WHERE telegram_id=$1 FOR UPDATE', [operation.ownerId])).rows[0];
      if (!row || Number(row.reset_version) !== operation.resetVersion) throw new ExpeditionError('ACCOUNT_RESET', 'Прогресс сброшен. Загрузите персонажа заново.');
      if (row.character_authority !== 'server-actions-v1' || !row.progress_json?.player) throw new ExpeditionError('AUTHORITATIVE_PROGRESS_REQUIRED', 'Экспедиции ожидают перехода персонажа на серверное владение золотом и предметами.', 501);
      if (row.progress_session_hash !== hash(operation.sessionToken) || Number(row.progress_session_generation) !== operation.sessionGeneration) throw new ExpeditionError('SESSION_TRANSFERRED', 'Активная сессия перенесена на другое устройство.');
      const requestHash = hash(canonical(command));
      const receipt = (await client.query('SELECT * FROM expedition_operations WHERE telegram_id=$1 AND reset_version=$2 AND operation_id=$3', [operation.ownerId, operation.resetVersion, operation.operationId])).rows[0];
      if (receipt && receipt.request_hash !== requestHash) throw new ExpeditionError('OPERATION_REUSED', 'Идентификатор операции уже использован с другими параметрами.');
      const save = structuredClone(row.progress_json) as Save;
      if (String(save.player.userId) !== String(operation.ownerId) || save.resetVersion !== operation.resetVersion) throw new ExpeditionError('INVALID_OWNER', 'Сохранение принадлежит другому аккаунту или версии сброса.');
      // One holder: resources are exclusively in owned_items. A legacy JSON bag
      // must be migrated by the character service before this gate can open.
      if (save.player.inventory.length || Object.values(save.player.equipped || {}).some(Boolean)) throw new ExpeditionError('ITEM_MIGRATION_REQUIRED', 'Сначала завершите перенос инвентаря в серверный реестр.', 501);
      const stored = (await client.query('SELECT reset_version,state_json FROM expedition_accounts WHERE telegram_id=$1', [operation.ownerId])).rows[0];
      if (!receipt && Number(row.progress_version) !== operation.expectedVersion) throw new ExpeditionError('VERSION_CONFLICT', 'Прогресс изменился. Загрузите актуальные данные.');
      const now = this.clock();
      if (!Number.isSafeInteger(now) || now <= 0) throw new ExpeditionError('SERVER_CLOCK', 'Серверное время недоступно.', 503);
      const premiumUntil = new Date(row.premium_until || 0).getTime();
      const state: ExpeditionState = stored && Number(stored.reset_version) === operation.resetVersion ? stored.state_json : await migrateVerifiedSave(client, operation.ownerId, save, now, premiumUntil);
      if (receipt) {
        await client.query('COMMIT');
        return {replayed: true, result: receipt.result_json, progressVersion: Number(row.progress_version), resetVersion: operation.resetVersion, sessionGeneration: operation.sessionGeneration, state: publicState(state, this.clock()), player: save.player};
      }
      // An overdue return is always a full completion, including a stale button.
      if (state.active && state.active.endsAt <= now) finish(save, state, now);
      // Reconcile or claim discards intervals spent with an occupied warehouse.
      // Starting/training never silently issues an additional independent award.
      if (command.type === 'reconcile' || command.type === 'claim') accruePremium(save, state, premiumUntil, now);
      if (command.type === 'start') accruePremium(save, state, premiumUntil, now);
      let result: unknown = {ok: true};
      switch (command.type) {
        case 'train': {town(save, state); const price = trainingCost(state.skill); if (price === null) throw new ExpeditionError('MAX_SKILL', 'Достигнут максимальный уровень.'); debit(save, price); state.skill++; result = {level: state.skill, gold: price}; break;}
        case 'start': await start(client, operation.ownerId, save, state, command.selection, now); break;
        case 'return': {
          if (state.active?.id === command.runId) {
            finish(save, state, now);
            await client.query('UPDATE game_notifications SET sent_at=NOW(),read_at=NOW() WHERE telegram_id=$1 AND event_key=$2 AND sent_at IS NULL', [operation.ownerId, 'expedition_' + command.runId]);
          }
          else if (!state.history.some(run => run.id === command.runId)) throw new ExpeditionError('NO_ACTIVE_RUN', 'Отправление не найдено.');
          result = state.history.find(run => run.id === command.runId); break;
        }
        case 'claim': result = await claim(client, operation.ownerId, save, state, command.runId); break;
        case 'accept-order': {
          town(save, state);
          const day = residentMarketDay(new Date(now));
          if (state.order || state.acceptedDay === day) throw new ExpeditionError('ORDER_LIMIT', 'Сегодня заказ уже принят.');
          state.order = dailyOrder(state.skill, save.player.miningLevel, day); state.acceptedDay = day; result = state.order; break;
        }
        case 'deliver-order': result = await deliverOrder(client, operation.ownerId, save, state); break;
        case 'abandon-order': town(save, state); state.order = null; break;
        case 'repeat': {
          town(save, state);
          if (command.selection) {
            if (new Date(row.premium_until || 0).getTime() <= now) throw new ExpeditionError('PREMIUM_REQUIRED', 'Повтор бригады доступен с Premium.');
            if (command.selection.crew !== 'hired') throw new ExpeditionError('INVALID_REPEAT', 'Повтор доступен только для бригады.');
            // Validate availability and reveal future cost without charging.
            const trial = resolveExpedition({...command.selection, skill: state.skill, mining: save.player.miningLevel, day: residentMarketDay(new Date(now))}, 'validation');
            result = {futureCost: trial.cost};
          }
          state.repeat = command.selection; break;
        }
        case 'reconcile': break;
        default: throw new ExpeditionError('UNKNOWN_COMMAND', 'Неизвестное действие.', 400);
      }
      if (state.repeat && !state.active && !state.warehouse && new Date(row.premium_until || 0).getTime() > now && ['claim', 'reconcile'].includes(command.type)) {
        // One automatic paid cycle per confirmed collection/reconciliation.
        // Declined payment is definitive; the collected loot must still commit.
        try {await start(client, operation.ownerId, save, state, state.repeat, now, true);}
        catch (error) {if (error instanceof ExpeditionRuleError || error instanceof ExpeditionError && error.code === 'NOT_ENOUGH_GOLD') state.repeat = null; else throw error;}
      }
      // The timestamp is server-owned. Repeated confirmed online actions do not
      // become an "offline" Premium interval merely by accumulating wall time.
      save.player.lastActiveTimestamp = now;
      await client.query(`INSERT INTO expedition_accounts(telegram_id,reset_version,state_json) VALUES($1,$2,$3::jsonb)
        ON CONFLICT(telegram_id) DO UPDATE SET reset_version=EXCLUDED.reset_version,state_json=EXCLUDED.state_json,updated_at=NOW()`, [operation.ownerId, operation.resetVersion, JSON.stringify(state)]);
      const version = Number(row.progress_version) + 1;
      await client.query('UPDATE players SET progress_json=$1::jsonb,progress_version=$2,updated_at=NOW() WHERE telegram_id=$3', [JSON.stringify(save), version, operation.ownerId]);
      await client.query('INSERT INTO expedition_operations(telegram_id,reset_version,operation_id,request_hash,result_json) VALUES($1,$2,$3,$4,$5::jsonb)', [operation.ownerId, operation.resetVersion, operation.operationId, requestHash, JSON.stringify(result)]);
      await client.query('COMMIT');
      return {replayed: false, result, progressVersion: version, resetVersion: operation.resetVersion, sessionGeneration: operation.sessionGeneration, state: publicState(state, now), player: save.player};
    } catch (error) {await client.query('ROLLBACK'); throw error;}
    finally {client.release();}
  }
}
/** Never disclose the seed or future full reward while a run is active. */
export function publicState(state: ExpeditionState, now: number) {
  const active = state.active;
  return {...state, active: active ? {id: active.id, startedAt: active.startedAt, endsAt: active.endsAt, legacy: !!active.legacy, selection: {route: active.snapshot.route, goal: active.snapshot.goal, duration: active.snapshot.duration, preparation: active.snapshot.preparation, crew: active.snapshot.crew}, skill: active.snapshot.skill, cost: active.snapshot.cost, earlyReturn: now >= active.endsAt ? null : outcome(active.snapshot, now - active.startedAt).loot} : null};
}
