// TikTok video, 8 scenes recorded separately at 1080×1920 (page zoom 2.5 → 432×768 css px).
// Usage: DIST=../dist node tt3.mjs <scene|all>   → video/tt3/<scene>.webm + video/tt3/marks.json
import {launch} from './browser.mjs'; import fs from 'node:fs';
const OUT = 'video/tt3'; fs.mkdirSync(OUT, {recursive: true});
const KEY = 'aethelgard_save_v1_data_437290420', ME = '437290420';
const marksFile = OUT + '/marks.json', marks = fs.existsSync(marksFile) ? JSON.parse(fs.readFileSync(marksFile)) : {};
const PROMO = 'AE-6NGGUR';
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
const SCENES = {
  // 0–3 s: a big critical hit in a hunt
  async hook() {
    const c = await start('hook', {mut: pl => { pl.equipped = {...pl.equipped, weapon: gear('tt-w', 'Клинок сумеречного леса', 'weapon', 'legendary', 30, {attack: 190}, {upgradeLevel: 7}), amulet: gear('tt-a', 'Амулет бездны', 'amulet', 'mythic', 30, {critChance: 95, critDamage: 60})}; }});
    const {p, W} = c; await c.ready();
    await c.nav(/Мир/); await W(500);
    await p.locator('main [role=button], main button').filter({hasText: /Шепчущий лес/}).first().click().catch(() => {}); await W(500);
    await p.getByRole('button', {name: /Отправиться в путь/}).first().click().catch(() => {}); await W(4300);
    await p.getByRole('button', {name: /Начать охоту/i}).first().click().catch(() => {}); await W(1200); await p.evaluate(() => scrollTo(0, 0));
    const from = c.at(); await c.cap('Эта RPG спрятана<br>в Telegram 👀'); await W(500);
    for (let i = 0; i < 3; i++) { await p.getByRole('button', {name: /^Атака/}).first().click({timeout: 1500, noWaitAfter: true}).catch(() => {}); await p.evaluate(() => scrollTo(0, 0)); await W(1400); }
    await c.done(from, c.at());
  },
  // 3–7 s: Telegram → the bot → Play (mock messenger) — the loading/settlement part is the start of the «hero» scene
  async tg() {
    const s = await launch({setupWorld: w => Object.assign(w, JSON.parse(fs.readFileSync('world-after-reg.json')))});
    const tg = await s.browser.newPage({viewport: {width: 1080, height: 1920}, recordVideo: {dir: OUT + '/raw', size: {width: 1080, height: 1920}}}); const t0 = Date.now();
    fs.copyFileSync('tg-mock.html', process.env.DIST + '/tg-mock.html'); try { await tg.goto(s.url + 'tg-mock.html', {waitUntil: 'load'}); } finally { fs.rmSync(process.env.DIST + '/tg-mock.html', {force: true}); } await tg.waitForTimeout(1500);
    await tg.addStyleTag({content: CSS.replace('html{zoom:2.5}', '') + '.cap{display:none!important}'});
    const from = (Date.now() - t0) / 1000;
    await tg.evaluate(() => { const d = document.createElement('div'); d.className = 'tt-cap'; d.innerHTML = 'Без скачивания.<br>Открыл бота — играешь'; document.body.append(d); requestAnimationFrame(() => d.classList.add('on')); window.go(); });
    await tg.waitForTimeout(6300); const to = (Date.now() - t0) / 1000;
    const vp = await tg.video().path(); await tg.close(); await s.close(); marks.tg = {file: vp, from, to}; fs.writeFileSync(marksFile, JSON.stringify(marks, null, 1)); console.log('tg', from, to);
  },
  // 7–12 s: loading → settlement → hero screen → classes
  async hero() {
    const c = await start('hero', {mut: pl => { pl.inventory.push(gear('g3', 'Латный доспех рыцаря', 'armor', 'legendary', 30, {defense: 150}, {upgradeLevel: 9}), gear('g2', 'Шлем дозорного', 'helmet', 'epic', 28, {defense: 60}, {upgradeLevel: 4}));
      pl.equipped = {...pl.equipped, armor: pl.inventory.at(-2), helmet: pl.inventory.at(-1), weapon: gear('tt-w', 'Клинок сумеречного леса', 'weapon', 'legendary', 30, {attack: 140}, {upgradeLevel: 7})}; pl.inventory.splice(-2); }});
    const {p, W} = c; await c.ready(); await W(400); const from = c.at() - 0.9;
    await c.nav(/Сумка/); await W(300); await c.cap('Воин, маг, разбойник, паладин…'); await W(1500);
    const CL = [['warrior', 'Воин'], ['mage', 'Маг'], ['rogue', 'Разбойник'], ['paladin', 'Паладин'], ['druid', 'Друид'], ['necromancer', 'Некромант'], ['archer', 'Лучник']];
    await p.evaluate(CL => { const d = document.createElement('div'); d.className = 'tt-classes'; document.body.append(d); let i = 0;
      const show = () => { const [k, n] = CL[i % CL.length]; d.innerHTML = `<img src="/assets/sprites/generated/heroes/${k}-fullbody.webp"><b>${n}</b>`; i++; }; show(); window.__ttCl = setInterval(show, 380); }, CL);
    await W(2700); await c.done(from, c.at());
  },
  // 12–17 s: reforge an axe into a two-hander, the shield goes back to the bag
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
  async horde() {
    const c = await start('horde', {mut: pl => { pl.equipped = {...pl.equipped, weapon: gear('tt-w', 'Клинок сумеречного леса', 'weapon', 'legendary', 30, {attack: 260}, {upgradeLevel: 7})}; }});
    const {p, W} = c; await c.ready();
    await p.evaluate(() => window.__aethOpen.horde()); await W(900);
    const from = c.at(); await c.cap('Орда · кооп · дуэли<br>· клановые рейды');
    await p.locator('.ae-horde-go').first().click({force: true}); await W(1300);
    for (let i = 0; i < 2; i++) { await p.locator('.ae-bv button').filter({hasText: /Атака/}).first().click({force: true}).catch(() => {}); await W(800); }
    await p.evaluate(() => { const d = document.createElement('div'); d.className = 'tt-classes'; d.innerHTML = '<img src="/assets/sprites/generated/monsters/bm_moon_lord.webp" style="height:62%;bottom:150px"><b style="color:#ff6b5a">🌕 Кровавая луна</b>'; document.body.append(d); setTimeout(() => d.remove(), 1100); }); await W(1150);
    await p.keyboard.press('Escape').catch(() => {}); await p.evaluate(() => { document.querySelectorAll('.ae-panel .ae-x').forEach(b => b.click()); }); await W(200);
    await p.evaluate(() => window.__aethOpen.coop()); await W(1300);
    await c.done(from, c.at());
  },
  // 22–27 s: feed the pet with the catch, it levels up
  async pet() {
    const sid = crypto.randomUUID(), t = new Date().toISOString();
    const c = await start('pet', {mut: pl => pl.inventory.push(gear(sid, 'Зимний осётр', 'material', 'rare', 1, {}, {templateId: 'fish_sturgeon', icon: '🐟', stackCount: 2, serverOwned: true}), gear('f-local', 'Ледяной голец', 'material', 'common', 1, {}, {templateId: 'fish_char', icon: '🐟', stackCount: 3})),
      world: w => { (w.tables.owned_items ||= []).push({id: sid, owner_telegram_id: Number(ME), item_json: {templateId: 'fish_sturgeon', name: 'Зимний осётр', type: 'material', rarity: 'rare', level: 1, stats: {}}, quantity: 2, locked: false, equipped_slot: null, bound_clan_id: null, character_id: null, origin: 'game_command', created_at: t, updated_at: t});
        (w.tables.ae_pet_food ||= []).push({user: ME, v: 22, t: Date.now(), active: 'pet_wolf', pets: {pet_wolf: {lvl: 4, xp: 172}}}); }});
    const {p, W} = c; await c.ready();
    await p.evaluate(() => document.querySelector('[data-settlement-place="fishing"]')?.click()); await W(1800);
    await p.evaluate(() => document.querySelector('[data-ae-fish-feed]')?.scrollIntoView({block: 'center'})); await W(200);
    const from = c.at(); await c.cap('Лови рыбу → корми питомца<br>→ он качается');
    await W(800); await p.evaluate(() => document.querySelector('[data-ae-fish-feed]')?.click()); await W(1300);
    await p.locator('.ae-panel .ae-petfood-fish button', {hasText: 'осётр'}).click({force: true}).catch(() => {}); await W(2300);
    await c.done(from, c.at());
  },
  // 27–32 s: chat lot → own price → auction bid
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
    const from = c.at(); await c.cap('Торгуй с игроками:<br>рынок, аукцион, сделки в чате');
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
