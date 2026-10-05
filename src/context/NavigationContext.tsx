import React, { createContext, useContext, useEffect, useState } from 'react';
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
  const [currentTab, setCurrentTab] = useState<GameTabId>('hunter');
  const [isCharacterSheetOpen, setIsCharacterSheetOpen] = useState(false);
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const { player, isInCombat, isCombatEnded, exitCombat, acknowledgeFirstJourney } = useGame();
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
    if (player?.firstJourney !== 'codex') return;
    exitCombat();
    acknowledgeFirstJourney();
    setCurrentTab('hunter');
    setIsCharacterSheetOpen(true);
  }, [player?.firstJourney, exitCombat, acknowledgeFirstJourney]);
  return <NavigationContext.Provider value={{ currentTab, setCurrentTab, isCharacterSheetOpen, setIsCharacterSheetOpen, isAdminOpen, setIsAdminOpen }}>{children}</NavigationContext.Provider>;
};

export const useNavigation = () => {
  const value = useContext(NavigationContext);
  if (!value) throw new Error('useNavigation must be used within a NavigationProvider');
  return value;
};
