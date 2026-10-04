# Mage equipment artwork

- Mode: edit/outpaint with imagegen, opaque background.
- Reference: `public/assets/sprites/generated/heroes/mage.webp`.
- Output: `public/assets/sprites/generated/heroes/mage-fullbody.webp` (512 × 1523, WebP).
- Scope: fantasy equipment frame for the mage. The existing square portrait remains the source for other screens.

## Generation prompt

Extend the supplied mage portrait into a full-body equipment-screen illustration. Preserve this exact character's identity: older bald dark-skinned male mage with short salt-and-pepper beard, same facial features, dignified serious expression, dark navy layered hooded robes embroidered with fine antique-gold astronomical patterns, circular gold-and-blue arcane medallions and chains. Outpaint the body down to both clearly visible boots. Standing front-facing, relaxed arms near sides, elaborate robe folds, leather belt with small potion pouches; no oversized weapon. Very tall narrow canvas, approximately 1:3 width:height. Full figure from head to boots occupies nearly the entire height with small safe margins, head begins 7% below top to fit an arched frame, boots end 94% down. Entire silhouette fits horizontally with small margins. Continue the same moody blue enchanted forest and floating cyan wisps throughout the background, dark edges, rich painterly realism and finely detailed fantasy game art. No text, no borders, no UI, no cropped legs. Composition made for a narrow tall portrait frame: character large and full height, no empty bands above or below.

## Verification

TypeScript check and production build pass. Browser inspection at 390 px and 900 px confirms the full-height figure, visible head and boots, and working live equipment slots. Artwork is not stretched; the frame clips the forest sides on narrow screens and extends the forest backdrop on wider screens.
