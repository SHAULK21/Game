# PR #88: follow-up to acbc6fe

PR remains draft. Checkpoints still accept validated client snapshots; this work
fixes four synchronization defects without implementing authoritative gameplay.

## Changes

- A migration decision is stored under `aethelgard_migration_candidate_<ID>_<reset>`
  before session acquisition can overwrite/delete the confirmed cache. The original
  bytes are backed up separately. The decision and exact import request survive
  restart and a lost response; only a confirmed import or explicit server choice
  removes the decision. Legacy saves without an epoch are importable only at epoch 0.
  Prior-reset decisions remain archival and cannot be read for the current epoch.
- Local and SQL inventory holdings use an integer stack range 1–2,147,483,647.
  Market/resident-sale lots remain 1–999. Existing valid large stacks are neither
  split nor truncated. Resource producers share checked arithmetic; matching local
  stacks grow even in a full bag. SQL-owned projections are not merged into local
  stacks. A capacity/maximum overflow leaves the source state unchanged; SQL reward
  overflow rolls back the transaction. Bulk disposal counts the whole stack.
- Incoming responses are checked against Telegram identity, reset epoch, progress
  version and session generation before cache/queue/event changes. Equal-version
  acknowledgements preserve queued descendants. Writer transfer/reset invalidates
  old pending writes. The background gate checks the captured request again after
  await, including whether a save started meanwhile.
- Donation is unavailable in the UI and the client does not send new requests.
  The endpoint returns HTTP 501, `FEATURE_UNAVAILABLE`, `outcome: rejected`, without
  a debit/receipt. An old donation retry may reach that endpoint and be cleared
  after its final refusal. Unknown 5xx/network outcomes retain their exact operation
  ID and payload, and successful lost-response purchases recover through receipts.

## Verification

| Scenario | Regression evidence |
| --- | --- |
| Initial network failure | No registration, no local fallback or deletion |
| Session acquisition replaces cache | Independent candidate and original backup remain |
| Reload / application termination | New browser restores decision; losing writer token requires explicit transfer |
| Offline transfer / import / server choice | Decision stays available until confirmed completion |
| Lost response after committed import | Same persisted request replays; no second credit/version increment |
| Different device and server heroes | Explicit selection replaces the chosen JSON partition; wallets/items are not summed; previous server hero backed up |
| Wrong owner / old reset | Candidate rejected; undefined legacy epoch cannot inherit a newer reset |
| 998 / 999 / 1000 / 1,000,000 | Exact counts through creation, checkpoints, load, migration and SQL projection |
| Full bag / bulk disposal | Existing stack grows without a new slot; 1,000-item disposal pays all 1,000 units |
| Version 2 then delayed version 1 | Cache, queue and reload events unchanged by stale response |
| Equal version / lower generation / wrong owner | Equal version retains descendants; obsolete generation/owner ignored |
| Pending GET during transfer or save | Completion recheck rejects it before applying state |
| Reset during pending save | Old response cannot restore prior epoch or mark current state offline |
| New donation / old donation retry | New call blocked; confirmed refusal clears old retry and returns game to ready |
| 503 / lost successful purchase response | Retry stays durable; receipt recovery clears it without re-execution |

Results for implementation commit `5e7371e06d834baee0e6bb89f675409b72d76631`:

- `npm test`: **223 passed, 0 failed**.
- Focused progress/resource regressions: **20 passed, 0 failed**.
- PostgreSQL 16 CI integration: **passed**, including all 18 HTTP/store/browser
  integration tests with independent connections (the other 2 focused tests are
  resource arithmetic tests).
- TypeScript and production build: **passed**; existing chunk-size warning remains.
- `git diff --check`: **passed**.
- [PostgreSQL CI job](https://github.com/SHAULK21/Game/actions/runs/37669431160/job/112957026893).

Local focused tests use PGlite and the actual HTTP/client progress mechanism.
The same integration suites support PostgreSQL through `TEST_DATABASE_URL`;
CI provisions PostgreSQL 16 with independent connections. Actual mobile OS process
termination is modeled by replacing the entire browser instance, not a physical
Telegram device. No production database was changed.

Commands:

```sh
npm run lint
npm test
npm run build
TEST_DATABASE_URL=postgres://... node --import tsx --test tests/server-progress.test.ts tests/server-progress-ui.test.ts
```
