import {getTelegramWebApp, getTelegramAccount} from './telegram';
import {selectedCharacter} from './characterSession';
import {expandGameReply, type WireGameReply} from './gameProjection';

type ServerlessError = {message?: string; type?: string; parameters?: Record<string, any>};
type ServerlessReply = WireGameReply;
export interface ServerlessTransport {
  call(name: string, input: Record<string, unknown>, callback: (error: ServerlessError | null, result?: ServerlessReply) => void): void;
}

/** One SDK request per operation. Mutation retries belong to ServerProgress,
 * which retains the original operation ID if a timeout hides the outcome. */
export function telegramRequest(transport: ServerlessTransport, path: string, init: RequestInit = {}): Promise<Response> {
  if (!path.startsWith('/api/')) return Promise.reject(new Error('Invalid game API path.'));
  const method = (init.method || 'GET').toUpperCase();
  let body: unknown;
  try {
    if (init.body != null) {
      if (typeof init.body !== 'string') throw new Error('Game API accepts JSON bodies only.');
      body = JSON.parse(init.body);
    }
  } catch (error) {return Promise.reject(error);}
  const headers: Record<string, string> = {};
  for (const [key, value] of new Headers(init.headers)) {
    if (key.startsWith('x-game-')) headers[key] = value;
  }
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true; init.signal?.removeEventListener('abort', abort); fn();
    };
    const abort = () => finish(() => reject(init.signal?.reason || new Error('Request aborted.')));
    if (init.signal?.aborted) {abort(); return;}
    init.signal?.addEventListener('abort', abort, {once: true});
    try {
      transport.call('gameApi', {path, method, headers, projectionProtocol: 1, ...(body === undefined ? {} : {body})}, (error, result) => {
        finish(() => {
          if (error) {
            if (error.type === 'ENDPOINT_ERROR' || error.type === 'UNAUTHORIZED') {
              const parameters = error.parameters || {};
              const status = error.type === 'UNAUTHORIZED' ? 401 : Number(parameters.status || 400);
              resolve(new Response(JSON.stringify({...parameters, error: error.message || 'Ошибка игрового сервера.'}),
                {status: Number.isInteger(status) && status >= 400 && status <= 599 ? status : 400}));
            } else reject(new Error(error.message || 'Не удалось получить результат операции.'));
            return;
          }
          if (!result || !Number.isInteger(result.status) || result.status < 200 || result.status > 599) {
            reject(new Error('Некорректный ответ Telegram Serverless.')); return;
          }
          const noBody = [204, 205, 304].includes(result.status);
          resolve(new Response(noBody ? null : JSON.stringify(expandGameReply(result).body ?? null),
            {status: result.status, headers: {'Content-Type': 'application/json'}}));
        });
      });
    } catch (error) {finish(() => reject(error));}
  });
}

export function gameFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set('X-Game-Character',String(selectedCharacter(getTelegramAccount().id)?.slot || 0));
  init = {...init, headers};
  if (import.meta.env?.VITE_GAME_BACKEND !== 'telegram') return fetch(path, init);
  const transport = getTelegramWebApp()?.Serverless;
  if (!transport) return Promise.reject(new Error('Откройте игру в Telegram с поддержкой Serverless.'));
  return telegramRequest(transport, path, init);
}
