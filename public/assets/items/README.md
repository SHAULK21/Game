# Item artwork

`sprites/` contains 32 hand-painted fantasy inventory icons generated with the built-in image generation tool: weapons, armour slots, jewellery, profession tools, health/mana potions, four ore types and common hunt materials. Each is a separate 256×256 WebP with real transparency; no sprite atlas, frame, rarity marker or sharpening number is baked into the image.

`src/utils/itemSprites.ts` maps existing item names and types to these families, so old saves need no migration. `item.image` remains the explicit per-item override. Inventory, equipment, loot, market, mining and crafting screens share the same artwork. Unknown materials retain their vector drawings. An image load error tries family art or the resource vector before falling back to the old icon.

Generation prompt template:

> Use case: stylized-concept. Asset type: one production fantasy RPG inventory icon. Subject: one complete item. Hand-painted dark fantasy game item art, polished painterly 3D volume, crisp large silhouette, gentle warm top-left lighting, readable at 40 pixels. Centered complete object with 10% empty margin on all sides. Truly transparent isolated cutout background. Neutral steel, warm worn leather, saturated gem or potion colours where relevant. No text, numbers, frame, border, pedestal, scenery, character, extra objects or cast shadow outside object. Entire object within canvas.

Exact subject descriptions are saved in `sprite-prompts.json`. Generation uses the built-in tool; PNG sources are converted to WebP with alpha preserved. The UI supplies rarity and upgrade labels independently.

Existing Canva import remains optional: place the four sheets in `canva_item_sheets/` and run `python scripts/split_item_icon_sheets.py`. To use a specific imported image instead of a family icon, assign its URL to `item.image`.
