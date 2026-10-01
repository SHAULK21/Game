import type {GameItem,ItemRarity} from '../types/game';

export const PICKAXES: {id:string;name:string;rarity:ItemRarity;miningLevel:number;price:number;critBonus:number;expBonus:number;color:string}[] = [
 {id:'pickaxe_common',name:'Кирка шахтёра',rarity:'common',miningLevel:1,price:250,critBonus:.15,expBonus:10,color:'#b3becb'},
 {id:'pickaxe_uncommon',name:'Усиленная кирка',rarity:'uncommon',miningLevel:10,price:2000,critBonus:.3,expBonus:20,color:'#79d698'},
 {id:'pickaxe_rare',name:'Мифриловая кирка',rarity:'rare',miningLevel:25,price:10000,critBonus:.6,expBonus:35,color:'#6ec9ff'},
 {id:'pickaxe_epic',name:'Руническая кирка',rarity:'epic',miningLevel:50,price:40000,critBonus:.9,expBonus:55,color:'#cb9cff'},
 {id:'pickaxe_legendary',name:'Кирка Горного короля',rarity:'legendary',miningLevel:80,price:150000,critBonus:1.2,expBonus:80,color:'#ffd16d'}
];
export const getPickaxeBonus = (item?: Pick<GameItem,'type'|'templateId'> | null) => item?.type === 'pickaxe' ? PICKAXES.find(p=>p.id===item.templateId) : undefined;
export const pickaxeArtwork = (color:string) => 'data:image/svg+xml,'+encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs><linearGradient id="m" x2="1" y2="1"><stop stop-color="#fff"/><stop offset=".45" stop-color="${color}"/><stop offset="1" stop-color="#45506d"/></linearGradient></defs><path d="m20 53 21-31" stroke="#483428" stroke-width="9" stroke-linecap="round"/><path d="m20 51 20-30" stroke="#bc8b58" stroke-width="5" stroke-linecap="round"/><path d="M9 28Q30 2 56 21L42 17 29 17z" fill="url(#m)" stroke="${color}" stroke-width="2"/><path d="m36 15 8 5-5 7-8-5z" fill="url(#m)" stroke="#e9e5db"/><path d="m22 44 5 3m0-11 5 3" stroke="#e0b88b" stroke-width="2"/></svg>`);
export function makePickaxe(id:string,instanceId:string): GameItem {
 const p=PICKAXES.find(p=>p.id===id);if(!p)throw new Error('Кирка не найдена.');
 return {id:instanceId,templateId:p.id,name:p.name,type:'pickaxe',rarity:p.rarity,level:1,upgradeLevel:0,icon:'⛏️',image:pickaxeArtwork(p.color),stats:{},description:`Шахта: +${p.critBonus} п.п. к шансу крита, +${p.expBonus}% опыта горного дела.`,sellPrice:Math.floor(p.price*.15),disassembleYield:{silver:Math.floor(p.price*.1)},stackCount:1};
}
// The vein defines its range; its maximum is reserved for a rare critical.
export const miningYieldRange = (node:{baseYieldMin:number;baseYieldMax:number}) => ({min:node.baseYieldMin,max:node.baseYieldMax});
export function miningCritChance(level:number,pickaxe?:GameItem,luck=0,achievement=false) {
 return Math.min(.025,Math.max(.004,.008-Math.max(0,level-1)*.00003)+(getPickaxeBonus(pickaxe)?.critBonus||0)/100+Math.min(.003,Math.max(0,luck)*.00003)+(achievement ? .001 : 0));
}
export function rollMiningYield(level:number,critChance:number,rng=Math.random,range={min:1,max:5}) {
 const min=Math.max(1,Math.floor(range.min)),max=Math.max(min+1,Math.floor(range.max));
 if(rng()<critChance)return {count:max,isCrit:true};
 const choices=max-min;
 if(choices===1)return {count:min,isCrit:false};
 const depth=Math.min(100,Math.max(1,level))-1;
 const weights=choices===2?[85+depth*.05,15-depth*.05]:[60+depth*.12,28-depth*.12,...Array(choices-2).fill(12/(choices-2))];
 let roll=rng()*100;
 for(let i=0;i<weights.length;i++){roll-=weights[i];if(roll<0)return {count:min+i,isCrit:false};}
 return {count:max-1,isCrit:false};
}
export const miningExperience = (base:number,pickaxe?:GameItem) => Math.round(base*(1+(getPickaxeBonus(pickaxe)?.expBonus||0)/100));
