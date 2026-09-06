# Promotions & Bundles — paste-ready spec

**Written:** 2026-09-07 · **Mode:** `/ss-market growth` · **Status:** DESIGNED, NOT CREATED.

**Price policy (Chaison, 2026-09-07):** traction phase targets **RM1.00–RM2.89**. Ceiling for a
later phase is **RM5.99**. Every figure below respects that band and says so where it bites.

Every price, discount and net figure is **computed**, not estimated — reproducible from the fee
model in `research/2026-09-05-shopee-my-seller-economics.md` § "Effective take rate". Nothing here
has been created in Seller Centre or pushed through the Open API. See § 0 first.

---

## 0. ⛔ HOLD — do not create any bundle until migration 0014 is applied

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

## 2. ⚠️ The traction tension — read before choosing bundles

Bundles and traction pull in **opposite directions**, and the RM2.89 cap sharpens the conflict.

| | Orders | Review chances | Seller net |
|---|---|---|---|
| 4 cheap titles sold **separately** | **4** | **4** | RM1.74 |
| The same 4 as **one bundle @ RM2.89** | 1 | 1 | RM1.94 |

The bundle earns **+RM0.20** and costs **three orders and three review opportunities.** Shopee
ranks on sales velocity, order count and rating count — exactly what the bundle gives up.

**So for a traction phase, singles are the engine and bundles are the upsell, not the reverse.**
That inverts the usual advice, and it inverts what a RM5.99-ceiling catalogue would want later.
It is a direct consequence of your price band: at RM9.99 the same 4-game bundle would net far
more than four singles, which is why the shelf-bundle play in
`research/2026-09-05-market-blind-spots.md` is a **later-phase** move, not a now move.

---

## 3. The bundles that actually work under RM2.89

Under the cap, **bundling only pays when the bundle is made of cheap titles.** Bundling premium
RM1.59 titles loses money, because their standalone economics are already tolerable.

| Bundle | Contents | Face | **Price** | Off | Net | vs separate |
|---|---|---|---|---|---|---|
| **Pocket Trio** | Stacklands · Tribes of Midgard · How to Fish | RM3.27 | **RM2.89** | 12% | RM1.94 | **+RM0.76** |
| **Starter Trio** | Stacklands · Tribes of Midgard · Dokimon Quest | RM3.27 | **RM2.89** | 12% | RM1.94 | **+RM0.76** |
| **Duo Pack** | any **two** of Dave the Diver / ETS2 / Escape From Duckov / Schedule I / Lords of the Fallen | RM3.18 | **RM2.89** | 9% | RM1.94 | **+RM0.30** |

**Why the trios win hardest.** Stacklands and Tribes of Midgard net RM0.31 each standalone at a
69% take rate — close to pointless on their own. Bundled, the same three games net RM1.94 instead
of RM1.18, a **+64% improvement**, and the buyer still pays 12% less than buying separately. That
is the flat fee being recovered, not margin being conceded.

### Explicitly NOT viable in this price band

| Idea | Why not — computed |
|---|---|
| Any bundle of 3+ **premium** (RM1.59) titles | Face RM4.77+ capped at RM2.89 → net RM1.94 vs RM2.46 separate = **−RM0.52** |
| 5-game mixed bundle | Face up to RM7.95 capped at RM2.89 → **−RM2.16** |
| **"The Whole Shelf" (all 10)** | Face RM13.80. At RM2.89 → **−RM4.46**. Even at your RM5.99 ceiling → **−RM1.80**. It only turns positive around **RM9.99+** |

**The Whole Shelf is a real opportunity and it is deferred, not rejected.** GamerSpace's ALL-IN-1
at RM18.99 has 10k+ sold and outsells every individual AAA title they carry. But it cannot be
priced inside RM1.00–5.99 without losing money against separate sales. Revisit when the price
policy allows RM9.99+.

---

## 4. Seller Centre settings

**Tool: Marketing Centre → Bundle Deal.** Use Bundle Deal, *not* Add-on Deal.

> ⚠️ Shopee's rule: *"Add-on(s) should be included as part of an item's variation and should not
> be listed separately"* — doing so is **Price Spam**. Our games are legitimately separate
> products, so a Bundle Deal across them is correct; an Add-on Deal is not.

| Field | Value |
|---|---|
| Bundle type | **Fixed price** |
| Bundle price | RM2.89 (all three bundles) |
| Products | item_ids from `docs/listing-copy.md` § "Status at a glance" |
| Period | **fixed 14-day window**, then review. Never open-ended (§ 5) |

### Copy — claim-compliant, paste-ready

Checked against every rule in `/ss-market` § 1: no co-op/online/multiplayer, no lifetime or refund
guarantee, no "instant", no `DLC+`, **no gameshare.space URL**.

```
POCKET TRIO — 3 Steam Games RM2.89 | Offline Play | 24H Auto Delivery
Stacklands · Tribes of Midgard · How to Fish
Over RM55 of Steam games. Original accounts, 24-hour auto delivery.
```
```
STARTER TRIO — 3 Steam Games RM2.89 | Offline Play | 24H Auto Delivery
Stacklands · Tribes of Midgard · Dokimon Quest
Over RM70 of Steam games. Original accounts, 24-hour auto delivery.
```
```
DUO PACK — 2 Steam Games RM2.89 | Offline Play | 24H Auto Delivery
Pick any two. Over RM95 of Steam games.
Original accounts, 24-hour auto delivery.
```

> ⚠️ **Tribes of Midgard, Schedule I and Euro Truck Simulator 2 carry `CO-OP` in their current
> live titles**, violating the offline-mode rule (`/ss-market` § 1, unfixed as of 2026-09-06).
> None of the copy above repeats it. **Fix `docs/listing-copy.md:56` before these go live** — a
> bundle that aggregates a co-op claim makes the same unkeepable promise at 3× the price.

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
**their route to better economics is the Pocket/Starter Trio, not a discount.**

---

## 6. Vouchers — also unblocked today

### Basket-builder — the one that pays for itself

| Field | Value |
|---|---|
| Type | Shop voucher · **RM1.00 off** · min spend **RM5.00** |

Same flat-fee arbitrage as bundling, aimed at buyers who did not take a bundle. Computed: a
4-game basket at RM5.46 face → buyer pays RM4.46 → **seller nets RM3.29**, against **RM2.51** for
those four sold separately. The voucher costs RM1.00 and returns **+RM0.78**, because it converts
four orders into one.

⚠️ Note this trades order count for net, exactly as § 2 describes. Run it *alongside* singles as
an opt-in, not as a replacement for them.

### Follow Prize — the upstream lever

| Field | Value |
|---|---|
| Type | **Shop voucher, all products** (Shopee's own design rule) |
| Reward | **10% off, cap RM1.00** — percentage, never fixed |
| Min spend | RM3.00 · Duration **more than 1 day** (Shopee requires it) |

⚠️ **Percentage, never fixed, at these prices.** A fixed RM1 voucher on a RM0.99 listing is a
100%+ discount on top of a 69% take rate. The cap makes the downside knowable. Followers are the
addressable audience for Feed and Chat Broadcast, so this feeds every other free lever.
Competitor benchmark: Cyber Space 21.1k, GamerSpace 22.7k.

---

## 7. Execution order

**Now, no migration needed:**

1. Create the **Follow Prize** voucher (§ 6).
2. Create the **basket-builder** voucher (§ 6).
3. Start the weekend **Shocking Sale** rotation on RM1.29+ titles (§ 5).

*Prices stay as they are — Chaison, 2026-09-07.*

**After migration 0014 and the § 0 gate:**

4. Fix the co-op formula at `docs/listing-copy.md:56` and the five affected titles.
5. Create **Pocket Trio** and **Starter Trio** (14-day window). Watch the first three orders
   individually and confirm all three games deliver.
6. Create **Duo Pack**.
7. Re-run `scripts/shopee-listings.mjs`; confirm zero failing lines.

**Later, when price policy allows RM9.99+:** revisit The Whole Shelf (§ 3).

---

## 8. What cannot be measured yet — say so before claiming a win

`orders` has **no price and no item_id**, and there are no analytics. "Did the bundle lift
revenue" is **unanswerable in principle** today. The fee arithmetic above holds regardless — it is
arithmetic. Bundle and voucher *demand* is a hypothesis until instrumentation exists. Do not
report a lift that cannot be measured.
