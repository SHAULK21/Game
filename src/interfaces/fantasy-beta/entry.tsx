import '../fantasy/fantasy-beta.css';
import '../fantasy/fantasy-chapters.css';
import '../fantasy/fantasy-combat-shared.css';
import './mobile.css';
import {GameScreens} from '../../GameScreens';
import {InterfacePresentationContext} from '../../context/InterfacePresentationContext';
import {fantasyRegistration} from '../fantasy/registration';
import {FantasyBetaLayout} from './FantasyBetaLayout';
export default function FantasyBetaInterface() { return <InterfacePresentationContext.Provider value={fantasyRegistration}><GameScreens Content={FantasyBetaLayout}/></InterfacePresentationContext.Provider>; }
