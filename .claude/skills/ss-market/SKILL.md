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
| **ONLINE co-op, online multiplayer, "play with friends online", shared server, PvP** | Buyers play in Steam **Offline Mode**. An online mode cannot be reached from offline. This overrides Steam's own category data — that data describes the game, not what a buyer of a shared account can do. **Local/split-screen co-op is the one exception — see the override below.** |
| **"Lifetime guarantee"** | Cannot be honoured. Carried by older Dave/Duckov listings; must not be copied onto new ones. |
| **Refund guarantees** | Off-limits while the `/terms` window is a placeholder. |
| **"Instant" delivery** | Say **24-hour**. Auto-delivery is real; instant is not. |
| **`DLC+` unless that specific account owns the DLC** | It is a per-account fact, not a per-game fact. |
| **A gameshare.space URL in a listing description or image** | Shopee MY's Listing Violation Guide prohibits external URLs "with intention to direct transactions outside of the Shopee platform" — 1 penalty point per 2 deleted listings. Retrieval instructions belong in the **Shopee Chat delivery message**, which is already automated and also satisfies Virtual Goods proof-of-delivery. |
| **A permanent inflated "was" price** | Shopee's named **Misleading Discount** violation. |
| **A parked listing at an absurd price** (competitors use RM9,997) | Shopee's **Price Spam** example is RM9,999. |
| **Add-ons listed as separate items** | Price Spam. Add-ons belong in an item's variations. |
| **Anything offered in exchange for a review** | Penalty risk. The sanctioned alternative is Chat Broadcast to the `User Pending Review` group. ⚠️ **State this precisely** — see `docs/promotions-and-bundles.md` § 6a: the specific Shopee MY rule on incentivised reviews is `UNSOURCED — MUST VERIFY`, so *"it is a confirmed policy violation"* is **not** an established claim and must not be repeated as one. The rule still holds, on the risk plus a stronger independent argument (a gated voucher pays an unhappy buyer to post the review they would have skipped), and the alternative is fully sourced. Upheld by Chaison 2026-09-08 when he dropped a review-gated voucher he had asked for. |

### 1a. Chaison's standing overrides — READ THESE BEFORE APPLYING §1

`FACT-C`. Recorded in `docs/listing-copy.md` ("📌 Chaison's decisions, 2026-09-07"). An override
outranks the table above. **Do not "fix" copy back to the pre-override rule** — that is not a
hypothetical: on 2026-09-07 at 01:01 a session enforcing the old blanket co-op ban rewrote ten
titles that were already correct, left six character counts stale, and produced a title saying
`OFFLINE` four lines under prose saying `LOCAL CO-OP`. The work had to be reconstructed.

| Date | Override | Applies to |
|---|---|---|
| 2026-09-07 | **Co-op wording is allowed where Steam lists `Shared/Split Screen Co-op`.** Grounds: local and split-screen co-op genuinely work on one shared account in Offline Mode, and buyers do buy these games for that. | Titles, descriptions, keywords |
| 2026-09-07 | **Fill the 120-character title cap** (~115 avg), superseding the older ~80-character target. | All titles |
| 2026-09-07 | **`FULL GAME` stays on Early Access titles** (raised on Subnautica 2, overruled). Residual risk noted once, not re-argued. | All titles |
| 2026-09-14 | **The receipt nudge reminds buyers of Shopee's own review coins.** Grounds: review coins are funded by Shopee, not the shop (no top-up exists), so restating them is not the shop offering anything. Holds only while the line names Shopee as the payer, says *any* review, carries no star, and states the full criteria (50+ characters AND photo AND video). Seller-funded coins (Seller Coins / Shop Prize) for a review stay under §1's review-incentive row. Source and correction: `research/2026-09-06-shopee-growth-levers.md`. | `buildReceiptNudgeMessage` |

**Applying the co-op override honestly** — the test is *split screen present*, not *co-op present*:

| Steam category | Tail |
|---|---|
| `Shared/Split Screen Co-op` present | co-op claim **allowed** — word it specifically (`LOCAL CO-OP`, `Offline Local Co-Op`), never a bare `CO-OP` |
| **Online Co-op only, no split screen** | **`OFFLINE`** — an offline buyer cannot reach it. The override does not cover this. |
| No co-op at all | `OFFLINE` |

So a bare `<OFFLINE or CO-OP>` formula is still wrong: it prompts the middle row's error.

### 1b. Open exposure — known, not yet fixed

| # | Exposure | State |
|---|---|---|
| 1 | **Banner images print `gameshare.space` inside the image.** Shopee `[MY] Listing Violation Guide` p.12 bans photos containing external URLs; p.4 = 1 penalty point per 2 deleted listings, 3 points caps the shop at 100 listings for 28 days. | **Generator fixed + all 188 banners re-rendered and staged into `brand/` 2026-09-07** (`FACT-V`: 0/188 contain the URL, 188/188 carry the `GAMESHARE` footer). **Shopee is NOT yet clear — the re-upload is Chaison's call.** ⚠️ Do **not** delete the `.foot` div as older notes instruct: both templates fill 830px exactly, so deletion leaves a white strip. ⚠️ `UNSOURCED`: no image diff exists, so nobody has confirmed the live listings match `brand/`. |
| 1b | **`FREE DLC INCLUDED` is printed on 4 live listings' banners** — `dave-the-diver`, `euro-truck-simulator-2`, `escape-from-duckov`, `dokimon-quest` (`games-data.mjs`, `badge3`). Same unbacked per-account claim `CHECKPOINT.md` says was removed from the shop; the 2026-09-06 cleanup only touched titles. Worse on Dave and Duckov, which sell **Offline** and **Offline DLC** as separate variations — a banner claim covers both, so it over-claims on the base one. | **Found 2026-09-07.** Not changed — live-listing claim, Chaison's call, and the honest fix needs a per-account DLC check. Other 43 games use `OFFLINE PLAY`/`SINGLE PLAYER`, both safe. |
| 2 | **All 38 Part 1–4 descriptions carry a `gameshare.space` URL.** Part 5 omits it and points at Shopee Chat instead, so the file is internally inconsistent. | 🟡 **MOSTLY RESOLVED 2026-09-08 — but the "0 of 39" first written here was WRONG, and the error is the lesson.** Chaison authorised the fix; applied via `scripts/fix-listing-urls.mjs`. 26 `normal`-type live listings were cleaned and verified. **3 live listings still carry it (6 occurrences) as of this correction.** ⚠️ **The wrong claim and why:** `get_item_base_info` returns `description: ""` for `description_type: "extended"`, and this row previously concluded their body was *"neither readable nor writable by API"* and *"needs a human pass in Seller Centre."* **Both halves were false.** The text is in `description_info.extended_description.field_list[]` (`FACT-V`, read directly), and `update_item` writes it via `description_type: "extended"` + the same structure (`FACT-S`, `UpdateItemDescriptionInfo` in congminh1254/shopee-sdk `src/schemas/product.ts`; whitelist-seller field, which this shop qualifies for). **One empty field was treated as proof of absence, and the shop was reported clean while three listings were selling with the violation.** Caught by `project-steamshare-c0`, not by the tooling. Script now reads and writes both shapes. Also outstanding: 6 UNLIST drafts (not live, no penalty risk — clean before publishing). ⚠️ `docs/listing-copy.md` was NOT updated, so the source file still carries 94 URLs and will reintroduce them into any new listing built from it — **fix the template at `:92` before the next upload.** Two lessons worth keeping: deleting the URL lines alone is **not** shippable (the URL *is* the step telling a buyer where their login comes from — 7 listings needed their whole `HOW IT WORKS` block replaced), and a global list-renumber corrupted prose on one listing by rewriting the year `1937.` to `1.`. |
| 3 | Titles stack `FULL GAME \| 24H AUTO DELIVERY \| ORIGINAL` — inside Shopee's keyword-spam definition. Not enforced against this shop so far. | Accepted exposure |
| 4 | **The stale "enter your Steam username" instruction.** The lookup form has taken an order id and nothing else since 2026-09-06. | **Two places, one fixed.** ① The **automated Shopee chat delivery message** said it to every buyer on every order — fixed in `lib/fulfillment.ts` 2026-09-07, 139/139 tests pass, **not yet deployed** (Chaison's call). Its test had asserted the wrong string, pinning the bug. ② Parts 1–4 descriptions — covered by the proposed template in row 2. |
| 5 | Cover banner renders `ADD TO YOUR STEAM LIBRARY` at 27px and the game's own name at 14px — the largest text is both an unbacked ownership claim and not the term buyers scan for. The cover is the only image in search results. | **Fix drafted + rendered 2026-09-07** — game name leads, `<genre> · SHARED STEAM ACCOUNT` beneath. Patch and evidence in `docs/listing-copy.md`, "🔶 Fourth art finding". Awaiting Chaison (brand call). **Apply before the re-upload if approved** — the 188 images ship once either way. |

---

## 2. Sources of truth — read before writing, never write from memory

| File | What it owns |
|---|---|
| `docs/listing-copy.md` | **Upload source of truth.** Every title and description, Applied vs Proposed. It was diffed against live Shopee by `scratchpad/verifycopy.mjs`, **which no longer exists** (see below) — so drift is currently undetectable and this file's "Applied" blocks are a claim, not a verified state. ⚠️ 3,600 lines, written by **concurrent sessions**: it has two `Part 4` headings and two `Part 5` headings, with eight games appearing twice (left alone on Chaison's instruction). **Always `grep -n` for the game and confirm which block is current before editing — the later block usually wins.** |
| `docs/shopee-listings.md` | Asset conventions, title convention, banned claims. Its rules supersede its own older per-game blocks. |
| `docs/promotions-and-bundles.md` | **Source of truth for every voucher, bundle and discount** — the computed spec, what is live vs designed, and the execution order. Check it BEFORE designing a promotion: on 2026-09-08 a voucher was requested that was already specced there at exactly the asked-for numbers, so the task was a decision, not a design. § 6a is the review-growth lever and the reasoning behind the no-incentivised-review rule. |
| `research/2026-09-06-shopee-growth-levers.md` | Ranking signals, every free and paid lever with sourced numbers, policy and enforcement risk, campaign calendar. |
| `research/2026-09-06-marketing-asset-audit.md` | What assets exist, what is stale, what is written-but-unshipped. |
| `research/2026-09-06-marketing-skill-ecosystem.md` | Tooling verdicts. Short version: nothing installable gives real Shopee keyword data. ⚠️ **Wrong on one point:** it called the `marketing-skills` pack (alirezarezvani marketplace) "prompts only". `paid-ads/scripts/roas_calculator.py` and `campaign-analytics/scripts/funnel_analyzer.py` are real calculators — see the next row. |
| `research/2026-09-13-shopee-metrics-playbook.md` | **Read before any metrics or ads question.** Metric definitions (Business Insights + Shopee Ads), what the API can pull vs what needs Seller Centre, Shopee's own diagnostic playbook (Traffic / Conversion / Sales-per-buyer; GMV Max's four Ads Diagnosis flags), breakeven-ROAS maths, the weekly metrics review, and the attribution-gap fix. `FACT-S (secondary)`: organic traffic has **no API**; `v2.product.get_item_extra_info` (views/sales/likes per listing) and `v2.ads.get_all_cpc_ads_daily_performance` / `get_product_campaign_daily_performance` **do** — confirmed present in `congminh1254/shopee-sdk` 2026-09-13. ~~Ads-scope permission on our app is `UNSOURCED`~~ — **granted, `FACT-V` 2026-09-13**: every ads, product and account-health endpoint returned data on this shop. Run `node --env-file=.env.local scripts/shopee-metrics.mjs --days 14 --out <file>` (read-only). Still Seller-Centre-only: visitors, conversion rate, Top Keywords. `get_recommended_keyword_list` returned empty for all 10 listings tried; the GMV Max report endpoints were rate-limited. ⚠️ Its breakeven ROAS ignores supplier cost per redemption — read the caveat under that table. |
| `research/2026-09-13-shopee-metrics-snapshot.md` | **The first real numbers, 2026-09-13.** Ads 07–12 Sep, per-listing views vs orders, shop health. Headline: discovery is the biggest loss (27 of 41 listings under 15 lifetime views); The Last of Us Part II and Spider-Man 2 get views but no sales; chat response rate 80% fails Shopee's 85% target. |
| `research/2026-09-13-metrics-loop-skills.md` | Which skills turn numbers into decisions. `FACT-V` 2026-09-13: `python ~/.claude/plugins/marketplaces/claude-code-skills/marketing-skill/skills/paid-ads/scripts/roas_calculator.py --spend --revenue --conversions --clicks --impressions --margin` works (plugin is on disk, **not installed**; scripts run directly). Its ROAS / breakeven / pause lines are right. Its "Losing $X" line is the gap to breakeven, not the loss, and it prints `$` for RM. Strongest external find: `xjli360/sealeap-amazon-skills` → `amazon-skills/amazon-official/sealeap-amazon-acos-diagnostics` (MIT, recomputes and cross-checks ACOS/ROAS; Amazon-shaped, needs Shopee mapping). **Always pass a margin net of Shopee fees AND supplier cost per redemption.** |
| `research/2026-09-13-off-shopee-channel-skills.md` | Channels outside Shopee. Organic TikTok / YouTube Shorts / unboosted, untagged FB-IG posts / Lowyat are the open paths. **Meta Shops/Marketplace listing is PROHIBITED** — Commerce Policy names "digital accounts". Meta, Google and TikTok **paid ads are RISKY, not named** — the file first said "PROHIBITED" and was corrected; say "likely rejected", not "banned in writing". Never Shop-tag or boost a Meta post. No skill reads organic-channel metrics for free — numbers come from each platform's native analytics (Chaison-only). |
| `research/2026-09-05-*` | Competitor landscape, pricing, unit economics, market blind spots. **Re-done 2026-09-13 from the page images of all 7 shops** — the first pass was text-only and missed the lifetime/online thumbnail claims. |
| `research/2026-09-13-competitor-price-map.md` | **Read before any price or traction decision.** Our live prices (`FACT-V` 2026-09-13) against every competitor, title by title. We are cheapest or within RM0.10 on 21 of 28 overlapping titles, so price is not the traction blocker. Includes the RM8,000/month order arithmetic. Marketing brief built on it: `.claude/fleet/BRIEF-MARKETING.md`. |
| `scripts/shopee-listings.mjs` | Coverage report. **A cross-marked line is a listing that takes money and delivers nothing.** Run after every listing change. |
| `scripts/audit-listing-copy.mjs` | **Built 2026-09-07. Run it before and after any copy work — it is the cheapest gate here.** Deterministic audit of all 72 title entries (120-char cap, stated-count accuracy, corruption, co-op wording) plus every buyer-visible string in `games-data.mjs` against the claim rules. `--fix` corrects wrong character counts only; it never touches a title or a claim. Exits 1 on findings. Committed deliberately — the tools it replaces were lost by living outside git. |
| `python -m markitdown <file>` | **Turns anything Chaison exports into Markdown tables an agent can read** — Seller Centre Business Insights / Shopee Ads `.xlsx`/`.csv` exports, `[MY]` Seller Education PDF decks, `.docx`/`.pptx`. `FACT-V` 2026-09-13: markitdown 0.1.8b1 is already installed (user-site Python 3.12), HTML and XLSX converted cleanly, all optional converters present (openpyxl, pandas, pdfminer, mammoth, pptx, xlrd). **Do not reinstall it.** Call it as `python -m markitdown` — the bare `markitdown` command is not on PATH. ⚠️ **On a PDF it reads the text layer only.** Competitor shop-page captures hide their key claims in thumbnail pixels (lifetime / online / offline badges) and sometimes the whole product grid — render the pages with pypdfium2 (installed) and read the images. `Read` on a PDF fails here (no `pdftoppm`). The 2026-09-05 competitor research missed lifetime and online claims at 5 of 7 shops this way; re-done 2026-09-13. |
| `scripts/publish-readiness.mjs` | **Built 2026-09-07.** Answers "what should we list next" from data instead of a stale hand-count: joins art × purchasable × copy/verdicts on the Steam app id. **Current: 10 live, 30 art+copy ready, 1 to verify, 6 do-not-list, 1 needing art. Nothing is blocked on writing copy.** Reads verdicts defensively — the most severe wins across duplicate headings, and it accepts both heading delimiters (see the two defects it found, in `docs/listing-copy.md`). |

**Numbers rule.** Never state a Shopee fee, quota, CPC, or policy threshold from memory. Quote
it from a sourced line in the research files, or mark it `UNSOURCED — MUST VERIFY`. Confident
invented numbers are the characteristic failure of this domain.

### 🔴 The entire `scratchpad/` directory is GONE — verified 2026-09-07

`FACT-V`: `scratchpad/` does not exist, was **never committed** (`git log --all -- scratchpad` is
empty) and is **not gitignored**. It is not recoverable from git. Every reference to it across
`CHECKPOINT.md`, `docs/` and this skill points at nothing:

| Referenced tool | What the docs claim it does | Reality |
|---|---|---|
| `scratchpad/verifycopy.mjs` | Diffs live Shopee against `docs/listing-copy.md` byte-for-byte | **Missing.** There is currently **no way to detect copy drift.** |
| `scratchpad/e2e.mjs` | CHECKPOINT: *"the only check that proves a listing can actually pay out. Repeat it before publishing anything else"* | **Missing.** The documented pre-publish gate cannot be run. |
| `scratchpad/refix.mjs` | Re-reads `item_status` and repairs silently re-listed drafts | **Missing** — and CHECKPOINT's rule *"after ANY bulk write, re-read `item_status` for every draft"* has no tool behind it. |
| `scratchpad/refresh.mjs` | Refreshes the 4-hour Shopee token mid-batch | **Missing.** |
| `scratchpad/seo2/images.md`, `roast-images.md`, `cgtext/` | Image spec and roasts | **Missing.** |

**Consequence to state plainly whenever it bites:** three separate safety rules in this repo —
pre-publish payout testing, copy-drift detection, and post-bulk-write draft checking — are written
down as if tooled and are currently **unenforceable**. Do not cite any of them as a completed
check. Rebuilding `e2e.mjs` is the highest-value one, because publishing an untested listing is
how a buyer pays for something that cannot be delivered.

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

0. **Run `node scripts/audit-listing-copy.mjs` first.** Two minutes, no judgement required, and it
   catches the whole class of defect this file keeps re-acquiring. Run it again when you finish.
1. Read the game's current block in `docs/listing-copy.md` and its assets in `brand/`.
2. Check every claim rule in §1. Report violations by file and line; do not silently rewrite.
3. Title: game name **first** — it is the term buyers search. Shopee's cap is 120 characters and
   the target since Chaison's 2026-09-07 override is to **fill it** (~115 avg), not the older ~80.
   Re-derive every character count **mechanically from the text**; never trust a count written
   next to it. This is not pedantry, it is measured: a 2026-09-07 audit of all 72 title entries
   found **9 of the 49 stated counts wrong — an 18% error rate** (deltas −5 to +2). All nine were
   corrected; 0 titles exceeded the cap and 0 were corrupt. Counts written by a previous session
   are unverified data. **The co-op tails are currently CORRECT** (§1a) — exactly two titles carry
   a co-op claim and both are split-screen games. Do not "fix" them.
4. **Images: Shopee allows 9, including the cover** (`FACT-S`, Seller Education Hub article/370 —
   three is the stated *minimum*). The pipeline renders four, so **five slots per listing are
   unused.** (The local spec this used to cite, `scratchpad/seo2/images.md`, no longer exists —
   see §2. The Shopee source still stands.)
5. Changing a **live** listing is Chaison's call, never an agent's. Propose, then wait.
6. After any listing change, run `scripts/shopee-listings.mjs` and confirm no failing lines.

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

**Ads were run anyway, 07–12 Sep 2026 — the result (`FACT-V`, `research/2026-09-13-shopee-metrics-snapshot.md`):** RM58.25 spent, 316 clicks (CTR 1.65%, CPC RM0.18), 19 orders, GMV RM26.36, **ROAS 0.45**, RM3.07 ad cost per order against RM0.82–1.17 kept per order. Break-even at our prices needs 16–22% click-to-order; actual was 6%. All 10 product campaigns were auto-bid with **no ROAS target**, and are now paused or ended. **The verdict below held.** Restart only after listing conversion rises and the rating follow-up works — with a ROAS target, one campaign per listing, on listings that convert.

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

**The fix is BUILT, not yet live** (2026-09-13, Chaison said go ahead). Migration
`0016_order_games_pricing.sql` adds `shopee_original_price`, `shopee_discounted_price` and
`shopee_quantity` to `order_games`. `lib/order-pricing.ts` reads them from the `item_list` Shopee
already sends — no new Shopee call. `FACT-V`: `tsc --noEmit` clean, 182/182 tests pass. **Measurement
starts only once 0016 is applied in Supabase** (CHECKPOINT deploy queue step 5). Deploy order is safe
either way. Rules for any report built on it:
- **NULL is unknown, never RM0** — rows from before 0016, manual rows, and **bundle-deal items**, where
  Shopee sends a 0 price by design. Exclude NULLs; do not sum them as zero.
- No history before 0016. A before/after comparison needs at least a week of priced orders on each side.
- A second line for the same game on one order gets no second row (one account per game), so its
  price is not recorded.

Revenue per listing, last 7 days:
```sql
select l.game_id, og.shopee_item_id, count(*) as lines,
       sum(og.shopee_discounted_price * coalesce(og.shopee_quantity, 1)) as revenue_myr
from order_games og
join shopee_listings l on l.item_id = og.shopee_item_id and l.model_id = og.shopee_model_id
where og.shopee_discounted_price is not null and og.created_at >= now() - interval '7 days'
group by 1, 2 order by revenue_myr desc;
```
Views and sales per listing come from `v2.product.get_item_extra_info` (not built). Business Insights
numbers are Seller-Centre-only: ask Chaison to export them, then read the file with
`python -m markitdown <file>`.

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

---

## 7. Keeping this skill true — the self-update loop

**This file is the shop's marketing memory. A session that learns something and does not write it
back here has thrown the finding away**, and the next session pays to rediscover it — or, worse,
acts on the stale version. That is not hypothetical here: the blanket co-op ban in §1 outlived
Chaison's reversal of it by long enough for one session to destroy ten correct titles enforcing it.

**Before finishing any marketing task, update this file when any of these is true:**

| Trigger | Where it goes |
|---|---|
| Chaison overruled or changed a rule | §1a override table, dated, with his stated grounds |
| An exposure was found, fixed, or accepted | §1b register — never delete a row, change its state |
| A documented instruction turned out to be wrong | Correct it **and say it was wrong**, so nobody re-follows it |
| A number was verified against a real source | Replace the guess; tag `FACT-V` / `FACT-S` / `FACT-C` |
| A live claim was found unbacked | §1b, flagged — do not silently rewrite live copy |

Two habits that produced most of the findings above, worth repeating:

1. **Audit the artifact, not the source.** `FREE DLC INCLUDED` sat unnoticed on four live listings
   because every previous pass read titles and code. It was found in one look at a rendered PNG.
   Render it, open it, read what a buyer actually sees.
2. **Re-derive, never inherit.** Character counts, "38/38 pass", "~152 images", "a two-line
   deletion" — every one of those was written confidently by a previous session and every one was
   wrong. Counts and geometry written by a prior session are unverified data, not facts.

**Scope guard.** Updating this skill is in scope for any marketing task. Editing a **live Shopee
listing** never is — propose and wait (§3). The distinction: this file is how we decide; the
listing is what buyers see and costs penalty points to get wrong.
