import { CharacterAttributes, CharacterClassId, PlayerCharacter, Skill } from '../types/game';

const skill = (classId: CharacterClassId, id: string, name: string, levelReq: number, damageMultiplier: number, damageType: Skill['damageType'], extras: Partial<Skill> = {}): Skill => ({
  classId, id, name, description: extras.description || [
    damageMultiplier ? `${Math.round(damageMultiplier * 100)}% урона${extras.hits ? ` за ${extras.hits} отдельных удара` : ''}` : 'Поддержка без прямого урона',
    extras.inflicts ? `эффект ${extras.inflicts.type} на ${extras.inflicts.duration} хода` : '',
    extras.comboFrom ? 'усиливается после связки' : '',
    extras.executeThreshold ? `усиление при HP цели ниже ${Math.round(extras.executeThreshold * 100)}%` : '',
    extras.guaranteedHit ? 'не промахивается' : '',
    extras.poisonBurst ? 'взрывает накопленный яд' : ''
  ].filter(Boolean).join(' · ') + '.', levelReq,
  manaCost: levelReq >= 6 ? 40 : 20, cooldown: levelReq >= 6 ? 4 : 3,
  currentCooldown: 0, damageMultiplier, damageType, icon: extras.icon || '✨', ...extras
});

// Extra skills live in data, so the combat resolver does not need a branch for every skill ID.
export const CLASS_SKILLS: Record<CharacterClassId, Skill[]> = {
  warrior: [skill('warrior','w_charge','Боевой натиск',4,1.65,'physical',{armorBreak:15,icon:'🪓'})],
  berserker: [skill('berserker','b_blood','Кровавый шквал',4,1.85,'physical',{hits:2,icon:'🩸'})],
  knight: [skill('knight','k_counter','Ответный удар',4,1.7,'physical',{comboFrom:'k_bastion',comboMultiplier:1.3,icon:'🛡️'}),skill('knight','k_judgement','Небесный суд',6,2.35,'holy',{isUltimate:true,icon:'☀️'})],
  rogue: [skill('rogue','r_burst','Взрыв токсина',5,1.5,'poison',{poisonBurst:true,comboFrom:'r_poison',comboMultiplier:1.2,icon:'☠️'})],
  assassin: [skill('assassin','a_stealth','Скрытность',3,0,'physical',{guaranteedEvade:true,icon:'🌑'}),skill('assassin','a_cut','Точный разрез',5,1.75,'physical',{executeThreshold:0.4,executeMultiplier:1.8,comboFrom:'a_stealth',comboMultiplier:1.25,icon:'🗡️'}),skill('assassin','a_final','Последний вздох',7,2.55,'physical',{isUltimate:true,executeThreshold:0.28,executeMultiplier:2,icon:'💀'})],
  archer: [skill('archer','arc_mark','Метка охотника',3,0.65,'physical',{inflicts:{type:'vulnerability',chance:1,duration:3,power:15},icon:'🎯'}),skill('archer','arc_pierce','Пробивающий выстрел',5,1.8,'physical',{armorBreak:20,guaranteedHit:true,comboFrom:'arc_mark',comboMultiplier:1.2,icon:'🏹'}),skill('archer','arc_rain','Ливень стрел',6,2.2,'physical',{hits:3,isUltimate:true,comboFrom:'arc_mark',comboMultiplier:1.25,icon:'🏹'})],
  mage: [skill('mage','m_storm','Грозовая цепь',5,1.9,'lightning',{comboFrom:'m_frost',comboMultiplier:1.25,icon:'⚡'})],
  necromancer: [skill('necromancer','n_curse','Проклятие',3,0.7,'dark',{inflicts:{type:'vulnerability',chance:1,duration:3,power:18},icon:'🕯️'}),skill('necromancer','n_touch','Касание смерти',5,1.6,'dark',{executeThreshold:0.3,executeMultiplier:2,instantExecutePve:true,comboFrom:'n_curse',comboMultiplier:1.25,icon:'☠️'}),skill('necromancer','n_legion','Легион душ',7,2.4,'dark',{hits:3,isUltimate:true,icon:'👻'})],
  paladin: [skill('paladin','p_aegis','Световой щит',4,0,'holy',{inflicts:{type:'shield',chance:1,duration:3,power:110},icon:'🛡️'}),skill('paladin','p_judgement','Кара небес',7,2.4,'holy',{isUltimate:true,comboFrom:'p_heal',comboMultiplier:1.3,icon:'🌟'})],
  druid: [skill('druid','d_bloom','Цветение',3,0,'poison',{healMultiplier:1.35,icon:'🌱'}),skill('druid','d_spores','Ядовитые споры',5,1.5,'poison',{inflicts:{type:'poison',chance:1,duration:3,power:24},comboFrom:'d_thorns',comboMultiplier:1.3,icon:'🍄'}),skill('druid','d_wrath','Гнев рощи',7,2.3,'poison',{hits:2,isUltimate:true,poisonBurst:true,icon:'🌳'})]
};

export const HIDDEN_SKILLS: Record<CharacterClassId, Skill> = {
  warrior: skill('warrior','w_hidden','Несокрушимый',25,2.1,'physical',{hidden:true,armorBreak:25,icon:'🛡️'}),
  berserker: skill('berserker','b_hidden','Багровое безумие',25,2.3,'physical',{hidden:true,hits:3,icon:'🔥'}),
  knight: skill('knight','k_hidden','Стальной бастион',25,1.8,'holy',{hidden:true,inflicts:{type:'shield',chance:1,duration:3,power:200},icon:'🏰'}),
  rogue: skill('rogue','r_hidden','Змеиная пляска',25,2.2,'poison',{hidden:true,hits:4,icon:'🐍'}),
  assassin: skill('assassin','a_hidden','Исчезновение',25,2.1,'physical',{hidden:true,guaranteedHit:true,executeThreshold:0.3,executeMultiplier:1.7,icon:'🌘'}),
  archer: skill('archer','arc_hidden','Безошибочный выстрел',25,2.3,'physical',{hidden:true,guaranteedHit:true,icon:'🎯'}),
  mage: skill('mage','m_hidden','Разлом стихий',25,2.4,'lightning',{hidden:true,comboFrom:'m_frost',comboMultiplier:1.3,icon:'🌌'}),
  necromancer: skill('necromancer','n_hidden','Владычество смерти',25,2.5,'dark',{hidden:true,healMultiplier:0.2,icon:'💀'}),
  paladin: skill('paladin','p_hidden','Второе солнце',25,2.1,'holy',{hidden:true,healMultiplier:0.3,icon:'☀️'}),
  druid: skill('druid','d_hidden','Сердце леса',25,2.1,'poison',{hidden:true,healMultiplier:0.25,icon:'🌿'})
};

export const PRIMARY_ATTRIBUTE: Record<CharacterClassId, keyof CharacterAttributes> = {
  warrior:'strength',berserker:'strength',knight:'vitality',rogue:'agility',assassin:'agility',archer:'agility',mage:'intelligence',necromancer:'intelligence',paladin:'spirit',druid:'spirit'
};

export function skillTier(player: PlayerCharacter): 1 | 2 | 3 | 4 {
  const primary = player.attributes[PRIMARY_ATTRIBUTE[player.classId]];
  if (player.level >= 70 && primary >= 250) return 4;
  if (player.level >= 40 && primary >= 150) return 3;
  if (player.level >= 20 && primary >= 80) return 2;
  return 1;
}

export function hiddenSkillReady(player: PlayerCharacter): boolean {
  const primary = player.attributes[PRIMARY_ATTRIBUTE[player.classId]];
  const secondary: keyof CharacterAttributes = ({warrior:'vitality',berserker:'vitality',knight:'willpower',rogue:'luck',assassin:'luck',archer:'luck',mage:'spirit',necromancer:'willpower',paladin:'strength',druid:'intelligence'} as const)[player.classId];
  return player.level >= 25 && primary >= 110 && player.attributes[secondary] >= 65;
}

export function reconcileSkills(player: PlayerCharacter, starting: Skill[]): PlayerCharacter {
  const available = [...starting, ...CLASS_SKILLS[player.classId]];
  const hidden = HIDDEN_SKILLS[player.classId];
  const unlocked = new Set(player.unlockedHiddenSkills || []);
  if (hiddenSkillReady(player)) unlocked.add(hidden.id);
  if (unlocked.has(hidden.id)) available.push(hidden);
  const existing = new Map((player.skills || []).map(s => [s.id,s]));
  return { ...player, unlockedHiddenSkills:[...unlocked], skills: available.map(s => ({...s,currentCooldown: existing.get(s.id)?.currentCooldown || 0})) };
}
