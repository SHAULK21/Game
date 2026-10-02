import { t as localize, useLocale } from '../../i18n/locale';
import React, { useState } from 'react';
import { useGame } from '../../context/GameContext';
import { CLASS_BRANCHES, branchSpent, spentTalentPoints, talentCost, talentLockReason, talentResetPrice, talentBonuses } from '../../data/talents';
import type { Talent } from '../../types/game';

const BRANCHES = ['damage', 'survival', 'class'] as const;
const RANGES = ['1–20', '21–40', '41–60', '61–80', '81–100'];
export function TalentTree() {
  useLocale();
  const { player, unlockTalent, resetTalentTree, isInCombat, isCombatEnded } = useGame();
  const [branch, setBranch] = useState<'damage' | 'survival' | 'class' | 'mastery'>('damage');
  const [expandedTier, setExpandedTier] = useState<number | null>(1);
  const [confirmReset, setConfirmReset] = useState(false);
  if (!player) return null;
  const busy = isInCombat && !isCombatEnded;
  const spent = player.talents.reduce((sum, talent) => sum + spentTalentPoints(talent), 0);
  const price = talentResetPrice(player.level);
  const selected = player.talents.filter(t => t.branch === branch);
  const legacy = player.talents.filter(t => t.branch === 'legacy');
  const names = CLASS_BRANCHES[player.classId];
  const renderTalent = (talent: Talent) => {
    const reason = busy ? 'Завершите бой' : talentLockReason(player, talent);
    const mastered = talent.currentRank >= talent.maxRank;
    const bonus = talent.branch === 'mastery' ? talentBonuses([talent])[talent.effect.stat] || 0 : null;
    return <article key={talent.id} className={`rounded-xl border p-3 flex flex-col gap-2 ${talent.currentRank ? 'border-amber-700/60 bg-amber-950/15' : 'border-slate-800 bg-slate-950/50'}`}>
      <div className="flex justify-between gap-2 text-[10px] text-slate-400"><span>{localize("Ур. ")}{localize(talent.levelReq || 1)}</span><span>{localize(talent.branch === 'mastery' ? `Ранг ${talent.currentRank}` : `${talent.currentRank}/${talent.maxRank}`)}</span></div>
      <h3 className="text-xs font-semibold text-slate-100">{localize(talent.name)}</h3>
      <p className="text-[11px] leading-relaxed text-slate-400 flex-1">{localize(talent.description)}</p>
      {bonus !== null && <p className="text-[10px] text-amber-200">{localize("Сейчас: +")}{localize(bonus.toFixed(2))}%</p>}
      {talent.branchPointsReq ? <p className="text-[10px] text-slate-500">{localize("В ветке: ")}{localize(branchSpent(player.talents, talent.branch!))}/{localize(talent.branchPointsReq)}{localize(" очков для доступа")}</p> : null}
      <button disabled={Boolean(reason)} title={localize(reason || 'Изучить талант')} onClick={() => unlockTalent(talent.id)} className="rounded-lg border border-amber-700/60 bg-amber-950/40 px-2 py-2 text-[10px] font-semibold text-amber-100 disabled:border-slate-800 disabled:bg-slate-900 disabled:text-slate-500 min-h-10">
        {localize(mastered ? 'Изучено полностью' : reason || `Изучить · ${talentCost(talent)} очк.`)}
      </button>
    </article>;
  };
  return <div className="space-y-4">
    <div className="ui-panel rounded-xl border p-3 space-y-2">
      <div className="flex justify-between text-xs"><span>{localize("Свободно: ")}<strong className="text-amber-200">{localize(player.talentPoints)}</strong></span><span className="text-slate-400">{localize("Вложено: ")}{localize(spent)}</span></div>
      <p className="text-[11px] leading-relaxed text-slate-400">{localize("Выберите стиль боя. Полная ветка стоит 58 очков: к 100 уровню доступны одна специализация и часть других. Очки характеристик распределяются отдельно.")}</p>
      {busy && <p role="status" className="text-[11px] text-amber-200">{localize("Распределение и сброс доступны после боя.")}</p>}
    </div>
    <div role="tablist" aria-label={localize("Ветки талантов")} className="grid grid-cols-3 gap-1">
      {BRANCHES.map((id, index) => <button key={id} role="tab" aria-selected={branch === id} onClick={() => { setBranch(id); setExpandedTier(1); }} className={`rounded-lg border px-2 py-2 min-h-14 text-[11px] ${branch === id ? 'border-amber-700 text-amber-100 bg-amber-950/30' : 'border-slate-800 text-slate-400'}`}>
        {localize(names[index])}<span className="block mt-1 text-[10px] opacity-70">{localize(branchSpent(player.talents, id))}{localize(" / 58 очк.")}</span>
      </button>)}
    </div>
    <button onClick={() => setBranch('mastery')} className={`w-full rounded-lg border py-2 text-xs ${branch === 'mastery' ? 'border-amber-700 text-amber-100' : 'border-slate-800 text-slate-400'}`}>{localize("Мастерство · с 101 уровня")}</button>
    {branch === 'mastery' ? <><p className="text-[11px] text-slate-400">{localize("Малые прибавки с убывающей отдачей и растущей ценой. Мастерство не повышает крит или вампиризм.")}</p><div className="grid grid-cols-2 gap-2">{localize(selected.map(renderTalent))}</div></> :
      <div role="tabpanel" className="space-y-2">
        <p className="text-[11px] text-slate-500">{localize("Нажмите на диапазон уровней, чтобы раскрыть таланты.")}</p>
        {RANGES.map((range, index) => {
          const tier = index + 1;
          const talents = selected.filter(t => t.tier === tier);
          const points = talents.reduce((sum, talent) => sum + spentTalentPoints(talent), 0);
          const levelReq = Math.min(...talents.map(t => t.levelReq || 1));
          return <details key={`${branch}:${range}`} open={expandedTier === tier} className="rounded-xl border border-slate-800 bg-slate-950/30 px-3">
            <summary onClick={event => { event.preventDefault(); setExpandedTier(expandedTier === tier ? null : tier); }} className="cursor-pointer py-3 text-xs text-slate-300">{localize("Уровни ")}{localize(range)}<span className="ml-2 text-[10px] text-slate-500">{localize(points)}{localize(" очк. вложено")}{localize(player.level < levelReq ? ` · с ${levelReq} ур.` : '')}</span>
            </summary>
            {expandedTier === tier && <div className="grid grid-cols-2 gap-2 pb-3">{localize(talents.map(renderTalent))}</div>}
          </details>;
        })}
      </div>}
    {legacy.length > 0 && <details className="rounded-xl border border-slate-800 p-3"><summary className="text-xs text-amber-200 cursor-pointer">{localize("Сохранённые таланты · ")}{localize(branchSpent(player.talents, 'legacy'))}{localize(" очк.")}</summary><p className="mt-2 text-[11px] text-slate-400">{localize("Старые ранги и бонусы действуют. При сбросе их очки вернутся для нового дерева.")}</p><div className="mt-2 space-y-2">{legacy.map(t => <div key={t.id} className="text-[11px] text-slate-300">{localize(t.name)} · {localize(t.currentRank)}/{localize(t.maxRank)}<p className="text-slate-500">{localize(t.description)}</p></div>)}</div></details>}
    <div className="rounded-xl border border-slate-800 p-3 space-y-2">
      <p className="text-[11px] text-slate-400">{localize("Сброс вернёт все ")}{localize(spent)}{localize(" вложенных очков, включая старые таланты и мастерство. Стоимость: ")}{localize(price)}{localize(" серебра. У вас: ")}{localize(player.silver)}.</p>
      {confirmReset ? <div className="flex gap-2"><button disabled={busy || player.silver < price || !spent} onClick={() => { resetTalentTree(); setConfirmReset(false); }} className="flex-1 rounded-lg bg-amber-900/40 border border-amber-700 p-2 text-xs text-amber-100 disabled:opacity-40">{localize("Сбросить за ")}{localize(price)}{localize(" серебра")}</button><button onClick={() => setConfirmReset(false)} className="rounded-lg border border-slate-700 p-2 text-xs text-slate-400">{localize("Отмена")}</button></div> :
        <button disabled={busy || !spent || player.silver < price} onClick={() => setConfirmReset(true)} className="w-full rounded-lg border border-slate-700 p-2 text-xs text-slate-300 disabled:opacity-40">{localize("Сбросить распределение")}</button>}
    </div>
  </div>;
}
