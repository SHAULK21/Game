import React, { useState, useEffect, lazy, Suspense } from 'react';
import { GameProvider, useGame } from './context/GameContext';
import { TopHeader } from './components/layout/TopHeader';
import { BottomNavigation, TabId } from './components/layout/BottomNavigation';
import { CombatScreen } from './components/combat/CombatScreen';
import { CharacterCreationModal } from './components/dialogs/CharacterCreationModal';
import { OfflineReportModal } from './components/dialogs/OfflineReportModal';
import { initTelegramApp } from './utils/telegram';

const WorldScreen = lazy(() => import('./components/world/WorldScreen').then(module => ({ default: module.WorldScreen })));
const ArenaScreen = lazy(() => import('./components/arena/ArenaScreen').then(module => ({ default: module.ArenaScreen })));
const InventoryScreen = lazy(() => import('./components/inventory/InventoryScreen').then(module => ({ default: module.InventoryScreen })));
const BlacksmithScreen = lazy(() => import('./components/blacksmith/BlacksmithScreen').then(module => ({ default: module.BlacksmithScreen })));
const CraftingScreen = lazy(() => import('./components/crafting/CraftingScreen').then(module => ({ default: module.CraftingScreen })));
const AlchemyScreen = lazy(() => import('./components/alchemy/AlchemyScreen').then(module => ({ default: module.AlchemyScreen })));
const MiningScreen = lazy(() => import('./components/mining/MiningScreen').then(module => ({ default: module.MiningScreen })));
const ClanScreen = lazy(() => import('./components/clan/ClanScreen').then(module => ({ default: module.ClanScreen })));
const ChatScreen = lazy(() => import('./components/chat/ChatScreen').then(module => ({ default: module.ChatScreen })));
const MarketScreen = lazy(() => import('./components/market/MarketScreen').then(module => ({ default: module.MarketScreen })));
const PetsScreen = lazy(() => import('./components/pets/PetsScreen').then(module => ({ default: module.PetsScreen })));
const LeaderboardScreen = lazy(() => import('./components/leaderboard/LeaderboardScreen').then(module => ({ default: module.LeaderboardScreen })));
const MoreMenuScreen = lazy(() => import('./components/more/MoreMenuScreen').then(module => ({ default: module.MoreMenuScreen })));
const CharacterScreen = lazy(() => import('./components/character/CharacterScreen').then(module => ({ default: module.CharacterScreen })));
const AdminModal = lazy(() => import('./components/admin/AdminModal').then(module => ({ default: module.AdminModal })));

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
    <div className="game-shell min-h-screen pt-safe text-slate-100 flex flex-col font-sans select-none overflow-x-hidden">
      {/* Top Header */}
      <TopHeader onOpenCharacterSheet={() => setIsCharacterSheetOpen(true)} />

      {/* Main View Area */}
      <main className="flex-1 w-full max-w-lg mx-auto">
        <Suspense fallback={<div role="status" className="p-6 text-center text-sm text-slate-400">Загрузка раздела…</div>}>
        {isCharacterSheetOpen ? (
          <CharacterScreen onClose={() => setIsCharacterSheetOpen(false)} />
        ) : (
          <>
            {currentTab === 'hunter' && <CombatScreen onContinueDungeon={() => setCurrentTab('world')} onReturnToArena={() => setCurrentTab('arena')} />}
            {currentTab === 'world' && <WorldScreen onEnterCombatTab={() => setCurrentTab('hunter')} />}
            {currentTab === 'character' && <CharacterScreen onClose={() => setCurrentTab('hunter')} />}
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
        </Suspense>
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
      {isAdminOpen && <Suspense fallback={<div role="status" className="fixed bottom-24 inset-x-0 text-center text-sm text-slate-400">Загрузка админки…</div>}><AdminModal isOpen onClose={() => setIsAdminOpen(false)} /></Suspense>}
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
