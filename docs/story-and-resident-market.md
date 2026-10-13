# Story introduction and resident buyout

New characters see five illustrated story cards before registration. Existing characters bypass the introduction. Completion/skip is stored per Telegram account on this device; changing device or clearing browser data can show it again. The story is available in Russian and Ukrainian and does not grant quest progress or change class mechanics.

The market has Knights (existing player listings), Local residents (instant buyout), and Basic shop. Residents use daily demand for materials, ore, fish, potions and equipment. Demand rotates at midnight in Europe/Kyiv; category multipliers are 80%, 90%, 100%, 120% and 140% of the buyout baseline. The baseline is the greater of 70% of normal sellPrice and a category minimum (8/10/12/15/30 gold) increased for level and rarity. Per-unit rounding occurs before multiplication by quantity; every sellable unit pays at least 5 gold. Zero-price or invalid-price items cannot be sold. The client fetches the server day, displays demand and per-unit/total quotes, and blocks confirmation when prices cannot be fetched. A new operation with an expired day is rejected without consuming items; a recorded receipt is replayed at its original price even after midnight. Old pending operations without a day still recover their original receipts. There is no listing tax or energy charge. Locked, equipped and clan-bound items are excluded. Server-owned items use canonical database prices and quantities. Local items use the existing client-authoritative inventory model. Buyout receipts are replayable after a lost response; account epoch is checked while the player is locked in the transaction. No new schema migration is required.

## Illustration prompts

Generated with built-in imagegen. Project assets: `public/assets/story/{arrival,courtyard,king,threat,mission}.webp`.

### arrival

Use case: illustration-story. Asset type: illustrated introductory story card for Aethelgard RPG. A lone cloaked traveler seen from behind approaches the immense stone gates of Aethelgard castle at dawn, warm lit windows, mist and mountains, grounded medieval dark fantasy. Painted realistic dark fantasy storybook artwork, intricate textures, subdued earthy palette with amber light, cinematic 3:2 landscape composition. No lettering, no UI, no watermark. Compatible visual style across five story cards. Avoid identifying the newcomer by gender or class.

### courtyard

Use case: illustration-story. Asset type: illustrated introductory story card for Aethelgard RPG. Inside a medieval castle courtyard, knights training, a blacksmith, an herbalist and a hooded mage, herald holding a sealed scroll in the foreground. A welcoming living castle, no battle. Painted realistic dark fantasy storybook artwork, intricate textures, subdued earthy palette with amber light, cinematic 3:2 landscape composition. No lettering, no UI, no watermark. Compatible visual style across five story cards. Avoid identifying the newcomer by gender or class.

### king

Use case: illustration-story. Asset type: illustrated introductory story card for Aethelgard RPG. A wise weary king in dark gold armor seated on a stone throne beneath worn crimson banners, addressing an unseen newcomer, warm candlelight, solemn medieval fantasy audience. Painted realistic dark fantasy storybook artwork, intricate textures, subdued earthy palette with amber light, cinematic 3:2 landscape composition. No lettering, no UI, no watermark. Compatible visual style across five story cards. Avoid identifying the newcomer by gender or class.

### threat

Use case: illustration-story. Asset type: illustrated introductory story card for Aethelgard RPG. View from castle battlements over wild green plains and dark forest; distant ruined watchtower and ominous shadow in forest, wolves on the empty road, beautiful but dangerous realm. Painted realistic dark fantasy storybook artwork, intricate textures, subdued earthy palette with amber light, cinematic 3:2 landscape composition. No lettering, no UI, no watermark. Compatible visual style across five story cards. Avoid identifying the newcomer by gender or class.

### mission

Use case: illustration-story. Asset type: illustrated introductory story card for Aethelgard RPG. Close narrative still life of a royal sealed parchment beside a simple sword, staff, bow and leather satchel on a wooden table; through an open window dawn lights the road into green plains. First mission begins. Painted realistic dark fantasy storybook artwork, intricate textures, subdued earthy palette with amber light, cinematic 3:2 landscape composition. No lettering, no UI, no watermark. Compatible visual style across five story cards. Avoid identifying the newcomer by gender or class.


Daily-demand validation: TypeScript and production build pass; all three production interfaces pass; resident/market regressions 6/6, full suite 219/219. SQL integration uses PGlite with the real buyout handler; UI checks use the real GameProvider. No DB migration is required because the day and original payout live in existing receipt JSON.
