import { getTelegramWebApp } from './telegram';

export async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const tg = getTelegramWebApp();
  const headers = new Headers(options.headers);
  headers.set('Content-Type', 'application/json');
  if (tg?.initData) headers.set('X-Telegram-Init-Data', tg.initData);

  const response = await fetch(path, { ...options, headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Ошибка сервера.');
  return data as T;
}
