import { getTelegramWebApp, getTelegramUser } from './telegram';
import { readResetVersion } from './accountReset';

export async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const tg = getTelegramWebApp();
  const headers = new Headers(options.headers);
  headers.set('Content-Type', 'application/json');
  headers.set('X-Game-Reset-Version', String(readResetVersion(getTelegramUser().id)));
  if (tg?.initData) headers.set('X-Telegram-Init-Data', tg.initData);

  let response: Response;
  try {
    response = await fetch(path, { ...options, headers });
  } catch (error) {
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
    if (data?.code === 'ACCOUNT_RESET' && Number.isSafeInteger(data.resetVersion)) {
      window.dispatchEvent(new CustomEvent('aethelgard-account-reset', { detail: { resetVersion: data.resetVersion } }));
    }
    const message = data?.error || data?.message || response.statusText || 'Ошибка сервера';
    throw new Error(`${message} (HTTP ${response.status})`);
  }
  return data as T;
}
