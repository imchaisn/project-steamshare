# Project Steamshare — Checkpoint

*Living status file — current state only, not a history log. Dated history lives in
`PROJECT-LOG.md` (Personal Assistant workspace). Operational docs: `docs/order-fulfillment-sop.md`,
`docs/steam-account-onboarding-runbook.md`, `docs/family-view-lockdown.md`, `docs/policies.md`.*

**Last updated:** 2026-09-05

---

## Status: LIVE, and Shopee orders now fulfil themselves

Two things are true as of 2026-09-05:

1. `gameshare.space` still serves rotating Steam Guard codes to buyer lookups, unchanged.
2. **A paid Shopee order now becomes an `orders` row and a delivered chat message with no
   human involvement.** Proven end-to-end on a real order the same day
   (a live Euro Truck Simulator 2 order, allocated to `dubust22`, delivered 07:24:12Z).

See "Automated Shopee fulfilment" below for how it works and how to turn it off.

### Buyer lookup — unchanged, still the thing that entitles a buyer to their code

```
POST https://www.gameshare.space/api/lookup
{"orderId":"T123","username":"ssp266"}
→ 200 {"username":"ssp266","password":"<redacted>","code":"<5-char Guard code>"}
```

Verified on production: codes rotate between requests (live TOTP, not cached), wrong username
returns the same generic 404 as a bad order id (can't be used to probe usernames), username match
is case-insensitive, `/terms` 200s, admin gate redirects to login, favicon serves.

### What's built
| Piece | State |
|---|---|
| Buyer lookup (order id + Steam username) | Live. Copy-to-clipboard modal — button reads **Copy** → **Copied!** before dismissing |
| Admin panel | Accounts, games, account↔game linking, Orders tab, status control (active/banned/recovering), recovery-email fields, code access log |
| Encryption | AES-256-GCM at rest for password + Guard `shared_secret`; decrypt only server-side |
| Rate limiting | **Live and verified.** Per-order 20 weighted/15min (primary), per-IP 300 weighted/15min (backstop), failed attempts weighted 3×. Fails open on DB error |
| Public `/terms` | Live, linked from lookup footer. Support = Shopee chat |
| Branding | GameShare "Loop Controller" logo (site + favicon + `brand/` exports), violet/magenta theme |
| Database | Supabase, migrations 0001–0008 **all applied** (0005–0008 landed 2026-09-05). **0009 written, NOT applied** — follow-up columns. 9 tables live |
| Deploy | Auto-deploys on every push to `master`. Repo public (required for Vercel Hobby git deploys) |
| **Shopee auto-fulfilment** | **LIVE.** Push webhook → order detail → listing mapping → account allocation → `orders` row → Shopee chat message. Kill switch `SHOPEE_AUTO_FULFILL` |
| Shopee Open API | Live app, partner id `2043838`, category *Seller In House System*. Shop authorized, token stored AES-encrypted in `shopee_auth`, auto-refreshes |
| Shopee Seller Chat | Working. `/api/v2/sellerchat/send_message`, addressed by `buyer_user_id` from the order detail |
| **Post-delivery follow-up** | **Code shipped, OFF.** Nightly cron asks the buyer to press Order Received + rate. Needs migration 0009 + `CRON_SECRET` + `SHOPEE_FOLLOW_UP=true` |

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
| 26995584552 | — | *"Demo product as for approval" — deliberately unmapped* |

Four games have active accounts but **no Shopee listing at all**: Dokimon, Schedule I, How to Fish,
and (until 2026-09-05) Euro Truck Simulator 2. That is idle inventory.

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

**It cannot send anything yet.** Two Chaison-only steps, in this order:

1. **Apply migration 0009** (`orders.follow_up_sent_at` / `follow_up_error` / `follow_up_attempts`
   + a partial index). It aborts on a DB without 0008. Until then the sweep answers with a summary
   naming the migration rather than failing obscurely.
2. **Set `CRON_SECRET` (any long random string) and `SHOPEE_FOLLOW_UP=true` in Vercel production,
   then redeploy** — env vars are baked into a deployment, the same trap as `SHOPEE_AUTO_FULFILL`.
   While `CRON_SECRET` is unset the route answers 503 instead of running unauthenticated.

Then verify before trusting it, on a real delivered order older than 24h:
`curl -H "x-api-secret: $API_SECRET" ".../api/cron/follow-up?limit=1"` → expect `sent: 1`, then read
the thread in Seller Chat. `enabled: false` in that reply means the flip has not reached the running
deployment. **No `FACT-V` for the send path yet — it has never run against production.**

The pipeline is deliberately **not** wired into the webhook: the delivery path is the money path, so
the follow-up shares no code with it, adds no column to its INSERT, and runs a day later in its own
request where a failure costs nothing a buyer can see.

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
