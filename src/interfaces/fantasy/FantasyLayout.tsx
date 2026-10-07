import {FantasyShell} from './FantasyGameContent';
import {TopHeader} from './components/layout/TopHeader';
import {BottomNavigation} from './components/layout/BottomNavigation';
export function FantasyLayout() { return <FantasyShell Header={TopHeader} Navigation={BottomNavigation}/>; }
