import {progressSessionToken, handleProgressConflict, confirmedProgress,waitForProgress,beginRemoteProgress,acceptProgress,setProgressStatus,progressStatus} from './serverProgress';
import {beginGameOperation,isGameMutation} from './gameOperations';
import { getLanguage } from '../i18n/locale';
import { getTelegramWebApp, getTelegramUser } from './telegram';
import {createOperationId} from './operationId';
import { readResetVersion } from './accountReset';

export async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const remoteMutation=!['GET','HEAD'].includes((options.method||'GET').toUpperCase()) && /^\/api\/(items(?:\/|$)|market(?:\/|$)|clan(?:\/|$)|pvp(?:\/|$))/.test(path) && !/\/chat$/.test(path);
  const pendingDonation=path==='/api/clan/donate' && localStorage.getItem('aethelgard_rpc_pending_'+getTelegramUser().id);
  if(path==='/api/clan/donate'&&!pendingDonation)throw new Error('Пожертвования временно недоступны. Казна ещё не подключена к серверному кошельку.');
  if(remoteMutation)await waitForProgress();
  const finishRemote=remoteMutation?beginRemoteProgress():()=>{};
  const tg = getTelegramWebApp();
  const userId = getTelegramUser().id;
  const requestProgress=confirmedProgress();
  const contextCurrent=()=>String(userId)===String(getTelegramUser().id)&&(!requestProgress||!confirmedProgress()||requestProgress.ownerId===confirmedProgress()!.ownerId&&requestProgress.resetVersion===confirmedProgress()!.resetVersion&&requestProgress.sessionGeneration===confirmedProgress()!.sessionGeneration);
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

  let settled=false;let obsolete=false;
  const finish = isGameMutation(path,options.method) ? beginGameOperation() : () => {};
  try {
  let response: Response;
  try {
    response = await fetch(path, { ...options, headers });
  } catch (error) {
    if(remoteMutation&&contextCurrent())setProgressStatus('offline');
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

  if(!contextCurrent()){obsolete=true;throw new Error('Ответ относится к прежней сессии или версии сброса.');}
  if (!response.ok) {
    if(data?.latest && confirmedProgress() && (data.latest.resetVersion<confirmedProgress()!.resetVersion || data.latest.resetVersion===confirmedProgress()!.resetVersion && (data.latest.version<confirmedProgress()!.version || data.latest.sessionGeneration<confirmedProgress()!.sessionGeneration))){obsolete=true;throw new Error('Устаревший ответ сервера проигнорирован.');}
    if (data?.latest && ['VERSION_CONFLICT','SESSION_LOST','SESSION_CONFLICT','ACCOUNT_RESET','PROGRESS_REGRESSION','CHARACTER_CONFLICT','INVALID_SAVE','NO_CHARACTER'].includes(data.code)) handleProgressConflict(data.latest,data.code);
    if (String(userId) === String(getTelegramUser().id) && data?.code === 'ACCOUNT_RESET' && Number.isSafeInteger(data.resetVersion)) {
      window.dispatchEvent(new CustomEvent('aethelgard-account-reset', { detail: { resetVersion: data.resetVersion } }));
    }
    const finalRefusal=response.status<500 || data?.code==='FEATURE_UNAVAILABLE'&&data?.outcome==='rejected';
    settled=finalRefusal;
    if(remoteMutation && finalRefusal)localStorage.removeItem(pendingKey);
    if(remoteMutation && !finalRefusal)setProgressStatus('offline');
    const message = data?.error || data?.message || response.statusText || 'Ошибка сервера';
    throw new Error(`${message} (HTTP ${response.status})`);
  }
  if(remoteMutation && data?._progress){
    if(!acceptProgress(data._progress)){obsolete=true;throw new Error('Устаревший ответ сервера проигнорирован.');}
    localStorage.removeItem(pendingKey);
    // Legacy callbacks may update their old view; replace it after their synchronous continuation.
    setTimeout(()=>{if(contextCurrent())acceptProgress(data._progress,true);finishRemote();},0);
  }else finishRemote();
  settled=true;
  return data as T;
  } catch(error) {if(remoteMutation&&!settled&&!obsolete&&contextCurrent()&&!['conflict','readonly'].includes(progressStatus()))setProgressStatus('offline');finishRemote();throw error;} finally { finish(); }
}
