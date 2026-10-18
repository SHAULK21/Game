import crypto from 'node:crypto';
import type {Pool, PoolClient} from 'pg';
import type {PlayerCharacter, CharacterClassId, ItemType} from '../src/types/game';
import type {ProgressEnvelope, ProgressOperationResult, PublicGameView} from '../src/types/progress';
import {canonicalJson} from '../src/utils/canonicalJson';
import {refreshGameTimers} from '../src/utils/gameCadence';
import {GameActor, loadGameEngine, type ActorSnapshot} from './gameActor';
import {loadGameInventory, persistGameInventory, publicPlayer} from './gameInventory';
import {executeGameCommand, isPresentationCommand, type GameCommand} from './gameCommands';
import {ProgressError, validateLegacyProgress, type ProgressSave} from './progressValidation';
import {publicState, reconcileCanonicalExpeditions, type ExpeditionState} from './expeditions/store';
import {gameTransactionPool, withGameTransaction} from './gameTransactions';
import {meaningfulSave} from './saveFingerprint';

export interface GameIdentity {id: number; displayName: string; username?: string; locale?: 'ru' | 'uk'}
export interface GameWriter {sessionToken: string; sessionGeneration: number; resetVersion: number}
export interface GameOperation extends GameWriter {operationId: string; expectedVersion: number}
export interface ServerSave extends ProgressSave {actor: ActorSnapshot; inventoryDigest?: string}
const uuid = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const hash = (value: string) => crypto.createHash('sha256').update(value).digest('hex');
const sameWriter = (row: any, token: string) => !!token && row.progress_session_hash === hash(token);
const safeVersion = (value: unknown) => Number.isSafeInteger(value) && Number(value) >= 0;
const json = (value: unknown) => canonicalJson(value);
function ownership(actor: GameActor) {return json([actor.current.player?.inventory, actor.current.player?.equipped]);}
function saveActor(actor: GameActor, epoch: number): ServerSave {
  if (!actor.current.player) throw new ProgressError('NO_CHARACTER', 'Персонаж отсутствует.');
  const player = {...actor.current.player, inventory: [], equipped: {}};
  delete player.clanId; delete player.marketGold; delete player.expeditionPresence;
  if (!Number.isSafeInteger(player.gold) || player.gold < 0 || !Number.isSafeInteger(player.silver) || player.silver < 0) throw new ProgressError('WALLET_LIMIT', 'Недопустимый итоговый баланс. Действие не выполнено.', 400);
  return {resetVersion: epoch, player, inventoryDigest: hash(ownership(actor)), quests: actor.current.quests, achievements: actor.current.achievements, activeDungeonRun: actor.current.activeDungeonRun,
    combat: {isInCombat: actor.current.isInCombat, isCombatEnded: actor.current.isCombatEnded, combatPlayerHp: actor.current.combatPlayerHp, combatPlayerMp: actor.current.combatPlayerMp}, actor: actor.snapshot({externalizeCanonical: true})};
}
function requestShape(operation: GameOperation) {
  if (!uuid(operation.operationId) || !uuid(operation.sessionToken) || !safeVersion(operation.expectedVersion) || !safeVersion(operation.sessionGeneration) || !safeVersion(operation.resetVersion)) throw new ProgressError('INVALID_OPERATION', 'Некорректная версия или идентификатор операции.', 400);
}
export class GameStore {
  readonly pool: Pool;
  constructor(pool: Pool, private options: {now?: () => number; isAdmin?: (owner: number) => boolean} = {}) {this.pool = gameTransactionPool(pool);}
  private now() {return (this.options.now || Date.now)();}
  private async transaction<T>(identity: GameIdentity, callback: (client: PoolClient, row: any) => Promise<T>) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const row = (await client.query('SELECT * FROM players WHERE telegram_id=$1 FOR UPDATE', [identity.id])).rows[0];
      if (!row) throw new ProgressError('NO_ACCOUNT', 'Telegram-аккаунт не найден.', 401);
      const value = await withGameTransaction(client, () => callback(client, row));
      await client.query('COMMIT'); return value;
    } catch (error) {await client.query('ROLLBACK'); throw error;}
    finally {client.release();}
  }
  private checkWriter(row: any, writer: GameWriter) {
    if (Number(row.reset_version) !== writer.resetVersion) throw new ProgressError('ACCOUNT_RESET', 'Прогресс сброшен администратором.');
    if (!sameWriter(row, writer.sessionToken) || Number(row.progress_session_generation) !== writer.sessionGeneration) throw new ProgressError('SESSION_LOST', 'Активная сессия перенесена. Изменения остановлены.');
  }
  private actorOptions(identity: GameIdentity, row: any, token: string) {
    const now = this.now();
    return {user: {id: identity.id, first_name: identity.displayName, username: identity.username}, resetVersion: Number(row.reset_version), locale: identity.locale || 'ru' as const,
      admin: this.options.isAdmin?.(identity.id) === true, premium: {active: new Date(row.premium_until || 0).getTime() > now, premiumUntil: row.premium_until ? new Date(row.premium_until).toISOString() : null, priceStars: 150, periodDays: 30},
      now: () => now, automationAllowed: sameWriter(row, token)};
  }
  private async actorFor(client: PoolClient, identity: GameIdentity, row: any, save: ServerSave, token: string) {
    if (!save.actor || save.actor.version !== 1) throw new ProgressError('INCOMPATIBLE_SAVE', 'Эта версия серверного сохранения требует обновления.', 503);
    if (save.resetVersion !== Number(row.reset_version) || String(save.player.userId) !== String(identity.id)) throw new ProgressError('WRONG_OWNER', 'Владелец или версия сохранения не совпадают.');
    const items = await loadGameInventory(client, identity.id);
    const player = refreshGameTimers({...structuredClone(save.player), ...items, marketGold: Number(row.market_gold || 0), clanId: row.clan_id || undefined}, this.now());
    delete (player as any).rows;
    const snapshot: ActorSnapshot = {...save.actor, state: {...save.actor.state, player, quests: save.quests, achievements: save.achievements, activeDungeonRun: save.activeDungeonRun}};
    const actor = await new GameActor({...this.actorOptions(identity, row, token), snapshot}).initialize();
    return {actor, items};
  }
  private async update(client: PoolClient, row: any, actor: GameActor, closeMigration: boolean, prepared?:ServerSave) {
    const save = prepared??saveActor(actor, Number(row.reset_version));
    return (await client.query(`UPDATE players SET progress_json=$2::jsonb,progress_version=progress_version+1,
      progress_migration_open=CASE WHEN $3 THEN FALSE ELSE progress_migration_open END,
      character_authority='server-actions-v1',character_name=$4,level=$5,arena_rating=$6,class_id=$7,updated_at=NOW()
      WHERE telegram_id=$1 RETURNING *`, [row.telegram_id, JSON.stringify(save), closeMigration, save.player.name, save.player.level, save.player.arenaRating, save.player.classId])).rows[0];
  }
  private envelope(identity: GameIdentity, row: any, token: string, actor: GameActor | null, state: ExpeditionState | null): ProgressEnvelope {
    const canonical = row.character_authority === 'server-actions-v1';
    const player = actor?.current.player ? publicPlayer(actor.current.player) : null;
    if(player&&state?.active?.snapshot.crew==='personal')player.expeditionPresence={runId:state.active.id,endsAt:state.active.endsAt};
    const save: ProgressSave | null = actor && player ? {resetVersion: Number(row.reset_version), player, quests: actor.current.quests, achievements: actor.current.achievements, activeDungeonRun: actor.current.activeDungeonRun} : row.progress_json ? {resetVersion: Number(row.reset_version), player: row.progress_json.player, quests: [], achievements: [], activeDungeonRun: null} : null;
    const game = actor ? {...actor.publicView(), player} as PublicGameView : null;
    return {protocol: 'server-actions-v1', ownerId: String(identity.id), resetVersion: Number(row.reset_version), version: Number(row.progress_version), sessionGeneration: Number(row.progress_session_generation), activeHere: sameWriter(row, token), writerPresent: !!row.progress_session_hash, migrationOpen: row.progress_migration_open === true, canonical, save, game, expeditions: state ? publicState(state, this.now(), player?.miningLevel||1) : null, serverTime: this.now(), nextTickAt: actor?.current.player?.worldJourney?.arrivesAt ?? (actor && Number.isFinite(actor.nextTickAt) ? actor.nextTickAt : null), cues: actor?.cues || []};
  }
  /** Persist due rewards before a new command's savepoint. A rejected action
   * must never roll back an earned reward or allow its random result to reroll. */
  private async frame(client: PoolClient, identity: GameIdentity, initial: any, token: string, tick = true) {
    let row = initial;
    const save = structuredClone(row.progress_json) as ServerSave;
    const lastSeen = row.last_seen_at ? new Date(row.last_seen_at).getTime() : save.player.lastActiveTimestamp || this.now();
    const expedition = await reconcileCanonicalExpeditions(client, row, save, this.now(), lastSeen);
    const {actor, items:loadedItems} = await this.actorFor(client, identity, row, save, token), beforeItems = ownership(actor);
    let items=loadedItems;
    if (tick) actor.tick();
    if (beforeItems !== ownership(actor)) {
      await persistGameInventory(client, identity.id, actor, 'game_command', items.rows);
      const latest = await loadGameInventory(client, identity.id);
      actor.replacePlayer({...actor.current.player!, inventory: latest.inventory, equipped: latest.equipped});
      items=latest;
    }
    const candidate=saveActor(actor,Number(row.reset_version));
    if (expedition.changed || meaningfulSave(candidate) !== meaningfulSave(row.progress_json)) row = await this.update(client, row, actor, false,candidate);
    return {row, actor, expedition, items};
  }
  /** Locked read and clock reconciliation, not a client checkpoint. */
  async load(identity: GameIdentity, token: string, {tick = true} = {}) {
    return this.transaction(identity, async (client, initial) => {
      if (initial.progress_json && String(initial.progress_json.player?.userId) !== String(identity.id)) throw new ProgressError('WRONG_OWNER', 'Владелец сохранения не совпадает.');
      if (!initial.progress_json || initial.character_authority !== 'server-actions-v1') return this.envelope(identity, initial, token, null, null);
      const {row, actor, expedition} = await this.frame(client, identity, initial, token, tick);
      await client.query('UPDATE players SET last_seen_at=$2 WHERE telegram_id=$1', [identity.id, new Date(this.now())]);
      return this.envelope(identity, row, token, actor, expedition.state);
    });
  }
  /** Only the legacy economic relay uses this inside its player lock. */
  async projectLocked(client: PoolClient, identity: GameIdentity, token: string) {
    const row = (await client.query('SELECT * FROM players WHERE telegram_id=$1 FOR UPDATE', [identity.id])).rows[0];
    const frame = await this.frame(client, identity, row, token, false);
    return this.envelope(identity, frame.row, token, frame.actor, frame.expedition.state);
  }
  async acquire(identity: GameIdentity, token: string, expectedGeneration: number, transfer: boolean) {
    if (!uuid(token) || !safeVersion(expectedGeneration) || typeof transfer !== 'boolean') throw new ProgressError('INVALID_SESSION', 'Некорректные параметры сессии.', 400);
    await this.transaction(identity, async (client, row) => {
      if (sameWriter(row, token)) return;
      if (row.progress_session_hash && !transfer) throw new ProgressError('SESSION_ACTIVE', 'Персонаж открыт на другом устройстве. Подтвердите перенос активной сессии.');
      if (Number(row.progress_session_generation) !== expectedGeneration) throw new ProgressError('SESSION_CONFLICT', 'Активная сессия уже изменилась. Загрузите актуальные данные.');
      await client.query('UPDATE players SET progress_session_hash=$2,progress_session_generation=progress_session_generation+1 WHERE telegram_id=$1', [identity.id, hash(token)]);
    });
    return this.load(identity, token);
  }
  async operation(identity: GameIdentity, operation: GameOperation, command: GameCommand): Promise<ProgressOperationResult> {
    requestShape(operation);
    // Bound raw nesting before canonical hashing, including unknown commands.
    const inspect = (value: any, depth = 0) => {if (depth > 6 || typeof value === 'string' && value.length > 1000 || Array.isArray(value) && value.length > 500) throw new ProgressError('INVALID_COMMAND', 'Слишком большой запрос.', 400); if (value && typeof value === 'object') for (const [key, child] of Object.entries(value)) {if (['__proto__','constructor','prototype'].includes(key)) throw new ProgressError('INVALID_COMMAND', 'Недопустимое поле.', 400); inspect(child, depth + 1);}};
    inspect(command);
    const requestHash = hash(json(command));
    return this.transaction(identity, async (client, initial) => {
      let row = initial; this.checkWriter(row, operation);
      const receipt = (await client.query('SELECT * FROM game_operations WHERE telegram_id=$1 AND reset_version=$2 AND operation_id=$3', [identity.id, operation.resetVersion, operation.operationId])).rows[0];
      if (receipt && receipt.request_hash !== requestHash) throw new ProgressError('OPERATION_CONFLICT', 'ID операции использован с другими параметрами.');
      if (!row.progress_json || row.character_authority !== 'server-actions-v1') throw new ProgressError('NO_CHARACTER', 'Загрузите серверного персонажа.');
      if (!receipt && Number(row.progress_version) !== operation.expectedVersion) throw new ProgressError('VERSION_CONFLICT', 'На сервере уже есть новый прогресс. Загрузите его перед следующим действием.');
      let {row: framedRow, actor, items, expedition} = await this.frame(client, identity, row, operation.sessionToken);
      row = framedRow;
      if (receipt) return {...this.envelope(identity, row, operation.sessionToken, actor, expedition.state), operation: {id: operation.operationId, outcome: receipt.outcome, result: receipt.result_json, replayed: true}};
      const save = structuredClone(row.progress_json) as ServerSave;
      await client.query('SAVEPOINT game_action');
      let outcome: 'applied' | 'rejected' = 'applied', result: unknown;
      try {
        if (expedition.state.active?.snapshot.crew === 'personal' && !isPresentationCommand(command)) throw new ProgressError('PERSONAL_EXPEDITION', 'Герой в экспедиции. Сначала вернитесь через её статус.');
        const beforeItems=ownership(actor);
        result = await executeGameCommand(actor, command);
        actor.replacePlayer({...actor.current.player!, lastActiveTimestamp: this.now()});
        // The player and owned inventory are already locked by frame(). Pure
        // combat/presentation actions must not rewrite every unchanged item.
        if(beforeItems!==ownership(actor)){
          await persistGameInventory(client, identity.id, actor, 'game_command', items.rows);
          const latest = await loadGameInventory(client, identity.id);
          actor.replacePlayer({...actor.current.player!, inventory: latest.inventory, equipped: latest.equipped});
        }
        row = await this.update(client, row, actor, true);
        await client.query('RELEASE SAVEPOINT game_action');
      } catch (error) {
        await client.query('ROLLBACK TO SAVEPOINT game_action'); await client.query('RELEASE SAVEPOINT game_action');
        if (!(error instanceof ProgressError)) throw error;
        outcome = 'rejected'; result = {code: error.code, error: error.message, status: error.status};
        ({actor, items} = await this.actorFor(client, identity, row, save, operation.sessionToken));
        // The pre-action frame is already durable in the outer transaction.
      }
      if (result && typeof result === 'object' && Object.hasOwn(result, 'player')) {const {player: _projection, ...safe} = result as any; result = safe;}
      result ??= null;
      await client.query('INSERT INTO game_operations(telegram_id,reset_version,operation_id,request_hash,outcome,result_json,result_version) VALUES($1,$2,$3,$4,$5,$6::jsonb,$7)', [identity.id, operation.resetVersion, operation.operationId, requestHash, outcome, JSON.stringify(result), row.progress_version]);
      await client.query('UPDATE players SET last_seen_at=$2 WHERE telegram_id=$1', [identity.id, new Date(this.now())]);
      return {...this.envelope(identity, row, operation.sessionToken, actor, expedition.state), operation: {id: operation.operationId, outcome, result, replayed: false}};
    });
  }
  async receipt(identity: GameIdentity, token: string, id: string, epoch: number) {
    if (!uuid(id) || !safeVersion(epoch)) throw new ProgressError('INVALID_OPERATION', 'Некорректный ID операции.', 400);
    const receipt = await this.transaction(identity, async (client, row) => {
      if (Number(row.reset_version) !== epoch) throw new ProgressError('ACCOUNT_RESET', 'Прогресс сброшен.');
      const game = (await client.query('SELECT outcome,result_json FROM game_operations WHERE telegram_id=$1 AND reset_version=$2 AND operation_id=$3', [identity.id, epoch, id])).rows[0];
      if (game) return game;
      const expedition = (await client.query('SELECT outcome,result_json FROM expedition_operations WHERE telegram_id=$1 AND reset_version=$2 AND operation_id=$3', [identity.id, epoch, id])).rows[0];
      if (expedition) return expedition;
      const api = (await client.query('SELECT response_json FROM progress_api_operations WHERE telegram_id=$1 AND reset_version=$2 AND operation_id=$3', [identity.id, epoch, id])).rows[0]?.response_json;
      return api ? api.receiptVersion === 2 ? {outcome:api.outcome,result_json:api.body} : {outcome:'applied',result_json:api} : null;
    });
    return {...await this.load(identity, token), operation: receipt ? {id, outcome: receipt.outcome, result: receipt.result_json, replayed: true} : null};
  }
  async create(identity: GameIdentity, operation: GameOperation, input: {name: string; classId: CharacterClassId; firstJourney?: boolean}) {
    requestShape(operation);
    const catalog = await loadGameEngine();
    if (typeof input?.name !== 'string' || !input.name.trim() || input.name.trim().length > 32 || !Object.hasOwn(catalog.CLASSES, input.classId) || input.firstJourney !== undefined && typeof input.firstJourney !== 'boolean') throw new ProgressError('INVALID_CHARACTER', 'Проверьте имя и класс персонажа.', 400);
    const requestHash = hash(json({type: 'create', name: input.name.trim(), classId: input.classId, firstJourney: input.firstJourney === true}));
    return this.transaction(identity, async (client, row) => {
      this.checkWriter(row, operation);
      const receipt = (await client.query('SELECT * FROM game_operations WHERE telegram_id=$1 AND reset_version=$2 AND operation_id=$3', [identity.id, operation.resetVersion, operation.operationId])).rows[0];
      if (receipt) {if (receipt.request_hash !== requestHash) throw new ProgressError('OPERATION_CONFLICT', 'ID операции уже использован.'); const save = row.progress_json as ServerSave, exp = await reconcileCanonicalExpeditions(client, row, save, this.now()); const {actor} = await this.actorFor(client, identity, row, save, operation.sessionToken); return {...this.envelope(identity, row, operation.sessionToken, actor, exp.state), operation: {id: operation.operationId, outcome: 'applied' as const, result: null, replayed: true}};}
      if (row.progress_json) throw new ProgressError('CHARACTER_EXISTS', 'На сервере уже есть персонаж.');
      if (Number(row.progress_version) !== operation.expectedVersion) throw new ProgressError('VERSION_CONFLICT', 'Версия прогресса изменилась.');
      const actor = await new GameActor(this.actorOptions(identity, row, operation.sessionToken)).initialize();
      await actor.invoke('createCharacter', input.name.trim(), input.classId, input.firstJourney === true);
      // Existing account-owned market/clan items are a separate SQL partition.
      const existing = await loadGameInventory(client, identity.id);
      actor.replacePlayer({...actor.current.player!, inventory: [...actor.current.player!.inventory, ...existing.inventory], equipped: {...existing.equipped, ...actor.current.player!.equipped}});
      await persistGameInventory(client, identity.id, actor, 'game_command', existing.rows);
      const canonical = await loadGameInventory(client, identity.id); actor.replacePlayer({...actor.current.player!, inventory: canonical.inventory, equipped: canonical.equipped});
      const save = saveActor(actor, operation.resetVersion), exp = await reconcileCanonicalExpeditions(client, {...row, progress_json: save}, save, this.now());
      actor.replacePlayer({...actor.current.player!, ...save.player, inventory: canonical.inventory, equipped: canonical.equipped});
      const updated = await this.update(client, row, actor, true);
      await client.query('INSERT INTO game_operations(telegram_id,reset_version,operation_id,request_hash,outcome,result_json,result_version) VALUES($1,$2,$3,$4,\'applied\',\'null\'::jsonb,$5)', [identity.id, operation.resetVersion, operation.operationId, requestHash, updated.progress_version]);
      return {...this.envelope(identity, updated, operation.sessionToken, actor, exp.state), operation: {id: operation.operationId, outcome: 'applied' as const, result: null, replayed: false}};
    });
  }
  private async rejectAdmission(identity:GameIdentity, operation:GameOperation, requestHash:string, error:ProgressError) {
    const result={code:error.code,error:error.message,status:error.status};
    await this.transaction(identity,async(client,row)=>{
      this.checkWriter(row,operation);
      const old=(await client.query('SELECT request_hash FROM game_operations WHERE telegram_id=$1 AND reset_version=$2 AND operation_id=$3',[identity.id,operation.resetVersion,operation.operationId])).rows[0];
      if(old){if(old.request_hash!==requestHash)throw new ProgressError('OPERATION_CONFLICT','ID переноса уже использован.');return;}
      if(Number(row.progress_version)!==operation.expectedVersion)throw new ProgressError('VERSION_CONFLICT','Прогресс изменился. Обновите выбор.');
      await client.query("INSERT INTO game_operations(telegram_id,reset_version,operation_id,request_hash,outcome,result_json,result_version) VALUES($1,$2,$3,$4,'rejected',$5::jsonb,$6)",[identity.id,operation.resetVersion,operation.operationId,requestHash,JSON.stringify(result),row.progress_version]);
    });
    return {...await this.load(identity,operation.sessionToken),operation:{id:operation.operationId,outcome:'rejected' as const,result,replayed:false}};
  }
  async migrate(identity: GameIdentity, operation: GameOperation, input: unknown, replaceExisting = false) {
    requestShape(operation);
    const catalog = await loadGameEngine();
    const requestHash = hash(json({type: 'migrate', save: input, replaceExisting}));
    let selected: ProgressSave;
    try{selected=validateLegacyProgress(input,identity.id,operation.resetVersion,catalog);}
    catch(error){if(error instanceof ProgressError)return this.rejectAdmission(identity,operation,requestHash,error);throw error;}
    return this.transaction(identity, async (client, row) => {
      this.checkWriter(row, operation);
      const receipt = (await client.query('SELECT * FROM game_operations WHERE telegram_id=$1 AND reset_version=$2 AND operation_id=$3', [identity.id, operation.resetVersion, operation.operationId])).rows[0];
      if (receipt) {
        if (receipt.request_hash !== requestHash) throw new ProgressError('OPERATION_CONFLICT', 'Повторный перенос изменился.');
        if(receipt.outcome==='rejected'){const latest=row.progress_json&&row.character_authority==='server-actions-v1'?await this.frame(client,identity,row,operation.sessionToken):null;return {...this.envelope(identity,latest?.row||row,operation.sessionToken,latest?.actor||null,latest?.expedition.state||null),operation:{id:operation.operationId,outcome:'rejected' as const,result:receipt.result_json,replayed:true}};}
        const save = structuredClone(row.progress_json) as ServerSave, exp = await reconcileCanonicalExpeditions(client, row, save, this.now()); const {actor} = await this.actorFor(client, identity, row, save, operation.sessionToken);
        return {...this.envelope(identity, row, operation.sessionToken, actor, exp.state), operation: {id: operation.operationId, outcome: 'applied' as const, result: null, replayed: true}};
      }
      if (!row.progress_migration_open || row.progress_json && !replaceExisting) throw new ProgressError('MIGRATION_CLOSED', 'Серверный персонаж уже выбран или изменён. Автоматическая замена запрещена.');
      if (Number(row.progress_version) !== operation.expectedVersion) throw new ProgressError('VERSION_CONFLICT', 'На сервере уже есть новый прогресс.');
      await client.query('INSERT INTO character_migration_backups(telegram_id,reset_version,progress_version,source,save_json) VALUES($1,$2,$3,\'local_selected\',$4::jsonb)', [identity.id, operation.resetVersion, row.progress_version, JSON.stringify(input)]);
      if (row.progress_json) {
        const oldExp = (await client.query('SELECT state_json FROM expedition_accounts WHERE telegram_id=$1', [identity.id])).rows[0]?.state_json;
        await client.query('INSERT INTO character_migration_backups(telegram_id,reset_version,progress_version,source,save_json) VALUES($1,$2,$3,\'server_before_choice\',$4::jsonb)', [identity.id, operation.resetVersion, row.progress_version, JSON.stringify({...row.progress_json, expeditions: oldExp})]);
        await client.query('DELETE FROM owned_items WHERE owner_telegram_id=$1 AND character_id=$2', [identity.id, row.progress_json.player.id]);
        await client.query('DELETE FROM expedition_accounts WHERE telegram_id=$1', [identity.id]);
      }
      // UUID ledger identities are references, including stale sold/transferred
      // items. They are never reminted from a legacy JSON object.
      const references = new Set((await client.query(`SELECT item_id::text AS id FROM game_ledger_ids
        UNION SELECT id::text FROM owned_items
        UNION SELECT request_json->>'itemId' FROM market_listing_requests
        UNION SELECT jsonb_array_elements_text(result_json->'itemIds') FROM inventory_bulk_disposals WHERE result_json ? 'itemIds'`)).rows.map(row => row.id));
      // Local items can legitimately have UUIDs. Only identities actually known
      // to the SQL ledger are references; never discard an unregistered UUID.
      selected.player.inventory = selected.player.inventory.filter(item => !references.has(item.id));
      selected.player.equipped = Object.fromEntries(Object.entries(selected.player.equipped).filter(([, item]) => item && !references.has(item.id)));
      const actor = await new GameActor({...this.actorOptions(identity, row, operation.sessionToken), migrationSave: JSON.stringify(selected)}).initialize();
      const existing = await loadGameInventory(client, identity.id);
      const equipped = {...actor.current.player!.equipped}, inventory = [...actor.current.player!.inventory, ...existing.inventory];
      for (const [key, item] of Object.entries(existing.equipped)) {const slot = key as ItemType;if (equipped[slot]) inventory.push(equipped[slot]!); equipped[slot] = item;}
      actor.replacePlayer({...actor.current.player!, inventory, equipped});
      await persistGameInventory(client, identity.id, actor, 'legacy_character', existing.rows);
      const canonical = await loadGameInventory(client, identity.id); actor.replacePlayer({...actor.current.player!, inventory: canonical.inventory, equipped: canonical.equipped});
      // Settle the pre-cutover interval once before the actor records current
      // activity. The migration backup retains the original local timestamp.
      const save = saveActor(actor, operation.resetVersion); save.player.lastActiveTimestamp = selected.player.lastActiveTimestamp;
      const exp = await reconcileCanonicalExpeditions(client, {...row, progress_json: save}, save, this.now());
      actor.replacePlayer({...actor.current.player!, ...save.player, inventory: canonical.inventory, equipped: canonical.equipped, lastActiveTimestamp: this.now()});
      const updated = await this.update(client, row, actor, true);
      await client.query('INSERT INTO game_operations(telegram_id,reset_version,operation_id,request_hash,outcome,result_json,result_version) VALUES($1,$2,$3,$4,\'applied\',\'null\'::jsonb,$5)', [identity.id, operation.resetVersion, operation.operationId, requestHash, updated.progress_version]);
      return {...this.envelope(identity, updated, operation.sessionToken, actor, exp.state), operation: {id: operation.operationId, outcome: 'applied' as const, result: null, replayed: false}};
    });
  }
  async keepServer(identity: GameIdentity, operation: GameOperation) {
    return this.operation(identity, operation, {type: 'keepServer'});
  }
  async migrateStoredLegacy(identity: GameIdentity, operation: GameOperation) {
    const row = (await this.pool.query('SELECT progress_json FROM players WHERE telegram_id=$1', [identity.id])).rows[0];
    if (!row?.progress_json) throw new ProgressError('NO_CHARACTER', 'Серверный персонаж отсутствует.');
    return this.migrate(identity, operation, row.progress_json, true);
  }
}
