// TikTok video #2 (new features), 7 scenes recorded separately at 1080×1920 (page zoom 2.5 → 432×768 css px).
// Usage: DIST=../dist node tt4.mjs <scene|all>   → video/tt4/<scene>.webm + video/tt4/marks.json
import {launch} from './browser.mjs'; import fs from 'node:fs';
const OUT = 'video/tt4'; fs.mkdirSync(OUT, {recursive: true});
const KEY = 'aethelgard_save_v1_data_437290420', ME = '437290420';
const marksFile = OUT + '/marks.json', marks = fs.existsSync(marksFile) ? JSON.parse(fs.readFileSync(marksFile)) : {};
const PROMO = 'AE-A8RMCU';
const gear = (id, name, type, rarity, lvl, stats, extra = {}) => ({id, templateId: id, name, type, rarity, level: lvl, upgradeLevel: 0, stats, icon: '⚔️', sellPrice: 50, disassembleYield: {}, stackCount: 1, ...extra});
function baseLs(mut) {
  const ls = JSON.parse(fs.readFileSync('ls.json')); const save = JSON.parse(ls[KEY]);
  Object.assign(save.player, {level: 30, gold: 48200, silver: 3800, energy: 100, worldPlace: 'settlement', royalBriefingStep: 99,
    currentRegionId: 'reg_whisper_woods', unlockedRegionIds: ['reg_plains', 'reg_whisper_woods', 'reg_forgotten_crypt', 'reg_forest', 'reg_swamp']});
  delete save.player.firstJourney; delete save.player.firstJourneyDeparture;
  save.player.name = 'Артур';
  mut?.(save.player);
  ls[KEY] = JSON.stringify(save); ls.aethelgard_interface_style = 'fantasy'; ls.aeth_ui_scale = 'big';
  ls['aeth_story_seen_v2_' + ME] = JSON.stringify(['reg_plains', 'reg_whisper_woods', 'reg_forgotten_crypt', 'reg_forest', 'reg_swamp', 'reg_desert', 'reg_cursed', 'reg_rift', 'reg_dragon']);
  ls['aeth_coop_story_' + ME] = '1'; ls['aeth_2h_seen_' + ME] = '[]';
  return ls;
}
const CSS = `html{zoom:2.5}.ae-pop{display:none!important}
.tt-cap{position:fixed;left:0;right:0;top:64px;padding:10px 12px 12px;background:linear-gradient(#000c,#0009 75%,#0000);z-index:99999;text-align:center;pointer-events:none;font:900 27px/1.12 Georgia,serif;color:#fff3d0;text-shadow:0 2px 0 #000,0 0 18px #000,0 0 6px #000,0 0 2px #000;opacity:0;transform:translateY(-10px) scale(.95);transition:all .3s}
.tt-cap small{display:block;margin-top:7px;font:800 17px/1.25 system-ui,sans-serif;color:#ffd36a}.tt-cap.on{opacity:1;transform:none}
.tt-full{position:fixed;inset:0;z-index:99998;pointer-events:none;background:#000 center/cover;display:flex;flex-direction:column;justify-content:center;align-items:center;padding:0 22px;text-align:center;animation:ttfade .5s}
.tt-full h1{font:900 44px/1.02 Georgia,serif;color:#ffe6a8;margin:0 0 6px;text-shadow:0 3px 0 #000,0 0 30px #000}.tt-full h2{font:700 16px/1.3 system-ui,sans-serif;color:#fff;margin:0 0 22px;text-shadow:0 2px 6px #000;letter-spacing:.5px}
.tt-full .row{margin:7px 0;padding:11px 16px;border-radius:14px;background:#000b;border:2px solid #f0cf7a88;font:900 21px/1.15 system-ui,sans-serif;color:#ffe6a8;min-width:300px;box-shadow:0 6px 24px #000c;animation:ttin .45s both}
.tt-full .row.promo{background:linear-gradient(#f0cf7a,#c99a3c);color:#1d1408;border-color:#fff3;font-size:25px}.tt-full .row small{display:block;font:700 13px system-ui,sans-serif;opacity:.85;margin-bottom:3px}
.tt-full .row:nth-of-type(2){animation-delay:.35s}.tt-full .row:nth-of-type(3){animation-delay:.7s}
.tt-classes{position:fixed;inset:0;z-index:99997;pointer-events:none;background:radial-gradient(#2a1d10,#070504);display:flex;align-items:flex-end;justify-content:center}
.tt-classes img{position:absolute;bottom:40px;left:50%;height:78%;transform:translateX(-50%);filter:drop-shadow(0 0 30px #000)}
.tt-classes b{position:absolute;bottom:120px;left:0;right:0;text-align:center;font:900 40px Georgia,serif;color:#ffe6a8;text-shadow:0 3px 0 #000,0 0 24px #000}
.tt-badge{position:fixed;right:16px;top:200px;z-index:99999;pointer-events:none;padding:10px 14px;border-radius:14px;background:#000d;border:2px solid #f0cf7a;font:900 22px system-ui,sans-serif;color:#fff;box-shadow:0 0 30px #f0cf7a55;animation:ttin .4s}
.tt-badge em{font-style:normal;color:#7dff8a}
@keyframes ttin{from{transform:scale(.8);opacity:0}}@keyframes ttfade{from{opacity:0}}`;
async function start(name, opts = {}) {
  const t0 = Date.now();
  const s = await launch({localState: opts.ls || baseLs(opts.mut), pageOptions: {viewport: {width: 1080, height: 1920}, deviceScaleFactor: 1, recordVideo: {dir: OUT + '/raw', size: {width: 1080, height: 1920}}},
    setupWorld: (w, E) => { Object.assign(w, JSON.parse(fs.readFileSync('world-after-reg.json'))); const pool = new E.NativePool(w, () => Date.now());
      pool.ensurePlayer({id: 555, displayName: 'Борис'}); Object.assign(w.tables.players.find(p => p.telegram_id == 555), {character_name: 'Борис', level: 28, class_id: 'druid', market_gold: 0});
      const me = w.tables.players.find(p => String(p.telegram_id) === ME); if (me) Object.assign(me, {level: 30, class_id: 'warrior', character_name: 'Sanvile'}); opts.world?.(w); }});
  const p = s.page; p.setDefaultTimeout(5000); p.on('dialog', d => d.accept(d.type() === 'prompt' ? (opts.prompt || '800') : undefined));
  await p.addStyleTag({content: CSS});
  const at = () => (Date.now() - t0) / 1000;
  const ctx = {s, p, W: ms => p.waitForTimeout(ms), at,
    cap: (t, sub = '') => p.evaluate(([t, sub]) => { document.querySelectorAll('.tt-cap').forEach(e => e.remove()); const d = document.createElement('div'); d.className = 'tt-cap'; d.innerHTML = t + (sub ? `<small>${sub}</small>` : ''); document.body.append(d); requestAnimationFrame(() => d.classList.add('on')); }, [t, sub]),
    nav: re => p.evaluate(src => { const re = new RegExp(src); [...document.querySelectorAll('nav.game-nav button, nav.game-nav a')].find(b => re.test(b.textContent))?.click(); }, re.source),
    async ready() { await p.waitForTimeout(6000); for (let k = 0; k < 3; k++) { for (const tx of ['Позже', 'В бой, герой!']) if (await p.getByRole('button', {name: tx}).count()) await p.getByRole('button', {name: tx}).first().click().catch(() => {}); await p.waitForTimeout(200); }
      await p.locator('.ae-x').first().click().catch(() => {}); await p.evaluate(() => document.querySelectorAll('.ae-toast').forEach(e => e.remove())); await p.waitForTimeout(300); }};
  ctx.done = async (from, to) => { const vp = await p.video().path(); await p.close(); await s.close(); marks[name] = {file: vp, from, to}; fs.writeFileSync(marksFile, JSON.stringify(marks, null, 1)); console.log(name, from.toFixed(2), '→', to.toFixed(2), vp); };
  return ctx;
}
const MULT = {rare: 1.35, epic: 1.65, legendary: 2.1};
function simGear(type, rarity, lvl, up, asc, extra = {}) {
  const m = MULT[rarity], st = {};
  if (type === 'weapon') { st.attack = Math.round((12 + lvl * 3) * m); st.critChance = Math.round((2 + lvl / 15) * 1.5); }
  else if (type === 'armor') { st.defense = Math.round((6 + lvl * 2) * m); st.magicDefense = Math.round((4 + lvl) * m); st.maxHp = Math.round((25 + lvl * 9) * m); }
  else if (['helmet', 'pants', 'gloves', 'boots', 'belt', 'cloak'].includes(type)) { st.defense = Math.round((3 + lvl) * m); st.magicDefense = Math.round((2 + lvl * 0.6) * m); st.maxHp = Math.round((12 + lvl * 4) * m); }
  else { st.attack = Math.round((4 + lvl) * m); st.maxHp = Math.round((10 + lvl * 3) * m); st.critChance = 1 + Math.floor(lvl / 20); }
  for (const k of Object.keys(st)) if (st[k] >= 10) st[k] = Math.round(st[k] * (1 + 0.1 * asc));
  for (const [k, v] of Object.entries(extra)) st[k] = (st[k] || 0) + v;
  return {id: 'tt_' + type, templateId: 'tt_' + type, name: type === 'weapon' ? 'Секира багрового рассвета ★3' : 'Латы рассвета ★3', type, rarity, level: lvl, upgradeLevel: up, ascension: asc, stats: st, icon: '⚔️', sellPrice: 10, disassembleYield: {}, stackCount: 1, isEquipped: true, ...(type === 'weapon' ? {twoHanded: true} : {})};
}
const strongHero = L => pl => { pl.level = L; pl.unlockedRegionIds = ['reg_plains', 'reg_whisper_woods', 'reg_forgotten_crypt', 'reg_forest', 'reg_swamp', 'reg_desert', 'reg_cursed'];
  const eq = {}; for (const t of ['weapon', 'helmet', 'armor', 'pants', 'gloves', 'boots', 'amulet', 'ring', 'belt', 'cloak', 'artifact']) eq[t] = simGear(t, 'legendary', L, 10, 3, t === 'weapon' ? {critChance: 8, critDamage: 30} : {});
  eq.weapon.stats.attack = Math.round(eq.weapon.stats.attack * 1.6); pl.equipped = eq; pl.inventory = (pl.inventory || []).filter(i => !eq[i.type]); };
const SCENES = {
  // 0–7 s: a far too strong hero meets the Threat: tougher monsters, the chip on screen, rage at low HP
  async threat() {
    const c = await start('threat', {mut: strongHero(45), world: w => { const me = w.tables.players.find(p => String(p.telegram_id) === ME); if (me) me.level = 45; }});
    const {p, W} = c; await c.ready(); await p.evaluate(() => localStorage.setItem('aeth_autoequip_437290420', '0')); await W(4000);
    await c.nav(/Мир/); await W(600);
    await p.locator('main [role=button], main button').filter({hasText: /Пылающая пустыня/}).first().click().catch(() => {}); await W(500);
    await p.getByRole('button', {name: /Отправиться в путь/}).first().click().catch(() => {});
    for (let i = 0; i < 40 && !(await p.getByRole('button', {name: /Начать охоту/i}).count()); i++) await W(400);
    await p.getByRole('button', {name: /Начать охоту/i}).first().click().catch(() => {}); await W(1500); await p.evaluate(() => scrollTo(0, 0));
    const from = c.at(); await c.cap('Мой герой стал<br>слишком сильным…', 'и игра ответила 😈'); await W(900);
    for (let i = 0; i < 6; i++) { await p.getByRole('button', {name: /^Атака/}).first().click({timeout: 1500, noWaitAfter: true}).catch(() => {}); await p.evaluate(() => scrollTo(0, 0)); await W(1100);
      if (i === 2) await c.cap('Монстры растут вместе с тобой', '⚠️ Угроза · 🔥 ярость · награда +50%'); }
    await c.done(from, c.at());
  },
  // 7–12 s: arena gladiators match the hero's strength
  async arena() {
    const c = await start('arena', {mut: pl => { pl.level = 45; pl.arenaTickets = 10; }, world: w => { const me = w.tables.players.find(p => String(p.telegram_id) === ME); if (me) me.level = 45; }});
    const {p, W} = c; await c.ready(); await W(3500);
    await c.nav(/Арена/); await W(1300);
    await p.getByRole('button', {name: 'В бой'}).nth(2).click().catch(() => {}); await W(1400);
    for (const t of ['Начать бой', 'В бой!', 'Сразиться', 'Подтвердить']) if (await p.getByRole('button', {name: t}).count()) { await p.getByRole('button', {name: t}).first().click().catch(() => {}); await W(1000); }
    await p.evaluate(() => scrollTo(0, 0));
    const from = c.at(); await c.cap('Гладиаторы арены', 'подстраиваются под твою силу');
    for (let i = 0; i < 4; i++) { await p.getByRole('button', {name: /^Атака/}).first().click({timeout: 1500, noWaitAfter: true}).catch(() => {}); await p.evaluate(() => scrollTo(0, 0)); await W(1100); }
    await c.done(from, c.at());
  },
  async horde() {
    const c = await start('horde', {mut: pl => { pl.equipped = {...pl.equipped, weapon: gear('tt-w', 'Клинок сумеречного леса', 'weapon', 'legendary', 30, {attack: 260}, {upgradeLevel: 7})}; }});
    const {p, W} = c; await c.ready();
    await p.evaluate(() => window.__aethOpen.horde()); await W(900);
    const from = c.at(); await c.cap('Орда: сколько монстров<br>ты продержишься?');
    await p.locator('.ae-horde-go').first().click({force: true}); await W(1300);
    for (let i = 0; i < 2; i++) { await p.locator('.ae-bv button').filter({hasText: /Атака/}).first().click({force: true}).catch(() => {}); await W(800); }
    await p.evaluate(() => { const d = document.createElement('div'); d.className = 'tt-classes'; d.innerHTML = '<img src="/assets/sprites/generated/monsters/bm_moon_lord.webp" style="height:62%;bottom:150px"><b style="color:#ff6b5a">🌕 Кровавая луна</b>'; document.body.append(d); setTimeout(() => d.remove(), 1100); }); await W(1150);
    await p.keyboard.press('Escape').catch(() => {}); await p.evaluate(() => { document.querySelectorAll('.ae-panel .ae-x').forEach(b => b.click()); }); await W(200);
    await p.evaluate(() => window.__aethOpen.coop()); await W(1300);
    await c.done(from, c.at());
  },
  // 22–27 s: feed the pet with the catch, it levels up
  async twohand() {
    const c = await start('twohand', {mut: pl => { pl.inventory.push(gear('axe1', 'Секира багрового рассвета', 'weapon', 'epic', 28, {attack: 100, critChance: 5}, {templateId: 'axe_double', icon: '🪓'}));
      const sh = gear('sh1', 'Щит болотного хранителя', 'offhand', 'rare', 25, {defense: 40}, {icon: '🛡️'}); pl.equipped = {...pl.equipped, offhand: {...sh, isEquipped: true}}; }});
    const {p, W} = c; await c.ready();
    await c.nav(/Сумка/); await W(900);
    const atk0 = await p.evaluate(() => window.__aethBridge.stats?.attack);
    await p.evaluate(() => document.querySelector('[data-inventory-item="axe1"]')?.scrollIntoView({block: 'center'})); await W(300);
    const from = c.at(); await c.cap('Двуручное оружие:<br>урон ×1.6 🗡️');
    await p.locator('[data-inventory-item="axe1"]').first().click({force: true}); await W(1100);
    await p.evaluate(() => document.querySelector('[data-ae-2h]')?.scrollIntoView({block: 'center'})); await W(300);
    await p.locator('[data-ae-2h]').first().click({force: true}); await W(1100);
    await p.getByRole('button', {name: /^Экипировать/}).first().click({force: true}).catch(() => {}); await W(1300);
    await p.keyboard.press('Escape').catch(() => {}); await p.evaluate(() => scrollTo(0, 0)); await W(200);
    const atk1 = await p.evaluate(() => window.__aethBridge.stats?.attack);
    await p.evaluate(([a, b]) => { const d = document.createElement('div'); d.className = 'tt-badge'; d.innerHTML = `⚔️ Атака ${a} → <em>${b}</em>`; document.body.append(d); }, [atk0, atk1]);
    await W(1500); console.log('atk', atk0, '→', atk1); await c.done(from, c.at());
  },
  // 17–22 s: Horde fight, Blood Moon, co-op
  // mail with a gift arrives in the bell
  async mail() {
    const c = await start('mail', {world: w => { const t = new Date().toISOString(); (w.tables.ae_mail ||= []).push({id: crypto.randomUUID(), op: crypto.randomUUID(), to: 'all', title: 'Подарок от короля', text: 'Спасибо, что сражаетесь за Аэтельгард! Держите награду.', gifts: {gold: 2000, fragments: 3, energy: 50}, at: t});
      const me = w.tables.players.find(p => String(p.telegram_id) === ME); if (me) me.created_at = new Date(Date.now() - 30 * 864e5).toISOString(); }});
    const {p, W} = c; await c.ready(); await W(2500); await p.evaluate(() => scrollTo(0, 0));
    const from = c.at(); await c.cap('Подарки и письма', 'приходят прямо в игру 🎁'); await W(900);
    await p.locator('[data-ae-bell]').first().click().catch(() => {}); await W(1600);
    await p.locator('.ae-mail button', {hasText: 'Забрать'}).first().click().catch(() => {}); await W(2200);
    await c.done(from, c.at());
  },
  async market() {
    let lotId = null;
    const c = await start('market', {world: w => { const t2 = new Date().toISOString();
      w.tables.owned_items.push({id: 'b1', owner_telegram_id: 555, item_json: {name: 'Доспех лунного стража', type: 'armor', rarity: 'epic', level: 26, stats: {defense: 95, maxHp: 120}, sellPrice: 30}, quantity: 1, locked: false, equipped_slot: null, bound_clan_id: null, origin: 'game_command', created_at: t2, updated_at: t2},
        {id: 'b2', owner_telegram_id: 555, item_json: {name: 'Посох звёздного огня', type: 'weapon', rarity: 'legendary', level: 30, stats: {magicAttack: 160}, sellPrice: 30, twoHanded: true}, quantity: 1, locked: false, equipped_slot: null, bound_clan_id: null, origin: 'game_command', created_at: t2, updated_at: t2}); }});
    const {s, p, W} = c;
    const {handleSocialRequest} = await import('../tgcloud/lib/social.js'); const {handleProgressRequest} = await import('../tgcloud/lib/gameEngine.js');
    const call = (path, body) => handleSocialRequest(s.world, {path, method: 'POST', body}, {id: 555}, Date.now()).then(r => r.body);
    const lot = (await call('/api/ae-market/lot', {kind: 'chat', itemId: 'b1', price: 1500})).lot; await call('/api/ae-market/lot', {kind: 'auction', itemId: 'b2', start: 2000, hours: 6});
    const enc = o => Buffer.from(unescape(encodeURIComponent(JSON.stringify(o))), 'binary').toString('base64');
    const say = (text, id = 555, name = 'Борис') => handleProgressRequest(s.world, {path: '/api/chat/global', method: 'POST', body: {text}}, {id, username: 'u' + id, displayName: name}, {now: () => Date.now(), isAdmin: () => false});
    await say('Кто идёт в кооп на паучье логово? 🕷️'); await say(`💰 Продаю: Доспех лунного стража — 1500 🪙 ⟦ae:l:${enc({id: lot.id, p: 1500, n: 'Доспех лунного стража', r: 'epic', l: 26, u: 0, t: 'armor', s: {defense: 95, maxHp: 120}})}⟧`);
    await c.ready();
    await p.evaluate(() => document.querySelector('[data-settlement-place="chat"]')?.click()); await W(3500);
    await p.evaluate(() => document.querySelector('.ae-chat-lot')?.scrollIntoView({block: 'center'})); await W(300);
    const from = c.at(); await c.cap('Торгуй с игроками', 'прямо в чате таверны');
    await W(900); await p.locator('.ae-chat-lot button', {hasText: 'Своя цена'}).first().click({force: true}).catch(() => {}); await W(1500);
    await p.evaluate(() => window.__aethOpen.auction('all')); await W(1000);
    c.p.removeAllListeners('dialog'); c.p.on('dialog', d => d.accept(d.type() === 'prompt' ? '2100' : undefined));
    await p.locator('.ae-panel .ae-lot button', {hasText: 'Ставка'}).first().click({force: true}).catch(() => {}); await W(1500);
    await c.done(from, c.at());
  },
  // 32–38 s: call to action
  async cta() {
    const c = await start('cta'); const {p, W} = c; await c.ready();
    await p.evaluate(PROMO => { const d = document.createElement('div'); d.className = 'tt-full'; d.style.backgroundImage = 'linear-gradient(#0008,#000c 70%),url(/assets/story/courtyard.webp)';
      d.innerHTML = `<h1>Aethelgard<br>RPG</h1><h2>⚔️ ИГРАЙ ПРЯМО В TELEGRAM</h2><div class="row"><small>Бот</small>🎮 @Aethelgardr_RPG_Bot</div><div class="row promo"><small>Промокод на старт</small>🎁 ${PROMO}</div><div class="row"><small>Новости</small>📣 t.me/Aethelgardo</div>`; document.body.append(d); }, PROMO);
    const from = c.at(); await W(6200); await c.done(from, c.at());
  },
};
const which = process.argv[2] || 'all';
for (const [k, fn] of Object.entries(SCENES)) if (which === 'all' || which.split(',').includes(k)) { try { await fn(); } catch (e) { console.log('scene', k, 'failed', e.message); } }
