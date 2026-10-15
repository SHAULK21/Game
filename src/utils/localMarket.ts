/** Shared resident economy. The server chooses the day; the client only previews it. */
export const RESIDENT_CATEGORIES = [
  {id:'material',label:'Материалы',minimum:8},
  {id:'ore',label:'Руда',minimum:10},
  {id:'fish',label:'Рыба',minimum:12},
  {id:'potion',label:'Зелья',minimum:15},
  {id:'equipment',label:'Экипировка',minimum:30}
] as const;
export type ResidentCategory = typeof RESIDENT_CATEGORIES[number]['id'];
export interface ResidentPricedItem {sellPrice?:unknown;type?:string;templateId?:string;rarity?:string;level?:number}
const dayFormatter=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Kyiv',year:'numeric',month:'2-digit',day:'2-digit'});
export function residentMarketDay(now=new Date()) {
  const parts=dayFormatter.formatToParts(now);
  return ['year','month','day'].map(type=>parts.find(p=>p.type===type)!.value).join('-');
}
export function residentDemand(day=residentMarketDay()) {
  const stamp=Date.parse(day+'T00:00:00Z');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(day)||!Number.isFinite(stamp)||new Date(stamp).toISOString().slice(0,10)!==day)throw new Error('Не удалось загрузить цены жителей.');
  const rotation=Math.floor(stamp/86400000)%RESIDENT_CATEGORIES.length;
  const rates=[140,120,100,90,80];
  return {day,categories:RESIDENT_CATEGORIES.map((c,i)=>({...c,percent:rates[(i-rotation+rates.length)%rates.length]}))};
}
export function residentCategory(item:ResidentPricedItem):ResidentCategory {
  if(item.type==='material'&&item.templateId?.startsWith('fish_'))return 'fish';
  if(item.type==='ore'||item.type==='potion'||item.type==='material')return item.type;
  return 'equipment';
}
export function residentUnitGold(item:ResidentPricedItem,day:string) {
  const baseline=residentNeutralUnitGold(item);
  return baseline===0?0:Math.max(5,Math.floor(baseline*residentDemand(day).categories.find(c=>c.id===residentCategory(item))!.percent/100));
}
export function residentNeutralUnitGold(item:ResidentPricedItem) {
  const value=Number(item.sellPrice??10);
  if(!Number.isFinite(value)||value<=0)return 0;
  const demand=RESIDENT_CATEGORIES.find(c=>c.id===residentCategory(item))!;
  const rarity=Math.max(0,['common','uncommon','rare','epic','legendary','mythic','ancient','divine'].indexOf(item.rarity||'common'));
  const level=Number.isFinite(item.level)?Math.max(1,Math.min(100,Math.floor(item.level!))):1;
  const baseline=Math.max(demand.minimum+rarity*2+Math.floor(level/10)*2,Math.floor(Math.min(100000,value)*0.7));
  return baseline;
}
export function localBuyoutGold(item:ResidentPricedItem,quantity:number,day=residentMarketDay()) {
  if(!Number.isInteger(quantity)||quantity<1||quantity>999)return 0;
  return residentUnitGold(item,day)*quantity;
}
