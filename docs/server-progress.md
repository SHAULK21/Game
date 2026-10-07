# Server character persistence — implementation status

This branch is a draft. It implements the synchronization and session protocol,
not a complete authoritative gameplay engine. Do not deploy or merge it as the
completed specification yet.

## Implemented

- A `players.telegram_id` primary key maps to a JSONB progress partition. The
  authenticated Telegram identity selects the row; a body ID cannot select it.
- `progress_version` is monotonically increasing, including administrative resets.
  Row locking covers version comparison, write and durable operation receipt.
- A separate writer generation and hashed session token require explicit transfer.
  Old sessions cannot write checkpoints or invoke item, market, clan and PvP mutations.
- Old request IDs return current state without applying their side effects again.
  Reusing an ID with different parameters fails. Receipts are scoped by account and epoch.
- The initial gate waits for an authenticated read. Errors never imply absence.
  Cache keys and writer tokens are separated by Telegram ID; only confirmed state is cached.
- Migration checks ownership, structure, numeric limits and reset epoch, and backs up
  both submitted local data and an explicitly replaced server predecessor. Nothing is summed.
- SQL `owned_items` and market wallet balances are projected into the character.
  They are stripped from the JSON write partition. Known ledger IDs cannot be reintroduced
  as local inventory. An account reset invalidates JSON, active sessions and old imports.
- Existing SQL economic routes use a shared outer transaction. Nested transactions
  become savepoints. Item consumption, wallet reward, save version and response receipt
  commit together, before the HTTP response. Local resident-sale prices are read from
  server progress. Clan creation consumes the server wallet after successful creation.
- Combat checkpoints include HP/MP, enemy, phase, status effects, remaining chain rewards,
  consumed potion kinds and dungeon state. Restoring ended fights does not apply defeat
  penalties again. Incomplete travel is cancelled at its source without an energy refund
  or a destination/quest reward. Network failure pauses mutation controls and timers.
- Missing Telegram initData is rejected by default even when NODE_ENV was not configured.
  `ALLOW_DEV_AUTH=true` is an explicit non-production-only development exception.

## Required before this can satisfy the full request

The normal `/api/progress/checkpoint` endpoint still accepts a structurally validated
client snapshot, guarded by identity, writer token, version, immutable character ID
and reward-claim regression checks. These guards prevent an old device or a replay
from overwriting current progress. They do **not** verify all gameplay transitions.
A modified active client can still propose fabricated amounts, loot or combat outcomes.
The create endpoint similarly validates a proposed starter snapshot rather than
building the entire starter character from server rules.

This does not satisfy the requested prohibition on a permanent arbitrary client-state
upload API. Replace these two snapshot routes with a finite domain command reducer:
creation, combat turns, purchases, crafting, gathering and reward claims must execute
from the current server state and server randomness, with the existing version and
receipt transaction around them. Preserve the explicit import route only for migration.

Migration selection is open only until the first ordinary checkpoint/API mutation.
A divergent local hero found after that point is backed up and cannot automatically
replace the server hero. The current UI explains that manual recovery is needed.
A separate, explicitly confirmed recovery/selection workflow is still required if
self-service selection of that divergent local hero must remain available afterward.

Production testing must also cover the transaction adapter on a real multi-connection
PostgreSQL service, concurrent market purchases with seller locks, crash boundaries,
and actual Telegram mobile application termination. The embedded PostgreSQL tests
serialize connection checkout, so they are not a substitute for those lock-contention tests.

## Database migration

`server/migrations/20261007_character_progress.sql` is idempotent and also included
at the end of `server/schema.sql`, which startup already executes. It does not delete
existing players, wallets or items. Back up the PostgreSQL database before deployment.
The follow-up `server/migrations/20261007_resource_stacks.sql` removes the inventory
999-unit constraint, retaining the market lot constraint. Both migrations are
idempotent and included in startup schema SQL. No production migration has been run.

The added tables hold operation receipts, migration backups, ledger ID history and
legacy economic API receipts. Do not purge receipts while requests from their reset
epoch can still be retried. Do not restore a backup across a newer reset epoch.

## Validation

The baseline suite passed 211 tests. Follow-up regressions exercise the actual
browser coordinator and session gate without the local gameplay adapter. They cover
persistent migration decisions, reload/application-close recovery, failed transfer
and import, a committed migration whose response is lost, exact resource quantities,
ordered responses, pending GET/save invalidation, final feature refusal and unknown
purchase outcomes. See `docs/pr88-regressions.md` for the follow-up results.

`TEST_DATABASE_URL` switches these integration tests to a real PostgreSQL service
with up to six independent connections and an isolated schema per test. The
`postgres-progress` CI job provisions PostgreSQL 16 and runs the same tests. Without
that variable they run against PGlite with serialized connection checkout.
Gameplay UI fixtures retain their explicit local adapter; the new regressions do not.
