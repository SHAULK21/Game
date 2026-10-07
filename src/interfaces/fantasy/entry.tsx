import './fantasy.css';
import './mobile.css';
import {GameScreens} from '../../GameScreens';
import {InterfacePresentationContext} from '../../context/InterfacePresentationContext';
import {fantasyRegistration} from './registration';
import {FantasyLayout} from './FantasyLayout';
export default function FantasyInterface() { return <InterfacePresentationContext.Provider value={fantasyRegistration}><GameScreens Content={FantasyLayout}/></InterfacePresentationContext.Provider>; }
