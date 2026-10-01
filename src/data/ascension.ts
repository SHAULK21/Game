import type {CharacterClassId,PlayerCharacter,Monster,Skill,MonsterSkill} from '../types/game';

export const ASCENSION_RANKS = ['E','D','C','B','A','S','SS','SSS'] as const;
export type AscensionRank = typeof ASCENSION_RANKS[number];
export type AscensionPath = 'precision'|'ward'|'flow';
export interface AscensionState {rank:AscensionRank;primary?:AscensionPath;secondary?:AscensionPath;trialsWon:AscensionRank[];echoWeek?:string;echoWins?:string[];season?:string;seasonWins?:number;titles?:string[]}
export const initialAscension = ():AscensionState => ({rank:'E',trialsWon:[]});
export const ASCENSION_STAGES = [
 {rank:'D',name:'Страж порога',hp:1800,power:80,defense:25,silver:500,fragments:3,reward:'Выбор первой пассивки',hint:'Периодически готовит сокрушительный удар. Защищайтесь перед сильным ударом.'},
 {rank:'C',name:'Рыцарь зеркального щита',hp:4800,power:150,defense:100,silver:1500,fragments:8,reward:'Новый классовый навык',hint:'Чередует обычную и усиленную защиту. Пробитие и эффекты помогают преодолеть броню.'},
 {rank:'B',name:'Хранитель живого пламени',hp:10000,power:260,defense:130,silver:4000,fragments:16,reward:'Усиление первой пассивки',hint:'Периодически лечится. Контроль позволяет пропустить его ход лечения.'},
 {rank:'A',name:'Судья трёх стихий',hp:22000,power:420,defense:220,silver:10000,fragments:30,reward:'Выбор второй пассивки',hint:'Чередует физические и магические атаки; после потери половины HP усиливается.'},
 {rank:'S',name:'Повелитель разлома',hp:48000,power:720,defense:350,silver:25000,fragments:50,reward:'Классовый навык вознесения',hint:'Лечится и накладывает уязвимость. Сохраните контроль и защиту для опасных ходов.'},
 {rank:'SS',name:'Владыка пустоты',hp:95000,power:1100,defense:500,silver:60000,fragments:85,reward:'Сочетание пассивок и усиление нового навыка',hint:'Две фазы, укрепление и магические удары. Меняйте атаку и оборону.'},
 {rank:'SSS',name:'Первый вознесённый',hp:190000,power:1700,defense:750,silver:150000,fragments:140,reward:'Эволюция навыка вознесения',hint:'Три фазы: усиление ниже 65% и 30% HP. Чередует сокрушительный удар и лечение.'}
] as const;
export const nextAscensionStage=(state?:AscensionState)=>ASCENSION_STAGES.find(s=>ASCENSION_RANKS.indexOf(s.rank)===ASCENSION_RANKS.indexOf(state?.rank||'E')+1);

const CLASS_NAMES:Record<CharacterClassId,[string,string,string,string,string]>={
 warrior:['Ритм клинка','Стойкость ветерана','Дыхание битвы','Рассекающий натиск','Воля полководца'],
 berserker:['Кровавое преследование','Несгибаемая ярость','Боевой экстаз','Рваная рана','Последний натиск'],
 knight:['Суд ордена','Бастион ордена','Клятва хранителя','Щит присяги','Несокрушимый страж'],
 rogue:['Поиск слабости','Осторожный шаг','Ловкость рук','Отвлекающий порез','Танец клинков'],
 assassin:['Метка охотника','Покров тени','Холодный расчёт','Теневой прокол','Печать ликвидатора'],
 archer:['Уязвимая цель','Шаг следопыта','Спокойное дыхание','Сковывающая стрела','Залп следопыта'],
 mage:['Резонанс стихий','Магический заслон','Арканный поток','Ледяная печать','Разлом стихий'],
 necromancer:['Проклятая метка','Костяной оберег','Шёпот духов','Метка увядания','Суд мёртвых'],
 paladin:['Праведный суд','Священный покров','Свет клятвы','Удар очищения','Восход света'],
 druid:['Зов хищника','Кора хранителя','Живая влага','Опутывающие корни','Гнев рощи']
};
export const passiveChoices=(classId:CharacterClassId)=>[
 {id:'precision' as const,name:CLASS_NAMES[classId][0],description:'Урон по противнику с ядом, ожогом, кровотечением или уязвимостью увеличен на 3%.'},
 {id:'ward' as const,name:CLASS_NAMES[classId][1],description:'Действие «Защита» дополнительно восстанавливает 2% максимального HP.'},
 {id:'flow' as const,name:CLASS_NAMES[classId][2],description:'После навыка возвращается 8% фактически потраченной маны (минимум 1, если навык платный).'}
];
export const ascensionBonuses=(state?:AscensionState)=>{
 const tier=ASCENSION_RANKS.indexOf(state?.rank||'E');
 const first=tier>=3?1.5:1;
 const power=(id:AscensionPath)=>state?.primary===id&&tier>=1?first:state?.secondary===id&&tier>=4?1:0;
 return {afflictedDamage:3*power('precision'),defendHeal:2*power('ward'),manaReturn:8*power('flow'),synergy:tier>=6&&Boolean(state?.primary&&state?.secondary),ultimateEvolution:tier>=7};
};
export function ascensionSkills(classId:CharacterClassId,state:AscensionState):Skill[] {
 const tier=ASCENSION_RANKS.indexOf(state.rank);if(tier<2)return [];
 const magical=['mage','necromancer','druid'].includes(classId);
 const common={classId,levelReq:1,currentCooldown:0,damageType:magical?'magic' as const:'physical' as const};
 const first:Skill={...common,id:`asc_${classId}_C`,name:CLASS_NAMES[classId][3],description:'Классовый приём ранга C. Перезарядка 4 хода.',icon:'✦',manaCost:20,cooldown:4,damageMultiplier:1.4};
 switch(classId){
  case 'warrior':first.hits=2;first.armorBreak=10;first.description+=' Два удара; уязвимость +10% получаемого урона на 3 хода.';break;
  case 'berserker':first.inflicts={type:'bleed',chance:1,duration:2,power:12};first.description+=' Кровотечение 2 хода.';break;
  case 'knight':first.damageMultiplier=0;first.inflicts={type:'shield',chance:1,duration:2,power:150};first.description+=' Щит: максимум из 150 и 6% максимального HP, 2 хода.';break;
  case 'rogue':first.inflicts={type:'vulnerability',chance:1,duration:2,power:10};first.description+=' Уязвимость +10% получаемого урона на 2 хода.';break;
  case 'assassin':first.guaranteedHit=true;first.armorBreak=15;first.description+=' Безошибочный удар; уязвимость +15% получаемого урона на 3 хода.';break;
  case 'archer':first.inflicts={type:'stun',chance:.5,duration:1,power:0};first.description+=' 50% шанс оглушения на 1 ход.';break;
  case 'mage':first.damageType='ice';first.inflicts={type:'freeze',chance:.5,duration:1,power:0};first.description+=' 50% шанс заморозки на 1 ход.';break;
  case 'necromancer':first.damageType='dark';first.inflicts={type:'poison',chance:1,duration:3,power:12};first.description+=' Яд на 3 хода.';break;
  case 'paladin':first.damageMultiplier=0;first.healMultiplier=1.5;first.inflicts={type:'shield',chance:1,duration:1,power:60};first.description+=' Лечение: 150 HP или 6% максимального HP; щит: 60 или 2,4% HP (большее значение).';break;
  case 'druid':first.inflicts={type:'poison',chance:1,duration:3,power:10};first.description+=' Яд на 3 хода.';break;
 }
 if(tier>=6){first.cooldown=3;first.description=first.description.replace('4 хода','3 хода')+' Усиление SS: перезарядка сокращена.';}
 if(tier<5)return [first];
 const ultimate:Skill={...common,id:`asc_${classId}_S`,name:CLASS_NAMES[classId][4],description:'Приём вознесения ранга S. Перезарядка 7 ходов.',icon:'🌟',isUltimate:true,manaCost:40,cooldown:7,damageMultiplier:2};
 if(['warrior','rogue','archer'].includes(classId))ultimate.hits=2;
 if(['berserker','assassin'].includes(classId)){ultimate.executeThreshold=.3;ultimate.executeMultiplier=1.3;ultimate.description+=' +30% урона по цели ниже 30% HP.';}
 if(classId==='knight'){ultimate.damageMultiplier=1.1;ultimate.inflicts={type:'shield',chance:1,duration:2,power:250};ultimate.description+=' Щит: 250 или 10% максимального HP (большее значение).';}
 if(classId==='mage'){ultimate.damageType='lightning';ultimate.inflicts={type:'vulnerability',chance:1,duration:2,power:10};}
 if(classId==='necromancer'){ultimate.damageType='dark';ultimate.poisonBurst=true;ultimate.description+=' Взрывает накопленный яд.';}
 if(classId==='paladin'){ultimate.damageMultiplier=0;ultimate.healMultiplier=3;ultimate.inflicts={type:'shield',chance:1,duration:2,power:180};ultimate.description+=' Лечение: 300 HP или 12% максимального HP; щит: 180 или 7,2% HP (большее значение).';}
 if(classId==='druid')ultimate.inflicts={type:'poison',chance:1,duration:3,power:25};
 if(tier>=7){
  ultimate.cooldown=6;ultimate.damageMultiplier*=1.15;
  if(ultimate.healMultiplier)ultimate.healMultiplier*=1.15;
  if(ultimate.inflicts&&ultimate.inflicts.power>0)ultimate.inflicts.power=Math.round(ultimate.inflicts.power*1.15);
  ultimate.description=ultimate.description.replace('7 ходов','6 ходов');
  ultimate.description+=' Эволюция SSS: +15% к силе приёма, перезарядка 6 ходов.';
 }
 if(classId==='paladin')ultimate.description=`Лечение: ${Math.round(100*ultimate.healMultiplier!)} HP или ${(4*ultimate.healMultiplier!).toFixed(1)}% максимального HP; щит: ${ultimate.inflicts!.power} или ${(ultimate.inflicts!.power/25).toFixed(1)}% HP (большее значение). Перезарядка ${ultimate.cooldown} ходов.`;
 if(classId==='knight')ultimate.description=`Удар и щит: ${ultimate.inflicts!.power} или ${(ultimate.inflicts!.power/25).toFixed(1)}% максимального HP (большее значение). Перезарядка ${ultimate.cooldown} ходов.`;
 return [first,ultimate];
}
export function migrateAscension(player:PlayerCharacter):PlayerCharacter {
 const old=player.ascension;
 const rank=old&&ASCENSION_RANKS.includes(old.rank)?old.rank:'E';
 const valid=(v:unknown):v is AscensionPath=>['precision','ward','flow'].includes(String(v));
 const state:AscensionState={...old,rank,primary:valid(old?.primary)?old.primary:undefined,secondary:valid(old?.secondary)&&old.secondary!==old.primary?old.secondary:undefined,trialsWon:(Array.isArray(old?.trialsWon)?old.trialsWon:[]).filter(r=>ASCENSION_RANKS.includes(r))};
 const originals=player.skills.filter(s=>!s.id.startsWith('asc_'));
 const added=ascensionSkills(player.classId,state).map(skill=>({...skill,currentCooldown:player.skills.find(s=>s.id===skill.id)?.currentCooldown||0}));
 return {...player,ascension:state,skills:[...originals,...added]};
}
export const fragmentCount=(player:PlayerCharacter)=>player.inventory.filter(i=>i.templateId==='ascension_fragment'&&!i.isLocked&&!i.boundToClan&&!i.serverOwned).reduce((n,i)=>n+(i.stackCount||1),0);
export function ascendCharacter(player:PlayerCharacter,choice?:AscensionPath):{player:PlayerCharacter;success:boolean;message:string} {
 const state=player.ascension||initialAscension();const stage=nextAscensionStage(state);
 const fail=(message:string)=>({player,success:false,message});
 if(!stage)return fail('Максимальный ранг SSS уже достигнут.');
 if(!state.trialsWon.includes(stage.rank))return fail('Сначала победите хранителя следующего ранга.');
 if((stage.rank==='D'||stage.rank==='A')&&(!passiveChoices(player.classId).some(p=>p.id===choice)||stage.rank==='A'&&choice===state.primary))return fail('Выберите новую пассивку.');
 if(player.silver<stage.silver||fragmentCount(player)<stage.fragments)return fail('Не хватает серебра или осколков вознесения.');
 let remaining=stage.fragments;const inventory=player.inventory.flatMap(i=>{if(!remaining||i.templateId!=='ascension_fragment'||i.isLocked||i.boundToClan||i.serverOwned)return [i];const count=i.stackCount||1;const spent=Math.min(count,remaining);remaining-=spent;return count>spent?[{...i,stackCount:count-spent}]:[];});
 const next={...player,silver:player.silver-stage.silver,inventory,ascension:{...state,rank:stage.rank,primary:stage.rank==='D'?choice:state.primary,secondary:stage.rank==='A'?choice:state.secondary}};
 return {player:migrateAscension(next),success:true,message:`Вознесение завершено: ранг ${stage.rank}.`};
}
export function ascensionBoss(rank:AscensionRank):Monster {
 const s=ASCENSION_STAGES.find(s=>s.rank===rank);if(!s)throw new Error('Испытание не найдено.');
 const index=ASCENSION_STAGES.indexOf(s);
 const heavy={id:'asc_heavy',name:'Удар хранителя',icon:'💥',manaCost:0,cooldown:3,currentCooldown:1,damageMultiplier:1.8,damageType:'physical' as const,description:'Сильный удар. Защита перед его ходом уменьшает полученный урон.'};
 const skills:MonsterSkill[]=[heavy];
 if(index>=2)skills.push({id:'asc_heal',name:'Живой источник',icon:'💚',manaCost:0,cooldown:4,currentCooldown:3,damageMultiplier:0,damageType:'physical',description:'Восстановит до 5% HP, максимум удвоенную атаку. Контроль заставляет пропустить ход.'});
 if(index>=3)skills.push({id:'asc_magic',name:'Печать разлома',icon:'🌑',manaCost:0,cooldown:4,currentCooldown:2,damageMultiplier:1.5,damageType:'magic',...(index>=4?{effect:'vulnerability' as const,effectChance:1,effectDuration:2,effectPower:10}:{}),description:index>=4?'Магический удар и уязвимость на 2 хода.':'Магический удар.'});
 return {id:`ascension_${rank}`,name:s.name,regionId:'ascension',level:1,hp:s.hp,maxHp:s.hp,mp:100,maxMp:100,attack:s.power,magicAttack:s.power,defense:s.defense,magicDefense:s.defense,speed:15+index*4,critChance:5,evasion:5,isBoss:true,bossPhase:1,avatar:'👑',expReward:0,goldReward:0,drops:[],skills};
}
export function ascensionBossPhase(monster:Monster):number {
 if(monster.regionId!=='ascension')return 1;
 const ratio=monster.hp/monster.maxHp;
 if(monster.id==='ascension_SSS'||monster.id.startsWith('ascension_echo_'))return ratio<=.3?3:ratio<=.65?2:1;
 return ['ascension_A','ascension_S','ascension_SS'].includes(monster.id)&&ratio<=.5?2:1;
}
export const ASCENSION_FRAGMENT_DESCRIPTION = 'Для вознесения на арене. Где взять: победите босса мира или подземелья — шанс выпадения 40%, по 1 осколку за победу. Также можно купить у других игроков на рынке. Хранители арены осколки не дают.';
export const fragmentItem=(id:string)=>({id,templateId:'ascension_fragment',name:'Осколок вознесения',type:'material' as const,rarity:'rare' as const,level:1,upgradeLevel:0,icon:'✦',stats:{},sellPrice:0,disassembleYield:{},stackCount:1,description:ASCENSION_FRAGMENT_DESCRIPTION});

export const ASCENSION_ECHOES = [
 {id:'storm',name:'Эхо бури',hint:'Хранитель имеет на 30% больше HP и наносит на 20% больше урона.'},
 {id:'control',name:'Эхо самообладания',hint:'Во время испытания нельзя использовать зелья.'},
 {id:'eternity',name:'Эхо вечности',hint:'Хранитель восстанавливает 8% HP вместо 5%.'}
] as const;
export const ascensionWeek=(now=Date.now())=>{const d=new Date(now);d.setUTCDate(d.getUTCDate()-((d.getUTCDay()+6)%7));return d.toISOString().slice(0,10);};
export const ascensionSeason=(now=Date.now())=>new Date(now).toISOString().slice(0,7);
export function ascensionEcho(id:string):Monster {
 const echo=ASCENSION_ECHOES.find(e=>e.id===id);if(!echo)throw new Error('Испытание не найдено.');
 const boss=ascensionBoss('SSS');const hp=Math.round(boss.maxHp*(id==='storm'?1.3:1));
 return {...boss,id:'ascension_echo_'+id,name:echo.name,hp,maxHp:hp,attack:Math.round(boss.attack*(id==='storm'?1.2:1)),magicAttack:Math.round(boss.magicAttack*(id==='storm'?1.2:1))};
}
export function recordAscensionEcho(player:PlayerCharacter,id:string,now=Date.now()):{player:PlayerCharacter;rewarded:boolean} {
 const state=player.ascension;if(state?.rank!=='SSS'||!ASCENSION_ECHOES.some(e=>e.id===id))return {player,rewarded:false};
 const week=ascensionWeek(now);const wins=state.echoWeek===week?state.echoWins||[]:[];
 if(wins.includes(id))return {player,rewarded:false};
 const nextWins=[...wins,id];const season=ascensionSeason(now);const score=(state.season===season?state.seasonWins||0:0)+1;
 const title=nextWins.length===3?`Повелитель эха · ${season}`:null;
 return {player:{...player,silver:player.silver+3000,ascension:{...state,echoWeek:week,echoWins:nextWins,season,seasonWins:score,titles:title?[...new Set([...(state.titles||[]),title])]:state.titles||[]}},rewarded:true};
}
