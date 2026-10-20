import {useRef, useState} from 'react';
import {useGame} from '../../context/GameStateContext';
import {t, useLocale} from '../../i18n/locale';
import {getEffectiveGearStats} from '../../utils/classEquipment';
import {itemMergeQuote, mergeableItem, mergeLevel, MAX_MERGE_LEVEL} from '../../utils/itemMerging';
import type {GameItem} from '../../types/game';
import {ItemSelector} from '../ui/ItemSelector';

/** Shared by all interface styles; a donor is always chosen explicitly. */
export function ItemMergePanel() {
  useLocale();
  const {player, mergeItems} = useGame();
  const [baseId, setBaseId] = useState(''), [donorId, setDonorId] = useState('');
  const [busy, setBusy] = useState(false), pending = useRef(false);
  const [result, setResult] = useState<{success: boolean; message: string} | null>(null);
  if (!player) return null;
  const items = [...Object.values(player.equipped).filter((i): i is GameItem => !!i), ...player.inventory].filter(mergeableItem);
  const base = items.find(i => i.id === baseId);
  const donors = base ? player.inventory.filter(i => itemMergeQuote(base, i).chance > 0) : [];
  const donor = donors.find(i => i.id === donorId);
  const quote = base && donor ? itemMergeQuote(base, donor) : null;
  const before = base ? getEffectiveGearStats(base, player.classId) : {};
  const after = base ? getEffectiveGearStats({...base, mergeLevel: mergeLevel(base) + 1}, player.classId) : {};
  const labels: Record<string, string> = {attack: 'Физическая атака:', magicAttack: 'Магическая атака:', defense: 'Физическая защита:', magicDefense: 'Магическая защита:'};
  const submit = async () => {
    if (!base || !donor || pending.current) return;
    pending.current = true; setBusy(true); setResult(null);
    try {
      const response = await mergeItems(base.id, donor.id);
      setResult(response);
      setDonorId('');
    } catch (error) {
      setResult({success: false, message: error instanceof Error ? error.message : 'Не удалось выполнить объединение.'});
    } finally {pending.current = false; setBusy(false);}
  };
  return <details className="ui-panel rounded-xl border border-slate-700 p-3">
    <summary className="min-h-11 cursor-pointer py-2 font-bold text-cyan-300">{t('Объединение предметов')}</summary>
    <div className="space-y-3 pt-2">
      <p className="text-xs text-slate-300">{t('Отдельное усиление до ◆10: +10% к атаке и защите за ступень. Заточка и редкость основного предмета сохраняются. Золото и материалы не нужны.')}</p>
      <p className="text-xs text-slate-400">{t('Одинаковые предметы одной редкости и уровня. Равные ступени: 100%; за каждую ступень разницы шанс уменьшается вдвое. Основным выбирайте более объединённый предмет.')}</p>
      <ItemSelector label="Основной предмет — останется" items={items} value={base?.id || ''} disabled={busy} onSelect={id => {setBaseId(id); setDonorId(''); setResult(null);}} />
      {base && <>
        <p className="text-xs text-cyan-300">{t('Объединение')}: ◆{mergeLevel(base)} / {MAX_MERGE_LEVEL} · {t('Заточка')} +{base.upgradeLevel || 0}</p>
        {mergeLevel(base) >= MAX_MERGE_LEVEL ? <p className="text-xs text-emerald-300">{t('Достигнут предел объединения: 10.')}</p> : <>
          <ItemSelector label="Второй предмет — будет израсходован" items={donors} value={donor?.id || ''} disabled={busy} onSelect={id => {setDonorId(id); setResult(null);}} />
          {!donors.length && <p className="text-xs text-slate-400">{t('Нет подходящей копии в сумке. Проверьте редкость, уровень, класс и блокировку предмета.')}</p>}
          {donor && quote && <>
            <div className="text-xs text-slate-200">{t('Шанс успеха:')} <strong>{Number((quote.chance * 100).toFixed(3))}%</strong> · ◆{mergeLevel(base)} → ◆{mergeLevel(base) + 1}</div>
            <div className="space-y-1 text-xs text-slate-300">{Object.entries(labels).filter(([key]) => before[key] !== undefined).map(([key, label]) => <div key={key}>{t(label)} {before[key]} → <b className="text-emerald-300">{after[key]}</b></div>)}</div>
            <p className="rounded-lg border border-amber-700 p-2 text-xs text-amber-200">{t('Второй предмет исчезнет при любом исходе, включая его заточку и объединение. При неудаче основной предмет не изменится.')}</p>
            <button type="button" disabled={busy} onClick={submit} className="min-h-11 w-full rounded-lg border border-cyan-600 bg-cyan-950 px-3 py-2 font-bold text-cyan-100 disabled:opacity-40">{t(busy ? 'Объединение…' : 'Объединить и израсходовать второй предмет')}</button>
          </>}
        </>}
      </>}
      {result && <p role="status" className={`text-xs ${result.success ? 'text-emerald-300' : 'text-amber-200'}`}>{t(result.message)}</p>}
    </div>
  </details>;
}
