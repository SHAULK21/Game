import {useEffect, useRef, useState} from 'react';
import {useGame} from '../../context/GameStateContext';
import {ItemSelector} from '../ui/ItemSelector';
import {ItemArtwork} from '../ui/ItemArtwork';
import {getEffectiveGearStats} from '../../utils/classEquipment';
import {ascensionMaterials, itemAscensionLevel, MAX_ITEM_ASCENSION, ITEM_ASCENSION_STATS, mergeEquipment} from '../../utils/itemAscension';
import {SHARPENABLE_TYPES} from '../../utils/sharpening';
import {t} from '../../i18n/locale';

const labels = {attack:'Атака', magicAttack:'Магічна атака', defense:'Захист', magicDefense:'Магічний захист', maxHp:'Макс. HP', maxMp:'Макс. MP'};
const rarity = {common:'Звичайна', uncommon:'Незвичайна', rare:'Рідкісна', epic:'Епічна', legendary:'Легендарна', mythic:'Міфічна', ancient:'Стародавня', divine:'Божественна'};

/** All interfaces share the same explicit donor selection and confirmed preview. */
export function ItemAscensionPanel() {
  const {player, mergeItems} = useGame();
  const [baseId, setBaseId] = useState(''), [materialId, setMaterialId] = useState('');
  const [confirmation, setConfirmation] = useState<string | null>(null);
  const [busy, setBusy] = useState(false), [message, setMessage] = useState('');
  const inFlight = useRef(false);
  const revision = useRef('');
  const items = player ? [...Object.values(player.equipped).filter(item => !!item), ...player.inventory]
    .filter(item => SHARPENABLE_TYPES.includes(item!.type)) as NonNullable<typeof player>['inventory'] : [];
  const base = items.find(item => item.id === baseId) ?? items[0];
  const candidates = player && base ? ascensionMaterials(player, base).sort((a,b) => a.upgradeLevel - b.upgradeLevel) : [];
  const material = candidates.find(item => item.id === materialId) ?? candidates[0];
  const quote = player && base && material ? mergeEquipment(player, base.id, material.id, '__ascension_preview__') : null;
  const next = quote?.item;
  // Confirmation belongs to the exact current inventory state, including rolls,
  // locks and quantities. A refresh never silently confirms a different donor.
  const stamp = JSON.stringify([base, material, player?.maxInventorySlots]);
  revision.current = stamp;
  useEffect(() => {setConfirmation(null);}, [stamp]);
  if (!player) return null;
  const before = base ? getEffectiveGearStats(base, player.classId) : {};
  const after = next ? getEffectiveGearStats(next, player.classId) : {};
  const rank = base ? itemAscensionLevel(base) : 0;

  const confirm = async () => {
    if (!base || !material || !quote?.success || confirmation !== stamp || inFlight.current) return;
    inFlight.current = true; setBusy(true); setMessage('');
    try {
      const result = await mergeItems(base.id, material.id);
      setMessage(result.message); setConfirmation(null);
    } catch (error) {setMessage(error instanceof Error ? error.message : 'Не вдалося об’єднати предмети.');}
    finally {inFlight.current = false; setBusy(false);}
  };

  return <section aria-label="Піднесення предметів" data-item-ascension className="rounded-xl border border-amber-700/50 bg-slate-950/90 p-3 text-slate-200 space-y-3">
    <div><h3 className="font-bold text-sm text-amber-200">Піднесення · об’єднання</h3>
      <p className="mt-1 text-xs text-slate-300">Два однакові предмети → один сильніший. Однакові рівень, рідкісність і ступінь піднесення. Успіх — 100%.</p>
      <p className="mt-1 text-xs text-slate-400">До V ступеня: +10% за ступінь до атаки, захисту, HP та MP. Зберігаються рідкісність, властивості основного предмета й найкраще заточення з двох. Золото та енергія не витрачаються.</p>
    </div>
    {!base ? <p className="text-xs">Немає спорядження для піднесення.</p> : <>
      <ItemSelector label="Основний предмет" items={items} value={base.id} disabled={busy} onSelect={id => {setBaseId(id); setMaterialId(''); setConfirmation(null); setMessage('');}} />
      <div className="flex flex-wrap gap-2 text-xs" data-item-progression>
        <span>Заточення: +{base.upgradeLevel}</span><span>Піднесення: {rank}/{MAX_ITEM_ASCENSION}</span><span>Рідкісність: {rarity[base.rarity]}</span>
      </div>
      {rank >= MAX_ITEM_ASCENSION ? <p className="text-xs text-amber-200">Досягнуто максимального піднесення: V.</p>
        : base.isLocked || base.boundToClan ? <p className="text-xs text-amber-200">Захищені та кланові предмети не можна об’єднувати.</p>
        : !material ? <p className="text-xs text-slate-300">Немає відповідної копії в сумці. Копія має бути неекіпірована, без захисту та кланової прив’язки.</p>
        : <>
          <ItemSelector label="Предмет, який буде витрачено" items={candidates} value={material.id} disabled={busy} onSelect={id => {setMaterialId(id); setConfirmation(null); setMessage('');}} />
          {next ? <div className="rounded-lg border border-slate-700 p-3 space-y-2" data-ascension-preview>
            <div className="flex items-center gap-2"><ItemArtwork item={next} size={40} /><strong className="break-words text-xs">{t(next.name)} · {rank} → {next.ascensionLevel}/{MAX_ITEM_ASCENSION} · +{next.upgradeLevel}</strong></div>
            {ITEM_ASCENSION_STATS.filter(stat => before[stat] || after[stat]).map(stat => <div key={stat} className="flex justify-between gap-2 text-xs"><span>{labels[stat]}</span><span>{before[stat] ?? 0} → <strong className="text-emerald-300">{after[stat] ?? 0}</strong></span></div>)}
          </div> : <p role="status" className="text-xs text-amber-200">{quote?.message}</p>}
          {confirmation === stamp ? <div className="rounded-lg border border-amber-600 p-3 space-y-2">
            <p className="text-xs">Буде витрачено 1 × {t(material.name)} (+{material.upgradeLevel}). Основний предмет отримає піднесення {rank + 1}/{MAX_ITEM_ASCENSION} і заточення +{next?.upgradeLevel}. Властивості копії не переносяться.</p>
            <div className="flex flex-wrap gap-2"><button type="button" disabled={busy} onClick={() => void confirm()} className="min-h-11 rounded-lg bg-amber-500 px-3 text-xs font-bold text-slate-950 disabled:opacity-50">{busy ? 'Об’єднання…' : 'Підтвердити об’єднання'}</button><button type="button" disabled={busy} onClick={() => setConfirmation(null)} className="min-h-11 rounded-lg border border-slate-600 px-3 text-xs">Скасувати</button></div>
          </div> : <button type="button" disabled={busy || !quote?.success} onClick={() => {if(revision.current === stamp)setConfirmation(stamp);}} className="min-h-11 w-full rounded-lg border border-amber-600 bg-amber-950/40 px-3 text-sm text-amber-100 disabled:opacity-50">Піднести до {rank + 1}/{MAX_ITEM_ASCENSION}</button>}
        </>}
    </>}
    {message && <p role="status" className="text-xs text-amber-100">{message}</p>}
  </section>;
}
