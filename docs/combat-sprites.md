# Combat character sprites

The ten playable classes use transparent full-body sprites in the fantasy combat scene. Existing portraits and registration artwork remain independent.

## Generation

Mode: edit / background extraction. Tool: imagegen. Each input was the existing `public/assets/sprites/generated/heroes/{class}-fullbody.webp`. Output: transparent RGBA PNG, encoded as 512×768 WebP with alpha retained (quality 86).

Final prompt:

> Use case: background-extraction. Asset type: transparent full-body RPG combat sprite. Edit target: the attached existing character image. Remove all scenery, forest, sky, buildings, magical background particles, rocks, ground and floor; output ONLY this exact full-body character on a truly transparent alpha background. Preserve the character's exact face identity, age, hairstyle, expression, physique, pose, armor/robes/cape, ornaments, hands and complete boots, and realistic dark fantasy painted rendering. Keep both feet fully visible. Do not invent or change costume or add weapons. Clean natural edges around hair, fur, cloth and armor with no rectangular background, no gray or black matte, no baked checkerboard, no border or frame. Center the full figure in a vertical 2:3 canvas with modest 4 percent transparent padding on all sides. Neutral subdued daylight appropriate for compositing onto multiple battle landscapes; remove excessive background-colored rim glow. No text.

## Files

- warrior: source `public/assets/sprites/generated/heroes/warrior-fullbody.webp`; output `public/assets/sprites/generated/heroes/combat/warrior.webp`.
- berserker: source `public/assets/sprites/generated/heroes/berserker-fullbody.webp`; output `public/assets/sprites/generated/heroes/combat/berserker.webp`.
- knight: source `public/assets/sprites/generated/heroes/knight-fullbody.webp`; output `public/assets/sprites/generated/heroes/combat/knight.webp`.
- rogue: source `public/assets/sprites/generated/heroes/rogue-fullbody.webp`; output `public/assets/sprites/generated/heroes/combat/rogue.webp`.
- assassin: source `public/assets/sprites/generated/heroes/assassin-fullbody.webp`; output `public/assets/sprites/generated/heroes/combat/assassin.webp`.
- archer: source `public/assets/sprites/generated/heroes/archer-fullbody.webp`; output `public/assets/sprites/generated/heroes/combat/archer.webp`.
- mage: source `public/assets/sprites/generated/heroes/mage-fullbody.webp`; output `public/assets/sprites/generated/heroes/combat/mage.webp`.
- necromancer: source `public/assets/sprites/generated/heroes/necromancer-fullbody.webp`; output `public/assets/sprites/generated/heroes/combat/necromancer.webp`.
- paladin: source `public/assets/sprites/generated/heroes/paladin-fullbody.webp`; output `public/assets/sprites/generated/heroes/combat/paladin.webp`.
- druid: source `public/assets/sprites/generated/heroes/druid-fullbody.webp`; output `public/assets/sprites/generated/heroes/combat/druid.webp`.

## Presentation

Figures share the battle landscape, with a soft foot shadow and subtle breathing, attack and hit animations. Reduced-motion preferences disable animation. These changes do not alter combat calculations.

