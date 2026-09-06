# Multi-game orders — design

**Date:** 2026-09-06
**Decided by:** Chaison
**Status:** implemented; migration 0014 NOT yet applied to production

---

## The problem

Shopee splits a cart by **shop**, not by item. A buyer who checks out four
different games from our shop produces **one `order_sn` carrying four entries
in `item_list`** — not four order ids.

The pipeline mapped only the first item that resolved to a game and discarded
the rest:

```ts
for (const item of items) {
  const exact = byKey.get(`${item.itemId}:${item.modelId}`);
  if (exact) return exact;          // ← returned on the first hit
  ...
}
```

So a buyer paid for four games and received one. The failure was **silent** at
every layer:

| Layer | What it reported |
|---|---|
| `fulfillOrder` | `created` — not `no_mapping` |
| Vercel logs | green |
| Shopee | order marked Shipped, buyer asked to rate it |
| `reconcile-shopee-orders.mjs` | healthy — `items.some(...)` passed on any one match |
| Buyer lookup | one game's credentials, no mention of the rest |

Only a Shopee chat complaint would have surfaced it.

## Decisions (Chaison, 2026-09-06)

1. **Partial orders deliver.** Serve every line item that maps; flag the rest
   loudly. Still ACK the push, still auto-ship. A partially-served buyer is
   better off than an unserved one, and withholding the ship risks Shopee
   auto-cancelling an order whose buyer already holds working credentials.
2. **One chat message per game**, not one message listing all games.
3. **A four-game test fixture** spanning our own TOTP path, cyberspace.cyou and
   gamersfantasy.my. Its order id and accounts are NOT recorded in this repo —
   see "Credential hygiene" below.

## Schema — migration 0014

A child table. `orders` stays **one row per Shopee order**.

```sql
create table order_games (
  id, order_id, account_game_id,
  supplier_site, supplier_order_id,       -- per-game
  delivered_at, delivery_error, delivery_attempts,  -- per-game latch
  shopee_item_id, shopee_model_id,        -- webhook idempotency
  position, created_at
);
```

**Why not one `orders` row per game, sharing a `shopee_order_id`?** That is
exactly the shape migration 0005 exists to forbid. `verifyShopeeOrder()` reads
`shopee_order_id` with `.maybeSingle()`, which errors on multiple matches, so
two rows for one order id permanently break that buyer's lookup — the
2026-08-26 ssp123 outage. Relaxing the index to `(shopee_order_id, game_id)`
would reintroduce it, because `.maybeSingle()` still reads `shopee_order_id`
alone. **0005 is untouched.**

**What moves to the child table, and why:**

- `supplier_site` / `supplier_order_id` — the strongest argument for the
  table. One order can hold a gamersfantasy.my game *next to* a
  cyberspace.cyou game; a single order-level mapping cannot express that.
- `delivered_at` and friends — forced by "one message per game". With a single
  order-level latch, the first game to send would claim it and the rest would
  silently skip.

**The legacy mirror.** `orders.account_game_id` / `supplier_site` /
`supplier_order_id` are kept, written as a copy of the **first** game, because
the admin panel still reads them. `order_games` is authoritative for the buyer
lookup, delivery, and load counting. Dropping the columns is a follow-up.

**Backfill** gives every existing order exactly one game line, with a
post-condition that aborts if any order is left without one — an order with no
game line reads to a buyer as "order not found".

## Load counting — the non-obvious consequence

`allocateAccountGame` counted buyers-per-account from `orders.account_game_id`.
Since that is now only a mirror of the first game, counting it would make every
additional game in a bulk order **invisible to the waterfall**, silently
overfilling accounts past `ACCOUNT_MAX_BUYERS` — which arrives as "I can't log
in" in Shopee chat, the exact failure the cap exists to prevent. Load counting
moved to `order_games`, which also closes the missing-index gap `0008` left and
`lib/fulfillment.ts` flagged in a comment.

## Rate limiting

The per-order cap of 20 weighted/15min was sized for a one-game order. A
four-game buyer spends one attempt checking the order plus at least one per
game, and supplier games legitimately answer `not_ready` until the buyer has
attempted the Steam login — so each is retried. A real bulk buyer could lock
themselves out of an order they paid for.

`orderLimitForGameCount(n)` scales the cap so the **per-game** budget is
identical to what a single-game buyer always had, capped at a 10× multiplier.

Two properties keep the anti-enumeration control intact:

- The count comes from **our database, never the request**, so nobody can
  inflate their own limit.
- An order id that does not resolve has no games and stays on the base 20.
- The count query runs **only on the slow path** — after a caller has already
  burned the base budget — so the common case costs zero extra queries, and an
  enumeration sweep (all failures, 3× weight) pays for every attempt before it
  can ever reach that branch.

## API

`/api/lookup`

- `phase: "credentials"` → `{ games: [{ gameId, title, username, password }] }`,
  plus top-level `username`/`password` mirroring the first game so
  `/ss-verify-live` and the seed scripts keep working.
- `phase: "code"` → takes `gameId` (an `order_games.id`); supplier resolution
  reads that row's own mapping. Omitting `gameId` falls back to the first game,
  so pre-multi-game callers are unaffected. The response echoes `gameId` so a
  page with four requests in flight cannot paint a code into the wrong card.
- **Account status is now per game.** A four-game order whose second game sits
  on a `recovering` account still serves the other three; the bad one renders
  as unavailable rather than being dropped, which would look to the buyer like
  they never bought it.

## Buyer UI

One card per game: title → username + copy → password + copy → its own Get Code
→ its own code tile. Copy buttons sit in a three-column grid
(`auto_1fr_auto`) so they align; the previous `justify-between` pushed each
button to the end of its own row, so they drifted apart whenever the username
and password differed in length — which is always.

Per-game code state is independent: one game failing must not blank the others,
and the buyer can work through them in any order.

## Out of scope

- **Admin multi-game editing.** The Orders tab shows a read-only game count
  (and flags `none ⚠`, which means a broken order). `PATCH` refuses to write a
  supplier mapping to an order with more than one game rather than guessing —
  one mapping cannot be correct for four different games.
- Dropping the legacy mirror columns.

## Credential hygiene — why the fixture is not named here

Since 2026-09-06 `/api/lookup` needs **only an order id**; the username check
was dropped. An order id in a tracked file is therefore a working credential —
it returns the account password and a live Guard code. The repo is public, and
this is CHECKPOINT.md **open item 0**, whose own fix list calls for a
test-order-id convention that is not published.

So `scripts/seed-bulk-test-order.mjs` hardcodes nothing: `--order-id` and
`--accounts` are required arguments with no defaults, matching the discipline
`setup-supplier-test-order.mjs` already follows. The real values live in
`local/BULK-TEST-ORDER.md`, which is gitignored.

## Verification

- `matchItemsToGames` unit tests, including the property that **every input
  item lands in exactly one bucket** — nothing is ever silently discarded.
- `orderLimitForGameCount` unit tests, including that junk input floors to the
  base limit rather than widening it.
- 129/129 tests pass (111 pre-existing, 18 new here); typecheck, `next build`
  and lint clean — apart from one pre-existing
  `react-hooks/set-state-in-effect` error in `app/admin/page.tsx`, untouched.
- **Not yet verified against production** — migration 0014 is unapplied, so
  there is no `FACT-V` for the live path. See TEAM.md §7.
