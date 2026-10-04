import { apiRequest } from './api';
import { getTelegramWebApp, isInsideTelegram } from './telegram';

export type NotificationSettings = Record<string, boolean>;

/** Called by a click handler so Telegram can show its native permission dialog. */
export async function subscribeToNotifications(settings: NotificationSettings, botStarted: boolean) {
  const tg = getTelegramWebApp();
  if (!tg || !isInsideTelegram()) throw new Error('Откройте игру в Telegram, чтобы включить сообщения.');
  let allowed = botStarted || tg.initDataUnsafe?.user?.allows_write_to_pm === true;
  if (!allowed && tg.requestWriteAccess) {
    allowed = await new Promise<boolean>(resolve => tg.requestWriteAccess!(resolve));
    if (!allowed) throw new Error('Для сообщений в Telegram разрешите боту писать вам.');
  }
  // Older clients can grant access by starting the bot instead.
  let startUrl: string | undefined;
  if (!allowed) {
    const referral = await apiRequest<{ url: string }>('/api/referrals');
    if (!referral.url || !tg.openTelegramLink) throw new Error('Нажмите «Старт» в игровом боте и попробуйте снова.');
    startUrl = referral.url.replace(/\?start=.*/, '?start=notifications');
  }
  const result = await apiRequest<{ settings: NotificationSettings }>('/api/notifications/settings', {
    method: 'POST', body: JSON.stringify({ ...settings, enabled: true })
  });
  if (startUrl) tg.openTelegramLink!(startUrl);
  return result.settings;
}
