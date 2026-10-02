import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { JSDOM } from 'jsdom';

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
    const input = w.document.querySelector('input[type="text"]');
    await w.act(async () => {
      Object.getOwnPropertyDescriptor(w.HTMLInputElement.prototype, 'value')!.set!.call(input, 'Новый герой');
      input.dispatchEvent(new w.Event('input', { bubbles: true }));
    });
    const fantasy = [...w.document.querySelectorAll('button')].find((node: any) => node.textContent.startsWith('Фэнтези')) as any;
    await w.act(async () => fantasy.click());
    assert.equal(w.document.documentElement.dataset.interface, 'fantasy'); assert.equal(input.value, 'Новый герой');
    await w.act(async () => button('Начать путешествие').click()); await settle();
    assert.equal(save().player.name, 'Новый герой'); assert.match(w.document.body.textContent, /Бестиарий/);
    const original = save().player;
    const activeTab = () => w.document.querySelector('nav button[aria-current="page"]')?.textContent.trim();
    for (const label of ['Сумка', 'Мир']) {
      await w.act(async () => button(label).click()); await settle();
      assert.equal(activeTab(), label);
      await w.act(async () => button('Современный').click()); await settle();
      assert.equal(activeTab(), label, 'modern keeps the selected section');
      await w.act(async () => button('Фэнтези').click()); await settle();
      assert.equal(activeTab(), label, 'fantasy keeps the selected section');
    }
    await w.act(async () => button('Герой').click()); await settle();
    assert.equal(activeTab(), 'Герой');
    await w.act(async () => button('Современный').click()); await settle();
    assert(w.document.querySelector('main').textContent.includes('Новый герой'), 'modern renders the fantasy hero tab');
    assert.equal([...w.document.querySelectorAll('button')].some((node: any) => node.textContent.includes('Начать охоту')), false);
    await w.act(async () => button('Фэнтези').click()); await settle();
    assert.equal(activeTab(), 'Герой');
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
    assert(button('Атака')); assert.equal(save().player.energy, original.energy - 2);
    await w.act(async () => button('Фэнтези').click()); await settle(); assert(button('Атака'));
    await w.act(async () => w.root.unmount()); await w.act(async () => w.mount()); await settle();
    assert.equal(w.document.documentElement.dataset.interface, 'fantasy'); assert.equal(save().player.id, original.id);
    serverVersion = 1;
    await w.act(async () => w.dispatchEvent(new w.CustomEvent('aethelgard-account-reset', { detail: { resetVersion: 1 } }))); await settle();
    assert.equal(w.localStorage.getItem('aethelgard_save_v1_data'), null); assert.match(w.document.body.textContent, /Выберите свой интерфейс/);
    assert.equal(w.document.documentElement.dataset.interface, 'fantasy');
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
