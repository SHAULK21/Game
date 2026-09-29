import React, { useEffect, useState } from 'react';
import { Crown, Trophy, RefreshCw } from 'lucide-react';
import { useGame } from '../../context/GameContext';
import { apiRequest } from '../../utils/api';

type Row = { telegram_id: number; display_name: string; username?: string | null; level: number; arena_rating: number };

export const LeaderboardScreen: React.FC = () => {
  const { player } = useGame();
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState('');

  const load = async () => {
    setError('');
    try {
      const r = await apiRequest<{ players: Row[] }>('/api/leaderboard');
      setRows(r.players || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось загрузить рейтинг.');
    }
  };

  useEffect(() => { load(); }, []);

  const me = player ? { telegram_id: Number(player.userId), display_name: player.name, level: player.level, arena_rating: player.arenaRating } : null;
  const merged = [...rows];
  if (me && !merged.some(r => String(r.telegram_id) === String(me.telegram_id))) merged.push(me);
  merged.sort((a,b) => b.level - a.level || b.arena_rating - a.arena_rating);

  return (
    <div className="p-3 space-y-4 max-w-lg mx-auto pb-24">
      <div className="rounded-2xl border border-yellow-500/30 bg-gradient-to-b from-[#1b1607] to-[#0a0f1d] p-4">
        <div className="flex items-center gap-3">
          <Crown className="w-8 h-8 text-yellow-300" />
          <div><div className="text-[10px] uppercase tracking-widest text-yellow-400 font-mono">Аэтельгард</div><h2 className="font-cinzel text-lg font-bold">Рейтинг игроков</h2></div>
        </div>
      </div>
      {error && <div className="rounded-xl border border-rose-500/40 bg-rose-950/30 p-3 text-xs text-rose-200">{error}</div>}
      <button onClick={load} className="w-full py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300"><RefreshCw className="w-3.5 h-3.5 inline mr-1" /> Обновить</button>
      <div className="space-y-2">
        {merged.slice(0, 50).map((row, i) => {
          const isMe = me && String(row.telegram_id) === String(me.telegram_id);
          return <div key={String(row.telegram_id)} className={`rounded-xl border p-3 flex items-center gap-3 ${isMe ? 'border-cyan-400/50 bg-cyan-950/20' : 'border-slate-800 bg-[#0a0f1d]'}`}>
            <div className="w-8 text-center font-bold text-slate-500">{i + 1}</div>
            <Trophy className={`w-5 h-5 ${i === 0 ? 'text-yellow-300' : 'text-slate-600'}`} />
            <div className="flex-1 min-w-0"><div className="text-xs font-bold truncate">{row.display_name}</div><div className="text-[9px] text-slate-500">Уровень {row.level} · Арена {row.arena_rating}</div></div>
            {isMe && <span className="text-[9px] text-cyan-300 font-bold">ВЫ</span>}
          </div>;
        })}
        {!merged.length && !error && <div className="text-center text-xs text-slate-600 p-8">Пока нет игроков в рейтинге.</div>}
      </div>
    </div>
  );
};
