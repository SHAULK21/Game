import { ARENA_BOTS } from '../data/arenaOpponents';
import type { ArenaOpponent, Monster, MonsterSkill } from '../types/game';
import { getNextExperience } from './progression';

const STYLES = [
  {difficulty:.75,exp:.10,label:'Учебный бой',tactic:'Щитоносец: крепкая защита, медленные удары',hp:1.15,attack:.85,defense:1.3,speed:.75},
  {difficulty:.9,exp:.12,label:'Обычный бой',tactic:'Дуэлянт: быстрые удары и кровотечение',hp:.85,attack:1.05,defense:.75,speed:1.3},
  {difficulty:1,exp:.15,label:'Опытный гладиатор',tactic:'Архимаг: огонь и магический урон',hp:.9,attack:1.1,defense:.8,speed:1},
  {difficulty:1.1,exp:.17,label:'Ветеран арены',tactic:'Некромант: проклятие ослабляет защиту',hp:1,attack:1.05,defense:.9,speed:1},
  {difficulty:1.25,exp:.20,label:'Сложный бой',tactic:'Берсерк: мощный натиск, слабая броня',hp:1.1,attack:1.2,defense:.7,speed:1.1},
  {difficulty:1.4,exp:.23,label:'Чемпион арены',tactic:'Командир: тяжёлая броня и сокрушительный удар',hp:1.2,attack:1.1,defense:1.35,speed:.85}
] as const;
export type Gladiator = ArenaOpponent & {expReward:number;difficultyLabel:string;tactic:string};

/** Scale with hero level, never with equipment: upgrades retain their advantage. */
export function arenaOpponents(heroLevel:number):Gladiator[] {
  const level=Math.max(1,Math.floor(heroLevel));
  return ARENA_BOTS.map((base,index)=>{
    const style=STYLES[index];
    const stats={hp:Math.round((125+level*25+Math.pow(level,1.4)*2)*style.difficulty*style.hp),
      attack:Math.round((13+level*3.5)*style.difficulty*style.attack),
      defense:Math.round((7+level*.65)*style.difficulty*style.defense),
      speed:Math.round((10+level*.35)*style.speed),critChance:base.stats.critChance};
    return {...base,level,stats,powerRating:Math.round(stats.hp*.3+stats.attack*3+stats.defense*2+stats.speed),
      expReward:Math.round(getNextExperience(level)*style.exp),difficultyLabel:style.label,tactic:style.tactic};
  });
}

/** Resolve by catalog ID, so stale UI stats and rewards never carry into a new fight. */
export function arenaMonster(id:string,heroLevel:number):Monster|undefined {
  const opponent=arenaOpponents(heroLevel).find(opp=>opp.id===id);
  if(!opponent)return undefined;
  const caster=['mage','necromancer'].includes(opponent.characterClass);
  const effect:MonsterSkill['effect']=opponent.characterClass==='rogue'?'bleed':opponent.characterClass==='mage'?'burn':opponent.characterClass==='necromancer'?'vulnerability':undefined;
  const damageType=caster?opponent.characterClass==='mage'?'fire':'dark':'physical';
  const signature:MonsterSkill={id:id+'_signature',name:opponent.characterClass==='rogue'?'Порез дуэлянта':opponent.characterClass==='mage'?'Огненный залп':opponent.characterClass==='necromancer'?'Проклятие арены':opponent.characterClass==='berserker'?'Натиск берсерка':'Сокрушительный удар',
    icon:opponent.avatar,manaCost:15,cooldown:3,damageMultiplier:1.35,damageType,actionKind:'super',effect,effectChance:effect ? .65 : undefined,effectDuration:2,effectPower:effect==='vulnerability'?15:Math.max(2,Math.round(opponent.stats.attack*.15)),description:opponent.tactic};
  const skills:MonsterSkill[]=[signature];
  if(['warrior','paladin'].includes(opponent.characterClass)) skills.push({id:id+'_guard',name:'Стойка гладиатора',icon:'🛡️',manaCost:10,cooldown:5,damageMultiplier:0,damageType:'physical',actionKind:'defend',effect:'fortify',effectChance:1,effectDuration:2,effectPower:20});
  return {id:'gladiator_'+id,name:'Гладиатор '+opponent.name,regionId:'arena',level:opponent.level,
    hp:opponent.stats.hp,maxHp:opponent.stats.hp,mp:90,maxMp:90,
    attack:caster?Math.round(opponent.stats.attack*.6):opponent.stats.attack,
    magicAttack:caster?opponent.stats.attack:0,defense:opponent.stats.defense,magicDefense:Math.round(opponent.stats.defense*.85),
    speed:opponent.stats.speed,critChance:opponent.stats.critChance,evasion:opponent.characterClass==='rogue'?10:4,
    isBoss:false,avatar:opponent.avatar,damageType,expReward:opponent.expReward,goldReward:0,drops:[],skills};
}
