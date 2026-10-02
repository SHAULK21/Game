import { Axe, BowArrow, Cross, Leaf, Shield, ShieldCheck, Skull, Swords, WandSparkles, VenetianMask } from 'lucide-react';
import type { CharacterClassId } from '../../types/game';

const icons = { warrior: Shield, berserker: Axe, knight: ShieldCheck, rogue: Swords,
  assassin: VenetianMask, archer: BowArrow, mage: WandSparkles, necromancer: Skull,
  paladin: Cross, druid: Leaf } satisfies Record<CharacterClassId, typeof Shield>;

export function ClassIcon({ classId, className = 'h-5 w-5' }: { classId: CharacterClassId; className?: string }) {
  const Icon = icons[classId];
  return <Icon className={className} aria-hidden="true" />;
}
