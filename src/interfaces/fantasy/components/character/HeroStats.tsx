import { useInterface } from '../../../../context/InterfaceContext';
import { RpgIcon, type RpgIconKind } from '../ui/RpgIcon';
import { HeroReferenceArt, type HeroReferenceRegion } from '../ui/HeroReferenceArt';
import { t as localize, useLocale, intlLocale } from '../../../../i18n/locale';
import type { CombatStats } from '../../../../types/game';

export function HeroStats({ stats }: { stats: CombatStats }) {
  useLocale();
  const { style } = useInterface();
  const betaIcons: Partial<Record<HeroReferenceRegion, RpgIconKind>> = { hp:'hp', mana:'skill', attack:'attack', magic:'skill', defense:'defend', magicDefense:'defend', critical:'attack', accuracy:'hunt', recovery:'hp', rewards:'gold' };
  const icon = (region: HeroReferenceRegion) => style === 'fantasy-beta' ? <RpgIcon kind={betaIcons[region] || 'character'} size={26} className="hero-stat-icon"/> : <HeroReferenceArt region={region} className="hero-stat-icon"/>;
  const main: Array<{ label: string; value: number; icon: HeroReferenceRegion }> = [
    { label: 'Здоровье', value: stats.maxHp, icon: 'hp' }, { label: 'Мана', value: stats.maxMp, icon: 'mana' },
    { label: 'Физ. атака', value: stats.attack, icon: 'attack' }, { label: 'Маг. атака', value: stats.magicAttack, icon: 'magic' },
    { label: 'Физ. защита', value: stats.defense, icon: 'defense' }, { label: 'Маг. защита', value: stats.magicDefense, icon: 'magicDefense' }
  ];
  const groups = [
    { title: 'Критические удары и пробитие', rows: [['Шанс крита', `${stats.critChance}%`], ['Урон крита', `${stats.critDamage}%`], ['Пробитие брони', `${stats.armorPenetration} ед.`]] },
    { title: 'Точность, уклонение и темп', rows: [['Меткость', `${Math.round(stats.accuracy)}%`], ['Уклонение', `${Math.round(stats.evasion)}%`], ['Скорость', stats.speed]] },
    { title: 'Восстановление', rows: [['Регенерация HP', `+${stats.hpRegen}`], ['Регенерация MP', `+${stats.mpRegen}`], ['Вампиризм', `${stats.vampirism}%`]] },
    { title: 'Бонусы наград', rows: [['Редкие находки', `+${stats.dropBonus}%`], ['Золото', `+${stats.goldBonus}%`], ['Опыт', `+${stats.expBonus}%`]] },
    { title: 'Сопротивления', rows: Object.entries(stats.resistances).map(([key, value]) => [({ physical: 'Физический урон', magic: 'Магический урон', fire: 'Огонь', ice: 'Лёд', lightning: 'Молния', poison: 'Яд', dark: 'Тьма', holy: 'Свет' } as Record<string,string>)[key] || key, `${value}%`]) }
  ];
  return <section aria-label={localize("Боевые характеристики")} className="codex-stats">
    <div className="codex-stat-grid">{main.map(row => <div className="codex-stat" key={row.label}>{icon(row.icon)}<span>{localize(row.label)}</span><strong>{localize(row.value.toLocaleString(intlLocale()))}</strong></div>)}</div>
    {groups.map((group,i) => <details key={group.title} className="codex-detail"><summary>{icon((['critical','accuracy','recovery','rewards','defense'] as const)[i])}{localize(group.title)}</summary><div>{group.rows.map(([label,value]) => <div className="codex-stat" key={label}><span>{localize(label)}</span><strong>{localize(value)}</strong></div>)}</div></details>)}
  </section>;
}
