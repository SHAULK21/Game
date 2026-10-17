import type {Express, RequestHandler} from 'express';
import {NativePool} from './pool';
import {createMarketListing, buyMarketListing, returnMarketListing, returnExpiredMarketListings} from '../marketListings';
import {sellToResidents} from '../localMarket';
import {disposeBulkItems, BulkDisposalError} from '../bulkDisposal';
import {residentDemand, residentMarketDay} from '../../src/utils/localMarket';
import {gameTransactionPool} from '../gameTransactions';

const same = (a: any, b: any) => a != null && b != null && String(a) === String(b);
const project = (row: any, keys: string[]) => Object.fromEntries(keys.map(key => [key, row[key] ?? null]));
export function registerNativeMarket(app: Express, native: NativePool, auth: RequestHandler) {
  const pool = gameTransactionPool(native.asPool());
  const table = (name: string) => native.table(name);
  const safe = (action: any, success = 200): RequestHandler => async (req, res) => {
    try {res.status(success).json(await action(req));}
    catch (error) {
      if ((error as any)?.code === 'NATIVE_QUERY_UNSUPPORTED') throw error;
      res.status(error instanceof BulkDisposalError ? error.status : 400).json({error: error instanceof Error ? error.message : 'Действие не выполнено.'});
    }
  };
  app.get('/api/market/listings', auth, (req, res) => {
    const type = String(req.query.type || '').trim();
    const listings = table('market_listings').filter(row => row.status === 'active' && row.verified && new Date(row.expires_at).getTime() > native.now() && (!type || row.item_json.type === type))
      .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))).slice(0, 100)
      .flatMap(row => {const seller = table('players').find(player => same(player.telegram_id, row.seller_telegram_id));
        return seller ? [{...project(row, ['id', 'seller_telegram_id', 'item_json', 'quantity', 'price_gold', 'created_at']), display_name: seller.character_name?.trim() || 'Игрок'}] : [];});
    res.json({listings});
  });
  app.get('/api/market/residents/demand', auth, (_req, res) => {res.json(residentDemand(residentMarketDay(new Date(native.now()))));});
  app.post('/api/market/list', auth, safe(async (req: any) => {
    const listing = await createMarketListing(pool, req.authUser.id, req.body, Number(req.get('X-Game-Reset-Version') || 0));
    const seller = table('players').find(row => same(row.telegram_id, req.authUser.id));
    return {listing: {...listing, display_name: seller?.character_name?.trim() || 'Игрок'}};
  }, 201));
  app.post('/api/market/residents', auth, safe((req: any) => sellToResidents(pool, req.authUser.id, Number(req.get('X-Game-Reset-Version') || 0), req.body, new Date(native.now()))));
  app.post('/api/market/:listingId/buy', auth, safe((req: any) => buyMarketListing(pool, req.authUser.id, req.params.listingId, req.body, Number(req.get('X-Game-Reset-Version') || 0))));
  app.post('/api/market/:listingId/return', auth, safe((req: any) => returnMarketListing(pool, req.authUser.id, req.params.listingId, Number(req.get('X-Game-Reset-Version') || 0))));
  app.get('/api/market/income', auth, (req, res) => res.json({balanceGold: Number(table('players').find(row => same(row.telegram_id, req.authUser!.id))?.market_gold || 0)}));
  app.get('/api/market/mine', auth, safe(async (req: any) => {
    await returnExpiredMarketListings(pool, req.authUser.id);
    return {listings: table('market_listings').filter(row => same(row.seller_telegram_id, req.authUser.id) && row.status === 'active').sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))).map(row => project(row, ['id', 'item_json', 'quantity', 'price_gold', 'expires_at', 'verified']))};
  }));
  app.get('/api/items/owned', auth, safe(async (req: any) => {
    await returnExpiredMarketListings(pool, req.authUser.id);
    return {items: table('owned_items').filter(row => same(row.owner_telegram_id, req.authUser.id)).sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))).map(row => project(row, ['id', 'item_json', 'quantity', 'locked', 'bound_clan_id', 'equipped_slot', 'origin']))};
  }));
  app.post('/api/items/bulk-dispose', auth, safe((req: any) => disposeBulkItems(pool, req.authUser.id, req.body)));
  app.post('/api/items/:itemId/equip', auth, safe((req: any) => {
    const row = table('owned_items').find(row => row.id === req.params.itemId && same(row.owner_telegram_id, req.authUser.id));
    if (!row) throw new Error('Предмет не принадлежит персонажу.');
    const slot = row.item_json.type;
    if (!['weapon','offhand','helmet','armor','pants','gloves','boots','amulet','ring','belt','cloak','artifact','pickaxe','alchemyTool'].includes(slot)) throw new Error('Этот предмет нельзя надеть.');
    for (const old of table('owned_items')) if (same(old.owner_telegram_id, req.authUser.id) && old.equipped_slot === slot) old.equipped_slot = null;
    row.equipped_slot = slot; row.updated_at = new Date(native.now()).toISOString(); return {ok: true};
  }));
  app.post('/api/items/:itemId/unequip', auth, safe((req: any) => {
    const row = table('owned_items').find(row => row.id === req.params.itemId && same(row.owner_telegram_id, req.authUser.id));
    if (row) {row.equipped_slot = null; row.updated_at = new Date(native.now()).toISOString();} return {ok: true};
  }));
  app.post('/api/items/:itemId/lock', auth, (req, res) => {
    const row = table('owned_items').find(row => row.id === req.params.itemId && same(row.owner_telegram_id, req.authUser!.id));
    if (!row) {res.status(404).json({error: 'Предмет не найден.'}); return;}
    row.locked = !row.locked; row.updated_at = new Date(native.now()).toISOString(); res.json({locked: row.locked});
  });
  app.post('/api/items/:itemId/dispose', auth, safe((req: any) => {
    const action = req.body?.action;
    if (!['sell', 'disassemble'].includes(action)) throw new Error('Недопустимое действие.');
    const row = table('owned_items').find(row => row.id === req.params.itemId && same(row.owner_telegram_id, req.authUser.id));
    if (!row || row.locked || row.equipped_slot) throw new Error('Предмет недоступен.');
    const item = row.item_json, quantity = Number(row.quantity);
    const gold = action === 'sell' ? Math.max(0, Math.min(100000, Number(item.sellPrice || 0))) * quantity : 0;
    const silver = action === 'disassemble' ? Math.max(0, Math.min(100000, Number(item.disassembleYield?.silver || 0))) * quantity : 0;
    const ore = action === 'disassemble' ? Math.max(0, Math.min(1000, Number(item.disassembleYield?.ore || 0))) * quantity : 0;
    native.world.tables.owned_items = table('owned_items').filter(item => item.id !== row.id);
    return {ok: true, gold, silver, ore};
  }));
}
