import type {CSSProperties} from 'react';
import {RpgIcon as VectorIcon,type RpgIconKind as VectorIconKind} from '../../interfaces/fantasy/components/ui/SvgRpgIcon';
export type ReferenceIconKind=VectorIconKind|'lands'|'dungeon'|'pin'|'compass'|'fish';
/** Flat, bounded navigation glyphs. Illustrations never share their size rules. */
export function RpgIcon({kind,size=24,className=''}:{kind:ReferenceIconKind;size?:number;className?:string}){
 const box:CSSProperties={width:size,height:size,flex:'0 0 auto',display:'inline-flex',alignItems:'center',justifyContent:'center'};
 const custom=kind==='fish'||kind==='more'||kind==='lands'||kind==='dungeon'||kind==='pin'||kind==='compass';
 return <span className={`reference-icon ${className}`} style={box} aria-hidden="true">{custom?<svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
 {kind==='fish'&&<><path d="M3 12c4-6 10-7 15-3l5-4v14l-5-4c-5 4-11 3-15-3Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/><circle cx="8" cy="11" r="1"/></>}
 {kind==='more'&&<path d="M3 4h18v3H3zm0 7h18v3H3zm0 7h18v3H3z"/>}
 {kind==='lands'&&<><path d="m1 20 7-15 5 10 4-13 6 18H1Z"/><path d="m6 10 2-5 2 5-2-1zm9-2 2-6 2 6-2-1z" fill="var(--reference-glyph-cutout,#26251e)"/></>}
 {kind==='dungeon'&&<path d="M3 21V11a9 9 0 0 1 18 0v10h-5V11a4 4 0 0 0-8 0v10H3Zm2-14 3 2 2-3-2-2-3 3Zm7-4v4h3l1-3-4-1Zm5 5 3 2-1 3-3-1 1-4Z"/>}
 {kind==='pin'&&<path fillRule="evenodd" d="M12 1a8 8 0 0 0-8 8c0 6 8 14 8 14s8-8 8-14a8 8 0 0 0-8-8Zm0 4a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z"/>}
 {kind==='compass'&&<><circle cx="12" cy="12" r="10" fill="none" stroke="currentColor"/><path d="m12 0 2 9 10 3-10 2-2 10-2-10L0 12l10-3 2-9Zm0 6-3 6 3 6 3-6-3-6Z"/></>}
 </svg>:<VectorIcon kind={kind==='hunt'?'attack':kind==='character'?'helmet':kind as VectorIconKind} size={size} className=""/>}</span>;
}
export type RpgIconKind=ReferenceIconKind;
