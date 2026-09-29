import React, { useState } from 'react';
import { useGame } from '../../context/GameContext';
import { 
  Scroll, 
  Trophy, 
  BarChart2, 
  Store, 
  Crown, 
  ShieldAlert, 
  Check, 
  Sparkles,
  Coins
} from 'lucide-react';
import { sound } from '../../utils/audio';
import { getTelegramUser } from '../../utils/telegram';

interface MoreMenuScreenProps {
  onOpenAdmin: () => void;
}

export const MoreMenuScreen: React.FC<MoreMenuScreenProps> = ({ onOpenAdmin }) => {
  const { player, quests, achievements, claimQuestReward, claimAchievementReward } = useGame();
  const [activeSection, setActiveSection] = useState<'quests' | 'achievements' | 'stats' | 'leaderboard'>('quests');

  if (!player) return null;
  const adminTelegramId = import.meta.env.VITE_ADMIN_TELEGRAM_ID || '';
  const isAdmin = adminTelegramId && String(getTelegramUser().id) === String(adminTelegramId);

  return (
    <div className="p-3 space-y-4 max-w-lg mx-auto pb-24">
      {/* Navigation Sub-Tabs */}
      <div className="grid grid-cols-4 gap-1.5 text-xs font-cinzel font-bold">
        <button
          onClick={() => setActiveSection('quests')}
          className={`py-2 px-1 text-center rounded-lg border transition-all ${
            activeSection === 'quests'
              ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-sm'
              : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
          }`}
        >
          Квесты
        </button>

        <button
          onClick={() => setActiveSection('achievements')}
          className={`py-2 px-1 text-center rounded-lg border transition-all ${
            activeSection === 'achievements'
              ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-sm'
              : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
          }`}
        >
          Достижения
        </button>

        <button
          onClick={() => setActiveSection('stats')}
          className={`py-2 px-1 text-center rounded-lg border transition-all ${
            activeSection === 'stats'
              ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-sm'
              : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
          }`}
        >
          Статистика
        </button>

        <button
          onClick={() => setActiveSection('leaderboard')}
          className={`py-2 px-1 text-center rounded-lg border transition-all ${
            activeSection === 'leaderboard'
              ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-sm'
              : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
          }`}
        >
          Рейтинг
        </button>
      </div>

      {/* QUESTS SECTION */}
      {activeSection === 'quests' && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-mono text-amber-300 px-1">
            <span>Журнал заданий:</span>
            <span>{quests.filter(q => q.completed && !q.claimed).length} готово к сдаче</span>
          </div>

          <div className="space-y-2">
            {quests.map(q => {
              const pct = Math.min(100, Math.round((q.currentCount / q.targetCount) * 100));
              return (
                <div
                  key={q.id}
                  className={`p-3 rounded-xl border transition-all ${
                    q.completed && !q.claimed
                      ? 'border-amber-400 bg-amber-950/30'
                      : 'border-slate-800 bg-[#0a0f1d]'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-cinzel text-xs font-bold text-slate-100">
                          {q.title}
                        </span>
                        <span className="text-[10px] font-mono px-1 rounded bg-slate-900 text-slate-400 border border-slate-800">
                          {q.category}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        {q.description}
                      </p>
                    </div>

                    {q.completed ? (
                      q.claimed ? (
                        <span className="text-[10px] font-mono text-slate-500 font-bold px-2 py-1 bg-slate-900 rounded">
                          Сдано
                        </span>
                      ) : (
                        <button
                          onClick={() => claimQuestReward(q.id)}
                          className="px-2.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs active:scale-95 transition-all shadow-md shadow-amber-950 animate-bounce"
                        >
                          Забрать
                        </button>
                      )
                    ) : (
                      <span className="text-[10px] font-mono text-cyan-400">
                        {q.currentCount}/{q.targetCount}
                      </span>
                    )}
                  </div>

                  {/* Rewards preview */}
                  <div className="flex items-center gap-3 mt-2 pt-2 border-t border-slate-800/60 text-[10px] font-mono text-slate-400">
                    <span>Награда:</span>
                    <span className="text-amber-300 font-bold">+{q.rewardGold} 🪙</span>
                    <span className="text-slate-300 font-bold">+{q.rewardSilver || 0} 🥈</span>
                    <span className="text-indigo-300 font-bold">+{q.rewardExp} EXP</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ACHIEVEMENTS SECTION */}
      {activeSection === 'achievements' && (
        <div className="space-y-2">
          <div className="text-xs font-mono text-amber-300 px-1">
            Постоянные достижения:
          </div>

          <div className="space-y-2">
            {achievements.map(ach => (
              <div
                key={ach.id}
                className="p-3 rounded-xl border border-slate-800 bg-[#0a0f1d] flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl p-2 bg-slate-900 rounded-lg border border-slate-800">
                    {ach.icon}
                  </span>
                  <div>
                    <span className="font-cinzel text-xs font-bold text-slate-100">
                      {ach.title}
                    </span>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {ach.description}
                    </p>
                    <div className="text-[10px] font-mono text-emerald-400 mt-1">
                      {ach.permanentBonusDesc}
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  {ach.completed && !ach.claimed ? (
                    <button
                      onClick={() => claimAchievementReward(ach.id)}
                      className="text-[10px] font-mono text-amber-300 font-bold px-2 py-1 bg-amber-950/60 border border-amber-500/40 rounded"
                    >
                      Забрать
                    </button>
                  ) : ach.claimed ? (
                    <span className="text-[10px] font-mono text-emerald-400 font-bold px-2 py-1 bg-emerald-950/60 border border-emerald-500/40 rounded">
                      Получено
                    </span>
                  ) : (
                    <span className="text-[10px] font-mono text-slate-500">
                      {ach.progress}/{ach.maxProgress}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* STATS SECTION */}
      {activeSection === 'stats' && (
        <div className="rounded-xl border border-slate-800 bg-[#0a0f1d] p-4 space-y-3">
          <span className="font-cinzel text-xs font-bold text-cyan-300 uppercase tracking-wider block border-b border-slate-800 pb-2">
            Статистика учетной записи:
          </span>

          <div className="space-y-2 text-xs font-mono">
            <div className="flex justify-between py-1 border-b border-slate-900">
              <span className="text-slate-400">Убито монстров:</span>
              <span className="text-slate-100 font-bold">{player.statsSummary.monstersKilled}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-900">
              <span className="text-slate-400">Побеждено боссов:</span>
              <span className="text-amber-400 font-bold">{player.statsSummary.bossesDefeated}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-900">
              <span className="text-slate-400">Побед в боях:</span>
              <span className="text-emerald-400 font-bold">{player.statsSummary.battlesWon}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-900">
              <span className="text-slate-400">Добыто руды в шахтах:</span>
              <span className="text-cyan-400 font-bold">{player.statsSummary.oresMined}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-900">
              <span className="text-slate-400">Сварено зелий:</span>
              <span className="text-purple-400 font-bold">{player.statsSummary.potionsCrafted}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-900">
              <span className="text-slate-400">Макс. уровень заточки:</span>
              <span className="text-yellow-400 font-bold">+{player.statsSummary.maxUpgradeReached}</span>
            </div>
          </div>
        </div>
      )}

      {/* LEADERBOARD SECTION */}
      {activeSection === 'leaderboard' && (
        <div className="rounded-xl border border-slate-800 bg-[#0a0f1d] p-5 text-center">
          <Trophy className="w-8 h-8 mx-auto text-amber-400 mb-2" />
          <div className="font-cinzel text-sm font-bold text-slate-200">Рейтинг игроков</div>
          <p className="text-[10px] text-slate-500 mt-1">
            Глобальный рейтинг будет показываться только из серверной базы. Тестовые персонажи больше не используются.
          </p>
        </div>
      )}

      {/* Admin Button */}
      {isAdmin && (
        <div className="pt-2">
        <button
          onClick={onOpenAdmin}
          className="w-full py-2.5 px-3 rounded-xl bg-purple-950/60 border border-purple-500/40 text-purple-300 font-cinzel font-bold text-xs flex items-center justify-center gap-2 hover:bg-purple-900/60 active:scale-95 transition-all"
        >
          <ShieldAlert className="w-4 h-4 text-purple-400" />
          <span>Панель Администратора</span>
        </button>
        </div>
      )}
    </div>
  );
};
