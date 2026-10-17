# Telegram Serverless migration status

See [release design and cutover procedure](telegram-cutover.md) for the current
implementation, data-preservation limits, deployment steps and recovery rules.

Prepared from SHAULK21/Game commit 10939c4 for Aethelgardr_RPG_Bot.
Administrator: 437290420. Production activation is still pending.

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
- Approved GitHub Actions CLI secret saved; notification timer remains disabled.
- Render Helgard is suspended by the provider's free usage limit. Auto-Deploy
  is being disabled before final activation. The PostgreSQL database is retained.

No production player record has been overwritten, no new gameplay handler has
been published, and the bot menu has not yet been switched.
