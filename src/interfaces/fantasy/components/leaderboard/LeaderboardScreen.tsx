import React, { useEffect, useState } from 'react';
import { useGame } from '../../../../context/GameContext';
import { apiRequest } from '../../../../utils/api';
import { RpgIcon } from '../ui/RpgIcon';
import { BestiaryPanel, FolioPage, RpgButton } from '../ui/BestiaryUI';

type Row = { telegram_id: number; character_name?: string; level: number; arena_rating: number };

export const LeaderboardScreen: React.FC = () => {
  const { player } = useGame();
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState('');

  const load = async () => {
    setError('');
    try {
      if (player) await apiRequest('/api/profile/sync', {
        method: 'POST',
        body: JSON.stringify({ characterName: player.name, level: player.level, arenaRating: player.arenaRating })
      });
      const r = await apiRequest<{ players: Row[] }>('/api/leaderboard');
      setRows(r.players || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось загрузить рейтинг.');
    }
  };

  useEffect(() => { load(); }, []);

  const me = player ? { telegram_id: Number(player.userId), character_name: player.name, level: player.level, arena_rating: player.arenaRating } : null;
  const merged = rows.map(row => me && String(row.telegram_id) === String(me.telegram_id) ? me : row);
  if (me && !merged.some(r => String(r.telegram_id) === String(me.telegram_id))) merged.push(me);
  merged.sort((a,b) => b.level - a.level || b.arena_rating - a.arena_rating);

  return (
    <FolioPage className="space-y-3 pt-3">
      <BestiaryPanel className="rounded-xl p-3">
        <div className="flex items-center gap-3">
          <RpgIcon kind="arena" size={30} className="text-yellow-300" />
          <div><div className="text-[11px] uppercase tracking-widest text-yellow-400 font-mono">Аэтельгард</div><h2 className="font-cinzel text-lg font-bold">Рейтинг игроков</h2></div>
        </div>
      </BestiaryPanel>
      {error && <div role="alert" className="rounded-xl border border-rose-500/40 bg-rose-950/30 p-3 text-xs text-rose-200">{error}</div>}
      <RpgButton variant="secondary" icon="refresh" onClick={load} className="w-full">Обновить</RpgButton>
      <div className="space-y-2">
        {merged.slice(0, 50).map((row, i) => {
          const isMe = me && String(row.telegram_id) === String(me.telegram_id);
          return <BestiaryPanel key={String(row.telegram_id)} className={`flex items-center gap-3 p-3 ${isMe ? 'border-cyan-400/50 bg-cyan-950/20' : ''}`}>
            <div className="w-8 text-center font-bold text-slate-500">{i + 1}</div>
            <RpgIcon kind={i === 0 ? 'crown' : 'arena'} size={20} className={i === 0 ? 'text-yellow-300' : 'text-slate-600'} />
            <div className="flex-1 min-w-0"><div className="text-xs font-bold truncate">{row.character_name || 'Игрок'}</div><div className="text-[11px] text-slate-500">Уровень {row.level} · Арена {row.arena_rating}</div></div>
            {isMe && <span className="text-[11px] text-[#d5ba89] font-bold">ВЫ</span>}
          </BestiaryPanel>;
        })}
        {!merged.length && !error && <div className="text-center text-xs text-slate-600 p-8">Пока нет игроков в рейтинге.</div>}
      </div>
    </FolioPage>
  );
};
