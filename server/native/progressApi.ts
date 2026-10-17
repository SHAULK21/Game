import {registerGameRoutes} from '../gameRoutes';
import {NativePool, type NativeWorld} from './pool';
import {registerGameApiGuard} from '../gameApiGuard';
import {gameTransactionPool} from '../gameTransactions';
import {registerNativeMarket} from './marketRoutes';
import {registerNativeClans} from './clanRoutes';
import {registerNativeSocial} from './socialRoutes';
import {registerNativePvp} from './pvpRoutes';
import {registerNativeAdmin} from './adminRoutes';
type Identity = {id: number; displayName: string; username?: string; allowsWriteToPm?: boolean};
type Reply = {status: number; body: any; effect?: {method: string; payload: Record<string, any>}};

export async function handleProgressRequest(world: NativeWorld, input: any, identity: Identity,
  options: {now?: () => number; isAdmin?: (id: number) => boolean; startParam?: string; onRoutes?: (routes: {method: string; pattern: string}[]) => void} = {}): Promise<Reply> {
  if (!Number.isSafeInteger(identity.id) || identity.id <= 0) return {status: 401, body: {code: 'UNAUTHORIZED', error: 'Откройте игру из Telegram.'}};
  if (!input || typeof input.path !== 'string' || input.path.length > 2048 || !input.path.startsWith('/api/')) return {status: 400, body: {error: 'Некорректный путь API.'}};
  const pool = new NativePool(world, options.now), account = pool.ensurePlayer(identity);
  const path = input.path.split('?')[0], method = String(input.method || 'GET').toUpperCase();
  const headers: Record<string, string> = {};
  for (const [name, value] of Object.entries(input.headers || {})) if (name.toLowerCase().startsWith('x-game-') && typeof value === 'string') headers[name.toLowerCase()] = value;
  const query: Record<string, string> = {};
  try {for (const part of input.path.split('?').slice(1).join('?').split('&')) {
    if (!part) continue; const at = part.indexOf('=');
    const key = decodeURIComponent((at < 0 ? part : part.slice(0, at)).replace(/\+/g, ' '));
    Object.defineProperty(query, key, {value: decodeURIComponent((at < 0 ? '' : part.slice(at + 1)).replace(/\+/g, ' ')), enumerable: true, configurable: true});
  }} catch {return {status: 400, body: {error: 'Некорректные параметры запроса.'}};}
  const req: any = {path, method, body: input.body ?? {}, headers, query, params: {}, authUser: identity,
    verifiedStartParam: options.startParam || '',
    get: (name: string) => headers[name.toLowerCase()]};
  let reply: Reply = {status: 404, body: {code: 'NOT_FOUND', error: 'API не найден.'}}, sent = false;
  let completed!: () => void;
  const completion = new Promise<void>(resolve => {completed = resolve;});
  const res: any = {locals: {}, get headersSent() {return sent;}, set() {return this;},
    get statusCode() {return reply.status;},
    status(status: number) {reply.status = status; return this;},
    json(body: any) {sent = true; reply.body = body; completed(); return this;}};
  const routes: {method: string; pattern: string; handlers: any[]}[] = [];
  const middleware: any[] = [];
  const app: any = {get: (pattern: string, ...handlers: any[]) => routes.push({method: 'GET', pattern, handlers}),
    post: (pattern: string, ...handlers: any[]) => routes.push({method: 'POST', pattern, handlers}),
    use: (...handlers: any[]) => middleware.push(...handlers)};
  const auth: any = async (_req: any, response: any, next: any) => {
    if (!['GET', 'HEAD'].includes(method) && Number(headers['x-game-reset-version'] || 0) !== Number(account.reset_version)) {
      response.status(409).json({code: 'ACCOUNT_RESET', resetVersion: Number(account.reset_version), error: 'Прогресс сброшен. Загрузите актуальные данные.'}); return;
    }
    await next();
  };
  const contextual = gameTransactionPool(pool.asPool());
  registerGameApiGuard(app, () => contextual, auth, options);
  registerGameRoutes(app, () => contextual, auth, options);
  registerNativeMarket(app, pool, auth);
  registerNativeClans(app, pool, auth);
  registerNativeSocial(app, pool, auth, options);
  registerNativePvp(app, pool, auth);
  registerNativeAdmin(app, pool, auth, options);
  options.onRoutes?.(routes.map(({method, pattern}) => ({method, pattern})));
  for (const route of routes) {
    if (route.method !== method) continue;
    const expected = route.pattern.split('/'), actual = path.split('/');
    if (expected.length !== actual.length) continue;
    const params: Record<string, string> = {}; let matches = true;
    for (let index = 0; index < expected.length; index++) {
      if (expected[index].startsWith(':')) {
        try {params[expected[index].slice(1)] = decodeURIComponent(actual[index]);} catch {matches = false; break;}
      } else if (expected[index] !== actual[index]) {matches = false; break;}
    }
    if (!matches) continue;
    reply.status = 200;
    req.params = params;
    const beforeRoute = /^\/api\/(progress|expeditions)(\/|$)/.test(path) ? null : JSON.parse(JSON.stringify(world));
    const handlers = [...middleware, ...route.handlers];
    const dispatch = async (index: number): Promise<void> => {
      if (sent || index >= handlers.length) return;
      let nextCall: Promise<void> | undefined;
      try {
        await handlers[index](req, res, () => {nextCall = dispatch(index + 1); return nextCall;});
        if (nextCall) await nextCall;
      } catch {
        if (!sent) res.status(503).json({code: 'RESULT_UNKNOWN', error: 'Игровой сервис временно недоступен. Восстановите запрос.'});
      }
    };
    await dispatch(0); await completion;
    if (beforeRoute && reply.status >= 400 && !reply.body?._operation) {
      for (const key of Object.keys(world)) delete world[key]; Object.assign(world, beforeRoute);
    }
    break;
  }
  return {...reply, ...(res.locals.effect ? {effect: res.locals.effect} : {})};
}
