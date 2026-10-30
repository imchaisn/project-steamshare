# Order Fulfillment SOP (Local-Verification Mode)

Steamshare doesn't have live Shopee API integration yet (`lib/shopee.ts` is in local-verification mode — see README "Known Risks #4"). Every sale needs a manual link before the buyer's first lookup will work. This is that procedure.

## Per-sale checklist

1. **Check Shopee Seller Center → Orders** for new paid orders on a Steamshare listing.
2. **Note the Order ID and Buyer ID** from the order details.
3. **Confirm inventory exists** for the game sold:
   - `/admin` → Steam Accounts: is there an account with that game already linked (Games section + the account/game link)?
   - If not, onboard the account first (Add Account form — encrypts password + Guard secret automatically) and link it to the game.
4. **Create the order link**: `/admin` → Orders tab → enter Shopee Order ID + Buyer ID, select the linked account/game, leave "verified" checked, submit.
5. **Buyer can now look up their code** at the public lookup page using the same Order ID + Buyer ID they used at checkout.

## The two post-delivery messages — what each one is for

A delivered order now produces **two** automated chat messages after the credentials, on purpose,
and they split the ask between them. Do not merge them and do not move an ask across them.

| # | When | Function | Asks for | Kill switch |
|---|---|---|---|---|
| 1 | **Immediately**, in the same webhook request | `buildReceiptNudgeMessage()` (`lib/fulfillment.ts`) | **"Order Received" + ⭐⭐⭐⭐⭐** | `SHOPEE_RECEIPT_NUDGE` — **defaults ON** |
| 2 | **~24 h later**, nightly cron | `buildFollowUpMessage()` (`lib/follow-up.ts`) | **"Order Received" + ⭐⭐⭐⭐⭐** — the SAME two asks | `SHOPEE_FOLLOW_UP` — defaults off |

## 🔴 THESE TWO MUST NOT BOTH BE ON — read before deploying

**Chaison's call, 2026-09-08, made after seeing both templates rendered side by side: the button
and the stars go out together, immediately, in ONE message.** That is message 1's job now.

**Message 2 asks for exactly the same two things.** With both live, a single buyer receives the
identical star request twice, a day apart. So shipping message 1 is a **two-step deploy**:

```
# 1. deploy the code (auto-deploys on push to master), then:
vercel env rm SHOPEE_FOLLOW_UP production --yes
printf false | vercel env add SHOPEE_FOLLOW_UP production
vercel redeploy <current production url> --scope imchaison-s-projects
```

⚠️ **The redeploy is not optional.** Vercel bakes env vars into a deployment, so changing the
value alone leaves the running deployment still sending message 2 while the dashboard shows the
new value — the same trap documented for `SHOPEE_AUTO_FULFILL` in `CHECKPOINT.md`.

Confirm it took: `curl -H "x-api-secret: $API_SECRET" ".../api/cron/follow-up?limit=1"` must
report `"enabled": false`.

**Nothing in the code can enforce this.** No process here can read another deployment's env, so
there is no assertion to write and no test that fails. It is a checklist item. If it is missed
the cost is a duplicate "please rate us" — annoying, not harmful, and reversible by flipping the
switch.

**Neither message may ever carry a voucher, discount or gift** — see
`docs/promotions-and-bundles.md` § 6a. This binds harder now that message 1 carries the star ask:
a voucher in that text is money offered in the same breath as a rating request. Tests in
`lib/fulfillment.test.ts` and `lib/follow-up.test.ts` fail the build if one appears.

## Message 1 — the receipt nudge (automated, 2026-09-08)

Sent **in the same webhook request** as the delivery message(s), immediately after the last one.
`{orderSn}` is the Shopee order id.

```
[GameShare]
Order ID: {orderSn}

✅ Everything for this order has been sent above.

Once you've logged in and the game is working, please tap
"Order Received" in Shopee and leave us a ⭐⭐⭐⭐⭐ 5-star
rating. It really helps us out 🙏

Setelah log masuk dan game berfungsi, sila tekan
"Pesanan Diterima" dan beri rating ⭐⭐⭐⭐⭐ 🙏

🪙 Shopee itself gives up to 5 Shopee Coins for any review
with 50+ characters, a photo AND a video. In the photo, show
the game running — never your login details.

🪙 Shopee sendiri beri sehingga 5 Syiling Shopee untuk
sebarang ulasan 50+ aksara bersama gambar DAN video.
Dalam gambar, tunjuk game sedang dimainkan — jangan
tunjuk maklumat log masuk.

⚠️ Any issue — message us here first, we'll sort it out.
   https://www.gameshare.space/tutorial#step-7
```

**Why it is worded this way — do not "tidy" these out:**

- **"Once you've logged in and the game is working" is load-bearing, and now doubly so.** Pressing
  Order Received releases escrow and closes the buyer's dispute window. Asking for it — and for
  five stars — unconditionally, seconds after handing over credentials they have not used, invites
  a buyer to give up their protection and rate a game they have not opened. That condition is the
  only thing standing between this message and a rating request aimed at someone who has not yet
  logged in. A test pins the line in both languages.
- **"Message us here first" carries more weight than it used to.** With the star ask now landing
  immediately, this is the line that routes a broken login into chat rather than into the 1-star
  review the same message just invited.
- **It is sent ONCE per order, not once per game.** A multi-game order gets one delivery message
  per game; repeating this ask four times would read as a malfunction.
- **No credential.** The delivery message immediately above it in the same thread already carries
  the username and password.
- **The 🪙 Shopee Coins paragraphs (Chaison, 2026-09-14).** Review coins are paid by Shopee, not the
  shop — there is no top-up to do. The paragraphs name Shopee as the payer, say *any* review, carry
  no star, and state the full 5-coin criteria (50+ characters AND a photo AND a video —
  `help.shopee.com.my` article 78479, read 2026-09-14). Keep all four: a coin line that reads as
  "5 stars → coins", or one promising coins for a text-only review, is exactly what to avoid. Keep
  the login-details warning too — a review photo is public, and the obvious screenshot is this
  chat, which holds a shared account's password. Tests pin all of it. Never swap in seller-funded
  coins (Seller Coins / Shop Prize): that is the shop paying for a review.

### How the automated send works

```
webhook → fulfillOrder → deliverOrderGames (one message per game, sequential)
  → returns HOW MANY messages it just sent
  → if that count > 0 AND SHOPEE_RECEIPT_NUDGE !== "false"  → send the nudge, once
```

**There is no database latch and no migration**, deliberately. The count is "sent just now", and
the per-game sends are themselves latched on `order_games.delivered_at` — so a Shopee retry
delivers nothing, returns 0, and the nudge is skipped. The delivery latch does double duty.

**What that costs:** if the serverless instance dies between the last delivery message and the
nudge, that order's nudge is lost for good — there is no retry list. Accepted, because the 24 h
follow-up makes the same request on its own latch, so a lost nudge costs the buyer nothing. The
alternative was an `orders.receipt_nudge_sent_at` column, and with the DB password stale that is a
migration only Chaison can apply by hand — it would have left the feature dark until he did.

**This switch defaults ON, unlike the other two**, which is the only inversion in that file:
`SHOPEE_AUTO_FULFILL` and `SHOPEE_AUTO_SHIP` guard actions with a blast radius, whereas the worst
case here is one redundant sentence in a chat thread. Set `SHOPEE_RECEIPT_NUDGE=false` to disable
— and **that flip needs a redeploy**, same Vercel env-baking trap as the others.

## Message 2 — the post-delivery follow-up (automated, 2026-09-05)

Sent **automatically** by the nightly cron (`/api/cron/follow-up`, 04:00 UTC = 12:00 MYT) to every
order delivered at least **24 hours ago** — not in the same breath as the credentials. Asking for 5
stars before the buyer has logged in once is how you collect a rating for a login they haven't tried
yet. `{orderSn}` is the Shopee order id.

```
[GameShare]
Order ID: {orderSn}

✅ All delivered — enjoy the game!

If it's working, please tap "Order Received" in Shopee and leave us
a ⭐⭐⭐⭐⭐ 5-star rating. It really helps us out 🙏

Kalau OK, tolong tekan "Pesanan Diterima" dan beri rating ⭐⭐⭐⭐⭐.

⚠️ Any issue — message us here first, we'll sort it out.
   https://www.gameshare.space/tutorial#step-7
```

**Why it is worded this way — do not "tidy" these out:**

- **Nothing is offered in exchange for the rating.** Asking for a rating is fine on Shopee;
  offering a discount, a free game or a refund *for* 5 stars is an incentivised review and can get
  the listing actioned. The template asks and offers nothing. Keep it that way.
- **"Message us here first" is load-bearing.** It routes a broken login into chat instead of into a
  1-star review, which is the entire commercial point of sending this message at all.
- **The BM line is not decoration.** A material share of buyers read it first — same reasoning as
  the bilingual warning in `buildDeliveryMessage()`.
- **The 30-day contact window** (a shop may only message a buyer within 30 days of their order) is
  no constraint at 24 hours. A follow-up on a month-old order will fail `user_is_forbidden`.

### How the automated send works

```
delivered_at set by the webhook
  → nightly cron GETs /api/cron/follow-up (Vercel cron, Authorization: Bearer $CRON_SECRET)
  → orders where source='shopee_push' AND follow_up_sent_at is null
      AND delivered_at between (now-25d) and (now-24h) AND follow_up_attempts < 3
  → claim follow_up_sent_at  → get_order_detail for buyer_user_id → chat send
  → keep the latch on success or an ambiguous failure; release it on a proven one
```

Code: `lib/follow-up.ts` (message + sweep), `app/api/cron/follow-up/route.ts` (auth + kill switch),
`vercel.json` (the schedule), migration `0009_orders_follow_up.sql` (the columns).

| Knob | Value |
|---|---|
| Kill switch | `SHOPEE_FOLLOW_UP` — sends nothing unless exactly `true`. **Flipping it needs a redeploy**, same Vercel env-baking trap as `SHOPEE_AUTO_FULFILL` |
| Cron auth | `CRON_SECRET` in Vercel. While unset the route answers **503** rather than running unauthenticated |
| Manual run | `curl -H "x-api-secret: $API_SECRET" "https://www.gameshare.space/api/cron/follow-up?limit=1"` — `limit` exists so a first live run is one order, not twenty-five |
| Schedule | `0 4 * * *` UTC. Vercel Hobby allows one run per day and fires it within the hour |

**Ops notes.**

- The reply body is the run summary (`scanned` / `sent` / `failed` / `skipped` + a line per order).
  `enabled: false` means the kill switch is off in the *running deployment* — that is how you
  confirm a flip actually took effect.
- Per-order failures land in `orders.follow_up_error`. An **ambiguous** send (timeout, HTTP 5xx)
  deliberately keeps the latch and never auto-resends: a duplicate "please rate us" is worse than a
  missing one. Clear `follow_up_sent_at` by hand if you decide otherwise.
- Orders delivered more than 25 days ago are never followed up — Shopee's 30-day contact window
  makes the send fail `user_is_forbidden` anyway.
- Manual (`source = 'manual'`) orders are skipped entirely. The admin who created that row owns
  communication with that buyer; use the copy above by hand if you want to ask them.

## Test order IDs — naming convention (standing rule, 2026-08-26)

Every account gets a **test order** seeded alongside it, so the account can be verified end-to-end
against production before it is ever sold. The order id is derived from the username so it is
guessable-by-us and never collides:

> **First 3 letters of the username + `123`.**

Letters only — skip digits, underscores and other punctuation when counting the three.

| Username | Test order id |
|---|---|
| `gscal1` | `gsc123` |
| `dubust22` | `dub123` |
| `ss_schedule11` | `sss123` (underscore skipped) |
| `ssp266` | `ssp123` |
| `ghjjK458` | `ghj123` |
| `Fishy790` | `fis123` |

Seed these with `scripts/seed-fleet.mjs`, which reads the local (never-committed) fleet file and
takes the Guard `shared_secret` from the SDA `.maFile`. It is idempotent — safe to re-run.

**Verification after seeding** — a build check is not enough, do all three against production:
1. Lookup returns a code for each test order id + its username.
2. The returned password matches the tracker (proves the encrypt/decrypt round-trip and that the
   right `ACCOUNTS_ENCRYPTION_KEY` was used — this has silently broken before).
3. Two lookups ~35s apart return **different** codes (proves live TOTP, not a cached value).

> **One order id must map to exactly one row.** `verifyShopeeOrder()` queries on `shopee_order_id`
> alone with `.maybeSingle()`, which **errors** when two rows share an order id — so a duplicate
> makes the lookup 404 for *everyone* on that id, not just the newer buyer. This actually happened on
> 2026-08-26 (`ssp123` existed twice with different `shopee_buyer_id`s; the older row was renamed to
> `ssp123-legacy` to resolve it). The table's unique constraint is on
> `(shopee_order_id, shopee_buyer_id)`, which does **not** prevent this. See the known-gaps section.

## When something goes wrong

| Symptom | Check |
|---|---|
| Buyer says lookup fails | `/admin` → Orders tab — does the order exist, is it marked verified, is it linked to the right account/game? |
| Buyer says login/code doesn't work | `/admin` → Steam Accounts — is that account's status still `active`? If banned/recovering, the lookup API already returns "temporarily unavailable, contact support" instead of a code |
| Suspicious repeat lookups on one order | `/admin` → Code Access Log — filter by order, check IP/frequency |
| Account gets banned | Mark it `recovering` or `banned` in the Steam Accounts status dropdown immediately so buyers get the "unavailable" message instead of a dead code. There's currently no automated buyer notification — that's a manual message you'd need to send (via Shopee chat) to affected buyers until this is automated |

## Not yet handled (known gaps)

- No live Shopee order verification — this whole doc exists *because* of that gap. Closing it (Shopee Open API integration) removes step 2-4 entirely.
- No rate-limiting on the lookup endpoint.
- No automated ban detection — you find out when a buyer complains or you happen to check.
