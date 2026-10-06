import { observeMobileViewport } from './utils/mobileViewport';
import { RoyalBriefing } from './components/dialogs/RoyalBriefing';
import { AdventureStory } from './components/dialogs/AdventureStory';
import { StoryRegistration, markStoryIntroSeen } from './components/dialogs/StoryIntro';
import { StartupReady } from './components/layout/StartupReady';
import { t as localize, useLocale } from './i18n/locale';
import { NotificationOnboarding } from './components/notifications/NotificationOnboarding';
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
const ReadyGameContent = () => {
  const { style } = useInterface();
  return <><StartupReady />{style !== 'modern' ? <FantasyGameContent /> : <ModernGameContent />}</>;
};
const InterfaceContent = () => {
  useLocale();
  const { player, isInCombat, isCombatEnded, travelState } = useGame();
  useEffect(() => { if (player) markStoryIntroSeen(); }, [Boolean(player)]);
  if (!player) return <><LanguageSync /><StartupReady /><StoryRegistration><CharacterCreationModal /></StoryRegistration></>;
  if (player.firstJourney === 'briefing') return <><LanguageSync /><StartupReady /><RoyalBriefing /></>;
  if (player.adventureJournal?.pending && (!isInCombat || isCombatEnded) && !travelState.isTraveling)
    return <><LanguageSync /><StartupReady /><AdventureStory /></>;
  return <><LanguageSync /><Suspense fallback={<div role="status" className="p-6 text-center">{localize("Загрузка интерфейса…")}</div>}>
    <ReadyGameContent />
  </Suspense><NotificationOnboarding /></>;
};

export default function App() {
  useLocale();
  useEffect(() => { initTelegramApp(); return observeMobileViewport(); }, []);
  return <InterfaceProvider><AccountSessionGate><GameProvider><NavigationProvider><InterfaceContent /></NavigationProvider></GameProvider></AccountSessionGate></InterfaceProvider>;
}
