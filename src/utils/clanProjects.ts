export const CLAN_PROJECTS = {
  arsenal: { name: 'Арсенал', description: '+5% урона рейду за ступень' },
  research: { name: 'Исследовательский зал', description: '+5% опыта и золота за победу в рейде за ступень' }
} as const;
export type ClanProject = keyof typeof CLAN_PROJECTS;
export function clanProjectCost(level: number) {
  const tier = Math.min(10, Math.max(0, level)) + 1;
  return { gold: 250 * tier, silver: 100 * tier, ore: 10 * tier };
}
export const clanRaidHealth = (level: number) => 10000 + (Math.min(15, Math.max(1, level)) - 1) * 2000;
export const clanRaidReward = (level: number, research = 0) => ({
  xp: Math.round((500 + (level - 1) * 100) * (1 + Math.min(10, research) * 0.05)),
  gold: Math.round((250 + (level - 1) * 75) * (1 + Math.min(10, research) * 0.05))
});

export function clanRaidItem(level: number, rare: boolean) {
  const tier=Math.min(15,Math.max(1,level));
  const scaling=1+(tier-1)*0.2;
  return { templateId: rare ? 'raid_relic' : 'raid_medallion',
    name: rare ? 'Реликвия кланового рейда' : 'Медальон кланового рейда',
    type:'amulet',rarity:rare?(tier>=10?'epic':'rare'):'uncommon',level:1,upgradeLevel:0,
    icon:rare?'🔮':'📿',stats:{maxHp:Math.round((rare?100:45)*scaling),maxMp:Math.round((rare?50:20)*scaling)},
    sellPrice:Math.round((rare?120:40)*scaling),disassembleYield:{silver:Math.round((rare?18:6)*scaling),ore:rare?2:1} };
}
