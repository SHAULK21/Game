import {t,useLocale} from '../../i18n/locale';
import {regionEntryLockReason} from '../../utils/regionalProgress';
import type {PlayerCharacter} from '../../types/game';
import type {RegionDefinition} from '../../data/gameData';
// Display coordinates only: access and travel costs come from game data/handlers.
const pins=[[18,76],[19,48],[40,76],[42,38],[64,76],[81,56],[63,34],[44,11],[82,14]];
export function WorldMap({regions,currentId,selectedId,player,onSelect}:{regions:RegionDefinition[];currentId:string;selectedId:string;player:PlayerCharacter;onSelect:(id:string)=>void}){
 useLocale();return <details className="world-map-panel"><summary>{t('Карта мира')}</summary><div className="world-map" role="group" aria-label={t('Земли')}>
 <img className="world-map-art" src="/assets/world/aethelgard-atlas-v1.webp" alt="" loading="lazy" draggable={false}/>
 {regions.map((r,i)=>{const lock=regionEntryLockReason(player,r);return <button key={r.id} style={{left:`${pins[i%pins.length][0]}%`,top:`${pins[i%pins.length][1]}%`}} className={`world-map-pin ${r.id===currentId?'is-current':''}`} aria-pressed={r.id===selectedId} aria-label={t('Посмотреть локацию: {0}').replace('{0}',t(r.name))} title={lock?t(lock):t(r.levelRange)} onClick={()=>onSelect(r.id)}><span aria-hidden="true">{lock?'◇':'◆'}</span><strong>{t(r.name).split(':')[0]}</strong></button>;})}</div></details>;
}
