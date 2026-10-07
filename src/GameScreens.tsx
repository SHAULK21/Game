import { FlightWarning } from './components/dialogs/FlightWarning';
import { RoyalBriefing } from './components/dialogs/RoyalBriefing';
import { AdventureStory } from './components/dialogs/AdventureStory';
import { StoryRegistration, markStoryIntroSeen } from './components/dialogs/StoryIntro';
import { StartupReady } from './components/layout/StartupReady';
import { t as localize, useLocale } from './i18n/locale';
import { NotificationOnboarding } from './components/notifications/NotificationOnboarding';
import { LanguageSync } from './i18n/LanguageSync';
import React, { Suspense, useEffect } from 'react';
import { CharacterCreationModal } from './components/dialogs/CharacterCreationModal';

import {useGame} from './context/GameContext';

export const GameScreens = ({Content}: {Content: React.ComponentType}) => {
  useLocale();
  const { player, isInCombat, isCombatEnded, travelState } = useGame();
  useEffect(() => { if (player) markStoryIntroSeen(); }, [Boolean(player)]);
  if (!player) return <><LanguageSync /><StartupReady /><StoryRegistration><CharacterCreationModal /></StoryRegistration></>;
  if (player.flightPenalty?.warningPending) return <><LanguageSync /><StartupReady /><FlightWarning /></>;
  if (player.firstJourney === 'briefing') return <><LanguageSync /><StartupReady /><RoyalBriefing /></>;
  if (player.adventureJournal?.pending && (!isInCombat || isCombatEnded) && !travelState.isTraveling)
    return <><LanguageSync /><StartupReady /><AdventureStory /></>;
  return <><LanguageSync /><Suspense fallback={<div role="status" className="p-6 text-center">{localize("Загрузка интерфейса…")}</div>}>
    <StartupReady /><Content />
  </Suspense><NotificationOnboarding /></>;
};

