# Steam Account Onboarding Runbook

How to stand up a new Steam account — one game per account — repeatably, at a pace that doesn't trip Steam's fraud checks. Follow the checklist in §5; §1–§4 explain the choices behind it so you don't re-litigate them each time.

**Scope.** This covers building inventory. Selling access to it is `docs/order-fulfillment-sop.md`. Buying games in cheaper foreign currencies (VPN / foreign payment / falsified billing) is **out of scope** — already researched and ruled out as prohibited and margin-negative for Malaysia.

**Settled context — don't re-derive:**

| | |
|---|---|
| Account creation pace | 1–3/week. Bursts trigger fraud review. |
| Phone numbers | 3–5 numbers across the first 20–50 accounts, staggered over days |
| Guard authenticator hold | New authenticator = 15-day trade/Market hold. Does **not** block login or play. |
| Guard secret capture | Steam Desktop Authenticator (github.com/Jessecar96/SteamDesktopAuthenticator), **official GitHub releases only**. "Open Desktop Authenticator" has no signed release — anything claiming to be one is fake. |
| ToS | Retaining the authenticator to serve non-owning buyers very likely violates the Steam Subscriber Agreement. Accepted business risk, decided 2026-08-19. Not reopened here. |

**Never commit a real email address, password, revocation code, `shared_secret`, `.maFile`, or Steam account name to this repo. It is public on GitHub.** Everything in this doc uses placeholders.

---

## 1. Email strategy

One Steam account per email is an operational requirement, not a Steam requirement. Steam will actually let you create multiple accounts against one contact email (you get a warning, then a "continue"). Ignore that — you want separation so a single inbox compromise or lockout can't take the whole fleet, and so each account's password-reset path is independent.

### Options compared

| Option | Cost | Setup effort | Real separation? | Fraud-check read | Verdict |
|---|---|---|---|---|---|
| Gmail plus-addressing (`you+tag@gmail.com`) | Free | Zero | **No** — all one mailbox, one Google account | Trivially normalised by any fraud system; Gmail also treats `a.b@` and `ab@` as identical, so dot-tricks aren't separation either | **Reject** |
| Separate free Gmail/Outlook accounts, one per Steam account | Free | High and rising | Yes | Neutral to Steam, but **Google/Microsoft themselves rate-limit new-account creation and demand phone verification** | **Reject** — it burns your scarce phone numbers on the *email* layer, competing with Steam's own phone needs |
| Custom domain + catch-all forwarding | ~RM50–70/yr domain, forwarding free | ~30 min once | Yes — unlimited distinct addresses, one inbox to watch | Not a disposable/blocklisted domain, so it clears Steam's disposable-email filters. No public evidence Steam penalises new domains | **Recommended** |
| Paid mailbox per account (Google Workspace etc.) | ~RM25+/user/mo | Medium | Yes | Neutral | **Reject** — cost scales linearly with accounts for zero added benefit |

### Recommendation: custom domain + Cloudflare Email Routing catch-all

Buy one domain, point DNS at Cloudflare, enable Email Routing with a catch-all rule forwarding everything to one Gmail inbox you already control. Free tier covers 200 explicit routing rules plus one catch-all, no message limit, no mailboxes to manage.

Why this wins:

- **Unlimited addresses at zero marginal cost.** Account #50 costs the same as account #1.
- **It doesn't consume phone numbers.** This is the decisive argument. Creating 50 Gmails needs ~50 phone verifications, and MCMC caps you at ~25 prepaid lines (§2). The email layer must not compete with Steam for that budget.
- **One inbox to monitor.** All Steam verification mail lands in one place, filterable by the `To:` address.
- **Portable.** If a forwarding provider dies, you re-point DNS. The Steam-side addresses never change.

Practical notes:

- Register the domain **now**, before you need it, so it has some age on it by the time you're at account #20. Use `.com` or `.my` — avoid `.xyz`/`.top`/`.click`, which carry spam reputation.
- Cloudflare Email Routing is **inbound only**. You can receive Steam's verification mail but not reply from those addresses without extra setup. Steam never requires you to send email, so this is fine. Don't build any process that assumes you can send.
- **Don't use a sequential naming pattern.** `steam001@`, `steam002@` is a machine-readable fleet signature. Use unrelated word-based local parts (`marbleoak@`, `tinvalley@`) from a wordlist, recorded in the tracker.
- The catch-all means you never pre-create addresses. Type a new local part into Steam's signup and the verification mail arrives. Then record it.
- Lock the destination Gmail down hard: strong unique password, its own hardware-key or app-based 2FA. It is the single point of failure for every account's password reset.

---

## 2. Phone verification (Malaysia)

A phone number isn't needed to *create* a Steam account. It's needed to add the Steam Guard **Mobile Authenticator**, which is the whole product. So every account needs one.

### The binding constraint is MCMC, not Steam

MCMC's Mandatory Standards for prepaid registration, registered **26 February 2026**: *"Service Providers and their representatives shall not register more than 5 SIM cards per customer/user."* Per service provider. Non-Malaysians get 2.

| | |
|---|---|
| Hard ceiling, Malaysian NRIC | **5 lines × ~5 telcos ≈ 20–25 numbers**, legitimately, in his own name |
| Lines registered before Feb 2026 | Grandfathered, not counted against the new cap |
| Practical target | 4–6 lines is plenty. Don't max out the cap for its own sake. |

### Cost per line

| Provider | Starter pack | Notes |
|---|---|---|
| Hotlink (Maxis) | RM10 | Preloaded RM5 credit (5-day validity) + 500MB |
| unifi Mobile | RM10 | |
| Yes 5G | RM10 | |
| redONE | RM10 | RM30 free credit released as RM5/mo over 6 months |
| U Mobile ULTRAplus | RM8 | Preloaded RM5 + 1GB activation bonus |
| Tune Talk / XOX (MVNOs) | Not confirmed; market band RM8–10 | Tune Talk sells a **one-year validity** add-on — useful, see below |

**Assume RM10/line acquisition.** The real recurring cost is keeping the line alive: prepaid numbers expire without top-up, and a dead line means no SMS if Steam ever forces re-verification or recovery. Budget **RM10–30/line/year** for validity top-ups, or buy Tune Talk's one-year validity product and stop thinking about it.

**Use eSIM.** As of July 2026, Hotlink, CelcomDigi, U Mobile, Tune Talk and XOX all offer eSIM on prepaid. A modern phone stores multiple eSIM profiles and switches between them in software — no SIM tray juggling, no second handset, instant activation. This is the single biggest quality-of-life change to this workflow.

### Reuse: yes, but treat it as risk clustering, not cost saving

| Question | Answer |
|---|---|
| Can one number be on several Steam accounts at once? | **Yes.** Steam explicitly allows it — log into each account and enable the authenticator on each. |
| Can a number be freed from an account and reused? | **Yes.** Store → Account details → Manage your phone → Remove phone (confirm via authenticator code or SMS). The number is then free. |
| Cooldown on reusing a freed number elsewhere? | **None published.** The old 3-month post-VAC-ban cooldown was removed when Trust Factor shipped. |
| Cost of removing a phone from an account | Removing the phone **also removes the mobile authenticator**. Re-adding either restarts the **15-day trade/Market hold**. Don't do this casually on a live account. |
| The catch | **Steam may treat accounts sharing a phone number as the same identity** for Subscriber Agreement enforcement. |

That last row is the one that matters. It makes phone allocation a **blast-radius decision**. If one account gets actioned and Steam walks the number, everything on that number is exposed.

**Allocation rule: max 5 accounts per number.** At 4–6 numbers that's 20–30 accounts, which covers you to 25 comfortably. Past 30, add lines rather than stacking. Put your highest-revenue titles on numbers with the fewest siblings. Record the number↔account mapping in the tracker so you can see the clusters.

---

## 3. Payment method

Every game is bought legitimately in MYR on Steam MY. The question is *what instrument touches Steam*, and the answer is: **not your card, ever.**

### Recommendation: Steam Wallet MYR codes, one per account

Buy Steam Wallet MYR codes with your own card / e-wallet from a reseller, then redeem one code per Steam account and pay for the game from wallet balance.

Why:

1. **Your card never appears on any Steam account's payment record.** Using one card across many Steam accounts is the highest-signal fraud pattern available to you, and it's documented to backfire — Steam Support has told users *"you will need to use this payment method from the primary account it was registered to"* after a card was spread across accounts, locking it out of the original account.
2. **It clears the limited-account state in the same step.** New Steam accounts are "limited" until USD 5 equivalent is spent; a wallet code counts at redemption time. One action, two problems solved.
3. **It decouples your bank's fraud rules from the Steam side.** You make a handful of larger reseller purchases instead of 50 small identical Steam charges.
4. **Cash option exists.** Razer Gold / Steam codes are sold over the counter at 7-Eleven Malaysia, which breaks the card link entirely if you ever want that.

### Where to buy

| Channel | Notes |
|---|---|
| Shopee / Lazada MY | RM100 / RM200 denominations commonly listed. You're already on Shopee rails. |
| Codashop MY, SEAGM, UniPin, Lapakgaming | Instant email/on-screen delivery |
| 7-Eleven Malaysia | Physical Razer Gold / Steam counter top-up |

Payment into the reseller: FPX (Maybank, CIMB, Public Bank, RHB, Hong Leong), Touch 'n Go eWallet, GrabPay, Boost, ShopeePay, DuitNow QR, cards. DuitNow QR clears fastest (~35–55s); FPX is slowest (1–3 min, extra OTP step).

### Velocity and fraud limits worth knowing

| Limit | Detail | How to stay clear |
|---|---|---|
| **Issuer velocity** | Banks flag many same-merchant, same-amount charges in a short window. Users report Steam purchases declining after several in one day, then clearing the next day. | Buy codes in **batches of 2–3 per session**, a few days apart. Match the account-creation cadence — you don't need 50 codes on day one. |
| **Steam code redemption rate limit** | Repeated invalid/used code entries trigger *"too many recent activation attempts from this account or Internet address."* User reports: ~30–60 min lockout after ~10 bad attempts, and retrying during the cooldown **resets the timer**. | Copy-paste one code at a time. If one fails, **stop** — don't retype it. Wait an hour. |
| **Retail gift-card caps** | Some retailers cap gift-card value per hour as fraud prevention. | Only relevant when buying physical at volume. Split across visits. |
| **Currency lock** | MYR wallet codes only redeem on accounts whose wallet currency is **MYR**. | Create every account from Malaysia, no VPN. Falls out of the scope exclusion anyway. |

**Do not** put one card on multiple Steam accounts to "save a step." That step is the whole point.

---

## 4. Standing setup (do once, before account #1)

| # | Task | Output |
|---|---|---|
| 1 | Register the domain, move DNS to Cloudflare, enable Email Routing catch-all → your locked-down Gmail | Unlimited Steam-ready addresses |
| 2 | Harden the destination Gmail: unique password, hardware/app 2FA | Single point of failure secured |
| 3 | Acquire 4–6 prepaid lines (eSIM preferred), spread across telcos, staggered over days | Phone budget |
| 4 | Install Steam Desktop Authenticator from the **official GitHub releases page only**. Needs .NET 8. | Guard secret capture tool |
| 5 | Set up a password manager vault (Bitwarden / 1Password) with a folder per account | Where revocation codes live |
| 6 | Set up an encrypted offline backup location for `.maFile`s (encrypted volume or archive — **not** cloud plaintext, **not** this repo) | Disaster recovery |
| 7 | Create the account tracker spreadsheet with the columns in §6 | Unit economics |
| 8 | **Dry-run the whole §5 sequence on account #1 and stop.** Confirm SDA still links successfully before committing to a fleet. | De-risked (see Known Gaps) |

---

## 5. Per-account checklist

Budget **30–45 minutes** per account. Do not run two accounts back-to-back within the same hour — space them by hours or days.

**Before you start:** have a Steam Wallet MYR code in hand covering the game price, and know which phone line this account goes on.

| # | Step | Detail | Record |
|---|---|---|---|
| 1 | **Pick the email address** | New word-based local part on your domain. Nothing sequential, nothing tied to the game. | Email address |
| 2 | **Create the Steam account** | store.steampowered.com → Login → Join Steam. Malaysian IP, no VPN. Steam account name also non-sequential. Strong unique password from the password manager. | Account ref, Steam account name, date created |
| 3 | **Verify the email** | Verification mail arrives in the catch-all inbox. Click through. | — |
| 4 | **Confirm currency is MYR** | Should default from your IP. Confirm before spending — MYR wallet codes won't redeem otherwise. | — |
| 5 | **Redeem the wallet code** | Account details → Add funds / Redeem a Steam Wallet Code. **One code, copy-pasted, one attempt.** If it fails, stop and wait an hour. | Wallet code cost (RM) |
| 6 | **Confirm limited status cleared** | Redemption of ≥USD5 equivalent lifts the limited-account restriction. | — |
| 7 | **Buy the game** | Pay from wallet balance. No card on the account, ever. | Game title, game price (RM), purchase date |
| 8 | **Add the phone number** | Account details → Manage phone → Add phone. SMS confirm. Use the line allocated to this account's cluster (≤5 accounts per line). | Phone line ref |
| 9 | **Link Guard via SDA** | Steam Desktop Authenticator → add account → log in → SMS confirm. SDA generates the `.maFile`. | Guard linked date, **15-day hold end date** = +15 days |
| 10 | **Record the revocation code immediately** | SDA displays it (format `R#####`). **Write it into the password manager entry for this account before you close the window.** It is the only way to recover the account if the authenticator is lost. | Password-manager entry ref |
| 11 | **Back up the `.maFile`** | Copy from `SteamDesktopAuth/maFiles/<steamID>.maFile` to the encrypted backup location. Treat it like a password. **Never** upload it, never put it in this repo, never leave it unencrypted on a shared machine. | Backup location ref |
| 12 | **Capture the `shared_secret`** | Open the `.maFile` in a text editor; it's a JSON field. This is what the admin panel needs to generate Guard codes. | — (never written down outside the vault/admin panel) |
| 13 | **Add to the admin panel** | `/admin` → Steam Accounts → Add Account. Paste account name, password, and `shared_secret`. The form encrypts password + Guard secret automatically. Then add the game under Games and link it to this account. | Admin panel account id |
| 14 | **Verify end-to-end** | Generate a code from the admin panel, log into Steam with it. If that works, the account is sellable. | Status → `active` |
| 15 | **Sanity check it's playable** | Launch the game once. The 15-day hold blocks trade/Market only, not login or play — confirm that holds for this account before listing. | — |
| 16 | **List on Shopee** | Fulfilment then follows `docs/order-fulfillment-sop.md`. | Listing ref |

**The account is sellable immediately after step 14.** You do not wait out the 15-day hold — it only affects trading and the Community Market, neither of which this business uses.

---

## 6. What to record per account

One row per Steam account in the tracker spreadsheet. **This spreadsheet lives outside the repo.**

| Column | Why |
|---|---|
| Account ref (short internal id) | The only identifier used in commits, notes, or anywhere public |
| Date created | Pacing audit — proves you're inside 1–3/week |
| Email address | Which catch-all address; needed for password reset |
| Steam account name | Login |
| Phone line ref (e.g. "Line C") | **Cluster tracking** — how many accounts share this number's blast radius |
| Game title | Inventory |
| Game price (RM) | COGS |
| Wallet code cost (RM) | COGS — flag if code price ≠ game price (leftover balance) |
| Guard linked date | — |
| 15-day hold ends | Only matters if you ever need trade/Market |
| Revocation code location | **Password-manager entry name only.** Never the code itself, anywhere but the vault. |
| `.maFile` backup location | Recovery |
| Admin panel account id | Ties tracker row to the live system |
| Status | `active` / `recovering` / `banned` — mirrors the admin panel |
| Units sold | Revenue side |
| Revenue to date (RM) | Unit economics |

Derived per account: **margin = revenue − (game price + amortised SIM + amortised domain)**. Break-even is roughly the first buyer; everything after is contribution.

---

## 7. Throughput and cost

### Timeline at 1–3 accounts/week

Plan on **2/week**. One is too slow to build inventory; three is the ceiling and shouldn't be the routine.

| Target | At 1/wk (slow) | At 2/wk (**plan**) | At 3/wk (ceiling) |
|---|---|---|---|
| 10 accounts | 10 weeks | **5 weeks** | 4 weeks |
| 25 accounts | 25 weeks (~6 mo) | **13 weeks (~3 mo)** | 9 weeks |
| 50 accounts | 50 weeks (~1 yr) | **25 weeks (~6 mo)** | 17 weeks |

**Reaching 50 is a six-month project at a sane pace.** If the business plan needs 50 accounts live in eight weeks, the plan is wrong, not the pace.

Phone-line checkpoints on that path: 10 accounts → 2 lines. 25 accounts → 5 lines. 50 accounts → 10 lines, which **exceeds** what any 2 telcos allow and pushes you across 3–4 providers. Acquire lines ahead of account creation, not behind it.

### Cost per account

Using a RM100 game as the reference — substitute the real title price.

| Component | Per account | Working |
|---|---|---|
| Game (in MYR, on Steam MY) | **RM100** | The dominant cost. Varies entirely by title. |
| SIM amortised | **~RM4** | RM10 starter ÷ 5 accounts/line = RM2, plus ~RM10/yr validity ÷ 5 = RM2 |
| Domain amortised | **~RM1.20** | ~RM60/yr ÷ 50 accounts |
| **Cash cost** | **~RM105** | |
| Time | **30–45 min** | Notionally RM25–38 at RM50/hr |
| **All-in** | **~RM130–145** | |

Read the table this way: **infrastructure is noise (~RM5), the game is the business, and your time is the second-largest line item.** Cheaper SIMs or a cheaper domain change nothing. The two levers that matter are (a) game selection — cost vs. how many buyers a title supports, and (b) getting the per-account run from 45 minutes toward 30 by having codes, addresses and line allocation prepared in advance.

At 50 accounts × RM100 games, total capital deployed is ~RM5,250 plus ~30 hours of your time. That's the number to hold in your head before scaling.

### Suggested rhythm

One **90-minute block per week**, same day each week, two accounts. In that block: pre-buy the next batch of wallet codes if running low, create both accounts spaced ~45 min apart, update the tracker, verify both end-to-end. Monthly: check line validity across all numbers and top up anything near expiry.

---

## Known gaps / unknowns

Things this runbook could not verify. Confirm on account #1 before scaling.

| Gap | Impact | How to close |
|---|---|---|
| **Steam Desktop Authenticator is unmaintained.** Last release v1.0.15, October 2023. The author states it will receive no further updates and recommends the official mobile app instead. There are secondhand reports of a Valve change around March 2026 breaking some SDA linking guides. | **High.** If SDA can't link new accounts, the model's secret-capture step is broken. | Dry-run steps 9–12 on account #1 **before** buying any more games. If SDA fails, evaluate `steamguard-cli` (dyc3/steamguard-cli — actively maintained, self-described beta) as fallback. Do not scale until one is proven working. |
| **Whether Steam MY checkout directly offers Touch 'n Go / Boost / GrabPay / ShopeePay.** Every source found describes *reseller* payment options, not Valve's own MY checkout. | Low — the wallet-code strategy bypasses this entirely. | Look at the actual checkout screen once. |
| **No published Steam limit on accounts per phone number**, or on accounts created per day per IP. The "5 per number" rule in §2 is a risk judgment, not a Steam-stated limit. | Medium. | Unknowable from outside. The conservative allocation stands. |
| **Whether Steam scores a brand-new custom domain worse than an aged Gmail.** No public evidence either way. | Low. | Register the domain early so it ages; watch for verification-mail failures on the first few accounts. |
| **Per-telco enforcement of the MCMC 5-SIM cap**, and whether eSIM profiles count identically to physical SIMs against it. | Medium at 50 accounts, irrelevant at 10. | Ask at the counter when buying line #5 from any one telco. |
| **Steam wallet-code redemption cooldown numbers** (~10 attempts → 30–60 min) are user-reported, not official. | Low — the mitigation (one careful paste, stop on failure) is correct regardless. | — |
| **Exact starter-pack prices for Tune Talk, XOX, Yoodo.** RM8–10 is the confirmed band from Hotlink, redONE, unifi, U Mobile and Yes. | Negligible — RM2 variance on a ~RM4 amortised line. | Check at purchase. |
| **Ban-cascade behaviour across accounts sharing a phone number** is a documented *policy statement* ("may be treated as the same identity"), not an observed enforcement pattern at this scale. | Medium-high. Nobody publicly runs this model at scale, so there's no precedent to read. | Keep clusters small; log which accounts share a line so any cascade is diagnosable after the fact. |

---

## Sources

Steam: [multiple accounts / one email](https://help.steampowered.com/en/faqs/view/2A85-29DD-C16A-D129) · [phone on multiple accounts](https://steamcommunity.com/discussions/forum/1/1489992080501353141/) · [15-day hold on re-adding phone + authenticator](https://steamcommunity.com/groups/community_market/discussions/0/3192485276072670531/) · [limited-account USD5 threshold](https://steamcommunity.com/discussions/forum/1/2941371547495172568/) · [same card across accounts](https://steamcommunity.com/discussions/forum/1/619568793893502145/) · [wallet code redemption limits](https://steamcommunity.com/discussions/forum/1/1643167006267774300/) · [SDA releases](https://github.com/Jessecar96/SteamDesktopAuthenticator/releases) · [steamguard-cli](https://github.com/dyc3/steamguard-cli)

Malaysia: [MCMC prepaid SIM limit FAQ](https://www.mcmc.gov.my/en/faqs/prepaid-registration/is-there-a-limit-to-the-number-of-prepaid-sim-card) · [MCMC 5-per-telco framework, Feb 2026](https://www.thestar.com.my/tech/tech-news/2026/02/26/malaysians-can-hold-up-to-five-prepaid-sim-cards-each-per-telco-under-new-mcmc-framework) · [MCMC enforcement](https://www.lowyat.net/2026/384391/mcmc-enforces-prepaid-sim-registration-rules/) · [Hotlink prepaid](https://www.hotlink.com.my/en/products/prepaid/) · [prepaid plan pricing](https://my.priceshop.com/en/news/most-affordable-prepaid-plans-malaysia/) · [Tune Talk eSIM](https://www.tunetalk.com/prepaid/services/esim/) · [Steam Wallet MYR payment rails](https://redxgame.com/blog/steam-wallet-myr/steam-wallet-myr-via-tng-ewallet-6-step-kl-guide-2026) · [Codashop MY](https://www.codashop.com/en-my/steam-wallet-code-sea) · [7-Eleven Malaysia services](https://www.7eleven.com.my/services/)

Email: [Cloudflare Email Routing](https://developers.cloudflare.com/email-service/configuration/email-routing-addresses/)
