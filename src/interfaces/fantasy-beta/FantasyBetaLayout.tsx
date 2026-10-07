import {useEffect,useRef} from 'react';
import {FantasyShell} from '../fantasy/FantasyGameContent';
import {BetaTopHeader} from '../fantasy/components/layout/BetaTopHeader';
import {BetaBottomNavigation} from '../fantasy/components/layout/BetaBottomNavigation';
import {BetaBookPage,BetaPageTurn,type BetaBookTab} from '../fantasy/components/ui/BetaBookPage';
import {useBookBounds} from '../fantasy/components/layout/useBookBounds';
import {useNavigation} from '../../context/NavigationContext';
import {useGame} from '../../context/GameContext';
function Surface({page,children}:React.PropsWithChildren<{page:string}>) { return page === 'hunter' ? <>{children}</> : <BetaBookPage page={page as BetaBookTab}>{children}</BetaBookPage>; }
export function FantasyBetaLayout() {
  const {currentTab,isCharacterSheetOpen} = useNavigation();
  const {player,isInCombat} = useGame();
  const pageSnapshot = useRef<HTMLElement|null>(null);
  const shellRef = useBookBounds(true,`${currentTab}:${isCharacterSheetOpen}:${Boolean(player)}:${isInCombat}`);
  useEffect(() => {
    const capture = () => {
      if (pageSnapshot.current || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
      const main = shellRef.current?.querySelector('main'); if (!main) return;
      const copy = document.createElement('div'); copy.className = 'beta-turn-copy';
      copy.append(...Array.from(main.childNodes,node => node.cloneNode(true)));
      copy.querySelectorAll('.beta-page-turn').forEach(node => node.remove());
      copy.querySelectorAll('[id]').forEach(node => node.removeAttribute('id'));
      copy.setAttribute('inert',''); copy.setAttribute('aria-hidden','true');
      const bounds = main.getBoundingClientRect(); copy.style.width = `${bounds.width}px`; copy.style.position = 'absolute';
      copy.style.top = `${bounds.top - parseFloat(getComputedStyle(shellRef.current!).getPropertyValue('--beta-book-top') || '0')}px`; copy.style.left = '-6.95%'; pageSnapshot.current = copy;
    };
    window.addEventListener('aethelgard:before-navigation',capture);
    return () => { window.removeEventListener('aethelgard:before-navigation',capture); pageSnapshot.current = null; };
  }, [shellRef]);
  return <FantasyShell Header={BetaTopHeader} Navigation={BetaBottomNavigation} Surface={Surface} shellRef={shellRef} decoration={<BetaPageTurn page={isCharacterSheetOpen ? 'character' : currentTab} snapshot={pageSnapshot}/>}/>;
}
