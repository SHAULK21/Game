import React, { lazy, Suspense, useEffect } from 'react';
import { initTelegramApp } from './utils/telegram';
import { GameProvider, useGame } from './context/GameContext';
import { CharacterCreationModal } from './components/dialogs/CharacterCreationModal';
import { InterfaceProvider, useInterface } from './context/InterfaceContext';
import { AccountSessionGate } from './components/layout/AccountSessionGate';
import { ModernGameContent } from './interfaces/modern/ModernGameContent';
import { NavigationProvider } from './context/NavigationContext';

const FantasyGameContent = lazy(() => import('./interfaces/fantasy/FantasyGameContent').then(module => ({ default: module.FantasyGameContent })));
const InterfaceContent = () => {
  const { style } = useInterface();
  const { player } = useGame();
  if (!player) return <CharacterCreationModal />;
  return <Suspense fallback={<div role="status" className="p-6 text-center">Загрузка интерфейса…</div>}>
    {style === 'fantasy' ? <FantasyGameContent /> : <ModernGameContent />}
  </Suspense>;
};

export default function App() {
  useEffect(() => { initTelegramApp(); }, []);
  return <InterfaceProvider><AccountSessionGate><GameProvider><NavigationProvider><InterfaceContent /></NavigationProvider></GameProvider></AccountSessionGate></InterfaceProvider>;
}
