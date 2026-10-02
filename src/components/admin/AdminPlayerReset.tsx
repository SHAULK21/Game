import React, { useEffect, useRef, useState } from 'react';
import { apiRequest } from '../../utils/api';
import { createOperationId } from '../../utils/operationId';

interface ResetPlayer { telegramId: string; username: string | null; displayName: string; characterName: string | null; level: number; resetVersion: number; inClan: boolean }
export const AdminPlayerReset: React.FC = () => {
  const [search, setSearch] = useState('');
  const [players, setPlayers] = useState<ResetPlayer[]>([]);
  const [selected, setSelected] = useState<ResetPlayer | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [reload, setReload] = useState(0);
  const operation = useRef<{ target: string; id: string } | null>(null);
  useEffect(() => {
    let alive = true;
    setLoading(true);
    const timer = window.setTimeout(async () => {
      try {
        const result = await apiRequest<{ players: ResetPlayer[] }>('/api/admin/players?search=' + encodeURIComponent(search));
        if (alive) setPlayers(result.players);
      } catch (error) { if (alive) setFeedback(error instanceof Error ? error.message : 'Не удалось загрузить игроков.'); }
      finally { if (alive) setLoading(false); }
    }, 250);
    return () => { alive = false; window.clearTimeout(timer); };
  }, [search, reload]);
  const reset = async () => {
    if (!selected || !confirmed || busy) return;
    const target = selected;
    if (operation.current?.target !== target.telegramId) operation.current = { target: target.telegramId, id: createOperationId() };
    setBusy(true); setFeedback('');
    try {
      await apiRequest('/api/admin/players/' + target.telegramId + '/reset', { method: 'POST', body: JSON.stringify({ operationId: operation.current.id, expectedVersion: Number(target.resetVersion), confirmTargetId: target.telegramId }) });
      setFeedback(`Прогресс ${target.characterName || target.displayName} сброшен. При входе игрок создаст нового персонажа.`);
      operation.current = null; setSelected(null); setConfirmed(false); setReload(value => value + 1);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Сброс не выполнен.';
      setFeedback(message);
      if (/HTTP (400|403|409)/.test(message)) { operation.current = null; setConfirmed(false); setSelected(null); setReload(value => value + 1); }
    } finally { setBusy(false); }
  };
  return <section className="rounded-xl border border-red-400/40 bg-slate-950/50 p-3 space-y-3" aria-label="Сброс прогресса игрока">
    <h4 className="text-sm font-bold text-red-200">Сбросить прогресс игрока</h4>
    <label className="block text-xs text-slate-300">Найти по имени, @username или Telegram ID
      <input type="search" value={search} disabled={busy} onChange={event => { setSearch(event.target.value); setSelected(null); setConfirmed(false); }} className="mt-1 min-h-11 w-full rounded-lg border border-slate-600 bg-slate-900 px-3 text-sm" placeholder="Выберите, чей аккаунт сбросить" />
    </label>
    <div className="max-h-48 overflow-y-auto space-y-1">
      {loading ? <p role="status" className="text-xs text-slate-400">Загрузка игроков…</p> : players.length ? players.map(candidate =>
        <button key={candidate.telegramId} type="button" disabled={busy} aria-pressed={selected?.telegramId === candidate.telegramId} onClick={() => { setSelected(candidate); setConfirmed(false); setFeedback(''); }} className={`min-h-11 w-full rounded-lg border p-2 text-left text-xs ${selected?.telegramId === candidate.telegramId ? 'border-red-400 bg-red-950/40' : 'border-slate-700 bg-slate-900'}`}>
          <strong>{candidate.characterName || candidate.displayName}</strong> · Ур. {candidate.level}
          <span className="mt-1 block text-slate-400">{candidate.username ? '@' + candidate.username + ' · ' : ''}ID {candidate.telegramId}</span>
        </button>
      ) : <p className="text-xs text-slate-400">Игроки не найдены.</p>}
    </div>
    {selected && <div className="space-y-2 rounded-lg border border-red-500/50 p-3">
      <p className="text-xs text-red-100">Сброс: <strong>{selected.characterName || selected.displayName}</strong>, ID {selected.telegramId}.</p>
      <p className="text-xs text-slate-300">Удалятся персонаж, уровни, ресурсы, предметы, профессии и прогресс пещер. Активные лоты будут сняты, PvP обнулится, игрок выйдет из клана. Telegram и оплаченный Premium сохранятся.</p>
      {selected.inClan && <p className="text-xs text-amber-200">Если игрок — глава клана, управление перейдёт другому участнику. Пустой клан будет удалён вместе с казной и складом.</p>}
      <label className="flex min-h-11 items-center gap-2 text-xs text-red-200"><input type="checkbox" checked={confirmed} disabled={busy} onChange={event => setConfirmed(event.target.checked)} className="h-5 w-5" />Подтверждаю сброс именно этого игрока</label>
      <button type="button" disabled={!confirmed || busy} onClick={() => void reset()} className="min-h-11 w-full rounded-lg border border-red-500 bg-red-950 px-3 text-xs font-bold text-red-100 disabled:opacity-40">{busy ? 'Сброс…' : 'Сбросить выбранного игрока'}</button>
    </div>}
    {feedback && <p role="status" className="text-xs text-amber-100">{feedback}</p>}
  </section>;
};
