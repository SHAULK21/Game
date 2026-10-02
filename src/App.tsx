import { t as localize, useLocale } from './i18n/locale';
import { LanguageSync } from './i18n/LanguageSync';
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
  useLocale();
  const { style } = useInterface();
  const { player } = useGame();
  if (!player) return <><LanguageSync /><CharacterCreationModal /></>;
  return <><LanguageSync /><Suspense fallback={<div role="status" className="p-6 text-center">{localize("Загрузка интерфейса…")}</div>}>
    {style === 'fantasy' ? <FantasyGameContent /> : <ModernGameContent />}
  </Suspense></>;
};

export default function App() {
  useLocale();
  useEffect(() => { initTelegramApp(); }, []);
  return <InterfaceProvider><AccountSessionGate><GameProvider><NavigationProvider><InterfaceContent /></NavigationProvider></GameProvider></AccountSessionGate></InterfaceProvider>;
}
