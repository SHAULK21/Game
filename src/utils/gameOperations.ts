import {useSyncExternalStore} from 'react';
let pending = 0;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach(listener => listener());
export const hasGameOperation = () => pending > 0;
export function beginGameOperation() {
  pending += 1; notify(); let finished = false;
  return () => { if (finished) return; finished = true; pending -= 1; notify(); };
}
export async function runGameOperation<T>(action: () => Promise<T>): Promise<T> {
  const finish = beginGameOperation();
  try { return await action(); } finally { finish(); }
}
export const isGameMutation = (path: string, method = 'GET') => !['GET','HEAD'].includes(method.toUpperCase()) && /^\/api\/(items(?:\/|$)|market(?:\/|$)|clan(?:\/|$)|premium(?:\/|$)|admin\/(?:premium|players))/.test(path);
export const useGameOperation = () => useSyncExternalStore(listener => { listeners.add(listener); return () => { listeners.delete(listener); }; }, hasGameOperation, () => false);

export const trackOperation = <Args extends unknown[], Result>(action: (...args: Args) => Promise<Result>) => (...args: Args) => runGameOperation(() => action(...args));
