import { t as localize, useLocale } from '../../i18n/locale';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Crown, Trophy, RefreshCw } from 'lucide-react';
import { useGame } from '../../context/GameContext';
import { apiRequest } from '../../utils/api';

type Row = { telegram_id: number; character_name?: string; level: number; arena_rating: number; is_online?: boolean };

export const LeaderboardScreen: React.FC<{ embedded?: boolean }> = ({ embedded = false }) => {
  useLocale();
  const { player } = useGame();
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState('');
  const requestInFlight = useRef(false);
  const mounted = useRef(false);
  const characterName = player?.name;
  const level = player?.level;
  const arenaRating = player?.arenaRating;

  const load = useCallback(async () => {
    if (requestInFlight.current || !mounted.current) return;
    requestInFlight.current = true;
    try {
      if (characterName !== undefined) await apiRequest('/api/profile/sync', {
        method: 'POST',
        body: JSON.stringify({ characterName, level, arenaRating })
      });
      const r = await apiRequest<{ players: Row[] }>('/api/leaderboard');
      if (mounted.current) {
        setRows(r.players || []);
        setError('');
      }
    } catch (e) {
      if (mounted.current) setError(e instanceof Error ? e.message : 'Не удалось загрузить рейтинг.');
    } finally {
      requestInFlight.current = false;
    }
  }, [characterName, level, arenaRating]);

  useEffect(() => {
    mounted.current = true;
    const refresh = () => { if (!document.hidden) void load(); };
    refresh();
    const timer = window.setInterval(refresh, 30000);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      mounted.current = false;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [load]);

  const me: Row | null = player ? { telegram_id: Number(player.userId), character_name: player.name, level: player.level, arena_rating: player.arenaRating, is_online: true } : null;
  const merged = rows.map(row => me && String(row.telegram_id) === String(me.telegram_id) ? me : row);
  if (me && !merged.some(r => String(r.telegram_id) === String(me.telegram_id))) merged.push(me);
  merged.sort((a,b) => b.level - a.level || b.arena_rating - a.arena_rating);

  return (
    <div className={`space-y-4 max-w-lg mx-auto ${embedded ? '' : 'p-3 pb-24'}`}>
      <div className="ui-panel rounded-2xl border p-4">
        <div className="flex items-center gap-3">
          <Crown className="w-8 h-8 text-yellow-300" />
          <div><div className="text-[10px] uppercase tracking-widest text-yellow-400 font-mono">{localize("Аэтельгард")}</div><h2 className="font-cinzel text-lg font-bold">{localize("Рейтинг игроков")}</h2></div>
        </div>
      </div>
      {error && <div className="rounded-xl border border-rose-500/40 bg-rose-950/30 p-3 text-xs text-rose-200">{localize(error)}</div>}
      <button onClick={load} className="w-full py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300"><RefreshCw className="w-3.5 h-3.5 inline mr-1" />{localize(" Обновить")}</button>
      <div className="space-y-2">
        {merged.slice(0, 50).map((row, i) => {
          const isMe = me && String(row.telegram_id) === String(me.telegram_id);
          return <div key={String(row.telegram_id)} className={`rounded-xl border p-3 flex items-center gap-3 ${isMe ? 'border-cyan-400/50 bg-cyan-950/20' : 'border-slate-800 bg-[#0a0f1d]'}`}>
            <div className="w-8 text-center font-bold text-slate-500">{localize(i + 1)}</div>
            <Trophy className={`w-5 h-5 ${i === 0 ? 'text-yellow-300' : 'text-slate-600'}`} />
            <div className="flex-1 min-w-0">
              <div className="h-2 mb-1 flex items-center">
                {row.is_online && <span role="img" aria-label={localize('Онлайн')} title={localize('Онлайн')} className="block h-2 w-2 rounded-full bg-emerald-400" />}
              </div>
              <div className="text-xs font-bold truncate">{row.character_name || localize('Игрок')}</div>
              <div className="text-[9px] text-slate-500">{localize("Уровень ")}{localize(row.level)}{localize(" · Арена ")}{localize(row.arena_rating)}</div>
            </div>
            {isMe && <span className="text-[9px] text-[#d5ba89] font-bold">{localize("ВЫ")}</span>}
          </div>;
        })}
        {!merged.length && !error && <div className="text-center text-xs text-slate-600 p-8">{localize("Пока нет игроков в рейтинге.")}</div>}
      </div>
    </div>
  );
};
