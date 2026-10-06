import React from 'react';
import { getMonsterArtworkPath } from '../fantasy/utils/monsterArtwork';
import { ChevronLeft, ChevronRight, MapPin, Skull, Swords } from 'lucide-react';
import { t as localize, useLocale } from '../../i18n/locale';
import { ModernLandscape } from './ModernLandscape';
import { MONSTERS, REGIONS } from '../../data/gameData';

type Monster = typeof MONSTERS[string];
export function HuntStage({ region, monsters, selected, onSelect }: {
  region: typeof REGIONS[number]; monsters: Monster[]; selected: Monster; onSelect: (id: string) => void;
}) {
  useLocale();
  const index = monsters.findIndex(monster => monster.id === selected.id);
  const step = (direction: number) => onSelect(monsters[(index + direction + monsters.length) % monsters.length].id);
  return <section className="modern-hunt-stage" aria-label={localize("Выбор противника")}>
    <ModernLandscape regionId={region.id} />
    <div className="modern-location"><MapPin size={18} />{localize(region.name)}</div>
    <img className="modern-hunt-monster" src={getMonsterArtworkPath(selected.id, selected.avatar)} alt={localize(selected.name)} key={selected.id} />
    {monsters.length > 1 && <><button className="modern-stage-arrow is-left" aria-label={localize("Предыдущий противник")} onClick={() => step(-1)}><ChevronLeft /></button><button className="modern-stage-arrow is-right" aria-label={localize("Следующий противник")} onClick={() => step(1)}><ChevronRight /></button></>}
    <div className="modern-hunt-caption"><h1>{localize(selected.name)}</h1><div className="flex flex-wrap gap-2"><span className="modern-tag">{localize("Ур. ")}{selected.level}</span><span className={`modern-tag ${selected.isBoss ? 'is-boss' : ''}`}>{selected.isBoss ? <Skull size={16} /> : <Swords size={16} />}{localize(selected.isBoss ? 'БОСС' : selected.isElite ? 'ЭЛИТА' : 'Обычный противник')}</span></div></div>
  </section>;
}
