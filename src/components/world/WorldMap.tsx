import {Portrait} from '../../interfaces/fantasy/components/ui/Portrait';
import {getFantasyHeroArtwork} from '../../interfaces/fantasy/utils/heroArtwork';
import {RpgIcon} from '../navigation/ReferenceIcon';
import {t,useLocale,intlLocale} from '../../i18n/locale';
import {regionEntryLockReason} from '../../utils/regionalProgress';
import type {PlayerCharacter} from '../../types/game';
import type {RegionDefinition} from '../../data/gameData';
// Display coordinates only: access and travel costs come from game data/handlers.
const pins=[[18,76],[19,48],[40,76],[42,38],[64,76],[81,56],[63,34],[44,11],[82,14]];
// Non-interactive context above an open sheet. The actual map/list remains untouched.
export function WorldMapBackdrop({regions,selectedId,section='land',player}:{regions:RegionDefinition[];selectedId:string;section?:'land'|'dungeon';player:PlayerCharacter}){
 useLocale();const index=Math.max(0,regions.findIndex(r=>r.id===selectedId));
 const nearby=regions.slice(Math.max(0,Math.min(index-1,regions.length-3)),Math.max(3,index+2));
 return <div className="world-sheet-stage"><header className="world-sheet-context-hud"><Portrait src={getFantasyHeroArtwork(player.classId)} alt="" className="world-sheet-context-portrait"/><div className="world-sheet-context-identity"><strong>{player.name}</strong><span>{t('Ур.')} {player.level}</span><div className="world-sheet-context-xp"><i style={{width:`${Math.min(100,(player.exp||0)/Math.max(1,player.nextExp||1)*100)}%`}}/></div></div><div className="world-sheet-context-resources"><span><RpgIcon kind="energy" size={16}/>{player.energy}/{player.maxEnergy}</span><span><RpgIcon kind="gold" size={16}/>{new Intl.NumberFormat(intlLocale(),{notation:'compact',maximumFractionDigits:1}).format(player.gold||0)}</span></div></header><div className="world-sheet-map-context"><img src="/assets/world/aethelgard-atlas-v1.webp" alt=""/><h2>{t('Мир')}</h2><div className="world-sheet-map-tabs"><span className={section==='land'?'is-selected':''}>{t('Земли')}</span><span className={section==='dungeon'?'is-selected':''}>{t('Подземелья')}</span><span>{t('Занятия')}</span></div><div className="world-sheet-map-labels">{nearby.slice(0,3).map(r=><span key={r.id} className={r.id===selectedId?'is-selected':''}><i aria-hidden="true">◇</i><strong>{t(r.name).split(':')[0]}</strong><small>{t(r.levelRange)}</small></span>)}</div></div></div>;
}
export function WorldMap({regions,currentId,selectedId,player,onSelect}:{regions:RegionDefinition[];currentId:string;selectedId:string;player:PlayerCharacter;onSelect:(id:string)=>void}){
 useLocale();return <details className="world-map-panel"><summary>{t('Карта мира')}</summary><div className="world-map" role="group" aria-label={t('Земли')}>
 <img className="world-map-art" src="/assets/world/aethelgard-atlas-v1.webp" alt="" loading="lazy" draggable={false}/>
 {regions.map((r,i)=>{const lock=regionEntryLockReason(player,r);return <button key={r.id} style={{left:`${pins[i%pins.length][0]}%`,top:`${pins[i%pins.length][1]}%`}} className={`world-map-pin ${r.id===currentId?'is-current':''}`} aria-pressed={r.id===selectedId} aria-label={t('Посмотреть локацию: {0}').replace('{0}',t(r.name))} title={lock?t(lock):t(r.levelRange)} onClick={()=>onSelect(r.id)}><span aria-hidden="true">{lock?'◇':'◆'}</span><strong>{t(r.name).split(':')[0]}</strong></button>;})}</div></details>;
}
