import type {Express, RequestHandler} from 'express';
import {NativePool} from './pool';
import {clanCreationCost} from '../../src/utils/clanEconomy';
import {canAssignRole, canManageMember, canUseVault, CLAN_ROLE_LABELS, type ClanRole} from '../../src/utils/clanRoles';
import {CLAN_PROJECTS, clanProjectCost, clanRaidHealth, clanRaidItem, clanRaidReward} from '../../src/utils/clanProjects';
import {queueNotification} from '../socialFeatures';
const same = (a: any, b: any) => a != null && b != null && String(a) === String(b);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function randomInt(max: number) {
  const limit = Math.floor(4294967296 / max) * max, bytes = new Uint32Array(1);
  do {crypto.getRandomValues(bytes);} while (bytes[0] >= limit);
  return bytes[0] % max;
}
export function registerNativeClans(app: Express, native: NativePool, auth: RequestHandler) {
  const table = (name: string) => native.table(name), now = () => native.now(), stamp = () => new Date(now()).toISOString();
  const player = (id: any) => table('players').find(row => same(row.telegram_id, id));
  const append = (name: string, row: any) => {const created = {id: table(name).reduce((max, row) => Math.max(max, Number(row.id) || 0), 0) + 1, created_at: stamp(), ...row}; table(name).push(created); return created;};
  const context = (id: number) => {
    const account = player(id), clan = table('clans').find(row => row.id === account?.clan_id);
    const member = table('clan_members').find(row => row.clan_id === clan?.id && same(row.telegram_id, id));
    if (!clan || !member) throw new Error('Вы не состоите в клане.');
    return {account, clan, member};
  };
  const notify = (id: number, key: string, text: string) => queueNotification(native.asPool(), id, key, 'clan', text);
  const vaultEvent = (clan: string, actor: number, action: string, item: any, quantity: number, gold = 0, silver = 0, ore = 0) => append('clan_storage_events', {clan_id: clan, actor_telegram_id: actor, action, item_name: String(item.name || 'Предмет').slice(0, 80), quantity, gold_delta: gold, silver_delta: silver, ore_delta: ore});
  const safe = (fn: any, status = 200): RequestHandler => async (req, res) => {
    try {res.status(status).json(await fn(req));}
    catch (error) {if ((error as any)?.code === 'NATIVE_QUERY_UNSUPPORTED') throw error; res.status(400).json({error: error instanceof Error ? error.message : 'Действие не выполнено.'});}
  };
  const bagRow = (row: any) => ({id: row.id, item_json: row.item_json, quantity: row.quantity, locked: row.locked, bound_clan_id: row.bound_clan_id, equipped_slot: row.equipped_slot, origin: row.origin});
  app.get('/api/clans', auth, (req, res) => {
    const q = String(req.query.q || '').trim().toLowerCase();
    const clans = table('clans').filter(row => !q || row.name.toLowerCase().includes(q) || row.tag.toLowerCase().includes(q))
      .map(row => ({row, members: table('clan_members').filter(member => member.clan_id === row.id).length}))
      .sort((a, b) => b.row.level - a.row.level || b.members - a.members || a.row.created_at.localeCompare(b.row.created_at)).slice(0, 30)
      .map(({row, members}) => ({id: row.id, tag: row.tag, name: row.name, description: row.description, level: row.level, xp: row.xp,
        max_members: row.max_members, recruitment_open: row.recruitment_open, min_join_level: row.min_join_level, members_count: members}));
    res.json({clans});
  });
  app.get('/api/clan/me', auth, (req, res) => {
    let state: ReturnType<typeof context>; try {state = context(req.authUser!.id);} catch {res.json({clan: null}); return;}
    const members = table('clan_members').filter(row => row.clan_id === state.clan.id).map(row => ({telegram_id: row.telegram_id, role: row.role, joined_at: row.joined_at, raid_damage: row.raid_damage,
      level: player(row.telegram_id)?.level, display_name: player(row.telegram_id)?.display_name, username: player(row.telegram_id)?.username}))
      .sort((a, b) => (a.role === 'owner' ? 0 : a.role === 'officer' ? 1 : 2) - (b.role === 'owner' ? 0 : b.role === 'officer' ? 1 : 2) || a.joined_at.localeCompare(b.joined_at));
    const messages = table('clan_chat_messages').filter(row => row.clan_id === state.clan.id).sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))).slice(0, 50).reverse()
      .map(row => ({id: row.id, text: row.text, created_at: row.created_at, display_name: player(row.telegram_id)?.character_name?.trim() || 'Игрок'}));
    res.json({clan: {...state.clan, role: state.member.role, members_count: members.length, raid_name: 'Страж клановых врат'}, members, messages});
  });
  app.post('/api/clan/create', auth, safe((req: any) => {
    const name = String(req.body?.name || '').trim(), tag = String(req.body?.tag || '').trim().toUpperCase(), description = String(req.body?.description || '').trim();
    const {operationId, gold, expectedPriceGold} = req.body || {};
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(operationId || '')) throw new Error('Неверный идентификатор создания клана.');
    if (!/^[A-ZА-ЯЁ0-9]{2,6}$/.test(tag) || name.length < 3 || name.length > 32 || description.length > 280) throw new Error('Проверьте название, тег и описание клана.');
    const previous = table('clan_creation_requests').find(row => row.operation_id === operationId);
    if (previous) {if (!same(previous.owner_telegram_id, req.authUser.id) || previous.name !== name || previous.tag !== tag || previous.description !== description) throw new Error('Запрос создания клана изменился.'); return {ok: true, clanId: previous.clan_id, priceGold: Number(previous.price_gold)};}
    const account = player(req.authUser.id)!;
    if (account.clan_id) throw new Error('Сначала выйдите из текущего клана.');
    const cost = clanCreationCost(new Date(account.premium_until || 0).getTime() > now());
    if (expectedPriceGold !== cost) throw new Error('Стоимость изменилась. Обновите статус Premium.');
    if (!Number.isSafeInteger(gold) || gold < cost) throw new Error(`Для создания клана нужно ${cost} золота.`);
    if (table('clans').some(row => row.tag === tag)) throw new Error('Такое название или тег уже занят.');
    const id = crypto.randomUUID();
    table('clans').push({id, tag, name, description, owner_telegram_id: req.authUser.id, level: 1, xp: 0, max_members: 30,
      raid_hp: 10000, raid_max_hp: 10000, raid_reset_at: new Date(now() + 7 * 86400000).toISOString(), created_at: stamp(), updated_at: stamp(),
      treasury_gold: 0, treasury_silver: 0, treasury_ore: 0, recruitment_open: true, min_join_level: 1, projects: {}});
    table('clan_members').push({clan_id: id, telegram_id: req.authUser.id, role: 'owner', joined_at: stamp(), raid_damage: 0, last_raid_attack: null});
    account.clan_id = id; account.updated_at = stamp();
    table('clan_creation_requests').push({operation_id: operationId, owner_telegram_id: req.authUser.id, clan_id: id, name, tag, description, price_gold: cost, created_at: stamp()});
    return {ok: true, clanId: id, priceGold: cost};
  }, 201));
  app.post('/api/clan/:clanId/join', auth, safe((req: any) => {
    const account = player(req.authUser.id)!, clan = table('clans').find(row => row.id === req.params.clanId);
    if (account.clan_id) throw new Error('Вы уже состоите в клане.');
    if (!clan || !clan.recruitment_open) throw new Error('Клан не найден или набор закрыт.');
    if (Number(account.level) < Number(clan.min_join_level)) throw new Error('Недостаточный уровень для вступления.');
    if (table('clan_members').filter(row => row.clan_id === clan.id).length >= Number(clan.max_members)) throw new Error('Клан заполнен.');
    table('clan_members').push({clan_id: clan.id, telegram_id: req.authUser.id, role: 'recruit', joined_at: stamp(), raid_damage: 0, last_raid_attack: null});
    account.clan_id = clan.id; account.updated_at = stamp(); return {ok: true};
  }));
  app.post('/api/clan/leave', auth, safe((req: any) => {
    const {account, clan, member} = context(req.authUser.id); let disbanded = false;
    if (member.role === 'owner') {
      const priority = ['officer', 'quartermaster', 'veteran', 'member'];
      const successors = table('clan_members').filter(row => row.clan_id === clan.id && !same(row.telegram_id, req.authUser.id)).sort((a, b) =>
        (priority.includes(a.role) ? priority.indexOf(a.role) : 4) - (priority.includes(b.role) ? priority.indexOf(b.role) : 4) || String(a.joined_at).localeCompare(String(b.joined_at)) || Number(a.telegram_id) - Number(b.telegram_id));
      if (successors[0]) {successors[0].role = 'owner'; clan.owner_telegram_id = successors[0].telegram_id; clan.updated_at = stamp();}
      else {if (req.body?.confirmDisband !== true) throw new Error('Подтвердите роспуск клана: казна и клановый склад будут удалены.'); disbanded = true;}
    }
    native.world.tables.clan_members = table('clan_members').filter(row => !(row.clan_id === clan.id && same(row.telegram_id, req.authUser.id)));
    account!.clan_id = null; account!.updated_at = stamp();
    if (disbanded) {
      native.world.tables.clans = table('clans').filter(row => row.id !== clan.id);
      for (const name of ['clan_chat_messages', 'clan_storage_events', 'clan_raid_item_claims', 'clan_management_events', 'clan_project_operations']) native.world.tables[name] = table(name).filter(row => row.clan_id !== clan.id);
      native.world.tables.owned_items = table('owned_items').filter(row => row.clan_id !== clan.id);
      for (const row of table('owned_items')) if (row.bound_clan_id === clan.id) row.bound_clan_id = null;
    }
    return {ok: true, disbanded};
  }));
  app.post('/api/clan/donate', auth, (_req, res) => {res.status(501).json({code: 'FEATURE_UNAVAILABLE', outcome: 'rejected', error: 'Пожертвования временно недоступны. Другие занятия работают как обычно.'});});
  app.post('/api/clan/projects/upgrade', auth, safe((req: any) => {
    const {clan, member} = context(req.authUser.id), {project, operationId} = req.body || {};
    if (!Object.hasOwn(CLAN_PROJECTS, project || '') || !UUID.test(operationId || '')) throw new Error('Неверный проект или ID операции.');
    if (!['owner', 'officer'].includes(member.role)) throw new Error('Только глава или офицер может улучшать проекты.');
    const previous = table('clan_project_operations').find(row => row.id === operationId);
    if (previous) {if (previous.clan_id !== clan.id || !same(previous.actor, req.authUser.id) || previous.project !== project) throw new Error('ID операции уже использован.'); return {ok: true};}
    const level = Number(clan.projects?.[project] || 0); if (level >= 10) throw new Error('Проект достиг максимальной ступени.');
    const cost = clanProjectCost(level);
    if (Number(clan.treasury_gold) < cost.gold || Number(clan.treasury_silver) < cost.silver || Number(clan.treasury_ore) < cost.ore) throw new Error('Недостаточно ресурсов в казне.');
    clan.projects = {...clan.projects, [project]: level + 1}; clan.treasury_gold = Number(clan.treasury_gold) - cost.gold; clan.treasury_silver = Number(clan.treasury_silver) - cost.silver; clan.treasury_ore = Number(clan.treasury_ore) - cost.ore;
    table('clan_project_operations').push({id: operationId, clan_id: clan.id, actor: req.authUser.id, project, created_at: stamp()}); return {ok: true};
  }));
  app.post('/api/clan/manage', auth, safe(async (req: any) => {
    const {clan, member} = context(req.authUser.id), body = req.body || {};
    const members = table('clan_members').filter(row => row.clan_id === clan.id), target = members.find(row => same(row.telegram_id, body.targetId));
    let text = '';
    if (body.action === 'settings') {
      if (!['owner', 'officer'].includes(member.role)) throw new Error('Настройки доступны главе и офицерам.');
      if (!Number.isInteger(Number(body.minLevel)) || Number(body.minLevel) < 1 || Number(body.minLevel) > 120 || typeof body.open !== 'boolean' || typeof body.description !== 'string' || body.description.length > 280) throw new Error('Проверьте описание и уровень 1–120.');
      clan.description = body.description; clan.recruitment_open = body.open; clan.min_join_level = Number(body.minLevel); text = 'Обновлены правила набора и описание.';
    } else if (body.action === 'role') {
      if (!target || !canAssignRole(member.role, target.role, body.role)) throw new Error('Недостаточно прав для смены роли.');
      target.role = body.role; text = `Роль ${target.telegram_id}: ${body.role}.`;
      await notify(Number(target.telegram_id), 'clan_role_' + crypto.randomUUID(), `В клане ${clan.name} изменена ваша роль: ${CLAN_ROLE_LABELS[body.role as ClanRole]}.`);
    } else if (body.action === 'kick') {
      if (!target || !canManageMember(member.role, target.role)) throw new Error('Недостаточно прав для исключения.');
      native.world.tables.clan_members = table('clan_members').filter(row => row !== target); player(target.telegram_id)!.clan_id = null; text = `Исключён игрок ${target.telegram_id}.`;
      await notify(Number(target.telegram_id), 'clan_kick_' + crypto.randomUUID(), `Вы исключены из клана ${clan.name}.`);
    } else if (body.action === 'transfer') {
      if (member.role !== 'owner' || !target || same(member.telegram_id, target.telegram_id)) throw new Error('Передать руководство может только глава другому участнику.');
      member.role = 'officer'; target.role = 'owner'; clan.owner_telegram_id = target.telegram_id; text = `Руководство передано ${target.telegram_id}.`;
    } else if (body.action === 'upgrade') {
      const cost = 1000 * Number(clan.level); if (member.role !== 'owner' || Number(clan.level) >= 15 || Number(clan.treasury_gold) < cost) throw new Error(`Нужны ${cost} золота в казне; улучшение доступно главе.`);
      clan.treasury_gold = Number(clan.treasury_gold) - cost; clan.level = Number(clan.level) + 1; clan.max_members = Math.min(50, Number(clan.max_members) + 2); text = 'Клан улучшен: +2 места.';
    } else throw new Error('Неизвестное действие.');
    append('clan_management_events', {clan_id: clan.id, actor: req.authUser.id, text}); return {ok: true};
  }));
  app.get('/api/clan/events', auth, (req, res) => {
    const membership = table('clan_members').find(row => same(row.telegram_id, req.authUser!.id));
    res.json({events: membership ? table('clan_management_events').filter(row => row.clan_id === membership.clan_id).sort((a, b) => Number(b.id) - Number(a.id)).slice(0, 30).map(row => ({text: row.text, created_at: row.created_at})) : []});
  });
  app.get('/api/clan/storage', auth, safe((req: any) => {
    const {clan, member} = context(req.authUser.id);
    return {role: member.role, stored: table('owned_items').filter(row => row.clan_id === clan.id).sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))).slice(0, 200).map(row => ({id: row.id, item_json: row.item_json, quantity: row.quantity, origin: row.origin})),
      personal: table('owned_items').filter(row => same(row.owner_telegram_id, req.authUser.id)).sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))).slice(0, 200).map(bagRow),
      events: table('clan_storage_events').filter(row => row.clan_id === clan.id).sort((a, b) => Number(b.id) - Number(a.id)).slice(0, 30).map(row => ({action: row.action, item_name: row.item_name, quantity: row.quantity, gold_delta: row.gold_delta, silver_delta: row.silver_delta, ore_delta: row.ore_delta, created_at: row.created_at, display_name: player(row.actor_telegram_id)?.display_name}))};
  }));
  for (const action of ['deposit', 'withdraw'] as const) app.post('/api/clan/storage/:itemId/' + action, auth, safe((req: any) => {
    const {clan, member} = context(req.authUser.id), quantity = Number(req.body?.quantity || 1);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 999) throw new Error('Неверное количество.');
    if (action === 'withdraw' && !canUseVault(member.role)) throw new Error('Забирать вещи могут глава, офицеры и казначей.');
    const row = table('owned_items').find(row => row.id === req.params.itemId && (action === 'deposit' ? same(row.owner_telegram_id, req.authUser.id) : row.clan_id === clan.id));
    if (!row || Number(row.quantity) < quantity || action === 'deposit' && (['legacy_market_return', 'legacy_character'].includes(row.origin) || row.locked || row.equipped_slot || row.bound_clan_id && row.bound_clan_id !== clan.id)) throw new Error('Предмет недоступен для переноса.');
    let transferred = row;
    if (Number(row.quantity) !== quantity) {
      row.quantity = Number(row.quantity) - quantity;
      transferred = {id: crypto.randomUUID(), item_json: JSON.parse(JSON.stringify(row.item_json)), quantity, origin: row.origin, locked: false, equipped_slot: null, character_id: null, created_at: stamp(), updated_at: stamp()};
      table('owned_items').push(transferred);
    }
    transferred.owner_telegram_id = action === 'deposit' ? null : req.authUser.id;
    transferred.clan_id = action === 'deposit' ? clan.id : null; transferred.bound_clan_id = clan.id; transferred.updated_at = stamp();
    vaultEvent(clan.id, req.authUser.id, action, row.item_json, quantity); return {ok: true};
  }));
  app.post('/api/clan/storage/:itemId/give', auth, safe(async (req: any) => {
    const {clan, member} = context(req.authUser.id), target = Number(req.body?.targetId);
    if (!Number.isSafeInteger(target) || !UUID.test(req.params.itemId || '') || !canUseVault(member.role) || !table('clan_members').some(row => row.clan_id === clan.id && same(row.telegram_id, target))) throw new Error('Недостаточно прав или получатель не в клане.');
    const item = table('owned_items').find(row => row.id === req.params.itemId && row.clan_id === clan.id); if (!item) throw new Error('Предмет уже забрали.');
    item.owner_telegram_id = target; item.clan_id = null; item.updated_at = stamp();
    vaultEvent(clan.id, req.authUser.id, 'give', item.item_json, Number(item.quantity));
    await notify(target, 'clan_give_' + item.id + '_' + now(), `🎒 Из кланового склада вам выдано: ${item.item_json.name} ×${item.quantity}.`); return {ok: true};
  }));
  app.post('/api/clan/storage/dispose', auth, safe((req: any) => {
    const {clan, member} = context(req.authUser.id), {action, upToRarity: rarity, itemId} = req.body || {};
    const rarities = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic', 'ancient', 'divine'];
    if (!canUseVault(member.role) || !['sell', 'disassemble'].includes(action) || !itemId && !rarities.includes(rarity)) throw new Error('Недостаточно прав или неверные параметры обработки.');
    const selected = table('owned_items').filter(row => row.clan_id === clan.id && (!itemId || row.id === itemId)).sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)) || a.id.localeCompare(b.id)).slice(0, 200).filter(row => itemId || rarities.indexOf(row.item_json.rarity) <= rarities.indexOf(rarity));
    if (!selected.length) throw new Error('Подходящих вещей в хранилище нет.');
    let gold = 0, silver = 0, ore = 0;
    for (const row of selected) {
      const quantity = Number(row.quantity), item = row.item_json;
      const g = action === 'sell' ? Math.max(0, Math.min(100000, Number(item.sellPrice || 0))) * quantity : 0;
      const s = action === 'disassemble' ? Math.max(0, Math.min(100000, Number(item.disassembleYield?.silver || 0))) * quantity : 0;
      const o = action === 'disassemble' ? Math.max(0, Math.min(1000, Number(item.disassembleYield?.ore || 0))) * quantity : 0;
      gold += g; silver += s; ore += o; vaultEvent(clan.id, req.authUser.id, action, item, quantity, g, s, o);
    }
    const ids = new Set(selected.map(row => row.id)); native.world.tables.owned_items = table('owned_items').filter(row => !ids.has(row.id));
    clan.treasury_gold = Number(clan.treasury_gold) + gold; clan.treasury_silver = Number(clan.treasury_silver) + silver; clan.treasury_ore = Number(clan.treasury_ore) + ore; clan.updated_at = stamp();
    return {ok: true, count: selected.length, gold, silver, ore};
  }));
  app.post('/api/clan/chat', auth, safe((req: any) => {
    const {clan} = context(req.authUser.id), text = String(req.body?.text || '').trim();
    if (!text || text.length > 500) throw new Error('Сообщение: 1–500 символов.');
    const row = append('clan_chat_messages', {clan_id: clan.id, telegram_id: req.authUser.id, text});
    return {message: {id: row.id, text: row.text, created_at: row.created_at, display_name: player(req.authUser.id)?.character_name?.trim() || 'Игрок'}};
  }, 201));
  app.post('/api/clan/raid/attack', auth, safe(async (req: any) => {
    const {clan, member} = context(req.authUser.id); let damage = 450 + randomInt(251);
    if (new Date(clan.raid_reset_at).getTime() <= now()) {clan.raid_hp = clanRaidHealth(Number(clan.level)); clan.raid_max_hp = clan.raid_hp; clan.raid_reset_at = new Date(now() + 7 * 86400000).toISOString(); for (const row of table('clan_members')) if (row.clan_id === clan.id) row.raid_damage = 0;}
    damage = Math.round(damage * (1 + Math.min(10, Number(clan.projects?.arsenal || 0)) * .05));
    if (Number(clan.raid_hp) <= 0) throw new Error('Рейд уже завершён.');
    const dayStart = new Date(now()); dayStart.setUTCHours(0, 0, 0, 0);
    if (member.last_raid_attack && new Date(member.last_raid_attack).getTime() >= dayStart.getTime()) throw new Error('Один удар по рейду в сутки. Следующий — в 00:00 UTC.');
    member.raid_damage = Number(member.raid_damage || 0) + Math.min(damage, Number(clan.raid_hp)); member.last_raid_attack = stamp();
    clan.raid_hp = Math.max(0, Number(clan.raid_hp) - damage); clan.updated_at = stamp();
    if (clan.raid_hp === 0) {
      const reward = clanRaidReward(Number(clan.level), Number(clan.projects?.research || 0), Number(clan.projects?.supplies || 0));
      clan.xp = Number(clan.xp) + reward.xp; clan.treasury_gold = Number(clan.treasury_gold) + reward.gold; clan.treasury_silver = Number(clan.treasury_silver) + reward.silver; clan.treasury_ore = Number(clan.treasury_ore) + reward.ore;
      clan.level = Math.max(Number(clan.level), Math.min(15, 1 + Math.floor(clan.xp / 1000))); clan.max_members = Math.max(Number(clan.max_members), Math.min(50, 30 + Math.floor(clan.xp / 1000) * 2));
      for (const row of table('clan_members').filter(row => row.clan_id === clan.id)) await notify(Number(row.telegram_id), 'raid_' + clan.id + '_' + clan.raid_reset_at, `🏆 Клан победил рейдового босса: +${reward.xp} опыта клана, +${reward.gold} золота, +${reward.silver} серебра и +${reward.ore} руды в казну.`);
    }
    dayStart.setUTCDate(dayStart.getUTCDate() - (dayStart.getUTCDay() + 6) % 7); const period = dayStart.toISOString().slice(0, 10); let reward = null;
    if (!table('clan_raid_item_claims').some(row => row.clan_id === clan.id && same(row.telegram_id, req.authUser.id) && String(row.period_start).slice(0, 10) === period)) {
      table('clan_raid_item_claims').push({clan_id: clan.id, telegram_id: req.authUser.id, period_start: period, created_at: stamp()});
      const row = {id: crypto.randomUUID(), owner_telegram_id: req.authUser.id, clan_id: null, bound_clan_id: null, quantity: 1, locked: false, equipped_slot: null, origin: 'clan_raid', character_id: null, item_json: clanRaidItem(Number(clan.level), randomInt(100) < 15), created_at: stamp(), updated_at: stamp()};
      table('owned_items').push(row); reward = {id: row.id, item_json: row.item_json};
    }
    return {ok: true, raidHp: clan.raid_hp, raidMaxHp: Number(clan.raid_max_hp), defeated: clan.raid_hp === 0, reward};
  }));
}
