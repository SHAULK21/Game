import type { CombatStats } from '../../types/game';

const Stat = ({label,value}:{label:string;value:string|number}) => <div className="flex items-center justify-between gap-2 rounded-lg bg-slate-950/60 px-3 py-2.5 text-xs"><span className="text-slate-400">{label}</span><span className="font-mono font-semibold text-slate-100 tabular-nums">{value}</span></div>;
export function HeroStats({stats}:{stats:CombatStats}) {
 const groups = [
  {title:'Критические удары и пробитие',rows:[['Шанс крита',`${stats.critChance}%`],['Урон крита',`${stats.critDamage}%`],['Пробитие брони',`${stats.armorPenetration} ед.`]]},
  {title:'Точность, уклонение и темп',rows:[['Меткость',`${Math.round(stats.accuracy)}%`],['Уклонение',`${Math.round(stats.evasion)}%`],['Скорость',stats.speed]]},
  {title:'Восстановление',rows:[['Регенерация HP',`+${stats.hpRegen}`],['Регенерация MP',`+${stats.mpRegen}`],['Вампиризм',`${stats.vampirism}%`]]},
  {title:'Бонусы наград',rows:[['Редкие находки',`+${stats.dropBonus}%`],['Золото',`+${stats.goldBonus}%`],['Опыт',`+${stats.expBonus}%`]]},
  {title:'Сопротивления',rows:Object.entries(stats.resistances).map(([key,value])=>[({physical:'Физический урон',magic:'Магический урон',fire:'Огонь',ice:'Лёд',lightning:'Молния',poison:'Яд',dark:'Тьма',holy:'Свет'} as Record<string,string>)[key]||key,`${value}%`])}
 ];
 return <section className="space-y-3" aria-label="Боевые характеристики">
  <div className="ui-panel rounded-2xl border p-3 space-y-2"><h3 className="text-xs font-bold text-cyan-200">Основные показатели</h3><div className="grid grid-cols-2 gap-2">{[['Здоровье',stats.maxHp],['Мана',stats.maxMp],['Физ. атака',stats.attack],['Маг. атака',stats.magicAttack],['Физ. защита',stats.defense],['Маг. защита',stats.magicDefense]].map(([label,value])=><Stat key={label} label={String(label)} value={value}/>)}</div></div>
  {groups.map(group=><details key={group.title} className="rounded-xl border border-slate-800 bg-slate-900/40 px-3"><summary className="cursor-pointer py-3 text-xs font-semibold text-slate-300">{group.title}</summary><div className="space-y-1.5 pb-3">{group.rows.map(([label,value])=><Stat key={label} label={String(label)} value={value}/>)}</div></details>)}
 </section>;
}
