import React from 'react';
import { BattleBackdrop, getBattleScene } from '../../components/combat/BattleBackdrop';

/** Modern-only art; existing battle and fantasy backgrounds stay intact. */
export function ModernLandscape({ regionId }: { regionId: string }) {
  if (regionId !== 'reg_plains') return <BattleBackdrop scene={getBattleScene(regionId, regionId)} />;
  return <div aria-hidden="true" className="absolute inset-0 pointer-events-none" data-battle-scene="plains">
    <img src="/assets/modern/green-plains.webp" alt="" className="h-full w-full object-cover" decoding="async" />
    <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/50" />
  </div>;
}
