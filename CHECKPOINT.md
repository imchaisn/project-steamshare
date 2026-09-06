# Project Steamshare — Checkpoint

*Living status file — current state only, not a history log. Dated history lives in
`PROJECT-LOG.md` (Personal Assistant workspace). Operational docs: `docs/order-fulfillment-sop.md`,
`docs/steam-account-onboarding-runbook.md`, `docs/family-view-lockdown.md`, `docs/policies.md`.*

**Last updated:** 2026-09-06

---

## Status: LIVE, and Shopee orders now fulfil themselves

Two things are true as of 2026-09-05:

1. `gameshare.space` still serves rotating Steam Guard codes to buyer lookups, unchanged.
2. **A paid Shopee order now becomes an `orders` row and a delivered chat message with no
   human involvement.** Proven end-to-end on a real order the same day
   (a live Euro Truck Simulator 2 order, allocated to `dubust22`, delivered 07:24:12Z).

See "Automated Shopee fulfilment" below for how it works and how to turn it off.

### Buyer lookup — now ORDER-ID-ONLY, Chaison's call 2026-09-06

```
POST https://www.gameshare.space/api/lookup
{"orderId":"T123"}
→ 200 {"username":"ssp266","password":"<redacted>","code":"<5-char Guard code>"}
```

**The username-match check is GONE.** Until 2026-09-06 a supplied username had to match
the account before a supplier was ever contacted, specifically so a known-good order id
alone could not be used to pull that account's password and code (see `app/api/lookup/route.ts`
for the reasoning that used to live there). Chaison chose to drop it — the homepage no longer
even asks for a username. Knowing (or guessing) a GameShare order id is now sufficient by
itself. Order-verified + account-active checks still gate the branch that talks to a supplier,
so it is not fully open, but the anti-enumeration property this file used to document as
verified is no longer true and should not be cited as a control.

Previously verified, now partly stale: codes rotate between requests (live TOTP, not cached)
still holds; `/terms` 200s, admin gate redirects to login, favicon serves still hold. The
"wrong username / probe usernames" claim above no longer applies — there is no username
input to probe.

### What's built
| Piece | State |
|---|---|
| Buyer lookup (order id + Steam username) | Live. Copy-to-clipboard modal — button reads **Copy** → **Copied!** before dismissing |
| Admin panel | Accounts, games, account↔game linking, Orders tab, status control (active/banned/recovering), recovery-email fields, code access log |
| Encryption | AES-256-GCM at rest for password + Guard `shared_secret`; decrypt only server-side |
| Rate limiting | **Live and verified.** Per-order 20 weighted/15min (primary), per-IP 300 weighted/15min (backstop), failed attempts weighted 3×. Fails open on DB error |
| Public `/terms` | Live, linked from lookup footer. Support = Shopee chat |
| Branding | GameShare "Loop Controller" logo (site + favicon + `brand/` exports), violet/magenta theme |
| Database | Supabase, migrations 0001–0008 **all applied** (0005–0008 landed 2026-09-05). migrations 0009–0013 applied 2026-09-06 (follow-up, auto-ship, code source, supplier mapping, supplier log). **0014 (order_games) WRITTEN, NOT APPLIED** — see "Multi-game orders" below |
| Deploy | Auto-deploys on every push to `master`. Repo public (required for Vercel Hobby git deploys) |
| **Shopee auto-fulfilment** | **LIVE.** Push webhook → order detail → listing mapping → account allocation → `orders` row → Shopee chat message. Kill switch `SHOPEE_AUTO_FULFILL` |
| Shopee Open API | Live app, partner id `2043838`, category *Seller In House System*. Shop authorized, token stored AES-encrypted in `shopee_auth`, auto-refreshes |
| Shopee Seller Chat | Working. `/api/v2/sellerchat/send_message`, addressed by `buyer_user_id` from the order detail |
| **Post-delivery follow-up** | **Code shipped, OFF.** Nightly cron asks the buyer to press Order Received + rate. Needs migration 0009 + `CRON_SECRET` + `SHOPEE_FOLLOW_UP=true` |
| **Auto-ship on Shopee’s side** | **LIVE 2026-09-06.** Migration 0010 applied, `SHOPEE_AUTO_SHIP=true` baked in. `ship_order` with `tracking_number`=order_sn CONFIRMED on a real order (`260906ATWBXXSC`). Next paid order ships itself |
| **Codes from our other websites** | **LIVE.** `SUPPLIER_CODE_SOURCE=true` confirmed set in Vercel production (`FACT-V` 2026-09-06 — see below), migrations 0011–0013 all applied. A real code has been fetched end to end through the real buyer-facing lookup, not just the adapter in isolation. **Redemptions per order are capped (~5-6)** — see below |

### ⚠ Multi-game orders — CODE READY, MIGRATION 0014 NOT APPLIED

**A bulk order used to silently short-deliver.** Shopee splits a cart by SHOP, not
by item, so four games bought in one checkout arrive as ONE `order_sn` with four
entries in `item_list`. `mapItemsToGame()` returned on the FIRST item that mapped
and dropped the rest: the buyer paid for four games, got one, and the fulfilment
status was `created`, so nothing anywhere reported a problem — not the logs, not
`reconcile-shopee-orders.mjs` (its `items.some(...)` passed on any single match),
not Shopee, which was marked Shipped and asked the buyer to rate it.

Reworked 2026-09-06. `orders` stays ONE row per Shopee order (migration 0005's
unique index is untouched — relaxing it is what caused the ssp123 outage) and the
games hang off it in a new `order_games` table.

**Chaison's calls:** deliver what maps and flag the rest (still ACK, still
auto-ship); ONE CHAT MESSAGE PER GAME; a four-game test fixture (id in
`local/BULK-TEST-ORDER.md`, deliberately not written here — open item 0).

Design: `docs/superpowers/specs/2026-09-06-multi-game-orders-design.md`.

### ✅ DEPLOYED 2026-09-07 — and safe with 0014 still unapplied

`FACT-V` 2026-09-07, commit `5da3c10` pushed to master and live on production:

- `order_games` **confirmed absent** — `GET /rest/v1/order_games` returns
  `PGRST205 "Could not find the table 'public.order_games' in the schema cache"`.
- **All six test orders still serve** through the pre-0014 fallback:
  `ssp123`, `dub123`, `gsc123`, `sss123`, `int123`, `thr123` each return one game
  with credentials — and now with the game TITLE, which is new and buyer-visible.
- **Live rotating codes still work**: two `phase:"code"` calls on `dub123` 35 s apart
  returned two DIFFERENT 5-character codes (live TOTP, not cached).
- `/api/health` → 200.

**Why deploying before the migration was safe.** `lib/order-games-compat.ts` degrades
every `order_games` read and write to the pre-0014 behaviour when the table is absent.
This was not optional: the repo auto-deploys on push, and the migration can only be
applied by hand, so the two cannot be ordered. Without the fallback this push would
have answered "order not found" for every live order.

The multi-game feature is therefore **deployed but dormant** — it activates the
moment 0014 is applied, with no second deploy.

### ✅ 0014 EXECUTED against a real Postgres engine — `FACT-V` 2026-09-07

The SQL is not just reviewed, it has been RUN. `@electric-sql/pglite` (in-process
Postgres, installed `--no-save`, nothing added to package.json) ran the migration
file UNMODIFIED against a replica of the ancestor schema. 12/12 checks passed:

- 0014 executes with no error; backfill makes exactly one game line per order;
  zero orphans; supplier mapping and `delivered_at` both carried across
  (so a delivered order is never re-messaged); re-running is idempotent.
- **The CHECK constraint is now `FACT-V`, not `FACT-S`.** A supplier site with no
  order id, and an order id with no site, are both REJECTED; neither-set is
  ACCEPTED. This is the exact three-valued-logic trap 0011 and 0012 shipped with
  and never executed — 0014's `coalesce` guard is confirmed working.
- The partial unique index refuses a duplicate Shopee line item (a webhook retry)
  while leaving manual rows (null `shopee_item_id`) unconstrained.
- The 0005 dependency guard correctly ABORTS when the unique index is absent.

So the paste cannot fail on syntax, on the guard, or on the backfill. The only
untested variable left is production's real data.

`isMissingOrderGames()` is deliberately narrow: it matches ONLY 42P01/PGRST205 for
this one table, never a permission error, a constraint violation or a dropped
connection. Those must still fail loudly — mistaking one for "pre-migration" would
hand a four-game buyer one game with no error anywhere. 10 tests pin that.

**DELETE `lib/order-games-compat.ts`** (and the imports flagged `PRE-0014 FALLBACK`)
once 0014 is applied and verified. Left in place, a genuine missing-table incident
would be silently absorbed as legacy mode.

| State | |
|---|---|
| Code | **DEPLOYED.** Typecheck + `next build` clean; 139/139 tests pass (28 new); lint clean apart from one pre-existing admin-page error |
| Migration `0014_order_games.sql` | **NOT APPLIED** — the one remaining step. Paste `local/PASTE-THIS-0014.sql` into the Supabase SQL editor. `run-migrations.mjs` cannot: DB password re-confirmed stale 2026-09-07 on both poolers, and no SQL-exec RPC exists |
| Multi-game test fixture | Script written (`scripts/seed-bulk-test-order.mjs`), dry-run verified against live data. **Not seeded** — it needs 0014 first. Its order id and accounts are arguments, NOT hardcoded, and live in `local/BULK-TEST-ORDER.md` — see open item 0: an order id alone is now a working credential |
| Production behaviour | UNCHANGED until 0014 is applied and the code is deployed |

**The ordering hazard is GONE.** It used to be that 0014 had to land before the code
deployed. The compat fallback removes that constraint entirely — the code is already
live and correct in both states, so 0014 can be applied whenever.

**`scripts/run-migrations.mjs` CANNOT apply it** — the direct DB password is still
broken (open item 1; re-confirmed 2026-09-06, `password authentication failed for
user "postgres"`). Paste the SQL into the Supabase dashboard → SQL editor instead.
A ready copy is at `local/PASTE-THIS-0014.sql` (same content as the migration).

```
# 1. Supabase dashboard -> SQL editor -> paste local/PASTE-THIS-0014.sql -> Run
# 2. then, and only then (exact command in local/BULK-TEST-ORDER.md):
node --env-file=.env.local scripts/seed-bulk-test-order.mjs --order-id <id> --accounts <...>
# 3. then deploy, then /ss-verify-live
```

0014 backfills one game line per existing order and ABORTS if any order is left
without one — an order with no game line reads to a buyer as "order not found".

**Not verified against production.** No `FACT-V` exists for the live multi-game
path yet, and none may be claimed until a real lookup has been run.

**Follow-ups deliberately not built:** multi-game create/edit in /admin (the
Orders tab shows a read-only game count and flags `none ⚠`; PATCH refuses to
write one supplier mapping to a multi-game order rather than guessing), and
dropping the legacy mirror columns on `orders`.

---

### Rate-limiter escape hatches
- `x-api-secret` header bypasses the limiter entirely and records no counters — use for testing
  against production without polluting a real buyer's bucket.
- `GET`/`DELETE /api/admin/rate-limit?ip=&orderId=` inspects/clears a bucket. Verified working
  (cleared 112 rows in a live test). Gated by `proxy.ts` — needs admin cookie or `x-api-secret`.

---

## Automated Shopee fulfilment — LIVE since 2026-09-05

```
buyer pays
  → Shopee pushes order_status_push (code 3) to /api/webhooks/shopee
  → HMAC verified against the PUSH partner key
  → row written to shopee_push_log (every push, valid or not)
  → get_order_detail: paid only if BOTH a recognised paid status AND a pay_time
  → item_id/model_id mapped to a game via shopee_listings
  → least-loaded ACTIVE account_games row allocated
  → orders row inserted (idempotent on shopee_order_id)
  → delivery message sent in Shopee chat, delivered_at stamped so it can never send twice
```

### Configuration (all in Vercel **production** env)
| Variable | Purpose |
|---|---|
| `SHOPEE_PARTNER_ID` / `SHOPEE_PARTNER_KEY` | Live app `2043838`. Signs **outbound** calls |
| `SHOPEE_PUSH_PARTNER_KEY` | **A DIFFERENT SECRET.** Signs **inbound** pushes |
| `SHOPEE_ENV` | `live` |
| `SHOPEE_PUSH_CALLBACK_URL` | `https://www.gameshare.space/api/webhooks/shopee` |
| `SHOPEE_AUTO_FULFILL` | `true`. The kill switch |

### Turning auto-fulfilment OFF
`SHOPEE_AUTO_FULFILL` is read per request, but **that does not mean a redeploy is optional** —
Vercel bakes env vars into a deployment, so changing the value alone leaves the running
deployment auto-delivering while the dashboard shows the new value. Both steps are required:

```
vercel env rm SHOPEE_AUTO_FULFILL production --yes
printf false | vercel env add SHOPEE_AUTO_FULFILL production
vercel redeploy <current production url> --scope imchaison-s-projects
```

Confirm by sending a signed push carrying an `ordersn`: **200** means off (logged, not fulfilled),
**500** means still on. Fastest kill if a redeploy is too slow: **Console → App List → Unlink**.
No token, nothing can be fulfilled — at the cost of re-authorizing afterwards.

### Things that cost hours to learn — do not rediscover these

- **`gameshare.space` 308-redirects to `www.gameshare.space`.** Shopee does not follow redirects
  on a push POST, so the apex domain silently fails every push. Every registered URL and every
  buyer-facing link uses the `www` host.
- **The push key is NOT the API key.** Console → Push Mechanism → Set Push has its own
  *Live Push Partner Key* with a Generate button. Signing inbound pushes with the API key rejects
  every push as 401, and it looks exactly like a misconfigured callback URL. Regenerating that key
  invalidates the deployed one — re-sync and redeploy if you ever press it.
- **Console field formats differ and the error messages do not say so.**
  App settings → *Live Redirect URL Domain* wants a **bare domain** (`https://www.gameshare.space`).
  The Authorize dialog's *Redirect URL* wants the **full path** (`.../api/shopee/callback`) — the
  bare domain there sends the auth code to the homepage where it is silently lost.
  Set Push → *Live Call Back URL* wants the **full path** to `/api/webhooks/shopee`; pointing it at
  `/api/shopee/callback` returns 405 (that route is GET-only) and verification fails.
- **Callback verification was a deadlock.** Saving a callback needs a 2xx from Shopee's test push;
  a 2xx needed a valid signature; the signature needed a key generated on the page you could not
  save. Resolved in code: an unverified push with **no `ordersn`** answers 200 (handshake), one
  **with** an `ordersn` still answers 401. Nothing unverified can reach fulfilment either way.
- **Shopee's contact window: a shop may only message a buyer within 30 days of their order**
  (or 7 days of them messaging first). Automated delivery is nowhere near it. A manual resend of an
  older order fails `user_is_forbidden` — that is policy, not a broken integration.
- **`buyer_username` is NOT masked for MY.** This was flagged as the pipeline's biggest unknown.
  Real orders return both `buyer_username` and `buyer_user_id`, and that user id is the chat
  `to_id` — which is why no conversation lookup is needed.
- **`add_item` rejects the fields the old docs show.** Creating a listing on category 101090
  fails twice before it works. First `product.error_invalid_brand` — the category demands a
  `brand`, and the answer is `{ brand_id: 0, original_brand_name: "NoBrand" }`, which is what
  all three existing listings carry and the first entry of `get_brand_list` for 101090. Then
  `product.error_param — invalid field seller_stock, value must Not Null`: `normal_stock` is
  dead, and stock is now `seller_stock: [{ location_id: "MYZ", stock: N }]`. `MYZ` is this
  shop's location id, read off the ETS2 model's `stock_info_v2` — not a guess.
- **A listing with no variations has no models at all.** `get_model_list` returns an empty
  array, so there is no model_id to map. That is the `(item_id, 0)` sentinel case `lib/fulfillment.ts`
  already handles — map such a listing with `model_id = 0` or it will never resolve.
- **`get_attributes` is `api_suspended`; use `get_attribute_tree`.** The latter takes
  `category_id_list` and returns every attribute with its value ids, which is the only way to
  fill the Specification panel from code. Category 101090's Game Genre Type accepts up to 5
  values and has **no Casual and no Indie** option, so a Steam genre list rarely maps 1:1.
- **The Specification panel every listing carries is these 5 attributes** (Seller Centre counts
  it as 6/11 including Brand): Warranty Type `100370`=No Warranty `5576`; Game Genre Type
  `100541`; SIRIM Certified `101198`=No `7058`; MCMC Approved `101396`=Yes `12543`;
  Certification/License `102370`=No `16872`. Set them with `update_item`'s `attribute_list`.
- **Stock is 99999, not 99.** Shared accounts resell without depletion, so every listing runs
  effectively unlimited stock. `update_stock` takes
  `stock_list: [{ seller_stock: [{ location_id: "MYZ", stock: 99999 }] }]` — no model_id for an
  item without variations.
- **Title convention (Chaison, 2026-09-05): short and SEO-shaped, game name FIRST.**
  `<Game> | Steam PC Game | FULL GAME | 24H AUTO DELIVERY | ORIGINAL | OFFLINE` (~80 chars).
  The older listings run to 117 of the 120 allowed; that is not the target. Do **not** copy
  `DLC+` (true only if the account owns the DLC) or `LIFE TIME GUARANTEE` (no guarantee while
  `/terms` is a placeholder) onto a new listing without checking — see the claims table in
  `docs/shopee-listings.md`.

- **Shopee MY accepted RM0.99 on `add_item`** — there is no RM1.00 minimum-price floor on
  category 101090, so sub-ringgit pricing is available if it is ever wanted.
- **The access token expires every 4 hours and the scratchpad scripts do NOT refresh it.**
  `lib/shopee-auth.ts` `getValidAccessToken()` refreshes transparently, but any standalone
  script that decrypts `shopee_auth.access_token_enc` directly (including
  `scripts/shopee-listings.mjs`) will just start failing `invalid_acceess_token` mid-run.
  Note `media_space/upload_image` accepts an EXPIRED token while `product/add_item` rejects it,
  so a batch can look half-healthy — images upload fine, every item creation fails.
### ⚠️ An UNLIST draft went LIVE on its own — check after every bulk operation

On 2026-09-06, straight after a bulk `update_stock` + `set_item_installment_status` pass over all
26 listings, **DELTARUNE (`47167470545`) was found `NORMAL`** — purchasable — despite having been
verified `UNLIST` minutes earlier. Its supplier code path is not deployed, so a sale would have
taken money and delivered nothing. It was re-unlisted immediately and **no order was placed while
it was live** (the only two Shopee orders in the window both pre-date it).

Root cause not established. The stock pass reported DELTARUNE's prior stock as **9999**, not the
**5** it was created with and verified at, which points at something outside this session having
touched it rather than at `update_stock` re-listing on its own — the other 14 drafts got identical
calls and stayed `UNLIST`. Treat both as open possibilities.

**The rule: after ANY bulk write across listings, re-read `item_status` for every draft.** A
silently re-listed draft is the same failure class as an unmapped listing — it sells something
that cannot be delivered, and nothing raises its hand. `scratchpad/refix.mjs` does the check and
the repair in one pass.

### Stock is 99999 on everything, including the supplier drafts (2026-09-06)

Chaison's call, made after the redemption ceiling was raised. All 26 listings, every model. The
ceiling is unchanged — a supplier listing showing 99999 can still only yield ~5-6 codes per order
id before `REACHED LIMIT`. The number is a display value, not capacity.

**Credit-card installment is ON at 3 months for all 26** via
`POST /api/v2/payment/set_item_installment_status` with `{item_id_list, tenure_list:[3]}`.
Shop-level installment was already enabled (`get_shop_installment_status` -> 1); without that,
item tenure never surfaces to buyers. Note `get_item_installment_status` 404s despite being in the
docs index — read the setter's own response instead, which returns the resulting tenure per item
and reports per-item failures while the top-level `error` stays empty.

### 15 supplier-game UNLIST drafts created 2026-09-06

All 15 games from our other two sites are now Shopee drafts — banners, copy, brand,
specification attributes and `shopee_listings` mappings all in place. **None are published.**
Item ids and per-game copy: `docs/listing-copy.md` Part 2, which is the upload source of truth.

Also done in the same pass: all 20 supplier accounts seeded, the 13 missing `games` rows created,
every account linked in `account_games`, and the `steam_app_id = 0` on the Ghost of Tsushima and
Into the Dead rows corrected (at 0 they miss `lib/catalogue.ts` and render as "art pending").

**Their stock is 5, not 99999, and that is deliberate** — see "Redemptions are FINITE" above.
Black Myth: Wukong's six accounts share ONE supplier order id, so they share one redemption cap
rather than multiplying it. Do not raise these to 99999 to match Part 1.

**They cannot be published until the supplier code path is deployed** (`master` pushed,
`SUPPLIER_CODE_SOURCE=true` in Vercel production, then a REDEPLOY). Until then a buyer would pay
and hit a lookup that cannot serve them.

**The access token expired twice during this work**, mid-batch both times. `add_item` rejects an
expired token while `media_space/upload_image` accepts it, so the first attempt uploaded 60 images
and created zero listings while looking half-healthy. `scratchpad/refresh.mjs` mirrors
`refreshShopToken` + `saveShopToken` and writes the new pair to disk before the DB write, because
the refresh token is single-use and a lost write kills production auth.

### ⚠️ Every new Shopee listing must be mapped by hand

`shopee_listings` maps `(item_id, model_id)` → our game. **It is not automatic, and an unmapped
listing fails silently from the buyer's point of view.** This bit us the day it went live: a new
Euro Truck Simulator 2 listing (`40634236344`) was created after the mappings were seeded, a real
buyer paid, `fulfillOrder()` returned `no_mapping`, and the webhook correctly ACKed with 200 —
because a Shopee retry cannot invent a mapping, only a human can. The only trace was a Vercel log
line nobody was watching. Fixed by adding the mapping and replaying the push.

Matching on item NAME is deliberately not implemented: Shopee item names are marketing copy that
gets edited constantly, and a wrong guess hands a buyer the wrong game — worse than a loud failure.

**So: after creating or re-listing anything on Shopee, add the mapping.** Current mappings:

| item_id | model_id | Game |
|---|---|---|
| 40634236344 | 346474705430 | Euro Truck Simulator 2 |
| 46516993841 | 282919612752 / 282919612753 | DAVE THE DIVER (Offline / Offline DLC) |
| 49766310127 | 416414251999 / 416414252000 | Escape From Duckov (Offline / Offline DLC) |
| 48217427795 | 0 | How to Fish — created and **published LIVE 2026-09-05** (no variations, hence model 0) |
| 48217450246 | 0 | Schedule I — **LIVE 2026-09-05**, RM1.59 |
| 52667425632 | 0 | Dokimon Quest — **LIVE 2026-09-05**, RM1.29 |
| 52367419203 | 0 | Stacklands — **LIVE 2026-09-05**, RM0.99 |
| 45417439240 | 0 | Lords of the Fallen 2014 — **LIVE 2026-09-05**, RM1.59 |
| 52467419241 | 0 | Tribes of Midgard — **LIVE 2026-09-05**, RM0.99 |
| 45017441353 | 0 | Batman Arkham Knight — **LIVE 2026-09-05**, RM1.29 |
| 26995584552 | — | *"Demo product as for approval" — deliberately unmapped* |

Games with active accounts but **no Shopee listing at all**: Dokimon and Schedule I, plus the four
newer accounts — Lords of the Fallen 2014, Stacklands, Tribes of Midgard, Batman: Arkham Knight.
That is idle inventory. How to Fish left this list on 2026-09-05.

### Shelf prices — all ten listings live as of 2026-09-06

Every listing is live, mapped, delivery-tested and priced below RM1.99 on Chaison's instruction.
Copy comes from `docs/listing-copy.md`, which is the upload source of truth and was applied and
verified byte-for-byte on 2026-09-06.

Pricing rule, tiered on **current** Steam price: `<=RM15 -> RM0.99` · `RM15-45 -> RM1.29` ·
`>RM45 -> RM1.59`. Steam prices move — Dave went RM24.50 -> RM49.00 and How to Fish
RM13.63 -> RM21.99 between 2026-08-26 and 2026-09-06, which is two tiers of difference. Re-pull
`appdetails?appids=<id>&cc=my` before repricing anything.

| Game | item_id | Steam | Shopee |
|---|---|---|---|
| Stacklands | 52367419203 | RM24.99 | RM0.99 |
| Tribes of Midgard | 52467419241 | RM9.75 | RM0.99 |
| How to Fish | 48217427795 | RM21.99 | RM1.29 |
| Dokimon Quest | 52667425632 | RM38.50 | RM1.29 |
| Batman Arkham Knight | 45017441353 | RM38.00 | RM1.29 |
| Schedule I | 48217450246 | RM49.00 | RM1.59 |
| Lords of the Fallen 2014 | 45417439240 | RM79.00 | RM1.59 |
| DAVE THE DIVER | 46516993841 | RM49.00 | RM1.59 (both models) |
| Euro Truck Simulator 2 | 40634236344 | RM54.00 | RM1.59 |
| Escape From Duckov | 49766310127 | RM54.62 | RM1.59 (both models) |

All ten carry the four-image banner set. **Idle inventory is zero.**

**The three oldest titles were rewritten on 2026-09-06** (103/112/117 chars -> 83/94/87) and
`LIFE TIME GUARANTEE` and `DLC+` were removed from the shop entirely — the first is unbackable
while `/terms` is a placeholder, the second is only true if that account owns the DLC and nobody
has checked per-account. Do not reintroduce either.

**Every one of the six new listings was delivery-tested before going live (2026-09-05).** A
temporary verified order per game was inserted, the real production `/api/lookup` was called as a
buyer would call it, a valid Steam Guard code came back for all six, and the test orders plus their
`code_access_log` rows were deleted (0 leftovers). Repeat it with `scratchpad/e2e.mjs` before
publishing anything else — it is the only check that proves a listing can actually pay out, and it
uses `x-api-secret` so it never touches a real buyer's rate-limit bucket.

**`lib/catalogue.ts` gates the public /games Buy button** and is hand-maintained on purpose: a
`shopee_listings` row is written BEFORE a listing is published (draft -> map -> publish), so it can
never mean "buyable". Add an id there only after `scripts/shopee-listings.mjs` reports NORMAL.

**Stock is inconsistent and nobody has normalised it.** The intended figure is 99999 (shared
accounts never deplete). Actual: How to Fish 99999, ETS2 99998, Dave *Offline* 99997 — those three
are 99999 minus real sales. But **Dave *Offline DLC* and both Duckov variations sit at 9999**, a
digit short. Harmless at current volume; worth a sweep before it ever matters.

### The delivery message

Built by `buildDeliveryMessage()` in `lib/fulfillment.ts`. **It carries the account password** —
Chaison's explicit decision on 2026-09-05, reversing the original design. The costs are documented
at that function: permanence in Shopee's logs, shared-account blast radius, and staleness on
rotation. **The practical consequence: rotating a shared account's password invalidates every
delivery message already sent for it**, so plan a rotation as a re-messaging exercise, not a
one-line DB update. Tests pin the allowed credential surface to exactly Order ID, Username and
Password, and still forbid any Steam Guard code.

### The follow-up message — SHIPPED, but OFF until two manual steps are done

A second message, sent ~24h after delivery, asking the buyer to press "Order Received" and leave a
rating. Copy chosen by Chaison on 2026-09-05; wording, ops table and reasoning live in
`docs/order-fulfillment-sop.md`. Built by `buildFollowUpMessage()` + `sendPendingFollowUps()` in
`lib/follow-up.ts`, exposed at `/api/cron/follow-up`, scheduled by `vercel.json` at `0 4 * * *` UTC
(12:00 MYT). It carries **no credential at all** — the delivery message a day earlier already did,
in the same thread — and offers nothing in exchange for the rating, which is what keeps it on the
right side of Shopee's incentivised-review rule. Both are tested.

Exactly-once is the same CLAIM → SEND → KEEP-OR-RELEASE latch the delivery path uses, on a new
`orders.follow_up_sent_at`. An ambiguous send keeps the latch (a duplicate "please rate us" beats a
duplicate that a human has to apologise for); a proven failure releases it for the next night, up to
3 attempts, and nothing older than 25 days is chased at all — Shopee's contact window is 30.

**Vercel side is DONE (2026-09-05).** `CRON_SECRET` (32 random bytes, hex) and
`SHOPEE_FOLLOW_UP=true` are set in production and baked in by a redeploy. The kill switch is on;
the route authenticates the cron.

**Migration 0009 applied 2026-09-06 — the feature is fully live.**

`FACT-V` 2026-09-06: `GET /api/cron/follow-up?limit=1` with `x-api-secret` →
`{"ok":true,"enabled":true,"scanned":0,...}` with an empty `details` — the missing-columns error is
gone, so the query runs against real columns. **No follow-up has actually been SENT yet**: at the
time of that run neither automated order had crossed 24h (`2609058GHEA0MK` delivered 2026-09-05
07:30Z, `260906ATWBXXSC` 2026-09-06 05:41Z). The nightly 04:00 UTC cron picks both up on its next
run. Watch `orders.follow_up_sent_at` / `follow_up_error` after that to close the last gap.

> ⚠️ **`DB_PASSWORD` in `.env.local` is STALE and still is.** `scripts/run-migrations.mjs` fails
> with Postgres `28P01`. 0009–0013 were applied by pasting into the Supabase SQL editor instead.
> Refresh it from Supabase → Settings → Database when convenient — **every** migration is a manual
> copy-paste until then, and the script is the only thing that enforces file order and the
> dependency guards.

### Auto-ship on Shopee's side — LIVE 2026-09-06

Until this, nothing in the codebase ever called a Shopee shipping API — the pipeline stopped at
the chat message, and Chaison was clicking "Ship" himself in Seller Centre after every delivery.
Dispatched research (`research/2026-09-06-shopee-virtual-goods-shipping-requirement.md`) confirmed
this was a live, recurring risk, not a cosmetic gap: Virtual Goods is a Non-SSL shipping channel
that runs through the same `READY_TO_SHIP -> ... -> COMPLETED` lifecycle as a physical parcel,
including Days-to-Ship and Auto Cancellation. An order Shopee never sees shipped is eventually
auto-cancelled **and refunded to the buyer** — who by then already has working Steam credentials
from the chat message. Every unshipped auto-fulfilled order was exposed to this. Chronic
non-shipment also degrades the Return/Refund Rate metric that can get the whole Virtual Goods
channel permanently removed (two bad months, per Shopee's Non-integrated Channel policy).

Built: `lib/shopee-logistics.ts` (`shipOrder()`, calling `v2.logistics.ship_order` with the
`non_integrated` method) + `shipOnce()` in `app/api/webhooks/shopee/route.ts`, wired into
`runFulfillment()` right after the delivery chat message, independent of whether that message
sent. Same exactly-once CLAIM -> CALL -> KEEP-OR-RELEASE latch as delivery, on a new
`orders.shipped_at` (migration 0010, depends on 0008, not yet applied). Gated by its own kill
switch, `SHOPEE_AUTO_SHIP`, deliberately separate from `SHOPEE_AUTO_FULFILL` — delivery keeps
running uninterrupted regardless of how this rolls out.

**Two things are genuinely unverified and need Chaison's real-order confirmation before this goes
live, not just a code review:**
1. **The `tracking_number` value.** No Shopee source gives an officially sanctioned placeholder for
   a listing with no real carrier. The code defaults to the order_sn itself
   (`buildTrackingNumber()` in `lib/shopee-logistics.ts`) — traceable and not fabricated, but a best
   guess, not a confirmed one.
2. **`v2.logistics.get_shipping_parameter` is deliberately skipped.** Shopee's own guide says to
   call it first to learn what `ship_order` expects; its exact response shape for a non-integrated
   channel was not confirmed by the research, only inferred. `ship_order` is called directly with
   the one concrete shape Shopee's guide documents instead. If the real call demands something
   else, Shopee's error message will say so via `orders.ship_error` — it will not fail silently, but
   it also has not been proven against production yet.

### ✅ LIVE since 2026-09-06 — and the tracking_number question is settled

`FACT-V` 2026-09-06. Both unknowns above are resolved by a real order, not a code review.
`scripts/ship-shopee-order.mjs --ship 260906ATWBXXSC` (DELTARUNE, buyer `shuwenchai135`) made the
byte-identical call `shipOnce()` makes — `POST /api/v2/logistics/ship_order` with
`{order_sn, non_integrated:{tracking_number:<the order_sn>}}` — and Shopee answered with an empty
`error`. The READY_TO_SHIP queue went 1 → 0, and `get_order_detail` now reports the order as
`SHIPPED`. **`tracking_number` = the order_sn is CONFIRMED accepted**, and `get_shipping_parameter`
was not needed. Do not change `TRACKING_NUMBER_STRATEGY` without a new real-order test.

State as of 2026-09-06: migration 0010 **applied**, `SHOPEE_AUTO_SHIP=true` set in Vercel
production and baked in by a redeploy, code deployed. The next paid order ships itself. Nothing
outstanding — but the *first* automated ship has still not been observed, so watch the next order's
`orders.shipped_at` and `ship_error` before assuming the wiring is as good as the manual call.

**Two older orders are shipped on Shopee but show `shipped_at = null` here**
(`260906ATWBXXSC`, shipped by the script; `2609058GHEA0MK`, shipped by hand on 2026-09-05 —
both confirmed `SHIPPED` via `get_order_detail`). Cosmetic: if Shopee ever re-pushes either one,
`shipOnce()` will claim, call `ship_order` on an already-shipped order, get a rejection and write it
to `ship_error`. Noise, not harm. Stamp `shipped_at` on those two rows in the Supabase table editor
to silence it.

## Competitor research — `research/`, added 2026-09-05

Buyer-side captures of competing Shopee MY shops, with **per-title Steam MY cost basis** (which the
earlier `research/2026-08-25-steamshare-competitor-market-pricing.md` sample did not have). Read
`-market-blind-spots.md` first; it is the only one that changes strategy rather than tactics.

| File | Answers |
|---|---|
| `2026-09-05-competitor-landscape.md` | who the shops are, capture log, data-quality warnings |
| `2026-09-05-competitor-pricing.md` | their price ladders, our cost basis, **the open pricing decision** |
| `2026-09-05-competitor-demand-and-unit-economics.md` | what sells, break-even per title, buy candidates |
| `2026-09-05-market-blind-spots.md` | catalogue ceiling, bundle model, guarantee liability |
| `2026-09-05-steam-title-metadata.md` | raw Steam API extract, 32 titles (`FACT-V`) |
| `2026-09-05-shared-account-fit-filter.md` | **which titles our model can actually carry** — sourced per title |
| `2026-09-05-shopee-my-seller-economics.md` | real fee stack, ranking inputs, prohibited-items policy |

**Two findings that overturned earlier work in this same set — do not re-derive the old versions:**

- **Shopee's effective take is 32–38% on an RM3 order, not ~10%.** A flat RM0.50–0.54 *per-order*
  fee dominates at our price points. A single-item order under ~RM0.70 is **net-negative**. This
  strengthens the case for holding RM7–9 and makes basket size a first-class lever.
- **Denuvo activation caps ceiling buyers-per-account.** Onimusha and AC Black Flag Resynced carry a
  disclosed **5 machines/day** cap. The expansion plan assumes 20 buyers/account and states there is
  no Steam-imposed ceiling — true of Steam, false of Denuvo. Check Denuvo before any purchase.
- Consequently **Red Dead Redemption 2, Forza Horizon 6 and AC Black Flag Resynced are `DOES NOT
  FIT`** (mandatory Rockstar / Xbox / Ubisoft account linkage or persistent connection).

**Status: partial — 2 of 7 shops captured** (Cyber Space, GamerSpace). Five pending: `cg`, `gf`,
`o1`, `prox`, `wnc`. Two claims from it that touch live work:

- **`docs/shopee-listings.md` is now stale.** Its "claims discipline" forbids saying auto-delivery
  because fulfilment was manual. Auto-fulfilment went live 2026-09-05. Competitors lead with
  "24/7 AUTO-DELIVERY"; we have parity and our copy does not say so.
- **`banned_item_push` (6) and `violation_item_push` (16) are unwired.** A silent Shopee takedown is
  the highest-impact failure mode nothing currently watches for.

Then verify before trusting it, on a real delivered order older than 24h:
`curl -H "x-api-secret: $API_SECRET" ".../api/cron/follow-up?limit=1"` → expect `sent: 1`, then read
the thread in Seller Chat. `enabled: false` in that reply means the flip has not reached the running
deployment. **No `FACT-V` for the send path yet — it has never run against production.**

`FACT-V` 2026-09-05, after the deploy: `GET /api/cron/follow-up` with no auth → **503** with the
"CRON_SECRET is not set" body, i.e. the route is live, reachable through `proxy.ts` (no login
redirect) and fails closed. Same deploy, unchanged: `/api/health` → 200, and a real lookup
(`ssp123` / `ssp266`) still returns a password and a live 5-char code.

The pipeline is deliberately **not** wired into the webhook: the delivery path is the money path, so
the follow-up shares no code with it, adds no column to its INSERT, and runs a day later in its own
request where a failure costs nothing a buyer can see.

---

## Second code source — A BRIDGE, NOT THE DESTINATION

**Strategic intent (Chaison, 2026-09-06): we will ultimately BUY the games outright and own
the accounts. Sourcing codes from our other websites is the interim step, not the end state.**

This should be read into every decision about the supplier layer:

- **Do not over-invest in it.** It is scaffolding. Redemption caps, reset requests, code
  expiry, the ~5-6 limit — these are all costs of borrowing rather than owning, and every one
  of them disappears when we own the account and hold its Guard seed.
- **The TOTP path stays primary.** An account whose seed we own generates codes offline,
  infinitely, with no cap, no expiry, no third party, and no network call. That is what
  "owning the game" buys, and it is why the supplier path was deliberately built so it can
  never degrade the TOTP path.
- **The transition is already cheap by design.** `code_source` is a per-account discriminator,
  so buying an account outright is a one-row change, not a migration:

  ```sql
  update steam_accounts
     set code_source       = 'totp',
         shared_secret_enc = '<the AES-GCM encrypted Guard seed>',
         supplier_site     = null,
         supplier_order_id = null
   where username = '<account>';
  ```

  Migration 0011's CHECK enforces the shape, so a half-finished conversion is refused at write
  time rather than failing later for a buyer. Orders already mapped to that account via
  `orders.supplier_order_id` should have their mapping cleared in the same change, or the
  order-level link will keep overriding the account's new TOTP source (see
  `lib/code-source/index.ts` — the order mapping wins on purpose).

- **Priority order for buying.** Convert the accounts that hurt most first: the ones that have
  already needed a reset, then the highest-volume sellers. Each conversion removes one order
  from `local/websites/NEEDS-RESET.md` permanently.

---

## Second code source: supplier-hosted Guard codes — SHIPPED 2026-09-06, OFF

Some of the accounts we sell live on **another of our own websites**, which keeps the Steam
Guard seed. Their code is not minted here — it lives on that site and has to be fetched over HTTP. Two
of our sites are in scope: `cyberspace.cyou` and `gamersfantasy.my`.

**The link is order id to order id.** The username and password are identical on every one
of our sites; the ONLY thing that differs is the order id. So a GameShare order carries the
other site's order id directly (`orders.supplier_order_id`, migration 0012), and that link
decides where the code is fetched from. An order with no link falls back to its account's
default, which is what the automated Shopee pipeline relies on.

**⚠️ That "identical username" assumption is FALSIFIED for gamersfantasy.my specifically
(2026-09-06).** The same gamersfantasy order id (`2609069D9MXVAP`) was queried repeatedly in
one day and returned FOUR different usernames — this supplier hands out accounts from a pool
per order id, not one fixed account. `cyberspace.cyou` has been repeatedly confirmed stable
and is NOT affected. Fix shipped: `lib/code-source/gamersfantasy.ts` now calls the supplier's
free `prechkorder` lookup immediately before every code fetch and uses whatever account it
returns right now, rather than trusting `steam_accounts.username`. Verified live end to end —
see the Sekiro entry below. Full writeup: `local/websites/gamersfantasy.my.md`.

**FIXED same day.** `resolveDisplayCredentials()` in `lib/code-source/index.ts` now resolves
the credentials phase fresh too, via the same per-site resolver map
(`CREDENTIAL_RESOLVERS`) that `lookupCode` uses for the code phase — both share
`resolveSupplierTarget()` so they can never disagree about which site/order id they're
targeting. `FACT-V` 2026-09-06: four back-to-back `phase: "credentials"` calls against a real
test order (`GF-POOL-TEST-001`, mapped to gamersfantasy order `2609069D9MXVAP`, stored
`steam_accounts.username` = `evilfantasynine1`) returned THREE different accounts —
`evilfantasy9`, `evilfantasynine4`, `evilfantasynine3` (twice) — never once the stale stored
value. Zero redemptions spent (`prechkorder` is the free action). Test order deleted after;
the onboarded account/game/link were kept, same convention as the Sekiro entry above.

Until this change such an account **could not be stored at all**: `0001` declared
`shared_secret_enc NOT NULL`, and a supplier account has no seed to put there.

### The design decision worth remembering

**The supplier order id belongs to the ACCOUNT, not to a buyer's order.** A value like the
DELTARUNE one is *our own purchase* of that account from cyberspace — every Shopee buyer we
resell it to shares it. So it lives on `steam_accounts`, and `orders`, `account_games`,
allocation, fulfilment and delivery are all completely untouched.

This also makes Black Myth: Wukong work for free — its six rotating usernames become six
normal account rows that happen to share one `supplier_order_id`, rotated by the
least-loaded allocator that already exists.

(The original proposal in `local/sharewebsite-problem.md` mapped gameshare order id →
supplier order id. That was rejected: it stores per-buyer what belongs to the account, and
cannot express Wukong at all. That file is marked superseded.)

### How it works

```
lookup verified (order + active)   <- username check dropped 2026-09-06, see above
  -> getCodeForAccount(account)
       code_source 'totp'     -> mint offline from our seed   (unchanged, never networks)
       code_source 'supplier' -> POST to that supplier's portal
  -> ok:    serve the code exactly as before
     fail:  not_ready | expired | supplier_error
```

The buyer never learns which kind of account they have.

**Staged as two phases since 2026-09-06.** `/api/lookup` takes a `phase` field
(`"credentials" | "code"`, defaulting to `"code"` so any caller that never sends it keeps the
old all-in-one behaviour). `credentials` verifies the order and decrypts the password WITHOUT
touching a supplier or spending a redemption; `code` does the rest, unchanged. Why it matters
beyond UI: a supplier-sourced buyer needs the credentials just to REACH Steam's login screen.
The old all-in-one behaviour gated credentials behind a successful code fetch, which would
have stranded exactly this buyer the moment this feature went live — they could never get a
code without logging in first, and could never log in without the credentials the code fetch
was gating. The homepage now shows username/password (each with a copy button) as soon as the
order resolves, then a separate Get Code action.

### Two things that cost real time — do not rediscover these

- **Both portals return HTTP 200 for every business outcome.** The `404` recorded in
  `local/sharewebsite-problem.md` for a CODE TIMEOUT is a value *inside the JSON body*, not
  an HTTP status. An adapter branching on `response.status === 404` misclassifies every
  expired code, silently and forever.
- **On gamersfantasy, "no code yet" and "wrong username" are the same response** — same 200,
  same JSON shape — separated only by the substring `(unavailable/in progress)`. The adapter
  maps the no-suffix case to `supplier_error`, NOT `not_ready`, on purpose: a stale username
  on our side would otherwise tell a buyer to "wait and retry" forever. This is not
  hypothetical — one recorded username was already found stale on 2026-09-06.

### The rate-limiter trap this avoids

All three failure reasons record outcome **`unavailable`**, never `failure`. `failure` is
weighted 3x against a 20-per-order budget, so a buyer pressing retry while waiting for Steam
to prompt them would have locked themselves out **after six presses** — punished for doing
exactly what our own error message told them to do. A regression test pins this.

### Failure isolation

The TOTP path never touches the network. A total outage of our other sites cannot degrade the
six accounts serving buyers today — that property is what makes this strictly additive.
Supplier calls are capped at a 5s timeout and every failure is contained to its own order.

### Admin panel

`/admin` now shows and edits, per account: code source, supplier site, **supplier order id**
(editable in place, since a supplier can rotate it), and a per-account **Reveal** for the
username and password — so the operator can key credentials into a supplier portal by hand.
Reveal is a separate `POST /api/admin/accounts/reveal`; the list endpoint deliberately never
carries passwords, so the fleet's plaintext is not shipped to the browser on every page load.

### Two things NOT verified by running them

**The CHECK constraints in 0011 and 0012 are `FACT-S`, not `FACT-V`.** Both originally had a
three-valued-logic bug: `length(btrim(NULL)) > 0` is NULL, `TRUE AND NULL` is NULL, and
Postgres accepts a CHECK unless it evaluates to FALSE — so a half-filled row inserted cleanly
through a constraint whose own comment said it could not. Both now wrap that test in
`coalesce(..., 0)`. **This was reasoned from documented Postgres semantics, not executed:**
there is no local Postgres or Docker on this machine and the DB password is broken (open item
1). When 0011 and 0012 are applied, confirm both by hand before trusting them:

Run the whole block as-is. It rolls back, so it leaves nothing behind — do NOT
run the statements individually, or the probe rows stay in production.

```sql
begin;

-- (a) 0012: a website with no order id must be REJECTED
insert into orders (shopee_order_id, shopee_buyer_id, account_game_id, verified, supplier_site)
  values ('probe-a', 'probe-buyer', null, false, 'cyberspace.cyou');

-- (b) 0012: an order id with no website must be REJECTED
insert into orders (shopee_order_id, shopee_buyer_id, account_game_id, verified, supplier_order_id)
  values ('probe-b', 'probe-buyer', null, false, 'SOME-ORDER');

-- (c) 0012: neither set must be ACCEPTED (every existing row is this shape)
insert into orders (shopee_order_id, shopee_buyer_id, account_game_id, verified)
  values ('probe-c', 'probe-buyer', null, false);

-- (d) 0011: a supplier account with no order id must be REJECTED
update steam_accounts set code_source = 'supplier',
       supplier_site = 'cyberspace.cyou', supplier_order_id = null
 where username = '<pick any account>';

rollback;
```

**Expected: (a), (b) and (d) each raise a check-constraint violation; (c) succeeds.**
If (a) or (d) succeeds instead, the coalesce fix did not work and a half-filled link can
still be written — stop and fix it before turning `SUPPLIER_CODE_SOURCE` on.

`shopee_buyer_id` is passed explicitly so the probe does not depend on 0008 having been
applied (0008 drops that column's NOT NULL; 0001 declares it). Without it, an unapplied-0008
database raises a not-null violation instead, which reads like the constraint firing and
gives a false pass on the very thing being tested.

**One combined test run reported 3 failures that never reproduced** — not in three further
combined runs, nor in any of the eight test files run individually (70/70 every time). Another
process was actively editing this working tree at the time, which is the likeliest cause.
**The failing test titles were not captured**, because the run was filtered to summary lines
only. That is a real gap: if 3 failures appear again, there is nothing recorded to compare
against. Capture full output, not a grepped count, before dismissing a flake.

### ✅ PROVEN WORKING LOCALLY — `FACT-V` 2026-09-06

**Migrations `0011` and `0012` are APPLIED** to production Postgres (pasted into the Supabase
SQL editor by Chaison; the DB password is still broken so `run-migrations.mjs` could not do it).
Verified by the self-check query returning `3, 2, 2` — three new `steam_accounts` columns, two
new `orders` columns, both shape constraints present.

**A real Steam Guard code was fetched end to end through the shipped code path.** Ghost of
Tsushima, our order id mapped to that site's order id, `getCodeForAccount()` called exactly as
`/api/lookup` calls it → HTTP 200 with a live 5-character code in 5677 ms. The buyer flow
works. Chaison then confirmed a second order (`int123`) working through the browser.

**Two test orders exist in production:**

| Our order id | Game | State |
|---|---|---|
| `gho123` | Ghost of Tsushima | ⚠️ that site's order has hit its redemption cap — needs a reset before it works again |
| `int123` | Into the Dead | ✅ confirmed working by Chaison |

Usernames deliberately omitted: an order id plus its username is a working credential pair for
`/api/lookup`, and this repo is public — that is exactly Open Item 0 below. They are in
`local/websites/cyberspace.cyou.md`.

### ✅ LIVE for real buyers — `FACT-V` 2026-09-06

`master` is pushed and deployed. Confirmed directly, not inferred from the checklist below:

- **`SUPPLIER_CODE_SOURCE=true` is set in Vercel production.** Proven by requesting a real
  code phase against a genuine supplier-backed test order and getting back the `not_ready`
  copy ("Log in to Steam first...") — that message can only come from the supplier branch;
  the offline TOTP path has no such state. Not re-inferred from an env var listing — this is
  what actually answered a real request.
- **Migration `0013` is applied.** `supplier_code_log` exists and holds real rows.
- **A full end-to-end test was run against a NEW gamersfantasy.my account** (not just
  cyberspace, which was already proven): `scripts/setup-supplier-test-order.mjs --username
  <supplier-username> --order-id GF-SEKIRO-TEST-001` onboarded Sekiro: Shadows Die Twice GOTY Edition
  (game + `steam_accounts` row + `account_games` link — these were KEPT as real inventory, not
  test throwaway). `POST /api/lookup` with `phase: "credentials"` then `phase: "code"` against
  the real production API returned genuine credentials and then a live 5-character code. The
  disposable `orders` test row was deleted afterward (0 leftovers, same as prior e2e tests);
  the `supplier_code_log` row from that real fetch was deliberately KEPT, since it's an
  accurate record of one real redemption spent on the Sekiro order's cap, not test noise.

**Still open, not yet confirmed:**
1. Whether the rest of the ~20 accounts across both supplier sites are seeded
   (`scripts/seed-suppliers.mjs`) and linked to games in `/admin` — only a handful of
   individual accounts have been proven end-to-end so far (Ghost of Tsushima, Into the Dead,
   Sekiro).
2. The constraint probe above (0011/0012 CHECK constraints) is still `FACT-S`, never executed
   against production.
3. The residual credential-staleness gap noted above (displayed credentials vs. freshly
   resolved code target on gamersfantasy.my) is unaddressed.

### Buyers get the newest code on demand, and we can see the cost

Built 2026-09-06 alongside the cap discovery.

**Deliberately NOT a timed auto-refresh.** A code does not change on a clock — it changes only
when somebody attempts a Steam login, which emails a new one. A scheduled refresh would fire on
its own cadence and almost always re-fetch the code we already had, spending a redemption to
learn nothing. That is precisely what exhausted an order. The only moment a new code exists is
just after the buyer logs in again, and only the buyer knows when that was.

| Buyer action | Cost |
|---|---|
| Ordinary press | **free** if fetched within 60 s (served from cache) |
| "Logged in again? Get the newest code" | **one redemption**, bypasses the cache |

The page also says *"Same code as before — Steam has not sent a new one yet"* when the value is
unchanged, rather than leaving the buyer wondering whether the button worked. A failed refresh
drops the stale code instead of serving it again.

**Migration `0013` adds `supplier_code_log`** — one row per REAL fetch. Cache hits are not
logged, because they spent nothing and counting them would hide how many redemptions remain.
`/admin` shows, per order on the other site: redemptions spent against the observed cap (amber
near it, red at it), the last outcome including REACHED LIMIT, and when the code last actually
changed.

**The code itself is never stored** — only a 12-character fingerprint, enough to answer "did it
change?" without putting a live credential at rest in a database whose admin panel is already
the weakest link (open item 0b). A code expires within ~2h, so storing it would age into
worthlessness while the risk would not.

### 🔴 Redemptions are FINITE — the thing to design around

The site caps how many times ONE order id may be redeemed. Exhausted, it returns
`{"code":"305","title":"REACHED LIMIT"}` until reset by hand.

**Measured 2026-09-06:** 10 requests were made against the Ghost of Tsushima order. Six went
through; the seventh returned `REACHED LIMIT`. So the cap is **5 or 6** — the ambiguity is one
request aborted client-side at 5 s that had already reached their server. This exhausted a real
saleable order, caused entirely by development testing.

This **falsified** the `FACT-C` the feature was designed on ("unlimited redemptions"), which
had been used to justify skipping usage tracking entirely.

Mitigations now in place:

- **`lib/code-source/cache.ts`** — a fetched code is reused for 60 s, so repeat presses cost
  ONE redemption instead of one each. Safe because the value is a single emailed Guard code,
  not a rotating TOTP: verified byte-identical across six fetches spanning minutes. Only
  successes are cached; a not-ready never is. Per-process memory, so not distributed — if
  redemptions still drain fast, move it to Postgres rather than lengthening the TTL.
- **`local/websites/WHEN-TO-FETCH-CODE.md`** — the operating rule: fetch ONLY when a buyer is
  at Steam's code prompt and has just asked. Never poll, never prefetch, never "just check".

**Code lifetime — partly measured 2026-09-06.** A code survives at least several minutes (one
was returned byte-identical across 6 fetches spanning minutes) and does NOT survive 1h49m (a
code fetched at ~11:14 returned `CODE TIMEOUT` at 13:03). So expiry sits between roughly 10
minutes and 1h49m; tighter than that is not established and is not guessed at in code.

It barely matters operationally: the buyer is told to be at Steam's prompt before pressing, so
the gap between fetch and use is seconds. It constrains only the 60 s cache TTL (comfortably
inside the lower bound) and manual fetches — a code pulled by hand to paste into Shopee chat is
NOT good for hours. Narrowing it further would cost 3-4 redemptions on a nominated burner order
and change nothing in the current design.

### A trap that cost real money to find

`SUPPLIER_TIMEOUT_MS` was 5000 and **failed every single real lookup.** Measured against that
site: the CSRF handshake is 160–221 ms but `POST /guide_code` takes **5376–5556 ms** (it appears
to wait on the Guard email). The abort fired at 5011 ms, just before the answer arrived, so a
valid code was in flight while the buyer got "temporarily unavailable". No unit test could catch
it — every adapter test uses a fixture and never waits on a network. Now 15000, with
`maxDuration = 30` on `/api/lookup` so our own timeout fires before Vercel's.

---

## Four blocked titles prepared as DELISTED drafts 2026-09-06

Star Wars Outlaws (`54517448418`), AC Shadows (`54867444295`), AC Valhalla (`54817448536`) and
Red Dead Redemption 2 (`55867457087`) now exist on Shopee as **UNLIST drafts** — banner, copy,
mapping, credentials all in place — so they are one command from publishing the moment their
blocker clears. None is purchasable.

None of these four has Steam Cloud, so their descriptions omit the "turn Steam Cloud off" line.

**Their descriptions are NOT publishable as written.** Each omits the thing that makes the game
work, because we cannot deliver it. The three Ubisoft titles need a second Ubisoft credential pair
stored, delivered, and then stated in the copy — three separate pieces of work, in that order.
RDR2 is worse: the supplier supplies no Rockstar credential at all, so there is nothing to deliver
even after a schema change. Recommend never listing RDR2 rather than treating it as pending.

### Duplicate Resident Evil Requiem row deleted

`Resident Evil Requiem Deluxe Edition` was a second `games` row for the live
`Resident Evil Requiem` (`45667475242`) — same app 3764200, same order `2609069D9MXVAP`, same pool —
and held a duplicate `evilfantasynine1` link that double-counted that account in the least-loaded
allocator. Row and link deleted; the survivor holds all five pool accounts. No second Shopee listing
was made, deliberately: a duplicate listing of a live product splits ranking and reviews.

Shop is now **33 live + 6 delisted drafts**, all 39 at stock 99999 with 3-month installment.

## Five more single-game orders added 2026-09-06 — 4 published, 1 refused

gamersfantasy.my dropped five games, each on **its own order id** — the simplest shape yet, and the
safest: one order, one game, one account, so none of them shares a redemption cap with anything.

| Game | item_id | Price |
|---|---|---|
| Marvel's Spider-Man 2 | 49667469218 | RM1.99 |
| The Last of Us Part II Remastered | 42734260249 | RM1.99 |
| Cities: Skylines II | 49967469265 | RM1.99 |
| Palworld | 51367462110 | RM1.59 |

Banners were generated for all four (`gen-banners.mjs`), copy written into `docs/listing-copy.md`
Part 4, drafts created, mapped, then published. Shop is now **33 live + 2 held**.

### ⛔ Red Dead Redemption 2 — seeded, linked, NOT listed

`260906BDEGWW2M` / `fantasy2redemption`. Two independent reasons, reached separately:

- The supplier's own `instruct` field: *"You MUST setup the bypass patch in tutorial! No rockstar
  code will be given."* No Social Club credential is supplied at all.
- `research/2026-09-05-shared-account-fit-filter.md` already classed RDR2 **DOES NOT FIT** —
  mandatory Rockstar Social Club link plus a periodic online entitlement re-check, even in story
  mode. That verdict predates the order, so the supplier note corroborates rather than reveals.

Selling a title needing a third-party patch also sits badly against a placeholder `/terms`.

### `260906BDBHJFR6` is a duplicate Cyberpunk order — unresolved

`prechkorder` returns `cyberfantasy2077`, byte-identical to the account already held under
`260906BAU2JQ0W`. One Steam account, two order ids. Left unseeded on purpose:
`seed-suppliers.mjs` hard-exits on duplicate usernames, so adding it blocks the write for **every**
supplier account. It is either double the code capacity or a double purchase, depending on whether
the two ids carry independent caps. Cheap to test; not tested.

## 🟢 SUPPLIER CATALOGUE IS LIVE — 18 published 2026-09-06

The second code source is deployed and serving. Verified before publishing, on production, with a
single lookup against the `int123` test order: **HTTP 409 `not_ready`** with the "Log in to Steam
first" message. That message is only reachable after the supplier was actually contacted — a kill
switch that was off would have returned `supplier_error` instead — so it proves the build is
deployed AND `SUPPLIER_CODE_SOURCE` is on, **without spending a redemption** (a not_ready issues no
code). Use that same probe as the cheap deploy check in future.

Shop is now **29 live + 2 held drafts**: 10 of our own TOTP games, 18 supplier games, and the demo
product. All at stock 99999 with 3-month installment.

### Held back deliberately — do not publish

| Item | Why |
|---|---|
| DELTARUNE `47167470545` | account `uchgi` **recovering** — 305 REACHED LIMIT. Already blocked a paying buyer (`260906ATWBXXSC`); its stock reads 99998 because that sale went through. |
| Ghost of Tsushima `46067470527` | account `xiv7s7552` **recovering** — exhausted by development testing |

Both need a reset from cyberspace.cyou before they can be published. Everything else about them is
ready — banner, copy, mapping, price.

The three Ubisoft titles have no listing at all and must not get one (second-account gap, below).

### Shop voucher `GAMESAVE2` — RM2 off min spend RM15

`voucher_id 1503523174895616`, shop-wide, fixed amount, 500 uses, live 2026-09-06 to 2026-10-06.

**Shopee prefixes the shop name onto `voucher_code`** — we sent `SAVE2` and the live code is
`GAMESAVE2`. The field takes at most 5 characters and Shopee supplies the rest.

**A percentage voucher could not express the ask.** "50% off, capped at RM2, min spend RM15" is
rejected by `voucher_max_discount_low_quality`, which requires
`max_price > percentage * min_spend * 0.01` — at 50% and RM15 that is RM7.50, so a RM2 cap is
invalid. Fixed-amount has no such gate and expresses the literal intent exactly.

Ongoing vouchers are near-frozen: only name, usage_quantity (increase only), end_time and display
channels can change. Discount and min spend cannot. A wrong one must be ended and replaced, and its
code is then locked for 30 days.

## Full supplier catalogue wired up 2026-09-06 — 18 drafts, deploy pushed

All 32 supplier credentials are seeded and every account is linked to a game. Seven new games were
created (Horizon Zero Dawn Remastered, God of War Ragnarok, Cyberpunk 2077, METAL GEAR SOLID Delta,
plus the three Ubisoft titles) and five new Shopee UNLIST drafts made. `steam_app_id` was repaired on
four rows sitting at 0 (Thronefall, Resident Evil Requiem, Sekiro, RE Requiem Deluxe) — at 0 they
miss `lib/catalogue.ts` and render as "art pending" with no Buy button.

Shop now holds **10 live (our own TOTP) + 18 supplier drafts + 2 flagged drafts**.

**`master` was pushed 2026-09-06**, so Vercel has the supplier code path. **Two steps remain, both
console-only:**

1. `SUPPLIER_CODE_SOURCE=true` in Vercel production, **then REDEPLOY** — Vercel bakes env vars into a
   deployment, so setting it alone leaves the running one on the old value.
2. Apply `local/PASTE-THIS-0013.sql` in the Supabase SQL editor. Non-blocking for buyers (the ledger
   write sits in a silent try/catch) but until it lands nothing counts redemptions — which is exactly
   how an order got burnt with no warning.

Until step 1, **no supplier listing may be published**: with the kill switch off a supplier account
cannot produce a code at all.

### ⛔ Three titles that must never be listed as things stand

Star Wars Outlaws, Assassin's Creed Shadows and Assassin's Creed Valhalla (order the shared gamersfantasy order (id in `local/websites/gamersfantasy.my.md`, gitignored))
each need a **second Ubisoft account** on top of the Steam credentials. `steam_accounts` stores one
credential pair and `buildDeliveryMessage()` sends Order ID + Username + Password only, so a buyer
would receive working Steam credentials and still be unable to launch. Seeded and linked so the fleet
knows about them; no listing exists and none should until there is somewhere to put the second pair.

**All seven games on the shared gamersfantasy order (id in `local/websites/gamersfantasy.my.md`, gitignored) share ONE redemption cap.** Selling two copies each of three
titles exhausts it for all seven, including the four that never sold — a Cyberpunk buyer can exhaust
Horizon Zero Dawn. Worse than Wukong, where the shared accounts at least back a single game.

### Still flagged, not to be published

DELTARUNE (`uchgi`) and Ghost of Tsushima (`xiv7s7552`) are both `recovering` — confirmed exhausted
by a live `305 REACHED LIMIT`. DELTARUNE has already blocked a paying buyer (`260906ATWBXXSC`).
Neither can deliver even after the deploy; they need a reset from cyberspace.cyou first.

## 🚨 Open item 0 — LIVE ACCOUNT CREDENTIALS ARE PUBLISHED IN THIS REPO

**Found by the security review on 2026-09-06. This is not new, and it outranks everything
else open.**

`/api/lookup` needs exactly two things: a Shopee order id and the matching Steam username.
It then returns that account's **password and a live Guard code**.

Both halves of that pair are published, in this repo, for **all six sellable accounts**:

- `docs/order-fulfillment-sop.md` — the test-order-id convention and the worked examples
- `CHECKPOINT.md` — this file: the inventory table's "Test order" column, and the
  onboarding examples further down

The convention itself ("first 3 letters of the username + `123`") means publishing either
half effectively publishes both. **The repo is public.** Anyone who reads it can pull live
credentials for the whole fleet, and the rate limiter does not stop them — 20 weighted
lookups per order per 15 minutes is ample when you already know the answer.

This is **worse than any finding in the supplier feature**, and it is entirely pre-existing.

### What actually fixes it — Chaison's call, all of it needs a console

1. **Rotate the six accounts' passwords.** Lookup reads live from the DB, so existing buyers
   pick up new values automatically. This is the only step that revokes what is already
   public — git history still holds the old values even after step 2.
2. **Redact the pairs** from `docs/order-fulfillment-sop.md` and this file. Use placeholders,
   not real values, and change the test-order-id convention so it is not derivable from a
   username.
3. **Consider making the repo private.** It is public only because Vercel Hobby requires it
   for git deploys; a paid plan removes that constraint.
4. Until 1 is done, treat every fleet password as compromised.

---

## ⚠️ Open item 0b — the admin panel is one unthrottled password away from the fleet

Also from the 2026-09-06 review, and sharpened by this session's new
`POST /api/admin/accounts/reveal`, which returns a **decrypted** password for any account id.

The gate itself is sound. It was attacked directly and held: 12 path spellings (dot-segment
traversal from every public prefix, encoded separators, case variants) and six
`x-middleware-subrequest` header variants (the CVE-2025-29927 class) all failed to reach the
handler. `proxy.ts` is doing its job.

The problem is what the gate is worth:

- `DASHBOARD_PASSWORD` is **still a placeholder** (open item 1 below, unresolved since
  2026-08-24).
- `/api/auth/login` has **no throttling at all** — 15 rapid wrong passwords returned 15
  plain 401s, no lockout, no backoff.
- The session cookie is never expired server-side.
- `GET /api/admin/accounts` lists every account id, and reveal takes an id. Two requests in
  a loop is the entire fleet's plaintext.

Reveal now writes an `admin.credential_reveal` audit line to the runtime log, so misuse is at
least visible after the fact. That is detection, not prevention.

**Fixes, cheapest first:** set a real `DASHBOARD_PASSWORD` in Vercel; rate-limit
`/api/auth/login` (the per-IP machinery in `lib/rate-limit.ts` already exists and could be
reused); expire sessions; require step-up re-auth for reveal specifically.

---

## ⚠️ Open item 1 — ROTATE THESE CREDENTIALS

On 2026-08-24 a scan found real credential values had been written into `CHECKPOINT.md` (this file)
and `scripts/seed-test-account.mjs`, and pushed **after the repo was made public**. History was
rewritten (`git filter-branch`), refs and reflog purged, `gc --prune=now` run, force-pushed; a
fresh clone now scans clean. Public repos are scraped by credential bots within minutes, so:

- **Supabase DB password** — Supabase → Settings → Database → Reset.
  **2026-09-05: the value in `.env.local` no longer works** (Postgres `28P01`), so it was either
  rotated or belongs to a different project. Consequence: `scripts/run-migrations.mjs` and
  `scripts/seed-shopee-listings.mjs` cannot connect. Migrations 0005–0008 were applied by pasting
  SQL into the **Supabase SQL Editor** instead, and `shopee_listings` is seeded through the
  PostgREST API using the service-role key. Both work fine; the password is off the critical path
  but should be straightened out.
  ⚠️ **Use the right project.** Steamshare is `vwefthulbxqarttytvpl`. A near-miss on 2026-09-05 had
  the SQL Editor open on a DIFFERENT Supabase project — running the migrations there
  would have built Steamshare's schema inside an unrelated project.
- **`DASHBOARD_PASSWORD`** — still a placeholder; change in `.env.local` **and** Vercel env vars.
  Guards the admin panel, which exposes every stored Steam credential.
- **`ssp266`'s Steam password** — change on Steam, then re-run the seed script
  (now takes `SSP266_PASSWORD` as an env var instead of hardcoding it)

**Confirmed clean, never committed:** `.env.local`, Supabase service role key,
`ACCOUNTS_ENCRYPTION_KEY`, `AUTH_SECRET`, `API_SECRET`, Vercel token, `ssp266`'s `shared_secret`.
Only tracked env file is `.env.local.example`, all values blank.

**Rule:** this repo is public. Never write a real credential into any tracked file, docs included.

---

## Other open items

2. **Shopee listing status — the real blocker. Now: awaiting approval (2026-08-26).** Chaison has
   submitted for virtual-goods/digital-category approval and is waiting on Shopee's decision. This is
   an upgrade on the previous state (delist-only, cause unknown) — it's now a known pending decision
   rather than an unexplained flag, but it is **still unresolved and still gates everything
   downstream**. No build work on the Shopee integration should start before it lands. If it comes
   back rejected, the storefront angle is invalid and the roadmap below is dead as written.
3. **Refund policy terms** — the 48hr-replacement / 7-day-refund window on the live `/terms` page is
   a drafted placeholder, marked as unconfirmed. Needs Chaison's actual decision.
4. ✅ **RESOLVED 2026-09-05 — Shopee Open API access is live.** The app *Gameshare Code Sharing
   System* is **Online**, category **Seller In House System**, with a live partner id (`2043838`)
   and a live partner key valid to 2027-03-03. The shop is authorized (365-day grant), the token is
   stored encrypted and auto-refreshes, and Order + Product + Seller Chat APIs all return real data.
   The Chat API scope question below (item 4 of the old unknowns) is also answered: **we have it.**
   Original 2026-08-29 analysis kept below for the reasoning that got us here.

   **Shopee Open API — the rejection was wrong for Malaysia. We likely already qualify (2026-08-29).**
   The Console rejects with *"not a Mall or Managed Seller"*, but that is **Thailand's** rule. Shopee's
   live `developer-guide/12` §3.1 (updated 2026-07-19, read verbatim via its content API by two
   independent agents) states:
   > **MY (Malaysia)** — Mall Sellers OR Registered Business Sellers OR Sellers with minimum 1 order in L12M

   Malaysia is one of the loosest markets on the platform. A **Registered Business Seller qualifies with
   zero sales**; alternatively **one order in 12 months** qualifies any seller.
   **Most likely root cause of the rejection:** the Shopee shop's KYC is registered as an *Individual*,
   not a Registered Business — leaving only the "Mall" branch, which produces exactly that wording.
   **Fix:** Seller Centre → Shop Information → resubmit KYC as **Registered Business** with Prosper
   Choice SSM docs → re-apply in the Console as *Registered Business Seller*, **leaving the Key Account
   Manager email blank** (explicitly optional). SLA is **3 working days**. If rejected again, appeal via
   Go to Profile → Edit quoting §3.1 with the SSM certificate.
   **App type to create: "Seller In-house System"** — the self-use tier, available to Registered Business
   Sellers, and it carries **All API including Chat API** (broader than the ERP System type). This makes
   roadmap items A *and* B buildable.
   **Backdoor needing no tier at all:** the Mall/Managed gate binds *app creation*, **not** shop
   authorization. Guide 20 (Authorization & Authentication) has zero seller-tier conditions, and Zetpy /
   SiteGiant / BigSeller all document their connect flow with no Shopee tier prerequisite. An ordinary
   non-Mall MY shop can OAuth into an existing ISV today — useful as an interim data path.
   Design note: buyer PII is masked by default (unmasking needs a pen-test report + IP whitelist), so
   keep verifying on `order_sn` + payment status, which the current form already matches.
   Full analysis: `Personal Assistant/research/2026-08-29-shopee-my-seller-tiers-api-eligibility.md`
   and `...-shopee-my-seller-email-export-digital-delivery.md`.

   **Progress 2026-09-03:** KYC fix appears to have landed — "Seller In-house System" was selectable
   in the Console, confirming Registered Business status. App created (`GameShare Fulfillment`,
   partner ID `1243120`), sandbox/test Partner Key issued and stored in `.env.local` (`SHOPEE_*`,
   gitignored, not committed — see the credential-leak history under open item 1 for why that matters
   here specifically). **Still missing before any real Order/Chat API call works:** a shop-level
   access token — Partner ID + Key only sign requests, they don't authorize against a shop. Next:
   generate one via Console → Test Account-Sandbox (visible in the left nav), or complete real OAuth
   once `gameshare.space` has a callback route (roadmap item B). *(Both were done on 2026-09-05 —
   the callback route shipped and the live shop was authorized through it. See the ✅ note above.)*

4b. **⏰ HARD DEADLINE 1 Sep 2026 — Virtual Goods channel requires Registered Business KYC.** From that
   date, Non-SSL / Virtual Goods shipping-channel applications are **rejected outright** if the seller is
   registered under the Individual Seller category. Our listings are non-physical and need this channel.
   Same fix as item 4 — migrating KYC to Prosper Choice SSM solves both. Application SLA 1–3 working days.
   Ongoing obligations once approved: proof of delivery required per order (keep an auditable delivery
   log — in a dispute with no proof, **the buyer wins by default**); auto-removal from the channel after
   30 consecutive days with no orders.

4c. **🚩 The product itself appears to be prohibited on Shopee — this outranks every API question.**
   Three independent policies: (a) Shopee MY's Prohibited Items *Services* row catches it via
   *"Any other services that are not expressly allowed by Shopee — NOT ALLOWED"* (`edu/article/614`,
   updated 2026-02-16); (b) Shopee's regional General Prohibited Items PDF names **"Game Accounts"**
   under Digital Goods §k and **"Membership Accounts And Other Related Listings"** under §l; (c) Open
   Platform Platform Partner Rules (guide 34) bans *"Selling or trading of seller accounts"*.
   Separately, **Preferred Seller permanently excludes shops with intangible listings** (3-month ban just
   for holding them), so that tier is structurally closed to us forever.
   **This probably explains the delist-only flag in open item 2** — previously recorded as "cause unknown".
   Confidence: **High** on the policy text, **Medium** on MY-specific classification (the PDF naming
   "Game Accounts" is regional and contains PH-specific entries; MY's own table catches it via the
   Services catch-all instead). Penalties: listing removal, penalty points, **account freezing**.
   **Action before further Shopee investment:** get a written ruling from Shopee MY Seller Support
   describing the listing plainly. A frozen account makes every tier question moot.
5. **No pruning on `lookup_attempts`** — grows unbounded. Prune statement is commented in the
   migration; schedule with pg_cron once traffic is real.
6. **`orders.shopee_order_id` is not unique on its own — latent lookup-killer.** The constraint is on
   `(shopee_order_id, shopee_buyer_id)`, but `verifyShopeeOrder()` queries on `shopee_order_id` alone
   with `.maybeSingle()`, which **errors** on duplicates — so two rows sharing an order id 404 the
   lookup for *every* buyer on that id. Hit for real on 2026-08-26 (`ssp123`; older row renamed to
   `ssp123-legacy`). Since the buyer-id field is legacy — the form collects username now — the fix is
   a unique index on `shopee_order_id` alone.
   ✅ **RESOLVED 2026-09-05.** `0005_orders_order_id_unique.sql` is **applied to production** and
   verified. Its duplicate guard passed, so no legacy duplicates remained. 0007 and 0008 landed in
   the same batch; 0008's own guard (which aborts unless 0005's single-column unique index exists)
   passing is independent proof that 0005 took effect. Applied via the Supabase SQL Editor rather
   than `run-migrations.mjs`, because the stored DB password no longer works — see open item 1.
7. **No DELETE handler on `/api/admin/orders`** — orders can be created from the admin panel but not
   removed, which forced a direct DB edit on 2026-08-26. Refund handling (roadmap item C) needs this
   anyway.
   ✅ **RESOLVED — deployed.** `app/api/admin/orders/route.ts` shipped with the 2026-09-03 work and
   is live in production. No migration was needed.
8. **Supabase project pause = silent, invisible lookup failure — found and fixed 2026-09-03.** The
   project was paused (likely free-tier inactivity) and every single buyer lookup — verified as far
   back as `ssp123`/`dub123`/`sss123` — was 404ing identically after a ~14.4s timeout. This is
   indistinguishable from a normal "order not found" response by design (security requirement:
   `/api/lookup` can't leak *why* a lookup failed). Nobody noticed until this session tested it
   directly — there was no monitoring of any kind on this failure mode. **Confirmed resolved**
   (Chaison unpaused the project; DNS + backend both verified reachable again, live lookup round-
   tripped correctly). **Mitigation built:** `GET /api/health` — public, checks real DB connectivity,
   returns 503 (not a generic 404) when the database is unreachable. Point a free external uptime
   monitor (UptimeRobot, Better Uptime, etc.) at it on an interval and alert on non-200 — that's the
   actual fix for "was down and nobody knew," not just knowing this once. **Standing habit going
   forward: run one real lookup (or hit `/api/health`) after any pause/unpause of this project**,
   don't assume buyers are unaffected just because the site loads.
9. **🔴 A silently-failed order has no alert — this is the live gap, and it has already bitten.**
   `no_mapping` (unmapped listing) and `no_capacity` (no active account owns the game) both ACK the
   push with 200, deliberately: a Shopee retry cannot fix either, only a human can. The cost is that
   the ONLY trace is a `console.error` in the Vercel logs. On 2026-09-05 a real buyer paid for Euro
   Truck Simulator 2, hit `no_mapping`, and nothing anywhere raised its hand — it was found only
   because Chaison noticed the order had not delivered.
   **Detection exists but is manual.** A reconciliation check — ask Shopee for every order, assert
   each paid one has an `orders` row, and name the exact unmapped `item_id` when one is missing —
   was written during that incident and confirmed the rest of the backlog was clean. It currently
   lives outside the repo, so **committing it as `scripts/reconcile-shopee-orders.mjs` and running
   it on a schedule is the outstanding work.** Until then, run it after every listing change.
   Related: `/api/health` (open item 8) covers "the database is down", not "an order fell through".
10. **`shopee_push_log` and `lookup_attempts` both grow unbounded.** Same pg_cron pruning story as
   open item 5; push log rows are small but arrive on every status change, not just payment.

---

## Inventory: 7 accounts, 6 sellable

All 7 are Guard-linked in SDA and seeded into Supabase (2026-08-26) with password + `shared_secret`
AES-256-GCM encrypted at rest. **Credentials are NOT in this repo** — the repo is public. The tracker
lives at `C:\Users\ASUS\Desktop\SteamShare\vault\` (`ACCOUNT-TRACKER.md` + `fleet.json`), which is
not a git repo and not inside OneDrive.

| Account | Game | App ID | Test order | Status |
|---|---|---|---|---|
| `gscal1` | DAVE THE DIVER | `1868140` | `gsc123` | `active` — verified live |
| `dubust22` | Euro Truck Simulator 2 | `227300` | `dub123` | `active` — verified live |
| `ss_schedule11` | Schedule I | `3164500` | `sss123` | `active` — verified live |
| `ssp266` | Escape From Duckov | `3167020` | `ssp123` | `active` — verified live |
| `ghjjK458` | Dokimon (free, no DLC) | `2019300` | `ghj123` | `active` — verified live |
| `Fishy790` | How to Fish | `4001890` | `fis123` | `active` — verified live |
| `guisio78` | — (intended Family View acct) | — | — | seeded, no game |

**Verified on production 2026-08-26**, all six sellable accounts: lookup returns a code; the returned
password round-trips to the tracker value (proving the right `ACCOUNTS_ENCRYPTION_KEY`); two lookups
35s apart return different codes (live TOTP, not cached).

Seeding is now scripted and idempotent: `scripts/seed-fleet.mjs` (reads the local fleet file + SDA
`.maFile`s, contains no credentials). Test-order-id convention — first 3 letters of the username +
`123` — is documented in `docs/order-fulfillment-sop.md`.

> **⚠️ Fleet-wide password weakness — unresolved.** Six of the seven passwords are keyboard-walk
> patterns drawn from adjacent key clusters, and one is derived from its own username. Two of them
> differ by a single leading character. Buyers *legitimately receive these credentials* — that is the
> product — so a buyer holding one account's password has a very short guess list to reach another's.
> This is a live cross-account vulnerability, not hygiene. Rotate to random per-account strings and
> update `/admin`; lookup reads live from the DB so existing buyers pick up the new value
> automatically. (Values are in the local tracker only — never in this repo.)

> **⚠️ `.maFile`s are stored unencrypted.** `manifest.json` reports `"encrypted": false` — every
> account's `shared_secret` (full Guard code generation for the whole fleet) is plaintext on disk in
> `Desktop\SteamShare\`. SDA supports passphrase encryption. Turn it on.

### Family lockdown — child-account model (revised 2026-08-26)

**Superseded the 2026-08-25 "never join a Steam Family" stance.** Chaison found the working
configuration: the selling accounts join the family as **child** members, not adults, with `guisio78`
as the adult/parent. The parent then sets parental controls + PIN on each child, and Chaison confirms
**all of them now require a PIN to access the account**.

**What this fixes versus the 2026-08-25 failure:** that test used *his personal account* as the
family adult, which pooled his real library and left a Valve-visible link between his real identity
and payment history and a selling account. `guisio78` is a burner created for exactly this role — no
personal library, no real identity, nothing to pool. That specific failure does not recur.

**Structure**

| Role | Account |
|---|---|
| Adult / parent (holds the PIN) | `guisio78` |
| Children (selling accounts) | `gscal1`, `dubust22`, `ss_schedule11`, `ssp266`, `ghjjK458`, `Fishy790` |

#### Open before this is relied on

1. **The member cap doesn't fit. Steam Families are capped at 6 members total.** One adult plus six
   children is **seven**. One of the six selling accounts cannot join, so either an account stays
   standalone or a second family is needed. Confirm the real cap in the client before assigning
   slots — this is arithmetic, not a judgement call, and it bites at the sixth account.
2. **Does a buyer need the PIN to play their own game?** The PIN cannot be both the buyer's key and
   the lock against the buyer. The model only works if a whitelisted game **launches without the
   PIN** while everything else stays gated. If buyers need the PIN, handing it over unlocks whatever
   that child can reach — and if they don't need it, confirm what happens when they hit a locked area.
3. **Does library pooling still expose the other five games?** Family libraries pool by design. The
   fix, if it holds, is per-child game whitelisting — each child restricted to its own title. Verify
   directly: sign into one child account and check whether the other five games are visible *and*
   whether they are launchable. Visible-but-blocked is acceptable; launchable is not, because it
   collapses per-title pricing exactly as it did on 2026-08-25.
4. **1-year slot cooldown.** An account that leaves a family cannot join another for a year. Get the
   slot assignments right the first time — this is not cheap to re-arrange.
5. **PINs are recorded for one account only.** `gscal1`'s is in the local tracker; the other six need
   theirs recorded there too, at the time they are set.

A 4-digit PIN with a public brute-forcer is still friction rather than a lock. The durable control
remains owning each account's email via the catch-all.

`docs/family-view-lockdown.md` is stale against this and needs rewriting once items 1-3 are answered.

---

## Roadmap — Shopee automation (scoped 2026-08-26; **A and B SHIPPED 2026-09-05**)

> **Current state:** A (chat auto-delivery) and B (order sync) are **built, deployed and proven on
> a real order**. C (refund handling) and D (account overload reassignment) remain unbuilt. The
> historical analysis below is kept because the reasoning still governs how these behave — but read
> "Automated Shopee fulfilment" near the top of this file for what is actually running today.

**Status change 2026-08-29 (second revision, same day):** the earlier "blocked indefinitely" reading was
wrong — see open item 4. Malaysia's published criteria admit a **Registered Business Seller with zero
sales**, and the **Seller In-house System** app type carries *All API including Chat API*. So parts A and
B are **buildable once the shop's KYC is migrated to Registered Business** (3-working-day SLA on the
application). Part C still needs no API and is buildable now.

**Target architecture once API access lands — fully automated, zero manual steps:**
```
Buyer pays → Shopee Push Mechanism webhook → our API receives order_sn + item
  → match item → game → allocate account_game → insert verified orders row
  → Chat API auto-messages buyer the gameshare.space link
Buyer pastes order id (their app has a COPY button) → credentials + live Guard code
```
Two facts confirmed 2026-08-29 that make this sound: the **Order ID is the same string buyer-side and
seller-side** (Shopee's own docs use "Order ID / Order SN" interchangeably and tell buyers to quote it to
sellers), and the **order export includes Buyer Username** — a genuine second factor, since the buyer
knows their own username but it is not visible in a screenshot of the order.

**Ruled out 2026-08-29 — Shopee has no code-pool auto-delivery, in any market.** "Virtual Goods" is a
*shipping channel*, not a fulfilment engine. Shopee SG states it outright: *"Shopee does not track the
real-time fulfillment of digital products and services."* Delivery is 100% seller-side via email / phone /
Shopee Chat. Any design assuming Shopee dispenses a code per order is invalid.

**Sequencing caution:** none of this matters if the listing category is prohibited — see open item 4c.
Resolve that first.

### A. Auto-reply bot in Shopee chat — ✅ **BUILT AND LIVE (2026-09-05)**
Both open questions below are now answered, and both answers went the opposite way to the guess:

1. **Shopee DOES expose a send-message API.** `/api/v2/sellerchat/send_message`, confirmed by
   probing the live API — a nonexistent path answers `error_not_found`, and this one answered
   `invalid_to_id`, i.e. it complained about request *content*, which only happens if the route
   exists and the partner holds the chat scope. Body is
   `{ to_id, message_type: "text", content: { text } }`; a flat `content` string is rejected.
   The recipient is the buyer's `buyer_user_id` from `get_order_detail`, so there is no
   conversation lookup at all.
2. **The password IS sent through Shopee chat** — Chaison reversed this on 2026-09-05. The
   reasoning against it (below) still stands and is recorded at `buildDeliveryMessage`; the live
   consequence to remember is that a password rotation invalidates every message already sent.

*Original pre-build analysis, kept for the reasoning:*

1. **Does Shopee Open Platform actually expose a chat/message send API?** *Unverified.* Existing
   research (`Personal Assistant/research/2026-08-19-shopee-open-api-integration.md`) covered the
   Order API, OAuth + HMAC-SHA256 signing and PII masking — **not** messaging. If no send-message API
   exists, the fallback is Seller Centre's built-in auto-reply, which is template-only and cannot
   inject a per-order value, making it useless for this. Browser automation is the other fallback and
   is both ToS-violating and fragile. **Verify before scoping any build.**
2. **Do not send the password through Shopee chat.** Send order id + username + the
   `gameshare.space` link only; the buyer gets the password *and* the rotating Guard code from the
   site, as today. Three reasons:
   - Shopee chat is a permanent record on Shopee's own servers. For a listing category that is
     *already* under review, writing Steam credentials into Shopee's logs is self-created evidence.
   - Passwords rotate (see C). A chat message with a stale password becomes a support ticket; the
     site always serves current state.
   - The buyer must visit the site for the Guard code anyway, so chat-delivering the password saves
     them nothing and costs us the control point.

### B. Order sync — ✅ **BUILT AND LIVE (2026-09-05)**
All three notes below were followed exactly: the webhook verifies Shopee's own HMAC (with the
separate **push** key, not `x-api-secret` and not the API key), `/api/webhooks/shopee` is
allowlisted in `proxy.ts`, and verification keys on `order_sn` + payment status. Payment is only
believed when BOTH a recognised paid status AND a `pay_time` are present.

*Original design notes:*
Shopee push/webhook on order status → upsert `orders` row (`verified = true` on payment). Notes:
- Webhook auth is **Shopee's HMAC signature over the raw request body** — a different mechanism from
  our `x-api-secret`. Do not reuse the existing `authorized()` helper for it.
- The webhook path must be allowlisted public in `proxy.ts`.
- Keys on `order_sn` + payment status (buyer PII is masked), which the current form already matches.

### C. Refund handling — **buildable now, does not need Shopee approval**
Intended: on refund, auto-delete the refunded order id from the database. Two corrections:

1. **Soft-delete, don't hard-delete.** Set `verified = false` and add a `refunded_at` column. A hard
   delete destroys the audit trail — `code_access_log.order_id` is `on delete set null`, so deleting
   the order orphans every record of who pulled codes against it, exactly when a dispute needs it.
   The `unique (shopee_order_id, shopee_buyer_id)` constraint also means a re-purchase would silently
   lose the refund history. Flipping `verified` is sufficient: `verifyShopeeOrder()` already gates on
   it, so the lookup 404s immediately with no code change.
2. **Revoking lookup access does not take the password back — this is the real gap.** A refunder
   already holds username + password. Killing their lookup only stops them obtaining *new* Guard
   codes; if they are already signed in on their own machine, Steam does not force re-auth, so they
   keep playing free indefinitely. The actual remedy is to **rotate that Steam account's password on
   refund**, which cuts the session and invalidates what they hold.
   **The useful property:** lookup reads the password live from the DB, so once the new password is
   saved in `/admin`, every other legitimate buyer on that shared account picks it up automatically
   on their next lookup. No re-messaging, no support burden. Rotation is cheap here by design.
   Caveat: rotating does disrupt every current buyer's active session at once — which is the intended
   effect, but should be a deliberate action, not a silent automatic one. Recommended shape: refund
   auto-flips `verified = false`, then **flags the account for password rotation** for a human to
   action, rather than rotating unattended.

### D. Account overload reassignment — **captured 2026-09-03, not built. Design only.**
Chaison's spec, recorded verbatim in intent: a buyer can't log in because the account is overloaded
(too many concurrent buyers on one Steam account). Buyer messages admin via Shopee chat with their
Order ID (the tutorial's new Scenario 4 already tells buyers to do exactly this — see
`app/tutorial/page.tsx`). Admin then **reassigns that order to a different Steam account holding the
same game**, so the buyer gets new login details but keeps the same Order ID. Near-term tracking is a
**Google Sheet** (order_id → currently-assigned username) as the manual admin bridge before this gets
proper in-app tooling — "we are adding this new code" afterwards, per Chaison.

**What this actually needs, technically — the core shift is that one order needs to be able to point
at more than one account over its lifetime, not just once at creation:**

1. **Reassignment itself needs no schema change today.** `orders.account_game_id` is already a plain
   FK — an admin could UPDATE it to point at a different `account_games` row (same game, different
   `steam_account`) right now via a direct DB edit. The gap is there's no admin-panel action or API
   route to do this deliberately (`/api/admin/orders` has POST and DELETE, no PATCH/reassign).
2. **No history is kept.** Today the row only ever shows the *current* account_game_id — if an order
   gets reassigned, there's no record of which account(s) served that order before now. That matters
   for disputes ("I never got a working login") and for spotting a genuinely bad-condition account
   (repeatedly reassigned = probably actually broken, not just "overloaded"). Needs something like an
   `order_reassignments` table (order_id, from_account_game_id, to_account_game_id, reason, at) rather
   than just overwriting the FK silently.
3. **"Overloaded" isn't a defined signal anywhere yet.** There's no concurrent-login count, no
   capacity limit per account, nothing that would let this be detected automatically instead of a
   buyer reporting it manually. Whether that's worth building depends on how often this actually
   happens once real order volume exists — don't build detection before there's evidence it's needed.
4. **The Google Sheet is explicitly the interim step, not the destination.** Treat it the same way the
   local `ACCOUNT-TRACKER.md`/`fleet.json` vault was treated before `scripts/seed-fleet.mjs` existed —
   useful now, but the plan is to fold this into the admin panel + `order_reassignments` table once the
   pattern is proven out manually.

**Sequencing:** this is independent of the Shopee API work (items 4/4b/4c) — reassignment is pure
Steamshare-side backend work, doesn't touch Shopee at all. Could be built any time; not started.

---

## Roadmap — own storefront + Stripe (goal stated 2026-08-25, deliberately deferred)

Chaison wants to move off Shopee eventually and build a direct storefront on the Stripe API. **Explicitly
sequenced for after Shopee is done** (2026-08-25) — not a parallel track, not next up. "Done" here reads
as: open item 2 resolved (the Shopee listing status blocker — see below) and the Shopee-based business
actually running/stable, not just "current session's work wrapped." Do not start build work on this before
that point without Chaison reopening it.

Before any build time goes into this (whenever it's picked back up), dispatched research already came
back with a clear caution — full writeup:
`research/2026-08-25-stripe-risk-steam-account-resale-payment-processor.md`.

**Verdict: connecting directly to Stripe is not a safe near-term move.** Two separate matches against
Stripe's own restricted-business list (`stripe.com/en-my/legal/restricted-businesses`, quoted
verbatim in the research file): (1) "no-value-added services... resale of a service without added
benefit to the buyer," and (2) products/services that facilitate infringement of third-party
proprietary rights — which independently catches the already-accepted Steam Subscriber Agreement
risk (`decisions/log.md`, 2026-08-19). Stripe's own support FAQ on restricted-list businesses: "it is
unlikely we will be able to accept payments for you." Malaysia is NOT the blocker — Stripe fully
supports MY-domiciled accounts; this is a category-risk problem, not a geography problem.

**If rejected/terminated, typical consequence is a 90–180 day hold on collected funds** — worse than
the current Shopee delist-only ambiguity, because that's money already in hand getting frozen, not
just a sales channel closing.

**Alternatives checked on actual policy, not marketing copy:**
- Xsolla (gaming-specific Merchant of Record) — explicitly personal-use-only, would likely reject
- Paddle — same underlying card-network rules as Stripe; MoR status isn't an exemption
- **PaymentCloud / Durango Merchant Services** (high-risk merchant account providers, explicitly serve
  digital-downloads/streaming/gaming verticals) — the realistic paid-card path, at the cost of higher
  fees and standing reserves as the normal price of entry, not something to shop around
- Crypto processors (e.g. NOWPayments) — no chargebacks, but doesn't touch the underlying Steam ToS
  issue and is a hard sell for Malaysian buyers used to card/FPX

**Open decision, not yet made:** stay on Shopee, pursue a high-risk merchant account provider instead
of Stripe directly, or accept the Stripe rejection/freeze risk anyway. Needs Chaison's call before any
storefront build work starts.

---

## Expansion strategy (agreed 2026-08-25)

**The lever is buyers-per-account, not account count.** Unit economics: ~RM130–145 per account, of
which ~RM100+ is the game; infrastructure is ~RM5.

**Pricing set 2026-08-25 at RM2–9/sale**, matching real market rate (see
`research/2026-08-25-steamshare-competitor-market-pricing.md` — competitor sample runs RM0.19–9.99,
clustering RM2–8) rather than the earlier RM20 placeholder. Correcting the table below to the real
range changes the math materially:

| Strategy | Accounts | Sales | Cost | Revenue @ RM2 | Revenue @ RM5 | Revenue @ RM9 |
|---|---|---|---|---|---|---|
| Breadth — many accounts, few buyers | 30 | 90 | ~RM3,900 | RM180 (loss) | RM450 (loss) | RM810 (loss) |
| **Depth — few accounts, many buyers** | **10** | **200** | **~RM1,300** | RM400 (loss) | RM1,000 (loss) | **RM1,800 (+RM500)** |

Breadth loses money across the entire RM2–9 range — no longer a viable comparison. Depth only turns
a profit at 200 sales/10 accounts if priced in the **top third of the range (~RM7–9)**. At the low
end (~RM2, where Cyber Space's flagship titles sell thousands of units), breakeven at RM1,300 cost
needs **~65 buyers/account (650 total)**, not 20 — which pushes directly against unverified
assumption #1 below (does unlimited concurrent access per account actually hold at that volume?).
**Open pricing decision:** hold RM7–9 to make the 20-buyers/account plan work as-is, or price low
to match the commoditized market and lean harder on volume — not yet decided which.

Buyers-per-account has no Steam-imposed ceiling. Steam **Family** membership is capped at 6 — a
different thing entirely, and not the model in use.

### Hard ceilings on account creation
| Constraint | Limit |
|---|---|
| Steam fraud detection | 1–3 accounts/week |
| MCMC prepaid SIM cap (Malaysia, Feb 2026) | 5 lines per telco ≈ 20–25 numbers on one NRIC |
| Accounts per phone number | ~5 (Steam may treat shared-number accounts as one identity) |
| Per-account setup | 30–45 min, manual — **no bulk method exists** |

Scripted account creation is explicitly rejected: it's what fraud detection is built to catch, and
it fails as a linked ban wave across the whole fleet.

### Email at scale — solved
Custom domain + **Cloudflare Email Routing catch-all** (~RM60/yr, forwarding free, ~30 min setup).
Unlimited addresses at zero marginal cost, consumes **no phone numbers** — decisive, since phone
numbers are the scarce resource. Use non-sequential word-based local parts. Lock the destination
inbox down hard: it's the single point of failure for every account's password reset.

**Alternative, parked 2026-09-05 — Zoho Mail per-account mailboxes.** Fixes the one weakness
above (that shared destination inbox), at ~$1/mailbox/mo instead of free. Not built, nothing depends
on it. Full setup + the trade-off table + the plan-gating unknown: `docs/zoho-mailbox-provisioning.md`.
Re-open it only if the single destination inbox becomes an unacceptable blast radius.

---

## Unverified assumptions the model rests on

These are **not** settled. Test before scaling.

1. **Offline mode allows concurrent play by multiple buyers.** Chaison reports buyers play offline,
   making concurrency a non-issue. Research could not verify multi-user simultaneous play on one
   account, or how long before Steam forces re-authentication. If wrong, buyers-per-account has a
   much lower ceiling and the expansion math above changes.
2. ~~**Account lockdown via a "parent" account.**~~ **Reopened and revised 2026-08-26 — the
   child-account variant is the current stance.** History: on 2026-08-25 Chaison tested this with his
   *personal* account as the family adult and hit real, non-misconfigured behaviour — Steam Families
   pool libraries, so his whole personal library flowed in, and it left a Valve-visible link between
   his real identity and a selling account. That killed the personal-parent version. On 2026-08-26 he
   found the working shape instead: selling accounts join as **child** members under `guisio78`, a
   burner adult with no personal library, and the parent's parental-control PIN gates access on every
   child. The earlier "never join a Steam Family, use Family View standalone" verdict is superseded.
   **Still unverified and load-bearing** (see the Family lockdown section above): the 6-member cap
   makes 1 adult + 6 children impossible; whether a buyer can launch their own game *without* the
   PIN; and whether per-child whitelisting actually stops the other titles being launchable, since
   pooling is what a family does. Answer those three before scaling on this.
   Remaining soft spot regardless: a buyer holding the password can pull a Guard code from our own
   site, so password change is the weakest link.
3. ~~**Steam Desktop Authenticator still links new accounts.**~~ **Confirmed working 2026-08-25** —
   `dubust22` linked successfully and produced a valid `shared_secret`. SDA remains unmaintained
   (last release Oct 2023), so this could break on any Valve change; keep `dyc3/steamguard-cli` as
   the fallback and re-check on each new account rather than assuming.

### Ruled out — do not revisit
- **Regional/currency arbitrage** (buying games in cheaper countries). Requires falsifying
  payment-issuance country and billing address; explicitly prohibited by the Subscriber Agreement,
  rated Very High enforcement risk at commercial scale, and thin-to-negative margin for Malaysia.
  Raised repeatedly; the answer has not changed. `research/2026-08-19-steam-regional-pricing-currency-arbitrage.md`
- ~~**Family View as account protection.**~~ **Superseded 2026-08-26 — see the Family lockdown
  section and assumption 2.** The original verdict ("doesn't block password/email/Guard changes") was
  already wrong; the follow-up stance ("use it standalone, never join a Steam Family") is now also
  superseded by the child-account model. What still stands: the PIN is 4 digits with a public
  brute-forcer, so it is friction rather than a lock. Still-valid supporting controls: never save a
  payment method, keep wallet at zero, withhold `identity_secret` (already the case — only
  `shared_secret` is stored), monitor the account email for Steam security notices.
  `docs/family-view-lockdown.md` is stale on all of this and needs rewriting.
- ~~**Steam Families as the sharing mechanism.**~~ **Partially superseded 2026-08-26.** Ruled out as a
  way to deliver games *to buyers* — 6-member cap, each buyer would need their own account, an
  undocumented "same household" check, a 1-year slot cooldown, and enforced one-borrower-at-a-time
  concurrency. All of that still holds. What changed is that a family is now used for the opposite
  purpose: **locking our own accounts down** as children under a burner adult, with no buyer ever
  joining it. The 6-member cap and 1-year cooldown carry over to that use and constrain it directly.

---

## Accepted risks (settled — not open questions)
- Retaining a Guard authenticator to serve non-owning buyers very likely violates the Steam
  Subscriber Agreement. Conscious decision, 2026-08-19 (`decisions/log.md`).
- Shopee's prohibited-items policy does not confirm this listing category is allowed. Chaison has
  chosen to proceed regardless — but see open item 2, which is a *factual* question still worth
  answering.
