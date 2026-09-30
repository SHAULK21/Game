import React, { useEffect, useState } from 'react';
import { useGame } from '../../context/GameContext';
import { 
  ShieldAlert, 
  Coins, 
  Gem, 
  Zap, 
  Sparkles, 
  Trash2, 
  UserCheck, 
  Megaphone,
  X,
  Check,
  Users,
  Activity
} from 'lucide-react';
import { sound } from '../../utils/audio';
import { apiRequest } from '../../utils/api';

interface AdminModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AdminModal: React.FC<AdminModalProps> = ({ isOpen, onClose }) => {
  const {
    player,
    adminAddGold,
    adminAddSilver,
    adminLevelUp,
    adminSpawnLegendaryItem,
    adminHealAll,
    resetCharacter,
    sendChatMessage
  } = useGame();

  const [broadcastText, setBroadcastText] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [serverStats, setServerStats] = useState({ totalPlayers: 0, onlinePlayers: 0 });
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    apiRequest<{ isAdmin: boolean }>('/api/admin/status')
      .then(result => setIsAdmin(Boolean(result?.isAdmin)))
      .catch(() => setIsAdmin(false));
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !isAdmin) return;
    let alive = true;
    const loadServerStats = async () => {
      try {
        const stats = await apiRequest<{ totalPlayers: number; onlinePlayers: number }>('/api/community/stats');
        if (alive) setServerStats({
          totalPlayers: Number(stats?.totalPlayers || 0),
          onlinePlayers: Number(stats?.onlinePlayers || 0)
        });
      } catch {
        // Admin tools remain available even if server statistics are temporarily unavailable.
      }
    };
    loadServerStats();
    const timer = window.setInterval(loadServerStats, 15000);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [isOpen, isAdmin]);

  if (!isOpen || !player || !isAdmin) return null;

  const showNotice = (msg: string) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(null), 2500);
  };

  const handleBroadcast = (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastText.trim()) return;
    sendChatMessage(`📢 [ОБЪЯВЛЕНИЕ АДМИНИСТРАЦИИ]: ${broadcastText.trim()}`, 'global');
    setBroadcastText('');
    showNotice('Объявление отправлено всем игрокам!');
  };

  const switchMockUser = (name: string) => {
    localStorage.setItem('aethelgard_mock_user', JSON.stringify({
      id: Math.floor(10000000 + Math.random() * 90000000),
      first_name: name,
      username: name.toLowerCase().replace(/\s+/g, '_'),
      language_code: 'ru',
      is_premium: true
    }));
    showNotice(`Профиль Telegram переключен на: ${name}. Перезагрузите приложение для смены.`);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl border border-purple-500/50 bg-[#0c0d1c] p-4 space-y-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-purple-500/30 pb-2.5">
          <div className="flex items-center gap-2 text-purple-300">
            <ShieldAlert className="w-5 h-5 text-purple-400" />
            <h3 className="font-cinzel text-sm font-bold text-slate-100">
              Панель Управления Игрой (Admin Console)
            </h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {feedback && (
          <div className="p-2.5 rounded-xl bg-purple-950/80 border border-purple-500/60 text-purple-200 text-xs text-center font-medium">
            {feedback}
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-xl border border-indigo-500/30 bg-indigo-950/20 p-3">
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-indigo-300">
              <Users className="w-3.5 h-3.5" /> Всего игроков
            </div>
            <div className="mt-1 text-xl font-mono font-bold text-slate-100">{serverStats.totalPlayers}</div>
          </div>
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-3">
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-emerald-300">
              <Activity className="w-3.5 h-3.5" /> Сейчас онлайн
            </div>
            <div className="mt-1 text-xl font-mono font-bold text-emerald-200">{serverStats.onlinePlayers}</div>
          </div>
        </div>

        {/* Quick Resource Cheats */}
        <div className="space-y-1.5">
          <span className="text-[11px] font-mono text-purple-400 uppercase tracking-wider block">
            Быстрое начисление ресурсов:
          </span>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <button
              onClick={() => {
                adminAddGold(10000);
                showNotice('+10,000 Золота добавлено!');
              }}
              className="p-2.5 rounded-xl bg-slate-900 border border-amber-500/40 text-amber-300 font-bold flex items-center justify-center gap-1.5 active:scale-95 transition-all"
            >
              <Coins className="w-4 h-4" />
              <span>+10,000 🪙 Золота</span>
            </button>

            <button
              onClick={() => {
                adminAddSilver(500);
                showNotice('+500 Серебра добавлено!');
              }}
              className="p-2.5 rounded-xl bg-slate-900 border border-cyan-500/40 text-[#d5ba89] font-bold flex items-center justify-center gap-1.5 active:scale-95 transition-all"
            >
              <Gem className="w-4 h-4" />
              <span>+500 🥈 Серебра</span>
            </button>

            <button
              onClick={() => {
                adminLevelUp();
                showNotice('+1 Уровень повышен!');
              }}
              className="p-2.5 rounded-xl bg-slate-900 border border-indigo-500/40 text-indigo-300 font-bold flex items-center justify-center gap-1.5 active:scale-95 transition-all"
            >
              <Zap className="w-4 h-4" />
              <span>+1 Уровень (EXP)</span>
            </button>

            <button
              onClick={() => {
                adminSpawnLegendaryItem();
                showNotice('Древний артефакт "Крушитель Богов" добавлен в инвентарь!');
              }}
              className="p-2.5 rounded-xl bg-purple-950 border border-purple-400/60 text-purple-200 font-bold flex items-center justify-center gap-1.5 active:scale-95 transition-all shadow-md"
            >
              <Sparkles className="w-4 h-4" />
              <span>Древний меч (+10)</span>
            </button>
          </div>
        </div>

        {/* Global Broadcast */}
        <div className="space-y-1.5">
          <span className="text-[11px] font-mono text-purple-400 uppercase tracking-wider block">
            Мировое оповещение (System Broadcast):
          </span>
          <form onSubmit={handleBroadcast} className="flex gap-2">
            <input
              type="text"
              value={broadcastText}
              onChange={e => setBroadcastText(e.target.value)}
              placeholder="Текст сообщения для всех игроков..."
              className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-purple-400"
            />
            <button
              type="submit"
              className="px-3 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs active:scale-95 transition-all flex items-center gap-1"
            >
              <Megaphone className="w-3.5 h-3.5" />
              <span>Отправить</span>
            </button>
          </form>
        </div>

        {/* Telegram Profile Switcher for Testing */}
        <div className="space-y-1.5">
          <span className="text-[11px] font-mono text-purple-400 uppercase tracking-wider block">
            Тестирование Telegram Mini App профилей:
          </span>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <button
              onClick={() => switchMockUser('Теневой Странник')}
              className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-white"
            >
              Странник (Default)
            </button>
            <button
              onClick={() => switchMockUser('Архимаг Элириан')}
              className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-white"
            >
              Архимаг (VIP)
            </button>
            <button
              onClick={() => switchMockUser('Берсерк Торвальд')}
              className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-white"
            >
              Берсерк
            </button>
            <button
              onClick={() => switchMockUser('Lord Administrator')}
              className="p-2 rounded-lg bg-purple-950/60 border border-purple-800 text-purple-300"
            >
              Администратор
            </button>
          </div>
        </div>

        {/* Destructive Actions */}
        <div className="pt-2 border-t border-slate-800">
          <button
            onClick={() => {
              if (confirm('Сбросить весь прогресс и начать заново?')) {
                resetCharacter();
                onClose();
              }
            }}
            className="w-full py-2.5 rounded-xl bg-red-950/80 border border-red-500/50 hover:bg-red-900 text-red-200 font-bold text-xs flex items-center justify-center gap-1.5 active:scale-95 transition-all"
          >
            <Trash2 className="w-4 h-4" />
            <span>Сбросить персонажа (Полный вайп)</span>
          </button>
        </div>
      </div>
    </div>
  );
};
