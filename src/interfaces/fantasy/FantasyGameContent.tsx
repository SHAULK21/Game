import { useBookBounds } from './components/layout/useBookBounds';
import { BetaBookPage, BetaPageTurn, type BetaBookTab } from './components/ui/BetaBookPage';
import { useInterface } from '../../context/InterfaceContext';
import { BetaTopHeader } from './components/layout/BetaTopHeader';
import { BetaBottomNavigation } from './components/layout/BetaBottomNavigation';
import { t as localize, useLocale } from '../../i18n/locale';
import React, { lazy, Suspense, useRef } from 'react';
import { useGame } from '../../context/GameContext';
import { TopHeader } from './components/layout/TopHeader';
import { BottomNavigation } from './components/layout/BottomNavigation';
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

export const FantasyGameContent: React.FC = () => {
  useLocale();
  const pageSnapshot = useRef<HTMLElement | null>(null);
  const { style } = useInterface();
  const Header = style === 'fantasy-beta' ? BetaTopHeader : TopHeader;
  const Navigation = style === 'fantasy-beta' ? BetaBottomNavigation : BottomNavigation;
  const { player, quests, isInCombat, activeMonster } = useGame();
  const { currentTab, setCurrentTab, isCharacterSheetOpen, setIsCharacterSheetOpen, isAdminOpen, setIsAdminOpen } = useNavigation();

  const shellRef = useBookBounds(style === 'fantasy-beta', `${currentTab}:${isCharacterSheetOpen}:${Boolean(player)}:${isInCombat}`);

  if (!player) {
    return <CharacterCreationModal />;
  }

  const availableQuests = quests.filter(q => q.completed && !q.claimed).length;

  return (
    <div ref={shellRef} onClickCapture={event => {
      if (style !== 'fantasy-beta' || !(event.target as HTMLElement).closest('button,a,summary')) return;
      const main = shellRef.current?.querySelector('main');
      if (!main) return;
      const copy = document.createElement('div');
      copy.className = 'beta-turn-copy';
      copy.append(...Array.from(main.childNodes, node => node.cloneNode(true)));
      copy.querySelectorAll('.beta-page-turn').forEach(node => node.remove());
      copy.querySelectorAll('[id]').forEach(node => node.removeAttribute('id'));
      copy.setAttribute('inert', '');
      copy.setAttribute('aria-hidden', 'true');
      copy.style.width = `${main.getBoundingClientRect().width}px`;
      copy.style.position = 'absolute';
      copy.style.top = `${main.getBoundingClientRect().top - parseFloat(getComputedStyle(shellRef.current!).getPropertyValue('--beta-book-top') || '0')}px`;
      copy.style.left = '-6.95%';
      pageSnapshot.current = copy;
    }} className="game-shell min-h-screen pt-safe text-slate-100 flex flex-col font-sans select-none overflow-x-clip">
      {/* Top Header */}
      <Header hidden={currentTab === 'hunter' && isInCombat && Boolean(activeMonster) && !isCharacterSheetOpen} compact={currentTab !== 'hunter' || isCharacterSheetOpen} onOpenCharacterSheet={() => setIsCharacterSheetOpen(true)} />

      {style === 'fantasy-beta' && <BetaPageTurn page={isCharacterSheetOpen ? 'character' : currentTab} snapshot={pageSnapshot} />}
      {/* Main View Area */}
      <main className="shell-main flex-1 w-full mx-auto">
        <Suspense fallback={<div role="status" className="p-6 text-center text-sm text-slate-400">{localize("Загрузка раздела…")}</div>}>
        {isCharacterSheetOpen ? (
          style === 'fantasy-beta' ? <BetaBookPage page="character"><CharacterScreen onClose={() => setIsCharacterSheetOpen(false)} /></BetaBookPage> : <CharacterScreen onClose={() => setIsCharacterSheetOpen(false)} />
        ) : (
          <BetaTabSurface page={currentTab as BetaBookTab} enabled={style === 'fantasy-beta'}>
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
          </BetaTabSurface>
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

function BetaTabSurface({ page, enabled, children }: React.PropsWithChildren<{ page: BetaBookTab; enabled: boolean }>) {
  return enabled && page !== 'hunter' ? <BetaBookPage page={page}>{children}</BetaBookPage> : <>{children}</>;
}
