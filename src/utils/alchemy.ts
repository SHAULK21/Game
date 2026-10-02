import type { GameItem, ItemRarity } from '../types/game';

export const ALCHEMY_TOOLS: {id:string;name:string;rarity:ItemRarity;alchemyLevel:number;price:number;expBonus:number;extraChance:number;color:string}[] = [
  {id:'retort_common',name:'Реторта ученика',rarity:'common',alchemyLevel:1,price:250,expBonus:10,extraChance:1,color:'#b3becb'},
  {id:'retort_uncommon',name:'Усиленная реторта',rarity:'uncommon',alchemyLevel:10,price:2000,expBonus:20,extraChance:2,color:'#79d698'},
  {id:'retort_rare',name:'Кристальная реторта',rarity:'rare',alchemyLevel:25,price:10000,expBonus:35,extraChance:3,color:'#6ec9ff'},
  {id:'retort_epic',name:'Руническая реторта',rarity:'epic',alchemyLevel:50,price:40000,expBonus:55,extraChance:4,color:'#cb9cff'},
  {id:'retort_legendary',name:'Реторта великого алхимика',rarity:'legendary',alchemyLevel:80,price:150000,expBonus:80,extraChance:5,color:'#ffd16d'}
];
export const getAlchemyToolBonus = (item: Pick<GameItem,'type'|'templateId'> | undefined, level: number) => item?.type === 'alchemyTool' ? ALCHEMY_TOOLS.find(tool=>tool.id===item.templateId && level>=tool.alchemyLevel) : undefined;
export const alchemyExperience = (base:number,item:GameItem|undefined,level:number) => Math.round(base*(1+(getAlchemyToolBonus(item,level)?.expBonus||0)/100));
export const alchemyExtraYield = (item:GameItem|undefined,level:number,rng=Math.random) => {
  const chance=getAlchemyToolBonus(item,level)?.extraChance||0;
  return chance>0 && rng()<chance/100 ? 1 : 0;
};
export const alchemyProgress = (level:number,exp:number) => {
  const current=Math.max(0,exp-Math.max(0,level-1)*220);
  return {current,need:220,percent:level>=100?100:Math.min(100,Math.round(current/220*100)),maxed:level>=100};
};
export function makeAlchemyTool(id:string,instanceId:string):GameItem {
  const tool=ALCHEMY_TOOLS.find(t=>t.id===id);
  if(!tool)throw new Error('Реторта не найдена.');
  return {id:instanceId,templateId:tool.id,name:tool.name,type:'alchemyTool',rarity:tool.rarity,level:1,upgradeLevel:0,icon:'⚗️',image:'/assets/sprites/generated/ui/gear/alchemyTool.webp',stats:{},stackCount:1,sellPrice:Math.floor(tool.price*.15),disassembleYield:{silver:Math.floor(tool.price*.1)},description:`Алхимия: +${tool.expBonus}% опыта, ${tool.extraChance}% шанс сварить 1 дополнительное зелье без дополнительных затрат. Требуется ${tool.alchemyLevel} уровень алхимии.`};
}
