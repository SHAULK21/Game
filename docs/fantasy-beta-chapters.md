# Fantasy beta chapters and fantasy item pickers

Every non-hunt beta destination now has a chapter heading and parchment layout: world, character, arena, inventory, blacksmith, crafting, alchemy, mining, fishing, clan, chat, market, pets, leaderboard and adventure journal. Providers, screen components, actions, gates and saved progress remain shared. The first hunt/bestiary layout is retained.

Chapter cards, form fields, selected states, rarity/status colors and wrapped descriptions use ink colors suitable for parchment. The hero uses live labels instead of raster tabs with baked-in text. Forge choices use a grid in beta, and a searchable item ledger in stable fantasy. Existing inventory equipment disclosure and item actions remain available.

All fantasy native single-choice lists use the accessible SelectionField dialog. The market uses ItemSelector with artwork, item name, rarity, level, upgrade and quantity. Search, disabled choices, native change events, Escape and focus restoration are preserved. Multiple selects retain native semantics. Modern theme styling is unchanged.

Page turns cover every beta destination, capture one inert DOM snapshot, strip IDs and wait for lazy page loading. They never mount a second game screen or execute copied handlers. Timers, observers and resize listeners are cleaned up; reduced-motion uses a short fade. Chapter appearance animates opacity only: transforms on chapter ancestors would incorrectly contain fixed inventory sheets.

The beta active battle uses the same CombatScreen/CombatArena and stable fantasy combat rules scoped to `.classic-fantasy-surface`. The additional combat stylesheet contains the existing stable combat/surface declarations; keep it aligned when changing stable battle visuals. Hunt remains beta.

## Verification

- TypeScript and production build pass.
- 174 automated tests pass, including all beta chapter navigation, shared progress, item selection in all three themes, disabled options and keyboard focus.
- Playwright WebKit: 240 loaded views across three themes and 320/375/390/430 px portrait and 844 px landscape, Russian/Ukrainian and simulated safe insets. No horizontal control/panel overflow or uncaught page errors in this matrix.
- Item sheets in all themes and searchable pickers with simulated visible keyboard height 480 px remain inside safe viewport; search font 16 px. Reload-heavy dialog fixtures can log aborted mocked API requests; these checks do not validate the live server.
- Stable and beta battle scene, hero plaque and attack button computed backgrounds, colors, corner radii and minimum heights match.
- Visual inspection of beta chapters found and removed duplicate hero raster labels.

These are WebKit emulations with a seeded low-level character and mocked APIs, not physical iPhone or live multiplayer verification.
