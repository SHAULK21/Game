import type {Express, Request, RequestHandler} from 'express';
import type {Pool} from 'pg';
import {GameStore, type GameOperation} from './gameStore';
import {ExpeditionStore, ExpeditionError, type Command} from './expeditions/store';
import {ExpeditionRuleError, ROUTES, GOALS, DURATIONS, PREPARATIONS, type Selection} from '../src/game/expeditions/rules';
import {ProgressError} from './progressValidation';
export function selection(input: any): Selection {
  if (!input || !ROUTES.some(route => route.id === input.route) || !GOALS.includes(input.goal) || !DURATIONS.includes(input.duration) || !Object.hasOwn(PREPARATIONS, input.preparation) || !['personal','hired'].includes(input.crew)) throw new ProgressError('INVALID_SELECTION', 'Проверьте параметры экспедиции.', 400);
  return {route: input.route, goal: input.goal, duration: input.duration, preparation: input.preparation, crew: input.crew};
}
export function registerGameRoutes(app: Express, getPool: () => Pool, auth: RequestHandler, options: {now?: () => number; isAdmin?: (id: number) => boolean} = {}) {
  const identity = (req: Request) => ({...req.authUser!, locale: req.get('X-Game-Language') === 'uk' ? 'uk' as const : 'ru' as const});
  const token = (req: Request) => req.get('X-Game-Session') || '';
  const writer = (req: Request): GameOperation => ({sessionToken: token(req), resetVersion: Number(req.get('X-Game-Reset-Version')), sessionGeneration: Number(req.get('X-Game-Generation')), expectedVersion: Number(req.get('X-Game-Version')), operationId: req.get('X-Game-Operation') || ''});
  const handle = (fn: (store: GameStore, req: Request) => Promise<any>): RequestHandler => async (req, res) => {
    const store = new GameStore(getPool(), options);
    try {res.set('Cache-Control', 'no-store').json(await fn(store, req));}
    catch (error) {
      const known = error instanceof ProgressError || error instanceof ExpeditionError || error instanceof ExpeditionRuleError;
      let latest: any;
      try {latest = await store.load(identity(req), token(req), {tick: false});} catch {}
      let receipt: any;
      if (req.get('X-Game-Operation')) try {receipt = await store.receipt(identity(req), token(req), req.get('X-Game-Operation')!, Number(req.get('X-Game-Reset-Version')));} catch {}
      res.status(known ? error instanceof ExpeditionRuleError ? 400 : error.status : 503).json({code: known ? error.code : 'RESULT_UNKNOWN', error: known ? error.message : 'Результат пока неизвестен. Восстановите операцию перед следующим действием.', ...latest, ...(receipt?.operation ? {operation: receipt.operation} : {}), ...(error instanceof ExpeditionError && error.operationOutcome ? {operation: {id: req.get('X-Game-Operation'), outcome: 'rejected', result: {code: error.code, error: error.message}, replayed: true}} : {})});
    }
  };
  app.get('/api/progress', auth, handle((store, req) => store.load(identity(req), token(req))));
  app.post('/api/progress/session', auth, handle((store, req) => store.acquire(identity(req), token(req), req.body?.generation, req.body?.transfer === true)));
  app.post('/api/progress/create', auth, handle((store, req) => store.create(identity(req), writer(req), req.body)));
  app.post('/api/progress/migrate', auth, handle((store, req) => req.body?.source === 'server' ? store.migrateStoredLegacy(identity(req), writer(req)) : store.migrate(identity(req), writer(req), req.body?.save, req.body?.replaceExisting === true)));
  app.post('/api/progress/keep-server', auth, handle((store, req) => store.keepServer(identity(req), writer(req))));
  app.post('/api/progress/command', auth, handle((store, req) => store.operation(identity(req), writer(req), req.body)));
  app.get('/api/progress/operations/:id', auth, handle((store, req) => store.receipt(identity(req), token(req), String(req.params.id), Number(req.get('X-Game-Reset-Version')))));
  app.post('/api/expeditions/command', auth, handle(async (store, req) => {
    const input = req.body || {}; let command: Command;
    switch (input.type) {
      case 'start': command = {type: 'start', selection: selection(input.selection), repeat: input.repeat, expectedPrice: input.expectedPrice}; break;
      case 'repeat': command = {type: 'repeat', selection: input.selection === null ? null : selection(input.selection)}; break;
      case 'return': command = {type: 'return', runId: input.runId, quote: input.quote}; break;
      case 'claim': command = {type: 'claim', runId: input.runId}; break;
      case 'train': command = {type: 'train', expectedPrice: input.expectedPrice}; break;
      case 'accept-order': case 'deliver-order': case 'abandon-order': case 'reconcile': command = {type: input.type}; break;
      default: throw new ProgressError('UNKNOWN_COMMAND', 'Неизвестное действие.', 400);
    }
    const result = await new ExpeditionStore(getPool(), options.now).mutate({...writer(req), ownerId: identity(req).id}, command);
    return {...await store.load(identity(req), token(req)), operation: {id: writer(req).operationId, outcome: 'applied', result: result.result, replayed: result.replayed}};
  }));
}
