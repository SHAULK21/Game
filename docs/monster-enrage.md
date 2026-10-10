# Long PvE encounters

Ordinary fights retain the previous damage through round 25. From round 26,
monster damage grows by `1 + n * 0.12 + n² * 0.015`, where `n = round - 25`.
The previous 2× ceiling is removed. Normal hits, super attacks and throwing
potions all use this multiplier. The rule covers regional monsters, dungeon
monsters, NPC gladiators and rank trials; server PvP is unchanged.

From round 40, pure defensive actions turn into an ordinary attack. Monster
control effects still expire normally but no longer cancel its turn. After all
armor, talents, shielding, misses and immunity, an enemy hit deals at least
`maxHeroHp * (round - 39) * 0.05` (rounded up). Only the shortfall is added as
a separately logged fury impact, so an already stronger hit is not double-counted.
This starts at 5% max HP on round 40, grows by 5 percentage points per round,
and reaches 100% on round 59. Even full healing each turn cannot perpetuate
combat. The existing once-per-dungeon necromancer resurrection remains available.
There is no automatic timeout defeat: killing the enemy before its turn still wins.

A shared Russian/Ukrainian combat notice warns from round 20, displays the
current multiplier and explains the unstoppable stage in all three interfaces.
New encounters and chain enemies already reset the round counter to 1.

Validation: actual GameProvider encounters with enormous armor, shields,
invulnerability, stun and full healing every turn end in defeat on round 59.
Tests exercise both ordinary attacks and delayed special casts, region fights,
NPC arena and ascension. A separate 540-battle simulation covered all ten
classes at hero levels 1, 4 and 8 in the first region: no timeouts.
