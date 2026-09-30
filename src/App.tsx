import React, { useState, useEffect } from 'react';
import { GameProvider, useGame } from './context/GameContext';
import { TopHeader } from './components/layout/TopHeader';
import { BottomNavigation, TabId } from './components/layout/BottomNavigation';
import { CombatScreen } from './components/combat/CombatScreen';
import { WorldScreen } from './components/world/WorldScreen';
import { ArenaScreen } from './components/arena/ArenaScreen';
import { InventoryScreen } from './components/inventory/InventoryScreen';
import { BlacksmithScreen } from './components/blacksmith/BlacksmithScreen';
import { CraftingScreen } from './components/crafting/CraftingScreen';
import { AlchemyScreen } from './components/alchemy/AlchemyScreen';
import { MiningScreen } from './components/mining/MiningScreen';
import { ClanScreen } from './components/clan/ClanScreen';
import { ChatScreen } from './components/chat/ChatScreen';
import { MarketScreen } from './components/market/MarketScreen';
import { PetsScreen } from './components/pets/PetsScreen';
import { LeaderboardScreen } from './components/leaderboard/LeaderboardScreen';
import { MoreMenuScreen } from './components/more/MoreMenuScreen';
import { CharacterScreen } from './components/character/CharacterScreen';
import { CharacterCreationModal } from './components/dialogs/CharacterCreationModal';
import { OfflineReportModal } from './components/dialogs/OfflineReportModal';
import { AdminModal } from './components/admin/AdminModal';
import { initTelegramApp } from './utils/telegram';

const MainGameContent: React.FC = () => {
  const { player, quests, isInCombat, isCombatEnded } = useGame();
  const [currentTab, setCurrentTab] = useState<TabId>('hunter');
  const [isCharacterSheetOpen, setIsCharacterSheetOpen] = useState(false);
  const [isAdminOpen, setIsAdminOpen] = useState(false);

  useEffect(() => {
    initTelegramApp();
  }, []);

  useEffect(() => {
    if (isInCombat && !isCombatEnded) {
      setIsCharacterSheetOpen(false);
      setCurrentTab('hunter');
    }
  }, [isInCombat, isCombatEnded]);

  if (!player) {
    return <CharacterCreationModal />;
  }

  const availableQuests = quests.filter(q => q.completed && !q.claimed).length;

  return (
    <div className="min-h-screen pt-safe bg-[#07090e] text-slate-100 flex flex-col font-sans select-none overflow-x-hidden">
      {/* Top Header */}
      <TopHeader onOpenCharacterSheet={() => setIsCharacterSheetOpen(true)} />

      {/* Main View Area */}
      <main className="flex-1 w-full max-w-md mx-auto">
        {isCharacterSheetOpen ? (
          <CharacterScreen onClose={() => setIsCharacterSheetOpen(false)} />
        ) : (
          <>
            {currentTab === 'hunter' && <CombatScreen onContinueDungeon={() => setCurrentTab('world')} />}
            {currentTab === 'world' && <WorldScreen onEnterCombatTab={() => setCurrentTab('hunter')} />}
            {currentTab === 'arena' && <ArenaScreen onEnterCombatTab={() => setCurrentTab('hunter')} />}
            {currentTab === 'inventory' && <InventoryScreen onNavigateToBlacksmith={() => setCurrentTab('blacksmith')} onNavigateToCrafting={() => setCurrentTab('crafting')} />}
            {currentTab === 'blacksmith' && <BlacksmithScreen />}
            {currentTab === 'crafting' && <CraftingScreen />}
            {currentTab === 'alchemy' && <AlchemyScreen />}
            {currentTab === 'mine' && <MiningScreen />}
            {currentTab === 'clan' && <ClanScreen />}
            {currentTab === 'chat' && <ChatScreen />}
            {currentTab === 'market' && <MarketScreen />}
            {currentTab === 'pets' && <PetsScreen />}
            {currentTab === 'leaderboard' && <LeaderboardScreen />}
            {currentTab === 'more' && <MoreMenuScreen onOpenAdmin={() => setIsAdminOpen(true)} />}
          </>
        )}
      </main>

      {/* Bottom Thumb Navigation Bar */}
      <BottomNavigation
        currentTab={currentTab}
        onSelectTab={tab => {
          setIsCharacterSheetOpen(false);
          setCurrentTab(tab);
        }}
        availableQuestsCount={availableQuests}
      />

      {/* Modals */}
      <OfflineReportModal />
      <AdminModal isOpen={isAdminOpen} onClose={() => setIsAdminOpen(false)} />
    </div>
  );
};

export default function App() {
  return (
    <GameProvider>
      <MainGameContent />
    </GameProvider>
  );
}
