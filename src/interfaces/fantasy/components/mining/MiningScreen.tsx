import {PICKAXES,getPickaxeBonus,miningCritChance,miningYieldRange} from '../../../../utils/mining';
import {ItemArtwork} from '../ui/ItemArtwork';
import {RARITY_COLORS} from '../../data/gameData';
import React, { useEffect, useRef, useState } from 'react';
import { useGame } from '../../../../context/GameContext';
import { MINING_NODES } from '../../data/gameData';
import { getResourceArtwork } from '../../utils/resourceArtwork';
import { RpgIcon } from '../ui/RpgIcon';
import { BestiaryPanel, FolioPage, ProgressBar, RpgButton, SectionTitle } from '../ui/BestiaryUI';

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
          ? `${result.isCrit ? 'КРИТ · ' : ''}Получено: ${result.yieldCount} × ${result.oreName}`
          : `Ошибка: не удалось добыть ${result.oreName || 'проверьте уровень, энергию шахты и место в рюкзаке'}.`,
        ...prev.slice(0, 8)
      ]);
    } catch (error) {
      setMiningLog(prev => [`Ошибка добычи: ${error instanceof Error ? error.message : 'попробуйте снова'}.`, ...prev.slice(0, 8)]);
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
    setMiningLog(prev => [result.success ? result.message : `Ошибка: ${result.message}`, ...prev.slice(0, 8)]);
  };

  return (
    <FolioPage className="space-y-3 pt-3">
      <BestiaryPanel className="space-y-2 p-3">
        <SectionTitle eyebrow="Инструмент шахтёра">Кирка для шахты</SectionTitle>
        <p className="text-xs text-slate-400">Отдельный слот. Бонусы работают при ручной добыче. Максимум жилы — редкий крит; обычная добыча зависит от жилы.</p>
        {player.equipped.pickaxe ? <div className="flex items-center gap-2 text-xs"><ItemArtwork item={player.equipped.pickaxe} size={36}/><div className="flex-1">{player.equipped.pickaxe.name}<div className="text-xs text-emerald-300">+{getPickaxeBonus(player.equipped.pickaxe)?.critBonus||0} п.п. крита · +{getPickaxeBonus(player.equipped.pickaxe)?.expBonus||0}% опыта</div></div><RpgButton variant="secondary" disabled={isMining || player.inventory.length>=player.maxInventorySlots} onClick={()=>unequipItem('pickaxe')}>Снять</RpgButton></div> : <p className="text-xs text-slate-500">Кирка не экипирована</p>}
        {player.inventory.filter(i=>i.type==='pickaxe').map(item=><div key={item.id} className="flex items-center gap-2 text-xs"><ItemArtwork item={item} size={30}/><span className="flex-1">{item.name}</span><RpgButton variant="secondary" disabled={isMining || player.miningLevel<(getPickaxeBonus(item)?.miningLevel||1)} onClick={()=>equipItem(item)}>Экипировать</RpgButton></div>)}
        <details><summary className="min-h-11 cursor-pointer py-3 text-xs text-[#c5b393]">Купить кирку · 5 редкостей</summary><div className="mt-2 space-y-2">{PICKAXES.map(offer=><div key={offer.id} className="leather-panel flex items-center gap-2 p-2"><div className="flex-1"><div className={`text-xs ${RARITY_COLORS[offer.rarity].text}`}>{offer.name} · {RARITY_COLORS[offer.rarity].label}</div><div className="text-xs text-slate-400">Шахта {offer.miningLevel} ур. · +{offer.critBonus} п.п. крита · +{offer.expBonus}% опыта</div></div><RpgButton variant="secondary" disabled={isMining || player.miningLevel<offer.miningLevel || player.gold<offer.price || player.inventory.length>=player.maxInventorySlots} onClick={()=>{const result=buyPickaxe(offer.id);setMiningLog(prev=>[result.message,...prev].slice(0,8));}}>{player.miningLevel<offer.miningLevel ? `С ${offer.miningLevel} ур.` : `${offer.price.toLocaleString()} золота`}</RpgButton></div>)}</div></details>
      </BestiaryPanel>
      <BestiaryPanel className="rounded-xl p-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-2.5 rounded-xl bg-amber-950/60 border border-amber-400/40 text-amber-400">
              <RpgIcon kind="mine" size={24} />
            </div>
            <div className="min-w-0">
              <h2 className="font-cinzel text-base font-bold text-slate-100">Королевские Рудники</h2>
              <div className="text-[11px] font-mono text-slate-400">
                Горное дело: <span className="text-amber-300 font-bold">{player.miningLevel} ур.</span>
              </div>
            </div>
          </div>
          <div className="text-right shrink-0">
            <span className="block text-[11px] text-slate-400">Энергия шахты</span>
            <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-300"><RpgIcon kind="energy" size={14} />{player.stamina}/{player.maxStamina}</span>
          </div>
        </div>

        <div className="mt-3">
          <ProgressBar value={currentLevelExp} max={currentLevelNeed} tone="energy" label="Опыт шахтёра" />
          {nextNode && (
            <div className="mt-1 text-[11px] text-slate-500">
              Следующая жила: <span className="text-slate-300">{nextNode.name}</span> с {nextNode.levelReq} ур.
            </div>
          )}
        </div>
      </BestiaryPanel>

      {/* Manual extraction first */}
      <div className="space-y-2">
        <div className="px-1">
          <SectionTitle eyebrow="Добыча">Ручная разработка</SectionTitle>
          <div className="text-xs text-slate-500">Кроме руды можно найти дополнительные материалы.</div>
        </div>

        {visibleNodes.map(node => {
          const mining = isMining && activeMiningNodeId === node.id;
          const locked = player.miningLevel < node.levelReq;
          return (
            <div key={node.id} className={`p-3 rounded-xl border ${locked ? 'border-slate-800/70 bg-slate-950/50 opacity-70' : 'border-slate-800 bg-[#0a0f1d]'}`}>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="p-2 bg-slate-900 rounded-lg border border-slate-800">
                    <ItemArtwork item={{ name: node.oreYield, type: 'ore', rarity: 'common', icon: '⛏' }} size={28} />
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="font-cinzel text-xs font-bold text-slate-100">{node.name}</div>
                      {locked && <span className="rounded border border-rose-500/30 bg-rose-950/30 px-1.5 py-0.5 text-[11px] font-bold text-rose-300">Закрыто · ур. {node.levelReq}</span>}
                    </div>
                    <div className="text-[11px] font-mono text-slate-400 mt-0.5">
                      {node.oreYield} ×{node.baseYieldMin}–{node.baseYieldMax} ({node.baseYieldMax} — крит) · {node.staminaCost} энергии · крит {(miningCritChance(node.levelReq,player.equipped.pickaxe,player.attributes.luck,achievements.some(a=>a.id==='ach_4'&&a.claimed))*100).toFixed(2)}%
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => handleMine(node.id)}
                  disabled={locked || isMining || player.stamina < node.staminaCost}
                  className="rpg-button rpg-button-primary min-h-11 px-3 disabled:opacity-35"
                >
                  {locked ? `С ${node.levelReq} ур.` : mining ? 'Добыча…' : player.stamina < node.staminaCost ? `Нужно ${node.staminaCost} энергии` : 'Добывать'}
                </button>
              </div>

              {(NODE_MATERIALS[node.id] || []).length > 0 && (
                <div className="mt-2 flex items-start gap-1.5">
                  <RpgIcon kind="gem" size={16} className="mt-0.5 shrink-0 text-purple-300" />
                  <div className="flex flex-wrap gap-1">
                    {(NODE_MATERIALS[node.id] || []).map(material => (
                      <span key={material} className="rounded border border-purple-500/20 bg-purple-950/20 px-1.5 py-1 text-xs text-purple-200">
                        <ItemArtwork item={{ name: material, type: 'material', rarity: 'common', icon: '✦' }} size={18} className="inline-block mr-1 align-middle" />{material}
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
          <div key={index} className={log.startsWith('Ошибка') ? 'text-rose-300' : 'text-slate-300'}>{log}</div>
          ))}
        </div>
      )}

      {/* Offline expedition second */}
      <BestiaryPanel className="p-3">
        <div className="flex items-center gap-2 mb-3">
          <RpgIcon kind="quest" size={19} className="text-[#d5ba89]" />
          <div>
            <div className="text-xs font-bold text-cyan-200">Офлайн-экспедиция</div>
            <div className="text-xs text-slate-500">
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
                <div className="text-[11px] text-slate-400 mt-0.5">
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
                  <span key={reward.name} className="px-1.5 py-1 rounded-lg border border-slate-700 bg-slate-950 text-[11px] text-slate-300">
                    {reward.name} ×{reward.count}
                  </span>
                ))}
              </div>
            )}

            {expeditionReady ? (
              <RpgButton variant="primary" icon="inventory" onClick={handleClaim} className="mt-3 w-full">Забрать добычу</RpgButton>
            ) : (
              <RpgButton
                onClick={() => {
                  const result = leaveMiningExpedition();
                  setMiningLog(prev => [result.success ? result.message : `Ошибка: ${result.message}`, ...prev.slice(0, 8)]);
                }}
                variant="danger"
                className="mt-3 w-full"
              >
                Уйти с шахты
              </RpgButton>
            )}
          </div>
        ) : premium.active ? (
          <div className="rounded-xl border border-yellow-500/25 bg-yellow-950/10 p-3 text-center">
            <RpgIcon kind="crown" size={22} className="mx-auto mb-1 text-yellow-300" />
            <div className="text-xs font-bold text-yellow-200">Автоматическая Premium-добыча активна</div>
            <div className="text-[11px] text-slate-500 mt-1">Просто закройте игру — ресурсы будут рассчитаны при возвращении.</div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-2">
            {EXPEDITIONS.map(option => (
              <RpgButton
                key={option.hours}
                onClick={() => {
                  const result = startMiningExpedition(option.hours);
                  setMiningLog(prev => [result.success ? result.message : `Ошибка: ${result.message}`, ...prev.slice(0, 8)]);
                }}
                variant="secondary"
                className="w-full justify-between p-3 text-left"
              >
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="text-xs font-bold text-slate-100">{option.title}</div>
                    <div className="text-[11px] text-slate-500">{option.description}</div>
                  </div>
                  <span className="px-2 py-1 rounded-lg bg-cyan-950 border border-slate-700 text-[#d5ba89] font-mono text-xs font-bold">
                    {option.hours} ч.
                  </span>
                </div>
              </RpgButton>
            ))}
          </div>
        )}
      </BestiaryPanel>
    </FolioPage>
  );
};
