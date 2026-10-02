import { HeroReferenceArt, type HeroReferenceRegion } from '../ui/HeroReferenceArt';
import { t as localize, useLocale, intlLocale } from '../../../../i18n/locale';
import type { CombatStats } from '../../../../types/game';

export function HeroStats({ stats }: { stats: CombatStats }) {
  useLocale();
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
    <div className="codex-stat-grid">{main.map(row => <div className="codex-stat" key={row.label}><HeroReferenceArt region={row.icon} className="hero-stat-icon"/><span>{localize(row.label)}</span><strong>{localize(row.value.toLocaleString(intlLocale()))}</strong></div>)}</div>
    {groups.map((group,i) => <details key={group.title} className="codex-detail"><summary><HeroReferenceArt region={(['critical','accuracy','recovery','rewards','defense'] as const)[i]} className="hero-stat-icon"/>{localize(group.title)}</summary><div>{group.rows.map(([label,value]) => <div className="codex-stat" key={label}><span>{localize(label)}</span><strong>{localize(value)}</strong></div>)}</div></details>)}
  </section>;
}
