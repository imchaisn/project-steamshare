# Promotions & Bundles — paste-ready spec

**Written:** 2026-09-07 · **Updated:** 2026-09-08 · **Mode:** `/ss-market growth` ·
**Status:** DESIGNED, NOT CREATED.

**2026-09-08 — the review-growth decision.** Chaison asked for a voucher redeemable **only after
the buyer's first review**. Raised as a penalty risk and **he dropped the gating the same day**.
The two halves were then specced separately: the RM1/RM5 voucher stays a *repeat-purchase* lever
with no review condition (§ 6), and reviews are chased through Shopee's own sanctioned segment
(§ 6a). See § 6a for what the evidence for that risk actually is — it is weaker than "policy
violation" and stronger than nothing, and the recommendation does not depend on it.

**Price policy (Chaison, 2026-09-07):** traction phase targets **RM1.00–RM2.89**. Ceiling for a
later phase is **RM5.99**. Every figure below respects that band and says so where it bites.

Every price, discount and net figure is **computed**, not estimated — reproducible from the fee
model in `research/2026-09-05-shopee-my-seller-economics.md` § "Effective take rate". Nothing here
has been created in Seller Centre or pushed through the Open API. See § 0 first.

---

## 0. ✅ CLEARED 2026-09-08 — this section's HOLD was stale, and it was blocking §§ 3–4

**This section said "⛔ HOLD — do not create any bundle until migration 0014 is applied". That
instruction was correct when written on 2026-09-07 and was already obsolete by the end of that
day. It is recorded as wrong here rather than deleted, so nobody re-derives it.**

`CHECKPOINT.md`, `FACT-V` 2026-09-07: **migration 0014 is APPLIED** (pasted into the Supabase SQL
editor by Chaison) and multi-game orders are **FULLY LIVE** — 21 orders backfilled to 21
`order_games` rows with zero orphans, a four-game test order returning four cards, and Get Code on
two different cards returning two different codes for two different titles. Per-game routing is
real, not cosmetic. `scripts/reconcile-shopee-orders.mjs` now reports a game line for every game
bought.

**So the § 7 gate below is satisfied and bundles are unblocked.** Two conditions from the original
gate still stand on their own merits and are NOT waived:

- Run `scripts/shopee-listings.mjs` and confirm **zero failing lines** before creating a bundle —
  an unmapped item inside a bundle still fails silently, which is a different defect from the one
  0014 fixed.
- Watch the first three bundle orders individually and confirm every game delivers.

<details><summary>Historical: why this was a HOLD, kept for the reasoning</summary>

**A bundle is a multi-game order. Multi-game orders currently short-deliver, silently.**

`CHECKPOINT.md` (2026-09-07): the multi-game code is **deployed but dormant**. `order_games` is
confirmed absent in production (`PGRST205`), so `lib/order-games-compat.ts` degrades every read
and write to **pre-0014 behaviour — one game per order**. Shopee splits a cart by shop, not by
item, so a 3-game bundle arrives as ONE `order_sn` with three `item_list` entries. Pre-0014, the
first item that maps wins and the rest are dropped.

The buyer pays for three games, receives one, the order is marked fulfilled, Shopee auto-ships it
and asks them to rate it. **Nothing anywhere raises its hand** — not the logs, not
`reconcile-shopee-orders.mjs`, not Shopee.

Creating bundles today would manufacture that failure on purpose, on the buyers spending the most,
whose 1-star review then costs the shop rating every other listing ranks on. In a traction phase
that is the most expensive review you can buy.

**The unblock is one step, and only Chaison can do it.** Paste `local/PASTE-THIS-0014.sql` into
the Supabase dashboard → SQL editor → Run. `run-migrations.mjs` cannot: the DB password is stale
on both poolers (re-confirmed 2026-09-07) and no SQL-exec RPC exists. The SQL has already been
executed against a real Postgres engine via pglite — 12/12 checks passed, `FACT-V` 2026-09-07 —
so it cannot fail on syntax, on the dependency guard, or on the backfill.

**Gate, in order:** apply 0014 → `/ss-verify-live` → seed `scripts/seed-bulk-test-order.mjs` and
confirm **all** games return from a real buyer lookup → run `scripts/shopee-listings.mjs`, zero
failing lines (an unmapped item in a bundle fails just as silently) → then create bundles →
afterwards delete `lib/order-games-compat.ts` and its `PRE-0014 FALLBACK` imports.

**§ 5 and § 6 are NOT blocked by this** — single-title discounts and vouchers involve no
multi-game order. Start there.

</details>

---

## 1. The fee that decides everything

Shopee MY charges a **flat RM0.54 Platform Support Fee per ORDER**, plus percentage fees. Against
a RM0.99–1.59 catalogue that flat fee is most of the bill:

| Price | Seller nets | Shopee's effective take |
|---|---|---|
| RM0.99 | RM0.31 | **69%** |
| RM1.29 | RM0.56 | **57%** |
| RM1.59 | RM0.82 | **48%** |
| RM1.99 | RM1.17 | 41% |
| RM2.49 | RM1.60 | 36% |
| RM2.89 | RM1.94 | **33%** |

*(Scenario B — not enrolled in Free Shipping, the likelier model since Virtual Goods is a
non-supported-logistics channel. Scenario A is worse throughout.)*

Two consequences run through everything below:

1. **The flat fee is charged once per order, not per item.** Bundling recovers it.
2. **A price rise would be worth more than it looks** — RM0.99 → RM1.29 is +30% to the buyer but
   +81% to the seller (RM0.31 → RM0.56), because the flat fee barely moves. **Chaison's call
   2026-09-07: prices stay as they are for now.** Recorded as arithmetic, not as a pending
   recommendation. It is why the trios below matter — bundling is the way to recover that flat
   fee without touching a price.

---

## 2. ⚠️ The traction tension — CORRECTED 2026-09-07, the original framing was wrong

**What this section said before, and why it was wrong.** It compared a bundle against *"the same
four titles sold as four separate orders"*, and concluded a bundle earns about +RM0.20 while
costing three orders and three review opportunities.

**That baseline does not exist.** `CHECKPOINT.md`: *"Shopee splits a cart by SHOP, not by item, so
four games bought in one checkout arrive as ONE `order_sn` with four entries in `item_list`."* A
buyer who wants four of our games in one sitting generates **one order and one review opportunity
whether or not a bundle or voucher exists.** The cart already merged them. Nothing we do at the
promotion layer collapses those four orders, because there were never four.

So the review cost attributed to bundles and to the basket-builder voucher was an artifact of a
counterfactual that Shopee's own cart behaviour rules out.

**The real tension, restated honestly — it lives across TIME, not within a session:**

| Buyer behaviour | Orders | Review chances |
|---|---|---|
| Four titles in one cart, no promotion | 1 | 1 |
| Four titles in one cart, with a bundle or voucher | 1 | 1 |
| One title now, another next week, and so on | up to 4 | up to 4 |

The only way four purchases become four review opportunities is four **separate visits**. So the
question a promotion actually asks is: *does encouraging a bigger basket today cost us repeat
visits later?* For a shop with no established repeat traffic, taking the larger sale now beats
waiting on return visits that may never happen — and a min-spend voucher **invites** a bigger
basket rather than forcing one, so it does not foreclose the repeat visit either.

**Consequence for the recommendations below: bundles and the basket-builder voucher are better
than this document originally claimed, not worse.** The fee arithmetic was always right; the
review-count objection against it was not.

*(Raised by `project-steamshare-2c`, who applied the original §2 argument against §6's voucher.
The objection was correct about bundles-versus-repeat-visits and incorrect about the baseline —
checking it is what surfaced the cart-merge fact that invalidates both.)*

---

## 3. THE BUNDLES — DECIDED 2026-09-08, ready to create

**Chaison delegated the discount and the goal to this lane on 2026-09-08** ("you can decide on the
discount / goal"). What follows is a decision, not a menu. Two bundles, one price point, both
buildable today.

**Status: UNBLOCKED.** Migration 0014 is applied and multi-game orders are verified live (§ 0), so
a bundle now delivers every game in it. That was the only thing standing in the way.

### The goal, stated so it can be judged later

**Raise the value of an order, and give the shop one product worth pointing at.** The shop's
listings are RM0.99–1.59 singles, which is the worst possible shape against a flat RM0.54 per-order
fee, and it has no hero product. Both competitors' best sellers are bundles — GamerSpace's ALL-IN-1
at RM18.99 has 10k+ sold and outsells every individual AAA title they carry
(`research/2026-09-05-market-blind-spots.md`).

Success is **bundle units sold in the first 14 days**, read from Seller Centre. ⚠️ It cannot be read
from our own database: `orders` has no price and no `item_id` (§ 8). Do not claim a revenue lift
that cannot be measured — count units, and treat the fee saving as arithmetic rather than as a
measured result.

### The two bundles

| Bundle | Contents | Face | **Price** | Off | Steam value | Net | vs separate |
|---|---|---|---|---|---|---|---|
| **Starter Pack** | Stacklands · Tribes of Midgard · Lords of the Fallen 2014 | RM3.57 | **RM2.89** | 19% | **RM113.74** | RM1.94 | **+RM0.50** |
| **Adventure Pack** | How to Fish · Dokimon Quest · Batman: Arkham Knight | RM3.87 | **RM2.89** | 25% | **RM98.49** | RM1.94 | **+RM0.26** |

No game appears in both. Together they use 6 of the 10 titles on our own accounts.

### Why these, and why RM2.89 — the decisions I actually made

**Why RM2.89 rather than deeper.** RM2.89 is the top of Chaison's traction band and the point where
the flat fee stops dominating: effective take falls from 57–69% on the singles to **33%** here. At
RM2.49 the Starter Pack's advantage over selling the same three separately collapses from +RM0.50
to +RM0.16 — a third of the gain, to move the headline discount from 19% to 30%. Not worth it. The
discount that matters for awareness is the one against **Steam's** price, not against our own.

**Why Lords of the Fallen is in the cheap bundle.** The highest-margin trio on paper is
Stacklands + Tribes + Dokimon at +RM0.76, but it shows only RM73.24 of Steam value. Swapping in
Lords of the Fallen (RM79.00 on Steam) costs RM0.26 of margin and buys **RM113.74 of headline
value** — the strongest hook in the catalogue for an awareness goal. That is the trade the goal
asks for, so it is the one I took.

**Why the two RM0.99 titles are both in bundles.** Stacklands and Tribes of Midgard net RM0.31 each
standalone at a 69% take rate — close to pointless alone. In a bundle the same games contribute at
33%. Bundling pays most exactly where standalone economics are worst.

**What is deliberately NOT bundled.** Dave the Diver, Euro Truck Simulator 2, Schedule I and Escape
From Duckov stay as RM1.59 singles. At 48% take their standalone economics are the healthiest in
the shop, so bundling them gives up more than the flat fee returns — a 3-premium bundle capped at
RM2.89 nets **−RM0.52** against selling them separately.

### ⚠️ Two constraints that decide WHICH games may be bundled

**1. Only our own Steam accounts. Never supplier-backed titles, until caps are known.**
`RULINGS.md` R6, `FACT-V` 2026-09-07: supplier redemptions are capped at roughly **5–6 per supplier
ORDER**, shared across every account on that order — one row covers 7 games including a live one.
A 3-game bundle spends **three redemptions per sale**, so two bundle sales could exhaust a whole
supplier order. All six games above are on accounts we hold, which is why they are the ones chosen.
Bundling a supplier title requires a `steam_accounts` query on `supplier_order_id` first; the
supplier's name does not settle it (R9).

**2. A bundle spends account capacity three times faster.** One bundle order occupies three
accounts at once rather than one. `CHECKPOINT.md` already names buyers-per-account as the real
lever, so watch the three bundled accounts' load, not just the order count.

### Seller Centre settings

**Marketing Centre → Bundle Deal.** Not Add-on Deal — Shopee's rule is that add-ons belong in an
item's variations, and listing them separately is Price Spam.

| Field | Starter Pack | Adventure Pack |
|---|---|---|
| Bundle type | Fixed price | Fixed price |
| Bundle price | **RM2.89** | **RM2.89** |
| Products | Stacklands `52367419203`, Tribes of Midgard `52467419241`, Lords of the Fallen 2014 `45417439240` | How to Fish `48217427795`, Dokimon Quest `52667425632`, Batman: Arkham Knight `45017441353` |
| Period | **14 days**, then review | **14 days**, then review |
| Purchase limit | leave open, but see constraint 2 | leave open, but see constraint 2 |

Item ids are `FACT-V` from `scripts/publish-readiness.mjs`, 2026-09-08.

### Bundle copy — claim-checked

No co-op or online claim (none of these six is bundled on a split-screen basis), no lifetime or
refund guarantee, no "instant", no `DLC+`, **no gameshare.space URL**.

```
STARTER PACK - 3 Steam Games | Offline Play | 24H Auto Delivery
Stacklands · Tribes of Midgard · Lords of the Fallen 2014
Over RM110 of Steam games for RM2.89. Original accounts, 24-hour auto delivery.
```
```
ADVENTURE PACK - 3 Steam Games | Offline Play | 24H Auto Delivery
How to Fish · Dokimon Quest · Batman: Arkham Knight
Over RM95 of Steam games for RM2.89. Original accounts, 24-hour auto delivery.
```

### Before creating them

1. `node scripts/shopee-listings.mjs` — **zero failing lines.** An unmapped item inside a bundle
   fails silently and only for the buyer, which is a different defect from the one 0014 fixed.
2. Watch the **first three bundle orders individually** and confirm every game in each delivered.
3. Re-check after 14 days: units sold, and whether the three bundled accounts are carrying load.

### Deferred, not rejected

**"The Whole Shelf"** — all ten own-account titles in one bundle. Face RM13.80, so it only turns
positive around **RM9.99+**, outside the current band (−RM4.46 at RM2.89, −RM1.80 even at the
RM5.99 ceiling). It is the shape the competitors' best sellers actually take, and it is the right
move once the price policy allows it.

---

## 4. Seller Centre settings — SUPERSEDED by § 3

**This section is empty on purpose.** Its settings and copy are now in § 3, which carries the
decided bundle set. It is recorded as superseded rather than deleted so that nobody restores it.

**What it used to say, and why it is wrong now:**

- It defined **three** bundles — Pocket Trio, Starter Trio and a Duo Pack — of which two shared two
  of their three games. Overlapping bundles cannibalise each other and confuse the storefront. § 3
  replaces them with **two non-overlapping trios**.
- It said *"item_ids from `docs/listing-copy.md` § Status at a glance"*. § 3 now carries the real
  item ids, `FACT-V` from `scripts/publish-readiness.mjs` — that file has duplicate part headings
  and eight games appearing twice, so it is the wrong place to look up an id.
- It carried a warning that Tribes of Midgard, Schedule I and Euro Truck Simulator 2 still had
  `CO-OP` in their live titles. **That was fixed shop-wide on 2026-09-07** — every co-op claim was
  removed and the house rule that generated them now mandates `OFFLINE`. The warning was correct
  when written and is resolved; do not act on it again.

---

## 5. Single-title discounts — the traction engine, unblocked today

**Tool: Marketing Centre → My Shop's Shocking Sale.** Self-nominated slots on the shop's own
storefront, with a countdown and no approval gate.

| Field | Value |
|---|---|
| Cadence | 1–2 slots per weekend |
| Depth | **10–15% off**, and only on RM1.29+ titles |
| Rotation | 2–3 listings per slot, rotating — never the same titles twice running |

⚠️ **Never leave a promotional price standing permanently.** A permanent inflated "was" price is
Shopee's named **Misleading Discount** violation — it is exactly what the competitor anchor-price
ladder does. Time-boxed, genuine, rotating.

⚠️ **Do not discount the RM0.99 titles.** Stacklands and Tribes of Midgard net RM0.31 at a 69%
take rate; 15% off takes them to about RM0.17 — the flat RM0.54 fee eats effectively all of it.
Discounting them is the one move here that actively destroys value. With prices held (§ 1),
**their route to better economics is the Starter Pack (§ 3), not a discount.**

---

## 6. Vouchers — also unblocked today

### Basket-builder — the one that pays for itself

**This is the voucher Chaison asked for on 2026-09-08 ("buying RM5 worth of game rebates RM1").
It was already specced here on 2026-09-07 at exactly those numbers — nothing needed designing,
only deciding.** The one change is what he asked to attach to it: *"only redeemable after leaving
a review the first time"*. **That condition is NOT in this spec** — he dropped it the same day
(§ 6a). This voucher is a repeat-purchase and basket-size lever, open to every buyer, with no
review condition of any kind.

| Field | Value |
|---|---|
| Type | Shop voucher · **RM1.00 off** (fixed) · min spend **RM5.00** |
| Applies to | **All products** — not a product voucher |
| Review condition | **NONE.** Do not add one (§ 6a) |

⚠️ **A live voucher cannot be re-priced.** Once a voucher is ongoing, only its name, usage
quantity (increase only), end time and display channels can change — `discount_amount` and
`min_basket_price` are immutable, and a code locks for **30 days** after it ends. So a
mis-sized voucher must be ended and replaced under a **new code**. Get the numbers right first.

> **`FACT-V` 2026-09-08 — confirmed against the live API, not inferred.**
> `voucher/get_voucher_list` returns **exactly one voucher** for shop `1597884613`:
> `GAMESAVE2`, `min_basket_price: 15`, `discount_amount: 2`, ends 2026-10-06, and
> **`current_usage: 0`** — nobody has redeemed it once in the two days it has been live,
> which is what "cannot fire" looks like in data. Same-day order totals were RM0.97 and
> RM1.29; the six most recent real orders ran RM0.97–4.99, so none of them was within
> RM10 of the minimum.
>
> **Consequence for buyer messaging: there is currently no voucher a buyer can be told to
> use.** Naming `GAMESAVE2` in a chat message sends them to a checkout that rejects the
> code. Do not put a voucher line in the receipt nudge or any post-order message until the
> RM1 / min-RM5 replacement below actually exists.

**Live as of 2026-09-07: `GAMESAVE2` — RM2 off, min spend RM15 — which cannot fire.** At
RM0.99–1.59 a buyer needs **10–16 games** in one basket to reach RM15, against a typical basket
of 1–3. It is inert rather than harmful (if it ever fires, a 10-game RM15.90 basket nets RM11.40
against RM8.20 for those ten sold separately). Its shape was borrowed from Cyrix Gaming's
RM3-off/min-RM20 ladder, which works only because their items are RM4–15, i.e. 2–5 items.
Replacing it is Chaison's call — ending a voucher spends escrow.

Same flat-fee arbitrage as bundling, aimed at buyers who did not take a bundle. Computed: a
4-game basket at RM5.46 face → buyer pays RM4.46 → **seller nets RM3.29**, against **RM2.51** for
those four sold separately. The voucher costs RM1.00 and returns **+RM0.78**, because it converts
four orders into one.

⚠️ Note this trades order count for net, exactly as § 2 describes. Run it *alongside* singles as
an opt-in, not as a replacement for them.

**Why this one is FIXED when `/ss-market` § 1 says "prefer percentage vouchers" — do not "fix" it.**
That rule exists because a fixed RM1 against a **RM0.99 single** is a 100%+ discount on top of a
69% take rate. It is a rule about *low-priced baskets*, and the RM5.00 minimum is precisely what
takes this voucher out of its range: RM1.00 off a RM5.46 basket is **18%**, which is a milder
discount than the 10%-capped Follow Prize below ever gives on a small basket. The percentage form
is also actively worse here — Shopee rejects a percentage voucher unless
`max_price > percentage × min_basket_price × 0.01`, so a 10%/RM1.00-cap voucher at a RM5.00
minimum needs a cap above RM0.50 and would clear, but the cap would bite at every basket over
RM10 and the voucher would stop scaling exactly where the flat-fee arbitrage is biggest. Fixed is
the correct shape **because** the minimum spend is doing the protecting.

### 🔴 Before creating this: `GAMESAVE2` occupies the slot and cannot fire

Repeated from above because it is the actual blocker: the live voucher is **RM2 off, min spend
RM15**, which needs 10–16 games in one basket against a typical basket of 1–3. **A live voucher's
`discount_amount` and `min_basket_price` are immutable** and the code locks for **30 days** after
it ends, so `GAMESAVE2` cannot be edited into this spec — it must be ended and replaced under a
new code. Ending a voucher spends escrow, so it is **Chaison's call, not an agent's**.

---

## 6a. Review growth — the sanctioned lever, and why the gating was dropped

**The ask (Chaison, 2026-09-08):** make the RM1/RM5 voucher *"only redeemable after leaving a
review the first time."* **The decision, same day: gating dropped — reconfirmed twice, the second
time with the full mechanics of the gated version written out in front of him.**

### Shopee cannot express that condition — and the workaround that CAN is manual forever

Worth recording so nobody re-derives it. The sourced field list for a shop voucher
(`research/2026-09-06-shopee-growth-levers.md` § 7, `FACT-S`) is: reward type, **minimum basket
price**, usage quantity, validity, and display placement — *"storefront, specific channels like
Shopee Feed, Shopee Live or do not display."* **There is no review condition, and no buyer-history
condition of any kind.** A voucher cannot be made to check whether someone has reviewed.

The one mechanism that would work is **`do not display`**, which makes a voucher private —
redeemable only by a buyer handed the code. Gating on a review then means, in full:

1. Buyer leaves their first review.
2. **You** spot it in Seller Centre → Ratings.
3. **You** send the code in Shopee Chat.

**No Shopee automation exists for any of those three steps**, so the cost is manual work per
buyer, permanently, and it scales linearly with the thing we are trying to grow. That is the
practical argument, and it sits alongside the policy one: this is the incentivised-review pattern,
and the exposure rose on 2026-09-08 when the immediate delivery message started asking for stars
— a thread reading *"rate us"* followed by *"here's RM1"* is the shape the rule exists about.

**Rejected on both grounds. Do not rebuild it without a new decision from Chaison.**

### What the evidence actually is — stated precisely, because it is weaker than it looks

`/ss-market` § 1 lists *"Anything offered in exchange for a review"* as a **penalty risk**, and
`lib/follow-up.ts` is written against that rule with a test pinning it. But
`research/2026-09-06-shopee-growth-levers.md` is explicit about the evidentiary state, and it
should not be overstated in either direction:

> **Incentivised reviews — the specific rule is `UNSOURCED — MUST VERIFY`.** No Shopee Malaysia
> page reachable in that research states whether a seller may offer a voucher, coin or gift in
> exchange for a review. The one secondary source found was incoherent and was discarded.

So: **"a review-gated voucher is a confirmed Shopee MY policy violation" is NOT an established
claim, and must not be repeated as one.** What is established is (a) *"dishonest review"* is
listed under **Junk**, a Spam-class violation (`FACT-S`), and (b) the alternative below is fully
sourced, free, and needs no policy exception at all.

**The recommendation does not rest on the risk.** Even if incentivising were provably permitted,
the gated design is the weaker instrument: it pays the buyers who would have reviewed anyway,
selects for *quantity* of reviews rather than satisfaction, and — the part that actually costs
money — an unhappy buyer holding a voucher they can only unlock by reviewing has been handed a
paid reason to post the review they were going to skip. Shopee's own segment reaches the same
non-reviewers for free and carries none of that.

### The lever: Chat Broadcast → `User Pending Review`

`FACT-S`, `research/2026-09-06-shopee-growth-levers.md` § 5. **Marketing Centre → Chat Broadcast.**
A free push to a targeted buyer group over Shopee Chat *and* push notification, carrying a message,
**one** voucher and product links.

**Shopee built a default recipient group whose entire purpose is this** — `User Pending Review`,
defined by Shopee as *"buyers that bought from seller's shop but have [not] leave review."* That
is as close to an endorsement of review-solicitation-by-reminder as the platform gives, and it is
the reason this route needs no policy exception.

| Field | Value |
|---|---|
| Tool | Marketing Centre → **Chat Broadcast** |
| Recipient group | **`User Pending Review`** — one group per broadcast |
| Voucher attached | **The basket-builder (RM1 off / min RM5) from § 6** |
| Cadence | Whatever the quota ladder allows — see below |
| Timing | **Monday**, quota resets 00:00 · and only into 12 hours that can be staffed |

**Why attaching the § 6 voucher here is NOT the gated design.** The voucher is available to
everyone regardless of whether they review; the broadcast merely delivers it to a segment that
happens to be defined by not having reviewed. Nothing is withheld from a non-reviewer and nothing
is unlocked by reviewing. That distinction is the whole point — keep it. **If the voucher is ever
made conditional on a review, this becomes the gated design under a different name.**

### The three constraints that decide whether this is even runnable

1. **Quota ladder** (`FACT-S`), reviewed **every Monday 00:00** on trailing-30-day performance.
   Both metrics must clear a level; *"if your Open Rate and Click Through Rate fall into two
   different levels, the lower level will determine your quota."*

   | Level | Quota | Open Rate | Click-Through Rate |
   |---|---|---|---|
   | 1 | **1 per 2 weeks** | <15% | <15% |
   | 2 | 1 per week | 15–<30% | 15–<30% |
   | 3 | 2 per week | ≥30% | ≥30% |

   A new shop starts at Level 1. **Plan for one broadcast a fortnight, not a weekly campaign.**

2. ⚠️ **The CRR trap — this is the one that can actually hurt the shop.** `FACT-S`: *"If a
   recipient sends a follow-up message after you send a broadcast, sellers should first chat
   respond within 12 hours in order to maintain their Chat Response Rate."* A broadcast creates an
   inbound reply wave with a 12-hour SLA against a **sole operator**. CRR is one of the four
   Account Health metrics that feed shop standing, and the competitor benchmark is GamerSpace
   answering within minutes at 99%. **Do not broadcast into hours that cannot be staffed.** A
   broadcast sent Friday night to chase reviews can cost more standing than the reviews are worth.
   Sent broadcasts **cannot be recalled**, and a buyer can receive only **1 broadcast per day**
   platform-wide.

3. 🔴 **Availability is unverified.** `FACT-S`: Shopee's deck marks Chat Broadcast
   ***"only for selected sellers"***. Whether this shop has it is `UNSOURCED — MUST VERIFY` and
   **only Chaison can check it** (Seller Centre → Marketing Centre → Chat Broadcast). Until he
   does, this entire section is a plan, not a runnable lever. **This is the first thing to confirm
   — everything else here is contingent on it.**

### What is already working on reviews, with no Seller Centre action at all

Two automated chat messages already run this funnel, and they are the fallback if Chat Broadcast
turns out to be unavailable:

| When | Message | Asks for |
|---|---|---|
| Immediately after auto-delivery | `buildReceiptNudgeMessage()` — `lib/fulfillment.ts` | **"Order Received"** only. Built 2026-09-08 |
| ~24 h after delivery | `buildFollowUpMessage()` — `lib/follow-up.ts` | **"Order Received" + ⭐⭐⭐⭐⭐**, in EN and BM |

**Both are deliberately free of any inducement, and both are tested to stay that way** — the
`nudge: offers nothing in exchange for anything` and `offers nothing in exchange for the rating`
tests fail the build if a voucher, discount, rebate or gift word appears in either. Do not "improve"
either message by attaching the § 6 voucher to it: a voucher in the same message as a star request
is the gated design again, and it is the one place it could be introduced by accident.

Note the ordering that makes this safe: the nudge asks for the button and **never** mentions stars;
the follow-up asks for stars a day later and **never** mentions the voucher. The voucher reaches
buyers through the broadcast, which is a separate message on a separate day.

---

## 6b. Follow Prize — the upstream voucher

| Field | Value |
|---|---|
| Type | **Shop voucher, all products** (Shopee's own design rule) |
| Reward | **10% off, cap RM1.00** — percentage, never fixed |
| Min spend | RM3.00 · Duration **more than 1 day** (Shopee requires it) |

⚠️ **Percentage, never fixed, at these prices.** A fixed RM1 voucher on a RM0.99 listing is a
100%+ discount on top of a 69% take rate. The cap makes the downside knowable.

> **Shopee API constraint on percentage vouchers** (reported by the shop-operations session,
> 2026-09-07): a percentage voucher is rejected unless `max_price > percentage x min_basket_price
> x 0.01` — i.e. the cap must not already bite at the minimum spend. **Checked: this config
> passes.** 10% x RM3.00 x 0.01 = RM0.30 threshold, against a RM1.00 cap, so it clears
> comfortably and the cap only starts biting at a RM10 basket.
>
> Note what the rule actually constrains — it is **high minimum spend**, not low prices, that
> breaks a percentage voucher. The same 10%/RM1.00 cap against a **RM15** minimum needs RM1.50
> and would be **rejected**. So do not read this as "fixed-amount only at our prices"; read it as
> "keep the minimum spend low", which is what the basket-builder above already does. Followers are the
addressable audience for Feed and Chat Broadcast, so this feeds every other free lever.
Competitor benchmark: Cyber Space 21.1k, GamerSpace 22.7k.

---

## 7. Execution order — revised 2026-09-08

**Everything here is Chaison's to do: all of it is Seller Centre, which no agent can reach.**

**Step 0 — the 60-second check that decides § 6a:**

0. **Marketing Centre → is Chat Broadcast available to this shop?** The deck marks it *"only for
   selected sellers"*. If it is not available, § 6a has no lever and the review funnel stays as
   the two automated chat messages, which already run. Report the answer as `FACT-C`.

**Then, in order:**

1. **End `GAMESAVE2`** (RM2 off / min RM15 — it cannot fire at our prices) and create the
   **basket-builder** voucher: RM1.00 off, min spend RM5.00, all products, **no review
   condition** (§ 6). It needs a new code — a live voucher's amount and minimum are immutable.
   *This is the voucher asked for on 2026-09-08.*
2. Create the **Follow Prize** voucher — 10% off, cap RM1.00, min spend RM3.00 (§ 6b).
3. Start the weekend **Shocking Sale** rotation on RM1.29+ titles (§ 5).
4. **If step 0 came back available:** send one Chat Broadcast to `User Pending Review` with the
   basket-builder voucher attached — **on a Monday, into 12 staffable hours** (§ 6a).

*Prices stay as they are — Chaison, 2026-09-07.*

**Bundles — no longer blocked (§ 0 cleared 2026-09-08, 0014 is applied):**

5. Fix the co-op formula at `docs/listing-copy.md:56` and the five affected titles.
6. Run `scripts/shopee-listings.mjs` and confirm **zero failing lines** *before* creating any
   bundle — an unmapped item inside a bundle still fails silently. This condition survived the
   § 0 clearance on its own merits.
7. Create the **Starter Pack** (Stacklands · Tribes of Midgard · Lords of the Fallen 2014) at
   RM2.89, 14-day window. Watch the **first three orders individually** and confirm all three
   games delivered on each — the multi-game path is live and verified, but these are the first
   real bundle orders it will carry.
8. Create the **Adventure Pack** (How to Fish · Dokimon Quest · Batman: Arkham Knight) at RM2.89,
   then re-run `scripts/shopee-listings.mjs` and confirm zero failing lines.

**Later, when price policy allows RM9.99+:** revisit The Whole Shelf (§ 3).

---

## 8. What cannot be measured yet — say so before claiming a win

`orders` has **no price and no item_id**, and there are no analytics. "Did the bundle lift
revenue" is **unanswerable in principle** today. The fee arithmetic above holds regardless — it is
arithmetic. Bundle and voucher *demand* is a hypothesis until instrumentation exists. Do not
report a lift that cannot be measured.
