# Telegram Serverless release and cutover

Target bot: `Aethelgardr_RPG_Bot`, app8958621621. Administrator: 437290420.
Mini App: https://app8958621621.tgcloud.ai/. Activation is complete; see
[the verified release record](telegram-serverless-migration.md).

The browser and game backend run on Telegram. Render PostgreSQL is a retained
source backup, not a runtime dependency. GitHub Actions supplies the notification
timer; it does not host the game API. It runs approximately every five minutes
and can be delayed by GitHub scheduling. Bot message handlers also drain due
messages. Gameplay requests return immediately after their game commit instead
of waiting for notification delivery.

## Build and validation

```
npm ci
npm run lint
npm run build:telegram
npm run test:native
npm run serverless:audit
node scripts/run-native-check.mjs gameplayCheck
```

The release audit admits only the production endpoint, two bot handlers and
their libraries. Test/import functions live under `scripts/staging`, are injected
into authenticated CLI runs and are never published as player endpoints.
`npm run deploy` repeats the local checks before `tgcloud push`.

All 68 game routes are implemented behind `gameApi`; the old HTTP webhook is
replaced by native message/pre-checkout handlers. `ctx.initData.user` supplies
verified caller identity. The configured administrator ID is checked server-side.
Existing game commands, session generations, account reset epochs and durable
operation receipts remain authoritative. Replaying a payment charge never
extends Premium twice. Telegram effects occur after game commits through leased
durable outbox jobs. Delivery is at least once if the process stops after Telegram
accepts a message but before its acknowledgement is committed.

## Storage boundary and limits

The observed runtime rejects SQL transactions/savepoints and does not roll back
an invocation that throws. The backend therefore applies existing game services
to a private in-memory relational candidate and commits the entire world through
one conditional SQLite UPDATE on `game_atomic_documents`. Revision comparison
prevents lost updates; eight conflicts return a recoverable unknown-result reply.
No Telegram API call occurs inside a retry. This preserves atomic purchases across
both players, ownership changes and operation receipts.

This initial design targets the existing small game. All players share one write
boundary, and the document grows with inventory, telemetry and receipts. It is
not a horizontally scalable database design. Review real contention, memory,
latency, receipt retention and document size before increasing the player base.
Do not split owners into independent documents without solving atomic market and
clan transfers. Native module files must stay below the observed 1 MiB limit;
the build separates the Ukrainian dictionary for that reason.

## Source data and important preservation limit

The verified source contains 34 tables and 1,822 rows, including 13 accounts.
**Only one account has a server-side character save. The other 12 have
`character_authority=legacy-local` and `progress_json=NULL`.** Their account,
Premium, item and social rows are preserved. Character progress that exists only
in localStorage on the old origin is absent from PostgreSQL and cannot be
reconstructed from this snapshot. The new origin cannot read the old origin's
localStorage. Do not describe these accounts as 13 restored characters or silently
create replacement characters. The existing admission path can import an
original legacy save if it is recovered from the corresponding device.

Snapshots are ignored local files under `.migration-backups/`. Export is one
repeatable-read read-only PostgreSQL transaction. Verification checks every
table's row count and SHA-256. Test imports use a `staging:<sha256>` document;
the platform verifies its complete hash and reconstructs the canonical actor.
All native economic invariants pass against the imported world.

## Activation order

1. Disable Render Auto-Deploy and prevent the old service from writing again.
   Render reported the Helgard service suspended by its free usage limit during
   preparation. This automatic suspension alone is not a permanent write fence.
   `node scripts/fence-render-database.mjs --freeze` sets this source role's
   default transactions to read-only in this database, after checking that no
   other source sessions remain. `--status` checks it; `--unfreeze` reverses it.
2. Take and verify the final source snapshot; import to a fresh staging key and
   run actor/invariant verification. No production overwrite is allowed.
3. Promote the verified document with the CLI-only promotion script. It releases
   the old writer sessions while retaining progress/reset versions and receipts.
4. Deploy the checked native modules and Telegram static build. Verify webhook
   ownership and test authenticated reads without running human-directed probes.
5. Switch the bot menu and Mini App URL to the Telegram host. Existing per-user
   menu overrides must be updated too, using the configured language.
   The Main Mini App URL is a separate BotFather setting; the owner must set it
   to the Telegram URL as well.
6. Enable `TELEGRAM_NOTIFICATIONS_ENABLED=true` only after the default branch
   contains the reviewed workflow. The approved `TGCLOUD_TOKEN` Actions secret
   is full CLI access to this bot. Keep it out of Git, logs and snapshots.
7. Keep PostgreSQL and the local verified snapshot for recovery. Remove the old
   Render web service only with explicit final confirmation; never delete the DB.

After Telegram accepts new writes, do not roll back to the stale PostgreSQL copy
without exporting and reconciling Telegram changes. A code-only rollback may
retain the same native document; a storage rollback needs a deliberate write
fence and reconciliation plan.
