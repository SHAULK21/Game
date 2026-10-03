import test from 'node:test';
import assert from 'node:assert/strict';
import { SoundManager } from '../src/utils/audio';

const settle = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };
function environment() {
  const starts: any[] = [], stops: any[] = [], requests: string[] = [];
  let now = 1000;
  class Context {
    state = 'running'; currentTime = 0; destination = {};
    async resume() { this.state = 'running'; }
    createGain() { return {gain:{value:0},connect(){},disconnect(){}}; }
    async decodeAudioData() { return {}; }
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
  return {starts,stops,requests,advance:(n=100)=>{now+=n;},restore:()=>{(globalThis as any).window=original.window;globalThis.fetch=original.fetch;(globalThis as any).localStorage=original.storage;Date.now=original.now;}};
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
