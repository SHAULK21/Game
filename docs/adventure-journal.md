# Story milestones and adventure journal

More → Adventure journal (both modern and fantasy interfaces) contains the introduction, royal briefing, return to the king and first Queen of Bats encounter. Locked chapters are visible but cannot be replayed. Replaying only opens a reader: it cannot start combat, consume energy, claim a quest or award another reward. Finish active combat before replaying.

## Automatic scenes

- Claiming `q_royal_first_journey` awards its existing reward once, then saves the two-page royal return chapter. An ongoing fight or journey finishes before this scene appears.
- The first valid encounter with `m_queen_bat` opens two pages before combat. Locked bosses do not open the scene. The actual encounter and its options are saved alongside the chapter; energy is charged only when reading finishes or the scene is skipped. Dungeon encounters preserve their room, difficulty, HP/MP and zero-energy cost.
- Page position and unlocked chapters live in `player.adventureJournal`, inside the existing character save. Reload resumes unfinished scenes. Old claimed royal quests and recorded plains boss victories unlock replay without automatic popups. Character resets start a fresh journal.
- Both new chapters support Back, Next, Skip and keyboard Escape. If the saved encounter can no longer start, the player can return to the game and prepare again. There is no additional quest or extra reward.

## Illustrations

Generated with the built-in ImageGen tool, using `public/assets/story/royal-order.webp` as a visual reference. Two new 1536×1024 illustrations were inspected and exported as approximately 1024×683 WebP, quality 84. The other pages reuse the existing `threat.webp` and `arrival.webp` artwork. UI text is separate and bilingual (Russian/Ukrainian).

Assets:

- `public/assets/story/first-boss.webp`
- `public/assets/story/royal-return.webp`

### Queen illustration prompt

Use case: illustration-story. Asset: single horizontal 3:2 cinematic illustration for Aethelgard medieval RPG. Primary request: first encounter with the Queen of Bats. The attached image is a STYLE REFERENCE only, not an edit target: match its richly detailed realistic painterly dark fantasy, coherent anatomy, textured materials and muted warm gold. In a vast limestone cavern, a terrifying giant queen bat unfolds her leathery wings from a high rock ledge, surrounded by a small swarm of ordinary bats. A class-neutral novice with dark hooded travel cloak, seen from behind small in foreground, holds a warm amber torch and looks upward. Cool blue cave shadows and amber torch light, dramatic yet readable on mobile. No king, no throne hall. Single full scene, no collage, no panels, no lettering, no UI, no watermark.

### Royal return illustration prompt

Use case: illustration-story. Asset: single horizontal 3:2 cinematic story illustration for Aethelgard RPG. Primary request: a novice returns to the king after successfully scouting the road to the green plains. Use the attached image as a character and style reference, not an edit target: same dignified elderly gray-bearded king, modest gold crown, engraved weathered armor, burgundy mantle, lion-carved throne and Gothic hall. Same class-neutral novice in dark hooded cloak shown from behind. New composition: novice stands before the throne presenting an unrolled parchment report with no readable writing; the king listens attentively and raises an open hand in respectful acknowledgement. A herald stands beside the throne, green countryside visible through Gothic window. Detailed realistic painterly medieval fantasy, rich warm amber candlelight, muted burgundy and worn gold. Single full scene, no collage, no panels, no text, no UI, no watermark.
