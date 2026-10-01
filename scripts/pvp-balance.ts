import { PVP_CLASSES, simulateDuel } from '../src/utils/pvp';
let seed=7;
const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
const results=PVP_CLASSES.map(classId=>{
  let wins=0,rounds=0,total=0;
  for(const opponent of PVP_CLASSES)if(opponent!==classId)for(let i=0;i<1000;i++){
    const r=simulateDuel({classId,stance:'balanced',name:'A'},{classId:opponent,stance:'balanced',name:'B'},random);
    wins+=r.winner==='attacker'?1:r.winner==='draw'?0.5:0;rounds+=r.rounds;total++;
  }
  const winRate=wins/total;
  if(winRate<0.4 || winRate>0.6)throw new Error(`${classId}: neutral win rate ${winRate}`);
  return {classId,matches:total,winPercent:Number((100*winRate).toFixed(1)),averageRounds:Number((rounds/total).toFixed(1))};
});
console.log(JSON.stringify(results,null,2));
