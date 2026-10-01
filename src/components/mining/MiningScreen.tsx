import {miningYield} from '../../utils/gameCadence';
import React, { useEffect, useState } from 'react';
import { useGame } from '../../context/GameContext';
import { MINING_NODES } from '../../data/gameData';
import { Clock3, Crown, PackageCheck, Pickaxe, Sparkles } from 'lucide-react';
import { getResourceArtwork } from '../../utils/resourceArtwork';

const EXPEDITIONS = [
  { hours: 1 as const, title: 'Короткая смена', description: 'Базовая руда и простые материалы.' },
  { hours: 3 as const, title: 'Глубокая выработка', description: 'Больше ресурсов и повышенный шанс редких материалов.' },
  { hours: 7 as const, title: 'Дальняя экспедиция', description: 'Максимальная офлайн-добыча и лучший шанс редких находок.' }
];

const NODE_MATERIALS: Record<string, string[]> = {
  ore_coal: ['Каменная пыль', 'Кварц'],
  ore_copper: ['Кварц', 'Медный кристалл'],
  ore_iron: ['Соляной кристалл', 'Магнетит', 'Железный пирит'],
  ore_silver: ['Осколок лунного камня', 'Лунная пыльца', 'Серебряная нить'],
  ore_gold: ['Янтарный кристалл', 'Сырой самоцвет', 'Золотая слюда'],
  ore_cobalt: ['Синяя кристаллическая пыль', 'Рунический осколок', 'Кобальтовая призма'],
  ore_mithril: ['Арканная пыль', 'Магическая эссенция', 'Мифриловый шёлк'],
  ore_adamantite: ['Руническое ядро', 'Осколок титана', 'Адамантовый зубец'],
  ore_blood_obsidian: ['Демонический уголь', 'Кровавый кристалл', 'Пепел Бездны'],
  ore_draconite: ['Осколок драконьей чешуи', 'Драконья искра', 'Сердце драконида'],
  ore_aetherium: ['Эфирная пыль', 'Звёздное ядро', 'Небесная слеза', 'Осколок вечности']
};

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
  const [isMining, setIsMining] = useState(false);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  if (!player) return null;

  const expedition = player.miningExpedition;
  const expeditionReady = Boolean(expedition && now >= expedition.endsAt);
  const remainingMs = expedition ? Math.max(0, expedition.endsAt - now) : 0;
  const visibleNodes = MINING_NODES;
  const nextNode = MINING_NODES.find(node => node.levelReq > player.miningLevel);
  const previousLevelExp = Math.max(0, (player.miningLevel - 1) * 175);
  const nextLevelExp = Math.max(175, player.miningLevel * 175);
  const currentLevelExp = Math.max(0, player.miningExp - previousLevelExp);
  const currentLevelNeed = Math.max(175, nextLevelExp - previousLevelExp);
  const levelProgress = Math.min(100, Math.round((currentLevelExp / currentLevelNeed) * 100));

  const handleMine = (nodeId: string) => {
    if (isMining) return;
    setIsMining(true);
    setActiveMiningNodeId(nodeId);

    window.setTimeout(() => {
      const result = mineNode(nodeId);
      setMiningLog(prev => [
        result.success
          ? `${result.isCrit ? '⚡ КРИТ! ' : '⛏️ '}Получено: ${result.yieldCount} × ${result.oreName}`
          : `❌ Не удалось добыть: ${result.oreName || 'проверьте уровень, энергию шахты и место в рюкзаке'}.`,
        ...prev.slice(0, 8)
      ]);
      setIsMining(false);
      setActiveMiningNodeId(null);
    }, 500);
  };

  const handleClaim = () => {
    const result = claimMiningExpedition();
    setMiningLog(prev => [result.success ? `📦 ${result.message}` : `❌ ${result.message}`, ...prev.slice(0, 8)]);
  };

  return (
    <div className="p-3 space-y-4 max-w-lg mx-auto pb-24">
      <div className="ui-panel rounded-2xl border p-4">
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

        <div className="mt-3">
          <div className="flex items-center justify-between text-[9px] font-mono text-slate-500">
            <span>Опыт шахтёра: {currentLevelExp}/{currentLevelNeed}</span>
            <span>{levelProgress}%</span>
          </div>
          <div className="mt-1 h-2 rounded-full bg-slate-900 overflow-hidden border border-slate-800">
            <div className="h-full bg-gradient-to-r from-amber-700 to-yellow-400" style={{ width: `${levelProgress}%` }} />
          </div>
          {nextNode && (
            <div className="mt-1 text-[9px] text-slate-500">
              Следующая жила: <span className="text-slate-300">{nextNode.name}</span> с {nextNode.levelReq} ур.
            </div>
          )}
        </div>
      </div>

      {/* Manual extraction first */}
      <div className="space-y-2">
        <div className="px-1">
          <div className="text-xs font-mono text-amber-400 uppercase tracking-wider">Ручная добыча</div>
          <div className="text-[10px] text-slate-500">Доступна всем игрокам. Кроме руды можно найти дополнительные материалы.</div>
        </div>

        {visibleNodes.map(node => {
          const mining = isMining && activeMiningNodeId === node.id;
          const locked = player.miningLevel < node.levelReq;
          return (
            <div key={node.id} className={`p-3 rounded-xl border ${locked ? 'border-slate-800/70 bg-slate-950/50 opacity-70' : 'border-slate-800 bg-[#0a0f1d]'}`}>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="p-2 bg-slate-900 rounded-lg border border-slate-800">
                    <img src={getResourceArtwork(node.oreYield, 'ore')} alt={node.oreYield} width={28} height={28} />
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="font-cinzel text-xs font-bold text-slate-100">{node.name}</div>
                      {locked && <span className="text-[8px] rounded border border-rose-500/30 bg-rose-950/30 px-1.5 py-0.5 font-bold text-rose-300">🔒 {node.levelReq} ур.</span>}
                    </div>
                    <div className="text-[10px] font-mono text-slate-400 mt-0.5">
                      {node.oreYield} ×{miningYield(node.baseYieldMin)}-{miningYield(node.baseYieldMax)} · ⛏ {node.staminaCost}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => handleMine(node.id)}
                  disabled={locked || isMining || player.stamina < node.staminaCost}
                  className="px-3 py-1.5 rounded-lg bg-amber-600 disabled:opacity-35 text-slate-950 font-bold text-xs active:scale-95"
                >
                  {locked ? `С ${node.levelReq} ур.` : mining ? 'Добыча…' : 'Добывать'}
                </button>
              </div>

              {(NODE_MATERIALS[node.id] || []).length > 0 && (
                <div className="mt-2 flex items-start gap-1.5">
                  <Sparkles className="w-3 h-3 text-purple-300 shrink-0 mt-0.5" />
                  <div className="flex flex-wrap gap-1">
                    {(NODE_MATERIALS[node.id] || []).map(material => (
                      <span key={material} className="text-[9px] px-1.5 py-0.5 rounded border border-purple-500/20 bg-purple-950/20 text-purple-200">
                        <img src={getResourceArtwork(material, 'material')} alt="" width={18} height={18} className="inline-block mr-1 align-middle" />{material}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {miningLog.length > 0 && (
        <div className="rounded-xl border border-slate-800 bg-[#070912] p-2.5 space-y-1 font-mono text-[11px]">
          {miningLog.map((log, index) => (
            <div key={index} className={log.startsWith('❌') ? 'text-rose-300' : 'text-slate-300'}>{log}</div>
          ))}
        </div>
      )}

      {/* Offline expedition second */}
      <div className="rounded-2xl border border-cyan-500/25 bg-[#0a0f1d] p-3">
        <div className="flex items-center gap-2 mb-3">
          <Clock3 className="w-4 h-4 text-[#d5ba89]" />
          <div>
            <div className="text-xs font-bold text-cyan-200">Офлайн-экспедиция</div>
            <div className="text-[10px] text-slate-500">
              {premium.active
                ? 'Premium добывает ресурсы офлайн автоматически — запускать экспедицию не нужно.'
                : 'Для обычного аккаунта экспедицию нужно запустить перед выходом из игры.'}
            </div>
          </div>
        </div>

        {expedition ? (
          <div className={`rounded-xl border p-3 ${expeditionReady ? 'border-emerald-500/40 bg-emerald-950/20' : 'border-slate-700 bg-cyan-950/10'}`}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-xs font-bold text-slate-100">Экспедиция на {expedition.durationHours} ч.</div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  Ручная добыча доступна параллельно, но бой заблокирован до выхода из экспедиции.
                </div>
              </div>
              <div className={`font-mono text-sm font-bold ${expeditionReady ? 'text-emerald-300' : 'text-[#d5ba89]'}`}>
                {expeditionReady ? 'ГОТОВО' : formatRemaining(remainingMs)}
              </div>
            </div>

            {expeditionReady && (
              <div className="mt-2 flex flex-wrap gap-1">
                {expedition.rewards.map(reward => (
                  <span key={reward.name} className="px-1.5 py-1 rounded-lg border border-slate-700 bg-slate-950 text-[9px] text-slate-300">
                    {reward.icon} {reward.name} ×{reward.count}
                  </span>
                ))}
              </div>
            )}

            {expeditionReady ? (
              <button onClick={handleClaim} className="mt-3 w-full py-2.5 rounded-xl bg-emerald-600 text-white font-bold text-xs flex items-center justify-center gap-2">
                <PackageCheck className="w-4 h-4" /> Забрать добычу
              </button>
            ) : (
              <button
                onClick={() => {
                  const result = leaveMiningExpedition();
                  setMiningLog(prev => [result.success ? `🚪 ${result.message}` : `❌ ${result.message}`, ...prev.slice(0, 8)]);
                }}
                className="mt-3 w-full py-2.5 rounded-xl bg-rose-950/60 border border-rose-500/40 text-rose-200 font-bold text-xs"
              >
                Уйти с шахты
              </button>
            )}
          </div>
        ) : premium.active ? (
          <div className="rounded-xl border border-yellow-500/25 bg-yellow-950/10 p-3 text-center">
            <Crown className="w-5 h-5 mx-auto text-yellow-300 mb-1" />
            <div className="text-xs font-bold text-yellow-200">Автоматическая Premium-добыча активна</div>
            <div className="text-[10px] text-slate-500 mt-1">Просто закройте игру — ресурсы будут рассчитаны при возвращении.</div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-2">
            {EXPEDITIONS.map(option => (
              <button
                key={option.hours}
                onClick={() => {
                  const result = startMiningExpedition(option.hours);
                  setMiningLog(prev => [result.success ? `🕯️ ${result.message}` : `❌ ${result.message}`, ...prev.slice(0, 8)]);
                }}
                className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-left hover:border-cyan-500/40 active:scale-[0.99]"
              >
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="text-xs font-bold text-slate-100">{option.title}</div>
                    <div className="text-[10px] text-slate-500">{option.description}</div>
                  </div>
                  <span className="px-2 py-1 rounded-lg bg-cyan-950 border border-slate-700 text-[#d5ba89] font-mono text-xs font-bold">
                    {option.hours} ч.
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
