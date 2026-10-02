import React, { useEffect, useState } from 'react';
import { apiRequest } from '../../utils/api';
import { getTelegramUser } from '../../utils/telegram';
import { applyAccountReset, readResetVersion, resetVersionKey } from '../../utils/accountReset';

export const AccountSessionGate: React.FC<React.PropsWithChildren> = ({ children }) => {
  const userId = getTelegramUser().id;
  const [version, setVersion] = useState<number | null>(null);
  const [wasReset, setWasReset] = useState(false);
  useEffect(() => {
    let alive = true;
    const accept = (next: number) => {
      if (!alive || !Number.isSafeInteger(next) || next < 0 || next < readResetVersion(userId)) return;
      const reset = applyAccountReset(userId, next);
      if (reset) setWasReset(true);
      setVersion(previous => Math.max(previous ?? 0, next));
    };
    const check = async () => {
      try { const result = await apiRequest<{ resetVersion: number }>('/api/profile/state', { signal: AbortSignal.timeout(10000) }); accept(result.resetVersion); }
      catch { if (alive) setVersion(previous => previous ?? readResetVersion(userId)); }
    };
    const onReset = (event: Event) => accept((event as CustomEvent<{ resetVersion: number }>).detail.resetVersion);
    const onVisible = () => { if (document.visibilityState === 'visible') void check(); };
    const onStorage = (event: StorageEvent) => { if (event.key === resetVersionKey(userId)) accept(Number(event.newValue)); };
    void check();
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') void check(); }, 15000);
    window.addEventListener('aethelgard-account-reset', onReset);
    window.addEventListener('storage', onStorage);
    document.addEventListener('visibilitychange', onVisible);
    return () => { alive = false; window.clearInterval(timer); window.removeEventListener('aethelgard-account-reset', onReset); window.removeEventListener('storage', onStorage); document.removeEventListener('visibilitychange', onVisible); };
  }, [userId]);
  if (version === null) return <div role="status" className="p-6 text-center">Загрузка персонажа…</div>;
  return <React.Fragment key={version}>
    {wasReset && <div role="status" className="fixed inset-x-3 top-2 z-[60] rounded-xl border border-amber-400 bg-slate-950 p-3 text-center text-sm text-amber-100">
      Администратор сбросил прогресс. Создайте нового персонажа.
      <button onClick={() => setWasReset(false)} className="ml-2 min-h-11 px-3 underline">Понятно</button>
    </div>}
    {children}
  </React.Fragment>;
};
