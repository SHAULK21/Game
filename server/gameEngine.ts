import { createHash } from "node:crypto";
import type { GameModelRuntime } from "../src/game/modelRuntime";
import { useGameModel, type GameContextType } from "../src/game/GameModel";
import { refreshGameTimers } from "../src/utils/gameCadence";
import { REGIONS, MONSTERS, getRegionMonster } from "../src/data/gameData";
import { completeTravelQuests } from "../src/utils/travelQuests";
import { gameSaveKey, resetVersionKey } from "../src/utils/accountReset";

export const ENGINE_VERSION = 1;
export type EngineSave = {
  engineVersion: number;
  state: Record<string, any>;
  refs: Record<string, any>;
  effects: Record<string, string>;
  storage: Record<string, string>;
};
const disabledEffects = new Set([
  "premiumRefresh",
  "clanRetry",
  "listingRetry",
  "residentRetry",
  "purchaseRetry",
  "resourceTimers",
  "notifications",
  "profileSync",
  "localSave",
  "presence",
  "ledgerInitial",
  "ledgerEvents",
  "bulkRetry",
]);
const signature = (values: any) =>
  createHash("sha256")
    .update(
      JSON.stringify(values, (_key, value) =>
        typeof value === "function" ? "function" : value,
      ) ?? "no-deps",
    )
    .digest("hex");
const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value));
/** No browser, no React rendering, no background mutations: every transition is committed by the caller. */
export class GameEngine {
  model!: GameContextType;
  readonly events: Array<{ type: string; name?: string; args: any[] }> = [];
  private dirty = true;
  private effects: Array<() => void> = [];
  private refs = new Map<string, { current: any }>();
  private memoSlots: any[] = [];
  private memoIndex = 0;
  private timers = new Map<
    number,
    { at: number; action: () => void; interval: number }
  >();
  private timerId = 0;
  private asyncTasks: Promise<any>[] = [];
  private now: number;
  private pendingOperations = 0;
  private cleanups = new Map<string, () => void>();
  readonly data: EngineSave;
  readonly runtime: GameModelRuntime;
  constructor(
    readonly userId: number,
    readonly resetVersion: number,
    save: EngineSave | null,
    readonly api: <T>(path: string, options?: RequestInit) => Promise<T>,
    readonly admin = false,
    now = Date.now(),
  ) {
    this.now = now;
    if (save && save.engineVersion !== ENGINE_VERSION)
      throw new Error("Unsupported game engine save version");
    this.data = save
      ? copy(save)
      : {
          engineVersion: ENGINE_VERSION,
          state: {},
          refs: {},
          effects: {},
          storage: {},
        };
    this.data.storage[resetVersionKey(userId)] = String(resetVersion);
    for (const [key, current] of Object.entries(this.data.refs))
      this.refs.set(key, { current });
    if (this.data.state.player)
      this.data.state.player = refreshGameTimers(this.data.state.player, now);
    const storage = {
      getItem: (key: string) => this.data.storage[key] ?? null,
      setItem: (key: string, value: string) => {
        this.data.storage[key] = String(value);
      },
      removeItem: (key: string) => {
        delete this.data.storage[key];
      },
      clear: () => {
        this.data.storage = {};
      },
      key: (i: number) => Object.keys(this.data.storage)[i] ?? null,
      get length() {
        return 0;
      },
    } as Storage;
    const ServerDate = class extends Date {
      constructor(...args: any[]) {
        super(args.length ? args[0] : now);
      }
      static now = () => now;
    } as DateConstructor;
    const schedule = (action: () => void, delay = 0, interval = 0) => {
      const id = ++this.timerId;
      this.timers.set(id, {
        at: this.now + Math.max(0, delay),
        action,
        interval,
      });
      return id;
    };
    this.runtime = {
      server: true,
      state: <T>(key: string, initial: T | (() => T)) => {
        if (!Object.hasOwn(this.data.state, key))
          this.data.state[key] =
            typeof initial === "function" ? (initial as () => T)() : initial;
        return [
          this.data.state[key],
          (action: any) => {
            const previous = this.data.state[key],
              next = typeof action === "function" ? action(previous) : action;
            if (next !== previous) {
              this.data.state[key] = next;
              this.dirty = true;
            }
          },
        ];
      },
      ref: <T>(key: string, initial: T) => {
        if (!this.refs.has(key)) this.refs.set(key, { current: initial });
        return this.refs.get(key)!;
      },
      effect: (key, action, deps) => {
        if (disabledEffects.has(key)) return;
        const sig = signature(deps),
          scheduler = /setTimeout|setInterval/.test(String(action));
        if (
          deps &&
          this.data.effects[key] === sig &&
          (!scheduler || this.cleanups.has(key))
        )
          return;
        this.data.effects[key] = sig;
        this.effects.push(() => {
          this.cleanups.get(key)?.();
          const cleanup = action();
          if (cleanup) this.cleanups.set(key, cleanup);
        });
      },
      callback: ((action: any, deps: any) =>
        this.memo(() => action, deps)) as any,
      memo: ((action: any, deps: any) => this.memo(action, deps)) as any,
      getUser: () => ({ id: userId, first_name: "Игрок" }),
      readResetVersion: () => resetVersion,
      storage,
      apiRequest: ((path: string, options?: RequestInit) => {
        const task = api(path, options);
        this.asyncTasks.push(task);
        return task;
      }) as any,
      sound: new Proxy(
        {},
        {
          get:
            (_target, name) =>
            (...args: any[]) => {
              this.events.push({ type: "sound", name: String(name), args });
            },
        },
      ) as any,
      haptic: (...args: any[]) => {
        this.events.push({ type: "haptic", args });
      },
      window: {
        addEventListener() {},
        removeEventListener() {},
        dispatchEvent() {
          return true;
        },
        location: {
          assign() {
            throw new Error("Invoice must be opened on the device");
          },
        },
      } as any,
      document: {
        addEventListener() {},
        removeEventListener() {},
        hidden: false,
      } as any,
      Date: ServerDate,
      setTimeout: ((fn: any, delay: any) => schedule(fn, delay)) as any,
      clearTimeout: ((id: any) => this.timers.delete(id)) as any,
      setInterval: ((fn: any, delay: any) => schedule(fn, delay, delay)) as any,
      clearInterval: ((id: any) => this.timers.delete(id)) as any,
      telemetry: () => () => {},
      isAdmin: () => admin,
      flush: (action) => action(),
      track:
        (action) =>
        (...args) => {
          const task = Promise.resolve(action(...args));
          this.asyncTasks.push(task);
          return task;
        },
      beginOperation: () => {
        this.pendingOperations++;
        return () => this.pendingOperations--;
      },
      hasOperation: () => this.pendingOperations > 0,
    };
    this.settle();
    // Travel consumes energy at departure. Its deadline and chosen encounter survive process/device changes.
    const journey = this.data.state.serverJourney;
    if (this.model.travelState.isTraveling && journey) {
      schedule(
        () => this.finishJourney(journey),
        Math.max(0, journey.endsAt - now),
      );
    } else if (this.model.travelState.isTraveling) {
      this.data.state.travelState = {
        ...this.model.travelState,
        isTraveling: false,
        message: "Путешествие прервано. Потраченная энергия не возвращается.",
      };
      this.dirty = true;
      this.settle();
    }
  }
  private memo(action: () => any, deps: any) {
    const index = this.memoIndex++;
    const previous = this.memoSlots[index];
    if (
      previous &&
      deps?.every((v: any, i: number) => Object.is(v, previous.deps[i]))
    )
      return previous.value;
    const value = action();
    this.memoSlots[index] = { deps, value };
    return value;
  }
  private settle() {
    for (let i = 0; i < 60; i++) {
      if (!this.dirty && !this.effects.length) return;
      this.dirty = false;
      this.memoIndex = 0;
      this.model = useGameModel(this.runtime);
      const effects = this.effects.splice(0);
      for (const action of effects) action();
    }
    throw new Error("Game model did not settle");
  }
  async drain() {
    for (let i = 0; i < 30; i++) {
      this.settle();
      const tasks = this.asyncTasks.splice(0);
      if (!tasks.length) return;
      const results = await Promise.allSettled(tasks);
      const failed = results.find((r) => r.status === "rejected");
      if (failed?.status === "rejected") throw failed.reason;
    }
    throw new Error("Unfinished game operation");
  }
  private finishJourney(journey: any) {
    if (!this.data.state.travelState.isTraveling) return;
    const region = REGIONS.find((r) => r.id === journey.regionId)!;
    this.data.state.player = {
      ...this.model.player,
      currentRegionId: region.id,
      activeRegionModId: journey.modId,
      unlockedRegionIds: [
        ...new Set([
          ...(this.model.player?.unlockedRegionIds || []),
          region.id,
        ]),
      ],
    };
    this.data.state.quests = completeTravelQuests(this.model.quests, region.id);
    this.data.state.travelState = {
      ...this.model.travelState,
      isTraveling: false,
      progress: 100,
      isAmbush: journey.ambush,
      message: journey.ambush ? "Засада!" : "Путешествие завершено.",
    };
    delete this.data.state.serverJourney;
    this.dirty = true;
    this.settle();
    if (journey.monsterId) {
      const monster = getRegionMonster(MONSTERS[journey.monsterId], region);
      this.model.startBattleWithMonster(
        {
          ...monster,
          name: `[Засада!] ${monster.name}`,
          expReward: Math.round(monster.expReward * 1.5),
          goldReward: Math.round(monster.goldReward * 1.5),
        },
        { chain: false, energyCost: 0, huntingModeId: journey.modId },
      );
      this.settle();
    }
  }
  async tick() {
    let count = 0;
    while (true) {
      const next = [...this.timers.entries()]
        .filter(([, t]) => t.at <= this.now)
        .sort((a, b) => a[1].at - b[1].at)[0];
      if (!next) break;
      if (++count > 30) throw new Error("Too many scheduled game actions");
      const [id, timer] = next;
      if (timer.interval) timer.at += timer.interval;
      else this.timers.delete(id);
      timer.action();
      await this.drain();
    }
    return this.model;
  }
  async command(name: string, args: any[]) {
    const p = this.model.player;
    if (
      p &&
      this.model.premium.active &&
      !this.model.isInCombat &&
      !this.model.travelState.isTraveling
    ) {
      const minutes = Math.floor(
        (this.now - (p.lastActiveTimestamp || this.now)) / 60000,
      );
      if (minutes >= 30) {
        this.data.state.pendingOfflineMinutes = Math.min(minutes, 480);
        this.data.state.player = { ...p, lastActiveTimestamp: this.now };
        this.dirty = true;
        await this.drain();
      }
    }
    if (name === "_tick") {
      await this.tick();
      return;
    }
    const action = (this.model as any)[name];
    if (typeof action !== "function") throw new Error("Unknown game command");
    const result = await action(...args);
    await this.drain();
    if (name === "startTravel" || name === "setActiveRegionMod") {
      if (this.model.travelState.isTraveling) {
        const region = REGIONS.find(
          (r) => r.id === this.model.travelState.targetRegionId,
        )!;
        const modId = this.data.state.player.activeRegionModId;
        const requested = name === "startTravel" ? args[1] : args[0];
        const { REGION_MODIFIERS } = await import("../src/data/gameData");
        const mod = REGION_MODIFIERS[requested || modId];
        const ambush = Math.random() < (mod?.ambushChance || 0);
        const pool = region.monsters.filter(
          (id) => !MONSTERS[id].isBoss && !MONSTERS[id].isElite,
        );
        this.data.state.serverJourney = {
          regionId: region.id,
          modId: requested || modId,
          endsAt: this.now + 2800,
          ambush,
          monsterId: ambush
            ? pool[Math.floor(Math.random() * pool.length)]
            : null,
        };
        this.timers.clear();
      }
    }
    return result;
  }
  export() {
    this.data.state.battleLog = (this.data.state.battleLog || []).slice(-160);
    this.data.state.chatMessages = (this.data.state.chatMessages || []).slice(
      -50,
    );
    this.data.refs = Object.fromEntries(
      [...this.refs.entries()]
        .filter(
          ([key]) =>
            ![
              "saveSnapshot",
              "serverInventoryVersion",
              "bulkInventoryBusy",
              "marketBusy",
              "clanCreationBusy",
            ].includes(key),
        )
        .map(([key, value]) => [key, value.current]),
    );
    return copy(this.data);
  }
  view() {
    const value: any = {};
    for (const [key, v] of Object.entries(this.model))
      if (typeof v !== "function") value[key] = v;
    return copy(value);
  }
  migrateLegacy(snapshot: any) {
    this.runtime.legacySnapshot = {
      ...snapshot,
      player: { ...snapshot.player, lastActiveTimestamp: this.now },
    };
    delete this.data.effects.loadLegacy;
    this.dirty = true;
    this.settle();
    this.runtime.legacySnapshot = undefined;
  }
  loadLegacy(snapshot: any) {
    this.data.state.player = copy(snapshot.player);
    this.data.state.quests = copy(snapshot.quests || this.model.quests);
    this.data.state.achievements = copy(
      snapshot.achievements || this.model.achievements,
    );
    this.data.state.activeDungeonRun = copy(snapshot.activeDungeonRun || null);
    this.dirty = true;
    this.settle();
  }
}
