// Aethelgard add-ons: item merging, friends & private messages, co-op dungeons, wiki,
// story scenes for first visits, extra UI/combat sounds. Plain DOM, no build step.
// Talks to the game through window.__aethBridge (set by the game provider on every render).
(() => {
  if (window.__aethAddons) return;
  window.__aethAddons = true;
  const B = () => window.__aethBridge || null;
  const me = () => B()?.player || null;
  const uid = () => String(me()?.userId || '');

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
  async function api(path, method = 'GET', body) {
    const b = B(); if (!b) throw new Error('Игра ещё загружается.');
    return b.api(path, method === 'GET' ? {} : {method, body: JSON.stringify(body || {})});
  }
  const uuid4 = () => crypto.randomUUID();
  const fmt = n => Number(n || 0).toLocaleString('ru-RU');
  let toastTimer;
  function toast(text) {
    let t = document.querySelector('.ae-toast');
    if (!t) { t = h('div', {class: 'ae-toast', role: 'status'}); document.body.append(t); }
    t.textContent = text; t.classList.add('is-on'); clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('is-on'), 2600);
  }

  // ---------- panel ----------
  let openPanelState = null;
  function openPanel(title, render, {onClose, cls} = {}) {
    closePanel();
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
  const mergeKey = i => [baseName(i).toLocaleLowerCase(), i.rarity, i.type, ascOf(i)].join('|');
  const rank = i => (Number(i.level) || 0) * 1000 + (Number(i.upgradeLevel) || 0);
  function mergeGroups(p) {
    const groups = new Map();
    for (const i of p.inventory || []) {
      if (!isGear(i) || !free(i) || ascOf(i) >= MAX_ASC) continue;
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
  setInterval(() => { try { purgeGone(); } catch {} }, 700);
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
      for (const it of sameStack ? [base0] : [base0, donor0]) if (it.serverOwned) claimed.set(it.id, await claimFromServer(it));
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
  function bigBanner(text, triple) {
    const el = h('div', {class: 'ae-combo-banner' + (triple ? ' is-triple' : '')}, text.replace(/\s*\(.*?\)/, ''));
    document.body.append(el); setTimeout(() => el.classList.add('is-on'), 10); setTimeout(() => el.remove(), 2200);
  }
  const COOP_ACTS = [['attack', '⚔️ Атака', 'быстрый удар'], ['power', '💥 Мощный удар', '×2.2 урона'], ['heal', '💚 Лечение', 'самому раненому'], ['guard', '🛡️ Прикрыть', '−60% урона, враг бьёт вас']];
  function openCoop() {
    let state = null, friends = [], busy = false, cdEnd = {}, foeAt = 0, guardEnd = 0, chainEnd = 0, spellCd = 12000;
    let prevFoe = null, prevHp = {}, seenLog = null, shakeUntil = 0; const hitUntil = {}, floats = [];
    // Turn server state changes into feedback: damage numbers, shakes, flashes, combo banners, party signals.
    const feel = room => {
      if (!room) { prevFoe = null; return; }
      const t = Date.now(), f = room.foe;
      if (f && prevFoe && prevFoe.name === f.name && f.hp < prevFoe.hp) { floats.push({sel: '.ae-foe', text: '−' + fmt(prevFoe.hp - f.hp), cls: 'is-dmg'}); shakeUntil = t + 380; }
      prevFoe = f ? {name: f.name, hp: f.hp} : null;
      for (const m of room.members || []) {
        const was = prevHp[m.id];
        if (was != null && m.hp < was) { hitUntil[m.id] = t + 600; floats.push({sel: `[data-ae-member="${m.id}"]`, text: '−' + fmt(was - m.hp), cls: 'is-hurt'}); if (String(m.id) === uid()) { sfx.play('hit', 0.45); try { Telegram.WebApp.HapticFeedback.impactOccurred('medium'); } catch {} } }
        if (was != null && m.hp > was) floats.push({sel: `[data-ae-member="${m.id}"]`, text: '+' + fmt(m.hp - was), cls: 'is-heal'});
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
    const volatile = new Set(['nextIn', 'cooldowns', 'left', 'guardUntil', 'warcry', 'wall', 'mark']);
    const refresh = () => {
      const key = JSON.stringify(state, (k, v) => volatile.has(k) ? (typeof v === 'number' ? v > 0 : v ? 1 : 0) : v);
      if (key === lastKey && !floats.length) return paintCd();
      lastKey = key; st.rerender();
    };
    const absorb = room => {
      feel(room);
      const t = Date.now(), mine = room?.members?.find(m => String(m.id) === uid());
      if (mine?.spell?.cd) spellCd = mine.spell.cd; chainEnd = room?.chain ? t + room.chain.left : 0;
      if (mine?.cooldowns) for (const [k, v] of Object.entries(mine.cooldowns)) cdEnd[k] = t + v;
      foeAt = room?.foe?.nextIn != null ? t + room.foe.nextIn : 0; guardEnd = mine?.guardUntil ? t + mine.guardUntil : 0;
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
        body.append(h('h3', {class: 'ae-h3'}, room.isHost ? 'Куда ведём отряд?' : 'Развилка — лидер выбирает путь'));
        for (const o of room.options) body.append(h('div', {class: 'ae-card ae-path' + (room.myVote === o.id ? ' is-voted' : '')}, h('div', {class: 'ae-row'}, h('span', {class: 'ae-entry-icon'}, o.icon), h('div', {class: 'ae-grow'}, h('b', {}, o.name), h('div', {class: 'ae-sub'}, o.hint)), o.votes ? h('span', {class: 'ae-badge'}, '🗳 ' + o.votes) : ''),
          room.isHost ? h('button', {class: 'ae-btn ae-primary ae-wide', type: 'button', onclick: () => { sfx.play('page'); post('/api/coop/choose', {optionId: o.id}); }}, 'Вести отряд сюда') : h('button', {class: 'ae-btn ae-wide', type: 'button', onclick: () => post('/api/coop/vote', {optionId: o.id}, 'Голос отдан')}, room.myVote === o.id ? 'Ваш голос ✓' : 'Предложить этот путь')));
      }
      for (const m of room.members) body.append(h('div', {class: 'ae-card ae-member' + ((hitUntil[m.id] || 0) > Date.now() ? ' ae-hit' : ''), 'data-ae-member': String(m.id)}, h('div', {class: 'ae-row'}, h('b', {class: 'ae-grow'}, `${m.name}${String(m.id) === uid() ? ' (вы)' : ''}${String(m.id) === String(room.hostId) ? ' ⭐' : ''}`),
        h('span', {class: 'ae-sub'}, `${CLASS_RU[m.classId] || m.classId} · ${m.level} ур.${m.guardUntil > 0 ? ' · 🛡️ щит' : ''}`)), bar(m.hp, m.maxHp, m.hp ? '' : 'is-down'),
        m.atk ? h('div', {class: 'ae-sub'}, `⚔️ ${fmt(m.atk)} · 🛡️ ${fmt(m.def)}${m.healer ? ' · 💚 лекарь' : ''}${m.spell ? ` · ${m.spell.icon} ${m.spell.name}` : ''}${m.hp ? '' : ' · без сил'}`) : ''));
      const mine = room.members.find(m => String(m.id) === uid());
      if (room.status === 'lobby') {
        if (room.isHost) body.append(h('button', {class: 'ae-btn ae-primary ae-wide', disabled: room.members.length < 2, onclick: () => post('/api/coop/start', {}, 'В бой!')}, room.members.length < 2 ? 'Ждём хотя бы одного союзника…' : '⚔️ Начать поход'));
        else body.append(h('p', {class: 'ae-note'}, 'Ждём, когда лидер начнёт поход.'));
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
          h('p', {class: 'ae-sub'}, 'Примените способность сразу после союзника (за 5 с) — сработает связка двух стихий. Третий герой подряд — тройная связка с огромным уроном.'),
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
      if (ft) { const l = Math.max(0, foeAt - t); ft.textContent = l > 150 ? `Следующий ход через ${(l / 1000).toFixed(1)} с` : 'Враг атакует!'; }
      const ct = st.body.querySelector('[data-ae-chain-timer]');
      if (ct) { const l = Math.max(0, chainEnd - t); ct.textContent = l ? `Осталось ${(l / 1000).toFixed(1)} с` : 'Время вышло'; }
    }
    const baseRender = st.rerender; st.rerender = () => { baseRender(); paintCd(); requestAnimationFrame(showFloats); };
    st.timers.push(setInterval(load, 1200), setInterval(paintCd, 100));
    load(); api('/api/friends').then(r => { friends = r.friends || []; }).catch(() => {});
  }

  // ---------- 9. wiki ----------
  const WIKI = [
    ['🚀 С чего начать', `<p>Создайте героя и выберите класс. Первые бои проходят на <b>Зелёных равнинах</b> (ур. 1–8). Каждое путешествие в локацию и бой тратят <b>энергию</b> ⚡ (максимум 60, восстанавливается по 1 каждые 2 минуты). Энергию также даёт бесплатная кружка пива в Таверне.</p><p>Заходите в <b>Поселение</b>: здесь кузница, алхимик, рынок, арена, дом клана, приют спутников, таверна, причал и шахтёрский двор.</p>`],
    ['⚔️ Бои', `<p>Бой пошаговый: <b>Атака</b>, <b>Навыки</b> (тратят ману), <b>Защита</b> (снижает урон и даёт ману), <b>Зелье</b> и <b>Скрыться</b>. Над врагом показан прогноз его следующего приёма — защищайтесь перед сильным ударом.</p><p>Урон уменьшается защитой цели: физический — по формуле защита/(защита+75), магический — защита/(защита+90). Пробитие снижает защиту врага. Крит увеличивает урон. Сопротивления срезают урон своего типа.</p><p><b>Автобой</b> (Premium) сам ведёт бой по вашим настройкам: порог лечения, навыки, отступление.</p>`],
    ['🧙 Классы', `<p><b>Воин</b>, <b>Рыцарь</b> — танки с высокой защитой. <b>Берсерк</b> — физический урон. <b>Разбойник</b> — скорость. <b>Ассасин</b> — взрывной урон. <b>Лучник</b> — дальний бой. <b>Маг</b> — магический урон. <b>Некромант</b> — тёмная магия и проклятия. <b>Паладин</b> — святой воин и лекарь. <b>Друид</b> — природа и лечение.</p><p>Носить можно оружие и броню любого класса по уровню, но бонус класса работает только у своего класса.</p>`],
    ['🗺️ Локации', `<p>Равнины (1–8) → Шепчущий лес (5–12) → Забытый склеп (8–18) → Тёмный лес (12–25) → Гиблые болота (25–40) → Пылающая пустыня (40–55) → Проклятые земли (55–75) → Демонический разлом (75–90) → Драконий сандор (90–120).</p><p>В каждой локации есть режимы охоты: обычный, «Священный свет» (легче), «Густой туман» (засады, больше добычи) и другие. Победа над местным боссом открывает новые режимы и награду за освоение региона.</p>`],
    ['🛡️ Снаряжение и заточка', `<p>Предметы бывают обычные, необычные, редкие, эпические, легендарные и мифические. В <b>Кузнице</b> предмет затачивается (+1, +2…) рудой из шахты: чем выше заточка, тем более редкая руда нужна. Каждая ступень даёт +6% к характеристикам. При неудаче заточка может сорваться — смотрите шанс успеха.</p>`],
    ['⚒️ Объединение (★)', `<p>Новое! Два <b>одинаковых</b> предмета (тот же предмет, редкость и уровень) можно объединить в один со звездой вознесения ★. Каждая ★ даёт <b>+10%</b> к базовым характеристикам, максимум ★5. Заточка сохраняется лучшая из двух. Стоимость — серебро.</p><p>Где: Ещё → Ещё возможности → «Объединение». Предметы должны лежать в сумке: не надеты, не заперты, не клановые.</p>`],
    ['✦ Вознесение героя', `<p>Арена → вкладка «Вознесение». Ранги E → D → C → B → A → S → SS → SSS. Для ранга нужно победить хранителя и потратить серебро и <b>Осколки вознесения</b>. Осколки: первое освоение равнин, опасная серия в Густом тумане, первые боссы зон, шанс с боссов (40%) и элит (25%), рынок, а теперь и кооп-подземелья. Осколки с рынка тоже засчитываются.</p>`],
    ['🏰 Подземелья и кооп', `<p>Подземелья проходятся по комнатам: выбирайте путь, сражайтесь, в конце — босс и ценная добыча.</p><p><b>Кооп-подземелья</b>: Ещё → «Кооп-подземелья». Лидер открывает комнату, до двух союзников присоединяются (или их зовут из списка друзей — придёт сообщение в Telegram). Отряд проходит 5 залов, последний — босс. Действия: Атака, Мощный удар, Лечение (поднимает павшего союзника), Прикрыть (принимает удары на себя). Награда — каждому участнику.</p>`],
    ['⛏️ Шахта, алхимия, рыбалка', `<p><b>Шахта</b> даёт руду для заточки и материалы для питомцев; уровень горного дела открывает новые жилы. <b>Алхимия</b> — зелья и боевые склянки. <b>Рыбалка</b> — улов для продажи и рецептов, тратит выносливость.</p>`],
    ['🐾 Спутники', `<p>Спутник (питомец) помогает в бою и даёт пассивный бонус. Лютоволк доступен сразу. Остальных создают в Приюте спутников из материалов шахты: <b>Астральная фея — горное дело 15</b>, <b>Адамантитовый големчик — 25</b>, <b>Огненный дракончик — 35</b>, <b>Эфирный пустотник — 45</b>.</p>`],
    ['💰 Рынок', `<p>Вещи из серверного реестра можно продать другим игрокам; выручка идёт в отдельный кошелёк рынка. Налог продавца 3% (с Premium — 0%). Непроданные лоты возвращаются через 7 дней. Локальный лут продаётся местным жителям — цена зависит от дневного спроса.</p>`],
    ['🛡️ Кланы', `<p>Создание клана — 100 000 золота (с Premium — 50 000). Еженедельный рейд на Стража клановых врат: удар раз в сутки, за победу клан получает опыт и казну. Казна тратится на клановые проекты (Арсенал, Исследовательский зал, Снабжение).</p>`],
    ['🏟️ Арена и PvP', `<p>Билеты арены: до 5 в сутки, обновляются в 00:00 UTC; с боссов шанс 25% получить билет (до 3 в сутки). Победа +25 очков рейтинга, поражение −15. PvP с игроками — отдельный рейтинг.</p>`],
    ['👥 Друзья и личка', `<p>Ещё → «Друзья». Ищите героя по имени, @username или ID и отправляйте заявку. Друзьям можно писать в личные сообщения, звать их в кооп. О новых заявках и сообщениях бот пишет в Telegram.</p>`],
    ['👑 Premium', `<p>150 ⭐ на 30 дней: автобой и его настройки, автопродолжение серии, массовая продажа и разбор, офлайн-добыча в шахте, +5 слотов сумки, VIP-метка, скидка 50% на клан и рынок без налога.</p>`],
    ['🔔 Уведомления и новости', `<p>Включите уведомления — бот напомнит о полной энергии, билетах арены и событиях. Новости игры: <a href="https://t.me/Aethelgardo" target="_blank" rel="noopener">t.me/Aethelgardo</a>.</p>`],
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
    if (host && !host.querySelector('[data-ae-admin-level]')) host.append(adminLevelBlock());
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
  function injectBag() {
    const anchor = [...document.querySelectorAll('button')].find(b => /Массовая продажа и разбор/.test(b.textContent || '') && !b.closest('.ae-panel'));
    if (!anchor) return;
    const n = mergeCount(me());
    let btn = anchor.parentElement.querySelector(':scope > [data-ae-bag-merge]');
    if (!btn) {
      btn = h('button', {type: 'button', class: 'ae-bag-merge', 'data-ae-bag-merge': '1', onclick: openMerge}, h('span', {class: 'ae-entry-icon'}, '⚒️'), h('span', {class: 'ae-grow'}, h('b', {}), h('small', {})), h('span', {class: 'ae-coop-go'}, '›'));
      anchor.parentElement.insertBefore(btn, anchor.nextSibling);
    }
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
  function iconInfo(item) {
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
    let info = null, duel = null, busy = false, name = prefill;
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

  // ---------- promo codes ----------
  function openPromo() {
    openPanel('🎁 Промокод', body => {
      body.append(h('p', {class: 'ae-note'}, 'Введите промокод из канала t.me/Aethelgardo или от администрации. Каждый код можно активировать один раз.'));
      const input = h('input', {class: 'ae-input', placeholder: 'Например: AE-7K2QX9', maxlength: 20, style: 'text-transform:uppercase'});
      const go = async () => {
        const code = input.value.trim(); if (!code) return toast('Введите промокод.');
        try {
          const r = await api('/api/promo/redeem', 'POST', {code, level: me()?.level || 1}), w = r.reward, b = B();
          b.setPlayer(p => { if (!p) return p; let inv = p.inventory;
            if (w.fragments) { inv = inv.slice(); const i = inv.findIndex(x => x.templateId === 'ascension_fragment' && !x.serverOwned && !x.isLocked); if (i >= 0) inv[i] = {...inv[i], stackCount: (inv[i].stackCount || 1) + w.fragments}; else inv.push({id: 'promo_' + uuid4(), templateId: 'ascension_fragment', name: 'Осколок вознесения', type: 'material', rarity: 'rare', level: 1, upgradeLevel: 0, icon: '✦', stats: {}, sellPrice: 0, disassembleYield: {}, stackCount: w.fragments}); }
            return {...p, inventory: inv, gold: (p.gold || 0) + w.gold, silver: (p.silver || 0) + w.silver, energy: w.energy ? Math.min(p.maxEnergy || 60, (p.energy || 0) + w.energy) : p.energy, arenaTickets: (p.arenaTickets || 0) + (w.arenaTickets || 0)}; });
          const parts = [w.premiumDays && `Premium на ${w.premiumDays} дн.`, w.gold && `${fmt(w.gold)} 🪙`, w.silver && `${fmt(w.silver)} 🥈`, w.fragments && `${w.fragments} ✦`, w.energy && `${w.energy} ⚡`, w.arenaTickets && `${w.arenaTickets} 🎟️`].filter(Boolean);
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
      const t = (el.textContent || '').trim(); const id = nickMap.get(t);
      if (!id || id === uid() || t === myName) continue;
      el.classList.add('ae-nick'); el.setAttribute('role', 'button'); el.tabIndex = 0;
      el.addEventListener('click', e => { e.stopPropagation(); e.preventDefault(); openPlayerCard(id, t); });
    }
  }
  function openPlayerCard(id, name) {
    openPanel('👤 ' + name, body => {
      body.append(h('div', {class: 'ae-grid2'},
        h('button', {class: 'ae-btn ae-primary', type: 'button', onclick: async () => { try { await api('/api/friends/request', 'POST', {targetId: id}); toast('Заявка в друзья отправлена'); } catch (e) { toast(cleanError(e)); } }}, '👥 В друзья'),
        h('button', {class: 'ae-btn ae-primary', type: 'button', onclick: () => openChat({id, name})}, '💬 Написать'),
        h('button', {class: 'ae-btn ae-primary', type: 'button', onclick: async () => { closePanel(); openDuel(name); }}, '⚔️ Дуэль'),
        h('button', {class: 'ae-btn', type: 'button', onclick: () => closePanel()}, 'Закрыть')));
    });
  }

  // ---------- items in chat ----------
  const TOKEN_RE = /⟦ae:i:([A-Za-z0-9+/=]+)⟧/;
  const enc = o => btoa(unescape(encodeURIComponent(JSON.stringify(o))));
  const dec = s => { try { return JSON.parse(decodeURIComponent(escape(atob(s)))); } catch { return null; } };
  const RAR_RU = RARITY_RU;
  function shareItem(item) {
    const compact = {n: baseName(item), r: item.rarity, l: item.level || 1, u: item.upgradeLevel || 0, a: ascOf(item), t: item.type, s: Object.fromEntries(Object.entries(item.stats || {}).filter(([, v]) => typeof v === 'number').slice(0, 6))};
    const text = `Продаю: ${baseName(item)}${compact.u ? ' +' + compact.u : ''}${compact.a ? ' ★' + compact.a : ''} ⟦ae:i:${enc(compact)}⟧`;
    if (text.length > 500) return toast('Слишком много характеристик для чата.');
    api('/api/chat/global', 'POST', {text}).then(() => { toast('Предмет отправлен в общий чат'); sfx.play('page'); }, e => toast(cleanError(e)));
  }
  function itemCard(o) {
    const fake = {name: o.n, rarity: o.r, level: o.l, upgradeLevel: o.u, ascension: o.a, type: o.t, stats: o.s};
    const icon = iconFor(fake) || '/assets/items/sprites/sword.webp';
    const card = h('button', {type: 'button', class: 'ae-chat-item', 'data-ae-rarity': o.r || 'common', onclick: e => { e.stopPropagation(); card.classList.toggle('is-open'); }},
      h('img', {src: icon, alt: '', style: iconStyle(fake)}), h('span', {class: 'ae-grow'}, h('b', {}, `${o.n}${o.u ? ' +' + o.u : ''}${o.a ? ' ★' + o.a : ''}`), h('small', {}, `${RAR_RU[o.r] || o.r || ''} · ур. ${o.l}`),
        h('small', {class: 'ae-chat-item-stats'}, statLine(o.s) || 'Без характеристик')));
    return card;
  }
  function renderChatItems() {
    for (const el of document.querySelectorAll('main *, .game-dialog-backdrop *')) {
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
      anchor.parentElement.insertBefore(h('button', {type: 'button', class: styleFrom.className.replace(/\bopacity-\S+|\bdisabled:\S+/g, '') + ' ae-share', 'data-ae-share': '1', onclick: () => shareItem(findItem(lastTileId) || item)}, '📢 В чат'), anchor.nextSibling);
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
    if (!card || card.parentElement.querySelector(':scope > [data-ae-moonshine]')) return;
    const p = me(), full = p && p.energy >= p.maxEnergy, mugs = p?.intoxication?.mugs || 0;
    const block = h('div', {class: 'ae-moonshine', 'data-ae-moonshine': '1'},
      h('div', {class: 'ae-row'}, h('span', {class: 'ae-entry-icon'}, '🥃'), h('div', {class: 'ae-grow'}, h('b', {}, 'Гномий самогон'), h('div', {class: 'ae-sub'}, '+25 энергии · бесплатно')),
        h('button', {class: 'ae-btn ae-primary', type: 'button', onclick: drinkMoonshine}, 'Выпить')),
      h('div', {class: 'ae-sub'}, 'Крепче пива: −15% атаки и защиты на 5 боёв (как три кружки). Опьянение копится, максимум −50%.'));
    card.parentElement.insertBefore(block, card.nextSibling);
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
    if (e.kind === 'trade_paid' && b) { if (!tradeDone().has('paid:' + e.data?.offerId)) { markTrade('paid:' + e.data?.offerId); b.setPlayer(p => p && {...p, gold: (p.gold || 0) + (Number(e.data?.gold) || 0)}); } }
    if (e.kind === 'trade_return' && b && e.data?.item) { if (!tradeDone().has('ret:' + e.data.offerId)) { markTrade('ret:' + e.data.offerId); giveItem(e.data.item); } }
    const act = e.kind === 'trade_offer' ? ['Смотреть', () => openFriends('trades')] : e.kind === 'coop' || e.kind === 'coop-invite' ? ['Открыть', openCoop] : e.kind === 'friend-accepted' ? ['Написать', () => openChat({id: e.data?.id, name: ''})] : e.kind === 'premium' ? ['Ура!', () => checkPremium()] : [null, null];
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
      h('button', {type: 'button', class: 'ae-quick-btn', 'data-ae-quests-btn': '1', onclick: () => openSpecialQuests()}, h('span', {}, '📜'), h('b', {}, 'Задания'), h('small', {}, 'за кооп и PvP'), questBadge()));
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
      const n = {...p, inventory: inv, gold: (p.gold || 0) + (w.gold || 0), silver: (p.silver || 0) + (w.silver || 0)};
      return w.exp && b.gainExp ? b.gainExp(n, w.exp).player : n; });
  }
  const rewardText = w => [w.gold && `${fmt(w.gold)} 🪙`, w.silver && `${fmt(w.silver)} 🥈`, w.exp && `${fmt(w.exp)} опыта`, w.fragments && `${w.fragments} ✦ осколок`].filter(Boolean).join(' · ');
  function openSpecialQuests() {
    let quests = null;
    const load = async () => { try { quests = questCache = (await api('/api/quests/special')).quests; } catch (e) { toast(cleanError(e)); } if (openPanelState === st) st.rerender(); };
    const st = openPanel('📜 Задания: кооп и PvP', body => {
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
  const ENTRIES = [['⚒️', 'Объединение', 'Сливайте одинаковые вещи в ★', openMerge], ['👥', 'Друзья', 'Друзья и личные сообщения', () => openFriends()],
    ['🤝', 'Кооп-подземелья', 'Проходите подземелья отрядом', openCoop], ['⚔️', 'Дуэли', 'PvP по нику, пошаговый бой', () => openDuel()], ['📜', 'Задания', 'За кооп и PvP', () => openSpecialQuests()], ['🎁', 'Промокод', 'Активировать код', openPromo], ['📖', 'Вики', 'Как играть, где что найти', openWiki]];
  function entryBlock() {
    return h('section', {class: 'ae-entry', 'data-ae-entry': '1'}, h('h3', {}, 'Ещё возможности'),
      h('div', {class: 'ae-entry-grid'}, ENTRIES.map(([icon, title, sub, fn]) => h('button', {class: 'ae-entry-btn', type: 'button', onclick: e => { e.stopPropagation(); fn(); }},
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
            h('small', {}, `${RARITY_RU[item.rarity] || ''} · ур. ${item.level || 1}${need ? ' · нужен ' + item.level + ' ур.' : ''}`), h('small', {class: 'ae-chat-item-stats'}, statLine(item.stats) || '')),
          h('span', {class: 'ae-equip-go'}, need ? '🔒' : 'Надеть')));
      }
    });
    return st;
  }

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
  setInterval(() => { try { dropLocks(); } catch {} }, 3000);
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
  async function depositItem(item) {
    const b = B(), p = me(); if (!b || !p) throw new Error('Игра ещё загружается.');
    if (p.worldJourney || document.documentElement.hasAttribute('data-in-combat')) throw new Error('Сначала завершите бой или путь.');
    if (Object.values(p.equipped || {}).some(e => e && e.id === item.id)) throw new Error('Сначала снимите вещь с героя.');
    const one = {...item, stackCount: 1};
    const r = await api('/api/items/deposit', 'POST', {operationId: uuid4(), item: one});
    const srv = {...one, ...(r.item || {}), id: r.itemId, serverOwned: true, marketTradable: true, isLocked: false, isEquipped: false, stackCount: 1};
    if ((item.stackCount || 1) <= 1) rememberGone([item.id]);
    b.setPlayer(cur => {
      if (!cur) return cur;
      const inv = cur.inventory.flatMap(i => i.id !== item.id ? [i] : (i.stackCount || 1) > 1 ? [{...i, stackCount: i.stackCount - 1}] : []);
      return {...cur, inventory: [...inv, srv]};
    });
    sfx.play('coins'); return srv;
  }
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
    coop: '<path d="M5 24V12a9 9 0 0 1 18 0v12M3.5 24h21M11 24v-6a3 3 0 0 1 6 0v6M9 13.5h10"/>',
    duel: '<path d="M5 5l12 12M5 5h3.5L19 15.5M5 5v3.5L15.5 19M23 5L11 17M23 5h-3.5L9 15.5M23 5v3.5L12.5 19M8 20l-3 3M20 20l3 3M7 18l3 3M21 18l-3 3"/>',
    quests: '<path d="M9 5h12a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H10a2 2 0 0 1-2-2V7a2 2 0 0 0-2-2h3M6 5a2 2 0 0 0-2 2v2h4M12 11h7M12 15h7M12 19h4"/>',
    merge: '<path d="M14 4l2.6 5.3 5.9.9-4.2 4.1 1 5.8L14 17.4l-5.3 2.7 1-5.8-4.2-4.1 5.9-.9z"/>',
    friends: '<circle cx="10" cy="9.5" r="3.5"/><circle cx="19.5" cy="10.5" r="2.8"/><path d="M3.5 22.5c0-3.6 2.9-6.5 6.5-6.5s6.5 2.9 6.5 6.5M16 16.6c1-.6 2.2-.9 3.5-.9 2.8 0 5 2.2 5 5.3"/>',
    promo: '<rect x="5" y="12" width="18" height="11" rx="1.5"/><path d="M4 8.5h20V12H4zM14 8.5V23M14 8.5c-1.5-3-5.2-4-6.2-2.1s2 3 6.2 2.1zm0 0c1.5-3 5.2-4 6.2-2.1s-2 3-6.2 2.1z"/>',
    wiki: '<path d="M14 7.5c-2.5-2-6-2.5-9.5-2v16c3.5-.5 7 0 9.5 2 2.5-2 6-2.5 9.5-2v-16c-3.5-.5-7 0-9.5 2zM14 7.5v16"/>'};
  const lineIcon = k => h('span', {class: 'reference-icon ae-line-icon', 'aria-hidden': 'true', html: `<svg width="25" height="25" viewBox="0 0 28 28" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${LINE[k]}</svg>`});
  const AE_GROUP = [['coop', 'Кооп', openCoop], ['duel', 'Дуэли', () => openDuel()], ['quests', 'Кооп и PvP задания', () => openSpecialQuests()], ['merge', 'Объединение', openMerge],
    ['friends', 'Друзья', () => openFriends()], ['promo', 'Промокод', openPromo], ['wiki', 'Вики', openWiki]];
  function tidyMechanicsMenu(menu) {
    if (!menu.querySelector(':scope > [data-ae-group]')) {
      const group = h('section', {class: 'mechanics-group', 'data-ae-group': '1'}, h('header', {}, h('h2', {}, 'Приключения'), h('p', {}, 'Вместе и против всех')),
        h('div', {class: 'mechanics-grid'}, AE_GROUP.map(([icon, label, fn]) => h('div', {class: 'mechanics-entry'},
          h('button', {type: 'button', onclick: e => { e.stopPropagation(); fn(); }}, lineIcon(icon), h('span', {class: 'mechanics-entry-label'}, label))))));
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
  let heavyAt = 0, heavyTimer = 0;
  function heavyPass() {
    const run = () => { heavyAt = Date.now(); heavyTimer = 0; try { decorateLands(); decorateNicks(); renderChatItems(); injectShareButton(); injectPvp(); injectTavern(); decorateTravel(); injectQuickBars(); injectSellToFriend(); injectForgeClaim(); decoratePets(); injectMarketDeposit(); } catch (e) { console.warn('ae heavy', e); } };
    const wait = 500 - (Date.now() - heavyAt);
    if (wait <= 0) run(); else if (!heavyTimer) heavyTimer = setTimeout(run, wait);
  }
  let queued = false;
  new MutationObserver(muts => {
    for (const m of muts) for (const n of m.addedNodes) if (n.nodeType === 1) soundScan(n.matches?.('.combat-damage-pop') ? n.parentElement : n);
    if (queued) return; queued = true;
    requestAnimationFrame(() => { queued = false; try { injectEntries(); injectAdmin(); decorateDungeons(); injectBag(); injectDungeonExit(); decorateTiles(); decorateSlots(); syncTravel(); hideLockUi(); injectModeToggle(); decorateCurrencies(); heavyPass(); } catch (e) { console.warn('ae inject', e); } });
  }).observe(document.documentElement, {childList: true, subtree: true});
  setInterval(() => { try { storyTick(); } catch (e) { console.warn('ae story', e); } }, 1200);
  // The game moves the travel bar by restyling it (no DOM insertions), so poll while a journey card is open.
  setInterval(() => { if (document.querySelector('.ae-travel-card')) try { syncTravel(); } catch {} }, 100);

  // ---------- styles ----------
  const css = `
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

.ae-quick{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin:8px 0}
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
  window.__aethOpen = {merge: openMerge, friends: openFriends, coop: openCoop, wiki: openWiki, duel: openDuel, promo: openPromo, pulse: socialPulse};
})();
