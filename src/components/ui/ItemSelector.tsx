import {SelectionField} from './SelectionField';
import {ItemArtwork} from './ItemArtwork';
import type {GameItem} from '../../types/game';
import {RARITY_COLORS} from '../../data/gameData';
import {t, useLocale} from '../../i18n/locale';
export function ItemSelector({items,value,onSelect,label,disabled=false}: {items:GameItem[];value:string;onSelect:(id:string)=>void;label:string;disabled?:boolean}) {
 useLocale();
 return <SelectionField aria-label={t(label)} value={value} disabled={disabled||!items.length} onChange={e=>onSelect(e.target.value)} renderChoice={id=>{
  const item=items.find(i=>i.id===id);if(!item)return t('Выберите предмет');
  return <span className="selection-item"><ItemArtwork item={item} size={42}/><span className="selection-item-copy"><strong>{t(item.name)}</strong><small className={RARITY_COLORS[item.rarity]?.text}>{t(RARITY_COLORS[item.rarity]?.label||item.rarity)} · {t('Ур. ')}{item.level}{item.upgradeLevel>0?` · +${item.upgradeLevel}`:''} · ×{item.stackCount||1}{item.isEquipped?' · '+t('Экипировано'):''}</small></span></span>;
 }}>
  <option value="" disabled>{t(items.length?'Выберите предмет':'Ничего не найдено')}</option>
  {items.map(item=><option key={item.id} value={item.id}>{t(item.name)} · {t(RARITY_COLORS[item.rarity]?.label||item.rarity)} · {t('Ур. ')}{item.level} · +{item.upgradeLevel||0} · ×{item.stackCount||1}</option>)}
 </SelectionField>;
}
