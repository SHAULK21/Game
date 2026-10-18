import {createActorDigest} from './actorDigest';
import type {GameContextType} from '../src/context/GameContext';
import type {GameEngineRuntime} from '../src/game/engineRuntime';
import type {TelegramUser} from '../src/utils/telegram';
import type {Locale} from '../src/i18n/translate';

type EngineModule = typeof import('../src/game/actorEntry');
let enginePromise: Promise<EngineModule> | undefined;
export const loadGameEngine = () => enginePromise ??= import(new URL('../server-dist/game-engine.mjs', import.meta.url).href);
const CALLBACK = Symbol('actor.callback');
const DERIVED_REFS = new Set(['presenceRef', 'dungeonPresenceRef', 'fishingPlayerRef', 'saveSnapshot', 'journeySnapshot']);
interface Timer {deadline: number; dependencies: string}
export interface ActorSnapshot {
  version: 1;
  state: Record<string, unknown>;
  refs: Record<string, unknown>;
  effects: Record<string, string>;
  timers: Record<string, Timer>;
}
export interface ActorOptions {
  user: TelegramUser;
  resetVersion: number;
  locale: Locale;
  admin: boolean;
  premium: {active: boolean; premiumUntil: string | null; priceStars: number; periodDays: number};
  snapshot?: ActorSnapshot;
  migrationSave?: string;
  now?: () => number;
  automationAllowed?: boolean;
}
interface Effect {key: string; dependencies: string; callback: () => void | (() => void)}
function encode(value: unknown): unknown {
  if (value === undefined) return {$actor: 'undefined'};
  if (value instanceof Set) return {$actor: 'set', values: [...value].map(encode)};
  if (value instanceof Map) return {$actor: 'map', values: [...value].map(([key, item]) => [encode(key), encode(item)])};
  if (Array.isArray(value)) return value.map(encode);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, encode(item)]));
  if (typeof value === 'function' || typeof value === 'symbol' || typeof value === 'bigint' || typeof value === 'number' && !Number.isFinite(value)) throw new Error('Non-durable actor state.');
  return value;
}
function decode(value: any): any {
  if (!value || typeof value !== 'object') return value;
  if (value.$actor === 'undefined') return undefined;
  if (value.$actor === 'set') return new Set(value.values.map(decode));
  if (value.$actor === 'map') return new Map(value.values.map(([key, item]: any[]) => [decode(key), decode(item)]));
  if (Array.isArray(value)) return value.map(decode);
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, decode(item)]));
}

/** An account-scoped actor executes the real shared rules without React rendering,
 * local test adapters, a DOM, global storage, or a client-provided reward result. */
export class GameActor {
  private fingerprints=createActorDigest(CALLBACK);
  private state: Record<string, any>;
  private refs: Record<string, {current: any}>;
  private dependencies: Record<string, string>;
  private timers: Record<string, Timer>;
  private timerCallbacks = new Map<string, () => void>();
  private effects: Effect[] = [];
  private effectKey = '';
  private effectDependencies = '';
  private timerIndex = 0;
  private timersSeen = new Set<string>();
  private dirty = false;
  private view!: GameContextType;
  private module!: EngineModule;
  readonly cues: Array<{name: string; args: unknown[]}> = [];
  private now: () => number;
  private storage = new Map<string, string>();
  private runtime: GameEngineRuntime;

  constructor(private options: ActorOptions) {
    if (options.snapshot && options.snapshot.version !== 1) throw new Error('Unsupported game actor version.');
    this.state = decode(options.snapshot?.state || {});
    this.refs = Object.fromEntries(Object.entries(decode(options.snapshot?.refs || {})).map(([key, current]) => [key, {current}]));
    this.dependencies = {...options.snapshot?.effects};
    this.timers = structuredClone(options.snapshot?.timers || {});
    const initializedAt=Date.now();
    this.now = options.now || (()=>initializedAt);
    // Subscription status always comes from the database, never private cache.
    this.state.premium = {...options.premium, loading: false, invoiceLink: null};
    const actor = this;
    const ActorDate = new Proxy(Date, {construct(target, args, newTarget) {return Reflect.construct(target, args.length ? args : [actor.now()], newTarget);}, get(target, key) {return key === 'now' ? actor.now : Reflect.get(target, key);}});
    const hooks = {
      useState(initial: any, key: string) {
        if (!key) throw new Error('Game engine must be compiled with stable actor hook identifiers.');
        if (!Object.hasOwn(actor.state, key)) actor.state[key] = structuredClone(typeof initial === 'function' ? initial() : initial);
        const setter = (action: any) => {
          actor.fingerprints.endRead();
          const previous = actor.state[key], fingerprint = actor.fingerprints.digest(previous), next = typeof action === 'function' ? action(previous) : action;
          if (fingerprint !== actor.fingerprints.digest(next)) {actor.state[key] = next; actor.dirty = true;}
        };
        Object.defineProperty(setter, CALLBACK, {value: 'setter:' + key});
        return [actor.state[key], setter];
      },
      useRef(initial: any, key: string) {
        if (!key) throw new Error('Missing actor ref identifier.');
        return actor.refs[key] ??= {current: initial};
      },
      useCallback(callback: Function, dependencies: unknown[], key: string) {
        Object.defineProperty(callback, CALLBACK, {value: actor.fingerprints.digest([key, dependencies]), configurable: true});
        return callback;
      },
      useMemo(callback: () => unknown) {return callback();},
      useEffect(callback: Effect['callback'], dependencies: unknown[] | undefined, key: string) {
        if (!key?.startsWith('actor:')) return;
        if (key === 'actor:loadLegacy' && !options.migrationSave) return;
        actor.effects.push({key, callback, dependencies: dependencies === undefined ? '' : actor.fingerprints.digest(dependencies)});
      },
    };
    this.runtime = {
      hooks: hooks as unknown as GameEngineRuntime['hooks'],
      localStorage: {getItem: key => this.storage.get(key) ?? null, setItem: (key, value) => {this.storage.set(key, value);}, removeItem: key => {this.storage.delete(key);}},
      getTelegramUser: () => options.user,
      getLanguage: () => options.locale,
      readResetVersion: () => options.resetVersion,
      readAccountSave: () => options.migrationSave ?? null,
      removeAccountSave: () => {},
      isCurrentUserAdmin: () => options.admin,
      sound: new Proxy({}, {get: (_target, name) => (...args: unknown[]) => {this.cues.push({name: String(name), args});}}) as GameEngineRuntime['sound'],
      triggerHaptic: type => {this.cues.push({name: 'haptic', args: [type]});},
      apiRequest: async () => {throw new Error('This action requires an explicit server domain service.');},
      useBalanceTelemetry: () => () => {},
      Date: ActorDate,
      setTimeout: ((callback: () => void, delay = 0) => this.schedule(callback, delay)) as unknown as typeof setTimeout,
      clearTimeout: (() => {}) as typeof clearTimeout,
      setInterval: (() => 0) as unknown as typeof setInterval,
      clearInterval: (() => {}) as typeof clearInterval,
    };
  }
  private schedule(callback: () => void, delay: number) {
    if (!this.effectKey) throw new Error('Game timers must belong to a named lifecycle effect.');
    const key = this.effectKey + ':' + this.timerIndex++;
    const current = this.timers[key];
    if (!current || current.dependencies !== this.effectDependencies) this.timers[key] = {deadline: this.now() + Math.max(0, delay), dependencies: this.effectDependencies};
    this.timerCallbacks.set(key, callback); this.timersSeen.add(key);
    return key;
  }
  private render() {
    for (let pass = 0; pass < 40; pass++) {
      this.dirty = false; this.effects = []; this.timerCallbacks.clear();
      this.fingerprints.beginRead();
      try{this.view = this.module.useGameEngine(this.runtime);}
      finally{this.fingerprints.endRead();}
      for (const effect of this.effects) {
        const clock = effect.key.endsWith(':timer') || effect.key.endsWith(':clock');
        if (!clock && effect.dependencies !== '' && this.dependencies[effect.key] === effect.dependencies) continue;
        this.dependencies[effect.key] = effect.dependencies;
        this.effectKey = effect.key; this.effectDependencies = effect.dependencies; this.timerIndex = 0; this.timersSeen.clear();
        effect.callback();
        for (const key of Object.keys(this.timers)) if (key.startsWith(effect.key + ':') && !this.timersSeen.has(key)) delete this.timers[key];
        this.effectKey = '';
      }
      if (!this.dirty) return;
    }
    throw new Error('Game lifecycle did not settle.');
  }
  async initialize() {this.module = await loadGameEngine(); this.render(); return this;}
  /** One due deadline per request prevents an offline request replaying hours of
   * automatic combat. Remaining deadlines are resolved on subsequent requests. */
  tick() {
    this.render();
    const due = Object.entries(this.timers).filter(([key, timer]) => timer.deadline <= this.now() && this.timerCallbacks.has(key) && (this.options.automationAllowed !== false || !/^actor:(?:playerAuto|chainAuto):timer:/.test(key))).sort((a, b) => a[1].deadline - b[1].deadline)[0];
    if (due) {const callback = this.timerCallbacks.get(due[0])!; delete this.timers[due[0]]; callback(); this.render();}
    return this.view;
  }
  /** Called only by the finite command dispatcher, never by a method name supplied
   * directly from HTTP. Object arguments must be resolved from the real catalogue
   * or the locked owned_items inventory before reaching this method. */
  async invoke<K extends keyof GameContextType>(key: K, ...args: GameContextType[K] extends (...args: infer A) => unknown ? A : never) {
    const action = this.view[key];
    if (typeof action !== 'function') throw new Error('Unknown game action.');
    const result = await (action as (...args: any[]) => any)(...args);
    this.render(); return result;
  }
  get current() {return this.view;}
  get catalog() {return this.module;}
  get admin() {return this.options.admin;}
  get nextTickAt() {return Math.min(...Object.entries(this.timers).filter(([key])=>this.timerCallbacks.has(key)&&(this.options.automationAllowed!==false||!/^actor:(?:playerAuto|chainAuto):timer:/.test(key))).map(([,timer])=>timer.deadline),Infinity);}
  replacePlayer(player: NonNullable<GameContextType['player']>) {this.state.player = player; this.render();}
  remapItemIds(mapping: Map<string, string>) {
    const seen = new WeakSet<object>();
    function visit(value: any) {
      if (!value || typeof value !== 'object' || seen.has(value)) return;
      seen.add(value);
      if (value instanceof Set || value instanceof Map) return;
      for (const key of Object.keys(value)) {
        if (typeof value[key] === 'string' && mapping.has(value[key])) value[key] = mapping.get(value[key]);
        else visit(value[key]);
      }
    }
    visit(this.state); visit(this.refs);
  }
  snapshot({externalizeCanonical = false} = {}): ActorSnapshot {
    const state = encode(this.state) as Record<string, unknown>;
    if (externalizeCanonical) for (const key of ['player', 'quests', 'achievements', 'activeDungeonRun']) delete state[key];
    return {version: 1, state, refs: Object.fromEntries(Object.entries(this.refs).filter(([key]) => !DERIVED_REFS.has(key)).map(([key, ref]) => [key, encode(ref.current)])), effects: {...this.dependencies}, timers: structuredClone(this.timers)};
  }
  /** Project data only. Private pending rewards, decisions, seeds and refs are
   * intentionally absent from the public game view. */
  publicView() {return Object.fromEntries(Object.entries(this.view).filter(([_key, value]) => typeof value !== 'function'));}
}
