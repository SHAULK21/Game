import React, { useEffect, useState } from 'react';
import { useGame } from '../../context/GameContext';
import { MINING_NODES } from '../../data/gameData';
import { Pickaxe, Clock3, Crown, PackageCheck } from 'lucide-react';
import { RpgIcon } from '../ui/RpgIcon';

const EXPEDITIONS = [
  {
    hours: 1 as const,
    title: 'Короткая смена',
    description: 'Базовая руда и простые материалы.',
    finds: ['Уголь', 'Медь', 'Железо', 'Трава', 'Чистая вода']
  },
  {
    hours: 3 as const,
    title: 'Глубокая выработка',
    description: 'Больше руды, шанс серебра, корней и лунной пыльцы.',
    finds: ['Железо', 'Серебро', 'Горный корень', 'Лунная пыльца', 'Самоцвет']
  },
  {
    hours: 7 as const,
    title: 'Дальняя экспедиция',
    description: 'Самая богатая добыча и повышенный шанс редких материалов.',
    finds: ['Золото', 'Мифрил', 'Самоцвет', 'Эссенция', 'Адамантит/Драконит по уровню']
  }
];

const formatRemaining = (ms: number) => {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};

export const MiningScreen: React.FC = () => {
  const {
    player,
    premium,
    mineNode,
    startMiningExpedition,
    claimMiningExpedition,
    leaveMiningExpedition
  } = useGame();

  const [activeMiningNodeId, setActiveMiningNodeId] = useState<string | null>(null);
  const [miningLog, setMiningLog] = useState<string[]>([]);
  const [isMining, setIsMining] = useState<boolean>(false);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  if (!player) return null;

  const expedition = player.miningExpedition;
  const expeditionReady = Boolean(expedition && now >= expedition.endsAt);
  const remainingMs = expedition ? Math.max(0, expedition.endsAt - now) : 0;

  const unlockedOres = MINING_NODES.filter(node => player.miningLevel >= node.levelReq);

  const handleMine = (nodeId: string) => {
    if (isMining || !premium.active || expedition) return;
    setIsMining(true);
    setActiveMiningNodeId(nodeId);

    setTimeout(() => {
      const res = mineNode(nodeId);
      if (res.success) {
        setMiningLog(prev => [
          res.isCrit
            ? `⚡ КРИТИЧЕСКАЯ ДОБЫЧА! Получено ${res.yieldCount} ед. [${res.oreName}]!`
            : `⛏️ Получено ${res.yieldCount} ед. [${res.oreName}].`,
          ...prev.slice(0, 8)
        ]);
      } else {
        setMiningLog(prev => [
          `❌ Не удалось добыть: ${res.oreName || 'недостаточно энергии шахты, уровня или места в сумке'}.`,
          ...prev.slice(0, 8)
        ]);
      }
      setIsMining(false);
      setActiveMiningNodeId(null);
    }, 600);
  };

  const handleStartExpedition = (hours: 1 | 3 | 7) => {
    const result = startMiningExpedition(hours);
    setMiningLog(prev => [result.success ? `🕯️ ${result.message}` : `❌ ${result.message}`, ...prev.slice(0, 8)]);
  };

  const handleClaimExpedition = () => {
    const result = claimMiningExpedition();
    setMiningLog(prev => [result.success ? `📦 ${result.message}` : `❌ ${result.message}`, ...prev.slice(0, 8)]);
  };

  return (
    <div className="p-3 space-y-4 max-w-lg mx-auto pb-24">
      <div className="rounded-2xl border border-amber-500/30 bg-gradient-to-b from-[#18110b] to-[#0a0f1d] p-4 shadow-xl">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-2.5 rounded-xl bg-amber-950/60 border border-amber-400/40 text-amber-400">
              <Pickaxe className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <h2 className="font-cinzel text-base font-bold text-slate-100">Королевские Рудники</h2>
              <div className="text-[11px] font-mono text-slate-400">
                Горное дело: <span className="text-amber-300 font-bold">{player.miningLevel} ур.</span>
              </div>
            </div>
          </div>
          <div className="text-right shrink-0">
            <span className="text-[10px] font-mono text-slate-400 block">Энергия шахты</span>
            <span className="text-xs font-mono text-emerald-300 font-bold">{player.stamina}/{player.maxStamina}</span>
          </div>
        </div>

        <div className="mt-3 rounded-xl border border-slate-800 bg-black/20 p-2.5 text-[10px] text-slate-400">
          {premium.active
            ? '👑 Premium: офлайн-добыча работает автоматически. Ручная добыча доступна всегда.'
            : 'Обычная ручная добыча доступна всегда. Для офлайн-добычи запустите экспедицию на 1, 3 или 7 часов.'}
        </div>
      </div>

      <div className="rounded-2xl border border-cyan-500/25 bg-[#0a0f1d] p-3">
        <div className="flex items-center gap-2 mb-3">
          <Clock3 className="w-4 h-4 text-cyan-300" />
          <div>
            <div className="text-xs font-bold text-cyan-200">Шахтёрская экспедиция</div>
            <div className="text-[10px] text-slate-500">Во время экспедиции ручная добыча недоступна. Если уйти раньше, сохранится часть уже добытых ресурсов.</div>
          </div>
        </div>

        {expedition ? (
          <div className={`rounded-xl border p-3 ${expeditionReady ? 'border-emerald-500/40 bg-emerald-950/20' : 'border-cyan-500/30 bg-cyan-950/10'}`}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-xs font-bold text-slate-100">
                  Экспедиция на {expedition.durationHours} ч.
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  {expeditionReady ? 'Группа вернулась с добычей.' : 'Персонаж работает в шахте.'}
                </div>
              </div>
              <div className={`font-mono text-sm font-bold ${expeditionReady ? 'text-emerald-300' : 'text-cyan-300'}`}>
                {expeditionReady ? 'ГОТОВО' : formatRemaining(remainingMs)}
              </div>
            </div>

            {expeditionReady ? (
              <div className="mt-2 flex flex-wrap gap-1">
                {(expedition.rewards || []).map(reward => (
                  <span key={reward.name} className="px-1.5 py-1 rounded-lg border border-slate-700 bg-slate-950 text-[9px] text-slate-300">
                    {reward.icon} {reward.name} ×{reward.count}
                  </span>
                ))}
              </div>
            ) : (
              <div className="mt-2 rounded-lg border border-slate-800 bg-slate-950/70 p-2 text-[10px] text-slate-500">
                Состав полной добычи будет известен после возвращения. При досрочном выходе сохранится часть ресурсов по уже отработанному времени.
              </div>
            )}

            {expeditionReady && (
              <button
                onClick={handleClaimExpedition}
                className="mt-3 w-full py-2.5 rounded-xl bg-emerald-600 text-white font-bold text-xs flex items-center justify-center gap-2 active:scale-95"
              >
                <PackageCheck className="w-4 h-4" />
                Забрать добычу
              </button>
            )}

            {!expeditionReady && (
              <button
                onClick={() => {
                  const result = leaveMiningExpedition();
                  setMiningLog(prev => [result.success ? `🚪 ${result.message}` : `❌ ${result.message}`, ...prev.slice(0, 8)]);
                }}
                className="mt-2 w-full py-2.5 rounded-xl bg-rose-950/60 border border-rose-500/40 text-rose-200 font-bold text-xs active:scale-95 transition-all"
              >
                Уйти с шахты
              </button>
            )}
          </div>
        ) : premium.active ? (
          <div className="rounded-xl border border-yellow-500/25 bg-yellow-950/10 p-3 text-center">
            <Crown className="w-5 h-5 mx-auto text-yellow-300 mb-1" />
            <div className="text-xs font-bold text-yellow-200">Экспедицию запускать не нужно</div>
            <div className="text-[10px] text-slate-500 mt-1">Premium автоматически добывает ресурсы, пока вы офлайн.</div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-2">
            {EXPEDITIONS.map(option => (
              <button
                key={option.hours}
                onClick={() => handleStartExpedition(option.hours)}
                className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-left hover:border-cyan-500/40 active:scale-[0.99] transition-all"
              >
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="text-xs font-bold text-slate-100">{option.title}</div>
                    <div className="text-[10px] text-slate-500">{option.description}</div>
                  </div>
                  <span className="shrink-0 px-2 py-1 rounded-lg bg-cyan-950 border border-cyan-500/30 text-cyan-300 font-mono text-xs font-bold">
                    {option.hours} ч.
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {option.finds.map(find => (
                    <span key={find} className="text-[9px] px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-400">
                      {find}
                    </span>
                  ))}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {miningLog.length > 0 && (
        <div className="rounded-xl border border-slate-800 bg-[#070912] p-2.5 space-y-1 font-mono text-[11px]">
          {miningLog.map((log, idx) => (
            <div key={idx} className={log.startsWith('❌') ? 'text-rose-300' : 'text-slate-300'}>{log}</div>
          ))}
        </div>
      )}

      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <div className="text-xs font-mono text-amber-400 uppercase tracking-wider">Ручная добыча</div>
          <span className="text-[9px] text-slate-500">Для всех игроков</span>
        </div>

        <div className="space-y-2">
          {unlockedOres.map(node => {
            const isCurrentlyMining = isMining && activeMiningNodeId === node.id;
            return (
              <div key={node.id} className="p-3 rounded-xl border border-slate-800 bg-[#0a0f1d] flex items-center justify-between gap-2">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="p-2 bg-slate-900 rounded-lg border border-slate-800">
                    <RpgIcon kind="ore" size={28} className="text-amber-300" />
                  </span>
                  <div className="min-w-0">
                    <span className="font-cinzel text-xs font-bold text-slate-100">{node.name}</span>
                    <div className="text-[10px] font-mono text-slate-400 mt-0.5">
                      {node.oreYield} ×{node.baseYieldMin}-{node.baseYieldMax} · ⛏ {node.staminaCost}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => handleMine(node.id)}
                  disabled={isMining || player.stamina < node.staminaCost}
                  className="px-3 py-1.5 rounded-lg bg-amber-600 disabled:opacity-35 disabled:cursor-not-allowed font-bold text-xs text-slate-950 active:scale-95"
                >
                  {isCurrentlyMining ? 'Добыча…' : 'Добывать'}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
