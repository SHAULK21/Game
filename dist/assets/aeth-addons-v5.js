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
  function openPanel(title, render, {onClose} = {}) {
    closePanel();
    const body = h('div', {class: 'ae-body'});
    const close = h('button', {class: 'ae-x', 'aria-label': 'Закрыть', onclick: () => closePanel()}, '×');
    const root = h('div', {class: 'ae-backdrop', onclick: e => { if (e.target === root) closePanel(); }},
      h('section', {class: 'ae-panel', role: 'dialog', 'aria-label': title}, h('header', {class: 'ae-head'}, h('h2', {}, title), close), body));
    document.body.append(root);
    const state = {root, body, timers: [], onClose, rerender: () => { body.replaceChildren(); render(body, state); }};
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
      const tabs = [['friends', `Друзья (${data.friends.length})`], ['requests', `Заявки${data.incoming.length ? ' · ' + data.incoming.length : ''}`], ['messages', 'Сообщения'], ['search', 'Найти']];
      body.append(h('div', {class: 'ae-tabs'}, tabs.map(([id, label]) => h('button', {class: 'ae-tab' + (tab === id ? ' is-on' : ''), onclick: () => { tab = id; panel.rerender(); }}, label))));
      if (loading) return body.append(h('p', {class: 'ae-empty'}, 'Загрузка…'));
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
  function openCoop() {
    let state = null, friends = [], busy = false;
    const load = async () => {
      try { state = await api('/api/coop/rooms'); } catch (e) { toast(cleanError(e)); }
      if (!openPanelState || openPanelState !== st) return; st.rerender();
    };
    const post = async (path, body, okMsg) => {
      if (busy) return; busy = true;
      try { const r = await api(path, 'POST', body); if (okMsg) toast(okMsg); if (r?.room !== undefined) state = {...state, mine: r.room}; return r; }
      catch (e) { toast(cleanError(e)); sfx.play('fail'); } finally { busy = false; st.rerender(); }
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
    };
    const bar = (cur, max, cls) => h('div', {class: 'ae-bar ' + (cls || '')}, h('i', {style: `width:${Math.max(0, Math.min(100, 100 * cur / Math.max(1, max)))}%`}), h('span', {}, `${fmt(cur)} / ${fmt(max)}`));
    const st = openPanel('🤝 Кооп-подземелья', body => {
      if (!state) return body.append(h('p', {class: 'ae-empty'}, 'Загрузка…'));
      const room = state.mine, lvl = me()?.level || 1;
      if (!room) {
        body.append(h('p', {class: 'ae-note'}, 'Соберите отряд до 3 героев. Лидер открывает комнату, союзники присоединяются, затем вместе проходите 5 залов с боссом в конце. Сила героев считается по уровню и классу. Лекари (друид, паладин) лечат сильнее. Награда — золото, серебро, опыт и шанс на Осколок вознесения.'));
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
        room.status === 'lobby' ? 'Сбор отряда' : room.status === 'active' ? `Зал ${room.stage} из ${room.rooms}` : room.status === 'won' ? 'Подземелье пройдено!' : 'Отряд пал'))));
      if (room.foe && room.status === 'active') body.append(h('div', {class: 'ae-card ae-foe'}, h('b', {}, (room.foe.boss ? '👑 ' : '👹 ') + room.foe.name), bar(room.foe.hp, room.foe.maxHp, 'is-foe')));
      for (const m of room.members) body.append(h('div', {class: 'ae-card'}, h('div', {class: 'ae-row'}, h('b', {class: 'ae-grow'}, `${m.name}${String(m.id) === uid() ? ' (вы)' : ''}${String(m.id) === String(room.hostId) ? ' ⭐' : ''}`),
        h('span', {class: 'ae-sub'}, `${CLASS_RU[m.classId] || m.classId} · ${m.level} ур.${m.guardUntil > Date.now() ? ' · 🛡️' : ''}`)), bar(m.hp, m.maxHp, m.hp ? '' : 'is-down')));
      const mine = room.members.find(m => String(m.id) === uid());
      if (room.status === 'lobby') {
        if (room.isHost) body.append(h('button', {class: 'ae-btn ae-primary ae-wide', disabled: room.members.length < 2, onclick: () => post('/api/coop/start', {}, 'В бой!')}, room.members.length < 2 ? 'Ждём хотя бы одного союзника…' : '⚔️ Начать поход'));
        else body.append(h('p', {class: 'ae-note'}, 'Ждём, когда лидер начнёт поход.'));
        body.append(h('h3', {class: 'ae-h3'}, 'Позвать друзей'));
        if (!friends.length) body.append(h('p', {class: 'ae-sub'}, 'Добавьте друзей в разделе «Друзья», чтобы звать их одним нажатием.'));
        for (const f of friends) body.append(h('div', {class: 'ae-row ae-card'}, h('span', {class: 'ae-dot' + (f.online ? ' is-on' : '')}), h('b', {class: 'ae-grow'}, `${f.name} (${f.level})`),
          h('button', {class: 'ae-btn', onclick: () => post('/api/coop/invite', {friendId: f.id}, 'Приглашение отправлено в Telegram')}, 'Позвать')));
      }
      if (room.status === 'active' && mine) {
        const cd = mine.cooldowns || {}, dead = !mine.hp;
        const actBtn = (action, label) => h('button', {class: 'ae-btn ae-act', disabled: dead || cd[action] > 0, onclick: () => { sfx.play(action === 'heal' ? 'magic' : action === 'guard' ? 'shield' : action === 'power' ? 'heavy' : 'hit'); post('/api/coop/act', {action}); }},
          label + (cd[action] > 0 ? ` · ${Math.ceil(cd[action] / 1000)}с` : ''));
        body.append(h('div', {class: 'ae-grid2'}, actBtn('attack', '⚔️ Атака'), actBtn('power', '💥 Мощный удар'), actBtn('heal', '💚 Лечение'), actBtn('guard', '🛡️ Прикрыть')));
        if (dead) body.append(h('p', {class: 'ae-note'}, 'Вы без сил. Союзник может поднять вас лечением.'));
      }
      if (room.status === 'won') body.append(room.reward && !room.reward.claimed ? h('button', {class: 'ae-btn ae-primary ae-wide', onclick: claim}, '🎁 Забрать награду') : h('p', {class: 'ae-note'}, 'Награда получена.'));
      body.append(h('div', {class: 'ae-log'}, room.log.slice().reverse().map(l => h('div', {}, l.text))));
      body.append(h('button', {class: 'ae-btn ae-wide', onclick: () => confirm('Покинуть отряд?') && post('/api/coop/leave', {}, 'Вы покинули отряд').then(load)}, room.status === 'active' ? 'Покинуть поход' : 'Выйти из комнаты'));
    });
    st.timers.push(setInterval(load, 1500));
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
  const storyKey = () => 'aeth_story_seen_' + uid();
  let lastRegion = null, storyInit = false;
  function storyTick() {
    const p = me(); if (!p || !p.userId) return;
    let seen; try { seen = new Set(JSON.parse(localStorage.getItem(storyKey()) || '[]')); } catch { seen = new Set(); }
    if (!storyInit) {
      storyInit = true;
      if (!localStorage.getItem(storyKey())) { for (const r of Object.keys(p.regionProgress || {})) seen.add(r); if (p.currentRegionId && (p.level || 1) > 2) seen.add(p.currentRegionId); localStorage.setItem(storyKey(), JSON.stringify([...seen])); }
    }
    const region = p.currentRegionId, inField = p.worldPlace && p.worldPlace !== 'settlement';
    if (!region || !inField || region === lastRegion && seen.has(region)) { lastRegion = region; return; }
    lastRegion = region;
    if (seen.has(region) || !STORY[region] || p.firstJourney || openPanelState || document.documentElement.hasAttribute('data-in-combat')) return;
    seen.add(region); localStorage.setItem(storyKey(), JSON.stringify([...seen]));
    const [img, title, text] = STORY[region];
    sfx.play('bell');
    const root = h('div', {class: 'ae-story', role: 'dialog', 'aria-label': title},
      h('div', {class: 'ae-story-card'}, h('img', {src: img, alt: ''}), h('div', {class: 'ae-story-text'}, h('small', {}, 'Новая земля'), h('h2', {}, title), h('p', {}, text),
        h('button', {class: 'ae-btn ae-primary ae-wide', onclick: () => { root.classList.add('is-out'); setTimeout(() => root.remove(), 300); sfx.play('page'); }}, 'Продолжить путь'))));
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

  // ---------- menu entry points ----------
  const ENTRIES = [['⚒️', 'Объединение', 'Сливайте одинаковые вещи в ★', openMerge], ['👥', 'Друзья', 'Друзья и личные сообщения', () => openFriends()],
    ['🤝', 'Кооп-подземелья', 'Проходите подземелья отрядом', openCoop], ['📖', 'Вики', 'Как играть, где что найти', openWiki]];
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
    for (const host of hosts) if (host && host.tagName !== 'BUTTON' && !host.closest('button') && !host.querySelector(':scope > [data-ae-entry]')) host.append(entryBlock());
    for (const stray of document.querySelectorAll('button [data-ae-entry], button [data-ae-merge], button [data-ae-coop-card], button [data-ae-bag-merge]')) stray.remove();
    for (const el of document.querySelectorAll('main *')) {
      if (el.childElementCount || !/^Выберите предмет для улучшения/i.test((el.textContent || '').trim()) || !el.offsetParent) continue;
      let host = el; while (host.parentElement && host.parentElement.tagName !== 'MAIN') host = host.parentElement;
      if (!host.parentElement || host.closest('button') || host.querySelector(':scope > [data-ae-merge]')) continue;
      host.append(h('button', {class: 'ae-entry-btn ae-merge-cta', 'data-ae-merge': '1', type: 'button', onclick: openMerge}, h('span', {class: 'ae-entry-icon'}, '⚒️'), h('span', {}, h('b', {}, 'Объединение предметов'), h('small', {}, 'Два одинаковых предмета → один со ★'))));
    }
  }
  let queued = false;
  new MutationObserver(muts => {
    for (const m of muts) for (const n of m.addedNodes) if (n.nodeType === 1) soundScan(n.matches?.('.combat-damage-pop') ? n.parentElement : n);
    if (queued) return; queued = true;
    requestAnimationFrame(() => { queued = false; try { injectEntries(); injectAdmin(); decorateDungeons(); injectBag(); injectDungeonExit(); } catch (e) { console.warn('ae inject', e); } });
  }).observe(document.documentElement, {childList: true, subtree: true});
  setInterval(() => { try { storyTick(); } catch (e) { console.warn('ae story', e); } }, 1200);

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
  window.__aethOpen = {merge: openMerge, friends: openFriends, coop: openCoop, wiki: openWiki};
})();
