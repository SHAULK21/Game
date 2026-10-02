import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { JSDOM } from 'jsdom';
import { translateText, ukrainianDictionary } from '../src/i18n/translate';
import { gameMessagePayload, gameMenuButton, messageLanguage } from '../server/telegramGameMessages';
import { runNotificationBatch, registerSocialFeatures } from '../server/socialFeatures';

const button = (w: any, label: string) => [...w.document.querySelectorAll('button')].find((el: any) => el.textContent.trim() === label) as any;
async function app(language = 'uk-UA', stored?: string) {
  const bundle = await build({ stdin: { contents: `import React,{act} from 'react';import {createRoot} from 'react-dom/client';import App from './src/App';import {readLanguage,setLanguage,getLanguage} from './src/i18n/locale';import {localizeDuelLog} from './src/i18n/duelLog';window.act=act;window.readLanguage=readLanguage;window.setLanguage=setLanguage;window.getLanguage=getLanguage;window.duelLog=localizeDuelLog;window.mount=()=>{window.root=createRoot(document.getElementById('root'));window.root.render(<App/>);};`, resolveDir: process.cwd(), loader: 'tsx' }, bundle: true, write: false, platform: 'browser', format: 'iife', define: { 'process.env.NODE_ENV': '"development"', 'import.meta.env.VITE_ADMIN_TELEGRAM_ID': '""' }, plugins: [{ name: 'art', setup(b) { b.onLoad({ filter: /\.(jpg|webp)$/ }, () => ({ contents: 'export default "art";', loader: 'js' })); } }] });
  const dom = new JSDOM('<html><body><div id="root"></div></body></html>', { url: 'http://localhost', runScripts: 'outside-only' });
  const w: any = dom.window;
  Object.defineProperty(w.navigator, 'language', { value: language, configurable: true });
  if (stored !== undefined) w.localStorage.setItem('aethelgard_language', stored);
  w.MessageChannel = class { port1 = { onmessage: null as any }; port2 = { postMessage: () => setTimeout(() => this.port1.onmessage?.(), 0) }; };
  w.IS_REACT_ACT_ENVIRONMENT = true; w.Headers = Headers; w.AbortSignal = AbortSignal;
  const requests: any[] = [];
  w.fetch = async (url: string, options: any) => {
    requests.push({ url, options });
    return { ok: true, status: 200, text: async () => JSON.stringify({ resetVersion: 0, active: false, items: [], ok: true, totalGold: 0, isAdmin: false }) };
  };
  w.eval(bundle.outputFiles[0].text);
  const settle = () => w.act(async () => { await new Promise(resolve => setTimeout(resolve, 50)); });
  return { dom, w, requests, settle };
}

test('language selection is visible only at registration; its saved locale survives both layouts and combat', async () => {
  const { dom, w, requests, settle } = await app();
  const click = async (label: string) => { const target = button(w, label); assert(target, `missing button: ${label}`); await w.act(async () => target.click()); await settle(); };
  const save = () => JSON.parse(w.localStorage.getItem('aethelgard_save_v1_data'));
  try {
    await w.act(async () => w.mount()); await settle();
    assert.equal(w.document.documentElement.lang, 'uk');
    assert.match(w.document.body.textContent, /Виберіть клас та ім'я персонажа/);
    assert.equal(w.document.querySelector('input[type="text"]').placeholder, "Введіть ім'я героя...");
    const input = w.document.querySelector('input[type="text"]');
    await w.act(async () => {
      Object.getOwnPropertyDescriptor(w.HTMLInputElement.prototype, 'value')!.set!.call(input, 'Золото');
      input.dispatchEvent(new w.Event('input', { bubbles: true }));
    });
    await click('Русский');
    assert(w.document.querySelector('input[type="text"]') === input, 'language does not remount registration');
    assert.equal(input.value, 'Золото'); assert.match(w.document.body.textContent, /Выберите класс и имя персонажа/);
    await click('Українська');
    const fantasy = [...w.document.querySelectorAll('button')].find((node: any) => node.textContent.startsWith('Фентезі')) as any;
    assert(fantasy); await w.act(async () => fantasy.click()); await settle();
    await click('Почати подорож');
    assert.equal(save().player.name, 'Золото');
    const original = JSON.stringify(save().player);
    assert.equal(button(w, 'Русский'), undefined); assert.equal(button(w, 'Українська'), undefined);
    assert.match(w.document.body.textContent, /Бестіарій/);
    await click('Сумка');
    const active = () => w.document.querySelector('nav button[aria-current="page"]')?.textContent.trim();
    await w.act(async () => w.setLanguage('ru')); assert.equal(active(), 'Сумка'); assert.equal(JSON.stringify(save().player), original);
    await click('Современный'); assert.equal(active(), 'Сумка');
    await w.act(async () => w.setLanguage('uk')); assert.equal(active(), 'Сумка'); assert.equal(JSON.stringify(save().player), original);
    await click('Фентезі'); await click('Ще'); await click('Герой'); await click('Сучасний');
    assert.match(w.document.querySelector('main').textContent, /Золото/);
    assert.equal(w.document.querySelector('main h3')?.textContent, 'Золото', 'player nickname is never translated even when it matches a dictionary key');
    await click('Полювання');
    const hunt = [...w.document.querySelectorAll('button')].find((node: any) => node.textContent.includes('Почати полювання')) as any;
    assert(hunt); await w.act(async () => hunt.click()); await settle();
    assert(button(w, 'Атака')); assert(button(w, 'Захист (+25 MP)'));
    const inBattle = JSON.stringify(save().player);
    await w.act(async () => w.setLanguage('ru')); assert(button(w, 'Защита (+25 MP)')); assert.equal(JSON.stringify(save().player), inBattle);
    await click('Фэнтези'); await w.act(async () => w.setLanguage('uk')); assert(button(w, 'Захист (+25 MP)')); assert.equal(JSON.stringify(save().player), inBattle);
    assert.match(w.document.body.textContent, /У бій вступає/);
    assert.equal(w.localStorage.getItem('aethelgard_language'), 'uk');
    assert.equal(w.document.documentElement.lang, 'uk');
    await w.act(async () => w.root.unmount()); await w.act(async () => w.mount()); await settle();
    assert.equal(w.document.documentElement.lang, 'uk'); assert.equal(save().player.name, 'Золото');
    const synced = requests.filter(r => r.url === '/api/preferences/language').map(r => JSON.parse(r.options.body).language);
    assert.equal(synced.at(-1), 'uk');
  } finally { await w.act(async () => w.root.unmount()); dom.window.close(); }
});

test('saved language takes precedence; Telegram Ukrainian and blocked storage have safe fallbacks', async () => {
  const { dom, w } = await app('uk-UA', 'ru');
  try {
    assert.equal(w.readLanguage(), 'ru');
    w.localStorage.setItem('aethelgard_language', 'invalid');
    assert.equal(w.readLanguage(), 'uk');
    Object.defineProperty(w.navigator, 'language', { value: 'en-US', configurable: true });
    w.Telegram = { WebApp: { initDataUnsafe: { user: { language_code: 'uk' } } } };
    assert.equal(w.readLanguage(), 'uk');
    w.Telegram.WebApp.initDataUnsafe.user.language_code = 'ru';
    assert.equal(w.readLanguage(), 'ru');
    w.Storage.prototype.getItem = () => { throw new Error('blocked'); };
    w.Storage.prototype.setItem = () => { throw new Error('blocked'); };
    w.setLanguage('uk'); assert.equal(w.getLanguage(), 'uk'); assert.equal(w.document.documentElement.lang, 'uk');
    assert.equal(w.duelLog('1. Золото: приём · 120 урона · крит. Защита: 230 HP.', 'Золото', 'Защита'), '1. Золото: прийом · 120 шкоди · крит. Защита: 230 HP.');
    assert.equal(w.duelLog('2. Защита: промах. Золото: 330 HP.', 'Золото', 'Защита'), '2. Защита: промах. Золото: 330 HP.');
  } finally { dom.window.close(); }
});

test('translation preserves template values, whitespace, links and authored additions; game terms translate', () => {
  assert.equal(translateText('Прогресс Золото  <герой> сброшен. При входе игрок создаст нового персонажа.', 'uk'), 'Прогрес Золото  <герой> скинуто. Під час входу гравець створить нового персонажа.');
  assert.equal(translateText('В клане Шахта изменена ваша роль: Казначей.', 'uk'), 'У клані Шахта змінено вашу роль: Скарбник.');
  assert.equal(translateText('⚔️ Золото вызвал вас на дуэль. Вы победили. Ваш рейтинг: 1012.', 'uk'), '⚔️ Золото викликав вас на дуель. Ви перемогли. Ваш рейтинг: 1012.');
  assert.equal(translateText('Error: Недостаточно золота. (HTTP 400)', 'uk'), 'Error: Недостатньо золота. (HTTP 400)');
  const authored = '  Неизвестный текст  с пробелами\nи новой строкой  ';
  assert.equal(translateText(authored, 'uk'), authored);
  const announcement = '✅ Технические работы завершены. Аэтельгард снова доступен — можно продолжать приключение!';
  assert.equal(translateText(announcement + '\n\nМой  текст: https://t.me/bot?start=ref_1', 'uk'), '✅ Технічні роботи завершено. Аетельгард знову доступний — можна продовжувати пригоду!\n\nМой  текст: https://t.me/bot?start=ref_1');
  assert.equal(translateText('Клинок новобранца', 'uk'), 'Клинок новобранця');
  assert.equal(translateText('Легендарный Мантия звёзд', 'uk'), 'Легендарна Мантія зірок');
  assert.equal(translateText('Шахта', 'ru'), 'Шахта');
  for (const [source, translation] of Object.entries(ukrainianDictionary)) {
    assert(translation.trim(), `empty translation: ${source}`);
    assert.deepEqual((source.match(/\{\d+\}/g) || []).sort(), (translation.match(/\{\d+\}/g) || []).sort(), `translation must preserve parameters: ${source}`);
  }
});

test('worker uses recipient language for notifications and Play button; Russian remains compatible', async () => {
  const text = '⚡ Энергия полностью восстановилась. Можно продолжить приключение!';
  const rows = ['uk', 'ru'].map((language, index) => ({ id: index + 1, telegram_id: index + 20, category: 'energy', text, bot_started: true, notification_settings: { enabled: true }, preferred_language: language }));
  const client: any = { query: async (sql: string) => ({ rows: sql.startsWith('SELECT n.*') ? rows : [] }), release: () => {} };
  const sent: any[] = [];
  await runNotificationBatch(() => ({ connect: async () => client }) as any, async (method, payload) => { sent.push(payload); return {} as any; }, 'https://game.example');
  assert.equal(sent[0].text, '⚡ Енергію повністю відновлено. Можна продовжити пригоду!');
  assert.equal(sent[0].reply_markup.inline_keyboard[0][0].text, '⚔️ Грати');
  assert.equal(sent[1].text, text); assert.equal(sent[1].reply_markup.inline_keyboard[0][0].text, '⚔️ Играть');
  assert.equal((gameMenuButton('https://game.example', 'uk') as any).text, '🎮 Грати');
  assert.equal(messageLanguage('ru', 'uk'), 'ru'); assert.equal(messageLanguage(null, 'uk'), 'uk');
  assert.equal(messageLanguage('invalid', 'en'), 'ru');
  assert.equal(gameMessagePayload(1, text, '', 'uk').reply_markup, undefined);
});

test('language preference validates locale, scopes the update to the authenticated player and leaves notification opt-in intact', async () => {
  const routes = new Map<string, Function[]>();
  const application: any = { post: (path: string, ...handlers: Function[]) => routes.set(path, handlers), get: () => {}, patch: () => {}, delete: () => {} };
  const writes: any[] = [], menus: any[] = [];
  const pool: any = { query: async (sql: string, args: any[]) => { writes.push({ sql, args }); return { rows: [{ bot_started: true }] }; } };
  registerSocialFeatures(application, () => pool, (() => {}) as any, async (method, payload) => { menus.push({ method, payload }); return {} as any; }, 'https://game.example');
  const handler = routes.get('/api/preferences/language')!.at(-1)!;
  const response: any = { statusCode: 200, status(code: number) { this.statusCode = code; return this; }, json(body: any) { this.body = body; return this; } };
  for (const language of [null, '', 'ua', 'en', true, ['uk']]) { await handler({ body: { language }, authUser: { id: 7 } }, response); assert.equal(response.statusCode, 400); }
  assert.equal(writes.length, 0);
  await handler({ body: { language: 'uk', telegramId: 999, enabled: true }, authUser: { id: 7 } }, response);
  assert.deepEqual(writes[0].args, ['uk', 7]); assert(!writes[0].sql.includes('notification_settings'));
  assert.equal(menus[0].method, 'setChatMenuButton'); assert.equal(menus[0].payload.chat_id, 7);
  assert.equal(menus[0].payload.menu_button.text, '🎮 Грати'); assert.deepEqual(response.body, { language: 'uk' });
});

test('market search accepts Ukrainian names after a live language switch and keeps canonical item IDs and names', async () => {
  const bundle = await build({ stdin: { contents: `import React,{act} from 'react';import {createRoot} from 'react-dom/client';import {MarketScreen as ModernMarket} from './src/components/market/MarketScreen';import {MarketScreen as FantasyMarket} from './src/interfaces/fantasy/components/market/MarketScreen';import {LanguageSwitcher} from './src/components/ui/LanguageSwitcher';window.act=act;window.mount=(fantasy)=>{window.root=createRoot(document.getElementById('root'));window.root.render(<><LanguageSwitcher/>{fantasy?<FantasyMarket/>:<ModernMarket/>}</>);};`, resolveDir: process.cwd(), loader: 'tsx' }, bundle: true, write: false, platform: 'browser', format: 'iife', define: { 'process.env.NODE_ENV': '"development"' }, plugins: [
    { name: 'fixture-game', setup(b) {
      b.onResolve({ filter: /\/context\/GameContext$/ }, () => ({ path: 'fixture', namespace: 'test-game' }));
      b.onLoad({ filter: /.*/, namespace: 'test-game' }, () => ({ contents: 'export const useGame=()=>window.gameData;', loader: 'js' }));
    } },
    { name: 'art', setup(b) { b.onLoad({ filter: /\.(jpg|webp)$/ }, () => ({ contents: 'export default "art";', loader: 'js' })); } }
  ] });
  for (const fantasy of [false, true]) {
    const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost', runScripts: 'outside-only' });
    const w: any = dom.window;
    w.localStorage.setItem('aethelgard_language', 'ru');
    const item = { id: 'meat-canonical-id', name: 'Мясо вепря', type: 'material', rarity: 'common', level: 1, stackCount: 3, stats: {} };
    w.gameData = { player: { classId: 'warrior', gold: 1000, maxInventorySlots: 20, inventory: [item], equipped: {} }, premium: { active: false }, refreshMarketIncome: async () => {} };
    w.fetch = async () => ({ ok: true, status: 200, text: async () => JSON.stringify({ listings: [] }) });
    w.Headers = Headers; w.IS_REACT_ACT_ENVIRONMENT = true;
    w.MessageChannel = class { port1 = { onmessage: null as any }; port2 = { postMessage: () => setTimeout(() => this.port1.onmessage?.(), 0) }; };
    w.eval(bundle.outputFiles[0].text);
    const settle = () => w.act(async () => { await new Promise(resolve => setTimeout(resolve, 40)); });
    try {
      await w.act(async () => w.mount(fantasy)); await settle();
      await w.act(async () => button(w, 'Продать вещь').click());
      const search = w.document.querySelector('input[type="search"]'); assert(search);
      await w.act(async () => {
        Object.getOwnPropertyDescriptor(w.HTMLInputElement.prototype, 'value')!.set!.call(search, "м'ясо");
        search.dispatchEvent(new w.Event('input', { bubbles: true }));
      });
      assert.equal(w.document.querySelector('option[value="meat-canonical-id"]'), null);
      await w.act(async () => button(w, 'Українська').click()); await settle();
      const option = w.document.querySelector('option[value="meat-canonical-id"]'); assert(option);
      assert.match(option.textContent, /М'ясо вепра/);
      assert.equal(option.value, item.id); assert.equal(item.name, 'Мясо вепря'); assert.equal(item.stackCount, 3);
      assert(w.document.querySelector('input[type="search"]') === search, 'search input remains mounted');
      await w.act(async () => {
        Object.getOwnPropertyDescriptor(w.HTMLInputElement.prototype, 'value')!.set!.call(search, 'мясо');
        search.dispatchEvent(new w.Event('input', { bubbles: true }));
      });
      assert(w.document.querySelector('option[value="meat-canonical-id"]'), 'canonical search also works in Ukrainian');
    } finally { await w.act(async () => w.root.unmount()); dom.window.close(); }
  }
});
