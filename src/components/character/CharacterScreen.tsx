import React, { useState } from 'react';
import { useGame } from '../../context/GameContext';
import { CLASSES, ASSETS } from '../../data/gameData';
import { CharacterAttributes } from '../../types/game';
import { 
  User, 
  Shield, 
  Swords, 
  Zap, 
  Sparkles, 
  Heart, 
  Check, 
  Plus, 
  ArrowLeft,
  Dog
} from 'lucide-react';
import { TalentTree } from './TalentTree';
import { sound } from '../../utils/audio';

interface CharacterScreenProps {
  onClose?: () => void;
}

export const CharacterScreen: React.FC<CharacterScreenProps> = ({ onClose }) => {
  const { player, combatStats, allocateAttribute, unlockTalent, premium } = useGame();
  const [activeTab, setActiveTab] = useState<'stats' | 'talents' | 'pet'>('stats');

  if (!player) return null;

  const classDef = CLASSES[player.classId];
  const expPct = Math.min(100, Math.round((player.exp / player.nextExp) * 100));

  return (
    <div className="p-3 space-y-4 max-w-lg mx-auto pb-24">
      {/* Top Bar with back button */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
        <div className="flex items-center gap-2">
          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-white"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}
          <h2 className="font-cinzel text-sm font-bold text-slate-100">
            Профиль героя: {premium.active && <span className="text-amber-300" title="Premium">👑 </span>}{player.name}
          </h2>
        </div>

        <div className="flex items-center gap-1.5 text-xs font-mono">
          <span className="text-slate-400">Ур.</span>
          <span className="text-cyan-400 font-bold">{player.level}</span><span className="text-amber-300 ml-2">Ранг {player.ascension?.rank || 'E'}</span>
        </div>
      </div>

      {/* Class Overview Card */}
      <div className="ui-panel rounded-2xl border p-3.5 flex items-center gap-3.5">
        <div className="relative shrink-0">
          <img
            src={classDef?.image || ASSETS.heroHunter}
            alt="Hero Avatar"
            className="w-16 h-16 rounded-xl object-cover border-2 border-cyan-400/50 shadow-md"
            referrerPolicy="no-referrer"
          />
          <span className="absolute -bottom-1 -right-1 bg-cyan-950 border border-cyan-400 text-cyan-200 text-[10px] font-mono font-bold px-1 rounded">
            {classDef.icon}
          </span>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-cinzel text-base font-bold text-slate-100">
              {classDef.name}
            </h3>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-cyan-950/80 text-cyan-300 border border-cyan-500/40">
              {classDef.role}
            </span>
          </div>

          <p className="text-[11px] text-slate-400 mt-1 leading-snug line-clamp-2">
            {classDef.description}
          </p>
          <div className="mt-2 rounded-lg border border-amber-500/25 bg-amber-950/20 px-2.5 py-2">
            <div className="text-[9px] uppercase tracking-wider font-bold text-amber-300">Пассив класса · {classDef.passive.name}</div>
            <div className="text-[10px] text-amber-100/80 mt-0.5 leading-snug">{classDef.passive.description}</div>
          </div>

          {/* EXP Bar */}
          <div className="mt-2 space-y-0.5">
            <div className="flex justify-between text-[10px] font-mono">
              <span className="text-slate-400">Опыт героя</span>
              <span className="text-cyan-300 tabular-nums">
                {player.exp} / {player.nextExp} ({expPct}%)
              </span>
            </div>
            <div className="h-1.5 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
              <div
                className="h-full bg-gradient-to-r from-cyan-500 to-indigo-500 transition-all duration-300"
                style={{ width: `${expPct}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-1 text-xs">
        <button
          onClick={() => setActiveTab('stats')}
          className={`flex-1 py-2 text-center rounded-lg font-cinzel font-bold transition-colors ${
            activeTab === 'stats'
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Характеристики
          {player.statPoints > 0 && (
            <span className="ml-1.5 px-1 py-0.2 rounded-full bg-amber-500 text-slate-950 text-[10px] font-mono">
              +{player.statPoints}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('talents')}
          className={`flex-1 py-2 text-center rounded-lg font-cinzel font-bold transition-colors ${
            activeTab === 'talents'
              ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Дерево талантов
          {player.talentPoints > 0 && (
            <span className="ml-1.5 px-1 py-0.2 rounded-full bg-purple-500 text-white text-[10px] font-mono">
              +{player.talentPoints}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('pet')}
          className={`flex-1 py-2 text-center rounded-lg font-cinzel font-bold transition-colors ${
            activeTab === 'pet'
              ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Питомец
        </button>
      </div>

      {/* STATS TAB */}
      {activeTab === 'stats' && (
        <div className="space-y-3">
          {/* Attributes Allocation */}
          <div className="rounded-xl border border-slate-800 bg-[#0a0f1d] p-3 space-y-2">
            <div className="flex items-center justify-between text-xs border-b border-slate-800 pb-1.5">
              <span className="font-cinzel font-bold text-slate-200">
                Базовые атрибуты:
              </span>
              <span className="font-mono text-amber-400">
                Свободно очков: {player.statPoints}
              </span>
            </div>

            <div className="space-y-1.5">
              {([
                { key: 'strength', label: 'Сила', desc: 'Физ. атака, переносимый вес', icon: '⚔️' },
                { key: 'agility', label: 'Ловкость', desc: 'Скорость, уклонение, крит', icon: '🏹' },
                { key: 'intelligence', label: 'Интеллект', desc: 'Маг. атака, запас маны', icon: '🔮' },
                { key: 'vitality', label: 'Живучесть', desc: 'Здоровье, физ. защита', icon: '🛡️' },
                { key: 'luck', label: 'Удача', desc: 'Дроп редких предметов, крит', icon: '🍀' },
                { key: 'spirit', label: 'Дух', desc: 'Регенерация MP, маг. защита', icon: '✨' },
                { key: 'willpower', label: 'Воля', desc: 'Регенерация HP, стойкость', icon: '🧠' },
              ] as const).map(attr => (
                <div
                  key={attr.key}
                  className="flex items-center justify-between py-1 px-2 rounded-lg bg-slate-900/60 text-xs font-mono"
                >
                  <div className="flex items-center gap-2">
                    <span>{attr.icon}</span>
                    <span className="text-slate-300">{attr.label}</span>
                    <span className="text-[10px] text-slate-500">({attr.desc})</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-slate-100 font-bold">
                      {player.attributes[attr.key as keyof CharacterAttributes]}
                    </span>
                    {player.statPoints > 0 && (
                      <button
                        onClick={() => allocateAttribute(attr.key as keyof CharacterAttributes)}
                        className="w-5 h-5 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold flex items-center justify-center active:scale-90 transition-transform"
                      >
                        +
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Derived Combat Stats */}
          <div className="rounded-xl border border-slate-800 bg-[#0a0f1d] p-3 space-y-2">
            <span className="font-cinzel text-xs font-bold text-cyan-300 uppercase tracking-wider block border-b border-slate-800 pb-1.5">
              Боевые показатели:
            </span>

            <div className="grid grid-cols-2 gap-2 text-xs font-mono">
              <div className="p-2 rounded bg-slate-900/60 flex justify-between">
                <span className="text-slate-400">Физ. Атака:</span>
                <span className="text-slate-100 font-bold">{combatStats.attack}</span>
              </div>
              <div className="p-2 rounded bg-slate-900/60 flex justify-between">
                <span className="text-slate-400">Маг. Атака:</span>
                <span className="text-slate-100 font-bold">{combatStats.magicAttack}</span>
              </div>
              <div className="p-2 rounded bg-slate-900/60 flex justify-between">
                <span className="text-slate-400">Физ. Защита:</span>
                <span className="text-slate-100 font-bold">{combatStats.defense}</span>
              </div>
              <div className="p-2 rounded bg-slate-900/60 flex justify-between">
                <span className="text-slate-400">Маг. Защита:</span>
                <span className="text-slate-100 font-bold">{combatStats.magicDefense}</span>
              </div>
              <div className="p-2 rounded bg-slate-900/60 flex justify-between">
                <span className="text-slate-400">Шанс крита:</span>
                <span className="text-amber-400 font-bold">{combatStats.critChance}%</span>
              </div>
              <div className="p-2 rounded bg-slate-900/60 flex justify-between">
                <span className="text-slate-400">Крит. Урон:</span>
                <span className="text-amber-400 font-bold">{combatStats.critDamage}%</span>
              </div>
              <div className="p-2 rounded bg-slate-900/60 flex justify-between">
                <span className="text-slate-400">Вампиризм:</span>
                <span className="text-rose-400 font-bold">{combatStats.vampirism}%</span>
              </div>
              <div className="p-2 rounded bg-slate-900/60 flex justify-between">
                <span className="text-slate-400">Пробитие:</span>
                <span className="text-amber-400 font-bold">{combatStats.armorPenetration} ед.</span>
              </div>
              <div className="p-2 rounded bg-slate-900/60 flex justify-between">
                <span className="text-slate-400">Уклонение:</span>
                <span className="text-indigo-400 font-bold">{Math.round(combatStats.evasion)}%</span>
              </div>
              <div className="p-2 rounded bg-slate-900/60 flex justify-between">
                <span className="text-slate-400">Меткость:</span>
                <span className="text-cyan-400 font-bold">{Math.round(combatStats.accuracy)}%</span>
              </div>
              <div className="p-2 rounded bg-slate-900/60 flex justify-between">
                <span className="text-slate-400">Реген HP/MP:</span>
                <span className="text-emerald-400 font-bold">+{combatStats.hpRegen} / +{combatStats.mpRegen}</span>
              </div>
              <div className="p-2 rounded bg-slate-900/60 flex justify-between">
                <span className="text-slate-400">Скорость:</span>
                <span className="text-cyan-400 font-bold">{combatStats.speed}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TALENTS TAB */}
      {activeTab === 'talents' && <TalentTree />}

      {/* PET TAB */}
      {activeTab === 'pet' && (
        <div className="rounded-xl border border-teal-500/30 bg-[#0a121d] p-4 space-y-3">
          {player.activePet ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <span className="text-4xl p-2 bg-slate-900 rounded-xl border border-slate-800">
                  {player.activePet.icon}
                </span>
                <div>
                  <h3 className="font-cinzel text-sm font-bold text-slate-100">
                    {player.activePet.name}
                  </h3>
                  <span className="text-[10px] font-mono text-teal-400">
                    Уровень {player.activePet.level} · Питомец героя
                  </span>
                </div>
              </div>

              <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-900 text-xs text-slate-300">
                <span className="text-teal-300 font-bold block mb-0.5">Пассивный бонус:</span>
                {player.activePet.passiveBonus}
              </div>

              {player.activePet.activeSkillName && (
                <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-900 text-xs text-slate-300">
                  <span className="text-amber-300 font-bold block mb-0.5">
                    Навык: {player.activePet.activeSkillName}
                  </span>
                  {player.activePet.activeSkillDesc}
                </div>
              )}
            </div>
          ) : (
            <div className="text-xs text-slate-400 text-center py-6">
              У вас пока нет активного питомца.
            </div>
          )}
        </div>
      )}
    </div>
  );
};
