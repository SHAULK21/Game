import {ServerProgressContext as ServerContext} from './ServerProgressContext';
import React,{createContext,useContext,useEffect,useMemo,useState,useRef} from 'react';
import {GameContext,type RuntimeGameContext} from './GameContext';
import {ServerProgress,ProgressRequestError} from '../utils/serverProgress';
import {getTelegramUser,getTelegramWebApp,triggerHaptic} from '../utils/telegram';
import {getLanguage,t,useLocale} from '../i18n/locale';
import {setProgressTransport,apiRequest} from '../utils/api';
import {sound} from '../utils/audio';
import {StartupReady} from '../components/layout/StartupReady';
import {selectBulkItems} from '../utils/bulkInventory';
import {clanCreationCost} from '../utils/clanEconomy';
import {gameFetch} from '../utils/gameFetch';
import {startProgressPolling} from '../utils/progressPolling';
const keys:Record<string,string[]>={performPlayerAction:['action','id'],allocateAttribute:['attribute'],unlockTalent:['talentId'],setActivePet:['petId'],craftPet:['petId'],unequipItem:['slot'],toggleItemLock:['itemId'],claimRegionCompletion:['regionId'],startTravel:['regionId','modeId'],setCurrentRegion:['regionId'],setActiveRegionMod:['modeId'],enterDungeon:['dungeonId','difficulty'],proceedDungeonRoom:['choice'],buyPickaxe:['pickaxeId'],mineNode:['nodeId'],craftBasicItem:['recipeId'],buyAlchemyTool:['toolId'],craftAlchemy:['recipeId'],fishingAction:['action','id','step'],challengeAscension:['echoId'],ascend:['path'],claimQuestReward:['questId'],claimAchievementReward:['achievementId'],setAdventureStoryStep:['step'],updateAutoBattleSettings:['settings'],buyBasicConsumable:['templateId'],adminAddGold:['amount'],adminAddSilver:['amount']};
const commandNames=['allocateAttribute','unlockTalent','resetTalentTree','setActivePet','craftPet','equipItem','unequipItem','sellItem','disassembleItem','toggleItemLock','expandInventory','upgradeItem','claimRegionCompletion','drinkBeer','dismissFlightWarning','startBattleWithMonster','performPlayerAction','startNextCombatBattle','exitCombat','startTravel','setCurrentRegion','setActiveRegionMod','returnToSettlement','enterDungeon','proceedDungeonRoom','exitDungeon','buyPickaxe','mineNode','craftBasicItem','buyAlchemyTool','craftAlchemy','fishingAction','challengeAscension','ascend','challengeArena','claimQuestReward','claimAchievementReward','setAdventureStoryStep','finishAdventureStory','dismissAdventureStory','advanceRoyalBriefing','acknowledgeFirstJourney','dismissOfflineReport','toggleAutoBattle','updateAutoBattleSettings','buyBasicConsumable','adminAddGold','adminAddSilver','adminLevelUp','adminSpawnLegendaryItem','adminHealAll'];
export function ServerGameProvider({children}:React.PropsWithChildren){
 const {locale}=useLocale(); const [,redraw]=useState(0);const [notice,setNotice]=useState('');const [skipLocal,setSkipLocal]=useState(false);
 const [client]=useState(()=>{
  const owner=String(getTelegramUser().id),key='aethelgard_writer_'+owner;
  let token=sessionStorage.getItem(key);if(!token){token=crypto.randomUUID();sessionStorage.setItem(key,token);}
  return new ServerProgress(owner,token,localStorage,async(path,init)=>{
   const headers=new Headers(init.headers);headers.set('Content-Type','application/json');headers.set('X-Telegram-Init-Data',getTelegramWebApp()?.initData||'');headers.set('X-Game-Language',getLanguage());
   const response=await gameFetch(path,{...init,headers,signal:AbortSignal.timeout(20000)});
   const data=await response.json();if(!response.ok)throw new ProgressRequestError(data,response.status);return data;
  });
 });
 useEffect(()=>client.subscribe(()=>redraw(n=>n+1)),[client]);
 useEffect(()=>{
  const polling=startProgressPolling(client,{now:Date.now,visible:()=>!document.hidden,
   setTimeout:(callback,delay)=>window.setTimeout(callback,delay),clearTimeout:timer=>window.clearTimeout(timer as number)});
  const visible=()=>polling.wake();
  window.addEventListener('online',visible);document.addEventListener('visibilitychange',visible);
  return()=>{polling.stop();window.removeEventListener('online',visible);document.removeEventListener('visibilitychange',visible);};
 },[client]);
 useEffect(()=>{setProgressTransport(async(path,init)=>{const result=await client.mutate(path,init.body?JSON.parse(String(init.body)):{});return result;});return()=>setProgressTransport(null);},[client]);
 const lastSoundVersion=useRef('');
 useEffect(()=>{const next=client.current;if(!next)return;const key=next.resetVersion+':'+next.version;if(lastSoundVersion.current===key)return;const first=!lastSoundVersion.current;lastSoundVersion.current=key;if(first)return;for(const cue of next.cues||[]){if(cue.name==='haptic')triggerHaptic(cue.args[0] as any);else if(/^play[A-Z]/.test(cue.name)&&typeof (sound as any)[cue.name]==='function')(sound as any)[cue.name](...cue.args);}},[client.current]);
 const view=client.current?.game;
 const referralChecked=useRef('');
 useEffect(()=>{
  const current=client.current,p=current?.game?.player;if(!p||!current.activeHere||client.status!=='saved')return;
  const key=current.resetVersion+':'+p.level;
  if(p.level>=10&&referralChecked.current!==key){referralChecked.current=key;void apiRequest('/api/referrals/check',{method:'POST',body:'{}'}).catch(()=>{});}
 },[client,view?.player?.level,client.status]);
 useEffect(()=>{const p=view?.player;if(!p||!client.current?.activeHere)return;void apiRequest('/api/notifications/schedule',{method:'POST',body:JSON.stringify({energy:p.energy,maxEnergy:p.maxEnergy,regenAt:p.lastEnergyRegenTimestamp})}).catch(()=>{});},[view?.player?.energy,view?.player?.maxEnergy,view?.player?.lastEnergyRegenTimestamp]);
 const commandActions=useRef<Record<string,Function>>({});
 const value=useMemo(()=>{
  const v:any={...view,player:view?.player||null,travelState:view?.travelState||{isTraveling:false},quests:view?.quests||[],achievements:view?.achievements||[],isInCombat:view?.isInCombat||false,premium:view?.premium||{active:false,loading:false}};
  const perform=async(path:string,body:any)=>{try{return await client.mutate(path,body);}catch(error){setNotice((error as Error).message);return {success:false,message:(error as Error).message};}};
  for(const name of commandNames)v[name]=commandActions.current[name]??=(async(...args:any[])=>{
   const command:any={type:name};(keys[name]||[]).forEach((key,i)=>{if(args[i]!==undefined)command[key]=args[i];});
   if(['equipItem','sellItem','disassembleItem','upgradeItem'].includes(name)){command.itemId=args[0].id;if(name==='upgradeItem')command.useProtection=args[1];}
   if(name==='startBattleWithMonster'){command.monsterId=args[0].id;command.chain=args[1]?.chain;command.modeId=args[1]?.huntingModeId;}
   if(name==='challengeArena')command.opponentId=args[0].id;
   const result=await perform('/api/progress/command',command);
   if(name==='fishingAction')return {...result,player:client.current?.game?.player};
   if(['setActivePet','craftAlchemy','buyBasicConsumable','enterDungeon','proceedDungeonRoom','challengeArena','startBattleWithMonster','startNextCombatBattle','finishAdventureStory'].includes(name))return typeof result==='boolean'?result:result?.success===true;
   return result;
  });
  v.createCharacter=async(name:string,classId:string,firstJourney=false)=>{const result=await perform('/api/progress/create',{name,classId,firstJourney});if(result?.success===false)throw new Error(result.message);};
  v.commitSwitchSnapshot=v.flushProgress=()=>{};v.getInterfaceSwitchBlockReason=()=>client.pending?'Дождитесь подтверждения операции.':v.isInCombat&&!v.isCombatEnded?'Нельзя сменить интерфейс во время незавершённого боя.':v.travelState.isTraveling||v.player?.worldJourney?'Дождитесь завершения путешествия.':'';
  v.resetCharacter=()=>setNotice('Сброс персонажа выполняет администратор.');
  v.refreshServerInventory=v.refreshMarketIncome=v.refreshPremiumStatus=async()=>{await client.load();};
  v.sellToResidents=(item:any,quantity:number,demandDay:string)=>perform('/api/market/residents',{operationId:crypto.randomUUID(),itemId:item.id,item,quantity,demandDay}).then(result=>({success:result?.success!==false&&!client.pending,message:result?.message||client.message}));
  v.bulkDisposeItems=(filters:any,action:string,confirmedIds?:string[])=>perform('/api/items/bulk-dispose',{operationId:crypto.randomUUID(),action,filters,itemIds:confirmedIds||selectBulkItems(v.player,filters).map(i=>i.id)}).then(result=>({success:result?.success!==false&&!client.pending,message:result?.message||client.message}));
  v.listMarketItem=(item:any,quantity:number,priceGold:number)=>perform('/api/market/list',{operationId:crypto.randomUUID(),itemId:item.id,item,quantity,price_gold:priceGold}).then(result=>({success:result?.success!==false&&!client.pending,message:result?.message||client.message}));
  v.returnMarketListing=(listingId:string)=>perform('/api/market/'+listingId+'/return',{}).then(result=>({success:result?.success!==false&&!client.pending,message:result?.message||client.message}));
  v.buyMarketListing=(listingId:string,expectedPriceGold?:number)=>perform('/api/market/'+listingId+'/buy',{operationId:crypto.randomUUID(),expectedPriceGold}).then(result=>({success:result?.success!==false&&!client.pending,message:result?.message||client.message}));
  v.createClan=(details:any)=>perform('/api/clan/create',{...details,operationId:crypto.randomUUID(),expectedPriceGold:clanCreationCost(v.premium.active)});
  v.preparePremiumInvoice=async()=>{const result=await apiRequest<any>('/api/premium/invoice',{method:'POST',body:'{}'});return result.invoiceLink||null;};
  v.purchasePremium=async(link?:string)=>{const url=link||await v.preparePremiumInvoice();if(url)getTelegramWebApp()?.openInvoice?.(url,()=>void client.load());return {success:!!url,message:url?'Подтвердите оплату в Telegram.':'Premium уже активен.'};};
  v.startMiningExpedition=v.claimMiningExpedition=v.leaveMiningExpedition=()=>({success:false,message:'Откройте раздел «Экспедиции».'});
  v.sendChatMessage=()=>{};
  return v as RuntimeGameContext;
 },[client,view,locale,client.status]);
 const uk=locale==='uk',snapshot=client.current;
 if(!snapshot)return <>{client.message&&<StartupReady/>}<section className="p-6 text-center" role="status"><p>{t('Загрузка персонажа…')}</p>{client.message&&<p>{client.message}</p>}<button className="min-h-11 underline" onClick={()=>void client.load()}>{t('Повторить')}</button></section></>;
 const choose=!!client.candidate&&!skipLocal;
 return <ServerContext.Provider value={client}><GameContext.Provider value={value}>
  {(client.status!=='saved'||notice||client.message)&&<aside className="server-save-status" role="status"><span>{notice||client.message||t(client.status==='saving'?'Сохранение…':client.status==='readonly'?'Персонаж открыт для просмотра.':'Нет связи. Изменения приостановлены.')}</span>{client.status==='readonly'&&<button onClick={()=>{if(confirm(uk?'Перенести активну сесію на цей пристрій?':'Перенести активную сессию на это устройство?'))void client.acquire(true);}}>{uk?'Перенести сесію':'Перенести сессию'}</button>}{['offline','conflict'].includes(client.status)&&<button onClick={()=>void (client.pending?client.resolveConflict():client.load())}>{t('Восстановить')}</button>}{notice&&<button onClick={()=>setNotice('')}>{t('Закрыть')}</button>}</aside>}
  {(!snapshot.canonical&&snapshot.save||choose)?<><StartupReady/><section className="server-migration"><h1>{t('Выберите персонажа')}</h1><p>{t('Прогресс не объединяется. Исходные данные сохраняются в резервной копии.')}</p>{snapshot.save&&<article><h2>{t('На сервере')}: {snapshot.save.player.name}</h2><p>{t('Уровень')} {snapshot.save.player.level} · {snapshot.save.player.gold} {t('золота')}</p><button disabled={client.status!=='saved'} onClick={()=>void (snapshot.canonical?client.mutate('/api/progress/keep-server',{}):client.mutate('/api/progress/migrate',{source:'server'})).catch(e=>setNotice(e.message))}>{t('Оставить серверного персонажа')}</button></article>}{choose&&<article><h2>{t('На этом устройстве')}: {client.candidate.player.name}</h2><p>{t('Уровень')} {client.candidate.player.level} · {client.candidate.player.gold} {t('золота')}</p>{!snapshot.migrationOpen&&<p>{t('На сервере уже выбран актуальный персонаж. Локальный остаётся в резервной копии и не может заменить новый прогресс.')}</p>}<button disabled={client.status!=='saved'||!snapshot.migrationOpen} onClick={()=>{if(!snapshot.save||confirm(t('Заменить серверного персонажа выбранным? Валюта и предметы не суммируются.')))void client.mutate('/api/progress/migrate',{save:client.candidate,replaceExisting:!!snapshot.save}).catch(e=>setNotice(e.message));}}>{t('Перенести этого персонажа')}</button></article>}{choose&&!snapshot.save&&<button onClick={()=>setSkipLocal(true)}>{t('Создать нового вместо переноса')}</button>}</section></>:children}
 </GameContext.Provider></ServerContext.Provider>;
}
