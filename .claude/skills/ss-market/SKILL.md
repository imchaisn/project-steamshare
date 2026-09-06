---
name: ss-market
description: Use when doing any marketing, SEO, listing-copy, keyword, voucher, ads, review or growth work for the GameShare Shopee Malaysia shop. Covers the weekly routine, writing or auditing a listing, keyword passes, campaign prep, and deciding whether a growth lever is worth the money. Enforces the claim rules that keep listings honest and the shop out of Shopee's penalty system.
---

# ss-market — Shopee Malaysia marketing

The objective is more sales from the Shopee shop. Everything here serves that, and nothing here
is allowed to serve it by promising something the product cannot do.

**This skill runs in the main session, not a subagent** — because most of the work needs a fact
only Chaison can see (§4), and a subagent cannot ask him anything.

---

## 1. The claim rules — non-negotiable, check before any copy ships

These are not style preferences. Each one is either a promise the product structurally cannot
keep, or a Shopee policy violation that costs penalty points. **Violating copy must not ship
even if it is asked for in passing** — raise the conflict, then follow Chaison's decision.

| Never | Why |
|---|---|
| **Co-op, multiplayer, "with friends", online, shared server** | Buyers play in Steam **Offline Mode**. An online mode cannot be reached from offline. This overrides Steam's own category data — that data describes the game, not what a buyer of a shared account can do. |
| **"Lifetime guarantee"** | Cannot be honoured. Carried by older Dave/Duckov listings; must not be copied onto new ones. |
| **Refund guarantees** | Off-limits while the `/terms` window is a placeholder. |
| **"Instant" delivery** | Say **24-hour**. Auto-delivery is real; instant is not. |
| **`DLC+` unless that specific account owns the DLC** | It is a per-account fact, not a per-game fact. |
| **A gameshare.space URL in a listing description or image** | Shopee MY's Listing Violation Guide prohibits external URLs "with intention to direct transactions outside of the Shopee platform" — 1 penalty point per 2 deleted listings. Retrieval instructions belong in the **Shopee Chat delivery message**, which is already automated and also satisfies Virtual Goods proof-of-delivery. |
| **A permanent inflated "was" price** | Shopee's named **Misleading Discount** violation. |
| **A parked listing at an absurd price** (competitors use RM9,997) | Shopee's **Price Spam** example is RM9,999. |
| **Add-ons listed as separate items** | Price Spam. Add-ons belong in an item's variations. |
| **Anything offered in exchange for a review** | Penalty risk. The sanctioned alternative is Chat Broadcast to the `User Pending Review` group. |

⚠️ **Known live violation, unfixed as of 2026-09-06.** The house title formula in
`docs/listing-copy.md` ends with `<OFFLINE or CO-OP>`, which *instructs* writers to break the
co-op rule. Five games took it up — Euro Truck Simulator 2, Schedule I, Tribes of Midgard,
Ghost of Tsushima, Fantasy Life i — several live, several also carrying `co-op` in their
keyword lists. **Fix the formula before the titles**, or the next regeneration restores it.

⚠️ Titles also currently stack `FULL GAME | 24H AUTO DELIVERY | ORIGINAL`, which sits inside
Shopee's keyword-spam definition. Not yet enforced against this shop; treat as live exposure.

⚠️ Descriptions still tell buyers to enter a **Steam username**, which the homepage stopped
asking for on 2026-09-06. Stale instructions cause chat volume, which costs response rate.

---

## 2. Sources of truth — read before writing, never write from memory

| File | What it owns |
|---|---|
| `docs/listing-copy.md` | **Upload source of truth.** Every title and description, Applied vs Proposed. `scratchpad/verifycopy.mjs` diffs live Shopee against it byte-for-byte — silently rewriting it makes the next verify run report fake drift. |
| `docs/shopee-listings.md` | Asset conventions, title convention, banned claims. Its rules supersede its own older per-game blocks. |
| `research/2026-09-06-shopee-growth-levers.md` | Ranking signals, every free and paid lever with sourced numbers, policy and enforcement risk, campaign calendar. |
| `research/2026-09-06-marketing-asset-audit.md` | What assets exist, what is stale, what is written-but-unshipped. |
| `research/2026-09-06-marketing-skill-ecosystem.md` | Tooling verdicts. Short version: nothing installable gives real Shopee keyword data. |
| `research/2026-09-05-*` | Competitor landscape, pricing, unit economics, market blind spots. |
| `scripts/shopee-listings.mjs` | Coverage report. **A cross-marked line is a listing that takes money and delivers nothing.** Run after every listing change. |

**Numbers rule.** Never state a Shopee fee, quota, CPC, or policy threshold from memory. Quote
it from a sourced line in the research files, or mark it `UNSOURCED — MUST VERIFY`. Confident
invented numbers are the characteristic failure of this domain.

---

## 3. Modes

### `weekly` — the routine (target 2–3 h/week)

Ordered so the highest-value item is never crowded out. Full detail and citations in
`research/2026-09-06-shopee-growth-levers.md`, section "The weekly routine this implies".

- **Monday:** Chat Broadcast quota resets 00:00 — if quota is available *and the next 12 hours
  can be staffed*, send one broadcast to `User Pending Review` with one voucher. Then check
  Account Health (penalty points, chat response rate, late shipment, non-fulfilment, rating).
- **Mid-week:** ship 2 product videos (MP4, 10–60 s, **offline-mode footage only**); schedule
  1–2 My Shop's Shocking Sale slots for the weekend.
- **Any day:** boost listings, prioritising titles with stock and recent sales.
- **Weekend:** one Shopee Feed post with a product tag and voucher tag.
- **Weekly:** read conversion rate per listing. Traffic without conversion is a *listing-quality*
  problem, not a traffic problem — that distinction decides what to fix next.

⚠️ **The Chat Broadcast trap.** A recipient's reply starts a 12-hour response clock against
chat response rate, which feeds shop standing. One operator, one automated pipeline — do not
broadcast into hours that cannot be staffed.

### `listing <game>` — write or audit one listing

1. Read the game's current block in `docs/listing-copy.md` and its assets in `brand/`.
2. Check every claim rule in §1. Report violations by file and line; do not silently rewrite.
3. Title: game name **first** — it is the term buyers search. Shopee's cap is 120 characters,
   target ~80. Re-derive the character count **mechanically from the text**; never trust a
   count written next to it. The file's own "38/38 pass" claim was false — three proposals
   (Storyteller, Thronefall, Love Is All Around) are corrupted to a single backtick.
4. Changing a **live** listing is Chaison's call, never an agent's. Propose, then wait.
5. After any listing change, run `scripts/shopee-listings.mjs` and confirm no failing lines.

### `keywords` — the keyword pass

The repo admits its Malay keyword choices "rest on general Malaysian commerce vocabulary rather
than observed search data" and calls them "a hypothesis to A/B, not an established win."

**No installable tool fixes this and no agent can reach the data.** The real sources are free
and behind Chaison's login: **Top Keywords** (Business Insights → Selling Coach) and the
**Keyword Planner** in the Ads console, which shows MY search volume and suggested bid. Ask him
to paste the numbers, then rewrite against observed demand rather than guesses. Shopee's own
advice is to focus the top 3 keyword searches, not to chase all of them.

Shopee's search-bar autocomplete is a free secondary source and is harvestable per title.

### `growth <lever>` — decide whether a lever is worth it

Check it against `research/2026-09-06-shopee-growth-levers.md` first — the lever may already be
priced, or found unavailable. Then apply the margin test below.

**Margin test, mandatory before any voucher or ad spend.** Prices are RM2–9 against a 21–38%
effective take rate. A fixed RM1 voucher on an RM3 order is a third of the price *on top of*
fees. **Prefer percentage vouchers to fixed amounts at these price points**, and model against
the net-of-fee figures in `research/2026-09-05-competitor-demand-and-unit-economics.md`.

**Current standing verdict on Shopee Ads: do not.** Shop Ads are Mall/Preferred-only and
Preferred now needs RM1,650/day GMV. Manual keyword ads are being retired for GMV Max, which
needs a 7-day learning phase per product. At roughly RM1.86 net on an RM3 order, breakeven is
about 26 clicks per conversion. Revisit only when a title has proven organic sales worth
defending and there is RM50–100 that can be written off.

---

## 4. What only Chaison can do — ask, never assume

No agent can reach Shopee Seller Centre, the Shopee Open Platform console, Steam, Supabase or
Vercel. Every one is browser-authenticated and his alone. When an answer depends on one of
these, **stop and ask him, giving the exact click-path**. A guess dressed as a finding is worse
than an open question.

Standing asks, highest value first:

1. **Top Keywords + Keyword Planner numbers** — retires the largest open unknown in the repo.
2. **Is the Free Shipping Programme even offered?** (Marketing Centre) — 60 seconds, and it
   decides which take-rate model is real, because Virtual Goods is a non-supported-logistics
   channel.
3. **Account Health**: current penalty points, chat response rate, shop rating.
4. **Is Chat Broadcast available to this shop?** Shopee's deck marks it "only for selected sellers".
5. **The shop's L3 category** — match a comparable competitor listing; avoid "Others".

Tag anything he reports back as `FACT-C`. It overrides desk research on conflict.

---

## 5. The measurement problem — say it out loud when it bites

The `orders` table has **no price and no item_id**, and there are no analytics packages. So
"which listing sold what, when, and after which change" is currently **unanswerable in
principle**, which means every A/B claim about titles or vouchers is guesswork.

When a task depends on measuring a change, say so plainly rather than producing a confident
before/after. The fix is a schema and instrumentation change, and it is worth doing before any
serious title experiment — otherwise the experiment cannot pay back.

---

## 6. Dispatching research

Use the `ss-researcher` agent for anything that reads a lot and returns a little — Shopee policy
decks, competitor sweeps, platform changes. Brief it with all seven sections of the `TEAM.md` §6
template; a short brief causes duplicated work. Always name the existing `research/` files it
must read first, and instruct it to gap-fill rather than re-derive. Always tell it which files
it may write and that it may modify nothing else — then verify with `git status` afterwards.

Fetching note that saves an hour: `seller.shopee.com.my/edu/*` is an unfetchable SPA, but Shopee
mirrors the same decks as PDFs on `deo.shopeemobile.com/shopee/seller/seller_cms/*.pdf`, many
labelled `[MY]`, and `ads.shopee.com.my` renders server-side.
