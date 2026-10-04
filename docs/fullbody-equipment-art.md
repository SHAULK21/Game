# Full-body fantasy equipment artwork

Mode: built-in imagegen edit/outpaint; opaque backgrounds. Source portraits retain their identity, costume, materials and atmosphere. Each portrait is a separate generated edit.

The equipment view now uses `getFantasyEquipmentArtwork` for all ten playable classes. The mage art was added previously; nine other playable classes now receive full-body versions. `hunter-fullbody.webp` also extends the existing hunter artwork for future use; it does not introduce a playable class.

Assets are stored in `public/assets/sprites/generated/heroes/<id>-fullbody.webp`, 512 px wide, approximately 1:3, WebP quality 85 (mage unchanged). Original square portraits remain untouched and are still used outside equipment. Each frame continues its own background rather than the mage forest.

## Prompt set

### warrior

Reference/edit target: `public/assets/sprites/generated/heroes/warrior.webp`.
Saved asset: `public/assets/sprites/generated/heroes/warrior-fullbody.webp`.

Use case: identity-preserve. Edit target: supplied square warrior portrait. Extend this exact character into a full-body fantasy equipment illustration. Preserve identity, age, gender, skin tone, facial features, hair, headwear, clothing colors, armor details and jewelry. Character: older dark-skinned woman with silver-streaked braided dark hair, scarred face, blackened plate armor with antique gold edging, fur mantle and round solar clasp. Continue the existing costume naturally down to matching trousers or robe, leg armor if appropriate, and both visible boots. Standing calm front-facing or slight three-quarter angle, arms near sides, compact silhouette, no new large weapon. Continue the existing moody forest or ruined forest background and lighting; retain class-specific atmosphere. Tall narrow canvas approximately 1:3 width:height. Entire figure head to boots fills height: top of head at 7%, soles at 94%, minimal empty space. Keep hands and gear within central 80% width for a narrow equipment frame. Same detailed painterly realism, worn natural materials and dark fantasy style as the supplied artwork and the completed full-body mage. No UI, no frame, no text, no watermark, no extra characters, no cropped feet.

### knight

Reference/edit target: `public/assets/sprites/generated/heroes/knight.webp`.
Saved asset: `public/assets/sprites/generated/heroes/knight-fullbody.webp`.

Use case: identity-preserve. Edit target: supplied square knight portrait. Extend this exact character into a full-body fantasy equipment illustration. Preserve identity, age, gender, skin tone, facial features, hair, headwear, clothing colors, armor details and jewelry. Character: armored knight with face entirely concealed by the same closed blackened steel greathelm with gold vertical ridge and filigree, dark engraved plate armor and two gold round chest clasps. Continue the existing costume naturally down to matching trousers or robe, leg armor if appropriate, and both visible boots. Standing calm front-facing or slight three-quarter angle, arms near sides, compact silhouette, no new large weapon. Continue the existing moody forest or ruined forest background and lighting; retain class-specific atmosphere. Tall narrow canvas approximately 1:3 width:height. Entire figure head to boots fills height: top of head at 7%, soles at 94%, minimal empty space. Keep hands and gear within central 80% width for a narrow equipment frame. Same detailed painterly realism, worn natural materials and dark fantasy style as the supplied artwork and the completed full-body mage. No UI, no frame, no text, no watermark, no extra characters, no cropped feet.

### paladin

Reference/edit target: `public/assets/sprites/generated/heroes/paladin.webp`.
Saved asset: `public/assets/sprites/generated/heroes/paladin-fullbody.webp`.

Use case: identity-preserve. Edit target: supplied square paladin portrait. Extend this exact character into a full-body fantasy equipment illustration. Preserve identity, age, gender, skin tone, facial features, hair, headwear, clothing colors, armor details and jewelry. Character: mature freckled red-haired woman with long red braid, same uncovered face, dark gold-engraved plate armor, sunburst chest medallion and pale cloak. Continue the existing costume naturally down to matching trousers or robe, leg armor if appropriate, and both visible boots. Standing calm front-facing or slight three-quarter angle, arms near sides, compact silhouette, no new large weapon. Continue the existing moody forest or ruined forest background and lighting; retain class-specific atmosphere. Tall narrow canvas approximately 1:3 width:height. Entire figure head to boots fills height: top of head at 7%, soles at 94%, minimal empty space. Keep hands and gear within central 80% width for a narrow equipment frame. Same detailed painterly realism, worn natural materials and dark fantasy style as the supplied artwork and the completed full-body mage. No UI, no frame, no text, no watermark, no extra characters, no cropped feet.

### berserker

Reference/edit target: `public/assets/sprites/generated/heroes/berserker.webp`.
Saved asset: `public/assets/sprites/generated/heroes/berserker-fullbody.webp`.

Use case: identity-preserve. Edit target: supplied square berserker portrait. Extend this exact character into a full-body fantasy equipment illustration. Preserve identity, age, gender, skin tone, facial features, hair, headwear, clothing colors, armor details and jewelry. Character: rugged muscular red-haired male with weathered scarred face, long red beard and braids, thick dark fur mantle, leather and dark metal armor, bronze clasp. Continue the existing costume naturally down to matching trousers or robe, leg armor if appropriate, and both visible boots. Standing calm front-facing or slight three-quarter angle, arms near sides, compact silhouette, no new large weapon. Continue the existing moody forest or ruined forest background and lighting; retain class-specific atmosphere. Tall narrow canvas approximately 1:3 width:height. Entire figure head to boots fills height: top of head at 7%, soles at 94%, minimal empty space. Keep hands and gear within central 80% width for a narrow equipment frame. Same detailed painterly realism, worn natural materials and dark fantasy style as the supplied artwork and the completed full-body mage. No UI, no frame, no text, no watermark, no extra characters, no cropped feet.

### archer

Reference/edit target: `public/assets/sprites/generated/heroes/archer.webp`.
Saved asset: `public/assets/sprites/generated/heroes/archer-fullbody.webp`.

Use case: identity-preserve. Edit target: supplied square archer portrait. Extend this exact character into a full-body fantasy equipment illustration. Preserve identity, age, gender, skin tone, facial features, hair, headwear, clothing colors, armor details and jewelry. Character: dark-skinned woman with tightly curled dark hair and some braids, same face, moss green scarf and cloak, worn leather armor, bow and quiver secured close along her back. Continue the existing costume naturally down to matching trousers or robe, leg armor if appropriate, and both visible boots. Standing calm front-facing or slight three-quarter angle, arms near sides, compact silhouette, no new large weapon. Continue the existing moody forest or ruined forest background and lighting; retain class-specific atmosphere. Tall narrow canvas approximately 1:3 width:height. Entire figure head to boots fills height: top of head at 7%, soles at 94%, minimal empty space. Keep hands and gear within central 80% width for a narrow equipment frame. Same detailed painterly realism, worn natural materials and dark fantasy style as the supplied artwork and the completed full-body mage. No UI, no frame, no text, no watermark, no extra characters, no cropped feet.

### hunter

Reference/edit target: `public/assets/sprites/generated/heroes/hunter.webp`.
Saved asset: `public/assets/sprites/generated/heroes/hunter-fullbody.webp`.

Use case: identity-preserve. Edit target: supplied square hunter portrait. Extend this exact character into a full-body fantasy equipment illustration. Preserve identity, age, gender, skin tone, facial features, hair, headwear, clothing colors, armor details and jewelry. Character: older gray-bearded man with long gray hair, broad-brimmed worn black feathered hat, same face, dark layered leather coat and cloak with brass buckles, hunting weapon secured close along his back. Continue the existing costume naturally down to matching trousers or robe, leg armor if appropriate, and both visible boots. Standing calm front-facing or slight three-quarter angle, arms near sides, compact silhouette, no new large weapon. Continue the existing moody forest or ruined forest background and lighting; retain class-specific atmosphere. Tall narrow canvas approximately 1:3 width:height. Entire figure head to boots fills height: top of head at 7%, soles at 94%, minimal empty space. Keep hands and gear within central 80% width for a narrow equipment frame. Same detailed painterly realism, worn natural materials and dark fantasy style as the supplied artwork and the completed full-body mage. No UI, no frame, no text, no watermark, no extra characters, no cropped feet.

### rogue

Reference/edit target: `public/assets/sprites/generated/heroes/rogue.webp`.
Saved asset: `public/assets/sprites/generated/heroes/rogue-fullbody.webp`.

Use case: identity-preserve. Edit target: supplied square rogue portrait. Extend this exact character into a full-body fantasy equipment illustration. Preserve identity, age, gender, skin tone, facial features, hair, headwear, clothing colors, armor details and jewelry. Character: young olive-skinned woman with short tousled curly black hair, same face, layered weathered dark leather armor, dark scarf, brass clasps and straps, small daggers sheathed close at belt. Continue the existing costume naturally down to matching trousers or robe, leg armor if appropriate, and both visible boots. Standing calm front-facing or slight three-quarter angle, arms near sides, compact silhouette, no new large weapon. Continue the existing moody forest or ruined forest background and lighting; retain class-specific atmosphere. Tall narrow canvas approximately 1:3 width:height. Entire figure head to boots fills height: top of head at 7%, soles at 94%, minimal empty space. Keep hands and gear within central 80% width for a narrow equipment frame. Same detailed painterly realism, worn natural materials and dark fantasy style as the supplied artwork and the completed full-body mage. No UI, no frame, no text, no watermark, no extra characters, no cropped feet.

### assassin

Reference/edit target: `public/assets/sprites/generated/heroes/assassin.webp`.
Saved asset: `public/assets/sprites/generated/heroes/assassin-fullbody.webp`.

Use case: identity-preserve. Edit target: supplied square assassin portrait. Extend this exact character into a full-body fantasy equipment illustration. Preserve identity, age, gender, skin tone, facial features, hair, headwear, clothing colors, armor details and jewelry. Character: pale slender young male with dark asymmetric undercut, same face and stern eyes, high dark cowl, black leather armor with gold fittings, purple vial and sheathed daggers. Continue the existing costume naturally down to matching trousers or robe, leg armor if appropriate, and both visible boots. Standing calm front-facing or slight three-quarter angle, arms near sides, compact silhouette, no new large weapon. Continue the existing moody forest or ruined forest background and lighting; retain class-specific atmosphere. Tall narrow canvas approximately 1:3 width:height. Entire figure head to boots fills height: top of head at 7%, soles at 94%, minimal empty space. Keep hands and gear within central 80% width for a narrow equipment frame. Same detailed painterly realism, worn natural materials and dark fantasy style as the supplied artwork and the completed full-body mage. No UI, no frame, no text, no watermark, no extra characters, no cropped feet.

### necromancer

Reference/edit target: `public/assets/sprites/generated/heroes/necromancer.webp`.
Saved asset: `public/assets/sprites/generated/heroes/necromancer-fullbody.webp`.

Use case: identity-preserve. Edit target: supplied square necromancer portrait. Extend this exact character into a full-body fantasy equipment illustration. Preserve identity, age, gender, skin tone, facial features, hair, headwear, clothing colors, armor details and jewelry. Character: pale dark-haired woman with same face, dark ragged hood and black robes, gold chains and bird-skull necklace, violet magical wisps. Continue the existing costume naturally down to matching trousers or robe, leg armor if appropriate, and both visible boots. Standing calm front-facing or slight three-quarter angle, arms near sides, compact silhouette, no new large weapon. Continue the existing moody forest or ruined forest background and lighting; retain class-specific atmosphere. Tall narrow canvas approximately 1:3 width:height. Entire figure head to boots fills height: top of head at 7%, soles at 94%, minimal empty space. Keep hands and gear within central 80% width for a narrow equipment frame. Same detailed painterly realism, worn natural materials and dark fantasy style as the supplied artwork and the completed full-body mage. No UI, no frame, no text, no watermark, no extra characters, no cropped feet.

### druid

Reference/edit target: `public/assets/sprites/generated/heroes/druid.webp`.
Saved asset: `public/assets/sprites/generated/heroes/druid-fullbody.webp`.

Use case: identity-preserve. Edit target: supplied square druid portrait. Extend this exact character into a full-body fantasy equipment illustration. Preserve identity, age, gender, skin tone, facial features, hair, headwear, clothing colors, armor details and jewelry. Character: older East Asian man with long silver hair and gray beard, same face, moss green layered robes with leaves and antler ornaments, bronze round clasp and natural amulets. Continue the existing costume naturally down to matching trousers or robe, leg armor if appropriate, and both visible boots. Standing calm front-facing or slight three-quarter angle, arms near sides, compact silhouette, no new large weapon. Continue the existing moody forest or ruined forest background and lighting; retain class-specific atmosphere. Tall narrow canvas approximately 1:3 width:height. Entire figure head to boots fills height: top of head at 7%, soles at 94%, minimal empty space. Keep hands and gear within central 80% width for a narrow equipment frame. Same detailed painterly realism, worn natural materials and dark fantasy style as the supplied artwork and the completed full-body mage. No UI, no frame, no text, no watermark, no extra characters, no cropped feet.

## Verification

TypeScript check and production build pass. Browser checks cover all ten playable classes at 390 px and 900 px: the correct full-body image loads, its height fills the frame, and all fourteen equipment slots remain available. Mobile screenshots were inspected for face/boots visibility and frame clipping; wide screenshots confirm preserved proportions.

