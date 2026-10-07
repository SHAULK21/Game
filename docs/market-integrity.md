# Public market integrity

The public market accepts only items held by the authenticated seller in `owned_items`.
The server copies the canonical item JSON, locks ownership/quantity and escrows the listed quantity.
Client-authored loot remains usable locally and sellable to residents, but cannot be listed publicly.

## Authoritative market wallet

`players.market_gold` is independent of the local hero's `gold`. Accounts receive 120 market gold
when this schema is first applied or their account is created; an administrative character reset
also resets this wallet to 120. Further credit comes only from verified market sales. There is no
API accepting a balance or deposit from the browser. Old client-side sales income is not credited
again into this wallet: its provenance and prior consumption cannot be reconstructed safely.
The UI distinguishes the market wallet from gold used in the basic shop and professions.

Purchases lock buyer and seller accounts in numeric order, then the listing, to serialize spending
and avoid inverse-account lock order in cross purchases. Account reset epochs are checked inside
the transaction. Debit, seller proceeds, ownership delivery, sale status, notification and receipt
commit together. Replaying the same operation returns its persisted receipt without another debit
or issuance, even after the listing is sold. A different account or request cannot use that receipt.

A full local bag cannot destroy a committed purchase: the item lives in `owned_items`, and inventory
refresh displays server items even if that temporarily exceeds the local slot limit. Client purchase
calls are serialized with the shared inventory/market lock and never replace inventory from a stale
snapshot or subtract payment from local gold. An interrupted request is retried with its saved UUID.

## Returns and migration

Owners can cancel a listing through the market UI. On inventory or own-listing load, expired active
lots are returned transactionally. `returned_item_id` and cancelled status prevent repeat issuance.
Returns survive a lost response and do not depend on available local slots.

Existing pre-fix listings have `verified=false`: they are excluded from public offers and cannot be
purchased. Their owners can reclaim them; recovered items retain `legacy_market_return` provenance
and cannot be listed publicly or deposited into a shared clan vault. This preserves the old item
without certifying client-supplied characteristics for trade with other players.

Already sold pre-fix listings have no buyer identity or delivery receipt. This update cannot identify
or automatically compensate an unknown historical buyer. New purchases always store that evidence.

## Account saves

Saves use `aethelgard_save_v1_data_<Telegram ID>`. Legacy saves migrate only when their stored owner
matches the active Telegram identity, before any gameplay migration. Foreign and ownerless legacy
saves remain untouched and are never loaded as the active character. Reset acknowledgements and
pending operations are scoped to the same owner; late inventory/wallet responses check owner and
reset epoch before changing client state.

## Validation

`market-security.test.ts` runs real SQL in PostgreSQL via PGlite, including schema reapplication,
forged/foreign item rejection, canonical escrow, receipt replay, insufficient funds, rollback after
issuance/debit, expiry/cancellation and legacy provenance. `market-purchase-ui.test.ts` executes the
real React provider with concurrent callbacks, a lost API response, a different-rarity full bag and
an account switch. Full tests, TypeScript and Vite build run separately. PGlite tests do not constitute
a multi-connection load test against the production PostgreSQL instance.
