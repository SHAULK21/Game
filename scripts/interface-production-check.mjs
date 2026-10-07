/** Runs the actual production ESM in an emulated document. No browser paint/Network claim. */
import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {JSDOM,VirtualConsole} from 'jsdom';
const modes = ['modern','fantasy','fantasy-beta'];
const root = path.resolve(process.argv[2] || 'dist');
const manifest = JSON.parse(await fs.readFile(path.join(root,'.vite/manifest.json'),'utf8'));
const sleep = ms => new Promise(resolve => setTimeout(resolve,ms));
export async function boot(style,save,storage={},session={}) {
  const vc = new VirtualConsole(), errors=[];
  vc.on('jsdomError',e => { if (!/navigation|HTMLMediaElement/.test(e.message)) errors.push(e.message); });
  vc.on('error',(...args) => errors.push(args.map(String).join(' ')));
  const dom = new JSDOM('<html><head></head><body><div id="root"></div></body></html>',{url:'http://game.test/',runScripts:'outside-only',pretendToBeVisual:true,virtualConsole:vc});
  const w=dom.window, loaded=new Set();
  w.Headers=Headers;w.AbortSignal=AbortSignal;w.TextEncoder=TextEncoder;w.TextDecoder=TextDecoder;w.matchMedia=()=>({matches:true,addEventListener(){},removeEventListener(){}});
  w.fetch=async url=>{if(String(url).includes('/assets/')){loaded.add(new URL(url,w.location.href).pathname.slice(1));return {ok:true};}return {ok:true,status:200,text:async()=>JSON.stringify({resetVersion:0,active:false,items:[],ok:true,isAdmin:false,clan:null,clans:[],messages:[],players:[],listings:[],opponents:[],members:[],onlinePlayers:0,totalGold:0,notifications:[],settings:{enabled:false,onboardingSeen:true},profile:{enrolled:false},history:[],leaders:[]})};};
  for(const [key,value]of Object.entries(storage))w.localStorage.setItem(key,value);
  for(const [key,value]of Object.entries(session))w.sessionStorage.setItem(key,value);
  w.localStorage.setItem('aethelgard_interface_style',style);w.localStorage.setItem('aethelgard_story_intro_v1_749219401','done');
  if(save)w.localStorage.setItem('aethelgard_save_v1_data_749219401',JSON.stringify(save));
  const original=w.Node.prototype.appendChild;
  w.Node.prototype.appendChild=function(node){if(node.tagName==='LINK'&&node.href){loaded.add(new URL(node.href).pathname.slice(1));if(node.rel==='stylesheet')queueMicrotask(()=>node.dispatchEvent(new w.Event('load')));}return original.call(this,node);};
  const context=dom.getInternalVMContext(), modules=new Map();
  async function get(file){if(modules.has(file))return modules.get(file);loaded.add(file);const source=await fs.readFile(path.join(root,file),'utf8');const module=new vm.SourceTextModule(source,{context,identifier:file,initializeImportMeta(meta){meta.url='http://game.test/'+file;},importModuleDynamically:async(specifier,parent)=>{const file=path.posix.normalize(path.posix.join(path.posix.dirname(parent.identifier),specifier));const child=await get(file);if(child.status==='unlinked')await child.link(linker);if(child.status==='linked')await child.evaluate();return child;}});modules.set(file,module);return module;}
  const linker=(specifier,parent)=>get(path.posix.normalize(path.posix.join(path.posix.dirname(parent.identifier),specifier)));
  for(const file of manifest['index.html'].css||[])loaded.add(file);
  const entry=await get(manifest['index.html'].file);await entry.link(linker);await entry.evaluate();
  const ready=async()=>{for(let i=0;i<200;i++){await sleep(10);if(w.document.querySelector('.registration-screen,.game-shell')&&![...w.document.querySelectorAll('main [role="status"]')].some(node=>/Загрузка|Завантаження/.test(node.textContent)))return;}throw new Error('Screen did not load: '+style+' '+w.document.body.textContent.slice(0,160)+' '+errors.join(';'));};
  await ready();await sleep(30);
  const exportStorage=store=>Object.fromEntries(Array.from({length:store.length},(_,i)=>{const key=store.key(i);return [key,store.getItem(key)];}));
  return {w,loaded,errors,ready,close:()=>dom.window.close(),storage:()=>exportStorage(w.localStorage),session:()=>exportStorage(w.sessionStorage)};
}
const initial=await boot('modern');
[...initial.w.document.querySelectorAll('button')].find(b=>b.textContent.includes('Начать путешествие')).click();
for(let i=0;i<100&&!initial.w.localStorage.getItem('aethelgard_save_v1_data_749219401');i++)await sleep(10);
const seed=JSON.parse(initial.w.localStorage.getItem('aethelgard_save_v1_data_749219401'));assert(seed?.player);
seed.player.firstJourney='done';seed.player.firstJourneyDeparture=false;seed.player.statPoints=0;initial.close();
const stable=p=>JSON.stringify({...p,lastActiveTimestamp:0});
const results=[];
for(const mode of modes){const app=await boot(mode,seed);const resources=[];for(const file of [...app.loaded].sort()){if(/\.(js|css)$/.test(file))resources.push({file,bytes:(await fs.stat(path.join(root,file))).size});}results.push({mode,js:resources.filter(r=>r.file.endsWith('.js')).reduce((a,r)=>a+r.bytes,0),css:resources.filter(r=>r.file.endsWith('.css')).reduce((a,r)=>a+r.bytes,0),resources,errors:app.errors});
 if(root.endsWith('/dist')){
  for(const other of modes.filter(m=>m!==mode)){const entry=manifest['src/interfaces/'+(other==='fantasy-beta'?'fantasy-beta':other)+'/entry.tsx'];assert(!app.loaded.has(entry.file),'foreign entry '+other);for(const css of entry.css||[])assert(!app.loaded.has(css),'foreign CSS '+other);}
  const foreign=mode==='fantasy'?'BetaHuntDashboard':mode==='fantasy-beta'?'HuntDashboard':null;
  if(foreign)for(const [key,value]of Object.entries(manifest))if(key.endsWith('/'+foreign+'.tsx'))assert(!app.loaded.has(value.file),'foreign hunt dashboard '+foreign);
  assert.equal(app.errors.length,0,app.errors.join(';'));
  // Exercise every lazy game section with the emitted production modules.
  const click = async label => {
    if(mode==='modern') label=({Создание:'Крафт',Спутники:'Питомцы',Журнал:'Квесты'})[label]||label;
    let button = [...app.w.document.querySelectorAll('nav button')].find(b => b.textContent.trim() === label);
    if (!button) {
      const more = [...app.w.document.querySelectorAll('nav button')].find(b => b.textContent.trim() === 'Ещё');
      assert(more,'More navigation'); more.click(); await sleep(20);
      button = [...app.w.document.querySelectorAll('.game-section')].find(b => b.textContent.trim().startsWith(label));
    }
    assert(button,'Missing section '+mode+'/'+label); button.click(); await app.ready();
    assert(app.w.document.querySelector('main').textContent.trim(),'Empty section '+mode+'/'+label);
  };
  for(const label of ['Мир','Арена','Сумка','Создание','Герой','Кузница','Алхимия','Рыбалка','Шахта','Рынок','Клан','Спутники','Чат','Рейтинг','Журнал','Охота']) await click(label);
  assert.equal(app.errors.length,0,app.errors.join(';'));
  if(mode==='fantasy-beta') {
    assert(!app.w.document.querySelector('image[href="/assets/sprites/reference/hero-codex.jpg"]'));
    const classic = manifest['src/interfaces/fantasy/components/ui/ClassicHeroReferenceArt.tsx'];
    assert(!app.loaded.has(classic.file),'beta must not load the classic reference renderer');
  }

  for(const to of modes.filter(m=>m!==mode)){
   const switchingApp = await boot(mode,seed);
   const current=JSON.parse(switchingApp.w.localStorage.getItem('aethelgard_save_v1_data_749219401'));const button=[...switchingApp.w.document.querySelectorAll('button')].find(b=>b.textContent.trim()===({modern:'Современный',fantasy:'Фэнтези','fantasy-beta':'Фэнтези — бета'})[to]);assert(button&&!button.disabled,'switch button unavailable');button.click();await sleep(20);assert.equal(switchingApp.w.localStorage.getItem('aethelgard_interface_style'),to);assert.equal(switchingApp.w.document.documentElement.dataset.interface,mode,'no live theme swap');const restored=await boot(to,null,switchingApp.storage(),switchingApp.session());assert.equal(restored.w.document.documentElement.dataset.interface,to);assert.equal(stable(JSON.parse(restored.w.localStorage.getItem('aethelgard_save_v1_data_749219401')).player),stable(current.player));restored.close(); switchingApp.close();
  }
 }
 app.close();}
console.log(JSON.stringify(results,null,2));
