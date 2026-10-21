# Multiple characters per Telegram account

Open **Journal → Settings → Characters** (both interfaces), then **Create character**.
The account has five slots including its original character. Empty slots open the
existing character creation screen. The selector also appears on that screen.
Switching requires confirmed progress and uses the existing combat/travel guard.
The choice is stored per Telegram account in sessionStorage, so another tab does
not switch underneath an active game. On a fresh session slot 0 is selected.

Existing saves remain in slot 0 without conversion. Extra characters have their
own inventory, wallet, clan, PvP rating, quests, reset epoch, writer token and
operation journal. Premium, purchases, referral identity and notification settings
remain account-wide. Referral qualification currently uses the original hero's
level. Characters of the same account cannot fight each other in ranked PvP.
This feature is available in authenticated Telegram play, not the offline demo.

## Storage and authentication

The client sends `X-Game-Character` (slot 0–4), never an authoritative player ID.
Both backends resolve that slot using the verified Telegram owner. Missing slots
fail closed. `POST /api/characters` allocates a specified slot idempotently, so
retries cannot create duplicate characters. Negative internal player IDs are
reserved for extra characters and are mapped back to the owner for Telegram
notification delivery. Telegram authentication still accepts positive IDs only.

## Release

Deploy frontend and backend together. For Telegram Serverless use the existing
`npm run deploy` workflow; the links live in the existing atomic document and
need no new SDK table migration. For PostgreSQL, startup applies the additive
`server/migrations/20261022_characters.sql` migration before accepting requests.
The same definitions are included in `server/schema.sql` for fresh installations.
Do not roll back to an old server while leaving the new frontend deployed.

Validation: `npm run lint`, `npm test`, `npm run build:telegram`, and
`npm run serverless:audit`. Character tests cover real inventory separation,
owner checks, retry safety, SQL migration, shared Premium, notification delivery,
and browser switching guards.
