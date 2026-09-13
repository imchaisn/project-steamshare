# Shopee MY chat response rate — rules and native tools

Research date: 2026-09-08. Scope: the Chat Response Rate (CRR) metric and NATIVE Seller
Centre / Shopee Seller app tools only. The Open Platform chat API (send_message, webhooks,
push codes) is explicitly out of scope — covered by a separate agent.

## Verdict in one paragraph

The core numeric facts about CRR (12-hour reply window, 30-day rolling calculation, ~85%
Preferred Seller threshold) are stated consistently and specifically enough across multiple
independent secondary sources that they are very likely correct, but **every official Shopee
MY (and SG, and PH) source page for this topic is a client-rendered single-page app that
returns an empty loading shell to any non-browser fetch** — confirmed directly below — so
none of it could be verified against Shopee's own text today. The single most
decision-relevant and most fragile finding is the answer to the decisive question: multiple
independent secondary sources converge that **Shopee's native Auto-Reply and Chat Broadcast
messages do NOT count as a response for CRR purposes** — only a manually-sent reply (typed,
a Shortcut Message send, or a sticker) counts. If that holds, a native auto-responder does
**not** solve Chaison's problem of maintaining CRR unattended; it only prevents the buyer from
being left in silence. This claim could not be elevated above `UNSOURCED — MUST VERIFY`
because I could not fetch an authoritative first-party page stating it. See the dedicated
section below for exactly what to check in Seller Centre to settle it.

## How the metric is calculated

**FACT-V** — Every Shopee Seller Education Hub URL tested today returns a client-rendered
SPA shell with no article text in the raw HTML, confirming the brief's warning. Tested with
`curl -A "Mozilla/5.0 ..." <url>` on 2026-09-08:
- `https://seller.shopee.com.my/edu/article/1795` ("How is Chat Response Rate (CRR)
  Calculated?") → HTTP 200, 13,332 bytes, `<title>Seller Education Hub</title>`, no CRR
  text in the DOM.
- `https://seller.shopee.com.my/edu/article/4729` (CRR FAQ) → same empty-shell result via
  WebFetch.
- `https://seller.shopee.com.my/edu/article/20378/auto-reply` → same empty-shell result via
  WebFetch.
- `https://seller.shopee.sg/edu/article/50/understanding-chat-response` → HTTP 200, 13,328
  bytes, same empty shell.
- `https://seller.shopee.sg/edu/article/2587/monitoring-chat-performance` → same.
- `https://seller.shopee.ph/edu/article/11647/understanding-chat-response` → same.

These pages are reported **unfetched**, not reconstructed. The article titles above (found
via search-engine indexing, not by fetching the page) are the only first-party artifact
obtained for the CRR-specific explainer pages.

The following numeric claims come from secondary sources only (Duoke, BigSeller — sellers'
tool vendors whose blogs cite Shopee's stated rules) and could not be cross-checked against a
fetched first-party page. They are internally consistent across multiple independent
write-ups, which is suggestive but not proof:

- **UNSOURCED — MUST VERIFY**: CRR = (number of new buyer-initiated chat threads and offers
  the seller replies to within 12 hours) ÷ (total new buyer-initiated chat threads and
  offers) × 100%, over a rolling 30-day window, refreshed daily. Basis: convergent claims in
  [Duoke — Shopee Account Health 2025](https://www.duoke.com/en/blog/article/164-Shopee-Account-Health-2025-Boost-Your-Shopee-Chat-Response-Rate-CCR-Chat-Satisfaction),
  [Duoke — Improve CRR](https://www.duoke.com/en/blog/article/97-How-to-Improve-Your-Shopee-Chat-Response-Rate-CRR-and-Boost-Better-Customer-Service-CS),
  [BigSeller — Improve CRR](https://www.bigseller.com/blog/articleDetails/3276/shopee-seller-chat-response-rate.htm).
  Google's indexed snippet of the (unfetchable) official page
  `seller.shopee.com.my/edu/article/1795` is titled "How is Chat Response Rate (CRR)
  Calculated?" which is consistent with this being the source these blogs are paraphrasing,
  but the snippet text itself was not retrievable.
- **UNSOURCED — MUST VERIFY**: CRR is only calculated once a shop has received at least 2
  chat threads in the trailing 30 days (below that, CRR shows as not-yet-available rather
  than 0%). Same secondary sources as above.
- **UNSOURCED — MUST VERIFY**: Effective 18 April 2024, Shopee changed the CRR calculation
  window from a trailing 90 days to a trailing 30 days. Found via search-engine summary of
  Shopee's own update notice, but the notice page itself is on the same unfetchable
  `seller.shopee.com.my/edu` domain and could not be independently confirmed.
- **UNSOURCED — MUST VERIFY** (answers objective #7 — first reply only, or every message):
  Sources disagree in a way that matters. Some secondary sources describe a distinct metric
  **First Response Time (FRT)** that explicitly counts only the first message of each
  "conversation" (a new buyer message arriving more than 12 hours after the prior one starts
  a new conversation for FRT purposes), and a separate metric **Average Response Time (ART)**
  that averages over all messages. CRR itself is described as being based on "new chat
  threads and offers" — which reads as thread-level, not every individual message — but one
  source claims a policy change made CRR apply "the same weightage across all chats," which
  is ambiguous as to whether that means every thread or every message within a thread. This
  is not settled and should not be treated as known.

## Thresholds and consequences

- **UNSOURCED — MUST VERIFY**: A CRR ≥ 85% is described as the passing bar for
  Preferred Seller / Preferred+ status on Shopee Malaysia. Cited by
  [Duoke — MY chat response guide](https://www.duoke.com/en/blog/article/398-Malaysia-E-commerce-Chat-Response-Rate-Complete-Guide-2026-Lazada-Shopee-and-TikTok-Shop)
  and [Ginee MY — Preferred Seller Plus](https://ginee.com/my/insights/preferred-seller-plus-shopee-malaysia/).
  I found no ordinary "healthy but non-Preferred" threshold stated anywhere distinct from the
  Preferred Seller bar — it is possible Shopee only publishes the one number.
- **FACT-S** (dated document — see caveat): a 2019 Shopee-hosted PDF, "[MY] Shopee's Seller
  Penalty Points system_vF 15_5_2019," fetched from
  `https://cdngarenanow-a.akamaihd.net/shopee/seller/seller_cms/75463ad695291e20f06e28d275417301/%5BMY%5D%20Shopee's%20Seller%20Penalty%20Points%20system_vF%2015_5_2019%20(5).pdf`
  (HTTP 200, 973,327 bytes, 25 pages, fetched and read via `pdftotext -layout`) lists
  "Rude/abusive chats" as its own penalty-point trigger under the Customer Service Policy
  (target <1%, 2 points issued), separately from Non-Fulfillment Rate, Late Shipment Rate,
  Prohibited Listings, IP Infringement and Listing Spam, each of which has its own
  target/points row in the same summary table. **The document's own summary table does not
  list a low Chat Response Rate percentage as a penalty-point trigger** — only rude/abusive
  chat behaviour is. **Caveat: this document is seven years old at the time of writing.**
  Shopee has since revised the CRR calculation window (2024) and the Preferred Seller fast
  handover threshold (per a March 2025 update reported by a shipping-logistics blog), so this
  2019 document cannot be relied on as current policy — it is evidence only that, as of 2019,
  CRR-as-percentage and the formal points system were two separate mechanisms, not that they
  still are.
- **UNSOURCED — MUST VERIFY**: consequences claimed by secondary sources for a low CRR —
  reduced shop search-ranking/visibility inside Shopee, the response-rate percentage being
  displayed publicly on the shop's storefront page (denting buyer trust/conversion directly,
  independent of ranking), loss of eligibility for Preferred Seller and for major campaign
  events (11.11, 6.6, etc.). These are plausible and repeated across sources but none could be
  confirmed against a fetched first-party page, so treat as reported consequence, not verified
  fact.
- Distinguishing documented vs. folklore, per objective #4: the **penalty-points mechanism**
  for chat behaviour is documented (2019, stale) and narrowly scoped to rude/abusive chat
  content, not to the CRR percentage. The **search-ranking and Preferred-Seller consequences**
  of a low CRR percentage are widely repeated by seller-tool vendors as settled fact but are,
  on the evidence gathered here, unverified claims rather than confirmed Shopee policy text.

## Native auto-reply features in Seller Centre

**FACT-S** — sourced from `[MY] Webchat User Guide.pdf`, fetched from
`https://deo.shopeemobile.com/shopee/seller/seller_cms/ff64afb5d13054e04ee69deed6222864/%5BMY%5D%20Webchat%20User%20Guide.pdf`
(HTTP 200, 3,215,361 bytes, converted with `pdftotext -layout`), which is explicitly Malaysia
market ("[MY]" in the filename). All menu paths below are: **Seller Centre webchat panel >
Navigation > My Settings > Chat Settings > [feature]**.

1. **Auto Reply** — "An automatic message that will be sent to a buyer after he/she initiated
   a conversation." Configured at *My Settings > Chat Settings > Auto Reply*. Limit: up to
   **500 characters**. The guide's own seller tips frame it as useful for a welcome message
   and for promoting an ongoing shop promotion — not framed by Shopee (in this document) as a
   CRR-maintenance tool.
2. **Off-Work Auto-Reply** — a variant of Auto Reply for buyers who message outside stated
   working hours; toggled separately under the Chat Assistant Auto-reply tab, with a
   configurable "working hours" window. **UNSOURCED — MUST VERIFY** for the exact current
   Seller Centre menu label and toggle location, since this detail came from a search-engine
   summary of a Shopee page, not a fetched page or the PDF above.
3. **Vacation Mode** — a shop-wide away mode; search-engine summaries describe it as
   triggering an auto-reply and as excluding messages received during Vacation Mode from CRR,
   FRT and ART entirely. **UNSOURCED — MUST VERIFY** — not found in either fetched PDF, and
   not confirmed against a first-party page.
4. **FAQ Assistant** — "A tool on Webchat that enables you to provide prompt FAQ responses
   for your buyers when they initiate a chat with you. It can send out greeting messages,
   question classification choices, and sub-questions." Configured at *My Settings > Chat
   Settings > FAQ Assistant*. Requires at least 1 FAQ to be added before it can be activated.
   Limits, per the guide: up to **3 question categories**, up to **3 sub-questions per
   category**, one prepared **Answer** per sub-question, an optional bundled **Greeting
   Message** sent together with the FAQ menu, and a **"Transfer to Customer Service Agent"**
   option the buyer can select to exit the FAQ flow into a live/human conversation. No
   keyword-matching is described — buyers navigate by clicking pre-set category/sub-question
   buttons, not by typing a keyword Shopee parses.
   - Note: I also fetched a non-MY-labelled `FAQ Assistant.pdf` from
     `https://deo.shopeemobile.com/shopee/seller/seller_cms/ca93507fc17b0c9f475902c08531443b/FAQ%20Assistant.pdf`
     (HTTP 200, 284,456 bytes). Its footer links to `seller.shopee.ph/edu` — **this is a
     Philippines-market document**, used here only as corroboration since its feature
     description is identical to the MY guide's; it is not cited for anything MY-specific.
5. **Shortcut Messages** ("quick replies" / canned responses) — pre-saved frequently-used
   answers a seller manually selects and sends. Limit: **up to 20 message shortcuts per
   shop**. These are manually triggered by the seller (a click, not automatic), and per the
   secondary-source consensus below, DO count toward CRR since they are a manual send action.
6. **Chat Broadcast** — a bulk outbound messaging tool to buyers who have placed a past order
   in the shop, not a reply mechanism. **FACT-S** from
   `[MY] Web Chat Broadcast User Guide (Seller Centre).pdf`, fetched from
   `https://deo.shopeemobile.com/shopee/seller/seller_cms/2baa00a0ebbf492c5650f9d3eefb59a9/%5BMY%5D%20Web%20Chat%20Broadcast%20User%20Guide%20(Seller%20Centre).pdf`
   (HTTP 200, 2,905,119 bytes): broadcasts may only be sent 9:00 AM–8:00 PM; a shop may send
   at most one message to a given recipient per day; each broadcast may include up to 1 text
   message, 1 voucher, and up to 4 product links (or, alternatively, 1 promotion instead of
   product links). The guide's own FAQ states explicitly: **"Chat broadcast will not directly
   affect CRR. But if a recipient sends a follow-up message after you send a broadcast,
   sellers should respond within 12 hours in order to maintain their CRR."** It also documents
   a scenario where the broadcast recipient is themselves a Shopee seller with their own
   Auto-Reply switched on: that recipient's auto-reply firing back at the broadcasting seller
   does **not** affect either party's CRR — direct first-party evidence that at least one
   category of automated message (a shop's own reply-to-broadcast auto-reply) is excluded
   from CRR accounting on both sides of the exchange. This is the strongest first-party signal
   found either way on the decisive question, though it is about a narrower scenario
   (auto-reply to an unsolicited broadcast) rather than a direct statement that Auto-Reply as
   a general feature is excluded from CRR.

## Does an automated reply count? (the decisive question)

**UNSOURCED — MUST VERIFY overall**, with one narrow **FACT-S** data point and a strong,
convergent, but non-first-party signal pointing the same direction.

- The one narrow fact I could source directly (see item 6 above, from the official `[MY] Web
  Chat Broadcast User Guide`) is that a buyer's own shop-side Auto-Reply, triggered in
  response to receiving a broadcast, does not affect CRR for either party. This is evidence
  that Shopee's system distinguishes automated sends from manual ones for CRR purposes, but
  it is not a direct statement that a seller's own Auto-Reply to an inbound buyer chat is
  excluded from that seller's own CRR.
- Multiple independent secondary sources state this more broadly and explicitly: "Shopee
  Auto Replies are not counted in the shop's customer service response rate statistics" and
  "Chat Broadcast messages and Auto-Replies do not contribute positively to your CRR, even if
  sent within the required timeframe... you would still have to manually send a text message
  or a sticker to maintain your CRR." Sources:
  [Duoke — Auto Reply guide 2026](https://www.duoke.com/en/blog/article/292-The-Ultimate-Guide-to-Using-Auto-Reply-2026),
  [Duoke — Account Health 2025](https://www.duoke.com/en/blog/article/164-Shopee-Account-Health-2025-Boost-Your-Shopee-Chat-Response-Rate-CCR-Chat-Satisfaction),
  [BigSeller — Improve CRR](https://www.bigseller.com/blog/articleDetails/3276/shopee-seller-chat-response-rate.htm).
  These are third-party seller-tool vendor blogs, which the brief permits only as a lead to a
  Shopee page, never as the sole source for a number or fact — and I was not able to follow
  that lead to a fetchable Shopee page, because every candidate first-party page
  (`seller.shopee.com.my/edu/article/1795`, `/4729`, `/20378`, and the SG/PH equivalents) is
  the same unfetchable client-rendered SPA.
- **Bottom line stated plainly, per the standing rule against softening**: the weight of
  evidence — one narrow first-party data point plus consistent, independent third-party
  claims with no source found contradicting them — points to **auto-replies not counting
  toward CRR**. If that is correct, a native Shopee Auto-Reply or FAQ Assistant deployment
  does **not**, by itself, protect Chaison's CRR; it only keeps buyers from being met with
  silence while a human is unavailable. It would need to be paired with either (a) fast human
  or automated-via-API manual sends within the 12-hour window (out of scope here — that is
  the other agent's territory), or (b) direct confirmation from Chaison's own Seller Centre
  data that this is still true today. I could not verify this and it must not be treated as
  settled.

## Open questions Chaison must confirm in Seller Centre

Only Chaison can reach Shopee Seller Centre. For each item, the exact click-path to check:

1. **Does Auto-Reply/FAQ Assistant count toward CRR?** Go to *Seller Centre > Business
   Insights / Chat Performance (or the CRR widget)* and note the current CRR percentage.
   Temporarily enable Auto-Reply only (Chat Settings > Auto Reply) for a period with no manual
   replies at all, and watch whether the CRR percentage for that window changes. If it does
   not move while auto-replies are firing and manual replies are absent, that settles it.
   Alternatively, open a Shopee Seller Centre support ticket and ask this exact question in
   writing — Shopee support agents can consult internal documentation an outside fetch cannot
   reach.
2. **Exact current CRR threshold for "healthy" vs. Preferred Seller**, and whether these are
   the same number. Check *Seller Centre > Shop Penalty / Performance dashboard*, which shows
   Chaison's live CRR, FRT, ART and the pass/fail bar Shopee currently applies to this
   specific shop.
3. **Whether the 12-hour window truly runs 24/7** (including overnight and weekends) or
   whether Shopee now has any business-hours carve-out — check the tooltip/help text directly
   next to the CRR figure in Seller Centre, since the definitional pages could not be fetched.
4. **Whether CRR counts every buyer message or only the first per thread** — same dashboard;
   Shopee's own tooltip or tutorial video linked from that dashboard is more likely to be
   current than any externally-cached figure quoted here.
5. **Current menu location and toggle names for Off-Work Auto-Reply and Vacation Mode** —
   confirm live in *My Settings > Chat Settings* in the Seller Centre webchat panel, since
   these two features were not found in the fetched PDFs and were reported here from
   secondary sources only.
6. **Whether the 2019 Seller Penalty Points document's separation of "CRR" from "penalty
   points"** still holds — ask Shopee support directly whether a chronically low CRR now
   generates penalty points on its own, independent of any rude/abusive chat behaviour.

## Sources

Fetched and read directly (FACT-V / FACT-S basis):
- `[MY] Webchat User Guide.pdf` — https://deo.shopeemobile.com/shopee/seller/seller_cms/ff64afb5d13054e04ee69deed6222864/%5BMY%5D%20Webchat%20User%20Guide.pdf (fetched 2026-09-08)
- `[MY] Web Chat Broadcast User Guide (Seller Centre).pdf` — https://deo.shopeemobile.com/shopee/seller/seller_cms/2baa00a0ebbf492c5650f9d3eefb59a9/%5BMY%5D%20Web%20Chat%20Broadcast%20User%20Guide%20(Seller%20Centre).pdf (fetched 2026-09-08)
- `FAQ Assistant.pdf` (Philippines market — used only as corroboration) — https://deo.shopeemobile.com/shopee/seller/seller_cms/ca93507fc17b0c9f475902c08531443b/FAQ%20Assistant.pdf (fetched 2026-09-08)
- `[MY] Shopee's Seller Penalty Points system_vF 15_5_2019.pdf` (7 years old — stale, cited with caveat) — https://cdngarenanow-a.akamaihd.net/shopee/seller/seller_cms/75463ad695291e20f06e28d275417301/%5BMY%5D%20Shopee's%20Seller%20Penalty%20Points%20system_vF%2015_5_2019%20(5).pdf (fetched 2026-09-08)

Attempted and confirmed UNFETCHABLE (client-rendered SPA, reported per standing rule rather
than reconstructed):
- https://seller.shopee.com.my/edu/article/1795 ("How is Chat Response Rate (CRR) Calculated?")
- https://seller.shopee.com.my/edu/article/4729 ("FAQs on Chat Response Rate (CRR) calculations")
- https://seller.shopee.com.my/edu/article/20378/auto-reply ("What is Auto-Reply")
- https://seller.shopee.com.my/edu/article/1798, /11267, /16563, /19372, /11027, /5866 (CRR-check, CRR-FAQ, customer-service-FAQ, chat-settings, and chat-statistics articles)
- https://seller.shopee.sg/edu/article/50/understanding-chat-response
- https://seller.shopee.sg/edu/article/2587/monitoring-chat-performance
- https://seller.shopee.ph/edu/article/11647/understanding-chat-response
- https://seller.shopee.ph/edu/article/3057

Cited as secondary/lead sources only, never as sole basis for a number without an
`UNSOURCED — MUST VERIFY` tag:
- https://www.duoke.com/en/blog/article/164-Shopee-Account-Health-2025-Boost-Your-Shopee-Chat-Response-Rate-CCR-Chat-Satisfaction
- https://www.duoke.com/en/blog/article/97-How-to-Improve-Your-Shopee-Chat-Response-Rate-CRR-and-Boost-Better-Customer-Service-CS
- https://www.duoke.com/en/blog/article/292-The-Ultimate-Guide-to-Using-Auto-Reply-2026
- https://www.duoke.com/en/blog/article/398-Malaysia-E-commerce-Chat-Response-Rate-Complete-Guide-2026-Lazada-Shopee-and-TikTok-Shop
- https://www.duoke.com/en/blog/article/45-Latest-policy-on-Shopee-Preferred-Sellers
- https://www.bigseller.com/blog/articleDetails/3276/shopee-seller-chat-response-rate.htm
- https://ginee.com/my/insights/preferred-seller-plus-shopee-malaysia/
- https://ginee.com/my/insights/auto-reply-shopee/
- https://www.forestshipping.com/shopee-updates-seller-performance-standards-fhr-lowered
- https://www.alibaba.com/product-insights/shopee-penalty-points-system-explained-2026.html
