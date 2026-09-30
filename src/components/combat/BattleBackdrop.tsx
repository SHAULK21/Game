import React, { useId } from 'react';

const SCENES = {
  plains: { sky: '#426779', glow: '#d6b879', far: '#345846', ground: '#1e3a2a' },
  woods: { sky: '#273e64', glow: '#acc9e9', far: '#244c43', ground: '#142e29' },
  forest: { sky: '#233f39', glow: '#8cae82', far: '#183a2c', ground: '#10251e' },
  crypt: { sky: '#363653', glow: '#9d9cce', far: '#323640', ground: '#1b202e' },
  swamp: { sky: '#3e4b30', glow: '#b9c969', far: '#35452d', ground: '#182b25' },
  desert: { sky: '#825944', glow: '#f4ce8a', far: '#ac7549', ground: '#614430' },
  cursed: { sky: '#44314e', glow: '#c196db', far: '#3a3049', ground: '#231b30' },
  rift: { sky: '#5b2530', glow: '#ffad62', far: '#42252f', ground: '#261c27' },
  mountain: { sky: '#304d66', glow: '#b5d9e9', far: '#48627a', ground: '#243341' },
  cave: { sky: '#25374b', glow: '#72acc4', far: '#334354', ground: '#152331' },
  mine: { sky: '#44362d', glow: '#e5aa62', far: '#4d4035', ground: '#27231f' },
  spider: { sky: '#333344', glow: '#a8b69b', far: '#383e40', ground: '#1e2729' },
  arena: { sky: '#78534b', glow: '#efc791', far: '#796451', ground: '#4c3930' }
};
export type BattleScene = keyof typeof SCENES;

const REGION_SCENES: Record<string, BattleScene> = {
  reg_plains: 'plains', reg_whisper_woods: 'woods', reg_forgotten_crypt: 'crypt',
  reg_forest: 'forest', reg_swamp: 'swamp', reg_desert: 'desert',
  reg_cursed: 'cursed', reg_rift: 'rift', reg_dragon: 'mountain'
};
const CAVE_SCENES: Record<string, BattleScene> = {
  cave_bat: 'cave', cave_mine: 'mine', cave_spider: 'spider',
  cave_catacombs: 'crypt', cave_rift: 'rift', cave_dragon: 'cave'
};

export const getBattleScene = (regionId: string | undefined, fallbackRegionId: string, dungeonId?: string): BattleScene =>
  regionId === 'arena' ? 'arena' : (dungeonId && CAVE_SCENES[dungeonId]) || REGION_SCENES[regionId || ''] || REGION_SCENES[fallbackRegionId] || 'plains';

export const BattleBackdrop: React.FC<{ scene: BattleScene; dungeonId?: string }> = ({ scene, dungeonId }) => {
  const id = useId().replace(/:/g, '');
  const p = SCENES[scene];
  const underground = ['cave', 'mine', 'spider'].includes(scene) || Boolean(dungeonId);
  const trees = ['woods', 'forest', 'swamp', 'cursed'].includes(scene);
  const ruins = ['crypt', 'cursed'].includes(scene);
  return <svg aria-hidden="true" className="absolute inset-0 h-full w-full pointer-events-none" viewBox="0 0 960 440" preserveAspectRatio="xMidYMid slice" data-battle-scene={scene}>
    <defs>
      <linearGradient id={`${id}-sky`} x2="0" y2="1"><stop stopColor={p.sky}/><stop offset="1" stopColor={p.ground}/></linearGradient>
      <radialGradient id={`${id}-light`}><stop stopColor={p.glow} stopOpacity=".55"/><stop offset="1" stopColor={p.glow} stopOpacity="0"/></radialGradient>
      <linearGradient id={`${id}-shade`} x2="0" y2="1"><stop stopColor="#050a14" stopOpacity=".18"/><stop offset=".5" stopColor="#050a14" stopOpacity=".06"/><stop offset="1" stopColor="#050a14" stopOpacity=".65"/></linearGradient>
    </defs>
    <path fill={`url(#${id}-sky)`} d="M0 0H960V440H0z"/>
    <ellipse cx="480" cy="145" rx="380" ry="230" fill={`url(#${id}-light)`}/>
    {!underground && <circle cx="690" cy="92" r={scene === 'desert' ? 40 : 25} fill={p.glow} opacity=".7"/>}
    <path d="M0 295L110 190L230 264L335 126L450 245L590 156L755 259L865 150L960 245V440H0Z" fill={p.far} opacity=".7"/>
    {scene === 'mountain' && <path d="M285 180L335 126L394 190L355 174L338 153L323 177ZM811 207L865 150L909 199L871 183L857 176Z" fill="#b7cbd4" opacity=".7"/>}
    {scene === 'desert' && <>
      <path d="M0 310Q200 190 445 305T960 270V440H0Z" fill="#a4764c"/>
      <path d="M0 353Q320 225 610 340T960 305V440H0Z" fill="#725338"/>
      <path d="M660 282L742 151L823 282Z" fill="#70573e"/><path d="M742 151L754 282H823Z" fill="#564633"/>
    </>}
    {trees && [35, 125, 225, 760, 855, 945].map((x, i) => <g key={x} transform={`translate(${x} ${25 + (i % 3) * 30})`} fill={i % 2 ? '#102b29' : p.ground}>
      <path d="M-10 350L-6 105L-38 63L-31 52L0 87L22 21L32 25L7 107L13 350Z"/>
      {scene !== 'cursed' && <><ellipse cy="67" rx="76" ry="71"/><ellipse cx="-38" cy="127" rx="70" ry="50"/><ellipse cx="40" cy="146" rx="67" ry="60"/></>}
    </g>)}
    {ruins && <g fill="#202532" stroke={p.far} strokeWidth="4">
      <path d="M70 315V100H146V315ZM814 315V100H890V315ZM50 95H166V119H50ZM794 95H910V119H794Z"/>
      <path d="M332 330V175Q480 10 628 175V330H592V183Q480 66 368 183V330Z"/>
      <path d="M183 354V283H230V354ZM724 354V262H765V354Z"/>
    </g>}
    {scene === 'arena' && <g stroke="#a28b6c" strokeWidth="8" fill="#453b36">
      <path d="M-30 80Q480 290 990 80V225Q480 405-30 225Z"/>
      {[125, 164, 204].map(y => <path key={y} d={`M-30 ${y}Q480 ${y + 185} 990 ${y}`} fill="none"/>)}
      {[30, 150, 810, 930].map(x => <path key={x} d={`M${x-17} 225V80H${x+17}V225M${x-27} 80H${x+27}`} />)}
    </g>}
    <path d="M0 355Q260 300 480 345T960 335V440H0Z" fill={p.ground}/>
    {scene === 'swamp' && <g fill="#80a99a" opacity=".3"><ellipse cx="480" cy="367" rx="290" ry="19"/><ellipse cx="150" cy="398" rx="120" ry="9"/></g>}
    {scene === 'rift' && <>
      <path d="M400 440L475 353L460 323L526 260L492 202L546 106L510 36" fill="none" stroke="#ed7144" strokeWidth="9" opacity=".8"/>
      <ellipse cx="510" cy="145" rx="42" ry="111" fill={`url(#${id}-light)`}/>
      {[75, 240, 675, 865].map((x, i) => <circle key={x} cx={x} cy={120 + i * 45} r="3" fill="#ffd395"/>)}
    </>}
    {underground && <g fill="#111b26">
      <path d="M0 0H960V69L894 44L850 150L814 57L752 91L701 34L642 64L575 22L505 91L449 36L365 62L300 28L230 100L171 47L105 133L69 42L0 111Z"/>
      <path d="M0 0L80 87L42 249L97 440H0ZM960 0L880 90L918 252L870 440H960Z"/>
    </g>}
    {scene === 'mine' && <g stroke="#66503a" fill="none" strokeWidth="20"><path d="M140 356V72H820V356"/><path d="M140 160L245 72M820 160L715 72"/><path d="M300 440L425 300M660 440L535 300" strokeWidth="5"/></g>}
    {scene === 'spider' && <g stroke="#d3d6c9" fill="none" opacity=".4"><path d="M0 0L270 210M0 0L330 90M0 0L95 260M960 0L740 240M960 0L650 70"/><path d="M0 80Q70 115 115 20M0 155Q115 220 220 40M960 95Q858 135 820 18M960 180Q810 223 730 60"/></g>}
    {dungeonId === 'cave_dragon' && <g fill="#d5a65a" opacity=".7"><path d="M640 366L687 326L748 376L790 348L866 405H601Z"/>{[665, 710, 790, 840].map(x => <ellipse key={x} cx={x} cy="378" rx="19" ry="6"/>)}</g>}
    {[90, 230, 740, 900].map((x, i) => <path key={x} d={`M${x} ${385+i%2*20}l17 -11l26 8l-5 17h-37z`} fill={p.far} opacity=".6"/>)}
    <path fill={`url(#${id}-shade)`} d="M0 0H960V440H0z"/>
  </svg>;
};
