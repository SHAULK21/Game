import { t as localize, useLocale, intlLocale } from '../../i18n/locale';
import {PICKAXES,getPickaxeBonus,miningCritChance,miningYieldRange} from '../../utils/mining';
import {ItemArtwork} from '../ui/ItemArtwork';
import {RARITY_COLORS} from '../../data/gameData';
import React, { useEffect, useRef, useState } from 'react';
import { useGame } from '../../context/GameContext';
import { MINING_NODES } from '../../data/gameData';
import { Clock3, Crown, PackageCheck, Pickaxe, Sparkles } from 'lucide-react';

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
  useLocale();
  const {
    player,
    premium,
    achievements,
    mineNode,
    buyPickaxe,
    equipItem,
    unequipItem,
    startMiningExpedition,
    claimMiningExpedition,
    leaveMiningExpedition
  } = useGame();

  const [activeMiningNodeId, setActiveMiningNodeId] = useState<string | null>(null);
  const [miningLog, setMiningLog] = useState<string[]>([]);
  const [isMining, setIsMining] = useState(false);
  const miningLock = useRef(false);
  const miningTimer = useRef<number | null>(null);
  useEffect(() => () => { if (miningTimer.current !== null) window.clearTimeout(miningTimer.current); }, []);
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
    if (miningLock.current) return;
    miningLock.current = true;
    setIsMining(true);
    setActiveMiningNodeId(nodeId);
    // Complete the action in the click event. Embedded desktop clients can
    // throttle delayed callbacks; the timer only controls the visual cooldown.
    try {
      const result = mineNode(nodeId);
      setMiningLog(prev => [
        result.success
          ? `${result.isCrit ? '⚡ КРИТ! ' : '⛏️ '}Получено: ${result.yieldCount} × ${result.oreName}`
          : `❌ Не удалось добыть: ${result.oreName || 'проверьте уровень, энергию шахты и место в рюкзаке'}.`,
        ...prev.slice(0, 8)
      ]);
    } catch (error) {
      setMiningLog(prev => [`❌ Ошибка добычи: ${error instanceof Error ? error.message : 'попробуйте снова'}.`, ...prev.slice(0, 8)]);
    } finally {
      miningTimer.current = window.setTimeout(() => {
        miningLock.current = false;
        setIsMining(false);
        setActiveMiningNodeId(null);
        miningTimer.current = null;
      }, 500);
    }
  };

  const handleClaim = () => {
    const result = claimMiningExpedition();
    setMiningLog(prev => [result.success ? `📦 ${result.message}` : `❌ ${result.message}`, ...prev.slice(0, 8)]);
  };

  return (
    <div className="p-3 space-y-4 max-w-lg mx-auto pb-24">
      <div className="ui-panel rounded-2xl border p-3 space-y-2">
        <h3 className="text-sm font-bold text-amber-200">{localize("⛏️ Кирка для шахты")}</h3>
        <p className="text-[10px] text-slate-400">{localize("Отдельный слот. Бонусы работают при ручной добыче. Максимум жилы — редкий крит; Обычная добыча зависит от жилы.")}</p>
        {player.equipped.pickaxe ? <div className="flex items-center gap-2 text-xs"><ItemArtwork item={player.equipped.pickaxe} size={36}/><div className="flex-1">{localize(player.equipped.pickaxe.name)}<div className="text-[10px] text-emerald-300">+{localize(getPickaxeBonus(player.equipped.pickaxe)?.critBonus||0)}{localize(" п.п. крита · +")}{localize(getPickaxeBonus(player.equipped.pickaxe)?.expBonus||0)}{localize("% опыта")}</div></div><button disabled={isMining || player.inventory.length>=player.maxInventorySlots} onClick={async()=>{const result=await unequipItem('pickaxe');setMiningLog(prev=>[result.message,...prev].slice(0,8));}} className="text-slate-400 disabled:opacity-40">{localize("Снять")}</button></div> : <p className="text-xs text-slate-500">{localize("Кирка не экипирована")}</p>}
        {player.inventory.filter(i=>i.type==='pickaxe').map(item=><div key={item.id} className="flex items-center gap-2 text-xs"><ItemArtwork item={item} size={30}/><span className="flex-1">{localize(item.name)}</span><button disabled={isMining} onClick={async()=>{const result=await equipItem(item);setMiningLog(prev=>[result.message,...prev].slice(0,8));}} className="text-cyan-300">{localize("Экипировать")}</button></div>)}
        <details><summary className="text-xs text-amber-300 cursor-pointer">{localize("Купить кирку · 5 редкостей")}</summary><div className="mt-2 space-y-2">{PICKAXES.map(offer=><div key={offer.id} className="rounded-lg bg-slate-950 p-2 flex items-center gap-2"><div className="flex-1"><div className={`text-xs ${RARITY_COLORS[offer.rarity].text}`}>{localize(offer.name)} · {localize(RARITY_COLORS[offer.rarity].label)}</div><div className="text-[10px] text-slate-400">{localize("Шахта ")}{localize(offer.miningLevel)}{localize(" ур. · +")}{localize(offer.critBonus)}{localize(" п.п. крита · +")}{localize(offer.expBonus)}{localize("% опыта")}</div></div><button disabled={isMining || player.miningLevel<offer.miningLevel || player.gold<offer.price || player.inventory.length>=player.maxInventorySlots} onClick={()=>{const result=buyPickaxe(offer.id);setMiningLog(prev=>[result.message,...prev].slice(0,8));}} className="text-[10px] text-amber-300 disabled:opacity-40">{localize(player.miningLevel<offer.miningLevel ? `С ${offer.miningLevel} ур.` : `${offer.price.toLocaleString(intlLocale())} 🪙`)}</button></div>)}</div></details>
      </div>
      <div className="ui-panel rounded-2xl border p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-2.5 rounded-xl bg-amber-950/60 border border-amber-400/40 text-amber-400">
              <Pickaxe className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <h2 className="font-cinzel text-base font-bold text-slate-100">{localize("Королевские Рудники")}</h2>
              <div className="text-[11px] font-mono text-slate-400">{localize("Горное дело: ")}<span className="text-amber-300 font-bold">{localize(player.miningLevel)}{localize(" ур.")}</span>
              </div>
            </div>
          </div>
          <div className="text-right shrink-0">
            <span className="text-[10px] font-mono text-slate-400 block">{localize("Энергия шахты")}</span>
            <span className="text-xs font-mono text-emerald-300 font-bold">{localize(player.stamina)}/{localize(player.maxStamina)}</span>
          </div>
        </div>

        <div className="mt-3">
          <div className="flex items-center justify-between text-[9px] font-mono text-slate-500">
            <span>{localize("Опыт шахтёра: ")}{localize(currentLevelExp)}/{localize(currentLevelNeed)}</span>
            <span>{localize(levelProgress)}%</span>
          </div>
          <div className="mt-1 h-2 rounded-full bg-slate-900 overflow-hidden border border-slate-800">
            <div className="h-full bg-gradient-to-r from-amber-700 to-yellow-400" style={{ width: `${levelProgress}%` }} />
          </div>
          {nextNode && (
            <div className="mt-1 text-[9px] text-slate-500">{localize("Следующая жила: ")}<span className="text-slate-300">{localize(nextNode.name)}</span>{localize(" с ")}{localize(nextNode.levelReq)}{localize(" ур.")}</div>
          )}
        </div>
      </div>

      {/* Manual extraction first */}
      <div className="space-y-2">
        <div className="px-1">
          <div className="text-xs font-mono text-amber-400 uppercase tracking-wider">{localize("Ручная добыча")}</div>
          <div className="text-[10px] text-slate-500">{localize("Доступна всем игрокам. Кроме руды можно найти дополнительные материалы.")}</div>
        </div>

        {visibleNodes.map(node => {
          const mining = isMining && activeMiningNodeId === node.id;
          const locked = player.miningLevel < node.levelReq;
          return (
            <div key={node.id} className={`p-3 rounded-xl border ${locked ? 'border-slate-800/70 bg-slate-950/50 opacity-70' : 'border-slate-800 bg-[#0a0f1d]'}`}>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="p-2 bg-slate-900 rounded-lg border border-slate-800">
                    <ItemArtwork item={{name:node.oreYield,type:'ore',rarity:'common',icon:node.icon}} size={32} />
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="font-cinzel text-xs font-bold text-slate-100">{localize(node.name)}</div>
                      {locked && <span className="text-[8px] rounded border border-rose-500/30 bg-rose-950/30 px-1.5 py-0.5 font-bold text-rose-300">🔒 {localize(node.levelReq)}{localize(" ур.")}</span>}
                    </div>
                    <div className="text-[10px] font-mono text-slate-400 mt-0.5">
                      {localize(node.oreYield)} ×{localize(node.baseYieldMin)}–{localize(node.baseYieldMax)} ({localize(node.baseYieldMax)}{localize(" — крит) · ⛏ ")}{localize(node.staminaCost)}{localize(" · крит ")}{localize((miningCritChance(node.levelReq,player.equipped.pickaxe,player.attributes.luck,achievements.some(a=>a.id==='ach_4'&&a.claimed))*100).toFixed(2))}%
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => handleMine(node.id)}
                  disabled={locked || isMining || player.stamina < node.staminaCost}
                  className="px-3 py-1.5 rounded-lg bg-amber-600 disabled:opacity-35 text-slate-950 font-bold text-xs active:scale-95"
                >
                  {localize(locked ? `С ${node.levelReq} ур.` : mining ? 'Добыча…' : player.stamina < node.staminaCost ? `Нужно ${node.staminaCost} энергии` : 'Добывать')}
                </button>
              </div>

              {(NODE_MATERIALS[node.id] || []).length > 0 && (
                <div className="mt-2 flex items-start gap-1.5">
                  <Sparkles className="w-3 h-3 text-purple-300 shrink-0 mt-0.5" />
                  <div className="flex flex-wrap gap-1">
                    {(NODE_MATERIALS[node.id] || []).map(material => (
                      <span key={material} className="text-[9px] px-1.5 py-0.5 rounded border border-purple-500/20 bg-purple-950/20 text-purple-200">
                        <ItemArtwork item={{name:material,type:'material',rarity:'common',icon:'💎'}} size={18} className="inline-block mr-1 align-middle" />{localize(material)}
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
            <div key={index} className={log.startsWith('❌') ? 'text-rose-300' : 'text-slate-300'}>{localize(log)}</div>
          ))}
        </div>
      )}

      {/* Offline expedition second */}
      <div className="rounded-2xl border border-cyan-500/25 bg-[#0a0f1d] p-3">
        <div className="flex items-center gap-2 mb-3">
          <Clock3 className="w-4 h-4 text-[#d5ba89]" />
          <div>
            <div className="text-xs font-bold text-cyan-200">{localize("Офлайн-экспедиция")}</div>
            <div className="text-[10px] text-slate-500">
              {localize(premium.active
                ? 'Premium добывает ресурсы офлайн автоматически — запускать экспедицию не нужно.'
                : 'Для обычного аккаунта экспедицию нужно запустить перед выходом из игры.')}
            </div>
          </div>
        </div>

        {expedition ? (
          <div className={`rounded-xl border p-3 ${expeditionReady ? 'border-emerald-500/40 bg-emerald-950/20' : 'border-slate-700 bg-cyan-950/10'}`}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-xs font-bold text-slate-100">{localize("Экспедиция на ")}{localize(expedition.durationHours)}{localize(" ч.")}</div>
                <div className="text-[10px] text-slate-400 mt-0.5">{localize("Ручная добыча доступна параллельно, но бой заблокирован до выхода из экспедиции.")}</div>
              </div>
              <div className={`font-mono text-sm font-bold ${expeditionReady ? 'text-emerald-300' : 'text-[#d5ba89]'}`}>
                {localize(expeditionReady ? 'ГОТОВО' : formatRemaining(remainingMs))}
              </div>
            </div>

            {expeditionReady && (
              <div className="mt-2 flex flex-wrap gap-1">
                {expedition.rewards.map(reward => (
                  <span key={reward.name} className="px-1.5 py-1 rounded-lg border border-slate-700 bg-slate-950 text-[9px] text-slate-300">
                    {localize(reward.icon)} {localize(reward.name)} ×{localize(reward.count)}
                  </span>
                ))}
              </div>
            )}

            {expeditionReady ? (
              <button onClick={handleClaim} className="mt-3 w-full py-2.5 rounded-xl bg-emerald-600 text-white font-bold text-xs flex items-center justify-center gap-2">
                <PackageCheck className="w-4 h-4" />{localize(" Забрать добычу")}</button>
            ) : (
              <button
                onClick={() => {
                  const result = leaveMiningExpedition();
                  setMiningLog(prev => [result.success ? `🚪 ${result.message}` : `❌ ${result.message}`, ...prev.slice(0, 8)]);
                }}
                className="mt-3 w-full py-2.5 rounded-xl bg-rose-950/60 border border-rose-500/40 text-rose-200 font-bold text-xs"
              >{localize("Уйти с шахты")}</button>
            )}
          </div>
        ) : premium.active ? (
          <div className="rounded-xl border border-yellow-500/25 bg-yellow-950/10 p-3 text-center">
            <Crown className="w-5 h-5 mx-auto text-yellow-300 mb-1" />
            <div className="text-xs font-bold text-yellow-200">{localize("Автоматическая Premium-добыча активна")}</div>
            <div className="text-[10px] text-slate-500 mt-1">{localize("Просто закройте игру — ресурсы будут рассчитаны при возвращении.")}</div>
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
                    <div className="text-xs font-bold text-slate-100">{localize(option.title)}</div>
                    <div className="text-[10px] text-slate-500">{localize(option.description)}</div>
                  </div>
                  <span className="px-2 py-1 rounded-lg bg-cyan-950 border border-slate-700 text-[#d5ba89] font-mono text-xs font-bold">
                    {localize(option.hours)}{localize(" ч.")}</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
