# Shopee MY Growth Levers — What Actually Moves Sales

**Captured:** 2026-09-06 · **Jurisdiction:** Malaysia · **Seller modelled:** GameShare — sole
operator, non-Mall Marketplace seller, ~25 live listings, digital goods on the Virtual Goods
(Non-SSL) shipping channel.

**Fact labels used throughout:** `FACT-S` = sourced, URL attached. `ASSUMPTION` = stated value plus
its basis. `UNSOURCED — MUST VERIFY` = needed but not established. `INFERENCE` = derived from two
sourced facts, reasoning shown.

> **Methodology note that unblocks previous research — read this first.**
> `research/2026-09-05-shopee-my-seller-economics.md` concluded that `seller.shopee.com.my/edu/*`
> is a JavaScript SPA returning only a page shell, and tagged a long list of items UNSOURCED as a
> result. That conclusion about the SPA is **correct and still holds** — every `/edu/article/*` URL
> tried in this pass (6821, 619/prohibited-listing) again returned only the heading
> "Seller Education Hub". **But two first-party Shopee surfaces render server-side and were not
> tried before:**
>
> 1. **`deo.shopeemobile.com/shopee/seller/seller_cms/*.pdf`** — Shopee's own CDN hosts the Seller
>    Education Hub / Shopee University decks as PDFs, many explicitly `[MY]`-labelled. These
>    download cleanly over `curl` and extract with `pdftotext`. This is where most of the FACT-S
>    material below comes from.
> 2. **`ads.shopee.com.my/learn/faq/*` and `ads.shopee.com.my/news/*`** — the Shopee Ads Malaysia
>    knowledge base is a normal server-rendered site and fetches fine.
>
> Anyone re-opening the fee questions left UNSOURCED in the economics file should search
> `deo.shopeemobile.com seller_cms "[MY]" <topic> pdf` before concluding a number is unreachable.
> Working extraction recipe: `curl -sL -o x.pdf "<url>" && pdftotext -layout x.pdf x.txt`.

---

## Verdict in one paragraph

For a sole operator at ~25 listings with a tiny budget, **Shopee Ads in Malaysia are a trap and
should be left alone for now** — not because the CPC is high (minimum bids are RM0.07–0.15,
`FACT-S`) but because Shopee is actively killing the manual keyword-bidding model GameShare would
need, replacing it with GMV Max auto-bidding that needs a 7-day learning phase per product and
optimises to a ROAS target; on RM2–9 order values against a 21–38% effective take rate
(`2026-09-05-shopee-my-seller-economics.md`), there is no room for a paid click. Shop Ads are
structurally unavailable — they are Mall/Preferred-Seller only, and Preferred Seller now requires
average daily GMV of RM1,650 and 20 orders/day (`FACT-S`). The real levers are free and
under-used: **product video** (Shopee's own decks claim 3.7× views and 3× sales versus
photos-only), **Chat Broadcast** — which has a native `User Pending Review` recipient group, the
one sanctioned way to chase reviews — **Follow Prize**, **My Shop's Shocking Sale**, and the
**Top Keywords / Keyword Planner** tools that give free first-party MY search-volume data and would
settle the keyword guesswork `docs/listing-copy.md` openly admits to. Against all of that sits the
finding that matters most: **the `[MY]` Listing Violation Guide explicitly prohibits directing
buyers to an external URL from a listing**, and GameShare's entire delivery model routes the buyer
to gameshare.space. That is a live, currently-accruing policy exposure, and it is a bigger threat
to the shop than any missed marketing lever.

---

## What is new here vs. existing research

**NEW in this file:**

- The CDN/PDF and `ads.shopee.com.my` fetch routes (see methodology box) — a research capability,
  not just a fact.
- The **Malaysia-specific `[MY]` Listing Violation Guide**, recovered verbatim. The economics file
  had to fall back on a *Philippines* PDF and correctly refused to import it. The MY document now
  exists in hand.
- The **external-URL / off-platform prohibition** and its direct collision with the gameshare.space
  retrieval flow. Not raised anywhere in existing research.
- **Title-composition rules** that bear on keyword-spam enforcement (banned symbol/promotional-text
  guidance) — the *policy* side of the title formula. (Copy itself is another agent's scope.)
- **Misleading Discount and Price Spam** as named, penalty-bearing violations — which retroactively
  reframes two competitor tactics recorded in `2026-09-05-competitor-pricing.md` as violations
  rather than clever plays.
- **Ad-product inventory, minimum bids, minimum budgets, and the manual→GMV Max migration.**
- **Preferred Seller numeric thresholds**, and the consequence that Shop Ads are out of reach.
- **Seller-tier listing limits and the delisting order** when a limit is breached.
- **Chat Broadcast**: quota ladder, recipient groups, and the CRR trap.
- **Product video impact figures**, first-party.
- **Free keyword-research tools** (Top Keywords, Shopee Keyword Planner) — the answer to the
  keyword-data gap `docs/listing-copy.md` declares.
- **Steam Subscriber Agreement verbatim**, current as of 2026-04-20.
- **AMS commission mechanics** including the different-shop attribution change.

**Already covered — not re-derived here:**

- Fee structure, effective take rate at RM3/RM8, Platform Support Fee. → `2026-09-05-shopee-my-seller-economics.md`
- Account Health's four metrics (Shop Rating, Chat Response Rate, LSR, NFR) as ranking-adjacent
  inputs, and Shopee's *"Shops with higher scores naturally rank on earlier pages in search"*
  framing. → same file. This file adds only the extra ranking signals that file did not reach.
- The debunking of the "40% relevance / 30% performance / 20% seller quality / 10% freshness"
  SEO-blog algorithm breakdown. → same file. **That debunk still stands.** Those percentages
  resurfaced in this pass's search results (Hashmeta, Cloud Ecommerce) and remain traceable to no
  Shopee document. Do not use them.
- Malaysia's public Prohibited and Restricted Items Policy not naming game accounts. → same file.
  Re-verified in this pass (page last updated 22 May 2025); conclusion unchanged.
- The `ship_order` requirement, Virtual Goods channel mechanics, RR%/penalty thresholds, POD.
  → `2026-09-06-shopee-virtual-goods-shipping-requirement.md`
- Competitor pricing ladders, sold-count comparability warnings, per-title economics.
  → the three `2026-09-05-competitor-*` files.
- Listing titles, descriptions, banner assets, claims discipline. → `docs/shopee-listings.md`,
  `docs/listing-copy.md`. Out of scope by brief; referenced only where policy constrains them.

---

## Ranking signals (what the algorithm rewards)

**Shopee does not publish its ranking weights in any market.** That was the economics file's
conclusion and nothing found in this pass contradicts it. What follows is the set of signals Shopee
*names* in its own material as affecting visibility, with the label each one earns.

### Where the traffic actually is

- `FACT-S`. **"Over 70% of Shopee's orders are coming from searches."** Shopee's own words, in its
  Shopee Ads Intermediate deck (RM-denominated, i.e. Malaysia).
  [Shopee Ads Intermediate PDF](https://deo.shopeemobile.com/shopee/seller/seller_cms/3b2946775957f6f20c4b1e2ba977c1ef/%5BEN%20Version%5D%20Shopee%20Ads%20Intermediate.pdf)
  (no date printed on the deck). This is the single most important framing number in this file:
  search is the channel; Feed, Live and Chat are secondary.

### Keyword relevance — title vs. attributes vs. description

- `FACT-S`. **Title is the primary keyword surface and is capped at 120 characters.** Shopee's
  Malaysia listing-optimisation deck states *"A product name has a character limit of 120"* and
  pushes a fixed naming convention.
  [\[MY\] Optimising your Product Listings](https://deo.shopeemobile.com/shopee/seller/seller_cms/48aef334d826a3a81324516f2cd83edc/%5BMY%5D%20Optimising%20your%20Product%20Listings.pdf),
  deck stamped **Edited: 03/02/2021** — the oldest source in this file, flagged accordingly.
- `FACT-S`. **Attributes are explicitly named as a ranking input, in Shopee's own words:**
  *"Accurate attributes also help to increase the visibility of your products especially in the
  improvement of search results."* (same deck). This is the clearest first-party statement found
  that anything other than the title feeds search. **Attributes are almost certainly under-used by
  GameShare** and cost nothing to fill.
- `FACT-S`. **Category is framed the same way:** *"Categories and attributes help to increase the
  visibility of your product"* — from the `[MY]` Listing Violation Guide's Category Spam section.
- **Description:** `UNSOURCED — MUST VERIFY` as a *ranking* input. Shopee's decks position the
  description as a **conversion** device (*"Product description plays an important role in making
  buyers feel more confident about the product"*) and give format guidance (3–8 bullet highlights,
  then a long description), but **no Shopee source found states the description is indexed for
  search.** Do not assume keyword-stuffing the description helps ranking; it does carry spam risk
  (below).

### Performance signals

- `FACT-S` (qualitative only). Shopee's Business Insights framing names three levers a seller
  controls — **traffic, conversion rate, sales per buyer** — and instructs: *"For products with
  lower sales and lower conversion rates, improve their listing quality and set competitive
  prices."*
  [\[MY\] EN ADVANCED](https://deo.shopeemobile.com/shopee/cms_cdn_bucket/ddac40caa3f1472faf5b9cd230d69da3_%5BMY%5D%20EN%20ADVANCED.pdf).
  Shopee treats conversion rate as the diagnostic. It does not say how it is weighted.
- **Sales velocity and recency:** still `UNSOURCED — MUST VERIFY` as a named ranking input, exactly
  as the economics file concluded. One *indirect* first-party signal is new here, though:
  `FACT-S` — when a shop breaches its listing limit, *"Listings with the lowest sold count,
  followed by the least recently updated, will be 'delisted'"* (`[MY]` Optimising deck). Sold count
  and recency are the axes Shopee itself ranks a shop's own listings on for that purpose. That is
  suggestive, not proof, that the same axes feed search. Treat as `INFERENCE`, weak.
- **Click-through rate:** `UNSOURCED — MUST VERIFY` as a search-ranking input. CTR *is* a
  first-class, measured metric in Chat Broadcast and in Ads (where it determines quota and Quality
  Score respectively), but no source ties CTR to organic search ranking.
- `FACT-S` — **Ads Quality Score exists and is relevance-based:** *"Quality Score: How relevant your
  ad is to the shopper searching for your keyword."* (Ads Intermediate deck). This governs *paid*
  placement only. Do not conflate it with organic ranking.

### Seller-quality signals

- **Already covered** in `2026-09-05-shopee-my-seller-economics.md`: Shop Rating, Chat Response
  Rate, Late Shipment Rate, Non-Fulfilment Rate, and Shopee's *"Shops with higher scores naturally
  rank on earlier pages in search"* line. Not re-derived.
- `FACT-S` — new detail: Account Health's four categories are **Listing Violation, Fulfilment,
  Customer Service, Customer Satisfaction** (`[MY]` EN ADVANCED). Note that **Listing Violation is
  one of the four** — i.e. the policy risks in this file are not a separate track from the
  performance ones; they land in the same dashboard that Shopee says feeds exposure.

### Freshness / boost

- **ASSUMPTION (secondary sources only).** "Boost Now" / "Bump" lets a seller bump **up to 5
  products, once every 4 hours**, free, pushing them to the top of the corresponding category page.
  This figure is consistent across several third-party seller-tool vendors —
  [EasyStore](https://blog.easystore.co/en-my/tools-to-boost-sales-on-shopee-malaysia),
  [BigSeller](https://help.bigseller.com/en_US/detailPage/5/1/2242/content),
  [SiteGiant](https://support.sitegiant.com/knowledge-base/how-to-boost-your-shopee-products-automatically/)
  — **but no Shopee first-party page confirming the 5-products/4-hours quota was reachable in this
  pass.** These are exactly the seller-community sources the brief warns about. Also note the
  feature appears to have been **renamed from "Boost" to "Bump"** (BigSeller), which is itself a
  sign the third-party docs may be describing different vintages of the feature.
  **Verify in Seller Centre before building a routine on the 4-hour cadence** — but the cadence is
  cheap to discover empirically: the UI shows the countdown.
- `FACT-S` — a **different**, paid-adjacent thing also called "boost" exists and should not be
  confused with the free one: **New Product Boost (NPB 2.0)** gives newly-created products extra
  traffic, but *only* for products already running **GMV Max Auto Bidding ads**.
  [ads.shopee.com.my/learn/faq/505/1926](https://ads.shopee.com.my/learn/faq/505/1926). Not free.

### Stock status

- `UNSOURCED — MUST VERIFY` as a ranking signal. Shopee's material treats out-of-stock as a sales
  loss (*"avoid risks of out-of-stock situations which may lead to loss of sales"*, EN ADVANCED)
  but never says zero stock suppresses ranking. Relevant to GameShare because pooled-account
  inventory is finite; do not assume a zeroed listing keeps its position.

### Penalty signals — this is where the documentation is strongest

Shopee publishes far more about what *demotes* than what *promotes*. Full detail in
"Category, policy and enforcement risk" below.

---

## Free levers, ranked by impact per hour

All source citations for this section are in the linked PDFs; each is `[MY]`-labelled or
RM-denominated unless noted.

### 1. Product video on every listing — highest impact per hour, by a distance

`FACT-S`. Shopee's own Malaysia listing deck claims a listing with video versus photos-only gets:

> **3.7×** increase in views · **3×** increase in sales

Format constraints, `FACT-S`: **MP4, 10–60 seconds, one video per listing**, uploadable via both
Shopee App and Seller Centre.
([\[MY\] Optimising your Product Listings](https://deo.shopeemobile.com/shopee/seller/seller_cms/48aef334d826a3a81324516f2cd83edc/%5BMY%5D%20Optimising%20your%20Product%20Listings.pdf))

Caveat the multiplier honestly: this is a **vendor's own marketing figure from a 2021-stamped
deck**, almost certainly measured across all categories and confounded by the fact that sellers who
bother to shoot video are better sellers generally. Treat 3.7×/3× as directional, not a forecast.
Even discounted heavily it is the best free lever available, and GameShare is uniquely well placed
to exploit it: **every game already has official Steam trailer footage and the repo already holds
per-game screenshots and banner art** (`docs/shopee-listings.md`, `brand/*`). A 15-second cut per
title is a mechanical, batchable job.

⚠️ One constraint carries straight over from `docs/shopee-listings.md`: whatever footage is used
must not depict online or co-op play, per the standing offline-mode rule. Trailer footage of a
multiplayer mode is a claim.

### 2. Fill every product attribute — free, one-off, explicitly a search input

`FACT-S`. The only listing field Shopee explicitly names as improving *search results*. Access via
**My Product → Batch Tools → Attribute Tool**, so it can be done in bulk across ~25 listings in one
sitting. Shopee's guidance: fill all mandatory attributes, and *"If your product does not have a
brand, please select 'No brand'"* — do **not** leave brand blank or type something irrelevant, which
is Attribute Spam (penalty-bearing, see below).

### 3. Top Keywords + Shopee Keyword Planner — free first-party MY search data

`FACT-S`. Two separate free tools, both behind Seller Centre login:

- **Top Keywords** (Business Insights → Selling Coach → Top Keywords): *"allows you to browse the
  most-searched keywords for your top 3 categories."* Shopee's own instruction: *"Name your listings
  with the most-searched keywords if it's relevant to your products. Instead of expanding your
  product selection to include all top keyword searches, focus on the top 3 keyword searches to
  maximise your impact."* (`[MY]` EN ADVANCED)
- **Shopee Keyword Planner** (inside the Ads console): shows each keyword's **search volume and
  suggested bid price**. (Ads Intermediate deck) — **you do not have to spend to read it**, though
  `UNSOURCED — MUST VERIFY` whether the planner is visible without any ads credit topped up.

**Why this matters more than it looks:** `docs/listing-copy.md` states plainly that its Malay
keyword choices *"rest on general Malaysian commerce vocabulary rather than observed search data"*
and calls the Malay phrasing *"a hypothesis to A/B, not an established win."* These two tools are
the observed data. Fifteen minutes in Seller Centre resolves a question the repo currently carries
as an open unknown. **This is the single highest-value thing on this list that only Chaison can
do** — no agent can reach a logged-in Seller Centre.

### 4. Follow Prize — buys followers, which are the input to every other free channel

`FACT-S`. **Marketing Centre → Follow Prize.** A voucher auto-offered by pop-up to qualified buyers
when they land on the shop page during the event window; the follower receives it straight into
their voucher wallet. Shopee's own design rules (`[MY]` EN ADVANCED):

- Make it a **shop voucher applicable to all products**, not a product voucher.
- **Duration must be more than one day.**
- Set a fixed amount or percentage, and *"Make sure that it is larger than other vouchers in the
  store."*

Followers are the addressable audience for Feed and for the follower half of Chat Broadcast, so
this is the upstream lever. Note the competitor benchmark: Cyber Space and GamerSpace sit at 21.1k
and 22.7k followers (`2026-09-05-competitor-landscape.md`).

⚠️ **Margin warning specific to GameShare.** At RM2–9 price points against a 21–38% effective take
rate, a fixed-amount voucher is enormous in percentage terms. An RM1 follow prize on an RM3 order
is a third of the price on top of ~32–38% in fees. Model the voucher against the net-of-fee figures
in `2026-09-05-competitor-demand-and-unit-economics.md` before setting an amount — a percentage
voucher is far safer than a fixed one at these prices.

### 5. Chat Broadcast — including the one sanctioned way to chase reviews

`FACT-S`. Free tool that pushes a message (plus **one** voucher, and product links) to a targeted
buyer group via Shopee Chat **and push notification**. Shopee's claimed effect: *"Drive up to +9%
Extra Sales"*, *"Boost up to +22% Shop Visits"*, *"1 in 10 broadcast read will drive orders"*
(`[MY]` EN ADVANCED — again, Shopee's own marketing numbers).

**Default recipient groups** (`FACT-S`), pick one per broadcast:

| Group | Targets |
|---|---|
| Recommended Followers | shop followers |
| Top 10% Buyers | top decile of the shop's buyers |
| Abandoned Cart Shoppers | added-to-cart, didn't buy |
| **User Pending Review** | **bought from the shop but have not left a review** |

**Quota ladder** (`FACT-S`), reviewed **every Monday 00:00** on trailing-30-day performance:

| Level | Buyers & Followers quota | Open Rate | Click-Through Rate |
|---|---|---|---|
| Level 1 | 1 per 2 weeks | <15% | <15% |
| Level 2 | 1 per week | 15–<30% | 15–<30% |
| Level 3 | 2 per week | ≥30% | ≥30% |

*"If your Open Rate and Click Through Rate fall into two different levels, the lower level will
determine your Chat Broadcast quota."* Both must clear a level to advance. Also `FACT-S`: sent
broadcasts **cannot be recalled**, and **a buyer can only receive 1 broadcast per day** platform-wide.

⚠️ **Two GameShare-specific traps.**
- `FACT-S`: *"If a recipient sends a follow-up message after you send a broadcast, sellers should
  first chat respond within 12 hours in order to maintain their Chat Response Rate (CRR)."* A
  broadcast to a large group creates an inbound reply wave with a 12-hour SLA, against a **sole
  operator with an automated pipeline**. CRR is one of the four Account Health metrics the
  economics file established feeds standing. **Do not broadcast without being able to staff the
  next 12 hours.** Competitor benchmark: GamerSpace answers within minutes at 99%
  (`2026-09-05-competitor-landscape.md`).
- `FACT-S`: the deck marks Chat Broadcast **"*only for selected sellers"**. Availability for a small
  new shop is `UNSOURCED — MUST VERIFY` in Seller Centre.

### 6. My Shop's Shocking Sale — self-nominated flash slots

`FACT-S`. **Marketing Centre → My Shop's Shocking Sale.** Lets a seller *"nominate their products
into upcoming Shocking Sale time sessions in your own shop"* — a limited-time offer with a
countdown, on the shop's own storefront, on slots the seller picks. Four steps: create slot, choose
date/time, add products, save and submit. No approval gate described, unlike platform-wide
campaigns. This is the closest thing to a campaign a small shop can run unilaterally.

### 7. Shop vouchers

`FACT-S`. **Marketing Centre → Vouchers.** Set reward type and **minimum basket price**, and choose
display placement: *"storefront, specific channels like Shopee Feed, Shopee Live or do not
display."* A **Smart Voucher** toggle exists where Shopee recommends the budget setting.

The minimum-basket-price field is the interesting one for GameShare: it is the mechanism behind
GamerSpace's captured "RM3 off, min spend RM20, ×3" voucher
(`2026-09-05-competitor-landscape.md`) — a bundle-forcing device on a catalogue whose modal price
is RM1.89–4.99. Same margin warning as Follow Prize applies.

### 8. Bundle Deal / Add-on Deal — structurally the most interesting, and under-explored

`FACT-S`. Both live in Marketing Centre. **Add-on Deal** attaches a discounted or free add-on to a
main product; **Bundle Deal** groups products for a combined discount; **Wholesale** discounts on
quantity.

This connects directly to the most important finding in the existing research set:
`2026-09-05-market-blind-spots.md` §1 (flagged in the competitor files as "the most important
finding in this research set") records that **GamerSpace's two highest-volume products are bundles,
not games** — an ALL-IN-1 bundle at RM18.99 with 10k+ sold. Bundle Deal is the native Shopee tool
for that shape of product. Not analysed further here: bundle *strategy* is a pricing/catalogue
question owned by those files, not a growth-lever question.

⚠️ `FACT-S` policy constraint: **add-ons must not be listed separately** — *"Add-on(s) should be
included as part of an item's variation and should not be listed separately"* — doing so is Price
Spam.

### 9. Shop decoration

`FACT-S`. **Shop Decoration** in Seller Centre lets sellers design the shop page. Shopee's line:
*"Every seller is recommended to use Shop Decoration to maximise their sales potential."* No
quantified impact given, and no evidence it touches ranking — this is a conversion/trust lever for
buyers who already reached the shop. Relevant competitive context: the axis a shop organises by is
a real differentiator (GamerSpace's use-case categories including "Lifetime Offline Games" beat
Cyber Space's platform categories — `2026-09-05-competitor-landscape.md`). Low effort, low ceiling.

### 10. Shopee Feed

`FACT-S`. Post photos/videos with **product tags** and **voucher tags**; posts with voucher tags
accumulate in Feed's voucher tab. Two voucher-tag types: **Feed Exclusive** and **Feed Regular**.
Shopee's suggested content mix: new product release, follower giveaway, best-selling product,
discounts/promotions, and *"Publish posts before the start of the campaign to alert and drive
excitement among followers."*
([\[MY\] Shopee Feed User Guide](https://deo.shopeemobile.com/shopee/seller/seller_cms/be22b701f57ac1108de3d0e4055011b4/%5BMY%5D%20Shopee%20Feed%20User%20Guide.pdf))

Ranked low **because Feed reaches followers**, and a new shop has few. It becomes worthwhile after
Follow Prize has built a base. Posting cadence limits: `UNSOURCED — MUST VERIFY`.

### 11. Shopee Live — effectively unavailable

- **ASSUMPTION (secondary source).** Desktop livestreaming requires **10,000 followers**; mobile
  requires only an active listing and an account in good standing.
  [shakalakaa.my](https://shakalakaa.my/blog/how-to-go-live-shopee-tiktok-malaysia) — a Malaysian
  seller-services blog, **not** Shopee. The 10k threshold is plausible and matches the pattern of
  other platforms but is not first-party.
- Even taking the mobile path, live selling is a **synchronous, high-hour-count channel** and
  GameShare is one person running an automated pipeline. **Nearest working alternative:** pre-recorded
  **product video** (lever 1) and **Feed video posts**, which capture much of the format's benefit
  with none of the scheduling cost.
- Shopee MY does publish Live Community Guidelines at `seller.shopee.com.my/edu/article/1326` —
  **unfetched** (SPA).

### 12. Free Shipping Programme — probably structurally unavailable

- **ASSUMPTION (secondary sources), important if true.** Joining requires the seller to *"Sign up
  for at least one Free Shipping Programme with a **Shopee Supported Logistics Partner**"**, keep
  penalty tier below tier 2, and have ≥1 listing.
  ([Ginee](https://ginee.com/my/insights/shopee-free-shipping-program/),
  [SiteGiant](https://sitegiant.my/blog/shopee-free-shipping-programmes/) — both third-party.)
- `INFERENCE`. GameShare ships on **Virtual Goods**, which
  `2026-09-06-shopee-virtual-goods-shipping-requirement.md` establishes as a **Non-SSL**
  (*Non-Shopee-Supported Logistics*) channel. If the eligibility rule above is accurate, then
  **GameShare cannot join the Free Shipping Programme at all** — it has no SSL channel to sign up
  with. That would simultaneously (a) close off the Friday spotlight and Free Shipping badge the
  economics file flagged as a possible visibility boost, and (b) **remove the ~5.94% service fee**
  from GameShare's cost stack, which means **Scenario B in the economics file (20.8–32.0% take
  rate) is the correct model, not Scenario A.**
- `UNSOURCED — MUST VERIFY` — this is an inference from a third-party eligibility statement, and it
  moves the unit-economics model. **Check Seller Centre → Marketing Centre → Free Shipping
  Programme for whether the option is even offered.** This is a high-value 60-second check.

---

## Paid levers, ranked by impact per ringgit

### The blunt answer first

**Do not run Shopee Ads yet.** Three independent reasons, all sourced:

1. **The model GameShare would want is being switched off.** `FACT-S`: *"All existing Manual
   Keyword Campaigns will be automatically upgraded to GMV Max"*, and in the migration window,
   *"D-7 onwards: manual ads become non-editable, and new manual ad creation stops."* Keyword
   selection is gone: *"Keyword selection is no longer required in GMV Max. It uses an Auto Keyword
   strategy."* Manual bidding, match types and custom bids *"no longer apply."*
   [ads.shopee.com.my/learn/faq/505/2053](https://ads.shopee.com.my/learn/faq/505/2053). Learning
   a manual keyword workflow now is learning a dead skill.
2. **GMV Max needs volume GameShare does not have.** `FACT-S`: campaigns require *"at least 7
   days"* of learning phase before actual ROAS converges to *"80%-120% of target ROAS"*.
   [ads.shopee.com.my/learn/faq/78/1831](https://ads.shopee.com.my/learn/faq/78/1831). Seven days
   of unoptimised spend, **per product**, across a catalogue whose orders are worth RM2–9 gross and
   roughly RM1.86–6.34 net (economics file).
3. **The arithmetic is brutal at these prices.** With minimum bids at RM0.07 (below) and net revenue
   as low as **RM1.86 on an RM3.00 order**, breakeven is about **26 clicks per conversion**. That is
   not an impossible conversion rate — but it leaves zero margin for the learning phase, and it
   assumes the floor bid wins impressions, which Shopee's own minimum-bid announcement implies it
   often does not.

### Ad types and what each costs

`FACT-S` — four products named in the Malaysia Ads deck:

| Ad type | Where it shows | Available to GameShare? |
|---|---|---|
| **Keyword / Product Search Ads** | search results page | Yes (migrating to GMV Max) |
| **Targeting / Discovery Ads** | Daily Discovery on homepage, "Similar Products", "You May Also Like" | Yes, if eligibility met |
| **Shop Ads** | top of search results, shop name + logo | **No** — see below |
| **GMV Max** (auto-bid or Custom ROAS) | *"Product Feeds across all Platform Traffic"* — Search, Discovery, Video, Games, Coins | Yes; the future default |

**Billing model** `FACT-S`: **PPC — pay per click, never per impression.** *"You won't be charged by
impression; you will only be charged when shoppers click on your ads."* Cost is drawn from a
prepaid **Shopee Ads Credit** balance which is *"non-refundable and has no expiry date"*. Invalid
clicks (repeated clicks from one user, automated clicks) are auto-detected and not charged.

**Minimum bid prices** — ⚠️ **two sources disagree; reporting the conflict, not picking a winner:**

- `FACT-S`, first-party but **old**: **Product Search Ads RM0.07, Discovery Ads RM0.07, Shop Search
  Ads RM0.15**, effective **24 November 2022**.
  [ads.shopee.com.my/news/1282](https://ads.shopee.com.my/news/1282). This is Shopee's own
  announcement page but is nearly four years old.
- **ASSUMPTION** (search-engine synthesis of `ads.shopee.com.my` pages, not read verbatim on a
  dated page): **RM0.14** for both Discovery and Search Ads.
- Both cannot be current. **UNSOURCED — MUST VERIFY** which applies in 2026; the live figure is
  shown in the Ads console at bid-setting time.

**Minimum and recommended budgets** `FACT-S` (Ads Intermediate deck):

- **Keyword Ads / Targeting Ads:** *"Recommend to set daily budget between RM 3 - 6"*, and *"Allow
  ads run at least for 2 weeks to gather enough data."* → **a genuine minimum viable test is
  roughly RM42–84 per product**, not RM3.
- **Shop Ads:** *"The minimum daily budget required is RM4. The minimum total budget required is
  RM40."*
- **GMV Max minimum budget in RM:** `UNSOURCED — MUST VERIFY` — the GMV Max FAQ does not state one.
  A US$10/day minimum for "Max Delivery Optimization" appears in third-party writeups; **not
  Malaysia-confirmed and not to be quoted as fact.**

**Typical CPC ranges in Malaysia:** `UNSOURCED — MUST VERIFY`. No credible MY-specific CPC
benchmark by category was found. The floor bid is sourced above; **actual clearing CPC is
auction-dependent and is only observable in the seller's own Ads console.** Any blog quoting a
"typical Shopee MY CPC" should be distrusted.

### Shop Ads are out of reach — and the threshold explains why

`FACT-S`: *"Shop Ads is open only to Mall sellers, Preferred sellers and selected sellers with good
track record in sales and shop ratings."* (Ads Intermediate deck)

**ASSUMPTION** (secondary, but numerically specific and consistent): as of **2 February 2026**,
Preferred Seller requires **average daily GMV of RM1,650 AND average daily orders of ≥20 in the
previous month**, plus a shop rating typically ≥4.8. Sourced from
[duoke.com](https://www.duoke.com/en/blog/article/45-Latest-policy-on-Shopee-Preferred-Sellers) and
an Alibaba seller-insights page, both citing `seller.shopee.com.my/edu/article/20613` ("Updated
Policy Criteria (Preferred, Mall Sellers)") — **which is SPA and could not be opened.**

Sanity-check the scale for GameShare: **RM1,650/day at a ~RM4 average order is ~410 orders/day.**
Preferred Seller is not a near-term target and Shop Ads should be treated as unavailable.

### Targeting / Discovery Ads eligibility

`FACT-S` — the only ad product with published, low, *reachable* eligibility criteria:

- shop has **at least one rating** from a user;
- shop is **not on Vacation Mode**;
- shop has been **active in the past 14 days**;
- the advertised product is not an adult listing;
- up to **10 products** selectable at a time.

If Chaison ever does test paid, **Discovery/Targeting is the one to test**, at the recommended
RM3–6/day for two weeks on a **single** proven-selling title — not spread across the catalogue.

### Verdict on paid

**Ads are a trap at this scale — but a shallow trap, not a deep one.** The failure mode is wasting
RM50–100 discovering that RM2–9 digital goods do not survive a CPC, not blowing a budget. The
useful thing in the Ads console is **free**: the Keyword Planner's search volumes. Log in, read
the data, spend nothing.

---

## Affiliate and KOL

**Shopee Affiliate Marketing Solution (AMS)** is the seller-side programme; the **Shopee Affiliate
Programme** is the creator-side one. A seller joins AMS from Seller Centre and sets a
**Commission XTRA** rate; affiliates then choose whether to promote.

`FACT-S` — commission mechanics from Shopee's own Malaysia help centre
([\[ENG\] Shopee Affiliate Commission Model](https://help.shopee.com.my/10/article/140905-%5BENG%5D-Shopee-Affiliate-Commission-Model)):

- Two components: **Shopee Commission** (paid by Shopee, category- and new/existing-customer
  dependent, **capped at RM5 per completed order** at a 1% baseline) and **Commission XTRA**
  (**set and paid by the seller**).
- **Attribution:** *"Every click from affiliate link has a 7-days attribution window, and commission
  is calculated based on last click attribution."*
- **Same-shop vs different-shop orders both pay.** Effective **24 May 2026**, on *different-shop*
  orders affiliates receive **50% of the rate set by the seller** for Commission XTRA, up from 30%.
- Rates differ across social media, Shopee Video and Shopee Live placements.

**ASSUMPTION (secondary sources — BigSeller, Reacheffect, KayaToday, all third-party):** the seller
Commission XTRA **minimum is 4%**; a seller setting **≥5%** but below Shopee's category-recommended
rate lands in **AMS Lite**, and matching the recommended rate qualifies for **AMS Elite** with
better affiliate exposure. **None of these tier names or numbers were confirmed on a fetchable
Shopee page** — `seller.shopee.com.my/edu/article/26669` ("AMS Commission Rules") and `/20181` are
both SPA and **unfetched**.

### Is it worth it for GameShare?

**Probably yes, and it is the best paid-ish lever available — because it is pay-on-result.**

The reasoning, labelled `INFERENCE`:

- Unlike Ads, **AMS costs nothing unless an order completes.** There is no learning phase, no daily
  budget, no floor bid. For a shop that cannot absorb speculative CPC, a pure revenue-share is the
  structurally correct channel.
- The cost is real, though: at a **4–5% Commission XTRA** on an RM3.00 order (RM0.12–0.15) stacked
  on ~32% in platform fees, net falls from ~RM2.04 to ~RM1.89. **Survivable.** At the 10–12%
  category-recommended rates the secondary sources describe for AMS Elite, it is RM0.30–0.36 —
  still survivable, but now a real slice of a ~RM2 net.
- **The category fit is unusually good.** Malaysian gaming content creators on TikTok/Instagram are
  numerous, cheap, and their audience is exactly the buyer for a RM3 Steam game. The 7-day
  last-click window is generous.

⚠️ **But there is a policy collision to check before joining.** The `[MY]` Listing Violation Guide's
Advertisement rules prohibit driving buyers off-platform *from a listing*. AMS is Shopee's own
sanctioned off-platform promotion channel, so affiliate links are plainly fine — but **anything
GameShare itself publishes on its own social channels that links buyers to a non-Shopee checkout is
a different matter.** Keep GameShare's own promotion pointing at the Shopee listing.

**UNSOURCED — MUST VERIFY:** whether Virtual Goods / digital-goods listings are **eligible** for AMS
at all in Malaysia. Nothing found either way. Given how many Shopee programmes turn out to be
SSL-gated, do not assume eligibility.

---

## Category, policy and enforcement risk

This section is deliberately unsoftened, per the brief.

### The live, currently-accruing exposure: external URLs in listings

`FACT-S` — verbatim from the Malaysia-specific
[\[MY\] Listing Violation Guide](https://deo.shopeemobile.com/shopee/seller/seller_cms/497b58681fce97d35c7638339b7b7118/%5BMY%5D%20Listing%20Violation%20Guide.pdf),
under **Prohibited Listings/Advertisements → Advertisements**:

> "Sellers should not use the product description and/or photos to inform buyers to contact them via
> third-party channels such as WhatsApp, LINE, Facebook or include any URLs to an external website
> with intention to direct transactions outside of the Shopee platform.
>
> Sellers who list any form of advertisements will incur penalty points under Shopee's Seller
> Penalty System (Prohibited)."

**GameShare's delivery model sends the buyer to gameshare.space to paste their Shopee order id and
retrieve credentials.** Read the rule closely, because the exposure is real but narrower than it
first looks:

- The prohibition is on URLs *"with intention to direct **transactions** outside of the Shopee
  platform."* GameShare's URL directs **fulfilment**, not the transaction — the sale completes on
  Shopee, and the site is reachable only with a valid Shopee order id. That is a materially
  different thing from a WhatsApp number that takes the payment off-platform, and it is a defensible
  position.
- But it is a position that has to be **argued**, and it would be argued after an automated flag,
  by a human reviewer, against a policy whose plain text says *"include any URLs to an external
  website"*. Two clauses are joined here and the enforcing system may not read them as conjoined.
- **Penalty band:** `FACT-S` — *"Every 2 prohibited listings deleted by Shopee will lead to 1
  penalty point."* Because the retrieval URL would sit in **every** listing, this is not a
  one-listing risk. **25 listings flagged ≈ 12 penalty points**, which is double the 6-point
  threshold that caps a shop at 100 listings for 28 days.

**Mitigations that do not require abandoning the model** (`INFERENCE`, not sourced advice):

- Deliver credentials **via Shopee Chat**, which the pipeline already does
  (`app/api/webhooks/shopee/route.ts`), and which
  `2026-09-06-shopee-virtual-goods-shipping-requirement.md` establishes is *also* what Shopee
  accepts as Virtual Goods proof-of-delivery. Chat is the on-platform, policy-clean channel and it
  is already built.
- Keep the URL **out of listing titles, descriptions and images** specifically — the three surfaces
  the policy names — and let the site be reached from the chat message instead.
- ⚠️ **UNSOURCED — MUST VERIFY:** whether Shopee's chat-content moderation applies the same
  external-URL rule to **chat messages**. The quoted policy names *"product description and/or
  photos"* only. Given the pipeline sends URLs over chat automatically at scale, this is worth
  confirming with Shopee Seller Support before assuming chat is safe.

**This is the highest-priority item in this file. It is not a marketing question, but it caps every
marketing outcome.**

### Which category do shared-account listings belong in?

`UNSOURCED — MUST VERIFY`. The Shopee MY category tree lives at
`seller.shopee.com.my/portal/categories` (cited in the `[MY]` Listing Violation Guide) — **behind
the SPA, unfetched.** No public source enumerates whether a "Digital Goods"/"Video Games" L3
category exists in Malaysia.

What is `FACT-S` about the choice:

- **Category Spam is a named, penalty-bearing violation.** *"Category spam are listings that have
  been placed in the wrong category."* Penalty band: *"Every 5 Spam listings deleted will lead to 1
  penalty point."*
- Shopee's own recommended method for resolving it is empirical and available to Chaison right now:
  *"If you are unsure which category your item should be under, you can try searching for that type
  of item on Shopee, and see which category and sub-category it belongs to."* **Look at where Cyber
  Space and GamerSpace list — two shops with 6 years of survival each — and match them.** That is
  Shopee's own stated method, and it doubles as competitive intelligence.
- `FACT-S`: *"Avoid selecting 'Others' in the sub-category selection."*
- `FACT-S`: **listing the same item under two categories is Duplicate Listing spam**, so this is a
  single-choice decision, not a hedge.

### Is selling shared Steam accounts against Shopee policy?

**Malaysia's public policy: still an absence, not a prohibition.** Re-verified this pass. The
[Prohibited and Restricted Items Policy](https://help.shopee.com.my/portal/4/article/77220-Prohibited-and-Restricted-Items-Policy)
(**last updated 22 May 2025**) lists 33 categories; none names game accounts, shared accounts, or
credentials. **Already covered in `2026-09-05-shopee-my-seller-economics.md`** — that file's
verbatim analysis stands and is not repeated.

**One new wrinkle this pass surfaced.** Clause **(xx)** reads:

> "Unless expressly allowed by Shopee, the provision of services, including but not limited to
> services that are sexual, illegal in nature or in violation of the Terms of Service, are
> prohibited"

*"in violation of the Terms of Service"* is open-ended, and the sale of access to a Steam account
**is** a violation of Valve's terms (next section). Whether Shopee reads "the Terms of Service" as
*its own* or as *any applicable* is not stated. `UNSOURCED — MUST VERIFY`, and probably
unresolvable from public text — but it is the clause an enforcement action would most plausibly
hang on, and it is closer to the mark than clause (xix) "potentially infringing items", which the
economics file identified as the nearest fit. **Note the clause number for any future appeal.**

**What could NOT be re-checked:** the MY `[MY]` Listing Violation Guide, unlike the Philippines
"General Prohibited Items" PDF the economics file found, **contains no "Digital Goods" section at
all.** Its prohibited-items page lists Drugs, Alcohol, Wildlife products, Weapons, Services,
Cigarettes, Medicine, Stocks, Stolen goods, Prohibited food, Sexually explicit content. **Game
Accounts do not appear.** This is now a *second, independent Malaysia-specific first-party
document* confirming the absence — which strengthens the economics file's finding materially. The
absence is no longer resting on one page.

### Is it against Steam's terms? Yes, unambiguously.

`FACT-S` — [Steam Subscriber Agreement](https://store.steampowered.com/subscriber_agreement/),
**last updated 20 April 2026**, quoted verbatim:

> "You may not sell or charge others for the right to use your Account, or otherwise transfer your
> Account"

> "You may not reveal, share or otherwise allow others to use your password or Account except as
> otherwise specifically authorized by Valve."

> "you must not use your Account to enable a violation of this Agreement by others"

And on enforcement:

> "Valve may restrict or cancel your Account or any particular Subscription(s) at any time in the
> event that (a) Valve ceases providing such Subscriptions to similarly situated Subscribers
> generally, or (b) you breach any terms of this Agreement"

> "You acknowledge that Valve is not required to provide you notice before terminating your
> Subscription(s) and/or Account."

Note the third quote specifically: *"you must not use your Account to enable a violation of this
Agreement by others"* — that clause reaches the buyer's conduct, not just the seller's.

**Plain reading of the exposure, stated without moralising:**

- The business model breaches the SSA on its face. There is no ambiguity clause to argue.
- The asset at risk is **the pooled Steam accounts and the games on them** — GameShare's entire
  inventory, purchased at RM13.99–299.00 per account (`2026-09-05-competitor-pricing.md`). Valve
  terminates with **no notice** and **no refund of purchased content**.
- Valve's enforcement mechanics are `UNSOURCED — MUST VERIFY`. Third-party sources describe
  automated detection of *"logins from multiple locations within a short period"*, which is exactly
  the signature of a pooled shared account and is plausible — but that is
  [GamerGuru](https://gamerguru.blog/are-shared-steam-accounts-legal) and similar blogs, **not
  Valve**, and their claims about detection methods are speculation dressed as fact. **Do not plan
  against a specific detection mechanism on this evidence.** What IS certain is the contractual
  right and the absence of a notice requirement.
- Practically, the competitor evidence argues enforcement is **not aggressive**: Cyber Space and
  GamerSpace have run this model for **six years** each, at 678 and 334 listings, with 105k and
  98.6k ratings (`2026-09-05-competitor-landscape.md`). That is a very large observed survival
  sample. It is not a guarantee, and it is survivorship-biased by construction — shops that were
  killed are not in the captured sample.

**Bottom line for Chaison:** the Shopee-side risk is *manageable and mostly self-inflicted* (the
external-URL issue, title spam, category choice — all fixable). The **Valve-side risk is
structural, unfixable, and uninsured**, and it is a risk to inventory rather than to the storefront.
It argues for keeping per-account acquisition cost low and the account pool diversified, which is a
catalogue decision owned by `2026-09-06-games-to-buy.md`, not this file.

### The other penalty signals, with their bands

All `FACT-S` from the `[MY]` Listing Violation Guide.

**The penalty table** (as printed; the source PDF's table layout is mangled by extraction, so the
target/points mapping below is the most defensible reading and is flagged as such):

| Listing Violation Type | Target | Points |
|---|---|---|
| Prohibited listings / advertisements | <2 | 1 |
| Spam | <5 | 1 |
| Counterfeit | <2 | 1 |

> "Note: Sellers with severe listings violations will earn 2 penalty points."

Restated in Shopee's own prose elsewhere in the same deck, which is the reliable version:
**"Every 2 prohibited listings deleted by Shopee will lead to 1 penalty point"** and **"Every 5
Spam listings deleted will lead to 1 penalty point."**

Also `FACT-S`:
- *"Sellers who reupload listings previously banned due to spam (wrong category, keyword spam,
  wrong attributes etc.) without editing will have their listings deleted and earn 1 penalty point"*
- *"Sellers who reupload previously deleted listings will earn 1 additional penalty point"*

**Listing-limit consequences** `FACT-S`:

| Trigger | Listing limit |
|---|---|
| 3+ listing-violation penalty points | **500** (for 28 days) |
| 6+ listing-violation penalty points | **100** (for 28 days) |
| 10%+ of listings set to pre-order | 1,000 (until pre-order % <10%) |

And the **normal** seller-tier limits, for context — GameShare at ~25 listings is nowhere near any
of them:

| Seller tier | Listing limit |
|---|---|
| <30 days on Shopee OR <5 unique orders | 1,000 |
| ≥30 days AND 5–100 unique orders | 3,000 |
| ≥30 days AND >100 unique orders | 5,000 |
| Preferred Sellers | 10,000 |
| Shopee Mall Sellers | 20,000 |

**Enforcement escalation ladder** `FACT-S`, verbatim:

> "Violations of this Prohibited and Restricted Items Policy may subject the Seller to a range of
> adverse actions, including but not limited to any or all of the following:
> - Listing deletion (penalty point may impose)
> - Limits placed on Account privileges
> - Account suspension and termination
> - Legal actions"
>
> "Note: Shopee reserves the rights to remove any listings in breach of the aforementioned policy
> without notice"

So: **listing takedown → listing-limit cap → privilege loss → suspension/termination.** Repeated
offenders in several categories *"may be frozen."*

### Keyword spam — a direct hit on the current title formula

`FACT-S`. Shopee's Malaysia title guidance:

> - "Don't use subjective commentaries such as 'Hot Item' or 'Best Seller'"
> - "Don't use promotional messages such as 'Sale' or 'Free Shipping'"
> - "Don't use irrelevant search terms in your product title, otherwise it would be considered as
>   Keyword spam"
> - "Emoticons / emoji, symbols or hashtags are not suggested, including but not limited to
>   }, -, $, ^ , {, <, !, *, #, @, ;, %, >"
> - Recommended format: **"Brand + Product Name + Model"**

And from the violation guide's Keyword/Brand Spam definition:

> "Including multiple or irrelevant brand names and keywords in the product title, e.g. 'Women's
> pants skirts shirts'"

**Not rewriting copy — out of scope — but the policy fact must be recorded:** the live title
formula documented in `docs/listing-copy.md` is
`<Game> | Steam PC Game | FULL GAME | 24H AUTO DELIVERY | ORIGINAL | OFFLINE`. Measured against the
rules above: `FULL GAME` / `24H AUTO DELIVERY` / `ORIGINAL` are promotional messages, not product
identity; the pipe-delimited stack is the "multiple keywords in the title" shape the spam rule
describes; and while `|` is not in the enumerated symbol list, the list is explicitly *"including
but not limited to"*. **The formula sits in enforcement range.** It also happens to be the formula
every competitor uses, which is the usual reason a risky pattern feels safe.

Note the tension honestly: `2026-09-05-shopee-my-seller-economics.md` correctly warns that Shopee's
own documentation is internally inconsistent, and the title-guidance deck here is **stamped 2021**
while the violation guide is undated. The *spam definition* is the load-bearing one and appears in
both. **Flagging for the listing-copy agent and for Chaison; not acting on it here.**

### Two competitor tactics that are named violations

Recorded because `2026-09-05-competitor-pricing.md` documents both approvingly as market mechanics,
and they are not safe to copy:

1. **The permanent anchor-price ladder.** `FACT-S`: *"Misleading discount refers to the situation in
   which sellers markup product original prices just before a promotion to exaggerate the discounts
   given. Such price manipulation and fake discount is not allowed on Shopee."* Shopee identifies it
   from the **historical price change log**. Consequence: *"Listings with misleading discount will
   be suspended for first offence, with no penalty as a warning. However, if there is any subsequent
   offense … all listings found with the behavior of misleading discount will be deleted under the
   reason of 'Prohibited Listing'."* The competitor files describe Cyber Space's discount curve as
   *"a merchandising artefact, not a sale"* — that is the violation, described neutrally.
2. **Parking a listing at an absurd price.** `FACT-S`: *"Sellers who list their products at
   extremely low (e.g. RM0.10) or high prices (e.g **RM9,999**) beyond the actual market value of
   the product will be identified and removed by the system."* Cyber Space's **Breathedge 2 at
   RM9,997** (competitor-pricing.md §"Two prices sit outside the ladder") is textbook Price Spam,
   RM2 under Shopee's own worked example. The RM0.29 and RM0.36 floor listings sit near the other
   end of the same rule.

Also relevant to a shared-account shop where accounts die and get replaced — `FACT-S`:
**Switched Listings.** Editing a live listing to sell a different item is prohibited and
*"Reviews may also be removed from your shop."* Shopee assesses images, title, category, price,
attributes, description. But the FAQ is explicit that ordinary maintenance is fine:

> "Q: Can I change the price or edit the product's title and description?
> A: Yes. Editing a listing's price, title and description is allowed as long as the item being sold
> remains unchanged."

So **retitling a listing for SEO is explicitly safe**; **repointing a Cyberpunk listing at a
different game to keep its sold count is not**, and would cost the shop its reviews.

Finally, `FACT-S` — **Junk**: *"Listings not in Bahasa Malaysia / English / Chinese Language"* are
Junk violations. The Malay-language title rotation in `docs/listing-copy.md` is safely inside this.

---

## Ratings and reviews

### How they weigh

**Already covered** in `2026-09-05-shopee-my-seller-economics.md`: Shop Rating is an Account Health
metric, gates Preferred Seller eligibility, and Shopee's own framing says higher-scoring shops
*"naturally rank on earlier pages in search."* No numeric weighting is published, in any market.
Not re-derived.

New, `FACT-S`: **Customer Satisfaction is one of the four Account Health categories**, described as
*"Provide buyers with ideal shopping experience for high ratings and feedback"* (`[MY]` EN
ADVANCED). Ratings are therefore a scored metric, not merely a display element.

### The mechanics buyers actually face

`FACT-S` — [Shopee MY Help Centre, Product Ratings](https://help.shopee.com.my/portal/4/article/78919-%5BProduct-Ratings%5D-How-do-I-rate-and-review-a-product)
(no last-updated date shown on the page):

- Buyers rate **four dimensions**: Product Quality, Seller Service, Delivery Speed, Driver Service —
  5-star scale each. **Note that two of the four are logistics dimensions that GameShare cannot
  influence**, since Virtual Goods has no driver and no physical delivery. How those are handled for
  a Non-SSL digital order is `UNSOURCED — MUST VERIFY` and worth knowing: if buyers can rate
  "Driver Service" on an order with no driver, that is a structural rating drag.
- Only **completed** orders qualify: *"Returned, refunded or cancelled orders are not eligible for
  rating."* ⚠️ This interlocks with
  `2026-09-06-shopee-virtual-goods-shipping-requirement.md`: orders that never get `ship_order`
  called auto-cancel, and **an auto-cancelled order can never produce a review.** Fixing the
  shipping call is therefore also a *ratings* fix, not only a revenue fix.
- Items must exceed **RM0.50 paid** to earn review coins. Several competitor listings sit near this
  line (Stray at RM0.36, Crime Scene Cleaner at RM1.20 — competitor files); a listing priced under
  RM0.50 earns its buyer no coin incentive to review at all.
- **Shopee Coins incentives, paid by Shopee not the seller:** up to **3 coins** for a review of *"no
  less than 50 characters, excluding spacing"*; up to **5 coins** for that plus *"no less than 1
  photo"* or a **3–60 second video**. Max **2 rewards per item within 30 days**. Edits earn no
  further coins. Shopee *"reserves discretion to retract coins if the review contains
  irrelevant/inappropriate content."*

**ASSUMPTION (secondary — [Ginee](https://ginee.com/my/insights/shopee-buyer-rating/),
[Locad](https://golocad.com/blog/guide-to-shopee-product-buyer-seller-rating/)):** buyers are
prompted to rate within **15 days** of order completion and may edit once within **30 days** of
first rating. **Not confirmed on the Shopee help page fetched**, which contained no window at all.
Treat the 15/30 day figures as unverified.

### What a seller may and may not do

- **May, and should:** `FACT-S` — use **Chat Broadcast with the `User Pending Review` default
  recipient group**, which Shopee defines as *"Target buyers that bought from seller's shop but have
  [not] leave review."* **Shopee built a targeting segment whose entire purpose is nudging
  non-reviewers.** That is as clear an endorsement of review-solicitation-by-reminder as the
  platform gives. Subject to the quota ladder (1 per 2 weeks at Level 1) and the 12-hour CRR reply
  obligation.
- **May:** ask a buyer in chat what went wrong on a bad review and offer a fix; the buyer can edit
  their own review. **ASSUMPTION** (secondary — [BigSeller](https://www.bigseller.com/blog/articleDetails/4082/shopee-seller-rating-review.htm)),
  which also notes reports filed merely because a seller dislikes a star rating *will not be upheld*.
- **May not:** `FACT-S` — *"Gibberish content / **dishonest review**"* is listed under **Junk**,
  a Spam-class violation. That is the clearest first-party hook against fabricated reviews found in
  Malaysian material.
- **Incentivised reviews — the specific rule is `UNSOURCED — MUST VERIFY`.** No Shopee Malaysia page
  reachable in this pass states whether a seller may offer a voucher, coin, or gift in exchange for
  a review. One low-quality secondary source claims *"the keyword 'spam' found in the seller's
  product review will lead to a deduction of two penalty points"* — that sentence is incoherent and
  should be discarded, not repeated. **Do not offer anything in exchange for a review on the basis
  of this research.** The safe path is fully sourced and sits above: the `User Pending Review`
  broadcast is a reminder, not an inducement, and needs no policy exception.

⚠️ **Rating-farming is a live competitor tactic and is not clean.** `2026-09-05-competitor-pricing.md`
identifies Cyber Space's RM0.29 Naruto listing as *"a rating farm, not a profit centre."* Against
Shopee's Price Spam rule (*"extremely low (e.g. RM0.10) … with no intention to sell the items at the
listed price"*) that tactic is at risk on price grounds — and at RM0.29 it is under the RM0.50
coin-eligibility floor anyway, so it does not even buy the buyer an incentive to review.

---

## Campaign calendar and what to prepare

### The dates

**ASSUMPTION (secondary sources — no official Shopee MY 2026 campaign calendar page was
fetchable).** The Malaysian e-commerce year runs on:

- **Double-date mega sales: 9.9, 10.10, 11.11, 12.12** — with **11.11 and 12.12 the two largest**,
  and 9.9/10.10 functioning as warm-ups.
- **Monthly payday sales** — Shopee MY runs a recurring payday campaign; a live landing page exists
  at [shopee.com.my/m/PaydaySale-calendar](https://shopee.com.my/m/PaydaySale-calendar) (not
  fetched — a buyer-side SPA).
- **Festive peaks: Raya, Merdeka, CNY, year-end.**

Sources: [Hansen Commerce](https://hansencommerce.com/insights-malaysia-mega-sale-calendar),
[salendar.com](https://salendar.com/shopee/) — both third-party commerce blogs. **No specific 2026
MY nomination deadline could be sourced.** Do not put a date in a calendar on this evidence; the
authoritative source is the campaign banner in Seller Centre.

`FACT-S` on **campaign shape**, from Shopee's own Raya deck: a mega campaign runs about **40 days**,
split into a long **"Campaign pre-hype"** phase and a short **"Campaign peak"**.
([\[EN\] Advanced - Raya Bersama Shopee](https://deo.shopeemobile.com/shopee/seller/seller_cms/e761b3470b1cf0ec4bb34da566c98d69/%5BEN%5D%20Advanced%20-%20Raya%20Bersama%20Shopee.pdf))
**The implication is the useful part: the work is front-loaded into the pre-hype window, not the
peak day.** By D-day the levers are already set.

`FACT-S` — Shopee's own claimed campaign uplift for sellers who use the marketing features:
**10× views, 8× followers, 6× conversion, 4× sales**, with the honest hedge printed alongside:
*"Shopee data shows that sellers who utilise Seller Features have, on average, more shop views and
shop followers."* That is a correlation statement in Shopee's own words. Treat the multipliers as
marketing.

### What a seller must do in advance

`FACT-S` — Shopee's own pre-campaign checklist (Raya deck, "Strategic Operations planning"):

> - Achieve good account health by meeting Shopee's performance targets
> - Beautify shop front
> - Keep an eye on competitor's pricing and provide special promotions
> - Make your products shine
> - Prepare sufficient stocks and update accurately

Plus, `FACT-S` from the same deck: *"Publish posts before the start of the campaign to alert and
drive excitement among followers"*, and *"Sellers are encouraged to attach high value D-day
vouchers in broadcast to increase shop view and conversion rate."*

Two GameShare-specific translations, `INFERENCE`:

- **"Prepare sufficient stocks"** means *buy the pooled accounts before the campaign, not during*.
  A campaign spike against a thin account pool produces exactly the failure mode
  `2026-09-06-shopee-virtual-goods-shipping-requirement.md` warns about: unfulfilled orders, auto
  cancellation, refunds, and a Return/Refund rate that can cost the Virtual Goods channel outright.
  **For GameShare, campaign preparation is primarily an inventory decision.**
- **"Achieve good account health"** is a gate, not advice — see the eligibility problem next.

### The eligibility problem — likely a hard no

**ASSUMPTION (secondary sources, but consistent and consequential).** Platform campaign nomination
generally requires: minimum review count, in-stock inventory, a minimum discount off original price,
an account in good standing with no policy violations — and, critically,
*"Shopee mandates corporate qualifications—valid business licenses—and typically does not accept
individual sellers for mega sales."*
([Hansen Commerce](https://hansencommerce.com/insights-malaysia-mega-sale-calendar),
[duoke.com](https://www.duoke.com/en/blog/article/250-Shopee-Seller-Guide-2026-Growth-Planning))

`INFERENCE`, and it lines up with something already in the repo: `CHECKPOINT.md` open item 4b and
`seller.shopee.com.my/edu/article/3695` (per the virtual-goods research) record a **Registered
Business KYC prerequisite effective 1 September 2026** for the Virtual Goods channel. If GameShare
must register a business for Virtual Goods anyway, that same registration is what would unlock
campaign nomination. **These two requirements should be handled as one task, not two.**

**UNSOURCED — MUST VERIFY:** whether Shopee MY campaign nomination is actually closed to
non-registered individual sellers. This is a third-party claim about a first-party gate.

**Nearest working alternative if platform campaigns are closed:** **My Shop's Shocking Sale**
(free lever #6) — self-nominated flash slots inside GameShare's own shop, no approval gate, timed
to coincide with the platform campaign's traffic. Plus **Follow Prize** and **shop vouchers**, which
need no nomination at all. A small shop can ride campaign-day traffic without being *in* the
campaign.

---

## The weekly routine this implies

Ordered so that the highest-value item is never crowded out. Roughly 2–3 hours per week after a
one-off setup block. **Everything here requires Seller Centre login — no agent can do any of it.**

### One-off, before any routine starts (do these in order)

1. **Resolve the external-URL exposure.** Audit all ~25 listings for gameshare.space appearing in
   the title, description, or any of the four banner images. Move retrieval instructions into the
   Shopee Chat delivery message. *(Highest priority item in this file.)*
2. **Check whether the Free Shipping Programme is even offered** in Seller Centre → Marketing
   Centre. 60 seconds; determines which take-rate scenario in the economics file is real.
3. **Read Top Keywords** (Business Insights → Selling Coach → Top Keywords) for the shop's top 3
   categories, and the **Keyword Planner** in the Ads console. Write down actual MY search volumes.
   This retires the largest open unknown in `docs/listing-copy.md`.
4. **Confirm the category** by searching Shopee for a comparable Cyber Space / GamerSpace listing and
   matching its L3 category. Avoid "Others".
5. **Fill every product attribute** across all listings via My Product → Batch Tools → Attribute
   Tool. Set "No brand" where there is none.
6. **Create a Follow Prize** — shop voucher, applies to all products, duration >1 day, percentage
   (not fixed amount) given the RM2–9 price points.
7. **Confirm the `ship_order` gap is closed** (owned by
   `2026-09-06-shopee-virtual-goods-shipping-requirement.md`) — no marketing lever pays back while
   orders auto-cancel and refund.

### Weekly

| Cadence | Action | Why |
|---|---|---|
| **Mon** | Check Chat Broadcast quota + reward level (refreshes Mon 00:00). If quota available and the next 12h can be staffed, send one broadcast to **User Pending Review**. Attach one voucher. | Only sanctioned review-chaser; quota is use-it-or-lose-it |
| **Mon** | Check Account Health: penalty points, CRR, LSR, NFR, Shop Rating | Penalty points cap listings at 500 (3 pts) / 100 (6 pts) |
| **Mid-week** | Ship **2 new product videos** (MP4, 10–60s, offline-mode footage only) until every listing has one | 3.7× views / 3× sales, Shopee's own figure; ~13 weeks to cover 25 listings |
| **Mid-week** | Schedule 1–2 **My Shop's Shocking Sale** slots for the weekend | Free flash-sale mechanic, no approval gate |
| **Any day** | Bump/Boost listings — reportedly up to 5 products every 4 hours. Prioritise titles with stock and recent sales | Free; **verify the quota in the UI, it is not first-party sourced** |
| **Fri/weekend** | One **Shopee Feed** post with a product tag + voucher tag | Reaches followers; scales with Follow Prize |
| **Weekly** | Business Insights: note conversion rate per listing. Anything with traffic but no conversion is a listing-quality problem, not a traffic problem | Shopee's own stated diagnostic |

### Monthly

- Re-read **Top Keywords** — search demand moves.
- Review **inventory depth** against the next campaign date; buy accounts ahead of the spike.
- Audit listings against the spam rules (title composition, category, no duplicates, no external
  URLs) before Shopee audits them for you.

### Explicitly NOT in the routine

- **Shopee Ads.** Revisit only after (a) the GMV Max migration settles, (b) a title has proven
  organic sales worth defending, and (c) there is RM50–100 that can be written off. The recommended
  minimum real test is **RM3–6/day for 2 weeks on one product**.
- **Shopee Live.** Wrong shape for a sole operator; pre-recorded video captures most of the value.
- **Anything offered in exchange for a review.** Unsourced rule, real penalty risk, and the
  compliant alternative already exists.

---

## Open questions for Chaison

Ordered by how much they change a decision. Every one of these needs a logged-in Seller Centre or
Shopee Support — no agent can reach them.

1. **Does the gameshare.space retrieval URL appear in any listing title, description, or image?**
   If yes, this is the most urgent thing in this file. And separately: **does Shopee's external-URL
   rule apply to Chat messages**, where the pipeline sends the link automatically? Worth a written
   question to Seller Support so the answer exists on record.
2. **Is the Free Shipping Programme offered to this shop at all?** If Virtual Goods (Non-SSL) blocks
   it, the correct unit-economics model is Scenario B (20.8–32.0%), not Scenario A (26.7–38.0%) —
   which changes every price and voucher decision downstream.
3. **What do Top Keywords and the Keyword Planner actually show for MY?** This retires the biggest
   acknowledged unknown in `docs/listing-copy.md` and would let the Malay-title hypothesis be
   settled with data instead of A/B guesswork.
4. **Which L3 category do Cyber Space and GamerSpace list under, and is GameShare in the same one?**
   Category Spam is penalty-bearing and Shopee's own recommended resolution method is to copy the
   incumbents.
5. **Is Chat Broadcast available to this shop?** The deck marks it *"only for selected sellers."*
   If unavailable, the review-chasing lever disappears and the routine above needs a substitute.
6. **What is the live minimum bid** — RM0.07 (Shopee's own 2022 announcement) or RM0.14 (2026
   search synthesis)? Visible in the Ads console at bid-setting time. Also: **is the Keyword Planner
   readable without topping up Ads Credit?**
7. **Has the GMV Max migration hit this account yet?** The D-14/D-7/D0 schedule is documented but
   the account-specific date is only in Seller Centre notifications.
8. **Does campaign nomination require a registered business?** If yes, fold it into the Virtual
   Goods KYC work already due 1 Sept 2026 (`CHECKPOINT.md` item 4b) rather than treating them as
   two separate obligations.
9. **How are Delivery Speed and Driver Service rated on a Virtual Goods order with no driver?** If
   buyers can score dimensions that structurally cannot be satisfied, that is a permanent drag on
   Shop Rating and needs to be known before optimising for ratings.
10. **What is the real Bump/Boost quota** in the UI today — 5 products / 4 hours, and is it still
    called "Boost" or now "Bump"? The routine's daily step depends on it and the figure is
    third-party only.
11. **Is AMS open to Virtual Goods listings**, and what Commission XTRA rate does Shopee recommend
    for this category? AMS is the best-shaped paid channel for this business precisely because it is
    pay-on-result — but only if digital goods are eligible.

---

## What could not be fetched

Reported as unfetched, never reconstructed:

- **All `seller.shopee.com.my/edu/article/*` pages.** SPA; returns only the "Seller Education Hub"
  heading. Confirmed again this pass on articles 6821 and 619. Specifically wanted and not obtained:
  `20613` (Preferred/Mall criteria), `26669` + `20181` + `13951` (AMS commission rules), `1326`
  (Shopee Live guidelines), `1095` + `14845` (Free Shipping Programme), `505` + `16059` (Seller
  Penalty Points).
- **`ads.shopee.com.my/learn/faq/80/142`** (Discovery Ads) — returned **HTTP 500**. Other pages on
  the same host fetched fine, so this is a page-specific failure worth retrying later.
- **`shopee.com.my/m/PaydaySale-calendar`** and the `shopee.com.my/events3/code/*` spam-explainer
  pages cited inside the violation guide — buyer-side SPAs, not attempted past the redirect.
- **The Shopee MY category tree** (`seller.shopee.com.my/portal/categories`) — behind the SPA.
- **Anything requiring an authenticated Seller Centre session** — every item in "Open questions".

### Source-quality ledger

**First-party Shopee, fetched and read in full:**
`[MY] Listing Violation Guide` · `[MY] Optimising your Product Listings` (2021) ·
`[MY] EN ADVANCED` · `[EN] Advanced - Raya Bersama Shopee` · `[EN Version] Shopee Ads Intermediate` ·
`[MY] Shopee Feed User Guide` · `[MY] Seller Voucher User Guide` ·
`ads.shopee.com.my` FAQ 505/2053, 78/1831, 505/1926, 82/145, 82/2112 · `ads.shopee.com.my/news/1282` ·
`help.shopee.com.my` articles 77220 and 78919 and 140905.

**First-party non-Shopee:** Steam Subscriber Agreement (2026-04-20).

**Third-party, labelled as such wherever used:** BigSeller, EasyStore, SiteGiant, Ginee, Locad,
duoke.com, Hansen Commerce, salendar.com, KayaToday, Reacheffect, shakalakaa.my, gamerguru.blog.
None of these was used for a number presented as FACT-S.

**Explicitly rejected:** the "40% relevance / 30% performance / 20% seller quality / 10% freshness"
algorithm breakdown (Hashmeta, Cloud Ecommerce and others) — untraceable to any Shopee document,
already debunked in `2026-09-05-shopee-my-seller-economics.md`, and it resurfaced again in this
pass. It is SEO vendor content. Do not use it.
