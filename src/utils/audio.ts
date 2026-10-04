import manifest from '../../public/assets/audio/manifest.json';

type Cue = keyof typeof manifest;
const LEVELS: Record<Cue, number> = {
  page: 0.3, slash: 0.38, shield: 0.6, heavy: 0.65, potion: 0.4, magic: 0.45,
  coins: 0.4, step: 0.35, mine: 0.55, whoosh: 0.35, bell: 0.3, fail: 0.4, monster: 0.55, fishCast: 0.6, fishBite: 0.75, fishReel: 0.55, fishCatch: 0.65
};

/** Short foley, shared by both interfaces. No queued sounds after a slow load. */
export class SoundManager {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private muted = false;
  private buffers = new Map<string, Promise<AudioBuffer | null>>();
  private voices = new Set<AudioBufferSourceNode>();
  private lastPlayed = new Map<Cue, number>();
  private lastVariant = new Map<Cue, number>();
  private variantBags = new Map<Cue, number[]>();
  private epoch = 0;
  private forceMedia = false;
  private listeners=new Set<()=>void>();
  public subscribe=(listener:()=>void)=>{this.listeners.add(listener);return ()=>{this.listeners.delete(listener);};};
  private mediaSlots: Array<{audio:HTMLAudioElement;busy:boolean;primed:boolean;token:number}> = [];
  private mediaWarmed=false;

  private prefersMedia() {
    if(typeof window==='undefined'||!window.Audio)return false;
    const platform=(window as any).Telegram?.WebApp?.platform;
    return this.forceMedia||['android','ios'].includes(platform)||/Android|iPhone|iPad|iPod/i.test(window.navigator?.userAgent||'');
  }

  private slots() {
    if(!this.mediaSlots.length&&typeof window!=='undefined'&&window.Audio) {
      for(let i=0;i<5;i++) {
        const audio=new window.Audio();audio.preload='auto';
        this.mediaSlots.push({audio,busy:false,primed:false,token:0});
      }
    }
    return this.mediaSlots;
  }

  /** Unlock each reusable media element during a real gesture, using a silent local WAV. */
  private primeMedia() {
    if(!this.mediaWarmed){
      this.mediaWarmed=true;
      for(const clips of Object.values(manifest))for(const clip of clips)void fetch(`/assets/audio/${clip.file}`,{cache:'force-cache'}).then(r=>r.arrayBuffer()).catch(()=>{});
    }
    for(const slot of this.slots()) {
      if(slot.primed||slot.busy)continue;
      const token=++slot.token;slot.busy=true;
      slot.audio.src='/assets/audio/unlock.wav';
      try {
        void Promise.resolve(slot.audio.play()).then(()=>{
          if(slot.token===token){slot.primed=true;slot.audio.pause();slot.busy=false;}
        }).catch(()=>{if(slot.token===token)slot.busy=false;});
      }catch{slot.busy=false;}
    }
  }

  private playMedia(file:string,cue:Cue,rate:number,delay:number,epoch:number,maxWait=300):Promise<boolean> {
    const start=():Promise<boolean>=>{
      if(this.muted||epoch!==this.epoch||(typeof document!=='undefined'&&document.hidden))return Promise.resolve(false);
      const slots=this.slots();const slot=slots.find(s=>!s.busy)||slots.find(s=>!s.primed);
      if(!slot)return Promise.resolve(false);
      const token=++slot.token;slot.busy=true;
      const finish=()=>{if(slot.token===token)slot.busy=false;};
      try {
        slot.audio.pause();slot.audio.src=`/assets/audio/${file}`;
        slot.audio.volume=LEVELS[cue]*0.65;slot.audio.playbackRate=rate*(0.97+Math.random()*0.06);
        slot.audio.onended=finish;slot.audio.onerror=finish;
        // Do not await a fetch/decode before play(): this call must retain the gesture.
        const playing=slot.audio.play();
        return new Promise(resolve=>{
          const timeout=setTimeout(()=>{if(slot.token===token){slot.audio.pause();slot.primed=false;finish();slot.token++;}resolve(false);},maxWait);
          void Promise.resolve(playing).then(()=>{clearTimeout(timeout);if(slot.token!==token){resolve(false);return;}slot.primed=true;resolve(true);}).catch(()=>{clearTimeout(timeout);if(slot.token===token)slot.primed=false;finish();resolve(false);});
        });
      }catch{finish();return Promise.resolve(false);}
    };
    if(!delay)return start();
    return new Promise(resolve=>setTimeout(()=>{void start().then(resolve);},delay*1000));
  }

  constructor() {
    try { this.muted = localStorage.getItem('aethelgard_sound_muted') === 'true'; } catch { /* Storage is optional. */ }
    if (typeof document !== 'undefined') {
      const unlock = () => { if (!this.muted) {if(this.prefersMedia())this.primeMedia();else void this.prepare(true);} };
      // Mobile WebViews may reject pointerdown; touchend/click must still retry.
      // Keep listeners after unlocking so audio can recover after app switching.
      for (const event of ['pointerdown','pointerup','touchend','click','keydown']) {
        document.addEventListener(event, unlock, { capture: true, passive: true });
      }
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) this.stop();
        else if (!this.muted&&!this.prefersMedia()) void this.prepare();
      });
      if (typeof window !== 'undefined') window.addEventListener?.('pageshow', () => { if (!this.muted&&!this.prefersMedia()) void this.prepare(); });
    }
  }

  private async prepare(userGesture = false) {
    try {
      if (this.ctx?.state === 'closed') {
        this.stop(); this.ctx = null; this.master = null; this.buffers.clear();
      }
      let created = false;
      if (!this.ctx && typeof window !== 'undefined') {
        const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Ctx) return false;
        this.ctx = new Ctx();
        created = true;
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.45;
        this.master.connect(this.ctx.destination);
      }
      if (!this.ctx) return false;
      // WebKit also reports "interrupted" after backgrounding or a phone call.
      // Start/resume synchronously inside the gesture, before any fetch/await.
      const needsResume = this.ctx.state !== 'running';
      const resumed = needsResume ? this.ctx.resume() : null;
      if (userGesture && (created || needsResume)) {
        try {
          const wake = this.ctx.createBufferSource();
          wake.buffer = this.ctx.createBuffer(1, 1, this.ctx.sampleRate);
          wake.connect(this.ctx.destination);
          wake.onended = () => wake.disconnect();
          wake.start(0);
        } catch { /* Resume may still succeed without the silent unlock buffer. */ }
      }
      if (resumed) await resumed;
      if (this.ctx.state !== 'running') return false;
      // Small audio bank; decode once after the first user gesture.
      for (const clips of Object.values(manifest)) for (const clip of clips) void this.load(clip.file);
      return true;
    } catch { return false; }
  }

  private load(file: string): Promise<AudioBuffer | null> {
    const cached = this.buffers.get(file);
    if (cached) return cached;
    const pending = (async () => {
      try {
        const response = await fetch(`/assets/audio/${file}`);
        if (!response.ok || !this.ctx) throw new Error('Audio unavailable');
        return await this.ctx.decodeAudioData(await response.arrayBuffer());
      } catch {
        this.buffers.delete(file); // A later gesture can retry a transient failure.
        return null;
      }
    })();
    this.buffers.set(file, pending);
    return pending;
  }

  private stop() {
    this.epoch++;
    for (const voice of this.voices) { try { voice.stop(); } catch { /* Already ended. */ } }
    this.voices.clear();
    for(const slot of this.mediaSlots){slot.token++;slot.audio.pause();slot.busy=false;}
  }

  public toggleMute() {
    this.muted = !this.muted;
    if (this.muted) this.stop();
    try { localStorage.setItem('aethelgard_sound_muted', String(this.muted)); } catch { /* Storage is optional. */ }
    if (!this.muted) {if(this.prefersMedia())this.primeMedia();else void this.prepare(true);}
    this.listeners.forEach(listener=>listener());
    return this.muted;
  }
  public getIsMuted() { return this.muted; }
  public testSound():Promise<boolean> {
    this.stop();this.muted=false;this.forceMedia=true;
    try{localStorage.setItem('aethelgard_sound_muted','false');}catch{/* Storage is optional. */}
    this.listeners.forEach(listener=>listener());
    return this.playMedia(manifest.bell[0].file,'bell',1,0,this.epoch,3000);
  }

  private play(cue: Cue, rate = 1, delay = 0) {
    if (this.muted || (typeof document !== 'undefined' && document.hidden)) return;
    const timestamp = Date.now();
    if (timestamp - (this.lastPlayed.get(cue) ?? -Infinity) < (cue === 'slash' ? 180 : 90)) return;
    this.lastPlayed.set(cue, timestamp);
    const epoch = this.epoch;
      const clips = manifest[cue];
      const previous = this.lastVariant.get(cue);
      // Shuffle bags exhaust every recording before recycling, with no boundary repeat.
      let bag = this.variantBags.get(cue);
      if (!bag?.length) {
        bag = clips.map((_, i) => i);
        for (let i = bag.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [bag[i], bag[j]] = [bag[j], bag[i]];
        }
        if (bag.length > 1 && bag[bag.length - 1] === previous) [bag[0], bag[bag.length - 1]] = [bag[bag.length - 1], bag[0]];
        this.variantBags.set(cue, bag);
      }
      const index = bag.pop()!;
      this.lastVariant.set(cue, index);
      if(this.prefersMedia()){void this.playMedia(clips[index].file,cue,rate,delay,epoch);return;}
    void (async () => {
      if (!await this.prepare() || !this.ctx || !this.master) {
        if(typeof window!=='undefined'&&window.Audio)void this.playMedia(clips[index].file,cue,rate,delay,epoch);
        return;
      }
      const buffer = await this.load(clips[index].file);
      if(!buffer){void this.playMedia(clips[index].file,cue,rate,delay,epoch);return;}
      if (!buffer || this.muted || epoch !== this.epoch || Date.now() - timestamp > 300 || this.ctx.state !== 'running' || (typeof document !== 'undefined' && document.hidden)) return;
      if (this.voices.size >= 5) return;
      const source = this.ctx.createBufferSource();
      const gain = this.ctx.createGain();
      source.buffer = buffer;
      source.playbackRate.value = rate * (0.97 + Math.random() * 0.06);
      gain.gain.value = LEVELS[cue];
      source.connect(gain);
      gain.connect(this.master);
      this.voices.add(source);
      source.onended = () => { this.voices.delete(source); source.disconnect(); gain.disconnect(); };
      source.start(this.ctx.currentTime + delay);
    })().catch(() => { /* Audio failure must never interrupt a game action. */ });
  }

  public playFishingCast() { this.play('fishCast'); }
  public playFishingBite() { this.play('fishBite'); }
  public playFishingReel() { this.play('fishReel'); }
  public playFishingCatch() { this.play('fishCatch'); }
  public playClick() { this.play('page'); }
  public playSlash() { this.play('slash'); }
  public playCriticalHit() { this.play('heavy'); this.play('shield', 0.85, 0.025); }
  public playDefend() { this.play('shield'); }
  public playPotion() { this.play('potion'); }
  public playMagic() { this.play('magic', 0.75); }
  public playVictory() { this.play('bell', 1.15); this.play('coins', 1, 0.15); }
  public playLevelUp() { this.play('bell', 1.4); this.play('magic', 1.1, 0.12); }
  public playUpgradeSuccess() { this.play('shield', 1.1); this.play('bell', 1.3, 0.08); }
  public playUpgradeFail() { this.play('fail'); }
  public playTravelStep() { this.play('step'); }
  public playAmbush() { this.play('heavy', 0.75); this.play('whoosh', 0.8); }
  public playCoin() { this.play('coins'); }
  public playCoinDrop() { this.playCoin(); }
  public playEnergyRefill() { this.play('magic', 1.15); }
  public playMining() { this.play('mine'); }
  public playMonsterAttack(damageType: string = 'physical') {
    if (damageType === 'physical') this.play('monster', 0.8);
    else this.play('magic', 0.55);
  }
  public playDodge() { this.play('whoosh'); }
  public playDefeat() { this.play('fail', 0.75); this.play('bell', 0.65, 0.1); }
}

export const sound = new SoundManager();
