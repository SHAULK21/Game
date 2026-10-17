interface PollClient {
  current: {nextTickAt?: number | null; serverTime: number; writerPresent?: boolean; activeHere?: boolean} | null;
  receivedAt: number;
  roundTripMs: number;
  requestInFlight: boolean;
  pending: unknown;
  status: string;
  subscribe(callback: () => void): () => void;
  load(): Promise<unknown>;
  acquire(): Promise<unknown>;
  resolveConflict(): Promise<unknown>;
}
interface Clock {
  now(): number;
  visible(): boolean;
  setTimeout(callback: () => void, delay: number): unknown;
  clearTimeout(timer: unknown): void;
}
export function progressPollDelay(client: Pick<PollClient, 'current' | 'receivedAt' | 'roundTripMs' | 'status'>, now: number) {
  if (client.status === 'offline' || client.status === 'conflict') return Math.max(1000, Math.min(5000, client.roundTripMs * 2));
  const state = client.current;
  if (!state?.activeHere || state.nextTickAt == null) return 15000;
  // serverTime is captured before processing the request. Time spent waiting for
  // that reply must not be added again to every 600ms combat deadline.
  const elapsed = Math.max(0, now - client.receivedAt) + Math.min(1000, client.roundTripMs);
  return Math.max(50, Math.min(15000, state.nextTickAt - state.serverTime - elapsed + 25));
}
export function startProgressPolling(client: PollClient, clock: Clock) {
  let stopped = false, refreshing = false, booting = true, timer: unknown;
  const cancel = () => {if (timer !== undefined) clock.clearTimeout(timer); timer = undefined;};
  const schedule = (immediate = false) => {
    cancel();
    if (stopped || booting || refreshing || !clock.visible() || client.requestInFlight) return;
    timer = clock.setTimeout(() => {timer = undefined; void refresh();}, immediate ? 0 : progressPollDelay(client, clock.now()));
  };
  const refresh = async () => {
    if (stopped || refreshing || !clock.visible() || client.requestInFlight) return;
    refreshing = true;
    try {if (client.pending) await client.resolveConflict(); else await client.load();}
    catch {/* Client retains the pending operation and displays connection errors. */}
    finally {refreshing = false; schedule();}
  };
  // Commands can create/change a combat deadline while an idle 15s poll is armed.
  const unsubscribe = client.subscribe(() => schedule());
  void (async () => {
    try {
      await client.load();
      if (!stopped && client.current && !client.current.writerPresent) await client.acquire();
      if (!stopped && client.pending) await client.resolveConflict();
    } catch {/* The next poll recovers using the same durable operation ID. */}
    finally {booting = false; schedule();}
  })();
  return {wake: () => schedule(true), stop: () => {stopped = true; cancel(); unsubscribe();}};
}
