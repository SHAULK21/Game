import type {Pool, PoolClient} from 'pg';

type Row = Record<string, any>;
export interface NativeWorld {tables: Record<string, Row[]>; [key: string]: any}
const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value));
const same = (a: any, b: any) => a != null && b != null && String(a) === String(b);
const json = (value: any) => typeof value === 'string' ? JSON.parse(value) : copy(value);
const iso = (value: any) => value instanceof Date ? value.toISOString() : value;
const normalize = (sql: string) => sql.replace(/\s+/g, ' ').trim().replace(/;$/, '');

/** Repository adapter for the existing, reviewed game services. It operates on
 * a private JSON candidate, never on the platform DB. Unsupported SQL fails
 * closed. The enclosing document CAS is the only durable commit boundary. */
export class NativePool {
  constructor(readonly world: NativeWorld, readonly now: () => number = Date.now) {}
  table(name: string): Row[] {return this.world.tables[name] ??= [];}
  private timestamp() {return new Date(this.now()).toISOString();}
  ensurePlayer(identity: {id: number; username?: string; displayName: string}) {
    let row = this.table('players').find(row => same(row.telegram_id, identity.id));
    if (!row) {
      row = {telegram_id: String(identity.id), username: identity.username || null, display_name: identity.displayName,
        reset_version: 0, progress_version: 0, progress_session_generation: 0, progress_session_hash: null,
        progress_migration_open: true, progress_json: null, character_authority: 'legacy-local', level: 1, arena_rating: 1000,
        clan_id: null, market_gold: 0, premium_until: null, created_at: this.timestamp(), updated_at: this.timestamp(),
        last_seen_at: null, bot_started: false, preferred_language: 'ru', preferred_interface: 'classic',
        notification_settings: {}, referred_by: null};
      this.table('players').push(row);
    }
    row.username = identity.username || null; row.display_name = identity.displayName;
    return row;
  }
  asPool(): Pool {return this as unknown as Pool;}
  async end() {}
  async connect(): Promise<PoolClient> {
    let transaction: NativeWorld | undefined;
    const savepoints: {name: string; state: NativeWorld}[] = [];
    const restore = (snapshot: NativeWorld) => {
      for (const key of Object.keys(this.world)) delete this.world[key];
      Object.assign(this.world, copy(snapshot));
    };
    return {query: async (sql: string, args: any[] = []) => {
      const text = normalize(sql);
      const empty = {rows: [], rowCount: 0};
      if (text === 'BEGIN') {if (transaction) throw new Error('Nested BEGIN must use a savepoint.'); transaction = copy(this.world); return empty;}
      if (text === 'COMMIT') {transaction = undefined; savepoints.length = 0; return empty;}
      if (text === 'ROLLBACK') {if (transaction) restore(transaction); transaction = undefined; savepoints.length = 0; return empty;}
      const match = /^(SAVEPOINT|ROLLBACK TO SAVEPOINT|RELEASE SAVEPOINT) ([a-zA-Z0-9_]+)$/.exec(text);
      if (match) {
        if (match[1] === 'SAVEPOINT') savepoints.push({name: match[2], state: copy(this.world)});
        else {
          let index = savepoints.length - 1;
          while (index >= 0 && savepoints[index].name !== match[2]) index--;
          if (index < 0) throw new Error('Savepoint not found.');
          if (match[1] === 'ROLLBACK TO SAVEPOINT') {restore(savepoints[index].state); savepoints.splice(index + 1);}
          else savepoints.splice(index);
        }
        return empty;
      }
      return this.query(text, args);
    }, release() {}} as unknown as PoolClient;
  }
  async query(sql: string, args: any[] = []): Promise<{rows: any[]; rowCount: number}> {
    const q = normalize(sql), a = args;
    const result = (rows: Row[] = [], count = rows.length) => ({rows: copy(rows), rowCount: count});
    const player = (id: any) => this.table('players').find(row => same(row.telegram_id, id));
    const update = (rows: Row[], fn: (row: Row) => void) => {rows.forEach(fn); return result([], rows.length);};
    const remove = (name: string, predicate: (row: Row) => boolean) => {
      const before = this.table(name), kept = before.filter(row => !predicate(row));
      this.world.tables[name] = kept; return result([], before.length - kept.length);
    };
    const insert = (name: string, row: Row) => {
      const created = {created_at: this.timestamp(), updated_at: this.timestamp(), ...row};
      this.table(name).push(created); return result([created]);
    };
    if (q.startsWith('SELECT pg_advisory_xact_lock(')) return result([{}]);
    if (q === 'SELECT * FROM players WHERE telegram_id=$1 FOR UPDATE') return result(player(a[0]) ? [player(a[0])!] : []);
    if (q === 'SELECT progress_json FROM players WHERE telegram_id=$1') return result(player(a[0]) ? [{progress_json: player(a[0])!.progress_json}] : []);
    if (q === 'UPDATE players SET last_seen_at=$2 WHERE telegram_id=$1') return update(this.table('players').filter(row => same(row.telegram_id, a[0])), row => {row.last_seen_at = iso(a[1]);});
    if (q === 'UPDATE players SET progress_session_hash=$2,progress_session_generation=progress_session_generation+1 WHERE telegram_id=$1') {
      return update(this.table('players').filter(row => same(row.telegram_id, a[0])), row => {row.progress_session_hash = a[1]; row.progress_session_generation = Number(row.progress_session_generation) + 1;});
    }
    if (q === "UPDATE players SET progress_json=$2::jsonb,progress_version=progress_version+1, progress_migration_open=CASE WHEN $3 THEN FALSE ELSE progress_migration_open END, character_authority='server-actions-v1',character_name=$4,level=$5,arena_rating=$6,class_id=$7,updated_at=NOW() WHERE telegram_id=$1 RETURNING *") {
      const row = player(a[0]); if (!row) return result();
      Object.assign(row, {progress_json: json(a[1]), progress_version: Number(row.progress_version) + 1,
        progress_migration_open: a[2] ? false : row.progress_migration_open, character_authority: 'server-actions-v1',
        character_name: a[3], level: a[4], arena_rating: a[5], class_id: a[6], updated_at: this.timestamp()});
      return result([row]);
    }
    if (q === 'UPDATE players SET progress_json=$1::jsonb,progress_version=$2,progress_migration_open=CASE WHEN $4 THEN FALSE ELSE progress_migration_open END,updated_at=NOW() WHERE telegram_id=$3') {
      return update(this.table('players').filter(row => same(row.telegram_id, a[2])), row => Object.assign(row, {
        progress_json: json(a[0]), progress_version: a[1], progress_migration_open: a[3] ? false : row.progress_migration_open, updated_at: this.timestamp()}));
    }
    const receiptSelect = /^SELECT (\*|outcome,result_json|request_hash|response_json) FROM (game_operations|expedition_operations|progress_api_operations) WHERE telegram_id=\$1 AND reset_version=\$2 AND operation_id=\$3$/.exec(q);
    if (receiptSelect) {
      const rows = this.table(receiptSelect[2]).filter(row => same(row.telegram_id, a[0]) && same(row.reset_version, a[1]) && same(row.operation_id, a[2]));
      return result(receiptSelect[1] === '*' ? rows : rows.map(row => Object.fromEntries(receiptSelect[1].split(',').map(key => [key, row[key]]))));
    }
    if (q === 'INSERT INTO game_operations(telegram_id,reset_version,operation_id,request_hash,outcome,result_json,result_version) VALUES($1,$2,$3,$4,$5,$6::jsonb,$7)' ||
        q === "INSERT INTO game_operations(telegram_id,reset_version,operation_id,request_hash,outcome,result_json,result_version) VALUES($1,$2,$3,$4,'applied','null'::jsonb,$5)" ||
        q === "INSERT INTO game_operations(telegram_id,reset_version,operation_id,request_hash,outcome,result_json,result_version) VALUES($1,$2,$3,$4,'rejected',$5::jsonb,$6)") {
      if (this.table('game_operations').some(row => same(row.telegram_id, a[0]) && same(row.reset_version, a[1]) && row.operation_id === a[2])) throw new Error('Duplicate operation receipt.');
      const applied = q.includes("'applied'"), rejected = q.includes("'rejected'");
      return insert('game_operations', {telegram_id: a[0], reset_version: a[1], operation_id: a[2], request_hash: a[3],
        outcome: applied ? 'applied' : rejected ? 'rejected' : a[4], result_json: applied ? null : json(a[rejected ? 4 : 5]), result_version: a[applied ? 4 : rejected ? 5 : 6]});
    }
    if (q === 'INSERT INTO expedition_operations(telegram_id,reset_version,operation_id,request_hash,result_json,outcome) VALUES($1,$2,$3,$4,$5::jsonb,$6)') {
      if (this.table('expedition_operations').some(row => same(row.telegram_id, a[0]) && same(row.reset_version, a[1]) && row.operation_id === a[2])) throw new Error('Duplicate expedition receipt.');
      return insert('expedition_operations', {telegram_id: a[0], reset_version: a[1], operation_id: a[2], request_hash: a[3], result_json: json(a[4]), outcome: a[5]});
    }
    const backup = /^INSERT INTO character_migration_backups\(telegram_id,reset_version,progress_version,source,save_json\) VALUES\(\$1,\$2,\$3,'(local_selected|server_before_choice)',\$4::jsonb\)$/.exec(q);
    if (backup) return insert('character_migration_backups', {id: crypto.randomUUID(), telegram_id: a[0], reset_version: a[1], progress_version: a[2], source: backup[1], save_json: json(a[3])});
    if (q === 'SELECT state_json FROM expedition_accounts WHERE telegram_id=$1' || q === 'SELECT reset_version,state_json FROM expedition_accounts WHERE telegram_id=$1') {
      return result(this.table('expedition_accounts').filter(row => same(row.telegram_id, a[0])).map(row => q.includes('reset_version') ? {reset_version: row.reset_version, state_json: row.state_json} : {state_json: row.state_json}));
    }
    if (q === 'DELETE FROM expedition_accounts WHERE telegram_id=$1') return remove('expedition_accounts', row => same(row.telegram_id, a[0]));
    if (q === 'INSERT INTO expedition_accounts(telegram_id,reset_version,state_json) VALUES($1,$2,$3::jsonb) ON CONFLICT(telegram_id) DO UPDATE SET reset_version=EXCLUDED.reset_version,state_json=EXCLUDED.state_json,updated_at=NOW()') {
      const row = this.table('expedition_accounts').find(row => same(row.telegram_id, a[0]));
      if (row) {Object.assign(row, {reset_version: a[1], state_json: json(a[2]), updated_at: this.timestamp()}); return result([], 1);}
      return insert('expedition_accounts', {telegram_id: a[0], reset_version: a[1], state_json: json(a[2])});
    }
    if (q === 'INSERT INTO expedition_migration_backups(telegram_id,reset_version,save_json,cutover_at) VALUES($1,$2,$3::jsonb,$4) ON CONFLICT DO NOTHING') {
      if (this.table('expedition_migration_backups').some(row => same(row.telegram_id, a[0]) && same(row.reset_version, a[1]))) return result();
      return insert('expedition_migration_backups', {telegram_id: a[0], reset_version: a[1], save_json: json(a[2]), cutover_at: iso(a[3])});
    }
    if (q === 'SELECT * FROM owned_items WHERE owner_telegram_id=$1 FOR UPDATE' || q === 'SELECT * FROM owned_items WHERE owner_telegram_id=$1 ORDER BY created_at,id FOR UPDATE') {
      const rows = this.table('owned_items').filter(row => same(row.owner_telegram_id, a[0]));
      if (q.includes('ORDER BY')) rows.sort((x, y) => String(x.created_at).localeCompare(String(y.created_at)) || String(x.id).localeCompare(String(y.id)));
      return result(rows);
    }
    if (q === 'INSERT INTO game_ledger_ids(telegram_id,item_id) SELECT owner_telegram_id,id FROM owned_items WHERE owner_telegram_id=$1 ON CONFLICT DO NOTHING') {
      let inserted = 0;
      for (const item of this.table('owned_items').filter(row => same(row.owner_telegram_id, a[0]))) {
        if (!this.table('game_ledger_ids').some(row => same(row.telegram_id, a[0]) && row.item_id === item.id)) {this.table('game_ledger_ids').push({telegram_id: a[0], item_id: item.id}); inserted++;}
      }
      return result([], inserted);
    }
    if (q === 'SELECT 1 FROM game_ledger_ids WHERE telegram_id=$1 AND item_id=$2') return result(this.table('game_ledger_ids').some(row => same(row.telegram_id, a[0]) && row.item_id === a[1]) ? [{'?column?': 1}] : []);
    if (q === 'UPDATE owned_items SET equipped_slot=NULL WHERE owner_telegram_id=$1 AND equipped_slot IS NOT NULL') return update(this.table('owned_items').filter(row => same(row.owner_telegram_id, a[0]) && row.equipped_slot != null), row => {row.equipped_slot = null;});
    if (q === 'UPDATE owned_items SET item_json=$2::jsonb,quantity=$3,equipped_slot=$4,locked=$5,updated_at=NOW() WHERE id=$1 AND owner_telegram_id=$6') {
      return update(this.table('owned_items').filter(row => row.id === a[0] && same(row.owner_telegram_id, a[5])), row => Object.assign(row, {item_json: json(a[1]), quantity: a[2], equipped_slot: a[3], locked: a[4], updated_at: this.timestamp()}));
    }
    if (q === 'INSERT INTO owned_items(id,owner_telegram_id,item_json,quantity,equipped_slot,locked,origin,character_id) VALUES($1,$2,$3::jsonb,$4,$5,$6,$7,$8)') {
      if (this.table('owned_items').some(row => row.id === a[0])) throw new Error('Duplicate item identity.');
      return insert('owned_items', {id: a[0], owner_telegram_id: a[1], item_json: json(a[2]), quantity: a[3], equipped_slot: a[4], locked: a[5], origin: a[6], character_id: a[7], bound_clan_id: null});
    }
    if (q === 'DELETE FROM owned_items WHERE id=$1 AND owner_telegram_id=$2') return remove('owned_items', row => row.id === a[0] && same(row.owner_telegram_id, a[1]));
    if (q === 'DELETE FROM owned_items WHERE owner_telegram_id=$1 AND character_id=$2') return remove('owned_items', row => same(row.owner_telegram_id, a[0]) && row.character_id === a[1]);
    if (q === 'DELETE FROM owned_items WHERE id=$1') return remove('owned_items', row => row.id === a[0]);
    if (q === 'UPDATE owned_items SET quantity=quantity+$1,updated_at=NOW() WHERE id=$2' || q === 'UPDATE owned_items SET quantity=quantity-$1,updated_at=NOW() WHERE id=$2') return update(this.table('owned_items').filter(row => row.id === a[1]), row => {row.quantity = Number(row.quantity) + (q.includes('quantity+$1') ? 1 : -1) * a[0]; row.updated_at = this.timestamp();});
    if (q === 'SELECT id,item_json,quantity,bound_clan_id FROM owned_items WHERE owner_telegram_id=$1 AND equipped_slot IS NULL FOR UPDATE') return result(this.table('owned_items').filter(row => same(row.owner_telegram_id, a[0]) && row.equipped_slot == null).map(row => ({id: row.id, item_json: row.item_json, quantity: row.quantity, bound_clan_id: row.bound_clan_id})));
    if (q === "INSERT INTO owned_items(owner_telegram_id,item_json,quantity,origin) VALUES($1,$2::jsonb,$3,'expedition') RETURNING id") {
      const inserted = insert('owned_items', {id: crypto.randomUUID(), owner_telegram_id: a[0], item_json: json(a[1]), quantity: a[2], origin: 'expedition', equipped_slot: null, locked: false, character_id: null, bound_clan_id: null});
      return result(inserted.rows.map(row => ({id: row.id})));
    }
    if (q === "SELECT id,quantity FROM owned_items WHERE owner_telegram_id=$1 AND (item_json->>'templateId'=$2 OR (item_json->>'name'=$3 AND item_json->>'type'=$4 AND item_json->>'rarity'=$5)) AND equipped_slot IS NULL AND NOT locked AND bound_clan_id IS NULL ORDER BY created_at,id FOR UPDATE") {
      return result(this.table('owned_items').filter(row => same(row.owner_telegram_id, a[0]) && row.equipped_slot == null && !row.locked && row.bound_clan_id == null && (row.item_json.templateId === a[1] || row.item_json.name === a[2] && row.item_json.type === a[3] && row.item_json.rarity === a[4]))
        .sort((x, y) => String(x.created_at).localeCompare(String(y.created_at)) || String(x.id).localeCompare(String(y.id))).map(row => ({id: row.id, quantity: row.quantity})));
    }
    if (q === "SELECT item_id::text AS id FROM game_ledger_ids UNION SELECT id::text FROM owned_items UNION SELECT request_json->>'itemId' FROM market_listing_requests UNION SELECT jsonb_array_elements_text(result_json->'itemIds') FROM inventory_bulk_disposals WHERE result_json ? 'itemIds'") {
      const ids = new Set<any>([...this.table('game_ledger_ids').map(row => row.item_id), ...this.table('owned_items').map(row => row.id), ...this.table('market_listing_requests').map(row => row.request_json?.itemId ?? null), ...this.table('inventory_bulk_disposals').flatMap(row => row.result_json?.itemIds ?? [])]);
      return result([...ids].map(id => ({id})));
    }
    if (q === 'INSERT INTO game_notifications (telegram_id,event_key,category,text,due_at) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (telegram_id,event_key) DO NOTHING') {
      if (this.table('game_notifications').some(row => same(row.telegram_id, a[0]) && row.event_key === a[1])) return result();
      const id = this.table('game_notifications').reduce((max, row) => Math.max(max, Number(row.id)), 0) + 1;
      return insert('game_notifications', {id, telegram_id: a[0], event_key: a[1], category: a[2], text: a[3], due_at: iso(a[4]), sent_at: null, read_at: null, attempts: 0, next_attempt_at: this.timestamp()});
    }
    if (q === 'UPDATE game_notifications SET sent_at=NOW(),read_at=NOW() WHERE telegram_id=$1 AND event_key=$2 AND sent_at IS NULL') return update(this.table('game_notifications').filter(row => same(row.telegram_id, a[0]) && row.event_key === a[1] && row.sent_at == null), row => {row.sent_at = this.timestamp(); row.read_at = this.timestamp();});
    if (q === 'SELECT reset_version FROM players WHERE telegram_id=$1 FOR UPDATE' || q === 'SELECT reset_version FROM players WHERE telegram_id=$1') return result(player(a[0]) ? [{reset_version: player(a[0])!.reset_version}] : []);
    if (q === 'SELECT * FROM owned_items WHERE id=$1 AND owner_telegram_id=$2 FOR UPDATE' || q === 'SELECT * FROM owned_items WHERE owner_telegram_id=$1 AND id=$2') return result(this.table('owned_items').filter(row => q.includes('WHERE id=') ? row.id === a[0] && same(row.owner_telegram_id, a[1]) : same(row.owner_telegram_id, a[0]) && row.id === a[1]));
    const byId = /^SELECT \* FROM (market_listing_requests|market_purchase_requests|market_listings|inventory_bulk_disposals) WHERE id=\$1$/.exec(q);
    if (byId) return result(this.table(byId[1]).filter(row => row.id === a[0]));
    if (q === 'SELECT seller_telegram_id FROM market_listings WHERE id=$1') return result(this.table('market_listings').filter(row => row.id === a[0]).map(row => ({seller_telegram_id: row.seller_telegram_id})));
    if (q === 'SELECT telegram_id,reset_version,market_gold,premium_until > NOW() AS is_premium FROM players WHERE telegram_id IN ($1,$2) ORDER BY telegram_id FOR UPDATE') return result(this.table('players').filter(row => same(row.telegram_id, a[0]) || same(row.telegram_id, a[1])).sort((x, y) => Number(x.telegram_id) - Number(y.telegram_id)).map(row => ({telegram_id: row.telegram_id, reset_version: row.reset_version, market_gold: row.market_gold, is_premium: new Date(row.premium_until || 0).getTime() > this.now()})));
    if (q === 'SELECT *, expires_at > NOW() AS unexpired FROM market_listings WHERE id=$1 FOR UPDATE') return result(this.table('market_listings').filter(row => row.id === a[0]).map(row => ({...row, unexpired: new Date(row.expires_at).getTime() > this.now()})));
    if (q === 'SELECT *, expires_at <= NOW() AS expired FROM market_listings WHERE id=$1 AND seller_telegram_id=$2 FOR UPDATE') return result(this.table('market_listings').filter(row => row.id === a[0] && same(row.seller_telegram_id, a[1])).map(row => ({...row, expired: new Date(row.expires_at).getTime() <= this.now()})));
    if (q === "SELECT id FROM market_listings WHERE seller_telegram_id=$1 AND status='active' AND expires_at <= NOW() ORDER BY created_at") return result(this.table('market_listings').filter(row => same(row.seller_telegram_id, a[0]) && row.status === 'active' && new Date(row.expires_at).getTime() <= this.now()).sort((x, y) => String(x.created_at).localeCompare(String(y.created_at))).map(row => ({id: row.id})));
    if (q === 'UPDATE owned_items SET quantity=quantity-$1 WHERE id=$2' || q === 'UPDATE owned_items SET quantity=quantity+$2 WHERE id=$1') return update(this.table('owned_items').filter(row => row.id === a[q.includes('WHERE id=$1') ? 0 : 1]), row => {row.quantity = Number(row.quantity) + (q.includes('quantity+$2') ? Number(a[1]) : -Number(a[0]));});
    if (q === 'INSERT INTO market_listings (seller_telegram_id,item_json,quantity,price_gold,verified,seller_reset_version) VALUES ($1,$2::jsonb,$3,$4,true,$5) RETURNING *') return insert('market_listings', {id: crypto.randomUUID(), seller_telegram_id: a[0], item_json: json(a[1]), quantity: a[2], price_gold: a[3], verified: true, seller_reset_version: a[4], status: 'active', expires_at: new Date(this.now() + 7 * 86400000).toISOString(), sale_tax_gold: 0, seller_net_gold: 0, returned_item_id: null, purchased_item_id: null, buyer_telegram_id: null, sold_at: null});
    if (q === 'INSERT INTO market_listing_requests (id,telegram_id,request_json,listing_id) VALUES ($1,$2,$3::jsonb,$4)') return insert('market_listing_requests', {id: a[0], telegram_id: a[1], request_json: json(a[2]), listing_id: a[3]});
    if (q === 'INSERT INTO market_purchase_requests (id,telegram_id,listing_id,reset_version,result_json) VALUES ($1,$2,$3,$4,$5::jsonb)') return insert('market_purchase_requests', {id: a[0], telegram_id: a[1], listing_id: a[2], reset_version: a[3], result_json: json(a[4])});
    if (q === "INSERT INTO owned_items (owner_telegram_id,item_json,quantity,origin) VALUES ($1,$2::jsonb,$3,'market_purchase') RETURNING id" || q === 'INSERT INTO owned_items (owner_telegram_id,item_json,quantity,origin) VALUES ($1,$2::jsonb,$3,$4) RETURNING id' || q === "INSERT INTO owned_items(owner_telegram_id,item_json,quantity,origin,character_id) VALUES($1,$2::jsonb,$3,'game_command',$4)") {
      const row = {id: crypto.randomUUID(), owner_telegram_id: a[0], item_json: json(a[1]), quantity: a[2],
        origin: q.includes("'market_purchase'") ? 'market_purchase' : q.includes("'game_command'") ? 'game_command' : a[3],
        character_id: q.includes('character_id') ? a[3] : null, equipped_slot: null, bound_clan_id: null, clan_id: null, locked: false};
      insert('owned_items', row); return result(q.includes('RETURNING id') ? [{id: row.id}] : [], 1);
    }
    if (q === 'UPDATE players SET market_gold=market_gold-$2 WHERE telegram_id=$1' || q === 'UPDATE players SET market_gold=market_gold+$2 WHERE telegram_id=$1') return update(this.table('players').filter(row => same(row.telegram_id, a[0])), row => {row.market_gold = Number(row.market_gold) + (q.includes('market_gold+$2') ? 1 : -1) * Number(a[1]);});
    if (q === "UPDATE market_listings SET status='sold',buyer_telegram_id=$2,purchased_item_id=$3,sale_tax_gold=$4,seller_net_gold=$5,sold_at=NOW() WHERE id=$1") return update(this.table('market_listings').filter(row => row.id === a[0]), row => Object.assign(row, {status: 'sold', buyer_telegram_id: a[1], purchased_item_id: a[2], sale_tax_gold: a[3], seller_net_gold: a[4], sold_at: this.timestamp()}));
    if (q === "UPDATE market_listings SET status='cancelled',returned_item_id=$2 WHERE id=$1") return update(this.table('market_listings').filter(row => row.id === a[0]), row => Object.assign(row, {status: 'cancelled', returned_item_id: a[1]}));
    if (q === 'SELECT * FROM progress_api_operations WHERE telegram_id=$1 AND operation_id=$2') return result(this.table('progress_api_operations').filter(row => same(row.telegram_id, a[0]) && row.operation_id === a[1]));
    if (q === 'INSERT INTO progress_api_operations(telegram_id,operation_id,reset_version,request_hash,response_json) VALUES($1,$2,$3,$4,$5::jsonb)') {
      if (this.table('progress_api_operations').some(row => same(row.telegram_id, a[0]) && row.operation_id === a[1])) throw new Error('Duplicate API receipt.');
      return insert('progress_api_operations', {telegram_id: a[0], operation_id: a[1], reset_version: a[2], request_hash: a[3], response_json: json(a[4])});
    }
    if (q === 'UPDATE players SET progress_json=$2::jsonb,progress_version=progress_version+1,progress_migration_open=FALSE WHERE telegram_id=$1') return update(this.table('players').filter(row => same(row.telegram_id, a[0])), row => {row.progress_json = json(a[1]); row.progress_version = Number(row.progress_version) + 1; row.progress_migration_open = false;});
    if (q === 'SELECT id,item_json,quantity FROM owned_items WHERE owner_telegram_id=$1 AND equipped_slot IS NULL FOR UPDATE') return result(this.table('owned_items').filter(row => same(row.owner_telegram_id, a[0]) && row.equipped_slot == null).map(row => ({id: row.id, item_json: row.item_json, quantity: row.quantity})));
    if (q === 'INSERT INTO inventory_bulk_disposals (id,telegram_id,request_json,result_json) VALUES ($1,$2,$3::jsonb,$4::jsonb)' || q === 'INSERT INTO inventory_bulk_disposals (id, telegram_id, request_json, result_json) VALUES ($1,$2,$3::jsonb,$4::jsonb)') return insert('inventory_bulk_disposals', {id: a[0], telegram_id: a[1], request_json: json(a[2]), result_json: json(a[3])});
    if (q === 'SELECT telegram_id, request_json, result_json FROM inventory_bulk_disposals WHERE id = $1') return result(this.table('inventory_bulk_disposals').filter(row => row.id === a[0]).map(row => ({telegram_id: row.telegram_id, request_json: row.request_json, result_json: row.result_json})));
    if (q === 'SELECT (premium_until > NOW()) AS active FROM players WHERE telegram_id = $1') return result(player(a[0]) ? [{active: new Date(player(a[0])!.premium_until || 0).getTime() > this.now()}] : []);
    if (q === 'SELECT * FROM owned_items WHERE id = ANY($1::uuid[]) AND owner_telegram_id = $2 ORDER BY id FOR UPDATE') return result(this.table('owned_items').filter(row => a[0].includes(row.id) && same(row.owner_telegram_id, a[1])).sort((x, y) => x.id.localeCompare(y.id)));
    if (q === 'DELETE FROM owned_items WHERE id = ANY($1::uuid[]) AND owner_telegram_id = $2') return remove('owned_items', row => a[0].includes(row.id) && same(row.owner_telegram_id, a[1]));
    if (q === "SELECT to_regclass('expedition_accounts') IS NOT NULL AS enabled" || q === "SELECT to_regclass('game_operations') IS NOT NULL AS enabled") return result([{enabled: true}]);
    if (q === 'SELECT admin_id, target_id, reset_version FROM admin_account_resets WHERE id=$1') return result(this.table('admin_account_resets').filter(row => row.id === a[0]).map(row => ({admin_id: row.admin_id, target_id: row.target_id, reset_version: row.reset_version})));
    if (q === 'SELECT telegram_id, clan_id, reset_version FROM players WHERE telegram_id=$1 FOR UPDATE') return result(player(a[0]) ? [{telegram_id: player(a[0])!.telegram_id, clan_id: player(a[0])!.clan_id, reset_version: player(a[0])!.reset_version}] : []);
    if (q === 'SELECT owner_telegram_id FROM clans WHERE id=$1 FOR UPDATE') return result(this.table('clans').filter(row => row.id === a[0]).map(row => ({owner_telegram_id: row.owner_telegram_id})));
    if (q === "SELECT telegram_id FROM clan_members WHERE clan_id=$1 AND telegram_id<>$2 ORDER BY CASE role WHEN 'officer' THEN 0 WHEN 'quartermaster' THEN 1 WHEN 'veteran' THEN 2 ELSE 3 END, joined_at, telegram_id LIMIT 1 FOR UPDATE") {
      const rank = (role: string) => role === 'officer' ? 0 : role === 'quartermaster' ? 1 : role === 'veteran' ? 2 : 3;
      return result(this.table('clan_members').filter(row => row.clan_id === a[0] && !same(row.telegram_id, a[1])).sort((x, y) => rank(x.role) - rank(y.role) || String(x.joined_at).localeCompare(String(y.joined_at)) || Number(x.telegram_id) - Number(y.telegram_id)).slice(0, 1).map(row => ({telegram_id: row.telegram_id})));
    }
    if (q === "UPDATE clan_members SET role='owner' WHERE clan_id=$1 AND telegram_id=$2") return update(this.table('clan_members').filter(row => row.clan_id === a[0] && same(row.telegram_id, a[1])), row => {row.role = 'owner';});
    if (q === 'UPDATE clans SET owner_telegram_id=$1, updated_at=NOW() WHERE id=$2') return update(this.table('clans').filter(row => row.id === a[1]), row => {row.owner_telegram_id = a[0]; row.updated_at = this.timestamp();});
    if (q === 'DELETE FROM clans WHERE id=$1') {
      for (const name of ['clan_members', 'clan_chat_messages', 'clan_storage_events', 'clan_management_events', 'clan_project_operations', 'clan_raid_item_claims']) remove(name, row => row.clan_id === a[0]);
      remove('owned_items', row => row.clan_id === a[0]);
      for (const row of this.table('owned_items')) if (row.bound_clan_id === a[0]) row.bound_clan_id = null;
      return remove('clans', row => row.id === a[0]);
    }
    const resetDelete = /^DELETE FROM (clan_members|expedition_operations|game_operations|progress_api_operations|market_listing_requests|inventory_bulk_disposals|clan_raid_item_claims|pvp_profiles) WHERE telegram_id=\$1$/.exec(q);
    if (resetDelete) return remove(resetDelete[1], row => same(row.telegram_id, a[0]));
    if (q === 'DELETE FROM owned_items WHERE owner_telegram_id=$1') return remove('owned_items', row => same(row.owner_telegram_id, a[0]));
    if (q === 'DELETE FROM clan_creation_requests WHERE owner_telegram_id=$1') return remove('clan_creation_requests', row => same(row.owner_telegram_id, a[0]));
    if (q === 'DELETE FROM pvp_matches WHERE attacker=$1 OR defender=$1') return remove('pvp_matches', row => same(row.attacker, a[0]) || same(row.defender, a[0]));
    if (q === "DELETE FROM game_notifications WHERE telegram_id=$1 AND category IN ('energy','mining','arena')") return remove('game_notifications', row => same(row.telegram_id, a[0]) && ['energy', 'mining', 'arena'].includes(row.category));
    if (q === "UPDATE market_listings SET status='cancelled' WHERE seller_telegram_id=$1 AND status='active'") return update(this.table('market_listings').filter(row => same(row.seller_telegram_id, a[0]) && row.status === 'active'), row => {row.status = 'cancelled';});
    if (q === 'UPDATE players SET progress_migration_open=TRUE WHERE telegram_id=$1') return update(this.table('players').filter(row => same(row.telegram_id, a[0])), row => {row.progress_migration_open = true;});
    if (q === "UPDATE players SET progress_json=NULL,progress_version=progress_version+1, progress_session_hash=NULL,progress_session_generation=progress_session_generation+1, character_authority='legacy-local' WHERE telegram_id=$1") return update(this.table('players').filter(row => same(row.telegram_id, a[0])), row => Object.assign(row, {progress_json: null, progress_version: Number(row.progress_version) + 1, progress_session_hash: null, progress_session_generation: Number(row.progress_session_generation) + 1, character_authority: 'legacy-local'}));
    if (q === "UPDATE players SET character_name=NULL, level=1, arena_rating=1000, class_id='warrior', market_gold=120, clan_id=NULL, reset_version=reset_version+1, reset_at=NOW(), updated_at=NOW() WHERE telegram_id=$1 RETURNING reset_version") {
      const row = player(a[0]); if (!row) return result();
      Object.assign(row, {character_name: null, level: 1, arena_rating: 1000, class_id: 'warrior', market_gold: 120, clan_id: null, reset_version: Number(row.reset_version) + 1, reset_at: this.timestamp(), updated_at: this.timestamp()}); return result([{reset_version: row.reset_version}]);
    }
    if (q === 'INSERT INTO admin_account_resets (id, admin_id, target_id, reset_version) VALUES ($1,$2,$3,$4)') return insert('admin_account_resets', {id: a[0], admin_id: a[1], target_id: a[2], reset_version: a[3]});
    const error = new Error('Unsupported native repository operation.') as Error & {code: string; query: string};
    console.error('Native repository query unsupported:', q);
    error.code = 'NATIVE_QUERY_UNSUPPORTED'; error.query = q; throw error;
  }
}
