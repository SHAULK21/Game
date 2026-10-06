import test from 'node:test';import assert from 'node:assert/strict';
import type {PlayerCharacter,CharacterClassId} from '../src/types/game';
import {recordAscensionEcho,ascensionEcho,ascensionWeek,ASCENSION_RANKS,ASCENSION_STAGES,initialAscension,migrateAscension,nextAscensionStage,ascendCharacter,ascensionSkills,ascensionBonuses,ascensionBoss,ascensionBossPhase,fragmentItem} from '../src/data/ascension';
const classes:CharacterClassId[]=['warrior','berserker','knight','rogue','assassin','archer','mage','necromancer','paladin','druid'];
const player=(classId:CharacterClassId)=>({classId,level:1,exp:123,nextExp:500,statPoints:17,talentPoints:22,gold:333,silver:1000000,attributes:{strength:19,agility:13,intelligence:11,vitality:15,luck:7,spirit:8,willpower:12},equipped:{weapon:{id:'old_weapon',stats:{attack:71},upgradeLevel:8}},talents:[{id:'paid',currentRank:5}],skills:[{id:'old_skill',name:'Существующий навык',damageMultiplier:2.7,cooldown:4,currentCooldown:2}],inventory:[{...fragmentItem('fragments'),stackCount:1000}],ascension:initialAscension()} as unknown as PlayerCharacter);
for(const classId of classes)test(`${classId}: all ascension ranks preserve original levels, attributes, talents, equipment and skills`,()=>{
 let p=player(classId);const original=structuredClone(p);assert.equal(migrateAscension({...p,ascension:undefined}).ascension?.rank,'E');
 for(const stage of ASCENSION_STAGES){
  p={...p,ascension:{...p.ascension!,trialsWon:[...p.ascension!.trialsWon,stage.rank]}};
  const result=ascendCharacter(p,stage.rank==='D'?'ward':stage.rank==='A'?'flow':undefined);assert.equal(result.success,true,result.message);p=result.player;
  for(const field of ['level','exp','nextExp','statPoints','talentPoints','gold','attributes','equipped','talents'] as const)assert.deepEqual(p[field],original[field],field);
  assert.deepEqual(p.skills.find(s=>s.id==='old_skill'),original.skills[0]);
  assert.equal(p.ascension?.rank,stage.rank);assert.ok(p.skills.filter(s=>s.id.startsWith('asc_')).every(s=>s.levelReq===1&&s.classId===classId));
  assert.deepEqual(migrateAscension(migrateAscension(p)),migrateAscension(p));
 }
 assert.equal(p.skills.length,3);assert.equal(nextAscensionStage(p.ascension),undefined);
 assert.equal(ascendCharacter(p).success,false);
});
test('trial, choice and material failures consume nothing and cannot skip ranks',()=>{
 const p=player('archer');assert.equal(ascendCharacter(p,'ward').player,p);
 const won={...p,ascension:{...p.ascension!,trialsWon:['D' as const]}};
 assert.equal(ascendCharacter(won).player,won);
 assert.equal(ascendCharacter({...won,silver:ASCENSION_STAGES[0].silver-1},'ward').success,false);
 assert.equal(ascendCharacter({...won,inventory:[]},'ward').success,false,'first rank requires dangerous-hunt fragments');
 const c={...p,ascension:{rank:'D' as const,primary:'ward' as const,trialsWon:['C' as const]},inventory:[{...fragmentItem('locked'),stackCount:10,isLocked:true}]};
 assert.equal(ascendCharacter(c).success,false,'locked fragments cannot pay for C');
 const success=ascendCharacter(won,'ward');assert.equal(success.player.silver,p.silver-ASCENSION_STAGES[0].silver);assert.equal(success.player.inventory[0].stackCount,998);
 assert.equal(ascendCharacter(success.player).success,false,'D victory cannot unlock C');
 const rankB={...p,ascension:{rank:'B' as const,primary:'ward' as const,trialsWon:['A' as const]}};assert.equal(ascendCharacter(rankB,'ward').success,false,'second choice must differ');
});
test('old characters have no combat bonuses; additions remain small and apply only after unlock',()=>{
 assert.deepEqual(ascensionBonuses(),{afflictedDamage:0,defendHeal:0,manaReturn:0,synergy:false,ultimateEvolution:false});
 assert.equal(ascensionBonuses({rank:'E',primary:'precision',trialsWon:[]}).afflictedDamage,0);
 for(const rank of ASCENSION_RANKS){const bonus=ascensionBonuses({rank,primary:'precision',secondary:'ward',trialsWon:[]});assert.ok(bonus.afflictedDamage<=4.5);assert.ok(bonus.defendHeal<=3);assert.ok(bonus.manaReturn<=12);}
 const c=ascensionSkills('archer',{rank:'C',trialsWon:[]});const ss=ascensionSkills('archer',{rank:'SS',trialsWon:[]});assert.equal(c[0].cooldown,4);assert.equal(ss[0].cooldown,3);
});
test('rank bosses are fixed, use no character level and expose healing and phase mechanics',()=>{
 for(const stage of ASCENSION_STAGES){const boss=ascensionBoss(stage.rank);assert.equal(boss.maxHp,stage.hp);assert.equal(boss.expReward,0);assert.equal(boss.goldReward,0);assert.equal(boss.regionId,'ascension');assert.equal(boss.isBoss,true);}
 const boss=ascensionBoss('SSS');assert.equal(ascensionBossPhase({...boss,hp:boss.maxHp*.5}),2);assert.equal(ascensionBossPhase({...boss,hp:boss.maxHp*.2}),3);assert.ok(boss.skills?.some(s=>s.id==='asc_heal'));assert.ok(boss.skills?.some(s=>s.effect==='vulnerability'));
});

test('SSS echo rewards are weekly, seasonal titles are cosmetic and duplicate victories never pay twice',()=>{
 let p:PlayerCharacter={...player('archer'),ascension:{rank:'SSS' as const,trialsWon:[]}};const original=structuredClone(p);const now=Date.parse('2026-10-01T12:00:00Z');
 for(const id of ['storm','control','eternity']){const reward=recordAscensionEcho(p,id,now);assert.equal(reward.rewarded,true);p=reward.player as typeof p;assert.equal(recordAscensionEcho(p,id,now).rewarded,false);}
 assert.equal(p.silver,original.silver+9000);assert.equal(p.ascension?.seasonWins,3);assert.equal(p.ascension?.titles?.length,1);assert.deepEqual(p.attributes,original.attributes);assert.deepEqual(p.equipped,original.equipped);assert.equal(p.level,original.level);
 assert.equal(recordAscensionEcho(p,'storm',Date.parse('2026-10-05T00:00:00Z')).rewarded,true);assert.equal(ascensionWeek(now),'2026-09-28');
 assert.equal(recordAscensionEcho({...p,ascension:{rank:'E',trialsWon:[]}},'storm',now).rewarded,false);
 assert.ok(ascensionEcho('storm').maxHp>ascensionBoss('SSS').maxHp);
});
