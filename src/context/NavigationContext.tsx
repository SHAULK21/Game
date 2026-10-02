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
  const { isInCombat, isCombatEnded } = useGame();
  useEffect(() => {
    if (isInCombat && !isCombatEnded) {
      setIsCharacterSheetOpen(false);
      setCurrentTab('hunter');
    }
  }, [isInCombat, isCombatEnded]);
  return <NavigationContext.Provider value={{ currentTab, setCurrentTab, isCharacterSheetOpen, setIsCharacterSheetOpen, isAdminOpen, setIsAdminOpen }}>{children}</NavigationContext.Provider>;
};

export const useNavigation = () => {
  const value = useContext(NavigationContext);
  if (!value) throw new Error('useNavigation must be used within a NavigationProvider');
  return value;
};
