// Player market extras on top of the engine's market wallet (players.market_gold):
//  • wallet: top up from the hero's gold and withdraw sales income back to it;
//  • chat lots: an item shared in the global chat with a fixed price (buy now) and/or price offers;
//  • auctions: bids from the market wallet, the highest bid wins when the time is up.
// The item is held by the server while a lot is open, so buying works while the seller is offline.
const rows = (world, n) => (world.tables[n] ||= []);
const same = (a, b) => String(a) === String(b);
const ok = (body, status = 200) => ({status, body}), fail = (error, status = 400) => ({status, body: {error}});
const player = (world, id) => rows(world, 'players').find(p => same(p.telegram_id, id));
const nameOf = p => String(p?.character_name || p?.display_name || 'Игрок').trim() || 'Игрок';
const iso = t => new Date(t).toISOString();
const DAY = 864e5, HOUR = 3600e3;
const gold = p => Math.max(0, Math.floor(Number(p?.market_gold) || 0));
const isPremium = (p, now) => Date.parse(p?.premium_until || 0) > now;
const tax = (price, p, now) => { const t = isPremium(p, now) ? 0 : Math.ceil(price * 3 / 100); return {tax: t, net: price - t}; };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const event = (world, to, icon, text, kind, data, now) => rows(world, 'ae_events').push({id: crypto.randomUUID(), to: String(to), icon, text, kind, data: data || null, at: iso(now), acked: false});

// ---------- wallet ----------
function opDone(world, op, me) { return rows(world, 'ae_market_ops').find(o => o.op === op && same(o.u, me)); }
function wallet(world, path, body, me, now) {
  const p = player(world, me); if (!p) return fail('Сначала создайте персонажа.', 404);
  if (path === '/api/ae-market/wallet') return ok({balance: gold(p), premium: isPremium(p, now)});
  const op = String(body.operationId || ''); if (!UUID.test(op)) return fail('Нет идентификатора операции.');
  const prev = opDone(world, op, me); if (prev) return ok({balance: gold(p), amount: prev.amount, replayed: true});
  const amount = Math.floor(Number(body.gold) || 0); if (!(amount > 0) || amount > 1e8) return fail('Укажите сумму.');
  const day = iso(now).slice(0, 10), today = rows(world, 'ae_market_ops').filter(o => same(o.u, me) && o.kind === 'in' && o.at.slice(0, 10) === day).reduce((s, o) => s + o.amount, 0);
  if (path === '/api/ae-market/deposit') {
    const cap = 500000 + (Number(p.level) || 1) * 20000;
    if (today + amount > cap) return fail(`За сутки можно перевести в кошелёк рынка до ${cap} золота (осталось ${Math.max(0, cap - today)}).`);
    p.market_gold = gold(p) + amount;
  } else {
    if (gold(p) < amount) return fail(`В кошельке рынка только ${gold(p)} золота.`);
    p.market_gold = gold(p) - amount;
  }
  rows(world, 'ae_market_ops').push({op, u: String(me), kind: path === '/api/ae-market/deposit' ? 'in' : 'out', amount, at: iso(now)});
  world.tables.ae_market_ops = rows(world, 'ae_market_ops').filter(o => Date.parse(o.at) > now - 3 * DAY);
  return ok({balance: gold(p), amount});
}

// ---------- lots (chat sales + auctions) ----------
const lotView = (world, l, me) => ({id: l.id, kind: l.kind, item: l.item_json, price: l.price, status: l.status, seller: {id: l.seller, name: nameOf(player(world, l.seller))}, mine: same(l.seller, me),
  bid: l.bid ? {amount: l.bid.amount, name: nameOf(player(world, l.bid.u)), mine: same(l.bid.u, me)} : null, bids: l.bids || 0, start: l.start || null, step: l.kind === 'auction' ? minStep(l) : null,
  endsAt: l.endsAt || null, expiresAt: l.expires, at: l.at, buyer: l.buyer ? nameOf(player(world, l.buyer)) : null, soldPrice: l.soldPrice || null,
  offers: same(l.seller, me) ? rows(world, 'ae_lot_offers').filter(o => o.lot === l.id && o.status === 'pending').map(o => ({id: o.id, price: o.price, name: nameOf(player(world, o.u))})) : undefined,
  myOffer: rows(world, 'ae_lot_offers').find(o => o.lot === l.id && same(o.u, me) && o.status === 'pending')?.price || null});
const minStep = l => Math.max(1, Math.ceil((l.bid?.amount || l.start || 1) * 0.05));
function giveItem(world, to, item_json, origin, now) {
  rows(world, 'owned_items').push({id: crypto.randomUUID(), owner_telegram_id: Number(to), clan_id: null, bound_clan_id: null, quantity: 1, locked: false, equipped_slot: null, origin, character_id: null, item_json, created_at: iso(now), updated_at: iso(now)});
}
function refundOffers(world, lot, now, notify, exceptId) {
  for (const o of rows(world, 'ae_lot_offers').filter(o => o.lot === lot.id && o.status === 'pending' && o.id !== exceptId)) {
    o.status = 'refunded'; const b = player(world, o.u); if (b) b.market_gold = gold(b) + o.price;
    event(world, o.u, '↩️', `Предложение за «${lot.item_json.name}» не принято — ${o.price} 🪙 вернулись в кошелёк рынка`, 'market', null, now);
  }
}
function sell(world, lot, buyerId, price, now, notify) {
  const seller = player(world, lot.seller), t = tax(price, seller, now);
  if (seller) seller.market_gold = gold(seller) + t.net;
  giveItem(world, buyerId, lot.item_json, lot.kind === 'auction' ? 'auction' : 'chat_trade', now);
  Object.assign(lot, {status: 'sold', buyer: String(buyerId), soldPrice: price, soldAt: iso(now)});
  event(world, lot.seller, '💰', `«${lot.item_json.name}» продан за ${price} 🪙 — в кошелёк рынка +${t.net} 🪙${t.tax ? ` (налог ${t.tax})` : ''}`, 'market', null, now);
  event(world, buyerId, '🎁', `«${lot.item_json.name}» теперь ваш — он в сумке`, 'market-item', null, now);
  notify?.(world, lot.seller, `💰 «${lot.item_json.name}» продан за ${price} золота. В кошелёк рынка поступило ${t.net} золота.`, 'lot-sold:' + lot.id, now);
  notify?.(world, buyerId, `🎁 Вы получили «${lot.item_json.name}» за ${price} золота. Предмет в сумке.`, 'lot-bought:' + lot.id, now);
}
// Finish auctions whose time is up and expire old chat lots.
export function settleLots(world, now, notify) {
  for (const l of rows(world, 'ae_lots').filter(l => l.status === 'active')) {
    if (l.kind === 'auction' && Date.parse(l.endsAt) <= now) {
      if (l.bid) sell(world, l, l.bid.u, l.bid.amount, now, notify);
      else { l.status = 'returned'; giveItem(world, l.seller, l.item_json, 'auction_return', now); event(world, l.seller, '↩️', `Аукцион «${l.item_json.name}» без ставок — вещь вернулась в сумку`, 'market-item', null, now); }
    } else if (l.kind === 'chat' && Date.parse(l.expires) <= now) {
      l.status = 'returned'; giveItem(world, l.seller, l.item_json, 'chat_return', now); refundOffers(world, l, now, notify);
      event(world, l.seller, '↩️', `Лот «${l.item_json.name}» из чата не продан за 7 дней — вещь вернулась в сумку`, 'market-item', null, now);
    }
  }
  world.tables.ae_lots = rows(world, 'ae_lots').filter(l => l.status === 'active' || Date.parse(l.soldAt || l.at) > now - 3 * DAY);
  world.tables.ae_lot_offers = rows(world, 'ae_lot_offers').filter(o => o.status === 'pending' || Date.parse(o.at) > now - 3 * DAY);
}
function createLot(world, body, me, now) {
  const p = player(world, me); if (!p) return fail('Сначала создайте персонажа.', 404);
  const kind = body.kind === 'auction' ? 'auction' : 'chat';
  const it = rows(world, 'owned_items').find(i => i.id === body.itemId && same(i.owner_telegram_id, me));
  if (!it || it.locked || it.equipped_slot || it.bound_clan_id || ['legacy_market_return', 'legacy_character'].includes(it.origin)) return fail('Эту вещь нельзя выставить: снимите её с героя и уберите замок.');
  if (rows(world, 'ae_lots').filter(l => same(l.seller, me) && l.status === 'active').length >= 10) return fail('Одновременно можно держать до 10 лотов.');
  const price = body.price == null || body.price === '' ? null : Math.floor(Number(body.price));
  if (price != null && !(price >= 1 && price <= 1e8)) return fail('Цена: от 1 до 100 000 000 золота.');
  const lot = {id: crypto.randomUUID(), kind, seller: String(me), item_json: {...it.item_json}, status: 'active', at: iso(now), expires: iso(now + 7 * DAY)};
  if (kind === 'auction') {
    const start = Math.floor(Number(body.start)); if (!(start >= 1 && start <= 1e8)) return fail('Стартовая цена: от 1 золота.');
    const hours = [1, 6, 24, 48].includes(Number(body.hours)) ? Number(body.hours) : 24;
    Object.assign(lot, {start, endsAt: iso(now + hours * HOUR), bid: null, bids: 0, price: price && price > start ? price : null});
  } else lot.price = price;
  if (Number(it.quantity) > 1) { it.quantity = Number(it.quantity) - 1; it.updated_at = iso(now); }
  else world.tables.owned_items = rows(world, 'owned_items').filter(i => i !== it);
  rows(world, 'ae_lots').push(lot);
  return ok({lot: lotView(world, lot, me)}, 201);
}
function act(world, path, body, me, now, notify) {
  const lot = rows(world, 'ae_lots').find(l => l.id === body.id); if (!lot) return fail('Лот не найден.', 404);
  const p = player(world, me); if (!p) return fail('Сначала создайте персонажа.', 404);
  if (path === '/api/ae-market/lot/cancel') {
    if (!same(lot.seller, me)) return fail('Это не ваш лот.', 403);
    if (lot.status !== 'active') return fail('Лот уже закрыт.');
    if (lot.kind === 'auction' && lot.bid) return fail('На аукционе уже есть ставки — снять его нельзя.');
    lot.status = 'cancelled'; lot.soldAt = iso(now); refundOffers(world, lot, now, notify); giveItem(world, me, lot.item_json, 'lot_cancel', now);
    return ok({ok: true});
  }
  if (lot.status !== 'active') return fail(lot.status === 'sold' ? 'Уже продано.' : 'Лот закрыт.');
  if (same(lot.seller, me)) {
    if (path !== '/api/ae-market/lot/decide') return fail('Это ваш лот.');
    const o = rows(world, 'ae_lot_offers').find(x => x.id === body.offerId && x.lot === lot.id && x.status === 'pending'); if (!o) return fail('Предложение не найдено.', 404);
    if (!body.accept) { o.status = 'declined'; const b = player(world, o.u); if (b) b.market_gold = gold(b) + o.price;
      event(world, o.u, '✖️', `${nameOf(p)} отклонил(а) ваше предложение ${o.price} 🪙 за «${lot.item_json.name}» — деньги вернулись в кошелёк рынка`, 'market', null, now); return ok({ok: true}); }
    if (lot.kind === 'auction') return fail('На аукционе предложения не принимаются.');
    o.status = 'accepted'; refundOffers(world, lot, now, notify, o.id); sell(world, lot, o.u, o.price, now, notify);
    return ok({ok: true});
  }
  if (path === '/api/ae-market/lot/buy') {
    if (!lot.price) return fail('У этого лота нет цены «купить сейчас» — предложите свою.');
    if (lot.kind === 'auction' && lot.bid && lot.bid.amount >= lot.price) return fail('Ставки уже выше цены выкупа.');
    if (gold(p) < lot.price) return fail(`Не хватает ${lot.price - gold(p)} золота в кошельке рынка.`, 402);
    p.market_gold = gold(p) - lot.price;
    if (lot.bid) { const b = player(world, lot.bid.u); if (b) b.market_gold = gold(b) + lot.bid.amount; event(world, lot.bid.u, '↩️', `«${lot.item_json.name}» выкупили — ваша ставка ${lot.bid.amount} 🪙 вернулась`, 'market', null, now); }
    refundOffers(world, lot, now, notify); sell(world, lot, me, lot.price, now, notify);
    return ok({ok: true, balance: gold(p)});
  }
  if (path === '/api/ae-market/lot/offer') {
    if (lot.kind !== 'chat') return fail('На аукционе делайте ставку.');
    const price = Math.floor(Number(body.price)); if (!(price >= 1 && price <= 1e8)) return fail('Укажите цену.');
    const mine = rows(world, 'ae_lot_offers').find(o => o.lot === lot.id && same(o.u, me) && o.status === 'pending');
    const need = price - (mine?.price || 0); if (gold(p) < need) return fail(`Не хватает ${need - gold(p)} золота в кошельке рынка.`, 402);
    p.market_gold = gold(p) - need;
    if (mine) { mine.price = price; mine.at = iso(now); }
    else rows(world, 'ae_lot_offers').push({id: crypto.randomUUID(), lot: lot.id, u: String(me), price, status: 'pending', at: iso(now)});
    event(world, lot.seller, '💬', `${nameOf(p)} предлагает ${price} 🪙 за «${lot.item_json.name}»`, 'lot-offer', {lot: lot.id}, now);
    notify?.(world, lot.seller, `💬 ${nameOf(p)} предлагает ${price} золота за «${lot.item_json.name}». Откройте Рынок → «Мои лоты», чтобы принять или отклонить.`, 'lot-offer:' + lot.id + ':' + me, now);
    return ok({ok: true, balance: gold(p)});
  }
  if (path === '/api/ae-market/lot/bid') {
    if (lot.kind !== 'auction') return fail('Это не аукцион.');
    if (lot.bid && same(lot.bid.u, me)) return fail('Ваша ставка и так первая.');
    const min = lot.bid ? lot.bid.amount + minStep(lot) : lot.start, amount = Math.floor(Number(body.amount));
    if (!(amount >= min)) return fail(`Минимальная ставка: ${min} золота.`);
    if (gold(p) < amount) return fail(`Не хватает ${amount - gold(p)} золота в кошельке рынка.`, 402);
    p.market_gold = gold(p) - amount;
    if (lot.bid) { const b = player(world, lot.bid.u); if (b) b.market_gold = gold(b) + lot.bid.amount;
      event(world, lot.bid.u, '🔨', `Вашу ставку на «${lot.item_json.name}» перебили (${amount} 🪙) — ${lot.bid.amount} 🪙 вернулись в кошелёк рынка`, 'auction-outbid', {lot: lot.id}, now);
      notify?.(world, lot.bid.u, `🔨 Вашу ставку на «${lot.item_json.name}» перебили: ${amount} золота. Ставка вернулась в кошелёк рынка.`, 'outbid:' + lot.id + ':' + amount, now); }
    lot.bid = {u: String(me), amount, at: iso(now)}; lot.bids = (lot.bids || 0) + 1;
    if (Date.parse(lot.endsAt) - now < 120e3) lot.endsAt = iso(now + 120e3); // anti-sniping: last-minute bids extend by 2 min
    event(world, lot.seller, '🔨', `Новая ставка ${amount} 🪙 на «${lot.item_json.name}»`, 'market', null, now);
    return ok({ok: true, balance: gold(p)});
  }
  return fail('API не найден.', 404);
}

export function handleMarketPlus(world, input, user, now, notify) {
  const path = String(input?.path || '').split('?')[0];
  if (!path.startsWith('/api/ae-market')) return null;
  const method = String(input?.method || 'GET').toUpperCase(), body = input?.body || {}, me = String(user.id);
  settleLots(world, now, notify);
  if (path === '/api/ae-market/wallet' || ((path === '/api/ae-market/deposit' || path === '/api/ae-market/withdraw') && method === 'POST')) return wallet(world, path, body, me, now);
  if (path === '/api/ae-market/lots' && method === 'GET') {
    // (no URLSearchParams in the serverless isolate)
    const qs = Object.fromEntries(String(input.path).split('?').slice(1).join('?').split('&').filter(Boolean).map(kv => { const i = kv.indexOf('='); return [decodeURIComponent(i < 0 ? kv : kv.slice(0, i)), decodeURIComponent(i < 0 ? '' : kv.slice(i + 1))]; }));
    const q = {get: k => qs[k] ?? null}, ids = (q.get('ids') || '').split(',').filter(Boolean).slice(0, 30);
    const list = ids.length ? rows(world, 'ae_lots').filter(l => ids.includes(l.id))
      : rows(world, 'ae_lots').filter(l => q.get('mine') ? same(l.seller, me) || same(l.bid?.u, me) || rows(world, 'ae_lot_offers').some(o => o.lot === l.id && same(o.u, me) && o.status === 'pending') : l.kind === 'auction' && l.status === 'active')
        .sort((a, b) => String(a.endsAt || a.at).localeCompare(String(b.endsAt || b.at))).slice(0, 60);
    return ok({lots: list.map(l => lotView(world, l, me)), balance: gold(player(world, me)), now});
  }
  if (path === '/api/ae-market/lot' && method === 'POST') return createLot(world, body, me, now);
  if (path.startsWith('/api/ae-market/lot/') && method === 'POST') return act(world, path, body, me, now, notify);
  return fail('API не найден.', 404);
}
