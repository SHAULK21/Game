// Several heroes on one Telegram account.
// Hero 1 is the account's own Telegram id. Heroes 2 and 3 get their own ids derived from it, so every game system
// (players, clans, chat, ratings…) sees them as separate heroes. The Mini App picks the hero with `input.char` (1 or 2);
// the server checks that the hero belongs to the verified Telegram user.
// Shared by the account: Premium (the longest one counts for all heroes), the bot chat (messages go to the real chat),
// promo codes, the app gift and invitations (once per account).
const rows = (world, n) => (world.tables[n] ||= []);
const same = (a, b) => String(a) === String(b);
const ok = (body, status = 200) => ({status, body}), fail = (error, status = 400) => ({status, body: {error}});

export const ALT_BASE = 8e15;            // above any Telegram user id, below Number.MAX_SAFE_INTEGER
export const SLOTS = 3;                  // hero 1 (main) + 2 more
export const PREMIUM_SLOT = 2;           // the third hero needs Premium to be created
export const charId = (tg, slot) => slot ? ALT_BASE + Number(tg) * 4 + slot : Number(tg);
export const isAlt = id => Number(id) >= ALT_BASE;
export const realOf = id => isAlt(id) ? Math.floor((Number(id) - ALT_BASE) / 4) : Number(id);
export const slotOf = id => isAlt(id) ? (Number(id) - ALT_BASE) % 4 : 0;
export const accountIds = id => { const tg = realOf(id); return Array.from({length: SLOTS}, (_, s) => String(charId(tg, s))); };

const player = (world, id) => rows(world, 'players').find(p => same(p.telegram_id, id));
const premiumOf = (world, id) => Math.max(0, ...accountIds(id).map(x => Date.parse(player(world, x)?.premium_until || 0) || 0));

// Premium and the bot chat state are one per account: copy the best of them to every hero of the account.
export function syncAccount(world, id) {
  const heroes = accountIds(id).map(x => player(world, x)).filter(Boolean); if (heroes.length < 2) return;
  const best = premiumOf(world, id), main = heroes.find(p => !isAlt(p.telegram_id));
  for (const p of heroes) {
    if (best && (Date.parse(p.premium_until || 0) || 0) < best) p.premium_until = new Date(best).toISOString();
    if (main && isAlt(p.telegram_id)) { p.bot_started = main.bot_started; if (main.notification_settings) p.notification_settings = main.notification_settings; }
  }
}

// May the verified Telegram user play hero `slot`? Returns an error reply or null.
export function slotDenied(world, tg, slot, now) {
  if (!slot) return null;
  if (!Number.isInteger(slot) || slot < 0 || slot >= SLOTS) return fail('Такого персонажа нет.', 404);
  if (slot === PREMIUM_SLOT && !player(world, charId(tg, slot)) && premiumOf(world, tg) <= now)
    return fail('Третий персонаж открывается с Premium.', 403);
  return null;
}

// GET /api/ae-chars — the account's heroes for the «Персонажи» screen.
export function handleChars(world, input, tg, current, now) {
  if (String(input?.path || '').split('?')[0] !== '/api/ae-chars') return null;
  const premium = premiumOf(world, tg) > now;
  const list = Array.from({length: SLOTS}, (_, slot) => {
    const p = player(world, charId(tg, slot));
    return {slot, current: slot === current, exists: !!p, locked: !p && slot === PREMIUM_SLOT && !premium,
      name: p ? String(p.character_name || p.display_name || 'Герой') : null, level: p ? Number(p.level) || 1 : null, cls: p?.class_id || null,
      seen: p?.last_seen_at || p?.updated_at || null};
  });
  return ok({chars: list, premium, slots: SLOTS, premiumSlot: PREMIUM_SLOT});
}
