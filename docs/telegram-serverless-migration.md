# Telegram Serverless migration status

See [release design and cutover procedure](telegram-cutover.md) for the current
implementation, data-preservation limits, deployment steps and recovery rules.

Prepared from SHAULK21/Game commit 10939c4 for Aethelgardr_RPG_Bot.
Administrator: 437290420. Production activation completed on 18 October 2026
(Europe/Kiev). The game is live at https://app8958621621.tgcloud.ai/.

Verified on 18 October 2026 (Europe/Kiev):

- Full source export: 34 tables, 1,822 rows, 13 accounts.
- All table checksums/counts and full Telegram staging document hash match.
- One canonical server character exists and restores successfully in Telegram.
  Twelve accounts have no character save in PostgreSQL; see the preservation limit.
- All 68 game routes have native registrations; Telegram handlers replace the old webhook.
- Production frontend and both native modules build within module-size limits.
- 315 regression tests pass, including 33 new native checks; TypeScript passes.
- On-platform synthetic character, clan, market, expedition, admin and outbox checks pass.
- Native economic invariants pass against the complete imported source world.
- Approved GitHub Actions CLI secret saved; notification timer enabled. Its first
  workflow run completed successfully: https://github.com/SHAULK21/Game/actions/runs/39071296038.
- Render Helgard was deleted after the owner's explicit final confirmation.
  PostgreSQL Game Echo remains available with a reversible default read-only fence.
- Production snapshot: 2026-10-17 21:28:03.454314+00;
  source SHA-256: a0ac75008e40992bff24ba24506a3815443fb0938fb41b918fe8151f868e5e56.
- Production economy validation passes after the first notification run.
- Webhook points to Telegram, accepts message/pre_checkout_query, has no pending
  updates and is in sync. The published API rejects unauthenticated requests (401).
- Default and eight personal bot menus point to Telegram; no menu updates failed.
  The owner confirmed the Main Mini App URL was also changed in BotFather.
- PR https://github.com/SHAULK21/Game/pull/89 is merged. GitHub CI passed tests,
  the Telegram build and the native release audit.

The final import inserted production:v1 without overwriting existing production
state. Old writer sessions were released; account reset epochs and progress
versions were preserved. Local verified exports remain under the ignored
.migration-backups directory. Subsequent gameplay writes live in Telegram only.
