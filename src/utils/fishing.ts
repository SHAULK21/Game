import type { AlchemyRecipe, GameItem, ItemRarity, PlayerCharacter } from '../types/game';

export interface FishingCast {
 id: string; spotId: string; fishId: string; grams: number; biteAt: number; expiresAt: number; hookedAt?: number;
}
export interface FishingState {
 level: number; exp: number; rod: number; catches: number; recordGrams: number;
 collection: Record<string, { count: number; recordGrams: number }>;
 cast?: FishingCast;
}
export const FISHING_COST = 4;
export const FISHING_WINDOW_MS = 20000;
export const FISH = [
 {id:'perch',name:'Речной окунь',rarity:'common',min:180,max:900,price:5},
 {id:'carp',name:'Бронзовый карась',rarity:'uncommon',min:300,max:1800,price:8},
 {id:'mooncarp',name:'Лунный карп',rarity:'rare',min:500,max:2500,price:14},
 {id:'trout',name:'Ручьевая форель',rarity:'common',min:400,max:2200,price:10},
 {id:'pike',name:'Лесная щука',rarity:'uncommon',min:700,max:4200,price:14},
 {id:'silverfin',name:'Серебропёрый карп',rarity:'rare',min:500,max:3100,price:22},
 {id:'char',name:'Ледяной голец',rarity:'common',min:500,max:2800,price:16},
 {id:'grayling',name:'Глубинный хариус',rarity:'uncommon',min:700,max:3800,price:24},
 {id:'sturgeon',name:'Зимний осётр',rarity:'rare',min:1800,max:7200,price:36},
 {id:'catfish',name:'Пещерный сом',rarity:'common',min:1400,max:6800,price:24},
 {id:'runekoi',name:'Рунный кои',rarity:'uncommon',min:800,max:4100,price:36},
 {id:'tench',name:'Древний линь',rarity:'rare',min:1200,max:5200,price:50}
] as const;
export const FISHING_SPOTS = [
 {id:'river',name:'Тихая заводь',description:'Тёплая вода, камыши и первые уроки рыболова.',heroLevel:1,level:1,fish:['perch','carp','mooncarp']},
 {id:'forest',name:'Лесной плёс',description:'Быстрое течение и хищная рыба у старых корней.',heroLevel:8,level:5,fish:['trout','pike','silverfin']},
 {id:'ice',name:'Зеркальное озеро',description:'Холодная вода хранит ингредиенты для защитных эликсиров.',heroLevel:20,level:12,fish:['char','grayling','sturgeon']},
 {id:'ruins',name:'Подземный источник',description:'Руны на берегу отзываются на редкий улов.',heroLevel:40,level:25,fish:['catfish','runekoi','tench']}
] as const;
export const FISHING_RODS = [
 {tier:0,name:'Камышовая удочка',level:1,silver:0,ingredients:[]},
 {tier:1,name:'Усиленная удочка',level:5,silver:80,ingredients:[{name:'Медная руда',count:6}]},
 {tier:2,name:'Рунная удочка',level:15,silver:400,ingredients:[{name:'Железная руда',count:10}]}
];
export const FISHING_RECIPES: AlchemyRecipe[] = [
 {id:'alc_fish_water',name:'Эликсир тихой воды',resultItem:'Эликсир тихой воды',description:'Восстанавливает 120 HP и 60 MP. Улов помогает восстановить обе силы сразу.',levelReq:1,heroLevelReq:1,resultCount:1,craftTimeSeconds:1,icon:'',resultStats:{heal:120,manaRestore:60},ingredients:[{name:'Речной окунь',count:2},{name:'Медная руда',count:1}]},
 {id:'alc_fish_scale',name:'Настой серебряной чешуи',resultItem:'Настой серебряной чешуи',description:'Увеличивает защиту на 20% на 3 хода.',levelReq:5,heroLevelReq:8,resultCount:1,craftTimeSeconds:2,icon:'',resultStats:{defensePercent:20,buffDuration:3},ingredients:[{name:'Серебропёрый карп',count:1},{name:'Бронзовый карась',count:2},{name:'Железная руда',count:1}]},
 {id:'alc_fish_hunter',name:'Масло хищника',resultItem:'Масло хищника',description:'Увеличивает атаку на 15% и шанс критического удара на 5% на 3 хода.',levelReq:8,heroLevelReq:10,resultCount:1,craftTimeSeconds:2,icon:'',resultStats:{attackPercent:15,critChance:5,buffDuration:3},ingredients:[{name:'Лесная щука',count:2},{name:'Ручьевая форель',count:2}]},
 {id:'alc_fish_ice',name:'Зелье ледяной кожи',resultItem:'Зелье ледяной кожи',description:'Восстанавливает 180 HP и увеличивает защиту на 25% на 4 хода.',levelReq:18,heroLevelReq:25,resultCount:1,craftTimeSeconds:2,icon:'',resultStats:{heal:180,defensePercent:25,buffDuration:4},ingredients:[{name:'Зимний осётр',count:1},{name:'Ледяной голец',count:3},{name:'Глубинный хариус',count:1}]},
 {id:'alc_fish_rune',name:'Рунный эликсир глубин',resultItem:'Рунный эликсир глубин',description:'Восстанавливает 400 MP и увеличивает защиту на 25% на 4 хода.',levelReq:35,heroLevelReq:45,resultCount:1,craftTimeSeconds:3,icon:'',resultStats:{manaRestore:400,defensePercent:25,buffDuration:4},ingredients:[{name:'Рунный кои',count:2},{name:'Древний линь',count:1},{name:'Пещерный сом',count:2}]}
];
export function initialFishing(): FishingState { return {level:1,exp:0,rod:0,catches:0,recordGrams:0,collection:{}}; }
export function migrateFishing(value?: Partial<FishingState>): FishingState {
 const base=initialFishing();
 if(!value)return base;
 const safe=(n:unknown,fallback:number)=>typeof n==='number'&&Number.isFinite(n)?Math.max(0,Math.floor(n)):fallback;
 const exp=safe(value.exp,0),level=Math.min(100,Math.max(1,Math.floor(exp/180)+1));
 const collection: FishingState['collection']={};
 for(const fish of FISH){const entry=value.collection?.[fish.id];if(entry)collection[fish.id]={count:safe(entry.count,0),recordGrams:safe(entry.recordGrams,0)};}
 const c=value.cast;
 const cast=c&&typeof c.id==='string'&&FISHING_SPOTS.some(s=>s.id===c.spotId)&&FISH.some(f=>f.id===c.fishId)&&Number.isFinite(c.biteAt)&&Number.isFinite(c.expiresAt)&&c.expiresAt>=c.biteAt&&Number.isFinite(c.grams)&&c.grams>0&&(!c.hookedAt||Number.isFinite(c.hookedAt))?{...c}:undefined;
 return {...base,level,exp,rod:Math.min(2,safe(value.rod,0)),catches:safe(value.catches,0),recordGrams:safe(value.recordGrams,0),collection,cast};
}
export const fishingProgress=(state:FishingState)=>({current:state.exp%180,need:180,percent:state.level>=100?100:state.exp%180/180*100});
export function fishingPhase(cast: FishingCast | undefined, now=Date.now()) {
 if(!cast)return 'idle';if(cast.hookedAt!==undefined)return now>=cast.hookedAt+1200?'land':'reel';
 return now>cast.expiresAt?'lost':now>=cast.biteAt?'bite':'wait';
}
export type FishingResult={success:boolean;message:string;player:PlayerCharacter;fish?:GameItem;grams?:number};
const fail=(player:PlayerCharacter,message:string):FishingResult=>({success:false,message,player});
export function castFishing(player:PlayerCharacter,spotId:string,now=Date.now(),rng=Math.random):FishingResult {
 const fishing=migrateFishing(player.fishing),spot=FISHING_SPOTS.find(s=>s.id===spotId);
 if(!spot)return fail(player,'Водоём не найден.');
 if(fishing.cast)return fail(player,'Сначала завершите текущий заброс.');
 if(player.miningExpedition)return fail(player,'Завершите шахтную экспедицию перед рыбалкой.');
 if(player.level<spot.heroLevel||fishing.level<spot.level)return fail(player,'Этот водоём ещё недоступен.');
 if(player.stamina<FISHING_COST)return fail(player,'Не хватает выносливости для заброса.');
 const rare=.05+fishing.rod*.03+Math.min(.05,fishing.level*.001),roll=rng();
 const fish=FISH.find(f=>f.id===spot.fish[roll<rare?2:roll<rare+.25?1:0])!;
 const stack=player.inventory.some(i=>i.templateId==='fish_'+fish.id&&i.type==='material');
 if(!stack&&player.inventory.length>=player.maxInventorySlots)return fail(player,'Освободите место в сумке для улова.');
 const biteAt=now+Math.round(4000+rng()*3000)-fishing.rod*400;
 const cast: FishingCast={id:'cast_'+now+'_'+rng().toString(36).slice(2,8),spotId,fishId:fish.id,grams:Math.round(fish.min+rng()*(fish.max-fish.min)),biteAt,expiresAt:biteAt+FISHING_WINDOW_MS};
 return {success:true,message:'Поплавок на воде. Дождитесь поклёвки.',player:{...player,stamina:player.stamina-FISHING_COST,fishing:{...fishing,cast}}};
}
export function hookFishing(player:PlayerCharacter,castId:string,now=Date.now()):FishingResult {
 const fishing=migrateFishing(player.fishing),cast=fishing.cast;
 if(!cast||cast.id!==castId)return fail(player,'Этот заброс уже завершён.');
 if(fishingPhase(cast,now)!=='bite')return fail(player,'Подсекайте только после поклёвки.');
 return {success:true,message:'Рыба на крючке. Осторожно подтяните её к берегу.',player:{...player,fishing:{...fishing,cast:{...cast,hookedAt:now}}}};
}
export function cancelFishing(player:PlayerCharacter):FishingResult {
 const fishing=migrateFishing(player.fishing);if(!fishing.cast)return fail(player,'Нет активного заброса.');
 return {success:true,message:'Леска смотана. Выносливость за заброс не возвращается.',player:{...player,fishing:{...fishing,cast:undefined}}};
}
export function landFishing(player:PlayerCharacter,castId:string,now=Date.now()):FishingResult {
 const fishing=migrateFishing(player.fishing),cast=fishing.cast;
 if(!cast||cast.id!==castId)return fail(player,'Этот улов уже забран.');
 if(fishingPhase(cast,now)!=='land')return fail(player,'Сначала подсеките и подтяните рыбу.');
 const definition=FISH.find(f=>f.id===cast.fishId)!;
 const item:GameItem={id:'fish_'+cast.id,templateId:'fish_'+definition.id,name:definition.name,type:'material',rarity:definition.rarity as ItemRarity,level:1,upgradeLevel:0,icon:'',image:'/assets/fishing/'+definition.id+'.webp',stats:{},stackCount:1,sellPrice:definition.price,disassembleYield:{silver:Math.max(1,Math.floor(definition.price/4))},description:'Рыбный ингредиент для особых алхимических зелий. Вес и рекорды хранятся в журнале рыболова.'};
 const index=player.inventory.findIndex(i=>i.templateId===item.templateId&&i.type==='material');
 if(index<0&&player.inventory.length>=player.maxInventorySlots)return fail(player,'Освободите место в сумке: улов ждёт на крючке.');
 const inventory=player.inventory.map(i=>({...i}));if(index>=0)inventory[index].stackCount=(inventory[index].stackCount||1)+1;else inventory.push(item);
 const previous=fishing.collection[definition.id]||{count:0,recordGrams:0};
 const spot=FISHING_SPOTS.find(s=>s.id===cast.spotId)!;
 const exp=fishing.exp+30+Math.floor(spot.level/2)+(definition.rarity==='rare'?20:definition.rarity==='uncommon'?10:0);
 return {success:true,message:'Улов добавлен в сумку. Опыт рыбалки начислен.',fish:item,grams:cast.grams,player:{...player,inventory,fishing:{...fishing,cast:undefined,exp,level:Math.min(100,Math.floor(exp/180)+1),catches:fishing.catches+1,recordGrams:Math.max(fishing.recordGrams,cast.grams),collection:{...fishing.collection,[definition.id]:{count:previous.count+1,recordGrams:Math.max(previous.recordGrams,cast.grams)}}}}};
}
export function upgradeFishingRod(player:PlayerCharacter):FishingResult {
 const fishing=migrateFishing(player.fishing),offer=FISHING_RODS[fishing.rod+1];
 if(!offer)return fail(player,'Удочка уже улучшена до максимума.');
 if(fishing.cast)return fail(player,'Сначала смотайте леску.');
 if(fishing.level<offer.level)return fail(player,'Недостаточный уровень рыбалки.');
 if(player.silver<offer.silver||offer.ingredients.some(need=>player.inventory.reduce((n,i)=>n+(i.name===need.name?(i.stackCount||1):0),0)<need.count))return fail(player,'Не хватает серебра или руды для улучшения.');
 let inventory=player.inventory.map(i=>({...i}));for(const need of offer.ingredients){let left=need.count;inventory=inventory.map(i=>{if(i.name!==need.name||left<=0)return i;const take=Math.min(left,i.stackCount||1);left-=take;return {...i,stackCount:(i.stackCount||1)-take};}).filter(i=>i.stackCount!==0);}
 return {success:true,message:'Удочка улучшена: поклёвка быстрее, редкий улов чаще.',player:{...player,inventory,silver:player.silver-offer.silver,fishing:{...fishing,rod:offer.tier}}};
}
