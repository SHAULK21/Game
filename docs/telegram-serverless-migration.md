# Telegram Serverless migration (experimental)

This branch is an isolated migration workspace. **Do not deploy to the production bot or replace the Render URL yet.**

## Verified baseline
- Frontend: React 19 / Vite 8; build command `npm run build`, output `dist/`.
- Backend: Express 4 started from `server/index.ts`, PostgreSQL through `pg`.
- Telegram Serverless: JavaScript V8 modules in `tgcloud/`; `endpoints/` for Mini App calls, `handlers/` for bot updates, `schema.js` for SQLite schema. No Node/npm dependencies in runtime.
- The official platform can host static frontend build files via `tgcloud.jsonc` and invoke endpoints via `Telegram.WebApp.Serverless.call`.

## Migration stages
1. Inventory Express routes, persistence tables, authentication, scheduled jobs and frontend API calls.
2. Introduce an opt-in transport adapter for Serverless calls, keeping the existing Render transport as default.
3. Port a **read-only** character/profile endpoint first. Use verified `ctx.initData.user.id`, never a client-supplied Telegram ID.
4. Define a versioned SQLite schema and data export/import tooling. Validate full character data, inventory, equipment, skills, quests, achievements, professions, currency, and reset/migration markers.
5. Port mutations with atomic transactions, idempotency keys, server-side authorization and anti-duplication protections.
6. Deploy the frontend to a **separate test bot** and run end-to-end tests on PC/mobile with the same Telegram account.
7. Test concurrent writes, backup/restore, economy exploits, rate limits, resource limits and rollback.
8. Only after signoff, plan a controlled production cutover.

## Non-negotiable safety
- No changes to production bot handlers/webhook during experimentation.
- No `tgcloud push` or `migrate` against the production bot before the route/data audit and backup.
- Never commit the CLI access token, bot token, Telegram initData or database credentials.
- Preserve the existing server-authoritative save and per-Telegram-ID ownership model.
- Do not merge pre-reset and post-reset saves or duplicate rewards.
- Do not assume all Express routes can be translated one-to-one: Serverless endpoints require SDK calls and have runtime constraints.

## Official reference
https://core.telegram.org/bots/serverless
