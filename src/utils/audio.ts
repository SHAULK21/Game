import manifest from '../../public/assets/audio/manifest.json';

type Cue = keyof typeof manifest;
const LEVELS: Record<Cue, number> = {
  page: 0.3, slash: 0.65, shield: 0.6, heavy: 0.65, potion: 0.4, magic: 0.45,
  coins: 0.4, step: 0.35, mine: 0.55, whoosh: 0.35, bell: 0.3, fail: 0.4
};

/** Recorded foley, shared by both interfaces. No queued sounds after a slow load. */
export class SoundManager {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private muted = false;
  private buffers = new Map<string, Promise<AudioBuffer | null>>();
  private voices = new Set<AudioBufferSourceNode>();
  private lastPlayed = new Map<Cue, number>();
  private lastVariant = new Map<Cue, number>();
  private epoch = 0;

  constructor() {
    try { this.muted = localStorage.getItem('aethelgard_sound_muted') === 'true'; } catch { /* Storage is optional. */ }
    if (typeof document !== 'undefined') {
      const unlock = () => { if (!this.muted) void this.prepare(); };
      document.addEventListener('pointerdown', unlock, { once: true });
      document.addEventListener('keydown', unlock, { once: true });
      document.addEventListener('visibilitychange', () => { if (document.hidden) this.stop(); });
    }
  }

  private async prepare() {
    try {
      if (!this.ctx && typeof window !== 'undefined') {
        const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Ctx) return false;
        this.ctx = new Ctx();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.45;
        this.master.connect(this.ctx.destination);
      }
      if (!this.ctx) return false;
      if (this.ctx.state === 'suspended') await this.ctx.resume();
      if (this.ctx.state !== 'running') return false;
      // Small bank (about 120 KB); decode once after the first user gesture.
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
  }

  public toggleMute() {
    this.muted = !this.muted;
    if (this.muted) this.stop();
    try { localStorage.setItem('aethelgard_sound_muted', String(this.muted)); } catch { /* Storage is optional. */ }
    if (!this.muted) void this.prepare();
    return this.muted;
  }
  public getIsMuted() { return this.muted; }

  private play(cue: Cue, rate = 1, delay = 0) {
    if (this.muted || (typeof document !== 'undefined' && document.hidden)) return;
    const timestamp = Date.now();
    if (timestamp - (this.lastPlayed.get(cue) ?? -Infinity) < 90) return;
    this.lastPlayed.set(cue, timestamp);
    const epoch = this.epoch;
    void (async () => {
      if (!await this.prepare() || !this.ctx || !this.master) return;
      const clips = manifest[cue];
      const previous = this.lastVariant.get(cue);
      let index = Math.floor(Math.random() * clips.length);
      if (clips.length > 1 && index === previous) index = (index + 1) % clips.length;
      this.lastVariant.set(cue, index);
      const buffer = await this.load(clips[index].file);
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
  public playMonsterAttack() { this.play('heavy', 0.9); }
  public playDodge() { this.play('whoosh'); }
  public playDefeat() { this.play('fail', 0.75); this.play('bell', 0.65, 0.1); }
}

export const sound = new SoundManager();
