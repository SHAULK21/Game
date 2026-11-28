// TikTok video #6 with an Audio8 TTS voiceover: hero creation, battle, «Путь новичка», daily reward, several heroes, CTA.
// Usage: node tt8.mjs <scene|all> → video/tt8/<scene>.webm + video/tt8/marks.json (based on tt7.mjs)
import {launch} from './browser.mjs'; import fs from 'node:fs';
const OUT = 'video/tt8'; fs.mkdirSync(OUT, {recursive: true});
const KEY = 'aethelgard_save_v1_data_437290420', ME = '437290420';
const marksFile = OUT + '/marks.json', marks = fs.existsSync(marksFile) ? JSON.parse(fs.readFileSync(marksFile)) : {};
const PROMO = 'TT-GEROI';
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
  ls['aeth_daily_seen_' + ME] = new Date().toISOString().slice(0, 10);   // the daily reward would open by itself over the scene
  ls['aeth_coop_story_' + ME] = '1'; ls['aeth_2h_seen_' + ME] = '[]';
  return ls;
}
const CSS = `html{zoom:2.5}.ae-panel{max-height:calc(88vh / 2.5)!important}.ae-backdrop{height:calc(100vh / 2.5)!important}.ae-pop,.ae-apk-hint,.ae-toast{display:none!important}
.world-travel-overlay,.fantasy-travel-overlay{min-height:0!important}
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
    cap: (t, sub = '', top = 0) => p.evaluate(([t, sub, top]) => { document.querySelectorAll('.tt-cap').forEach(e => e.remove()); const d = document.createElement('div'); d.className = 'tt-cap'; if (top) d.style.top = top + 'px'; d.innerHTML = t + (sub ? `<small>${sub}</small>` : ''); document.body.append(d); requestAnimationFrame(() => d.classList.add('on')); }, [t, sub, top]),
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

const POT = (id, name, stats, icon) => ({id: 'p_' + id, templateId: id, name, type: 'potion', rarity: 'rare', level: 1, upgradeLevel: 0, icon, stats, sellPrice: 10, disassembleYield: {}, stackCount: 5});
const potions = pl => pl.inventory.push(POT('alc_rage', 'Зелье ярости', {attackPercent: 30, buffDuration: 3}, '😡'), POT('alc_throw_venom', 'Ядовитая склянка', {poisonDamage: 220}, '☠️'), POT('alc_mp_mid', 'Большое зелье маны', {manaRestore: 260}, '💧'), POT('alc_hp_great', 'Великое зелье исцеления', {heal: 650}, '💖'));
async function toFight(c, region = /Шепчущ/) {
  const {p, W} = c;
  await c.nav(/Мир/); await W(700);
  await p.locator('main [role=button], main button').filter({hasText: region}).first().click().catch(() => {}); await W(500);
  await p.getByRole('button', {name: /Отправиться в путь/}).first().click().catch(() => {});
  for (let i = 0; i < 40; i++) { const b = (await p.getByRole('button').allInnerTexts()).map(x => x.trim()); if (b.some(x => /^атака$/i.test(x))) break;
    const go = b.find(x => /^Начать охоту|^Отправиться ·|^Сразиться|^В бой/i.test(x)); if (go) await p.getByRole('button', {name: go}).first().click().catch(() => {}); await W(500); }
  await W(800); await p.evaluate(() => document.querySelector('[data-ae-scene]')?.scrollIntoView({block: 'start'}));
}
const atk = async c => { await c.p.getByRole('button', {name: /^атака$/i}).first().click({timeout: 1500, noWaitAfter: true}).catch(() => {}); await c.W(1200); await c.p.evaluate(() => document.querySelector('[data-ae-scene]')?.scrollIntoView({block: 'start'})); };

const CLAN = (w, extra = {}) => { const cid = 'clan-tt', st = new Date().toISOString();
  (w.tables.clans ||= []).push({id: cid, tag: 'ЛЕВ', name: 'Львиное сердце', description: '', owner_telegram_id: 437290420, level: 6, xp: 5200, max_members: 30, raid_hp: 12000, raid_max_hp: 12000, raid_reset_at: new Date(Date.now() + 5 * 864e5).toISOString(), created_at: st, updated_at: st, treasury_gold: 60000, treasury_silver: 9000, treasury_ore: 300, recruitment_open: true, min_join_level: 1, projects: {}});
  (w.tables.clan_members ||= []).push({clan_id: cid, telegram_id: 437290420, role: 'owner', joined_at: st, raid_damage: 0, last_raid_attack: null}, {clan_id: cid, telegram_id: 555, role: 'officer', joined_at: st, raid_damage: 2400, last_raid_attack: null});
  for (const id of [437290420, 555]) w.tables.players.find(p => p.telegram_id == id).clan_id = cid;
  (w.tables.ae_clan_fort ||= []).push({clan: cid, b: {hall: {lvl: 6}, walls: {lvl: 5}, barracks: {lvl: 6}, tower: {lvl: 3}, forge: {lvl: 4}, shrine: {lvl: 3}, vault: {lvl: 4}, den: {lvl: 5}}, g: {militia: 6, archer: 4}, upk_at: st, inc_at: st, hunt: 'dragon', bosses: {}, shield: null, atk_at: null, log: []});
  (w.tables.ae_lands ||= []).push({id: 'l_forest', owner: cid, troops: {militia: 12, archer: 4}, gov: null, spec: 'gold', specLvl: 2, pool: null, at: null, inc_at: st, shield: null, log: []},
    {id: 'l_plains', owner: null, troops: {}, gov: null, spec: null, specLvl: 0, pool: 520, at: st, inc_at: null, shield: null, log: []});
  (w.tables.ae_companions ||= []).push({id: 'k1', u: ME, name: 'Бран Железный', role: 'tank', lvl: 42, gear: {}}, {id: 'k2', u: ME, name: 'Лиара Светлая', role: 'heal', lvl: 30, gear: {}});
  Object.assign(w.tables.players.find(p => String(p.telegram_id) === ME), {level: 45}); };

const NAMES = ['Мирослава', 'Тихон', 'Ярослав', 'Велена', 'Дарен', 'Златка', 'Радомир', 'Весна'];
const SEASONW = w => { const st = new Date().toISOString(), me = w.tables.players.find(p => String(p.telegram_id) === ME); me.level = 45;
  const rows = (w.tables.ae_season ||= []); rows.push({s: 1, u: ME, pts: 1590, got: [1, 2, 3, 4, 5, 6, 7, 8, 9], day: st.slice(0, 10), dayPts: 210, login: st.slice(0, 10)});
  NAMES.forEach((n, i) => { const id = 9200 + i; w.tables.players.push({...me, telegram_id: id, character_name: n, level: 70 - i * 6, clan_id: null}); rows.push({s: 1, u: String(id), pts: 2450 - i * 260, got: [], day: '', dayPts: 0}); }); };

const ALT1 = String(8e15 + 437290420 * 4 + 1), ALT2 = String(8e15 + 437290420 * 4 + 2);
const SCENES = {
  async create() {
    const ls = {aethelgard_interface_style: 'fantasy', aeth_ui_scale: 'big'};
    const c = await start('create', {ls, world: w => { w.tables.players = w.tables.players.filter(p => String(p.telegram_id) !== ME); }}); const {p, W} = c;
    await W(6000); await p.evaluate(() => [...document.querySelectorAll('button')].find(b => /^Пропустить$/.test(b.textContent.trim()))?.click()); await W(1800);
    await p.evaluate(() => document.querySelector('.registration-screen')?.scrollTo(0, 0)); await W(300);
    const from = c.at(); await c.cap('Создай героя за минуту ⚔️', '10 классов · своё имя'); await W(900);
    const inp = p.locator('.registration-screen input').first(); await inp.click(); await p.keyboard.press('Control+A'); await p.keyboard.type('Арина', {delay: 140}); await W(500);
    await p.evaluate(() => document.activeElement?.blur());
    for (const cls of ['Некромант', 'Маг', 'Паладин', 'Некромант']) { await p.evaluate(cls => { const b = [...document.querySelectorAll('.registration-screen button')].find(x => x.textContent.trim().startsWith(cls)); b?.click(); }, cls); await W(1100); }
    await p.evaluate(() => document.querySelector('.registration-screen')?.scrollBy({top: 260, behavior: 'smooth'})); await W(1500);
    await c.done(from, c.at());
  },
  async battle() {
    const c = await start('battle', {mut: pl => { pl.level = 9; pl.unlockedRegionIds = ['reg_plains', 'reg_whisper_woods']; potions(pl); }}); const {p, W} = c; await c.ready();
    await toFight(c);
    const from = c.at(); await c.cap('Пошаговые бои 🔥', 'навыки · связки · зелья · питомец');
    await p.getByRole('button', {name: /^Навыки$/}).first().click().catch(() => {}); await W(700);
    await p.evaluate(() => [...document.querySelectorAll('button')].find(b => /Мощный удар/.test(b.textContent))?.click()); await W(150); await p.evaluate(() => document.querySelector('[data-ae-scene]')?.scrollIntoView({block: 'start'})); await W(1650);
    await p.evaluate(() => document.querySelector('[data-ae-scene]')?.scrollIntoView({block: 'start'}));
    await atk(c); await atk(c);
    await p.getByRole('button', {name: /^Навыки$/}).first().click().catch(() => {}); await W(600);
    await p.evaluate(() => [...document.querySelectorAll('button')].find(b => /Боевой натиск|Сокрушение/.test(b.textContent))?.click()); await W(150); await p.evaluate(() => document.querySelector('[data-ae-scene]')?.scrollIntoView({block: 'start'})); await W(1650);
    await p.evaluate(() => document.querySelector('[data-ae-scene]')?.scrollIntoView({block: 'start'})); await atk(c);
    await c.done(from, c.at());
  },
  async path() {
    const c = await start('path', {mut: pl => { pl.level = 3; pl.exp = 120; pl.worldPlace = 'field'; }, world: w => {
      Object.assign(w.tables.players.find(p => String(p.telegram_id) === ME), {level: 3});
      (w.tables.ae_path ||= []).push({u: ME, marks: {win: 'x', stats: 'x', skill: 'x', gear: 'x'}, claimed: {win: 'a', stats: 'b'}, at: new Date().toISOString()}); }});
    const {p, W} = c; await c.ready(); await W(5000);
    await p.evaluate(() => window.__aethOpen.path()); await W(2500); await p.evaluate(() => window.__aethOpen.path()); await W(1200);
    const from = c.at(); await c.cap('Путь новичка 🧭', '7 шагов · награда за каждый'); await W(1600);
    await p.evaluate(() => document.querySelector('.ae-path-step.is-ready button')?.click()); await W(1700);
    await p.evaluate(() => { const b = document.querySelector('.ae-panel .ae-body'); b?.scrollTo({top: b.scrollHeight, behavior: 'smooth'}); }); await W(800);
    await c.cap('5 уровень = Премиум на сутки 👑', 'автобой и офлайн-добыча'); await W(2200);
    await c.done(from, c.at());
  },
  async daily() {
    const c = await start('daily', {mut: strongHero(30), world: w => { (w.tables.ae_daily ||= []).push({u: ME, day: new Date(Date.now() - 864e5).toISOString().slice(0, 10), n: 6, best: 6}); }});
    const {p, W} = c; await c.ready(); await W(1500);
    await p.evaluate(() => window.__aethOpen.daily()); await W(1800);
    const from = c.at(); await c.cap('Награда за вход 🎁', 'каждый день — больше'); await W(1800);
    await c.cap('7-й день — Премиум 👑', 'золото · осколки · билеты'); await W(500);
    await p.evaluate(() => [...document.querySelectorAll('.ae-panel button')].find(b => /Забрать награду/.test(b.textContent))?.click()); await W(2600);
    await c.done(from, c.at());
  },
  async chars() {
    const c = await start('chars', {mut: strongHero(30), world: w => { const me = w.tables.players.find(p => String(p.telegram_id) === ME);
      me.premium_until = new Date(Date.now() + 9 * 864e5).toISOString();
      w.tables.players.push({...me, telegram_id: ALT1, character_name: 'Мира', class_id: 'necromancer', level: 24, clan_id: null}); }});
    const {p, W} = c; await c.ready(); await W(1500);
    await p.evaluate(() => window.__aethOpen.chars()); await W(2000);
    const from = c.at(); await c.cap('До 3 героев на аккаунте 👥', 'разные классы — один Телеграм'); await W(3400);
    await p.evaluate(() => document.querySelector('.ae-char.is-empty button')?.scrollIntoView({block: 'center', behavior: 'smooth'})); await W(1400);
    await c.done(from, c.at());
  },
  async anim() {
    const c = await start('anim', {mut: pl => { pl.level = 9; pl.unlockedRegionIds = ['reg_plains', 'reg_whisper_woods']; potions(pl); }}); const {p, W} = c; await c.ready();
    await toFight(c);
    const from = c.at();
    await atk(c); await W(900); await atk(c); await W(900);
    await p.getByRole('button', {name: /^Защита/}).first().click({timeout: 1500, noWaitAfter: true}).catch(() => {}); await W(150); await p.evaluate(() => document.querySelector('[data-ae-scene]')?.scrollIntoView({block: 'start'})); await W(2400);
    await atk(c); await W(1200); await atk(c); await W(1500);
    await c.done(from, c.at());
  },
  async cta() {
    const c = await start('cta'); const {p, W} = c; await c.ready();
    await p.evaluate(PROMO => { const d = document.createElement('div'); d.className = 'tt-full'; d.style.backgroundImage = 'linear-gradient(#0008,#000c 70%),url(/assets/story/courtyard.webp)';
      d.innerHTML = `<h1>Aethelgard<br>RPG</h1><h2>⚔️ ФЭНТЕЗИ-РПГ В TELEGRAM</h2><div class="row"><small>Играй прямо в Telegram</small>🎮 @Aethelgardr_RPG_Bot</div><div class="row promo"><small>Промокод на старт</small>🎁 ${PROMO}</div>`;
      document.body.append(d); }, PROMO);
    const from = c.at(); await W(6500); await c.done(from, c.at());
  },
};
const which = process.argv[2] || 'all';
for (const [k, fn] of Object.entries(SCENES)) if (which === 'all' || which.split(',').includes(k)) { try { await fn(); } catch (e) { console.log('scene', k, 'failed', e.message); } }
