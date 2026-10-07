import React, { createContext, useContext, useCallback, useEffect, useRef, useState } from 'react';
import { useGame } from './GameContext';
import type { GameTabId } from '../types/navigation';

interface NavigationState {
  currentTab: GameTabId;
  setCurrentTab: React.Dispatch<React.SetStateAction<GameTabId>>;
  isCharacterSheetOpen: boolean;
  setIsCharacterSheetOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isAdminOpen: boolean;
  setIsAdminOpen: React.Dispatch<React.SetStateAction<boolean>>;
}
const NavigationContext = createContext<NavigationState | null>(null);

export const NavigationProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [currentTab, updateTab] = useState<GameTabId>('hunter');
  const [isCharacterSheetOpen, updateSheet] = useState(false);
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const tabRef = useRef(currentTab), sheetRef = useRef(isCharacterSheetOpen);
  const setCurrentTab = useCallback<NavigationState['setCurrentTab']>(action => {
    const next = typeof action === 'function' ? action(tabRef.current) : action;
    if (next === tabRef.current) return;
    if (!sheetRef.current) window.dispatchEvent(new CustomEvent('aethelgard:before-navigation'));
    tabRef.current = next; updateTab(next);
  }, []);
  const setIsCharacterSheetOpen = useCallback<NavigationState['setIsCharacterSheetOpen']>(action => {
    const next = typeof action === 'function' ? action(sheetRef.current) : action;
    if (next === sheetRef.current) return;
    if (tabRef.current !== 'character') window.dispatchEvent(new CustomEvent('aethelgard:before-navigation'));
    sheetRef.current = next; updateSheet(next);
  }, []);

  const { player, isInCombat, isCombatEnded, exitCombat, acknowledgeFirstJourney, travelState } = useGame();
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
    if (player?.firstJourney === 'briefing') {
      exitCombat();setIsCharacterSheetOpen(false);setCurrentTab('hunter');return;
    }
    if (player?.firstJourney !== 'codex') return;
    exitCombat();
    acknowledgeFirstJourney();
    setCurrentTab('hunter');
    setIsCharacterSheetOpen(true);
  }, [player?.firstJourney, exitCombat, acknowledgeFirstJourney]);
  useEffect(() => {
    if (travelState.isTraveling || player?.firstJourney === 'done' && player.firstJourneyDeparture && player.statPoints === 0) {
      setIsCharacterSheetOpen(false);
      setCurrentTab('world');
    }
  }, [player?.firstJourney,player?.firstJourneyDeparture,player?.statPoints,travelState.isTraveling]);
  return <NavigationContext.Provider value={{ currentTab, setCurrentTab, isCharacterSheetOpen, setIsCharacterSheetOpen, isAdminOpen, setIsAdminOpen }}>{children}</NavigationContext.Provider>;
};

export const useNavigation = () => {
  const value = useContext(NavigationContext);
  if (!value) throw new Error('useNavigation must be used within a NavigationProvider');
  return value;
};
