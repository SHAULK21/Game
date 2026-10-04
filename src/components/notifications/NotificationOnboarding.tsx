import { useEffect, useState } from 'react';
import { useGame } from '../../context/GameContext';
import { t, useLocale } from '../../i18n/locale';
import { apiRequest } from '../../utils/api';
import { getTelegramUser, isInsideTelegram } from '../../utils/telegram';
import { subscribeToNotifications, type NotificationSettings } from '../../utils/notificationSubscription';
import { useDialog } from '../../interfaces/fantasy/components/ui/useDialog';

export function NotificationOnboarding() {
  useLocale();
  const { player, offlineReport } = useGame();
  const [data, setData] = useState<{ settings: NotificationSettings; botStarted: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const key = `aethelgard_notification_onboarding_${getTelegramUser().id}`;
  const remember = () => { try { localStorage.setItem(key, 'seen'); } catch { /* Server preference is authoritative. */ } };
  useEffect(() => {
    if (!player || !isInsideTelegram()) return;
    let cancelled = false;
    void apiRequest<{ settings: NotificationSettings; botStarted: boolean }>('/api/notifications').then(result => {
      if (cancelled) return;
      const settings = result.settings || {};
      if (settings.onboardingSeen || Object.hasOwn(settings, 'enabled')) { remember(); return; }
      let seen = false;
      try { seen = localStorage.getItem(key) === 'seen'; } catch { /* Continue with server preferences. */ }
      if (seen) {
        void apiRequest('/api/notifications/onboarding', { method: 'POST', body: '{}' }).catch(() => undefined);
        return;
      }
      setData({ ...result, settings });
    }).catch(() => undefined); // An unavailable server must never block entering the game.
    return () => { cancelled = true; };
  }, [Boolean(player), key]);
  const later = () => {
    if (busy) return;
    remember(); setData(null);
    void apiRequest('/api/notifications/onboarding', { method: 'POST', body: '{}' }).catch(() => undefined);
  };
  const open = Boolean(data && !offlineReport);
  const dialog = useDialog(open, later);
  if (!open || !data) return null;
  const enable = async () => {
    setBusy(true); setError('');
    try { await subscribeToNotifications(data.settings, data.botStarted); remember(); setData(null); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Не удалось включить уведомления. Попробуйте снова.'); }
    finally { setBusy(false); }
  };
  return <div className="fixed inset-0 z-[70] bg-black/75 flex items-center justify-center p-4">
    <section ref={dialog} role="dialog" aria-modal="true" aria-labelledby="notification-onboarding-title" aria-describedby="notification-onboarding-description" tabIndex={-1}
      className="notification-onboarding-dialog ui-panel w-full max-w-sm p-5 space-y-4 rounded-xl">
      <h2 id="notification-onboarding-title" className="text-lg font-bold">{t('Включить уведомления?')}</h2>
      <p id="notification-onboarding-description" className="text-sm leading-relaxed">{t('Сообщать в Telegram о восстановлении энергии, завершении экспедиций и других событиях, даже когда игра закрыта?')}</p>
      <p className="text-xs">{t('Настройки можно изменить в разделе «Ещё → Оповещения».')}</p>
      {error && <p role="alert" className="text-sm text-red-400">{t(error)}</p>}
      <div className="flex gap-3">
        <button disabled={busy} onClick={() => void enable()} className="ui-primary flex-1 min-h-11 rounded-lg font-bold">{t(busy ? 'Подождите…' : 'Включить')}</button>
        <button disabled={busy} onClick={later} className="flex-1 min-h-11 rounded-lg border border-current">{t('Позже')}</button>
      </div>
    </section>
  </div>;
}
