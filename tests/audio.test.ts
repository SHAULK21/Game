import test from 'node:test';
import assert from 'node:assert/strict';
import { SoundManager } from '../src/utils/audio';

const settle = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };
test('mobile touchend retries a rejected first gesture and recovers interrupted/closed audio',async()=>{
 const original={document:(globalThis as any).document,window:(globalThis as any).window,fetch:globalThis.fetch,storage:(globalThis as any).localStorage};
 const documentTarget=new EventTarget();let hidden=false,gesture=false;
 Object.defineProperty(documentTarget,'hidden',{get:()=>hidden});
 const contexts:MobileContext[]=[];let played=0,wakes=0;
 class MobileContext {
  state='suspended';currentTime=0;destination={};sampleRate=48000;
  constructor(){contexts.push(this);}
  async resume(){if(!gesture)throw new Error('gesture required');this.state='running';}
  createGain(){return {gain:{value:0},connect(){},disconnect(){}};}
  createBuffer(){return {silent:true};}
  async decodeAudioData(){return {silent:false};}
  createBufferSource(){return {buffer:null as any,playbackRate:{value:1},onended:null as any,connect(){},disconnect(){},stop(){},start(){if(this.buffer.silent)wakes++;else played++;}};}
 }
 (globalThis as any).document=documentTarget;
 (globalThis as any).window={webkitAudioContext:MobileContext,addEventListener(){}};
 (globalThis as any).localStorage={getItem:()=>null,setItem(){}};
 globalThis.fetch=(async()=>({ok:true,arrayBuffer:async()=>new ArrayBuffer(8)})) as any;
 const touch=async()=>{gesture=true;documentTarget.dispatchEvent(new Event('touchend'));gesture=false;await settle();};
 try {
  const sound=new SoundManager();
  documentTarget.dispatchEvent(new Event('pointerdown'));await settle();
  assert.equal(contexts[0].state,'suspended');
  await touch();assert.equal(contexts[0].state,'running');assert(wakes>0);
  sound.playSlash();await settle();assert.equal(played,1);
  hidden=true;documentTarget.dispatchEvent(new Event('visibilitychange'));
  contexts[0].state='interrupted';hidden=false;documentTarget.dispatchEvent(new Event('visibilitychange'));await settle();
  await touch();assert.equal(contexts[0].state,'running');
  sound.playMagic();await settle();assert.equal(played,2,'sounds recover after backgrounding');
  contexts[0].state='closed';await touch();assert.equal(contexts.length,2);
  sound.playDefend();await settle();assert.equal(played,3,'closed audio context is recreated');
  sound.toggleMute();await touch();sound.playMining();await settle();assert.equal(played,3,'gestures preserve the mute preference');
 }finally{
  (globalThis as any).document=original.document;(globalThis as any).window=original.window;globalThis.fetch=original.fetch;(globalThis as any).localStorage=original.storage;
 }
});
function environment() {
  const starts: any[] = [], stops: any[] = [], requests: string[] = [];
  let now = 1000, decoded = 0;
  class Context {
    state = 'running'; currentTime = 0; destination = {};
    async resume() { this.state = 'running'; }
    createGain() { return {gain:{value:0},connect(){},disconnect(){}}; }
    async decodeAudioData() { return {id:decoded++}; }
    createBufferSource() {
      const source = {buffer:null,playbackRate:{value:1},onended:null as any,connect(){},disconnect(){},start(){starts.push(source);},stop(){stops.push(source);source.onended?.();}};
      return source;
    }
  }
  const original = { window: (globalThis as any).window, fetch: globalThis.fetch, storage: (globalThis as any).localStorage, now: Date.now };
  (globalThis as any).window = {AudioContext: Context};
  (globalThis as any).localStorage = {getItem:()=>null,setItem:()=>{}};
  globalThis.fetch = (async (url: any) => { requests.push(String(url)); return {ok:true,arrayBuffer:async()=>new ArrayBuffer(8)}; }) as any;
  Date.now = () => now;
  return {starts,stops,requests,advance:(n=200)=>{now+=n;},restore:()=>{(globalThis as any).window=original.window;globalThis.fetch=original.fetch;(globalThis as any).localStorage=original.storage;Date.now=original.now;}};
}

test('recorded audio is cached, repeated attack spam is limited, mute stops voices and can be reversed', async () => {
  const e = environment();
  try {
    const sound = new SoundManager();
    sound.playSlash(); await settle();
    assert.equal(e.starts.length,1);
    const downloads = e.requests.length;
    assert(downloads > 10); assert(e.requests.every(url=>url.startsWith('/assets/audio/')));
    sound.playSlash(); await settle(); assert.equal(e.starts.length,1);
    e.advance(); sound.playSlash(); await settle(); assert.equal(e.starts.length,2);
    assert.equal(e.requests.length,downloads,'decoded samples are reused');
    assert.equal(sound.toggleMute(),true); assert.equal(e.stops.length,2);
    e.advance(); sound.playMagic(); await settle(); assert.equal(e.starts.length,2);
    sound.toggleMute(); sound.playDefend(); await settle(); assert.equal(e.starts.length,3);
  } finally { e.restore(); }
});

test('a delayed download cannot burst into playback later or survive a mute/unmute cycle', async () => {
  const e = environment();
  let release!: () => void;
  const gate = new Promise<void>(resolve=>release=resolve);
  globalThis.fetch = (async()=>{await gate;return {ok:true,arrayBuffer:async()=>new ArrayBuffer(8)};}) as any;
  try {
    const sound = new SoundManager();
    sound.playMining(); await settle();
    sound.toggleMute(); sound.toggleMute();
    e.advance(500); release(); await settle();
    assert.equal(e.starts.length,0);
    sound.playMining(); await settle(); assert.equal(e.starts.length,1,'a current event can play a now-cached sample');
  } finally { release(); e.restore(); }
});

test('missing audio or unsupported Web Audio does not throw or block gameplay', async () => {
  const e = environment();
  try {
    globalThis.fetch = (async()=>{throw new Error('offline');}) as any;
    const sound = new SoundManager(); sound.playVictory(); await settle(); assert.equal(e.starts.length,0);
    (globalThis as any).window = {};
    const unsupported = new SoundManager(); unsupported.playCriticalHit(); await settle(); assert.equal(e.starts.length,0);
  } finally { e.restore(); }
});


test('ordinary attacks use all eight recordings before repeating and throttle rapid clicks', async () => {
  const e = environment();
  try {
    const sound = new SoundManager();
    for (let i = 0; i < 16; i++) {
      sound.playSlash(); await settle();
      const count = e.starts.length;
      e.advance(100); sound.playSlash(); await settle();
      assert.equal(e.starts.length,count,'click within 180 ms is silent');
      e.starts.at(-1).onended(); e.advance(100);
    }
    assert.equal(e.starts.length,16);
    const ids = e.starts.map(s=>s.buffer.id);
    assert.equal(new Set(ids.slice(0,8)).size,8);
    assert.equal(new Set(ids.slice(8,16)).size,8);
    assert.notEqual(ids[7],ids[8],'bag boundary does not repeat');
  } finally { e.restore(); }
});

test('enemy physical attacks cycle through four distinct recordings and magic has a separate tone', async () => {
  const e = environment();
  try {
    const sound = new SoundManager();
    sound.playSlash(); await settle();
    const playerBuffer = e.starts[0].buffer;
    e.starts[0].onended();
    for (let i=0;i<4;i++) {
      e.advance(); sound.playMonsterAttack('physical'); await settle(); e.starts.at(-1).onended();
    }
    const enemy = e.starts.slice(1);
    assert.equal(new Set(enemy.map(s=>s.buffer.id)).size,4);
    assert(enemy.every(s=>s.buffer!==playerBuffer));
    e.advance(); sound.playMonsterAttack('fire'); await settle();
    assert(e.starts.at(-1).playbackRate.value < .57);
    assert(!enemy.some(s=>s.buffer===e.starts.at(-1).buffer));
  } finally { e.restore(); }
});


test('fishing has distinct cached cues, variant recordings and respects mute',async()=>{
 const e=environment();try{
  const sound=new SoundManager();sound.playFishingCast();await settle();e.advance();sound.playFishingBite();await settle();e.advance();sound.playFishingReel();await settle();e.advance();sound.playFishingCatch();await settle();
  assert.equal(e.starts.length,4);assert.equal(new Set(e.starts.map(s=>s.buffer)).size,4);assert(e.requests.some(url=>url.includes('fishBite')));
  const downloads=e.requests.length;e.advance();sound.playFishingBite();await settle();assert.equal(e.requests.length,downloads);assert.equal(e.starts.length,5);
  sound.toggleMute();e.advance();sound.playFishingCatch();await settle();assert.equal(e.starts.length,5);
 }finally{e.restore();}
});
