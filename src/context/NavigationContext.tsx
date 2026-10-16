import {useServerProgress} from './ServerProgressContext';
import {inSettlement,SETTLEMENT_TABS} from '../utils/worldPresence';
import {getTelegramUser} from '../utils/telegram';
import {readResetVersion} from '../utils/accountReset';
import React, { createContext, useContext, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useGame } from './GameContext';
import type { GameTabId } from '../types/navigation';

interface NavigationState {
  currentTab: GameTabId;
  goBack:()=>void;
  canGoBack:boolean;
  setCurrentTab: React.Dispatch<React.SetStateAction<GameTabId>>;
  isCharacterSheetOpen: boolean;
  setIsCharacterSheetOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isAdminOpen: boolean;
  setIsAdminOpen: React.Dispatch<React.SetStateAction<boolean>>;
}
const NavigationContext = createContext<NavigationState | null>(null);

export const NavigationProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const serverProgress=useServerProgress();
  const firstJourneyWork=useRef(false);
  const { player, isInCombat, isCombatEnded, exitCombat, acknowledgeFirstJourney, travelState } = useGame();
  const settlementRef=useRef(false);settlementRef.current=inSettlement(player);
  const previousTravel=useRef(false);
  const userId = getTelegramUser().id;
  const navigationKey = 'aethelgard_navigation_' + userId + '_' + readResetVersion(userId);
  const [saved] = useState(() => { try { return JSON.parse(sessionStorage.getItem(navigationKey) || 'null'); } catch { return null; } });
  const tabs = ['expeditions','hunter','settlement','world','character','arena','inventory','blacksmith','crafting','alchemy','mine','fishing','clan','chat','market','pets','leaderboard','more','menu'];
  const [currentTab, updateTab] = useState<GameTabId>(tabs.includes(saved?.tab) ? saved.tab : 'hunter');
  const [isCharacterSheetOpen, updateSheet] = useState(saved?.sheet === true);
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const history=useRef<GameTabId[]>(Array.isArray(saved?.history)?saved.history.filter((tab:string)=>tabs.includes(tab)):[]);
  const [canGoBack,setCanGoBack]=useState(history.current.length>0);
  const travelRef=useRef(false);
  const tabRef = useRef(currentTab), sheetRef = useRef(isCharacterSheetOpen);
  const setCurrentTab = useCallback<NavigationState['setCurrentTab']>(action => {
    let next = typeof action === 'function' ? action(tabRef.current) : action;
    if(SETTLEMENT_TABS.includes(next)&&!settlementRef.current)next='settlement';
    if (next === tabRef.current || travelRef.current && next!=='world') return;
    history.current=[...history.current.slice(-19),tabRef.current];setCanGoBack(true);
    if (!sheetRef.current) window.dispatchEvent(new CustomEvent('aethelgard:before-navigation'));
    tabRef.current = next; updateTab(next);
  }, []);
  useLayoutEffect(() => { try { sessionStorage.setItem(navigationKey,JSON.stringify({tab:currentTab,sheet:isCharacterSheetOpen,history:history.current})); } catch {} }, [navigationKey,currentTab,isCharacterSheetOpen]);
  const goBack=useCallback(()=>{if(travelRef.current)return;let previous=history.current.pop();if(!previous)return;if(SETTLEMENT_TABS.includes(previous)&&!settlementRef.current)previous='settlement';window.dispatchEvent(new CustomEvent("aethelgard:before-navigation"));tabRef.current=previous;updateTab(previous);sheetRef.current=false;updateSheet(false);setCanGoBack(history.current.length>0);},[]);
  const setIsCharacterSheetOpen = useCallback<NavigationState['setIsCharacterSheetOpen']>(action => {
    const next = typeof action === 'function' ? action(sheetRef.current) : action;
    if (next === sheetRef.current || travelRef.current && next) return;
    if (tabRef.current !== 'character') window.dispatchEvent(new CustomEvent('aethelgard:before-navigation'));
    sheetRef.current = next; updateSheet(next);
  }, []);

  travelRef.current=travelState.isTraveling||Boolean(player?.worldJourney);
  useEffect(()=>{if(player&&SETTLEMENT_TABS.includes(currentTab)&&!inSettlement(player))setCurrentTab('settlement');},[player?.worldPlace,player?.worldJourney,currentTab]);
  useEffect(()=>{const moving=travelState.isTraveling||Boolean(player?.worldJourney);if(previousTravel.current&&!moving&&player)setCurrentTab(player.worldPlace==='settlement'?'settlement':player.worldPlace==='dungeon'?'world':'hunter');previousTravel.current=moving;},[travelState.isTraveling,player?.worldJourney,player?.worldPlace]);
  useEffect(()=>{
    const back=window.Telegram?.WebApp?.BackButton;if(!back)return;
    const handle=()=>{if(travelRef.current)return;if(document.querySelector('[role="dialog"]'))document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));else goBack();};
    if(canGoBack&&!travelState.isTraveling)back.show();else back.hide();back.onClick(handle);
    return()=>{back.offClick(handle);back.hide();};
  },[goBack,canGoBack,travelState.isTraveling]);
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('aethelgard:screen',{detail:isCharacterSheetOpen?'character':currentTab}));
  },[currentTab,isCharacterSheetOpen]);
  useEffect(() => {
    if (isInCombat && !isCombatEnded) {
      setIsCharacterSheetOpen(false);
      setCurrentTab('hunter');
    }
  }, [isInCombat, isCombatEnded]);
  useEffect(() => {
    if(serverProgress&&(!serverProgress.current?.activeHere||serverProgress.status!=='saved'||serverProgress.pending))return;
    if (player?.firstJourney === 'briefing') {
      if(isInCombat)void exitCombat();setIsCharacterSheetOpen(false);setCurrentTab('hunter');return;
    }
    if (player?.firstJourney !== 'codex'||firstJourneyWork.current) return;
    firstJourneyWork.current=true;
    void (async()=>{
      if(isInCombat)await exitCombat();
      await acknowledgeFirstJourney();
      setCurrentTab('hunter');
      setIsCharacterSheetOpen(true);
    })().finally(()=>{firstJourneyWork.current=false;});
  }, [player?.firstJourney, exitCombat, acknowledgeFirstJourney,isInCombat,serverProgress?.current?.activeHere,serverProgress?.status]);
  useEffect(() => {
    if (travelState.isTraveling || player?.worldJourney || player?.firstJourney === 'done' && player.firstJourneyDeparture && player.statPoints === 0) {
      setIsCharacterSheetOpen(false);
      setCurrentTab('world');
    }
  }, [player?.firstJourney,player?.firstJourneyDeparture,player?.statPoints,travelState.isTraveling]);
  return <NavigationContext.Provider value={{ goBack,canGoBack,currentTab, setCurrentTab, isCharacterSheetOpen, setIsCharacterSheetOpen, isAdminOpen, setIsAdminOpen }}>{children}</NavigationContext.Provider>;
};

export const useOptionalNavigation = () => useContext(NavigationContext);
export const useNavigation = () => {
  const value = useContext(NavigationContext);
  if (!value) throw new Error('useNavigation must be used within a NavigationProvider');
  return value;
};
