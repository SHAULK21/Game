// Aethelgard add-ons: item merging, friends & private messages, co-op dungeons, wiki,
// story scenes for first visits, extra UI/combat sounds. Plain DOM, no build step.
// Talks to the game through window.__aethBridge (set by the game provider on every render).
(() => {
  if (window.__aethAddons) return;
  window.__aethAddons = true;
  const B = () => window.__aethBridge || null;
  const me = () => B()?.player || null;
  const uid = () => String(me()?.userId || '');
  // ---------- interface size: the whole game scaled down (setting kept on the device) ----------
  const UI_SCALES = [['big', 'Как раньше', 1], ['x1', '×1 Обычный', 0.92], ['x2', '×2 Компактный', 0.84], ['x3', '×3 Мини', 0.76]];
  const uiScale = () => { const k = localStorage.getItem('aeth_ui_scale') || 'x1'; return (UI_SCALES.find(x => x[0] === k) || UI_SCALES[1])[2]; };
  // Phones: the viewport tag renders the page wider and scales it down — the browser shrinks everything at once
  // (fixed bars, full-height screens, dialogs), so the game still fills the screen. Where the tag is ignored
  // (Telegram Desktop, some WebViews) the page falls back to CSS zoom with fixes for full-height parts.
  const BASE_VIEWPORT = 'width=device-width, initial-scale=1.0, viewport-fit=cover';
  let scaleMode = null, scaleBase = 0;
  const pageZoom = () => scaleMode === 'zoom' ? uiScale() : 1; // CSS zoom factor between screen and page pixels
  const deviceWidth = () => Math.round((window.visualViewport?.width || innerWidth) * (window.visualViewport?.scale || 1));
  function useZoom(z) {
    const root = document.documentElement; scaleMode = z === 1 ? null : 'zoom';
    root.style.zoom = z === 1 ? '' : String(z); root.style.setProperty('--ae-zoom', String(z)); root.classList.toggle('ae-zoomed', z !== 1);
  }
  function applyUiScale(force) {
    const z = uiScale(), meta = document.querySelector('meta[name=viewport]'), root = document.documentElement;
    root.classList.toggle('ae-scaled', z !== 1); root.style.setProperty('--ae-scale', String(z));
    if (scaleMode === 'zoom' && !force) return useZoom(z); // the viewport tag was already found not to work here
    useZoom(1);
    const base = deviceWidth();
    if (z === 1 || !meta || !matchMedia('(pointer: coarse)').matches || base < 200) { meta?.setAttribute('content', BASE_VIEWPORT); scaleBase = 0; if (z !== 1) useZoom(z); return; }
    scaleBase = base; scaleMode = 'meta';
    meta.setAttribute('content', `width=${Math.round(base / z)}, initial-scale=${z}, minimum-scale=${z}, maximum-scale=${z}, user-scalable=no, viewport-fit=cover`);
    setTimeout(() => { // did the browser honour it? the page should now be base / z pixels wide
      if (scaleMode === 'meta' && Math.abs(document.documentElement.clientWidth - base / z) > 12) { meta.setAttribute('content', BASE_VIEWPORT); useZoom(z); }
    }, 400);
  }
  applyUiScale();
  addEventListener('orientationchange', () => setTimeout(() => { if (scaleMode === 'meta' && Math.abs(deviceWidth() - scaleBase) > 20) applyUiScale(); }, 500));

  // ---------- helpers ----------
  const h = (tag, attrs = {}, ...kids) => {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else if (k === 'html') el.innerHTML = v;
      else el.setAttribute(k, v === true ? '' : v);
    }
    for (const kid of kids.flat()) if (kid != null && kid !== false) el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
    return el;
  };
  const cleanError = e => String(e?.message || e || 'Ошибка').replace(/ \(HTTP \d+\)$/, '');
  // The hero's real combat stats (gear, attributes, talents, pet) as the game computes them.
  const STATS_PATHS = /^\/api\/(horde\/start|duel\/start|coop\/create|coop\/join|ae-clanx\/raid\/start)$/;
  function heroStatsPayload() {
    const s = B()?.stats; if (!s || !(s.maxHp > 0)) return null;
    const pet = me()?.activePet;
    return {pet: pet ? {id: pet.id, name: pet.name, level: pet.level || 1, rarity: pet.rarity, hungry: !!pet.aeHungry} : null, maxHp: s.maxHp, attack: s.attack, magicAttack: s.magicAttack, defense: s.defense, magicDefense: s.magicDefense, critChance: s.critChance, critDamage: s.critDamage, evasion: s.evasion, vampirism: s.vampirism, armorPenetration: s.armorPenetration, hpRegen: s.hpRegen, mpRegen: s.mpRegen, maxMp: s.maxMp, kit: heroKit()};
  }
  // The hero's skills with the same math as the main combat: skill rank (level + main attribute) and the talent tree.
  const MAIN_ATTR = {warrior: 'strength', berserker: 'strength', knight: 'vitality', rogue: 'agility', assassin: 'agility', archer: 'agility', hunter: 'agility', mage: 'intelligence', necromancer: 'intelligence', paladin: 'spirit', druid: 'spirit'};
  function talentBonuses(talents) {
    const t = {};
    for (const n of talents || []) if (n.currentRank) for (const e of [n.effect, ...(n.effects || [])]) { if (!e?.stat) continue;
      const v = n.branch === 'mastery' ? e.valuePerRank * (1 - Math.exp(-n.currentRank / 100)) : e.valuePerRank * n.currentRank; t[e.stat] = (t[e.stat] || 0) + v; }
    return t;
  }
  function skillRank(p) { const a = p.attributes?.[MAIN_ATTR[p.classId]] || 0; return p.level >= 70 && a >= 250 ? 4 : p.level >= 40 && a >= 150 ? 3 : p.level >= 20 && a >= 80 ? 2 : 1; }
  function heroKit(p = me()) {
    if (!p?.skills) return null;
    const t = talentBonuses(p.talents), rank = skillRank(p), RM = [1, 1.12, 1.25, 1.4];
    const skills = p.skills.filter(k => (k.levelReq || 1) <= (p.level || 1)).map(k => {
      const r = String(k.id).startsWith('asc_') ? 1 : rank, inf = k.inflicts;
      return {id: k.id, name: k.name, icon: k.icon, desc: k.description || '', levelReq: k.levelReq || 1, type: k.damageType,
        mana: Math.max(0, Math.ceil((k.manaCost || 0) * (1 - (t.manaCostReduction || 0) / 100))),
        mult: (k.damageMultiplier || 0) * RM[r - 1] * (1 + (t.skillDamage || 0) / 100), heal: (k.healMultiplier || 0),
        comboFrom: k.comboFrom || null, comboMult: k.comboMultiplier || 1.25, armorBreak: (k.armorBreak || 0) / 100, execT: k.executeThreshold || 0, execM: k.executeMultiplier || 1.5,
        inflicts: inf ? {type: inf.type, chance: Math.min(1, (inf.chance ?? 1) * (1 + (t.effectChance || 0) / 100)), duration: (inf.duration || 1) + (t.effectDuration || 0) + (['shield', 'fury', 'fortify', 'haste'].includes(inf.type) ? (t.buffDuration || 0) : 0),
          power: (inf.power || 0) * (inf.type === 'vulnerability' ? 1 + (t.vulnerabilityPower || 0) / 100 : 1)} : null};
    });
    const keep = ['alternatingDamage', 'executeDamage', 'afflictedDamage', 'offensiveStance', 'defensiveStance', 'skillManaReturn', 'critMana', 'shieldPower', 'defendHeal', 'blockMana', 'killRecovery', 'lowHpReduction', 'dotPower', 'healPower'];
    for (const it of Object.values(p.equipped || {})) if (it?.stats) for (const k of ['bleedChance', 'poisonChance', 'burnChance']) if (it.stats[k]) t[k] = (t[k] || 0) + Number(it.stats[k]);
    keep.push('bleedChance', 'poisonChance', 'burnChance');
    return {skills, talents: Object.fromEntries(keep.filter(k => t[k]).map(k => [k, Math.round(t[k] * 100) / 100]))};
  }
  // The game's own «Навыки» menu (same markup as the monster fight), shared by co-op, duels and the Horde.
  // Every skill costs mana only. combos: ids of skills that would trigger a combo right now.
  function skillMenu({mp, disabled, combos = [], onUse, onClose}) {
    const p = me(); if (!p?.skills?.length) return '';
    const kit = heroKit(p), cost = id => kit?.skills.find(k => k.id === id)?.mana ?? null, rank = ['I', 'II', 'III', 'IV'][skillRank(p) - 1];
    const tagRank = k => String(k.id).startsWith('asc_') ? `Ранг ${String(k.id).endsWith('_C') ? 'C' : p.ascension?.rank === 'SSS' ? 'SSS' : 'S'}` : rank;
    const rows = p.skills.map(k => {
      const locked = (p.level || 1) < (k.levelReq || 1), c = cost(k.id) ?? Math.ceil(k.manaCost || 0), enough = mp >= c, can = enough && !locked && !disabled, combo = combos.includes(k.id);
      return {k, locked, c, enough, can, combo};
    });
    if (isModern()) {
      return h('div', {class: 'bg-slate-900/95 border border-indigo-500/40 rounded-xl p-3 space-y-2 mt-2', 'data-ae-skill-menu': '1'},
        h('div', {class: 'flex items-center justify-between text-xs text-indigo-300 font-cinzel font-bold border-b border-slate-800 pb-1'}, h('span', {}, 'Выберите заклинание или навык'), h('button', {class: 'text-slate-400 hover:text-white', type: 'button', onclick: onClose}, '✕')),
        h('div', {class: 'grid grid-cols-1 gap-1.5'}, ...rows.map(({k, locked, c, enough, can, combo}) => h('button', {type: 'button', disabled: !can, 'data-combat-skill': k.id, onclick: () => can && onUse(k),
          class: 'p-2 rounded-lg border flex items-start gap-2 justify-between text-left transition-all ' + (can ? (combo ? 'bg-cyan-950/40 border-cyan-400 hover:border-cyan-200 active:scale-98 cursor-pointer' : 'bg-slate-950 border-indigo-900/60 hover:border-indigo-400 active:scale-98 cursor-pointer') : 'bg-slate-950/40 border-slate-800 text-slate-500 cursor-not-allowed')},
          h('div', {}, h('div', {class: 'text-xs font-bold text-slate-200 flex items-center gap-1.5'}, h('span', {}, k.icon || '✨'), h('span', {}, k.name), combo ? h('span', {class: 'text-[9px] text-cyan-300'}, '🔗 Связка') : '', h('span', {class: 'text-[9px] text-cyan-300'}, tagRank(k)),
              k.isUltimate ? h('span', {class: 'text-[9px] px-1 rounded bg-amber-950 text-amber-300 border border-amber-500 font-mono'}, 'УЛЬТ') : ''),
            h('div', {class: 'text-[10px] text-slate-400'}, k.description || ''), locked ? h('div', {class: 'text-[10px] text-rose-400 font-mono'}, `🔒 С уровня ${k.levelReq}`) : ''),
          h('div', {class: 'text-right shrink-0'}, h('span', {class: 'text-[10px] font-mono block ' + (enough ? 'text-indigo-300' : 'text-rose-400')}, `${c} MP`)))),
          h('div', {class: 'col-span-full text-[10px] text-slate-500 p-2'}, '🔒 Неизвестный классовый навык. Откроется при развитии героя.')));
    }
    return h('section', {id: 'combat-skills', 'aria-label': 'Выберите заклинание или навык', class: 'combat-ledger p-3 space-y-2 mt-2', 'data-ae-skill-menu': '1'},
      h('div', {class: 'combat-ledger-heading'}, h('span', {}, 'Выберите заклинание или навык'), h('button', {'aria-label': 'Закрыть список навыков', class: 'combat-ledger-close', type: 'button', onclick: onClose}, '×')),
      h('div', {class: 'combat-skill-ledger'}, ...rows.map(({k, locked, c, enough, can, combo}) => h('button', {type: 'button', 'data-combat-skill': k.id, disabled: !can, class: 'combat-skill-entry ' + (combo ? 'is-combo' : ''), onclick: () => can && onUse(k)},
        h('span', {class: 'combat-skill-copy'}, h('span', {class: 'combat-skill-heading'}, h('strong', {}, k.name), h('span', {class: 'combat-ink-tag'}, tagRank(k)), combo ? h('span', {class: 'combat-ink-tag'}, 'Связка') : '', k.isUltimate ? h('span', {class: 'combat-ink-tag'}, 'УЛЬТ') : ''),
          h('span', {class: 'combat-skill-description'}, k.description || ''), locked ? h('span', {class: 'combat-unavailable'}, `Доступно с уровня ${k.levelReq}`) : ''),
        h('span', {class: 'combat-mana-cost ' + (enough ? '' : 'combat-unavailable')}, `${c} MP`))),
        h('p', {class: 'combat-ledger-note'}, 'Неизвестный классовый навык откроется при развитии героя.')));
  }
  async function api(path, method = 'GET', body) {
    const b = B(); if (!b) throw new Error('Игра ещё загружается.');
    if (method !== 'GET' && STATS_PATHS.test(path)) { const st = heroStatsPayload(); if (st) body = {...(body || {}), stats: st}; }
    return b.api(path, method === 'GET' ? {} : {method, body: JSON.stringify(body || {})});
  }
  // Keep the server copy fresh so duel opponents fight against your current gear too.
  let statsSent = '', statsSentAt = 0;
  setInterval(() => {
    try {
      const st = heroStatsPayload(), j = st && JSON.stringify(st);
      if (!j || j === statsSent || Date.now() - statsSentAt < 30e3 || document.documentElement.hasAttribute('data-in-combat')) return;
      statsSentAt = Date.now(); api('/api/ae-stats', 'POST', {stats: st}).then(() => { statsSent = j; }, () => {});
    } catch {}
  }, 10e3);
  const uuid4 = () => crypto.randomUUID();
  const fmt = n => Number(n || 0).toLocaleString('ru-RU');
  let toastTimer;
  function toast(text) {
    let t = document.querySelector('.ae-toast');
    if (!t) { t = h('div', {class: 'ae-toast', role: 'status'}); document.body.append(t); }
    t.textContent = text; t.classList.add('is-on'); clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('is-on'), 2600);
  }


  // ---------- icons instead of emoji in the add-ons' own UI: one atlas: the game's own icons and painted ones in the same style ----------
  // Emoji look different on every phone; these match the game. Only our own panels and buttons are touched,
  // never the game's React-managed DOM.
  const AE_ATLAS = {url: '/assets/ae-icons-v2.webp', cols: 6, rows: 9, icons: {"gold":[0,0],"silver":[1,0],"energy":[2,0],"attack":[3,0],"defend":[4,0],"hp":[5,0],"clan":[0,1],"crown":[1,1],"forge":[2,1],"arena":[3,1],"quest":[4,1],"map":[5,1],"hunt":[0,2],"potion":[1,2],"skill":[2,2],"monster":[3,2],"mine":[4,2],"inventory":[5,2],"settings":[0,3],"refresh":[1,3],"character":[2,3],"bestiary":[3,3],"compass":[4,3],"alchemy":[5,3],"market":[0,4],"stamina":[1,4],"crystal":[2,4],"coin":[3,4],"spark":[4,4],"key":[5,4],"badge":[0,5],"ore":[1,5],"herb":[2,5],"fang":[3,5],"bell":[4,5],"mail":[5,5],"gift":[0,6],"hammer":[1,6],"blade":[2,6],"zoom":[3,6],"paw":[4,6],"ticket":[5,6],"megaphone":[0,7],"news":[1,7],"coop":[2,7],"friends":[3,7],"book":[4,7],"chat":[5,7],"trophy":[0,8],"moon":[1,8],"calendar":[2,8]}};
  const AE_LINE = { // 24×24 line icons for what the atlas has no picture of, painted in the text colour through a CSS mask
    plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
  };
  const AE_EMOJI = {'🪙': 'gold', '🥈': 'silver', '⚡': 'energy', '⚔': 'attack', '🛡': 'defend', '❤': 'hp', '👑': 'crown', '💎': 'crystal', '💰': 'market', '⚒': 'forge',
    '🏟': 'arena', '📜': 'quest', '🗺': 'map', '🎯': 'hunt', '🧪': 'potion', '✨': 'skill', '👹': 'monster', '⛏': 'mine', '🎒': 'inventory', '⚙': 'settings', '🔄': 'refresh',
    '👤': 'character', '📖': 'bestiary', '🧭': 'compass', '⚗': 'alchemy', '✦': 'spark', '🔑': 'key',
    '🔔': 'bell', '✉': 'mail', '📨': 'mail', '🎁': 'gift', '🔨': 'hammer', '🗡': 'blade', '🔍': 'zoom', '🐾': 'paw', '🎟': 'ticket', '📢': 'megaphone', '📣': 'megaphone',
    '📰': 'news', '🤝': 'coop', '👥': 'friends', '📚': 'book', '💬': 'chat', '🏆': 'trophy', '📦': 'inventory', '➕': 'plus', '🌕': 'moon', '🗓': 'calendar', '📅': 'calendar'};
  const AE_EMOJI_RE = new RegExp('(' + Object.keys(AE_EMOJI).map(e => e.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')️?', 'g');
  const aeIcon = name => { const el = document.createElement('i'); el.className = 'ae-ic'; el.dataset.i = name; el.setAttribute('aria-hidden', 'true'); return el; };
  (() => { // the CSS for every icon, generated once
    const a = AE_ATLAS, rules = [`.ae-ic{display:inline-block;width:1.25em;height:1.25em;vertical-align:-.28em;flex:none;background:url(${a.url}) no-repeat;background-size:${a.cols * 100}% ${a.rows * 100}%}`];
    for (const [n, [c, r]] of Object.entries(a.icons)) rules.push(`.ae-ic[data-i="${n}"]{background-position:${a.cols > 1 ? c / (a.cols - 1) * 100 : 0}% ${a.rows > 1 ? r / (a.rows - 1) * 100 : 0}%}`);
    for (const [n, svg] of Object.entries(AE_LINE)) { const url = `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${svg}</svg>`)}")`;
      rules.push(`.ae-ic[data-i="${n}"]{background:currentColor;-webkit-mask:${url} center/88% no-repeat;mask:${url} center/88% no-repeat}`); }
    rules.push('.ae-fx-canvas{position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none;z-index:2147482000}.ae-fx-flash{position:fixed;inset:0;pointer-events:none;z-index:2147481999;transition:opacity .38s ease-out}@keyframes aeShake{0%,100%{transform:translate(0,0)}20%{transform:translate(-5px,2px)}40%{transform:translate(4px,-3px)}60%{transform:translate(-3px,1px)}80%{transform:translate(2px,-1px)}}@keyframes aeShakeBig{0%,100%{transform:translate(0,0)}15%{transform:translate(-11px,4px)}30%{transform:translate(9px,-6px)}45%{transform:translate(-7px,3px)}60%{transform:translate(5px,-2px)}80%{transform:translate(-2px,1px)}}.ae-fx-shake{animation:aeShake .32s ease-out}.ae-fx-shake-big{animation:aeShakeBig .42s ease-out}@keyframes aeFlinch{0%{transform:translateX(0);filter:none}30%{transform:translateX(9px) scale(.985);filter:brightness(1.8) sepia(1) hue-rotate(-40deg) saturate(4)}100%{transform:translateX(0);filter:none}}.ae-fx-flinch{animation:aeFlinch .24s ease-out}@keyframes aeRage{0%,100%{filter:drop-shadow(0 0 6px rgba(255,40,20,.7)) saturate(1.2)}50%{filter:drop-shadow(0 0 18px rgba(255,70,20,.95)) saturate(1.5) brightness(1.08)}}.ae-fx-rage{animation:aeRage 1.1s ease-in-out infinite}@keyframes aeDissolve{0%{opacity:1;filter:none}60%{opacity:.4;filter:brightness(2) sepia(1) saturate(3) blur(1px)}100%{opacity:0;filter:brightness(3) blur(3px);transform:translateY(-8px) scale(.96)}}.ae-fx-dissolve{animation:aeDissolve 1.4s ease-in forwards}.ae-relink{position:fixed;inset:0;z-index:2147483000;background:rgba(5,7,6,.86);display:flex;align-items:center;justify-content:center;padding:20px}.ae-relink-card{max-width:380px;width:100%;background:#141a17;border:1px solid #a58a4f;border-radius:16px;padding:18px;color:#f1ead8;display:flex;flex-direction:column;gap:8px;text-align:center}.ae-relink-card h2{margin:0;color:#ffe6a8;font:800 20px Georgia,serif}.ae-relink-card p{margin:0 0 6px;font-size:13.5px;line-height:1.45}.ae-apk-list{margin:6px 0 0;padding-left:18px;font-size:13px;line-height:1.45}.ae-apk-list li{margin:3px 0}.ae-gem-img{width:40px;height:40px;object-fit:contain;flex:none}.ae-gem-chip-img{width:1.4em;height:1.4em;object-fit:contain;vertical-align:-.35em}.ae-entry-icon .ae-ic,.ae-pop-i .ae-ic,.ae-inbox-i .ae-ic,.ae-gem-i .ae-ic{width:1.15em;height:1.15em;vertical-align:-.2em}.ae-head h2 .ae-ic{margin-right:.15em}');
    document.head.append(h('style', {}, rules.join('\n')));
  })();
  const AE_IC_SCOPE = '.ae-backdrop, .ae-toast, .ae-pop, .ae-bv, .ae-bag-merge, .ae-coop-card, .ae-market-one, .ae-entry, .ae-2h-note, .ae-2h-btn, .ae-story, .ae-chat-item, .ae-float, .ae-premium, .ae-weekend, .ae-quick-btn, .ae-exp-ready, .ae-forge-up, .ae-pill-btn, .ae-place-badge';
  function iconize(root) {
    if (!root || root.nodeType !== 1 || !AE_EMOJI_RE.test(root.textContent || '')) return; AE_EMOJI_RE.lastIndex = 0;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {acceptNode: t => { const p = t.parentElement; if (!p || p.closest('input, textarea, select, option, [contenteditable], .ae-ic, [data-ae-noic]')) return NodeFilter.FILTER_REJECT;
      AE_EMOJI_RE.lastIndex = 0; return AE_EMOJI_RE.test(t.data) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP; }});
    const hits = []; for (let t; (t = walker.nextNode());) hits.push(t);
    for (const t of hits) { const frag = document.createDocumentFragment(); let last = 0; AE_EMOJI_RE.lastIndex = 0;
      for (let m; (m = AE_EMOJI_RE.exec(t.data));) { if (m.index > last) frag.append(t.data.slice(last, m.index)); frag.append(aeIcon(AE_EMOJI[m[1]])); last = m.index + m[0].length; }
      if (last < t.data.length) frag.append(t.data.slice(last)); t.replaceWith(frag); }
  }
  let icQueue = new Set(), icRaf = 0;
  new MutationObserver(list => {
    for (const m of list) { const el = m.target.nodeType === 1 ? m.target : m.target.parentElement; if (!el) continue;
      const scope = el.closest(AE_IC_SCOPE) || [...m.addedNodes].find(n => n.nodeType === 1 && n.matches?.(AE_IC_SCOPE)); if (scope) icQueue.add(scope); }
    if (icQueue.size && !icRaf) icRaf = requestAnimationFrame(() => { icRaf = 0; const q = icQueue; icQueue = new Set(); for (const r of q) try { iconize(r); } catch {} });
  }).observe(document.documentElement, {childList: true, subtree: true});
  // ---------- panel ----------
  let openPanelState = null;
  function openPanel(title, render, {onClose, cls} = {}) {
    closePanel(); try { logVisit('Окно: ' + title); } catch {}
    const body = h('div', {class: 'ae-body'});
    const close = h('button', {class: 'ae-x', 'aria-label': 'Закрыть', onclick: () => closePanel()}, '×');
    const root = h('div', {class: 'ae-backdrop', onclick: e => { if (e.target === root) closePanel(); }},
      h('section', {class: 'ae-panel' + (cls ? ' ' + cls : ''), role: 'dialog', 'aria-label': title}, h('header', {class: 'ae-head'}, h('h2', {}, title), close), body));
    document.body.append(root);
    const state = {root, body, timers: [], onClose, rerender: () => { const y = body.scrollTop; body.replaceChildren(); render(body, state); body.scrollTop = y; }};
    openPanelState = state; state.rerender(); sfx.play('whoosh');
    return state;
  }
  function closePanel() {
    const s = openPanelState; if (!s) return;
    s.timers.forEach(clearInterval); s.onClose?.(); s.root.remove(); openPanelState = null;
  }
  addEventListener('keydown', e => { if (e.key === 'Escape') closePanel(); });
  document.addEventListener('click', e => { if (openPanelState && document.querySelector('.ae-battle-backdrop') && e.target.closest?.('nav.game-nav')) closePanel(); }, true);

  // ---------- 1. item merging ----------
  const NON_GEAR = new Set(['material', 'ore', 'potion', 'consumable', 'fish', 'food', 'gem', 'scroll', 'resource', 'bait', 'tool', 'pickaxe', 'key', 'quest']);
  const RARITY_RU = {common: 'обычный', uncommon: 'необычный', rare: 'редкий', epic: 'эпический', legendary: 'легендарный', mythic: 'мифический'};
  const RARITY = {common: 1, uncommon: 1.5, rare: 2, epic: 3, legendary: 4, mythic: 5};
  const MAX_ASC = 5, ASC_STEP = 0.1;
  const isGear = i => i && !NON_GEAR.has(i.type) && i.stats && Object.keys(i.stats).length > 0;
  const ascOf = i => Math.max(0, Math.min(MAX_ASC, Number(i.ascension) || 0));
  const baseName = i => String(i.name || '').replace(/\s★\d$/, '');
  const mergeCost = i => Math.round(150 * (ascOf(i) + 1) * (RARITY[i.rarity] || 1) * Math.max(1, Number(i.level) || 1) ** 0.5);
  const free = i => !i.isEquipped && !i.isLocked && !i.boundToClan;
  const mergeKey = i => [baseName(i).toLocaleLowerCase(), i.rarity, i.type, ascOf(i), i.twoHanded ? '2h' : ''].join('|');
  const rank = i => (Number(i.level) || 0) * 1000 + (Number(i.upgradeLevel) || 0);
  // Worn items never merge — including server-held ones, which carry no isEquipped flag (the slot lives on the hero).
  const wornIds = p => new Set(Object.values(p?.equipped || {}).filter(Boolean).map(e => e.id));
  function mergeGroups(p) {
    const groups = new Map(), worn = wornIds(p);
    for (const i of p.inventory || []) {
      if (!isGear(i) || !free(i) || worn.has(i.id) || i.equippedSlot || i.equipped_slot || ascOf(i) >= MAX_ASC) continue;
      const key = mergeKey(i);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(i);
    }
    return [...groups.values()].map(g => g.sort((x, y) => rank(y) - rank(x))).filter(g => g.reduce((n, i) => n + (i.stackCount || 1), 0) >= 2)
      .sort((a, b) => (RARITY[b[0].rarity] || 0) - (RARITY[a[0].rarity] || 0) || (b[0].level || 0) - (a[0].level || 0));
  }
  const mergeCount = p => p ? mergeGroups(p).length : 0;
  function mergedItem(base, donor) {
    const asc = ascOf(base) + 1, baseStats = base.baseStats || {...base.stats};
    const stats = Object.fromEntries(Object.entries(baseStats).map(([k, v]) => [k, typeof v !== 'number' ? v : Number.isInteger(v) && Math.abs(v) >= 10 ? Math.round(v * (1 + ASC_STEP * asc)) : Math.round(v * (1 + ASC_STEP * asc) * 10) / 10]));
    return {...base, stackCount: 1, ascension: asc, baseStats, stats, name: baseName(base) + ' ★' + asc,
      level: Math.max(Number(base.level) || 1, Number(donor.level) || 1),
      upgradeLevel: Math.max(Number(base.upgradeLevel) || 0, Number(donor.upgradeLevel) || 0), sellPrice: Math.round((Number(base.sellPrice) || 10) * 1.5)};
  }
  // Server-registered items are first released from the server registry, then handled as bag items.
  async function claimFromServer(item) {
    await api('/api/items/' + encodeURIComponent(item.id) + '/dispose', 'POST', {action: 'disassemble'});
    return {...item, id: 'srv_' + item.id, serverOwned: false, marketTradable: undefined, isEquipped: false, slot: undefined};
  }
  // Ids consumed by merges; any stale copy that a late inventory sync brings back is removed.
  const goneKey = () => 'aeth_merge_gone_' + uid();
  const goneIds = () => { try { return new Set(JSON.parse(localStorage.getItem(goneKey()) || '[]')); } catch { return new Set(); } };
  function rememberGone(ids) { const g = goneIds(); ids.forEach(x => g.add(x)); localStorage.setItem(goneKey(), JSON.stringify([...g].slice(-300))); }
  function purgeGone() {
    const b = B(), p = me(); if (!b || !p?.inventory) return;
    const g = goneIds(); if (!g.size || !p.inventory.some(i => g.has(i.id))) return;
    b.setPlayer(cur => cur && {...cur, inventory: cur.inventory.filter(i => !g.has(i.id))});
  }
  setInterval(() => { if (document.hidden) return; try { purgeGone(); } catch {} }, 700);
  let merging = false;
  async function doMerge(groupKeyItemId) {
    const b = B(), p = me(); if (!b || !p) return toast('Игра ещё загружается.');
    if (merging) return;
    if (p.worldJourney || document.documentElement.hasAttribute('data-in-combat')) return toast('Сначала завершите бой или путь.');
    const g = mergeGroups(p).find(x => x.some(i => i.id === groupKeyItemId));
    if (!g) return toast('Нужны два одинаковых предмета в сумке.');
    const base0 = g[0], donor0 = g[1] || g[0], sameStack = donor0.id === base0.id;
    const cost = mergeCost(base0);
    if ((p.silver || 0) < cost) return toast(`Нужно ${fmt(cost)} серебра.`);
    merging = true;
    const release = b.busy ? b.busy() : () => {};
    try {
      const claimed = new Map();
      for (const it of sameStack ? [base0] : [base0, donor0]) if (it.serverOwned) {
        try { claimed.set(it.id, await claimFromServer(it)); }
        catch (e) {
          if (claimed.size) b.setPlayer(cur => cur && {...cur, inventory: [...cur.inventory.filter(i => !claimed.has(i.id)), ...claimed.values()]}); // keep what was already released
          if (/недоступ/i.test(cleanError(e))) throw new Error(`«${baseName(it)}» с сервера сейчас надета или выставлена на рынок — снимите её или верните с рынка.`); throw e; }
      }
      const base = claimed.get(base0.id) || base0, donor = sameStack ? base : (claimed.get(donor0.id) || donor0);
      const result = {...mergedItem(base, donor), id: 'merge_' + uuid4()};
      const consumed = sameStack ? [base0.id, base.id] : [base0.id, base.id, donor0.id, donor.id];
      let applied = false;
      b.setPlayer(cur => {
        if (!cur || String(cur.userId) !== String(p.userId) || (cur.silver || 0) < cost) return cur;
        let inv;
        if (sameStack) {
          if (claimed.has(base0.id)) {
            const n = (base0.stackCount || 1) - 2; inv = cur.inventory.filter(i => i.id !== base0.id);
            if (n > 0) inv.push({...base, id: base.id, stackCount: n});
          } else {
            const src = cur.inventory.find(i => i.id === base0.id); if (!src || (src.stackCount || 1) < 2) return cur;
            inv = cur.inventory.map(i => i.id === base0.id ? {...i, stackCount: (i.stackCount || 1) - 2} : i).filter(i => (i.stackCount || 1) > 0);
          }
        } else {
          const has = id => cur.inventory.some(i => i.id === id);
          for (const it of [base0, donor0]) if (!claimed.has(it.id) && !has(it.id)) return cur;
          inv = cur.inventory.filter(i => i.id !== base0.id && i.id !== donor0.id);
        }
        applied = true;
        return {...cur, silver: cur.silver - cost, inventory: [...inv, result]};
      });
      await new Promise(r => setTimeout(r, 300));
      const now = me();
      if (now?.inventory?.some(i => i.id === result.id)) {
        rememberGone(sameStack ? [...claimed.keys()] : consumed);
        b.sound?.playUpgradeSuccess?.(); toast(`Готово: ${result.name}`);
      } else {
        // Never lose items released from the server: put them back into the bag as regular items.
        if (claimed.size) b.setPlayer(cur => cur && {...cur, inventory: [...cur.inventory.filter(i => !claimed.has(i.id) && ![...claimed.values()].some(c => c.id === i.id)), ...claimed.values()]});
        toast('Не удалось объединить: сумка изменилась. Попробуйте ещё раз.'); sfx.play('fail');
      }
    } catch (e) { toast(cleanError(e)); sfx.play('fail'); }
    finally { release(); merging = false; setTimeout(() => openPanelState?.rerender(), 200); }
  }
  function statLine(stats) {
    const names = {attack: 'Атака', magicAttack: 'Маг. атака', defense: 'Защита', magicDefense: 'Маг. защита', maxHp: 'HP', maxMp: 'MP', critChance: 'Крит %', speed: 'Скорость', dodge: 'Уклонение', armorPenetration: 'Пробитие'};
    return Object.entries(stats || {}).filter(([, v]) => typeof v === 'number' && v).slice(0, 4).map(([k, v]) => `${names[k] || k} ${Math.round(v * 10) / 10}`).join(' · ');
  }
  function openMerge() {
    openPanel('⚒️ Объединение предметов', body => {
      const p = me();
      body.append(h('p', {class: 'ae-note'}, 'Два одинаковых предмета (одно название, редкость и ранг ★) сливаются в один с рангом вознесения на 1 выше. Каждая ★ даёт +10% к характеристикам, остаются лучший уровень и лучшая заточка из двух. Максимум ★5. Надетые, запертые и клановые вещи не участвуют. Серверные вещи (с рынка и наград) переносятся в сумку и после объединения не выставляются на рынок игрокам.'));
      if (!p) return body.append(h('p', {}, 'Загрузка…'));
      body.append(h('p', {class: 'ae-pill'}, `Серебро: ${fmt(p.silver)}`));
      const groups = mergeGroups(p);
      if (!groups.length) return body.append(h('p', {class: 'ae-empty'}, 'Пока нет пар одинаковых предметов. Добывайте одинаковую экипировку в боях и подземельях.'));
      for (const g of groups) {
        const top = g[0], next = mergedItem(top, g[1] || top), cost = mergeCost(top);
        const count = g.reduce((n, i) => n + (i.stackCount || 1), 0);
        body.append(h('div', {class: 'ae-card'},
          h('div', {class: 'ae-row'}, h('span', {class: 'ae-icon'}, top.icon || '⚔️'), h('div', {class: 'ae-grow'},
            h('b', {}, top.name), h('div', {class: 'ae-sub'}, `${RARITY_RU[top.rarity] || top.rarity || ''} · ур. ${top.level || 1} · +${top.upgradeLevel || 0} · в сумке: ${count}${g.some(i => i.serverOwned) ? ' · есть серверные' : ''}`),
            h('div', {class: 'ae-sub'}, 'Сейчас: ' + statLine(top.stats)), h('div', {class: 'ae-sub ae-good'}, `После ★${next.ascension}: ` + statLine(next.stats)))),
          h('button', {class: 'ae-btn ae-primary', disabled: (p.silver || 0) < cost, onclick: () => doMerge(top.id)}, `Объединить · ${fmt(cost)} 🥈`)));
      }
    });
  }

  // ---------- 6. friends & private messages ----------
  function openFriends(tab = 'friends') {
    let data = {friends: [], incoming: [], outgoing: []}, results = [], contacts = [], query = '', loading = true;
    const load = async () => {
      try { [data, contacts] = await Promise.all([api('/api/friends'), api('/api/chat/private/contacts').then(r => r.players || [])]); } catch (e) { toast(cleanError(e)); }
      loading = false; panel.rerender();
    };
    const act = async (path, targetId, msg) => { try { await api(path, 'POST', {targetId}); toast(msg); sfx.play('bell'); await load(); } catch (e) { toast(cleanError(e)); } };
    const row = (f, ...buttons) => h('div', {class: 'ae-row ae-card'}, h('span', {class: 'ae-dot' + (f.online ? ' is-on' : '')}),
      h('div', {class: 'ae-grow'}, h('b', {}, f.name), h('div', {class: 'ae-sub'}, `ур. ${f.level}${f.online ? ' · в сети' : ''}`)), ...buttons);
    const panel = openPanel('👥 Друзья и личные сообщения', body => {
      const tabs = [['friends', `Друзья (${data.friends.length})`], ['requests', `Заявки${data.incoming.length ? ' · ' + data.incoming.length : ''}`], ['messages', 'Сообщения'], ['trades', 'Сделки'], ['search', 'Найти']];
      body.append(h('div', {class: 'ae-tabs'}, tabs.map(([id, label]) => h('button', {class: 'ae-tab' + (tab === id ? ' is-on' : ''), onclick: () => { tab = id; panel.rerender(); }}, label))));
      if (loading) return body.append(h('p', {class: 'ae-empty'}, 'Загрузка…'));
      if (tab === 'trades') { const box = h('div', {class: 'ae-body-inner'}); body.append(box); tradesTab(box); return; }
      if (tab === 'friends') {
        if (!data.friends.length) body.append(h('p', {class: 'ae-empty'}, 'Друзей пока нет. Найдите игрока во вкладке «Найти».'));
        for (const f of data.friends) body.append(row(f, h('button', {class: 'ae-btn ae-primary', onclick: () => openChat(f)}, '💬'),
          h('button', {class: 'ae-btn', 'aria-label': 'Удалить из друзей', onclick: () => confirm(`Удалить ${f.name} из друзей?`) && act('/api/friends/remove', f.id, 'Удалён из друзей')}, '✕')));
      }
      if (tab === 'requests') {
        if (!data.incoming.length && !data.outgoing.length) body.append(h('p', {class: 'ae-empty'}, 'Заявок нет.'));
        for (const f of data.incoming) body.append(row(f, h('button', {class: 'ae-btn ae-primary', onclick: () => act('/api/friends/accept', f.id, 'Теперь вы друзья!')}, 'Принять'),
          h('button', {class: 'ae-btn', onclick: () => act('/api/friends/decline', f.id, 'Заявка отклонена')}, 'Нет')));
        if (data.outgoing.length) body.append(h('h3', {class: 'ae-h3'}, 'Отправленные'));
        for (const f of data.outgoing) body.append(row(f, h('button', {class: 'ae-btn', onclick: () => act('/api/friends/remove', f.id, 'Заявка отменена')}, 'Отменить')));
      }
      if (tab === 'messages') {
        const list = contacts.filter(c => c.lastAt);
        if (!list.length) body.append(h('p', {class: 'ae-empty'}, 'Переписок пока нет. Напишите другу из вкладки «Друзья».'));
        for (const c of list) body.append(h('button', {class: 'ae-row ae-card ae-click', onclick: () => openChat(c)},
          h('div', {class: 'ae-grow'}, h('b', {}, c.name), h('div', {class: 'ae-sub'}, (c.lastText || '').slice(0, 60))), c.unread ? h('span', {class: 'ae-badge'}, c.unread) : null));
      }
      if (tab === 'search') {
        const input = h('input', {class: 'ae-input', placeholder: 'Имя героя, @username или ID', value: query, maxlength: 40});
        const run = async () => { query = input.value.trim(); if (query.length < 2) return toast('Минимум 2 символа.'); try { results = (await api('/api/friends/search?q=' + encodeURIComponent(query))).players || []; } catch (e) { toast(cleanError(e)); } panel.rerender(); };
        input.addEventListener('keydown', e => e.key === 'Enter' && run());
        body.append(h('div', {class: 'ae-row'}, input, h('button', {class: 'ae-btn ae-primary', onclick: run}, 'Найти')));
        if (query && !results.length) body.append(h('p', {class: 'ae-empty'}, 'Никого не нашли.'));
        for (const f of results) body.append(row(f,
          f.relation === 'accepted' ? h('button', {class: 'ae-btn', onclick: () => openChat(f)}, '💬') :
          f.relation === 'pending' ? h('span', {class: 'ae-sub'}, 'заявка отправлена') :
          h('button', {class: 'ae-btn ae-primary', onclick: () => act('/api/friends/request', f.id, 'Заявка отправлена')}, '+ В друзья')));
        setTimeout(() => input.focus(), 50);
      }
    });
    load();
  }
  function openChat(peer) {
    let messages = [], text = '';
    const load = async () => { try { messages = (await api('/api/chat/private/' + encodeURIComponent(peer.id))).messages || []; } catch (e) { toast(cleanError(e)); } paint(); };
    let list, input;
    const paint = () => {
      if (!list) return;
      list.replaceChildren(...(messages.length ? messages.map(m => h('div', {class: 'ae-msg' + (String(m.sender_id) === uid() ? ' is-mine' : '')}, m.text,
        h('time', {}, new Date(m.created_at).toLocaleTimeString('ru-RU', {hour: '2-digit', minute: '2-digit'})))) : [h('p', {class: 'ae-empty'}, 'Напишите первое сообщение.')]));
      list.scrollTop = list.scrollHeight;
    };
    const send = async () => {
      text = input.value.trim(); if (!text) return;
      input.value = ''; try { await api('/api/chat/private/' + encodeURIComponent(peer.id), 'POST', {text, clientMessageId: uuid4()}); sfx.play('page'); await load(); } catch (e) { input.value = text; toast(cleanError(e)); }
    };
    const st = openPanel('💬 ' + peer.name, body => {
      list = h('div', {class: 'ae-chat'});
      input = h('input', {class: 'ae-input', placeholder: 'Сообщение…', maxlength: 500});
      input.addEventListener('keydown', e => e.key === 'Enter' && send());
      body.append(h('button', {class: 'ae-link', onclick: () => openFriends('friends')}, '← К друзьям'), list, h('div', {class: 'ae-row ae-compose'}, input, h('button', {class: 'ae-btn ae-primary', onclick: send}, '➤')));
      paint();
    });
    st.timers.push(setInterval(load, 4000)); load();
  }

  // ---------- 7. co-op dungeons ----------
  const CLASS_RU = {warrior: 'Воин', knight: 'Рыцарь', paladin: 'Паладин', berserker: 'Берсерк', rogue: 'Разбойник', assassin: 'Ассасин', hunter: 'Лучник', mage: 'Маг', necromancer: 'Некромант', druid: 'Друид'};
  const COOP_CD = {attack: 900, power: 4500, heal: 4000, guard: 6000};
  const COOP_SCENES = {goblin_cave: '/assets/cave-bat-BMyMeMjZ.webp', spider_den: '/assets/spider-DP3tZJJe.webp', crypt_depths: '/assets/catacombs-DeUOVUij.webp', rift_gate: '/assets/cave-rift-87tvC-MB.webp'};
  const COOP_FOE_SPRITE = {'Гоблин-разведчик': 'm_goblin', 'Гоблин-лучник': 'v_ww_raider', 'Гоблин-шаман': 'v_ww_shaman', 'Гоблин-громила': 'm_bandit', 'Вожак гоблинов': 'm_goblin', 'Король гоблинов Гракх': 'v_ww_shaman',
    'Паук-ткач': 'v_ww_spider', 'Ядовитый паук': 'm_spider', 'Кокон-ловушка': 'v_cr_spider', 'Паук-страж': 'm_spider', 'Матка-ткачиха': 'v_sw_queen', 'Паучья королева Ирхаса': 'm_spider_queen',
    'Скелет-воин': 'm_cursed_soldier', 'Костяной маг': 'bm_cultist', 'Упырь': 'bm_ghoul', 'Рыцарь праха': 'm_death_knight_boss', 'Страж гробниц': 'v_cr_colossus', 'Лич Морвен': 'v_cu_lord',
    'Бес пламени': 'm_ash_imp', 'Адская гончая': 'bm_hound', 'Демон-палач': 'v_de_knight', 'Страж разлома': 'm_sand_guard', 'Пожиратель душ': 'bm_bat_swarm', 'Владыка разлома Азгор': 'm_demon_lord'};
  const coopFoeImg = name => `/assets/sprites/generated/monsters/${COOP_FOE_SPRITE[name] || 'm_bandit'}.webp`;
  function bigBanner(text, triple) {
    const el = h('div', {class: 'ae-combo-banner' + (triple ? ' is-triple' : '')}, text.replace(/\s*\(.*?\)/, ''));
    document.body.append(el); setTimeout(() => el.classList.add('is-on'), 10); setTimeout(() => el.remove(), 2200);
  }
  const COOP_ACTS = [['attack', '⚔️ Атака', 'быстрый удар'], ['power', '💥 Мощный удар', '×2.2 урона'], ['heal', '💚 Лечение', 'самому раненому'], ['guard', '🛡️ Прикрыть', '−60% урона, враг бьёт вас']];
  function openCoop() {
    let state = null, friends = [], busy = false, cdEnd = {}, foeAt = 0, guardEnd = 0, chainEnd = 0, spellCd = 12000, skillsOpen = false;
    let prevFoe = null, prevHp = {}, seenLog = null, shakeUntil = 0; const hitUntil = {}, floats = [];
    // Turn server state changes into feedback: damage numbers, shakes, flashes, combo banners, party signals.
    const feel = room => {
      if (!room) { prevFoe = null; return; }
      const t = Date.now(), f = room.foe;
      if (f && prevFoe && prevFoe.name === f.name && f.hp < prevFoe.hp) { floats.push({sel: '[data-bv-foe], .ae-foe', text: '−' + fmt(prevFoe.hp - f.hp), cls: 'is-dmg'}); shakeUntil = t + 380; }
      prevFoe = f ? {name: f.name, hp: f.hp} : null;
      for (const m of room.members || []) {
        const was = prevHp[m.id];
        if (was != null && m.hp < was) { hitUntil[m.id] = t + 600; floats.push({sel: String(m.id) === uid() ? '[data-bv-hero], [data-ae-member="' + m.id + '"]' : `[data-ae-member="${m.id}"]`, text: '−' + fmt(was - m.hp), cls: 'is-hurt'}); if (String(m.id) === uid()) { sfx.play('hit', 0.45); try { Telegram.WebApp.HapticFeedback.impactOccurred('medium'); } catch {} } }
        if (was != null && m.hp > was) floats.push({sel: String(m.id) === uid() ? '[data-bv-hero], [data-ae-member="' + m.id + '"]' : `[data-ae-member="${m.id}"]`, text: '+' + fmt(m.hp - was), cls: 'is-heal'});
        prevHp[m.id] = m.hp;
      }
      const keys = (room.log || []).map(l => l.at + l.text);
      if (!seenLog) { seenLog = new Set(keys); return; }
      const myName = room.members?.find(m => String(m.id) === uid())?.name;
      for (const l of room.log || []) {
        const k = l.at + l.text; if (seenLog.has(k)) continue; seenLog.add(k);
        if (/СВЯЗКА/.test(l.text)) { bigBanner(l.text, /ТРОЙНАЯ/.test(l.text)); sfx.play('magic', 0.5); try { Telegram.WebApp.HapticFeedback.notificationOccurred('success'); } catch {} }
        else if (/^📣/.test(l.text) && !(myName && l.text.startsWith('📣 ' + myName + ':'))) { popup({icon: '📣', text: l.text.replace(/^📣\s*/, '')}); }
        else if (/^(🌀|💢)/.test(l.text)) sfx.play('heavy', 0.4);
      }
    };
    const showFloats = () => {
      while (floats.length) {
        const f = floats.shift(), el = st.body.querySelector(f.sel); if (!el) continue;
        const r = el.getBoundingClientRect(), n = h('div', {class: 'ae-float ' + f.cls, style: `left:${r.left + r.width * (0.35 + Math.random() * 0.3)}px;top:${r.top + 18}px`}, f.text);
        document.body.append(n); setTimeout(() => n.remove(), 1100);
      }
    };
    let lastKey = '';
    const volatile = new Set([]);
    const refresh = () => {
      const key = JSON.stringify(state, (k, v) => volatile.has(k) ? (typeof v === 'number' ? v > 0 : v ? 1 : 0) : v);
      if (key === lastKey && !floats.length) return paintCd();
      lastKey = key; st.rerender();
    };
    const absorb = room => {
      feel(room);
      const t = Date.now(), mine = room?.members?.find(m => String(m.id) === uid());
      cdEnd = {}; foeAt = 0; chainEnd = 0; guardEnd = 0; void t; void mine;
    };
    const load = async () => {
      try { state = await api('/api/coop/rooms'); absorb(state?.mine); } catch (e) { toast(cleanError(e)); }
      if (!openPanelState || openPanelState !== st) return; refresh();
    };
    const post = async (path, body, okMsg) => {
      const fast = path === '/api/coop/act' || path === '/api/coop/ping';
      if (busy && !fast) return; if (!fast) busy = true;
      try { const r = await api(path, 'POST', body); if (okMsg) toast(okMsg); if (r?.room !== undefined) { state = {...state, mine: r.room}; absorb(r.room); } return r; }
      catch (e) { if (!/восстанавливается|часто/.test(cleanError(e))) toast(cleanError(e)); if (!fast) sfx.play('fail'); } finally { if (!fast) busy = false; refresh(); }
    };
    const claim = async () => {
      const r = await post('/api/coop/claim', {}); const rw = r?.reward; if (!rw) return;
      if (r.alreadyClaimed) return toast('Награда уже получена.');
      const b = B();
      b.setPlayer(p => {
        if (!p) return p;
        let next = {...p, gold: (p.gold || 0) + rw.gold, silver: (p.silver || 0) + rw.silver};
        if (rw.fragment) {
          const inv = next.inventory.slice(), i = inv.findIndex(x => x.templateId === 'ascension_fragment' && !x.serverOwned && !x.isLocked);
          if (i >= 0) inv[i] = {...inv[i], stackCount: (inv[i].stackCount || 1) + 1};
          else inv.push({id: 'coop_' + uuid4(), templateId: 'ascension_fragment', name: 'Осколок вознесения', type: 'material', rarity: 'rare', level: 1, upgradeLevel: 0, icon: '✦', stats: {}, sellPrice: 0, disassembleYield: {}, stackCount: 1});
          next = {...next, inventory: inv};
        }
        return b.gainExp ? b.gainExp(next, rw.exp).player : {...next, exp: (next.exp || 0) + rw.exp};
      });
      b.sound?.playVictory?.();
      toast(`Награда: +${fmt(rw.gold)} 🪙 +${fmt(rw.silver)} 🥈 +${fmt(rw.exp)} опыта${rw.fragment ? ' + Осколок вознесения' : ''}`);
      state.mine = null; load();
      const sk = 'aeth_coop_story_' + uid();
      if (!localStorage.getItem(sk)) { localStorage.setItem(sk, '1'); setTimeout(() => { closePanel(); showStory('/assets/story/coop-first-victory.webp', 'Первая победа отряда', 'Плечом к плечу',
        'Последний враг пал, и в глубине подземелья вспыхнули древние руны. Вы вошли сюда чужими людьми, а выходите — отрядом. Король уже слышал о вашем подвиге: впереди подземелья опаснее, а их сокровища — богаче. Зовите друзей и возвращайтесь.', 'Вперёд, к новым походам'); }, 900); }
      refreshQuestBadge();
    };
    const bar = (cur, max, cls) => h('div', {class: 'ae-bar ' + (cls || '')}, h('i', {style: `width:${Math.max(0, Math.min(100, 100 * cur / Math.max(1, max)))}%`}), h('span', {}, `${fmt(cur)} / ${fmt(max)}`));
    const st = openPanel('🤝 Кооп-подземелья', body => {
      if (!state) return body.append(h('p', {class: 'ae-empty'}, 'Загрузка…'));
      const room = state.mine, lvl = me()?.level || 1;
      if (!room) {
        body.append(h('p', {class: 'ae-note'}, 'Соберите отряд до 3 героев. Лидер ведёт отряд через 7 залов: на развилках он выбирает путь — можно нарваться на элиту, сорваться с карниза или найти сокровище и святилище. В конце — босс. Сила героев считается по уровню и классу. Лекари (друид, паладин) лечат сильнее. Награда — золото, серебро, опыт и шанс на Осколок вознесения.'));
        body.append(h('h3', {class: 'ae-h3'}, 'Открыть комнату'));
        for (const d of state.dungeons) body.append(h('div', {class: 'ae-row ae-card'}, h('img', {class: 'ae-dthumb', src: dIcon(COOP_ICONS[d.id] || 'goblin_cave'), alt: ''}), h('div', {class: 'ae-grow'}, h('b', {}, d.name), h('div', {class: 'ae-sub'}, `ур. ${d.minLevel}–${d.maxLevel}`)),
          h('button', {class: 'ae-btn ae-primary', disabled: lvl < d.minLevel, onclick: () => post('/api/coop/create', {dungeonId: d.id}, 'Комната открыта. Позовите друзей!')}, lvl < d.minLevel ? `с ${d.minLevel} ур.` : 'Открыть')));
        body.append(h('h3', {class: 'ae-h3'}, 'Открытые комнаты'));
        if (!state.open.length) body.append(h('p', {class: 'ae-empty'}, 'Сейчас никто не ищет союзников.'));
        for (const r of state.open) body.append(h('div', {class: 'ae-row ae-card'}, h('img', {class: 'ae-dthumb', src: dIcon(COOP_ICONS[r.dungeon.id] || 'goblin_cave'), alt: ''}), h('div', {class: 'ae-grow'}, h('b', {}, r.dungeon.name),
          h('div', {class: 'ae-sub'}, r.members.map(m => `${m.name} (${m.level})`).join(', ') + ` · ${r.members.length}/3`)),
          h('button', {class: 'ae-btn ae-primary', disabled: !r.fits, onclick: () => post('/api/coop/join', {roomId: r.id}, 'Вы в отряде!')}, r.fits ? 'Войти' : `с ${r.dungeon.minLevel} ур.`)));
        return;
      }
      const meFight = room.members.find(m => String(m.id) === uid());
      battleMode(body, room.status === 'active' && room.phase === 'fight' && room.foe && meFight);
      if (room.status === 'active' && room.phase === 'fight' && room.foe && meFight) {
        // Same screen as the cave fight: every hero acts once per round, then the enemy. Skills for mana, cross-hero combos.
        const f = room.foe, dead = !meFight.hp, mp = meFight.mp ?? 0, acted = !!meFight.acted, waiting = room.waiting || [];
        const onMe = f.intent !== 'aoe' && f.intentText?.includes(meFight.name), kit = heroKit(), comboIds = room.combos || [];
        const chips = [];
        if (f.stunned) chips.push('💫 враг оглушён'); if (f.vuln) chips.push('🎯 враг уязвим'); for (const d0 of f.dots || []) chips.push(`${d0.icon} ${d0.name} · ${d0.left}`);
        if (meFight.barrier) chips.push(`🛡️ ваш щит ${fmt(meFight.barrier)}`); if (meFight.fury) chips.push('📯 ярость +30%');
        const turnText = dead ? 'Вы без сил — союзник может поднять вас зельем' : !acted ? 'Ваш ход — выберите действие' : waiting.length ? `Ждём хода: ${waiting.map(w => w.name).join(', ')}` : 'Ход врага…';
        const act = (action, extra) => () => { if (dead || acted) return; sfx.play(action === 'guard' ? 'shield' : action === 'potion' ? 'potion' : action === 'skill' ? 'magic' : 'hit'); post('/api/coop/act', {action, ...(extra || {})}); };
        const party = h('div', {class: 'ae-bv-party'},
          room.setup && String(room.setup.byId) !== uid() && room.setup.combo ? h('div', {class: 'ae-chain' + (comboIds.length ? ' is-ready' : '')}, h('b', {}, `⚡ ${room.setup.by}: ${room.setup.icon} «${room.setup.skill}»`),
            h('div', {}, comboIds.length ? `Ваш атакующий навык сейчас даст связку «${room.setup.combo}»!` : `Готова связка «${room.setup.combo}» — нужен атакующий навык.`)) : '',
          room.setup && String(room.setup.byId) === uid() && room.setup.combo ? h('div', {class: 'ae-chain'}, h('b', {}, `⚡ Вы подготовили связку «${room.setup.combo}»`), h('div', {}, 'Союзник может завершить её своим атакующим навыком.')) : '',
          chips.length ? h('div', {class: 'ae-chips'}, chips.map(c => h('span', {class: 'ae-chip'}, c))) : '',
          h('div', {class: 'ae-bv-members'}, room.members.filter(m => String(m.id) !== uid()).map(m => h('div', {class: 'ae-bv-member' + ((hitUntil[m.id] || 0) > Date.now() ? ' ae-hit' : ''), 'data-ae-member': String(m.id)},
            h('img', {class: 'ae-avatar', src: heroPortrait(m.classId), alt: ''}), h('div', {class: 'ae-grow'}, h('b', {}, `${m.name}${String(m.id) === String(room.hostId) ? ' ⭐' : ''}`), bar(m.hp, m.maxHp, m.hp ? '' : 'is-down'),
              h('small', {}, `${m.hp ? (m.acted ? '✅ походил(а)' : '⏳ выбирает ход') : '💀 без сил'} · мана ${fmt(m.mp)}/${fmt(m.maxMp)}`)),
            !m.hp && (meFight.potions || 0) > 0 && !acted ? h('button', {class: 'ae-btn', type: 'button', onclick: act('potion', {targetId: m.id})}, '🧪 Поднять') : ''))),
          acted && waiting.length ? h('button', {class: 'ae-btn ae-wide', type: 'button', onclick: () => confirm(`Не ждать ${waiting.map(w => w.name).join(', ')}? Их ход будет пропущен.`) && post('/api/coop/act', {action: 'hurry'})}, `⏩ Не ждать (${waiting.map(w => w.name).join(', ')})`) : '',
          h('div', {class: 'ae-pings'}, [['help', '🆘 Помощь'], ['guard', '🛡️ Прикрой'], ['combo', '⚡ Связка'], ['focus', '🎯 В атаку'], ['ok', '👍 Ок']].map(([k, t]) => h('button', {type: 'button', class: 'ae-ping', onclick: () => { sfx.play('bell', 0.25); post('/api/coop/ping', {kind: k}); }}, t))));
        const menu = skillsOpen ? skillMenu({mp, disabled: dead || acted, combos: comboIds.map(c => c.id), onClose: () => { skillsOpen = false; st.rerender(); }, onUse: k => { skillsOpen = false; act('skill', {skillId: k.id})(); }}) : null;
        body.append(battleView({
          location: room.dungeon.name, mode: `Зал ${room.stage}/${room.rooms}`, round: `Раунд ${room.round || 1}`,
          scene: COOP_SCENES[room.dungeon.id] || '/assets/catacombs-DeUOVUij.webp', turn: turnText, turnShort: acted ? 'Ожидание' : 'Ваш ход',
          hero: {name: meFight.name, cls: CLASS_RU2[meFight.classId] || meFight.classId, level: meFight.level, hp: meFight.hp, maxHp: meFight.maxHp, mp, maxMp: meFight.maxMp || 100, mpLabel: 'MANA', portrait: heroPortrait(meFight.classId), body: heroBody(meFight.classId)},
          foe: {name: f.name, level: f.boss ? 'Босс' : f.elite ? 'Элита' : 'Враг', hp: f.hp, maxHp: f.maxHp, atk: f.atk, def: f.def, img: coopFoeImg(f.name)},
          note: (room.log || []).at(-1)?.text || room.scene || f.desc,
          intent: f.intentText ? {label: 'Враг после хода отряда:', name: `${f.intentText}${onMe ? ' — это вы!' : ''}`, text: f.intent === 'aoe' ? '💡 Удар по всем: подлечитесь заранее.' : onMe || f.intent === 'heavy' ? '💡 «Защита» снизит урон вдвое и вернёт ману.' : (f.desc || '')} : null,
          series: {label: 'Отряд', value: `Зал ${room.stage} / ${room.rooms}`, sub: room.bonus ? `💰 Бонус награды +${Math.round(room.bonus * 100)}%` : ''},
          actions: [{kind: 'attack', label: 'Атака', disabled: dead || acted, onClick: act('attack')},
            {kind: 'skill', label: 'Навыки', disabled: dead || acted, attr: {'aria-expanded': String(skillsOpen), 'aria-controls': 'combat-skills'}, onClick: () => { skillsOpen = !skillsOpen; st.rerender(); }},
            {kind: 'defend', label: 'Защита (+25% MP)', disabled: dead || acted, onClick: act('guard')},
            {kind: 'potion', label: `Зелье (${meFight.potions ?? 0})`, disabled: dead || acted || !(meFight.potions > 0), onClick: act('potion')}],
          secondary: [{label: 'Покинуть поход', kind: 'leave', onClick: () => confirm('Покинуть отряд?') && post('/api/coop/leave', {}, 'Вы покинули отряд').then(load)}],
          log: room.log.map(l => l.text), menu, extra: party}));
        if (shakeUntil > Date.now()) body.querySelector('[data-bv-foe]')?.classList.add('ae-shake');
        if ((hitUntil[meFight.id] || 0) > Date.now()) body.querySelector('[data-bv-hero]')?.classList.add('ae-shake');
        return;
      }
      body.append(h('div', {class: 'ae-card ae-row'}, h('img', {class: 'ae-dthumb', src: dIcon(COOP_ICONS[room.dungeon.id] || 'goblin_cave'), alt: ''}), h('div', {class: 'ae-grow'}, h('b', {}, room.dungeon.name), h('div', {class: 'ae-sub'},
        room.status === 'lobby' ? 'Сбор отряда' : room.status === 'active' ? `Зал ${room.stage} из ${room.rooms}${room.phase === 'choose' ? ' · развилка' : ''}` : room.status === 'won' ? 'Подземелье пройдено!' : 'Отряд пал'))));
      if (room.status === 'active') body.append(h('div', {class: 'ae-stages'}, Array.from({length: room.rooms}, (_, i) => h('i', {class: (i + 1 < room.stage || (room.phase === 'choose' && i + 1 === room.stage)) ? 'is-done' : i + 1 === room.stage ? 'is-now' : '', title: 'Зал ' + (i + 1)}, i + 1 === room.rooms ? '👑' : String(i + 1)))), room.bonus ? h('div', {class: 'ae-pill'}, `💰 Бонус награды +${Math.round(room.bonus * 100)}%`) : '');
      if (room.status === 'active' && room.scene) body.append(h('div', {class: 'ae-scene'}, h('small', {}, `📍 Зал ${room.stage} из ${room.rooms}`), room.scene));
      if (room.foe && room.status === 'active' && room.phase === 'fight') {
        const f = room.foe, me0 = room.members.find(m => String(m.id) === uid());
        const onMe = f.intent !== 'aoe' && me0 && f.intentText && f.intentText.includes(me0.name);
        body.append(h('div', {class: 'ae-card ae-foe' + (f.boss ? ' is-boss' : f.elite ? ' is-elite' : '') + (shakeUntil > Date.now() ? ' ae-shake' : '')},
          h('div', {class: 'ae-row'}, h('b', {class: 'ae-grow'}, (f.boss ? '👑 ' : f.elite ? '⚠️ ' : '👹 ') + f.name), h('span', {class: 'ae-foe-tag'}, f.boss ? 'Босс' : f.elite ? 'Элита' : 'Враг')),
          f.desc ? h('div', {class: 'ae-foe-desc'}, f.desc) : '',
          bar(f.hp, f.maxHp, 'is-foe'),
          h('div', {class: 'ae-sub'}, `⚔️ Атака ${fmt(f.atk)} · 🛡️ Защита ${fmt(f.def)}`),
          f.intentText ? h('div', {class: 'ae-intent is-' + (f.intent || 'strike') + (onMe ? ' is-me' : '')},
            h('span', {class: 'ae-intent-i'}, f.intent === 'aoe' ? '🌀' : f.intent === 'heavy' ? '💢' : '🗡️'),
            h('span', {class: 'ae-grow'}, h('small', {'data-ae-foe-timer': '1'}, 'Следующий ход'), `${f.name} ${f.intentText}${onMe ? ' — это вы!' : ''}`)) : '',
          f.intent === 'aoe' || f.intent === 'heavy' || onMe ? h('div', {class: 'ae-tip'}, f.intent === 'aoe' ? '💡 Удар по всем: подлечите раненых заранее или поставьте «Стену щитов».' : '💡 Нажмите «Прикрыть» — щит примет удар на себя и снизит урон на 60%.') : ''));
        const fx = room.fx || {}, chips = [];
        if (fx.warcry) chips.push('📯 Боевой клич: +25% урона');
        if (fx.wall) chips.push('🧱 Стена щитов: −40% урона по отряду');
        if (fx.mark) chips.push('🎯 Метка: враг получает +30% урона');
        for (const d0 of fx.dots || []) chips.push(`${d0.icon} ${d0.name} · ${d0.left} хода`);
        if (chips.length) body.append(h('div', {class: 'ae-chips'}, chips.map(c => h('span', {class: 'ae-chip'}, c))));
        if (room.chain) body.append(room.chain.preview
          ? h('div', {class: 'ae-chain is-ready'}, h('b', {}, `⚡ ${room.chain.by} открыл(а) связку!`), h('div', {}, `Ваша способность сейчас даст ${room.chain.next === 'triple' ? 'ТРОЙНУЮ связку' : 'связку'} ${room.chain.preview.icon} «${room.chain.preview.name}»`), h('small', {'data-ae-chain-timer': '1'}, ''))
          : h('div', {class: 'ae-chain'}, h('b', {}, '⚡ Связка открыта'), h('div', {}, 'Союзник должен применить свою способность, пока не истекло время.'), h('small', {'data-ae-chain-timer': '1'}, '')));
      }
      if (room.status === 'active' && room.phase === 'choose') {
        body.append(h('h3', {class: 'ae-h3'}, 'Куда ведём отряд? Выбрать может любой'));
        for (const o of room.options) body.append(h('div', {class: 'ae-card ae-path' + (room.myVote === o.id ? ' is-voted' : '')}, h('div', {class: 'ae-row'}, h('span', {class: 'ae-entry-icon'}, o.icon), h('div', {class: 'ae-grow'}, h('b', {}, o.name), h('div', {class: 'ae-sub'}, o.hint)), o.votes ? h('span', {class: 'ae-badge'}, '🗳 ' + o.votes) : ''),
          true ? h('button', {class: 'ae-btn ae-primary ae-wide', type: 'button', onclick: () => { sfx.play('page'); post('/api/coop/choose', {optionId: o.id}); }}, 'Вести отряд сюда') : h('button', {class: 'ae-btn ae-wide', type: 'button', onclick: () => post('/api/coop/vote', {optionId: o.id}, 'Голос отдан')}, room.myVote === o.id ? 'Ваш голос ✓' : 'Предложить этот путь')));
      }
      for (const m of room.members) body.append(h('div', {class: 'ae-card ae-member' + ((hitUntil[m.id] || 0) > Date.now() ? ' ae-hit' : ''), 'data-ae-member': String(m.id)}, h('div', {class: 'ae-row'}, h('b', {class: 'ae-grow'}, `${m.name}${String(m.id) === uid() ? ' (вы)' : ''}${String(m.id) === String(room.hostId) ? ' ⭐' : ''}`),
        h('span', {class: 'ae-sub'}, `${CLASS_RU[m.classId] || m.classId} · ${m.level} ур.${m.guardUntil > 0 ? ' · 🛡️ щит' : ''}`)), bar(m.hp, m.maxHp, m.hp ? '' : 'is-down'),
        m.atk ? h('div', {class: 'ae-sub'}, `⚔️ ${fmt(m.atk)} · 🛡️ ${fmt(m.def)}${m.healer ? ' · 💚 лекарь' : ''}${m.spell ? ` · ${m.spell.icon} ${m.spell.name}` : ''}${m.hp ? '' : ' · без сил'}`) : ''));
      const mine = room.members.find(m => String(m.id) === uid());
      if (room.status === 'lobby') {
        if (room.isHost) body.append(h('button', {class: 'ae-btn ae-primary ae-wide', disabled: room.members.length < 2, onclick: () => post('/api/coop/start', {}, 'В бой!')}, room.members.length < 2 ? 'Ждём хотя бы одного союзника…' : '⚔️ Начать поход'));
        else body.append(h('p', {class: 'ae-note'}, 'Ждём, когда лидер начнёт поход.'));
        body.append(h('button', {class: 'ae-btn ae-wide ae-coop-share', type: 'button', onclick: () => shareCoop(room)}, '📢 Позвать в общий чат'));
        body.append(h('h3', {class: 'ae-h3'}, 'Позвать друзей'));
        if (!friends.length) body.append(h('p', {class: 'ae-sub'}, 'Добавьте друзей в разделе «Друзья», чтобы звать их одним нажатием.'));
        for (const f of friends) body.append(h('div', {class: 'ae-row ae-card'}, h('span', {class: 'ae-dot' + (f.online ? ' is-on' : '')}), h('b', {class: 'ae-grow'}, `${f.name} (${f.level})`),
          h('button', {class: 'ae-btn', onclick: () => post('/api/coop/invite', {friendId: f.id}, 'Приглашение отправлено в Telegram')}, 'Позвать')));
      }
      if (room.status === 'active' && room.phase === 'fight' && mine) {
        const dead = !mine.hp;
        const actBtn = ([action, label, sub]) => h('button', {class: 'ae-btn ae-act', type: 'button', 'data-ae-act': action, disabled: dead, onpointerdown: e => { e.preventDefault(); e.currentTarget.click(); }, onclick: () => {
          if (dead || (cdEnd[action] || 0) > Date.now()) return;
          sfx.play(action === 'heal' ? 'magic' : action === 'guard' ? 'shield' : action === 'power' ? 'heavy' : 'hit');
          cdEnd[action] = Date.now() + COOP_CD[action]; paintCd(); post('/api/coop/act', {action}); }},
          h('b', {}, label), h('small', {}, `${sub} · ${COOP_CD[action] / 1000} с`), h('i', {class: 'ae-act-cd'}));
        const sp = mine.spell, comboReady = !!room.chain?.preview;
        if (sp) body.append(h('button', {class: 'ae-btn ae-act ae-spell' + (comboReady ? ' is-combo' : ''), type: 'button', 'data-ae-act': 'spell', disabled: dead, onpointerdown: e => { e.preventDefault(); e.currentTarget.click(); }, onclick: () => {
          if (dead || (cdEnd.spell || 0) > Date.now()) return;
          sfx.play('magic'); cdEnd.spell = Date.now() + spellCd; paintCd(); post('/api/coop/act', {action: 'spell'}); }},
          h('b', {}, `${sp.icon} ${sp.name}${comboReady ? ' — СВЯЗКА!' : ''}`), h('small', {}, `${sp.elRu} · ${sp.text} · ${Math.round(sp.cd / 1000)} с`), h('i', {class: 'ae-act-cd'})));
        body.append(h('div', {class: 'ae-grid2 ae-acts'}, COOP_ACTS.map(actBtn)));
        body.append(h('div', {class: 'ae-pings'}, [['help', '🆘'], ['guard', '🛡️'], ['combo', '⚡'], ['focus', '🎯'], ['ok', '👍']].map(([k, ic]) => h('button', {type: 'button', class: 'ae-ping', title: 'Сигнал отряду',
          onclick: () => { sfx.play('bell', 0.25); post('/api/coop/ping', {kind: k}); }}, ic + ' ' + {help: 'Помощь', guard: 'Прикрой', combo: 'Связка', focus: 'В атаку', ok: 'Ок'}[k]))));
        body.append(h('details', {class: 'ae-combos'}, h('summary', {}, '📜 Связки стихий — как работают'),
          h('p', {class: 'ae-sub'}, 'Примените способность сразу после союзника (в течение 4 действий отряда) — сработает связка двух стихий. Третий герой подряд — тройная связка с огромным уроном.'),
          ...[['🔥🌿', 'Огонь + Природа', 'Лесной пожар — горение 3 хода'], ['☯️', 'Свет + Тьма', 'Сумеречный разлом — мощный взрыв'], ['😈', 'Огонь + Тьма', 'Адское пламя — мощный взрыв'],
            ['☀️', 'Огонь + Свет', 'Священный огонь — урон и лечение отряда'], ['☠️', 'Природа + Тьма', 'Гнилая чума — яд 3 хода'], ['🌳', 'Свет + Природа', 'Благословение рощи — урон и лечение'],
            ['🌪️', 'Сила + Природа', 'Удар бури — враг оглушён'], ['🤜', 'Сила + Сила', 'Двойной натиск — враг оглушён'], ['⚔️', 'Сила + Свет', 'Клятва рыцарей — урон и лечение'], ['☄️', 'Сила + Огонь', 'Пылающий натиск — взрыв'], ['🌑', 'Сила + Тьма', 'Удар из тьмы — взрыв']]
            .map(([i, e, t]) => h('div', {class: 'ae-combo-row'}, h('span', {}, i), h('b', {}, e), h('span', {class: 'ae-sub'}, t)))));
        if (dead) body.append(h('p', {class: 'ae-note'}, 'Вы без сил. Союзник может поднять вас лечением.'));
      }
      if (room.status === 'won') body.append(room.reward && !room.reward.claimed ? h('button', {class: 'ae-btn ae-primary ae-wide', onclick: claim}, '🎁 Забрать награду') : h('p', {class: 'ae-note'}, 'Награда получена.'));
      body.append(h('div', {class: 'ae-log'}, room.log.slice().reverse().map(l => h('div', {}, l.text))));
      body.append(h('button', {class: 'ae-btn ae-wide', onclick: () => confirm('Покинуть отряд?') && post('/api/coop/leave', {}, 'Вы покинули отряд').then(load)}, room.status === 'active' ? 'Покинуть поход' : 'Выйти из комнаты'));
    });
    // Cooldowns and the enemy timer tick locally between server updates.
    function paintCd() {
      const t = Date.now();
      for (const btn of st.body.querySelectorAll('[data-ae-act]')) {
        const a = btn.getAttribute('data-ae-act'), left = Math.max(0, (cdEnd[a] || 0) - t), cdEl = btn.querySelector('.ae-act-cd'), full = a === 'spell' ? spellCd : COOP_CD[a];
        btn.classList.toggle('is-cd', left > 0);
        if (cdEl) { const pct = Math.min(100, 100 * left / full); cdEl.style.display = left ? 'flex' : 'none'; cdEl.style.background = `linear-gradient(90deg,#000c ${pct}%,#0006 ${pct}%)`; cdEl.textContent = left ? (left / 1000).toFixed(1) + ' с' : ''; }
      }
      const ft = st.body.querySelector('[data-ae-foe-timer]');
      const sl = state?.mine?.foe?.stepsLeft; if (ft) ft.textContent = state?.mine?.foe?.stunned ? '💫 Враг оглушён — пропустит ход' : sl ? (sl <= 1 ? '⚠️ Враг ударит после следующего действия!' : `Враг ударит через ${sl} действ. отряда`) : '';
      const ct = st.body.querySelector('[data-ae-chain-timer]');
      const cl = state?.mine?.chain?.left; if (ct) ct.textContent = cl ? `Успейте за ${cl} действ. отряда` : 'Время вышло';
    }
    const baseRender = st.rerender; st.rerender = () => { baseRender(); paintCd(); requestAnimationFrame(showFloats); };
    let pollAt = 0; st.timers.push(setInterval(() => { const fight = state?.mine?.status === 'active' && state.mine.phase === 'fight'; if (Date.now() - pollAt < (fight ? 600 : 1500)) return; pollAt = Date.now(); load(); }, 200));
    load(); api('/api/friends').then(r => { friends = r.friends || []; }).catch(() => {});
  }

  // ---------- 9. wiki ----------
  const WIKI = [
    ['🚀 С чего начать', `<p>Создайте героя и выберите класс. Первые бои проходят на <b>Зелёных равнинах</b> (ур. 1–8). Путешествия и бои тратят <b>энергию</b> ⚡: запас <b>100</b>, восстанавливается по 1 каждые 2 минуты. Энергию также дают пиво и самогон в Таверне.</p><p><b>Поселение</b> — сердце игры: рынок, доска поручений, мастерская, кузница, алхимик, арена, дом клана, приют спутников, таверна, причал и шахта. Значки на карточках подсказывают, куда стоит зайти: «🎟️ билеты», «⚗️ можно варить», «🍖 питомец голоден», «✨ загляните».</p>`],
    ['⚔️ Бои', `<p>Бой пошаговый: <b>Атака</b>, <b>Навыки</b> (меню всех навыков героя за ману), <b>Защита</b> (меньше урона и +мана), <b>Зелье</b> и <b>Скрыться</b>. Над врагом показан прогноз его следующего приёма — встаньте в защиту перед сильным ударом.</p><p>Урон уменьшается защитой цели; пробивание брони, крит и сила крита его увеличивают. Вампиризм возвращает часть урона здоровьем. <b>Автобой</b> (Premium) сам ведёт бой по вашим настройкам.</p>`],
    ['✨ Навыки и таланты', `<p>У каждого класса 3–4 навыка, один из них — <b>ульта</b>. <b>Ранг навыка</b> (I–IV) растёт с уровнем и главной характеристикой класса и усиливает урон до ×1.4. Некоторые навыки работают <b>в связке</b>: применённые подряд, они бьют сильнее (метка «Связка»).</p><p><b>Дерево талантов</b> даёт урон навыков, экономию маны, силу и длительность эффектов, добивание, стойки, возврат маны и многое другое. Новые навыки открываются с развитием героя.</p><p>Навыки и таланты работают <b>во всех боях</b>: с монстрами, в коопе, дуэлях и Орде. В коопе, дуэлях и Орде навыки ограничены только маной.</p>`],
    ['🧙 Классы и характеристики', `<p><b>Воин</b>, <b>Рыцарь</b> — танки. <b>Берсерк</b> — физический урон. <b>Разбойник</b>, <b>Ассасин</b> — скорость и взрывной урон. <b>Лучник</b> — дальний бой. <b>Маг</b>, <b>Некромант</b> — магия. <b>Паладин</b>, <b>Друид</b> — урон и лечение.</p><p>За каждый уровень — 5 очков характеристик. <b>🍀 Удача</b> повышает шанс, что найденная вещь станет на ступень реже, и чаще приносит легендарные находки (подробности — в Профиле).</p><p><b>♻️ Сброс характеристик</b>: экран героя или Профиль → «Сбросить». Возвращаются все вложенные очки, уровень, вещи, навыки и таланты не меняются. Первый сброс бесплатный, далее — 50 серебра за уровень героя.</p>`],
    ['🗺️ Локации', `<p>Равнины (1–8) → Шепчущий лес (5–12) → Забытый склеп (8–18) → Тёмный лес (12–25) → Гиблые болота (25–40) → Пылающая пустыня (40–55) → Проклятые земли (55–75) → Демонический разлом (75–90) → Драконий сандор (90–120).</p><p>В каждой земле свои режимы охоты и свои уникальные монстры. Победа над местным боссом открывает новые режимы и награду за освоение региона.</p>`],
    ['🛡️ Снаряжение', `<p>Редкости: обычные, необычные, редкие, эпические, легендарные и мифические. Носить можно вещи любого класса по уровню.</p><p><b>🎁 Находки</b>: после каждой победы есть шанс найти новую вещь под ваш уровень, с босса — всегда. Точные шансы — в разделе «🎲 Редкость и шансы».</p><p><b>👑 Автоодевание</b> (Premium): герой сам надевает вещи, которые делают его сильнее. Переключатель — в сумке.</p><p><b>⬆️ Вещи выше уровня</b>: снаряжение можно надеть, если оно не больше чем на 10 уровней выше героя. Пока герой не дорос, характеристики вещи ослаблены на 6% за каждый уровень разницы (до 40% силы) — когда уровень сравняется, вещь заработает в полную силу.</p><p><b>🗡️ Двуручное оружие</b>: атака ×1.6 по сравнению с обычным оружием того же уровня, но занимает обе руки — щит или второе оружие с ним не надеть (значок «2H» в сумке). 15% нового найденного или созданного оружия выпадает двуручным. Любое оружие, кроме кинжалов, можно перековать в двуручное за золото: откройте оружие в сумке → «⚒️ Перековать в двуручное». Вернуть одноручным нельзя.</p><p><b>⚠️ Угроза</b>: если снаряжение героя намного сильнее обычного для его уровня, монстры в походах становятся крепче и злее (до ×2.6 к здоровью, сильнее бьют и лучше пробивают броню). Зато опыт и золото за них выше — до +50%. Учитывается самая сильная экипировка за последние 15 минут. На арене гладиаторы подстраиваются под силу героя, а раненые монстры (от 15 уровня) впадают в ярость и бьют сильнее.</p>`],
    ['🎲 Редкость и шансы', `<p><b>Редкости</b> (от слабых к сильным): обычная → необычная (×1.15 к характеристикам) → редкая (×1.35) → эпическая (×1.65) → легендарная (×2.1) → мифическая.</p>
<table class="ae-wiki-table"><tr><th>Источник</th><th>Необ.</th><th>Ред.</th><th>Эпич.</th><th>Лег.</th></tr>
<tr><td>Монстр</td><td>7%</td><td>4%</td><td>2%</td><td>0,8%</td></tr>
<tr><td>Босс (всегда)</td><td>—</td><td>25%</td><td>50%</td><td>25%</td></tr>
<tr><td>Мастерская</td><td>27%</td><td>14%</td><td>8%</td><td>5%</td></tr></table>
<p>Плюс обычная добыча монстров и боссов по их собственному списку (например, легендарные клинки с боссов зон). Находки создаются под ваш уровень; у эпических одно особое свойство, у легендарных — два.</p>
<p><b>🍀 Удача</b>: шансы находок умножаются на 1 + (удача − 8) / 40 (до ×3), а у каждой новой вещи есть шанс <b>удача × 0,4%</b> (до 25%) стать на ступень реже. Ваши точные цифры — в Профиле.</p>
<p>Гнёзда для кристаллов: обычные и необычные — 1, редкие и эпические — 2, легендарные и выше — 3.</p>`],
    ['⚒️ Кузница и заточка', `<p>Заточка от +0 до +25, каждая ступень даёт +6% к характеристикам. До +5 — гарантированно, пороги +5/+10/+15/+20 сохраняются при провале. Нужны руда из шахты и трофеи монстров — список и где их добыть написаны прямо в кузнице.</p><p>Нажмите <b>«В кузницу»</b> в меню предмета — кузница откроется сразу с ним. Результат каждой попытки показывается крупно, номер заточки на картинке предмета обновляется сразу.</p>`],
    ['💎 Кристаллы', `<p>Кристалл вставляется в снаряжение и <b>навсегда</b> добавляет характеристику. <b>Создать</b> — в Мастерской (трофеи + 900 серебра), <b>купить</b> — на Рынке во вкладке «Базовый магазин» (1 800–2 700 золота), <b>вставить</b> — в Кузнице или в Сумке.</p><p>Вампиризм, регенерация HP и маны, шанс и сила крита, пробивание брони, уклонение, меткость. <b>Кристаллы крови, яда и пламени</b> дают шанс наложить кровотечение, отравление или поджог при ударе — во всех боях.</p><p>Гнёзда: обычные и необычные вещи — 1, редкие и эпические — 2, легендарные и выше — 3.</p>`],
    ['★ Объединение', `<p>Два <b>одинаковых</b> предмета (название, редкость и ★) объединяются в один со звездой вознесения: каждая ★ даёт <b>+10%</b> к характеристикам, максимум ★5. Остаются лучший уровень и лучшая заточка. Стоимость — серебро. Где: Сумка → «Объединить одинаковые». Надетые, запертые и клановые вещи не участвуют.</p>`],
    ['✦ Вознесение героя', `<p>Арена → «Вознесение». Ранги E → D → C → B → A → S → SS → SSS: победите хранителя и потратьте серебро и <b>Осколки вознесения</b> (с боссов, элит, Орды, коопа, рынка). Ваш ранг вознесения виден всем в профиле.</p>`],
    ['🤝 Кооп-подземелья', `<p>Меню → «Кооп». Лидер открывает комнату, союзники присоединяются (по ссылке в общем чате или приглашению другу). 7 залов, на развилках путь может выбрать любой участник: бой, элита, ловушка, сокровище или святилище. В конце — босс.</p><p>Бой <b>пошаговый, как в пещерах</b>: каждый герой делает ход, затем бьёт враг. Атака, Навыки, Защита (+25% маны) и Зелья (ими можно поднять павшего союзника). Если союзник отошёл — «⏩ Не ждать».</p><p><b>⚡ Связки героев</b>: союзник оглушил или заморозил врага — ваш атакующий навык даёт «Удар по беззащитному» ×1.5; уязвимость — «Сокрушение уязвимого» ×1.4; кровотечение, яд или поджог — «Детонация» ×1.35; ярость, щит или лечение — тоже усиливают. Подходящие навыки подсвечиваются.</p>`],
    ['🌕 Орда', `<p>Меню → «Орда»: бесконечные волны монстров, быстрые бои и автобой (сам выбирает сильнейший навык). Каждый 20-й враг — вожак, сундуки на 20, 40 и 60 убийствах. Стоит 10 энергии.</p><p><b>Кровавая луна</b> (с 10 уровня): лунные чудовища, враги сильнее, награда ×1.75. <b>Выходные Кровавой луны</b> — по субботам и воскресеньям каждый поход идёт в Кровавую луну с наградой ×2 для всех уровней.</p>`],
    ['🏟️ Арена и дуэли', `<p>Билеты арены: каждый день в 00:00 UTC их становится не меньше 5. <b>Дополнительные билеты</b> дают задания («Задания» в быстрой панели): 3 боя на арене (+2), 2 победы на арене (+1), кооп-подземелье, 3 дуэли и 40 монстров Орды (по +1), недельные задания (+3…+5). Лишние билеты сверх 5 не сгорают. <b>Дуэли</b>: вызовите любого героя по нику — с вами сражается его тень с его снаряжением, навыками и талантами. Есть рейтинг и награды, дуэли считаются в задания.</p>`],
    ['📜 Задания и титулы', `<p><b>Доска поручений</b> — задания жителей и короля. <b>«Задания»</b> (быстрая панель) — ежедневные и недельные задания за кооп, дуэли и Орду с наградами и осколками.</p><p><b>Профиль</b>: 23 титула за подвиги, круглые аватарки, ранг вознесения и статистика. Профиль других игроков открывается по нажатию на ник.</p>`],
    ['⛏️ Шахта, алхимия, рыбалка', `<p><b>Шахта</b> — руда для заточки и материалы. <b>Алхимия</b> — зелья и склянки: у ингредиентов видно «есть/нужно», а под рецептом написано, чего не хватает. Энергия алхимии восстанавливается по 1 каждые 20 секунд, новые рецепты открываются с уровнем алхимии. <b>Рыбалка</b> — улов для продажи и рецептов.</p>`],
    ['🐾 Спутники', `<p><b>⭐ Прокачка питомца</b>: питомец получает опыт за каждого монстра (+2), босса (+15, до 600 опыта в день за бои) и за кормление (рыба: обычная +8, необычная +15, редкая +30; миска +12, пир +25). Каждый уровень — +6% к характеристикам питомца, максимум 30 уровень. Уровень у каждого питомца свой и хранится на сервере.</p><p>Спутник помогает в бою и даёт бонус. Лютоволк доступен сразу, остальных создают в Приюте из материалов шахты: фея — горное дело 15, големчик — 25, дракончик — 35, пустотник — 45.</p><p><b>🍖 Кормите питомца</b>: сытость падает за сутки, голодный питомец даёт только половину характеристик. Корм — мясо или рыба из сумки, миска (10 золота) или пир (30 золота). Бот напомнит, когда питомец проголодается.</p>`],
    ['💰 Рынок и торговля', `<p><b>🪙 Одно золото</b>: покупки у игроков, ставки и предложения цены оплачиваются золотом героя, выручка от продаж и возвраты ставок приходят туда же автоматически.</p><p><b>🔨 Аукцион</b> (Рынок → «Аукцион»): выставьте вещь со стартовой ценой и сроком 1, 6, 24 или 48 ч, можно задать цену выкупа. Ставка списывается из кошелька и возвращается, если её перебьют; ставка в последние 2 минуты продлевает торги. Победитель получает вещь, без ставок она вернётся в сумку.</p><p><b>💬 Продажа через чат</b>: в окне вещи «📢 В чат» → укажите цену (или оставьте пустой). Игроки купят сразу или предложат свою цену — деньги предложения резервируются и вернутся, если вы откажете. Ответить на предложения — в «Аукцион → Мои лоты».</p><p><b>💰 Купить показанную вещь</b>: под любой вещью в чате есть кнопка «Купить» — назовите цену, золото зарезервируется. Владелец получит запрос (Рынок → «Аукцион и мои лоты» → «Запросы») и одной кнопкой продаст вещь из сумки. Нет ответа за 2 дня или отказ — золото вернётся.</p><p>Пока вещь продаётся, она хранится у рынка — покупка проходит, даже если продавец не в игре. Налог продавца 3% (с Premium 0%). Обычный рынок «Рыцари» и продажа жителям работают как раньше.</p>`],
    ['🛡️ Кланы', `<p>Создание клана — 100 000 золота (с Premium — 50 000). Каждую неделю клан бьёт <b>Стража клановых врат</b>: один удар в сутки, за победу — опыт клана и золото в казну. Казна тратится на клановые проекты (Арсенал, Исследовательский зал, Снабжение).</p><p><b>Приглашения</b>: в Доме клана — «👥 Позвать друзей» (друг получит приглашение в игре и сообщение от бота) и «📢 В общий чат» (по приглашению из чата сутки могут вступить до 15 героев, даже если набор закрыт).</p><p><b>🏰 Штаб клана</b> (кнопка в Доме клана): <b>ежедневный сундук</b>; <b>бонусы</b> всем участникам — +2% опыта и золота и +3% к шансу редкой добычи за каждый уровень клана (до +30% / +45%); <b>задание дня и недели</b> — общая цель на весь клан, награду получает каждый; <b>вклад</b> — очки за монстров, боссов, дуэли и арену, подземелья, руду, зелья и рейд; <b>рейтинг недели</b> — топ-3 кланов получают золото в казну, опыт и бонус чемпиона (медаль у тега); <b>война кланов</b> — раз в неделю клан сражается с соперником по очкам вклада.</p><p><b>💰 Казна и хранилище</b>: в Доме клана кнопки «Пополнить казну» (золото и серебро, 100 монет = 1 очко вклада) и «Внести вещь» — вещь из сумки переезжает в общее хранилище. Казна также растёт от победы над Стражем, заданий клана (+300 / +1500 🪙), войн и рейтинга. Забирать, выдавать, продавать и разбирать вещи из хранилища могут глава, офицеры и казначей.</p><p><b>⛏️ Руда в казне</b>: напрямую руду внести нельзя. Она приходит за победу над Стражем врат и при <b>разборе вещей из хранилища</b>: участник вносит экипировку («Внести вещь»), а глава, офицер или казначей нажимает «Разобрать» — серебро и руда от разбора идут в казну («Продать» даёт золото). Руда, положенная в хранилище как предмет, в казну не засчитывается. Казна тратится на клановые проекты и повышение уровня клана.</p><p><b>🐲 Рейд</b> — настоящий пошаговый бой со Стражем врат раз в сутки: 12 ходов, навыки, защита, зелья и три фазы босса. Навык с эффектом (оглушение, яд, щит…) оставляет <b>связку</b> следующему соклановцу — его атакующий навык станет сильнее.</p><p><b>Поиск и заявки</b>: «🔍 Найти клан» показывает все кланы; в открытые можно вступить сразу, в закрытые — подать заявку (глава и офицеры принимают её в Штабе). Глава может задать <b>эмблему</b> и <b>приветствие</b> новичкам, а неактивных 3+ дня исключать прямо из списка вклада. В кооп-подземельях с соклановцем награда <b>+20%</b>.</p><p><b>Смена главы</b>: если глава клана не заходит в игру 3 дня, лидерство автоматически переходит к участнику с самым высоким уровнем из тех, кто заходил за последние 3 дня. Бывший глава остаётся офицером. Тег клана <b>[ТЕГ]</b> виден перед ником в чатах и в профиле.</p>`],
    ['👥 Друзья и приглашения', `<p>Меню → «Друзья»: поиск по имени, @username или ID, личные сообщения, сделки, приглашения в кооп.</p><p><b>🎁 Пригласить друга</b>: отправьте свою ссылку. Когда герой друга достигнет 10 уровня, вы оба получите <b>Premium на 3 дня</b>.</p>`],
    ['👑 Premium', `<p>150 ⭐ на 30 дней: автобой и автопродолжение серии, <b>автоодевание</b> лучших вещей, массовая продажа и разбор, офлайн-добыча в шахте, +5 слотов сумки, VIP-метка, скидка 50% на клан и рынок без налога.</p>`],
    ['🔔 Уведомления и новости', `<p>Включите уведомления — бот напомнит о полной энергии, билетах арены, голодном питомце, выходных Кровавой луны, вызовах и друзьях. Все обновления — в меню «Что нового» и в канале <a href="https://t.me/Aethelgardo" target="_blank" rel="noopener">t.me/Aethelgardo</a>.</p>`],
  ];
  function openWiki() {
    openPanel('📖 Вики Аэтельгарда', body => {
      body.append(h('p', {class: 'ae-note'}, 'Короткий справочник: как играть, где что найти и как становиться сильнее.'));
      for (const [title, html] of WIKI) body.append(h('details', {class: 'ae-wiki'}, h('summary', {}, title), h('div', {html})));
    });
  }

  // ---------- 10. story scenes on the first visit of a location ----------
  const STORY = {
    reg_plains: ['/assets/plains-DfAnHj7l.webp', 'Зелёные равнины', 'Когда-то здесь паслись королевские стада. Теперь по лугам рыщут волки и разбойники, а гоблины жгут сторожевые костры у старой мельницы. Стража ждёт того, кто вернёт покой Пастбищам.'],
    reg_whisper_woods: ['/assets/woods-nWSh73gt.webp', 'Шепчущий лес', 'Ветви шепчут чужими голосами. Охотники говорят, что Волчья стая выбрала вожака — огромного зверя с глазами цвета луны. Следы ведут вглубь чащи.'],
    reg_forgotten_crypt: ['/assets/crypt-BTumbge1.webp', 'Забытый склеп', 'Под равнинами спят древние короли. Но кто-то сорвал печати: в катакомбах слышен стук костей и тихое пение некроманта.'],
    reg_forest: ['/assets/forest-B0c-87GO.webp', 'Тёмный лес', 'Солнце не пробивается сквозь вековые кроны. Паутина толщиной с канат, коконы на ветвях… Где-то в глубине Логова ждёт его хозяйка.'],
    reg_swamp: ['/assets/swamp-DLuFAhXR.webp', 'Гиблые болота', 'Трупный газ стелется над топью. Из ила поднимаются твари, о которых молчат даже бывалые наёмники. Каждый шаг может стать последним.'],
    reg_desert: ['/assets/desert-CWB6P9JN.webp', 'Пылающая пустыня', 'Пески хранят пирамиды забытой империи. Скорпионы величиной с боевого коня охраняют их сокровища, а ночью над барханами поёт мёртвый ветер.'],
    reg_cursed: ['/assets/cursed-Lvsw06at.webp', 'Проклятые земли', 'Земля почернела от некромантии. Здесь правит Рыцарь Смерти, и его армия скелетов растёт с каждой ночью.'],
    reg_rift: ['/assets/rift-DTdreQra.webp', 'Демонический разлом', 'Трещина в самой ткани мира извергает адское пламя. Из неё выходят демоны, и если разлом не закрыть — Аэтельгард сгорит.'],
    reg_dragon: ['/assets/cave-dragon-C5DdFomJ.webp', 'Драконий сандор', 'На вечных скалах восседает Древний Дракон Аэтельгор. Легенды говорят: лишь величайший герой королевства может бросить ему вызов.'],
  };
  const storyKey = () => 'aeth_story_seen_v2_' + uid();
  let lastRegion = null, storyInit = false;
  function storyTick() {
    const p = me(); if (!p || !p.userId) return;
    let seen; try { seen = new Set(JSON.parse(localStorage.getItem(storyKey()) || '[]')); } catch { seen = new Set(); }
    if (!storyInit) {
      storyInit = true;
      if (!localStorage.getItem(storyKey())) { if (p.firstJourney) seen.add('reg_plains'); localStorage.setItem(storyKey(), JSON.stringify([...seen])); }
    }
    // First time the hero's current land is a new one: show its scene as soon as no battle, journey or panel is in the way.
    const region = p.currentRegionId;
    if (!region || seen.has(region) || !STORY[region]) return;
    if (region === 'reg_plains' && p.firstJourney) return;
    if (openPanelState || p.worldJourney || document.documentElement.hasAttribute('data-in-combat') || document.querySelector('.ae-story, .ae-travel-card, .fantasy-travel-overlay, .world-travel-overlay')) return;
    seen.add(region); localStorage.setItem(storyKey(), JSON.stringify([...seen]));
    const [img, title, text] = STORY[region];
    showStory(img, 'Новая земля', title, text, 'Продолжить путь');
  }
  function showStory(img, kicker, title, text, button) {
    sfx.play('bell');
    const root = h('div', {class: 'ae-story', role: 'dialog', 'aria-label': title},
      h('div', {class: 'ae-story-card'}, h('img', {src: img, alt: ''}), h('div', {class: 'ae-story-text'}, h('small', {}, kicker), h('h2', {}, title), h('p', {}, text),
        h('button', {class: 'ae-btn ae-primary ae-wide', onclick: () => { root.classList.add('is-out'); setTimeout(() => root.remove(), 300); sfx.play('page'); }}, button))));
    document.body.append(root);
  }

  // ---------- 11. sounds ----------
  const sfx = (() => {
    const files = {page: ['page-1', 'page-2'], whoosh: ['whoosh-1', 'whoosh-2'], hit: ['monster-hit-1', 'monster-hit-2', 'monster-hit-3', 'monster-hit-4'], heavy: ['heavy-1', 'heavy-2'],
      shield: ['shield-1', 'shield-2'], magic: ['magic-1', 'magic-2'], bell: ['bell-1'], coins: ['coins-1', 'coins-2'], fail: ['fail-1'], potion: ['potion-1', 'potion-2']};
    const cache = {}; let ctx = null, last = {};
    const muted = () => { try { return localStorage.getItem('aethelgard_sound_muted') === 'true'; } catch { return false; } };
    function play(kind, volume = 0.35) {
      if (muted() || !files[kind]) return;
      const now = performance.now(); if (now - (last[kind] || 0) < 90) return; last[kind] = now;
      const name = files[kind][Math.floor(Math.random() * files[kind].length)];
      try { const a = (cache[name] ||= new Audio('/assets/audio/' + name + '.mp3')).cloneNode(); a.volume = volume; a.play().catch(() => {}); } catch {}
    }
    function tick(freq = 1650, dur = 0.035, vol = 0.05) {
      if (muted()) return;
      try {
        ctx ||= new (window.AudioContext || window.webkitAudioContext)();
        const o = ctx.createOscillator(), g = ctx.createGain(), t = ctx.currentTime;
        o.type = 'triangle'; o.frequency.setValueAtTime(freq, t); o.frequency.exponentialRampToValueAtTime(freq * 0.55, t + dur);
        g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(g).connect(ctx.destination); o.start(t); o.stop(t + dur + 0.01);
      } catch {}
    }
    return {play, tick};
  })();
  document.addEventListener('click', e => {
    const b = e.target.closest?.('button, [role=button], a');
    if (!b || b.disabled) return;
    if (b.closest('nav')) sfx.play('page', 0.25);
    else if (/Продать|Купить|Забрать/i.test(b.textContent || '')) sfx.play('coins', 0.3);
    else sfx.tick();
  }, true);
  const seenPops = new WeakSet();
  function soundScan(root) {
    for (const pop of root.querySelectorAll?.('.combat-damage-pop') || []) {
      if (seenPops.has(pop)) continue; seenPops.add(pop);
      const impact = pop.getAttribute('data-impact') || '', heroSide = !!pop.closest('[class*="combat-damage-hero"],[class*="combat-damage-player"]');
      if (impact === 'critical' || impact === 'super') sfx.play('heavy', 0.4);
      else if (impact.includes('shield')) sfx.play('shield', 0.35);
      else if (heroSide) sfx.play('hit', 0.3);
      else if (/heal|regen/i.test(impact)) sfx.play('magic', 0.3);
    }
  }


  // ---------- admin: grant Premium to a player ----------
  function adminPremiumBlock() {
    let picked = null, results = [];
    const list = h('div', {class: 'ae-admin-list'}), days = h('input', {class: 'ae-input', type: 'number', min: '1', max: '365', value: '30', 'aria-label': 'Дней'});
    const search = h('input', {class: 'ae-input', placeholder: 'Имя, @username или Telegram ID'});
    const status = h('div', {class: 'ae-sub'}, 'Игрок не выбран');
    const paint = () => list.replaceChildren(...results.map(pl => h('button', {type: 'button', class: 'ae-row ae-card ae-click' + (picked?.telegramId === pl.telegramId ? ' is-picked' : ''),
      onclick: () => { picked = pl; status.textContent = `Выбран: ${pl.characterName || pl.displayName} · ур. ${pl.level} · ID ${pl.telegramId}`; paint(); }},
      h('div', {class: 'ae-grow'}, h('b', {}, pl.characterName || pl.displayName || 'Игрок'), h('div', {class: 'ae-sub'}, `${pl.username ? '@' + pl.username + ' · ' : ''}ID ${pl.telegramId} · ур. ${pl.level}`)))));
    const find = async () => { try { results = ((await api('/api/admin/players?search=' + encodeURIComponent(search.value.trim()))).players || []).slice(0, 8); paint(); } catch (e) { toast(cleanError(e)); } };
    search.addEventListener('keydown', e => e.key === 'Enter' && find());
    const grant = async () => {
      if (!picked) return toast('Сначала выберите игрока.');
      const d = Number(days.value); if (!Number.isInteger(d) || d < 1 || d > 365) return toast('Укажите 1–365 дней.');
      if (!confirm(`Выдать Premium на ${d} дн. игроку ${picked.characterName || picked.displayName}?`)) return;
      try { const r = await api('/api/admin/premium/grant', 'POST', {targetId: picked.telegramId, days: d, operationId: uuid4()});
        toast(`Premium выдан до ${new Date(r.premiumUntil).toLocaleDateString('ru-RU')}`); sfx.play('bell'); } catch (e) { toast(cleanError(e)); }
    };
    return h('section', {class: 'ae-admin-premium', 'data-ae-admin': '1'}, h('div', {class: 'ae-h3'}, '👑 Выдать Premium игроку'),
      h('div', {class: 'ae-row'}, search, h('button', {class: 'ae-btn', type: 'button', onclick: find}, 'Найти')), list, status,
      h('div', {class: 'ae-row'}, h('span', {class: 'ae-sub'}, 'Дней'), days, h('button', {class: 'ae-btn ae-primary', type: 'button', onclick: grant}, 'Выдать')));
  }
  function injectAdmin() {
    const title = [...document.querySelectorAll('h1,h2,h3,div,span')].find(e => e.childElementCount === 0 && /Admin Console/.test(e.textContent || ''));
    if (!title) return;
    let box = title; while (box && !(box.scrollHeight > box.clientHeight + 4 && /(auto|scroll)/.test(getComputedStyle(box).overflowY))) box = box.parentElement;
    const host = box || title.closest('[role=dialog]') || title.parentElement?.parentElement;
    if (host && !host.querySelector('[data-ae-admin]')) host.append(adminPremiumBlock());
    if (host && !host.querySelector('[data-ae-admin-promo]')) host.append(adminPromoBlock());
    if (host && !host.querySelector('[data-ae-admin-news]')) host.append(adminNewsBlock());
    if (host && !host.querySelector('[data-ae-admin-mail]')) host.append(adminMailBlock());
    if (host && !host.querySelector('[data-ae-admin-level]')) host.append(adminLevelBlock());
    if (host && !host.querySelector('[data-ae-admin-stats]')) {
      // under the console's own header (with its ✕), never above it
      let head = title; while (head && head.parentElement !== host) head = head.parentElement;
      if (head) { head.after(adminStatsBlock()); head.classList.add('ae-admin-head'); } else host.append(adminStatsBlock());
    }
    // a misplaced block from an older version: move it under the header
    const misplaced = host?.firstElementChild?.matches?.('[data-ae-admin-stats]') ? host.firstElementChild : null;
    if (misplaced) { let head = title; while (head && head.parentElement !== host) head = head.parentElement; if (head) head.after(misplaced); }
  }


  // ---------- premium welcome card ----------
  const welcomeKey = () => 'aeth_premium_welcomed_' + uid();
  function showPremiumWelcome(status) {
    if (document.querySelector('.ae-premium')) return;
    localStorage.setItem(welcomeKey(), status.premiumUntil || String(Date.now()));
    const until = status.premiumUntil ? new Date(status.premiumUntil).toLocaleDateString('ru-RU') : '';
    const perks = ['⚔️ Автобой и его настройки', '🔁 Автопродолжение серии', '🎒 Массовая продажа и разбор', '⛏️ Офлайн-добыча в шахте', '🧳 +5 слотов сумки', '👑 VIP-метка в чате', '🛡️ Клан за 50 000 и рынок без налога'];
    const root = h('div', {class: 'ae-story ae-premium', role: 'dialog', 'aria-label': 'Добро пожаловать в Premium'},
      h('div', {class: 'ae-story-card ae-premium-card'}, h('img', {src: '/assets/premium-welcome-v1.jpg', alt: 'Aethelgard Premium'}),
        h('div', {class: 'ae-story-text'}, h('small', {}, 'Ваш статус повышен'), h('h2', {}, '👑 Добро пожаловать в Premium!'),
          h('p', {}, 'Спасибо, что поддерживаете Аэтельгард! Королевство открывает вам свои лучшие возможности' + (until ? ` — до ${until}.` : '.')),
          h('ul', {class: 'ae-perks'}, perks.map(x => h('li', {}, x))),
          h('button', {class: 'ae-btn ae-primary ae-wide', onclick: () => { root.classList.add('is-out'); setTimeout(() => root.remove(), 300); }}, 'В бой, герой!'))));
    document.body.append(root); sfx.play('bell', 0.5); setTimeout(() => sfx.play('coins', 0.35), 350);
    for (let i = 0; i < 26; i++) root.append(h('i', {class: 'ae-confetti', style: `left:${Math.random() * 100}%;animation-delay:${Math.random() * 0.8}s;background:${['#e5c678', '#f6e2aa', '#a78bfa', '#67e8f9'][i % 4]}`}));
  }
  async function checkPremium() {
    if (!uid()) return false;
    try {
      const st = await api('/api/premium/status');
      if (!st?.active) return false;
      const seen = Date.parse(localStorage.getItem(welcomeKey()) || '') || Number(localStorage.getItem(welcomeKey())) || 0;
      if (seen && seen > Date.now()) return true;
      showPremiumWelcome(st); return true;
    } catch { return false; }
  }
  (function watchInvoice() {
    const wa = window.Telegram?.WebApp;
    if (!wa?.openInvoice || wa.openInvoice.__ae) return;
    const orig = wa.openInvoice.bind(wa);
    const wrapped = (url, cb) => orig(url, status => { try { cb?.(status); } finally { if (status === 'paid') { let n = 0; const t = setInterval(async () => { if (await checkPremium() || ++n > 8) clearInterval(t); }, 1500); } } });
    wrapped.__ae = true; wa.openInvoice = wrapped;
  })();
  const premiumBoot = setInterval(() => { if (uid()) { clearInterval(premiumBoot); setTimeout(checkPremium, 2500); } }, 1000);


  // ---------- dungeon icons + co-op card in the World dungeon list ----------
  const CAVE_ICONS = {'Пещера летучих мышей': 'bat_cave', 'Заброшенная шахта': 'old_mine', 'Паучье логово': 'spider_lair', 'Катакомбы древних королей': 'catacombs', 'Демонический разлом': 'demon_rift', 'Пещера Аэтельгора': 'dragon_cave'};
  const COOP_ICONS = {goblin_cave: 'goblin_cave', spider_den: 'spider_den', crypt_depths: 'crypt_depths', rift_gate: 'rift_gate'};
  const dIcon = key => '/assets/dungeons/dungeon-' + key + '.webp';
  function decorateDungeons() {
    const cards = [];
    for (const el of document.querySelectorAll('main *, .game-dialog-backdrop *, .bottom-sheet-backdrop *')) {
      if (el.childElementCount || !CAVE_ICONS[(el.textContent || '').trim()] || el.closest('.ae-panel')) continue;
      let card = el.parentElement;
      while (card && !(/комнат/.test(card.textContent) && (card.tagName === 'BUTTON' || card.querySelector('button')) && card.getBoundingClientRect().height < 220)) card = card.parentElement;
      if (!card || card.tagName === 'MAIN') continue;
      cards.push(card);
      if ([...card.querySelectorAll('img')].some(i => i.getBoundingClientRect().width > 60)) continue;
      if (card.getAttribute('data-ae-dungeon') !== CAVE_ICONS[el.textContent.trim()]) card.setAttribute('data-ae-dungeon', CAVE_ICONS[el.textContent.trim()]);
    }
    if (cards.length >= 2) {
      let parent = cards[0].parentElement;
      while (parent && !cards.every(c => parent.contains(c))) parent = parent.parentElement;
      let last = cards[cards.length - 1]; while (last && last.parentElement !== parent) last = last.parentElement;
      if (parent && last && parent.tagName !== 'MAIN' && !parent.querySelector(':scope > [data-ae-coop-card]')) {
        const card = h('button', {type: 'button', class: 'ae-coop-card', 'data-ae-coop-card': '1', onclick: () => openCoop()},
          h('span', {class: 'ae-coop-icons'}, ['goblin_cave', 'spider_den', 'rift_gate'].map(k => h('img', {src: dIcon(k), alt: ''}))),
          h('span', {class: 'ae-grow'}, h('b', {}, '🤝 Кооп-подземелья'), h('small', {}, 'До 3 героев · 5 залов · босс · награда каждому')), h('span', {class: 'ae-coop-go'}, '›'));
        parent.insertBefore(card, last.nextSibling);
      }
    }
  }


  // ---------- merge button right inside the bag ----------
  // ---------- Premium: auto-equip better gear ----------
  // Each candidate is tried on for real and kept only if the hero's combat power (the game's own stats) goes up.
  const AUTO_SLOTS = ['weapon', 'offhand', 'helmet', 'armor', 'pants', 'gloves', 'boots', 'amulet', 'ring', 'belt', 'cloak', 'artifact'];
  const CASTER = new Set(['mage', 'necromancer', 'druid', 'paladin']);
  const autoKey = () => 'aeth_autoequip_' + uid();
  const autoOn = () => localStorage.getItem(autoKey()) !== '0';
  let premiumActive = null, premiumAt = 0, autoBusy = false, autoSeen = '';
  async function isPremium() {
    if (premiumActive !== null && Date.now() - premiumAt < 10 * 60e3) return premiumActive;
    premiumAt = Date.now(); try { premiumActive = !!(await api('/api/premium/status'))?.active; } catch { premiumActive = premiumActive || false; }
    return premiumActive;
  }
  function heroPower(st, cls) {
    if (!st) return 0;
    const atk = CASTER.has(cls) ? Math.max(st.magicAttack || 0, st.attack || 0) : Math.max(st.attack || 0, (st.magicAttack || 0) * 0.5);
    return atk * 3 + (st.defense || 0) * 1.5 + (st.magicDefense || 0) + (st.maxHp || 0) * 0.25 + (st.maxMp || 0) * 0.05 + (st.critChance || 0) * 8 + (st.critDamage || 0) * 0.5 + (st.speed || 0) + (st.evasion || 0) * 3;
  }
  const quickScore = i => Object.values(i.stats || {}).reduce((a, v) => a + (Number(v) || 0), 0) * (1 + 0.1 * (i.upgradeLevel || 0)) * (1 + 0.1 * (ascOf(i) || 0));
  const frame = () => new Promise(r => setTimeout(r, 120));
  // Items already judged are remembered on the device, so a restart re-checks nothing; only new items are tried.
  const autoSeenKey = () => 'aeth_autoequip_seen_' + uid();
  const autoSeenIds = () => { try { return new Set(JSON.parse(localStorage.getItem(autoSeenKey()) || '[]')); } catch { return new Set(); } };
  const rememberJudged = ids => { const s = autoSeenIds(); ids.forEach(x => s.add(x)); localStorage.setItem(autoSeenKey(), JSON.stringify([...s].slice(-400))); };
  // Silent swap (the game's own local equip, without its click sound and vibration).
  const swapLocal = (slot, item) => { B().setPlayer(x => {
    if (!x || !x.inventory.some(i => i.id === item.id)) return x;
    const worn = x.equipped?.[slot], inv = x.inventory.filter(i => i.id !== item.id);
    if (worn) inv.push({...worn, isEquipped: false});
    return {...x, inventory: inv, equipped: {...x.equipped, [slot]: {...item, isEquipped: true}}};
  }); syncEquippedSoon(); };
  // Tell the server which of its items the hero really wears (otherwise it refuses to sell / disassemble the old ones).
  let eqSyncTimer = 0, eqSyncSent = '';
  function syncEquippedSoon(delay = 2500) { clearTimeout(eqSyncTimer); eqSyncTimer = setTimeout(syncEquippedNow, delay); }
  async function syncEquippedNow() {
    const p = me(); if (!p?.equipped) return;
    if (p.worldJourney || document.documentElement.hasAttribute('data-in-combat')) return syncEquippedSoon(15000);
    const equipped = Object.fromEntries(Object.entries(p.equipped).filter(([, i]) => i?.serverOwned).map(([slot, i]) => [slot, i.id]));
    const key = uid() + JSON.stringify(equipped); if (key === eqSyncSent) return;
    try { await api('/api/items/equipped-sync', 'POST', {equipped}); eqSyncSent = key; } catch {}
  }
  setTimeout(() => syncEquippedNow(), 9000);
  async function autoEquip(force) {
    const b = B(), p = me(); if (!b?.setPlayer || !p || autoBusy || !autoOn()) return;
    if (p.worldJourney || document.documentElement.hasAttribute('data-in-combat') || openPanelState) return;
    const sig = (p.inventory || []).map(i => i.id).join(',') + '|' + p.level; if (!force && sig === autoSeen) return; autoSeen = sig;
    const judged = force ? new Set() : autoSeenIds(), lvlKey = 'L' + p.level;
    const fresh = (p.inventory || []).filter(i => AUTO_SLOTS.includes(i.type) && !judged.has(i.id + '@' + lvlKey) && !judged.has(i.id));
    if (!fresh.length) return;
    if (!(await isPremium())) return;
    autoBusy = true; const done = [], checked = [];
    try {
      for (const slot of AUTO_SLOTS) {
        const cur = me(); if (!cur || cur.worldJourney || document.documentElement.hasAttribute('data-in-combat')) break;
        const worn = cur.equipped?.[slot];
        if (slot === 'offhand' && isTwoHand(cur.equipped?.weapon)) continue; // both hands are busy
        const cands = fresh.filter(i => i.type === slot && cur.inventory.some(x => x.id === i.id) && !i.serverOwned && !i.isLocked && !i.boundToClan && !i.isEquipped && (i.level || 1) <= (cur.level || 1))
          .filter(i => !worn || quickScore(i) > quickScore(worn) * 0.9).sort((a, c) => quickScore(c) - quickScore(a)).slice(0, 2);
        for (const c of cands) {
          const before = heroPower(B().stats, cur.classId), prev = me().equipped?.[slot], prevOff = slot === 'weapon' && isTwoHand(c) ? me().equipped?.offhand : null;
          swapLocal(slot, c); if (prevOff) unequipSlot('offhand'); await frame();
          const after = heroPower(B().stats, cur.classId);
          if (after > before * 1.002) done.push(c.name);
          else if (prevOff) { if (prev) swapLocal(slot, me().inventory.find(i => i.id === prev.id) || prev); else unequipSlot(slot); await frame(); const off = me().inventory.find(i => i.id === prevOff.id); if (off) swapLocal('offhand', off); }
          else if (prev) swapLocal(slot, me().inventory.find(i => i.id === prev.id) || prev);
          else B().setPlayer(x => { const ue = x?.equipped?.[slot]; if (!ue || ue.id !== c.id) return x; const eq = {...x.equipped}; delete eq[slot]; return {...x, equipped: eq, inventory: [...x.inventory, {...ue, isEquipped: false}]}; });
          if (after <= before * 1.002) await frame();
        }
      }
      checked.push(...fresh.map(i => i.id + '@' + lvlKey));
    } catch (e) { console.warn('ae autoequip', e); }
    finally { rememberJudged(checked); autoBusy = false; autoSeen = (me()?.inventory || []).map(i => i.id).join(',') + '|' + me()?.level; }
    if (done.length) { toast(`👑 Автоодевание: ${done.join(', ')}`); sfx.play('page'); }
  }
  setInterval(() => { autoEquip().catch(() => {}); }, 4000);
  function autoEquipToggle() {
    const on = autoOn();
    return h('button', {type: 'button', class: 'ae-bag-merge ae-autoequip' + (on ? ' has-pairs' : ''), 'data-ae-autoequip': '1', onclick: async () => {
      if (!(await isPremium())) { toast('👑 Автоодевание доступно с Aethelgard Premium.'); return; }
      localStorage.setItem(autoKey(), on ? '0' : '1'); toast(on ? 'Автоодевание выключено' : '👑 Автоодевание включено'); document.querySelector('[data-ae-autoequip]')?.replaceWith(autoEquipToggle()); if (!on) autoEquip(true);
    }}, h('span', {class: 'ae-entry-icon'}, '👑'), h('span', {class: 'ae-grow'}, h('b', {}, `Автоодевание: ${on ? 'вкл' : 'выкл'}`), h('small', {}, 'Premium: сам надевает вещи, которые делают героя сильнее')), h('span', {class: 'ae-coop-go'}, on ? '✓' : '›'));
  }
  // ---------- alchemy: show how many ingredients you have, and why a brew would fail ----------
  function decorateAlchemy() {
    const main = document.querySelector('main'); if (!main || !/Изученные рецепты/.test(main.textContent || '')) return;
    const p = me(); if (!p) return;
    const have = name => (p.inventory || []).reduce((n, i) => n + (i.name === name ? i.stackCount || 1 : 0), 0);
    for (const el of main.querySelectorAll('span, div, code')) {
      if (el.childElementCount) continue;
      const m = (el.dataset.aeIng || el.textContent || '').trim().match(/^(.+?) x(\d+)$/); if (!m) continue;
      if (!el.dataset.aeIng) el.dataset.aeIng = el.textContent.trim();
      const n = have(m[1]), need = Number(m[2]), txt = `${m[1]} ${n}/${need}`;
      if (el.textContent !== txt) el.textContent = txt;
      el.classList.toggle('ae-ing-low', n < need); el.classList.toggle('ae-ing-ok', n >= need);
    }
    for (const btn of main.querySelectorAll('button')) {
      const m = (btn.textContent || '').match(/Сварить\s*·\s*(\d+)\s*(?:энерги|⚗)/); if (!m) continue;
      let card = btn; for (let i = 0; i < 6 && card && !card.querySelector('[data-ae-ing]'); i++) card = card.parentElement;
      const missing = card ? [...card.querySelectorAll('.ae-ing-low')].map(e => e.dataset.aeIng.replace(/ x\d+$/, '')) : [];
      const cost = Number(m[1]), en = p.alchemyEnergy ?? 0, lowEn = en < cost;
      const note = missing.length ? `Не хватает: ${missing.join(', ')}` : lowEn ? `Мало энергии алхимии: ${en}/${cost} — восстановится примерно через ${Math.ceil((cost - en) * 20 / 60)} мин` : '';
      let tag = btn.parentElement.querySelector(':scope > .ae-alch-note');
      if (!note) { tag?.remove(); btn.classList.remove('ae-alch-blocked'); continue; }
      if (!tag) { tag = h('div', {class: 'ae-alch-note'}); btn.after(tag); }
      if (tag.textContent !== '⚠️ ' + note) tag.textContent = '⚠️ ' + note;
      btn.classList.add('ae-alch-blocked');
    }
  }
  setInterval(() => { if (document.hidden) return; try { decorateAlchemy(); } catch {} }, 1000);
  // ---------- forge: a clear result after every upgrade attempt ----------
  let forgeSnap = null;
  function watchForge() {
    const main = document.querySelector('main'), p = me();
    if (!p || !main || !/Заточить до \+|Ковка\.\.\./.test(main.textContent || '')) { forgeSnap = null; return; }
    const items = [...Object.values(p.equipped || {}).filter(Boolean), ...(p.inventory || [])];
    const snap = {lv: new Map(items.map(i => [i.id, {lv: i.upgradeLevel || 0, name: i.name}])), gold: p.gold || 0, silver: p.silver || 0};
    // the «+N» badge on the forge's item pictures, same as on bag tiles
    const byName = new Map(items.map(i => [i.name, i]));
    for (const img of main.querySelectorAll('img')) {
      let box = img.parentElement, it = null;
      for (let k = 0; k < 4 && box && !it; k++, box = box.parentElement) { const t = box.textContent || ''; for (const [nm, i] of byName) if (nm && t.includes(nm)) { it = i; break; } }
      const holder = img.parentElement; if (!it || !holder || !isGear(it) || holder.getBoundingClientRect().width > 120) continue;
      const lv = it.upgradeLevel || 0; let b = holder.querySelector(':scope > .ae-forge-up');
      if (!lv) { b?.remove(); continue; }
      if (!b) { b = h('b', {class: 'ae-forge-up'}); holder.append(b); if (getComputedStyle(holder).position === 'static') holder.style.position = 'relative'; }
      if (b.textContent !== '+' + lv) { b.textContent = '+' + lv; b.classList.remove('is-pop'); void b.offsetWidth; b.classList.add('is-pop'); }
    }
    const prev = forgeSnap; forgeSnap = snap; if (!prev) return;
    for (const [id, cur] of snap.lv) {
      const was = prev.lv.get(id); if (!was || was.lv === cur.lv) continue;
      if (cur.lv > was.lv) { bigBanner(`⚒️ ${cur.name}: +${was.lv} → +${cur.lv}!`, cur.lv >= 10); sfx.play('coins'); try { Telegram.WebApp.HapticFeedback.notificationOccurred('success'); } catch {} }
      else { bigBanner(`💥 Провал: ${cur.name} +${was.lv} → +${cur.lv}`, false); sfx.play('fail'); }
      return;
    }
    if (snap.gold < prev.gold || snap.silver < prev.silver) { bigBanner('💥 Заточка не удалась — уровень сохранён', false); sfx.play('fail'); }
  }
  setInterval(() => { if (document.hidden) return; try { watchForge(); } catch {} }, 300);
  // ---------- crystals: craft or buy, then socket into gear to add a stat (vampirism, crit, bleed…) ----------
  const GEMS = [
    {id: 'vamp', name: 'Кристалл вампиризма', icon: '🩸', stat: 'vampirism', value: 3, unit: '%', label: 'Вампиризм', recipe: [['Острый клык', 3], ['Магическая эссенция', 1]], gold: 2700},
    {id: 'life', name: 'Кристалл жизни', icon: '💚', stat: 'hpRegen', value: 5, unit: '', label: 'Регенерация HP', recipe: [['Лечебная трава', 5], ['Горный корень', 1]], gold: 1800},
    {id: 'mana', name: 'Кристалл маны', icon: '💧', stat: 'mpRegen', value: 3, unit: '', label: 'Регенерация маны', recipe: [['Лунная пыльца', 3]], gold: 1800},
    {id: 'fury', name: 'Кристалл ярости', icon: '⚡', stat: 'critChance', value: 4, unit: '%', label: 'Шанс крита', recipe: [['Острый клык', 2], ['Огненный цветок', 1]], gold: 2700},
    {id: 'ruin', name: 'Кристалл разрушения', icon: '💥', stat: 'critDamage', value: 15, unit: '%', label: 'Сила крита', recipe: [['Огненный цветок', 2], ['Магическая эссенция', 1]], gold: 2700},
    {id: 'pierce', name: 'Кристалл пробоя', icon: '🗡️', stat: 'armorPenetration', value: 5, unit: '', label: 'Пробивание брони', recipe: [['Медная монета гоблинов', 5], ['Горный корень', 1]], gold: 2100},
    {id: 'shadow', name: 'Кристалл тени', icon: '🌫️', stat: 'evasion', value: 3, unit: '', label: 'Уклонение', recipe: [['Волчья шкура', 4], ['Лунная пыльца', 1]], gold: 2100},
    {id: 'aim', name: 'Кристалл точности', icon: '🎯', stat: 'accuracy', value: 6, unit: '', label: 'Меткость', recipe: [['Медная монета гоблинов', 3], ['Волчья шкура', 2]], gold: 1800},
    {id: 'bleed', name: 'Кристалл крови', icon: '🔴', stat: 'bleedChance', value: 10, unit: '%', label: 'Шанс кровотечения при ударе', recipe: [['Острый клык', 3], ['Мясо вепря', 3]], gold: 2400},
    {id: 'venom', name: 'Кристалл яда', icon: '🧪', stat: 'poisonChance', value: 10, unit: '%', label: 'Шанс отравления при ударе', recipe: [['Ядовитая железа', 4]], gold: 2400},
    {id: 'flame', name: 'Кристалл пламени', icon: '🔥', stat: 'burnChance', value: 10, unit: '%', label: 'Шанс поджога при ударе', recipe: [['Огненный цветок', 3]], gold: 2400}];
  const GEM_SILVER = 900;
  const GEM_SLOTS = {common: 1, uncommon: 1, rare: 2, epic: 2, legendary: 3, mythic: 3, ancient: 3, divine: 3};
  const STAT_RU = Object.fromEntries(GEMS.map(g => [g.stat, g.label]));
  const gemItem = g => ({id: 'gem_' + g.id + '_' + uuid4().slice(0, 8), templateId: 'ae_gem_' + g.id, name: g.name, type: 'material', rarity: 'epic', level: 1, upgradeLevel: 0, icon: g.icon,
    description: `Вставьте в снаряжение: ${g.label} +${g.value}${g.unit}.`, stats: {}, sellPrice: 50, disassembleYield: {}, stackCount: 1});
  const gemCount = (p, g) => (p.inventory || []).reduce((n, i) => n + (i.templateId === 'ae_gem_' + g.id ? i.stackCount || 1 : 0), 0);
  const matCount = (p, name) => (p.inventory || []).reduce((n, i) => n + (i.name === name ? i.stackCount || 1 : 0), 0);
  function takeFromBag(inv, pred, count) {
    let left = count; const out = [];
    for (const i of inv) { if (left > 0 && pred(i)) { const n = i.stackCount || 1, use = Math.min(n, left); left -= use; if (n - use > 0) out.push({...i, stackCount: n - use}); } else out.push(i); }
    return left > 0 ? null : out;
  }
  function addGem(inv, g, n = 1) {
    const i = inv.findIndex(x => x.templateId === 'ae_gem_' + g.id);
    if (i >= 0) { const c = inv.slice(); c[i] = {...c[i], stackCount: (c[i].stackCount || 1) + n}; return c; }
    return [...inv, {...gemItem(g), stackCount: n}];
  }
  // The server keeps the count of each player's crystals; the bag is trimmed to it (crystals never appear from nowhere).
  let gemBusy = false, gemSyncAt = 0;
  async function syncGems(lower) {
    const p = me(); if (!p || gemBusy || claimBusy || walletBusy) return;
    const local = Object.fromEntries(GEMS.map(g => [g.id, (p.inventory || []).reduce((n, i) => n + (i.templateId === 'ae_gem_' + g.id && !i.serverOwned ? i.stackCount || 1 : 0), 0)]));
    let r; try { r = await api('/api/items/gems/sync', 'POST', {gems: local, lower: !!lower}); } catch { return; }
    gemSyncAt = Date.now(); if (gemBusy) return;
    const allow = r.gems || {}; if (!GEMS.some(g => local[g.id] > (allow[g.id] || 0))) return;
    B()?.setPlayer(cur => { if (!cur) return cur; const left = {...allow};
      const inventory = cur.inventory.flatMap(i => { const m = /^ae_gem_([a-z]+)$/.exec(i.templateId || ''); if (!m || i.serverOwned) return [i];
        const keep = Math.min(i.stackCount || 1, Math.max(0, left[m[1]] || 0)); left[m[1]] = (left[m[1]] || 0) - keep; return keep > 0 ? [{...i, stackCount: keep}] : []; });
      return {...cur, inventory}; });
  }
  setTimeout(() => syncGems(false), 11000); setInterval(() => { if (!document.hidden && Date.now() - gemSyncAt > 120e3) syncGems(true); }, 30e3);
  const canAct = () => { const p = me(); if (!p) return 'Игра ещё загружается.'; if (p.worldJourney || document.documentElement.hasAttribute('data-in-combat')) return 'Сначала завершите бой или путь.'; return null; };
  // Each place shows its own part: the Forge sockets, the Workshop crafts, the market's basic shop sells.
  const GEM_TITLE = {apply: '💎 Вставить кристалл', craft: '⚒️ Создать кристалл', buy: '🪙 Кристаллы в продаже'};
  const GEM_WHERE = 'Создать кристалл можно в Мастерской, купить — на Рынке во вкладке «Базовый магазин», вставить — в Кузнице или в Сумке.';
  function openGems(tab = 'apply') {
    let pick = null; syncGems(true).then(() => { if (openPanelState === st) st.rerender(); });
    const st = openPanel(GEM_TITLE[tab] || GEM_TITLE.apply, body => {
      const p = me(); if (!p) return;
      body.append(h('p', {class: 'ae-note'}, tab === 'apply' ? 'Кристалл вставляется в снаряжение и навсегда добавляет характеристику. Гнёзд: обычные и необычные вещи — 1, редкие и эпические — 2, легендарные и выше — 3.'
        : tab === 'craft' ? `Кристалл создаётся из трофеев с монстров и ${GEM_SILVER} серебра. Готовый кристалл вставьте в снаряжение в Кузнице или Сумке.` : 'Редкий товар заезжих торговцев. Готовый кристалл вставьте в снаряжение в Кузнице или Сумке.'));
      if (tab === 'craft' || tab === 'buy') {
        if (tab === 'craft') body.append(h('div', {class: 'ae-pill'}, `Серебро: ${fmt(p.silver)} · каждый кристалл ${GEM_SILVER} 🥈`));
        else body.append(h('div', {class: 'ae-pill'}, `Золото: ${fmt(p.gold)}`));
        for (const g of GEMS) {
          const have = gemCount(p, g), ok = tab === 'buy' ? (p.gold || 0) >= g.gold : (p.silver || 0) >= GEM_SILVER && g.recipe.every(([n, c]) => matCount(p, n) >= c);
          body.append(h('div', {class: 'ae-card ae-row ae-gem-row'}, h('img', {class: 'ae-gem-img', src: '/assets/items/gear/gem_' + g.id + '.webp', alt: ''}),
            h('div', {class: 'ae-grow'}, h('b', {}, g.name), h('div', {class: 'ae-sub'}, `${g.label} +${g.value}${g.unit}${have ? ` · у вас: ${have}` : ''}`),
              tab === 'craft' ? h('div', {class: 'ae-gem-recipe'}, g.recipe.map(([n, c]) => h('span', {class: matCount(p, n) >= c ? 'ae-ing-ok' : 'ae-ing-low'}, `${n} ${Math.min(matCount(p, n), 999)}/${c}`))) : ''),
            h('button', {type: 'button', class: 'ae-btn' + (ok ? ' ae-primary' : ''), disabled: !ok, onclick: async ev => {
              const err = canAct(); if (err) return toast(err);
              const btnEl = ev.currentTarget; btnEl.disabled = true; gemBusy = true;
              try { await api('/api/items/gems/add', 'POST', {gem: g.id, how: tab, operationId: uuid4()}); }
              catch (e) { gemBusy = false; btnEl.disabled = false; return toast(cleanError(e)); }
              if (tab === 'craft') { // server-held materials must be used up on the server, or the next bag refresh returns them
                const plan = []; for (const [n, c] of g.recipe) { let left = c;
                  for (const i of [...(me().inventory || [])].sort((a, b) => Number(!!a.serverOwned) - Number(!!b.serverOwned))) { if (left <= 0) break; if (i.name !== n || i.isLocked) continue; const use = Math.min(left, i.stackCount || 1); left -= use; if (i.serverOwned) plan.push({id: i.id, count: use}); } }
                if (plan.length) { try { await api('/api/items/consume', 'POST', {items: plan}); } catch (e) { gemBusy = false; btnEl.disabled = false; return toast(cleanError(e)); } }
              }
              B().setPlayer(cur => {
                if (!cur) return cur;
                if (tab === 'buy') { if ((cur.gold || 0) < g.gold) return cur; return {...cur, gold: cur.gold - g.gold, inventory: addGem(cur.inventory, g)}; }
                if ((cur.silver || 0) < GEM_SILVER) return cur;
                let inv = cur.inventory; for (const [n, c] of g.recipe) { inv = takeFromBag(inv, i => i.name === n, c); if (!inv) return cur; }
                return {...cur, silver: cur.silver - GEM_SILVER, inventory: addGem(inv, g)};
              });
              gemBusy = false; sfx.play(tab === 'buy' ? 'coins' : 'magic'); toast(`${g.icon} ${g.name} ${tab === 'buy' ? 'куплен' : 'создан'}`); setTimeout(() => st.rerender(), 120);
            }}, tab === 'buy' ? `${fmt(g.gold)} 🪙` : 'Создать')));
        }
        body.append(h('p', {class: 'ae-sub'}, GEM_WHERE));
        return;
      }
      // apply
      const owned = GEMS.filter(g => gemCount(p, g) > 0);
      if (!owned.length) { body.append(h('p', {class: 'ae-empty'}, 'У вас нет кристаллов. ' + GEM_WHERE)); return; }
      body.append(h('h3', {class: 'ae-h3'}, '1. Выберите кристалл'));
      body.append(h('div', {class: 'ae-gem-pick'}, owned.map(g => h('button', {type: 'button', class: 'ae-btn ae-gem-chip' + (pick === g.id ? ' is-on' : ''), onclick: () => { pick = g.id; st.rerender(); }}, h('img', {class: 'ae-gem-chip-img', src: '/assets/items/gear/gem_' + g.id + '.webp', alt: ''}), ` ${g.label} +${g.value}${g.unit} ×${gemCount(p, g)}`))));
      if (!pick) return;
      const g = GEMS.find(x => x.id === pick);
      body.append(h('h3', {class: 'ae-h3'}, '2. Выберите вещь'));
      const worn = Object.entries(p.equipped || {}).filter(([, i]) => i && MARKET_GEAR.has(i.type)).map(([slot, i]) => ({i, slot}));
      const bag = (p.inventory || []).filter(i => MARKET_GEAR.has(i.type)).map(i => ({i, slot: null}));
      const list = [...worn, ...bag].filter(({i}) => !i.boundToClan);
      if (!list.length) body.append(h('p', {class: 'ae-empty'}, 'Нет подходящего снаряжения.'));
      for (const {i, slot} of list) {
        const used = (i.gems || []).length, max = GEM_SLOTS[i.rarity] || 1, full = used >= max;
        body.append(h('button', {type: 'button', class: 'ae-chat-item ae-equip-row', 'data-ae-rarity': i.rarity || 'common', disabled: full, onclick: async ev => {
          const err = canAct(); if (err) return toast(err);
          if (!confirm(`Вставить «${g.name}» в «${i.name}»? Это навсегда.`)) return;
          const gemIt = (me().inventory || []).filter(x => x.templateId === 'ae_gem_' + g.id && !x.isLocked).sort((a, b) => Number(!!a.serverOwned) - Number(!!b.serverOwned))[0];
          if (!gemIt) return toast('Кристалла нет в сумке.');
          { const btnEl = ev.currentTarget; btnEl.disabled = true; gemBusy = true;
            try { await api('/api/items/socket-gem', 'POST', {gem: g.id, gemItemId: gemIt.serverOwned ? gemIt.id : null, gearId: i.serverOwned ? i.id : null}); }
            catch (e) { gemBusy = false; btnEl.disabled = false; toast(cleanError(e)); if (/нет в сумке/i.test(String(e?.message || ''))) syncGems(true).then(() => st.rerender()); return; } }
          B().setPlayer(cur => {
            if (!cur || gemCount(cur, g) < 1) return cur;
            const upd = it => ({...it, stats: {...(it.stats || {}), [g.stat]: (it.stats?.[g.stat] || 0) + g.value}, gems: [...(it.gems || []), g.id], ...(it.aeOver ? {aeOver: {...it.aeOver, diff: -1, base: {...it.aeOver.base, [g.stat]: (it.aeOver.base[g.stat] || 0) + g.value}}} : {})});
            const inv0 = takeFromBag(cur.inventory, x => x.id === gemIt.id, 1); if (!inv0) return cur;
            if (slot) { const e = cur.equipped?.[slot]; if (!e || e.id !== i.id || (e.gems || []).length >= max) return cur; return {...cur, inventory: inv0, equipped: {...cur.equipped, [slot]: upd(e)}}; }
            const idx = inv0.findIndex(x => x.id === i.id); if (idx < 0 || (inv0[idx].gems || []).length >= max) return cur;
            const inv = inv0.slice(); inv[idx] = upd(inv[idx]); return {...cur, inventory: inv};
          }); gemBusy = false;
          sfx.play('magic'); bigBanner(`💎 ${i.name}: ${g.label} +${g.value}${g.unit}`, false); pick = null; setTimeout(() => st.rerender(), 150);
        }}, h('img', {src: iconFor(i) || '/assets/items/sprites/sword.webp', alt: '', style: iconStyle(i)}),
          h('span', {class: 'ae-grow'}, h('b', {}, `${i.name}${slot ? ' (надето)' : ''}`), h('small', {}, `${RARITY_RU[i.rarity] || ''} · ур. ${i.level || 1} · гнёзд ${used}/${max}`),
            (i.gems || []).length ? h('small', {class: 'ae-chat-item-stats'}, (i.gems || []).map(id => GEMS.find(x => x.id === id)?.icon || '💎').join(' ')) : ''),
          h('span', {class: 'ae-equip-go'}, full ? 'Нет гнёзд' : 'Вставить')));
      }
    });
  }
  // ---------- legendary finds: an extra chance after every victory (the base game has very few legendaries) ----------
  const LEG_NAMES = {
    weapon: {warrior: ['Меч', 'Секира', 'Копьё'], knight: ['Меч', 'Копьё'], paladin: ['Молот', 'Булава'], berserker: ['Секира', 'Молот'], rogue: ['Кинжал'], assassin: ['Кинжал'], archer: ['Лук'], hunter: ['Лук'], mage: ['Посох', 'Жезл'], necromancer: ['Посох', 'Коса'], druid: ['Посох', 'Жезл']},
    offhand: 'Щит', helmet: 'Шлем', armor: 'Доспех', pants: 'Поножи', gloves: 'Перчатки', boots: 'Сапоги', amulet: 'Амулет', ring: 'Кольцо', belt: 'Пояс', cloak: 'Плащ', artifact: 'Реликвия'};
  // Names by rarity; legendary epithets also change with the level tier.
  const GEAR_EPITHETS = {
    uncommon: ['путника', 'странника', 'лесника', 'дозорного', 'следопыта', 'ополченца', 'наёмника', 'охотника'],
    rare: ['ветерана', 'серебряной гвардии', 'северного ветра', 'каменного сердца', 'горного клана', 'ночного дозора', 'лунного света', 'королевской стражи'],
    epic: ['героя', 'бури', 'пламенной клятвы', 'тени', 'звёздного света', 'грома', 'древнего ордена', 'полуночи'],
    legendary: ['Рассвета', 'Падшей звезды', 'Громовержца', 'Лунной охотницы', 'Вечного пламени', 'Безмолвия', 'Древних королей', 'Небесного стража', 'Кровавой луны', 'Драконьего сердца', 'Бездны', 'Первородного света']};
  const GEAR_MULT = {uncommon: 1.15, rare: 1.35, epic: 1.65, legendary: 2.1};
  const GEAR_BONUS = {uncommon: 0, rare: 0, epic: 1, legendary: 2};
  const LEG_BONUS = ['vampirism', 'critChance', 'critDamage', 'hpRegen', 'evasion', 'armorPenetration', 'bleedChance', 'burnChance', 'poisonChance'];
  const LEG_ICON = {weapon: '⚔️', offhand: '🛡️', helmet: '🪖', armor: '🥋', pants: '👖', gloves: '🧤', boots: '👢', amulet: '📿', ring: '💍', belt: '🎗️', cloak: '🧥', artifact: '🔮'};
  function makeGear(p, rarity = 'legendary') {
    const L = Math.max(1, 1 + Math.floor(((p.level || 1) - 1) / 4) * 4), types = Object.keys(LEG_NAMES), type = types[Math.floor(Math.random() * types.length)];
    const pool = type === 'weapon' ? (LEG_NAMES.weapon[p.classId] || ['Меч']) : [LEG_NAMES[type]], base = pool[Math.floor(Math.random() * pool.length)];
    const eps = GEAR_EPITHETS[rarity], epithet = rarity === 'legendary' ? eps[Math.min(eps.length - 1, Math.floor(L / 9))] : eps[Math.floor(Math.random() * eps.length)];
    const m = GEAR_MULT[rarity] || 1, st = {}, caster = CASTER.has(p.classId);
    if (type === 'weapon') { st[caster ? 'magicAttack' : 'attack'] = Math.round((12 + L * 3) * m); st.critChance = Math.round((2 + L / 15) * (m > 1.5 ? 1.5 : 1)); }
    else if (type === 'armor') { st.defense = Math.round((6 + L * 2) * m); st.magicDefense = Math.round((4 + L) * m); st.maxHp = Math.round((25 + L * 9) * m); }
    else if (['helmet', 'offhand', 'pants', 'gloves', 'boots', 'belt', 'cloak'].includes(type)) { st.defense = Math.round((3 + L) * m); st.magicDefense = Math.round((2 + L * 0.6) * m); st.maxHp = Math.round((12 + L * 4) * m); }
    else { st[caster ? 'magicAttack' : 'attack'] = Math.round((4 + L) * m); st.maxHp = Math.round((10 + L * 3) * m); st.critChance = 1 + Math.floor(L / 20); }
    const bonuses = [], picks = LEG_BONUS.slice().sort(() => Math.random() - 0.5).slice(0, GEAR_BONUS[rarity] || 0);
    for (const bonus of picks) { const bg = GEMS.find(g => g.stat === bonus); st[bonus] = (st[bonus] || 0) + Math.round((bg?.value || 3) * (rarity === 'legendary' ? 1.5 : 1)); bonuses.push(STAT_RU[bonus] || bonus); }
    const word = {uncommon: 'Необычная', rare: 'Редкая', epic: 'Эпическая', legendary: 'Легендарная'}[rarity];
    const variant = Math.random() < 0.5 ? 1 : 2;
    return {id: 'loot_' + uuid4(), templateId: `ae_gear_${rarity}_${type}_${L}${variant === 2 ? '_v2' : ''}`, name: `${base} ${epithet}`, type, rarity, level: L, upgradeLevel: 0, icon: LEG_ICON[type] || '✨',
      description: `${word} находка.${bonuses.length ? ' Особые свойства: ' + bonuses.join(', ') + '.' : ''}`, stats: st, sellPrice: Math.round((20 + L * 10) * m), disassembleYield: {silver: Math.round((10 + L * 3) * m)}, stackCount: 1};
  }
  const makeLegendary = p => makeGear(p, 'legendary');
  // Drop table after a victory (luck multiplies the chances).
  function rollLoot(boss, luckMul) {
    const r = Math.random();
    if (boss) return r < Math.min(0.6, 0.25 * luckMul) ? 'legendary' : r < 0.75 ? 'epic' : 'rare';
    const t = [['legendary', 0.008], ['epic', 0.02], ['rare', 0.04], ['uncommon', 0.07]]; let acc = 0;
    for (const [rar, c] of t) { acc += c * luckMul; if (r < acc) return rar; }
    return null;
  }
  let killSnap = null;
  function legendaryTick() {
    const p = me(), b = B(); if (!p?.statsSummary || !b?.setPlayer) return;
    const k = {kills: p.statsSummary.monstersKilled || 0, bosses: p.statsSummary.bossesDefeated || 0, uid: p.userId};
    const prev = killSnap; killSnap = k; if (!prev || prev.uid !== k.uid) return;
    const dk = Math.max(0, Math.min(5, k.kills - prev.kills)), db = Math.max(0, Math.min(3, k.bosses - prev.bosses)); if (!dk && !db) return;
    const lm = luckInfo(p).legMul * (1 + (clanX?.clan ? clanX.bonus?.loot || 0 : 0) / 100), found = [];
    for (let i = 0; i < Math.max(0, dk - db); i++) { const r = rollLoot(false, lm); if (r) found.push(r); }
    for (let i = 0; i < db; i++) found.push(rollLoot(true, lm));
    const room = (p.maxInventorySlots || 40) - (p.inventory || []).length; if (!found.length || room <= 0) return;
    const items = found.slice(0, room).map(r => makeGear(p, r));
    b.setPlayer(cur => cur && cur.inventory.length + items.length <= (cur.maxInventorySlots || 40) ? {...cur, inventory: [...cur.inventory, ...items]} : cur);
    for (const it of items) {
      if (it.rarity === 'legendary' || it.rarity === 'epic') setTimeout(() => { bigBanner(`${it.rarity === 'legendary' ? '🌟 Легендарная' : '💜 Эпическая'} находка: ${it.name}!`, it.rarity === 'legendary'); sfx.play('coins'); try { Telegram.WebApp.HapticFeedback.notificationOccurred('success'); } catch {} }, 600);
      else setTimeout(() => toast(`🎁 Находка: ${it.name} (${RARITY_RU[it.rarity]})`), 600);
    }
  }
  // ---------- luck: better rarity on found gear and more legendary finds ----------
  const RARITY_UP = {common: 'uncommon', uncommon: 'rare', rare: 'epic', epic: 'legendary'};
  function luckInfo(p) {
    const luck = Number(p?.attributes?.luck) || 0;
    return {luck, bump: Math.min(0.25, luck * 0.004), legMul: Math.max(1, Math.min(3, 1 + (luck - 8) / 40))};
  }
  let knownGear = null;
  function luckTick() {
    const p = me(), b = B(); if (!p?.inventory || !b?.setPlayer) return;
    const ids = new Set(p.inventory.map(i => i.id));
    if (!knownGear || knownGear.uid !== p.userId) { knownGear = {uid: p.userId, ids}; return; }
    const fresh = p.inventory.filter(i => !knownGear.ids.has(i.id) && isGear(i) && !i.serverOwned && RARITY_UP[i.rarity] && !/^(leg_|loot_|merge_|trade_|srv_|coop_|gem_)/.test(i.id));
    knownGear.ids = ids;
    const {bump} = luckInfo(p);
    for (const it of fresh) {
      if (Math.random() >= bump) continue;
      const to = RARITY_UP[it.rarity], stats = Object.fromEntries(Object.entries(it.stats || {}).map(([k, v]) => [k, typeof v === 'number' ? Math.round(v * 1.15) : v]));
      b.setPlayer(cur => cur && {...cur, inventory: cur.inventory.map(x => x.id === it.id ? {...x, rarity: to, stats, sellPrice: Math.round((x.sellPrice || 10) * 1.3)} : x)});
      setTimeout(() => { bigBanner(`🍀 Удача! «${it.name}» стал(а) ${RARITY_RU[to]}`, to === 'legendary'); sfx.play('coins'); }, 400);
    }
  }
  // ---------- respec: return every invested attribute point and distribute them again ----------
  const BASE_ATTR = {warrior: {strength: 16, vitality: 15, willpower: 12, agility: 10, luck: 8, spirit: 7, intelligence: 6}, berserker: {strength: 18, agility: 12, intelligence: 5, vitality: 12, luck: 10, spirit: 6, willpower: 11},
    knight: {strength: 14, agility: 9, intelligence: 7, vitality: 18, luck: 6, spirit: 9, willpower: 13}, rogue: {strength: 11, agility: 18, intelligence: 7, vitality: 10, luck: 15, spirit: 6, willpower: 8},
    assassin: {strength: 12, agility: 19, intelligence: 8, vitality: 9, luck: 14, spirit: 5, willpower: 9}, archer: {strength: 11, agility: 17, intelligence: 8, vitality: 10, luck: 12, spirit: 8, willpower: 9},
    mage: {strength: 6, agility: 9, intelligence: 19, vitality: 9, luck: 10, spirit: 15, willpower: 12}, necromancer: {strength: 7, agility: 9, intelligence: 18, vitality: 10, luck: 11, spirit: 14, willpower: 14},
    paladin: {strength: 14, agility: 9, intelligence: 12, vitality: 15, luck: 8, spirit: 13, willpower: 14}, druid: {strength: 11, agility: 11, intelligence: 14, vitality: 13, luck: 10, spirit: 15, willpower: 12}};
  const respecKey = () => 'aeth_respec_used_' + uid();
  const respecInfo = p => {
    const base = BASE_ATTR[p.classId === 'hunter' ? 'archer' : p.classId] || BASE_ATTR.warrior;
    const spent = Object.entries(p.attributes || {}).reduce((n, [k, v]) => n + Math.max(0, (v || 0) - (base[k] ?? v)), 0);
    const free = !localStorage.getItem(respecKey()), cost = free ? 0 : 50 * (p.level || 1);
    return {base, spent, cost, free};
  };
  function doRespec() {
    const p = me(), b = B(); if (!p || !b) return;
    const err = canAct(); if (err) return toast(err);
    const r = respecInfo(p);
    if (!r.spent) return toast('Вложенных очков нет — сбрасывать нечего.');
    if ((p.silver || 0) < r.cost) return toast(`Нужно ${fmt(r.cost)} серебра.`);
    if (!confirm(`Сбросить характеристики? Вернётся ${r.spent} очков, их можно распределить заново.${r.cost ? ` Стоимость: ${fmt(r.cost)} серебра.` : ' Первый сброс — бесплатно.'}`)) return;
    b.setPlayer(cur => {
      if (!cur || (cur.silver || 0) < r.cost) return cur;
      const attrs = {...cur.attributes}; let back = 0;
      for (const [k, v] of Object.entries(attrs)) { const bv = r.base[k]; if (bv != null && v > bv) { back += v - bv; attrs[k] = bv; } }
      return {...cur, attributes: attrs, statPoints: (cur.statPoints || 0) + back, silver: (cur.silver || 0) - r.cost};
    });
    localStorage.setItem(respecKey(), '1'); sfx.play('magic'); bigBanner(`♻️ Возвращено ${r.spent} очков характеристик`, false);
  }
  const respecButton = () => h('button', {type: 'button', class: 'ae-btn ae-wide ae-respec', 'data-ae-respec': '1', onclick: doRespec}, '♻️ Сбросить характеристики');
  function injectRespec() {
    const anchor = [...document.querySelectorAll('main span, main div, main p')].find(e => !e.childElementCount && /^(Свободно очков|Очки характеристик|Свободных очков)/i.test((e.textContent || '').trim()));
    if (!anchor) return;
    const row = anchor.parentElement; if (!row || row.parentElement.querySelector(':scope > [data-ae-respec]')) return;
    row.after(respecButton());
  }
  // ---------- arena: report each finished arena fight (for the arena quests) ----------
  let arenaSnap = null;
  function arenaTick() {
    const p = me(); if (!p) return;
    const cur = {uid: p.userId, rating: Number(p.arenaRating) || 0, tickets: Number(p.arenaTickets) || 0};
    const prev = arenaSnap; arenaSnap = cur; if (!prev || prev.uid !== cur.uid || prev.rating === cur.rating) return;
    const won = cur.rating > prev.rating;
    api('/api/quests/arena', 'POST', {won}).then(() => refreshQuestBadge?.()).catch(() => {});
  }
  function injectBag() {
    const anchor = [...document.querySelectorAll('button')].find(b => /Массовая продажа и разбор/.test(b.textContent || '') && !b.closest('.ae-panel'));
    if (!anchor) return;
    const n = mergeCount(me());
    let btn = anchor.parentElement.querySelector(':scope > [data-ae-bag-merge]');
    if (!btn) {
      btn = h('button', {type: 'button', class: 'ae-bag-merge', 'data-ae-bag-merge': '1', onclick: openMerge}, h('span', {class: 'ae-entry-icon'}, '⚒️'), h('span', {class: 'ae-grow'}, h('b', {}), h('small', {})), h('span', {class: 'ae-coop-go'}, '›'));
      anchor.parentElement.insertBefore(btn, anchor.nextSibling);
    }
    if (!anchor.parentElement.querySelector(':scope > [data-ae-gems]')) btn.after(h('button', {type: 'button', class: 'ae-bag-merge', 'data-ae-gems': '1', onclick: () => openGems()}, h('span', {class: 'ae-entry-icon'}, '💎'), h('span', {class: 'ae-grow'}, h('b', {}, 'Вставить кристалл'), h('small', {}, 'Вампиризм, крит, кровотечение… в снаряжение')), h('span', {class: 'ae-coop-go'}, '›')));
    if (!anchor.parentElement.querySelector(':scope > [data-ae-autoequip]')) btn.after(autoEquipToggle());
    const label = n ? `Объединить одинаковые · ${n}` : 'Объединить одинаковые', sub = n ? 'Есть пары для ★ — нажмите, чтобы выбрать' : 'Пар одинаковых вещей пока нет';
    if (btn.querySelector('b').textContent !== label) { btn.querySelector('b').textContent = label; btn.querySelector('small').textContent = sub; btn.classList.toggle('has-pairs', !!n); }
  }


  // ---------- leave a dungeon straight from a "go to settlement first" screen ----------
  function injectDungeonExit() {
    const note = [...document.querySelectorAll('main *, .game-dialog-backdrop *')].find(e => !e.childElementCount && /Сначала завершите поход или покиньте пещеру/.test(e.textContent || '') && e.offsetParent);
    if (!note) return;
    let host = note.parentElement; while (host && !host.querySelector('button')) host = host.parentElement;
    if (!host || host.closest('button') || host.querySelector('[data-ae-leave]')) return;
    host.append(h('button', {type: 'button', class: 'ae-bag-merge ae-leave', 'data-ae-leave': '1', onclick: () => {
      const b = B(); if (!b?.exitDungeon) return toast('Игра ещё загружается.');
      if (!confirm('Покинуть пещеру? Текущий поход закончится, полученные награды останутся.')) return;
      b.exitDungeon(); toast('Вы покинули пещеру. Путь в поселение…'); sfx.play('page');
      setTimeout(() => { const r = B()?.returnToSettlement?.(); if (r && r.success === false && r.message) toast(r.message); }, 400);
    }}, h('span', {class: 'ae-entry-icon'}, '🏃'), h('span', {class: 'ae-grow'}, h('b', {}, 'Покинуть пещеру и идти в поселение'), h('small', {}, 'Поход закончится, полученные награды сохранятся'))));
  }


  // ================= batch 5 =================
  // ---------- item tiles: own icon by name, rarity color, +N, ★, level ----------
  const ITEM_ICONS = [[/меч|клинок|сабл|шпаг|рапир/i, 'sword'], [/секир|топор/i, 'axe'], [/кинжал|нож|стилет/i, 'dagger'], [/\bлук\b|лук |арбалет/i, 'bow'], [/посох|жезл|скипетр|гримуар|том /i, 'staff'],
    [/молот|булав|кистен/i, 'hammer'], [/щит|баклер|тотем|эгида/i, 'shield'], [/шлем|капюшон|корона|маска|шапк|венец/i, 'helmet'], [/нагрудник|доспех|куртк|одеяни|мантия|роба|кольчуг|латы|броня/i, 'armor'],
    [/перчат|рукавиц|наруч/i, 'gloves'], [/сапог|ботин|обувь/i, 'boots'], [/плащ|накидк/i, 'cloak'], [/пояс|кушак/i, 'belt'], [/кольц|перстень/i, 'ring'], [/амулет|кулон|ожерель|медальон|реликви|талисман/i, 'amulet'],
    [/штан|поножи/i, 'pants'], [/кирк/i, 'pickaxe'], [/реторт/i, 'retort'], [/медн.*руд/i, 'copper-ore'], [/золот.*руд/i, 'gold-ore'], [/серебр.*руд/i, 'silver-ore'], [/руд|уголь|адамантит|драконит|эфириум|мифрил|слиток/i, 'iron-ore'],
    [/зелье ман|маны/i, 'mana-potion'], [/зелье|склянк|эликсир|настой/i, 'health-potion'], [/трав|лист/i, 'herb'], [/шкур|кож/i, 'hide'], [/клык|зуб|коготь|рог/i, 'fang'], [/мяс|филе|туш/i, 'meat'], [/нить|ткан|шёлк|шелк/i, 'thread'],
    [/кристал|самоцвет|камень|алмаз|рубин/i, 'crystal'], [/печать|знак|жетон|эмблем/i, 'seal'], [/монет/i, 'coin']];
  const RES_ICONS = [[/осколок вознес/i, 'spark'], [/пыль|пыльц/i, 'dust'], [/цвет|лепест/i, 'flower'], [/корень|корн/i, 'root'], [/чешу/i, 'scale'], [/искр/i, 'spark'], [/крыл|перо/i, 'wing'], [/ядро/i, 'core'], [/механизм|шестер/i, 'gear'],
    [/ключ/i, 'key'], [/эссенц|вода|сок|\bяд|железа/i, 'vial'], [/паутин/i, 'web'], [/осколок|кристал/i, 'crystal']];
  // Two art sets (light/leather and dark/plate) plus a per-name tint, so different items look different
  // while copies of the same item always share one icon.
  const GEAR_B = new Set(['armor', 'helmet', 'boots', 'gloves', 'amulet', 'ring', 'belt', 'cloak', 'pants']);
  const HEAVY_RE = /латн|стал|желез|рыцар|кольчуж|тёмн|темн|тен[еия]|демон|драк|костян|орден|страж|воит|паладин|гвард|чёрн|черн|адамант|мифрил|бездн|проклят|король|королев/i;
  const LIGHT_RE = /кож|ткан|шёлк|шелк|охотн|следопыт|странник|рекрут|стартов|прост|льнян|ученик|новичк|лесн|пастух|крестьян/i;
  const HUES = [0, 0, 28, -28, 150, 205, 265];
  const hashStr = str => { let x = 2166136261; for (const c of str) { x ^= c.codePointAt(0); x = Math.imul(x, 16777619); } return x >>> 0; };
  // Our own finds and crystals have their own painted icons (by kind × rarity).
  const OWN_ART_LIST = ["gear_amulet_epic", "gear_amulet_legendary", "gear_amulet_rare", "gear_amulet_uncommon", "gear_armor_epic", "gear_armor_legendary", "gear_armor_rare", "gear_armor_uncommon", "gear_artifact_epic", "gear_artifact_legendary", "gear_artifact_rare", "gear_artifact_uncommon", "gear_axe_epic", "gear_axe_legendary", "gear_axe_rare", "gear_axe_uncommon", "gear_belt_epic", "gear_belt_legendary", "gear_belt_rare", "gear_belt_uncommon", "gear_boots_epic", "gear_boots_legendary", "gear_boots_rare", "gear_boots_uncommon", "gear_bow_epic", "gear_bow_legendary", "gear_bow_rare", "gear_bow_uncommon", "gear_cloak_epic", "gear_cloak_legendary", "gear_cloak_rare", "gear_cloak_uncommon", "gear_dagger_epic", "gear_dagger_legendary", "gear_dagger_rare", "gear_dagger_uncommon", "gear_gloves_epic", "gear_gloves_legendary", "gear_gloves_rare", "gear_gloves_uncommon", "gear_hammer_epic", "gear_hammer_legendary", "gear_hammer_rare", "gear_hammer_uncommon", "gear_helmet_epic", "gear_helmet_legendary", "gear_helmet_rare", "gear_helmet_uncommon", "gear_pants_epic", "gear_pants_legendary", "gear_pants_rare", "gear_pants_uncommon", "gear_ring_epic", "gear_ring_legendary", "gear_ring_rare", "gear_ring_uncommon", "gear_shield_epic", "gear_shield_legendary", "gear_shield_rare", "gear_shield_uncommon", "gear_staff_epic", "gear_staff_legendary", "gear_staff_rare", "gear_staff_uncommon"];
  const OWN_WEAPON = [[/^Секира/, 'axe'], [/^Молот/, 'hammer'], [/^Кинжал/, 'dagger'], [/^Лук/, 'bow'], [/^Посох/, 'staff'], [/^Копь/, 'spear'], [/^Булава/, 'mace'], [/^Коса/, 'scythe'], [/^Жезл/, 'wand'], [/^Меч/, 'sword']];
  // pictures that exist (filled in as art arrives); a missing v2 falls back to v1, a missing new kind to the nearest old one
  const OWN_ART = new Set(OWN_ART_LIST);
  const KIND_FALLBACK = {spear: 'sword', mace: 'hammer', scythe: 'staff', wand: 'staff'};
  function ownIcon(item) {
    const t = String(item?.templateId || '');
    let m = t.match(/^ae_gem_([a-z]+)$/); if (m) return '/assets/items/gear/gem_' + m[1] + '.webp';
    m = t.match(/^ae_gear_(uncommon|rare|epic|legendary)_([a-z]+)_\d+(?:_v(\d))?$/) || t.match(/^ae_leg_([a-z]+)_\d+$/);
    if (!m) return null;
    const isGear = t.startsWith('ae_gear_'), rarity = isGear ? m[1] : 'legendary', type = isGear ? m[2] : m[1], v = isGear && m[3] === '2' ? 2 : 1;
    let kind = type === 'offhand' ? 'shield' : type;
    if (type === 'weapon') kind = (OWN_WEAPON.find(([re]) => re.test(item.name || '')) || [0, 'sword'])[1];
    const pick = k => [v === 2 && `gear_${k}_${rarity}_2`, `gear_${k}_${rarity}`].filter(Boolean).find(f => OWN_ART.has(f));
    const f = pick(kind) || (KIND_FALLBACK[kind] && pick(KIND_FALLBACK[kind]));
    return f ? `/assets/items/gear/${f}.webp` : null; // no picture yet (e.g. swords): the game's own icon
  }
  function iconInfo(item) {
    const own = ownIcon(item); if (own) return {src: own, hue: 0};
    const n = baseName(item || {});
    for (const [re, f] of RES_ICONS) if (re.test(n)) return {src: '/assets/sprites/generated/ui/resources/' + f + '.webp', hue: 0};
    // Gear: the slot type decides the picture (a pants item named «…клинка» must not get a sword); the name only picks the weapon kind.
    const TYPE_ICON = {helmet: 'helmet', armor: 'armor', pants: 'pants', gloves: 'gloves', boots: 'boots', cloak: 'cloak', belt: 'belt', ring: 'ring', amulet: 'amulet', offhand: 'shield', pickaxe: 'pickaxe', alchemyTool: 'retort'};
    const WEAPONS = new Set(['sword', 'axe', 'dagger', 'bow', 'staff', 'hammer']);
    let byType = TYPE_ICON[item?.type];
    if (item?.type === 'weapon') byType = (ITEM_ICONS.find(([re, f]) => WEAPONS.has(f) && re.test(n)) || [0, 'sword'])[1];
    const pairs = byType ? [[/(?:)/, byType]] : ITEM_ICONS;
    for (const [re, f] of pairs) if (re.test(n)) {
      const x = hashStr(n.toLocaleLowerCase());
      const useB = GEAR_B.has(f) && (HEAVY_RE.test(n) || (!LIGHT_RE.test(n) && (x & 1)));
      const gearish = !/ore|potion|herb|hide|fang|meat|thread|crystal|seal|coin|pickaxe|retort/.test(f);
      return {src: useB ? '/assets/sprites/generated/ui/gear/' + f + '.webp' : '/assets/items/sprites/' + f + '.webp', hue: gearish ? HUES[(x >>> 3) % HUES.length] : 0};
    }
    return null;
  }
  const iconFor = item => iconInfo(item)?.src || null;
  const iconStyle = item => { const hue = iconInfo(item)?.hue || 0; return hue ? `filter:hue-rotate(${hue}deg)` : null; };
  function applyIcon(img, item) {
    const ic = iconInfo(item); if (!img || !ic || img.dataset.aeFailed) return;
    if (img.getAttribute('src') !== ic.src) { img.onerror = () => { img.dataset.aeFailed = '1'; img.style.filter = ''; }; img.setAttribute('src', ic.src); }
    const f = ic.hue ? `hue-rotate(${ic.hue}deg)` : ''; if (img.style.filter !== f) img.style.filter = f;
  }
  function findItem(id) {
    const p = me(); if (!p) return null;
    return (p.inventory || []).find(i => String(i.id) === String(id)) || Object.values(p.equipped || {}).find(i => i && String(i.id) === String(id)) || null;
  }
  function decorateTiles() {
    for (const tile of document.querySelectorAll('[data-inventory-item]')) {
      const item = findItem(tile.getAttribute('data-inventory-item')); if (!item) continue;
      const rarity = item.rarity || 'common'; if (tile.getAttribute('data-ae-rarity') !== rarity) tile.setAttribute('data-ae-rarity', rarity);
      applyIcon(tile.querySelector('img'), item);
      const key = [item.upgradeLevel || 0, ascOf(item), item.level || 1, item.stackCount || 1].join('|');
      let badges = tile.querySelector(':scope > .ae-badges');
      if (badges && badges.dataset.key === key) continue;
      if (!badges) { badges = h('span', {class: 'ae-badges', 'aria-hidden': 'true'}); tile.append(badges); tile.classList.add('ae-tile'); }
      badges.dataset.key = key;
      badges.replaceChildren(
        (item.upgradeLevel || 0) > 0 ? h('b', {class: 'ae-b-up'}, '+' + item.upgradeLevel) : '',
        ascOf(item) ? h('b', {class: 'ae-b-asc'}, '★' + ascOf(item)) : '',
        isGear(item) ? h('b', {class: 'ae-b-lvl'}, (item.level || 1) + '') : '');
    }
  }

  // ---------- land icons ----------
  const LANDS = [['Зеленые равнины', 'reg_plains'], ['Зелёные равнины', 'reg_plains'], ['Шепчущий лес', 'reg_whisper_woods'], ['Забытый склеп', 'reg_forgotten_crypt'], ['Тёмный лес', 'reg_forest'], ['Темный лес', 'reg_forest'],
    ['Гиблые болота', 'reg_swamp'], ['Пылающая пустыня', 'reg_desert'], ['Проклятые земли', 'reg_cursed'], ['Демонический разлом', 'reg_rift'], ['Драконий сандор', 'reg_dragon']];
  const landOf = t => (LANDS.find(([n]) => t.startsWith(n)) || [])[1];
  function decorateLands() {
    for (const img of document.querySelectorAll('main img[src$="/icons/map.webp"], main .atlas-node img[src$="/icons/bestiary.webp"], main .beta-world-tile img[src$="/icons/bestiary.webp"]')) {
      let card = img.parentElement; for (let i = 0; i < 7 && card && !(card.tagName === 'BUTTON' || card.getAttribute('role') === 'button' || card.classList.contains('region-dispatch')); i++) card = card.parentElement;
      if (!card || /комнат/.test(card.textContent)) continue;
      const leaf = [...card.querySelectorAll('*')].find(e => !e.childElementCount && landOf((e.textContent || '').trim()));
      const reg = leaf && landOf(leaf.textContent.trim()); if (!reg) continue;
      img.setAttribute('src', '/assets/regions/region-' + reg + '.webp'); img.classList.add('ae-land-icon'); img.removeAttribute('width'); img.removeAttribute('height');
      const box = img.closest('span.grid'); if (box) box.classList.add('ae-land-box');
    }
  }

  // ---------- toasts: new private messages / friend requests / duels ----------
  const pulseKey = () => 'aeth_pulse_seen_' + uid();
  async function socialPulse() {
    if (!uid() || document.hidden) return;
    let r; try { r = await api('/api/social/pulse'); } catch { return; }
    let seen; try { seen = JSON.parse(localStorage.getItem(pulseKey()) || '{}'); } catch { seen = {}; }
    const notes = [];
    for (const f of r.friendRequests || []) if (!seen['f' + f.id]) { seen['f' + f.id] = 1; notes.push({icon: '👋', text: `${f.name} хочет добавить вас в друзья`, act: 'Открыть', fn: () => openFriends('requests')}); }
    if (r.lastMessage && seen.m !== r.lastMessage.id) { seen.m = r.lastMessage.id; notes.push({icon: '✉️', text: `${r.lastMessage.name}: ${r.lastMessage.text}`, act: 'Ответить', fn: () => openChat({id: r.lastMessage.from, name: r.lastMessage.name})}); }
    for (const d of r.duelsAgainstMe || []) if (!seen['d' + d.id]) { seen['d' + d.id] = 1; notes.push({icon: '⚔️', text: d.won ? `${d.by} победил(а) вашу тень в дуэли` : `Ваша тень отразила вызов ${d.by}`, act: 'Ответить', fn: () => openDuel(d.by)}); }
    localStorage.setItem(pulseKey(), JSON.stringify(seen));
    notes.slice(0, 3).forEach((n, i) => setTimeout(() => popup(n), i * 2200));
    const evs = r.events || [];
    evs.forEach((e, i) => setTimeout(() => applyEvent(e), (notes.length + i) * 2200));
    if (evs.length) api('/api/social/events/ack', 'POST', {ids: evs.map(e => e.id)}).catch(() => {});
    if (evs.length || (r.friendRequests || []).length) setTimeout(() => loadInbox(true), 1500);
  }
  function popup({icon, text, act, fn}) {
    const el = h('div', {class: 'ae-pop', role: 'status'}, h('span', {class: 'ae-pop-i'}, icon), h('span', {class: 'ae-grow'}, text),
      act ? h('button', {class: 'ae-btn ae-primary', type: 'button', onclick: () => { el.remove(); fn?.(); }}, act) : '', h('button', {class: 'ae-pop-x', type: 'button', 'aria-label': 'Закрыть', onclick: () => el.remove()}, '×'));
    document.body.append(el); sfx.play('bell', 0.4); setTimeout(() => el.classList.add('is-on'), 20); setTimeout(() => el.remove(), 9000);
  }
  setTimeout(socialPulse, 6000); setInterval(socialPulse, 30000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) socialPulse(); });

  // ---------- duels (turn-based PvP vs the opponent's shadow) ----------
  function openDuel(prefill = '') {
    let info = null, duel = null, busy = false, name = prefill, skillsOpen = false;
    const rerender = () => st.rerender();
    const load = async () => { try { info = await api('/api/duel'); duel = info.active; } catch (e) { toast(cleanError(e)); } st.rerender(); };
    let prev = null, shake = {}; const floats = [];
    const feel = d => {
      if (!d) return;
      for (const [side, f] of [['foe', d.foe], ['me', d.me]]) {
        const was = prev?.[side];
        if (was != null && f.hp < was) { floats.push({side, text: '−' + fmt(was - f.hp), cls: side === 'me' ? 'is-hurt' : 'is-dmg'}); shake[side] = Date.now() + 380; if (side === 'me') try { Telegram.WebApp.HapticFeedback.impactOccurred('medium'); } catch {} }
        if (was != null && f.hp > was) floats.push({side, text: '+' + fmt(f.hp - was), cls: 'is-heal'});
      }
      prev = {foe: d.foe.hp, me: d.me.hp};
    };
    const act = async (path, body) => { if (busy) return; busy = true; try { const r = await api(path, 'POST', body); duel = r.duel; feel(duel); const last = duel?.log?.slice(-3) || [];
        if (last.some(l => l.crit)) sfx.play('heavy'); else if (last.some(l => l.heal)) sfx.play('magic'); else sfx.play('hit');
        if (duel && duel.status !== 'active') { sfx.play(duel.status === 'won' ? 'bell' : 'fail'); info = await api('/api/duel'); } }
      catch (e) { toast(cleanError(e)); } finally { busy = false; st.rerender(); } };
    const claim = async () => { try { const r = await api('/api/duel/claim', 'POST', {}); const b = B(); b.setPlayer(p => { if (!p) return p; const n = {...p, gold: (p.gold || 0) + r.reward.gold}; return b.gainExp ? b.gainExp(n, r.reward.exp).player : n; });
        toast(`Награда: +${fmt(r.reward.gold)} 🪙 +${fmt(r.reward.exp)} опыта`); b.sound?.playVictory?.(); duel = {...duel, reward: {...duel.reward, claimed: true}}; st.rerender(); } catch (e) { toast(cleanError(e)); } };
    const bar = (cur, max, cls) => h('div', {class: 'ae-bar ' + (cls || '')}, h('i', {style: `width:${Math.max(0, Math.min(100, 100 * cur / Math.max(1, max)))}%`}), h('span', {}, `${fmt(cur)} / ${fmt(max)}`));
    const fighterCard = (f, foe) => h('div', {class: 'ae-card' + (foe ? ' ae-foe' : '')}, h('div', {class: 'ae-row'}, h('b', {class: 'ae-grow'}, (foe ? '👤 ' : '🛡️ ') + f.name), h('span', {class: 'ae-sub'}, `${f.className} · ${f.level} ур.${f.guard ? ' · 🛡️' : ''}`)),
      bar(f.hp, f.maxHp, foe ? 'is-foe' : ''), h('div', {class: 'ae-bar is-mp'}, h('i', {style: `width:${100 * f.mp / f.maxMp}%`}), h('span', {}, `MP ${f.mp} / ${f.maxMp}`)));
    const st = openPanel('⚔️ Дуэли', body => {
      if (!info) return body.append(h('p', {class: 'ae-empty'}, 'Загрузка…'));
      if (!duel || (duel.status !== 'active' && !duel.log)) {
        body.append(h('p', {class: 'ae-note'}, 'Вызовите любого героя по нику. Он не обязан быть в сети — с вами сразится его тень с силой по уровню и классу. Победа: рейтинг дуэлей, золото и опыт (награда до 10 побед в день). Соперник получит сообщение о вашем вызове.'));
        body.append(h('div', {class: 'ae-pill'}, `Рейтинг дуэлей: ${info.rating} · Победы ${info.wins} · Поражения ${info.losses}`));
        const input = h('input', {class: 'ae-input', placeholder: 'Ник героя или @username', value: name, maxlength: 40});
        const go = () => { name = input.value.trim(); if (name.length < 2) return toast('Введите ник.'); act('/api/duel/start', {name}); };
        input.addEventListener('keydown', e => e.key === 'Enter' && go());
        body.append(h('div', {class: 'ae-row'}, input, h('button', {class: 'ae-btn ae-primary', type: 'button', onclick: go}, 'Бросить вызов')));
        if (info.top?.length) { body.append(h('h3', {class: 'ae-h3'}, 'Лучшие дуэлянты')); info.top.forEach((t, i) => body.append(h('div', {class: 'ae-row ae-card'}, h('b', {}, `${i + 1}.`), h('span', {class: 'ae-grow'}, t.name), h('span', {class: 'ae-sub'}, `${t.rating} · ${t.wins} поб.`),
          String(t.id) !== uid() ? h('button', {class: 'ae-btn', type: 'button', onclick: () => act('/api/duel/start', {targetId: t.id})}, '⚔️') : ''))); }
        return;
      }
      if (prev == null) feel(duel);
      battleMode(body, duel.status === 'active');
      if (duel.status === 'active') {
        const D = duel, mm = D.me, ff = D.foe;
        const fxText = f => { const c = []; if (f.guard) c.push('🛡️ защита'); if (f.barrier) c.push(`🛡️ щит ${f.barrier}`); if (f.fury) c.push('📯 ярость'); if (f.vuln) c.push('🎯 уязвим'); if (f.stunned) c.push('💫 оглушён'); for (const d0 of f.dots || []) c.push(`${d0.icon} ${d0.name}`); return c.join(' · '); };
        const doAct = (a, extra) => () => act('/api/duel/act', {action: a, ...(extra || {})});
        body.append(battleView({
          location: 'Арена дуэлей', mode: 'PvP-дуэль', round: `Ход ${D.turn}`, scene: '/assets/arena-D132A-sN.webp',
          turn: mm.stunned ? 'Вы оглушены — ход будет пропущен' : 'Ваш ход — выберите действие', turnShort: 'Ваш ход',
          hero: {name: mm.name, cls: mm.className, level: mm.level, hp: mm.hp, maxHp: mm.maxHp, mp: mm.mp, maxMp: mm.maxMp, mpLabel: 'MANA', portrait: heroPortrait(mm.classId), body: heroBody(mm.classId)},
          foe: {name: ff.name, level: `${ff.className} · Ур. ${ff.level}`, hp: ff.hp, maxHp: ff.maxHp, atk: ff.atk, def: ff.def, img: isModern() ? heroPortrait(ff.classId) : heroBody(ff.classId), mirror: true},
          note: [fxText(mm) && `Вы: ${fxText(mm)}`, fxText(ff) && `Соперник: ${fxText(ff)}`].filter(Boolean).join(' | ') || (D.log || []).at(-1)?.text,
          intent: D.intent ? {label: 'Тень соперника готовит:', name: D.intent, text: /мощный навык|навык/.test(D.intent) ? '💡 Встаньте в защиту — урон по вам снизится.' : ''} : null,
          series: {label: 'Дуэль', value: `Мана соперника ${ff.mp}/${ff.maxMp}`, sub: 'Навыки и таланты героев — как в обычном бою'},
          actions: [{kind: 'attack', label: 'Атака', disabled: busy, onClick: doAct('attack')},
            {kind: 'skill', label: 'Навыки', disabled: busy, attr: {'aria-expanded': String(skillsOpen), 'aria-controls': 'combat-skills'}, onClick: () => { skillsOpen = !skillsOpen; rerender(); }},
            {kind: 'defend', label: 'Защита (+25% MP)', disabled: busy, onClick: doAct('guard')},
            {kind: 'potion', label: `Зелье (${mm.potions ?? 0})`, disabled: busy || !(mm.potions > 0), onClick: doAct('potion')}],
          secondary: [{label: 'Сдаться', kind: 'leave', onClick: () => confirm('Сдаться?') && act('/api/duel/act', {action: 'flee'})}],
          log: (D.log || []).map(l => l.text),
          menu: skillsOpen ? skillMenu({mp: mm.mp, disabled: busy, onClose: () => { skillsOpen = false; rerender(); }, onUse: k => { skillsOpen = false; doAct('skill', {skillId: k.id})(); }}) : null}));
        if ((shake.foe || 0) > Date.now()) body.querySelector('[data-bv-foe]')?.classList.add('ae-shake');
        if ((shake.me || 0) > Date.now()) body.querySelector('[data-bv-hero]')?.classList.add('ae-shake');
        requestAnimationFrame(() => { while (floats.length) { const f = floats.shift(), el = body.querySelector(f.side === 'me' ? '[data-bv-hero]' : '[data-bv-foe]'); if (!el) continue;
          const r = el.getBoundingClientRect(), n = h('div', {class: 'ae-float ' + f.cls, style: `left:${r.left + r.width * 0.4}px;top:${r.top + r.height * 0.3}px`}, f.text); document.body.append(n); setTimeout(() => n.remove(), 1100); } });
        return;
      }
      const chips = f => { const fx = f.fx || {}, c = [];
        if (f.guard) c.push('🛡️ защита'); if (fx.rage) c.push(`📯 +30% урона · ${fx.rage}`); if (fx.wall) c.push(`🧱 −50% урона · ${fx.wall}`); if (fx.mark) c.push(`🎯 метка · ${fx.mark}`); if (fx.stun) c.push('🌿 опутан');
        for (const d0 of fx.dots || []) c.push(`${d0.icon} ${d0.name} · ${d0.left}`);
        return c.length ? h('div', {class: 'ae-chips'}, c.map(x => h('span', {class: 'ae-chip'}, x))) : ''; };
      const side = (f, who) => h('div', {class: `ae-duelist is-${who}` + ((shake[who] || 0) > Date.now() ? ' ae-shake' : ''), 'data-ae-duelist': who},
        h('img', {class: 'ae-duelist-img', src: `/assets/sprites/generated/heroes/combat/${f.classId === 'hunter' ? 'archer' : f.classId}.webp`, alt: '', onerror: e => { e.target.src = '/assets/sprites/generated/heroes/combat/warrior.webp'; }}),
        h('div', {class: 'ae-duelist-info'}, h('b', {}, (who === 'foe' ? '👤 ' : '🛡️ ') + f.name), h('small', {}, `${f.className} · ${f.level} ур.`),
          bar(f.hp, f.maxHp, who === 'foe' ? 'is-foe' : ''), h('div', {class: 'ae-bar is-mp'}, h('i', {style: `width:${100 * f.mp / f.maxMp}%`}), h('span', {}, `MP ${f.mp} / ${f.maxMp}`)), chips(f)));
      body.append(h('div', {class: 'ae-arena'}, h('div', {class: 'ae-arena-turn'}, duel.status === 'active' ? `Ход ${duel.turn}` : 'Бой окончен'), side(duel.foe, 'foe'),
        duel.intent ? h('div', {class: 'ae-intent' + (/сильный|×|Огненный|Удар в спину|ярость/.test(duel.intent) ? ' is-heavy' : '')}, h('span', {class: 'ae-intent-i'}, duel.intentKind === 'skill' ? '✨' : duel.intentKind === 'heal' ? '💚' : duel.intentKind === 'guard' ? '🛡️' : '🗡️'),
          h('span', {class: 'ae-grow'}, h('small', {}, 'Тень соперника готовит'), duel.intent)) : '',
        h('div', {class: 'ae-vs'}, 'VS'), side(duel.me, 'me')));
      if (duel.status === 'active') {
        const m = duel.me.mp, sk = duel.me.skill, cd = duel.me.cd || 0;
        const b2 = (a, l, sub, dis, extra = '') => h('button', {class: 'ae-btn ae-act' + extra, type: 'button', disabled: busy || dis, onclick: () => act('/api/duel/act', {action: a})}, h('b', {}, l), h('small', {}, sub));
        body.append(h('div', {class: 'ae-grid2 ae-acts'}, b2('attack', '⚔️ Атака', 'обычный удар'), b2('power', '💥 Сильный удар', '×1.9 · 20 MP', m < 20),
          sk ? b2('skill', `${sk.icon} ${sk.name}`, cd ? `перезарядка ${cd} ход.` : sk.text, cd > 0, ' ae-spell' + (cd ? '' : ' is-ready')) : '', b2('heal', '💚 Лечение', '22% HP · 25 MP', m < 25),
          b2('guard', '🛡️ Защита', '−55% урона, +15 MP'), h('button', {class: 'ae-btn ae-act', type: 'button', onclick: () => confirm('Сдаться?') && act('/api/duel/act', {action: 'flee'})}, h('b', {}, '🏳️ Сдаться'), h('small', {}, 'поражение'))));
      } else {
        body.append(h('div', {class: 'ae-card ae-result ' + (duel.status === 'won' ? 'is-win' : 'is-loss')}, h('b', {}, duel.status === 'won' ? '🏆 Победа!' : '💀 Поражение'), h('div', {class: 'ae-sub'}, `Рейтинг: ${duel.ratingChange > 0 ? '+' : ''}${duel.ratingChange}`)));
        if (duel.reward && !duel.reward.claimed) body.append(h('button', {class: 'ae-btn ae-primary ae-wide', type: 'button', onclick: claim}, `🎁 Забрать: ${fmt(duel.reward.gold)} 🪙 и ${fmt(duel.reward.exp)} опыта`));
        body.append(h('button', {class: 'ae-btn ae-wide', type: 'button', onclick: () => { duel = null; load(); }}, 'Новый вызов'));
      }
      body.append(h('div', {class: 'ae-log ae-duel-log'}, (duel.log || []).slice().reverse().map(l => h('div', {class: l.who ? (String(l.who) === String(duel.me.id) ? 'is-me' : 'is-foe') : ''}, l.text))));
      requestAnimationFrame(() => { while (floats.length) { const f = floats.shift(), el = body.querySelector(`[data-ae-duelist="${f.side}"] .ae-duelist-img`); if (!el) continue;
        const r = el.getBoundingClientRect(), n = h('div', {class: 'ae-float ' + f.cls, style: `left:${r.left + r.width * 0.4}px;top:${r.top + 20}px`}, f.text); document.body.append(n); setTimeout(() => n.remove(), 1100); } });
    }, {cls: 'ae-duel-panel'});
    load();
  }

  // Currencies and fragments live on the device: one place that adds a reward to the hero (promo codes, mail gifts).
  function grantReward(w) {
    const b = B(); if (!b?.setPlayer) return [];
    b.setPlayer(p => { if (!p) return p; let inv = p.inventory;
      if (w.fragments) { inv = inv.slice(); const i = inv.findIndex(x => x.templateId === 'ascension_fragment' && !x.serverOwned && !x.isLocked); if (i >= 0) inv[i] = {...inv[i], stackCount: (inv[i].stackCount || 1) + w.fragments}; else inv.push({id: 'promo_' + uuid4(), templateId: 'ascension_fragment', name: 'Осколок вознесения', type: 'material', rarity: 'rare', level: 1, upgradeLevel: 0, icon: '✦', stats: {}, sellPrice: 0, disassembleYield: {}, stackCount: w.fragments}); }
      return {...p, inventory: inv, gold: (p.gold || 0) + (w.gold || 0), silver: (p.silver || 0) + (w.silver || 0), energy: w.energy ? Math.min(p.maxEnergy || ENERGY_CAP, (p.energy || 0) + w.energy) : p.energy, arenaTickets: (p.arenaTickets || 0) + (w.arenaTickets || 0)}; });
    return giftParts(w);
  }
  const giftParts = w => [w.premiumDays && `Premium на ${w.premiumDays} дн.`, w.gold && `${fmt(w.gold)} 🪙`, w.silver && `${fmt(w.silver)} 🥈`, w.fragments && `${w.fragments} ✦`, w.energy && `${w.energy} ⚡`, w.arenaTickets && `${w.arenaTickets} 🎟️`].filter(Boolean);

  // ---------- 🔔 bell in the header: notification history (also while offline) and mail from the administration ----------
  let inboxData = null, inboxAt = 0, inboxBusy = false;
  const BELL_SVG = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></svg>';
  async function loadInbox(force) {
    if (!uid() || inboxBusy || (!force && Date.now() - inboxAt < 55e3)) return inboxData;
    inboxBusy = true; try { inboxData = await api('/api/ae-inbox'); inboxAt = Date.now(); paintBell(); } catch {} finally { inboxBusy = false; }
    resumeMailClaim(); return inboxData;
  }
  setTimeout(() => loadInbox(true), 7000); setInterval(() => { if (!document.hidden) loadInbox(); }, 60e3);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) loadInbox(true); });
  const bellCount = () => (inboxData?.unread || 0) + (inboxData?.friendReq || 0);
  function paintBell() {
    const n = bellCount();
    for (const b of document.querySelectorAll('[data-ae-bell]')) { const badge = b.querySelector('.ae-bell-n'); badge.textContent = n > 99 ? '99+' : String(n); badge.hidden = !n; b.classList.toggle('has-new', !!n); }
  }
  function injectBell() {
    const modernSound = document.querySelector('header .modern-header-inner button[aria-label="Переключить звук"]');
    const fantasyRow = document.querySelector('header .shell-brand-row');
    const make = cls => { const b = h('button', {type: 'button', class: cls + ' ae-bell', 'data-ae-bell': '1', 'aria-label': 'Уведомления и почта', onclick: () => openInbox()}, h('span', {class: 'ae-bell-n', hidden: true}, '0'));
      b.insertAdjacentHTML('afterbegin', BELL_SVG); return b; };
    if (modernSound && !modernSound.parentElement.querySelector(':scope > [data-ae-bell]')) { const wrap = modernSound.parentElement;
      let group = wrap.querySelector(':scope > .ae-head-tools'); if (!group) { group = h('div', {class: 'ae-head-tools'}); modernSound.before(group); group.append(modernSound); }
      group.prepend(make(modernSound.className)); paintBell(); }
    // fantasy: in the free space right after the hero's name block (both the full and the compact header)
    const hero = document.querySelector('header .shell-hud-content > .shell-hero-button');
    if (hero && !hero.parentElement.querySelector(':scope > [data-ae-bell]')) { document.querySelectorAll('header .shell-brand-row [data-ae-bell]').forEach(e => e.remove()); hero.after(make('ae-bell-f ae-bell-nick')); paintBell(); }
    if (hero) { // placed by hand next to the nickname (the hero block is a button, the bell cannot live inside it)
      const bell = hero.parentElement.querySelector(':scope > [data-ae-bell]'), nameRow = hero.querySelector('.flex.min-w-0.items-center') || hero.querySelector('span span');
      if (bell && nameRow) { const box = hero.parentElement.getBoundingClientRect(), last = nameRow.lastElementChild || nameRow, r = last.getBoundingClientRect(), z = pageZoom();
        const res = hero.parentElement.querySelector('.shell-hud-resources')?.getBoundingClientRect(), maxLeft = res && res.top < r.bottom && res.bottom > r.top ? (res.left - box.left) / z - 36 : 1e4;
        const left = Math.round(Math.min((r.right - box.left) / z + 10, maxLeft)), top = Math.round(((r.top + r.bottom) / 2 - box.top) / z - 15);
        if (bell.style.left !== left + 'px') bell.style.left = left + 'px'; if (bell.style.top !== top + 'px') bell.style.top = top + 'px'; } }
    else if (!hero && fantasyRow && !document.querySelector('header [data-ae-bell]')) { const set = fantasyRow.querySelector('details.shell-settings'); const b = make('ae-bell-f ae-bell-row'); if (set) set.before(b); else fantasyRow.append(b); paintBell(); }
  }
  const agoText = at => { const m = Math.max(0, Math.round((Date.now() - Date.parse(at)) / 60e3)); return m < 1 ? 'только что' : m < 60 ? `${m} мин назад` : m < 1440 ? `${Math.floor(m / 60)} ч назад` : new Date(at).toLocaleDateString('ru-RU', {day: 'numeric', month: 'short'}); };
  const EVENT_OPEN = {market: () => openAuction('mine'), 'market-item': () => openAuction('mine'), 'lot-offer': () => openAuction('mine'), 'auction-outbid': () => openAuction('all'), 'buy-request': () => openAuction('req')};
  const mailDoneKey = () => 'aeth_mail_done_' + uid(), mailPendKey = () => 'aeth_mail_pending_' + uid();
  const mailDone = () => { try { return new Set(JSON.parse(localStorage.getItem(mailDoneKey()) || '[]')); } catch { return new Set(); } };
  async function claimMail(m, opIn) {
    const done = mailDone(); if (done.has(m.id)) return toast('Подарок уже получен.');
    let pend; try { pend = JSON.parse(localStorage.getItem(mailPendKey()) || 'null'); } catch { pend = null; }
    const op = opIn || (pend?.id === m.id ? pend.op : uuid4()); localStorage.setItem(mailPendKey(), JSON.stringify({id: m.id, op}));
    try {
      const r = await api('/api/ae-inbox/claim', 'POST', {id: m.id, operationId: op});
      const d = mailDone(); if (!d.has(m.id)) { const parts = grantReward(r.gifts || {}); d.add(m.id); localStorage.setItem(mailDoneKey(), JSON.stringify([...d].slice(-300))); toast(`🎁 Получено: ${parts.join(', ')}`); B()?.sound?.playVictory?.(); }
      localStorage.removeItem(mailPendKey()); if (r.gifts?.premiumDays) setTimeout(() => checkPremium(), 800);
      m.claimed = true; return true;
    } catch (e) { if (/уже получен|не найдено/i.test(String(e?.message || ''))) localStorage.removeItem(mailPendKey()); toast(cleanError(e)); return false; }
  }
  // a claim cut off mid-way (closed app, lost network) is finished on the next load
  function resumeMailClaim() {
    let pend; try { pend = JSON.parse(localStorage.getItem(mailPendKey()) || 'null'); } catch { pend = null; }
    if (pend?.id && !mailDone().has(pend.id)) claimMail({id: pend.id}, pend.op).then(() => loadInbox(true));
  }
  function openInbox(tab) {
    let d = inboxData; tab ||= (d?.mail || []).some(m => !m.read || (Object.keys(m.gifts || {}).length && !m.claimed)) ? 'mail' : 'events';
    const markSeen = () => { const ids = (d?.mail || []).filter(m => !m.read).map(m => m.id); if (!d) return;
      if (tab === 'events' || ids.length) api('/api/ae-inbox/seen', 'POST', {mail: tab === 'mail' ? ids : []}).then(() => { if (tab === 'mail') ids.forEach(id => { const m = d.mail.find(x => x.id === id); if (m) m.read = true; }); else d.events.forEach(e => { e.isNew = false; });
        d.unread = d.events.filter(e => e.isNew).length + d.mail.filter(m => !m.read || (Object.keys(m.gifts || {}).length && !m.claimed)).length; paintBell(); }, () => {}); };
    const st = openPanel('🔔 Уведомления', body => {
      const newEv = (d?.events || []).filter(e => e.isNew).length, newMail = (d?.mail || []).filter(m => !m.read || (Object.keys(m.gifts || {}).length && !m.claimed)).length;
      body.append(h('div', {class: 'ae-tabs'}, [['events', `🔔 События${newEv ? ' ' + newEv : ''}`], ['mail', `✉️ Почта${newMail ? ' ' + newMail : ''}`]].map(([k, l]) => h('button', {type: 'button', class: 'ae-tab' + (tab === k ? ' is-on' : ''), onclick: () => { tab = k; st.rerender(); markSeen(); }}, l))));
      if (!d) return body.append(h('p', {class: 'ae-empty'}, 'Загрузка…'));
      if (tab === 'events') {
        const extra = [];
        if (d.friendReq) extra.push(h('button', {type: 'button', class: 'ae-inbox-row is-new', onclick: () => { closePanel(); openFriends('requests'); }}, h('span', {class: 'ae-inbox-i'}, '👋'), h('span', {class: 'ae-grow'}, h('b', {}, `Заявки в друзья: ${d.friendReq}`), h('small', {}, 'Нажмите, чтобы ответить'))));
        if (d.pm) extra.push(h('button', {type: 'button', class: 'ae-inbox-row is-new', onclick: () => { closePanel(); openFriends(); }}, h('span', {class: 'ae-inbox-i'}, '💬'), h('span', {class: 'ae-grow'}, h('b', {}, `Непрочитанные сообщения: ${d.pm}`), h('small', {}, 'Друзья → личные сообщения'))));
        body.append(...extra);
        if (!d.events.length && !extra.length) body.append(h('p', {class: 'ae-empty'}, 'Пока тихо. Здесь появятся продажи, ставки, дуэли, клан, питомец и всё, что случилось, пока вас не было.'));
        for (const e of d.events) { const go = EVENT_OPEN[e.kind];
          body.append(h(go ? 'button' : 'div', {type: go ? 'button' : null, class: 'ae-inbox-row' + (e.isNew ? ' is-new' : ''), onclick: go ? () => { closePanel(); go(); } : null},
            h('span', {class: 'ae-inbox-i'}, e.icon || '🔔'), h('span', {class: 'ae-grow'}, h('span', {}, e.text), h('small', {}, agoText(e.at))), go ? h('span', {class: 'ae-coop-go'}, '›') : '')); }
        body.append(h('p', {class: 'ae-sub'}, 'История хранится 7 дней.'));
      } else {
        if (!d.mail.length) body.append(h('p', {class: 'ae-empty'}, 'Писем нет. Здесь появятся письма и подарки от администрации.'));
        const done = mailDone();
        for (const m of d.mail) { const g = giftParts(m.gifts || {}), got = m.claimed || done.has(m.id);
          body.append(h('div', {class: 'ae-card ae-mail' + (!m.read ? ' is-new' : '')}, h('div', {class: 'ae-row'}, h('b', {class: 'ae-grow'}, `✉️ ${m.title}`), h('small', {class: 'ae-sub'}, agoText(m.at))),
            h('small', {class: 'ae-sub'}, m.toAll ? 'Администрация · всем героям' : 'Администрация · лично вам'),
            m.text ? h('p', {class: 'ae-mail-text'}, m.text) : '',
            g.length ? h('div', {class: 'ae-mail-gifts'}, h('span', {class: 'ae-grow'}, '🎁 ' + g.join(' · ')),
              got ? h('span', {class: 'ae-pill'}, '✅ Получено') : h('button', {type: 'button', class: 'ae-btn ae-primary', onclick: async ev => { ev.currentTarget.disabled = true; if (await claimMail(m)) { m.claimed = true; m.read = true; } await loadInbox(true); d = inboxData; st.rerender(); }}, 'Забрать')) : '')); }
      }
    }, {cls: 'ae-hq-panel'});
    loadInbox(true).then(x => { d = x; if (openPanelState === st) { st.rerender(); markSeen(); } });
  }
  function adminMailBlock() {
    let list = [];
    const to = h('select', {class: 'ae-input'}, h('option', {value: 'all'}, '📣 Всем игрокам'), h('option', {value: 'one'}, '👤 Одному игроку'));
    const who = h('input', {class: 'ae-input', placeholder: 'Ник героя или Telegram ID', hidden: true});
    to.addEventListener('change', () => { who.hidden = to.value !== 'one'; });
    const title = h('input', {class: 'ae-input', placeholder: 'Тема письма', maxlength: 80}), text = h('textarea', {class: 'ae-input', rows: 4, placeholder: 'Текст письма (необязательно, если есть подарок)', maxlength: 2000});
    const G = [['gold', '🪙 Золото'], ['silver', '🥈 Серебро'], ['energy', '⚡ Энергия'], ['fragments', '✦ Осколки'], ['arenaTickets', '🎟️ Билеты арены'], ['premiumDays', '👑 Premium, дней']];
    const gi = Object.fromEntries(G.map(([k, l]) => [k, h('input', {class: 'ae-input', type: 'number', min: '0', placeholder: l})]));
    const box = h('div', {class: 'ae-admin-list'});
    const paint = () => box.replaceChildren(...list.map(m => h('div', {class: 'ae-row ae-card'}, h('span', {class: 'ae-grow'}, h('b', {}, m.title), h('small', {class: 'ae-sub'}, ` · ${m.to} · ${agoText(m.at)}${giftParts(m.gifts).length ? ' · 🎁 ' + giftParts(m.gifts).join(', ') : ''} · прочитали ${m.read}${giftParts(m.gifts).length ? `, забрали ${m.claimed}` : ''}`)),
      h('button', {type: 'button', class: 'ae-btn', onclick: async () => { if (!confirm(`Удалить письмо «${m.title}»? Кто не забрал подарок — уже не заберёт.`)) return; try { await api('/api/admin/mail', 'POST', {delete: true, id: m.id}); await load(); } catch (e) { toast(cleanError(e)); } }}, '🗑'))));
    const load = async () => { try { list = (await api('/api/admin/mail')).mail || []; paint(); } catch {} };
    let op = uuid4();
    const send = async ev => {
      const gifts = Object.fromEntries(G.map(([k]) => [k, Math.max(0, Math.floor(Number(gi[k].value) || 0))]).filter(([, v]) => v > 0));
      const target = to.value === 'all' ? 'all' : who.value.trim(); if (!target) return toast('Укажите ник или Telegram ID игрока.');
      const what = giftParts(gifts).join(', ');
      if (!confirm(`Отправить «${title.value.trim() || 'без темы'}» ${target === 'all' ? 'ВСЕМ игрокам' : 'игроку ' + target}${what ? ` с подарком: ${what}` : ''}?`)) return;
      const btn = ev.currentTarget; btn.disabled = true;
      try { const r = await api('/api/admin/mail', 'POST', {operationId: op, to: target, title: title.value, text: text.value, gifts}); toast(`✉️ Отправлено: ${r.to}`); op = uuid4();
        title.value = ''; text.value = ''; for (const [k] of G) gi[k].value = ''; await load(); }
      catch (e) { toast(cleanError(e)); } finally { btn.disabled = false; }
    };
    load();
    return h('section', {class: 'ae-admin-premium', 'data-ae-admin-mail': '1'}, h('div', {class: 'ae-h3'}, '✉️ Почта и подарки'),
      h('div', {class: 'ae-sub'}, 'Письмо появится у игроков в 🔔 → «Почта». Подарок каждый игрок забирает один раз. Письма хранятся 30 дней; «всем» получают герои, созданные до отправки.'),
      to, who, title, text, h('div', {class: 'ae-mail-grid'}, ...G.map(([k]) => gi[k])), h('button', {type: 'button', class: 'ae-btn ae-primary ae-wide', onclick: send}, '✉️ Отправить'), box);
  }

  // ---------- 📱 Android app (APK): connect it from Telegram; inside the app — reminders, vibration, screen, sharing, updates ----------
  const APK = window.AethApk || null, isApk = !!APK;
  const APK_URL = 'https://github.com/SHAULK21/Game/releases/latest/download/Aethelgard.apk';
  if (isApk) document.documentElement.classList.add('ae-apk');
  function openApkInfo() {
    const tgData = !isApk && window.Telegram?.WebApp?.initData || '';
    openPanel('📱 Приложение Android', body => {
      if (!isApk) {
        body.append(h('p', {class: 'ae-note'}, 'Играйте тем же героем без Telegram: отдельное приложение для Android. Прогресс общий — можно чередовать Telegram и приложение.'),
          h('div', {class: 'ae-card'}, h('b', {}, 'Что есть только в приложении'), h('ul', {class: 'ae-apk-list'},
            h('li', {}, '🔔 Напоминания на телефон: энергия восполнилась, питомец проголодался, начались выходные Кровавой луны'),
            h('li', {}, '📳 Вибрация на ударах и победах'), h('li', {}, '🖥️ Полный экран без панелей Telegram'),
            h('li', {}, '🔆 Экран не гаснет во время боя'), h('li', {}, '📤 «Поделиться героем» в любой мессенджер'), h('li', {}, '⬆️ Сообщает о новых версиях'))),
          h('b', {}, '1. Установите'), h('button', {type: 'button', class: 'ae-btn ae-primary ae-wide', onclick: () => { try { Telegram.WebApp.openLink(APK_URL); } catch { window.open(APK_URL); } }}, '⬇️ Скачать APK'),
          h('p', {class: 'ae-sub'}, 'Android спросит разрешение на установку из браузера — это нормально для приложений не из Play Маркета.'),
          h('b', {}, '2. Подключите своего героя'),
          h('button', {type: 'button', class: 'ae-btn ae-primary ae-wide', disabled: !tgData, onclick: () => { const url = location.origin + '/apk-login#d=' + encodeURIComponent(tgData);
            try { Telegram.WebApp.openLink(url); } catch { window.open(url); } }}, '🔗 Подключить приложение'),
          h('button', {type: 'button', class: 'ae-btn ae-wide', disabled: !tgData, onclick: async () => { try { await navigator.clipboard.writeText(tgData); toast('Код скопирован. Вставьте его в приложении: «У меня есть код входа».'); } catch { toast('Не удалось скопировать — используйте кнопку «Подключить приложение».'); } }}, '📋 Скопировать код входа'),
          h('p', {class: 'ae-sub'}, '⚠️ Ссылка и код — это ваш вход в игру. Никому их не пересылайте.'));
        return;
      }
      const tog = (key, def, label, hint, after) => { const on = APK.getPref(key, def);
        return h('button', {type: 'button', class: 'ae-inbox-row' + (on ? ' is-new' : ''), onclick: () => { APK.setPref(key, !on); after?.(!on); openApkInfo(); }},
          h('span', {class: 'ae-inbox-i'}, on ? '✅' : '⬜'), h('span', {class: 'ae-grow'}, h('b', {}, label), h('small', {}, hint))); };
      body.append(h('p', {class: 'ae-note'}, `Версия приложения ${APK.versionName()}. Герой тот же, что и в Telegram.`),
        tog('notify', true, 'Напоминания', 'Энергия, питомец, выходные Кровавой луны', on => { if (!on) [1, 2, 3].forEach(i => APK.cancel(i)); else apkRemindTick(true); }),
        tog('vibrate', true, 'Вибрация', 'На ударах, победах и заточке'),
        tog('fullscreen', true, 'Полный экран', 'Скрыть системные панели'),
        tog('awake', false, 'Не гасить экран всегда', 'Без этого экран не гаснет только в бою'),
        h('div', {class: 'ae-grid2'},
          h('button', {type: 'button', class: 'ae-btn', onclick: () => shareHero()}, '📤 Поделиться героем'),
          h('button', {type: 'button', class: 'ae-btn', onclick: () => checkApkUpdate(true)}, '⬆️ Проверить обновления')),
        h('button', {type: 'button', class: 'ae-btn ae-wide', onclick: () => { if (confirm('Выйти из героя в приложении? Подключить снова можно из игры в Telegram.')) APK.logout(); }}, '🚪 Выйти из аккаунта'));
    }, {cls: 'ae-hq-panel'});
  }
  function shareHero() {
    const p = me() || {}, st = B()?.stats || {};
    const text = `⚔️ Мой герой в Aethelgard RPG: ${p.name || 'Герой'}, ${p.level || 1} ур.\nАтака ${fmt(st.attack || st.magicAttack || 0)} · Защита ${fmt(st.defense || 0)} · HP ${fmt(st.maxHp || 0)}\nИграй в Telegram: https://t.me/Aethelgardr_RPG_Bot`;
    if (isApk) APK.share(text); else { try { Telegram.WebApp.openTelegramLink('https://t.me/share/url?url=' + encodeURIComponent('https://t.me/Aethelgardr_RPG_Bot') + '&text=' + encodeURIComponent(text)); } catch {} }
  }
  if (isApk) {
    // links: outside Telegram, openLink/openTelegramLink/window.open must go to the browser or the Telegram app
    const ext = u => { try { APK.openExternal(String(u)); } catch {} };
    const hookLinks = () => { const w = window.Telegram?.WebApp; if (!w || w.__aeLinks) return; w.__aeLinks = true; w.openLink = u => ext(u); w.openTelegramLink = u => ext(u); };
    hookLinks(); setTimeout(hookLinks, 3000);
    const origOpen = window.open; window.open = (u, ...rest) => { if (u && !String(u).startsWith(location.origin)) { ext(u); return null; } return origOpen.call(window, u, ...rest); };
    // an expired Telegram login: the server answers 401 — offer to reconnect instead of a dead screen
    let relinkShown = 0;
    const onUnauthorized = () => { if (Date.now() - relinkShown < 120e3) return; relinkShown = Date.now(); setTimeout(openRelink, 300); };
    const of = window.fetch; window.fetch = async (...a) => { const r = await of(...a); try { if (r.status === 401 && String(a[0]?.url || a[0]).includes('/api/')) onUnauthorized(); } catch {} return r; };
    const xo = XMLHttpRequest.prototype.open; XMLHttpRequest.prototype.open = function (m, u, ...rest) { this.__aeUrl = String(u); return xo.call(this, m, u, ...rest); };
    const xs = XMLHttpRequest.prototype.send; XMLHttpRequest.prototype.send = function (...a) { this.addEventListener('loadend', () => { if (this.status === 401 && (this.__aeUrl || '').includes('/api/')) onUnauthorized(); }); return xs.apply(this, a); };
    function openRelink() {
      const box = h('div', {class: 'ae-relink'}, h('div', {class: 'ae-relink-card'}, h('h2', {}, '🔑 Нужно переподключиться'),
        h('p', {}, 'Вход через Telegram устарел. Откройте игру в Telegram → Меню → «📱 Приложение Android» → «🔗 Подключить приложение». Или скопируйте там код входа и вставьте его сюда.'),
        h('button', {type: 'button', class: 'ae-btn ae-primary ae-wide', onclick: () => ext('https://t.me/Aethelgardr_RPG_Bot')}, 'Открыть игру в Telegram'),
        h('button', {type: 'button', class: 'ae-btn ae-wide', onclick: () => { const v = (APK.paste() || '').trim(); if (v.includes('hash=') && v.includes('user=')) APK.saveLogin(v); else toast('В буфере нет кода входа. Скопируйте его в игре в Telegram.'); }}, '📋 Вставить код входа'),
        h('button', {type: 'button', class: 'ae-btn ae-wide', onclick: () => box.remove()}, 'Позже')));
      document.querySelector('.ae-relink')?.remove(); document.body.append(box);
    }
    // Telegram's haptics do nothing outside Telegram: the phone vibrates instead
    const hookHaptics = () => { const hf = window.Telegram?.WebApp?.HapticFeedback; if (!hf || hf.__ae) return; hf.__ae = true;
      const ms = {light: 12, medium: 25, heavy: 45, rigid: 20, soft: 10, success: 60, warning: 40, error: 90};
      hf.impactOccurred = s => { APK.vibrate(ms[s] || 20); return hf; }; hf.notificationOccurred = s => { APK.vibrate(ms[s] || 40); return hf; }; hf.selectionChanged = () => { APK.vibrate(8); return hf; }; };
    hookHaptics(); setTimeout(hookHaptics, 3000);
    // keep the screen on in battle (or always, if chosen)
    let awake = null;
    setInterval(() => { const want = APK.getPref('awake', false) || document.documentElement.hasAttribute('data-in-combat') || !!document.querySelector('.ae-battle-backdrop');
      if (want !== awake) { awake = want; APK.keepAwake(want); } }, 1500);
    window.addEventListener('aeth-apk-resume', () => { try { loadInbox(true); } catch {} });
  }
  // reminders on the phone: energy full (1), pet hungry (2), Blood Moon weekend (3)
  let remindSig = '';
  function apkRemindTick(force) {
    if (!isApk || !APK.getPref('notify', true)) return; const p = me(); if (!p) return;
    const energyAt = p.energy < p.maxEnergy ? (p.lastEnergyRegenTimestamp || Date.now()) + (p.maxEnergy - p.energy) * 12e4 : 0;
    let petAt = 0; try { if (p.activePet) { const sat = petSat(); petAt = sat > HUNGRY_AT ? Date.now() + (sat - HUNGRY_AT) * PET_DAY / 100 : 0; } } catch {}
    const bm = (() => { const d = new Date(Date.now() + 3 * 3600e3), day = d.getUTCDay(); if (day === 6 || day === 0) return 0; const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + (6 - day)) - 3 * 3600e3); return t.getTime() + 10 * 3600e3; })();
    const sig = [Math.round(energyAt / 6e4), Math.round(petAt / 6e4), bm].join('|'); if (!force && sig === remindSig) return; remindSig = sig;
    if (energyAt) APK.schedule(1, energyAt, '⚡ Энергия восполнилась', `${p.name || 'Герой'} готов к походу — энергия ${p.maxEnergy}/${p.maxEnergy}.`); else APK.cancel(1);
    if (petAt) APK.schedule(2, petAt, '🐾 Питомец проголодался', `${p.activePet?.name || 'Питомец'} ждёт корма — голодный питомец слабее в бою.`); else APK.cancel(2);
    if (bm) APK.schedule(3, bm, '🌕 Выходные Кровавой луны', 'В Орде двойные награды до конца воскресенья!'); else APK.cancel(3);
  }
  if (isApk) { setTimeout(() => apkRemindTick(true), 9000); setInterval(() => { if (!document.hidden) apkRemindTick(); }, 60e3); }
  // a new version on GitHub
  async function checkApkUpdate(manual) {
    if (!isApk) return;
    try {
      const r = await fetch('https://api.github.com/repos/SHAULK21/Game/releases/latest', {headers: {Accept: 'application/vnd.github+json'}}); if (!r.ok) throw new Error();
      const j = await r.json(), code = Number(String(j.tag_name || '').match(/(\d+)$/)?.[1] || 0);
      if (code > APK.version()) { if (confirm(`Вышла новая версия приложения (${j.name || j.tag_name}). Скачать?`)) APK.openExternal(APK_URL); }
      else if (manual) toast('У вас последняя версия приложения.');
    } catch { if (manual) toast('Не удалось проверить обновления.'); }
  }
  if (isApk) setTimeout(() => { const k = 'aeth_apk_upd_check', last = Number(localStorage.getItem(k) || 0); if (Date.now() - last > 12 * 3600e3) { localStorage.setItem(k, String(Date.now())); checkApkUpdate(false); } }, 15000);

  // ---------- ⚔️ combat VFX: slashes, sparks, spell bursts, crit flash and shake, monster flinch, rage aura, death dissolve ----------
  // One canvas over the screen, driven by the hits the game already shows (.combat-damage-pop / .ae-float); works in Telegram and the app.
  const fxMode = () => localStorage.getItem('aeth_fx') || (matchMedia('(prefers-reduced-motion: reduce)').matches ? 'low' : 'high');
  const FX_STYLE = {warrior: ['slash', '#ffd38a'], knight: ['slash', '#e8eef7'], paladin: ['slash', '#ffe68a'], berserker: ['cleave', '#ff8a5a'], rogue: ['twin', '#c7f0ff'], assassin: ['twin', '#c58cff'],
    archer: ['arrow', '#d9ff9a'], hunter: ['arrow', '#ffe0a0'], mage: ['burst', '#7ec8ff'], necromancer: ['burst', '#9cff7a'], druid: ['burst', '#8dffb0']};
  const fx = {cv: null, ctx: null, parts: [], running: false, last: 0};
  function fxCanvas() {
    if (fx.cv && fx.cv.isConnected) return fx.cv;
    const cv = document.createElement('canvas'); cv.className = 'ae-fx-canvas ae-float'; document.body.append(cv); fx.cv = cv; fx.ctx = cv.getContext('2d'); fxResize(); return cv;
  }
  function fxResize() { if (!fx.cv) return; const r = fx.cv.getBoundingClientRect(), d = Math.min(2, devicePixelRatio || 1); fx.cv.width = Math.round(r.width * d); fx.cv.height = Math.round(r.height * d); fx.scale = fx.cv.width / Math.max(1, r.width); }
  addEventListener('resize', () => fxResize());
  // a point on screen (getBoundingClientRect space) → canvas pixels
  const fxPt = (x, y) => { const r = fx.cv.getBoundingClientRect(), k = fx.cv.width / Math.max(1, r.width); return [(x - r.left) * k, (y - r.top) * k]; };
  const rnd = (a, b) => a + Math.random() * (b - a);
  function fxAdd(p) { if (fx.parts.length > (fxMode() === 'low' ? 90 : 240)) fx.parts.shift(); fx.parts.push(p); if (!fx.running) { fx.running = true; fx.last = performance.now(); requestAnimationFrame(fxLoop); } }
  function fxLoop(t) {
    const dt = Math.min(0.05, (t - fx.last) / 1000); fx.last = t; const c = fx.ctx, cv = fx.cv; if (!c) { fx.running = false; return; }
    c.clearRect(0, 0, cv.width, cv.height); c.globalCompositeOperation = 'lighter';
    fx.parts = fx.parts.filter(p => (p.life -= dt) > 0);
    for (const p of fx.parts) {
      const a = Math.max(0, p.life / p.max); p.x += p.vx * dt; p.y += p.vy * dt; p.vy += (p.g || 0) * dt; p.vx *= p.drag || 1; p.vy *= p.drag || 1;
      c.globalAlpha = a * (p.alpha || 1);
      if (p.k === 'spark') { c.strokeStyle = p.col; c.lineWidth = p.w; c.beginPath(); c.moveTo(p.x, p.y); c.lineTo(p.x - p.vx * 0.04, p.y - p.vy * 0.04); c.stroke(); }
      else if (p.k === 'dot') { c.fillStyle = p.col; c.beginPath(); c.arc(p.x, p.y, p.r * (0.4 + a * 0.6), 0, 6.283); c.fill(); }
      else if (p.k === 'ring') { const rr = p.r0 + (p.r1 - p.r0) * (1 - a); c.strokeStyle = p.col; c.lineWidth = p.w * a + 0.5; c.beginPath(); c.arc(p.x, p.y, rr, 0, 6.283); c.stroke(); }
      else if (p.k === 'arc') { const prog = 1 - a, sweep = p.sweep * Math.min(1, prog * 2.2); c.strokeStyle = p.col; c.lineCap = 'round';
        for (let i = 0; i < 3; i++) { c.lineWidth = p.w * (1 - i * 0.3) * a; c.globalAlpha = a * (1 - i * 0.28); c.beginPath(); c.arc(p.x, p.y, p.r + i * 3, p.a0, p.a0 + sweep, p.sweep < 0); c.stroke(); } }
      else if (p.k === 'streak') { c.strokeStyle = p.col; c.lineWidth = p.w * a; c.lineCap = 'round'; c.beginPath(); c.moveTo(p.x, p.y); c.lineTo(p.x - p.dx * (0.3 + 0.7 * a), p.y - p.dy * (0.3 + 0.7 * a)); c.stroke(); }
      else if (p.k === 'glow') { const g = c.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r); g.addColorStop(0, p.col); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.beginPath(); c.arc(p.x, p.y, p.r, 0, 6.283); c.fill(); }
    }
    c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
    if (fx.parts.length) requestAnimationFrame(fxLoop); else { fx.running = false; c.clearRect(0, 0, cv.width, cv.height); }
  }
  function sparks(x, y, n, col, speed = 420, w = 2) { const k = fx.scale || 1; for (let i = 0; i < n; i++) { const a = rnd(0, 6.283), v = rnd(0.35, 1) * speed * k; fxAdd({k: 'spark', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: 520 * k, drag: 0.94, w: w * k, col, life: rnd(0.25, 0.55), max: 0.55}); } }
  function fxShake(el, strong) { if (!el || fxMode() === 'off') return; el.classList.remove('ae-fx-shake', 'ae-fx-shake-big'); void el.offsetWidth; el.classList.add(strong ? 'ae-fx-shake-big' : 'ae-fx-shake'); setTimeout(() => el.classList.remove('ae-fx-shake', 'ae-fx-shake-big'), 420); }
  function fxFlinch(el) { if (!el) return; el.classList.remove('ae-fx-flinch'); void el.offsetWidth; el.classList.add('ae-fx-flinch'); setTimeout(() => el.classList.remove('ae-fx-flinch'), 260); }
  function fxFlash(col, strength = 0.35) { if (fxMode() === 'off') return; const d = h('div', {class: 'ae-fx-flash ae-float', style: `background:${col};opacity:${strength}`}); document.body.append(d); requestAnimationFrame(() => { d.style.opacity = '0'; }); setTimeout(() => d.remove(), 420); }
  // what hit, where: kind = normal | critical | super | shield | poison | fire | bleed | hurt | heal
  function fxHit(rect, kind, onHero) {
    if (fxMode() === 'off' || !rect || !rect.width) return; fxCanvas(); if (!fx.cv.width) fxResize();
    const k = fx.scale || 1, [x, y] = fxPt(rect.left + rect.width * rnd(0.35, 0.65), rect.top + rect.height * rnd(0.35, 0.55)), low = fxMode() === 'low';
    const [style, col] = FX_STYLE[me()?.classId] || FX_STYLE.warrior;
    if (onHero) { // the monster hits the hero
      const big = kind === 'critical' || kind === 'super';
      sparks(x, y, low ? 6 : big ? 18 : 10, '#ff6a4a', big ? 520 : 380); fxAdd({k: 'glow', x, y, r: (big ? 90 : 60) * k, col: 'rgba(255,60,40,.55)', vx: 0, vy: 0, life: 0.25, max: 0.25});
      if (big) { fxFlash('radial-gradient(circle,transparent 45%,rgba(200,20,20,.85))', 0.55); try { Telegram.WebApp.HapticFeedback.impactOccurred('heavy'); } catch {} }
      return;
    }
    if (kind === 'shield') { fxAdd({k: 'ring', x, y, r0: 20 * k, r1: 70 * k, w: 5 * k, col: '#7fd3ff', vx: 0, vy: 0, life: 0.45, max: 0.45}); sparks(x, y, 8, '#bfe9ff', 260); return; }
    if (kind === 'poison' || kind === 'fire' || kind === 'bleed') { const c2 = kind === 'poison' ? '#8dff5a' : kind === 'fire' ? '#ffae3a' : '#ff4a4a';
      for (let i = 0; i < (low ? 5 : 12); i++) fxAdd({k: 'dot', x: x + rnd(-30, 30) * k, y: y + rnd(-10, 25) * k, vx: rnd(-20, 20) * k, vy: rnd(-120, -50) * k * (kind === 'bleed' ? -0.6 : 1), r: rnd(3, 6) * k, col: c2, life: rnd(0.5, 0.9), max: 0.9}); return; }
    const crit = kind === 'critical', sup = kind === 'super', size = (crit ? 1.45 : sup ? 1.6 : 1) * k;
    if (style === 'slash' || style === 'cleave') { const a0 = rnd(-2.6, -2.1); fxAdd({k: 'arc', x, y, r: 48 * size, a0, sweep: (style === 'cleave' ? 2.6 : 2.1), w: (style === 'cleave' ? 9 : 6) * size, col, vx: 0, vy: 0, life: 0.32, max: 0.32}); }
    else if (style === 'twin') { for (const d of [-1, 1]) fxAdd({k: 'streak', x: x + d * 22 * k, y: y + 26 * k, dx: -d * 60 * size, dy: -70 * size, w: 4 * size, col, vx: 0, vy: 0, life: 0.25, max: 0.25}); }
    else if (style === 'arrow') fxAdd({k: 'streak', x, y, dx: 140 * size, dy: 18 * size, w: 3.5 * size, col, vx: 0, vy: 0, life: 0.22, max: 0.22});
    else { fxAdd({k: 'glow', x, y, r: 70 * size, col: col + 'cc', vx: 0, vy: 0, life: 0.35, max: 0.35}); fxAdd({k: 'ring', x, y, r0: 10 * k, r1: 60 * size, w: 5 * k, col, vx: 0, vy: 0, life: 0.4, max: 0.4}); }
    sparks(x, y, low ? 6 : crit || sup ? 26 : 12, crit ? '#fff3c4' : col, crit || sup ? 560 : 420, crit ? 2.6 : 2);
    if (crit) { fxAdd({k: 'ring', x, y, r0: 16 * k, r1: 110 * k, w: 7 * k, col: '#fff1b0', vx: 0, vy: 0, life: 0.4, max: 0.4}); fxFlash('rgba(255,245,210,.9)', 0.28); }
    if (sup) { fxAdd({k: 'ring', x, y, r0: 20 * k, r1: 150 * k, w: 9 * k, col, vx: 0, vy: 0, life: 0.55, max: 0.55}); fxAdd({k: 'glow', x, y, r: 120 * k, col: col + '99', vx: 0, vy: 0, life: 0.5, max: 0.5}); }
  }
  // death: the monster crumbles into embers, a few coins fly up
  function fxDeath(el) {
    if (fxMode() === 'off' || !el) return; fxCanvas(); const r = el.getBoundingClientRect(); if (!r.width) return; const k = fx.scale || 1, low = fxMode() === 'low';
    el.classList.add('ae-fx-dissolve'); setTimeout(() => el.classList.remove('ae-fx-dissolve'), 1600);
    for (let i = 0; i < (low ? 20 : 55); i++) { const [x, y] = fxPt(r.left + r.width * rnd(0.2, 0.8), r.top + r.height * rnd(0.15, 0.9)); fxAdd({k: 'dot', x, y, vx: rnd(-40, 40) * k, vy: rnd(-160, -40) * k, drag: 0.98, r: rnd(2, 4.5) * k, col: Math.random() < 0.5 ? '#ffb347' : '#ff6a2a', life: rnd(0.8, 1.6), max: 1.6}); }
    const [cx, cy] = fxPt(r.left + r.width / 2, r.top + r.height * 0.55);
    for (let i = 0; i < (low ? 6 : 14); i++) fxAdd({k: 'dot', x: cx, y: cy, vx: rnd(-220, 220) * k, vy: rnd(-520, -280) * k, g: 900 * k, r: 4.5 * k, col: '#ffd34a', life: 1.1, max: 1.1});
  }
  // native fights: hit pops, the reward card, the rage line
  const artOf = target => document.querySelector(target === 'player' ? '.combat-player-art' : '.combat-monster-art');
  new MutationObserver(list => {
    if (fxMode() === 'off') return;
    for (const m of list) for (const n of m.addedNodes) {
      if (n.nodeType !== 1) continue;
      if (n.classList?.contains('combat-damage-pop')) {
        const target = n.closest('.combat-damage-player') ? 'player' : 'monster', kind = n.dataset.impact || 'normal', art = artOf(target) || n;
        fxHit(art.getBoundingClientRect(), kind, target === 'player');
        if (target === 'monster') { fxFlinch(art); if (kind === 'critical' || kind === 'super') fxShake(document.querySelector('.combat-scene'), true); }
        else fxShake(document.querySelector('.combat-scene'), kind === 'critical' || kind === 'super');
      } else if (n.classList?.contains('ae-float')) {
        if (n.classList.contains('ae-fx-canvas') || n.classList.contains('ae-fx-flash')) continue;
        const r = n.getBoundingClientRect(), box = {left: r.left - 40, top: r.top - 10, width: 80, height: 80};
        if (n.classList.contains('is-dmg')) fxHit(box, n.classList.contains('is-big') ? 'critical' : 'normal', false);
        else if (n.classList.contains('is-hurt')) fxHit(box, 'normal', true);
      } else if (n.matches?.('.combat-reward') || n.querySelector?.('.combat-reward')) fxDeath(artOf('monster'));
      else if (/в ярости!/.test(n.textContent || '') && n.textContent.length < 160) { const a = artOf('monster'); if (a) a.classList.add('ae-fx-rage'); }
    }
  }).observe(document.body, {childList: true, subtree: true});
  // rage ends with the fight
  setInterval(() => { if (!document.documentElement.hasAttribute('data-in-combat')) document.querySelectorAll('.ae-fx-rage').forEach(e => e.classList.remove('ae-fx-rage')); }, 2000);
  // ---------- promo codes ----------
  function openPromo() {
    openPanel('🎁 Промокод', body => {
      body.append(h('p', {class: 'ae-note'}, 'Введите промокод из канала t.me/Aethelgardo или от администрации. Каждый код можно активировать один раз.'));
      const input = h('input', {class: 'ae-input', placeholder: 'Например: AE-7K2QX9', maxlength: 20, style: 'text-transform:uppercase'});
      const go = async () => {
        const code = input.value.trim(); if (!code) return toast('Введите промокод.');
        try {
          const r = await api('/api/promo/redeem', 'POST', {code, level: me()?.level || 1}), w = r.reward, b = B(), parts = grantReward(w);
          toast(`«${r.title}»: ${parts.join(', ')}`); b.sound?.playVictory?.(); input.value = '';
          if (w.premiumDays) setTimeout(() => checkPremium(), 800);
        } catch (e) { toast(cleanError(e)); sfx.play('fail'); }
      };
      input.addEventListener('keydown', e => e.key === 'Enter' && go());
      body.append(h('div', {class: 'ae-row'}, input, h('button', {class: 'ae-btn ae-primary', type: 'button', onclick: go}, 'Активировать')));
      setTimeout(() => input.focus(), 50);
    });
  }
  function adminPromoBlock() {
    let packs = [], codes = [];
    const list = h('div', {class: 'ae-admin-list'}), sel = h('select', {class: 'ae-input'});
    const paint = () => list.replaceChildren(...codes.slice(0, 15).map(c => h('div', {class: 'ae-row ae-card'}, h('code', {class: 'ae-code'}, c.code), h('span', {class: 'ae-grow ae-sub'}, `${c.title} · осталось ${c.usesLeft}/3`),
      h('button', {class: 'ae-btn', type: 'button', onclick: () => navigator.clipboard?.writeText(c.code).then(() => toast('Скопировано: ' + c.code), () => toast(c.code))}, '📋'))));
    const load = async () => { try { const r = await api('/api/admin/promo'); packs = r.packs; codes = r.codes; sel.replaceChildren(...packs.map(p => h('option', {value: p.id}, `${p.title}${p.minLevel > 1 ? ` (с ${p.minLevel} ур.)` : ''}`))); paint(); } catch {} };
    const gen = async () => { try { const r = await api('/api/admin/promo', 'POST', {pack: sel.value}); codes = [...r.codes, ...codes]; paint(); toast('Создано 5 промокодов по 3 активации'); navigator.clipboard?.writeText(r.codes.map(c => c.code).join('\n')).catch(() => {}); } catch (e) { toast(cleanError(e)); } };
    load();
    return h('section', {class: 'ae-admin-premium', 'data-ae-admin-promo': '1'}, h('div', {class: 'ae-h3'}, '🎟️ Промокоды'), h('div', {class: 'ae-sub'}, 'Генерируются по 5 кодов, у каждого 3 активации. Коды копируются в буфер.'),
      h('div', {class: 'ae-row'}, sel, h('button', {class: 'ae-btn ae-primary', type: 'button', onclick: gen}, 'Создать 5')), list);
  }

  // ---------- clickable nicknames ----------
  let nickMap = new Map(), nickLoaded = 0;
  async function loadNicks() {
    if (Date.now() - nickLoaded < 60000) return; nickLoaded = Date.now();
    try { const [lb, chat] = await Promise.all([api('/api/leaderboard').catch(() => ({players: []})), api('/api/chat/global').catch(() => ({messages: []}))]);
      for (const p of lb.players || []) if (p.character_name) nickMap.set(p.character_name.trim(), String(p.telegram_id));
      for (const m of chat.messages || []) if (m.display_name) nickMap.set(m.display_name.trim(), String(m.telegram_id)); } catch {}
  }
  function decorateNicks() {
    const scope = [...document.querySelectorAll('main, .game-dialog-backdrop, .bottom-sheet-backdrop')].filter(s => /Общий чат|Рейтинг|Таблица|Кланы|Чат/.test(s.textContent || ''));
    if (!scope.length) return; loadNicks();
    const myName = (me()?.name || '').trim();
    for (const root of scope) for (const el of root.querySelectorAll('strong, b, span, div, p')) {
      if (el.childElementCount || el.closest('button, input, textarea, .ae-panel, nav, header') || el.classList.contains('ae-nick')) continue;
      const t = (el.textContent || '').trim(); const id = t === myName && myName ? uid() : nickMap.get(t);
      if (id && !el.dataset.aeUid && t.length > 1) el.dataset.aeUid = id;
      if (!id || id === uid() || t === myName) continue;
      el.classList.add('ae-nick'); el.setAttribute('role', 'button'); el.tabIndex = 0;
      el.addEventListener('click', e => { e.stopPropagation(); e.preventDefault(); openPlayerCard(id, t); });
    }
  }
  // ---------- clan tag «[TAG]» before nicknames ----------
  const clanTags = new Map(), clanMeta = new Map(); let clanTagsAt = 0, clanTagsBusy = false;
  async function loadClanTags(ids) {
    if (clanTagsBusy) return; const want = ids.filter(id => !clanTags.has(id)).slice(0, 40);
    if (!want.length && Date.now() - clanTagsAt < 120000) return;
    clanTagsBusy = true; clanTagsAt = Date.now();
    try { const r = await api('/api/ae-profile/batch', 'POST', {ids: want.length ? want : ids.slice(0, 40)}); for (const p of r.profiles || []) { clanTags.set(String(p.id), p.clan || ''); clanMeta.set(String(p.id), {place: p.clanPlace || null, emblem: p.emblem || null, avatar: p.avatar || null}); } for (const id of want) if (!clanTags.has(id)) clanTags.set(id, ''); }
    catch {} finally { clanTagsBusy = false; }
  }
  function paintClanTags() {
    const els = [...document.querySelectorAll('[data-ae-uid]')]; if (!els.length) return;
    loadClanTags([...new Set(els.map(e => e.dataset.aeUid))]);
    for (const el of els) {
      const tag = clanTags.get(el.dataset.aeUid), cm = clanMeta.get(el.dataset.aeUid) || {};
      let prev = el.previousElementSibling?.classList.contains('ae-clan-tag') ? el.previousElementSibling : null;
      if (!tag) { prev?.remove(); prev = null; }
      else {
        const txt = `${cm.place ? MEDAL[cm.place] : ''}[${tag}]`, cls = 'ae-clan-tag' + (cm.place ? ' is-p' + cm.place : '');
        if (prev) { if (prev.textContent !== txt) prev.textContent = txt; if (prev.className !== cls) prev.className = cls; }
        else { prev = h('span', {class: cls, title: cm.place ? `Клан — ${cm.place}-е место недели` : 'Клан'}, txt); el.before(prev); }
      }
      // the player's avatar in front of the tag (or the nickname)
      const first = prev || el, ava = first.previousElementSibling?.classList.contains('ae-nick-ava') ? first.previousElementSibling : null;
      if (!cm.avatar) { ava?.remove(); continue; }
      if (ava) { if (ava.getAttribute('src') !== cm.avatar) ava.setAttribute('src', cm.avatar); continue; }
      const id = el.dataset.aeUid, name = (el.textContent || '').trim();
      first.before(h('img', {class: 'ae-nick-ava', src: cm.avatar, alt: '', loading: 'lazy', onerror: e => e.target.remove(), onclick: e => { e.stopPropagation(); if (id !== String(uid())) openPlayerCard(id, name); else openProfile(); }}));
    }
  }
  setInterval(() => { if (document.hidden) return; try { paintClanTags(); } catch {} }, 1500);
  function openPlayerCard(id, name) {
    let prof = null;
    const st = openPanel('👤 ' + name, body => {
      if (prof) body.append(profileHeader(prof), h('div', {class: 'ae-prof-stats'},
        h('span', {}, `⚔️ Рейтинг дуэлей ${prof.stats.duelRating}`), h('span', {}, `🤝 Кооп-побед ${prof.stats.coopWins}`), h('span', {}, `🌕 Рекорд Орды ${prof.stats.hordeBest}`), h('span', {}, `🏅 Титулов ${prof.titlesEarned}`)));
      body.append(h('div', {class: 'ae-grid2'},
        h('button', {class: 'ae-btn ae-primary', type: 'button', onclick: async () => { try { await api('/api/friends/request', 'POST', {targetId: id}); toast('Заявка в друзья отправлена'); } catch (e) { toast(cleanError(e)); } }}, '👥 В друзья'),
        h('button', {class: 'ae-btn ae-primary', type: 'button', onclick: () => openChat({id, name})}, '💬 Написать'),
        h('button', {class: 'ae-btn ae-primary', type: 'button', onclick: async () => { closePanel(); openDuel(name); }}, '⚔️ Дуэль'),
        h('button', {class: 'ae-btn', type: 'button', onclick: () => closePanel()}, 'Закрыть')));
    });
    api('/api/ae-profile/card?id=' + encodeURIComponent(id)).then(r => { prof = r.profile; if (openPanelState === st) st.rerender(); }, () => {});
  }
  // ---------- profile: titles + avatar (game characters only, round) ----------
  const CLASS_NAME = {warrior: 'Воин', knight: 'Рыцарь', paladin: 'Паладин', berserker: 'Берсерк', rogue: 'Разбойник', assassin: 'Ассасин', hunter: 'Охотник', archer: 'Лучник', mage: 'Маг', necromancer: 'Некромант', druid: 'Друид'};
  const profileHeader = pr => h('div', {class: 'ae-prof-head'}, h('img', {class: 'ae-avatar is-big', src: pr.avatar.src, alt: ''}),
    h('div', {class: 'ae-grow'}, h('b', {class: 'ae-prof-name'}, pr.clan ? h('span', {class: 'ae-clan-tag'}, `[${pr.clan.tag}]`) : '', pr.name), h('div', {class: 'ae-sub'}, `${CLASS_NAME[pr.classId] || pr.classId} · ${pr.level} ур.`),
      pr.clan ? h('div', {class: 'ae-prof-clan'}, `${pr.clan.emblem || '🛡️'} Клан «${pr.clan.name}» · ур. ${pr.clan.level}${pr.clan.role === 'owner' ? ' · глава' : pr.clan.role === 'officer' ? ' · офицер' : ''}`) : h('div', {class: 'ae-sub'}, 'Без клана'),
      pr.pet ? h('div', {class: 'ae-prof-pet'}, h('img', {src: `/assets/pets/icon-${pr.pet.id}.webp`, alt: '', onerror: e => e.target.remove()}), h('span', {}, `${pr.pet.name} · ур. ${pr.pet.level}`), h('small', {}, `${RARITY_RU[pr.pet.rarity] || ''}${pr.pet.hungry ? ' · голоден' : ''}`)) : h('div', {class: 'ae-sub'}, '🐾 Без питомца'),
      pr.title ? h('div', {class: 'ae-title-badge'}, `${pr.title.icon} ${pr.title.name}`) : h('div', {class: 'ae-sub'}, 'Без титула'),
      pr.asc ? h('div', {class: 'ae-asc-badge', 'data-asc': pr.asc.rank, title: 'Ранг вознесения'}, h('b', {}, pr.asc.rank), h('span', {}, `Вознесение · ${pr.asc.name}`))
        : h('div', {class: 'ae-asc-badge is-none'}, h('b', {}, '—'), h('span', {}, 'Вознесение не пройдено'))));
  let myProfile = null;
  async function loadMyProfile() {
    try {
      let r = await api('/api/ae-profile');
      const rank = me()?.ascension?.rank || 'E', shown = r.profile?.asc?.rank || 'E';
      if (rank !== shown) { try { const u = await api('/api/ae-profile/asc', 'POST', {rank}); r = {...r, profile: u.profile}; } catch {} }
      myProfile = r; applyHeaderAvatar();
      // announce titles earned since the last check
      const key = 'aeth_titles_seen_' + uid(), earned = r.titles.filter(t => t.earned).map(t => t.id), seenRaw = localStorage.getItem(key);
      if (seenRaw) { const seen = new Set(JSON.parse(seenRaw)); for (const t of r.titles.filter(t => t.earned && !seen.has(t.id))) popup({icon: '🏅', text: `Новый титул: ${t.icon} ${t.name}`, act: 'Надеть', fn: () => openProfile()}); }
      localStorage.setItem(key, JSON.stringify(earned));
      return r;
    } catch { return null; }
  }
  setInterval(() => { if (uid() && !document.hidden) loadMyProfile(); }, 120000);
  function applyHeaderAvatar() {
    const src = myProfile?.profile?.avatar?.src; if (!src) return;
    for (const img of document.querySelectorAll('header img.modern-avatar, header .shell-hero-portrait img')) {
      if (img.getAttribute('src') !== src) img.setAttribute('src', src);
      if (!img.dataset.aeProfile) { img.dataset.aeProfile = '1'; img.classList.add('ae-header-avatar'); img.title = 'Профиль: титул и аватарка';
        img.addEventListener('click', e => { e.stopPropagation(); e.preventDefault(); openProfile(); }, true); }
    }
  }
  setTimeout(() => { if (uid()) loadMyProfile(); }, 5000);
  function openProfile(tab = 'titles') {
    let data = myProfile;
    const st = openPanel('👤 Профиль', body => {
      if (!data) return body.append(h('p', {class: 'ae-empty'}, 'Загрузка…'));
      const pr = data.profile;
      body.append(profileHeader(pr));
      { const li = me() ? luckInfo(me()) : null; if (li) body.append(h('div', {class: 'ae-pill'}, `🍀 Удача ${li.luck}: шанс улучшить редкость найденной вещи ${Math.round(li.bump * 100)}% · легендарные находки ×${li.legMul.toFixed(2)}`)); }
      { const r = me() ? respecInfo(me()) : null; if (r) body.append(h('div', {class: 'ae-row ae-card'}, h('div', {class: 'ae-grow'}, h('b', {}, '♻️ Характеристики'), h('div', {class: 'ae-sub'}, r.spent ? `Вложено очков: ${r.spent}. Сброс ${r.cost ? `— ${fmt(r.cost)} серебра` : '— первый бесплатно'}.` : 'Вложенных очков нет.')), h('button', {class: 'ae-btn' + (r.spent ? ' ae-primary' : ''), type: 'button', disabled: !r.spent, onclick: () => { closePanel(); doRespec(); }}, 'Сбросить'))); }
      body.append(h('div', {class: 'ae-tabs'}, [['titles', `🏅 Титулы ${data.titles.filter(t => t.earned).length}/${data.titles.length}`], ['avatars', '🖼️ Аватарка']].map(([k, l]) =>
        h('button', {type: 'button', class: 'ae-pill-btn' + (tab === k ? ' is-on' : ''), onclick: () => { tab = k; st.rerender(); }}, l))));
      if (tab === 'avatars') {
        body.append(h('p', {class: 'ae-sub'}, 'Выберите аватарку — её увидят другие игроки в вашем профиле.'));
        body.append(h('div', {class: 'ae-avatar-grid'}, data.avatars.map(a => h('button', {type: 'button', class: 'ae-avatar-pick' + (a.id === pr.avatar.id ? ' is-on' : ''), title: a.name, onclick: async () => {
          try { const r = await api('/api/ae-profile/avatar', 'POST', {id: a.id}); data.profile = r.profile; myProfile = data; applyHeaderAvatar(); sfx.play('page'); st.rerender(); } catch (e) { toast(cleanError(e)); }
        }}, h('img', {class: 'ae-avatar', src: a.src, alt: ''}), h('small', {}, a.name)))));
        return;
      }
      const list = data.titles.slice().sort((a, b) => (b.earned - a.earned) || (b.progress / b.need - a.progress / a.need));
      for (const t of list) {
        const on = pr.title?.id === t.id;
        body.append(h('div', {class: 'ae-card ae-title-row' + (t.earned ? '' : ' is-locked') + (on ? ' is-on' : '')},
          h('span', {class: 'ae-title-icon'}, t.earned ? t.icon : '🔒'),
          h('div', {class: 'ae-grow'}, h('b', {}, t.name), h('div', {class: 'ae-sub'}, t.desc), !t.earned && t.need > 1 ? h('div', {class: 'ae-bar'}, h('i', {style: `width:${100 * t.progress / t.need}%`}), h('span', {}, `${fmt(t.progress)} / ${fmt(t.need)}`)) : ''),
          t.earned ? h('button', {type: 'button', class: 'ae-btn' + (on ? '' : ' ae-primary'), onclick: async () => {
            try { const r = await api('/api/ae-profile/title', 'POST', {id: on ? null : t.id}); data.profile = r.profile; myProfile = data; toast(on ? 'Титул снят' : `Титул «${t.name}» надет`); sfx.play('page'); st.rerender(); } catch (e) { toast(cleanError(e)); }
          }}, on ? 'Снять' : 'Надеть') : ''));
      }
    });
    loadMyProfile().then(r => { if (r) { data = r; if (openPanelState === st) st.rerender(); } });
  }

  // ---------- items in chat ----------
  const TOKEN_RE = /⟦ae:i:([A-Za-z0-9+/=]+)⟧/;
  const enc = o => btoa(unescape(encodeURIComponent(JSON.stringify(o))));
  const dec = s => { try { return JSON.parse(decodeURIComponent(escape(atob(s)))); } catch { return null; } };
  const RAR_RU = RARITY_RU;
  function shareItem(item) {
    const compact = {n: baseName(item), r: item.rarity, l: item.level || 1, u: item.upgradeLevel || 0, a: ascOf(item), t: item.type, ...(item.twoHanded ? {th: 1} : {}), s: Object.fromEntries(Object.entries(item.stats || {}).filter(([, v]) => typeof v === 'number').slice(0, 6)), w: uid(), i: item.id};
    const text = `Продаю: ${baseName(item)}${compact.u ? ' +' + compact.u : ''}${compact.a ? ' ★' + compact.a : ''} ⟦ae:i:${enc(compact)}⟧`;
    if (text.length > 500) return toast('Слишком много характеристик для чата.');
    api('/api/chat/global', 'POST', {text}).then(() => { toast('Предмет отправлен в общий чат'); sfx.play('page'); }, e => toast(cleanError(e)));
  }
  function itemCard(o) {
    const fake = {name: o.n, rarity: o.r, level: o.l, upgradeLevel: o.u, ascension: o.a, type: o.t, stats: o.s};
    const icon = iconFor(fake) || '/assets/items/sprites/sword.webp';
    const card = h('button', {type: 'button', class: 'ae-chat-item', 'data-ae-rarity': o.r || 'common', onclick: e => { e.stopPropagation(); card.classList.toggle('is-open'); }},
      h('img', {src: icon, alt: '', style: iconStyle(fake)}), h('span', {class: 'ae-grow'}, h('b', {}, `${o.n}${o.u ? ' +' + o.u : ''}${o.a ? ' ★' + o.a : ''}`), h('small', {}, `${RAR_RU[o.r] || o.r || ''} · ур. ${o.l}${o.th ? ' · 🗡️ двуручное' : ''}`),
        h('small', {class: 'ae-chat-item-stats'}, statLine(o.s) || 'Без характеристик')));
    if (String(o.w || '') !== String(uid())) { const asked = myAsk(o);
      card.dataset.aeShown = JSON.stringify(o);
      card.append(h('span', {class: 'ae-lot-btns'}, h('span', {role: 'button', tabindex: '0', class: 'ae-btn ae-buy-shown' + (asked ? '' : ' ae-primary'), onclick: e => { e.stopPropagation(); askToBuy(o, card); }}, asked ? `⏳ Ваша цена: ${fmt(asked)}` : '💰 Купить'))); }
    return card;
  }
  // ---------- co-op invites in the global chat ----------
  const COOP_RE = /⟦ae:c:([A-Za-z0-9+/=]+)⟧/;
  function shareCoop(room) {
    const k = 'aeth_coop_shared_' + room.id, last = Number(localStorage.getItem(k) || 0);
    if (Date.now() - last < 60000) return toast(`Приглашение уже в чате. Повторить можно через ${Math.ceil((60000 - (Date.now() - last)) / 1000)} с.`);
    const o = {r: room.id, d: room.dungeon.name, i: room.dungeon.id, mn: room.dungeon.minLevel, mx: room.dungeon.maxLevel, h: room.members.find(m => String(m.id) === String(room.hostId))?.name || ''};
    const text = `🛡️ Ищу отряд в «${o.d}» (ур. ${o.mn}–${o.mx}) ⟦ae:c:${enc(o)}⟧`;
    api('/api/chat/global', 'POST', {text}).then(() => { localStorage.setItem(k, String(Date.now())); toast('Приглашение отправлено в общий чат'); sfx.play('page'); }, e => toast(cleanError(e)));
  }
  function coopCard(o) {
    const lvl = me()?.level || 1, low = lvl < (o.mn || 1);
    return h('div', {class: 'ae-chat-item ae-chat-coop', onclick: e => e.stopPropagation()},
      h('img', {src: dIcon(COOP_ICONS[o.i] || 'goblin_cave'), alt: ''}),
      h('span', {class: 'ae-grow'}, h('b', {}, `🤝 Кооп: ${o.d}`), h('small', {}, `ур. ${o.mn}–${o.mx}${o.h ? ' · лидер ' + o.h : ''}`)),
      h('button', {type: 'button', class: 'ae-btn ae-primary', disabled: low, onclick: async e => {
        e.stopPropagation();
        try { await api('/api/coop/join', 'POST', {roomId: o.r}); toast('Вы в отряде!'); sfx.play('bell'); openCoop(); }
        catch (err) { toast(/уже в отряде|Сначала покиньте/i.test(cleanError(err)) ? 'Вы уже в другом отряде — сначала покиньте его.' : cleanError(err).replace('Комната уже недоступна.', 'Отряд уже ушёл в поход или распущен.')); }
      }}, low ? `с ${o.mn} ур.` : 'Вступить'));
  }
  // ---------- clans: invite friends, post an invitation to the global chat ----------
  const CLAN_RE = /⟦ae:k:([A-Za-z0-9+/=]+)⟧/;
  async function joinClanByCode(code) {
    try { const r = await api('/api/ae-clan/join', 'POST', {code}); sfx.play('bell'); bigBanner(`🛡️ Вы вступили в клан [${r.clan.tag}] «${r.clan.name}»!`, false); setTimeout(() => clickPlace('clan'), 700); }
    catch (e) { toast(cleanError(e)); }
  }
  async function shareClan() {
    try {
      const r = await api('/api/ae-clan/share', 'POST', {}), c = r.clan, k = 'aeth_clan_shared_' + c.id, last = Number(localStorage.getItem(k) || 0);
      if (Date.now() - last < 120000) return toast(`Приглашение уже в чате. Повторить можно через ${Math.ceil((120000 - (Date.now() - last)) / 1000)} с.`);
      const o = {c: r.code, n: c.name, t: c.tag, l: c.level, m: c.members, x: c.max, ml: c.minLevel};
      await api('/api/chat/global', 'POST', {text: `🛡️ Клан [${c.tag}] «${c.name}» набирает героев ⟦ae:k:${enc(o)}⟧`});
      localStorage.setItem(k, String(Date.now())); toast('Приглашение в клан отправлено в общий чат'); sfx.play('page');
    } catch (e) { toast(cleanError(e)); }
  }
  function clanChatCard(o) {
    const lvl = me()?.level || 1, low = lvl < (o.ml || 1), full = o.m >= o.x;
    return h('div', {class: 'ae-chat-item ae-chat-coop', onclick: e => e.stopPropagation()}, h('span', {class: 'ae-entry-icon'}, '🛡️'),
      h('span', {class: 'ae-grow'}, h('b', {}, `Клан [${o.t}] «${o.n}»`), h('small', {}, `ур. клана ${o.l} · ${o.m}/${o.x} участников${o.ml > 1 ? ` · с ${o.ml} ур.` : ''}`)),
      h('button', {type: 'button', class: 'ae-btn ae-primary', disabled: low || full, onclick: e => { e.stopPropagation(); if (confirm(`Вступить в клан «${o.n}»?`)) joinClanByCode(o.c); }}, full ? 'Мест нет' : low ? `с ${o.ml} ур.` : 'Вступить'));
  }
  function openClanInvite() {
    let friends = null, clan = null;
    const st = openPanel('🛡️ Позвать в клан', body => {
      if (!friends) return body.append(h('p', {class: 'ae-empty'}, 'Загрузка…'));
      if (!clan) return body.append(h('p', {class: 'ae-empty'}, 'Вы не состоите в клане.'));
      body.append(h('div', {class: 'ae-pill'}, `[${clan.tag}] «${clan.name}» · ${clan.members}/${clan.max} участников`));
      body.append(h('button', {class: 'ae-btn ae-primary ae-wide', type: 'button', onclick: () => { closePanel(); shareClan(); }}, '📢 Пригласить в общий чат'));
      body.append(h('p', {class: 'ae-sub'}, 'Приглашение в чате действует сутки, по нему могут вступить до 15 героев — даже если набор в клан закрыт. Друзья получают личное приглашение и сообщение от бота.'));
      body.append(h('h3', {class: 'ae-h3'}, 'Друзья'));
      if (!friends.length) body.append(h('p', {class: 'ae-empty'}, 'Друзей пока нет — добавьте их в разделе «Друзья».'));
      for (const f of friends) body.append(h('div', {class: 'ae-row ae-card'}, h('span', {class: 'ae-dot' + (f.online ? ' is-on' : '')}), h('b', {class: 'ae-grow'}, `${f.name} (${f.level})`),
        f.inClan ? h('span', {class: 'ae-sub'}, 'уже в клане') : h('button', {class: 'ae-btn ae-primary', type: 'button', onclick: async ev => {
          try { await api('/api/ae-clan/invite', 'POST', {friendId: f.id}); ev.target.disabled = true; ev.target.textContent = 'Приглашён ✓'; toast(`Приглашение отправлено: ${f.name}`); sfx.play('bell'); } catch (e) { toast(cleanError(e)); } }}, 'Позвать')));
    });
    Promise.all([api('/api/friends').then(r => r.friends || []), api('/api/ae-clan').then(r => r.clan)]).then(([f, c]) => { friends = f; clan = c; }, e => { friends = []; toast(cleanError(e)); }).finally(() => { if (openPanelState === st) st.rerender(); });
  }
  function injectClanInvite() {
    const leave = [...document.querySelectorAll('main button')].find(b => /^Выйти из клана$/.test((b.textContent || '').trim()));
    if (!leave || leave.parentElement.querySelector(':scope > [data-ae-clan-invite]')) return;
    leave.before(h('div', {class: 'ae-row ae-clan-invite', 'data-ae-clan-invite': '1'},
      h('button', {type: 'button', class: 'ae-btn ae-primary ae-grow', onclick: openClanInvite}, '👥 Позвать друзей'),
      h('button', {type: 'button', class: 'ae-btn ae-grow', onclick: shareClan}, '📢 В общий чат')));
  }
  // ---------- Clan HQ: bonuses, daily chest, clan quests, contribution, rating, wars, requests, settings ----------
  let clanX = null, clanXAt = 0;
  async function loadClanX(force) {
    if (!force && clanX && Date.now() - clanXAt < 600000) return clanX;
    try { clanX = await api('/api/ae-clanx'); clanXAt = Date.now(); } catch { }
    return clanX;
  }
  const ROLE_RU = {owner: 'Глава', officer: 'Офицер', quartermaster: 'Казначей', veteran: 'Ветеран', member: 'Участник', recruit: 'Новичок'};
  const MEDAL = {1: '🥇', 2: '🥈', 3: '🥉'};
  const pbar = (cur, max, label, cls = '') => h('div', {class: 'ae-bar ' + cls}, h('i', {style: `width:${Math.max(0, Math.min(100, 100 * cur / Math.max(1, max)))}%`}), h('span', {}, label || `${fmt(cur)} / ${fmt(max)}`));
  function openClanHQ(startTab = 'main') {
    let d = null, tab = startTab, mem = null, topD = null, reqs = null, err = '';
    const load = async () => { try { d = await api('/api/ae-clanx'); clanX = d; clanXAt = Date.now(); err = ''; } catch (e) { err = cleanError(e); } rer(); };
    const rer = () => { if (openPanelState === st) st.rerender(); };
    const loadTab = async t => {
      try { if (t === 'members') mem = await api('/api/ae-clanx/members'); if (t === 'top') topD = await api('/api/ae-clanx/top'); if (t === 'requests') reqs = (await api('/api/ae-clanx/requests')).requests; } catch (e) { toast(cleanError(e)); }
      rer();
    };
    const go = t => { tab = t; rer(); loadTab(t); };
    const claimGoal = async g => { try { const r = await api('/api/ae-clanx/goal/claim', 'POST', {key: g.key}); applyReward(r.reward); sfx.play('coins'); bigBanner(`🎯 Награда клана: ${rewardText(r.reward)}`, false); await load(); } catch (e) { toast(cleanError(e)); } };
    const openChest = async () => { try { const r = await api('/api/ae-clanx/chest', 'POST', {}); applyReward(r.reward); sfx.play('coins'); try { Telegram.WebApp.HapticFeedback.notificationOccurred('success'); } catch {} bigBanner(`🎁 Клановый сундук: ${rewardText(r.reward)}`, !!r.reward.fragments); await load(); } catch (e) { toast(cleanError(e)); } };
    const st = openPanel('🏰 Штаб клана', body => {
      if (err) return body.append(h('p', {class: 'ae-empty'}, err));
      if (!d) return body.append(h('p', {class: 'ae-empty'}, 'Загрузка…'));
      if (!d.clan) { body.append(h('p', {class: 'ae-empty'}, 'Вы не состоите в клане.'), h('button', {class: 'ae-btn ae-primary ae-wide', type: 'button', onclick: () => { closePanel(); openClanSearch(); }}, '🔍 Найти клан')); return; }
      const c = d.clan, officer = ['owner', 'officer'].includes(d.role), place = d.season.find(x => x.clan === c.id)?.place;
      body.append(h('div', {class: 'ae-hq-head'}, h('span', {class: 'ae-hq-emblem'}, c.emblem || '🛡️'),
        h('div', {class: 'ae-grow'}, h('b', {}, `[${c.tag}] ${c.name}`, place ? ' ' + MEDAL[place] : ''), h('div', {class: 'ae-sub'}, `Ур. ${c.level} · ${c.members}/${c.max} участников · вы: ${ROLE_RU[d.role] || d.role}`),
          pbar(c.xp % 1000, 1000, c.level >= 15 ? 'Максимальный уровень' : `До ур. ${c.level + 1}: ${fmt(c.xp % 1000)} / 1000 XP`, 'is-mp'))));
      const tabs = [['main', '🏰 Штаб'], ['members', '📊 Вклад'], ['top', '🏆 Рейтинг'], ...(officer ? [['requests', `📨 Заявки${d.requests ? ' ' + d.requests : ''}`], ['settings', '⚙️']] : [])];
      body.append(h('div', {class: 'ae-tabs'}, tabs.map(([k, l]) => h('button', {type: 'button', class: 'ae-tab' + (tab === k ? ' is-on' : ''), onclick: () => go(k)}, l))));
      if (tab === 'main') {
        const b = d.bonus;
        body.append(h('div', {class: 'ae-hq-bonus'}, h('b', {}, '✨ Бонусы клана для всех участников'),
          h('div', {class: 'ae-hq-pills'}, h('span', {}, `+${b.exp}% опыта`), h('span', {}, `+${b.gold}% золота`), h('span', {}, `+${b.loot}% к шансу редкой добычи`)),
          h('small', {}, b.champion ? `${MEDAL[b.champion]} Включая бонус чемпиона недели. ` : '', 'Растут с уровнем клана: +2% опыта и золота, +3% к добыче за каждый уровень.')));
        body.append(h('div', {class: 'ae-card ae-hq-chest' + (d.chest.ready ? ' is-ready' : '')}, h('span', {class: 'ae-hq-ic'}, '🎁'),
          h('div', {class: 'ae-grow'}, h('b', {}, 'Ежедневный сундук клана'), h('div', {class: 'ae-sub'}, `${fmt(d.chest.preview.gold)} 🪙 · ${fmt(d.chest.preview.silver)} 🥈 · ${fmt(d.chest.preview.exp)} опыта · ✦ ${d.chest.preview.fragChance}%${d.chest.preview.ticketChance ? ` · 🎟️ ${d.chest.preview.ticketChance}%` : ''}`)),
          d.chest.ready ? h('button', {class: 'ae-btn ae-primary', type: 'button', onclick: openChest}, 'Открыть') : h('span', {class: 'ae-sub'}, `через ${untilText(d.chest.next)}`)));
        body.append(h('h3', {class: 'ae-h3'}, '🎯 Задания клана'));
        for (const g of d.goals) body.append(h('div', {class: 'ae-card ae-hq-goal' + (g.done ? ' is-done' : '')},
          h('div', {class: 'ae-row'}, h('span', {class: 'ae-hq-ic'}, g.icon), h('div', {class: 'ae-grow'}, h('b', {}, g.name), h('div', {class: 'ae-sub'}, `${g.kind === 'day' ? 'Задание дня' : 'Задание недели'}${g.past ? ' (прошлое)' : g.endsAt ? ' · осталось ' + untilText(g.endsAt) : ''} · награда каждому: ${rewardText(g.reward)}`))),
          pbar(g.prog, g.target, `${fmt(g.prog)} / ${fmt(g.target)}`),
          g.canClaim ? h('button', {class: 'ae-btn ae-primary ae-wide', type: 'button', onclick: () => claimGoal(g)}, '🎁 Забрать награду') : g.claimed ? h('div', {class: 'ae-sub ae-good'}, '✅ Награда получена') : g.done ? h('div', {class: 'ae-sub'}, 'Выполнено до вашего вступления') : ''));
        body.append(h('p', {class: 'ae-sub'}, 'Засчитывается всё, что делают участники: монстры, боссы, дуэли и арена, подземелья, добыча руды, зелья и рейд. Награду получает каждый участник клана.'));
        const r = d.raid;
        body.append(h('div', {class: 'ae-card ae-hq-raid'}, h('div', {class: 'ae-row'}, h('span', {class: 'ae-hq-ic'}, '🐲'), h('div', {class: 'ae-grow'}, h('b', {}, 'Страж клановых врат'), h('div', {class: 'ae-sub'}, r.hp > 0 ? `Пошаговый бой: 12 ходов, навыки и связки с соклановцами. Сброс через ${untilText(r.resetAt)}.` : 'Повержен на этой неделе!'))),
          pbar(r.hp, r.max, `${fmt(r.hp)} / ${fmt(r.max)} HP`, 'is-foe'),
          h('button', {class: 'ae-btn ae-primary ae-wide', type: 'button', disabled: (!r.run && (r.doneToday || r.hp <= 0)), onclick: () => { closePanel(); openClanRaid(); }},
            r.run ? (r.run.status === 'active' ? '⚔️ Продолжить бой' : '🎁 Итоги боя') : r.hp <= 0 ? 'Страж повержен' : r.doneToday ? 'Бой уже был сегодня' : '⚔️ В бой со Стражем')));
        const w = d.war;
        body.append(h('div', {class: 'ae-card ae-hq-war'}, h('b', {}, '⚔️ Война кланов'), w && w.foe ? [
          h('div', {class: 'ae-hq-vs'}, h('span', {}, `${c.emblem} [${c.tag}]`), h('b', {}, `${fmt(w.mine)} : ${fmt(w.theirs)}`), h('span', {}, `[${w.foe.tag}] ${w.foe.emblem}`)),
          h('div', {class: 'ae-sub'}, `Против «${w.foe.name}» (ур. ${w.foe.level}). Очки вклада всех участников до конца недели (${untilText(w.endsAt)}). Победа: +2000 🪙 в казну и +300 опыта клана, ничья: +1000, поражение: +500.`)]
          : h('div', {class: 'ae-sub'}, 'Соперник пока не найден — война начнётся, как только появится ещё один клан. Новые войны стартуют каждую неделю.')));
        body.append(h('div', {class: 'ae-card ae-row'}, h('span', {class: 'ae-hq-ic'}, '💰'), h('div', {class: 'ae-grow'}, h('b', {}, 'Казна клана'), h('div', {class: 'ae-sub'}, `${fmt(c.treasury)} 🪙 · ${fmt(c.treasurySilver)} 🥈 · ${fmt(c.treasuryOre)} руды`)),
          h('button', {class: 'ae-btn ae-primary', type: 'button', onclick: () => openClanDonate(() => load())}, 'Пополнить')));
        body.append(h('button', {class: 'ae-btn ae-wide', type: 'button', onclick: () => openClanDeposit()}, '🎒 Внести вещь в хранилище клана'));
        body.append(treasuryHelp());
        body.append(h('div', {class: 'ae-pill'}, `📊 Ваш вклад за неделю: ${fmt(d.myPts)} · клан: ${fmt(d.weekPts)}`));
        body.append(h('div', {class: 'ae-row'}, h('button', {class: 'ae-btn ae-grow', type: 'button', onclick: () => { closePanel(); openClanInvite(); }}, '👥 Позвать друзей'), h('button', {class: 'ae-btn ae-grow', type: 'button', onclick: () => { closePanel(); openCoop(); }}, '🤝 Кооп с соклановцами')));
        body.append(h('p', {class: 'ae-sub'}, '🤝 Если в кооп-подземелье с вами соклановец — награда +20% и выше шанс осколка.'));
      }
      if (tab === 'members') {
        if (!mem) return body.append(h('p', {class: 'ae-empty'}, 'Загрузка…'));
        if (mem.mvp) body.append(h('div', {class: 'ae-pill'}, `👑 Лучший прошлой недели: ${mem.mvp.name} — ${fmt(mem.mvp.pts)} очков`));
        body.append(h('p', {class: 'ae-sub'}, 'Очки за неделю: монстр 1, босс 5, подземелье 8, победа в дуэли или на арене 4, зелье 1, 5 руды 1, бой со Стражем 10 + 1 за каждые 100 урона, 100 монет в казну 1.'));
        mem.members.forEach((m, i) => body.append(h('div', {class: 'ae-card ae-row ae-hq-mem' + (m.away >= 3 ? ' is-away' : '')},
          h('span', {class: 'ae-hq-rank'}, i < 3 && m.week ? MEDAL[i + 1] : `${i + 1}`), h('img', {class: 'ae-avatar', src: heroPortrait(m.classId), alt: ''}),
          h('div', {class: 'ae-grow'}, h('b', {}, m.name), h('div', {class: 'ae-sub'}, `${ROLE_RU[m.role] || m.role} · ур. ${m.level} · ${m.away <= 0 ? 'сегодня в игре' : m.away >= 3 ? `⚠️ не заходил ${m.away} дн.` : `был ${m.away} дн. назад`}`),
            h('div', {class: 'ae-sub'}, `⚔️ ${m.detail.kills} · 👹 ${m.detail.bosses} · 🤺 ${m.detail.duels} · 🏰 ${m.detail.dungeons} · 🐲 ${fmt(m.raid)}`)),
          h('div', {class: 'ae-hq-pts'}, h('b', {}, fmt(m.week)), h('small', {}, `всего ${fmt(m.total)}`)),
          d.role === 'owner' && m.role !== 'owner' && m.away >= 3 ? h('button', {class: 'ae-btn', type: 'button', onclick: async () => {
            if (!confirm(`Исключить ${m.name} из клана? Не заходил ${m.away} дн.`)) return;
            try { await api('/api/clan/manage', 'POST', {action: 'kick', targetId: m.id}); toast(`${m.name} исключён`); loadTab('members'); } catch (e) { toast(cleanError(e)); } }}, 'Исключить') : '')));
        if (d.role === 'owner') body.append(h('p', {class: 'ae-sub'}, 'Неактивных 3+ дня глава может исключить прямо здесь. Если сам глава не заходит 3 дня, лидерство переходит к самому сильному активному участнику.'));
      }
      if (tab === 'top') {
        if (!topD) return body.append(h('p', {class: 'ae-empty'}, 'Загрузка…'));
        body.append(h('div', {class: 'ae-hq-bonus'}, h('b', {}, `🏆 Рейтинг недели · итоги через ${untilText(topD.endsAt)}`),
          h('small', {}, `Топ-3 по очкам вклада получают в казну ${topD.prizes.map(fmt).join(' / ')} 🪙, опыт клана и бонус чемпиона на неделю (+5/+3/+2% к опыту и золоту). У участников тег клана отмечается медалью.`)));
        topD.week.forEach((x, i) => body.append(h('div', {class: 'ae-card ae-row' + (x.id === c.id ? ' ae-hq-mine' : '')}, h('span', {class: 'ae-hq-rank'}, i < 3 && x.week ? MEDAL[i + 1] : `${i + 1}`), h('span', {class: 'ae-hq-ic'}, x.emblem),
          h('div', {class: 'ae-grow'}, h('b', {}, `[${x.tag}] ${x.name}`, x.place ? ' ' + MEDAL[x.place] : ''), h('div', {class: 'ae-sub'}, `ур. ${x.level} · ${x.members}/${x.max} · урон рейду ${fmt(x.raid)}`)), h('div', {class: 'ae-hq-pts'}, h('b', {}, fmt(x.week)), h('small', {}, 'очков')))));
        if (topD.season.length) body.append(h('p', {class: 'ae-sub'}, 'Прошлая неделя: ' + topD.season.map(x => `${MEDAL[x.place]} [${x.tag}] ${fmt(x.pts)}`).join(' · ')));
      }
      if (tab === 'requests') {
        if (!reqs) return body.append(h('p', {class: 'ae-empty'}, 'Загрузка…'));
        if (!reqs.length) body.append(h('p', {class: 'ae-empty'}, 'Новых заявок нет. Закройте открытый набор в настройках клана — тогда игроки смогут вступать только по заявке или приглашению.'));
        for (const q of reqs) body.append(h('div', {class: 'ae-card'}, h('div', {class: 'ae-row'}, h('img', {class: 'ae-avatar', src: heroPortrait(q.classId), alt: ''}), h('div', {class: 'ae-grow'}, h('b', {}, q.name), h('div', {class: 'ae-sub'}, `ур. ${q.level} · ${CLASS_RU2[q.classId] || q.classId}`))),
          q.msg ? h('p', {class: 'ae-sub'}, `«${q.msg}»`) : '',
          h('div', {class: 'ae-row'}, h('button', {class: 'ae-btn ae-primary ae-grow', type: 'button', onclick: async () => { try { await api('/api/ae-clanx/request/decide', 'POST', {id: q.id, accept: true}); toast(`${q.name} принят(а) в клан`); sfx.play('bell'); await load(); loadTab('requests'); } catch (e) { toast(cleanError(e)); } }}, '✅ Принять'),
            h('button', {class: 'ae-btn ae-grow', type: 'button', onclick: async () => { try { await api('/api/ae-clanx/request/decide', 'POST', {id: q.id, accept: false}); await load(); loadTab('requests'); } catch (e) { toast(cleanError(e)); } }}, 'Отклонить'))));
      }
      if (tab === 'settings') {
        const welcome = h('textarea', {class: 'ae-input', rows: '3', maxlength: '200', placeholder: 'Например: Привет! Бей Стража каждый день и заходи в чат 🙂'}); welcome.value = c.welcome || '';
        let emblem = c.emblem || '🛡️';
        const grid = h('div', {class: 'ae-hq-emblems'}, d.emblems.map(e => h('button', {type: 'button', class: 'ae-hq-em' + (e === emblem ? ' is-on' : ''), onclick: ev => { emblem = e; grid.querySelectorAll('.ae-hq-em').forEach(b => b.classList.toggle('is-on', b === ev.currentTarget)); }}, e)));
        body.append(h('h3', {class: 'ae-h3'}, 'Эмблема клана'), grid, h('h3', {class: 'ae-h3'}, 'Приветствие новичкам'), welcome,
          h('p', {class: 'ae-sub'}, 'Каждый новый участник увидит это сообщение при входе в игру.'),
          h('button', {class: 'ae-btn ae-primary ae-wide', type: 'button', onclick: async () => { try { await api('/api/ae-clanx/settings', 'POST', {welcome: welcome.value, emblem}); toast('Сохранено'); await load(); } catch (e) { toast(cleanError(e)); } }}, '💾 Сохранить'),
          h('p', {class: 'ae-sub'}, 'Описание клана, открытый набор, минимальный уровень, роли, исключение и передача лидерства — в Доме клана (блок «Устройство клана»).'));
      }
    }, {cls: 'ae-hq-panel'});
    load().then(() => { if (tab !== 'main') loadTab(tab); });
  }
  // ---------- the Gate Guardian: a real turn-based fight ----------
  function openClanRaid() {
    let run = null, busy = false, skillsOpen = false, err = '';
    const rer = () => { if (openPanelState === st) st.rerender(); };
    const act = async (action, skillId) => {
      if (busy || !run || run.status !== 'active') return; busy = true;
      const before = run.foe.hp, hp0 = run.hp;
      try { run = (await api('/api/ae-clanx/raid/act', 'POST', {action, skillId})).run; sfx.play(run.foe.hp < before ? 'hit' : 'tick', 0.4);
        if (run.foe.hp < before) floatAt('[data-bv-foe]', '−' + fmt(before - run.foe.hp), 'is-dmg'); if (run.hp < hp0) floatAt('[data-bv-hero]', '−' + fmt(hp0 - run.hp), 'is-hurt');
        if (run.status === 'ended') { sfx.play(run.result?.defeated ? 'coins' : 'fail', 0.5); loadClanX(true); } }
      catch (e) { toast(cleanError(e)); } finally { busy = false; rer(); }
    };
    const floatAt = (sel, text, cls) => requestAnimationFrame(() => { const el = st.body.querySelector(sel); if (!el) return; const r = el.getBoundingClientRect(), n = h('div', {class: 'ae-float ' + cls, style: `left:${r.left + r.width * 0.45}px;top:${r.top + r.height * 0.25}px`}, text); document.body.append(n); setTimeout(() => n.remove(), 900); });
    const claim = async () => { try { const r = await api('/api/ae-clanx/raid/claim', 'POST', {}); if (!r.alreadyClaimed) { applyReward(r.reward); toast('Награда: ' + rewardText(r.reward)); } closePanel(); setTimeout(reopenClan, 300); } catch (e) { toast(cleanError(e)); } };
    const st = openPanel('🐲 Страж клановых врат', body => {
      if (err) return body.append(h('p', {class: 'ae-empty'}, err), h('button', {class: 'ae-btn ae-wide', type: 'button', onclick: () => { closePanel(); openClanHQ(); }}, '← В штаб клана'));
      if (!run) return body.append(h('p', {class: 'ae-empty'}, 'Загрузка…'));
      battleMode(body, run.status === 'active');
      if (run.status === 'active') {
        const cls = me()?.classId || 'warrior', ph = run.phase;
        body.append(battleView({location: 'Клановые врата', mode: `Фаза ${ph.n}/3`, round: `Ход ${run.turn + 1}/${run.turns}`, scene: '/assets/catacombs-DeUOVUij.webp',
          turn: 'Ваш ход — выберите действие', turnShort: 'Ваш ход',
          hero: {name: me()?.name || 'Герой', cls: CLASS_RU2[cls] || cls, level: me()?.level || 1, hp: run.hp, maxHp: run.maxHp, mp: run.mp, maxMp: run.maxMp, mpLabel: 'MANA', portrait: heroPortrait(cls), body: heroBody(cls)},
          foe: {name: 'Страж клановых врат', level: 'Рейдовый босс', hp: run.foe.hp, maxHp: run.foe.maxHp, atk: run.foe.atk, img: '/assets/sprites/generated/monsters/v_cr_colossus.webp'},
          note: run.log.at(-1),
          intent: run.heavyNext ? {label: 'Страж готовит:', name: '💢 Сокрушающий удар', text: 'Двойной урон на следующем ходу — самое время встать в защиту.', value: '×2'} : {label: 'Фаза:', name: ph.name, text: ph.text},
          series: {label: 'Урон за бой', value: fmt(run.dealt), sub: run.ally ? `🤝 Связка от ${run.ally.name} ждёт ваш атакующий навык` : 'Ваш навык с эффектом станет связкой для следующего соклановца'},
          actions: [{kind: 'attack', label: 'Атака', onClick: () => act('attack')},
            {kind: 'skill', label: 'Навыки', attr: {'aria-expanded': String(skillsOpen)}, onClick: () => { skillsOpen = !skillsOpen; rer(); }},
            {kind: 'defend', label: 'Защита (+12% MP)', onClick: () => act('defend')},
            {kind: 'potion', label: `Зелье (${run.potions})`, disabled: !run.potions, onClick: () => act('potion')}],
          secondary: [{label: 'Отступить', onClick: async () => { if (!confirm('Отступить? Нанесённый урон засчитается, но новый бой — только завтра.')) return; try { run = (await api('/api/ae-clanx/raid/leave', 'POST', {})).run; } catch (e) { toast(cleanError(e)); } rer(); }}],
          log: run.log, menu: skillsOpen ? skillMenu({mp: run.mp, onClose: () => { skillsOpen = false; rer(); }, onUse: k => { skillsOpen = false; act('skill', k.id); }}) : null}));
        return;
      }
      const r = run.result || {};
      body.append(h('div', {class: 'ae-card ae-result ' + (r.defeated ? 'is-win' : '')}, h('b', {}, r.defeated ? '🏆 Страж клановых врат повержен!' : `⚔️ Урон по Стражу: ${fmt(r.total || run.dealt)}`),
        h('div', {class: 'ae-sub'}, `Здоровье Стража: ${fmt(r.raidHp ?? run.foe.hp)} / ${fmt(run.foe.maxHp)}${r.combos ? ` · связок с соклановцами: ${r.combos}` : ''}`),
        r.item?.item_json ? h('div', {class: 'ae-sub ae-good'}, `🎁 Недельный трофей рейда: ${r.item.item_json.name} — в «Моих серверных вещах» клана`) : '',
        r.reward ? h('div', {class: 'ae-sub'}, `Награда за бой: ${rewardText(r.reward)}`) : ''));
      body.append(h('button', {class: 'ae-btn ae-primary ae-wide', type: 'button', onclick: claim}, '🎁 Забрать и вернуться'));
      body.append(h('div', {class: 'ae-log'}, run.log.slice().reverse().slice(0, 8).map(l => h('div', {}, l))));
    }, {cls: 'ae-horde-panel'});
    (async () => {
      try { const o = await api('/api/ae-clanx'); const cur = o?.raid?.run;
        run = cur || (await api('/api/ae-clanx/raid/start', 'POST', {})).run; } catch (e) { err = cleanError(e); }
      rer();
    })();
  }
  // ---------- clan search + join requests ----------
  function openClanSearch() {
    let d = null, onlyOpen = false;
    const load = async () => { try { d = await api('/api/ae-clanx/search'); } catch (e) { toast(cleanError(e)); } if (openPanelState === st) st.rerender(); };
    const st = openPanel('🔍 Поиск клана', body => {
      if (!d) return body.append(h('p', {class: 'ae-empty'}, 'Загрузка…'));
      if (d.inClan) body.append(h('p', {class: 'ae-note'}, 'Вы уже в клане. Чтобы перейти в другой, сначала выйдите из текущего в Доме клана.'));
      else body.append(h('div', {class: 'ae-hq-bonus'}, h('b', {}, 'Зачем клан?'), h('small', {}, 'Ежедневный сундук, до +30% опыта и золота, клановые задания с наградой каждому, рейд на Стража врат, войны кланов и +20% в кооп-подземельях с соклановцами.')));
      body.append(h('div', {class: 'ae-tabs'}, [[false, 'Все кланы'], [true, 'Открытый набор']].map(([v, l]) => h('button', {type: 'button', class: 'ae-tab' + (onlyOpen === v ? ' is-on' : ''), onclick: () => { onlyOpen = v; st.rerender(); }}, l))));
      const list = d.clans.filter(c => !onlyOpen || c.open);
      if (!list.length) body.append(h('p', {class: 'ae-empty'}, 'Кланов пока нет — создайте первый в Доме клана!'));
      for (const c of list) {
        const low = d.myLevel < c.minLevel, full = c.members >= c.max;
        body.append(h('div', {class: 'ae-card'}, h('div', {class: 'ae-row'}, h('span', {class: 'ae-hq-ic'}, c.emblem),
          h('div', {class: 'ae-grow'}, h('b', {}, `[${c.tag}] ${c.name}`, c.place ? ' ' + MEDAL[c.place] : ''), h('div', {class: 'ae-sub'}, `ур. ${c.level} · ${c.members}/${c.max} · активны ${c.active} · с ${c.minLevel} ур. · ${c.open ? '🟢 открытый набор' : '🔒 по заявке'}`))),
          c.desc ? h('p', {class: 'ae-sub'}, c.desc) : '',
          d.inClan ? '' : full ? h('div', {class: 'ae-sub'}, 'Мест нет') : low ? h('div', {class: 'ae-sub'}, `Нужен ${c.minLevel} уровень`)
            : c.open ? h('button', {class: 'ae-btn ae-primary ae-wide', type: 'button', onclick: async () => { try { await api(`/api/clan/${c.id}/join`, 'POST', {}); sfx.play('bell'); bigBanner(`🛡️ Вы вступили в клан [${c.tag}] «${c.name}»!`, false); closePanel(); setTimeout(() => clickPlace('clan'), 500); } catch (e) { toast(cleanError(e)); } }}, '🛡️ Вступить')
            : c.requested ? h('button', {class: 'ae-btn ae-wide', type: 'button', onclick: async () => { try { await api('/api/ae-clanx/request/cancel', 'POST', {clanId: c.id}); toast('Заявка отозвана'); load(); } catch (e) { toast(cleanError(e)); } }}, '⏳ Заявка отправлена · отозвать')
            : h('button', {class: 'ae-btn ae-primary ae-wide', type: 'button', onclick: async () => { const msg = prompt('Пара слов главе клана (необязательно):', '') ?? null; if (msg === null) return;
              try { await api('/api/ae-clanx/request', 'POST', {clanId: c.id, msg}); toast('Заявка отправлена — глава получит уведомление'); sfx.play('bell'); load(); } catch (e) { toast(cleanError(e)); } }}, '📨 Подать заявку')));
      }
    });
    load();
  }
  // ---------- clan treasury donations + putting bag gear into the clan storage ----------
  function openClanDonate(onDone) {
    let gold = 0, silver = 0;
    const st = openPanel('💰 Пополнить казну', body => {
      const p = me() || {}, G = p.gold || 0, S = p.silver || 0;
      const gIn = h('input', {class: 'ae-input', type: 'number', min: '0', max: String(G), value: String(gold || ''), placeholder: 'Золото', oninput: e => { gold = Math.max(0, Math.floor(Number(e.target.value) || 0)); }});
      const sIn = h('input', {class: 'ae-input', type: 'number', min: '0', max: String(S), value: String(silver || ''), placeholder: 'Серебро', oninput: e => { silver = Math.max(0, Math.floor(Number(e.target.value) || 0)); }});
      const quick = (setter, total, inp) => h('div', {class: 'ae-row ae-quick'}, [100, 1000, 5000].map(v => h('button', {type: 'button', class: 'ae-btn', disabled: total < v, onclick: () => { setter(v); inp.value = v; }}, fmt(v))),
        h('button', {type: 'button', class: 'ae-btn', disabled: total < 10, onclick: () => { const v = Math.floor(total * 0.1); setter(v); inp.value = v; }}, '10%'));
      body.append(h('p', {class: 'ae-note'}, 'Золото и серебро из казны глава и офицеры тратят на клановые проекты (Арсенал, Исследовательский зал, Снабжение) и на повышение уровня клана. За каждые 100 внесённых монет — 1 очко вклада.'),
        h('div', {class: 'ae-pill'}, `У вас: ${fmt(G)} 🪙 · ${fmt(S)} 🥈`), treasuryHelp(),
        h('b', {}, '🪙 Золото'), gIn, quick(v => { gold = v; }, G, gIn), h('b', {}, '🥈 Серебро'), sIn, quick(v => { silver = v; }, S, sIn),
        h('button', {type: 'button', class: 'ae-btn ae-primary ae-wide', onclick: async () => {
          const cur = me() || {};
          if (gold + silver <= 0) return toast('Укажите сумму.');
          if (gold > (cur.gold || 0) || silver > (cur.silver || 0)) return toast('Не хватает монет.');
          const err = canAct?.(); if (err) return toast(err);
          try { const r = await api('/api/ae-clanx/donate', 'POST', {gold, silver});
            B()?.setPlayer(x => x && {...x, gold: Math.max(0, (x.gold || 0) - gold), silver: Math.max(0, (x.silver || 0) - silver)});
            sfx.play('coins'); bigBanner(`💰 В казну: ${[gold && fmt(gold) + ' 🪙', silver && fmt(silver) + ' 🥈'].filter(Boolean).join(' · ')}`, false);
            toast(`Казна: ${fmt(r.treasury.gold)} 🪙 · ${fmt(r.treasury.silver)} 🥈`); closePanel(); loadClanX(true); onDone ? onDone() : setTimeout(reopenClan, 300);
          } catch (e) { toast(cleanError(e)); } }}, '💰 Внести в казну'));
    });
    return st;
  }
  function openClanDeposit() {
    const st = openPanel('🎒 Внести вещь в хранилище', body => {
      const p = me() || {}, worn = new Set(Object.values(p.equipped || {}).filter(Boolean).map(e => e.id));
      const ok = i => i && !i.isEquipped && !i.isLocked && !worn.has(i.id) && (i.serverOwned ? !i.boundToClan : transferable(i));
      const list = (p.inventory || []).filter(ok).sort((a, b) => (b.level || 0) - (a.level || 0));
      body.append(h('p', {class: 'ae-note'}, 'Вещь переедет из вашей сумки в общее хранилище клана. Глава, офицеры и казначей смогут выдать её любому участнику, продать или разобрать в казну. Внесённая вещь привязывается к клану.'));
      body.append(h('p', {class: 'ae-sub'}, 'Забирать, выдавать, продавать и разбирать вещи из хранилища могут глава, офицеры и казначей. Назначить казначея может глава в списке участников клана.'));
      if (!list.length) return body.append(h('p', {class: 'ae-empty'}, 'В сумке нет вещей, которые можно внести (надетые вещи сначала снимите).'));
      for (const it of list) body.append(h('button', {type: 'button', class: 'ae-chat-item ae-equip-row', 'data-ae-rarity': it.rarity || 'common', onclick: async ev => {
        if (!confirm(`Внести «${baseName(it)}» в хранилище клана? Вернуть её себе сможет только руководство клана.`)) return;
        ev.currentTarget.disabled = true;
        try { const qty = STACKABLE.has(it.type) && (it.stackCount || 1) > 1 ? Math.max(1, Math.min(it.stackCount, Math.floor(Number(prompt(`Сколько внести? (у вас ${it.stackCount})`, String(it.stackCount))) || 0))) : 1;
          const srv = it.serverOwned ? it : await depositItem(it, qty);
          await api(`/api/clan/storage/${srv.id}/deposit`, 'POST', {quantity: srv.stackCount || 1});
          B()?.setPlayer(cur => cur && {...cur, inventory: cur.inventory.flatMap(i => i.id !== srv.id ? [i] : (i.stackCount || 1) > 1 ? [{...i, stackCount: i.stackCount - 1}] : [])});
          if ((srv.stackCount || 1) <= 1) rememberGone([srv.id]);
          toast(`«${baseName(it)}» в хранилище клана`); closePanel(); setTimeout(reopenClan, 300);
        } catch (e) { toast(cleanError(e)); ev.currentTarget.disabled = false; }
      }}, h('img', {src: iconFor(it) || '/assets/items/sprites/sword.webp', alt: '', style: iconStyle(it)}),
        h('span', {class: 'ae-grow'}, h('b', {}, `${baseName(it)}${it.upgradeLevel ? ' +' + it.upgradeLevel : ''}`), h('small', {}, `${RARITY_RU[it.rarity] || ''} · ур. ${it.level || 1}${(it.stackCount || 1) > 1 ? ` · ×${it.stackCount}` : ''}`), h('small', {class: 'ae-chat-item-stats'}, statLine(it.stats) || '')),
        h('span', {class: 'ae-equip-go'}, 'Внести')));
    });
    return st;
  }
  const TREASURY_HELP = '🪙🥈 <b>Золото и серебро</b> — «Пополнить казну».<br>⛏️ <b>Руда</b> — за победу над Стражем и за «Разобрать» вещи в хранилище.<br>🎯 Ещё: задания клана, войны, рейтинг.<br>🏗️ Тратится на проекты и уровень клана.';
  const treasuryHelp = () => h('details', {class: 'ae-combos ae-treasury-help'}, h('summary', {}, 'ℹ️ Как пополнить казну'), h('div', {class: 'ae-sub', html: TREASURY_HELP}));
  function injectClanTreasury() {
    const t = [...document.querySelectorAll('main p, main div, main span')].find(e => !e.childElementCount && /^Казна:/.test((e.textContent || '').trim()));
    if (!t || t.parentElement.querySelector(':scope > [data-ae-treasury]')) return;
    t.after(h('div', {class: 'ae-row ae-clan-invite', 'data-ae-treasury': '1'},
      h('button', {type: 'button', class: 'ae-btn ae-primary ae-grow', onclick: () => openClanDonate()}, '💰 Пополнить казну'),
      h('button', {type: 'button', class: 'ae-btn ae-grow', onclick: () => openClanDeposit()}, '🎒 Внести вещь')));
    t.parentElement.querySelector(':scope > [data-ae-treasury]').after(treasuryHelp());
  }
  // Mine: the offline expedition card sits at the very bottom, under a long list of veins. Show it right under
  // the mine's status card. Reordered with CSS only (the game keeps owning these nodes).
  function liftMineExpedition() {
    const main = document.querySelector('main'); if (!main) return;
    const exp = [...main.querySelectorAll('section, div')].find(e => /^Офлайн-экспедиция/.test((e.innerText || '').trim()) && e.parentElement && [...e.parentElement.children].some(c => /Королевские Рудники/.test(c.innerText || '')));
    if (!exp) return;
    const box = exp.parentElement; if (box.dataset.aeMine) return;
    const kids = [...box.children], gap = kids[1] ? getComputedStyle(kids[1]).marginTop : '12px';
    const status = kids.findIndex(c => /Королевские Рудники/.test(c.innerText || ''));
    box.dataset.aeMine = '1'; box.style.setProperty('--ae-mine-gap', gap);
    kids.forEach((c, i) => { c.dataset.aeMineOrder = i === status ? '0' : c === exp ? '1' : String(Math.min(8, i + 2)); });
    exp.dataset.aeMineLifted = '1';
  }
  // Expedition card: what each shift brings, progress and haul while away, a bot reminder, a glow when it is back.
  const MINE_LOOT = [['🪨', 'Уголь', 1], ['🟤', 'Медная руда', 1], ['🌿', 'Лечебная трава', 1], ['💧', 'Чистая вода', 1], ['⚪', 'Железная руда', 5], ['🌱', 'Горный корень', 5],
    ['✨', 'Серебряная руда', 15], ['🌙', 'Лунная пыльца', 15], ['💠', 'Мифриловая руда', 15], ['🔮', 'Магическая эссенция', 15], ['🪙', 'Золотая руда', 25], ['💎', 'Сырой самоцвет', 25], ['🟣', 'Адамантит', 25]];
  const SHIFTS = [[1, 'Короткая смена'], [3, 'Глубокая выработка'], [7, 'Дальняя экспедиция']];
  const shiftYield = h => { const picks = h >= 7 ? 4 : h >= 3 ? 3 : 2, a = Math.max(1, Math.round(h * 0.45)); return {lo: picks * Math.max(1, Math.round(a * 0.6)), hi: picks * (a + h + 2), kinds: picks, rare: h >= 7 ? '×1.8' : h >= 3 ? '×1.25' : '—', exp: h * 25}; };
  const clock = t => new Date(t).toLocaleTimeString('ru-RU', {hour: '2-digit', minute: '2-digit'});
  const leftText = ms => { const m = Math.max(0, Math.ceil(ms / 60e3)), hh = Math.floor(m / 60); return hh ? `${hh} ч ${m % 60} мин` : `${m} мин`; };
  function expeditionExtra(p) {
    const P = p.miningExpedition, now = Date.now(), lvl = p.miningLevel || 1;
    if (!P) {
      const have = MINE_LOOT.filter(x => x[2] <= lvl), next = MINE_LOOT.find(x => x[2] > lvl);
      return h('div', {class: 'ae-exp-extra'},
        h('div', {class: 'ae-exp-table'}, SHIFTS.map(([hh, name]) => { const y = shiftYield(hh); return h('div', {class: 'ae-exp-row'}, h('b', {}, `${hh} ч.`), h('span', {}, name), h('span', {}, `≈ ${y.lo}–${y.hi} шт. · ${y.kinds} вида`), h('small', {}, `редкие ${y.rare} · +${y.exp} опыта`)); })),
        h('div', {class: 'ae-exp-loot'}, h('small', {}, 'Можно найти: '), have.map(x => h('span', {title: x[1]}, x[0])), next ? h('small', {class: 'ae-exp-next'}, ` · с ${next[2]} ур. шахты: ${MINE_LOOT.filter(x => x[2] === next[2]).map(x => x[0] + ' ' + x[1]).join(', ')}`) : ''),
        h('small', {class: 'ae-exp-tip'}, '💡 Запустите «Дальнюю экспедицию» перед сном — утром заберёте больше всего добычи. Бот напомнит, когда она вернётся.'));
    }
    const total = Math.max(1, P.endsAt - P.startedAt), done = now >= P.endsAt, pct = Math.min(100, Math.round(100 * (now - P.startedAt) / total));
    const haul = (P.rewards || []).map(r => h('span', {class: 'ae-exp-item is-' + (r.rarity || 'common'), title: r.name}, `${r.icon || '📦'} ${r.name} ×${r.count}`));
    return h('div', {class: 'ae-exp-extra' + (done ? ' is-done' : '')},
      done ? h('div', {class: 'ae-exp-ready'}, '✅ Экспедиция вернулась — заберите добычу!') : [
        h('div', {class: 'ae-bar is-mp'}, h('i', {style: `width:${pct}%`}), h('span', {}, `${pct}% · вернётся в ${clock(P.endsAt)} (через ${leftText(P.endsAt - now)})`)),
        h('small', {class: 'ae-exp-tip'}, '🔔 Бот напишет в Telegram, когда экспедиция вернётся (если уведомления включены).')],
      haul.length && !done ? h('div', {class: 'ae-exp-haul'}, h('small', {}, 'Везут:'), ...haul) : '');
  }
  let expSig = '';
  function decorateExpedition() {
    const card = document.querySelector('[data-ae-mine-lifted]'), p = me(); if (!card || !p) return;
    const P = p.miningExpedition, now = Date.now();
    const sig = JSON.stringify([P?.endsAt, P && Math.floor((now - P.startedAt) / 30e3), P && now >= P.endsAt, p.miningLevel]);
    let box = card.querySelector(':scope > [data-ae-exp]');
    card.classList.toggle('ae-exp-done', !!(P && now >= P.endsAt));
    if (box && sig === expSig) return;
    expSig = sig; const next = h('div', {'data-ae-exp': '1'}, expeditionExtra(p));
    if (box) box.replaceWith(next); else card.append(next);
  }
  setInterval(() => { if (!document.hidden && document.querySelector('[data-ae-mine-lifted]')) try { decorateExpedition(); } catch (e) { console.warn('ae exp', e); } }, 1000);
  // Crystal entry points inside the right places (Forge, Workshop, market's basic shop).
  function gemEntry(attr, title, sub, tab) {
    return h('button', {type: 'button', class: 'ae-bag-merge ae-gem-entry', [attr]: '1', onclick: () => openGems(tab)}, h('span', {class: 'ae-entry-icon'}, '💎'), h('span', {class: 'ae-grow'}, h('b', {}, title), h('small', {}, sub)), h('span', {class: 'ae-coop-go'}, '›'));
  }
  function injectGemPlaces() {
    const main = document.querySelector('main'); if (!main) return;
    const forge = [...main.querySelectorAll('p')].find(e => /^Заточка снаряжения/.test((e.textContent || '').trim()));
    if (forge && !main.querySelector('[data-ae-gem-forge]')) forge.after(gemEntry('data-ae-gem-forge', 'Вставить кристалл', 'Гнёзда в снаряжении: вампиризм, крит, кровотечение…', 'apply'));
    const craft = [...main.querySelectorAll('h1, h2')].find(e => /^Крафт снаряжения/.test((e.textContent || '').trim()));
    if (craft && !main.querySelector('[data-ae-gem-craft]')) { const box = craft.parentElement; box.after(gemEntry('data-ae-gem-craft', 'Создать кристалл', `Из трофеев с монстров и ${GEM_SILVER} 🥈`, 'craft')); }
    const tab = [...main.querySelectorAll('button')].find(b => /^Базовый магазин$/.test((b.textContent || '').trim()));
    const shopRow = tab?.parentElement, have = main.querySelector('[data-ae-gem-shop]');
    if (tab && (tab.getAttribute('aria-selected') === 'true' || (!tab.hasAttribute('aria-selected') && /amber|#302c24/.test(tab.className)))) { if (!have) shopRow.after(gemEntry('data-ae-gem-shop', 'Кристаллы', `Редкий товар: от ${fmt(Math.min(...GEMS.map(g => g.gold)))} 🪙`, 'buy')); }
    else have?.remove();
  }
  // HQ / search buttons in the Clan House; the native «Удар» opens the real fight.
  function injectClanHQ() {
    const leave = [...document.querySelectorAll('main button')].find(b => /^Выйти из клана$/.test((b.textContent || '').trim()));
    if (leave && !leave.parentElement.querySelector(':scope > [data-ae-clan-hq]')) {
      const n = clanX?.clan ? (clanX.chest?.ready ? 1 : 0) + (clanX.goals || []).filter(g => g.canClaim).length + (clanX.requests || 0) : 0;
      leave.before(h('button', {type: 'button', class: 'ae-btn ae-primary ae-wide ae-hq-btn', 'data-ae-clan-hq': '1', onclick: () => openClanHQ()}, '🏰 Штаб клана', h('small', {}, 'сундук · задания · вклад · рейтинг · война'), n ? h('i', {class: 'ae-hq-badge'}, String(n)) : ''));
      loadClanX(true).then(() => { const b = document.querySelector('[data-ae-clan-hq]'); const k = clanX?.clan ? (clanX.chest?.ready ? 1 : 0) + (clanX.goals || []).filter(g => g.canClaim).length + (clanX.requests || 0) : 0; if (b && k && !b.querySelector('.ae-hq-badge')) b.append(h('i', {class: 'ae-hq-badge'}, String(k))); });
    }
    const strike = [...document.querySelectorAll('main button')].find(b => /^Удар$/.test((b.textContent || '').trim()) && /Страж клановых врат/.test(b.closest('section, div')?.parentElement?.textContent || ''));
    if (strike && !strike.dataset.aeRaid) {
      strike.dataset.aeRaid = '1'; strike.textContent = '⚔️ В бой';
      strike.addEventListener('click', e => { e.preventDefault(); e.stopImmediatePropagation(); openClanRaid(); }, true);
      const note = [...strike.closest('section, div').parentElement.querySelectorAll('p')].find(p => /Один удар в сутки/.test(p.textContent || ''));
      if (note && !note.dataset.aeRaid) { note.dataset.aeRaid = '1'; note.textContent = 'Пошаговый бой раз в сутки: 12 ходов, навыки, защита и связки с соклановцами. ' + note.textContent.replace(/^Один удар в сутки\.\s*/, ''); }
    }
    if (!leave && !document.querySelector('[data-ae-clan-search]')) {
      const create = [...document.querySelectorAll('main button')].find(b => /Создать клан/.test(b.textContent || ''));
      if (create) create.parentElement.before(h('button', {type: 'button', class: 'ae-btn ae-primary ae-wide ae-hq-btn', 'data-ae-clan-search': '1', onclick: () => openClanSearch()}, '🔍 Найти клан', h('small', {}, 'открытые кланы и заявки в закрытые')));
    }
  }
  // Report activity to the clan (kills, bosses, dungeons, ore, potions) and apply clan bonuses to battle rewards.
  let cxSnap = null, cxPend = {}, cxFlushAt = 0, bonusSnap = null;
  function clanTick() {
    const p = me(), b = B(); if (!p?.statsSummary) return;
    const s = p.statsSummary, cur = {uid: p.userId, kills: s.monstersKilled || 0, bosses: s.bossesDefeated || 0, dungeons: s.dungeonsCleared || 0, ores: s.oresMined || 0, potions: s.potionsCrafted || 0};
    if (cxSnap && cxSnap.uid === cur.uid) for (const k of ['kills', 'bosses', 'dungeons', 'ores', 'potions']) { const dlt = cur[k] - cxSnap[k]; if (dlt > 0 && dlt < 60) cxPend[k] = (cxPend[k] || 0) + dlt; }
    cxSnap = cur;
    if (clanX && !clanX.clan) cxPend = {};
    if (Object.keys(cxPend).length && Date.now() - cxFlushAt > 20000) { cxFlushAt = Date.now(); const send = cxPend; cxPend = {}; api('/api/ae-clanx/progress', 'POST', send).catch(() => {}); }
    const bn = clanX?.clan ? clanX.bonus : null, won = s.battlesWon || 0;
    const prev = bonusSnap; bonusSnap = {uid: p.userId, won, gold: p.gold || 0, exp: p.exp || 0, level: p.level || 1};
    if (!bn || !prev || prev.uid !== p.userId || won <= prev.won || won - prev.won > 3 || !b?.setPlayer) return;
    const dg = (p.gold || 0) - prev.gold, de = (p.level || 1) === prev.level ? (p.exp || 0) - prev.exp : 0;
    const addG = dg > 0 ? Math.round(dg * bn.gold / 100) : 0, addE = de > 0 ? Math.round(de * bn.exp / 100) : 0;
    if (!addG && !addE) return;
    b.setPlayer(x => { if (!x) return x; const n = {...x, gold: (x.gold || 0) + addG}; return addE && b.gainExp ? b.gainExp(n, addE).player : n; });
    bonusSnap.gold += addG;
    const el = h('div', {class: 'ae-clan-bonus-pop'}, `🛡️ Бонус клана: ${[addG && `+${fmt(addG)} 🪙`, addE && `+${fmt(addE)} опыта`].filter(Boolean).join(' · ')}`); document.body.append(el); setTimeout(() => el.remove(), 2200);
  }
  // Gear up to 10 levels above the hero can be worn early: its stats are weakened by 6% per level of difference
  // (down to 40%) until the hero catches up. The original stats are kept on the item and restored automatically.
  const overFactor = diff => Math.max(0.4, 1 - 0.06 * diff);
  const scaleStats = (st, f) => Object.fromEntries(Object.entries(st || {}).map(([k, v]) => [k, typeof v === 'number' ? Math.round(v * f * 10) / 10 : v]));
  function overLevelFix(it, level, worn) {
    if (!it || typeof it !== 'object') return it;
    const diff = worn ? (it.level || 1) - level : 0;
    if (diff > 0) { const base = it.aeOver?.base || it.stats || {}; if (it.aeOver?.diff === diff) return it; return {...it, stats: scaleStats(base, overFactor(diff)), aeOver: {base, diff}}; }
    if (it.aeOver) { const {aeOver, ...rest} = it; return {...rest, stats: aeOver.base}; }
    return it;
  }
  let overNotified = '';
  function overLevelTick() {
    const p = me(), b = B(); if (!p?.equipped || !b?.setPlayer) return;
    const lvl = p.level || 1, needs = Object.values(p.equipped).some(it => it && ((it.level || 1) > lvl ? it.aeOver?.diff !== (it.level || 1) - lvl : !!it.aeOver)) || (p.inventory || []).some(it => it?.aeOver);
    if (!needs) return;
    b.setPlayer(x => { if (!x) return x; const L = x.level || 1;
      return {...x, equipped: Object.fromEntries(Object.entries(x.equipped || {}).map(([k, it]) => [k, overLevelFix(it, L, true)])), inventory: (x.inventory || []).map(it => overLevelFix(it, L, false))}; });
    const worst = Object.values(p.equipped).filter(it => it && (it.level || 1) > lvl).sort((a, c) => c.level - a.level)[0];
    const key = worst ? worst.id + ':' + lvl : '';
    if (worst && key !== overNotified) { overNotified = key; const d = worst.level - lvl;
      toast(`⚠️ «${worst.name}» на ${d} ур. выше героя: характеристики −${Math.round((1 - overFactor(d)) * 100)}% до ${worst.level} уровня`); }
  }
  // One timer for everything that watches the hero's save; it does nothing until the hero object changes.
  let watchedHero = null, watchedEq = null, watchedSlots = null;
  setInterval(() => {
    const p = me(); if (!p) return;
    const changed = p !== watchedHero; watchedHero = p;
    if (changed) { const sig = Object.values(p.equipped || {}).map(i => i?.id || '').join(','); if (sig !== watchedEq) { if (watchedEq !== null) syncEquippedSoon(); watchedEq = sig;
      // The player changed gear by hand: Premium auto-equip must never put back what they took off.
      const now = Object.fromEntries(Object.entries(p.equipped || {}).map(([k, v]) => [k, v?.id || null]));
      if (watchedSlots && !autoBusy) { const off = Object.entries(watchedSlots).filter(([k, id]) => id && now[k] !== id).map(([, id]) => id); if (off.length) rememberJudged(off.flatMap(id => [id, id + '@L' + (p.level || 1)])); }
      watchedSlots = now; } }
    if (!changed && !Object.keys(cxPend).length) return;
    for (const fn of changed ? [twoHandTick, overLevelTick, legendaryTick, luckTick, arenaTick, clanTick, petXpTick] : [clanTick, petXpTick]) try { fn(); } catch (e) { console.warn('ae watch', e); }
  }, 1000);
  setTimeout(() => loadClanX(), 6000); setInterval(() => loadClanX(), 600000);

  // ---------- «Угроза»: a hero far stronger than usual for their level meets tougher monsters (HP and damage),
  // and gets more experience and gold for them. The game reads window.__aeThreat when it prepares a monster. ----------
  const powerNorm = L => ({atk: 117 + 10.8 * L, def: 100 + 16 * L, hp: 520 + 80 * L}); // typical on-level gear (balance runs)
  function threatOf(st, L) {
    if (!st || !(L >= 15)) return 1;
    const n = powerNorm(L), atk = Math.max(Number(st.attack) || 0, Number(st.magicAttack) || 0);
    const r = 0.5 * atk / n.atk + 0.25 * (Number(st.defense) || 0) / n.def + 0.25 * (Number(st.maxHp) || 0) / n.hp;
    return Math.max(1, Math.min(2.6, 1 + (r - 1.3) * 1.5));
  }
  // The highest threat of the last 15 minutes counts, so taking gear off right before a fight does not reset it.
  let lastThreat = 0;
  const threatPeakKey = () => 'aeth_threat_peak_' + uid();
  function heldThreat(m) {
    let pk; try { pk = JSON.parse(localStorage.getItem(threatPeakKey()) || 'null'); } catch { pk = null; }
    const now = Date.now(), live = pk && now - pk.at < 15 * 60e3 ? pk.m : 0;
    if (m >= live) { if (!pk || pk.m !== m || now - pk.at > 60e3) localStorage.setItem(threatPeakKey(), JSON.stringify({m, at: now})); return m; }
    return live;
  }
  function threatTick() {
    const b = B(), p = me(); if (!b || !p) return;
    const inCombat = document.documentElement.hasAttribute('data-in-combat');
    if (!inCombat) { // never changes mid-fight
      const st = b.stats || {}, m = heldThreat(Math.round(threatOf(st, p.level) * 10) / 10);
      const T = m >= 1.1 ? {m, d: Math.round((1 + (m - 1) * 1.3) * 100) / 100, r: Math.round((1 + Math.min(0.5, (m - 1) * 0.35)) * 100) / 100} : null;
      window.__aeThreat = T;
      window.__aeHero = {lvl: p.level || 1, hp: Number(st.maxHp) || 0, atk: Math.max(Number(st.attack) || 0, Number(st.magicAttack) || 0), def: Number(st.defense) || 0}; // arena opponents match the hero
      if (T && Math.abs(lastThreat - m) >= 0.3) toast(`⚠️ Угроза ×${m}: ваш герой силён — монстры крепче и злее, опыт и золото +${Math.round((T.r - 1) * 100)}%`);
      else if (!T && lastThreat) toast('Угроза снята: монстры снова обычные');
      lastThreat = T ? m : 0;
    }
    // a chip during the fight, so it is clear why the monster is tougher
    const T = window.__aeThreat, show = inCombat && T && window.__aeThreatOn && !document.querySelector('.ae-battle-backdrop');
    let chip = document.querySelector('.ae-threat-chip');
    if (show && !chip) { chip = h('div', {class: 'ae-threat-chip ae-float', title: 'Монстры сильнее из-за мощного снаряжения'}, `⚠️ Угроза ×${T.m} · награда +${Math.round((T.r - 1) * 100)}%`); document.body.append(chip); }
    else if (!show && chip) chip.remove();
  }
  setTimeout(threatTick, 8000); setInterval(() => { if (!document.hidden) threatTick(); }, 3000);
  // ---------- player market: wallet top-up / withdrawal, auctions, selling and price offers from the chat ----------
  const LOT_RE = /⟦ae:l:([A-Za-z0-9+/=]+)⟧/;
  const opsKey = () => 'aeth_market_ops_' + uid();
  const opApplied = op => { try { return JSON.parse(localStorage.getItem(opsKey()) || '[]').includes(op); } catch { return false; } };
  const markOp = op => { let l; try { l = JSON.parse(localStorage.getItem(opsKey()) || '[]'); } catch { l = []; } l.push(op); localStorage.setItem(opsKey(), JSON.stringify(l.slice(-100))); };
  const refreshServerBag = () => window.dispatchEvent(new Event('aethelgard-market-inventory-refresh'));
  async function walletMove(kind, amount) {
    const b = B(), p = me(); if (!b || !p) throw new Error('Игра ещё загружается.');
    if (kind === 'deposit' && (p.gold || 0) < amount) throw new Error('Не хватает золота у героя.');
    const op = uuid4(), r = await api('/api/ae-market/' + kind, 'POST', {gold: amount, operationId: op});
    if (!opApplied(op)) { markOp(op); b.setPlayer(x => x && {...x, gold: Math.max(0, (x.gold || 0) + (kind === 'deposit' ? -amount : amount))}); }
    sfx.play('coins'); return r.balance;
  }
  // need: how much is missing for a purchase (opens with that amount filled in)
  function openMarketWallet(need = 0, after) {
    let bal = null, amount = need || 1000, busy = false;
    const st = openPanel('👛 Кошелёк рынка', body => {
      const p = me() || {};
      body.append(h('p', {class: 'ae-note'}, 'Покупки у игроков, предложения цены и ставки на аукционе оплачиваются из кошелька рынка. Туда же приходит выручка от продаж. Переводите золото героя в кошелёк и обратно.'));
      body.append(h('div', {class: 'ae-hq-pills ae-wallet-sum'}, h('span', {}, `👛 В кошельке: ${bal == null ? '…' : fmt(bal)} 🪙`), h('span', {}, `🧙 У героя: ${fmt(p.gold || 0)} 🪙`)));
      if (need) body.append(h('div', {class: 'ae-pill'}, `Для покупки не хватает ${fmt(need)} 🪙 в кошельке рынка`));
      const inp = h('input', {class: 'ae-input', type: 'number', min: '1', value: String(amount), oninput: e => { amount = Math.max(0, Math.floor(Number(e.target.value) || 0)); }});
      body.append(inp, h('div', {class: 'ae-row ae-quick'}, [1000, 5000, 10000].map(v => h('button', {type: 'button', class: 'ae-btn', onclick: () => { amount = v; inp.value = v; }}, fmt(v))),
        h('button', {type: 'button', class: 'ae-btn', onclick: () => { amount = p.gold || 0; inp.value = amount; }}, 'Всё')));
      const go = kind => async () => { if (busy || !(amount > 0)) return; busy = true;
        try { bal = await walletMove(kind, amount); toast(kind === 'deposit' ? `👛 В кошелёк рынка: +${fmt(amount)} 🪙` : `🧙 Герою: +${fmt(amount)} 🪙`); if (after && kind === 'deposit') { closePanel(); after(); return; } }
        catch (e) { toast(cleanError(e)); } finally { busy = false; if (openPanelState === st) st.rerender(); } };
      body.append(h('div', {class: 'ae-grid2'}, h('button', {type: 'button', class: 'ae-btn ae-primary', onclick: go('deposit')}, after ? '➕ Пополнить и купить' : '➕ Пополнить кошелёк'), h('button', {type: 'button', class: 'ae-btn', onclick: go('withdraw')}, '➖ Вывести герою')));
    });
    api('/api/ae-market/wallet').then(r => { bal = r.balance; if (openPanelState === st) st.rerender(); }, () => {});
  }
  // One gold for the player: the market wallet is only the server's till for deals. Gold moves in right before a deal
  // and income (sales, refunds of outbid bids or declined offers) moves straight back to the hero.
  let walletBusy = false, sweepAt = 0;
  async function ensureWallet(need) {
    const r = await api('/api/ae-market/wallet'), bal = r.balance || 0; if (bal >= need) return true;
    const diff = need - bal, have = me()?.gold || 0;
    if (have < diff) { toast(`Не хватает ${fmt(diff - have)} 🪙 золота.`); sfx.play('fail'); return false; }
    await walletMove('deposit', diff); return true;
  }
  async function sweepWallet(force) {
    if (walletBusy || !uid() || (!force && Date.now() - sweepAt < 45e3)) return; sweepAt = Date.now();
    try { const bal = (await api('/api/ae-market/wallet')).balance || 0; if (bal <= 0 || walletBusy) return;
      await walletMove('withdraw', bal); toast(`💰 С рынка: +${fmt(bal)} 🪙`); } catch {}
  }
  setTimeout(() => sweepWallet(true), 12000); setInterval(() => { if (!document.hidden) sweepWallet(); }, 60e3);
  const walletError = (e, retry) => { const m = String(e?.message || e || '').match(/Не хватает (\d+) золота в кошельке рынка/); if (!m) return false;
    (async () => { walletBusy = true; try { if (await ensureWallet(Number(m[1]) + 0) || false) await retry(); } finally { walletBusy = false; setTimeout(() => sweepWallet(true), 1500); } })().catch(err => toast(cleanError(err)));
    return true; };
  const leftShort = at => { const ms = Date.parse(at) - Date.now(); if (ms <= 0) return 'завершается'; const m = Math.ceil(ms / 60e3), hh = Math.floor(m / 60); return hh >= 24 ? `${Math.floor(hh / 24)} д ${hh % 24} ч` : hh ? `${hh} ч ${m % 60} мин` : `${m} мин`; };
  const lotItemRow = (it, extra) => { const fake = {...it}; return h('div', {class: 'ae-row ae-lot-item', 'data-ae-rarity': it.rarity || 'common'}, h('img', {src: iconFor(fake) || '/assets/items/sprites/sword.webp', alt: '', style: iconStyle(fake)}),
    h('div', {class: 'ae-grow'}, h('b', {}, `${baseName(it)}${it.upgradeLevel ? ' +' + it.upgradeLevel : ''}`), h('small', {}, `${RARITY_RU[it.rarity] || ''} · ур. ${it.level || 1}${it.twoHanded ? ' · 🗡️ двуручное' : ''}`), h('small', {class: 'ae-chat-item-stats'}, statLine(it.stats) || '')), extra || ''); };
  // Turn a bag item into a server-held one (needed to put it on sale), returns the server item id.
  async function serverIdOf(item) {
    if (item.serverOwned) return item.id;
    if (!transferable(item)) throw new Error('Эту вещь нельзя выставить (надетые и запертые вещи сначала снимите и отоприте).');
    return (await depositItem(item, 1)).id;
  }
  const dropFromBag = id => B()?.setPlayer(x => x && {...x, inventory: x.inventory.flatMap(i => i.id !== id ? [i] : (i.stackCount || 1) > 1 ? [{...i, stackCount: i.stackCount - 1}] : [])});
  const sellable = i => i && !i.isEquipped && !i.isLocked && !i.boundToClan && (i.serverOwned || transferable(i));
  async function lotAction(path, body, okText) {
    const run = () => api('/api/ae-market/lot/' + path, 'POST', body);
    walletBusy = true;
    try {
      try { await run(); }
      catch (e) { const m = String(e?.message || '').match(/Не хватает (\d+) золота в кошельке рынка/); if (!m) throw e;
        const bal = (await api('/api/ae-market/wallet')).balance || 0; if (!(await ensureWallet(bal + Number(m[1])))) return false; await run(); }
      toast(okText); sfx.play('coins'); if (path === 'buy' || path === 'cancel' || path === 'decide') setTimeout(refreshServerBag, 300); lotCache.clear(); return true;
    } catch (e) { toast(cleanError(e)); return false; }
    finally { walletBusy = false; setTimeout(() => sweepWallet(true), 1500); }
  }
  // ---------- buying an item that was only shown in the chat: a price request to its owner ----------
  function sellerOfCard(o, card) {
    if (o.w) return String(o.w);
    let el = card; for (let i = 0; i < 7 && el; i++) { const n = el.querySelector?.('[data-ae-uid]'); if (n) return n.dataset.aeUid; el = el.parentElement; }
    return null;
  }
  async function marketPost(path, body, okText) {
    const run = () => api('/api/ae-market/' + path, 'POST', body);
    walletBusy = true;
    try {
      try { await run(); }
      catch (e) { const m = String(e?.message || '').match(/Не хватает (\d+) золота в кошельке рынка/); if (!m) throw e;
        const bal = (await api('/api/ae-market/wallet')).balance || 0; if (!(await ensureWallet(bal + Number(m[1])))) return false; await run(); }
      if (okText) { toast(okText); sfx.play('coins'); } return true;
    } catch (e) { toast(cleanError(e)); return false; }
    finally { walletBusy = false; setTimeout(() => sweepWallet(true), 1500); }
  }
  // My pending price requests, so a chat card keeps showing «your price» after the chat redraws.
  let myReqs = new Map(), myReqsAt = 0;
  const reqKey = (seller, n, l) => `${seller}|${n}|${Number(l) || 1}`;
  function myAsk(o) { if (Date.now() - myReqsAt > 30e3) loadMyReqs(); return o.w ? myReqs.get(reqKey(o.w, o.n, o.l)) || null : null; }
  let reqsLoading = false;
  async function loadMyReqs() {
    if (reqsLoading || !uid()) return; reqsLoading = true; myReqsAt = Date.now();
    try { const r = await api('/api/ae-market/requests'); const next = new Map((r.requests || []).filter(x => !x.incoming && x.status === 'pending').map(x => [reqKey(x.sellerId, x.item.n, x.item.l), x.price]));
      const changed = next.size !== myReqs.size || [...next].some(([k, v]) => myReqs.get(k) !== v); myReqs = next; if (changed) redrawShown(); }
    catch {} finally { reqsLoading = false; }
  }
  function redrawShown() { for (const el of document.querySelectorAll('[data-ae-shown]')) { try { el.replaceWith(itemCard(JSON.parse(el.dataset.aeShown))); } catch {} } }
  async function askToBuy(o, card) {
    const seller = sellerOfCard(o, card);
    if (!seller) return toast('Не удалось понять, кто продаёт. Напишите продавцу в личные сообщения.');
    if (seller === String(uid())) return toast('Это ваша вещь.');
    const prev = myReqs.get(reqKey(seller, o.n, o.l));
    const v = prompt(prev ? `Вы уже предложили ${fmt(prev)} 🪙 за «${o.n}». Новая цена (разница зарезервируется):` : `Сколько золота предложить за «${o.n}»? Золото зарезервируется и вернётся, если продавец откажет или не ответит за 2 дня.`, prev ? String(prev) : '');
    if (v == null) return; const price = Math.floor(Number(v)); if (!(price > 0)) return toast('Укажите цену.');
    if (prev === price) return;
    if (await marketPost('request', {seller, price, item: {n: o.n, r: o.r, l: o.l, u: o.u, t: o.t, s: o.s, i: o.i}}, '📨 Запрос отправлен продавцу')) {
      myReqs.set(reqKey(seller, o.n, o.l), price); myReqsAt = Date.now();
      if (o.w) redrawShown(); else card.querySelector('.ae-buy-shown')?.replaceWith(h('small', {class: 'ae-lot-price'}, `⏳ Ваша цена: ${fmt(price)} 🪙`));
    }
  }
  // The seller finds the requested item in the bag (by id from the chat card, else by name, level and rarity).
  function findRequested(r) {
    const p = me() || {}, worn = new Set(Object.values(p.equipped || {}).filter(Boolean).map(e => e.id)), inv = p.inventory || [];
    const byId = r.item.i && inv.find(i => i.id === r.item.i);
    const match = byId || inv.find(i => baseName(i) === r.item.n && (i.level || 1) === r.item.l && (i.rarity || 'common') === r.item.r);
    if (match) return {item: match};
    const w = Object.values(p.equipped || {}).find(i => i && (i.id === r.item.i || (baseName(i) === r.item.n && (i.level || 1) === r.item.l)));
    return {worn: !!w || worn.has(r.item.i)};
  }
  async function sellRequested(r) {
    const f = findRequested(r);
    if (!f.item) return toast(f.worn ? 'Эта вещь надета — сначала снимите её с героя.' : 'Этой вещи уже нет в сумке.');
    if (f.item.isLocked) return toast('Вещь заперта — сначала отоприте её.');
    if (!confirm(`Продать «${r.item.n}» игроку ${r.buyer} за ${r.price} 🪙?`)) return false;
    try { const id = await serverIdOf(f.item); await api('/api/ae-market/request/decide', 'POST', {id: r.id, accept: true, itemId: id}); dropFromBag(id); rememberGone([id]);
      toast(`💰 Продано за ${fmt(r.price)} 🪙`); sfx.play('coins'); setTimeout(() => sweepWallet(true), 800); return true; }
    catch (e) { toast(cleanError(e)); return false; }
  }
  function openAuction(tab = 'all') {
    let d = null, mine = null, pick = null, reqs = [];
    const load = async () => { try { [d, mine, reqs] = await Promise.all([api('/api/ae-market/lots'), api('/api/ae-market/lots?mine=1'), api('/api/ae-market/requests').then(r => r.requests)]); } catch (e) { toast(cleanError(e)); } if (openPanelState === st) st.rerender(); };
    const bid = async l => { const min = l.bid ? l.bid.amount + l.step : l.start, v = prompt(`Ваша ставка на «${baseName(l.item)}» (минимум ${min} 🪙):`, String(min)); if (v == null) return;
      if (await lotAction('bid', {id: l.id, amount: Math.floor(Number(v))}, '🔨 Ставка принята')) load(); };
    const st = openPanel('🔨 Аукцион и лоты', body => {
      const inc = (reqs || []).filter(r => r.incoming && r.status === 'pending').length;
      body.append(h('div', {class: 'ae-tabs'}, [['all', '🔨 Торги'], ['mine', '📦 Мои лоты'], ['req', `📨 Запросы${inc ? ' ' + inc : ''}`], ['sell', '➕ Выставить']].map(([k, l]) => h('button', {type: 'button', class: 'ae-tab' + (tab === k ? ' is-on' : ''), onclick: () => { tab = k; st.rerender(); }}, l))));
      body.append(h('div', {class: 'ae-row ae-wallet-line'}, h('span', {class: 'ae-grow'}, `🪙 Ваше золото: ${fmt(me()?.gold || 0)}`)));
      if (!d) return body.append(h('p', {class: 'ae-empty'}, 'Загрузка…'));
      if (tab === 'all') {
        if (!d.lots.length) body.append(h('p', {class: 'ae-empty'}, 'Сейчас торгов нет. Выставите свою вещь во вкладке «Выставить».'));
        for (const l of d.lots) body.append(h('div', {class: 'ae-card ae-lot'}, lotItemRow(l.item),
          h('div', {class: 'ae-lot-info'}, h('span', {}, l.bid ? `Ставка: ${fmt(l.bid.amount)} 🪙 · ${l.bid.mine ? 'ваша' : l.bid.name}` : `Старт: ${fmt(l.start)} 🪙`), h('span', {}, `⏳ ${leftShort(l.endsAt)} · ставок ${l.bids}`), h('small', {}, `Продавец: ${l.seller.name}`)),
          l.mine ? h('div', {class: 'ae-sub'}, 'Ваш лот') : h('div', {class: 'ae-row'}, h('button', {type: 'button', class: 'ae-btn ae-primary ae-grow', disabled: !!l.bid?.mine, onclick: () => bid(l)}, l.bid?.mine ? 'Вы лидируете' : `🔨 Ставка от ${fmt(l.bid ? l.bid.amount + l.step : l.start)}`),
            l.price ? h('button', {type: 'button', class: 'ae-btn', onclick: async () => { if (confirm(`Выкупить «${baseName(l.item)}» за ${l.price} 🪙?`) && await lotAction('buy', {id: l.id}, '🎁 Куплено — вещь в сумке')) load(); }}, `Выкуп ${fmt(l.price)}`) : '')));
        body.append(h('p', {class: 'ae-sub'}, 'Ставка списывается с вашего золота и возвращается, если её перебьют. Ставка в последние 2 минуты продлевает торги на 2 минуты. Налог продавца 3% (с Premium 0%).'));
      }
      if (tab === 'mine') {
        const list = mine?.lots || [];
        if (!list.length) body.append(h('p', {class: 'ae-empty'}, 'У вас нет лотов и ставок.'));
        for (const l of list) body.append(h('div', {class: 'ae-card ae-lot'}, lotItemRow(l.item),
          h('div', {class: 'ae-lot-info'}, h('span', {}, l.kind === 'auction' ? '🔨 Аукцион' : '💬 Продажа из чата'),
            h('span', {}, l.status === 'active' ? (l.kind === 'auction' ? `${l.bid ? `ставка ${fmt(l.bid.amount)} (${l.bid.mine ? 'ваша' : l.bid.name})` : `старт ${fmt(l.start)}`} · ⏳ ${leftShort(l.endsAt)}` : `${l.price ? `цена ${fmt(l.price)} 🪙` : 'только предложения'}${l.myOffer ? ` · ваше предложение ${fmt(l.myOffer)}` : ''}`)
              : l.status === 'sold' ? `✅ Продано за ${fmt(l.soldPrice)} 🪙 · ${l.buyer}` : l.status === 'returned' ? '↩️ Вернулось в сумку' : '✖️ Снято')),
          l.mine && l.offers?.length ? h('div', {class: 'ae-lot-offers'}, l.offers.map(o => h('div', {class: 'ae-row'}, h('span', {class: 'ae-grow'}, `💬 ${o.name}: ${fmt(o.price)} 🪙`),
            h('button', {type: 'button', class: 'ae-btn ae-primary', onclick: async () => { if (await lotAction('decide', {id: l.id, offerId: o.id, accept: true}, '💰 Продано')) load(); }}, 'Принять'),
            h('button', {type: 'button', class: 'ae-btn', onclick: async () => { if (await lotAction('decide', {id: l.id, offerId: o.id, accept: false}, 'Отклонено')) load(); }}, '✖')))) : '',
          l.mine && l.status === 'active' && !(l.kind === 'auction' && l.bid) ? h('button', {type: 'button', class: 'ae-btn ae-wide', onclick: async () => { if (confirm('Снять лот? Вещь вернётся в сумку.') && await lotAction('cancel', {id: l.id}, '↩️ Лот снят')) load(); }}, 'Снять с продажи') : ''));
      }
      if (tab === 'req') {
        const list = reqs || [];
        body.append(h('p', {class: 'ae-sub'}, 'Запросы на покупку вещей, которые показывали в общем чате. Золото покупателя уже зарезервировано: нажмите «Продать» — вещь уйдёт ему, золото придёт вам.'));
        if (!list.length) body.append(h('p', {class: 'ae-empty'}, 'Запросов нет.'));
        for (const r of list) { const it = {name: r.item.n, rarity: r.item.r, level: r.item.l, upgradeLevel: r.item.u, type: r.item.t, stats: r.item.s};
          body.append(h('div', {class: 'ae-card ae-lot'}, lotItemRow(it),
            h('div', {class: 'ae-lot-info'}, h('span', {}, r.incoming ? `💰 ${r.buyer} предлагает ${fmt(r.price)} 🪙` : `Вы предложили ${fmt(r.price)} 🪙 · продавец ${r.seller}`),
              h('span', {}, r.status === 'pending' ? `⏳ ждёт ответа, до ${new Date(r.expires).toLocaleString('ru-RU', {day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'})}` : r.status === 'done' ? '✅ Сделка состоялась' : r.status === 'declined' ? '✖️ Отказ' : r.status === 'expired' ? '⌛ Истёк' : '✖️ Отменён')),
            r.status !== 'pending' ? '' : r.incoming ? h('div', {class: 'ae-row'}, h('button', {type: 'button', class: 'ae-btn ae-primary ae-grow', onclick: async () => { if (await sellRequested(r)) load(); }}, '💰 Продать'),
              h('button', {type: 'button', class: 'ae-btn', onclick: async () => { if (await marketPost('request/decide', {id: r.id, accept: false}, 'Отказано')) load(); }}, 'Отказать'))
              : h('button', {type: 'button', class: 'ae-btn ae-wide', onclick: async () => { if (await marketPost('request/cancel', {id: r.id}, '↩️ Запрос отменён, золото вернулось')) load(); }}, 'Отменить запрос'))); }
      }
      if (tab === 'sell') {
        const list = (me()?.inventory || []).filter(sellable).sort((a, b) => (b.level || 0) - (a.level || 0));
        if (!pick) {
          body.append(h('p', {class: 'ae-note'}, 'Выберите вещь. Пока идут торги, она хранится у рынка — покупатель получит её, даже если вы не в игре.'));
          if (!list.length) body.append(h('p', {class: 'ae-empty'}, 'В сумке нет вещей для продажи (надетые и запертые вещи не подходят).'));
          for (const it of list) body.append(h('button', {type: 'button', class: 'ae-chat-item ae-equip-row', 'data-ae-rarity': it.rarity || 'common', onclick: () => { pick = it; st.rerender(); }}, ...lotItemRow(it).childNodes));
          return;
        }
        const start = h('input', {class: 'ae-input', type: 'number', min: '1', placeholder: 'Стартовая цена', value: String(Math.max(10, (pick.sellPrice || 10) * 3))});
        const buyout = h('input', {class: 'ae-input', type: 'number', min: '1', placeholder: 'Цена выкупа (необязательно)'});
        let hours = 24; const dur = h('div', {class: 'ae-tabs'}, [1, 6, 24, 48].map(v => h('button', {type: 'button', class: 'ae-tab' + (v === hours ? ' is-on' : ''), onclick: e => { hours = v; dur.querySelectorAll('.ae-tab').forEach(b => b.classList.toggle('is-on', b === e.currentTarget)); }}, `${v} ч`)));
        body.append(h('div', {class: 'ae-card'}, lotItemRow(pick)), h('b', {}, 'Стартовая цена'), start, h('b', {}, 'Выкуп сразу (необязательно)'), buyout, h('b', {}, 'Длительность'), dur,
          h('div', {class: 'ae-grid2'}, h('button', {type: 'button', class: 'ae-btn', onclick: () => { pick = null; st.rerender(); }}, '← Другая вещь'),
            h('button', {type: 'button', class: 'ae-btn ae-primary', onclick: async ev => {
              const err = canAct(); if (err) return toast(err); ev.currentTarget.disabled = true;
              try { const id = await serverIdOf(pick); await api('/api/ae-market/lot', 'POST', {kind: 'auction', itemId: id, start: Math.floor(Number(start.value)), price: buyout.value ? Math.floor(Number(buyout.value)) : null, hours});
                dropFromBag(id); rememberGone([id]); toast('🔨 Лот выставлен на аукцион'); sfx.play('coins'); pick = null; tab = 'mine'; load(); }
              catch (e) { toast(cleanError(e)); ev.currentTarget.disabled = false; } }}, '🔨 Выставить')));
      }
    }, {cls: 'ae-hq-panel'});
    load();
  }
  // Chat: share an item for show, or put it up for sale (fixed price and/or offers).
  function openShareItem(item) {
    const st = openPanel('📢 Вещь в общий чат', body => {
      const price = h('input', {class: 'ae-input', type: 'number', min: '1', placeholder: 'Цена в золоте (пусто — только предложения)'});
      body.append(h('div', {class: 'ae-card'}, lotItemRow(item)),
        h('button', {type: 'button', class: 'ae-btn ae-wide', onclick: () => { closePanel(); shareItem(item); }}, '👀 Просто показать'),
        h('h3', {class: 'ae-h3'}, '💰 Продать через чат'), price,
        h('p', {class: 'ae-sub'}, 'Вещь уйдёт на хранение рынку. Игроки смогут сразу купить её за вашу цену или предложить свою — вы примете лучшее предложение. Золото придёт вам, вещь без продажи вернётся через 7 дней.'),
        h('button', {type: 'button', class: 'ae-btn ae-primary ae-wide', disabled: !sellable(item), onclick: async ev => {
          const err = canAct(); if (err) return toast(err); ev.currentTarget.disabled = true;
          try { const id = await serverIdOf(item), p = price.value ? Math.floor(Number(price.value)) : null;
            const r = await api('/api/ae-market/lot', 'POST', {kind: 'chat', itemId: id, price: p}); dropFromBag(id); rememberGone([id]);
            const compact = {id: r.lot.id, p, n: baseName(item), r: item.rarity, l: item.level || 1, u: item.upgradeLevel || 0, t: item.type, ...(item.twoHanded ? {th: 1} : {}), s: Object.fromEntries(Object.entries(item.stats || {}).filter(([, v]) => typeof v === 'number').slice(0, 6))};
            await api('/api/chat/global', 'POST', {text: `💰 Продаю: ${compact.n}${p ? ` — ${p} 🪙` : ' — жду предложений'} ⟦ae:l:${enc(compact)}⟧`});
            closePanel(); toast('Вещь выставлена в общем чате'); sfx.play('coins'); }
          catch (e) { toast(cleanError(e)); ev.currentTarget.disabled = false; } }}, sellable(item) ? '💰 Выставить на продажу' : 'Эту вещь нельзя продать'));
    });
  }
  const lotCache = new Map(); let lotFetch = null;
  function lotStatus(id) {
    const c = lotCache.get(id); if (c && Date.now() - c.at < 30e3) return c.lot;
    if (!lotFetch) { lotFetch = setTimeout(async () => { const ids = [...document.querySelectorAll('[data-ae-lot]')].map(e => e.dataset.aeLot); lotFetch = null; if (!ids.length) return;
      try { const r = await api('/api/ae-market/lots?ids=' + [...new Set(ids)].join(',')); const got = new Set(); for (const l of r.lots) { lotCache.set(l.id, {lot: l, at: Date.now()}); got.add(l.id); }
        for (const id of ids) if (!got.has(id)) lotCache.set(id, {lot: {status: 'gone'}, at: Date.now()});
        for (const el of document.querySelectorAll('[data-ae-lot]')) el.replaceWith(lotChatCard(JSON.parse(el.dataset.aeLotData))); } catch {} }, 250); }
    return c?.lot || null;
  }
  function lotChatCard(o) {
    const l = lotStatus(o.id), fake = {name: o.n, rarity: o.r, level: o.l, upgradeLevel: o.u, type: o.t, stats: o.s}, closed = l && l.status !== 'active';
    const buy = async e => { e.stopPropagation(); if (!confirm(`Купить «${o.n}» за ${o.p} 🪙?`)) return; if (await lotAction('buy', {id: o.id}, '🎁 Куплено — вещь в сумке')) lotCache.delete(o.id); };
    const offer = async e => { e.stopPropagation(); const prev = lotCache.get(o.id)?.lot?.myOffer;
      const v = prompt(prev ? `Вы уже предложили ${fmt(prev)} 🪙 за «${o.n}». Новая цена (разница зарезервируется):` : `Ваша цена за «${o.n}» (золото резервируется и вернётся, если продавец откажет):`, String(prev || (o.p ? Math.round(o.p * 0.8) : ''))); if (v == null) return;
      const price = Math.floor(Number(v)); if (!(price > 0)) return toast('Укажите цену.'); if (price === prev) return;
      if (await lotAction('offer', {id: o.id, price}, '💬 Предложение отправлено продавцу')) {
        const c = lotCache.get(o.id); lotCache.set(o.id, {lot: {...(c?.lot || {status: 'active'}), myOffer: price}, at: Date.now()});
        for (const el of document.querySelectorAll('[data-ae-lot]')) if (el.dataset.aeLot === o.id) el.replaceWith(lotChatCard(o)); } };
    return h('div', {class: 'ae-chat-item ae-chat-lot' + (closed ? ' is-closed' : ''), 'data-ae-rarity': o.r || 'common', 'data-ae-lot': o.id, 'data-ae-lot-data': JSON.stringify(o), onclick: e => e.stopPropagation()},
      h('img', {src: iconFor(fake) || '/assets/items/sprites/sword.webp', alt: '', style: iconStyle(fake)}),
      h('span', {class: 'ae-grow'}, h('b', {}, `${o.n}${o.u ? ' +' + o.u : ''}`), h('small', {}, `${RAR_RU[o.r] || o.r || ''} · ур. ${o.l}${o.th ? ' · 🗡️ двуручное' : ''}`), h('small', {class: 'ae-chat-item-stats'}, statLine(o.s) || ''),
        h('small', {class: 'ae-lot-price'}, closed ? (l.status === 'sold' ? `✅ Продано${l.soldPrice ? ` за ${fmt(l.soldPrice)} 🪙` : ''}` : '✖️ Снято с продажи') : o.p ? `💰 ${fmt(o.p)} 🪙` : '💬 Ждёт предложений')),
      closed ? '' : l?.mine ? h('button', {type: 'button', class: 'ae-btn', onclick: e => { e.stopPropagation(); openAuction('mine'); }}, l.offers?.length ? `Предложения: ${l.offers.length}` : 'Ваш лот')
        : h('span', {class: 'ae-lot-btns'}, o.p ? h('button', {type: 'button', class: 'ae-btn ae-primary', onclick: buy}, 'Купить') : '', h('button', {type: 'button', class: 'ae-btn', onclick: offer}, l?.myOffer ? `Ваша: ${fmt(l.myOffer)}` : 'Своя цена')));
  }
  // Market screen: wallet controls + auction entry next to the market wallet line; a friendly fix for «not enough in the wallet».
  function injectMarketTools() {
    const main = document.querySelector('main'); if (!main) return;
    if (document.hidden) return;
    const line = [...main.querySelectorAll('p, div, span')].find(e => /^Кошелёк рынка:/.test((e.textContent || '').trim()) && (e.textContent || '').length < 60 && !e.querySelector('button, p, div'));
    for (const el of main.querySelectorAll('[data-ae-lot]')) { const c = lotCache.get(el.dataset.aeLot); if (!c || Date.now() - c.at > 30e3) lotStatus(el.dataset.aeLot); }
    if (line && !line.parentElement.querySelector(':scope > [data-ae-market-tools]')) line.after(h('div', {class: 'ae-market-one', 'data-ae-market-tools': '1'},
      h('small', {}, `🪙 Покупки оплачиваются золотом героя, выручка от продаж приходит туда же. Налог продавца 3% (с Premium 0%).`),
      h('button', {type: 'button', class: 'ae-btn ae-primary ae-wide', onclick: () => openAuction()}, '🔨 Аукцион и мои лоты')));
    if (line) line.classList.add('ae-hide');
    for (const el of main.querySelectorAll('p')) if (!el.dataset.aeOneGold && /отдельный серверный кошел[её]к рынка|Золото из локального сохранения/.test(el.textContent || '')) { el.dataset.aeOneGold = '1'; el.classList.add('ae-hide'); }
    for (const el of main.querySelectorAll('p, span, div')) if (!el.childElementCount && /^(Кошел[её]к рынка|Ваш кошел[её]к рынка)\b/.test((el.textContent || '').trim()) && el !== line) el.classList.add('ae-hide');
    for (const el of main.querySelectorAll('p, div, span')) if (!el.childElementCount && /Недостаточно золота в кошельке рынка/.test(el.textContent || '') && !el.dataset.aeWalletFix) {
      el.dataset.aeWalletFix = '1'; el.classList.add('ae-hide');
    }
  }
  setInterval(() => { if (document.hidden) return; for (const el of document.querySelectorAll('[data-ae-lot]')) { const c = lotCache.get(el.dataset.aeLot); if (!c || Date.now() - c.at > 15e3) { lotCache.delete(el.dataset.aeLot); lotStatus(el.dataset.aeLot); } } }, 15000);
  // «Купить» on a market listing: if the wallet is short, offer to top it up first and then buy.
  document.addEventListener('click', async e => {
    const btn = e.target.closest?.('main button'); if (!btn || btn.dataset.aeBuyOk || !/^Купить$/.test((btn.textContent || '').trim())) return;
    let card = btn; for (let i = 0; i < 5 && card && !/Продавец:/.test(card.textContent || ''); i++) card = card.parentElement;
    if (!card || !/Продавец:/.test(card.textContent || '')) return;
    const m = (card.textContent || '').replace(/ /g, ' ').match(/(\d[\d ]*)\s*Купить/); const price = m ? Number(m[1].replace(/ /g, '')) : 0; if (!price) return;
    e.preventDefault(); e.stopImmediatePropagation();
    if (walletBusy) return; walletBusy = true;
    try { if (!(await ensureWallet(price))) return; btn.dataset.aeBuyOk = '1'; btn.click(); setTimeout(() => { delete btn.dataset.aeBuyOk; }, 500); }
    catch (err) { toast(cleanError(err)); }
    finally { setTimeout(() => { walletBusy = false; sweepWallet(true); }, 4000); }
  }, true);
  function renderChatItems() {
    for (const el of document.querySelectorAll('main *, .game-dialog-backdrop *')) {
      if (!el.childElementCount && COOP_RE.test(el.textContent || '') && !el.closest('.ae-chat-item, textarea, input')) {
        const m = el.textContent.match(COOP_RE), o = dec(m[1]);
        if (o && o.r) { const before = el.textContent.replace(COOP_RE, '').replace(/🛡️ Ищу отряд в «[^»]*» \(ур\. [^)]*\)/, '').trim(); el.replaceChildren(before ? h('span', {}, before + ' ') : '', coopCard(o)); continue; }
      }
      if (!el.childElementCount && CLAN_RE.test(el.textContent || '') && !el.closest('.ae-chat-item, textarea, input')) {
        const m = el.textContent.match(CLAN_RE), o = dec(m[1]);
        if (o && o.c) { const before = el.textContent.replace(CLAN_RE, '').replace(/🛡️ Клан \[[^\]]*\] «[^»]*» набирает героев/, '').trim(); el.replaceChildren(before ? h('span', {}, before + ' ') : '', clanChatCard(o)); continue; }
      }
      if (!el.childElementCount && LOT_RE.test(el.textContent || '') && !el.closest('.ae-chat-item, textarea, input')) {
        const m = el.textContent.match(LOT_RE), o = dec(m[1]);
        if (o && o.id) { const before = el.textContent.replace(LOT_RE, '').replace(/💰 Продаю: .*$/, '').trim(); el.replaceChildren(before ? h('span', {}, before + ' ') : '', lotChatCard(o)); continue; }
      }
      if (el.childElementCount || !TOKEN_RE.test(el.textContent || '') || el.closest('.ae-chat-item, textarea, input')) continue;
      const m = (el.textContent || '').match(TOKEN_RE), o = m && dec(m[1]); if (!o) continue;
      const before = el.textContent.replace(TOKEN_RE, '').trim();
      el.replaceChildren(before ? h('span', {}, before + ' ') : '', itemCard(o));
    }
  }
  let lastTileId = null;
  document.addEventListener('pointerdown', e => { const t = e.target.closest?.('[data-inventory-item]'); if (t) lastTileId = t.getAttribute('data-inventory-item'); }, true);
  function injectShareButton() {
    if (!lastTileId) return;
    const item = findItem(lastTileId); if (!item) return;
    const dialogs = [...document.querySelectorAll('.game-dialog-backdrop, .bottom-sheet-backdrop, .fixed.inset-0')].filter(d => (d.textContent || '').includes(baseName(item)) && d.querySelector('button'));
    for (const d of dialogs) {
      if (d.querySelector('[data-ae-share]')) continue;
      const btns = [...d.querySelectorAll('button')].filter(b => /Надеть|Снять|Продать|Разобрать|Запереть|Отпереть|Экипировать|Защитить|кузниц/i.test(b.textContent || ''));
      const anchor = btns[btns.length - 1]; if (!anchor) continue;
      const styleFrom = btns.filter(b => !b.disabled && !/Экипировать/.test(b.textContent || '')).pop() || anchor;
      anchor.parentElement.insertBefore(h('button', {type: 'button', class: styleFrom.className.replace(/\bopacity-\S+|\bdisabled:\S+/g, '') + ' ae-share', 'data-ae-share': '1', onclick: () => openShareItem(findItem(lastTileId) || item)}, '📢 В чат'), anchor.nextSibling);
    }
  }

  // ---------- PvP tab: challenge by nickname ----------
  function injectPvp() {
    for (const el of document.querySelectorAll('main *')) {
      if (el.childElementCount || !/^(PvP с игроками|Дуэли игроков|PvP — игроки|Рейтинг PvP)/.test((el.textContent || '').trim()) || !el.offsetParent) continue;
      let host = el; while (host.parentElement && host.parentElement.tagName !== 'MAIN') host = host.parentElement;
      if (!host.parentElement || host.closest('button') || host.querySelector('[data-ae-duel]')) continue;
      host.prepend(h('button', {type: 'button', class: 'ae-coop-card', 'data-ae-duel': '1', onclick: () => openDuel()}, h('span', {class: 'ae-entry-icon'}, '⚔️'),
        h('span', {class: 'ae-grow'}, h('b', {}, 'Дуэль по нику'), h('small', {}, 'Бросьте вызов любому герою — пошаговый бой')), h('span', {class: 'ae-coop-go'}, '›')));
    }
  }


  // ================= batch 6 =================
  // ---------- travel screen: rotating banners with tips ----------
  const TIPS = ['Защищайтесь перед сильным ударом — прогноз приёма врага показан над кнопками боя.', 'Пиво в таверне восстанавливает энергию, но на несколько боёв снижает атаку и защиту.',
    'Одинаковые вещи объединяются прямо в Сумке: каждая ★ даёт +10% к характеристикам.', 'Заточке нужна руда из шахты: чем выше +, тем более редкая руда понадобится.',
    'Осколки вознесения падают с боссов и элит — копите их для рангов на арене.', 'В кооп-подземельях лидер выбирает путь: неверная тропа может стоить отряду здоровья.',
    'Билеты арены обновляются в 00:00 UTC — не забывайте их тратить.', 'Друзей можно позвать в кооп одним нажатием — бот пришлёт им приглашение.',
    '«Густой туман» даёт больше добычи, но засады в нём опаснее.', 'Перед походом проверьте зелья: в бою они спасают от поражения.',
    'Спутники дают пассивные бонусы — Фею можно создать уже с 15 уровня горного дела.', 'Вызовите любого героя на дуэль по нику в разделе PvP на арене.',
    'Промокоды из канала t.me/Aethelgardo дают золото, осколки и Premium.', 'Лишние вещи продавайте на рынке — предмет можно показать в общем чате.',
    'Новые земли открываются с уровнем — следите за рекомендуемым уровнем локации.'];
  function decorateTravel() {
    for (const card of document.querySelectorAll('.fantasy-travel-overlay > section, .world-travel-overlay > div')) {
      if (card.querySelector(':scope > .ae-travel')) continue;
      let i = Number(localStorage.getItem('aeth_travel_i') || 0); localStorage.setItem('aeth_travel_i', String(i + 1));
      let tip = Number(localStorage.getItem('aeth_tip_i') || -1) + 1; if (tip >= TIPS.length) tip = 0; localStorage.setItem('aeth_tip_i', String(tip));
      card.prepend(h('figure', {class: 'ae-travel'}, h('div', {class: 'ae-travel-pic'}, h('img', {src: `/assets/travel/travel-${(i % 5) + 1}.webp`, alt: ''}), h('figcaption', {}, h('small', {}, `Совет ${tip + 1} из ${TIPS.length}`), TIPS[tip]))));
      card.classList.add('ae-travel-card');
    }
  }

  // ---------- tavern: stronger drink ----------
  function injectTavern() {
    const beer = [...document.querySelectorAll('main *')].find(e => !e.childElementCount && /^Кружка пива$/.test((e.textContent || '').trim()) && e.offsetParent);
    if (!beer) return;
    let card = beer; for (let i = 0; i < 6 && card && !card.querySelector('button'); i++) card = card.parentElement;
    if (!card) return;
    const p = me(), full = p && p.energy >= p.maxEnergy, mugs = p?.intoxication?.mugs || 0;
    const have = card.parentElement.querySelector(':scope > [data-ae-moonshine] [data-ae-drink]'); if (have) { if (have.disabled !== !!full) have.disabled = !!full; return; }
    const btn = card.querySelector('button[data-drink-beer]');
    const block = h('div', {class: 'tavern-beer-row ae-moonshine', 'data-ae-moonshine': '1'}, h('span', {class: 'ae-moon-thumb'}, '🥃'),
      h('div', {class: 'tavern-beer-copy'}, h('h3', {}, 'Гномий самогон'), h('p', {class: 'tavern-beer-benefits'}, '+25 энергии · −15% на 5 боёв')),
      h('button', {type: 'button', class: btn?.className || '', 'data-ae-drink': '1', disabled: full, onclick: drinkMoonshine}, 'Выпить'));
    card.parentElement.insertBefore(block, card.nextSibling);
    const det = card.parentElement.querySelector('.tavern-beer-details');
    if (det && !det.querySelector('[data-ae-moon-info]')) det.append(h('p', {'data-ae-moon-info': '1'}, 'Гномий самогон: +25 энергии, но −15% атаки и защиты на 5 боёв (как три кружки). Опьянение копится, максимум −50%.'));
  }
  // Modern style: the tall sticky header leaves little room, so on entering the tavern the page scrolls the chat
  // up under the header and the message list fills the rest of the screen.
  let tavernSeen = null;
  function fitTavernChat() {
    const chat = document.querySelector('#tavern-chat .chat-header'); if (!chat) { tavernSeen = null; return; }
    const head = document.querySelector('header.game-header'), nav = document.querySelector('nav.game-nav'), z = pageZoom(), root = document.documentElement.style;
    const setVar = (k, v) => { if (root.getPropertyValue(k) !== v + 'px') root.setProperty(k, v + 'px'); };
    if (nav) setVar('--ae-nav-h', Math.round(nav.getBoundingClientRect().height / z));
    if (tavernSeen === chat) return; tavernSeen = chat;
    setTimeout(() => {
      const form = document.querySelector('#tavern-chat .chat-composer'), px = el => el ? el.getBoundingClientRect().height / z : 0; // first room for a full screen of messages
      root.setProperty('--ae-chat-h', Math.max(240, Math.round(innerHeight - px(nav) - px(form) - px(chat) - 30)) + 'px');
      window.scrollBy({top: (chat.getBoundingClientRect().top - 6) / z});                  // chat header to the top of the screen…
      requestAnimationFrame(() => { const hb = head ? head.getBoundingClientRect() : null, stuck = hb && hb.top >= -1 && hb.bottom > 8;
        if (stuck) window.scrollBy({top: (chat.getBoundingClientRect().top - hb.bottom - 6) / z}); // …or just under the header if it stays on screen
        sizeTavernStream(); });
    }, 350);
  }
  // the message list ends right above the message box, which ends right above the bottom bar
  function sizeTavernStream() {
    const st = document.querySelector('#tavern-chat .chat-stream'), form = document.querySelector('#tavern-chat .chat-composer'), nav = document.querySelector('nav.game-nav'); if (!st) return;
    const z = pageZoom(), bottom = nav ? nav.getBoundingClientRect().top : innerHeight * z, formH = form ? form.getBoundingClientRect().height : 56;
    const h = Math.max(240, Math.round((bottom - formH - 14 - st.getBoundingClientRect().top) / z));
    document.documentElement.style.setProperty('--ae-chat-h', h + 'px');
  }
  function drinkMoonshine() {
    const b = B(), p = me(); if (!b || !p) return;
    if (p.worldPlace !== 'settlement' || p.worldJourney || document.documentElement.hasAttribute('data-in-combat')) return toast('Таверна работает только в поселении.');
    if (p.energy >= p.maxEnergy) return toast('Энергия полна. Самогон сейчас не нужен.');
    b.setPlayer(cur => cur && cur.energy < cur.maxEnergy ? {...cur, energy: Math.min(cur.maxEnergy, cur.energy + 25), flightPenalty: cur.flightPenalty ? {...cur.flightPenalty, battlesLeft: 0} : cur.flightPenalty,
      intoxication: {mugs: Math.min(10, (cur.intoxication?.mugs || 0) + 3), battlesLeft: Math.max(5, cur.intoxication?.battlesLeft || 0)}} : cur);
    b.sound?.playEnergyRefill?.(); toast('🥃 +25 энергии. Голова кружится: атака и защита снижены на 5 боёв.');
  }

  // ---------- events from the server: popups + admin-granted levels ----------
  const appliedKey = () => 'aeth_events_applied_' + uid();
  function applyEvent(e) {
    let done; try { done = new Set(JSON.parse(localStorage.getItem(appliedKey()) || '[]')); } catch { done = new Set(); }
    if (done.has(e.id)) return; done.add(e.id); localStorage.setItem(appliedKey(), JSON.stringify([...done].slice(-200)));
    const b = B();
    if (e.kind === 'admin_level' && b) {
      const target = Number(e.data?.level) || 0;
      b.setPlayer(p => { if (!p || target <= (p.level || 1) || !b.gainExp) return p; let x = p; for (let i = 0; i < 130 && (x.level || 1) < target; i++) x = b.gainExp(x, Math.max(1, (x.nextExp || 100) - (x.exp || 0))).player; return x; });
    }
    if (e.kind === 'market-item') setTimeout(refreshServerBag, 300);
    if (e.kind === 'market' || e.kind === 'auction-outbid') setTimeout(() => sweepWallet(true), 800);
    if (e.kind === 'trade_paid' && b) { if (!tradeDone().has('paid:' + e.data?.offerId)) { markTrade('paid:' + e.data?.offerId); b.setPlayer(p => p && {...p, gold: (p.gold || 0) + (Number(e.data?.gold) || 0)}); } }
    if (e.kind === 'trade_return' && b && e.data?.item) { if (!tradeDone().has('ret:' + e.data.offerId)) { markTrade('ret:' + e.data.offerId); giveItem(e.data.item); } }
    const act = e.kind === 'trade_offer' ? ['Смотреть', () => openFriends('trades')] : e.kind === 'coop' || e.kind === 'coop-invite' ? ['Открыть', openCoop] : e.kind === 'clan-invite' && e.data?.code ? ['Вступить', () => joinClanByCode(e.data.code)] : e.kind === 'friend-accepted' ? ['Написать', () => openChat({id: e.data?.id, name: ''})] : e.kind === 'premium' ? ['Ура!', () => checkPremium()] : e.kind === 'lot-offer' ? ['Ответить', () => openAuction('mine')] : e.kind === 'buy-request' ? ['Ответить', () => openAuction('req')] : e.kind === 'auction-outbid' ? ['Перебить', () => openAuction('all')] : e.kind === 'clan-hint' ? ['Найти клан', () => openClanSearch()] : e.kind === 'clan-request' ? ['Заявки', () => openClanHQ('requests')] : e.kind === 'clan' || e.kind === 'clan-welcome' ? ['Штаб', () => openClanHQ()] : [null, null];
    popup({icon: e.icon || '🔔', text: e.text, act: act[0], fn: act[1]});
  }

  // ---------- admin: give level ----------
  function adminLevelBlock() {
    let picked = null; const list = h('div', {class: 'ae-admin-list'}), status = h('div', {class: 'ae-sub'}, 'Игрок не выбран');
    const search = h('input', {class: 'ae-input', placeholder: 'Имя, @username или ID'}), lvl = h('input', {class: 'ae-input', type: 'number', min: '1', max: '120', value: '10', 'aria-label': 'Уровень'});
    const find = async () => { try { const r = (await api('/api/admin/players?search=' + encodeURIComponent(search.value.trim()))).players || []; list.replaceChildren(...r.slice(0, 6).map(pl => h('button', {type: 'button', class: 'ae-row ae-card ae-click', onclick: () => { picked = pl; status.textContent = `Выбран: ${pl.characterName || pl.displayName} · сейчас ур. ${pl.level}`; }},
      h('b', {class: 'ae-grow'}, pl.characterName || pl.displayName || 'Игрок'), h('span', {class: 'ae-sub'}, `ур. ${pl.level}`)))); } catch (e) { toast(cleanError(e)); } };
    search.addEventListener('keydown', e => e.key === 'Enter' && find());
    const give = async () => { if (!picked) return toast('Выберите игрока.'); const level = Number(lvl.value); if (!confirm(`Установить ${picked.characterName || picked.displayName} уровень ${level}?`)) return;
      try { await api('/api/admin/players/level', 'POST', {targetId: picked.telegramId, level}); toast(`Готово: уровень ${level} применится при входе игрока в игру`); } catch (e) { toast(cleanError(e)); } };
    return h('section', {class: 'ae-admin-premium', 'data-ae-admin-level': '1'}, h('div', {class: 'ae-h3'}, '🎖️ Выдать уровень игроку'), h('div', {class: 'ae-sub'}, 'Только повышение. Уровень применится, когда игрок откроет игру (в течение минуты, если он в сети).'),
      h('div', {class: 'ae-row'}, search, h('button', {class: 'ae-btn', type: 'button', onclick: find}, 'Найти')), list, status, h('div', {class: 'ae-row'}, h('span', {class: 'ae-sub'}, 'Уровень'), lvl, h('button', {class: 'ae-btn ae-primary', type: 'button', onclick: give}, 'Выдать')));
  }


  // ================= batch 7 =================
  // ---------- quick access bar: duels + co-op on Arena and World screens ----------
  function quickBar() {
    return h('div', {class: 'ae-quick', 'data-ae-quick': '1'},
      h('button', {type: 'button', class: 'ae-quick-btn', onclick: () => openDuel()}, h('span', {}, '⚔️'), h('b', {}, 'Дуэли'), h('small', {}, 'PvP по нику')),
      h('button', {type: 'button', class: 'ae-quick-btn', onclick: () => openCoop()}, h('span', {}, '🤝'), h('b', {}, 'Кооп'), h('small', {}, 'Подземелья отрядом')),
      h('button', {type: 'button', class: 'ae-quick-btn', onclick: () => openHorde()}, h('span', {}, '🌕'), h('b', {}, 'Орда'), h('small', {}, 'быстрые бои')),
      h('button', {type: 'button', class: 'ae-quick-btn', 'data-ae-quests-btn': '1', onclick: () => openSpecialQuests()}, h('span', {}, '📜'), h('b', {}, 'Задания'), h('small', {}, 'кооп, PvP, орда'), questBadge()));
  }
  // ---------- special quests: co-op and PvP ----------
  let questCache = null;
  const questBadge = () => { const n = (questCache || []).filter(q => !q.claimed && q.progress >= q.need).length; return n ? h('i', {class: 'ae-qbadge'}, String(n)) : ''; };
  async function refreshQuestBadge() {
    if (!uid() || document.hidden) return;
    try { questCache = (await api('/api/quests/special')).quests; } catch { return; }
    for (const b of document.querySelectorAll('[data-ae-quests-btn]')) { b.querySelector('.ae-qbadge')?.remove(); const x = questBadge(); if (x) b.append(x); }
  }
  setTimeout(refreshQuestBadge, 8000); setInterval(refreshQuestBadge, 60000);
  function applyReward(w, b = B()) {
    b.setPlayer(p => { if (!p) return p; let inv = p.inventory;
      if (w.fragments) { inv = inv.slice(); const i = inv.findIndex(x => x.templateId === 'ascension_fragment' && !x.serverOwned && !x.isLocked); if (i >= 0) inv[i] = {...inv[i], stackCount: (inv[i].stackCount || 1) + w.fragments}; else inv.push({id: 'quest_' + uuid4(), templateId: 'ascension_fragment', name: 'Осколок вознесения', type: 'material', rarity: 'rare', level: 1, upgradeLevel: 0, icon: '✦', stats: {}, sellPrice: 0, disassembleYield: {}, stackCount: w.fragments}); }
      const n = {...p, inventory: inv, gold: (p.gold || 0) + (w.gold || 0), silver: (p.silver || 0) + (w.silver || 0), arenaTickets: (p.arenaTickets || 0) + (w.tickets || 0)};
      return w.exp && b.gainExp ? b.gainExp(n, w.exp).player : n; });
  }
  const rewardText = w => [w.gold && `${fmt(w.gold)} 🪙`, w.silver && `${fmt(w.silver)} 🥈`, w.exp && `${fmt(w.exp)} опыта`, w.fragments && `${w.fragments} ✦ осколок`, w.tickets && `${w.tickets} 🎟️ ${w.tickets === 1 ? 'билет' : w.tickets < 5 ? 'билета' : 'билетов'} арены`].filter(Boolean).join(' · ');
  function openSpecialQuests() {
    let quests = null;
    const load = async () => { try { quests = questCache = (await api('/api/quests/special')).quests; } catch (e) { toast(cleanError(e)); } if (openPanelState === st) st.rerender(); };
    const st = openPanel('📜 Задания: кооп, PvP, арена', body => {
      if (!quests) return body.append(h('p', {class: 'ae-empty'}, 'Загрузка…'));
      body.append(h('p', {class: 'ae-note'}, 'Проходите кооп-подземелья с друзьями и сражайтесь в дуэлях — за это дают золото, опыт и осколки вознесения. Ежедневные задания обновляются в 00:00 UTC, недельные — в понедельник.'));
      for (const [period, title] of [['day', '☀️ Ежедневные'], ['week', '📅 Недельные']]) {
        body.append(h('h3', {class: 'ae-h3'}, title));
        for (const q of quests.filter(x => x.period === period)) {
          const done = q.progress >= q.need;
          body.append(h('div', {class: 'ae-card ae-quest' + (q.claimed ? ' is-claimed' : done ? ' is-done' : '')},
            h('div', {class: 'ae-row'}, h('span', {class: 'ae-entry-icon'}, q.icon), h('div', {class: 'ae-grow'}, h('b', {}, q.title), h('div', {class: 'ae-sub'}, 'Награда: ' + rewardText(q.reward)))),
            h('div', {class: 'ae-bar'}, h('i', {style: `width:${100 * q.progress / q.need}%`}), h('span', {}, `${q.progress} / ${q.need}`)),
            q.claimed ? h('div', {class: 'ae-sub'}, '✓ Награда получена') : done ? h('button', {class: 'ae-btn ae-primary ae-wide', type: 'button', onclick: async () => {
              try { const r = await api('/api/quests/special/claim', 'POST', {id: q.id}); applyReward(r.reward); B()?.sound?.playVictory?.(); toast('Награда: ' + rewardText(r.reward)); load(); refreshQuestBadge(); } catch (e) { toast(cleanError(e)); }
            }}, '🎁 Забрать награду') : h('button', {class: 'ae-btn ae-wide', type: 'button', onclick: () => /coop/.test(q.id) ? openCoop() : openDuel()}, /coop/.test(q.id) ? 'К кооп-подземельям' : 'К дуэлям')));
        }
      }
    });
    load();
  }
  function injectQuickBars() {
    for (const bar of document.querySelectorAll('main div, main nav, main section')) {
      if (bar.closest('button') || bar.parentElement?.querySelector(':scope > [data-ae-quick]')) continue;
      const labels = [...bar.querySelectorAll(':scope > button')].map(b => (b.textContent || '').trim());
      const arena = labels.length >= 2 && labels.some(t => /^Вознесение/.test(t)) && labels.some(t => /^Тренировка/.test(t));
      const world = labels.length >= 3 && labels.some(t => /^(Поля|Земли)$/.test(t)) && labels.some(t => /^(Пещеры|Подземелья)$/.test(t));
      if ((arena || world) && bar.offsetParent) bar.parentElement.insertBefore(quickBar(), bar.nextSibling);
    }
  }

  // ---------- direct trade between friends ----------
  const tradeDoneKey = () => 'aeth_trade_done_' + uid();
  const tradeDone = () => { try { return new Set(JSON.parse(localStorage.getItem(tradeDoneKey()) || '[]')); } catch { return new Set(); } };
  const markTrade = id => { const s = tradeDone(); s.add(id); localStorage.setItem(tradeDoneKey(), JSON.stringify([...s].slice(-200))); };
  function giveItem(item, note) {
    const b = B(); b.setPlayer(p => p && {...p, inventory: [...p.inventory, {...item, id: 'trade_' + uuid4(), serverOwned: false, isEquipped: false, isLocked: false}]}); if (note) toast(note);
  }
  function openSellToFriend(item0) {
    let friends = [], loading = true;
    api('/api/friends').then(r => { friends = r.friends || []; loading = false; st.rerender(); }, () => { loading = false; st.rerender(); });
    const st = openPanel('🤝 Продать другу', body => {
      const item = findItem(item0.id) || item0;
      body.append(h('div', {class: 'ae-chat-item', 'data-ae-rarity': item.rarity || 'common'}, h('img', {src: iconFor(item) || '/assets/items/sprites/sword.webp', alt: '', style: iconStyle(item)}),
        h('span', {class: 'ae-grow'}, h('b', {}, `${baseName(item)}${item.upgradeLevel ? ' +' + item.upgradeLevel : ''}${ascOf(item) ? ' ★' + ascOf(item) : ''}`), h('small', {}, `${RARITY_RU[item.rarity] || ''} · ур. ${item.level || 1}${(item.stackCount || 1) > 1 ? ' · ×' + item.stackCount : ''}`))));
      if (loading) return body.append(h('p', {class: 'ae-empty'}, 'Загрузка друзей…'));
      if (!friends.length) return body.append(h('p', {class: 'ae-empty'}, 'Сначала добавьте игрока в друзья — продавать напрямую можно только друзьям.'), h('button', {class: 'ae-btn ae-primary ae-wide', type: 'button', onclick: () => openFriends('search')}, 'Найти друзей'));
      const sel = h('select', {class: 'ae-input'}, friends.map(f => h('option', {value: f.id}, `${f.name} · ур. ${f.level}${f.online ? ' · в сети' : ''}`)));
      const price = h('input', {class: 'ae-input', type: 'number', min: '1', placeholder: 'Цена в золоте'});
      body.append(h('div', {class: 'ae-sub'}, 'Кому'), sel, h('div', {class: 'ae-sub'}, 'Цена (золото)'), price,
        h('p', {class: 'ae-note'}, 'Предмет уйдёт из сумки на хранение. Если друг откажется или не ответит за 48 часов — вещь вернётся к вам. Золото придёт, как только друг примет сделку.'),
        h('button', {class: 'ae-btn ae-primary ae-wide', type: 'button', onclick: async () => {
          const b = B(), cur = findItem(item.id); const pr = Math.floor(Number(price.value));
          if (!cur || cur.isEquipped || cur.isLocked || cur.boundToClan) return toast('Предмет надет, заперт или уже недоступен.');
          if (!Number.isInteger(pr) || pr < 1) return toast('Укажите цену.');
          try {
            let sellItem = cur;
            if (cur.serverOwned) { sellItem = await claimFromServer(cur); rememberGone([cur.id]); b.setPlayer(p => p && {...p, inventory: p.inventory.map(i => i.id === cur.id ? sellItem : i)}); }
            await api('/api/trade/offer', 'POST', {buyerId: sel.value, price: pr, item: sellItem, offerId: uuid4()});
            rememberGone([sellItem.id]); b.setPlayer(p => p && {...p, inventory: p.inventory.filter(i => i.id !== sellItem.id && i.id !== cur.id)});
            toast('Предложение отправлено другу'); sfx.play('coins'); closePanel();
          } catch (e) { toast(cleanError(e)); }
        }}, 'Предложить сделку'));
    });
  }
  function tradesTab(body, rerender) {
    body.append(h('p', {class: 'ae-empty'}, 'Загрузка сделок…'));
    api('/api/trade').then(r => {
      body.replaceChildren();
      body.append(h('div', {class: 'ae-tabs'}, h('button', {class: 'ae-tab', type: 'button', onclick: () => openFriends('friends')}, '← Друзья')));
      if (!r.incoming.length && !r.outgoing.length) body.append(h('p', {class: 'ae-empty'}, 'Сделок нет. Продать вещь другу: Сумка → предмет → «🤝 Продать другу».'));
      if (r.incoming.length) body.append(h('h3', {class: 'ae-h3'}, 'Вам предлагают'));
      for (const t of r.incoming) body.append(h('div', {class: 'ae-card ae-path'}, itemCard({n: baseName(t.item), r: t.item.rarity, l: t.item.level, u: t.item.upgradeLevel, a: ascOf(t.item), t: t.item.type, s: t.item.stats}),
        h('div', {class: 'ae-sub'}, `${t.seller.name} · ${fmt(t.price)} 🪙`), h('div', {class: 'ae-grid2'},
          h('button', {class: 'ae-btn ae-primary', type: 'button', onclick: async () => {
            const p = me(); if ((p?.gold || 0) < t.price) return toast(`Нужно ${fmt(t.price)} золота.`);
            if (tradeDone().has(t.id)) return toast('Сделка уже проведена.');
            try { const res = await api('/api/trade/accept', 'POST', {offerId: t.id, gold: p.gold});
              if (!tradeDone().has(t.id)) { markTrade(t.id); B().setPlayer(x => x && {...x, gold: (x.gold || 0) - res.price, inventory: [...x.inventory, {...res.item, id: 'trade_' + uuid4(), serverOwned: false}]}); }
              toast(`Куплено: ${res.item.name}`); sfx.play('coins'); openFriends('trades'); } catch (e) { toast(cleanError(e)); }
          }}, `Купить · ${fmt(t.price)} 🪙`),
          h('button', {class: 'ae-btn', type: 'button', onclick: async () => { try { await api('/api/trade/decline', 'POST', {offerId: t.id}); toast('Вы отказались'); openFriends('trades'); } catch (e) { toast(cleanError(e)); } }}, 'Отказаться'))));
      if (r.outgoing.length) body.append(h('h3', {class: 'ae-h3'}, 'Ваши предложения'));
      for (const t of r.outgoing) body.append(h('div', {class: 'ae-card ae-path'}, itemCard({n: baseName(t.item), r: t.item.rarity, l: t.item.level, u: t.item.upgradeLevel, a: ascOf(t.item), t: t.item.type, s: t.item.stats}),
        h('div', {class: 'ae-sub'}, `→ ${t.buyer.name} · ${fmt(t.price)} 🪙 · ждёт ответа`),
        h('button', {class: 'ae-btn ae-wide', type: 'button', onclick: async () => { try { await api('/api/trade/cancel', 'POST', {offerId: t.id}); toast('Сделка отменена, предмет вернётся в сумку'); setTimeout(socialPulse, 400); openFriends('trades'); } catch (e) { toast(cleanError(e)); } }}, 'Отменить')));
    }, e => { body.replaceChildren(h('p', {class: 'ae-empty'}, cleanError(e))); });
  }
  function injectSellToFriend() {
    if (!lastTileId) return;
    const item = findItem(lastTileId); if (!item) return;
    for (const d of document.querySelectorAll('.game-dialog-backdrop, .bottom-sheet-backdrop, .fixed.inset-0')) {
      const share = d.querySelector('[data-ae-share]'); if (!share || d.querySelector('[data-ae-sell-friend]')) continue;
      share.parentElement.insertBefore(h('button', {type: 'button', class: share.className.replace('ae-share', '') + ' ae-share', 'data-ae-sell-friend': '1', onclick: () => openSellToFriend(findItem(lastTileId) || item)}, '🤝 Продать другу'), share.nextSibling);
    }
  }

  // ---------- menu entry points ----------
  const ENTRIES = [['👤', 'Профиль', 'Титулы и аватарка', () => openProfile()], ['🔍', 'Размер интерфейса', 'Сделать игру крупнее или компактнее', () => openUiScale()], ['📱', 'Приложение Android', 'Играть без Telegram, напоминания на телефон', () => openApkInfo()], ['📰', 'Что нового', 'Обновления игры', () => openNews()],['🌕', 'Орда', 'Быстрые бои и Кровавая луна', () => openHorde()],['⚒️', 'Объединение', 'Сливайте одинаковые вещи в ★', openMerge], ['👥', 'Друзья', 'Друзья и личные сообщения', () => openFriends()], ['🎁', 'Пригласить друга', 'Premium вам и другу', () => openInvite()],
    ['🤝', 'Кооп-подземелья', 'Проходите подземелья отрядом', openCoop], ['⚔️', 'Дуэли', 'PvP по нику, пошаговый бой', () => openDuel()], ['📜', 'Задания', 'За кооп и PvP', () => openSpecialQuests()], ['🎁', 'Промокод', 'Активировать код', openPromo], ['📖', 'Вики', 'Как играть, где что найти', openWiki]];
  function entryBlock() {
    return h('section', {class: 'ae-entry', 'data-ae-entry': '1'}, h('h3', {}, 'Ещё возможности'),
      h('div', {class: 'ae-entry-grid'}, ENTRIES.map(([icon, title, sub, fn]) => h('button', {class: 'ae-entry-btn', type: 'button', 'data-ae-news-btn': title === 'Что нового' ? '1' : null, onclick: e => { e.stopPropagation(); fn(); }},
        h('span', {class: 'ae-entry-icon'}, icon), h('span', {}, h('b', {}, title), h('small', {}, sub))))));
  }
  function injectEntries() {
    const hosts = [];
    for (const el of document.querySelectorAll('main *')) {
      if (el.childElementCount || (el.textContent || '').trim() !== 'Все занятия под рукой' || !el.offsetParent) continue;
      let host = el; while (host.parentElement && host.parentElement.tagName !== 'MAIN') host = host.parentElement;
      if (host.parentElement && !host.closest('button')) hosts.push(host);
    }
    for (const sheet of document.querySelectorAll('.bottom-sheet-backdrop, .game-dialog-backdrop')) {
      const t = sheet.textContent || ''; if (/Рейтинг/.test(t) && /Чат/.test(t) && /(Журнал|Настройки)/.test(t)) hosts.push(sheet.firstElementChild || sheet);
    }
    for (const host of hosts) {
      if (!host || host.tagName === 'BUTTON' || host.closest('button')) continue;
      const menu = host.querySelector('.mechanics-menu-scroll');
      if (menu) { host.querySelector(':scope > [data-ae-entry]')?.remove(); tidyMechanicsMenu(menu); continue; }
      if (!host.querySelector(':scope > [data-ae-entry]')) host.append(entryBlock());
    }
    for (const stray of document.querySelectorAll('button [data-ae-entry], button [data-ae-merge], button [data-ae-coop-card], button [data-ae-bag-merge]')) stray.remove();
    for (const el of document.querySelectorAll('main *')) {
      if (el.childElementCount || !/^Выберите предмет для улучшения/i.test((el.textContent || '').trim()) || !el.offsetParent) continue;
      let host = el; while (host.parentElement && host.parentElement.tagName !== 'MAIN') host = host.parentElement;
      if (!host.parentElement || host.closest('button') || host.querySelector(':scope > [data-ae-merge]')) continue;
      host.append(h('button', {class: 'ae-entry-btn ae-merge-cta', 'data-ae-merge': '1', type: 'button', onclick: openMerge}, h('span', {class: 'ae-entry-icon'}, '⚒️'), h('span', {}, h('b', {}, 'Объединение предметов'), h('small', {}, 'Два одинаковых предмета → один со ★'))));
    }
  }

  // ================= batch 8 =================
  // ---------- equipment slots: tap an empty slot to pick gear from the bag ----------
  const SLOT_RU = {weapon: 'Оружие', offhand: 'Левая рука', helmet: 'Шлем', armor: 'Броня', pants: 'Штаны', gloves: 'Перчатки', boots: 'Сапоги', cloak: 'Плащ', amulet: 'Амулет', ring: 'Кольцо', belt: 'Пояс', artifact: 'Артефакт', pickaxe: 'Кирка', alchemyTool: 'Реторта'};
  function decorateSlots() {
    const p = me(); if (!p) return;
    for (const btn of document.querySelectorAll('[data-equipment-slot], [data-modern-equipment-slot]')) {
      if (btn.closest('.ae-panel')) continue;
      const slot = btn.getAttribute('data-equipment-slot') || btn.getAttribute('data-modern-equipment-slot'), eq = p.equipped?.[slot];
      if (eq) { applyIcon(btn.querySelector('img'), eq); if (btn.dataset.aeEmptySlot) delete btn.dataset.aeEmptySlot; continue; }
      if (btn.disabled || (btn.hasAttribute('data-modern-equipment-slot') && !btn.dataset.aeEmptySlot)) { btn.disabled = false; btn.dataset.aeEmptySlot = '1'; btn.title = (SLOT_RU[slot] || 'Слот') + ': нажмите, чтобы надеть'; }
    }
  }
  document.addEventListener('click', e => {
    const btn = e.target.closest?.('[data-ae-empty-slot]'); if (!btn) return;
    const slot = btn.getAttribute('data-equipment-slot') || btn.getAttribute('data-modern-equipment-slot'); if (me()?.equipped?.[slot]) return;
    e.preventDefault(); e.stopPropagation(); openEquipPicker(slot);
  }, true);
  function openEquipPicker(slot) {
    const st = openPanel(`🛡️ ${SLOT_RU[slot] || 'Слот'}: что надеть`, body => {
      const p = me(); if (!p) return body.append(h('p', {class: 'ae-empty'}, 'Игра ещё загружается.'));
      const list = (p.inventory || []).filter(i => i.type === slot).sort((a, b) => (Number(b.level) || 0) - (Number(a.level) || 0) || rank(b) - rank(a));
      if (!list.length) return body.append(h('p', {class: 'ae-empty'}, `В сумке нет предметов для слота «${SLOT_RU[slot] || slot}». Их можно найти в походах, купить на рынке или создать в кузнице.`));
      body.append(h('div', {class: 'ae-sub'}, 'Выберите предмет — он сразу наденется на героя.'));
      for (const item of list) {
        const need = slot !== 'pickaxe' && slot !== 'alchemyTool' && (Number(item.level) || 1) > (p.level || 1);
        body.append(h('button', {type: 'button', class: 'ae-chat-item ae-equip-row' + (need ? ' is-locked' : ''), 'data-ae-rarity': item.rarity || 'common', onclick: async () => {
          const b = B(); if (!b?.equipItem) return toast('Обновите игру, чтобы надевать из слота.');
          let r; try { r = await b.equipItem(item); } catch (err) { r = {success: false, message: cleanError(err)}; }
          if (r && r.success === false) return toast(r.message || 'Не удалось надеть предмет.');
          toast(`Надето: ${baseName(item)}`); closePanel();
        }},
          h('img', {src: iconFor(item) || '/assets/sprites/generated/ui/gear/' + slot + '.webp', alt: '', style: iconStyle(item)}),
          h('span', {class: 'ae-grow'}, h('b', {}, `${baseName(item)}${item.upgradeLevel ? ' +' + item.upgradeLevel : ''}${ascOf(item) ? ' ★' + ascOf(item) : ''}`),
            h('small', {}, `${RARITY_RU[item.rarity] || ''} · ур. ${item.level || 1}${item.twoHanded ? ' · 🗡️ двуручное' : ''}${need ? ' · нужен ' + item.level + ' ур.' : ''}`), h('small', {class: 'ae-chat-item-stats'}, statLine(item.stats) || '')),
          h('span', {class: 'ae-equip-go'}, need ? '🔒' : 'Надеть')));
      }
    });
    return st;
  }


  // ---------- two-handed weapons: ×1.6 attack, both hands — no shield or second weapon while it is worn ----------
  // A share of newly found weapons comes out two-handed; any weapon can also be reforged into one for gold.
  const TWO_HAND_MULT = 1.6, TWO_HAND_CHANCE = 0.15;
  const isTwoHand = i => !!i?.twoHanded;
  const twoHandStats = st => { const out = {...(st || {})}; for (const k of ['attack', 'magicAttack']) if (Number(out[k]) > 0) out[k] = Math.round(out[k] * TWO_HAND_MULT); return out; };
  const makeTwoHand = it => ({...it, twoHanded: true, stats: twoHandStats(it.stats), ...(it.aeOver?.base ? {aeOver: {...it.aeOver, base: twoHandStats(it.aeOver.base)}} : {})});
  const canBeTwoHand = i => i && i.type === 'weapon' && !i.twoHanded && i.weaponClass !== 'dagger' && !/кинжал|стилет|кастет/i.test(i.name || '') && ((Number(i.stats?.attack) || 0) > 0 || (Number(i.stats?.magicAttack) || 0) > 0);
  const TWO_HAND_SKIP = /^(own_|srv_|trade_|merge_|regional_)/; // bought, traded, merged or shop items keep what they are
  const hashUnit = str => { let x = 2166136261; for (const c of String(str)) x = Math.imul(x ^ c.charCodeAt(0), 16777619); return (x >>> 0) / 4294967296; };
  const thSeenKey = () => 'aeth_2h_seen_' + uid();
  const RARITY_COST = {common: 1, uncommon: 1.4, rare: 2, epic: 3, legendary: 4.5, mythic: 6, ancient: 8, divine: 10};
  const reforgeCost = i => Math.round((300 + Math.pow(i.level || 1, 2) * 5) * (RARITY_COST[i.rarity] || 1) / 50) * 50;
  function unequipSlot(slot) {
    B()?.setPlayer(x => { const ue = x?.equipped?.[slot]; if (!ue) return x; const eq = {...x.equipped}; delete eq[slot]; return {...x, equipped: eq, inventory: [...x.inventory, {...ue, isEquipped: false}]}; });
    syncEquippedSoon();
  }
  let thPrev = null;
  function twoHandTick() {
    const p = me(), b = B(); if (!p || !b?.setPlayer || autoBusy) return;
    // newly found weapons: some come out two-handed (decided once per item)
    const weapons = (p.inventory || []).filter(i => i.type === 'weapon'), raw = localStorage.getItem(thSeenKey());
    if (raw == null) localStorage.setItem(thSeenKey(), JSON.stringify([...weapons, ...Object.values(p.equipped || {}).filter(Boolean)].map(i => i.id)));
    else {
      let seen; try { seen = new Set(JSON.parse(raw)); } catch { seen = new Set(); }
      const fresh = weapons.filter(i => !seen.has(i.id));
      if (fresh.length) {
        const lucky = fresh.filter(i => !TWO_HAND_SKIP.test(String(i.id)) && !i.serverOwned && canBeTwoHand(i) && hashUnit(i.id + ':' + uid()) < TWO_HAND_CHANCE);
        fresh.forEach(i => seen.add(i.id)); localStorage.setItem(thSeenKey(), JSON.stringify([...seen].slice(-800)));
        if (lucky.length) { const ids = new Set(lucky.map(i => i.id));
          b.setPlayer(x => x && {...x, inventory: x.inventory.map(i => ids.has(i.id) && !i.twoHanded ? makeTwoHand(i) : i)});
          toast(`🗡️ Двуручное оружие: «${baseName(lucky[0])}» — атака ×${TWO_HAND_MULT}, занимает обе руки`); sfx.play('coins'); return; }
      }
    }
    // both hands: a two-handed weapon and a shield / second weapon cannot be worn together
    if (p.worldJourney || document.documentElement.hasAttribute('data-in-combat')) return;
    const w = p.equipped?.weapon, o = p.equipped?.offhand, cur = {w: w?.id || null, o: o?.id || null};
    if (isTwoHand(w) && o) {
      const shieldJustWorn = thPrev && thPrev.o !== cur.o && thPrev.w === cur.w;
      if (shieldJustWorn) { unequipSlot('weapon'); toast(`«${baseName(w)}» снято: двуручное оружие не держат вместе со щитом или вторым оружием`); thPrev = {w: null, o: cur.o}; }
      else { unequipSlot('offhand'); toast(`«${baseName(o)}» убран в сумку: двуручное оружие занимает обе руки`); thPrev = {w: cur.w, o: null}; }
      return;
    }
    thPrev = cur;
  }
  function reforgeTwoHand(item) {
    const p = me(); if (!p || !canBeTwoHand(item)) return;
    if (item.serverOwned) return toast('Вещь ещё у рынка — подождите, пока она вернётся в сумку.');
    if (item.isEquipped || Object.values(p.equipped || {}).some(e => e?.id === item.id)) return toast('Сначала снимите оружие с героя.');
    const cost = reforgeCost(item);
    if ((p.gold || 0) < cost) return toast(`Перековка стоит ${fmt(cost)} 🪙 — не хватает ${fmt(cost - (p.gold || 0))} 🪙.`);
    if (!confirm(`Перековать «${baseName(item)}» в двуручное за ${fmt(cost)} 🪙?\n\nАтака ×${TWO_HAND_MULT}, но щит или второе оружие с ним надеть нельзя. Вернуть одноручным будет нельзя.`)) return;
    B().setPlayer(x => { if (!x || (x.gold || 0) < cost) return x; const i = x.inventory.findIndex(e => e.id === item.id); if (i < 0 || x.inventory[i].twoHanded) return x;
      const inv = x.inventory.slice(); inv[i] = makeTwoHand(inv[i]); return {...x, gold: x.gold - cost, inventory: inv}; });
    toast(`⚒️ «${baseName(item)}» перекован в двуручное: атака ×${TWO_HAND_MULT}`); sfx.play('heavy');
    document.querySelectorAll('[data-ae-2h]').forEach(e => e.remove());
  }
  // Item window: what a two-hander is, and the reforge button for one-handed weapons.
  function injectTwoHand() {
    if (!lastTileId) return;
    const item = findItem(lastTileId); if (!item || item.type !== 'weapon') return;
    const dialogs = [...document.querySelectorAll('.game-dialog-backdrop, .bottom-sheet-backdrop, .fixed.inset-0')].filter(d => (d.textContent || '').includes(baseName(item)) && d.querySelector('button'));
    for (const d of dialogs) {
      // the game's own weapon-class label «Двуручное оружие» only means a heavy weapon — real two-handers are marked by the add-on
      for (const el of d.querySelectorAll('p, span, div, small')) if (!el.childElementCount && /^(🗡️ )?(Двуручное|Тяжёлое) оружие$/.test((el.textContent || '').trim())) { const t = item.twoHanded ? '🗡️ Двуручное оружие' : 'Тяжёлое оружие'; if (el.textContent !== t) el.textContent = t; }
      const have = d.querySelector('[data-ae-2h]'); if (have && have.dataset.aeFor === item.id + (item.twoHanded ? '2' : '1')) continue; have?.remove();
      const btns = [...d.querySelectorAll('button')].filter(b => /Надеть|Снять|Продать|Разобрать|Экипировать|кузниц/i.test(b.textContent || ''));
      const anchor = btns[0]; if (!anchor) continue;
      let row = anchor; while (row.parentElement && row.parentElement !== d && row.parentElement.querySelectorAll('button').length <= btns.length + 3 && !row.parentElement.querySelector('h1,h2,h3')) row = row.parentElement;
      const note = item.twoHanded
        ? h('div', {class: 'ae-2h-note', 'data-ae-2h': '1', 'data-ae-for': item.id + '2'}, h('b', {}, '🗡️ Двуручное оружие'), h('small', {}, `Атака ×${TWO_HAND_MULT} (уже учтено в характеристиках). Занимает обе руки: щит или второе оружие с ним надеть нельзя.`))
        : canBeTwoHand(item) && !item.serverOwned ? h('button', {type: 'button', class: 'ae-btn ae-2h-btn', 'data-ae-2h': '1', 'data-ae-for': item.id + '1', onclick: e => { e.stopPropagation(); reforgeTwoHand(findItem(lastTileId) || item); }},
          `⚒️ Перековать в двуручное · ${fmt(reforgeCost(item))} 🪙`) : null;
      if (note) row.parentElement.insertBefore(note, row);
    }
  }
  // Hero screen: the second-hand slot shows it is taken by the two-handed weapon.
  function decorateTwoHandSlot() {
    const locked = isTwoHand(me()?.equipped?.weapon);
    for (const btn of document.querySelectorAll('[data-equipment-slot="offhand"], [data-modern-equipment-slot="offhand"]')) btn.classList.toggle('ae-2h-locked', locked);
    for (const tile of document.querySelectorAll('[data-inventory-item]')) { const it = findItem(tile.getAttribute('data-inventory-item')); tile.classList.toggle('ae-2h-tile', isTwoHand(it)); }
  }
  document.addEventListener('click', e => {
    const btn = e.target.closest?.('[data-equipment-slot="offhand"], [data-modern-equipment-slot="offhand"]'); if (!btn || btn.closest('.ae-panel')) return;
    const w = me()?.equipped?.weapon; if (!isTwoHand(w) || me()?.equipped?.offhand) return;
    e.preventDefault(); e.stopPropagation(); toast(`Обе руки заняты: «${baseName(w)}» — двуручное оружие. Снимите его, чтобы надеть щит или второе оружие.`);
  }, true);
  // ---------- travel: one picture card with destination + smooth progress ----------
  function syncTravel() {
    for (const card of document.querySelectorAll('.ae-travel-card')) {
      const fig = card.querySelector(':scope > .ae-travel'); if (!fig) continue;
      const title = (card.querySelector('h3')?.textContent || '').trim();
      const msg = (card.querySelector('.travel-message, p')?.textContent || '').trim();
      const bar = card.querySelector('[role=progressbar]') ;
      const jr = me()?.worldJourney, span = jr ? Number(jr.arrivesAt) - Number(jr.startedAt) : 0;
      let pct = span > 0 ? 100 * (Date.now() - Number(jr.startedAt)) / span : Number(bar?.getAttribute('aria-valuenow'));
      if (!Number.isFinite(pct)) { const w = card.querySelector('[style*="width"]:not(.ae-travel *)'); pct = parseFloat(w?.style.width) || 0; }
      let info = fig.querySelector('.ae-travel-info');
      if (!info) { info = h('div', {class: 'ae-travel-info'}, h('b', {class: 'ae-travel-dest'}), h('div', {class: 'ae-travel-bar'}, h('span')), h('div', {class: 'ae-travel-meta'}, h('span', {class: 'ae-travel-msg'}), h('strong', {class: 'ae-travel-pct'}))); fig.append(info); }
      const set = (sel, v) => { const e = info.querySelector(sel); if (e.textContent !== v) e.textContent = v; };
      set('.ae-travel-dest', title || 'В пути'); set('.ae-travel-msg', /Дождитесь|в пути/i.test(msg) ? 'Дорога займёт немного времени…' : msg); set('.ae-travel-pct', Math.round(pct) + '%');
      const fill = info.querySelector('.ae-travel-bar > span'), w = Math.max(0, Math.min(100, pct)) + '%'; if (fill.style.width !== w) fill.style.width = w;
    }
  }

  // ---------- forge: server-held items are moved into the bag first, then upgrade as usual ----------
  let forgeClaiming = false;
  async function claimServerGear() {
    const b = B(), p = me(); if (!b || !p || forgeClaiming) return;
    if (p.worldJourney || document.documentElement.hasAttribute('data-in-combat')) return toast('Сначала завершите бой или путь.');
    const eqIds = new Set(Object.values(p.equipped || {}).filter(Boolean).map(i => i.id));
    const shown = new Set([...document.querySelectorAll('main button')].map(x => (x.innerText || '').trim().split('\n')[0].trim()).filter(Boolean));
    const list = (p.inventory || []).filter(i => i.serverOwned && !i.isEquipped && !eqIds.has(i.id) && !i.boundToClan && shown.has(String(i.name || '').trim())).slice(0, 1);
    if (!list.length) return toast((p.inventory || []).some(i => i.serverOwned && i.boundToClan) ? 'Клановые вещи точить нельзя.' : 'Эта вещь надета на героя — снимите её в Сумке и подготовьте снова.');
    forgeClaiming = true; const release = b.busy ? b.busy() : () => {}; let done = 0;
    try {
      for (const it of list) {
        try { if (it.isLocked && !(await unlockServerItem(it.id))) throw new Error('Не удалось снять защиту с предмета.'); const local = {...(await claimFromServer(it)), isLocked: false}; rememberGone([it.id]); b.setPlayer(cur => cur && {...cur, inventory: cur.inventory.map(i => i.id === it.id ? local : i)}); done++; }
        catch (e) { toast(cleanError(e)); }
      }
    } finally { release(); forgeClaiming = false; }
    if (done) { sfx.play('page'); toast(`Готово: ${done} ${done === 1 ? 'вещь готова' : 'вещи готовы'} к заточке. Выберите предмет ещё раз.`); }
  }
  function injectForgeClaim() {
    for (const el of document.querySelectorAll('main div')) {
      if (el.childElementCount || !/^Для заточки серверной вещи/.test((el.textContent || '').trim())) continue;
      el.replaceChildren(h('button', {type: 'button', class: 'ae-btn ae-primary ae-wide', 'data-ae-forge-claim': '1', onclick: claimServerGear}, '⚒️ Подготовить вещь к заточке'),
        h('small', {class: 'ae-sub', style: 'display:block;margin-top:6px'}, 'Вещь с рынка или подарок переносится в обычную сумку, после этого её можно точить.'));
      el.style.padding = '8px'; el.style.border = '0';
    }
  }

  // ---------- sale protection removed: hide its buttons and unlock every item (local and server-held) ----------
  const unlocked = new Set();
  async function unlockServerItem(id) {
    if (unlocked.has(id)) return true; unlocked.add(id);
    try {
      let r = await api('/api/items/' + encodeURIComponent(id) + '/lock', 'POST', {});
      if (r && r.locked === true) r = await api('/api/items/' + encodeURIComponent(id) + '/lock', 'POST', {});
      if (r && r.locked === true) { unlocked.delete(id); return false; }
      B()?.setPlayer(cur => cur && {...cur, inventory: cur.inventory.map(i => i.id === id ? {...i, isLocked: false} : i)});
      return true;
    } catch { unlocked.delete(id); return false; }
  }
  function dropLocks() {
    const b = B(), p = me(); if (!b || !p?.inventory) return;
    const eqList = Object.values(p.equipped || {}).filter(Boolean);
    if ([...p.inventory, ...eqList].some(i => i.isLocked && !i.serverOwned)) {
      const un = i => i && i.isLocked && !i.serverOwned ? {...i, isLocked: false} : i;
      b.setPlayer(cur => cur && {...cur, inventory: cur.inventory.map(un), equipped: Object.fromEntries(Object.entries(cur.equipped || {}).map(([k, v]) => [k, un(v)]))});
    }
    for (const i of [...p.inventory, ...eqList]) if (i.isLocked && i.serverOwned && !unlocked.has(i.id)) unlockServerItem(i.id);
  }
  setInterval(() => { if (document.hidden) return; try { dropLocks(); } catch {} }, 3000);
  function hideLockUi() {
    for (const btn of document.querySelectorAll('button')) {
      const t = (btn.textContent || '').trim();
      if (/^(Защитить от продажи|Разблокировать|🔒 Запереть|🔓 Отпереть)$/.test(t) && btn.style.display !== 'none') btn.style.display = 'none';
    }
    for (const el of document.querySelectorAll('.inventory-bag-state')) if ((el.textContent || '').trim() === 'Защитить от продажи') el.style.display = 'none';
  }

  // ---------- hunt modes: only names by default, details under a spoiler ----------
  let modesOpen = false;
  function injectModeToggle() {
    for (const grid of document.querySelectorAll('.region-dispatch .grid')) {
      if (!grid.querySelector('.hunting-mode-entry')) continue;
      const box = grid.closest('.region-dispatch'); box.classList.toggle('ae-modes-open', modesOpen);
      for (const b of grid.querySelectorAll('.hunting-mode-entry')) b.classList.toggle('ae-mode-locked', !!b.querySelector('.hunting-mode-lock'));
      if (grid.nextElementSibling?.hasAttribute?.('data-ae-modes')) { const t = modesOpen ? '▲ Скрыть подробности' : 'ℹ️ Подробнее: HP, урон, дроп, засады'; if (grid.nextElementSibling.textContent !== t) grid.nextElementSibling.textContent = t; continue; }
      grid.after(h('button', {type: 'button', class: 'ae-modes-toggle', 'data-ae-modes': '1', onclick: e => { e.stopPropagation(); modesOpen = !modesOpen; injectModeToggle(); }}, modesOpen ? '▲ Скрыть подробности' : 'ℹ️ Подробнее: HP, урон, дроп, засады'));
    }
  }

  // ---------- pets: drawn icons instead of emoji ----------
  const PET_ICONS = {'🐺': ['pet_wolf', 'Снежный лютоволк'], '🐉': ['pet_dragon', 'Огненный дракончик'], '🧚': ['pet_fairy', 'Астральная фея'], '🗿': ['pet_golem', 'Адамантитовый големчик'], '🌌': ['pet_voidling', 'Эфирный пустотник']};
  // ---------- energy cap: 100 for everyone (was 60). One-time raise; the gap is added to current energy. ----------
  const ENERGY_CAP = 100;
  function raiseEnergyCap() {
    const b = B(), p = me(); if (!b?.setPlayer || !p || !(Number(p.maxEnergy) < ENERGY_CAP)) return;
    const gap = ENERGY_CAP - Number(p.maxEnergy || 0);
    b.setPlayer(c => c && Number(c.maxEnergy) < ENERGY_CAP ? {...c, maxEnergy: ENERGY_CAP, energy: Math.min(ENERGY_CAP, Number(c.energy || 0) + gap)} : c);
    const k = 'aeth_energy100_' + uid();
    if (!localStorage.getItem(k)) { localStorage.setItem(k, '1'); setTimeout(() => toast(`⚡ Запас энергии увеличен до ${ENERGY_CAP}! +${gap} энергии в подарок`), 1500); }
  }
  setInterval(() => { try { raiseEnergyCap(); } catch (e) { console.warn('ae energy', e); } }, 2000);

  // ---------- pet hunger: satiety drains over a day; a hungry pet gives half its stats ----------
  const PET_DAY = 24 * 3600e3, HUNGRY_AT = 25;
  const petFoodKey = () => 'aeth_pet_food_' + uid();
  const petBaseStats = {};
  const FOOD_RE = /мясо|рыб|окун|карп|карас|щук|форел|лещ|сом\b|судак|угор|голец|хариус|ос[её]тр|кои\b|линь/i;
  const FISH_FEED = {common: 30, uncommon: 45, rare: 70, epic: 85, legendary: 100};
  const isFish = i => String(i?.templateId || '').startsWith('fish_');
  function petFood() { try { const s = JSON.parse(localStorage.getItem(petFoodKey()) || 'null'); if (s && typeof s.v === 'number') return s; } catch {} const s = {v: 100, t: Date.now()}; localStorage.setItem(petFoodKey(), JSON.stringify(s)); return s; }
  const petSat = () => { const s = petFood(); return Math.max(0, Math.min(100, s.v - (Date.now() - s.t) * 100 / PET_DAY)); };
  const petHungry = () => !!me()?.activePet && petSat() < HUNGRY_AT;
  const feedables = () => (me()?.inventory || []).filter(i => !i.isEquipped && !i.isLocked && !isFish(i) && /material|fish|food|consumable/.test(i.type || '') && FOOD_RE.test(i.name || ''));
  // The catch from fishing, grouped by kind, best first.
  const fishFeed = () => { const m = new Map(); for (const i of me()?.inventory || []) { if (!isFish(i) || i.isLocked) continue; const k = i.templateId, cur = m.get(k);
      if (cur) { cur.count += i.stackCount || 1; if (!i.serverOwned) cur.item = i; } else m.set(k, {item: i, count: i.stackCount || 1, add: FISH_FEED[i.rarity] || 30}); }
    return [...m.values()].sort((a, b) => b.add - a.add || b.count - a.count); };
  const petLvlKey = () => 'aeth_pet_levels_' + uid();
  const petLevels = () => { try { return JSON.parse(localStorage.getItem(petLvlKey()) || '{}'); } catch { return {}; } };
  const petMul = lvl => 1 + 0.06 * (Math.max(1, lvl) - 1);
  function applyPetHunger() {
    const b = B(), p = me(), pet = p?.activePet; if (!b || !pet?.stats || p.worldJourney || document.documentElement.hasAttribute('data-in-combat')) return;
    const hungry = petSat() < HUNGRY_AT, prog = petLevels()[pet.id], lvl = prog?.level || pet.aeLevel || 1;
    let base = pet.aePetBase;
    if (!base) { // first time: the catalogue stats (undo an older «hungry» halving if it is on)
      const bk = petFoodKey() + '_base_' + pet.id; let saved = null; try { saved = JSON.parse(localStorage.getItem(bk) || 'null'); } catch {}
      base = pet.aeHungry && saved ? saved : {...pet.stats};
    }
    const grown = v => v > 0 ? Math.max(Math.round(v * petMul(lvl)), v + lvl - 1) : v; // at least +1 per level even for small numbers
    const target = Object.fromEntries(Object.entries(base).map(([k, v]) => [k, typeof v === 'number' ? Math.floor(grown(v) * (hungry ? 0.5 : 1)) : v]));
    if (pet.aePetBase && pet.aeLevel === lvl && !!pet.aeHungry === hungry && pet.level === lvl && JSON.stringify(pet.stats) === JSON.stringify(target)) return;
    b.setPlayer(c => c?.activePet?.id === pet.id ? {...c, activePet: {...c.activePet, aePetBase: base, aeLevel: lvl, level: lvl, aeHungry: hungry, stats: target}} : c);
  }
  // Server answer → remember levels, celebrate a level-up.
  function petProgress(r) {
    if (!r) return;
    const all = {...petLevels()}; for (const [k, v] of Object.entries(r.pets || {})) all[k] = {...(all[k] || {}), level: v};
    if (r.pet) all[r.pet.id] = {level: r.pet.level, xp: r.pet.xp, need: r.pet.need, max: r.pet.max};
    localStorage.setItem(petLvlKey(), JSON.stringify(all));
    if (r.up > 0 && r.pet) { const nm = me()?.activePet?.name || 'Питомец'; bigBanner(`🐾 ${nm} достиг ${r.pet.level} уровня! Сила +${Math.round((petMul(r.pet.level) - 1) * 100)}%`, r.pet.level % 10 === 0); sfx.play('coins'); try { Telegram.WebApp.HapticFeedback.notificationOccurred('success'); } catch {} }
    applyPetHunger();
  }
  // Fights give the active pet XP: kills and bosses counted from the hero's stats, sent in small batches.
  let petSnap = null, petPend = {kills: 0, bosses: 0}, petFlushAt = 0;
  function petXpTick() {
    const p = me(); if (!p?.statsSummary || !p.activePet) return;
    const cur = {uid: p.userId, kills: p.statsSummary.monstersKilled || 0, bosses: p.statsSummary.bossesDefeated || 0};
    if (petSnap && petSnap.uid === cur.uid) { const dk = cur.kills - petSnap.kills, db = cur.bosses - petSnap.bosses; if (dk > 0 && dk < 60) petPend.kills += dk; if (db > 0 && db < 10) petPend.bosses += db; }
    petSnap = cur;
    if ((petPend.kills || petPend.bosses) && Date.now() - petFlushAt > 25e3) { petFlushAt = Date.now(); const send = petPend; petPend = {kills: 0, bosses: 0};
      api('/api/ae-pet', 'POST', {action: 'xp', pet: p.activePet.id, ...send}).then(petProgress, () => { petPend.kills += send.kills; petPend.bosses += send.bosses; }); }
  }
  // The server keeps satiety (so it follows the player across devices and the bot can remind); the device caches it.
  let petSyncAt = 0;
  async function petSync(force) {
    if (!uid() || (!force && Date.now() - petSyncAt < 10 * 60e3)) return; petSyncAt = Date.now();
    try { const r = await api('/api/ae-pet', 'POST', {local: petFood(), pet: me()?.activePet?.id}); localStorage.setItem(petFoodKey(), JSON.stringify({v: r.sat, t: Date.now()})); petProgress(r); } catch { petSyncAt = 0; }
  }
  let feeding = false;
  async function feedPet(how, fishItem) {
    const b = B(), p = me(); if (!b || !p?.activePet) return toast('Нет активного питомца.');
    if (feeding) return;
    const sat = petSat(); if (sat >= 99) return toast('Питомец сыт и не хочет есть.');
    const it = fishItem || (how === 'food' ? feedables()[0] : null), cost = how === 'feast' ? 30 : how === 'bowl' ? 10 : 0;
    if (how === 'food' && !it) return toast('В сумке нет мяса или рыбы.');
    if (cost && (p.gold || 0) < cost) return toast(`Нужно ${cost} золота.`);
    feeding = true; let r;
    try { r = await api('/api/ae-pet', 'POST', {action: 'feed', how, pet: p.activePet.id, itemId: it?.serverOwned ? it.id : undefined}); } catch (e) { feeding = false; return toast(cleanError(e)); }
    petProgress(r);
    feeding = false;
    if (it) b.setPlayer(c => c && {...c, inventory: c.inventory.flatMap(i => i.id !== it.id ? [i] : (i.stackCount || 1) > 1 ? [{...i, stackCount: i.stackCount - 1}] : [])});
    if (cost) b.setPlayer(c => c && {...c, gold: Math.max(0, (c.gold || 0) - cost)});
    localStorage.setItem(petFoodKey(), JSON.stringify({v: r.sat, t: Date.now()})); localStorage.removeItem(petFoodKey() + '_warned');
    sfx.play('potion'); toast(`🐾 ${p.activePet.name} доволен! Сытость ${Math.round(r.sat)}%`);
    setTimeout(() => { applyPetHunger(); document.querySelectorAll('.ae-petfood').forEach(e => e.replaceWith(petFoodCard())); paintPlaceBadges(); if (openPanelState?.root.querySelector('.ae-petfood')) openPanelState.rerender(); }, 50);
  }
  function petFoodCard() {
    const sat = Math.round(petSat()), hungry = sat < HUNGRY_AT, pet = me()?.activePet, food = feedables(), gold = me()?.gold || 0;
    const hrs = Math.max(0, Math.round((sat - HUNGRY_AT) * PET_DAY / 100 / 3600e3));
    return h('div', {class: 'ae-petfood' + (hungry ? ' is-hungry' : '')},
      h('div', {class: 'ae-row'}, h('b', {class: 'ae-grow'}, hungry ? `🍖 ${pet?.name || 'Питомец'} голоден!` : `🍖 Сытость: ${pet?.name || 'питомец'}`), h('span', {class: 'ae-petfood-pct'}, sat + '%')),
      h('div', {class: 'ae-petfood-bar'}, h('i', {style: `width:${sat}%`})),
      (() => { const g = petLevels()[pet?.id] || {level: 1, xp: 0, need: 90, max: 30}, lvl = g.level || 1, top = lvl >= (g.max || 30);
        return h('div', {class: 'ae-petlvl'}, h('div', {class: 'ae-row'}, h('b', {class: 'ae-grow'}, `⭐ Уровень ${lvl}${top ? ' · максимум' : ''}`), h('span', {}, `сила +${Math.round((petMul(lvl) - 1) * 100)}%`)),
          top ? '' : h('div', {class: 'ae-petfood-bar is-xp'}, h('i', {style: `width:${Math.min(100, Math.round(100 * (g.xp || 0) / Math.max(1, g.need || 90)))}%`})),
          h('small', {}, top ? 'Питомец достиг предела.' : `Опыт ${g.xp || 0}/${g.need || 90}: +2 за монстра, +15 за босса (до 600 в день), кормление даёт ещё — рыба по редкости, пир +25.`)); })(),
      h('p', {class: 'ae-note'}, hungry ? 'Голодный питомец даёт только половину характеристик. Покормите его!' : `Сытый питомец даёт полные бонусы. Проголодается примерно через ${hrs} ч — бот напомнит в Telegram, если уведомления включены.`),
      fishFeed().length ? h('div', {class: 'ae-petfood-fish'}, h('small', {}, '🐟 Улов с рыбалки:'), fishFeed().slice(0, 4).map(f => h('button', {type: 'button', class: 'ae-btn', disabled: sat >= 99, onclick: () => feedPet('fish_' + (f.item.rarity || 'common'), f.item)}, `${baseName(f.item)} ×${f.count} · +${f.add}%`))) : '',
      h('div', {class: 'ae-petfood-btns'},
        h('button', {type: 'button', class: 'ae-btn', disabled: !food.length, onclick: () => feedPet('food')}, food.length ? `🥩 ${food[0].name} · +40%` : '🥩 Мясо · нет'),
        h('button', {type: 'button', class: 'ae-btn', disabled: gold < 10, onclick: () => feedPet('bowl')}, '🥣 Миска корма · 10 🪙 · +50%'),
        h('button', {type: 'button', class: 'ae-btn ae-primary', disabled: gold < 30, onclick: () => feedPet('feast')}, '🍗 Пир · 30 🪙 · 100%')));
  }
  function injectPetFood() {
    if (!me()?.activePet) return;
    const anchor = document.querySelector('main .pet-codex-card.is-active') || [...document.querySelectorAll('main .ui-panel')].find(e => /КОМПАНЬОНЫ|Компаньоны/.test(e.firstElementChild?.textContent || e.textContent.slice(0, 40)));
    if (!anchor) return;
    const sat = String(Math.round(petSat())), cur = anchor.parentElement.querySelector(':scope > .ae-petfood') || anchor.querySelector(':scope > .ae-petfood');
    if (cur && cur.dataset.sat === sat) return;
    const card = petFoodCard(); card.dataset.sat = sat;
    if (cur) cur.replaceWith(card); else if (anchor.classList.contains('pet-codex-card')) anchor.after(card); else anchor.append(card);
  }
  function injectFishFeed() {
    if (!me()?.activePet || !fishFeed().length) return;
    const main = document.querySelector('main'); if (!main || main.querySelector('[data-ae-fish-feed]')) return;
    const h1 = [...main.querySelectorAll('h1, h2')].find(e => /Рыбацкий причал|Рыбалка/i.test(e.textContent || '')); if (!h1) return;
    const box = h1.closest('section, .ui-panel, .bestiary-panel, .rounded-2xl') || h1;
    box.after(h('button', {type: 'button', class: 'ae-bag-merge', 'data-ae-fish-feed': '1', onclick: () => openPanel('🐾 Покормить питомца', b => { b.append(h('img', {class: 'ae-petfood-art', src: `/assets/pets/icon-${me()?.activePet?.id || 'pet_wolf'}.webp`, alt: ''}), petFoodCard()); })},
      h('span', {class: 'ae-entry-icon'}, '🐾'), h('span', {class: 'ae-grow'}, h('b', {}, 'Покормить питомца уловом'), h('small', {}, `Сытость ${Math.round(petSat())}% · рыба даёт +30–70%`)), h('span', {class: 'ae-coop-go'}, '›')));
  }
  function petHungerTick() {
    if (!me()) return; petSync(); applyPetHunger();
    if (!petHungry()) return;
    const k = petFoodKey() + '_warned'; if (localStorage.getItem(k) || openPanelState || document.documentElement.hasAttribute('data-in-combat')) return;
    localStorage.setItem(k, String(Date.now())); sfx.play('bell');
    openPanel('🐾 Ваш питомец голоден!', body => { body.append(h('img', {class: 'ae-petfood-art', src: `/assets/pets/icon-${me()?.activePet?.id || 'pet_wolf'}.webp`, alt: ''}), petFoodCard()); });
  }
  setInterval(() => { try { petHungerTick(); } catch (e) { console.warn('ae pet', e); } }, 5000);

  function decoratePets() {
    for (const el of document.querySelectorAll('main span, main div, .bottom-sheet-backdrop span, .bottom-sheet-backdrop div, .game-dialog-backdrop span, .game-dialog-backdrop div')) {
      if (el.childElementCount || el.classList.contains('ae-pet-icon')) continue;
      const pet = PET_ICONS[(el.textContent || '').trim()]; if (!pet) continue;
      let card = el; for (let i = 0; i < 4 && card && !(card.textContent || '').includes(pet[1]); i++) card = card.parentElement;
      if (!card || !(card.textContent || '').includes(pet[1])) continue;
      el.classList.add('ae-pet-icon'); el.style.backgroundImage = `url(/assets/pets/icon-${pet[0]}.webp)`;
    }
  }

  // ---------- market: put bag gear on the market (the market only accepts server-held items) ----------
  const MARKET_GEAR = new Set(['weapon', 'offhand', 'helmet', 'armor', 'pants', 'gloves', 'boots', 'amulet', 'ring', 'belt', 'cloak', 'artifact']);
  const depositable = i => i && !i.serverOwned && !i.isEquipped && !i.boundToClan && MARKET_GEAR.has(i.type);
  const STACKABLE = new Set(['material', 'ore', 'potion', 'consumable', 'fish', 'food', 'scroll', 'resource']);
  const transferable = i => i && !i.serverOwned && !i.isEquipped && !i.isLocked && (MARKET_GEAR.has(i.type) ? !i.boundToClan : STACKABLE.has(i.type));
  // Puts a bag item on the server for a deal (market, auction, chat lot, clan storage). qty: how many of a stack.
  async function depositItem(item, qty = 1) {
    const b = B(), p = me(); if (!b || !p) throw new Error('Игра ещё загружается.');
    if (p.worldJourney || document.documentElement.hasAttribute('data-in-combat')) throw new Error('Сначала завершите бой или путь.');
    if (Object.values(p.equipped || {}).some(e => e && e.id === item.id)) throw new Error('Сначала снимите вещь с героя.');
    const n = MARKET_GEAR.has(item.type) ? 1 : Math.max(1, Math.min(item.stackCount || 1, qty));
    const one = {...item, stackCount: n};
    const r = await api('/api/items/deposit', 'POST', {operationId: uuid4(), item: one, quantity: n});
    const srv = {...one, ...(r.item || {}), id: r.itemId, serverOwned: true, marketTradable: true, isLocked: false, isEquipped: false, stackCount: n};
    if ((item.stackCount || 1) <= n) rememberGone([item.id]);
    b.setPlayer(cur => {
      if (!cur) return cur;
      const inv = cur.inventory.flatMap(i => i.id !== item.id ? [i] : (i.stackCount || 1) > n ? [{...i, stackCount: i.stackCount - n}] : []);
      return {...cur, inventory: [...inv, srv]};
    });
    sfx.play('coins'); return srv;
  }
  // ---------- one owner for every item: the bag lives on the device ----------
  // Server-held items that reached the hero (purchases, raid trophies, clan storage, deals) are taken into the bag as
  // ordinary items. The server keeps items only while they are in a deal, so the two sides never disagree about them.
  const claimKey = () => 'aeth_claims_' + uid();
  let claimBusy = false, claimAt = 0;
  async function claimServerItems(force) {
    const p = me(), b = B(); if (!p || !b || claimBusy || walletBusy) return;
    if (p.worldJourney || document.documentElement.hasAttribute('data-in-combat')) return;
    const hasServer = (p.inventory || []).some(i => i.serverOwned) || Object.values(p.equipped || {}).some(i => i?.serverOwned);
    if (!hasServer || (!force && Date.now() - claimAt < 20e3)) return;
    claimBusy = true; claimAt = Date.now();
    let done; try { done = new Set(JSON.parse(localStorage.getItem(claimKey()) || '[]')); } catch { done = new Set(); }
    const op = uuid4();
    try {
      const r = await api('/api/items/claim', 'POST', {operationId: op});
      if (done.has(op) || !r.items?.length) return; done.add(op); localStorage.setItem(claimKey(), JSON.stringify([...done].slice(-50)));
      const rows = new Map(r.items.map(x => [x.id, x]));
      const local = (x, prev) => ({...(prev || {}), ...x.item_json, name: prev?.name || x.item_json.name, id: 'own_' + uuid4(), stackCount: x.quantity, isLocked: x.locked, boundToClan: x.bound_clan_id || undefined, serverOwned: false, marketTradable: false, slot: undefined});
      rememberGone([...rows.keys()]);
      b.setPlayer(cur => {
        if (!cur) return cur;
        const seen = new Set(), equipped = {...(cur.equipped || {})};
        for (const [slot, it] of Object.entries(equipped)) { const x = it && rows.get(it.id); if (x) { equipped[slot] = {...local(x, it), isEquipped: true}; seen.add(x.id); } }
        const inventory = cur.inventory.map(it => { const x = rows.get(it.id); if (!x) return it; seen.add(x.id); return {...local(x, it), isEquipped: false}; });
        for (const x of r.items) if (!seen.has(x.id)) { const it = {...local(x), isEquipped: false}; if (x.equipped_slot && !equipped[x.equipped_slot]) equipped[x.equipped_slot] = {...it, isEquipped: true}; else inventory.push(it); }
        return {...cur, inventory, equipped};
      });
    } catch {} finally { claimBusy = false; }
  }
  setTimeout(() => claimServerItems(true), 10000); setInterval(() => { if (!document.hidden) claimServerItems(); }, 30e3);
  window.addEventListener('aethelgard-market-inventory-refresh', () => setTimeout(() => claimServerItems(true), 3500));
  function openMarketDeposit() {
    const st = openPanel('🎒 Выставить вещь из сумки', body => {
      const list = (me()?.inventory || []).filter(depositable).sort((a, b) => (b.level || 0) - (a.level || 0));
      body.append(h('p', {class: 'ae-note'}, 'Рынок принимает только вещи, которые хранятся на сервере. Выберите экипировку — она переедет на склад рынка, и её можно будет выставить через «Продать вещь».'));
      if (!list.length) return body.append(h('p', {class: 'ae-empty'}, 'В сумке нет экипировки для продажи (надетые вещи сначала снимите).'));
      for (const it of list) body.append(h('button', {type: 'button', class: 'ae-chat-item ae-equip-row', 'data-ae-rarity': it.rarity || 'common', onclick: async () => {
        try { await depositItem(it); toast(`«${baseName(it)}» готова к продаже`); closePanel(); setTimeout(() => [...document.querySelectorAll('main button')].find(x => /Продать вещь/.test(x.textContent) && !x.disabled)?.click(), 500); }
        catch (e) { toast(cleanError(e)); }
      }}, h('img', {src: iconFor(it) || '/assets/items/sprites/sword.webp', alt: '', style: iconStyle(it)}),
        h('span', {class: 'ae-grow'}, h('b', {}, `${baseName(it)}${it.upgradeLevel ? ' +' + it.upgradeLevel : ''}${ascOf(it) ? ' ★' + ascOf(it) : ''}`), h('small', {}, `${RARITY_RU[it.rarity] || ''} · ур. ${it.level || 1}`), h('small', {class: 'ae-chat-item-stats'}, statLine(it.stats) || '')),
        h('span', {class: 'ae-equip-go'}, 'На рынок')));
    });
    return st;
  }
  function injectMarketDeposit() {
    const sell = [...document.querySelectorAll('main button')].find(x => /^Продать вещь/.test((x.textContent || '').trim()));
    if (sell && !sell.parentElement.querySelector('[data-ae-market-dep]'))
      sell.after(h('button', {type: 'button', class: sell.className + ' ae-market-dep', 'data-ae-market-dep': '1', onclick: openMarketDeposit}, '🎒 Выставить вещь из сумки'));
    if (!lastTileId) return;
    const item = findItem(lastTileId); if (!depositable(item)) return;
    for (const d of document.querySelectorAll('.game-dialog-backdrop, .bottom-sheet-backdrop, .fixed.inset-0')) {
      const share = d.querySelector('[data-ae-share]'); if (!share || d.querySelector('[data-ae-to-market]')) continue;
      share.parentElement.insertBefore(h('button', {type: 'button', class: share.className.replace('ae-share', '') + ' ae-share', 'data-ae-to-market': '1', onclick: async () => {
        const cur = findItem(lastTileId) || item; if (!confirm(`Перенести «${baseName(cur)}» на склад рынка? После этого её можно выставить в «Рынок → Продать вещь».`)) return;
        try { await depositItem(cur); toast('Готово: откройте Рынок → «Продать вещь»'); document.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape', bubbles: true})); } catch (e) { toast(cleanError(e)); }
      }}, '🏷️ На рынок'), share.nextSibling);
    }
  }
  // ---------- modern «Меню»: one style, no duplicates, add-on features as a native group ----------
  // Line icons in the menu's own style (stroke = currentColor, 28×28 like the game's icons)
  const LINE = {
    scale: '<circle cx="12" cy="12" r="7"/><path d="M17 17l7 7M9 12h6M12 9v6"/>',
    gems: '<path d="M8 4h12l4 6-10 14L4 10z"/><path d="M4 10h20M11 4l-2 6 5 14 5-14-2-6"/>',
    invite: '<circle cx="11" cy="10" r="4"/><path d="M3.5 23c.7-4 3.7-6.5 7.5-6.5 1.6 0 3 .4 4.2 1.2M21 14v8M17 18h8"/>',
    coop: '<path d="M5 24V12a9 9 0 0 1 18 0v12M3.5 24h21M11 24v-6a3 3 0 0 1 6 0v6M9 13.5h10"/>',
    duel: '<path d="M5 5l12 12M5 5h3.5L19 15.5M5 5v3.5L15.5 19M23 5L11 17M23 5h-3.5L9 15.5M23 5v3.5L12.5 19M8 20l-3 3M20 20l3 3M7 18l3 3M21 18l-3 3"/>',
    quests: '<path d="M9 5h12a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H10a2 2 0 0 1-2-2V7a2 2 0 0 0-2-2h3M6 5a2 2 0 0 0-2 2v2h4M12 11h7M12 15h7M12 19h4"/>',
    merge: '<path d="M14 4l2.6 5.3 5.9.9-4.2 4.1 1 5.8L14 17.4l-5.3 2.7 1-5.8-4.2-4.1 5.9-.9z"/>',
    friends: '<circle cx="10" cy="9.5" r="3.5"/><circle cx="19.5" cy="10.5" r="2.8"/><path d="M3.5 22.5c0-3.6 2.9-6.5 6.5-6.5s6.5 2.9 6.5 6.5M16 16.6c1-.6 2.2-.9 3.5-.9 2.8 0 5 2.2 5 5.3"/>',
    promo: '<rect x="5" y="12" width="18" height="11" rx="1.5"/><path d="M4 8.5h20V12H4zM14 8.5V23M14 8.5c-1.5-3-5.2-4-6.2-2.1s2 3 6.2 2.1zm0 0c1.5-3 5.2-4 6.2-2.1s-2 3-6.2 2.1z"/>',
    profile: '<circle cx="14" cy="10" r="4.5"/><path d="M5.5 23.5c.8-4.4 4.3-7 8.5-7s7.7 2.6 8.5 7"/><path d="M20.5 4.5l1 2 2.2.3-1.6 1.5.4 2.2-2-1-2 1 .4-2.2-1.6-1.5 2.2-.3z" fill="currentColor" stroke="none"/>',
    horde: '<path d="M14 4c-5 0-8.5 3.4-8.5 8 0 2.6 1.2 4.5 3 5.6V21a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1v-3.4c1.8-1.1 3-3 3-5.6 0-4.6-3.5-8-8.5-8z"/><circle cx="10.6" cy="12.6" r="1.8"/><circle cx="17.4" cy="12.6" r="1.8"/><path d="M12 22v-2.4M16 22v-2.4"/>',
    news: '<rect x="4.5" y="5.5" width="19" height="17" rx="2"/><path d="M8.5 10h11M8.5 14h11M8.5 18h6"/><circle cx="21.5" cy="6.5" r="2.5" fill="currentColor" stroke="none"/>',
    phone: '<rect x="8" y="3.5" width="12" height="21" rx="2.5"/><path d="M12.5 20.5h3"/>',
    wiki: '<path d="M14 7.5c-2.5-2-6-2.5-9.5-2v16c3.5-.5 7 0 9.5 2 2.5-2 6-2.5 9.5-2v-16c-3.5-.5-7 0-9.5 2zM14 7.5v16"/>'};
  const lineIcon = k => h('span', {class: 'reference-icon ae-line-icon', 'aria-hidden': 'true', html: `<svg width="25" height="25" viewBox="0 0 28 28" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${LINE[k]}</svg>`});
  const AE_GROUP = [['profile', 'Профиль', () => openProfile()], ['news', 'Что нового', openNews], ['horde', 'Орда', () => openHorde()], ['coop', 'Кооп', openCoop], ['duel', 'Дуэли', () => openDuel()], ['quests', 'Кооп и PvP задания', () => openSpecialQuests()], ['merge', 'Объединение', openMerge],
    ['friends', 'Друзья', () => openFriends()], ['invite', 'Пригласить друга', () => openInvite()], ['promo', 'Промокод', openPromo], ['wiki', 'Вики', openWiki], ['scale', 'Размер интерфейса', () => openUiScale()], ['phone', 'Приложение Android', () => openApkInfo()]];
  function openUiScale() {
    const st = openPanel('🔍 Размер интерфейса', body => {
      const cur = localStorage.getItem('aeth_ui_scale') || 'x1';
      body.append(h('p', {class: 'ae-note'}, 'Уменьшите интерфейс, если на экране тесно. Настройка сохраняется на этом устройстве.'));
      const fxCur = fxMode();
      body.append(h('h3', {class: 'ae-h3'}, '✨ Эффекты боя'), h('div', {class: 'ae-scale-list'}, [['high', 'Полные'], ['low', 'Лёгкие'], ['off', 'Выключены']].map(([k, l]) => h('button', {type: 'button', class: 'ae-btn ae-scale-opt' + (k === fxCur ? ' ae-primary is-on' : ''), onclick: () => { localStorage.setItem('aeth_fx', k); st.rerender(); }}, h('b', {}, l)))));
      body.append(h('div', {class: 'ae-scale-list'}, UI_SCALES.map(([k, label, z]) => h('button', {type: 'button', class: 'ae-btn ae-scale-opt' + (k === cur ? ' ae-primary is-on' : ''), onclick: () => {
        localStorage.setItem('aeth_ui_scale', k); applyUiScale(); sfx.play('page'); st.rerender(); setTimeout(() => window.dispatchEvent(new Event('resize')), 50); }},
        h('b', {}, label), h('small', {}, `${Math.round(z * 100)}%`)))));
    });
  }
  function tidyMechanicsMenu(menu) {
    if (!menu.querySelector(':scope > [data-ae-group]')) {
      const group = h('section', {class: 'mechanics-group', 'data-ae-group': '1'}, h('header', {}, h('h2', {}, 'Приключения'), h('p', {}, 'Вместе и против всех')),
        h('div', {class: 'mechanics-grid'}, AE_GROUP.map(([icon, label, fn]) => h('div', {class: 'mechanics-entry'},
          h('button', {type: 'button', 'data-ae-news-btn': icon === 'news' ? '1' : null, onclick: e => { e.stopPropagation(); fn(); }}, lineIcon(icon), h('span', {class: 'mechanics-entry-label'}, label))))));
      const first = menu.querySelector(':scope > .mechanics-group');
      menu.insertBefore(group, first ? first.nextSibling : null);
    }
    // Places that live in «Поселение» are not repeated in the menu; groups left empty disappear.
    const SETTLEMENT = new Set(['Арена', 'Создание', 'Кузница', 'Алхимия', 'Шахта', 'Рыбалка', 'Клан', 'Чат', 'Рынок', 'Спутники', 'Задания']);
    for (const g of menu.querySelectorAll(':scope > .mechanics-group:not([data-ae-group])')) {
      let shown = 0;
      for (const e of g.querySelectorAll('.mechanics-entry')) {
        const dup = SETTLEMENT.has((e.querySelector('.mechanics-entry-label')?.textContent || '').trim());
        if (dup !== e.classList.contains('ae-dup')) e.classList.toggle('ae-dup', dup);
        if (!dup && !e.querySelector('.mechanics-pin[aria-pressed="true"]') && !/^Герой$/.test((e.querySelector('.mechanics-entry-label')?.textContent || '').trim())) shown++;
      }
      if (!shown !== g.classList.contains('ae-empty')) g.classList.toggle('ae-empty', !shown);
    }
    // «Журнал приключений» repeats «Задания» and «Достижения» from «Развитие»
    for (const b of menu.querySelectorAll(':scope > .mechanics-utilities > button'))
      if (/^Журнал приключений$/.test((b.textContent || '').trim()) && !b.classList.contains('ae-hide')) b.classList.add('ae-hide');
    // favorites: a small star on each pinned tile unpins it (the group copy of the entry is hidden)
    for (const fav of menu.querySelectorAll('.mechanics-favorites > div > button')) {
      if (fav.querySelector('.ae-unpin')) continue;
      const label = (fav.textContent || '').trim();
      fav.append(h('span', {class: 'ae-unpin', role: 'button', title: 'Убрать из избранного', onclick: e => { e.stopPropagation(); e.preventDefault(); [...menu.querySelectorAll('.mechanics-group .mechanics-pin')].find(x => (x.getAttribute('aria-label') || '').endsWith(': ' + label))?.click(); }}, '★'));
    }
  }
  // ---------- modern header: real gold / silver coins instead of two identical circles ----------
  function decorateCurrencies() {
    const p = me(); if (!p) return;
    const digits = v => String(v ?? '').replace(/\D/g, '');
    for (const r of document.querySelectorAll('.modern-resource')) {
      const n = digits(r.querySelector('b')?.textContent);
      const kind = n && n === digits(p.gold) ? 'gold' : n && n === digits(p.silver) ? 'silver' : r.getAttribute('data-ae-cur');
      if (kind && r.getAttribute('data-ae-cur') !== kind) { r.setAttribute('data-ae-cur', kind); r.title = kind === 'gold' ? 'Золото' : 'Серебро'; }
    }
    const pet = document.querySelector('[data-settlement-place="pets"] .settlement-place-icon img');
    if (pet && pet.getAttribute('src') !== '/assets/pets/place-icon-v1.webp') pet.setAttribute('src', '/assets/pets/place-icon-v1.webp');
  }

  // ---------- analytics: which sections players open (batched, sent once a minute) ----------
  const visitQ = [], visitLast = {};
  function logVisit(key) {
    key = String(key || '').replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, '').replace(/\s+/g, ' ').trim().slice(0, 40);
    if (!key || Date.now() - (visitLast[key] || 0) < 30e3) return; visitLast[key] = Date.now(); visitQ.push(key);
  }
  async function flushVisits() { if (!visitQ.length || !uid()) return; const s = visitQ.splice(0, 30); try { await api('/api/ae-track', 'POST', {s}); } catch { visitQ.unshift(...s.slice(0, 30 - visitQ.length)); } }
  setInterval(flushVisits, 60e3);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flushVisits(); });
  document.addEventListener('click', e => {
    const nav = e.target.closest?.('nav button, nav a, .bottom-nav button, [class*="bottom-nav"] button');
    if (nav) logVisit('Меню: ' + (nav.innerText || nav.getAttribute('aria-label') || ''));
    const place = e.target.closest?.('[data-settlement-place]');
    if (place) logVisit('Поселение: ' + (place.querySelector('strong')?.textContent || place.dataset.settlementPlace));
  }, true);
  // ---------- settlement tiles: live notification badges that pull players into each place ----------
  const placeSeenKey = () => 'aeth_place_seen_' + uid();
  const today = () => new Date().toLocaleDateString('sv');
  const placeSeen = () => { try { return JSON.parse(localStorage.getItem(placeSeenKey()) || '{}'); } catch { return {}; } };
  const PLACE_HINT = {};
  const plural = (n, one, few, many) => { const m10 = n % 10, m100 = n % 100; return m10 === 1 && m100 !== 11 ? one : m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14) ? few : many; };
  // Re-open the Clan House so the game's own screen fetches fresh treasury / storage.
  const reopenClan = () => { const back = [...document.querySelectorAll('main button')].find(b => /^Назад$/.test((b.textContent || '').trim()));
    if (document.querySelector('[data-settlement-place="clan"]')) return clickPlace('clan');
    if (back) { back.click(); setTimeout(() => clickPlace('clan'), 450); } };
  const clickPlace = id => { const b = document.querySelector(`[data-settlement-place="${id}"]`); if (b) b.click(); else toast('Это место доступно в поселении.'); };
  function placeBadge(id, p) {
    const now = Date.now(), cast = p.fishing?.cast, exp = p.miningExpedition;
    if (id === 'pets' && p.activePet) { const sat = petSat(); if (sat < HUNGRY_AT) return ['warn', '🍖 Питомец голоден']; if (sat < 50) return ['info', '🍖 Пора покормить']; }
    if (id === 'fishing' && cast) { if (cast.hookedAt || (Number.isFinite(cast.biteAt) && now >= cast.biteAt && !(now > cast.expiresAt))) return ['warn', '🐟 Клюёт! Подсекайте']; return ['busy', '⏳ Ждём клёва']; }
    if (id === 'mine' && exp) return Number(exp.endsAt) <= now ? ['ready', '⛏️ Добыча готова'] : ['busy', '⏳ Идёт добыча'];
    if (id === 'arena' && (p.arenaTickets || 0) > 0) { const n = p.arenaTickets; return ['ready', `🎟️ ${n} ${plural(n, 'билет', 'билета', 'билетов')}`]; }
    if (id === 'alchemy' && (p.alchemyEnergy || 0) >= (p.maxAlchemyEnergy || 100)) return ['ready', '⚗️ Можно варить'];
    if (id === 'chat' && p.energy < p.maxEnergy) return ['ready', '⚡ Энергия +25'];
    // The board's own quests (not the co-op/PvP/Horde «Задания» — those have their badge on the quick bar).
    if (id === 'quests') { const n = (B()?.quests || []).filter(q => q.completed && !q.claimed).length; if (n) return ['ready', `🎁 ${n} ${plural(n, 'награда', 'награды', 'наград')}`]; }
    if (placeSeen()[id] !== today()) return ['new', '✨ Загляните'];
    return null;
  }
  function paintPlaceBadges() {
    const p = me(); const tiles = document.querySelectorAll('[data-settlement-place]'); if (!p || !tiles.length) return;
    for (const t of tiles) {
      const id = t.dataset.settlementPlace, want = placeBadge(id, p), sig = want ? want.join('|') : '';
      if (!t.dataset.aeSeenHook) { t.dataset.aeSeenHook = '1'; t.addEventListener('click', () => { const s = placeSeen(); s[id] = today(); localStorage.setItem(placeSeenKey(), JSON.stringify(s)); }, true); }
      if ((t.dataset.aeBadge || '') === sig) continue;
      t.dataset.aeBadge = sig; t.querySelector(':scope > .ae-place-badge')?.remove(); t.removeAttribute('data-ae-badge-kind');
      if (!want) continue;
      const [kind, text] = want; t.setAttribute('data-ae-badge-kind', kind);
      t.append(h('span', {class: 'ae-place-badge is-' + kind, title: kind === 'new' ? 'Вы ещё не заходили сюда сегодня' : text}, text));
    }
  }
  setInterval(() => { if (document.hidden) return; try { paintPlaceBadges(); } catch {} }, 4000);

  // ---------- «Что нового»: update posts (same as in the channel) ----------
  const newsSeenKey = () => 'aeth_news_seen_' + uid();
  let newsCache = null;
  const esc = t => String(t).replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));
  function newsHtml(text) {
    return esc(text).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/`([^`]{2,40})`/g, '<code class="ae-copy" title="Нажмите, чтобы скопировать">$1</code>')
      .replace(/(^|\s)(t\.me\/[A-Za-z0-9_/]+)/g, '$1<a href="https://$2" target="_blank" rel="noopener">$2</a>').replace(/\n/g, '<br>');
  }
  async function loadNews() { try { newsCache = (await api('/api/news')).posts || []; } catch { newsCache = newsCache || []; } return newsCache; }
  const unreadNews = () => { const seen = localStorage.getItem(newsSeenKey()) || ''; return (newsCache || []).filter(x => x.at > seen).length; };
  function openNews() {
    const st = openPanel('📰 Что нового', body => {
      if (!newsCache) return body.append(h('p', {class: 'ae-empty'}, 'Загрузка…'));
      body.append(h('p', {class: 'ae-note'}, h('span', {}, 'Все обновления игры. Новости первыми — в канале '), h('a', {href: 'https://t.me/Aethelgardo', target: '_blank', rel: 'noopener'}, 't.me/Aethelgardo')));
      if (!newsCache.length) return body.append(h('p', {class: 'ae-empty'}, 'Пока пусто.'));
      for (const n of newsCache) body.append(h('article', {class: 'ae-card ae-news'}, h('small', {}, new Date(n.at).toLocaleDateString('ru-RU', {day: 'numeric', month: 'long', year: 'numeric'})), h('h3', {}, n.title), h('div', {class: 'ae-news-text', html: newsHtml(n.text)})));
    });
    st.body.addEventListener('click', e => { const c = e.target.closest('.ae-copy'); if (!c) return; navigator.clipboard?.writeText(c.textContent).then(() => toast('Промокод скопирован: ' + c.textContent), () => toast(c.textContent)); });
    loadNews().then(() => { if (newsCache[0]) localStorage.setItem(newsSeenKey(), newsCache[0].at); if (openPanelState === st) st.rerender(); paintNewsBadges(); });
  }
  function paintNewsBadges() {
    if (!newsCache) return;
    const n = unreadNews(), want = n ? String(n) : '';
    for (const b of document.querySelectorAll('[data-ae-news-btn]')) {
      const cur = b.querySelector(':scope > .ae-qbadge');
      if ((cur?.textContent || '') === want) continue;
      cur?.remove(); if (want) b.append(h('i', {class: 'ae-qbadge'}, want));
    }
  }
  // ---------- welcome window: greeting + what changed since the last visit ----------
  const visitKey = () => 'aeth_last_visit_' + uid();
  const DAY_MS = 864e5;
  const daysWord = n => n % 10 === 1 && n % 100 !== 11 ? 'день' : [2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100) ? 'дня' : 'дней';
  function showWelcome(posts, awayDays) {
    const p = me(), name = p?.characterName || p?.name || 'герой', seenBefore = localStorage.getItem(newsSeenKey()) || '';
    const unread = posts.filter(x => x.at > seenBefore), list = unread.length ? unread : posts.slice(0, 1);
    const long = awayDays >= 3;
    const close = () => { if (posts[0]) localStorage.setItem(newsSeenKey(), posts[0].at); paintNewsBadges(); root.classList.add('is-out'); setTimeout(() => root.remove(), 300); sfx.play('page'); };
    const items = list.slice(0, 5).map((n, i) => h('details', {class: 'ae-welcome-item', open: i === 0 ? true : null},
      h('summary', {}, h('b', {}, n.title), h('small', {}, new Date(n.at).toLocaleDateString('ru-RU', {day: 'numeric', month: 'long'}))), h('div', {class: 'ae-news-text', html: newsHtml(n.text)})));
    const root = h('div', {class: 'ae-story ae-welcome', role: 'dialog', 'aria-label': 'Добро пожаловать'},
      h('div', {class: 'ae-story-card'}, h('img', {src: '/assets/story/royal-return.webp', alt: ''}),
        h('div', {class: 'ae-story-text'},
          h('small', {}, long ? `Вас не было ${awayDays} ${daysWord(awayDays)}` : 'Новости королевства'),
          h('h2', {}, long ? `С возвращением, ${name}!` : `Рады видеть, ${name}!`),
          h('p', {}, long ? 'Пока вы странствовали, Аэтельгард изменился. Вот что нового:' : unread.length > 1 ? `Вышло обновлений: ${unread.length}. Вот что нового:` : 'В игре вышло обновление:'),
          h('div', {class: 'ae-welcome-list'}, items),
          unread.length > 5 ? h('p', {class: 'ae-sub'}, `И ещё ${unread.length - 5} — в разделе «Что нового».`) : '',
          h('div', {class: 'ae-row'}, h('button', {class: 'ae-btn ae-wide', type: 'button', onclick: () => { close(); openNews(); }}, 'Все обновления'),
            h('button', {class: 'ae-btn ae-primary ae-wide', type: 'button', onclick: close}, long ? 'В бой!' : 'Отлично')))));
    root.addEventListener('click', e => { const c = e.target.closest('.ae-copy'); if (!c) return; navigator.clipboard?.writeText(c.textContent).then(() => toast('Промокод скопирован: ' + c.textContent), () => toast(c.textContent)); });
    document.body.append(root); sfx.play('bell');
  }
  setTimeout(async () => {
    if (!uid()) return;
    const lastVisit = Number(localStorage.getItem(visitKey()) || 0), now = Date.now();
    const awayDays = lastVisit ? Math.floor((now - lastVisit) / DAY_MS) : 0;
    localStorage.setItem(visitKey(), String(now)); setInterval(() => localStorage.setItem(visitKey(), String(Date.now())), 60000);
    await loadNews(); paintNewsBadges();
    if (!newsCache?.length) return;
    const seen = localStorage.getItem(newsSeenKey());
    // A brand-new player: no window over the tutorial, just mark everything as read.
    if (!lastVisit && !seen) { localStorage.setItem(newsSeenKey(), newsCache[0].at); paintNewsBadges(); return; }
    const hasUnread = newsCache[0].at > (seen || '');
    if (!hasUnread && awayDays < 7) return;
    // Wait for a calm moment: no battle, journey, open panel or story scene.
    const tryShow = () => {
      const busy = document.documentElement.hasAttribute('data-in-combat') || me()?.worldJourney || openPanelState || document.querySelector('.ae-story, .fantasy-travel-overlay, .world-travel-overlay, .game-dialog-backdrop');
      if (busy) return setTimeout(tryShow, 3000);
      showWelcome(newsCache, awayDays);
    };
    tryShow();
  }, 7000);
  // ---------- admin: player analytics ----------
  function adminStatsBlock() {
    return h('section', {class: 'ae-admin-premium', 'data-ae-admin-stats': '1'}, h('h3', {}, '📊 Аналитика игроков'),
      h('p', {class: 'ae-sub'}, 'Активность по дням, возвраты новичков, популярные разделы и где игроки бросают игру.'),
      h('button', {class: 'ae-btn ae-primary ae-wide', type: 'button', onclick: () => openAdminStats()}, 'Открыть аналитику'));
  }
  function openAdminStats() {
    let d = null, err = '';
    const st = openPanel('📊 Аналитика', body => {
      if (err) return body.append(h('p', {class: 'ae-empty'}, err));
      if (!d) return body.append(h('p', {class: 'ae-empty'}, 'Считаю…'));
      const pct = r => r?.pct == null ? '—' : r.pct + '%';
      const tile = (v, l, sub) => h('div', {class: 'ae-stat'}, h('b', {}, String(v)), h('span', {}, l), sub ? h('small', {}, sub) : '');
      body.append(h('div', {class: 'ae-stat-grid'}, tile(d.dau, 'Сегодня', 'игроков'), tile(d.wau, 'За 7 дней'), tile(d.mau, 'За 30 дней'), tile(d.total, 'Всего героев')));
      body.append(h('h3', {class: 'ae-h3'}, 'Возвращаются ли новички'));
      body.append(h('div', {class: 'ae-stat-grid'}, tile(pct(d.retention.d1), 'На 2-й день', `из ${d.retention.d1.base}`), tile(pct(d.retention.d3), 'На 4-й день', `из ${d.retention.d3.base}`), tile(pct(d.retention.d7), 'На 8-й день', `из ${d.retention.d7.base}`)));
      body.append(h('p', {class: 'ae-sub'}, 'Доля игроков, зарегистрированных за последние 30 дней, которые зашли снова через 1, 3 и 7 дней.'));
      body.append(h('h3', {class: 'ae-h3'}, 'Игроки по дням (14 дней)'));
      const max = Math.max(1, ...d.daily.map(x => x.dau));
      body.append(h('div', {class: 'ae-chart'}, d.daily.map(x => h('div', {class: 'ae-chart-col', title: `${x.day}: ${x.dau} игроков, ${x.new} новых`},
        h('span', {class: 'ae-chart-v'}, x.dau ? String(x.dau) : ''), h('i', {style: `height:${Math.round(100 * x.dau / max)}%`}, h('em', {style: `height:${x.dau ? Math.round(100 * x.new / x.dau) : 0}%`})), h('small', {}, x.day.slice(8))))));
      body.append(h('p', {class: 'ae-sub'}, 'Высота столбца — все игроки дня, светлая часть — новички.'));
      body.append(h('h3', {class: 'ae-h3'}, 'Популярные разделы (7 дней)'));
      if (!d.sections.length) body.append(h('p', {class: 'ae-empty'}, 'Данные начнут копиться после обновления.'));
      const smax = Math.max(1, ...d.sections.map(x => x.users));
      for (const x of d.sections) body.append(h('div', {class: 'ae-hbar'}, h('span', {}, x.s), h('i', {style: `width:${Math.round(100 * x.users / smax)}%`}), h('b', {}, `${x.users} чел · ${x.n}`)));
      body.append(h('h3', {class: 'ae-h3'}, `Где бросают игру (${d.quit.n} не заходят 3+ дня)`));
      if (!d.quit.list.length) body.append(h('p', {class: 'ae-empty'}, 'Пока таких нет.'));
      const qmax = Math.max(1, ...d.quit.list.map(x => x.n));
      for (const x of d.quit.list) body.append(h('div', {class: 'ae-hbar is-quit'}, h('span', {}, x.k), h('i', {style: `width:${Math.round(100 * x.n / qmax)}%`}), h('b', {}, String(x.n))));
      body.append(h('p', {class: 'ae-sub'}, 'Последний экран игры и уровень героя у тех, кто перестал заходить.'));
      body.append(h('div', {class: 'ae-pill'}, `🤖 Запустили бота: ${d.botUsers} · уведомления включены: ${d.notifyOn}`));
      if (d.storage) { const sg = d.storage;
        body.append(h('div', {class: 'ae-card' + (sg.pct >= 70 ? ' ae-storage-warn' : '')}, h('b', {}, `${sg.pct >= 85 ? '🔴' : sg.pct >= 70 ? '🟠' : '🟢'} Хранилище игры: ${sg.pct}% (${fmt(sg.storedKb)} из ${fmt(sg.limitKb)} КБ)`),
          h('div', {class: 'ae-bar'}, h('i', {style: `width:${Math.min(100, sg.pct)}%`}), h('span', {}, `данные без сжатия: ${fmt(sg.rawKb)} КБ`)),
          h('div', {class: 'ae-sub'}, 'Самые большие таблицы: ' + sg.tables.map(t => `${t.k} — ${t.kb} КБ (${t.n})`).join(' · ')),
          sg.pct >= 70 ? h('div', {class: 'ae-sub'}, '⚠️ Места остаётся мало: при 100% игра перестанет сохраняться. Нужна чистка старых данных.') : '')); }
    });
    api('/api/ae-admin/stats').then(r => { d = r; }, e => { err = cleanError(e); }).finally(() => { if (openPanelState === st) st.rerender(); });
  }
  function adminNewsBlock() {
    let editId = null;
    const title = h('input', {class: 'ae-input', placeholder: 'Заголовок, например: Обновление: связки в коопе', maxlength: 120});
    const text = h('textarea', {class: 'ae-input ae-news-input', rows: 8, placeholder: 'Текст поста (как в канале). **жирный**, `ПРОМОКОД`'});
    const toChannel = h('input', {type: 'checkbox', checked: true});
    const mode = h('div', {class: 'ae-sub'}), go = h('button', {class: 'ae-btn ae-primary ae-wide', type: 'button'}, 'Опубликовать'), cancel = h('button', {class: 'ae-btn ae-wide', type: 'button', style: 'display:none'}, 'Отменить правку');
    const list = h('div', {class: 'ae-admin-list'});
    const chMsg = c => c === 'sent' ? ' и в канале' : c === 'edited' ? ', в канале тоже изменено' : c === 'deleted' ? ', из канала тоже удалено' : c === 'not-in-channel' ? ' (в канале этого поста нет — правьте там вручную)' : c ? ` (канал: ${String(c).replace(/^failed: /, '')})` : '';
    const setEdit = post => { editId = post?.id || null; title.value = post?.title || ''; text.value = post?.text || '';
      mode.textContent = post ? `✏️ Правка поста «${post.title}»${post.inChannel ? ' — изменится и в канале' : ''}` : ''; go.textContent = post ? 'Сохранить изменения' : 'Опубликовать'; cancel.style.display = post ? '' : 'none';
      toChannel.checked = true; toChannel.parentElement && (toChannel.parentElement.style.display = post?.inChannel ? 'none' : ''); if (post) title.scrollIntoView({behavior: 'smooth', block: 'center'}); };
    const load = async () => { try { const r = await api('/api/admin/news'); list.replaceChildren(...(r.posts || []).map(p => h('div', {class: 'ae-row ae-card'},
      h('div', {class: 'ae-grow'}, h('b', {}, p.title), h('div', {class: 'ae-sub'}, `${new Date(p.at).toLocaleDateString('ru-RU')}${p.inChannel ? ' · 📣 в канале' : ''}`)),
      h('button', {class: 'ae-btn', type: 'button', title: 'Изменить', onclick: () => setEdit(p)}, '✏️'),
      h('button', {class: 'ae-btn', type: 'button', title: 'Удалить', onclick: async () => { if (!confirm(`Удалить «${p.title}»${p.inChannel ? ' — и из канала' : ''}?`)) return;
        try { const r2 = await api('/api/admin/news', 'DELETE', {id: p.id}); toast('Удалено из игры' + chMsg(r2.channel)); if (editId === p.id) setEdit(null); await load(); await loadNews(); paintNewsBadges(); } catch (e) { toast(cleanError(e)); } }}, '🗑')))); } catch {} };
    go.onclick = async () => {
      if (!title.value.trim() || text.value.trim().length < 10) return toast('Заполните заголовок и текст.');
      if (!confirm(editId ? 'Сохранить изменения поста?' : 'Опубликовать новость в игре' + (toChannel.checked ? ' и в канале' : '') + '?')) return;
      try { const r = await api('/api/admin/news', 'POST', {title: title.value, text: text.value, toChannel: toChannel.checked, editId: editId || undefined, operationId: editId ? undefined : uuid4()});
        toast((editId ? 'Изменено в игре' : 'Опубликовано в игре') + chMsg(r.channel)); setEdit(null); await load(); await loadNews(); paintNewsBadges(); }
      catch (e) { toast(cleanError(e)); }
    };
    cancel.onclick = () => setEdit(null);
    load();
    return h('section', {class: 'ae-admin-premium', 'data-ae-admin-news': '1'}, h('div', {class: 'ae-h3'}, '📰 Новости («Что нового»)'), h('div', {class: 'ae-sub'}, 'Текст появится в меню «Что нового» у всех игроков. Правка и удаление поста меняют его и в канале.'),
      mode, title, text, h('label', {class: 'ae-row ae-sub'}, toChannel, ' Отправить и в канал t.me/Aethelgardo'), go, cancel, h('div', {class: 'ae-h3'}, 'Опубликованные'), list);
  }
  // ---------- one battle screen for every add-on fight: a copy of the game's own monster-combat markup ----------
  // Same classes as the native combat screen, so each interface style (fantasy / modern) dresses it exactly the same way.
  const isModern = () => document.documentElement.getAttribute('data-interface') === 'modern';
  const pctOf = (a, b) => Math.max(0, Math.min(100, 100 * (Number(a) || 0) / Math.max(1, Number(b) || 1)));
  const ICON = k => `<span class="inline-flex items-center justify-center shrink-0 text-[#a48b60]" aria-hidden="true"><img alt="" aria-hidden="true" width="20" height="20" draggable="false" class="block shrink-0 object-contain" src="/assets/sprites/generated/ui/icons/${k}.webp"></span>`;
  const KIND_ICON = {attack: 'attack', skill: 'skill', defend: 'defend', potion: 'potion'};
  const LUCIDE = {attack: '<polyline points="14.5 17.5 3 6 3 3 6 3 17.5 14.5"></polyline><line x1="13" x2="19" y1="19" y2="13"></line><line x1="16" x2="20" y1="16" y2="20"></line><line x1="19" x2="21" y1="21" y2="19"></line><polyline points="14.5 6.5 18 3 21 3 21 6 17.5 9.5"></polyline><line x1="5" x2="9" y1="14" y2="18"></line><line x1="7" x2="4" y1="17" y2="20"></line><line x1="3" x2="5" y1="19" y2="21"></line>',
    skill: '<path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"></path>',
    defend: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"></path>',
    potion: '<path d="M2 9.5a5.5 5.5 0 0 1 9.591-3.676.56.56 0 0 0 .818 0A5.49 5.49 0 0 1 22 9.5c0 2.29-1.5 4-3 5.5l-5.492 5.313a2 2 0 0 1-3 .019L5 15c-1.5-1.5-3-3.2-3-5.5"></path>',
    leave: '<path d="M4 16v-2.38C4 11.5 2.97 10.5 3 8c.03-2.72 1.49-6 4.5-6C9.37 2 10 3.8 10 5.5c0 3.11-2 5.66-2 8.68V16a2 2 0 1 1-4 0Z"></path><path d="M20 20v-2.38c0-2.12 1.03-3.12 1-5.62-.03-2.72-1.49-6-4.5-6C14.63 6 14 7.8 14 9.5c0 3.11 2 5.66 2 8.68V20a2 2 0 1 0 4 0Z"></path>',
    play: '<path d="M5 5a2 2 0 0 1 3.008-1.728l11.997 6.998a2 2 0 0 1 .003 3.458l-12 7A2 2 0 0 1 5 19z"></path>'};
  const lucide = (k, cls) => `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="${cls}" aria-hidden="true">${LUCIDE[k] || LUCIDE.attack}</svg>`;
  // o: {location, mode, round, scene, turn, hero:{name,cls,level,hp,maxHp,mp,maxMp,portrait,body}, foe:{name,level,hp,maxHp,atk,def,img,tint}, note, intent:{name,text,value},
  //     series:{label,value,sub}, actions:[{kind,label,onClick,disabled,attr}], secondary:[{label,onClick,auto,on,attr}], log:[], extra:Node|null, extraTop:Node|null}
  // The active companion next to the hero, exactly as in the field fight.
  const PET_SPOT = {pet_wolf: 'feet', pet_golem: 'feet', pet_dragon: 'shoulder', pet_fairy: 'shoulder', pet_voidling: 'shoulder'};
  const petArt = compact => { const pet = me()?.activePet; return pet && PET_SPOT[pet.id] ? `<span class="combat-companion at-${PET_SPOT[pet.id]}${compact ? ' is-compact' : ''}"><img alt="" draggable="false" src="/assets/sprites/generated/pets/combat/${esc(pet.id)}.webp" onerror="this.parentNode.remove()"></span>` : ''; };
  function battleView(o) {
    const E = esc, hero = o.hero, foe = o.foe, root = document.createElement('div'); root.className = 'ae-bv ' + (isModern() ? 'modern-shell' : 'shell-main');
    const handlers = [];
    const on = fn => { handlers.push(fn); return `data-bv="${handlers.length - 1}"`; };
    const attrs = a => a ? Object.entries(a).map(([k, v]) => `${k}="${E(v)}"`).join(' ') : '';
    const logRows = (o.log || []).slice(-12).reverse();
    if (!isModern()) {
      root.innerHTML = `<div class="folio-page fantasy-combat-page classic-fantasy-surface space-y-3 pt-3">
<section class="bestiary-panel combat-hero-plaque grid grid-cols-[52px_minmax(0,1fr)] items-center gap-2.5 p-2"><div class="relative h-[58px] w-[52px] overflow-hidden rounded-md border bg-[#0d1012] border-[#a98951]"><img alt="" class="h-full w-full object-cover object-top" src="${E(hero.portrait)}"></div><div class="min-w-0"><div class="mb-1.5 flex items-center justify-between gap-2"><span class="truncate text-xs font-semibold text-[#e1d5c0]">${E(hero.name)} · ${E(hero.cls)}</span><span class="shrink-0 font-mono text-[11px] text-[#d2b676]">Ур. ${E(hero.level)}</span></div><span role="status" class="combat-turn-label mb-1 block text-[11px] font-semibold text-[#d5ba89]">${E(o.turn || 'Ваш ход — выберите действие')}</span><div class="mb-1.5"><div class="mb-1 flex items-center justify-between gap-2 text-[11px] tabular-nums"><span class="text-[#918c82]">HP</span><span class="text-[#d8d1c4]">${fmt(hero.hp)}/${fmt(hero.maxHp)}</span></div><div role="progressbar" class="progress-track h-2"><div class="progress-fill is-hp" style="width:${pctOf(hero.hp, hero.maxHp)}%"></div></div></div>${hero.maxMp ? `<div><div class="mb-1 flex items-center justify-between gap-2 text-[11px] tabular-nums"><span class="text-[#918c82]">${E(hero.mpLabel || 'MANA')}</span><span class="text-[#d8d1c4]">${fmt(hero.mp)}/${fmt(hero.maxMp)}</span></div><div role="progressbar" class="progress-track h-2"><div class="progress-fill is-mana" style="width:${pctOf(hero.mp, hero.maxMp)}%"></div></div></div>` : ''}</div></section>
<div data-bv-extra-top></div>
<section class="combat-scene relative isolate flex min-h-[334px] flex-col overflow-hidden rounded-2xl border border-[#756344] bg-[#090b0d] p-3 sm:min-h-[390px]"><div class="absolute inset-0 -z-20"><div aria-hidden="true" class="absolute inset-0 pointer-events-none"><img alt="" class="h-full w-full object-cover object-center" src="${E(o.scene)}"><div class="absolute inset-0 bg-gradient-to-b from-slate-950/55 via-transparent to-slate-950/55"></div></div></div><div class="combat-scene-shade absolute inset-0 -z-10"></div><div class="combat-scene-header relative z-10 flex items-center justify-between gap-2 pb-2 text-[11px]"><span class="truncate font-semibold text-[#e0d2b7]">${E(o.location)}</span><div class="flex shrink-0 items-center gap-2"><span class="truncate text-[#b4aea2]">${E(o.mode || '')}</span><span class="combat-round">${E(o.round || '')}</span></div></div>
<div class="combat-player-art" data-bv-hero><div><div class="combat-player-breathe"><img alt="" class="h-full w-full object-contain object-bottom" src="${E(hero.body)}"></div></div>${petArt(false)}</div>
${foe ? `<div class="combat-monster-art pointer-events-none absolute right-0 top-9 z-0 flex h-[240px] w-[55%] items-end justify-end overflow-hidden sm:h-[292px] sm:w-[55%]" data-bv-foe><img alt="" class="h-full w-full object-contain object-right-bottom" style="${foe.mirror ? 'transform:scaleX(-1)' : ''}" src="${E(foe.img)}"></div>
<div class="combat-enemy-plaque relative z-10 mt-auto pb-1 ml-[25%] max-w-[75%]"><div class="mb-1 flex items-center gap-2"><span class="text-[11px] uppercase tracking-[.12em] text-[#c2b9a8]">${E(foe.level)}</span></div><h1 class="folio-title break-words text-xl font-bold leading-tight sm:text-2xl">${E(foe.name)}</h1><div class="mt-3 max-w-sm"><div class="mb-1 flex items-center justify-between gap-2 text-[11px] tabular-nums"><span class="text-[#918c82]">Здоровье противника</span><span class="text-[#d8d1c4]">${fmt(foe.hp)}/${fmt(foe.maxHp)}</span></div><div role="progressbar" class="progress-track h-2"><div class="progress-fill is-hp" style="width:${pctOf(foe.hp, foe.maxHp)}%"></div></div></div>${foe.atk != null ? `<div class="mt-2 flex items-center gap-3 text-[11px] text-[#d0c8b9]"><span class="inline-flex items-center gap-1">${ICON('attack').replace('width="20" height="20"', 'width="14" height="14"')}${fmt(foe.atk)}</span>${foe.def != null ? `<span class="inline-flex items-center gap-1">${ICON('defend').replace('width="20" height="20"', 'width="14" height="14"')}${fmt(foe.def)}</span>` : ''}</div>` : ''}</div>` : ''}
</section>
<div class="combat-command-center space-y-2">${o.note ? `<p role="status" class="bestiary-panel px-3 py-2 text-xs leading-relaxed text-[#d8d1c4]">${E(o.note)}</p>` : ''}${o.intent ? `<details class="bestiary-panel overflow-hidden" open><summary class="flex min-h-11 cursor-pointer list-none items-center gap-2 px-3 text-xs">${ICON('skill').replace('width="20" height="20"', 'width="17" height="17"')}<span class="min-w-0 flex-1"><span class="mr-1 text-[11px] text-[#918c82]">${E(o.intent.label || 'Возможный приём:')}</span><strong class="text-[#d8d1c4]">${E(o.intent.name)}</strong>${o.intent.text ? `<span class="mt-1 block text-[11px] leading-relaxed text-[#aaa49a]">${E(o.intent.text)}</span>` : ''}</span>${o.intent.value ? `<span class="shrink-0 font-mono text-[11px] text-[#d28f89]">${E(o.intent.value)}</span>` : ''}</summary></details>` : ''}${o.series ? `<div class="bestiary-panel flex min-h-8 items-center justify-between gap-3 px-3 py-1 text-[11px]"><span class="flex items-center gap-1.5 font-bold text-[#d1ad67]">${ICON('hunt').replace('width="20" height="20"', 'width="14" height="14"')}${E(o.series.label)}</span><span class="font-mono text-[#c5c0b6]">${E(o.series.value)}</span></div>` : ''}
<div class="space-y-2 transition-all opacity-100"><div class="combat-action-grid grid grid-cols-2 gap-2">${(o.actions || []).map(a => `<button ${on(a.onClick)} ${attrs(a.attr)} ${a.disabled ? 'disabled' : ''} class="combat-action combat-action-${a.kind} rpg-button ${a.kind === 'attack' ? 'rpg-button-primary' : 'rpg-button-secondary'} min-h-[76px] flex-col text-xs ${a.cls || ''}">${ICON(KIND_ICON[a.kind] || 'skill')}<span>${E(a.label)}</span>${a.sub ? `<small class="ae-bv-sub">${E(a.sub)}</small>` : ''}${a.cdSlot ? '<i class="ae-act-cd"></i>' : ''}</button>`).join('')}</div>
<div class="combat-secondary-actions flex gap-2">${(o.secondary || []).map(s => s.auto ? `<button ${on(s.onClick)} ${attrs(s.attr)} class="combat-auto-toggle pointer-events-auto inline-flex min-h-11 flex-1 justify-center items-center gap-1.5 rounded-md border px-2.5 text-[10px] font-bold transition-colors ${s.on ? 'border-[#c3a775] bg-[#3a2f1c] text-[#f0d79a]' : 'border-[#414345] bg-[#202428] text-[#c8c2b8]'} hover:text-white">${ICON('settings').replace('width="20" height="20"', 'width="15" height="15"')}<span>${E(s.label)}</span></button>` : `<button ${on(s.onClick)} ${attrs(s.attr)} ${s.disabled ? 'disabled' : ''} class="rpg-button rpg-button-secondary min-h-11 flex-1 text-xs text-[#aaa49a] ae-bv-sec">${E(s.label)}${s.cdSlot ? '<i class="ae-act-cd"></i>' : ''}</button>`).join('')}</div></div></div>
<div data-bv-extra></div>
<details class="bestiary-panel overflow-hidden" open><summary class="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-3 text-xs font-semibold text-[#cfc6b7]"><span class="flex items-center gap-2">${ICON('bestiary').replace('width="20" height="20"', 'width="17" height="17"')}Летопись боя</span><span class="font-mono text-[11px] text-[#918c82]">${(o.log || []).length} записей</span></summary><div class="max-h-40 space-y-1 overflow-y-auto border-t border-[#343638] px-3 py-2 text-xs">${logRows.map(l => `<div class="flex items-start gap-1.5 font-mono text-[11px] leading-snug"><span class="combat-ink">${E(l)}</span></div>`).join('')}</div></details></div>`;
    } else {
      const acts = o.actions || [];
      const mainActs = acts.slice(0, 3), restActs = acts.slice(3);
      const mainBtn = a => a.kind === 'defend' || a.kind === 'potion'
        ? `<button ${on(a.onClick)} ${attrs(a.attr)} ${a.disabled ? 'disabled' : ''} class="py-3 px-2 rounded-xl bg-gradient-to-b from-slate-800 to-slate-900 hover:from-slate-700 hover:to-slate-800 text-slate-200 font-cinzel font-bold text-xs flex flex-col items-center justify-center gap-1 active:scale-95 transition-all border border-slate-700 ${a.cls || ''}">${lucide(a.kind, 'lucide w-4 h-4 text-slate-300')}<span>${E(a.label)}</span>${a.sub ? `<small class="ae-bv-sub">${E(a.sub)}</small>` : ''}${a.cdSlot ? '<i class="ae-act-cd"></i>' : ''}</button>`
        : `<button ${on(a.onClick)} ${attrs(a.attr)} ${a.disabled ? 'disabled' : ''} class="ui-primary py-3 px-2 rounded-xl font-cinzel font-bold text-xs flex flex-col items-center justify-center gap-1 active:scale-95 transition-all border ${a.kind === 'attack' ? 'border-cyan-400/40' : 'border-indigo-400/40'} ${a.cls || ''}">${lucide(a.kind, `lucide w-4 h-4 ${a.kind === 'attack' ? 'text-cyan-200' : 'text-indigo-200'}`)}<span>${E(a.label)}</span>${a.sub ? `<small class="ae-bv-sub">${E(a.sub)}</small>` : ''}${a.cdSlot ? '<i class="ae-act-cd"></i>' : ''}</button>`;
      const smallBtn = a => a.kind === 'potion'
        ? `<button ${on(a.onClick)} ${attrs(a.attr)} ${a.disabled ? 'disabled' : ''} class="py-2 px-2 rounded-xl border text-xs font-medium flex items-center justify-center gap-1.5 transition-all bg-emerald-950/60 border-emerald-500/50 text-emerald-200 active:scale-95 ${a.cls || ''}">${lucide('potion', 'lucide w-3.5 h-3.5 text-emerald-400')}<span>${E(a.label)}</span>${a.cdSlot ? '<i class="ae-act-cd"></i>' : ''}</button>`
        : `<button ${on(a.onClick)} ${attrs(a.attr)} ${a.disabled ? 'disabled' : ''} class="py-2 px-2 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 text-slate-300 text-xs font-medium flex items-center justify-center gap-1.5 active:scale-95 transition-all ${a.cls || ''}">${lucide(a.kind === 'leave' ? 'leave' : a.kind, 'lucide w-3.5 h-3.5 text-slate-400')}<span>${E(a.label)}</span>${a.cdSlot ? '<i class="ae-act-cd"></i>' : ''}</button>`;
      const auto = (o.secondary || []).find(s => s.auto), others = (o.secondary || []).filter(s => !s.auto);
      root.innerHTML = `<div class="p-3 space-y-3 max-w-lg mx-auto pb-24"><div data-bv-extra-top></div>
<div class="relative rounded-2xl overflow-hidden border border-slate-700/60 bg-[#070b14] h-[33vh] min-h-[220px] max-h-[300px] flex flex-col justify-between p-3 select-none"><div aria-hidden="true" class="absolute inset-0 pointer-events-none"><img alt="" class="h-full w-full object-cover object-center" src="${E(o.scene)}"><div class="absolute inset-0 bg-gradient-to-b from-slate-950/55 via-transparent to-slate-950/55"></div></div>
<div class="relative z-10 flex items-center justify-between text-[11px] font-mono border-b border-slate-800/80 pb-1.5"><div class="flex items-center gap-1.5 text-cyan-300"><span class="font-bold truncate max-w-[120px]">${E(o.location)}</span><span class="text-slate-600">·</span><span class="text-amber-300 text-[10px]">${o.mode ? '[' + E(o.mode) + ']' : ''}</span></div><div class="flex items-center gap-2"><span class="text-slate-400 text-[10px]">${E(o.round || '')}</span><div class="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider flex items-center gap-1 border transition-all bg-cyan-950/90 border-cyan-400/80 text-cyan-300 shadow-sm"><span>${E(o.turn || 'Ваш ход')}</span></div></div></div>
<div class="relative z-10 flex-1 grid grid-cols-5 items-center gap-2 py-1"><div class="col-span-2 flex flex-col items-center justify-center p-2 rounded-xl transition-all duration-300 ring-1 ring-[#c3a775] bg-slate-950/55" data-bv-hero><div class="relative"><div class="relative w-20 h-20 sm:w-24 sm:h-24 rounded-xl overflow-hidden border-2 border-cyan-400/60 shadow-md bg-slate-950"><img alt="" class="w-full h-full object-cover object-top" src="${E(hero.portrait)}"><span class="absolute bottom-0 inset-x-0 bg-slate-950/90 text-center text-[9px] font-mono text-cyan-300 py-0.5 truncate px-1">${E(hero.cls)}</span><span class="absolute top-1 left-1 w-2 h-2 rounded-full bg-cyan-400 shadow-sm"></span></div>${petArt(true)}</div><div class="w-full mt-1.5 text-center"><div class="flex items-center justify-between text-[11px] font-mono leading-none"><span class="font-bold text-slate-200 truncate max-w-[70px]">${E(hero.name)}</span><span class="text-cyan-400 font-bold text-[10px]">Ур. ${E(hero.level)}</span></div><div class="mt-1"><div class="flex justify-between text-[9px] font-mono text-emerald-400"><span class="font-bold">HP</span><span class="tabular-nums">${fmt(hero.hp)}/${fmt(hero.maxHp)}</span></div><div class="h-1.5 bg-slate-950 rounded-full overflow-hidden border border-emerald-950 mt-0.5"><div class="h-full bg-gradient-to-r from-emerald-500 to-cyan-400 transition-all duration-300 rounded-full" style="width:${pctOf(hero.hp, hero.maxHp)}%"></div></div></div>${hero.maxMp ? `<div class="mt-0.5"><div class="flex justify-between text-[9px] font-mono text-indigo-400"><span class="font-bold">${E(hero.mpLabel || 'MP')}</span><span class="tabular-nums">${fmt(hero.mp)}/${fmt(hero.maxMp)}</span></div><div class="h-1 bg-slate-950 rounded-full overflow-hidden border border-indigo-950"><div class="h-full bg-gradient-to-r from-indigo-500 to-purple-400 transition-all duration-300 rounded-full" style="width:${pctOf(hero.mp, hero.maxMp)}%"></div></div></div>` : ''}</div></div>
<div class="col-span-1 flex flex-col items-center justify-center"><div class="w-9 h-9 rounded-full flex items-center justify-center font-cinzel font-bold text-xs transition-all bg-[#302c24] text-[#d5ba89] border border-[#9d8459]">VS</div><div class="mt-1 text-center"><span class="text-[9px] font-mono font-bold block text-cyan-300">Вы</span></div></div>
${foe ? `<div class="col-span-2 flex flex-col items-center justify-center p-2 rounded-xl transition-all duration-300 opacity-90 bg-slate-900/40" data-bv-foe><div class="relative flex items-center justify-center w-20 h-20 sm:w-24 sm:h-24 rounded-xl overflow-hidden border-2 border-red-500/60 shadow-md bg-red-950/40"><img alt="" class="w-full h-full object-cover" src="${E(foe.img)}"><span class="absolute bottom-0 inset-x-0 bg-slate-950/90 text-center text-[9px] font-mono text-red-300 py-0.5 truncate px-1">${E(foe.name)}</span></div><div class="w-full mt-1.5 text-center"><div class="flex items-center justify-between text-[11px] font-mono leading-none"><span class="font-bold text-slate-200 truncate max-w-[70px]">${E(foe.name)}</span><span class="text-red-400 font-bold text-[10px]">${E(foe.level)}</span></div><div class="mt-1"><div class="flex justify-between text-[9px] font-mono text-red-400"><span class="font-bold">HP</span><span class="tabular-nums">${fmt(foe.hp)}/${fmt(foe.maxHp)}</span></div><div class="h-1.5 bg-slate-950 rounded-full overflow-hidden border border-red-950 mt-0.5"><div class="h-full bg-gradient-to-r from-red-600 via-rose-500 to-amber-400 transition-all duration-300 rounded-full" style="width:${pctOf(foe.hp, foe.maxHp)}%"></div></div></div>${foe.atk != null ? `<div class="mt-1 flex items-center justify-between text-[9px] font-mono text-slate-400"><span>⚔️ ${fmt(foe.atk)}</span>${foe.def != null ? `<span>🛡️ ${fmt(foe.def)}</span>` : ''}</div>` : ''}</div></div>` : ''}</div></div>
<div class="space-y-2"><div class="p-2.5 rounded-xl border flex items-center justify-between text-xs font-mono transition-all bg-[#252620] border-[#9d8459] text-[#d5ba89]"><div class="flex items-center gap-2"><span class="w-2 h-2 rounded-full bg-[#c3a775]"></span><span class="font-semibold">${E(o.turnShort || 'Ваш ход')}</span></div>${auto ? `<button ${on(auto.onClick)} class="px-2.5 py-1 rounded text-[11px] font-bold flex items-center gap-1.5 transition-colors ${auto.on ? 'bg-cyan-900 text-cyan-100' : 'bg-slate-800 text-slate-300'} hover:text-white">${lucide('play', 'lucide w-3.5 h-3.5')}<span>${E(auto.label)}</span></button>` : ''}</div>
${o.note ? `<p role="status" class="rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-2 text-xs leading-relaxed text-slate-200">${E(o.note)}</p>` : ''}
${o.intent ? `<div class="rounded-xl border border-amber-500/40 bg-amber-950/30 p-2.5"><div class="flex items-center gap-2 text-amber-200 text-xs font-bold"><span>${E(o.intent.label || 'Возможный приём врага')}</span>${o.intent.value ? `<span class="ml-auto text-[10px] text-slate-400">${E(o.intent.value)}</span>` : ''}</div><div class="mt-1 flex items-center gap-2 text-[11px] font-mono"><span class="text-slate-100 font-bold">${E(o.intent.name)}</span></div>${o.intent.text ? `<div class="mt-1 text-[10px] text-slate-400"><p>${E(o.intent.text)}</p></div>` : ''}</div>` : ''}
${o.series ? `<div class="mb-2.5 rounded-xl border border-amber-500/30 bg-amber-950/20 p-2.5"><div class="flex items-center justify-between text-[11px] font-mono"><span class="text-amber-300 font-bold">🔥 ${E(o.series.label)}</span><span class="text-slate-300">${E(o.series.value)}</span></div>${o.series.sub ? `<div class="mt-1 text-[10px] text-slate-400">${E(o.series.sub)}</div>` : ''}</div>` : ''}
<div class="space-y-2 transition-all opacity-100"><div class="grid grid-cols-3 gap-2">${mainActs.map(mainBtn).join('')}</div><div class="grid grid-cols-3 gap-2">${[...restActs.map(smallBtn), ...others.map(s => smallBtn({kind: s.kind || 'leave', label: s.label, onClick: s.onClick, disabled: s.disabled, attr: s.attr, cdSlot: s.cdSlot}))].join('')}</div></div></div>
<div data-bv-extra></div>
<div class="rounded-xl border border-slate-800 bg-[#070a12] p-2.5 h-36 flex flex-col"><div class="text-[10px] font-mono text-slate-400 uppercase tracking-wider mb-1 flex items-center justify-between border-b border-slate-800/80 pb-1"><span>Журнал пошагового сражения</span><span>${(o.log || []).length} записей</span></div><div class="flex-1 overflow-y-auto space-y-1 text-xs pr-1">${logRows.map(l => `<div class="leading-snug flex items-start gap-1.5 font-mono text-[11px]"><span class="text-slate-300">${E(l)}</span></div>`).join('')}</div></div>
${(() => { const st = B()?.stats; return st ? `<div class="p-2.5 rounded-xl bg-[#090e1a] border border-cyan-500/20 text-[10px] font-mono flex items-center justify-between text-slate-300"><span>🩸 Вампиризм: <strong class="text-rose-400">+${fmt(st.vampirism || 0)}%</strong></span><span>⚔️ Пробитие: <strong class="text-amber-300">${fmt(st.armorPenetration || 0)}</strong></span><span>🛡️ Броня: <strong class="text-slate-200">${fmt(st.defense || 0)}</strong></span><span>💨 Уклон: <strong class="text-indigo-300">${fmt(st.evasion || 0)}%</strong></span><span>🎯 Крит: <strong class="text-cyan-300">${fmt(st.critChance || 0)}%</strong></span></div>` : ''; })()}</div>`;
    }
    root.querySelectorAll('[data-bv]').forEach(b => { const fn = handlers[Number(b.getAttribute('data-bv'))]; if (fn) b.addEventListener('click', e => { e.preventDefault(); if (!b.disabled) fn(e); }); });
    if (o.menu) root.querySelector('.space-y-2.transition-all')?.append(o.menu);
    if (o.extra) root.querySelector('[data-bv-extra]')?.append(o.extra);
    if (o.extraTop) root.querySelector('[data-bv-extra-top]')?.append(o.extraTop);
    return root;
  }
  // Full-screen battle mode for an add-on panel: hides the panel frame so the copy looks like the game's own screen.
  const battleMode = (body, on) => {
    const p = body.closest('.ae-panel'), b = body.closest('.ae-backdrop'); if (!p) return;
    p.classList.toggle('ae-battle-mode', !!on); b?.classList.toggle('ae-battle-backdrop', !!on);
    if (on && b) { const hd = isModern() ? document.querySelector('header.game-header') : null, nav = document.querySelector('nav.game-nav');
      const z = pageZoom(); // measured on screen, applied inside the zoomed page
      b.style.setProperty('--bv-top', (hd ? Math.max(0, Math.round(hd.getBoundingClientRect().bottom / z)) : 0) + 'px'); b.style.setProperty('--bv-nav', (nav ? Math.round(nav.getBoundingClientRect().height / z) : 0) + 'px'); }
    // First frame of a fight: bring the action buttons above the bottom nav (the field fight needs a manual scroll here).
    if (on && !p.dataset.bvScrolled) { p.dataset.bvScrolled = '1'; requestAnimationFrame(() => { const row = body.querySelector('.combat-secondary-actions') || [...body.querySelectorAll('.grid.grid-cols-3')].pop(); if (!row) return;
      const nav = document.querySelector('nav.game-nav'), limit = (nav ? nav.getBoundingClientRect().top : innerHeight) - 8, over = row.getBoundingClientRect().bottom - limit; if (over > 0) body.scrollTop += over / pageZoom(); }); }
    if (!on) delete p.dataset.bvScrolled;
    if (on && !p.dataset.bvBg) { const shell = document.querySelector('.game-shell') || document.body, cs = getComputedStyle(shell); p.dataset.bvBg = '1'; p.style.setProperty('--bv-bg', cs.backgroundColor && cs.backgroundColor !== 'rgba(0, 0, 0, 0)' ? cs.backgroundColor : '#0b0d10'); p.style.setProperty('--bv-bgi', cs.backgroundImage || 'none'); }
  };
  const heroPortrait = cls => `/assets/sprites/generated/heroes/${cls === 'hunter' ? 'archer' : cls || 'warrior'}.webp`;
  const heroBody = cls => `/assets/sprites/generated/heroes/combat/${cls === 'hunter' ? 'archer' : cls || 'warrior'}.webp`;
  const CLASS_RU2 = {warrior: 'Воин', knight: 'Рыцарь', paladin: 'Паладин', berserker: 'Берсерк', rogue: 'Разбойник', assassin: 'Ассасин', hunter: 'Охотник', archer: 'Лучник', mage: 'Маг', necromancer: 'Некромант', druid: 'Друид'};

  // ---------- «Орда»: fast endless fights, auto-battle without delays, Blood Moon ----------
  const HORDE_COST = 10;
  const untilText = at => { const ms = Math.max(0, Date.parse(at) - Date.now()), d = Math.floor(ms / 864e5), hh = Math.floor(ms % 864e5 / 3600e3), mm = Math.floor(ms % 3600e3 / 60e3);
    return d ? `${d} д ${hh} ч` : hh ? `${hh} ч ${mm} мин` : `${mm} мин`; };
  // ---------- invite a friend: personal link; both get Premium when the friend reaches level 10 ----------
  function openInvite() {
    let d = null, err = '';
    const share = () => {
      const text = 'Присоединяйся ко мне в Аэтельгарде — RPG прямо в Telegram! ⚔️ Охота на монстров, кооп-подземелья, дуэли и Орда. Перейди по ссылке:';
      const link = `https://t.me/share/url?url=${encodeURIComponent(d.url)}&text=${encodeURIComponent(text)}`;
      try { Telegram.WebApp.openTelegramLink(link); } catch { window.open(link, '_blank'); }
      logVisit('Приглашение: поделиться');
    };
    const copy = () => { navigator.clipboard?.writeText(d.url).then(() => toast('Ссылка скопирована'), () => toast(d.url)); logVisit('Приглашение: копировать'); };
    const st = openPanel('🎁 Пригласить друга', body => {
      if (err) return body.append(h('p', {class: 'ae-empty'}, err));
      if (!d) return body.append(h('p', {class: 'ae-empty'}, 'Загрузка…'));
      body.append(h('div', {class: 'ae-invite-hero'}, h('b', {}, `👑 Premium на ${d.rewardDays} дня — вам и другу`),
        h('span', {}, `Отправьте другу свою ссылку. Когда его герой достигнет ${d.requiredLevel} уровня, вы оба получите игровой Premium: автобой, офлайн-добычу и рынок без налога.`)));
      body.append(h('div', {class: 'ae-invite-link'}, h('code', {}, d.url)));
      body.append(h('div', {class: 'ae-row'}, h('button', {class: 'ae-btn ae-primary ae-grow', type: 'button', onclick: share}, '📨 Отправить другу'), h('button', {class: 'ae-btn', type: 'button', onclick: copy}, '📋 Копировать')));
      body.append(h('p', {class: 'ae-sub'}, 'Друг должен впервые открыть игру именно по вашей ссылке. Бот сообщит вам, когда он придёт и когда награда будет начислена.'));
      body.append(h('h3', {class: 'ae-h3'}, `Ваши приглашённые${d.invited.length ? ` (${d.invited.length})` : ''}`));
      if (!d.invited.length) body.append(h('p', {class: 'ae-empty'}, 'Пока никого — самое время позвать друзей!'));
      for (const f of d.invited) body.append(h('div', {class: 'ae-card ae-row ae-invite-row'},
        h('img', {src: heroPortrait(f.classId || 'warrior'), alt: ''}),
        h('div', {class: 'ae-grow'}, h('b', {}, f.name), f.rewarded ? h('div', {class: 'ae-sub ae-good'}, `✅ Награда получена — Premium на ${d.rewardDays} дня`)
          : h('div', {}, h('div', {class: 'ae-bar'}, h('i', {style: `width:${Math.min(100, 100 * f.level / d.requiredLevel)}%`}), h('span', {}, `ур. ${f.level} из ${d.requiredLevel}`))))));
      if (d.count) body.append(h('div', {class: 'ae-pill'}, `🏆 Наград за друзей получено: ${d.count}`));
    });
    api('/api/ae-referrals').then(r => { d = r; }, e => { err = cleanError(e); }).finally(() => { if (openPanelState === st) st.rerender(); });
  }
  function openHorde() {
    let info = null, run = null, busy = false, auto = false, alive = true, shake = {}, skillsOpen = false;
    const floats = [];
    const sprite = id => `/assets/sprites/generated/monsters/${id}.webp`;
    const load = async () => { try { info = await api('/api/horde'); run = info.run; } catch (e) { toast(cleanError(e)); } if (openPanelState === st) st.rerender(); };
    const feel = events => {
      for (const ev of events || []) {
        if (ev.t === 'hit') { floats.push({at: 'foe', text: (ev.crit ? '💥' : '') + '−' + fmt(ev.v), cls: ev.crit || ev.power ? 'is-dmg is-big' : 'is-dmg'}); shake.foe = Date.now() + 260; }
        if (ev.t === 'hurt') { floats.push({at: 'hero', text: '−' + fmt(ev.v), cls: 'is-hurt'}); shake.hero = Date.now() + 260; }
        if (ev.t === 'heal') floats.push({at: 'hero', text: '+' + fmt(ev.v), cls: 'is-heal'});
        if (ev.t === 'kill') { sfx.play(ev.kind === 'normal' ? 'hit' : 'heavy', 0.35); if (ev.kind === 'leader') bigBanner(`👑 ${ev.name} повержен!`, false); }
        if (ev.t === 'flee') floats.push({at: 'foe', text: '💨 убегает', cls: 'is-heal'});
        if (ev.t === 'join') floats.push({at: 'queue', text: '🩸 +1', cls: 'is-hurt'});
        if (ev.t === 'milestone') { bigBanner(`🏆 Веха ${ev.n}! Сундук: +${fmt(ev.gold)} 🪙${ev.frag ? ' и ✦' : ''}`, ev.n >= 60); sfx.play('coins', 0.5); try { Telegram.WebApp.HapticFeedback.notificationOccurred('success'); } catch {} }
        if (ev.t === 'dead') { auto = false; sfx.play('fail'); }
      }
    };
    const showFloats = () => { while (floats.length) { const f = floats.shift(), el = st.body.querySelector(f.at === 'hero' ? '[data-bv-hero], [data-hz="hero"]' : '[data-bv-foe], [data-hz="foe"]'); if (!el) continue;
      const r = el.getBoundingClientRect(), n = h('div', {class: 'ae-float ' + f.cls, style: `left:${r.left + r.width * (0.3 + Math.random() * 0.35)}px;top:${r.top + r.height * 0.25}px`}, f.text); document.body.append(n); setTimeout(() => n.remove(), 900); } };
    const act = async (action, steps = 1, skillId) => {
      if (busy || !run || run.status !== 'active') return; busy = true;
      try { const r = await api('/api/horde/act', 'POST', {action, steps, skillId}); run = r.run; feel(r.events); if (action !== 'attack' || steps === 1) sfx.tick?.(); }
      catch (e) { toast(cleanError(e)); auto = false; } finally { busy = false; if (openPanelState === st) st.rerender(); }
    };
    // Auto-battle: back-to-back requests, several exchanges each, no artificial pauses.
    const autoLoop = async () => {
      while (auto && alive && run?.status === 'active') {
        const best = (heroKit()?.skills || []).filter(k => k.mult > 0 && k.mana <= (run.mp || 0)).sort((x, y) => y.mult - x.mult)[0];
        const a = run.hp < run.maxHp * 0.35 && run.potions > 0 ? 'potion' : best ? 'skill' : run.powerCd === 0 ? 'power' : 'attack';
        const t = Date.now(); await act(a, 3, best?.id);
        const rest = 300 - (Date.now() - t); if (rest > 0) await new Promise(r => setTimeout(r, rest)); // keep a visible rhythm on very fast connections

      }
      if (openPanelState === st) st.rerender();
    };
    const start = async blood => {
      const p = me(); if (!p) return;
      if ((p.energy || 0) < HORDE_COST) return toast(`Нужно ${HORDE_COST} энергии.`);
      if (p.worldJourney || document.documentElement.hasAttribute('data-in-combat')) return toast('Сначала завершите бой или путь.');
      try { const r = await api('/api/horde/start', 'POST', {blood}); run = r.run;
        B()?.setPlayer(x => x && {...x, energy: Math.max(0, (x.energy || 0) - HORDE_COST)}); sfx.play(blood ? 'heavy' : 'whoosh'); st.rerender(); }
      catch (e) { toast(cleanError(e)); }
    };
    const claim = async () => {
      try { const r = await api('/api/horde/claim', 'POST', {}); if (!r.alreadyClaimed) { applyReward(r.reward); B()?.sound?.playVictory?.(); toast('Добыча: ' + rewardText(r.reward)); }
        run = null; await load(); refreshQuestBadge(); }
      catch (e) { toast(cleanError(e)); }
    };
    const bar = (cur, max, cls, label) => h('div', {class: 'ae-bar ' + (cls || '')}, h('i', {style: `width:${Math.max(0, Math.min(100, 100 * cur / Math.max(1, max)))}%`}), h('span', {}, label || `${fmt(cur)} / ${fmt(max)}`));
    const st = openPanel('🌕 Орда', body => {
      body.closest('.ae-panel')?.classList.toggle('is-blood', !!run?.blood && run.status === 'active');
      if (!info) return body.append(h('p', {class: 'ae-empty'}, 'Загрузка…'));
      const lvl = me()?.level || 1, energy = me()?.energy || 0;
      if (!run || (run.status === 'ended' && run.claimed)) {
        body.append(h('div', {class: 'ae-horde-hero'}, h('b', {}, 'Орда монстров'), h('span', {}, 'Бесконечный поток врагов, мгновенные бои и автобой. Добыча за каждого монстра, сундуки на 20, 40 и 60 убийствах.')));
        body.append(h('div', {class: 'ae-pill'}, `🏆 Рекорд: ${info.best.kills || 0} · 🌕 ${info.best.bloodKills || 0}`));
        const wk = info.weekend || {};
        if (wk.on) {
          body.append(h('div', {class: 'ae-weekend is-on'}, h('b', {}, '🌕 Выходные Кровавой луны!'), h('span', {}, `Каждый поход — Кровавая луна, награды ×2 (итого ×3.5 к обычной Орде). До конца: ${untilText(wk.endsAt)}.`)));
          body.append(h('button', {class: 'ae-btn ae-wide ae-horde-go is-blood', type: 'button', disabled: energy < HORDE_COST, onclick: () => start(true)}, h('b', {}, '🌕 В Кровавую Орду ×2'), h('small', {}, `${HORDE_COST} ⚡ · лунные чудовища и двойная добыча`)));
        } else {
          body.append(h('button', {class: 'ae-btn ae-primary ae-wide ae-horde-go', type: 'button', disabled: energy < HORDE_COST, onclick: () => start(false)}, h('b', {}, '⚔️ В Орду'), h('small', {}, `${HORDE_COST} ⚡ · обычный режим`)));
          body.append(h('button', {class: 'ae-btn ae-wide ae-horde-go is-blood', type: 'button', disabled: energy < HORDE_COST || lvl < 10, onclick: () => start(true)}, h('b', {}, '🌕 Кровавая луна'),
            h('small', {}, lvl < 10 ? 'откроется с 10 уровня' : `${HORDE_COST} ⚡ · монстры сильнее и злее, награда ×1.75`)));
          if (wk.nextAt) body.append(h('div', {class: 'ae-weekend'}, h('b', {}, '🗓️ Выходные Кровавой луны'), h('span', {}, `Каждую субботу и воскресенье Кровавая луна для всех с двойной наградой. Начнутся через ${untilText(wk.nextAt)}.`)));
        }
        if (energy < HORDE_COST) body.append(h('p', {class: 'ae-sub'}, 'Не хватает энергии — она восстанавливается со временем, а в таверне есть пиво и самогон.'));
        body.append(h('details', {class: 'ae-combos'}, h('summary', {}, '📜 Как играть'), h('div', {class: 'ae-sub', html: '• Каждое нажатие — мгновенный обмен ударами. <b>Автобой</b> бьёт без пауз.<br>• Каждый 10-й монстр — элита, каждый 20-й — вожак.<br>• После каждой победы вы немного восстанавливаете здоровье, с собой 3 зелья.<br>• Погибнете — поход закончится, но вся добыча останется вашей.<br>• 🌕 <b>Кровавая луна</b>: монстры бьют сильнее и чаще, раненые убегают, на их место прибегают новые.<br>• Ежедневные задания: 20, 40 и 60 монстров Орды; недельное — 30 в Кровавую луну.'})));
        body.append(h('button', {class: 'ae-btn ae-wide', type: 'button', onclick: () => openSpecialQuests()}, '📜 Задания Орды'));
        return;
      }
      const front = run.queue[0], next = run.next;
      battleMode(body, run.status === 'active' && !!front);
      if (run.status === 'active' && front) {
        const cls = me()?.classId || 'warrior', q = run.queue.slice(1);
        body.append(battleView({
          location: run.blood ? 'Орда · Кровавая луна' : 'Орда монстров', mode: run.weekend ? 'Выходные луны ×3.5' : run.blood ? 'Кровавая луна ×1.75' : 'Быстрый бой', round: `☠️ ${run.kills}`,
          scene: run.blood ? '/assets/rift-DTdreQra.webp' : '/assets/arena-D132A-sN.webp', turn: auto ? 'Автобой — бой идёт сам' : 'Ваш ход — выберите действие', turnShort: auto ? 'Автобой' : 'Ваш ход',
          hero: {name: me()?.name || 'Герой', cls: CLASS_RU2[cls] || cls, level: me()?.level || 1, hp: run.hp, maxHp: run.maxHp, mp: run.mp ?? 0, maxMp: run.maxMp || 100, mpLabel: 'MANA', portrait: heroPortrait(cls), body: heroBody(cls)},
          foe: {name: front.name, level: front.kind === 'leader' ? 'Вожак' : front.kind === 'elite' ? 'Элита' : 'Монстр орды', hp: front.hp, maxHp: front.maxHp, atk: front.atk, img: sprite(front.sprite)},
          note: (run.log || []).at(-1),
          intent: q.length ? {label: 'Следом бегут:', name: q.map(m => m.name).join(', '), text: run.blood ? 'Кровавая луна: монстры бьют сильнее, раненые могут сбежать, на их место прибегают новые.' : '', value: `+${q.length}`} : null,
          series: {label: 'Орда', value: next ? `${run.kills} / ${next}` : `${run.kills} · все вехи`, sub: `Добыча: ${rewardText(run.loot) || '—'}`},
          actions: [{kind: 'attack', label: 'Атака', onClick: () => { if (!auto) act('attack'); }},
            {kind: 'skill', label: 'Навыки', disabled: auto, attr: {'aria-expanded': String(skillsOpen), 'aria-controls': 'combat-skills'}, onClick: () => { if (!auto) { skillsOpen = !skillsOpen; st.rerender(); } }},
            {kind: 'defend', label: 'Защита (+12% MP)', disabled: auto, onClick: () => { if (!auto) act('defend'); }},
            {kind: 'potion', label: `Зелье (${run.potions})`, disabled: !run.potions, onClick: () => { if (!auto) act('potion'); }}],
          secondary: [{auto: true, on: auto, label: auto ? '⏸ Автобой: вкл' : 'Автобой', onClick: () => { auto = !auto; st.rerender(); if (auto) autoLoop(); }},
            {label: 'Уйти с добычей', onClick: async () => { auto = false; try { run = (await api('/api/horde/leave', 'POST', {})).run; } catch (e) { toast(cleanError(e)); } st.rerender(); }}],
          log: run.log || [],
          menu: skillsOpen ? skillMenu({mp: run.mp ?? 0, disabled: auto, onClose: () => { skillsOpen = false; st.rerender(); }, onUse: k => { skillsOpen = false; act('skill', 1, k.id); }}) : null}));
        if ((shake.foe || 0) > Date.now()) body.querySelector('[data-bv-foe]')?.classList.add('ae-shake');
        if ((shake.hero || 0) > Date.now()) body.querySelector('[data-bv-hero]')?.classList.add('ae-shake');
        requestAnimationFrame(showFloats);
        return;
      }
      body.append(h('div', {class: 'ae-horde-top'}, h('div', {class: 'ae-horde-kills'}, h('b', {}, `☠️ ${run.kills}`), h('small', {}, next ? `до вехи ${next}: ${next - run.kills}` : 'все вехи взяты!')),
        h('div', {class: 'ae-horde-loot'}, h('span', {}, `🪙 ${fmt(run.loot.gold)}`), h('span', {}, `✨ ${fmt(run.loot.exp)}`), run.loot.fragments ? h('span', {}, `✦ ${run.loot.fragments}`) : '')));
      if (next) body.append(bar(run.kills - (next === 20 ? 0 : next - 20), 20, 'is-mp', `Веха ${next}: ${run.kills} / ${next}`));
      if (run.status === 'active' && front) {
        const cls = me()?.classId || 'warrior', heroCls = cls === 'hunter' ? 'archer' : cls;
        body.append(h('div', {class: 'ae-horde-stage' + (run.blood ? ' is-blood' : '')},
          h('div', {class: 'ae-horde-player' + ((shake.hero || 0) > Date.now() ? ' ae-shake ae-hit' : ''), 'data-hz': 'hero'},
            h('img', {src: `/assets/sprites/generated/heroes/combat/${heroCls}.webp`, alt: '', onerror: e => { e.target.src = '/assets/sprites/generated/heroes/combat/warrior.webp'; }}),
            h('div', {class: 'ae-horde-name'}, me()?.name || 'Герой'), bar(run.hp, run.maxHp, run.hp < run.maxHp * 0.3 ? 'is-down' : '')),
          h('div', {class: 'ae-horde-foe' + ((shake.foe || 0) > Date.now() ? ' ae-shake' : '') + ' is-' + front.kind, 'data-hz': 'foe'},
            h('img', {src: sprite(front.sprite), alt: '', onerror: e => { e.target.style.visibility = 'hidden'; }}),
            h('div', {class: 'ae-horde-name'}, front.name), bar(front.hp, front.maxHp, 'is-foe')),
          h('div', {class: 'ae-horde-queue', 'data-hz': 'queue'}, run.queue.slice(1).map(m => h('div', {class: 'ae-horde-q is-' + m.kind, title: m.name}, h('img', {src: sprite(m.sprite), alt: ''}))))));
      }
      if (!(run.status === 'active' && front)) body.append(h('div', {class: 'ae-horde-me', 'data-hz': 'hero'}, h('small', {}, '🛡️ Ваш герой'), bar(run.hp, run.maxHp, run.hp < run.maxHp * 0.3 ? 'is-down' : '')));
      if (run.status === 'active') {
        body.append(h('div', {class: 'ae-grid2 ae-acts ae-horde-acts'},
          h('button', {class: 'ae-btn ae-act ae-horde-attack', type: 'button', onpointerdown: e => { e.preventDefault(); if (!auto) act('attack'); }}, h('b', {}, '⚔️ Атака'), h('small', {}, 'мгновенный удар')),
          h('button', {class: 'ae-btn ae-act', type: 'button', disabled: run.powerCd > 0, onpointerdown: e => { e.preventDefault(); if (!auto) act('power'); }}, h('b', {}, '💥 Мощный'), h('small', {}, run.powerCd > 0 ? `через ${run.powerCd} уд.` : '×2.5 урона')),
          h('button', {class: 'ae-btn ae-act', type: 'button', disabled: !run.potions, onpointerdown: e => { e.preventDefault(); if (!auto) act('potion'); }}, h('b', {}, `🧪 Зелье ×${run.potions}`), h('small', {}, '+40% HP')),
          h('button', {class: 'ae-btn ae-act ae-horde-auto' + (auto ? ' is-on' : ''), type: 'button', onclick: () => { auto = !auto; st.rerender(); if (auto) autoLoop(); }}, h('b', {}, auto ? '⏸ Стоп' : '▶️ Автобой'), h('small', {}, auto ? 'бьёт без пауз' : 'сам бьёт и пьёт зелья'))));
        body.append(h('button', {class: 'ae-btn ae-wide', type: 'button', onclick: async () => { auto = false; try { run = (await api('/api/horde/leave', 'POST', {})).run; } catch (e) { toast(cleanError(e)); } st.rerender(); }}, '🏃 Уйти с добычей'));
      } else {
        body.append(h('div', {class: 'ae-card ae-result ' + (run.died ? 'is-loss' : 'is-win')}, h('b', {}, run.died ? `💀 Вы пали на ${run.kills}-м монстре` : `🏁 Поход завершён: ${run.kills} монстров`),
          h('div', {class: 'ae-sub'}, `Добыча: ${rewardText(run.loot) || 'пусто'}`)));
        if (!run.claimed) body.append(h('button', {class: 'ae-btn ae-primary ae-wide', type: 'button', onclick: claim}, '🎁 Забрать добычу'));
      }
      body.append(h('div', {class: 'ae-log'}, (run.log || []).slice().reverse().slice(0, 6).map(l => h('div', {}, l))));
      requestAnimationFrame(showFloats);
    }, {cls: 'ae-horde-panel', onClose: () => { alive = false; auto = false; }});
    load();
  }
  let heavyAt = 0, heavyTimer = 0;
  function heavyPass() {
    const run = () => { heavyAt = Date.now(); heavyTimer = 0; try { decorateLands(); decorateNicks(); renderChatItems(); injectShareButton(); injectTwoHand(); fitTavernChat(); injectPvp(); injectTavern(); decorateTravel(); injectQuickBars(); injectSellToFriend(); injectForgeClaim(); decoratePets(); injectMarketDeposit(); paintNewsBadges(); paintPlaceBadges(); injectPetFood(); decorateAlchemy(); injectRespec(); injectClanInvite(); injectClanHQ(); injectClanTreasury(); injectGemPlaces(); liftMineExpedition(); injectMarketTools(); injectFishFeed(); } catch (e) { console.warn('ae heavy', e); } };
    const wait = 500 - (Date.now() - heavyAt);
    if (wait <= 0) run(); else if (!heavyTimer) heavyTimer = setTimeout(run, wait);
  }
  let queued = false;
  new MutationObserver(muts => {
    for (const m of muts) for (const n of m.addedNodes) if (n.nodeType === 1) soundScan(n.matches?.('.combat-damage-pop') ? n.parentElement : n);
    if (queued) return; queued = true;
    requestAnimationFrame(() => { queued = false; try { injectEntries(); injectAdmin(); decorateDungeons(); injectBag(); injectDungeonExit(); decorateTiles(); decorateSlots(); decorateTwoHandSlot(); injectBell(); syncTravel(); hideLockUi(); injectModeToggle(); decorateCurrencies(); applyHeaderAvatar(); heavyPass(); } catch (e) { console.warn('ae inject', e); } });
  }).observe(document.documentElement, {childList: true, subtree: true});
  setInterval(() => { try { storyTick(); } catch (e) { console.warn('ae story', e); } }, 1200);
  // The game moves the travel bar by restyling it (no DOM insertions), so poll while a journey card is open.
  setInterval(() => { if (!document.hidden && document.querySelector('.ae-travel-card')) try { syncTravel(); } catch {} }, 100);

  // ---------- styles ----------
  const css = `
.ae-clan-tag{display:inline-block;margin-right:4px;padding:0 4px;border-radius:5px;background:#3b2f1a;border:1px solid #c79a3e88;color:#f3d27a;font:700 0.82em/1.35 system-ui,sans-serif;vertical-align:baseline}html[data-interface=modern] .ae-clan-tag{background:#1e293b;border-color:#38bdf866;color:#7dd3fc}
.ae-prof-clan{font-size:12.5px;color:#e5ce96;margin-top:2px}
.ae-scale-list{display:grid;grid-template-columns:1fr 1fr;gap:8px}.ae-scale-opt{display:flex;flex-direction:column;align-items:center;gap:2px;min-height:58px}.ae-scale-opt small{opacity:.75}
.ae-2h-note{display:flex;flex-direction:column;gap:2px;padding:8px 10px;margin:6px 0;border-radius:10px;border:1px solid rgba(232,184,92,.55);background:rgba(232,184,92,.12);font-size:12px;line-height:1.35}.ae-2h-note b{color:#f0c46a}html[data-interface=fantasy] .ae-2h-note{border-color:#9a6a2a;background:rgba(122,58,16,.1)}html[data-interface=fantasy] .ae-2h-note b{color:#7a3a10}.ae-2h-btn{width:100%;margin:6px 0}.ae-2h-locked{position:relative;opacity:.55}.ae-2h-locked::after{content:'🔒 Двуручное';position:absolute;left:50%;bottom:4px;transform:translateX(-50%);font-size:10px;font-weight:700;white-space:nowrap;padding:1px 6px;border-radius:8px;background:rgba(20,14,8,.85);color:#f0c46a;pointer-events:none}.ae-2h-tile::before{content:'2H';position:absolute;left:3px;top:3px;z-index:3;font-size:9px;font-weight:800;line-height:1;padding:2px 3px;border-radius:4px;background:#7a2f1c;color:#ffe2a8;pointer-events:none}.ae-2h-tile{position:relative}.ae-head-tools{display:flex;align-items:center;gap:2px}.ae-bell{position:relative}.ae-bell-n{position:absolute;top:2px;right:0;min-width:18px;height:18px;padding:0 5px;border-radius:9px;background:#e5484d;color:#fff;font:800 11px/18px system-ui,sans-serif;text-align:center;box-shadow:0 0 0 2px #0b0f0d}.ae-bell.has-new svg{animation:aering 2.4s ease-in-out infinite;transform-origin:50% 10%}@keyframes aering{0%,80%,100%{transform:rotate(0)}84%{transform:rotate(14deg)}88%{transform:rotate(-12deg)}92%{transform:rotate(8deg)}96%{transform:rotate(-4deg)}}.ae-bell-f{position:relative;flex:none;align-self:center;display:inline-flex;align-items:center;justify-content:center;width:34px;height:34px;margin:0 2px;border-radius:9px;border:1px solid #6b5631;background:rgba(20,14,8,.55);color:#e3c983}.ae-bell-f .ae-bell-n{top:-5px;right:-6px}.ae-bell-f.ae-bell-row{position:absolute;right:46px;top:4px;z-index:2}.shell-hud-content{position:relative}.ae-bell-f.ae-bell-nick{position:absolute;z-index:3;width:30px;height:30px;margin:0}.ae-bell-nick svg{width:19px;height:19px}.ae-bell-nick .ae-bell-n{top:-6px;right:-8px;min-width:16px;height:16px;line-height:16px;font-size:10px}.ae-inbox-row{display:flex;align-items:center;gap:10px;width:100%;text-align:left;padding:9px 10px;border-radius:10px;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.03);color:inherit;font:inherit;font-size:13px;line-height:1.3}.ae-inbox-row small{display:block;opacity:.6;font-size:11px;margin-top:2px}.ae-inbox-row.is-new{border-color:rgba(240,196,106,.6);background:rgba(240,196,106,.1)}.ae-inbox-i{font-size:20px;width:26px;text-align:center;flex:0 0 26px}.ae-mail{display:flex;flex-direction:column;gap:6px}.ae-mail.is-new{border-color:rgba(240,196,106,.7)!important}.ae-mail-text{margin:0;font-size:13px;line-height:1.4;white-space:pre-wrap}.ae-mail-gifts{display:flex;align-items:center;gap:8px;padding:8px 10px;border-radius:10px;background:rgba(240,196,106,.12);font-weight:700;font-size:13px}.ae-mail-grid{display:grid;grid-template-columns:1fr 1fr;gap:6px}.ae-threat-chip{position:fixed;left:50%;transform:translateX(-50%);top:calc(6px + env(safe-area-inset-top,0px));z-index:60;padding:3px 10px;border-radius:12px;background:rgba(60,14,10,.92);border:1px solid #e0603c;color:#ffd9b8;font:700 11px/1.4 system-ui,sans-serif;white-space:nowrap;pointer-events:none}html.ae-zoomed .ae-float{zoom:calc(1 / var(--ae-zoom))}html.ae-scaled .max-w-sm{max-width:calc(24rem / var(--ae-scale))}html.ae-scaled .max-w-md{max-width:calc(28rem / var(--ae-scale))}html.ae-scaled .max-w-lg{max-width:calc(32rem / var(--ae-scale))}html.ae-scaled .max-w-xl{max-width:calc(36rem / var(--ae-scale))}html.ae-scaled .max-w-2xl{max-width:calc(42rem / var(--ae-scale))}
html.ae-zoomed,html.ae-zoomed body{min-height:calc(100vh / var(--ae-zoom))}html.ae-zoomed .game-shell,html.ae-zoomed .min-h-screen{min-height:calc(100vh / var(--ae-zoom))!important}
.ae-nick-ava{width:26px;height:26px;border-radius:50%;object-fit:cover;object-position:top;flex:none;vertical-align:middle;margin-right:6px;border:1px solid #e5c67866;background:#0b0d10;cursor:pointer;display:inline-block}html[data-interface=modern] .ae-nick-ava{border-color:#38bdf866}
.ae-petlvl{display:flex;flex-direction:column;gap:4px;margin:8px 0 4px;font-size:12.5px}.ae-petlvl small{opacity:.75;font-size:11.5px;line-height:1.35}.ae-petfood-bar.is-xp i{background:linear-gradient(90deg,#a855f7,#facc15)!important}
.ae-prof-pet{display:flex;align-items:center;gap:6px;font-size:12.5px;margin-top:3px}.ae-prof-pet img{width:22px;height:22px;border-radius:6px;object-fit:cover}.ae-prof-pet small{opacity:.7;font-size:11px}
.ae-petfood-fish{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin:6px 0}.ae-petfood-fish small{width:100%;opacity:.8}.ae-petfood-fish .ae-btn{font-size:12px;min-height:34px;padding:4px 10px}
.ae-chat-item .ae-buy-shown{min-height:30px;padding:3px 10px;font-size:12px;cursor:pointer;display:inline-flex;align-items:center}
.ae-hide{display:none!important}.ae-market-one{display:flex;flex-direction:column;gap:6px;margin:6px 0}.ae-market-one small{opacity:.8;font-size:12px;line-height:1.4}
.ae-lot{display:flex;flex-direction:column;gap:6px}.ae-lot-item img{width:40px;height:40px;object-fit:contain;flex:none}.ae-lot-item small{display:block;opacity:.75;font-size:11.5px}
.ae-lot-info{display:flex;flex-wrap:wrap;gap:4px 12px;font-size:12px}.ae-lot-info small{opacity:.7;width:100%}.ae-lot-offers{display:flex;flex-direction:column;gap:4px}
.ae-wallet-line{font-size:12.5px;margin:4px 0}.ae-chat-lot{display:flex;align-items:center;gap:8px;cursor:default}.ae-chat-lot.is-closed{opacity:.6}
.ae-lot-price{color:#facc15;font-weight:700}.ae-lot-btns{display:flex;flex-direction:column;gap:4px;flex:none}.ae-lot-btns .ae-btn{min-height:30px;padding:3px 10px;font-size:12px}
.tavern-beer-card{padding:8px 10px!important;margin-bottom:8px!important}.tavern-beer-card .tavern-beer-row{gap:10px!important}
.tavern-beer-card .tavern-beer-row>img.tavern-beer-thumb,.ae-moon-thumb{flex:0 0 36px!important;width:36px!important;height:36px!important;border-radius:8px}
.game-tavern [data-ae-drink]{color:#ffe6ad;background:#604821;border:1px solid #a58a4f;border-radius:8px;font-weight:700}.game-tavern [data-ae-drink]:disabled{opacity:.55}
.ae-moon-thumb{display:grid;place-items:center;font-size:22px;background:#ffffff0d;border:1px solid #ffffff1a}
.tavern-beer-card .tavern-beer-copy h3{font-size:13.5px!important;margin:0 0 1px!important}.tavern-beer-card .tavern-beer-benefits{font-size:11px!important}
.tavern-beer-card .tavern-beer-row>button{min-height:34px!important;padding:4px 14px!important;font-size:12.5px!important;flex:none}
.tavern-beer-card .tavern-beer-row.ae-moonshine{display:flex!important;flex-direction:row!important;align-items:center!important;text-align:left!important;margin:8px 0 0!important;padding:8px 0 0!important;border:0!important;border-top:1px dashed #ffffff1a!important;border-radius:0!important;background:none!important;box-shadow:none!important}
.tavern-beer-card .tavern-beer-warning,.tavern-beer-card .tavern-current-effects{display:inline;margin:0!important;font-size:11px!important;opacity:.75}
.tavern-beer-card .tavern-beer-warning{display:block;margin-top:6px!important}.tavern-beer-card .tavern-current-effects{display:flex!important;margin-top:2px!important}
.tavern-beer-card .tavern-hint{display:none!important}
.tavern-beer-card .tavern-beer-details summary{min-height:30px!important;font-size:11.5px}
#tavern-chat .chat-header{padding:8px 12px!important}#tavern-chat .chat-eyebrow,#tavern-chat .chat-subtitle{display:none!important}
#tavern-chat .chat-header>div{margin-top:0!important}#tavern-chat .chat-header>div:last-child{position:absolute;right:58px;top:50%;transform:translateY(-50%)}
#tavern-chat .chat-header{position:relative}#tavern-chat .chat-header h2{font-size:16px!important}
#tavern-chat .chat-stream{min-height:max(300px,calc(100vh - 300px))!important}#tavern-chat .chat-stream{flex:none!important;min-height:0!important;height:var(--ae-chat-h,360px)!important;max-height:var(--ae-chat-h,360px)!important;overflow-y:auto!important}#tavern-chat .chat-header button[aria-label]{padding:5px!important}.tavern-beer-card{display:grid!important;grid-template-columns:1fr 1fr;gap:6px!important;padding:6px!important}.tavern-beer-card>.tavern-beer-row,.tavern-beer-card .tavern-beer-row.ae-moonshine{display:flex!important;flex-direction:row!important;align-items:center!important;gap:6px!important;margin:0!important;padding:5px 6px!important;border:1px solid #ffffff1a!important;border-radius:10px!important;min-width:0}.tavern-beer-card .tavern-beer-row>img.tavern-beer-thumb,.tavern-beer-card .ae-moon-thumb{flex:0 0 26px!important;width:26px!important;height:26px!important;font-size:18px;display:grid;place-items:center;border-radius:6px}.tavern-beer-card .tavern-beer-copy{min-width:0;flex:1}.tavern-beer-card .tavern-beer-copy h3{font-size:12px!important;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.tavern-beer-card .tavern-beer-benefits{font-size:10px!important;line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.tavern-beer-card .tavern-beer-row>button{min-height:30px!important;padding:3px 8px!important;font-size:11.5px!important}.tavern-beer-card .tavern-beer-warning,.tavern-beer-card .tavern-current-effects{display:none!important}.tavern-beer-card .tavern-beer-details{grid-column:1/-1;margin:0!important}.tavern-beer-card .tavern-beer-details summary{min-height:22px!important;font-size:11px;padding:0 2px}#tavern-chat .chat-header{padding:6px 10px!important}#tavern-chat .chat-header .rpg-icon-button{width:32px!important;height:32px!important;min-width:32px!important;min-height:32px!important}#tavern-chat .chat-header h2{font-size:15px!important}#tavern-chat .chat-stream{gap:0}#tavern-chat .chat-stream>*+*{margin-top:5px!important}#tavern-chat .chat-message{padding:5px 8px!important;border-radius:10px!important}#tavern-chat .chat-message.is-own{margin-left:12px!important}#tavern-chat .chat-message>div:first-child{min-height:0!important;align-items:center}#tavern-chat .chat-message .ae-nick-ava{width:18px!important;height:18px!important}#tavern-chat .chat-sender,#tavern-chat .chat-time{line-height:18px!important}#tavern-chat .chat-message-text{margin-top:1px!important;line-height:1.3}
.game-tavern>h2,.game-tavern h2:first-child{margin-bottom:6px!important}
[data-ae-mine-lifted] button>div.justify-between{width:100%}[data-ae-mine-lifted] button>div.justify-between>div:first-child{flex:1;min-width:0;text-align:left}
[data-ae-mine-lifted] button>div.justify-between>span{flex:none;white-space:nowrap;min-width:52px;text-align:center}
html:not([data-interface=modern]) [data-ae-mine-lifted] .text-cyan-200{color:#e5c678!important;font-family:Georgia,serif;font-size:14px}
html:not([data-interface=modern]) [data-ae-mine-lifted] .text-xs.text-slate-500{color:#a79f8f!important}
html:not([data-interface=modern]) [data-ae-mine-lifted] button.w-full{padding:10px 12px!important}
html:not([data-interface=modern]) [data-ae-mine-lifted] button.w-full .text-slate-100{color:#efe4cc!important;font-size:13px}
html:not([data-interface=modern]) [data-ae-mine-lifted] button.w-full .text-slate-500{color:#a79f8f!important;font-family:system-ui,sans-serif;font-weight:400;line-height:1.35}
html:not([data-interface=modern]) [data-ae-mine-lifted] button.w-full>div>span{background:#2a2216!important;border-color:#a98951!important;color:#f0d79a!important;font-family:Georgia,serif}
html:not([data-interface=modern]) [data-ae-mine-lifted] button.w-full:hover>div>span{border-color:#e5c678!important}
.ae-exp-extra{display:flex;flex-direction:column;gap:8px;margin-top:10px;padding-top:10px;border-top:1px dashed #e5c67840;font-size:12.5px}
.ae-exp-table{display:flex;flex-direction:column;gap:4px}.ae-exp-row{display:grid;grid-template-columns:34px 1fr auto;gap:2px 8px;align-items:baseline}.ae-exp-row b{color:#facc15}.ae-exp-row small{grid-column:2/4;opacity:.7;font-size:11px}
.ae-exp-loot{display:flex;flex-wrap:wrap;gap:4px;align-items:center}.ae-exp-loot span{font-size:16px}.ae-exp-next{opacity:.65}
.ae-exp-tip{opacity:.75;font-size:11.5px;line-height:1.4}.ae-exp-haul{display:flex;flex-wrap:wrap;gap:4px;align-items:center}
.ae-exp-item{padding:2px 7px;border-radius:999px;border:1px solid #ffffff22;background:#ffffff0a;font-size:11.5px}.ae-exp-item.is-uncommon{border-color:#22c55e77}.ae-exp-item.is-rare{border-color:#38bdf8aa}.ae-exp-item.is-epic{border-color:#a855f7aa}.ae-exp-item.is-legendary{border-color:#f59e0bcc}
.ae-exp-ready{font-weight:700;color:#4ade80;font-size:13.5px}
.ae-exp-done{box-shadow:0 0 0 2px #4ade80aa,0 0 22px #4ade8055!important;animation:aeExpPulse 1.6s ease-in-out infinite}
@keyframes aeExpPulse{50%{box-shadow:0 0 0 2px #4ade80,0 0 30px #4ade8088}}
[data-ae-mine]{display:flex!important;flex-direction:column;gap:var(--ae-mine-gap,12px)}[data-ae-mine]>*{margin-top:0!important;margin-bottom:0!important}
[data-ae-mine-order="0"]{order:0}[data-ae-mine-order="1"]{order:1}[data-ae-mine-order="2"]{order:2}[data-ae-mine-order="3"]{order:3}[data-ae-mine-order="4"]{order:4}[data-ae-mine-order="5"]{order:5}[data-ae-mine-order="6"]{order:6}[data-ae-mine-order="7"]{order:7}[data-ae-mine-order="8"]{order:8}
[data-ae-mine-lifted]{box-shadow:0 0 0 1px #e5c67855,0 0 18px #e5c67822}
.ae-treasury-help{margin:4px 0;font-size:12px}.ae-treasury-help summary{cursor:pointer;opacity:.8;font-size:12px}.ae-treasury-help .ae-sub{margin-top:4px;line-height:1.5;font-size:12px}
.ae-tabs{flex-shrink:0}.ae-hq-panel .ae-body>*,.ae-horde-panel .ae-body>*{flex-shrink:0}
.ae-hq-head{display:flex;gap:10px;align-items:center;margin-bottom:8px}.ae-hq-head b{font-size:16px}.ae-hq-emblem{font-size:34px;width:52px;height:52px;display:grid;place-items:center;border-radius:14px;background:#ffffff10;border:1px solid #e5ce9655}
.ae-hq-bonus{padding:10px 12px;border-radius:12px;border:1px solid #e5ce9655;background:linear-gradient(135deg,#e5ce9618,#ffffff05);margin:8px 0;display:flex;flex-direction:column;gap:6px}.ae-hq-bonus small{opacity:.8;font-size:12px;line-height:1.35}
.ae-hq-pills{display:flex;flex-wrap:wrap;gap:6px}.ae-hq-pills span{padding:3px 9px;border-radius:999px;background:#22c55e22;border:1px solid #22c55e66;color:#bbf7d0;font-size:12px;font-weight:700}
.ae-hq-ic{font-size:24px;width:34px;text-align:center;flex:none}.ae-hq-chest.is-ready{border-color:#facc15aa;box-shadow:0 0 0 1px #facc1544,0 0 18px #facc1522}
.ae-hq-goal{display:flex;flex-direction:column;gap:6px}.ae-hq-goal.is-done{border-color:#22c55e88}.ae-hq-raid,.ae-hq-war{display:flex;flex-direction:column;gap:6px}
.ae-hq-vs{display:flex;justify-content:space-between;align-items:center;font-size:14px}.ae-hq-vs b{font-size:20px;color:#facc15}
.ae-hq-rank{width:26px;text-align:center;font-weight:800;flex:none}.ae-hq-pts{text-align:right;display:flex;flex-direction:column;flex:none}.ae-hq-pts b{font-size:16px;color:#facc15}.ae-hq-pts small{opacity:.7;font-size:11px}
.ae-hq-mem.is-away{opacity:.72}.ae-hq-mine{border-color:#facc15aa}
.ae-hq-emblems{display:grid;grid-template-columns:repeat(5,1fr);gap:6px}.ae-hq-em{font-size:24px;padding:6px 0;border-radius:10px;border:1px solid #ffffff22;background:#ffffff08;cursor:pointer}.ae-hq-em.is-on{border-color:#facc15;background:#facc1522}
.ae-hq-btn{position:relative;display:flex;flex-direction:column;align-items:center;gap:2px;margin:6px 0}.ae-hq-btn small{opacity:.8;font-size:11px;font-weight:500}.ae-hq-badge{position:absolute;top:-6px;right:-4px;min-width:20px;height:20px;padding:0 5px;border-radius:999px;background:#ef4444;color:#fff;font:700 12px/20px system-ui;font-style:normal}
.ae-clan-tag.is-p1{border-color:#facc15;box-shadow:0 0 6px #facc1588}.ae-clan-tag.is-p2{border-color:#cbd5e1;box-shadow:0 0 5px #cbd5e188}.ae-clan-tag.is-p3{border-color:#d97706;box-shadow:0 0 5px #d9770688}
.ae-clan-bonus-pop{position:fixed;left:50%;top:84px;transform:translateX(-50%);z-index:9999;padding:6px 12px;border-radius:999px;background:#14532dee;border:1px solid #22c55e;color:#dcfce7;font:700 12.5px system-ui;pointer-events:none;animation:aeFadeUp 2.2s ease forwards}
@keyframes aeFadeUp{0%{opacity:0;transform:translate(-50%,8px)}12%{opacity:1;transform:translate(-50%,0)}80%{opacity:1}100%{opacity:0;transform:translate(-50%,-10px)}}

.ae-admin-head{position:sticky;top:-16px;z-index:5;background:inherit;background-color:#0c0d1c;padding-top:6px;padding-bottom:6px}html[data-interface=fantasy] .ae-admin-head{background-color:#1b1712}
.ae-wiki-table{width:100%;border-collapse:collapse;font-size:11.5px;margin:6px 0;table-layout:fixed}.ae-wiki-table th:first-child,.ae-wiki-table td:first-child{width:30%}.ae-wiki-table th,.ae-wiki-table td{border:1px solid #ffffff22;padding:4px 6px;text-align:center}.ae-wiki-table td:first-child,.ae-wiki-table th:first-child{text-align:left}.ae-wiki-table th{color:#e5ce96}
.ae-clan-invite{margin:8px 0;gap:8px}.ae-respec{margin:8px 0;border-color:#a78bfa88!important;color:#ddd6fe!important}
.ae-forge-up{position:absolute;right:2px;bottom:2px;z-index:2;padding:0 5px;border-radius:6px;background:#1a1306e6;border:1px solid #e5ce96;color:#ffd77a;font:800 11px/16px system-ui,sans-serif;pointer-events:none}
.ae-forge-up.is-pop{animation:aeForgePop .6s ease-out}@keyframes aeForgePop{0%{transform:scale(1.9);color:#fff;box-shadow:0 0 16px #ffd77a}100%{transform:scale(1)}}
.ae-gem-row .ae-gem-i{font-size:26px;width:34px;text-align:center}.ae-gem-recipe{display:flex;flex-wrap:wrap;gap:4px;margin-top:4px}.ae-gem-recipe span{font-size:11px;padding:1px 6px;border-radius:6px;border:1px solid #ffffff22}
.ae-gem-pick{display:flex;flex-wrap:wrap;gap:6px}.ae-gem-chip{min-height:38px;font-size:12px}.ae-gem-chip.is-on{background:#e5ce96;color:#1a1306;font-weight:700}
.ae-ing-low{color:#fca5a5!important;border-color:#b91c1c!important}.ae-ing-ok{color:#86efac!important}
.ae-alch-note{margin-top:6px;padding:6px 10px;border-radius:8px;background:#450a0a99;border:1px solid #b91c1c88;color:#fecaca;font-size:12px}
.ae-alch-blocked{filter:grayscale(.6);opacity:.75}
.ae-coop-skills{display:flex;flex-direction:column;gap:6px;margin:6px 0}
.ae-coop-skills-h{display:flex;justify-content:space-between;align-items:center;font-size:12.5px;color:#cbd5e1}.ae-coop-skills-h b{color:#e5ce96}
.ae-coop-skill-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px}
.ae-coop-skill{display:grid;grid-template-columns:auto 1fr;grid-template-rows:auto auto;column-gap:8px;align-items:center;text-align:left;min-height:52px;padding:6px 10px;border-radius:12px;border:1px solid #7c6a4a;background:linear-gradient(#2a2216,#17120c);color:#f1e6cc;cursor:pointer;font:inherit}
html[data-interface=modern] .ae-coop-skill{border-color:#334155;background:#111a2b;color:#e2e8f0}
.ae-coop-skill-i{grid-row:1/3;font-size:22px}.ae-coop-skill b{font-size:12.5px;line-height:1.15}.ae-coop-skill small{font-size:11px;color:#93c5fd}
.ae-coop-skill.is-off{opacity:.45;cursor:default}.ae-coop-skill.is-combo{border-color:#facc15;box-shadow:0 0 0 1px #facc15,0 0 16px #facc1566;animation:aePlaceBob 1.4s ease-in-out infinite}.ae-coop-skill.is-combo small{color:#fde047}.ae-coop-skill:not(.is-off):active{transform:scale(.97)}
.ae-asc-badge{display:inline-flex;align-items:center;gap:6px;margin-top:5px;padding:3px 10px 3px 3px;border-radius:14px;border:1px solid #a78bfa88;background:linear-gradient(90deg,#4c1d9566,#1e1b4b66);font-size:12px;color:#ddd6fe;max-width:100%}
.ae-asc-badge b{display:inline-grid;place-items:center;min-width:26px;height:22px;padding:0 5px;border-radius:999px;background:linear-gradient(#a78bfa,#6d28d9);color:#fff;font:800 11.5px/1 system-ui,sans-serif;letter-spacing:.02em;box-shadow:0 0 10px #8b5cf688}
.ae-asc-badge span{line-height:1.25}
.ae-asc-badge[data-asc=A] b,.ae-asc-badge[data-asc=B] b{background:linear-gradient(#60a5fa,#1d4ed8);box-shadow:0 0 10px #3b82f688}
.ae-asc-badge[data-asc^=S] b{background:linear-gradient(#fde68a,#d97706);color:#2a1a05;box-shadow:0 0 14px #f59e0bbb}.ae-asc-badge[data-asc^=S]{border-color:#f59e0b99;color:#fde68a;background:linear-gradient(90deg,#78350f66,#1c1917aa)}
.ae-asc-badge.is-none{border-color:#ffffff22;background:#ffffff08;color:#8b95a3}.ae-asc-badge.is-none b{background:#334155;box-shadow:none}
.ae-invite-hero{display:flex;flex-direction:column;gap:4px;padding:12px;border-radius:14px;border:1px solid #e5ce9688;background:linear-gradient(135deg,#3a2a0ecc,#141a21);font-size:13px}
.ae-invite-hero b{font-size:16px;color:#f3d27a}
.ae-invite-link{padding:10px;border-radius:10px;background:#0b0f14;border:1px dashed #ffffff33;overflow-wrap:anywhere;font-size:12.5px}.ae-invite-link code{color:#e5ce96}
.ae-invite-row img{width:40px;height:40px;border-radius:50%;object-fit:cover;border:1px solid #e5ce9666}.ae-invite-row .ae-bar{margin-top:4px;height:16px}
.ae-stat-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(70px,1fr));gap:6px}
.ae-stat{display:flex;flex-direction:column;align-items:center;padding:8px 4px;border-radius:12px;background:#ffffff0d;border:1px solid #ffffff17;text-align:center}
.ae-stat b{font-size:20px;color:#e5ce96}.ae-stat span{font-size:11.5px;color:#cbd5e1}.ae-stat small{font-size:10.5px;color:#8b95a3}
.ae-chart{display:flex;align-items:flex-end;gap:3px;height:130px;padding:6px 2px 0;border-bottom:1px solid #ffffff22}
.ae-chart-col{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;height:100%;min-width:0}
.ae-chart-col i{position:relative;display:block;width:100%;min-height:2px;border-radius:4px 4px 0 0;background:#c79a3e}.ae-chart-col i em{position:absolute;left:0;right:0;bottom:0;background:#f3e2b6;border-radius:0}
.ae-chart-v{font-size:9.5px;color:#cbd5e1;height:12px}.ae-chart-col small{font-size:9px;color:#8b95a3;margin-top:2px}
.ae-hbar{position:relative;display:flex;align-items:center;gap:6px;min-height:26px;padding:0 8px;border-radius:8px;background:#ffffff08;overflow:hidden;font-size:12px}
.ae-hbar i{position:absolute;inset:0 auto 0 0;background:#c79a3e33;z-index:0}.ae-hbar.is-quit i{background:#ef444433}.ae-hbar span{position:relative;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.ae-hbar b{position:relative;font-size:11.5px;color:#e5ce96}
.ae-weekend{display:flex;flex-direction:column;gap:2px;padding:10px 12px;border-radius:12px;border:1px dashed #b9474788;background:#2a0d0d66;color:#f3d6d6;font-size:12.5px}
.ae-weekend b{color:#fca5a5;font-size:13.5px}.ae-weekend.is-on{border-style:solid;border-color:#ef4444;background:linear-gradient(135deg,#450a0acc,#1f0707cc);box-shadow:0 0 18px #ef444444}
[data-settlement-place]{position:relative!important;overflow:visible!important}
.ae-place-badge{position:absolute;top:-8px;right:-4px;z-index:3;max-width:calc(100% - 4px);height:20px;padding:0 8px;border-radius:999px;font:700 10.5px/20px system-ui,sans-serif;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;pointer-events:none;box-shadow:0 2px 8px #0009}
.ae-place-badge.is-info{background:linear-gradient(#f59e0b,#b45309);color:#fff;border:1px solid #fde68a}
.ae-place-badge.is-new{background:linear-gradient(#f6d77c,#c99a35);color:#2a1a05;border:1px solid #fff3c4;animation:aePlaceTwinkle 2.6s ease-in-out infinite}
.ae-place-badge.is-ready{background:linear-gradient(#22c55e,#15803d);color:#fff;border:1px solid #bbf7d0;animation:aePlaceBob 1.8s ease-in-out infinite}
.ae-place-badge.is-warn{background:linear-gradient(#ef4444,#b91c1c);color:#fff;border:1px solid #fecaca;animation:aePlaceBob 1.1s ease-in-out infinite}
.ae-place-badge.is-busy{background:#1e293bee;color:#cbd5e1;border:1px solid #475569}
[data-ae-badge-kind=warn]{box-shadow:0 0 0 1px #ef444488,0 0 16px #ef444455!important}
[data-ae-badge-kind=ready]{box-shadow:0 0 0 1px #22c55e77,0 0 14px #22c55e40!important}
@keyframes aePlaceBob{0%,100%{transform:translateY(0)}50%{transform:translateY(-3px)}}
@keyframes aePlaceTwinkle{0%,100%{transform:scale(1);filter:brightness(1)}50%{filter:brightness(1.3)}}
@media (prefers-reduced-motion:reduce){.ae-place-badge{animation:none!important}}
.ae-petfood{margin:8px 0;padding:10px 12px;border-radius:12px;border:1px solid #a28a5299;background:#1d1710e6;color:#efe6d2;display:flex;flex-direction:column;gap:6px}
html[data-interface=modern] .ae-petfood{background:#0f172a;border-color:#2b3a52;color:#e2e8f0}
.ae-petfood.is-hungry{border-color:#dc2626;box-shadow:0 0 0 1px #dc262655,0 0 18px #dc262633}
.ae-petfood-pct{font:700 13px system-ui,sans-serif;color:#facc15}.ae-petfood.is-hungry .ae-petfood-pct{color:#f87171}
.ae-petfood-bar{height:8px;border-radius:99px;background:#0006;overflow:hidden}.ae-petfood-bar i{display:block;height:100%;background:linear-gradient(90deg,#f59e0b,#84cc16);transition:width .4s}
.ae-petfood.is-hungry .ae-petfood-bar i{background:linear-gradient(90deg,#b91c1c,#f97316)}
.ae-petfood-btns{display:grid;grid-template-columns:1fr 1fr;gap:6px}.ae-petfood-btns .ae-btn{font-size:12px;padding:0 8px}.ae-petfood-btns .ae-btn:first-child{grid-column:1/-1}
.ae-petfood-art{width:96px;height:96px;object-fit:contain;align-self:center}
.ae-backdrop{position:fixed;inset:0;z-index:170;background:#000b;display:flex;align-items:flex-end;justify-content:center;padding:8px 8px calc(8px + env(safe-area-inset-bottom))}
.ae-panel{width:100%;max-width:520px;max-height:88vh;display:flex;flex-direction:column;background:#141a21;color:#e7e2d6;border:1px solid #b4975680;border-radius:16px;box-shadow:0 20px 60px #000c;font:14px/1.45 system-ui,sans-serif}
html[data-interface=fantasy] .ae-panel{background:#1b1712;border-color:#a28a52;font-family:Georgia,serif}
.ae-head{display:flex;align-items:center;gap:8px;padding:12px 14px;border-bottom:1px solid #ffffff1a}.ae-head h2{flex:1;margin:0;font-size:16px;color:#e5ce96}
.ae-x{width:44px;height:44px;font-size:24px;color:#cbd5e1;background:none;border:0;cursor:pointer}
.ae-body{overflow:auto;padding:12px 14px 16px;display:flex;flex-direction:column;gap:8px}
.ae-card{background:#ffffff0d;border:1px solid #ffffff17;border-radius:12px;padding:10px}.ae-row{display:flex;align-items:center;gap:8px}.ae-grow{flex:1;min-width:0}
.ae-sub{font-size:12px;color:#a8b0bb}.ae-good{color:#86efac}.ae-note{font-size:12.5px;color:#c8c2b2;margin:0}.ae-empty{color:#94a3b8;text-align:center;padding:14px 0;margin:0}
.ae-h3{margin:8px 0 0;font-size:13px;color:#e5ce96;text-transform:uppercase;letter-spacing:.06em}
.ae-btn{min-height:44px;min-width:44px;padding:0 12px;border-radius:10px;border:1px solid #ffffff2a;background:#ffffff12;color:#f1ead8;font:inherit;font-size:13px;cursor:pointer}
.ae-btn:disabled{opacity:.45;cursor:default}.ae-primary{background:linear-gradient(#c79a3e,#8f6a24);border-color:#e5ce96;color:#1a1306;font-weight:700}.ae-wide{width:100%}
.ae-link{background:none;border:0;color:#e5ce96;text-align:left;padding:6px 0;font:inherit;cursor:pointer}
.ae-input{flex:1;min-width:0;min-height:44px;border-radius:10px;border:1px solid #ffffff2a;background:#0b0f14;color:#f1ead8;padding:0 12px;font:inherit}
.ae-tabs{display:flex;gap:6px;overflow-x:auto}.ae-tab{flex:1 0 auto;min-height:40px;padding:0 10px;border-radius:999px;border:1px solid #ffffff22;background:none;color:#cbd5e1;font:inherit;font-size:12.5px;cursor:pointer}.ae-tab.is-on{background:#e5ce96;color:#1a1306;font-weight:700}
.ae-dot{width:9px;height:9px;border-radius:50%;background:#64748b;flex:0 0 9px}.ae-dot.is-on{background:#22c55e}.ae-badge{background:#dc2626;color:#fff;border-radius:999px;padding:1px 7px;font-size:12px}
.ae-click{text-align:left;font:inherit;color:inherit;cursor:pointer}.ae-icon{font-size:24px;width:32px;text-align:center}.ae-pill{align-self:flex-start;background:#ffffff12;border-radius:999px;padding:3px 10px;font-size:12px;margin:0}
.ae-chat{display:flex;flex-direction:column;gap:6px;min-height:240px;max-height:52vh;overflow:auto;padding:4px}
.ae-msg{align-self:flex-start;max-width:82%;background:#ffffff14;border-radius:12px 12px 12px 4px;padding:7px 10px;white-space:pre-wrap;word-break:break-word}.ae-msg.is-mine{align-self:flex-end;background:#8f6a24;color:#fff;border-radius:12px 12px 4px 12px}
.ae-msg time{display:block;font-size:10px;opacity:.65;text-align:right}.ae-compose{position:sticky;bottom:0}
.ae-bar{position:relative;height:18px;border-radius:9px;background:#0008;overflow:hidden;margin-top:6px}.ae-bar i{position:absolute;inset:0 auto 0 0;background:linear-gradient(90deg,#16a34a,#4ade80)}.ae-bar.is-foe i{background:linear-gradient(90deg,#b91c1c,#f87171)}.ae-bar.is-down i{background:#475569}
.ae-bar span{position:relative;display:block;text-align:center;font-size:11px;line-height:18px;color:#fff;text-shadow:0 1px 2px #000}
.ae-grid2{display:grid;grid-template-columns:1fr 1fr;gap:8px}.ae-act{font-weight:700}.ae-foe{border-color:#f8717166}
.ae-log{font-size:12px;color:#cbd5e1;background:#0006;border-radius:10px;padding:8px;max-height:170px;overflow:auto;display:flex;flex-direction:column;gap:3px}
.ae-wiki{background:#ffffff0a;border:1px solid #ffffff17;border-radius:12px;padding:0 12px}.ae-wiki summary{min-height:44px;display:flex;align-items:center;cursor:pointer;font-weight:700;color:#e5ce96}.ae-wiki p{margin:0 0 10px;font-size:13.5px}.ae-wiki a{color:#93c5fd}
.ae-entry{margin:14px 10px 8px}.ae-entry h3{margin:0 0 8px;font-size:13px;letter-spacing:.06em;text-transform:uppercase;color:#d5ba89}
.ae-entry-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.ae-entry-btn{display:flex;align-items:center;gap:8px;min-height:56px;padding:8px 10px;text-align:left;border-radius:12px;border:1px solid #b4975666;background:#ffffff0d;color:inherit;font:inherit;cursor:pointer;width:100%}
.ae-entry-btn b{display:block;font-size:13px}.ae-entry-btn small{display:block;font-size:11px;opacity:.75}.ae-entry-icon{font-size:22px}.ae-merge-cta{margin-top:12px}
.ae-admin-premium{display:flex;flex-direction:column;gap:8px;margin:12px 0;padding:12px;border-radius:12px;border:1px solid #eab30866;background:#eab3080d;color:#f1ead8;font:13px system-ui,sans-serif}.ae-admin-list{display:flex;flex-direction:column;gap:6px}.ae-card.is-picked{border-color:#eab308;background:#eab3081f}
.ae-toast{position:fixed;left:50%;bottom:calc(96px + env(safe-area-inset-bottom));transform:translateX(-50%) translateY(20px);opacity:0;z-index:200;background:#111827f2;color:#f8fafc;border:1px solid #e5ce9666;border-radius:12px;padding:10px 14px;font:13px system-ui,sans-serif;transition:.25s;pointer-events:none;max-width:90vw;text-align:center}.ae-toast.is-on{opacity:1;transform:translateX(-50%)}
.ae-story{position:fixed;inset:0;z-index:180;background:#000d;display:flex;align-items:center;justify-content:center;padding:16px;animation:aeIn .4s ease}.ae-story.is-out{opacity:0;transition:opacity .3s;pointer-events:none}
.ae-story-card{max-width:480px;width:100%;border-radius:18px;overflow:hidden;background:#15110c;border:1px solid #a28a52;box-shadow:0 30px 80px #000}
.ae-story-card img{display:block;width:100%;aspect-ratio:16/10;object-fit:cover;animation:aeZoom 6s ease-out forwards}
.ae-story-text{padding:16px;color:#efe6d0;font-family:Georgia,serif}.ae-story-text small{color:#d5ba89;letter-spacing:.12em;text-transform:uppercase}.ae-story-text h2{margin:4px 0 8px;color:#f3d79a}.ae-story-text p{margin:0 0 14px;line-height:1.55}
.ae-premium-card{border-color:#e5c678;box-shadow:0 0 60px #e5c67855,0 30px 80px #000}.ae-perks{margin:0 0 14px;padding:0;list-style:none;display:grid;gap:4px;font:13px system-ui,sans-serif;color:#efe6d0}
.ae-confetti{position:absolute;top:-12px;width:8px;height:14px;border-radius:2px;animation:aeFall 2.6s ease-in forwards;pointer-events:none}@keyframes aeFall{to{transform:translateY(105vh) rotate(540deg);opacity:.2}}

.ae-bag-merge{display:flex;align-items:center;gap:10px;width:100%;min-height:52px;margin:8px 0;padding:8px 12px;text-align:left;border-radius:12px;border:1px solid #b4975666;background:#ffffff0a;color:inherit;font:inherit;cursor:pointer}.ae-bag-merge b{display:block;font-size:13px}.ae-bag-merge small{display:block;font-size:11px;opacity:.75}.ae-bag-merge.has-pairs{border-color:#e5c678;background:linear-gradient(100deg,#3a2c14cc,#1a1510cc);box-shadow:0 0 14px #e5c67833}
html[data-interface=fantasy] .ae-bag-merge{background:#2a2117;color:#f3e6c4;border-color:#a28a52}html[data-interface=fantasy] .ae-bag-merge.has-pairs{background:linear-gradient(#c79a3e,#8f6a24);color:#1a1306;border-color:#e5ce96}html[data-interface=fantasy] .ae-bag-merge.has-pairs .ae-coop-go{color:#1a1306}

/* Layering: keep every full-screen modal above the bottom navigation (140) while restoring the original
   relative order between modal levels, and keep the option picker (opened from inside modals) on top. */
.fixed.inset-0.z-50{z-index:150!important}.fixed.inset-0.z-\[60\]{z-index:152!important}.fixed.inset-0.z-\[70\]{z-index:154!important}
.fixed.inset-0.z-\[80\]{z-index:156!important}.fixed.inset-0.z-\[100\]{z-index:158!important}
.selection-backdrop{z-index:195!important}
.ae-story{z-index:185!important}

/* item tiles: rarity colors, badges */
[data-ae-rarity=common]{--ae-r:#9ca3af}[data-ae-rarity=uncommon]{--ae-r:#22c55e}[data-ae-rarity=rare]{--ae-r:#3b82f6}[data-ae-rarity=epic]{--ae-r:#a855f7}[data-ae-rarity=legendary]{--ae-r:#f59e0b}[data-ae-rarity=mythic]{--ae-r:#ef4444}
.ae-tile{position:relative!important;box-shadow:inset 0 0 0 2px var(--ae-r),0 0 10px -2px var(--ae-r)!important;border-color:var(--ae-r)!important}
.ae-tile[data-ae-rarity=common]{box-shadow:inset 0 0 0 1px var(--ae-r)!important}
.ae-tile::after{content:"";position:absolute;left:0;right:0;bottom:0;height:3px;background:var(--ae-r);border-radius:0 0 6px 6px;pointer-events:none}
.ae-tile .inventory-bag-upgrade{display:none!important}
.ae-badges{position:absolute;inset:0;pointer-events:none;z-index:3;font:700 10px/1 system-ui,sans-serif}
.ae-badges b{position:absolute;padding:2px 4px;border-radius:6px;background:#000c;color:#fff;text-shadow:0 1px 1px #000}
.ae-b-up{top:3px;left:3px;color:#fde68a!important}.ae-b-asc{top:3px;right:3px;color:#fcd34d!important;background:#3b2a05e6!important}.ae-b-lvl{bottom:5px;left:3px;color:#cbd5e1!important}
.modern-item-card .ae-badges .ae-b-lvl{bottom:auto;top:24px}
/* land icons */
img.ae-land-icon{width:40px!important;height:40px!important;border-radius:50%;object-fit:cover}
.region-map-seal img.ae-land-icon{width:44px!important;height:44px!important}
.ae-land-box{width:44px!important;height:44px!important;border:0!important;background:none!important;padding:0!important}
.region-dispatch .region-dispatch-name{font-size:15px!important;line-height:1.2!important;margin:0!important}.region-dispatch .region-starter-stamp{font-size:9px!important}.region-dispatch .region-dispatch-meta{font-size:11px!important}
.region-dispatch-heading{margin-bottom:2px!important}.region-dispatch>.pt-1{padding-top:0!important}
.ae-duel-panel{max-height:96vh!important}
.ae-arena{position:relative;border-radius:14px;padding:10px;background:linear-gradient(#0009,#000c),url(/assets/arena-D132A-sN.webp) center/cover;border:1px solid #c9a35a55;margin-bottom:8px}
.ae-arena-turn{position:absolute;top:8px;right:10px;font:700 11px system-ui,sans-serif;color:#e5c678;background:#0008;padding:3px 8px;border-radius:999px}
.ae-duelist{display:flex;gap:10px;align-items:flex-end}.ae-duelist.is-me{flex-direction:row-reverse;text-align:right}
.ae-duelist-img{width:96px;height:130px;object-fit:contain;object-position:bottom;filter:drop-shadow(0 6px 10px #000c)}.ae-duelist.is-foe .ae-duelist-img{transform:scaleX(-1)}
.ae-duelist-info{flex:1;min-width:0;display:flex;flex-direction:column;gap:4px}.ae-duelist-info b{color:#f3e2b6;font:700 15px Georgia,serif}.ae-duelist-info small{color:#cbb98f;font-size:11px}
.ae-duelist.is-me .ae-chips{justify-content:flex-end}
.ae-vs{text-align:center;font:900 18px Georgia,serif;color:#e5c678;text-shadow:0 0 12px #e5c67888;margin:2px 0}
.ae-spell.is-ready{border-color:#ffd36a!important;box-shadow:0 0 14px #ffd36a55}
.ae-duel-log .is-me{color:#f3d79a}.ae-duel-log .is-foe{color:#ff9a8a}
/* modern «Меню»: compact tiles in the game's style */
.mechanics-group{background:none!important;border:0!important;box-shadow:none!important;padding:0!important;margin-top:14px!important}
.mechanics-group>header{display:flex;align-items:baseline;justify-content:space-between;gap:8px;margin-bottom:8px}.mechanics-group>header h2{margin:0}.mechanics-group>header p{margin:0;font-size:11px!important}
.mechanics-grid{display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:8px!important}
.mechanics-entry{position:relative!important;display:block!important;border:0!important;background:none!important;padding:0!important;box-shadow:none!important}
.mechanics-entry>button:first-child{width:100%!important;min-height:66px;display:flex!important;flex-direction:column!important;align-items:center!important;justify-content:center!important;gap:5px!important;padding:8px 4px!important;border:1px solid #b08d4f8c!important;border-radius:10px!important;background:linear-gradient(#2a241a,#18150f)!important;text-align:center!important;color:#f0e2c2!important}
.mechanics-entry>button:first-child>span[aria-hidden="true"]:last-child:not(.reference-icon){display:none!important}
.mechanics-entry-label{font-size:12px!important;line-height:1.2!important;word-break:normal!important;overflow-wrap:normal!important;hyphens:none!important;white-space:normal}
.mechanics-pin{position:absolute!important;top:2px!important;right:2px!important;width:22px!important;height:22px!important;min-width:0!important;min-height:0!important;padding:0!important;border:0!important;background:none!important;font-size:12px!important;line-height:22px!important;opacity:.55;z-index:1}
.mechanics-entry:has(.mechanics-pin[aria-pressed="true"]),.mechanics-entry:has(.mechanics-pin[aria-label$=": Герой"]){display:none!important}
.mechanics-menu-scroll>.mechanics-utilities{display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:8px!important;margin-top:14px!important;background:none!important;border:0!important;padding:0!important}
.mechanics-menu-scroll>.mechanics-utilities>button{min-height:58px;display:flex!important;flex-direction:column!important;align-items:center!important;justify-content:center!important;gap:4px!important;padding:8px 4px!important;border:1px solid #b08d4f8c!important;border-radius:10px!important;background:linear-gradient(#2a241a,#18150f)!important;color:#f0e2c2!important;font-size:12px!important;text-align:center!important;width:auto!important}
.mechanics-menu-scroll>.mechanics-utilities>button.ae-hide,.mechanics-group .mechanics-entry.ae-dup,.mechanics-menu-scroll>.mechanics-group.ae-empty{display:none!important}
.mechanics-entry:has(.mechanics-pin[aria-label$=": Спутники"]) .reference-icon{background:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 28 28' fill='none' stroke='%23efe3c6' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'%3E%3Ccircle cx='8.5' cy='11' r='2.3'/%3E%3Ccircle cx='12.5' cy='6.8' r='2.3'/%3E%3Ccircle cx='17.5' cy='6.8' r='2.3'/%3E%3Ccircle cx='21.5' cy='11' r='2.3'/%3E%3Cpath d='M9.5 20.5c0-3.3 2.4-6.5 5.5-6.5s5.5 3.2 5.5 6.5c0 2.1-2 2.6-3.1 2.3-1-.3-1.5-.7-2.4-.7s-1.4.4-2.4.7c-1.1.3-3.1-.2-3.1-2.3z'/%3E%3C/svg%3E") center/25px 25px no-repeat}.mechanics-entry:has(.mechanics-pin[aria-label$=": Спутники"]) .reference-icon>*{visibility:hidden}
.ae-line-icon{width:25px;height:25px;display:inline-flex!important;align-items:center;justify-content:center;color:inherit}
.modern-resource[data-ae-cur] > span:first-child svg{display:none}
.modern-resource[data-ae-cur] > span:first-child{width:34px!important;height:28px!important;flex:0 0 34px!important;margin-right:2px;background:center/contain no-repeat}
.modern-resource[data-ae-cur=gold] > span:first-child{background-image:url(/assets/sprites/generated/ui/icons/gold.webp)}.modern-resource[data-ae-cur=gold] b{color:#f6cf6b}
.modern-resource[data-ae-cur=silver] > span:first-child{background-image:url(/assets/sprites/generated/ui/icons/silver.webp)}.modern-resource[data-ae-cur=silver] b{color:#d7dde6}
/* battle mode: the add-on panel becomes a copy of the game's own combat screen */
.ae-backdrop.ae-battle-backdrop{padding:0!important;background:none!important;align-items:stretch!important;z-index:35!important;top:var(--bv-top,0)!important}
.ae-battle-backdrop .ae-panel.ae-battle-mode{top:var(--bv-top,0)!important;height:auto!important}
.ae-panel.ae-battle-mode .ae-head{display:none!important}
.ae-panel.ae-battle-mode{position:fixed!important;inset:0!important;width:100%!important;max-width:none!important;max-height:none!important;height:100%!important;border-radius:0!important;border:0!important;box-shadow:none!important;background-color:var(--bv-bg,#0b0d10)!important;background-image:var(--bv-bgi,none)!important;display:flex;flex-direction:column}
.ae-panel.ae-battle-mode .ae-head{position:absolute;top:8px;right:8px;z-index:6;padding:0!important;border:0!important;background:none!important}.ae-panel.ae-battle-mode .ae-head h2{display:none}
.ae-panel.ae-battle-mode .ae-head .ae-x{width:30px;height:30px;border-radius:50%;background:#000a;border:1px solid #ffffff33}
.ae-panel.ae-battle-mode>.ae-body{flex:1;overflow:auto;padding:0 0 calc(var(--bv-nav,70px) + 24px + env(safe-area-inset-bottom))!important;max-height:none!important}

.ae-bv .ae-act-cd{position:absolute;inset:0;display:none;align-items:center;justify-content:center;color:#fff;font:700 13px system-ui,sans-serif;font-style:normal;pointer-events:none;border-radius:inherit}
.ae-bv .ae-bv-sec{position:relative;overflow:hidden}.ae-bv-timer{display:block;font-size:10.5px;color:#e5c678;margin-top:2px}
.ae-bv-party{margin-top:8px;display:flex;flex-direction:column;gap:6px}.ae-bv-members{display:flex;flex-direction:column;gap:6px}
.ae-bv-member{display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:10px;background:#00000055;border:1px solid #ffffff1c}.ae-bv-member .ae-avatar{width:38px;height:38px}.ae-bv-member small{font-size:10.5px;opacity:.8}.ae-bv-member b{font-size:12.5px}
.ae-bv{max-width:448px;width:100%;margin:0 auto;box-sizing:border-box}
.ae-bv.modern-shell{background:none!important}.ae-bv.shell-main{padding-bottom:0!important;max-width:448px!important}.ae-bv-sub{display:block;font-size:10px;opacity:.75;font-weight:500;line-height:1.2;margin-top:2px;text-transform:none;letter-spacing:0}
.ae-bv .combat-action{position:relative;overflow:hidden}.ae-bv .combat-action:disabled,.ae-bv button:disabled{opacity:.5}
.ae-bv .ae-combo-glow{animation:ae-pulse .8s ease-in-out infinite;box-shadow:0 0 16px #ffd36a99!important;border-color:#ffd36a!important}
.ae-horde-panel{max-height:96vh!important}.ae-horde-panel.is-blood{background:linear-gradient(#2a0707,#120404)!important;border-color:#c0303099!important;box-shadow:0 0 40px #a0101066!important}
.ae-horde-hero{display:flex;flex-direction:column;gap:6px;padding:16px 14px;margin-bottom:10px;border-radius:14px;background:linear-gradient(#0008,#000c),url(/assets/arena-D132A-sN.webp) center/cover;border:1px solid #c9a35a55}
.ae-horde-hero b{font:800 22px Georgia,serif;color:#ffe6a8}.ae-horde-hero span{font-size:13px;color:#e9dcc0;line-height:1.4}
.ae-horde-go{display:flex!important;flex-direction:column;align-items:center;gap:2px;min-height:58px;margin:8px 0!important}.ae-horde-go b{font-size:16px}.ae-horde-go small{font-size:11px;opacity:.85}
.ae-horde-go.is-blood{background:linear-gradient(#7a1414,#3d0808)!important;border:1px solid #e0505099!important;color:#ffd9d0!important}
.ae-horde-top{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:6px}.ae-horde-kills b{display:block;font:900 26px/1 Georgia,serif;color:#ffe6a8}.ae-horde-kills small{font-size:11px;color:#bfae8c}
.ae-horde-loot{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end;font:700 13px system-ui,sans-serif}.ae-horde-loot span{background:#ffffff12;border-radius:999px;padding:3px 8px}
.ae-horde-stage{position:relative;display:flex;gap:8px;align-items:flex-end;margin:8px 0;padding:10px;border-radius:14px;background:linear-gradient(#0007,#000b),url(/assets/arena-D132A-sN.webp) center/cover;border:1px solid #c9a35a44;min-height:250px}
.ae-horde-stage.is-blood{background:radial-gradient(circle at 80% 8%,#ff4a3a 0 26px,#ff4a3a55 27px,transparent 60px),linear-gradient(#3a0505aa,#000d),url(/assets/arena-D132A-sN.webp) center/cover;border-color:#e0505088}
.ae-horde-foe{flex:1;min-width:0;display:flex;flex-direction:column;align-items:center;gap:4px}.ae-horde-foe img{width:100%;max-width:170px;height:170px;object-fit:contain;filter:drop-shadow(0 8px 12px #000)}
.ae-avatar{width:56px;height:56px;border-radius:50%;object-fit:cover;object-position:center 20%;border:2px solid #c9a35a;background:#111;box-shadow:0 0 0 3px #0006}.ae-avatar.is-big{width:84px;height:84px;flex:0 0 84px}
.ae-header-avatar{border-radius:50%!important;object-fit:cover!important;object-position:center 20%!important;cursor:pointer}
.ae-prof-head{display:flex;gap:12px;align-items:center;margin-bottom:10px}.ae-prof-name{font:700 19px Georgia,serif;color:#f3e2b6}
.ae-title-badge{display:inline-block;margin-top:5px;padding:3px 10px;border-radius:999px;background:linear-gradient(#5a4316,#2c210b);border:1px solid #e5c678;color:#ffe6a8;font:700 12px system-ui,sans-serif}
.ae-prof-stats{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 10px}.ae-prof-stats span{font-size:11.5px;padding:4px 8px;border-radius:999px;background:#ffffff10;border:1px solid #ffffff1c}
.ae-tabs{display:flex;gap:6px;margin:6px 0 10px}.ae-pill-btn{flex:1;padding:8px;border-radius:10px;border:1px solid #ffffff22;background:#ffffff0d;color:inherit;font:600 12.5px system-ui,sans-serif;cursor:pointer}.ae-pill-btn.is-on{border-color:#e5c678;background:#e5c67822;color:#ffe6a8}
.ae-avatar-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}.ae-avatar-pick{display:flex;flex-direction:column;align-items:center;gap:4px;padding:6px 2px;border:0;background:none;color:inherit;cursor:pointer}
.ae-avatar-pick small{font-size:10px;text-align:center;line-height:1.15;opacity:.85}.ae-avatar-pick.is-on .ae-avatar{border-color:#6fe39a;box-shadow:0 0 0 3px #6fe39a55}
.ae-title-row{display:flex;align-items:center;gap:10px;margin:6px 0}.ae-title-row.is-locked{opacity:.62}.ae-title-row.is-on{border-color:#e5c678!important;background:#e5c67814!important}.ae-title-row .ae-bar{margin-top:5px}
.ae-title-icon{font-size:24px;width:30px;text-align:center}
.ae-horde-player{flex:0 0 32%;display:flex;flex-direction:column;align-items:center;gap:4px}.ae-horde-player img{width:100%;height:170px;object-fit:contain;object-position:bottom;filter:drop-shadow(0 8px 12px #000)}.ae-horde-player .ae-bar{width:100%}
.ae-horde-player .ae-horde-name{font-size:13px}.ae-horde-foe .ae-horde-name{font-size:13px}
.ae-horde-foe.is-elite img{filter:drop-shadow(0 0 12px #e0913f) drop-shadow(0 8px 12px #000)}.ae-horde-foe.is-leader img{width:230px;height:230px;filter:drop-shadow(0 0 18px #ff5a5a) drop-shadow(0 8px 12px #000)}
.ae-horde-name{font:700 15px Georgia,serif;color:#f3e2b6;text-shadow:0 2px 4px #000;text-align:center}.ae-horde-foe .ae-bar{width:100%}
.ae-horde-queue{display:flex;flex-direction:column;gap:6px}.ae-horde-q{width:54px;height:54px;border-radius:12px;background:#0009;border:1px solid #ffffff22;display:flex;align-items:center;justify-content:center}.ae-horde-q img{width:48px;height:48px;object-fit:contain;opacity:.85}
.ae-horde-q.is-leader{border-color:#ff5a5a}.ae-horde-q.is-elite{border-color:#e0913f}
.ae-horde-me{margin:4px 0 8px}.ae-horde-me small{font-size:11px;color:#bfae8c}
.ae-horde-attack{background:linear-gradient(#8a6a2a,#4a3510)!important;border-color:#f0cf7a!important}.ae-horde-auto.is-on{background:linear-gradient(#1f6a4a,#0e3a28)!important;border-color:#6fe39a!important;animation:ae-pulse 1s ease-in-out infinite}
.ae-float.is-big{font-size:26px}
.ae-chat-coop{display:flex;align-items:center;gap:8px;cursor:default}.ae-chat-coop img{width:40px;height:40px;border-radius:50%;flex:0 0 40px}.ae-chat-coop .ae-btn{flex:0 0 auto;padding:7px 12px}
.ae-welcome .ae-story-card{max-height:92vh;display:flex;flex-direction:column}.ae-welcome .ae-story-card>img{max-height:28vh;object-fit:cover}.ae-welcome .ae-story-text{overflow:auto}
.ae-welcome-list{display:flex;flex-direction:column;gap:6px;margin:8px 0 12px;text-align:left}.ae-welcome-item{border:1px solid #c9a35a55;border-radius:10px;background:#0006;padding:8px 10px}
.ae-welcome-item summary{cursor:pointer;display:flex;flex-direction:column;gap:2px;list-style:none}.ae-welcome-item summary::-webkit-details-marker{display:none}.ae-welcome-item summary b{color:#f3e2b6;font:700 14px Georgia,serif}.ae-welcome-item summary small{color:#bfae8c;font-size:11px;text-transform:none;letter-spacing:0}
.ae-welcome-item .ae-news-text{margin-top:6px;font-size:12.5px}.ae-welcome .ae-story-text>.ae-row:last-child{gap:8px;position:sticky;bottom:-1px;margin:0 -16px -16px;padding:14px 16px 16px;background:linear-gradient(#14110d00,#14110d 22%,#14110d);box-shadow:0 30px 0 #14110d}
.ae-news h3{margin:2px 0 8px;font:700 17px Georgia,serif;color:#f3e2b6}.ae-news small{color:#bfae8c;font-size:11px}.ae-news-text{font-size:13.5px;line-height:1.5}.ae-news-text code{background:#ffd36a22;border:1px dashed #ffd36a88;border-radius:6px;padding:1px 6px;color:#ffe08a;cursor:pointer;font-weight:700}
.ae-news-text a{color:#7cc4ff}.ae-news-input{width:100%;min-height:140px;margin:6px 0;resize:vertical;font:13px/1.4 system-ui,sans-serif}[data-ae-news-btn],.ae-entry-btn{position:relative}
.ae-emoji-icon{font-size:22px;line-height:1;width:25px;height:25px;display:inline-flex!important;align-items:center;justify-content:center}
.mechanics-favorites>div>button{position:relative}.ae-unpin{position:absolute;top:2px;right:5px;color:#e5c678;font-size:12px;cursor:pointer}
/* modern interface: add-on controls in the modern look (slate cards, no fantasy gold) */
html[data-interface=modern] .ae-quick{gap:8px}
html[data-interface=modern] .ae-quick-btn{flex-direction:row!important;justify-content:flex-start!important;text-align:left!important;gap:8px!important;min-height:46px;padding:8px 10px!important;border:1px solid #2b3a52!important;border-radius:12px!important;background:#111a2b!important;color:#e2e8f0!important;font-family:inherit!important}
html[data-interface=modern] .ae-quick-btn span{font-size:18px!important}html[data-interface=modern] .ae-quick-btn b{color:#e2e8f0!important;font:600 12.5px system-ui,sans-serif!important}html[data-interface=modern] .ae-quick-btn small{display:none}
html[data-interface=modern] .ae-quick-btn:active{background:#18243a!important}
html[data-interface=modern] .ae-bag-merge{border:1px solid #2b3a52!important;border-radius:12px!important;background:#111a2b!important;color:#e2e8f0!important;font-family:system-ui,sans-serif!important}
html[data-interface=modern] .ae-bag-merge b{color:#e2e8f0!important}html[data-interface=modern] .ae-bag-merge small{color:#94a3b8!important}html[data-interface=modern] .ae-bag-merge.has-pairs{border-color:#22d3ee88!important}
html[data-interface=modern] section:has(>[data-ae-bag-merge]){border-color:#2b3a52!important;background:#0d1524!important}
html[data-interface=modern] .ae-qbadge{top:-6px;right:-6px}
/* modern «Мир»: compact header and current-land card */
html[data-interface=modern] .world-current-landscape{height:92px!important;max-height:92px!important;object-fit:cover!important}
/* «Мир»: the "go to the fields" card belongs to the Lands tab only */
.world-hub:not([data-world-section="lands"]) .world-current{display:none!important}
/* «Поселение»: compact place tiles, 3 per row */
/* «Сумка» (modern): smaller item tiles, 5 per row */
.modern-item-grid{grid-template-columns:repeat(5,minmax(0,1fr))!important;gap:5px!important}
.modern-item-card{min-height:0!important;padding:4px 3px 5px!important}.modern-item-card>div:nth-child(n+4){display:none!important}
.modern-item-card>div:first-child{height:32px!important;margin-top:2px!important}.modern-item-card>div:first-child img{width:32px!important;height:32px!important}
.modern-item-card>div:nth-child(2){min-height:22px!important;max-height:22px!important;font-size:8.5px!important;line-height:11px!important}.modern-item-card>div:nth-child(3){font-size:8.5px!important}
html[data-interface=modern] .world-current-body{padding:8px 10px!important}html[data-interface=modern] .world-current-body h2{font-size:17px!important;line-height:1.2!important;margin:0 0 4px!important}
.ae-qbadge{position:absolute;top:4px;right:6px;min-width:18px;height:18px;border-radius:9px;background:#e0443e;color:#fff;font:700 11px/18px system-ui,sans-serif;text-align:center;font-style:normal}
.ae-quest.is-done{border-color:#e5c67899}.ae-quest.is-claimed{opacity:.6}.ae-quest .ae-bar{margin:6px 0}
.ae-market-dep{margin-top:6px;width:100%}
.pet-artwork[aria-label="Эфирный пустотник"]{background:url(/assets/pets/art-pet_voidling.webp) center/cover no-repeat!important}.pet-artwork[aria-label="Эфирный пустотник"]>*{opacity:0!important}
.ae-pet-icon{color:transparent!important;background-size:cover;background-position:center;border-radius:12px;min-width:1.15em;min-height:1.15em;display:inline-block}
/* compact hunt mode picker */
.region-dispatch:not(.ae-modes-open) .hunting-mode-values,.region-dispatch:not(.ae-modes-open) .hunting-mode-lock,.region-dispatch:not(.ae-modes-open) p.hunting-mode-description{display:none!important}
.region-dispatch:not(.ae-modes-open) .hunting-mode-entry{display:flex!important;align-items:center;justify-content:center;min-height:40px!important}.region-dispatch:not(.ae-modes-open) .hunting-mode-entry>div{margin:0!important}
.hunting-mode-entry.ae-mode-locked .hunting-mode-name::after{content:' 🔒';font-size:10px}
.ae-modes-toggle{display:block;width:100%;margin:4px 0 0;padding:6px;border:1px dashed #9a7a4a88;border-radius:8px;background:none;color:inherit;font:600 12px Georgia,serif;opacity:.85;cursor:pointer}
.region-dispatch{padding:10px!important}.region-dispatch>*+*{margin-top:6px!important}
.region-dispatch .region-dispatch-description{display:none!important}
.region-dispatch .grid.grid-cols-2:has(.hunting-mode-entry){grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:6px!important}
.hunting-mode-entry{padding:6px!important;min-height:0!important}
.hunting-mode-entry .hunting-mode-name{font-size:11.5px!important;line-height:1.15}
.hunting-mode-values{font-size:10px!important;line-height:1.3!important}
.hunting-mode-entry p,.hunting-mode-entry [class*=lock],.hunting-mode-entry [class*=closed]{display:-webkit-box!important;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;font-size:10px!important}
.hunting-mode-heading,.hunting-mode-description{font-size:11px!important;margin:0!important}
/* toasts */
.ae-pop{position:fixed;left:50%;top:calc(10px + env(safe-area-inset-top));transform:translate(-50%,-140%);z-index:199;display:flex;align-items:center;gap:8px;width:min(94vw,460px);padding:10px 10px 10px 12px;border-radius:14px;background:#141a21f5;color:#f1ead8;border:1px solid #e5c678;box-shadow:0 12px 30px #000a;font:13px/1.35 system-ui,sans-serif;transition:transform .3s}
.ae-pop.is-on{transform:translate(-50%,0)}.ae-pop-i{font-size:22px}.ae-pop .ae-btn{min-height:36px}.ae-pop-x{background:none;border:0;color:#94a3b8;font-size:20px;min-width:32px;min-height:36px;cursor:pointer}
/* duels */
.ae-bar.is-mp{height:12px;margin-top:4px}.ae-bar.is-mp i{background:linear-gradient(90deg,#1d4ed8,#60a5fa)}.ae-bar.is-mp span{font-size:9px;line-height:12px}
.ae-result{text-align:center;font-size:16px}.ae-result.is-win{border-color:#22c55e;background:#14532d55}.ae-result.is-loss{border-color:#ef4444;background:#7f1d1d55}
.ae-code{font:700 14px ui-monospace,monospace;letter-spacing:.06em;color:#fde68a}
/* nicknames */
.ae-nick{cursor:pointer;text-decoration:underline dotted;text-underline-offset:3px}.ae-nick:hover{color:#fde68a}
/* items in chat */
.ae-chat-item{display:flex;align-items:center;gap:8px;width:100%;max-width:320px;margin-top:4px;padding:6px 8px;text-align:left;border-radius:10px;border:2px solid var(--ae-r,#9ca3af);background:#0b0f14d9;color:#f1ead8;font:12px/1.3 system-ui,sans-serif;cursor:pointer}
.ae-chat-item img{width:34px;height:34px;object-fit:contain}.ae-chat-item b{display:block;color:var(--ae-r)}.ae-chat-item small{display:block;opacity:.8}
.ae-chat-item .ae-chat-item-stats{display:none}.ae-chat-item.is-open .ae-chat-item-stats{display:block;color:#86efac}

.ae-travel{margin:-4px -4px 10px;border-radius:12px;overflow:hidden;position:relative}.ae-travel-pic{position:relative}.ae-travel-pic::after{content:'';position:absolute;inset:40% 0 0;background:linear-gradient(transparent,#000d);pointer-events:none}.ae-travel figcaption{z-index:1}.ae-travel img{display:block;width:100%;aspect-ratio:9/5;object-fit:cover}
.ae-travel figcaption{position:absolute;left:0;right:0;bottom:0;padding:10px 12px;color:#f3e6c4;font:13px/1.4 Georgia,serif;text-align:left;text-shadow:0 1px 2px #000}
.ae-travel figcaption small{display:block;color:#e5c678;font:700 10px system-ui,sans-serif;letter-spacing:.1em;text-transform:uppercase}
html[data-interface=fantasy] .rpg-button-secondary.inventory-ink,html[data-interface=fantasy] .rpg-button-secondary.inventory-ink *{color:#f0dfb6!important}
[data-ae-empty-slot]{cursor:pointer}[data-ae-empty-slot]:hover,[data-ae-empty-slot]:focus-visible{filter:brightness(1.25);outline:1px dashed #d8b46a99;outline-offset:-3px}
.ae-equip-row{width:100%;margin:6px 0;cursor:pointer}.ae-equip-row.is-locked{opacity:.6}.ae-equip-go{flex:0 0 auto;font:700 12px system-ui,sans-serif;color:#1d1408;background:linear-gradient(#f0cf7a,#c99a3c);border-radius:8px;padding:7px 10px}.ae-equip-row.is-locked .ae-equip-go{background:#ffffff1a;color:#ddd}
.ae-travel-card{padding:0!important;background:#0b0d10!important;border:1px solid #c9a35a77!important;border-radius:16px!important;overflow:hidden;box-shadow:0 20px 60px #000c!important;max-width:420px!important;width:100%}
.ae-travel-card>:not(.ae-travel){display:none!important}
.ae-travel-card>.ae-travel{margin:0!important;border-radius:0!important}
.ae-travel-info{padding:12px 14px 14px;background:linear-gradient(#14110d,#0b0d10);text-align:left}
.ae-travel-dest{display:block;color:#f3e2b6;font:700 18px/1.25 Georgia,serif;margin-bottom:10px}
.ae-travel-bar{height:10px;border-radius:999px;background:#ffffff14;overflow:hidden;border:1px solid #c9a35a44}
.ae-travel-bar>span{display:block;height:100%;width:0;border-radius:inherit;background:linear-gradient(90deg,#8f6a2a,#e8c271,#8f6a2a);background-size:200% 100%;transition:width .15s linear;animation:ae-travel-shine 1.6s linear infinite}
@keyframes ae-travel-shine{from{background-position:200% 0}to{background-position:0 0}}
.ae-travel-meta{display:flex;justify-content:space-between;gap:8px;margin-top:7px;color:#bfae8c;font:12px system-ui,sans-serif}.ae-travel-meta strong{color:#e8c271}
.ae-moonshine{margin-top:8px;padding:10px;border-radius:12px;border:1px solid #b4975680;background:#2a1b0c33;display:flex;flex-direction:column;gap:6px}
.ae-stages{display:flex;gap:4px;justify-content:center}.ae-stages i{font-style:normal;width:30px;height:30px;border-radius:50%;display:grid;place-items:center;font:700 12px system-ui;border:1px solid #ffffff33;color:#94a3b8}
.ae-stages i.is-done{background:#14532d;color:#86efac;border-color:#22c55e}.ae-stages i.is-now{background:#8f6a24;color:#fff;border-color:#e5c678;box-shadow:0 0 10px #e5c67888}
.ae-path{display:flex;flex-direction:column;gap:8px}.ae-path.is-voted{border-color:#e5c678}

.ae-quick{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px;margin:8px 0}
.ae-quick-btn{display:grid;grid-template-columns:auto 1fr;grid-template-rows:auto auto;column-gap:8px;align-items:center;min-height:52px;padding:8px 10px;text-align:left;border-radius:12px;border:1px solid #d6b46a;background:linear-gradient(100deg,#3a2c14e6,#1a1510e6);color:#f3e6c4;font:inherit;cursor:pointer}
.ae-quick-btn span{grid-row:1/3;font-size:22px}.ae-quick-btn b{font-size:13px;color:#f3d79a}.ae-quick-btn small{font-size:10.5px;opacity:.8}
.ae-quick-btn{position:relative;display:flex!important;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:1px;padding:7px 4px!important}.ae-quick-btn span{font-size:20px!important}.ae-quick-btn small{font-size:9.5px!important;line-height:1.15}
/* dungeon icons */
[data-ae-dungeon] span.grid:first-child{width:52px!important;height:52px!important;border:0!important;border-radius:50%!important;background:center/cover no-repeat transparent!important;filter:drop-shadow(0 3px 6px #0009)}
[data-ae-dungeon] span.grid:first-child>*{display:none!important}
[data-ae-dungeon=bat_cave] span.grid:first-child{background-image:url(/assets/dungeons/dungeon-bat_cave.webp)!important}
[data-ae-dungeon=old_mine] span.grid:first-child{background-image:url(/assets/dungeons/dungeon-old_mine.webp)!important}
[data-ae-dungeon=spider_lair] span.grid:first-child{background-image:url(/assets/dungeons/dungeon-spider_lair.webp)!important}
[data-ae-dungeon=catacombs] span.grid:first-child{background-image:url(/assets/dungeons/dungeon-catacombs.webp)!important}
[data-ae-dungeon=demon_rift] span.grid:first-child{background-image:url(/assets/dungeons/dungeon-demon_rift.webp)!important}
[data-ae-dungeon=dragon_cave] span.grid:first-child{background-image:url(/assets/dungeons/dungeon-dragon_cave.webp)!important}
.ae-dthumb{width:48px;height:48px;flex:0 0 48px;border-radius:50%}
.ae-scene{margin:8px 0;padding:10px 12px;border-radius:12px;background:linear-gradient(135deg,#2a2116,#15120e);border:1px solid #c9a35a44;color:#e9dcc0;font:13px/1.45 Georgia,serif}.ae-scene small{display:block;color:#d9b66a;font:700 10px system-ui,sans-serif;letter-spacing:.08em;text-transform:uppercase;margin-bottom:3px}
.ae-foe.is-elite{border-color:#e0913f88}.ae-foe.is-boss{border-color:#e05a5a99;box-shadow:0 0 18px #e05a5a33}.ae-foe-tag{font:700 10px system-ui,sans-serif;text-transform:uppercase;letter-spacing:.06em;padding:3px 7px;border-radius:999px;background:#ffffff14}
.ae-foe-desc{margin:4px 0 6px;color:#cbbfa8;font:italic 12px/1.4 Georgia,serif}
.ae-intent{display:flex;gap:8px;align-items:center;margin-top:8px;padding:8px 10px;border-radius:10px;background:#ffffff0d;border:1px solid #ffffff1c;font-size:13px}.ae-intent small{display:block;color:#bfae8c;font-size:11px}.ae-intent-i{font-size:20px}
.ae-intent.is-heavy{border-color:#f09a3e88;background:#f09a3e14}.ae-intent.is-aoe{border-color:#ef5b5b99;background:#ef5b5b16}.ae-intent.is-me{box-shadow:inset 0 0 0 1px #ffd36a99}
.ae-tip{margin-top:6px;color:#e8d29a;font-size:12px}
.ae-act{position:relative;overflow:hidden;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;min-height:52px;text-align:center}.ae-act small{font-size:10px;opacity:.75;font-weight:400}
.ae-act-cd{position:absolute;inset:0;display:none;align-items:center;justify-content:center;color:#fff;font:700 13px system-ui,sans-serif;font-style:normal;pointer-events:none}
.ae-act.is-cd{cursor:default}
.ae-spell{width:100%;margin:8px 0 6px;background:linear-gradient(135deg,#3a2a5c,#1d1630)!important;border-color:#9b7be088!important}.ae-spell.is-combo{animation:ae-pulse 0.8s ease-in-out infinite;border-color:#ffd36a!important;box-shadow:0 0 18px #ffd36a77}
@keyframes ae-pulse{50%{transform:scale(1.025);box-shadow:0 0 28px #ffd36aaa}}
.ae-chips{display:flex;flex-wrap:wrap;gap:6px;margin:6px 0}.ae-chip{font-size:11px;padding:4px 8px;border-radius:999px;background:#ffffff12;border:1px solid #ffffff22}
.ae-chain{margin:6px 0;padding:9px 11px;border-radius:12px;border:1px dashed #ffd36a88;background:#ffd36a10;font-size:12px}.ae-chain b{display:block;color:#ffd36a;font-size:13px}.ae-chain small{color:#e9cf8a}.ae-chain.is-ready{border-style:solid;background:#ffd36a22;animation:ae-pulse 1s ease-in-out infinite}
.ae-pings{display:flex;gap:5px;flex-wrap:wrap;margin:8px 0}.ae-ping{flex:1 1 auto;font:600 11px system-ui,sans-serif;padding:7px 6px;border-radius:9px;border:1px solid #ffffff22;background:#ffffff0d;color:inherit;cursor:pointer}
.ae-combos{margin:6px 0 8px;font-size:12px}.ae-combos summary{cursor:pointer;color:#e5c678}.ae-combo-row{display:grid;grid-template-columns:28px 110px 1fr;gap:6px;align-items:center;padding:3px 0}
.ae-shake{animation:ae-shake .38s}@keyframes ae-shake{20%{transform:translateX(-5px)}40%{transform:translateX(5px)}60%{transform:translateX(-3px)}80%{transform:translateX(2px)}}
.ae-member.ae-hit{animation:ae-hitflash .6s}@keyframes ae-hitflash{0%,60%{box-shadow:inset 0 0 0 2px #ff5a5a,0 0 14px #ff5a5a88;background:#ff5a5a1c}}
.ae-float{position:fixed;z-index:400;pointer-events:none;font:900 18px system-ui,sans-serif;text-shadow:0 2px 3px #000;animation:ae-float 1.1s ease-out forwards}.ae-float.is-dmg{color:#ffd36a}.ae-float.is-hurt{color:#ff6b6b}.ae-float.is-heal{color:#6fe39a}
@keyframes ae-float{to{transform:translateY(-46px);opacity:0}}
.ae-combo-banner{position:fixed;left:50%;top:32%;z-index:420;transform:translate(-50%,-50%) scale(.6);opacity:0;max-width:88vw;text-align:center;padding:14px 18px;border-radius:16px;background:linear-gradient(135deg,#3a2a12,#1b120a);border:2px solid #ffd36a;color:#ffe9a8;font:800 16px/1.35 Georgia,serif;box-shadow:0 0 40px #ffd36a88;transition:all .25s ease-out;pointer-events:none}
.ae-combo-banner.is-on{opacity:1;transform:translate(-50%,-50%) scale(1)}.ae-combo-banner.is-triple{border-color:#c79bff;box-shadow:0 0 60px #c79bffaa;color:#f3e3ff}
.ae-coop-card{display:flex;align-items:center;gap:10px;width:100%;min-height:76px;margin:8px 0;padding:10px 12px;text-align:left;border-radius:14px;border:1px solid #d6b46a;background:linear-gradient(100deg,#3a2c14e6,#1a1510e6);color:#f3e6c4;font:inherit;cursor:pointer;box-shadow:0 0 18px #d6b46a33}
.ae-coop-card b{display:block;font-size:15px;color:#f3d79a}.ae-coop-card small{display:block;font-size:12px;opacity:.8}
.ae-coop-icons{display:flex}.ae-coop-icons img{width:40px;height:40px;border-radius:50%;margin-left:-12px}.ae-coop-icons img:first-child{margin-left:0}.ae-coop-go{font-size:24px;color:#d6b46a}
/* compact fantasy navigation during combat: plain icons instead of shrunken frames */
html[data-in-combat] .fantasy-shell-nav{background:linear-gradient(#1f1a12,#0e0c09)!important;border-top:1px solid #a28a52!important}
html[data-in-combat] .fantasy-shell-nav .shell-ornament{display:none!important}
html[data-in-combat] .fantasy-shell-nav .game-nav-item>*{transform:none!important}
html[data-in-combat] .fantasy-shell-nav .game-nav-item{height:48px!important;font-size:0!important;gap:0!important;border-radius:0!important;position:relative}
html[data-in-combat] .fantasy-shell-nav .game-nav-item img{width:24px!important;height:24px!important;opacity:.7;transition:opacity .15s}
html[data-in-combat] .fantasy-shell-nav .game-nav-item.is-active img{opacity:1;filter:drop-shadow(0 0 6px #e5c678aa)}
html[data-in-combat] .fantasy-shell-nav .game-nav-item.is-active::after{content:"";position:absolute;left:28%;right:28%;top:0;height:2px;background:#e5c678;border-radius:2px}
html[data-in-combat] .fantasy-shell-nav .game-nav-item+.game-nav-item::before{content:"";position:absolute;left:0;top:14px;bottom:14px;width:1px;background:#a28a5240}
@keyframes aeIn{from{opacity:0}}@keyframes aeZoom{from{transform:scale(1.12)}to{transform:scale(1)}}
@media (prefers-reduced-motion:reduce){.ae-story,.ae-story-card img{animation:none}.ae-confetti{display:none}}`;
  document.head.append(h('style', {id: 'ae-styles'}, css));
  window.__aethOpen = {newsAdmin: () => openPanel('📰 Новости', b => b.append(adminNewsBlock())), mailAdmin: () => openPanel('✉️ Почта', b => b.append(adminMailBlock())), inbox: openInbox, merge: openMerge, friends: openFriends, coop: openCoop, wiki: openWiki, duel: openDuel, promo: openPromo, pulse: socialPulse, horde: () => openHorde(), profile: () => openProfile(), card: (id, name) => openPlayerCard(id, name), stats: () => openAdminStats(), quests: () => openSpecialQuests(), invite: () => openInvite(), clanHQ: t => openClanHQ(t), clanRaid: () => openClanRaid(), clanSearch: () => openClanSearch(), auction: t => openAuction(t), wallet: n => openMarketWallet(n), shareItem: it => openShareItem(it), clanDonate: () => openClanDonate(), clanDeposit: () => openClanDeposit(), gems: t => openGems(t), legend: () => makeLegendary(me()), gear: r => makeGear(me(), r)};
})();
