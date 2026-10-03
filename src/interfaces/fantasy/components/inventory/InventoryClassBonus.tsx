import type { CharacterClassId, GameItem } from '../../../../types/game';
import { CLASS_EQUIPMENT, getClassGearBonus } from '../../../../utils/classEquipment';
import { STAT_LABELS } from '../../../../utils/statLabels';
import { t, useLocale } from '../../../../i18n/locale';
const PERCENT=new Set(['critDamage','armorPenetration','critChance','evasion','accuracy','vampirism','darkResistance']);
export function InventoryClassBonus({item,characterClass}:{item:GameItem;characterClass:CharacterClassId}) {
  useLocale();const bonus=getClassGearBonus(item);if(!bonus)return null;
  const matches=bonus.targetClass===characterClass;
  return <div className="inventory-class-bonus">
    <p>+{bonus.value}{PERCENT.has(bonus.stat)?'%':''} {t(STAT_LABELS[bonus.stat] || bonus.stat)} · {t(CLASS_EQUIPMENT[bonus.targetClass].label)}</p>
    <p className={matches?'inventory-positive':''}>{t(matches ? item.isEquipped ? 'Бонус активен' : 'Активируется при экипировке' : 'Бонус неактивен: другой класс')}</p>
  </div>;
}
