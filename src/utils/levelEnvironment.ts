interface LevelRegion {
  id: string;
  minLevel: number;
  levelRange: string;
}

export function levelEnvironment(level: number) {
  if (level < 25) return { name: 'Земли начинающих', range: '1–24', icon: '🌿', color: 'border-emerald-500/30 bg-emerald-950/40 text-emerald-200' };
  if (level < 55) return { name: 'Земли опытных героев', range: '25–54', icon: '⚔️', color: 'border-amber-500/30 bg-amber-950/40 text-amber-200' };
  return { name: 'Земли ветеранов', range: '55+', icon: '🐉', color: 'border-purple-500/30 bg-purple-950/40 text-purple-200' };
}

export function groupRegionsByLevel<T extends LevelRegion>(regions: readonly T[], level: number) {
  const highestRange = Math.max(...regions.map(region => Number(region.levelRange.match(/\d+/g)?.at(-1)) || region.minLevel));
  const groups = { recommended: [] as T[], earlier: [] as T[], future: [] as T[] };
  for (const region of regions) {
    const maxLevel = Number(region.levelRange.match(/\d+/g)?.at(-1)) || region.minLevel;
    if (level < region.minLevel) groups.future.push(region);
    else if (level <= maxLevel || maxLevel === highestRange) groups.recommended.push(region);
    else groups.earlier.push(region);
  }
  return groups;
}
