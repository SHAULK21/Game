export const PVP_CLASSES = ['warrior','berserker','knight','rogue','assassin','archer','mage','necromancer','paladin','druid'] as const;
export const PVP_CLASS_NAMES: Record<string,string> = {warrior:'Воин',berserker:'Берсерк',knight:'Рыцарь',rogue:'Разбойник',assassin:'Убийца',archer:'Лучник',mage:'Маг',necromancer:'Некромант',paladin:'Паладин',druid:'Друид'};
export const PVP_STANCES = ['balanced','assault','guard','control'] as const;
export type PvpStance = typeof PVP_STANCES[number];
export const STANCE_LABELS: Record<PvpStance,string> = {balanced:'Баланс',assault:'Натиск',guard:'Оборона',control:'Контроль'};
export type DuelFighter = { classId: string; stance: PvpStance; name: string };
export function simulateDuel(a: DuelFighter,b: DuelFighter,random = Math.random) {
  const make = (f:DuelFighter) => {
    const caster = ['mage','necromancer','druid'].includes(f.classId);
    let hp=1200,attack=130,defense=60,speed=50;
    if (f.classId==='knight') { hp=1450; attack=110; defense=78; speed=40; }
    if (f.classId==='paladin') { hp=1380; attack=112; defense=75; speed=40; }
    if (['rogue','assassin','archer'].includes(f.classId)) { hp=1100; attack=137; defense=50; speed=65; }
    if (f.classId==='berserker') {hp=1280;attack=142;defense=38;}
    if (f.classId==='rogue') attack=144;
    if (f.classId==='assassin') attack=149;
    if (f.classId==='archer') attack=142;
    if (caster) {hp=1100;attack=145;defense=55;}
    if (f.classId==='mage') {hp=1180;attack=148;}
    if (f.classId==='necromancer') hp=1150;
    if (f.classId==='druid') {hp=1150;attack=141;}
    if (f.stance==='assault') {attack*=1.18;defense*=0.8;}
    if (f.stance==='guard') {defense*=1.35;attack*=0.88;}
    if (f.stance==='control') {speed*=1.3;attack*=0.94;}
    return {...f,hp,maxHp:hp,attack,defense,speed,shield:0};
  };
  const fighters=[make(a),make(b)];const log:string[]=[];
  let rounds=0;
  for(let round=1;round<=30 && fighters.every(f=>f.hp>0);round++) {
    rounds=round;
    // Speed influences initiative without guaranteeing every opening strike.
    const initiativeChance = 0.5 + Math.max(-0.15, Math.min(0.15, (fighters[0].speed - fighters[1].speed) / 150));
    const first = random() < initiativeChance ? 0 : 1;
    for(const i of [first,1-first]) {
      const f=fighters[i],enemy=fighters[1-i]; if(f.hp<=0||enemy.hp<=0)break;
      const special=round%3===0;let multiplier=special?1.35:1;
      if(special && f.classId==='berserker') multiplier+= (1-f.hp/f.maxHp)*0.5;
      if(special && f.classId==='assassin') multiplier+=0.3;
      const evades=['rogue','archer'].includes(enemy.classId) && random()<(enemy.classId==='rogue'?0.16:0.12);
      const crit=random() < (f.classId==='archer'?0.22:0.12);
      const penetration=special && ['mage','assassin','warrior'].includes(f.classId)?0.5:1;
      let damage=evades?0:Math.max(25,Math.round(f.attack*multiplier*(crit?1.5:1)*(0.9+random()*0.2)-enemy.defense*penetration*0.55));
      const blocked=Math.min(enemy.shield,damage);enemy.shield-=blocked;damage-=blocked;enemy.hp=Math.max(0,enemy.hp-damage);
      if (f.classId==='necromancer' && damage>0) f.hp=Math.min(f.maxHp,f.hp+Math.round(damage*0.12));
      if(special && ['paladin','druid'].includes(f.classId)) f.hp=Math.min(f.maxHp,f.hp+(f.classId==='paladin'?80:60));
      if(special && ['knight','warrior'].includes(f.classId)) f.shield+=65;
      // Control counters assault; guard counters control; assault counters guard.
      if(special && ({control:'assault',guard:'control',assault:'guard'} as Record<string,string>)[f.stance]===enemy.stance) enemy.hp=Math.max(0,enemy.hp-35);
      log.push(`${round}. ${f.name}: ${evades?'промах':`${special?'приём · ':''}${damage} урона${crit?' · крит':''}`}. ${enemy.name}: ${Math.ceil(enemy.hp)} HP.`);
    }
  }
  const ratio=fighters.map(f=>f.hp/f.maxHp);
  const winner = Math.abs(ratio[0]-ratio[1])<0.001 ? 'draw' : ratio[0]>ratio[1]?'attacker':'defender';
  return {winner,rounds,log,hp:fighters.map(f=>Math.ceil(f.hp))};
}
export function pvpRatingDelta(a:number,b:number,result: 'attacker'|'defender'|'draw') {
  const expected=1/(1+Math.pow(10,(b-a)/400));
  return Math.round(24*((result==='draw'?0.5:result==='attacker'?1:0)-expected));
}
