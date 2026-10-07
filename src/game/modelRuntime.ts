import type React from "react";
import type { apiRequest } from "../utils/api";
import type { sound } from "../utils/audio";
import type { TelegramUser } from "../utils/telegram";
import type { useBalanceTelemetry } from "../hooks/useBalanceTelemetry";
/** Named state slots let the same game rules run in React and in a server transaction. */
export interface GameModelRuntime {
  server: true;
  legacySnapshot?: any;
  state: <T>(
    key: string,
    initial: T | (() => T),
  ) => [T, React.Dispatch<React.SetStateAction<T>>];
  ref: <T>(key: string, initial: T) => { current: T };
  effect: (
    key: string,
    action: React.EffectCallback,
    deps?: React.DependencyList,
  ) => void;
  callback: typeof React.useCallback;
  memo: typeof React.useMemo;
  getUser: () => TelegramUser;
  readResetVersion: (id: string | number) => number;
  storage: Storage;
  apiRequest: typeof apiRequest;
  sound: typeof sound;
  haptic: (...args: any[]) => void;
  window: Window;
  document: Document;
  Date: DateConstructor;
  setTimeout: typeof globalThis.setTimeout;
  clearTimeout: typeof globalThis.clearTimeout;
  setInterval: typeof globalThis.setInterval;
  clearInterval: typeof globalThis.clearInterval;
  telemetry: typeof useBalanceTelemetry;
  isAdmin: () => boolean;
  flush: (action: () => void) => void;
  track: <Args extends unknown[], Result>(
    action: (...args: Args) => Promise<Result>,
  ) => (...args: Args) => Promise<Result>;
  beginOperation: () => () => void;
  hasOperation: () => boolean;
}
