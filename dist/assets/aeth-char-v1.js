// Several heroes on one Telegram account: runs after telegram-web-app.js and before the game bundle.
// The chosen hero (localStorage, per Telegram account) gets its own id in the game, and every server call names it
// (input.char); the server checks that the hero belongs to this Telegram account.
(() => {
  const W = window.Telegram && window.Telegram.WebApp, u = W && W.initDataUnsafe && W.initDataUnsafe.user;
  if (!u || !u.id) return;
  const tg = String(u.id), key = 'aeth_char_slot_' + tg;
  let slot = 0; try { slot = Number(localStorage.getItem(key)) || 0; } catch (e) {}
  if (slot !== 1 && slot !== 2) slot = 0;
  window.__aeChar = {tg: tg, slot: slot, key: key};
  if (!slot) return;
  const id = 8e15 + Number(tg) * 4 + slot;   // the same rule as tgcloud/lib/alts.js
  const unsafe = Object.assign({}, W.initDataUnsafe, {user: Object.assign({}, u, {id: id, username: undefined})});
  const S = W.Serverless, call = S && S.call;
  const serverless = S ? Object.assign(Object.create(S), {call: function (name, input, cb) {
    if (typeof input === 'function') { cb = input; input = {}; }
    return call.call(S, name, Object.assign({}, input || {}, {char: slot}), cb);
  }}) : S;
  // The Telegram object stays the same underneath; only the hero id and the server calls differ.
  const view = Object.create(W, {initDataUnsafe: {value: unsafe, enumerable: true}, Serverless: {value: serverless, enumerable: true}});
  window.Telegram.WebApp = view;
})();
