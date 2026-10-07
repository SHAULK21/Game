import type {GameTabId} from '../../types/navigation';
import { useInterface } from '../../context/InterfaceContext';
import { t as localize, useLocale } from '../../i18n/locale';
import React, { lazy, Suspense } from 'react';
import { useGame } from '../../context/GameContext';
import { CombatScreen } from './components/combat/CombatScreen';
import { CharacterCreationModal } from '../../components/dialogs/CharacterCreationModal';
import { OfflineReportModal } from './components/dialogs/OfflineReportModal';
import { useNavigation } from '../../context/NavigationContext';

const FishingScreen = lazy(() => import('../../components/fishing/FishingScreen').then(module => ({ default: module.FishingScreen })));
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
const AdminModal = lazy(() => import('../../components/admin/AdminModal').then(module => ({ default: module.AdminModal })));

type HeaderProps = {onOpenCharacterSheet:() => void;compact?:boolean;hidden?:boolean};
type NavigationProps = {currentTab:GameTabId;onSelectTab:(tab:GameTabId) => void;availableQuestsCount:number};
export const FantasyShell: React.FC<{Header:React.ComponentType<HeaderProps>;Navigation:React.ComponentType<NavigationProps>;Surface?:React.ComponentType<React.PropsWithChildren<{page:string}>>;decoration?:React.ReactNode;shellRef?:React.Ref<HTMLDivElement>}> = ({Header,Navigation,Surface=PlainSurface,decoration,shellRef}) => {
  useLocale();
  const { player, quests, isInCombat, activeMonster } = useGame();
  const { currentTab, setCurrentTab, isCharacterSheetOpen, setIsCharacterSheetOpen, isAdminOpen, setIsAdminOpen } = useNavigation();
  if (!player) {
    return <CharacterCreationModal />;
  }

  const availableQuests = quests.filter(q => q.completed && !q.claimed).length;

  return (
    <div ref={shellRef} className="game-shell min-h-screen pt-safe text-slate-100 flex flex-col font-sans select-none overflow-x-clip">
      {/* Top Header */}
      <Header hidden={currentTab === 'hunter' && isInCombat && Boolean(activeMonster) && !isCharacterSheetOpen} compact={currentTab !== 'hunter' || isCharacterSheetOpen} onOpenCharacterSheet={() => setIsCharacterSheetOpen(true)} />

      {decoration}
      {/* Main View Area */}
      <main className="shell-main flex-1 w-full mx-auto">
        <Suspense fallback={<div role="status" className="p-6 text-center text-sm text-slate-400">{localize("Загрузка раздела…")}</div>}>
        {isCharacterSheetOpen ? (
          <Surface page="character"><CharacterScreen onClose={() => setIsCharacterSheetOpen(false)} /></Surface>
        ) : (
          <Surface page={currentTab}>
            {currentTab === 'hunter' && <CombatScreen onContinueDungeon={() => setCurrentTab('world')} onReturnToArena={() => setCurrentTab('arena')} />}
            {currentTab === 'world' && <WorldScreen onEnterCombatTab={() => setCurrentTab('hunter')} />}
            {currentTab === 'character' && <CharacterScreen onClose={() => setCurrentTab('hunter')} />}
            {currentTab === 'arena' && <ArenaScreen onEnterCombatTab={() => setCurrentTab('hunter')} />}
            {currentTab === 'inventory' && <InventoryScreen onNavigateToBlacksmith={() => setCurrentTab('blacksmith')} onNavigateToCrafting={() => setCurrentTab('crafting')} />}
            {currentTab === 'blacksmith' && <BlacksmithScreen />}
            {currentTab === 'crafting' && <CraftingScreen />}
            {currentTab === 'alchemy' && <AlchemyScreen />}
            {currentTab === 'mine' && <MiningScreen />}
            {currentTab === 'fishing' && <FishingScreen />}
            {currentTab === 'clan' && <ClanScreen />}
            {currentTab === 'chat' && <ChatScreen />}
            {currentTab === 'market' && <MarketScreen />}
            {currentTab === 'pets' && <PetsScreen />}
            {currentTab === 'leaderboard' && <LeaderboardScreen />}
            {currentTab === 'more' && <MoreMenuScreen onOpenAdmin={() => setIsAdminOpen(true)} />}
          </Surface>
        )}
        </Suspense>
      </main>

      {/* Bottom Thumb Navigation Bar */}
      <Navigation
        currentTab={isCharacterSheetOpen ? 'character' : currentTab}
        onSelectTab={tab => {
          setIsCharacterSheetOpen(false);
          setCurrentTab(tab);
        }}
        availableQuestsCount={availableQuests}
      />

      {/* Modals */}
      <OfflineReportModal />
      {isAdminOpen && <Suspense fallback={<div role="status" className="fixed bottom-24 inset-x-0 text-center text-sm text-slate-400">{localize("Загрузка админки…")}</div>}><AdminModal isOpen onClose={() => setIsAdminOpen(false)} /></Suspense>}
    </div>
  );
};

function PlainSurface({children}:React.PropsWithChildren<{page:string}>) { return <>{children}</>; }
// Compatibility entry for direct consumers; production entries import their layout explicitly.
const Classic = lazy(() => import('./FantasyLayout').then(module => ({default:module.FantasyLayout})));
const Beta = lazy(() => import('../fantasy-beta/FantasyBetaLayout').then(module => ({default:module.FantasyBetaLayout})));
export function FantasyGameContent() {
  const {style} = useInterface(); const Layout = style === 'fantasy-beta' ? Beta : Classic;
  return <Suspense fallback={<div role="status">{localize('Загрузка интерфейса…')}</div>}><Layout/></Suspense>;
}
