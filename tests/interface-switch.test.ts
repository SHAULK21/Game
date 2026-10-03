import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { JSDOM } from 'jsdom';
import { getMonsterArtworkPath } from '../src/interfaces/fantasy/utils/monsterArtwork';

async function setup(contents: string) {
  const bundle = await build({ stdin: { contents, resolveDir: process.cwd(), loader: 'tsx' }, bundle: true, write: false, platform: 'browser', format: 'iife', define: { 'process.env.NODE_ENV': '"development"', 'import.meta.env.VITE_ADMIN_TELEGRAM_ID': '""' }, plugins: [{ name: 'art', setup(b) { b.onLoad({ filter: /\.(jpg|webp)$/ }, () => ({ contents: 'export default "art";', loader: 'js' })); } }] });
  const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost', runScripts: 'outside-only' });
  const w: any = dom.window;
  w.MessageChannel = class { port1 = { onmessage: null as any }; port2 = { postMessage: () => setTimeout(() => this.port1.onmessage?.(), 0) }; };
  w.IS_REACT_ACT_ENVIRONMENT = true; w.Headers = Headers; w.AbortSignal = AbortSignal;
  w.eval(bundle.outputFiles[0].text);
  return { dom, w };
}

test('registration switches styles without losing input; both layouts share character, energy and active combat', async () => {
  const { dom, w } = await setup(`import React,{act} from 'react';import {createRoot} from 'react-dom/client';import App from './src/App';window.act=act;window.mount=()=>{window.root=createRoot(document.getElementById('root'));window.root.render(<App/>);};`);
  let serverVersion = 0;
  w.fetch = async (url: string) => ({ ok: true, status: 200, text: async () => JSON.stringify(url === '/api/profile/state' ? { resetVersion: serverVersion } : { active: false, items: [], ok: true, totalGold: 0, isAdmin: false }) });
  const settle = async () => w.act(async () => { await new Promise(resolve => setTimeout(resolve, 40)); });
  const button = (text: string) => [...w.document.querySelectorAll('button')].find((node: any) => node.textContent.trim() === text) as any;
  const save = () => JSON.parse(w.localStorage.getItem('aethelgard_save_v1_data'));
  try {
    await w.act(async () => w.mount()); await settle();
    assert.match(w.document.body.textContent, /Выберите свой интерфейс/);
    const classButtons = [...w.document.querySelectorAll('.registration-screen button[aria-pressed]')].filter((node: any) => node.querySelector('svg') && /Воин|Берсерк|Рыцарь|Разбойник|Ассасин|Лучник|Маг|Некромант|Паладин|Друид/.test(node.textContent));
    assert.equal(classButtons.length, 10);
    assert(classButtons.every((node: any) => !/\p{Extended_Pictographic}/u.test(node.textContent)));
    assert.match(w.document.querySelector('[data-skill-details="w_strike"]').textContent, /Шанс за удар: 25%/);
    assert(w.document.querySelector('[data-skill-details="w_charge"]'), 'registration previews advanced class skills too');
    assert.equal(w.document.querySelector('.registration-screen img').getAttribute('src'), 'art');
    const input = w.document.querySelector('input[type="text"]');
    await w.act(async () => {
      Object.getOwnPropertyDescriptor(w.HTMLInputElement.prototype, 'value')!.set!.call(input, 'Новый герой');
      input.dispatchEvent(new w.Event('input', { bubbles: true }));
    });
    const fantasy = [...w.document.querySelectorAll('button')].find((node: any) => node.textContent.startsWith('Фэнтези')) as any;
    await w.act(async () => fantasy.click());
    assert.equal(w.document.documentElement.dataset.interface, 'fantasy'); assert.equal(input.value, 'Новый герой');
    assert.equal(w.document.querySelector('.registration-screen img').getAttribute('src'), '/assets/sprites/generated/heroes/warrior.webp');
    assert.equal(w.document.querySelectorAll('.registration-class-portrait').length,10);
    const selectClass = (name: string) => [...w.document.querySelectorAll('.registration-screen button')].find((node: any) => node.querySelector('.registration-class-portrait') && node.textContent.startsWith(name)) as any;
    await w.act(async () => selectClass('Некромант').click());
    assert(w.document.querySelector('.skill-codex-card[data-skill-details="n_drain"]'));
    assert.match(w.document.querySelector('[data-skill-details="n_drain"]').textContent,/50% фактически нанесённого урона/);
    assert.equal(w.document.querySelector('.registration-class-portrait image').getAttribute('href'),'/assets/sprites/reference/class-portraits.jpg');
    await w.act(async () => selectClass('Воин').click());

    await w.act(async () => button('Начать путешествие').click()); await settle();
    assert.equal(save().player.name, 'Новый герой'); assert.match(w.document.body.textContent, /Бестиарий/);
    const original = save().player;
    assert.equal(button('Русский'), undefined); assert.equal(button('Українська'), undefined);
    assert.equal(w.document.querySelector('[data-skill-details]'), null);
    const activeTab = () => w.document.querySelector('nav button[aria-current="page"]')?.textContent.trim();
    for (const label of ['Сумка', 'Мир']) {
      await w.act(async () => button(label).click()); await settle();
      assert.equal(activeTab(), label);
      await w.act(async () => button('Современный').click()); await settle();
      assert.equal(activeTab(), label, 'modern keeps the selected section');
      await w.act(async () => button('Фэнтези').click()); await settle();
      assert.equal(activeTab(), label, 'fantasy keeps the selected section');
    }
    await w.act(async () => button('Ещё').click());
    await w.act(async () => button('Герой').click()); await settle();
    assert.equal(activeTab(), 'Ещё');
    await w.act(async () => button('Современный').click()); await settle();
    assert(w.document.querySelector('main').textContent.includes('Новый герой'), 'modern renders the fantasy hero tab');
    assert.equal([...w.document.querySelectorAll('button')].some((node: any) => node.textContent.includes('Начать охоту')), false);
    await w.act(async () => button('Фэнтези').click()); await settle();
    assert.equal(activeTab(), 'Ещё');
    await w.act(async () => button('Охота').click()); await settle();
    await w.act(async () => button('Современный').click()); await settle();
    assert.equal(w.document.documentElement.dataset.interface, 'modern'); assert.equal(save().player.id, original.id); assert.equal(save().player.gold, original.gold);
    await w.act(async () => button('Фэнтези').click()); await settle();
    const hunt = [...w.document.querySelectorAll('button')].find((node: any) => node.textContent.includes('Начать охоту')) as any;
    // The main action precedes the tall bestiary dossier in document order.
    assert(hunt.compareDocumentPosition([...w.document.querySelectorAll('h2')].find((node: any) => node.textContent === 'Бестиарий')) & w.Node.DOCUMENT_POSITION_FOLLOWING);
    await w.act(async () => hunt.click()); await settle();
    assert(button('Атака')); assert.equal(save().player.energy, original.energy - 2);
    await w.act(async () => button('Современный').click()); await settle();
    assert.equal(button('Русский'), undefined); assert.equal(button('Українська'), undefined);
    assert.equal(w.document.querySelector('[data-skill-details]'), null);
    assert(button('Атака')); assert.equal(save().player.energy, original.energy - 2);
    await w.act(async () => button('Фэнтези').click()); await settle(); assert(button('Атака'));
    await w.act(async () => w.root.unmount()); await w.act(async () => w.mount()); await settle();
    assert.equal(w.document.documentElement.dataset.interface, 'fantasy'); assert.equal(save().player.id, original.id);
    serverVersion = 1;
    await w.act(async () => w.dispatchEvent(new w.CustomEvent('aethelgard-account-reset', { detail: { resetVersion: 1 } }))); await settle();
    assert.equal(w.localStorage.getItem('aethelgard_save_v1_data'), null); assert.match(w.document.body.textContent, /Выберите свой интерфейс/);
    assert.equal(w.document.documentElement.dataset.interface, 'fantasy');
    assert(button('Русский')); assert(button('Українська'));
    assert(w.document.querySelector('[data-skill-details="w_strike"]'));
    await w.act(async () => button('Начать путешествие').click()); await settle();
    const recreated = save().player;
    assert.equal(save().resetVersion, 1);
    // A previous client can have stored the new character without this field.
    const legacy = save(); delete legacy.resetVersion;
    w.localStorage.setItem('aethelgard_save_v1_data', JSON.stringify(legacy));
    for (let visit = 0; visit < 2; visit++) {
      await w.act(async () => w.root.unmount()); await w.act(async () => w.mount()); await settle();
      assert.equal(save().player.id, recreated.id);
      assert.equal(save().resetVersion, 1);
      assert.equal(w.document.querySelector('.registration-screen'), null);
    }
    serverVersion = 2;
    await w.act(async () => w.dispatchEvent(new w.CustomEvent('aethelgard-account-reset', { detail: { resetVersion: 2 } }))); await settle();
    assert.equal(w.localStorage.getItem('aethelgard_save_v1_data'), null);
    assert(w.document.querySelector('.registration-screen'), 'a new admin reset still applies');
  } finally { await w.act(async () => w.root.unmount()); dom.window.close(); }
});

test('admin chooses a player and must confirm before sending a reset for that exact ID', async () => {
  const { dom, w } = await setup(`import React,{act} from 'react';import {createRoot} from 'react-dom/client';import {AdminPlayerReset} from './src/components/admin/AdminPlayerReset';window.act=act;window.mount=()=>{window.root=createRoot(document.getElementById('root'));window.root.render(<AdminPlayerReset/>);};`);
  const sent: any[] = [];
  w.fetch = async (url: string, options: any) => {
    if (options?.method === 'POST') sent.push({ url, body: JSON.parse(options.body) });
    return { ok: true, status: 200, text: async () => JSON.stringify({ players: [{ telegramId: '2', username: 'target', displayName: 'Второй', characterName: 'Воин', level: 12, resetVersion: 0, inClan: false }] }) };
  };
  try {
    await w.act(async () => w.mount()); await w.act(async () => { await new Promise(resolve => setTimeout(resolve, 300)); });
    const select = [...w.document.querySelectorAll('button')].find((node: any) => node.textContent.includes('ID 2')) as any;
    await w.act(async () => select.click());
    const reset = [...w.document.querySelectorAll('button')].find((node: any) => node.textContent === 'Сбросить выбранного игрока') as any;
    assert.equal(reset.disabled, true); assert.equal(sent.length, 0);
    await w.act(async () => w.document.querySelector('input[type="checkbox"]').click());
    assert.equal(reset.disabled, false);
    await w.act(async () => reset.click());
    assert.equal(sent.length, 1); assert.equal(sent[0].url, '/api/admin/players/2/reset'); assert.equal(sent[0].body.confirmTargetId, '2'); assert.equal(sent[0].body.expectedVersion, 0);
    assert.match(w.document.body.textContent, /Прогресс Воин сброшен/);
  } finally { await w.act(async () => w.root.unmount()); dom.window.close(); }
});


test('fantasy artwork uses new sprites and recovers from image failures; modern artwork stays unchanged', async () => {
  const { dom, w } = await setup(`import React,{act} from 'react';import {createRoot} from 'react-dom/client';import {ItemArtwork as FantasyItem} from './src/interfaces/fantasy/components/ui/ItemArtwork';import {ItemArtwork as ModernItem} from './src/components/ui/ItemArtwork';import {RpgIcon} from './src/interfaces/fantasy/components/ui/RpgIcon';import {ClassPortraitIcon} from './src/interfaces/fantasy/components/ui/ClassPortraitIcon';window.act=act;window.mount=()=>{window.root=createRoot(document.getElementById('root'));const item={name:'Меч',type:'weapon',rarity:'common',image:'/saved-sword.png'};window.root.render(<><div id="fantasy"><FantasyItem item={item}/></div><div id="modern"><ModernItem item={item}/></div><div id="icon"><RpgIcon kind="attack" title="Атака"/></div><div id="class"><ClassPortraitIcon classId="mage" label="Маг"/></div></>);};`);
  try {
    await w.act(async () => w.mount());
    const image = (id: string) => w.document.querySelector(`#${id} img`);
    assert.equal(image('fantasy').getAttribute('src'), '/assets/sprites/generated/ui/gear/weapon.webp');
    assert.equal(image('modern').getAttribute('src'), '/saved-sword.png');
    assert.equal(image('icon').getAttribute('src'), '/assets/sprites/generated/ui/icons/attack.webp');
    await w.act(async () => image('fantasy').dispatchEvent(new w.Event('error')));
    assert.equal(image('fantasy').getAttribute('src'), '/saved-sword.png');
    await w.act(async () => image('icon').dispatchEvent(new w.Event('error')));
    assert(w.document.querySelector('#icon svg'));
    assert.equal(image('modern').getAttribute('src'), '/saved-sword.png');
    assert.equal(w.document.querySelector('#class svg').getAttribute('viewBox'),'504 23 100 100');
    await w.act(async () => w.document.querySelector('#class image').dispatchEvent(new w.Event('error')));
    assert.equal(w.document.querySelector('#class image'),null);
    assert(w.document.querySelector('#class svg'), 'portrait falls back to its class SVG');
  } finally { await w.act(async () => w.root.unmount()); dom.window.close(); }
});

test('fantasy codex controls, complete loot, dialogs and every section work together', async () => {
  const { dom, w } = await setup(`import React,{act} from 'react';import {createRoot} from 'react-dom/client';import App from './src/App';import {MONSTERS} from './src/data/gameData';window.catalog=Object.values(MONSTERS);window.act=act;window.mount=()=>{window.root=createRoot(document.getElementById('root'));window.root.render(<App/>);};`);
  w.localStorage.setItem('aethelgard_interface_style', 'fantasy');
  w.fetch = async () => ({ ok: true, status: 200, text: async () => JSON.stringify({ resetVersion: 0, active: false, items: [], listings: [], players: [], messages: [], clans: [], clan: null, onlinePlayers: 0, profile: { enrolled: false, stance: 'balanced', rating: 1000, tickets: 5, wins: 0, losses: 0 }, opponents: [], leaders: [], history: [], resetAt: new Date().toISOString(), ok: true, totalGold: 0, isAdmin: false }) });
  const settle = async () => w.act(async () => { await new Promise(resolve => setTimeout(resolve, 50)); });
  const button = (label: string) => [...w.document.querySelectorAll('button')].find((node: any) => node.textContent.trim() === label) as any;
  const click = async (label: string) => { const node=button(label); assert(node, `missing button: ${label}`); await w.act(async () => node.click()); await settle(); };
  const aria = (label: string) => w.document.querySelector(`[aria-label="${label}"]`);
  try {
    await w.act(async () => w.mount()); await settle();
    await w.act(async () => {
      const input=w.document.querySelector('input[type="text"]');
      Object.getOwnPropertyDescriptor(w.HTMLInputElement.prototype,'value')!.set!.call(input,'Герой кодекса');
      input.dispatchEvent(new w.Event('input',{bubbles:true}));
    });
    await click('Начать путешествие');
    assert.equal(w.document.querySelectorAll('header').length,1);
    assert.equal(w.document.querySelectorAll('nav').length,1);
    assert.deepEqual([...w.document.querySelectorAll('nav button')].map((n:any)=>n.textContent.trim()),['Охота','Мир','Арена','Сумка','Создание','Ещё']);
    assert(w.document.querySelector('header [data-shell-frame="hud"]'));
    assert.equal(w.document.querySelectorAll('nav [data-shell-frame="active"]').length,1);
    assert(w.document.querySelector('.shell-hud-resources .is-silver'));
    await click('Арена'); assert.match(w.document.querySelector('main').textContent,/Арен/);
    await click('Создание'); assert(w.document.querySelector('main').textContent.trim().length>0);
    await click('Охота');
    const dossier=w.document.querySelector('.bestiary-dossier');
    const monsterName=dossier.querySelector('h2').textContent;
    const monster=w.catalog.find((m:any)=>m.name===monsterName);
    assert(monster);
    assert.equal(dossier.querySelectorAll('.loot-entry').length,monster.drops.length,'all drop types and entries are shown');
    for (const drop of monster.drops) assert(dossier.textContent.includes(drop.itemName));
    const energy=w.document.querySelector('button[title="Энергия. Открыть способы восстановления"]');
    await w.act(async()=>energy.click());
    assert.equal(button('Медитация · бесплатноЗапас полон')?.disabled,true);
    await w.act(async()=>w.document.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape',bubbles:true})));
    const settings=aria('Настройки автобоя');
    await w.act(async () => { settings.focus(); settings.click(); });
    assert.equal(w.document.querySelector('[role="dialog"]').getAttribute('aria-label'),'Настройки автобоя');
    assert.equal(w.document.body.style.overflow,'hidden');
    const slider=aria('Порог автозелья по здоровью');
    await w.act(async () => { Object.getOwnPropertyDescriptor(w.HTMLInputElement.prototype,'value')!.set!.call(slider,'35'); slider.dispatchEvent(new w.Event('input',{bubbles:true})); });
    assert.match(w.document.querySelector('[role="dialog"]').textContent,/35%/);
    await w.act(async () => w.document.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape',bubbles:true})));
    assert.equal(w.document.querySelector('[role="dialog"]'),null);
    assert.equal(w.document.body.style.overflow,''); assert(w.document.activeElement === settings, 'focus returns to settings button');
    await w.act(async () => aria('Открыть лист персонажа').click()); await settle();
    const before=JSON.parse(w.localStorage.getItem('aethelgard_save_v1_data')).player;
    await w.act(async () => aria('Повысить: Сила').click()); await settle();
    const after=JSON.parse(w.localStorage.getItem('aethelgard_save_v1_data')).player;
    assert.equal(after.attributes.strength,before.attributes.strength+1);assert.equal(after.statPoints,before.statPoints-1);
    await click('Снаряжение');
    await w.act(async () => aria('Сменить: Оружие').click()); await settle();
    assert.equal(w.document.querySelector('nav button[aria-current="page"]').textContent.trim(),'Сумка');
    await w.act(async () => aria('Открыть лист персонажа').click()); await settle();await click('Спутник');await click('Выбрать ›');
    assert.match(w.document.querySelector('main').textContent,/Спутник|Питом|СПУТНИК/i);
    for (const label of ['Кузница','Алхимия','Шахта','Рынок','Клан','Спутники','Чат','Рейтинг','Журнал']) {
      await click('Ещё');await click(label);
      assert(w.document.querySelector('main').textContent.trim().length>0,`${label} renders`);
      if (label === 'Арена') { await click('PvP — игроки'); assert.match(w.document.querySelector('main').textContent,/1000/); }
      assert.equal(w.document.querySelector('[aria-label="Другие разделы"]'),null);
    }
    await click('Мир');await w.act(async () => aria('Открыть лист персонажа').click()); await settle();
    assert(w.document.querySelector('[data-reference-region="frame"] image'));
    assert(w.document.querySelector('[data-reference-region="castle"] image'));
    assert(w.document.querySelector('[data-reference-region="strength"] image'));
    assert.equal(w.document.querySelector('.hero-reference-tabs [aria-selected="true"]').textContent,'Характеристики');
    assert.equal(w.document.querySelector('[data-reference-region="frame"] image').getAttribute('href'),'/assets/sprites/reference/hero-codex.jpg');
    await click('Современный');
    assert.equal(w.document.querySelector('.hero-codex'),null,'modern retains its own character layout');
    assert.equal(JSON.parse(w.localStorage.getItem('aethelgard_save_v1_data')).player.id,before.id);
    await w.act(async()=>w.root.unmount());
    const save=JSON.parse(w.localStorage.getItem('aethelgard_save_v1_data'));
    save.player.level=25;save.player.currentRegionId='reg_plains';
    w.localStorage.setItem('aethelgard_save_v1_data',JSON.stringify(save));
    w.localStorage.setItem('aethelgard_interface_style','fantasy');
    await w.act(async()=>w.mount());await settle();await click('Мир');
    assert.match(w.document.querySelector('.atlas-node[aria-pressed="true"]').textContent,/ВЫ ЗДЕСЬ/,'world keeps actual location even above its recommended level');
  } finally { await w.act(async () => w.root.unmount()); dom.window.close(); }
});

test('fantasy portraits recover when selecting a new source after a loading error', async () => {
  const {dom,w}=await setup(`import React,{act} from 'react';import {createRoot} from 'react-dom/client';import {Portrait} from './src/interfaces/fantasy/components/ui/Portrait';window.act=act;window.mount=()=>{window.root=createRoot(document.getElementById('root'));window.show=src=>window.root.render(<Portrait src={src} alt="Волк"/>);window.show('/missing.webp');};`);
  try {
    await w.act(async()=>w.mount());
    await w.act(async()=>w.document.querySelector('img').dispatchEvent(new w.Event('error')));
    assert(w.document.querySelector('[role="img"][aria-label="Волк"]'));
    await w.act(async()=>w.show('/wolf.webp'));
    assert.equal(w.document.querySelector('img').getAttribute('src'),'/wolf.webp');
  } finally {await w.act(async()=>w.root.unmount());dom.window.close();}
});


test('uncatalogued fantasy enemies retain their own portrait instead of using a bandit', () => {
  assert.equal(getMonsterArtworkPath('custom_beast', '/assets/beast.webp'), '/assets/beast.webp');
  assert.equal(getMonsterArtworkPath('custom_beast', '🐻'), '');
  assert.equal(getMonsterArtworkPath('custom_beast', 'javascript:alert(1)'), '');
  assert.equal(getMonsterArtworkPath('m_wolf', '/old-wolf.jpg'), '/assets/sprites/generated/monsters/m_wolf.webp');
});


test('a pre-reset provider cannot save over the cleared account while a current provider can create a new hero', async () => {
  const { dom, w } = await setup(`import React,{act} from 'react';import {createRoot} from 'react-dom/client';import {GameProvider,useGame} from './src/context/GameContext';import {getTelegramUser} from './src/utils/telegram';function Probe(){window.game=useGame();return null;}window.act=act;window.userId=getTelegramUser().id;window.mount=()=>{window.root=createRoot(document.getElementById('root'));window.root.render(<GameProvider><Probe/></GameProvider>);};`);
  w.fetch = async () => ({ok:true,status:200,text:async()=>JSON.stringify({active:false,items:[],ok:true,totalGold:0,isAdmin:false})});
  const saveKey = 'aethelgard_save_v1_data';
  const versionKey = 'aethelgard_reset_version_' + w.userId;
  try {
    await w.act(async () => w.mount());
    await w.act(async () => w.game.createCharacter('До сброса','warrior'));
    assert.equal(JSON.parse(w.localStorage.getItem(saveKey)).resetVersion,0);
    // Another tab has handled the reset; this provider still has the old epoch.
    w.localStorage.removeItem(saveKey); w.localStorage.setItem(versionKey,'1');
    await w.act(async () => w.game.createCharacter('Устаревшая сессия','warrior'));
    assert.equal(w.localStorage.getItem(saveKey),null);
    await w.act(async () => w.root.unmount()); await w.act(async () => w.mount());
    await w.act(async () => w.game.createCharacter('После сброса','warrior'));
    const save=JSON.parse(w.localStorage.getItem(saveKey));
    assert.equal(save.resetVersion,1); assert.equal(save.player.name,'После сброса');
  } finally { await w.act(async () => w.root.unmount()); dom.window.close(); }
});


test('fantasy pets show live active-first cards, exact reference artwork, ingredient counts and unchanged craft/selection actions', async () => {
  const bundle = await build({stdin:{contents:`import React,{act} from 'react';import {createRoot} from 'react-dom/client';import {PetsScreen} from './src/interfaces/fantasy/components/pets/PetsScreen';import {PETS_LIST} from './src/data/gameData';window.pets=PETS_LIST;window.act=act;window.mount=()=>{window.root=createRoot(document.getElementById('root'));window.root.render(<PetsScreen/>);};window.render=()=>window.root.render(<PetsScreen/>);`,resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,platform:'browser',format:'iife',plugins:[{name:'fixture',setup(b){b.onResolve({filter:/\/context\/GameContext$/},()=>({path:'fixture',namespace:'pet-test'}));b.onLoad({filter:/.*/,namespace:'pet-test'},()=>({contents:'export const useGame=()=>window.gameData;',loader:'js'}));}},{name:'art',setup(b){b.onLoad({filter:/\.(jpg|webp)$/},()=>({contents:'export default "art";',loader:'js'}));}}]});
  const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost',runScripts:'outside-only'});const w:any=dom.window;
  w.IS_REACT_ACT_ENVIRONMENT=true;
  w.MessageChannel=class{port1={onmessage:null as any};port2={postMessage:()=>setTimeout(()=>this.port1.onmessage?.(),0)};};
  w.localStorage.setItem('aethelgard_language','uk');w.eval(bundle.outputFiles[0].text);
  const calls:string[]=[];
  w.gameData={player:{miningLevel:40,craftedPetIds:['pet_wolf'],activePet:w.pets[0],inventory:[{name:'Мифриловая руда',stackCount:7}]},setActivePet:(id:string)=>{calls.push(id);return true;},craftPet:(id:string)=>{calls.push(id);return {message:'Недостатньо матеріалів.'};}};
  try {
    await w.act(async()=>w.mount());
    const cards=()=>[...w.document.querySelectorAll('.pet-codex-card')];
    assert.equal(cards().length,5);assert.match(cards()[0].textContent,/Сніговий лютововк/);
    assert.equal(w.document.querySelector('.pet-artwork svg').getAttribute('viewBox'),'32 302 215 164');
    assert.equal(w.document.querySelector('.pet-artwork image').getAttribute('href'),'/assets/sprites/reference/pet-codex.jpg');
    const dragon=cards().find((c:any)=>c.textContent.includes('85'));const fairy=cards().find((c:any)=>c.textContent.includes('7/10'));
    assert(dragon.querySelector('button').disabled);assert.equal(fairy.querySelector('button').disabled,false);
    await w.act(async()=>fairy.querySelector('button').click());assert.deepEqual(calls,['pet_fairy']);
    assert.match(w.document.querySelector('[role="status"]').textContent,/Недостатньо матеріалів/);
    w.gameData.player={...w.gameData.player,activePet:w.pets[1],craftedPetIds:['pet_wolf','pet_dragon']};
    await w.act(async()=>w.render());assert.match(cards()[0].textContent,/Вогняний дракончик/);
    const wolf=cards().find((c:any)=>c.textContent.includes('Сніговий лютововк'));
    await w.act(async()=>wolf.querySelector('button').click());assert.equal(calls.at(-1),'pet_wolf');
    await w.act(async()=>w.document.querySelector('.pet-codex-card.is-active .pet-artwork image').dispatchEvent(new w.Event('error')));
    assert.equal(w.document.querySelector('.pet-codex-card.is-active .pet-artwork image'),null,'failed artwork keeps the active pet card with a fallback');
    assert(w.document.querySelector('.pet-artwork'));
  } finally {await w.act(async()=>w.root.unmount());dom.window.close();}
});

test('fantasy inventory manuscript retains equipment, locks, salvage, sale and resource navigation', async () => {
  const {dom,w}=await setup(`import React,{act} from 'react';import {createRoot} from 'react-dom/client';import {GameProvider,useGame} from './src/context/GameContext';import {InventoryScreen} from './src/interfaces/fantasy/components/inventory/InventoryScreen';window.act=act;window.workshop=0;function Screen(){window.game=useGame();return window.game.player?<InventoryScreen onNavigateToCrafting={()=>window.workshop++}/>:null;}window.mount=()=>{window.root=createRoot(document.getElementById('root'));window.root.render(<GameProvider><Screen/></GameProvider>);};`);
  w.fetch=async()=>({ok:true,status:200,text:async()=>JSON.stringify({resetVersion:0,active:false,items:[],ok:true,totalGold:0,isAdmin:false})});
  const settle=async()=>w.act(async()=>{await new Promise(r=>setTimeout(r,40));});
  const button=(text:string)=>[...w.document.querySelectorAll('button')].find((n:any)=>n.textContent.trim()===text) as any;
  const click=async(text:string)=>{assert(button(text),`missing: ${text}`);await w.act(async()=>button(text).click());await settle();};
  const slot=()=>w.document.querySelector('[data-equipment-slot="weapon"]');
  const selectBag=async(id:string)=>{const node=w.document.querySelector(`[data-inventory-item="${id}"]`);assert(node);await w.act(async()=>node.click());};
  try {
    await w.act(async()=>w.mount());await settle();await w.act(async()=>w.game.createCharacter('Арсенал','paladin'));await settle();
    const weapon=w.game.player.equipped.weapon;
    assert.equal(w.document.querySelectorAll('[data-equipment-slot]').length,14);
    assert(w.document.querySelector('[data-reference-part="paladin-equipment"]'));
    assert.equal(w.document.querySelectorAll('header,nav').length,0,'screen relies on the shared shell');
    await w.act(async()=>slot().click());assert.equal(button('Продать за '+weapon.sellPrice+' золота'),undefined);
    assert(![...w.document.querySelectorAll('button')].some((n:any)=>n.textContent.includes('Разобрать →')),'equipped item cannot be disposed');
    await click('Снять');assert.equal(slot().disabled,true);assert(w.game.player.inventory.some((i:any)=>i.id===weapon.id));
    await selectBag(weapon.id);await click('Защитить от продажи');assert(w.game.player.inventory.find((i:any)=>i.id===weapon.id).isLocked);
    assert(![...w.document.querySelectorAll('button')].some((n:any)=>n.textContent.includes('Разобрать →')));
    await click('Разблокировать');await click('Экипировать');assert.equal(w.game.player.equipped.weapon.id,weapon.id);
    await w.act(async()=>slot().click());await w.act(async()=>w.document.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape',bubbles:true})));
    assert.equal(w.document.querySelector('[role="dialog"]'),null);assert.equal(w.document.body.style.overflow,'');
    await w.act(async()=>slot().click());await click('Снять');await selectBag(weapon.id);
    const salvage=[...w.document.querySelectorAll('button')].find((n:any)=>n.textContent.includes('Разобрать →')) as any;assert(salvage);assert.match(salvage.textContent,/Железная руда ×3/);
    const silver=w.game.player.silver;await w.act(async()=>salvage.click());await settle();
    assert(!w.game.player.inventory.some((i:any)=>i.id===weapon.id));assert.equal(w.game.player.silver,silver+2);
    const potion=w.game.player.inventory.find((i:any)=>i.type==='potion');
    const tab=(prefix:string)=>[...w.document.querySelectorAll('[role="tab"]')].find((n:any)=>n.textContent.startsWith(prefix)) as any;
    await w.act(async()=>tab('Зелья').click());await selectBag(potion.id);
    const sale=[...w.document.querySelectorAll('button')].find((n:any)=>n.textContent.includes('Продать за')) as any;assert(sale);
    const gold=w.game.player.gold;await w.act(async()=>sale.click());await settle();assert(w.game.player.gold>gold);
    await w.act(async()=>tab('Ресурсы').click());assert(w.document.querySelector('[data-reference-part="item-ore"]'));
    await click('Открыть мастерскую снаряжения · рецепты и ресурсы');assert.equal(w.workshop,1);
  } finally {await w.act(async()=>w.root.unmount());dom.window.close();}
});
