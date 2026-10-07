import {progressSessionToken, handleProgressConflict, confirmedProgress,waitForProgress,beginRemoteProgress,acceptProgress,setProgressStatus} from './serverProgress';
import {beginGameOperation,isGameMutation} from './gameOperations';
import { getLanguage } from '../i18n/locale';
import { getTelegramWebApp, getTelegramUser } from './telegram';
import {createOperationId} from './operationId';
import { readResetVersion } from './accountReset';

export async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const remoteMutation=!['GET','HEAD'].includes((options.method||'GET').toUpperCase()) && /^\/api\/(items(?:\/|$)|market(?:\/|$)|clan(?:\/|$)|pvp(?:\/|$))/.test(path) && !/\/chat$/.test(path);
  if(remoteMutation)await waitForProgress();
  const finishRemote=remoteMutation?beginRemoteProgress():()=>{};
  const tg = getTelegramWebApp();
  const userId = getTelegramUser().id;
  const headers = new Headers(options.headers);
  headers.set('Content-Type', 'application/json');
  headers.set('X-Game-Session', progressSessionToken());
  headers.set('X-Game-Save-Version', String(confirmedProgress()?.version ?? -1));
  const pendingKey='aethelgard_rpc_pending_'+userId;
  let pending:any=null;
  if(remoteMutation){
    try{pending=JSON.parse(localStorage.getItem(pendingKey)||'null');}catch{}
    const request=JSON.stringify({path,body:options.body,resetVersion:readResetVersion(userId)});
    if(pending && pending.request!==request){finishRemote();throw new Error('Сначала завершите предыдущую операцию или загрузите актуальный прогресс.');}
    if(!pending){let bodyId:string|undefined;try{const b=JSON.parse(String(options.body||'{}'));bodyId=b.operationId||b.matchId;}catch{}pending={operationId:bodyId||createOperationId(),request};localStorage.setItem(pendingKey,JSON.stringify(pending));}
    headers.set('X-Game-Operation',pending.operationId);
  }
  headers.set('X-Game-Language', getLanguage());
  headers.set('X-Game-Reset-Version', String(readResetVersion(getTelegramUser().id)));
  if (tg?.initData) headers.set('X-Telegram-Init-Data', tg.initData);

  const finish = isGameMutation(path,options.method) ? beginGameOperation() : () => {};
  try {
  let response: Response;
  try {
    response = await fetch(path, { ...options, headers });
  } catch (error) {
    if(remoteMutation)setProgressStatus('offline');
    throw new Error('Нет соединения с игровым сервером. Проверьте Render и /api/health.');
  }

  const raw = await response.text();
  let data: any = {};
  if (raw) {
    try { data = JSON.parse(raw); }
    catch {
      if (raw.trim().startsWith('<!doctype') || raw.trim().startsWith('<html')) {
        throw new Error(`API вернул HTML вместо данных (HTTP ${response.status}). Проверьте, что Render запущен как Web Service через npm run start.`);
      }
      data = { error: raw.slice(0, 300) };
    }
  }

  if (!response.ok) {
    if (data?.latest && ['VERSION_CONFLICT','SESSION_LOST','SESSION_CONFLICT','ACCOUNT_RESET','PROGRESS_REGRESSION','CHARACTER_CONFLICT','INVALID_SAVE','NO_CHARACTER'].includes(data.code)) handleProgressConflict(data.latest,data.code);
    if (String(userId) === String(getTelegramUser().id) && data?.code === 'ACCOUNT_RESET' && Number.isSafeInteger(data.resetVersion)) {
      window.dispatchEvent(new CustomEvent('aethelgard-account-reset', { detail: { resetVersion: data.resetVersion } }));
    }
    if(remoteMutation && response.status<500)localStorage.removeItem(pendingKey);
    if(remoteMutation && response.status>=500)setProgressStatus('offline');
    const message = data?.error || data?.message || response.statusText || 'Ошибка сервера';
    throw new Error(`${message} (HTTP ${response.status})`);
  }
  if(remoteMutation && data?._progress){
    acceptProgress(data._progress);
    localStorage.removeItem(pendingKey);
    // Legacy callbacks may update their old view; replace it after their synchronous continuation.
    setTimeout(()=>{acceptProgress(data._progress,true);finishRemote();},0);
  }else finishRemote();
  return data as T;
  } catch(error) {finishRemote();throw error;} finally { finish(); }
}
