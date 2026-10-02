const MONSTER_ART_ROOT = '/assets/sprites/generated/monsters';

const authoredMonsterArt = new Set([
  'm_wolf', 'm_goblin', 'm_boar', 'm_bandit', 'm_queen_bat', 'm_spider', 'm_stone_golem',
  'm_spider_queen', 'm_death_knight_boss', 'm_demon_lord', 'm_dragon_boss', 'm_sand_scorpion',
  'm_sand_guard', 'm_cursed_soldier', 'm_blood_hound', 'm_ash_imp', 'm_rift_drake',
  'm_peak_guard', 'm_scale_hunter'
]);

const regionalAliases: Record<string, string> = {
  elite_reg_plains: 'm_wolf',
  elite_reg_whisper_woods: 'm_wolf',
  elite_reg_forgotten_crypt: 'm_bandit',
  elite_reg_forest: 'm_spider',
  elite_reg_swamp: 'm_spider',
  elite_reg_desert: 'm_sand_guard',
  elite_reg_cursed: 'm_blood_hound',
  elite_reg_rift: 'm_rift_drake',
  elite_reg_dragon: 'm_scale_hunter',
  boss_reg_whisper_woods: 'm_queen_bat'
};

const isGeneratedMonsterImage = (value?: string) => Boolean(value && /^\/assets\/sprites\/generated\/monsters\/[^?#]+\.(?:png|webp)(?:[?#].*)?$/i.test(value));

/** Resolve monster portraits without touching combat data or the saved avatar values. */
export const getMonsterArtworkPath = (id: string, savedAvatar?: string): string => {
  let artId = authoredMonsterArt.has(id) ? id : regionalAliases[id];

  if (!artId && id.startsWith('ascension_echo_')) artId = 'm_demon_lord';
  if (!artId && id.startsWith('ascension_')) artId = 'm_dragon_boss';
  if (!artId && id.endsWith('_scout')) artId = 'm_bandit';
  if (!artId && id.startsWith('boss_')) artId = 'm_queen_bat';

  if (artId) return `${MONSTER_ART_ROOT}/${artId}.webp`;
  if (isGeneratedMonsterImage(savedAvatar)) return savedAvatar!;

  return `${MONSTER_ART_ROOT}/m_bandit.webp`;
};
