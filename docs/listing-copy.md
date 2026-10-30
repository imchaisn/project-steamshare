# Listing Copy — paste-ready titles & descriptions

**This is the upload source of truth.** Every title and description below is written to be copied
verbatim into Shopee Seller Centre (or pushed via `add_item` / `update_item`). Generated 2026-09-06
against live Steam data (`appdetails`, `cc=my`) and the live shop state.

## SEO title rotation pass — 2026-09-06

Every title in this file used one identical formula, which meant 25 listings competing for the same
words. All 38 games now carry a **rotated** title drawn from six patterns, several of them in Malay
(`Akaun Steam`, `Game PC Original`, `Delivery 24 Jam`, `Murah`) since Shopee MY's buyer base and UI
are substantially Malay-speaking.

**What was and was not applied:**

| Part | State | What this file now shows |
|---|---|---|
| Part 1 (10) | **LIVE on Shopee** | Applied title kept. New one added as `Proposed title` — changing a live listing is Chaison's call, not an agent's |
| Part 2 (15) | UNLIST drafts uploaded | Applied title kept. New one added as `Proposed title` — the draft on Shopee still carries the old text |
| Part 3 (8) | Nothing uploaded | **Written fresh.** There is no live state to drift from |
| Part 4 (5) | Nothing uploaded | **Written fresh** 2026-09-06, after the rotation pass |

Parts 1 and 2 were deliberately *not* overwritten. This file is the upload source of truth and
`scratchpad/verifycopy.mjs` diffs live Shopee listings against it byte-for-byte; silently rewriting
it would make the next verify run report drift that looks like a Shopee-side fault.

**Every title was re-checked mechanically, not by eye** — character count re-derived from the text
(not trusted from the writer's own count), ASCII-only, and matched against the banned-claims list
below. 38/38 pass, re-run after every addition. `FACT-V` 2026-09-06.

**Honest limit on the keyword research.** Shopee's own listing pages are barely indexed by general
web search. Solid live shopee.com.my evidence came back for Euro Truck Simulator 2, Stacklands,
Horizon Zero Dawn, Thronefall, Sekiro, AC Valhalla, Metal Gear Delta, Resident Evil Requiem (listed
there as "Resident Evil 9"), Black Myth: Wukong (as 黑神话:悟空) and Empire of the Ants. For the rest
— notably Dokimon Quest, How to Fish, Escape From Duckov, Norland and Into the Dead — **no Shopee MY
listing was found at all**, and those titles rest on general Malaysian commerce vocabulary rather
than observed search data. Each is tagged in the per-game keyword lines. Treat the Malay phrasing as
a hypothesis to A/B, not an established win.

---

> Supersedes the copy in `docs/shopee-listings.md`. That file's per-game *Title options* and
> *Description* blocks were drafted 2026-08-26, never used, and no longer match either the live
> listings or the title convention. Keep it for the banner/asset notes and the claims table; use
> **this** file for copy.

---

# Part 1 — Live on Shopee (10 games)

## House rules

**Title formula** — game name FIRST (it is the term buyers search), then the fixed tail:

```
<Game> | Steam PC Game | FULL GAME | 24H AUTO DELIVERY | ORIGINAL | OFFLINE
```

Shopee's cap is 120 characters; Chaison's 2026-09-07 override says fill it (~115 avg).

**The last slot is `OFFLINE`, with one exception: `LOCAL CO-OP` is allowed where Steam lists
`Shared/Split Screen Co-op`.** The test is *split screen present*, NOT *co-op present* — online
co-op is unreachable from Offline Mode and must never be claimed, but split-screen co-op genuinely
works on one shared account offline, and buyers buy those games for it. See Chaison's standing
override in `.claude/skills/ss-market/SKILL.md` §1a.

Of our listed games exactly one qualifies today: **WARRIORS OROCHI 3 Ultimate** (`Single-player` +
`Shared/Split Screen Co-op`). ETS2, Schedule I, Tribes of Midgard, Ghost of Tsushima, FANTASY LIFE i
and Palworld are online-co-op only — `OFFLINE` is correct for all six.

⚠️ This rule has now been broken in BOTH directions. It once instructed a blanket `CO-OP` tail, which
shipped online-co-op claims on three live listings. It was then over-corrected to a blanket `OFFLINE`,
which stripped a legitimate split-screen claim. Apply the split-screen test per game; do not blanket
either way.

**Three claims are banned in new copy:**

| Claim | Why not |
|---|---|
| `LIFE TIME GUARANTEE` | There is no guarantee to give while `/terms` is a placeholder. Carried by the three oldest titles; removed here. |
| `DLC+` / `FREE DLC` | Only true if that specific account owns the DLC, which nobody has verified per-account. Steam DLC counts below are what *exists*, not what we own. |
| Anything reading as a **key** or **code** | We deliver *login details*, not an activation key. The live Duckov description says "code delivered within 24 hours" — that is the single most likely "not as described" dispute in the shop. Fixed in this file. |

**`24H AUTO DELIVERY` is now honest.** Auto-fulfilment went live 2026-09-05. Still never write
*instant*.

**Steam Cloud.** The "turn Steam Cloud off" line belongs only in games that have it. Steam's category
data lists no Steam Cloud for **How to Fish** and **Tribes of Midgard**, so their descriptions omit
that line — telling a buyer to disable a setting the game does not have reads as copy-paste sloppiness.
(The currently-live How to Fish description carries that line and should lose it.)

**Description template** — every game uses this skeleton, only the name, pitch and the two
conditional lines change:

```
<GAME> — Steam shared account

<pitch: one or two lines, concrete, no marketing adjectives>

WHAT YOU GET
- Login for a Steam account that owns <Game>
- A Steam Guard code whenever Steam asks for one
- The full base game

HOW IT WORKS
1. Pay, then open Shopee Chat - your login is sent there automatically
2. Sign in to Steam with those details
3. When Steam asks for a verification code, follow the steps in that same chat message
4. Enter the code straight away - it is short-lived

BEFORE YOU PLAY
- Play in Offline Mode
- Turn Steam Cloud OFF — it can overwrite other players' saves        <- omit if no Steam Cloud

PLEASE NOTE
- This is a SHARED account, not a personal account
- Do not change the password, email or any account setting
- Delivery is automatic, within 24 hours of payment
- Support through Shopee chat
```

### 🔶 PROPOSED replacement template — awaiting Chaison, 2026-09-07

The template above has **two defects, both live on all 38 Part 1–4 descriptions:**

1. **It prints `www.gameshare.space` twice.** Shopee MY's Listing Violation Guide treats an
   external URL that directs transactions off-platform as a violation — 1 penalty point per 2
   deleted listings.
2. **It tells buyers to enter a Steam username.** The lookup form has taken an order id and
   nothing else since 2026-09-06.

**Removing the URL strands nobody — verified, not assumed.** `buildDeliveryMessage()`
(`lib/fulfillment.ts`) already sends `SITE_URL`, `TUTORIAL_URL` and `STEP_7_URL` in the automated
Shopee chat message, on every order, within 24 hours of payment. The description was a duplicate
of information the buyer receives anyway — which is exactly why it is safe to drop, and why the
`ss-market` skill puts retrieval instructions in the chat message.

```
<GAME> — Steam shared account

<pitch: one or two lines, concrete, no marketing adjectives>

WHAT YOU GET
- Login for a Steam account that owns <Game>
- The full base game
- A Steam Guard code whenever Steam asks for one

HOW IT WORKS
1. Pay, then open your Shopee chat with us
2. Your login is sent there automatically, within 24 hours - Order ID, username and password,
   plus the link that gives you your Steam Guard code
3. Open Steam and sign in with them
4. When Steam asks for a verification code, follow that link and press Get Code
5. Type it into Steam straight away - the code is short-lived

BEFORE YOU PLAY
- Play in Offline Mode
- Turn Steam Cloud OFF - it can overwrite other players' saves     <- omit if no Steam Cloud
- The full step-by-step guide is linked in your Shopee chat message

PLEASE NOTE
- This is a SHARED account, not a personal account
- Do not change the password, email or any account setting
- Delivery is automatic, within 24 hours of payment
- Support through Shopee chat
```

**Not applied.** Editing 38 live descriptions is Chaison's call. Applying it is mechanical once
approved, and `scratchpad/verifycopy.mjs` will report drift on all 38 until both sides match —
so update this file and the listings in the same pass, never one without the other.

---

## 🔍 Mechanical audit, 2026-09-07 — every title and every banner claim

Run against the file and `scripts/games-data.mjs`, not by eye. `FACT-V`.

### Titles — 72 entries parsed

| Check | Result |
|---|---|
| Over Shopee's 120-char cap | **0** |
| Corrupt / empty / multiline | **0** — the three previously reported as "corrupted to a single backtick" (Storyteller, Thronefall, Love Is All Around) are intact. That warning is now stale; it has been removed from the `ss-market` skill. |
| **Stated count ≠ actual** | **9 of the 49 entries that carry a count — an 18% error rate.** All nine corrected below. |
| Length spread | min 76, max 120, mean 99.9 |

The nine corrected counts (the **titles were not touched**, only the annotation beside them):

| Line | Was | Actual | Title |
|---|---|---|---|
| 246 | 106 | **101** | Euro Truck Simulator 2 ETS2 Steam Account \| Original PC Game … |
| 252 | 94 | **96** | Euro Truck Simulator 2 ETS2 \| Steam PC Game \| FULL GAME … |
| 395 | 107 | **102** | Steam PC \| Schedule 1 (Schedule I) \| Full Game Original … |
| 601 | 88 | **90** | Tribes of Midgard \| Akaun Steam \| Game PC Original … |
| 859 | 109 | **111** | Steam PC \| Ghost of Tsushima Director's Cut … |
| 963 | 107 | **109** | FANTASY LIFE i: The Girl Who Steals Time … |
| 1181 | 105 | **100** | WARRIORS OROCHI 3 Ultimate Steam Account … |
| 2416 | 79 | **81** | Palworld \| Akaun Steam \| Game PC Original … |
| 2470 | 103 | **105** | Steam PC \| Red Dead Redemption 2 RDR2 … |

Counts cross-checked against `wc -c` independently of the parser. This matters for the fill-the-cap
strategy: a title believed to be at 107 that is really at 109 has 11 characters of headroom, not 13.

### ✅ The co-op tails are CORRECT — do not "fix" them

Exactly **two** of the 72 titles contain co-op/online/multiplayer/PvP wording:

- **Call of Duty WWII** — `Offline Local Co-Op`
- **Split Fiction** — `2 Player Split Screen Co-op … LOCAL CO-OP`

Both are precisely the games Steam lists `Shared/Split Screen Co-op` for, which is exactly what
Chaison's 2026-09-07 override permits. **No title claims online co-op.** Ready or Not and
Subnautica 2 — online co-op only, no split screen — correctly end `OFFLINE`.

Recorded because this is the third time this section has been rewritten. **The current state is
correct. A session that "enforces" a blanket co-op ban here is reintroducing a bug, not fixing one.**

### Banner claims — 47 games × ~8 surfaces

Every buyer-visible string in `games-data.mjs` (title, genre, badge3, and each feature head/body)
checked against the claim rules:

- **`FREE DLC INCLUDED` on exactly 4 games** — dave-the-diver, euro-truck-simulator-2,
  escape-from-duckov, dokimon-quest. This is the complete set, not a sample.
- **Zero** hits for online/co-op, lifetime, guarantee, refund or "instant" anywhere in the banner
  data. The other 5 regex hits are false positives — "free-roam", "free mode", "free traversal",
  "both included" (the Uncharted collection genuinely is two games), "yours to arrange". No action.

---

## 📊 Publish readiness, derived 2026-09-07 — `scripts/publish-readiness.mjs`

Stop quoting a hand-counted "~23 games earning nothing"; it goes stale every time art is rendered.
The script derives it by joining `games-data.mjs` (art) × `lib/catalogue.ts` (purchasable) × this
file (copy + verdicts) on the Steam app id.

| Bucket | Count | Meaning |
|---|---|---|
| ✅ Live / purchasable | **10** | Earning today |
| 🟢 **Art + copy done, not purchasable** | **30** | **The real opportunity.** Needs: publish → map `(item_id, model_id)` → confirm NORMAL → add to `lib/catalogue.ts` |
| ⚠️ Verify before listing | **1** | Call of Duty: WWII — see the contradiction below |
| 🔴 Do not list | **6** | Star Wars Outlaws, AC Shadows, AC Valhalla, RDR2, WWE 2K26, EA SPORTS FC 26. **Not idle inventory** — publisher-account/DRM requirements an Offline-Mode buyer cannot satisfy |
| 📝 Copy but no art | **1** | Split Fiction — run `gen-banners.mjs` |

**Nothing is blocked on writing copy. All 47 games with art already have a copy block.**

### Two defects this surfaced in *this file*

**1. The duplicate headings silently erase safety verdicts.** Star Wars Outlaws, AC Shadows, AC
Valhalla and RDR2 each have **two** `## … App <id>` headings: the first carries `🔴 DO NOT LIST`,
the second (P25–P28) carries nothing. Any tool that keeps the last heading per app id — the obvious
implementation — files all four as *opportunity*. The script now takes the most severe verdict
across every duplicate. **A DO NOT LIST must not be cancellable by a later duplicate that merely
forgot to repeat it.**

**2. Headings use two different delimiters.** 47 use an em-dash before `App`, and 9 — the entire
J-series — use a plain hyphen. Matching only the em-dash dropped all nine and reported six games as
"needs copy written" when their copy already existed, which would have sent someone to redo
finished work.

### ⚠️ Call of Duty: WWII contradicts itself three ways — a human must settle it

| Line | Says |
|---|---|
| 3506 (its own heading) | `⚠️ verify the Activision account prompt first` |
| 3083 (2026-09-07 roast table) | *"no third-party account notice … Listable — my earlier Activision flag was unfounded"* |
| 3256 | `Activision/Battle.net account` — `UNSOURCED — MUST VERIFY` |

Two of three say unverified, so the script classifies it **VERIFY**, which is the fail-safe reading.
This is not a fresh finding — it is the file disagreeing with itself, and it matters because
Call of Duty: WWII is also the single shipping title carrying a co-op claim.

---

## Status at a glance

**Applied to the live shop 2026-09-06.** Every listing below was verified byte-for-byte against
this file afterwards — titles, descriptions, and no banned claims. Re-run the check any time with
`scratchpad/verifycopy.mjs`.

| Game | item_id | Price | Steam | Applied |
|---|---|---|---|---|
| Stacklands | 52367419203 | RM0.99 | RM24.99 | ✅ |
| Tribes of Midgard | 52467419241 | RM0.99 | RM9.75 | ✅ |
| How to Fish | 48217427795 | RM1.29 | RM21.99 | ✅ title kept, Cloud line removed |
| Dokimon Quest | 52667425632 | RM1.29 | RM38.50 | ✅ |
| Batman Arkham Knight | 45017441353 | RM1.29 | RM38.00 | ✅ |
| Schedule I | 48217450246 | RM1.59 | RM49.00 | ✅ |
| Lords of the Fallen 2014 | 45417439240 | RM1.59 | RM79.00 | ✅ |
| DAVE THE DIVER | 46516993841 | RM1.59 | RM49.00 | ✅ retitled 103 → 83, claims dropped |
| Euro Truck Simulator 2 | 40634236344 | RM1.59 | RM54.00 | ✅ retitled 112 → 94 |
| Escape From Duckov | 49766310127 | RM1.59 | RM54.62 | ✅ retitled 117 → 87, claims dropped |

**Pricing rule** (all below RM1.99, tiered on current Steam price):
`≤RM15 → RM0.99` · `RM15–45 → RM1.29` · `>RM45 → RM1.59`. Dave, ETS2 and Duckov carry variations;
every model is priced the same.

---

## 1. DAVE THE DIVER — App 1868140

*MINTROCKET · 28 Jun 2023 · Adventure/Casual/RPG/Simulation · RM49.00 on Steam · 5 DLC exist ·
single-player · full controller support · has Steam Cloud · RM1.59*

🔸 **Proposed SEO title — NOT APPLIED. This listing is LIVE on Shopee; changing it is Chaison's call.**

**Proposed title** (102, P3)
```
[PC] DAVE THE DIVER - Shared Steam Account | Full Game | Auto Delivery Within 24H | Original | Offline
```
**Keywords:** dave the diver, akaun steam, shared steam account, steam pc game, full game, 24h auto delivery, original, offline

**Title — currently applied** (83)
```
DAVE THE DIVER | Steam PC Game | FULL GAME | 24H AUTO DELIVERY | ORIGINAL | OFFLINE
```

**Description**
```
DAVE THE DIVER — Steam shared account

Dive the Blue Hole by day, run a sushi restaurant by night. A mix of exploration,
fishing and restaurant management that keeps changing shape as you play.

WHAT YOU GET
- Login for a Steam account that owns DAVE THE DIVER
- A Steam Guard code whenever Steam asks for one
- The full base game

HOW IT WORKS
1. Pay, then open Shopee Chat - your login is sent there automatically
2. Sign in to Steam with those details
3. When Steam asks for a verification code, follow the steps in that same chat message
4. Enter the code straight away - it is short-lived

BEFORE YOU PLAY
- Play in Offline Mode
- Turn Steam Cloud OFF - it can overwrite other players' saves

PLEASE NOTE
- This is a SHARED account, not a personal account
- Do not change the password, email or any account setting
- Delivery is automatic, within 24 hours of payment
- Support through Shopee chat
```

---

## 2. Euro Truck Simulator 2 — App 227300

*SCS Software · 12 Oct 2012 · Indie/Simulation · RM54.00 on Steam · 108 DLC exist · online co-op ·
has Steam Cloud · RM1.59*

`ETS2` is kept in the title — it is a heavily searched abbreviation and worth the 5 characters.

🔸 **Proposed SEO title — NOT APPLIED. This listing is LIVE on Shopee; changing it is Chaison's call.**

**Proposed title** (101, P2)
```
Euro Truck Simulator 2 ETS2 Steam Account | Original PC Game | Full Game | 24 Hour Delivery | Offline
```
**Keywords:** euro truck simulator 2, ets2, steam account, original pc game, full game, 24 hour delivery, truck driving simulator

<!-- KEYWORD FIX 2026-09-07 — `online co-op` REMOVED, and deliberately NOT replaced with a
     co-op term of any kind. FACT-V, Steam appdetails app 227300 cc=my: categories are
     Single-player | Multi-player | Co-op | Online Co-op — there is NO `Shared/Split Screen
     Co-op`. So neither `online co-op` (unreachable in Offline Mode) nor `local co-op` (the
     game has no split screen at all) is a true claim here; the second would be worse than the
     first, because it describes a feature that does not exist rather than one the buyer merely
     cannot reach. `truck driving simulator` replaces it: true, and the highest-intent search
     term for this title. THE LIVE LISTING STILL CARRIES THE OLD KEYWORDS — see
     docs/publish-packets/LIVE-KEYWORD-FIX.md. Found by project-steamshare-5a. -->


**Title — currently applied** (96)
```
Euro Truck Simulator 2 ETS2 | Steam PC Game | FULL GAME | 24H AUTO DELIVERY | ORIGINAL | OFFLINE
```

**Description**
```
EURO TRUCK SIMULATOR 2 — Steam shared account

Haul cargo across Europe and grow one truck into a fleet. Long roads, real
logistics, and a cab you will spend a lot of hours in.

WHAT YOU GET
- Login for a Steam account that owns Euro Truck Simulator 2
- A Steam Guard code whenever Steam asks for one
- The full base game

HOW IT WORKS
1. Pay, then open Shopee Chat - your login is sent there automatically
2. Sign in to Steam with those details
3. When Steam asks for a verification code, follow the steps in that same chat message
4. Enter the code straight away - it is short-lived

BEFORE YOU PLAY
- Play in Offline Mode
- Turn Steam Cloud OFF - it can overwrite other players' saves

PLEASE NOTE
- This is a SHARED account, not a personal account
- Do not change the password, email or any account setting
- Delivery is automatic, within 24 hours of payment
- Support through Shopee chat
```

---

## 3. Escape From Duckov — App 3167020

*Team Soda · published by bilibili · 16 Oct 2025 · Action/Adventure/Indie/RPG · RM54.62 on Steam ·
1 DLC exists · single-player · has Steam Cloud · RM1.59*

🔸 **Proposed SEO title — NOT APPLIED. This listing is LIVE on Shopee; changing it is Chaison's call.**

**Proposed title** (85, P1 (adapted — see note))
```
Escape From Duckov | PC Steam Original Game | FULL GAME | 24H AUTO DELIVERY | OFFLINE
```
**Keywords:** escape from duckov, duckov, pc steam original game, full game, 24h auto delivery, offline

**Title — currently applied** (87)
```
Escape From Duckov | Steam PC Game | FULL GAME | 24H AUTO DELIVERY | ORIGINAL | OFFLINE
```

**Description**
```
ESCAPE FROM DUCKOV — Steam shared account

An extraction survival RPG in a duck's world. Scavenge, haul the loot home, and
build a hideout worth defending. PVE only - nobody is hunting you.

WHAT YOU GET
- Login for a Steam account that owns Escape From Duckov
- A Steam Guard code whenever Steam asks for one
- The full base game

HOW IT WORKS
1. Pay, then open Shopee Chat - your login is sent there automatically
2. Sign in to Steam with those details
3. When Steam asks for a verification code, follow the steps in that same chat message
4. Enter the code straight away - it is short-lived

BEFORE YOU PLAY
- Play in Offline Mode
- Turn Steam Cloud OFF - it can overwrite other players' saves

PLEASE NOTE
- This is a SHARED account, not a personal account
- Do not change the password, email or any account setting
- Delivery is automatic, within 24 hours of payment
- Support through Shopee chat
```

---

## 4. How to Fish — App 4001890

*Dazed Games · 20 Aug 2026 · Action/Casual/Indie/Simulation · RM21.99 on Steam · no DLC ·
1–4 player online co-op · full controller support · **no Steam Cloud** · RM1.29*

Title was already on convention. The description below drops the Steam Cloud line the live one
wrongly carried — applied 2026-09-06.

🔸 **Proposed SEO title — NOT APPLIED. This listing is LIVE on Shopee; changing it is Chaison's call.**

**Proposed title** (84, P4)
```
How to Fish | Akaun Steam | Game PC Original | Full Game | Delivery 24 Jam | Offline
```
**Keywords:** how to fish, akaun steam, game pc original, full game, delivery 24 jam, offline

**Title — currently applied** (80) — unchanged, already live
```
How to Fish | Steam PC Game | FULL GAME | 24H AUTO DELIVERY | ORIGINAL | OFFLINE
```

**Description**
```
HOW TO FISH — Steam shared account

Physics-driven fishing that goes wrong in entertaining ways. Cast, haul, and
watch the boat lose an argument with the water.

WHAT YOU GET
- Login for a Steam account that owns How to Fish
- A Steam Guard code whenever Steam asks for one
- The full base game

HOW IT WORKS
1. Pay, then open Shopee Chat - your login is sent there automatically
2. Sign in to Steam with those details
3. When Steam asks for a verification code, follow the steps in that same chat message
4. Enter the code straight away - it is short-lived

BEFORE YOU PLAY
- Play in Offline Mode

PLEASE NOTE
- This is a SHARED account, not a personal account
- Do not change the password, email or any account setting
- Delivery is automatic, within 24 hours of payment
- Support through Shopee chat
```

---

## 5. Schedule I — App 3164500

*TVGS · 24 Mar 2025 · Action/Indie/Simulation/Strategy · Early Access · RM49.00 on Steam · no DLC ·
online co-op · has Steam Cloud · RM1.59*

🔸 **Proposed SEO title — NOT APPLIED. This listing is LIVE on Shopee; changing it is Chaison's call.**

**Proposed title** (102, P6)
```
Steam PC | Schedule 1 (Schedule I) | Full Game Original | Shared Account | 24H Auto Delivery | Offline
```
**Keywords:** schedule 1, schedule i, steam pc, shared account, original pc game, full game, 24h delivery, management sim pc

<!-- KEYWORD FIX 2026-09-07 — `online co-op` REMOVED, and deliberately NOT replaced with a
     co-op term. FACT-V, Steam appdetails app 3164500 cc=my: Single-player | Multi-player |
     Co-op | Online Co-op, with NO `Shared/Split Screen Co-op`. `local co-op` would therefore be
     a FALSE claim, not a safer one. `management sim pc` replaces it: true and searchable.
     THE LIVE LISTING STILL CARRIES THE OLD KEYWORDS — see
     docs/publish-packets/LIVE-KEYWORD-FIX.md. Found by project-steamshare-5a. -->


**Title — currently applied** (77) — unchanged, already live
```
Schedule I | Steam PC Game | FULL GAME | 24H AUTO DELIVERY | ORIGINAL | OFFLINE
```

**Description**
```
SCHEDULE I — Steam shared account

Start from nothing and build an empire. A first-person crime simulation about
supply, territory and staying one step ahead.

WHAT YOU GET
- Login for a Steam account that owns Schedule I
- A Steam Guard code whenever Steam asks for one
- The full base game (Early Access)

HOW IT WORKS
1. Pay, then open Shopee Chat - your login is sent there automatically
2. Sign in to Steam with those details
3. When Steam asks for a verification code, follow the steps in that same chat message
4. Enter the code straight away - it is short-lived

BEFORE YOU PLAY
- Play in Offline Mode
- Turn Steam Cloud OFF - it can overwrite other players' saves

PLEASE NOTE
- This is a SHARED account, not a personal account
- Do not change the password, email or any account setting
- Delivery is automatic, within 24 hours of payment
- Support through Shopee chat
```

---

## 6. Dokimon Quest — App 2019300

*Yanako RPGs · 22 Nov 2024 · Adventure/Casual/RPG/Strategy · RM38.50 on Steam · 1 DLC exists ·
single-player · has Steam Cloud · RM1.29*

> **Note:** `docs/shopee-listings.md` still records this game as *free on Steam* and calls it a
> business problem with no base game to sell. That is stale — it is RM38.50 as of 2026-09-06 and is
> a normal paid title.

🔸 **Proposed SEO title — NOT APPLIED. This listing is LIVE on Shopee; changing it is Chaison's call.**

**Proposed title** (92, P2)
```
Dokimon Quest Steam Account | Original PC Game | Full Game | 24 Hour Delivery | Offline Play
```
**Keywords:** dokimon quest, dokimon, monster taming rpg, steam account, original pc game, full game, offline play, 24 hour delivery

**Title — currently applied** (82) — unchanged, already live
```
Dokimon Quest | Steam PC Game | FULL GAME | 24H AUTO DELIVERY | ORIGINAL | OFFLINE
```

**Description**
```
DOKIMON QUEST — Steam shared account

A monster-collecting RPG. Catch them, train them, and battle your way across a
hand-drawn world.

WHAT YOU GET
- Login for a Steam account that owns Dokimon Quest
- A Steam Guard code whenever Steam asks for one
- The full base game

HOW IT WORKS
1. Pay, then open Shopee Chat - your login is sent there automatically
2. Sign in to Steam with those details
3. When Steam asks for a verification code, follow the steps in that same chat message
4. Enter the code straight away - it is short-lived

BEFORE YOU PLAY
- Play in Offline Mode
- Turn Steam Cloud OFF - it can overwrite other players' saves

PLEASE NOTE
- This is a SHARED account, not a personal account
- Do not change the password, email or any account setting
- Delivery is automatic, within 24 hours of payment
- Support through Shopee chat
```

---

## 7. Stacklands — App 1948280

*Sokpop Collective · 8 Apr 2022 · Casual/Indie/Simulation · RM24.99 on Steam · 2 DLC exist ·
single-player · has Steam Cloud · RM0.99*

> Priced at RM0.99 while Steam had it at RM12.49 in a 50% sale. **That sale has ended — Steam is back
> to RM24.99**, which makes RM0.99 a sharper deal than intended, not a worse one.

🔸 **Proposed SEO title — NOT APPLIED. This listing is LIVE on Shopee; changing it is Chaison's call.**

**Proposed title** (98, P5)
```
Stacklands PC Game Murah | Steam Shared Account | Original Full Game | 24H Auto Delivery | Offline
```
**Keywords:** stacklands, stacklands steam, pc game murah, steam shared account, original full game, 24h auto delivery, offline game

**Title — currently applied** (79) — unchanged, already live
```
Stacklands | Steam PC Game | FULL GAME | 24H AUTO DELIVERY | ORIGINAL | OFFLINE
```

**Description**
```
STACKLANDS — Steam shared account

A village builder played entirely with cards. Stack them, combine them, and
survive what comes at night.

WHAT YOU GET
- Login for a Steam account that owns Stacklands
- A Steam Guard code whenever Steam asks for one
- The full base game

HOW IT WORKS
1. Pay, then open Shopee Chat - your login is sent there automatically
2. Sign in to Steam with those details
3. When Steam asks for a verification code, follow the steps in that same chat message
4. Enter the code straight away - it is short-lived

BEFORE YOU PLAY
- Play in Offline Mode
- Turn Steam Cloud OFF - it can overwrite other players' saves

PLEASE NOTE
- This is a SHARED account, not a personal account
- Do not change the password, email or any account setting
- Delivery is automatic, within 24 hours of payment
- Support through Shopee chat
```

---

## 8. Lords of the Fallen 2014 — App 265300

*CI Games / Deck 13 · 28 Oct 2014 · Action/RPG · RM79.00 on Steam · 7 DLC exist · single-player ·
has Steam Cloud · RM1.59*

The `2014` matters — it distinguishes this from the 2023 reboot of the same name. Keep it.

🔸 **Proposed SEO title — NOT APPLIED. This listing is LIVE on Shopee; changing it is Chaison's call.**

**Proposed title** (109, P3)
```
[2014] Lords of the Fallen - Shared Steam Account | Full Game | Auto Delivery Within 24H | Original | Offline
```
**Keywords:** lords of the fallen 2014, lords of the fallen 2014 vs 2023, lords of the fallen shared steam account, akaun steam lords of the fallen, game pc original steam, lords of the fallen deck13, lords of the fallen not reboot

**Title — currently applied** (93) — unchanged, already live
```
Lords of the Fallen 2014 | Steam PC Game | FULL GAME | 24H AUTO DELIVERY | ORIGINAL | OFFLINE
```

**Description**
```
LORDS OF THE FALLEN 2014 — Steam shared account

A heavy, deliberate action RPG against oversized foes. Patience beats speed.
This is the original 2014 game, not the 2023 reboot.

WHAT YOU GET
- Login for a Steam account that owns Lords Of The Fallen 2014
- A Steam Guard code whenever Steam asks for one
- The full base game

HOW IT WORKS
1. Pay, then open Shopee Chat - your login is sent there automatically
2. Sign in to Steam with those details
3. When Steam asks for a verification code, follow the steps in that same chat message
4. Enter the code straight away - it is short-lived

BEFORE YOU PLAY
- Play in Offline Mode
- Turn Steam Cloud OFF - it can overwrite other players' saves

PLEASE NOTE
- This is a SHARED account, not a personal account
- Do not change the password, email or any account setting
- Delivery is automatic, within 24 hours of payment
- Support through Shopee chat
```

---

## 9. Tribes of Midgard — App 858820

*Norsfell · published by Gearbox / 2K · 27 Jul 2021 · Action/Adventure/Indie/RPG · RM9.75 on Steam
(75% off RM39.00) · 3 DLC exist · online co-op · full controller support · **no Steam Cloud** ·
RM0.99*

🔸 **Proposed SEO title — NOT APPLIED. This listing is LIVE on Shopee; changing it is Chaison's call.**

**Proposed title** (90, P4)
```
Tribes of Midgard | Akaun Steam | Game PC Original | Full Game | Delivery 24 Jam | Offline
```
**Keywords:** tribes of midgard steam, tribes of midgard akaun steam, tribes of midgard pc original, akun steam tribes of midgard, tribes of midgard co-op, delivery 24 jam, game pc original

**Title — currently applied** (84) — unchanged, already live
```
Tribes of Midgard | Steam PC Game | FULL GAME | 24H AUTO DELIVERY | ORIGINAL | OFFLINE
```

**Description**
```
TRIBES OF MIDGARD — Steam shared account

Norse survival action-RPG. Hold your village through the night against the
giants, and push out further each run.

WHAT YOU GET
- Login for a Steam account that owns Tribes of Midgard
- A Steam Guard code whenever Steam asks for one
- The full base game

HOW IT WORKS
1. Pay, then open Shopee Chat - your login is sent there automatically
2. Sign in to Steam with those details
3. When Steam asks for a verification code, follow the steps in that same chat message
4. Enter the code straight away - it is short-lived

BEFORE YOU PLAY
- Play in Offline Mode

PLEASE NOTE
- This is a SHARED account, not a personal account
- Do not change the password, email or any account setting
- Delivery is automatic, within 24 hours of payment
- Support through Shopee chat
```

---

## 10. Batman Arkham Knight — App 208650

*Rocksteady Studios · published by WB Games · 23 Jun 2015 · Action/Adventure · RM38.00 on Steam ·
24 DLC exist · single-player · has Steam Cloud · RM1.29*

The `™` in Steam's official name is dropped — it adds nothing to search and risks encoding trouble.

🔸 **Proposed SEO title — NOT APPLIED. This listing is LIVE on Shopee; changing it is Chaison's call.**

**Proposed title** (97, P1)
```
Batman Arkham Knight | PC Steam Game | FULL GAME | 24H AUTO DELIVERY | Original Product | OFFLINE
```
**Keywords:** batman arkham knight steam, batman arkham knight pc game, original product, pc steam game, batman arkham knight offline, akaun steam batman

**Title — currently applied** (89) — unchanged, already live
```
Batman Arkham Knight | Steam PC Game | FULL GAME | 24H AUTO DELIVERY | ORIGINAL | OFFLINE
```

**Description**
```
BATMAN ARKHAM KNIGHT — Steam shared account

The finale of the Arkham trilogy. Prowl Gotham as Batman and take the Batmobile
to the streets.

WHAT YOU GET
- Login for a Steam account that owns Batman: Arkham Knight
- A Steam Guard code whenever Steam asks for one
- The full base game

HOW IT WORKS
1. Pay, then open Shopee Chat - your login is sent there automatically
2. Sign in to Steam with those details
3. When Steam asks for a verification code, follow the steps in that same chat message
4. Enter the code straight away - it is short-lived

BEFORE YOU PLAY
- Play in Offline Mode
- Turn Steam Cloud OFF - it can overwrite other players' saves

PLEASE NOTE
- This is a SHARED account, not a personal account
- Do not change the password, email or any account setting
- Delivery is automatic, within 24 hours of payment
- Support through Shopee chat
```

---

## Stale facts this file corrects

`docs/shopee-listings.md` was generated 2026-08-26 and several of its Steam figures have moved:

| Game | That file says | Actually (2026-09-06) |
|---|---|---|
| DAVE THE DIVER | RM24.50 | **RM49.00** |
| How to Fish | RM13.63 | **RM21.99** |
| Dokimon Quest | **FREE on Steam** | **RM38.50** — the "no base game to sell" problem is gone |
| Stacklands | — | RM24.99 (the RM12.49 sale used for pricing has ended) |
| Schedule I | Early Access, RM49.00 | still Early Access, RM49.00, **0 DLC** |

Steam prices move constantly. Re-pull with `appdetails?appids=<id>&cc=my` before trusting any figure
here for a pricing decision.

---

# Part 2 — Supplier-sourced games (NOT LISTED YET)

Fifteen more games sit on the two supplier portals recorded under `local/websites/`
(`cyberspace.cyou` and `gamersfantasy.my`). Copy for all of them is below, ready to upload.

> **All 15 are now UNLIST drafts on Shopee (2026-09-06) and none can be published yet.** Read the
> three blockers before publishing any of them.

## Upload status — all 15 are UNLIST drafts on Shopee as of 2026-09-06

Uploaded with banners, descriptions, brand, specification attributes and mappings. **None are
published**; none can be bought. `scripts/shopee-listings.mjs` lists them under UNLISTED and still
counts them as idle inventory, which is correct — a mapped draft is not sellable.

| Game | item_id | Price | Stock |
|---|---|---|---|
| Ghost of Tsushima Director's Cut | 46067470527 | RM1.99 | 99999 |
| DYNASTY WARRIORS: ORIGINS | 54117441114 | RM1.99 | 99999 |
| FANTASY LIFE i | 46467470550 | RM1.99 | 99999 |
| Indiana Jones and the Great Circle | 45467475301 | RM1.99 | 99999 |
| Resident Evil Requiem | 45667475242 | RM1.99 | 99999 |
| Black Myth: Wukong | 28845742292 | RM1.99 | 99999 |
| WARRIORS OROCHI 3 Ultimate | 42484247105 | RM1.99 | 99999 |
| Empire of the Ants | 46067475292 | RM1.59 | 99999 |
| DELTARUNE | 47167470545 | RM1.59 | 99999 |
| Norland | 43384247116 | RM1.59 | 99999 |
| Into the Dead: Our Darkest Days | 47467470500 | RM1.59 | 99999 |
| TCG Card Shop Simulator | 43984247133 | RM1.59 | 99999 |
| Storyteller | 47567470574 | RM1.29 | 99999 |
| Thronefall | 55717441172 | RM1.29 | 99999 |
| Love Is All Around | 47067475273 | RM1.29 | 99999 |

All 20 supplier accounts were seeded (`scripts/seed-suppliers.mjs`), the 13 missing `games` rows
created, and every account linked in `account_games`. Two existing rows (Ghost of Tsushima, Into
the Dead) had `steam_app_id = 0` and were corrected — left at 0 they miss `lib/catalogue.ts`'s
lookup and render as "art pending" on /games.

## 🔴 Blocker 1 — stock says 99999, but redemptions are finite

**Stock was set to 99999 on 2026-09-06 on Chaison's instruction, after this constraint was
raised. The constraint has not gone away — the number on the listing simply no longer reflects it.**

The Guard code for these accounts is fetched from our other site, which caps redemptions **per
order id** at 5–6 for that order's lifetime, then returns `REACHED LIMIT` until reset by hand. One
real saleable order (Ghost of Tsushima) was already exhausted by development testing.

**Black Myth: Wukong is the sharpest case.** Its six accounts all share ONE supplier order id, so
six accounts do **not** mean six times the codes — they share a single cap.

A buyer needs a fresh code on every new Steam login, not just once, so 5–6 redemptions is closer to
2–3 buyers than 5. `lib/code-source/cache.ts` reuses a code for 60s so repeat presses cost one
redemption instead of one each, but that only helps within a single sitting.

So a listing advertising 99999 can deliver on the order of a handful before it needs a manual reset
on the source site. **Before publishing, raise the caps there or accept that ceiling.**

## Blocker 2 — the code path is shipped but NOT DEPLOYED

`lib/code-source/` is built and **proven working end to end locally** (a real Guard code fetched
for Ghost of Tsushima through `getCodeForAccount()`, and a second order confirmed in the browser).
Migrations 0011 and 0012 are applied to production.

But per CHECKPOINT, **nothing is deployed**: `master` has not been pushed, and
`SUPPLIER_CODE_SOURCE` is not set in Vercel production. Vercel bakes env vars into a deployment, so
setting it is not enough — production needs a redeploy after. Until both happen, a buyer of any
game here would pay and hit a lookup that cannot serve them.

## Blocker 3 — the buyer flow is genuinely different, so the copy is different


For Part 1 games the Steam Guard code exists at all times — it is a TOTP we compute. For supplier
games **the code does not exist until the buyer has already attempted a Steam login**, because that
attempt is what makes Steam issue the code in the first place. The portals return a "not found"
style response before that, which is correct behaviour and not a fault.

The codes also **expire** — that is what happened on the DELTARUNE order in
`local/sharewebsite-problem.md`.

So Part 2 descriptions use a five-step HOW IT WORKS that puts the Steam login *before* the code
lookup, and warn that the code is short-lived. Using the Part 1 wording here would send buyers to
the lookup page first, where they would find nothing and reasonably conclude they had been scammed.

**Supplier description template:**

```
<GAME> — Steam shared account

<pitch>

WHAT YOU GET
- Login for a Steam account that owns <Game>
- A Steam Guard code whenever Steam asks for one
- The full base game

HOW IT WORKS
1. Pay, then open Shopee Chat - your login is sent there automatically
2. Sign in to Steam with those details
3. When Steam asks for a verification code, follow the steps in that same chat message
4. Enter the code straight away - it is short-lived

BEFORE YOU PLAY
- Play in Offline Mode
- Turn Steam Cloud OFF - it can overwrite other players' saves     <- omit if no Steam Cloud

PLEASE NOTE
- This is a SHARED account, not a personal account
- Do not change the password, email or any account setting
- Login details are delivered automatically, within 24 hours of payment
- Support through Shopee chat
```

## Names I had to infer — confirm before listing

The portal tables use short informal names. Most resolve to exactly one Steam app, but five were
abbreviations and I picked the best match rather than guessing silently. **Check these five against
the actual account before you list them** — the wrong game is a guaranteed refund:

| Portal name | Resolved to | App | Confidence |
|---|---|---|---|
| `DW Origins` | DYNASTY WARRIORS: ORIGINS | 2384580 | High — "DW" is the standard abbreviation and it is the only Origins entry |
| `TCG Card` | TCG Card Shop Simulator | 3070070 | High — only Steam game matching that stem |
| `Indiana Jones` | Indiana Jones and the Great Circle | 2677660 | Medium — three Indiana Jones games on Steam; picked the current AAA one |
| `All Around` | Love Is All Around | 2322560 | **Upgraded Low → Good, 2026-09-06.** Steam's own news feed for app 2322560 titles it "Love Is All Around - 完蛋！我被美女包围了！", and Shopee MY carries listings for other SKUs of the same game. Nothing found contradicting it. Still worth an eyeball against the account's library — the art is six women in a promo lineup, so a wrong guess is obvious on sight |
| `the Ants` | Empire of the Ants | 2287330 | **Low** — could also be the mobile "The Ants: Underground Kingdom", which is not on Steam |

`Fantasy Life` → FANTASY LIFE i: The Girl Who Steals Time and `Into the Dead` → Into the Dead: Our
Darkest Days are the only Steam matches for those stems, so those two are safe.

## Pricing — the tier rule runs out here

Part 1's ladder tops out at `>RM45 → RM1.59`. Part 2 contains RM267, RM253, RM249 and RM239 titles —
five to ten times the Steam price of anything currently in the shop, all landing in the same
RM1.59 bucket. Selling *Ghost of Tsushima* and *Thronefall* for the same money is leaving the
premium titles' value on the table. Suggested prices below extend the ladder with a fourth tier
(`>RM150 → RM1.99`), but **that is a business call and I have not applied it anywhere** — Part 1's
prices are untouched.

---

## P1. Ghost of Tsushima Director's Cut — App 2215430

*Sucker Punch / Nixxes · 16 May 2024 · Action/Adventure · RM249.00 on Steam · 1 DLC exists ·
online co-op + PvP · has Steam Cloud · supplier `cyberspace.cyou` · suggested RM1.99*

🔸 **Proposed SEO title — NOT APPLIED. The UNLIST draft on Shopee still carries the applied title below.**

**Proposed title** (111, P6)
```
Steam PC | Ghost of Tsushima Director's Cut | Full Game Original | Shared Account | 24H Auto Delivery | Offline
```
**Keywords:** ghost of tsushima, ghost of tsushima director's cut, steam pc, steam account, shared account, full game original, co-op, 24 hour delivery

**Title — currently applied**
```
Ghost of Tsushima Director's Cut | Steam PC Game | FULL GAME | 24H AUTO DELIVERY | ORIGINAL | OFFLINE
```

**Description**
```
GHOST OF TSUSHIMA DIRECTOR'S CUT — Steam shared account

Feudal Japan, one samurai against a Mongol invasion. An open world you clear by
blade or by stealth, plus the Iki Island expansion.

WHAT YOU GET
- Login for a Steam account that owns Ghost of Tsushima Director's Cut
- A Steam Guard code whenever Steam asks for one
- The full base game

HOW IT WORKS
1. Pay, then open Shopee Chat - your login is sent there automatically
2. Sign in to Steam with those details
3. When Steam asks for a verification code, follow the steps in that same chat message
4. Enter the code straight away - it is short-lived

BEFORE YOU PLAY
- Play in Offline Mode
- Turn Steam Cloud OFF - it can overwrite other players' saves

PLEASE NOTE
- This is a SHARED account, not a personal account
- Do not change the password, email or any account setting
- Login details are delivered automatically, within 24 hours of payment
- Support through Shopee chat
```

---

## P2. DYNASTY WARRIORS: ORIGINS — App 2384580

*KOEI TECMO · 16 Jan 2025 · Action/RPG/Strategy · RM267.00 on Steam · 3 DLC exist · single-player ·
has Steam Cloud · supplier `cyberspace.cyou` · suggested RM1.99*

🔸 **Proposed SEO title — NOT APPLIED. The UNLIST draft on Shopee still carries the applied title below.**

**Proposed title** (116, P2)
```
DYNASTY WARRIORS ORIGINS (DW Origins) Steam Account | Original PC Game | Full Game | 24 Hour Delivery | Offline Play
```
**Keywords:** dynasty warriors origins, dw origins, steam account, original pc game, full game, offline, 24 hour delivery

**Title — currently applied**
```
DYNASTY WARRIORS ORIGINS | Steam PC Game | FULL GAME | 24H AUTO DELIVERY | ORIGINAL | OFFLINE
```

**Description**
```
DYNASTY WARRIORS ORIGINS — Steam shared account

One nameless warrior in the Three Kingdoms. Thousands of enemies on screen and a
battlefield that shifts around the choices you make.

WHAT YOU GET
- Login for a Steam account that owns DYNASTY WARRIORS: ORIGINS
- A Steam Guard code whenever Steam asks for one
- The full base game

HOW IT WORKS
1. Pay, then open Shopee Chat - your login is sent there automatically
2. Sign in to Steam with those details
3. When Steam asks for a verification code, follow the steps in that same chat message
4. Enter the code straight away - it is short-lived

BEFORE YOU PLAY
- Play in Offline Mode
- Turn Steam Cloud OFF - it can overwrite other players' saves

PLEASE NOTE
- This is a SHARED account, not a personal account
- Do not change the password, email or any account setting
- Login details are delivered automatically, within 24 hours of payment
- Support through Shopee chat
```

---

## P3. FANTASY LIFE i: The Girl Who Steals Time — App 2993780

*LEVEL5 · 21 May 2025 · RPG · RM253.71 on Steam · 1 DLC exists · online co-op · has Steam Cloud ·
supplier `cyberspace.cyou` · suggested RM1.99*

🔸 **Proposed SEO title — NOT APPLIED. The UNLIST draft on Shopee still carries the applied title below.**

**Proposed title** (109, P1)
```
FANTASY LIFE i: The Girl Who Steals Time | Steam PC Game | FULL GAME | 24H AUTO DELIVERY | ORIGINAL | OFFLINE
```
**Keywords:** fantasy life i, fantasy life steam, the girl who steals time, steam pc game, full game, original, co-op

**Title — currently applied**
```
FANTASY LIFE i The Girl Who Steals Time | Steam PC Game | FULL GAME | 24H AUTO DELIVERY | OFFLINE
```

**Description**
```
FANTASY LIFE i — Steam shared account

Pick a Life - miner, cook, mercenary, twelve of them - and switch whenever you
like. Build an island and travel through time at your own pace.

WHAT YOU GET
- Login for a Steam account that owns FANTASY LIFE i: The Girl Who Steals Time
- A Steam Guard code whenever Steam asks for one
- The full base game

HOW IT WORKS
1. Pay, then open Shopee Chat - your login is sent there automatically
2. Sign in to Steam with those details
3. When Steam asks for a verification code, follow the steps in that same chat message
4. Enter the code straight away - it is short-lived

BEFORE YOU PLAY
- Play in Offline Mode
- Turn Steam Cloud OFF - it can overwrite other players' saves

PLEASE NOTE
- This is a SHARED account, not a personal account
- Do not change the password, email or any account setting
- Login details are delivered automatically, within 24 hours of payment
- Support through Shopee chat
```

---

## P4. Indiana Jones and the Great Circle — App 2677660

*MachineGames · 8 Dec 2024 · Action/Adventure · RM239.00 on Steam · 1 DLC exists · single-player ·
has Steam Cloud · supplier `cyberspace.cyou` · suggested RM1.99*
**Name inferred from `Indiana Jones` — confirm the account is this game, not a LEGO or 1999 title.**

🔸 **Proposed SEO title — NOT APPLIED. The UNLIST draft on Shopee still carries the applied title below.**

**Proposed title** (115, P5)
```
Indiana Jones and the Great Circle PC Game Murah | Steam Account | Full Game Original | 24H Auto Delivery | Offline
```
**Keywords:** indiana jones and the great circle, indiana jones steam, pc game murah, steam account, akaun steam, full game original, offline

**Title — currently applied**
```
Indiana Jones and the Great Circle | Steam PC Game | FULL GAME | 24H AUTO DELIVERY | ORIGINAL | OFFLINE
```

**Description**
```
INDIANA JONES AND THE GREAT CIRCLE — Steam shared account

1937. A first-person adventure across Egypt, Shanghai and the Himalayas, built
on puzzles, improvised fistfights and the whip.

WHAT YOU GET
- Login for a Steam account that owns Indiana Jones and the Great Circle
- A Steam Guard code whenever Steam asks for one
- The full base game

HOW IT WORKS
1. Pay, then open Shopee Chat - your login is sent there automatically
2. Sign in to Steam with those details
3. When Steam asks for a verification code, follow the steps in that same chat message
4. Enter the code straight away - it is short-lived

BEFORE YOU PLAY
- Play in Offline Mode
- Turn Steam Cloud OFF - it can overwrite other players' saves

PLEASE NOTE
- This is a SHARED account, not a personal account
- Do not change the password, email or any account setting
- Login details are delivered automatically, within 24 hours of payment
- Support through Shopee chat
```

---

## P5. Resident Evil Requiem — App 3764200

*CAPCOM · 26 Feb 2026 · Action/Adventure · RM239.00 on Steam · 3 DLC exist · single-player ·
has Steam Cloud · supplier `gamersfantasy.my` · suggested RM1.99*

> ⚠️ **This one has a known data problem.** `local/websites/gamersfantasy.my.md` records that the
> stored username is stale — the portal reports a different current username. On that portal a wrong
> username and "no code yet" are structurally identical responses, so this would fail in the most
> confusing way possible. **Fix the account row before listing.**

🔸 **Proposed SEO title — NOT APPLIED. The UNLIST draft on Shopee still carries the applied title below.**

**Proposed title** (113, P3)
```
[PC] Resident Evil Requiem RE9 - Shared Steam Account | Full Game | Auto Delivery Within 24H | Original | Offline
```
**Keywords:** Resident Evil Requiem, Resident Evil 9, RE9, PC game original, shared steam account, auto delivery 24 hours, offline mode

**Title — currently applied**
```
Resident Evil Requiem | Steam PC Game | FULL GAME | 24H AUTO DELIVERY | ORIGINAL | OFFLINE
```

**Description**
```
RESIDENT EVIL REQUIEM — Steam shared account

Survival horror, back where it belongs. Raccoon City, and a story that finally
turns the lights off again.

WHAT YOU GET
- Login for a Steam account that owns Resident Evil Requiem
- A Steam Guard code whenever Steam asks for one
- The full base game

HOW IT WORKS
1. Pay, then open Shopee Chat - your login is sent there automatically
2. Sign in to Steam with those details
3. When Steam asks for a verification code, follow the steps in that same chat message
4. Enter the code straight away - it is short-lived

BEFORE YOU PLAY
- Play in Offline Mode
- Turn Steam Cloud OFF - it can overwrite other players' saves

PLEASE NOTE
- This is a SHARED account, not a personal account
- Do not change the password, email or any account setting
- Login details are delivered automatically, within 24 hours of payment
- Support through Shopee chat
```

---

## P6. Black Myth: Wukong — App 2358720

*Game Science · 19 Aug 2024 · Action/Adventure/RPG · RM219.00 on Steam · 2 DLC exist ·
single-player · has Steam Cloud · supplier `cyberspace.cyou` · suggested RM1.99*

> **Stock note:** this order has **six rotational accounts** on the portal, not one. They are
> assigned round-robin rather than 1:1, so this listing can carry real concurrent stock instead of
> the usual single shared account. See `local/websites/cyberspace.cyou.md`.

🔸 **Proposed SEO title — NOT APPLIED. The UNLIST draft on Shopee still carries the applied title below.**

**Proposed title** (96, P6)
```
[Steam PC] Black Myth Wukong | Full Game Original | Shared Account | 24H Auto Delivery | Offline
```
**Keywords:** Black Myth Wukong, Wukong, 黑神话悟空, 悟空, Steam offline, shared account, PC game original, 24 hour auto delivery

**Title — currently applied**
```
Black Myth Wukong | Steam PC Game | FULL GAME | 24H AUTO DELIVERY | ORIGINAL | OFFLINE
```

**Description**
```
BLACK MYTH WUKONG — Steam shared account

Journey to the West as the Destined One. Heavy, precise action-RPG combat, staff
stances, and bosses built to be learned rather than beaten first try.

WHAT YOU GET
- Login for a Steam account that owns Black Myth: Wukong
- A Steam Guard code whenever Steam asks for one
- The full base game

HOW IT WORKS
1. Pay, then open Shopee Chat - your login is sent there automatically
2. Sign in to Steam with those details
3. When Steam asks for a verification code, follow the steps in that same chat message
4. Enter the code straight away - it is short-lived

BEFORE YOU PLAY
- Play in Offline Mode
- Turn Steam Cloud OFF - it can overwrite other players' saves

PLEASE NOTE
- This is a SHARED account, not a personal account
- Do not change the password, email or any account setting
- Login details are delivered automatically, within 24 hours of payment
- Support through Shopee chat
```

---

## P7. WARRIORS OROCHI 3 Ultimate Definitive Edition — App 1879330

*KOEI TECMO · 12 Jul 2022 · Action/Strategy · RM153.00 on Steam · no DLC · split-screen co-op ·
has Steam Cloud · supplier `cyberspace.cyou` · suggested RM1.99*

🔸 **Proposed SEO title — NOT APPLIED. The UNLIST draft on Shopee still carries the applied title below.**

**Proposed title** (100, P2)
```
WARRIORS OROCHI 3 Ultimate Steam Account | Original PC Game | Full Game | 24 Hour Delivery | Offline
```
**Keywords:** WARRIORS OROCHI 3 Ultimate, Orochi 3, Warriors Orochi, Musou Orochi 2 Ultimate, Steam account, co-op, PC original game

**Title — currently applied**
```
WARRIORS OROCHI 3 Ultimate | Steam PC Game | FULL GAME | 24H AUTO DELIVERY | ORIGINAL | LOCAL CO-OP
```

**Description**
```
WARRIORS OROCHI 3 ULTIMATE — Steam shared account

Around 145 playable characters from Dynasty Warriors, Samurai Warriors and
beyond, thrown at armies that fill the screen. Two-player split screen.

WHAT YOU GET
- Login for a Steam account that owns WARRIORS OROCHI 3 Ultimate Definitive Edition
- A Steam Guard code whenever Steam asks for one
- The full base game

HOW IT WORKS
1. Pay, then open Shopee Chat - your login is sent there automatically
2. Sign in to Steam with those details
3. When Steam asks for a verification code, follow the steps in that same chat message
4. Enter the code straight away - it is short-lived

BEFORE YOU PLAY
- Play in Offline Mode
- Turn Steam Cloud OFF - it can overwrite other players' saves

PLEASE NOTE
- This is a SHARED account, not a personal account
- Do not change the password, email or any account setting
- Login details are delivered automatically, within 24 hours of payment
- Support through Shopee chat
```

---

## P8. Empire of the Ants — App 2287330

*Tower Five · 6 Nov 2024 · Strategy · RM99.90 on Steam · 1 DLC exists · online PvP ·
has Steam Cloud · supplier `cyberspace.cyou` · suggested RM1.59*
**Name inferred from `the Ants` — low confidence. Confirm before listing.**

🔸 **Proposed SEO title — NOT APPLIED. The UNLIST draft on Shopee still carries the applied title below.**

**Proposed title** (91, P4)
```
Empire of the Ants | Akaun Steam | Game PC Original | Full Game | Delivery 24 Jam | Offline
```
**Keywords:** Empire of the Ants, akaun steam, game pc original, offline PC, shared account, delivery 24 jam

**Title — currently applied**
```
Empire of the Ants | Steam PC Game | FULL GAME | 24H AUTO DELIVERY | ORIGINAL | OFFLINE
```

**Description**
```
EMPIRE OF THE ANTS — Steam shared account

Real-time strategy at ant scale, rendered in Unreal Engine 5. Command a colony
across a forest floor that looks close to photographic.

WHAT YOU GET
- Login for a Steam account that owns Empire of the Ants
- A Steam Guard code whenever Steam asks for one
- The full base game

HOW IT WORKS
1. Pay, then open Shopee Chat - your login is sent there automatically
2. Sign in to Steam with those details
3. When Steam asks for a verification code, follow the steps in that same chat message
4. Enter the code straight away - it is short-lived

BEFORE YOU PLAY
- Play in Offline Mode
- Turn Steam Cloud OFF - it can overwrite other players' saves

PLEASE NOTE
- This is a SHARED account, not a personal account
- Do not change the password, email or any account setting
- Login details are delivered automatically, within 24 hours of payment
- Support through Shopee chat
```

---

## P9. DELTARUNE — App 1671210

*tobyfox · 4 Jun 2025 · Indie/RPG · RM61.00 on Steam · 1 DLC exists · single-player ·
has Steam Cloud · supplier `cyberspace.cyou` · suggested RM1.59*

🔸 **Proposed SEO title — NOT APPLIED. The UNLIST draft on Shopee still carries the applied title below.**

**Proposed title** (92, P4)
```
DELTARUNE | Akaun Steam | Game PC Original Indie RPG | Full Game | Delivery 24 Jam | OFFLINE
```
**Keywords:** Deltarune, Deltarune Steam, akaun steam, game pc original, indie RPG, full game, delivery 24 jam

**Title — currently applied**
```
DELTARUNE | Steam PC Game | FULL GAME | 24H AUTO DELIVERY | ORIGINAL | OFFLINE
```

**Description**
```
DELTARUNE — Steam shared account

From the maker of UNDERTALE. A story-driven RPG where the battles bend, the
music carries it, and your choices are watched.

WHAT YOU GET
- Login for a Steam account that owns DELTARUNE
- A Steam Guard code whenever Steam asks for one
- The full base game

HOW IT WORKS
1. Pay, then open Shopee Chat - your login is sent there automatically
2. Sign in to Steam with those details
3. When Steam asks for a verification code, follow the steps in that same chat message
4. Enter the code straight away - it is short-lived

BEFORE YOU PLAY
- Play in Offline Mode
- Turn Steam Cloud OFF - it can overwrite other players' saves

PLEASE NOTE
- This is a SHARED account, not a personal account
- Do not change the password, email or any account setting
- Login details are delivered automatically, within 24 hours of payment
- Support through Shopee chat
```

---

## P10. Norland — App 1857090

*Long Jaunt · 18 Jul 2024 · RPG/Simulation/Strategy · Early Access · RM59.99 on Steam · no DLC ·
single-player · has Steam Cloud · supplier `cyberspace.cyou` · suggested RM1.59*

🔸 **Proposed SEO title — NOT APPLIED. The UNLIST draft on Shopee still carries the applied title below.**

**Proposed title** (95, P5)
```
Norland PC Game Murah | Steam Shared Account | Original Full Game | 24H Auto Delivery | OFFLINE
```
**Keywords:** Norland, Norland Steam, game pc murah, steam shared account, original, full game, 24h auto delivery

**Title — currently applied**
```
Norland | Steam PC Game | FULL GAME | 24H AUTO DELIVERY | ORIGINAL | OFFLINE
```

**Description**
```
NORLAND — Steam shared account

A medieval kingdom sim where the nobles are the problem. Manage a family that
schemes, drinks, falls ill and occasionally murders each other.

WHAT YOU GET
- Login for a Steam account that owns Norland
- A Steam Guard code whenever Steam asks for one
- The full base game (Early Access)

HOW IT WORKS
1. Pay, then open Shopee Chat - your login is sent there automatically
2. Sign in to Steam with those details
3. When Steam asks for a verification code, follow the steps in that same chat message
4. Enter the code straight away - it is short-lived

BEFORE YOU PLAY
- Play in Offline Mode
- Turn Steam Cloud OFF - it can overwrite other players' saves

PLEASE NOTE
- This is a SHARED account, not a personal account
- Do not change the password, email or any account setting
- Login details are delivered automatically, within 24 hours of payment
- Support through Shopee chat
```

---

## P11. Into the Dead: Our Darkest Days — App 2239710

*PikPok · 9 Apr 2025 · Action/Simulation/Strategy · Early Access · RM48.79 on Steam · no DLC ·
single-player · **no Steam Cloud** · supplier `cyberspace.cyou` · suggested RM1.59*

🔸 **Proposed SEO title — NOT APPLIED. The UNLIST draft on Shopee still carries the applied title below.**

**Proposed title** (98, P1 (adapted by main session - agent returned today's title verbatim, which is not a rotation))
```
Into the Dead: Our Darkest Days | PC Steam Original Game | Full Game | 24H Auto Delivery | Offline
```
**Keywords:** Into the Dead, Into the Dead Our Darkest Days, zombie survival game, steam pc game, full game, original, 24h auto delivery

**Title — currently applied**
```
Into the Dead Our Darkest Days | Steam PC Game | FULL GAME | 24H AUTO DELIVERY | ORIGINAL | OFFLINE
```

**Description**
```
INTO THE DEAD: OUR DARKEST DAYS — Steam shared account

Texas, 1980, a city overrun. A side-on survival sim about scavenging by day and
keeping people alive - and quiet - at night.

WHAT YOU GET
- Login for a Steam account that owns Into the Dead: Our Darkest Days
- A Steam Guard code whenever Steam asks for one
- The full base game (Early Access)

HOW IT WORKS
1. Pay, then open Shopee Chat - your login is sent there automatically
2. Sign in to Steam with those details
3. When Steam asks for a verification code, follow the steps in that same chat message
4. Enter the code straight away - it is short-lived

BEFORE YOU PLAY
- Play in Offline Mode

PLEASE NOTE
- This is a SHARED account, not a personal account
- Do not change the password, email or any account setting
- Login details are delivered automatically, within 24 hours of payment
- Support through Shopee chat
```

---

## P12. TCG Card Shop Simulator — App 3070070

*OPNeon Games · 15 Sep 2024 · Simulation · Early Access · RM46.99 on Steam · no DLC ·
single-player · has Steam Cloud · supplier `cyberspace.cyou` · suggested RM1.59*

🔸 **Proposed SEO title — NOT APPLIED. The UNLIST draft on Shopee still carries the applied title below.**

**Proposed title** (111, P3)
```
[PC] TCG Card Shop Simulator - Shared Steam Account | Full Game | Auto Delivery Within 24H | Original | Offline
```
**Keywords:** TCG Card Shop Simulator, card shop simulator, steam shared account, PC game, full game, auto delivery, original, offline

**Title — currently applied**
```
TCG Card Shop Simulator | Steam PC Game | FULL GAME | 24H AUTO DELIVERY | ORIGINAL | OFFLINE
```

**Description**
```
TCG CARD SHOP SIMULATOR — Steam shared account

Run a trading card shop. Order stock, price it, restock the shelves, open packs
you probably should have sold.

WHAT YOU GET
- Login for a Steam account that owns TCG Card Shop Simulator
- A Steam Guard code whenever Steam asks for one
- The full base game (Early Access)

HOW IT WORKS
1. Pay, then open Shopee Chat - your login is sent there automatically
2. Sign in to Steam with those details
3. When Steam asks for a verification code, follow the steps in that same chat message
4. Enter the code straight away - it is short-lived

BEFORE YOU PLAY
- Play in Offline Mode
- Turn Steam Cloud OFF - it can overwrite other players' saves

PLEASE NOTE
- This is a SHARED account, not a personal account
- Do not change the password, email or any account setting
- Login details are delivered automatically, within 24 hours of payment
- Support through Shopee chat
```

---

## P13. Storyteller — App 1624540

*Daniel Benmergui · 23 Mar 2023 · Adventure · RM40.00 on Steam · 1 DLC exists · single-player ·
has Steam Cloud · supplier `cyberspace.cyou` · suggested RM1.29*

🔸 **Proposed SEO title — NOT APPLIED. The UNLIST draft on Shopee still carries the applied title below.**

**Proposed title** (102, P6)
```
Steam PC | Storyteller Puzzle Game | Full Game Original | Shared Account | 24H Auto Delivery | Offline
```
**Keywords:** storyteller, storyteller steam, storyteller pc game, akaun steam, steam pc original game, shared steam account, puzzle game steam, daniel benmergui

**Title — currently applied**
```
Storyteller | Steam PC Game | FULL GAME | 24H AUTO DELIVERY | ORIGINAL | OFFLINE
```

**Description**
```
STORYTELLER — Steam shared account

A puzzle game made of comic panels. Drop in characters and settings, and the
story writes itself - your job is to make the tragedy land.

WHAT YOU GET
- Login for a Steam account that owns Storyteller
- A Steam Guard code whenever Steam asks for one
- The full base game

HOW IT WORKS
1. Pay, then open Shopee Chat - your login is sent there automatically
2. Sign in to Steam with those details
3. When Steam asks for a verification code, follow the steps in that same chat message
4. Enter the code straight away - it is short-lived

BEFORE YOU PLAY
- Play in Offline Mode
- Turn Steam Cloud OFF - it can overwrite other players' saves

PLEASE NOTE
- This is a SHARED account, not a personal account
- Do not change the password, email or any account setting
- Login details are delivered automatically, within 24 hours of payment
- Support through Shopee chat
```

---

## P14. Thronefall — App 2239150

*GrizzlyGames / Mythwright · 11 Oct 2024 · Action/Indie/Strategy · RM34.00 on Steam · no DLC ·
single-player · has Steam Cloud · supplier `cyberspace.cyou` · suggested RM1.29*

🔸 **Proposed SEO title — NOT APPLIED. The UNLIST draft on Shopee still carries the applied title below.**

**Proposed title** (89, P2)
```
Thronefall Steam Account | Original PC Game | Full Game | 24 Hour Delivery | Offline Play
```
**Keywords:** thronefall, thronefall steam, thronefall pc game, thronefall auto delivery, akaun steam thronefall, steam shared account, thronefall full version

**Title — currently applied**
```
Thronefall | Steam PC Game | FULL GAME | 24H AUTO DELIVERY | ORIGINAL | OFFLINE
```

**Description**
```
THRONEFALL — Steam shared account

Build your kingdom by day, defend it by night. A minimalist strategy game that
takes about twenty minutes a run and is very hard to stop playing.

WHAT YOU GET
- Login for a Steam account that owns Thronefall
- A Steam Guard code whenever Steam asks for one
- The full base game

HOW IT WORKS
1. Pay, then open Shopee Chat - your login is sent there automatically
2. Sign in to Steam with those details
3. When Steam asks for a verification code, follow the steps in that same chat message
4. Enter the code straight away - it is short-lived

BEFORE YOU PLAY
- Play in Offline Mode
- Turn Steam Cloud OFF - it can overwrite other players' saves

PLEASE NOTE
- This is a SHARED account, not a personal account
- Do not change the password, email or any account setting
- Login details are delivered automatically, within 24 hours of payment
- Support through Shopee chat
```

---

## P15. Love Is All Around — App 2322560

*intiny · 17 Oct 2023 · Adventure/Indie/RPG/Simulation/Strategy · RM26.75 on Steam · 2 DLC exist ·
has Steam Cloud · supplier `cyberspace.cyou` · suggested RM1.29*
**Name inferred from `All Around`. Confidence upgraded from Low to Good on 2026-09-06** — Steam's news feed for app 2322560 uses the title "Love Is All Around - 完蛋！我被美女包围了！" and Shopee MY lists other SKUs of the same game. Still confirm against the account's library before listing.

🔸 **Proposed SEO title — NOT APPLIED. The UNLIST draft on Shopee still carries the applied title below.**

**Proposed title** (106, P5)
```
Love Is All Around PC Game Murah | Steam Shared Account | Original Full Game | 24H Auto Delivery | Offline
```
**Keywords:** love is all around, love is all around steam, akaun steam murah, visual novel steam, FMV dating sim, steam pc original game, love is all around switch ps5

**Title — currently applied**
```
Love Is All Around | Steam PC Game | FULL GAME | 24H AUTO DELIVERY | ORIGINAL | OFFLINE
```

**Description**
```
LOVE IS ALL AROUND — Steam shared account

A live-action romance visual novel. Real actors, branching choices, and a lot
of endings depending on who you pay attention to.

WHAT YOU GET
- Login for a Steam account that owns Love Is All Around
- A Steam Guard code whenever Steam asks for one
- The full base game

HOW IT WORKS
1. Pay, then open Shopee Chat - your login is sent there automatically
2. Sign in to Steam with those details
3. When Steam asks for a verification code, follow the steps in that same chat message
4. Enter the code straight away - it is short-lived

BEFORE YOU PLAY
- Play in Offline Mode
- Turn Steam Cloud OFF - it can overwrite other players' saves

PLEASE NOTE
- This is a SHARED account, not a personal account
- Do not change the password, email or any account setting
- Login details are delivered automatically, within 24 hours of payment
- Support through Shopee chat
```

---

## Part 2 checklist before any of this goes live

1. Deploy the supplier code path: `git push` master, set `SUPPLIER_CODE_SOURCE=true` in Vercel
   production, then REDEPLOY (Vercel bakes env vars into a deployment).
2. Confirm the five inferred game names against the actual accounts.
3. Fix the stale username on the `gamersfantasy.my` account.
4. Decide whether the ladder gets a `>RM150 → RM1.99` tier.
5. ~~Generate four banners~~ — done, all 15 have a four-image set in `brand/`.
6. ~~Create each listing as an UNLIST draft and map it~~ — done 2026-09-06.
7. Run `scratchpad/e2e.mjs` against a supplier game once deployed, and only then publish. Note it
   costs a real redemption from a finite budget, so test ONE game, not all fifteen.
8. Decide the stock question in Blocker 1 before publishing anything.

---

# Part 3 — gamersfantasy.my direct-account games (NO SHOPEE DRAFT YET)

Eight more games from `local/websites/gamersfantasy.my.md`, none of which had copy anywhere before
this section. They are **not** the same batch as Part 2: Part 2's fifteen already exist as UNLIST
drafts with item ids, banners and mappings. **These eight have nothing** — no draft, no item id, no
art in `brand/`, no `games` row, no `CATALOGUE` entry.

Seven of them sit on one order id, the shared gamersfantasy order (one dedicated account per game). The eighth,
Sekiro, is on its own order id its own separate gamersfantasy order.

Steam facts below were fetched live 2026-09-06 from `appdetails?cc=my` — `FACT-V`, not recalled.
App ids were resolved with `scripts/resolve-appids.mjs` against Steam's own index, not from memory.

## These use the Part 2 supplier flow, not the Part 1 flow

Codes come from the gamersfantasy portal, so the **five-step** `HOW IT WORKS` applies — Steam login
first, code lookup second. Using Part 1's wording here sends the buyer to the lookup page before a
code exists, which reads as a scam. See Blocker 3 above for the full reasoning.

## 🔴 Three of these must NOT be listed at all yet

**Star Wars Outlaws, Assassin's Creed Shadows and Assassin's Creed Valhalla each need a second,
Ubisoft account** that we do not deliver. `buildDeliveryMessage()` sends Order ID + Username +
Password, and the lookup page shows the same three — there is nowhere in `steam_accounts` to put a
second credential pair. **A buyer would receive working Steam credentials and still be unable to
launch the game.** Copy is written below so it is ready, but the listing is blocked until that gap
is closed. The supplier's own tutorial link for these three differs from the other four, which is
their acknowledgement that it is a separate flow.

## 🔴 Seven games, one shared redemption cap

All seven on the shared gamersfantasy order redeem against that single order id, and the measured ceiling is ~5-6
redemptions before `REACHED LIMIT`. **Seven games do not get seven caps.** Two buyers each across
three titles exhausts the order for all seven, including the four that never sold. This is worse
than Blocker 1's version of the problem, because here the games are unrelated — a Cyberpunk buyer
can be locked out by a God of War buyer.

## Edition names are deliberately NOT in these titles

The supplier labels several of these as *Ultimate*, *Digital Deluxe* or *Complete* Edition. Those
are DLC bundles, and per the banned-claims table at the top of this file we do not advertise DLC we
have not verified that specific account owns. Every title below sells the **base game**, which is
what `WHAT YOU GET` promises and what a dispute would be judged against.

`Remastered` (Horizon) and `GOTY Edition` (Sekiro) are exceptions and are kept — those are the names
of the base Steam products themselves (apps 2561580 and 814380), not add-ons.

**If you verify an account really does own the bundle, upgrade the title then** — it is worth real
search traffic. Until then it is the single most likely "not as described" dispute in the batch.

| Supplier's label | Sold as | App | Dropped from title |
|---|---|---|---|
| Horizon Zero Dawn Remastered | Horizon Zero Dawn Remastered | 2561580 | — |
| Star Wars Outlaws Ultimate Edition | Star Wars Outlaws | 2842040 | `Ultimate Edition` |
| Assassin's Creed Shadows Digital Deluxe Edition | Assassin's Creed Shadows | 3159330 | `Digital Deluxe Edition` |
| God of War Ragnarök | God of War Ragnarok | 2322010 | — (umlaut dropped for search) |
| Assassin's Creed Valhalla Complete Edition | Assassin's Creed Valhalla | 2208920 | `Complete Edition` |
| Cyberpunk 2077 Ultimate Edition | Cyberpunk 2077 | 1091500 | `Ultimate Edition` |
| METAL GEAR SOLID: SNAKE EATER Digital Deluxe Edition | METAL GEAR SOLID DELTA SNAKE EATER | 2417610 ⚠️ | `Digital Deluxe Edition` |
| Sekiro: Shadows Die Twice GOTY Edition | Sekiro Shadows Die Twice GOTY | 814380 | — |

⚠️ **The Metal Gear id is an inference.** `resolve-appids.mjs` returns two plausible matches for that
stem: **2417610** `METAL GEAR SOLID Δ: SNAKE EATER` and **2131650** `METAL GEAR SOLID 3: Snake Eater
- Master Collection Version`. Delta is the one that ships a Digital Deluxe Edition, which is what the
supplier's label says, so Delta is the pick — but the two games look nothing alike, so **check the
account's library before uploading any art.** This is the same failure mode as Tribes of Midgard
nearly shipping with Maiden and Spell's art.

## Pricing — every one of these is a `>RM150` title

All eight are RM189–RM285 list price on Steam, so all eight land in the fourth tier Part 2 proposes
(`>RM150 → RM1.99`). **That tier is still an unapplied business call** — nothing in the shop uses it
yet. If it is rejected, these all fall to RM1.59 alongside Thronefall.

## Status at a glance

| Game | App | Steam MY | Steam Cloud | Suggested | Blocked by |
|---|---|---|---|---|---|
| Horizon Zero Dawn Remastered | 2561580 | RM209.00 | yes | RM1.99 | shared cap |
| Star Wars Outlaws | 2842040 | RM229.00 | **no** | RM1.99 | 🔴 Ubisoft account |
| Assassin's Creed Shadows | 3159330 | RM239.00 | **no** | RM1.99 | 🔴 Ubisoft account |
| God of War Ragnarok | 2322010 | RM249.00 | yes | RM1.99 | shared cap |
| Assassin's Creed Valhalla | 2208920 | RM189.00 | **no** | RM1.99 | 🔴 Ubisoft account |
| Cyberpunk 2077 | 1091500 | RM219.00 | yes | RM1.99 | shared cap |
| METAL GEAR SOLID DELTA SNAKE EATER | 2417610 | RM239.00 list | yes | RM1.99 | shared cap + id check |
| Sekiro Shadows Die Twice GOTY | 814380 | RM285.00 | yes | RM1.99 | own order id, own cap |

**None of the eight lists Online Co-op on Steam, so every title ends `OFFLINE`.** Metal Gear Delta
is the trap in this batch — it *has* multiplayer, but Steam lists Online **PvP** and no co-op, so it
does not get the badge. Same call as Empire of the Ants in Part 2.

---

## G1. Horizon Zero Dawn Remastered — App 2561580

*Guerrilla Games / Nixxes · 31 Oct 2024 · Action/Adventure/RPG · RM209.00 on Steam · 0 DLC ·
single-player · full controller support · has Steam Cloud · supplier `gamersfantasy.my`,
order + account: see `local/websites/gamersfantasy.my.md` (gitignored) · suggested RM1.99*

**Title** (101)
```
Horizon Zero Dawn Remastered HZD | Steam PC Game | FULL GAME | 24H AUTO DELIVERY | ORIGINAL | OFFLINE
```

**Keywords** (P1): Horizon Zero Dawn Remastered, HZD, Horizon Zero Dawn, Steam PC Game, akaun steam, game pc original, 24 jam, offline

**Description**
```
HORIZON ZERO DAWN REMASTERED — Steam shared account

A thousand years after the fall, machines rule the wilds. Play Aloy, hunt them for
parts, and work out what ended the old world. Rebuilt for PC from the ground up.

WHAT YOU GET
- Login for a Steam account that owns Horizon Zero Dawn Remastered
- A Steam Guard code whenever Steam asks for one
- The full base game

HOW IT WORKS
1. Pay, then open Shopee Chat - your login is sent there automatically
2. Sign in to Steam with those details
3. When Steam asks for a verification code, follow the steps in that same chat message
4. Enter the code straight away - it is short-lived

BEFORE YOU PLAY
- Play in Offline Mode
- Turn Steam Cloud OFF - it can overwrite other players' saves

PLEASE NOTE
- This is a SHARED account, not a personal account
- Do not change the password, email or any account setting
- Login details are delivered automatically, within 24 hours of payment
- Support through Shopee chat
```

---

## G2. Star Wars Outlaws — App 2842040 · 🔴 DO NOT LIST

*Massive Entertainment / Ubisoft · 21 Nov 2024 · Action/Adventure · RM229.00 on Steam · 9 DLC exist ·
single-player · full controller support · **no Steam Cloud** · supplier `gamersfantasy.my`,
order + account: see `local/websites/gamersfantasy.my.md` (gitignored) · suggested RM1.99*

🔴 **Blocked.** Needs the Ubisoft account recorded for this game in
`local/websites/gamersfantasy.my.md`, which we have no way to deliver. Do not publish.

**Title** (90)
```
Star Wars Outlaws | Akaun Steam | Game PC Original | Full Game | Delivery 24 Jam | Offline
```

**Keywords** (P4): Star Wars Outlaws, akaun steam, game pc original, full game, delivery 24 jam, offline, steam pc

**Description**
```
STAR WARS OUTLAWS — Steam shared account

A scoundrel, a ship, and a debt to every syndicate in the galaxy. Travel between
planets, take work from whoever pays, and keep enough standing on all sides to survive.

WHAT YOU GET
- Login for a Steam account that owns Star Wars Outlaws
- A Steam Guard code whenever Steam asks for one
- The full base game

HOW IT WORKS
1. Pay, then open Shopee Chat - your login is sent there automatically
2. Sign in to Steam with those details
3. When Steam asks for a verification code, follow the steps in that same chat message
4. Enter the code straight away - it is short-lived

BEFORE YOU PLAY
- Play in Offline Mode

PLEASE NOTE
- This is a SHARED account, not a personal account
- Do not change the password, email or any account setting
- Login details are delivered automatically, within 24 hours of payment
- Support through Shopee chat
```

---

## G3. Assassin's Creed Shadows — App 3159330 · 🔴 DO NOT LIST

*Ubisoft Quebec · 19 Mar 2025 · Action/Adventure/RPG · RM239.00 on Steam · 2 DLC exist ·
single-player · partial controller support · **no Steam Cloud** · supplier `gamersfantasy.my`,
order + account: see `local/websites/gamersfantasy.my.md` (gitignored) · suggested RM1.99*

🔴 **Blocked.** Needs the Ubisoft account recorded for this game in
`local/websites/gamersfantasy.my.md`, which we have no way to deliver. Do not publish.

**Title** (113)
```
[AC Shadows] Assassin's Creed Shadows - Shared Steam Account | Full Game | Auto Delivery 24H | Original | Offline
```

**Keywords** (P3): Assassin's Creed Shadows, AC Shadows, shared steam account, full game, auto delivery 24h, original, offline

**Description**
```
ASSASSIN'S CREED SHADOWS — Steam shared account

Feudal Japan with two playable leads: a shinobi who works from the shadows and a
samurai who does not. One open world, two ways through the same targets.

WHAT YOU GET
- Login for a Steam account that owns Assassin's Creed Shadows
- A Steam Guard code whenever Steam asks for one
- The full base game

HOW IT WORKS
1. Pay, then open Shopee Chat - your login is sent there automatically
2. Sign in to Steam with those details
3. When Steam asks for a verification code, follow the steps in that same chat message
4. Enter the code straight away - it is short-lived

BEFORE YOU PLAY
- Play in Offline Mode

PLEASE NOTE
- This is a SHARED account, not a personal account
- Do not change the password, email or any account setting
- Login details are delivered automatically, within 24 hours of payment
- Support through Shopee chat
```

---

## G4. God of War Ragnarok — App 2322010

*Santa Monica Studio / Jetpack Interactive · 19 Sep 2024 · Action/Adventure/RPG · RM249.00 on Steam ·
3 DLC exist · single-player · full controller support · has Steam Cloud · supplier
`gamersfantasy.my`, order + account: see `local/websites/gamersfantasy.my.md` (gitignored) · suggested RM1.99*

The umlaut in *Ragnarök* is dropped from the title on purpose — Shopee buyers type `Ragnarok`.

**Title** (111)
```
Steam PC | God of War Ragnarok GOW Ragnarok | Full Game Original | Shared Account | 24H Auto Delivery | Offline
```

**Keywords** (P6): God of War Ragnarok, GOW Ragnarok, GOW, Ragnarok, steam pc, full game original, shared account, 24h auto delivery

**Description**
```
GOD OF WAR RAGNAROK — Steam shared account

Kratos and Atreus cross the Nine Realms with Ragnarok already closing in. Norse
myth, close-quarters combat, and a father-and-son story that carries the whole game.

WHAT YOU GET
- Login for a Steam account that owns God of War Ragnarok
- A Steam Guard code whenever Steam asks for one
- The full base game

HOW IT WORKS
1. Pay, then open Shopee Chat - your login is sent there automatically
2. Sign in to Steam with those details
3. When Steam asks for a verification code, follow the steps in that same chat message
4. Enter the code straight away - it is short-lived

BEFORE YOU PLAY
- Play in Offline Mode
- Turn Steam Cloud OFF - it can overwrite other players' saves

PLEASE NOTE
- This is a SHARED account, not a personal account
- Do not change the password, email or any account setting
- Login details are delivered automatically, within 24 hours of payment
- Support through Shopee chat
```

---

## G5. Assassin's Creed Valhalla — App 2208920 · 🔴 DO NOT LIST

*Ubisoft Montreal · 6 Dec 2022 · Action/Adventure/RPG · RM189.00 on Steam · 4 DLC exist ·
single-player · partial controller support · **no Steam Cloud** · supplier `gamersfantasy.my`,
order + account: see `local/websites/gamersfantasy.my.md` (gitignored) · suggested RM1.99*

🔴 **Blocked.** Needs the Ubisoft account recorded for this game in
`local/websites/gamersfantasy.my.md`, which we have no way to deliver. Do not publish.

**Title** (114)
```
[PC] Assassin's Creed Valhalla (AC Valhalla) - Shared Account | Full Game | 24H Auto Delivery | Original | Offline
```

**Keywords** (P3): assassin's creed valhalla, ac valhalla, steam account, shared account, pc game original, full game, 24h delivery, offline

**Description**
```
ASSASSIN'S CREED VALHALLA — Steam shared account

Lead a Viking clan out of Norway and into England. Raid for supplies, build the
settlement up between raids, and pick your side in the war for the kingdoms.

WHAT YOU GET
- Login for a Steam account that owns Assassin's Creed Valhalla
- A Steam Guard code whenever Steam asks for one
- The full base game

HOW IT WORKS
1. Pay, then open Shopee Chat - your login is sent there automatically
2. Sign in to Steam with those details
3. When Steam asks for a verification code, follow the steps in that same chat message
4. Enter the code straight away - it is short-lived

BEFORE YOU PLAY
- Play in Offline Mode

PLEASE NOTE
- This is a SHARED account, not a personal account
- Do not change the password, email or any account setting
- Login details are delivered automatically, within 24 hours of payment
- Support through Shopee chat
```

---

## G6. Cyberpunk 2077 — App 1091500

*CD PROJEKT RED · 9 Dec 2020 · RPG · RM219.00 on Steam · 3 DLC exist · single-player ·
full controller support · has Steam Cloud · supplier `gamersfantasy.my`,
order + account: see `local/websites/gamersfantasy.my.md` (gitignored) · suggested RM1.99*

**Title** (102)
```
[Steam PC] Cyberpunk 2077 (CP2077) | Full Game Original | Shared Account | 24H Auto Delivery | Offline
```

**Keywords** (P6): cyberpunk 2077, cp2077, steam pc, original pc game, full game, shared account, 24h auto delivery, offline

**Description**
```
CYBERPUNK 2077 — Steam shared account

Night City, first person, one mercenary carrying someone else's memories. An open
world RPG where the build you pick changes how each job can be solved.

WHAT YOU GET
- Login for a Steam account that owns Cyberpunk 2077
- A Steam Guard code whenever Steam asks for one
- The full base game

HOW IT WORKS
1. Pay, then open Shopee Chat - your login is sent there automatically
2. Sign in to Steam with those details
3. When Steam asks for a verification code, follow the steps in that same chat message
4. Enter the code straight away - it is short-lived

BEFORE YOU PLAY
- Play in Offline Mode
- Turn Steam Cloud OFF - it can overwrite other players' saves

PLEASE NOTE
- This is a SHARED account, not a personal account
- Do not change the password, email or any account setting
- Login details are delivered automatically, within 24 hours of payment
- Support through Shopee chat
```

---

## G7. METAL GEAR SOLID DELTA: SNAKE EATER — App 2417610 ⚠️ id inferred

*KONAMI · 28 Aug 2025 · Action/Adventure · RM239.00 list on Steam (RM155.35 at capture, 35% off) · 1 DLC exists · single-player, plus
online PvP · full controller support · has Steam Cloud · supplier `gamersfantasy.my`,
order + account: see `local/websites/gamersfantasy.my.md` (gitignored) · suggested RM1.99*

⚠️ Confirm the account owns **Delta** (2417610) and not the **MGS3 Master Collection Version**
(2131650) before generating any art. The title says `DELTA` rather than `Δ` because Shopee search
and Malaysian keyboards do not do Greek.

Steam lists Online **PvP** for this game and no co-op, so the title ends `OFFLINE`. The PvP mode is
named in the pitch but not promised in `WHAT YOU GET` — a shared account playing online is not
something to encourage.

**Title** (111)
```
METAL GEAR SOLID DELTA SNAKE EATER (MGS Delta) PC Game Murah | Original Full Game | 24H Auto Delivery | Offline
```

**Keywords** (P5): metal gear solid delta, mgs delta, snake eater, pc game murah, original, full game, 24h auto delivery, offline

**Description**
```
METAL GEAR SOLID DELTA: SNAKE EATER — Steam shared account

The 1964 jungle infiltration, rebuilt. Camouflage, stalk and survive your way
through Snake Eater with the original story and voice performances intact.

WHAT YOU GET
- Login for a Steam account that owns METAL GEAR SOLID DELTA: SNAKE EATER
- A Steam Guard code whenever Steam asks for one
- The full base game

HOW IT WORKS
1. Pay, then open Shopee Chat - your login is sent there automatically
2. Sign in to Steam with those details
3. When Steam asks for a verification code, follow the steps in that same chat message
4. Enter the code straight away - it is short-lived

BEFORE YOU PLAY
- Play in Offline Mode
- Turn Steam Cloud OFF - it can overwrite other players' saves

PLEASE NOTE
- This is a SHARED account, not a personal account
- Do not change the password, email or any account setting
- Login details are delivered automatically, within 24 hours of payment
- Support through Shopee chat
```

---

## G8. Sekiro Shadows Die Twice GOTY — App 814380

*FromSoftware · 21 Mar 2019 · Action/Adventure · RM285.00 on Steam · 0 DLC · single-player ·
full controller support · has Steam Cloud · supplier `gamersfantasy.my`,
order + account: see `local/websites/gamersfantasy.my.md` (gitignored) ·
suggested RM1.99*

`GOTY` stays in the title: app 814380 *is* the GOTY Edition on Steam, so it is the product name,
not a DLC claim.

**Title** (108)
```
Sekiro Shadows Die Twice GOTY Steam Account | Original PC Game | Full Game | 24 Hour Delivery | Offline Play
```

**Keywords** (P2): sekiro, sekiro shadows die twice, goty, goty edition, steam account, original pc game, full game, offline

**Description**
```
SEKIRO: SHADOWS DIE TWICE - GOTY EDITION — Steam shared account

A one-armed shinobi in Sengoku Japan, built entirely around the deflect. Fights
are won by holding your ground and reading the rhythm, not by backing away.

WHAT YOU GET
- Login for a Steam account that owns Sekiro: Shadows Die Twice - GOTY Edition
- A Steam Guard code whenever Steam asks for one
- The full base game

HOW IT WORKS
1. Pay, then open Shopee Chat - your login is sent there automatically
2. Sign in to Steam with those details
3. When Steam asks for a verification code, follow the steps in that same chat message
4. Enter the code straight away - it is short-lived

BEFORE YOU PLAY
- Play in Offline Mode
- Turn Steam Cloud OFF - it can overwrite other players' saves

PLEASE NOTE
- This is a SHARED account, not a personal account
- Do not change the password, email or any account setting
- Login details are delivered automatically, within 24 hours of payment
- Support through Shopee chat
```

---

## Part 3 checklist before any of this goes live

Everything in the Part 2 checklist applies here too — it is the same supplier code path. On top of
it:

1. **Confirm the Metal Gear app id** against the account's library (Delta 2417610 vs Master
   Collection 2131650) before generating any art.
2. **Close the Ubisoft second-account gap, or drop those three titles.** As things stand a buyer of
   Outlaws, Shadows or Valhalla pays and cannot launch the game.
3. **Decide the shared-cap question for the shared gamersfantasy order** — seven games against ~5-6 redemptions is
   the tightest inventory in the shop, and a buyer of one title exhausts the other six.
4. **Generate art.** None of the eight has a `brand/` set. Slugs to use:
   `horizon-zero-dawn-remastered`, `star-wars-outlaws`, `assassins-creed-shadows`,
   `god-of-war-ragnarok`, `assassins-creed-valhalla`, `cyberpunk-2077`,
   `metal-gear-solid-delta-snake-eater`, `sekiro-shadows-die-twice`. No `FREE DLC` badge on any of
   them, and `OFFLINE PLAY` on all eight.
5. **Apply or reject the `>RM150 → RM1.99` tier.** All eight sit in it; nothing in the shop uses it.
6. **Create the UNLIST drafts and map them.** Unlike Part 2, this step has not been done.

---

# Part 4 — gamersfantasy.my single-game orders (NO SHOPEE DRAFT YET)

Five more games, added to `local/websites/gamersfantasy.my.md` on 2026-09-06 after Part 3 was
written. They are **the best-shaped supplier inventory we hold**, for one reason: *one order id,
one game, one account.* No pool, no bundle.

Steam facts fetched live 2026-09-06 from `appdetails?cc=my` — `FACT-V`. App ids resolved with
`scripts/resolve-appids.mjs`, not from memory.

## Why this batch is better than Part 3

Part 3's seven games all redeem against **one** order id, so ~5-6 redemptions are shared between
them and a Cyberpunk buyer can lock out a God of War buyer. **Every game here carries its own order
id, so it carries its own cap.** That is roughly five times the usable capacity of the Part 3 batch
for the same number of titles, and one title selling out no longer touches the others.

The cap itself is unchanged (~5-6 per order id, then `REACHED LIMIT` until reset by hand), so this
is still finite inventory. It is just no longer *shared* inventory.

## 🔴 Red Dead Redemption 2 must not be listed — this is already decided

`CHECKPOINT.md` line 428 rules Red Dead Redemption 2 **`DOES NOT FIT`**, alongside Forza Horizon 6
and AC Black Flag Resynced, because of **mandatory Rockstar account linkage**. The game prompts for
a Rockstar Games account tied to the Steam copy; we deliver Steam credentials only, exactly like the
three Ubisoft titles in Part 3.

That ruling predates this batch and nothing here overturns it. Copy is written below so it is ready
if the account-linkage problem is ever solved, but **the listing is blocked.**

## ⚠️ Use LIST price for the pricing tier, not the price showing today

Two of these are on sale right now and it changes their tier:

| Game | Price at capture | List price | Discount | Tier on sale price | Tier on list price |
|---|---|---|---|---|---|
| Palworld | RM50.40 | **RM72.00** | 30% | RM1.59 | RM1.59 (unchanged) |
| Red Dead Redemption 2 | RM62.25 | **RM249.00** | 75% | RM1.59 ❌ | **RM1.99** |

Reading RDR2's sale price as its value would have put a RM249 game in the same bucket as
Stacklands. The tier below is set from **list** price throughout.

This also corrected an error in Part 3: METAL GEAR SOLID DELTA was recorded at RM155.35, which was a
35%-off sale price. Its list price is RM239.00. The tier verdict there was unaffected (both are
above RM150) but the recorded fact was wrong and has been fixed.

## ⚠️ The CO-OP title tail contradicts the "Play in Offline Mode" line

Palworld and RDR2 both list Online Co-op on Steam, so by the house rule their titles end `CO-OP`.
But every description in this file — theirs included — says **"Play in Offline Mode"** under
BEFORE YOU PLAY.

**A buyer who bought on the strength of `CO-OP` and is then told to play offline has a fair
complaint.** This is not new to Part 4: Euro Truck Simulator 2, Schedule I, Tribes of Midgard,
Ghost of Tsushima and Fantasy Life i are all live or drafted with the same contradiction. It is
flagged here because Palworld is a game people buy *specifically* to play with friends, which makes
it the title most likely to turn the contradiction into a dispute.

**Not resolved here** — it needs a decision, not a copy tweak. The options are to drop `CO-OP` from
the tail, or to say plainly in the description what online play does and does not work on a shared
account. Either is a change to the house rules at the top of this file.

## Status at a glance

| Game | App | Steam list | Steam Cloud | Online co-op | Suggested | Blocked by |
|---|---|---|---|---|---|---|
| Marvel's Spider-Man 2 | 2651280 | RM249.00 | yes | no | RM1.99 | nothing — cleanest in the batch |
| Cities: Skylines II | 949230 | RM169.00 | yes | no | RM1.99 | nothing |
| The Last of Us Part II Remastered | 2531310 | RM209.00 | yes | no | RM1.99 | nothing |
| Palworld | 1623730 | RM72.00 | yes | **yes** | RM1.59 | OFFLINE/offline wording |
| Red Dead Redemption 2 | 1174180 | RM249.00 | **no** | yes | RM1.99 | 🔴 Rockstar account linkage |

## Edition names dropped, same rule as Part 3

| Supplier's label | Sold as | App | Dropped |
|---|---|---|---|
| Marvel's Spider-Man 2 Digital Deluxe Edition | Marvel's Spider-Man 2 | 2651280 | `Digital Deluxe Edition` |
| Cities: Skylines II Ultimate Edition | Cities: Skylines II | 949230 | `Ultimate Edition` |
| The Last of Us Part 2 Remastered | The Last of Us Part II Remastered | 2531310 | — |
| Palworld | Palworld | 1623730 | — |
| Red Dead Redemption 2 Ultimate Edition | Red Dead Redemption 2 | 1174180 | `Ultimate Edition` |

Steam's own catalogue confirms the first two are add-ons, not editions of the base product:
`Marvel's Spider-Man 2 - Digital Deluxe Upgrade` is a separate SKU (app 3172660), and Cities:
Skylines II has 21 separate DLC entries. `Remastered` in The Last of Us Part II Remastered is kept —
app 2531310 *is* the Remastered product.

---

## H1. Marvel's Spider-Man 2 — App 2651280

*Insomniac Games / Nixxes · 30 Jan 2025 · Action/Adventure · RM249.00 on Steam · 0 DLC on the base
app · single-player · full controller support · has Steam Cloud · supplier `gamersfantasy.my`, own
order id + account: see `local/websites/gamersfantasy.my.md` (gitignored) · suggested RM1.99*

The cleanest listing in the batch: no account linkage, no co-op wording problem, own redemption cap.

**Title** (100)
```
Marvel's Spider-Man 2 Steam Account | Original PC Game | Full Game | 24 Hour Delivery | Offline Play
```

**Keywords** (P2): marvel's spider-man 2, spiderman 2, spider man 2 pc, steam account, original pc game, full game, 24 hour delivery, offline

**Description**
```
MARVEL'S SPIDER-MAN 2 — Steam shared account

Peter and Miles share one New York and you swap between them mid-mission.
Symbiote powers, web-wings across the boroughs, and Kraven's hunt closing in.

WHAT YOU GET
- Login for a Steam account that owns Marvel's Spider-Man 2
- A Steam Guard code whenever Steam asks for one
- The full base game

HOW IT WORKS
1. Pay, then open Shopee Chat - your login is sent there automatically
2. Sign in to Steam with those details
3. When Steam asks for a verification code, follow the steps in that same chat message
4. Enter the code straight away - it is short-lived

BEFORE YOU PLAY
- Play in Offline Mode
- Turn Steam Cloud OFF - it can overwrite other players' saves

PLEASE NOTE
- This is a SHARED account, not a personal account
- Do not change the password, email or any account setting
- Login details are delivered automatically, within 24 hours of payment
- Support through Shopee chat
```

---

## H2. Cities: Skylines II — App 949230

*Colossal Order / Iceflake Studios · 24 Oct 2023 · Simulation · RM169.00 on Steam · 21 DLC exist ·
single-player · full controller support · has Steam Cloud · supplier `gamersfantasy.my`, own order
id + account: see `local/websites/gamersfantasy.my.md` (gitignored) · suggested RM1.99*

21 DLC exist for this game and we have verified none of them. The `Ultimate Edition` in the
supplier's label is exactly the claim the banned-claims table forbids.

**Title** (105)
```
Cities Skylines 2 PC Game Murah | Steam Shared Account | Original Full Game | 24H Auto Delivery | Offline
```

**Keywords** (P5): cities skylines 2, cities skylines ii, city builder pc, game pc murah, steam shared account, original full game, 24h auto delivery

**Description**
```
CITIES: SKYLINES II — Steam shared account

Zone, wire and plumb a city up from empty ground, then let the traffic and the
tax sheet tell you what you got wrong. A deeper simulation than the first game.

WHAT YOU GET
- Login for a Steam account that owns Cities: Skylines II
- A Steam Guard code whenever Steam asks for one
- The full base game

HOW IT WORKS
1. Pay, then open Shopee Chat - your login is sent there automatically
2. Sign in to Steam with those details
3. When Steam asks for a verification code, follow the steps in that same chat message
4. Enter the code straight away - it is short-lived

BEFORE YOU PLAY
- Play in Offline Mode
- Turn Steam Cloud OFF - it can overwrite other players' saves

PLEASE NOTE
- This is a SHARED account, not a personal account
- Do not change the password, email or any account setting
- Login details are delivered automatically, within 24 hours of payment
- Support through Shopee chat
```

---

## H3. The Last of Us Part II Remastered — App 2531310

*Naughty Dog / Nixxes / Iron Galaxy · 3 Apr 2025 · Action/Adventure · RM209.00 on Steam · 0 DLC ·
single-player · full controller support · has Steam Cloud · supplier `gamersfantasy.my`, own order
id + account: see `local/websites/gamersfantasy.my.md` (gitignored) · suggested RM1.99*

`No Return` is part of the Remastered base product, not DLC, so naming it in the pitch is safe.

**Title** (113)
```
[PC] The Last of Us Part 2 Remastered - Shared Steam Account | Full Game | Auto Delivery 24H | Original | Offline
```

**Keywords** (P3): the last of us part 2, tlou 2, last of us remastered, shared steam account, full game, auto delivery 24h, original, offline

**Description**
```
THE LAST OF US PART II REMASTERED — Steam shared account

Ellie's revenge, told from both ends of it. Close-quarters survival in a Seattle
nobody controls, plus the No Return roguelike mode built for this version.

WHAT YOU GET
- Login for a Steam account that owns The Last of Us Part II Remastered
- A Steam Guard code whenever Steam asks for one
- The full base game

HOW IT WORKS
1. Pay, then open Shopee Chat - your login is sent there automatically
2. Sign in to Steam with those details
3. When Steam asks for a verification code, follow the steps in that same chat message
4. Enter the code straight away - it is short-lived

BEFORE YOU PLAY
- Play in Offline Mode
- Turn Steam Cloud OFF - it can overwrite other players' saves

PLEASE NOTE
- This is a SHARED account, not a personal account
- Do not change the password, email or any account setting
- Login details are delivered automatically, within 24 hours of payment
- Support through Shopee chat
```

---

## H4. Palworld — App 1623730 · ⚠️ read the CO-OP note above

*Pocketpair · 9 Jul 2026 · Action/Adventure/Indie/RPG · RM72.00 list on Steam (RM50.40 at capture,
30% off) · 1 DLC exists · **online co-op, cross-platform multiplayer** · full controller support ·
has Steam Cloud · supplier `gamersfantasy.my`, own order id + account: see
`local/websites/gamersfantasy.my.md` (gitignored) · suggested RM1.59*

⚠️ This is the title where the `CO-OP` tail versus "Play in Offline Mode" contradiction matters most
— people buy Palworld to play it with friends. Settle that wording before listing.

At RM72.00 list it falls in the existing `>RM45 → RM1.59` tier, not the proposed fourth tier.

**Title** (81)
```
Palworld | Akaun Steam | Game PC Original | Full Game | Delivery 24 Jam | Offline
```

**Keywords** (P4): palworld, akaun steam, game pc original, survival craft pc, delivery 24 jam, co-op, full game

**Description**
```
PALWORLD — Steam shared account

Catch Pals, then put them to work - mining, farming, hauling, or holding a gun.
Open-world survival and base building.

WHAT YOU GET
- Login for a Steam account that owns Palworld
- A Steam Guard code whenever Steam asks for one
- The full base game

HOW IT WORKS
1. Pay, then open Shopee Chat - your login is sent there automatically
2. Sign in to Steam with those details
3. When Steam asks for a verification code, follow the steps in that same chat message
4. Enter the code straight away - it is short-lived

BEFORE YOU PLAY
- Play in Offline Mode
- Turn Steam Cloud OFF - it can overwrite other players' saves

PLEASE NOTE
- This is a SHARED account, not a personal account
- Do not change the password, email or any account setting
- Login details are delivered automatically, within 24 hours of payment
- Support through Shopee chat
```

---

## H5. Red Dead Redemption 2 — App 1174180 · 🔴 DO NOT LIST

*Rockstar Games · 5 Dec 2019 · Action/Adventure · RM249.00 list on Steam (RM62.25 at capture, 75%
off) · 0 DLC · online co-op + PvP · **no Steam Cloud** · no controller-support flag on the Steam
listing · supplier `gamersfantasy.my`, own order id + account: see
`local/websites/gamersfantasy.my.md` (gitignored) · suggested RM1.99*

🔴 **Blocked, and this was already decided.** `CHECKPOINT.md` line 428 rules RDR2 `DOES NOT FIT` on
mandatory **Rockstar account linkage** — the same class of problem as the three Ubisoft titles in
Part 3. Do not create a draft for this.

No Steam Cloud on this app, so the Cloud line is correctly absent below.

**Title** (105)
```
Steam PC | Red Dead Redemption 2 RDR2 | Full Game Original | Shared Account | 24H Auto Delivery | Offline
```

**Keywords** (P6): red dead redemption 2, rdr2, red dead 2, steam pc, full game original, shared account, 24h auto delivery, co-op

**Description**
```
RED DEAD REDEMPTION 2 — Steam shared account

1899, and the Van der Linde gang is running out of country. An open world you
cross on horseback, where the small choices stack up on Arthur Morgan.

WHAT YOU GET
- Login for a Steam account that owns Red Dead Redemption 2
- A Steam Guard code whenever Steam asks for one
- The full base game

HOW IT WORKS
1. Pay, then open Shopee Chat - your login is sent there automatically
2. Sign in to Steam with those details
3. When Steam asks for a verification code, follow the steps in that same chat message
4. Enter the code straight away - it is short-lived

BEFORE YOU PLAY
- Play in Offline Mode

PLEASE NOTE
- This is a SHARED account, not a personal account
- Do not change the password, email or any account setting
- Login details are delivered automatically, within 24 hours of payment
- Support through Shopee chat
```

---

## Part 4 checklist before any of this goes live

The Part 2 checklist applies — same supplier code path. On top of it:

1. **Drop Red Dead Redemption 2** unless the Rockstar-linkage ruling in `CHECKPOINT.md` is
   overturned. Four listable games here, not five.
2. **Settle the `CO-OP` versus "Play in Offline Mode" contradiction** before Palworld goes up. It
   affects five already-live or drafted listings too, so it is a house-rules decision.
3. **Verify the Cyberpunk double-order-id question** recorded in `local/websites/gamersfantasy.my.md`
   — one account, two order ids. If the caps are independent it is free capacity; if shared, we paid
   twice. Cheap to test: exhaust one id, see whether the other still yields.
4. **Generate art.** None of the five has a `brand/` set. Slugs: `marvels-spider-man-2`,
   `cities-skylines-2`, `the-last-of-us-part-2-remastered`, `palworld`, `red-dead-redemption-2`.
   No `FREE DLC` badge on any. `ONLINE CO-OP` on Palworld and RDR2 only; `OFFLINE PLAY` on the
   other three.
5. **Apply or reject the `>RM150 → RM1.99` tier.** Three of these sit in it. Palworld does not.
6. **Create the UNLIST drafts and map them.** Not done for any of the five.

---

# Part 4 — gamersfantasy.my single-game orders (added 2026-09-06)

Five more games, each on **its own order id** — the simplest shape yet: one order, one game, one
account. That matters: unlike the supplier order (id in `local/`, gitignored)'s seven games, these do **not** share a redemption
cap with anything, so a buyer of one cannot exhaust another.

Four are listed. One is not.

## ⛔ Red Dead Redemption 2 — do not list

the supplier order (id in `local/`, gitignored) / the account for this game is seeded and linked so the fleet knows we hold it, but it
must not become a Shopee listing. Two independent reasons, reached separately:

- **The supplier's own `instruct` field says so:** *"You MUST setup the bypass patch in tutorial! No
  rockstar code will be given."* The buyer is expected to patch around Rockstar's launcher, and no
  Social Club credential is supplied at all.
- **`research/2026-09-05-shared-account-fit-filter.md` already classed RDR2 `DOES NOT FIT`** —
  mandatory Rockstar Social Club link plus a periodic online entitlement re-check, *even in story
  mode*. That verdict predates this order, so the supplier note is corroboration, not new evidence.

Selling a title that needs a third-party patch to run also sits badly against a `/terms` page that
is still a placeholder.

> Separately, the supplier order (id in `local/`, gitignored) is **the same Cyberpunk account we already hold** under
> the supplier order (id in `local/`, gitignored) — one Steam account, two order ids. Left out of seeding deliberately:
> `seed-suppliers.mjs` hard-exits on duplicate usernames, so adding it would block the write for
> every supplier account. It is either free extra capacity or a double purchase, depending on
> whether the two ids carry independent redemption caps. Untested.

---

## P21. Marvel's Spider-Man 2 — App 2651280

*Insomniac Games / Nixxes · 30 Jan 2025 · Action/Adventure · RM249.00 on Steam · no DLC ·
single-player · has Steam Cloud · order + account: see `local/websites/gamersfantasy.my.md` (gitignored) ·
RM1.99*

**Title**
```
Marvels Spider-Man 2 | Steam PC Game | FULL GAME | 24H AUTO DELIVERY | ORIGINAL | OFFLINE
```

**Description**
```
MARVEL'S SPIDER-MAN 2 — Steam shared account

Peter and Miles across a bigger New York, with the symbiote pulling one of them
somewhere darker. Web-swinging that still has no equal.

WHAT YOU GET
- Login for a Steam account that owns Marvel's Spider-Man 2
- A Steam Guard code whenever Steam asks for one
- The full base game

HOW IT WORKS
1. Pay, then open Shopee Chat - your login is sent there automatically
2. Sign in to Steam with those details
3. When Steam asks for a verification code, follow the steps in that same chat message
4. Enter the code straight away - it is short-lived

BEFORE YOU PLAY
- Play in Offline Mode
- Turn Steam Cloud OFF - it can overwrite other players' saves

PLEASE NOTE
- This is a SHARED account, not a personal account
- Do not change the password, email or any account setting
- Login details are delivered automatically, within 24 hours of payment
- Support through Shopee chat
```

---

## P22. The Last of Us Part II Remastered — App 2531310

*Naughty Dog / Nixxes / Iron Galaxy · 3 Apr 2025 · Action/Adventure · RM209.00 on Steam · no DLC ·
single-player · has Steam Cloud · order + account: see `local/websites/gamersfantasy.my.md` (gitignored) · RM1.99*

**Title**
```
The Last of Us Part 2 Remastered | Steam PC Game | FULL GAME | 24H AUTO DELIVERY | ORIGINAL | OFFLINE
```

**Description**
```
THE LAST OF US PART II REMASTERED — Steam shared account

Ellie's story, remastered for PC, with the No Return roguelike mode and the lost
levels included.

WHAT YOU GET
- Login for a Steam account that owns The Last of Us Part II Remastered
- A Steam Guard code whenever Steam asks for one
- The full base game

HOW IT WORKS
1. Pay, then open Shopee Chat - your login is sent there automatically
2. Sign in to Steam with those details
3. When Steam asks for a verification code, follow the steps in that same chat message
4. Enter the code straight away - it is short-lived

BEFORE YOU PLAY
- Play in Offline Mode
- Turn Steam Cloud OFF - it can overwrite other players' saves

PLEASE NOTE
- This is a SHARED account, not a personal account
- Do not change the password, email or any account setting
- Login details are delivered automatically, within 24 hours of payment
- Support through Shopee chat
```

---

## P23. Cities: Skylines II — App 949230

*Colossal Order / Iceflake · 24 Oct 2023 · Simulation · RM169.00 on Steam · 21 DLC exist ·
single-player · has Steam Cloud · order + account: see `local/websites/gamersfantasy.my.md` (gitignored) · RM1.99*

**Title**
```
Cities Skylines II | Steam PC Game | FULL GAME | 24H AUTO DELIVERY | ORIGINAL | OFFLINE
```

**Description**
```
CITIES: SKYLINES II — Steam shared account

Build a city and then watch the traffic tell you what you got wrong. Deeper
simulation, bigger maps, and roads that will haunt you.

WHAT YOU GET
- Login for a Steam account that owns Cities: Skylines II
- A Steam Guard code whenever Steam asks for one
- The full base game

HOW IT WORKS
1. Pay, then open Shopee Chat - your login is sent there automatically
2. Sign in to Steam with those details
3. When Steam asks for a verification code, follow the steps in that same chat message
4. Enter the code straight away - it is short-lived

BEFORE YOU PLAY
- Play in Offline Mode
- Turn Steam Cloud OFF - it can overwrite other players' saves

PLEASE NOTE
- This is a SHARED account, not a personal account
- Do not change the password, email or any account setting
- Login details are delivered automatically, within 24 hours of payment
- Support through Shopee chat
```

---

## P24. Palworld — App 1623730

*Pocketpair · 9 Jul 2026 · Action/Adventure/Indie/RPG · RM50.40 on Steam · 1 DLC exists ·
**online co-op** · has Steam Cloud · order + account: see `local/websites/gamersfantasy.my.md` (gitignored) · RM1.59*

The only one of the five with online co-op, and the only one under RM55 on Steam — hence RM1.59
rather than RM1.99.

**Title**
```
Palworld | Steam PC Game | FULL GAME | 24H AUTO DELIVERY | ORIGINAL | OFFLINE
```

**Description**
```
PALWORLD — Steam shared account

Catch creatures, then put them to work in your factory. Survival crafting with
a straight face and a very odd premise.

WHAT YOU GET
- Login for a Steam account that owns Palworld
- A Steam Guard code whenever Steam asks for one
- The full base game

HOW IT WORKS
1. Pay, then open Shopee Chat - your login is sent there automatically
2. Sign in to Steam with those details
3. When Steam asks for a verification code, follow the steps in that same chat message
4. Enter the code straight away - it is short-lived

BEFORE YOU PLAY
- Play in Offline Mode
- Turn Steam Cloud OFF - it can overwrite other players' saves

PLEASE NOTE
- This is a SHARED account, not a personal account
- Do not change the password, email or any account setting
- Login details are delivered automatically, within 24 hours of payment
- Support through Shopee chat
```

---

# Part 5 — prepared but DELISTED, blocked on a delivery gap

Four games that are fully prepared — banner, copy, listing, mapping, seeded credentials — and
deliberately kept **UNLIST**. They are not waiting on a supplier reset like DELTARUNE; they are
waiting on us being able to deliver what the buyer needs.

> **None of these descriptions is publishable as written.** Each is missing the very thing that makes
> the game work, because we cannot deliver it yet. Adding the missing line to the copy does not fix
> the problem — the credential has to actually reach the buyer first. Read the blocker for each
> before listing.

**None of these four has Steam Cloud** (checked against Steam's category data), so their descriptions
omit the "turn Steam Cloud off" line the rest of the catalogue carries.

## The blocker for the three Ubisoft titles

Each needs a **second Ubisoft account** on top of the Steam credentials — the Ubisoft launcher
prompts for it after the Steam game starts. `steam_accounts` stores exactly one credential pair, and
`buildDeliveryMessage()` sends Order ID + Username + Password. There is nowhere to put the second
pair and no way to send it.

**Before any of these three can be published**, all of:
1. Somewhere to store a second credential pair (schema change).
2. Delivery + the buyer lookup page carrying it.
3. A line added to each description below telling the buyer they also get a Ubisoft login.

## The blocker for Red Dead Redemption 2

Different and harder. The supplier supplies **no Rockstar credential at all** — its `instruct` field
says *"You MUST setup the bypass patch in tutorial! No rockstar code will be given."*
`research/2026-09-05-shared-account-fit-filter.md` independently classed RDR2 **DOES NOT FIT**:
mandatory Social Club link plus a periodic online entitlement re-check, even in story mode.

This one is not a schema gap — the credential does not exist to deliver. Publishing it means selling
a game that needs a third-party patch to run, against a `/terms` page that is still a placeholder.
**Recommend not listing it at all** rather than treating it as pending.

---

## P25. Star Wars Outlaws Ultimate Edition — App 2842040

*Massive Entertainment (Ubisoft) · 21 Nov 2024 · Action/Adventure · RM229.00 on Steam ·
no Steam Cloud · order + account: see `local/websites/gamersfantasy.my.md` (gitignored) · RM1.99 · **DELISTED***

**Title**
```
Star Wars Outlaws Ultimate Edition | Steam PC Game | FULL GAME | 24H AUTO DELIVERY | ORIGINAL | OFFLINE
```

**Description**
```
STAR WARS OUTLAWS ULTIMATE EDITION — Steam shared account

A scoundrel, a syndicate double-cross, and an open galaxy between the Empire and
everyone else. The Ultimate Edition content included.

WHAT YOU GET
- Login for a Steam account that owns Star Wars Outlaws
- A Steam Guard code whenever Steam asks for one
- The full base game

HOW IT WORKS
1. Pay, then open Shopee Chat - your login is sent there automatically
2. Sign in to Steam with those details
3. When Steam asks for a verification code, follow the steps in that same chat message
4. Enter the code straight away - it is short-lived

BEFORE YOU PLAY
- Play in Offline Mode

PLEASE NOTE
- This is a SHARED account, not a personal account
- Do not change the password, email or any account setting
- Login details are delivered automatically, within 24 hours of payment
- Support through Shopee chat
```

---

## P26. Assassins Creed Shadows Deluxe Edition — App 3159330

*Ubisoft Quebec · 19 Mar 2025 · Action/Adventure/RPG · RM239.00 on Steam · no Steam Cloud ·
order + account: see `local/websites/gamersfantasy.my.md` (gitignored) · RM1.99 · **DELISTED***

**Title**
```
Assassins Creed Shadows Deluxe | Steam PC Game | FULL GAME | 24H AUTO DELIVERY | ORIGINAL | OFFLINE
```

**Description**
```
ASSASSIN'S CREED SHADOWS DELUXE EDITION — Steam shared account

Feudal Japan, two protagonists with opposite methods - a shinobi who avoids the
fight and a samurai who ends it. Deluxe Edition content included.

WHAT YOU GET
- Login for a Steam account that owns Assassin's Creed Shadows
- A Steam Guard code whenever Steam asks for one
- The full base game

HOW IT WORKS
1. Pay, then open Shopee Chat - your login is sent there automatically
2. Sign in to Steam with those details
3. When Steam asks for a verification code, follow the steps in that same chat message
4. Enter the code straight away - it is short-lived

BEFORE YOU PLAY
- Play in Offline Mode

PLEASE NOTE
- This is a SHARED account, not a personal account
- Do not change the password, email or any account setting
- Login details are delivered automatically, within 24 hours of payment
- Support through Shopee chat
```

---

## P27. Assassins Creed Valhalla Complete Edition — App 2208920

*Ubisoft Montreal · 6 Dec 2022 · Action/Adventure/RPG · RM189.00 on Steam · no Steam Cloud ·
order + account: see `local/websites/gamersfantasy.my.md` (gitignored) · RM1.99 · **DELISTED***

**Title**
```
Assassins Creed Valhalla Complete | Steam PC Game | FULL GAME | 24H AUTO DELIVERY | ORIGINAL | OFFLINE
```

**Description**
```
ASSASSIN'S CREED VALHALLA COMPLETE EDITION — Steam shared account

Raid England as a Viking, build a settlement, and decide how much of a conqueror
you actually are. Complete Edition content included.

WHAT YOU GET
- Login for a Steam account that owns Assassin's Creed Valhalla
- A Steam Guard code whenever Steam asks for one
- The full base game

HOW IT WORKS
1. Pay, then open Shopee Chat - your login is sent there automatically
2. Sign in to Steam with those details
3. When Steam asks for a verification code, follow the steps in that same chat message
4. Enter the code straight away - it is short-lived

BEFORE YOU PLAY
- Play in Offline Mode

PLEASE NOTE
- This is a SHARED account, not a personal account
- Do not change the password, email or any account setting
- Login details are delivered automatically, within 24 hours of payment
- Support through Shopee chat
```

---

## P28. Red Dead Redemption 2 Ultimate Edition — App 1174180

*Rockstar Games · 5 Dec 2019 · Action/Adventure · RM62.25 on Steam · no Steam Cloud ·
order + account: see `local/websites/gamersfantasy.my.md` (gitignored) · RM1.59 · **DELISTED — recommend never listing***

**Title**
```
Red Dead Redemption 2 Ultimate Edition | Steam PC Game | FULL GAME | 24H AUTO DELIVERY | ORIGINAL | OFFLINE
```

**Description**
```
RED DEAD REDEMPTION 2 ULTIMATE EDITION — Steam shared account

1899, the end of the outlaw age, and a gang that will not admit it. One of the
densest open worlds ever built.

WHAT YOU GET
- Login for a Steam account that owns Red Dead Redemption 2
- A Steam Guard code whenever Steam asks for one
- The full base game

HOW IT WORKS
1. Pay, then open Shopee Chat - your login is sent there automatically
2. Sign in to Steam with those details
3. When Steam asks for a verification code, follow the steps in that same chat message
4. Enter the code straight away - it is short-lived

BEFORE YOU PLAY
- Play in Offline Mode

PLEASE NOTE
- This is a SHARED account, not a personal account
- Do not change the password, email or any account setting
- Login details are delivered automatically, within 24 hours of payment
- Support through Shopee chat
```

---

## Resolved: the duplicate Resident Evil Requiem row was deleted

`Resident Evil Requiem Deluxe Edition` was a second `games` row for the same product as the live
`Resident Evil Requiem` (`45667475242`) — same app id 3764200, same supplier order the supplier order (id in `local/`, gitignored),
same five-account pool. It never got a listing, and on 2026-09-06 the row and its duplicate
account link were deleted.

No second Shopee listing was created for it, deliberately: that would have been a duplicate listing
of a live product, splitting ranking and reviews across two pages. The fix was a data merge.

The delete was guarded — it refused to run unless the surviving row was confirmed listed, the
duplicate confirmed unlisted, and every account on the duplicate confirmed also linked to the
survivor. The surviving row now holds all five pool accounts.

**Item ids for the four delisted drafts above:**

| Game | item_id | Price | Status |
|---|---|---|---|
| Star Wars Outlaws Ultimate Edition | 54517448418 | RM1.99 | UNLIST |
| Assassins Creed Shadows Deluxe Edition | 54867444295 | RM1.99 | UNLIST |
| Assassins Creed Valhalla Complete Edition | 54817448536 | RM1.99 | UNLIST |
| Red Dead Redemption 2 Ultimate Edition | 55867457087 | RM1.59 | UNLIST |

---

# Part 5 — gamersfantasy.my batch of 2026-09-07

Ten games, each on its own order id, added to `local/websites/gamersfantasy.my.md` overnight.
Steam facts fetched live 2026-09-07 from `appdetails?cc=my` — `FACT-V`. App ids resolved with
`scripts/resolve-appids.mjs`.

**All ten are listable.** Order + account for each: see `local/websites/gamersfantasy.my.md`
(gitignored — `prechkorder` returns credentials from an order id alone, so ids never go in a
tracked file).

---

## 📌 Chaison's decisions, 2026-09-07 — these override the `ss-market` skill

Recorded here so the next session does not re-derive them or "fix" them back.

**1. Co-op and offline are BOTH advertised.** The `ss-market` skill (§1) bans all co-op,
multiplayer and online wording on the grounds that buyers are restricted to Offline Mode.
**Overruled.** Local and split-screen co-op work on a shared account, buyers do purchase these
games to play them that way, and the tail now says `Offline + Co-Op` wherever Steam lists co-op.
The skill file should be amended to match, or it will keep flagging this.

**2. `FULL GAME` stays on Subnautica 2 despite Early Access.** I raised this as a claim-accuracy
risk; Chaison's call is to treat it like every other listing. Recorded, not re-argued. The residual
risk, stated once: Steam's own store page shows an Early Access banner, so a buyer can see the
mismatch, which makes it the most defensible refund request in the batch.

**3. Split Fiction is listable — I was wrong to block it.** I read "no Single-player category" as
"unplayable" and stopped there. Steam also lists **Shared/Split Screen Co-op**, **Shared/Split
Screen** and **Remote Play Together** for app 2001120, so two people at one PC can play it, which
is a normal thing for a buyer to want. Its tail says `LOCAL CO-OP` rather than plain `CO-OP`
because that is the specific true claim — there is no solo mode.

**4. Scope of this session is titles and descriptions only.** Everything else below is flagged for
another session, not fixed here.

---

## 🔴 SEO/roast pass, 2026-09-07 — two games are NOT sellable

Two independent grill-me roasts plus a live Steam re-check changed the batch. **Verified from
Steam's own `drm_notice` / `ext_user_account_notice` fields, `FACT-V` 2026-09-07:**

| Game | Steam's own declaration | Verdict |
|---|---|---|
| **EA SPORTS FC 26** | `drm_notice`: *"EA online activation and EA app software installation and background use required."* | 🔴 **DO NOT LIST.** An Offline-Mode buyer cannot start it at all. Not "thin value" — zero. |
| **WWE 2K26** | `ext_user_account_notice`: *"2K Account"*; `drm_notice`: Denuvo **5 different machines/24h** | 🔴 **DO NOT LIST.** Publisher login plus a hard machine cap that limits buyers per account. |
| **Split Fiction** | `legal_notice`: *"Internet connection; Steam Account; acceptance of EA User Agreement required"* | ⚠️ **VERIFY FIRST.** EA-published, no solo mode, and an internet requirement that sits badly with Offline Mode. |
| Football Manager 26 | `drm_notice`: Denuvo Anti-tamper, no publisher account, no published cap | Listable; Denuvo risk noted. |
| Call of Duty: WWII | no third-party account notice | Listable — my earlier Activision flag was unfounded. |

`scripts/games-data.mjs` (written by a parallel session) had already reached the EA and 2K
conclusions. **Eight listable, not ten.**

## Co-op is claimed ONLY where split-screen exists

Chaison's 2026-09-07 override permits co-op wording on the stated grounds that *"local and
split-screen co-op work on a shared account"*. Applying that reasoning honestly:

| Steam category | Games | Tail |
|---|---|---|
| Shared/Split Screen Co-op present | Call of Duty: WWII, Split Fiction, (WWE 2K26, EA FC 26 — both blocked anyway) | co-op claim allowed |
| **Online Co-op only, no split screen** | **Ready or Not, Subnautica 2** | **OFFLINE** — an offline buyer cannot reach it |
| No co-op at all | TEKKEN 8, Football Manager 26, UNCHARTED, FINAL FANTASY XVI | OFFLINE |

So exactly **one shipping title carries a co-op claim** (Call of Duty: WWII, `Offline Local Co-Op`)
plus Split Fiction if it clears verification. I had wrongly put `Offline + Co-Op` on Ready or Not
and Subnautica 2; that was my error in the dispatch brief, not the marketing agent's.

## 🔴 HIGHEST PRIORITY, and it is not in this file

**Every Shopee banner the shop renders prints `gameshare.space` inside the image** —
`scripts/gen-banners.mjs:108` and `:148`, the `.foot` div in both the main and feature templates.
That is ~152 live banner images. Shopee's `[MY] Listing Violation Guide` p.12 prohibits photos that
"include any URLs to an external website"; p.4 sets 1 penalty point per 2 deleted listings, and 3
points caps the shop at 100 listings for 28 days. The shop's own `ss-market` skill already writes
this rule down and says "…or image".

### ✅ GENERATOR FIXED 2026-09-07 — but the live images are NOT yet replaced

`FACT-V` 2026-09-07. `gen-banners.mjs:108` and `:148` now render `GAMESHARE` (the shop brand, no
TLD, not a URL) instead of `gameshare.space`. `node --check` clean; `dave-the-diver` re-rendered
and inspected — footer correct, layout intact.

⚠️ **"It is a two-line deletion" was wrong, and deleting those lines would have broken every
banner.** Both templates fill the 830px canvas exactly — main `62+375+84+245+64`, feature
`62+470+236+62` — so removing the `.foot` div leaves a 62–64px white strip at the bottom of all
~188 images. The band has to stay; only its text changes. Recorded because the next session would
have followed the old instruction.

**Re-rendered and staged, same day.** `FACT-V` 2026-09-07: `node scripts/gen-banners.mjs` rendered
all **188** banners across 47 games; **0 of 188** contain `gameshare.space`, **188 of 188** carry
the `GAMESHARE` footer. All 188 copied into `brand/` (every one differed, i.e. every staged asset
had carried the URL — confirmed by opening the pre-fix `brand/dave-the-diver-banner-1.png`, which
printed `gameshare.space`).

The 7 older single-image banners in `brand/` (`<slug>-banner.png`, plus `-v2`) were **not**
re-rendered: `docs/shopee-listings.md:94-95` marks them "kept for reference, do not upload".

**The exposure on Shopee is NOT cleared.** Two things remain, and only Chaison can do them:

1. **Re-upload the 188 images to the listings.** Fixing the generator and `brand/` changes nothing
   a buyer or Shopee sees.
2. ⚠️ **`UNSOURCED — MUST VERIFY`: nobody has confirmed the images actually on each live listing
   match `brand/` byte-for-byte.** `scratchpad/verifycopy.mjs` diffs text only; no image diff
   exists. So "the live listings carry the URL" is an inference from the generator, not a
   verified fact about Shopee — likely true, unproven.

### 🔴 THIRD ART FINDING, NEW 2026-09-07 — an unbacked claim is live inside 4 images

**`FREE DLC INCLUDED` is printed on the banner of `dave-the-diver`, `euro-truck-simulator-2`,
`escape-from-duckov` and `dokimon-quest`** — `games-data.mjs`, the `badge3` field. All four are
live listings.

This is the same claim `CHECKPOINT.md` records as removed from the shop entirely, on the grounds
that DLC ownership *"is only true if that account owns the DLC and nobody has checked
per-account."* The 2026-09-06 cleanup removed `DLC+` from **titles** and stopped there, so the
claim survived in the images, where nobody looked.

Sharper for two of them: Dave the Diver and Escape From Duckov each sell **Offline** and **Offline
DLC** as separate variations. A banner claim covers the whole listing, so it over-claims on the
base variation by construction — the buyer who picks Offline is told the DLC is included.

**Not changed here** — it is a live-listing claim, which is Chaison's call, and the honest fix
needs a per-account DLC check nobody has run. The other 43 games carry `OFFLINE PLAY` (37) or
`SINGLE PLAYER` (6), both of which are safe.

### 🔶 Fourth art finding + PROPOSED fix — awaiting Chaison, 2026-09-07

The cover banner renders **`ADD TO YOUR STEAM LIBRARY` at 27px and the game's own name at 14px**.
The largest text is both an ownership claim the product does not deliver — the buyer gets access to
a shared account, not a title in their own library — and not the term a buyer scans for. The cover
is the only image in Shopee search results.

**Proposed:** the game name leads the band, with `<genre> · SHARED STEAM ACCOUNT` beneath it. That
deletes the ownership claim, promotes the term buyers actually search, and turns the second line
into the shop's real differentiator instead of filler.

Rendered and checked at both extremes (`FACT-V` 2026-09-07): `UNCHARTED: LEGACY OF THIEVES`
(28 chars, the longest in the catalogue) and `SEKIRO` (6, the shortest) both sit correctly, because
the size steps down with length rather than being fixed.

**Not applied.** The `gameshare.space` removal was unambiguous policy compliance; this one bundles
a claim removal with a typographic judgement, and brand is Chaison's call. **If he approves, do it
before the re-upload** — the 188 images have to be re-uploaded for the URL fix anyway, so bundling
costs one upload instead of two.

The patch, against `mainBanner()` in `scripts/gen-banners.mjs`:

```js
// add at the top of mainBanner(g) — size steps down so a long title never overflows 800px
const tLen = g.title.length;
const titleSize = tLen > 34 ? 19 : tLen > 27 ? 22 : tLen > 20 ? 26 : 30;

// .band CSS
.band h1{color:#fff;font-weight:900;font-size:${titleSize}px;letter-spacing:.02em;
         text-align:center;line-height:1.05;padding:0 22px}
.band p{color:#c7b8ec;font-weight:700;font-size:13px;letter-spacing:.10em}

// body
<div class="band"><h1>${g.title.toUpperCase()}</h1><p>${g.genre} &middot; SHARED STEAM ACCOUNT</p></div>
```

## Shopee allows 9 images, not 3

`FACT-S`, independently re-fetched twice from Shopee's Seller Education Hub article/370: *"up to
nine images (including the cover image)"*. Three is Shopee's stated **minimum**. The pipeline
renders four, so **five slots per listing are unused.** Full spec and its roast in
`scratchpad/seo2/images.md` and `scratchpad/seo2/roast-images.md`.

## Titles now use the 120-character cap

Average **115/120**, up from 92 — about 230 characters of indexed search text recovered across the
ten. Every count below is re-derived from the text mechanically, not carried over.

⚠️ Two standing conflicts a human must settle:
- **`CHECKPOINT.md:294-296` and `docs/shopee-listings.md:16-18` record a decision that ~117-character
  title walls "are not the target".** Chaison's instruction on 2026-09-07 was the opposite — fill the
  cap. The newer instruction is applied here; the older records should be updated or this will
  ping-pong.
- **"FIFA 26" was removed** from the EA SPORTS FC 26 title. It is Shopee's own literal Keyword/Brand
  Spam example. (Moot while that game is do-not-list, but do not reinstate it.)

## ⚠️ Section collision — two sessions are editing this file

At 01:01:13 on 2026-09-07 another session rewrote the titles in this Part, stripping every co-op
tail to enforce the `ss-market` rule that Chaison had already overruled, and left the character
counts stale — six of ten were then wrong, and Split Fiction's title said `OFFLINE` while the prose
four lines above it said `LOCAL CO-OP`. Restored here against the verified facts above.

**Until the `ss-market` skill file is amended to match Chaison's override, the two sessions will
keep reverting each other.** That is the fix, not another edit to this file.

## 🚩 Flagged for another session — NOT fixed here

1. **`gameshare.space` URLs in Parts 1–4 descriptions.** All 38 carry one. Shopee MY's Listing
   Violation Guide treats an external URL that directs transactions off-platform as a violation —
   1 penalty point per 2 deleted listings. Part 5's descriptions omit the URL and point at Shopee
   Chat instead, so **Part 5 is deliberately inconsistent with Parts 1–4 here.** Whoever reconciles
   should decide one way and apply it everywhere.
2. **Descriptions still tell buyers to enter a Steam username** on the lookup page. The homepage
   stopped asking for one on 2026-09-06. Stale in Parts 1–4; already corrected in Part 5.
3. **Title keyword stacking.** `FULL GAME | 24H AUTO DELIVERY | ORIGINAL` in one title sits inside
   Shopee's keyword-spam definition. Kept here for consistency with the shop's existing style;
   flagged as live exposure, not enforced against this shop so far.
4. **Duplicate part numbering in this file.** Two `Part 4` headings and two `Part 5` headings exist,
   written by two sessions at once, with eight games appearing twice. Left alone on Chaison's
   instruction. The `⚠️ Section collision` note under Part 4 lists them.
5. **Publisher-account checks below** are unverified and need someone with Steam access.

---

## ⚠️ Four titles may need a publisher account on top of Steam — verify before listing

Same family as the Ubisoft titles in Part 3 and Red Dead Redemption 2 in Part 4. **None verified** —
the check is launching each once, offline, on the real account and seeing what it prompts for. That
is Chaison-only; no agent can reach Steam.

| Game | Publisher | Risk | Status |
|---|---|---|---|
| EA SPORTS FC 26 | Electronic Arts | EA app account | `UNSOURCED — MUST VERIFY` |
| Split Fiction | Electronic Arts | EA app account | `UNSOURCED — MUST VERIFY` |
| Call of Duty: WWII | Activision | Activision/Battle.net account | `UNSOURCED — MUST VERIFY` |
| WWE 2K26 | 2K | 2K account prompt seen on other 2K titles | `UNSOURCED — MUST VERIFY` |

## Two sale prices — tiers set from LIST price

| Game | At capture | List | Discount | Tier from list |
|---|---|---|---|---|
| WWE 2K26 | RM119.50 | **RM239.00** | 50% | RM1.99 |
| Call of Duty: WWII | RM71.25 | **RM285.00** | 75% | RM1.99 |

Both would have landed a tier low on the sale price, per the rule established in Part 4.

## Status at a glance

| Game | App | Steam list | Cloud | Offline on Steam | Tail | Suggested |
|---|---|---|---|---|---|---|
| TEKKEN 8 | 1778820 | RM139.00 | yes | versus only, no co-op | OFFLINE | RM1.59 |
| Ready or Not | 1144200 | RM100.00 | yes | online co-op | Offline | RM1.59 |
| WWE 2K26 | 3717070 | RM239.00 | yes | online + split screen | Offline | RM1.99 |
| Football Manager 26 | 3551340 | RM199.00 | yes | no | OFFLINE | RM1.99 |
| Call of Duty: WWII | 476600 | RM285.00 | yes | online + split screen | Offline | RM1.99 |
| EA SPORTS FC 26 | 3405690 | RM75.00 | **no** | online + split screen | Offline | RM1.59 |
| UNCHARTED: Legacy of Thieves | 1659420 | RM209.00 | yes | no | OFFLINE | RM1.99 |
| Subnautica 2 | 1962700 | RM89.00 | yes | online co-op | Offline | RM1.59 |
| Split Fiction | 2001120 | RM159.00 | yes | **split screen, no solo** | OFFLINE | RM1.99 |
| FINAL FANTASY XVI | 2515020 | RM209.00 | yes | no | OFFLINE | RM1.99 |

## Edition names dropped

| Supplier's label | Sold as | App | Why |
|---|---|---|---|
| TEKKEN 8 Ultimate Edition | TEKKEN 8 | 1778820 | 24 separate DLC exist |
| Ready or Not: Home Invasion Bundle | Ready or Not | 1144200 | `Home Invasion` is DLC app 3015760 |
| WWE 2K26 Attitude Era Edition | WWE 2K26 | 3717070 | 12 separate DLC exist |
| FINAL FANTASY XVI COMPLETE EDITION | FINAL FANTASY XVI | 2515020 | Expansion Pass is app 2886900 |

Unverified per-account DLC ownership, same rule as Parts 3 and 4.

## Description template used here

No URL (see flag 1), and no "enter your Steam username" (see flag 2).

```
<GAME> - Steam shared account

<pitch>

WHAT YOU GET
- Login for a Steam account that owns <Game>
- A Steam Guard code whenever Steam asks for one
- The full base game

HOW IT WORKS
1. Pay, then open Shopee Chat - your login is sent there automatically
2. Sign in to Steam with those details
3. When Steam asks for a verification code, follow the steps in that same chat message
4. Enter the code straight away - it is short-lived

BEFORE YOU PLAY
- Play in Offline Mode
- Turn Steam Cloud OFF - it can overwrite other players' saves    <- omit if no Steam Cloud

PLEASE NOTE
- This is a SHARED account, not a personal account
- Do not change the password, email or any account setting
- Login details are delivered automatically, within 24 hours of payment
- Support through Shopee chat
```

---

## J1. TEKKEN 8 — App 1778820

*Bandai Namco Studios · 25 Jan 2024 · Action · RM139.00 on Steam · 24 DLC exist · single-player ·
has Steam Cloud · supplier `gamersfantasy.my` · suggested RM1.59*

Steam lists versus and online PvP but **no co-op**, so the tail stays `OFFLINE`. Local versus on one
PC works; Arcade Quest and story mode are the offline draw.

**Title** (116)
```
TEKKEN 8 Steam PC Game | Fighting Game Original Full Game | Akaun Steam Shared Account | 24H Auto Delivery | OFFLINE
```

**Keywords:** tekken 8, tekken, fighting game pc, game pc original, steam pc game, full game, 24h auto delivery, offline

**Description**
```
TEKKEN 8 - Steam shared account

The King of Iron Fist returns with the Mishima bloodline still tearing itself
apart. Arcade Quest, story mode, and versus matches on one PC.

WHAT YOU GET
- Login for a Steam account that owns TEKKEN 8
- A Steam Guard code whenever Steam asks for one
- The full base game

HOW IT WORKS
1. Pay, then open Shopee Chat - your login is sent there automatically
2. Sign in to Steam with those details
3. When Steam asks for a verification code, follow the steps in that same chat message
4. Enter the code straight away - it is short-lived

BEFORE YOU PLAY
- Play in Offline Mode
- Turn Steam Cloud OFF - it can overwrite other players' saves

PLEASE NOTE
- This is a SHARED account, not a personal account
- Do not change the password, email or any account setting
- Login details are delivered automatically, within 24 hours of payment
- Support through Shopee chat
```

---

## J2. Ready or Not - App 1144200

*VOID Interactive · 13 Dec 2023 · Action/Adventure/Indie · RM100.00 on Steam · 4 DLC exist ·
single-player + online co-op · has Steam Cloud · supplier `gamersfantasy.my` · suggested RM1.59*

**Title** (118)
```
Ready or Not Steam PC Game | Tactical Shooter SWAT Original | Akaun Steam Shared Account | 24H Auto Delivery | OFFLINE
```

**Keywords:** ready or not, tactical shooter pc, swat game, co-op pc game, akaun steam, original pc game, 24 hour delivery

**Description**
```
READY OR NOT - Steam shared account

Lead a SWAT team through buildings that punish rushing. Breach, clear and call
your shots - a deliberate, tense tactical shooter with AI officers.

WHAT YOU GET
- Login for a Steam account that owns Ready or Not
- A Steam Guard code whenever Steam asks for one
- The full base game

HOW IT WORKS
1. Pay, then open Shopee Chat - your login is sent there automatically
2. Sign in to Steam with those details
3. When Steam asks for a verification code, follow the steps in that same chat message
4. Enter the code straight away - it is short-lived

BEFORE YOU PLAY
- Play in Offline Mode
- Turn Steam Cloud OFF - it can overwrite other players' saves

PLEASE NOTE
- This is a SHARED account, not a personal account
- Do not change the password, email or any account setting
- Login details are delivered automatically, within 24 hours of payment
- Support through Shopee chat
```

---

## J3. WWE 2K26 - App 3717070 · ⚠️ verify the 2K account prompt first

*Visual Concepts / 2K · 12 Mar 2026 · Simulation/Sports · RM239.00 list on Steam (RM119.50 at
capture, 50% off) · 12 DLC exist · single-player + co-op + split screen · has Steam Cloud ·
supplier `gamersfantasy.my` · suggested RM1.99*

**Title** (107)
```
WWE 2K26 Steam PC Game | Wrestling Game Original Full Game | Akaun Steam Asli | 24H Auto Delivery | OFFLINE
```

**Keywords:** wwe 2k26, wwe 2k, wrestling game pc, shared steam account, full game, auto delivery 24h, original, co-op

**Description**
```
WWE 2K26 - Steam shared account

Build a wrestler and take them through MyRise, run your own roster in Universe
mode, or hand a friend the second controller.

WHAT YOU GET
- Login for a Steam account that owns WWE 2K26
- A Steam Guard code whenever Steam asks for one
- The full base game

HOW IT WORKS
1. Pay, then open Shopee Chat - your login is sent there automatically
2. Sign in to Steam with those details
3. When Steam asks for a verification code, follow the steps in that same chat message
4. Enter the code straight away - it is short-lived

BEFORE YOU PLAY
- Play in Offline Mode
- Turn Steam Cloud OFF - it can overwrite other players' saves

PLEASE NOTE
- This is a SHARED account, not a personal account
- Do not change the password, email or any account setting
- Login details are delivered automatically, within 24 hours of payment
- Support through Shopee chat
```

---

## J4. Football Manager 26 - App 3551340

*Sports Interactive / SEGA · 4 Nov 2025 · Simulation/Sports/Strategy · RM199.00 on Steam · 1 DLC
exists · single-player · has Steam Cloud · supplier `gamersfantasy.my` · suggested RM1.99*

No co-op on Steam's list, so the tail stays `OFFLINE`. The whole game is single-player by nature —
one of the best fits in the catalogue.

**Title** (120)
```
Football Manager 26 FM26 Steam PC Game | Original Full Game Akaun Steam | Game PC Original | 24H Auto Delivery | OFFLINE
```

**Keywords:** football manager 26, fm26, football manager, akaun steam, game pc original, delivery 24 jam, offline

**Description**
```
FOOTBALL MANAGER 26 - Steam shared account

Take a club and run all of it - transfers, tactics, the training pitch and the
press. Then find out on a Saturday whether any of it worked.

WHAT YOU GET
- Login for a Steam account that owns Football Manager 26
- A Steam Guard code whenever Steam asks for one
- The full base game

HOW IT WORKS
1. Pay, then open Shopee Chat - your login is sent there automatically
2. Sign in to Steam with those details
3. When Steam asks for a verification code, follow the steps in that same chat message
4. Enter the code straight away - it is short-lived

BEFORE YOU PLAY
- Play in Offline Mode
- Turn Steam Cloud OFF - it can overwrite other players' saves

PLEASE NOTE
- This is a SHARED account, not a personal account
- Do not change the password, email or any account setting
- Login details are delivered automatically, within 24 hours of payment
- Support through Shopee chat
```

---

## J5. Call of Duty: WWII - App 476600 · ⚠️ verify the Activision account prompt first

*Sledgehammer Games / Activision · 2 Nov 2017 · Action · RM285.00 list on Steam (RM71.25 at
capture, 75% off) · 1 DLC exists · single-player + co-op + split screen · has Steam Cloud ·
supplier `gamersfantasy.my` · suggested RM1.99*

**Title** (118)
```
Call of Duty WWII COD WW2 Steam PC Game | War Shooter Original | Akaun Steam | 24H Auto Delivery | Offline Local Co-Op
```

**Keywords:** call of duty wwii, cod ww2, call of duty ww2, game pc murah, steam shared account, original full game, co-op

**Description**
```
CALL OF DUTY: WWII - Steam shared account

Normandy onward with the 1st Infantry Division. A campaign that drops the
regenerating health and makes you lean on your squad.

WHAT YOU GET
- Login for a Steam account that owns Call of Duty: WWII
- A Steam Guard code whenever Steam asks for one
- The full base game

HOW IT WORKS
1. Pay, then open Shopee Chat - your login is sent there automatically
2. Sign in to Steam with those details
3. When Steam asks for a verification code, follow the steps in that same chat message
4. Enter the code straight away - it is short-lived

BEFORE YOU PLAY
- Play in Offline Mode
- Turn Steam Cloud OFF - it can overwrite other players' saves

PLEASE NOTE
- This is a SHARED account, not a personal account
- Do not change the password, email or any account setting
- Login details are delivered automatically, within 24 hours of payment
- Support through Shopee chat
```

---

## J6. EA SPORTS FC 26 - App 3405690 · ⚠️ verify the EA account prompt first

*EA Canada / Electronic Arts · 25 Sep 2025 · Simulation/Sports · RM75.00 on Steam · 1 DLC exists ·
single-player + co-op + split screen · **no Steam Cloud** · supplier `gamersfantasy.my` ·
suggested RM1.59*

No Steam Cloud on this app, so the Cloud line is correctly absent below.

**Title** (113)
```
EA SPORTS FC 26 FC26 Steam PC Game | Football Game Original Full Game | Akaun Steam | 24H Auto Delivery | OFFLINE
```

**Keywords:** ea sports fc 26, fc 26, fifa 26, football game pc, steam pc, shared account, 24h auto delivery, co-op

**Description**
```
EA SPORTS FC 26 - Steam shared account

The 2025/26 squads, Career mode, Kick-Off and matches against a friend on the
same PC. Build a club across seasons or just play a game.

WHAT YOU GET
- Login for a Steam account that owns EA SPORTS FC 26
- A Steam Guard code whenever Steam asks for one
- The full base game

HOW IT WORKS
1. Pay, then open Shopee Chat - your login is sent there automatically
2. Sign in to Steam with those details
3. When Steam asks for a verification code, follow the steps in that same chat message
4. Enter the code straight away - it is short-lived

BEFORE YOU PLAY
- Play in Offline Mode

PLEASE NOTE
- This is a SHARED account, not a personal account
- Do not change the password, email or any account setting
- Login details are delivered automatically, within 24 hours of payment
- Support through Shopee chat
```

---

## J7. UNCHARTED: Legacy of Thieves Collection - App 1659420

*Naughty Dog / Iron Galaxy · 19 Oct 2022 · Adventure · RM209.00 on Steam · 0 DLC · single-player ·
has Steam Cloud · supplier `gamersfantasy.my` · suggested RM1.99*

**The cleanest listing in this batch** - pure single-player, no DLC to misrepresent, no publisher
login, two full games in one product.

**Title** (115)
```
UNCHARTED Legacy of Thieves Collection Steam PC Game | Action Adventure | Akaun Steam | 24H Auto Delivery | OFFLINE
```

**Keywords:** uncharted, uncharted legacy of thieves, uncharted 4, lost legacy, steam account, original pc game, offline

**Description**
```
UNCHARTED: LEGACY OF THIEVES COLLECTION - Steam shared account

Two full adventures: Nathan Drake's last job in A Thief's End, and Chloe and
Nadine's run through India in The Lost Legacy.

WHAT YOU GET
- Login for a Steam account that owns UNCHARTED: Legacy of Thieves Collection
- A Steam Guard code whenever Steam asks for one
- The full base game

HOW IT WORKS
1. Pay, then open Shopee Chat - your login is sent there automatically
2. Sign in to Steam with those details
3. When Steam asks for a verification code, follow the steps in that same chat message
4. Enter the code straight away - it is short-lived

BEFORE YOU PLAY
- Play in Offline Mode
- Turn Steam Cloud OFF - it can overwrite other players' saves

PLEASE NOTE
- This is a SHARED account, not a personal account
- Do not change the password, email or any account setting
- Login details are delivered automatically, within 24 hours of payment
- Support through Shopee chat
```

---

## J8. Subnautica 2 - App 1962700

*Unknown Worlds Entertainment · 14 May 2026 · Action/Adventure · RM89.00 on Steam · 1 DLC exists ·
single-player + online co-op · has Steam Cloud · supplier `gamersfantasy.my` · suggested RM1.59*

Steam classes this app as **Early Access**. Per Chaison's decision 2 above it is sold as `FULL GAME`
like everything else, and the Early Access framing is not in the copy.

**Title** (111)
```
Subnautica 2 Steam PC Game | Underwater Survival Original Full Game | Akaun Steam | 24H Auto Delivery | OFFLINE
```

**Keywords:** subnautica 2, subnautica, survival game pc, underwater survival, steam pc game, full game, co-op, offline

**Description**
```
SUBNAUTICA 2 - Steam shared account

An alien ocean to descend into, one breath at a time. Scavenge, build a base,
and find out what is further down than you wanted to go.

WHAT YOU GET
- Login for a Steam account that owns Subnautica 2
- A Steam Guard code whenever Steam asks for one
- The full base game

HOW IT WORKS
1. Pay, then open Shopee Chat - your login is sent there automatically
2. Sign in to Steam with those details
3. When Steam asks for a verification code, follow the steps in that same chat message
4. Enter the code straight away - it is short-lived

BEFORE YOU PLAY
- Play in Offline Mode
- Turn Steam Cloud OFF - it can overwrite other players' saves

PLEASE NOTE
- This is a SHARED account, not a personal account
- Do not change the password, email or any account setting
- Login details are delivered automatically, within 24 hours of payment
- Support through Shopee chat
```

---

## J9. Split Fiction - App 2001120 · ⚠️ verify the EA account prompt first

*Hazelight Studios / Electronic Arts · 6 Mar 2025 · Action/Adventure · RM159.00 on Steam · 1 DLC
exists · **co-op only - no single-player mode** · split screen + Remote Play Together · has Steam
Cloud · supplier `gamersfantasy.my` · suggested RM1.99*

The tail says `LOCAL CO-OP`, not `CO-OP` or `OFFLINE`, because that is the precise true claim:
Steam lists Shared/Split Screen Co-op and Remote Play Together, and lists **no** Single-player. Two
people at one PC works. One person alone does not, and the description says so plainly - a buyer
who expects a solo campaign is the one refund risk on this listing.

**Title** (115)
```
Split Fiction Steam PC Game | 2 Player Split Screen Co-op Hazelight | Akaun Steam | 24H Auto Delivery | LOCAL CO-OP
```

**Keywords:** split fiction, hazelight, co-op game pc, split screen game, 2 player pc game, steam pc game, full game, local co-op

**Description**
```
SPLIT FICTION - Steam shared account

Two writers trapped inside their own stories, one sci-fi and one fantasy,
switching worlds to get out. Built for two players on one screen.

WHAT YOU GET
- Login for a Steam account that owns Split Fiction
- A Steam Guard code whenever Steam asks for one
- The full base game

HOW IT WORKS
1. Pay, then open Shopee Chat - your login is sent there automatically
2. Sign in to Steam with those details
3. When Steam asks for a verification code, follow the steps in that same chat message
4. Enter the code straight away - it is short-lived

BEFORE YOU PLAY
- Play in Offline Mode
- Turn Steam Cloud OFF - it can overwrite other players' saves

PLEASE NOTE
- TWO PLAYERS REQUIRED - this game is co-op only and has no solo mode
- Split screen on one PC, two controllers recommended
- This is a SHARED account, not a personal account
- Do not change the password, email or any account setting
- Login details are delivered automatically, within 24 hours of payment
- Support through Shopee chat
```

---

## J10. FINAL FANTASY XVI - App 2515020

*Square Enix · 17 Sep 2024 · Action/RPG · RM209.00 on Steam · 5 DLC exist · single-player ·
has Steam Cloud · supplier `gamersfantasy.my` · suggested RM1.99*

Pure single-player, no publisher login.

**Title** (113)
```
FINAL FANTASY XVI FF16 Steam PC Game | Action JRPG Original Full Game | Akaun Steam | 24H Auto Delivery | OFFLINE
```

**Keywords:** final fantasy xvi, ff16, final fantasy 16, jrpg pc, steam pc game, full game, 24h auto delivery, offline

**Description**
```
FINAL FANTASY XVI - Steam shared account

Valisthea, where the Mothercrystals are running the continent into war. Clive
Rosfield's revenge, told through Eikon fights the size of the landscape.

WHAT YOU GET
- Login for a Steam account that owns FINAL FANTASY XVI
- A Steam Guard code whenever Steam asks for one
- The full base game

HOW IT WORKS
1. Pay, then open Shopee Chat - your login is sent there automatically
2. Sign in to Steam with those details
3. When Steam asks for a verification code, follow the steps in that same chat message
4. Enter the code straight away - it is short-lived

BEFORE YOU PLAY
- Play in Offline Mode
- Turn Steam Cloud OFF - it can overwrite other players' saves

PLEASE NOTE
- This is a SHARED account, not a personal account
- Do not change the password, email or any account setting
- Login details are delivered automatically, within 24 hours of payment
- Support through Shopee chat
```

---

## Part 5 checklist

1. **Verify the publisher-login prompt** for EA SPORTS FC 26, Split Fiction, Call of Duty: WWII and
   WWE 2K26 - launch each once, offline, on the real account. Chaison-only.
2. **Generate art.** Slugs: `tekken-8`, `ready-or-not`, `wwe-2k26`, `football-manager-26`,
   `call-of-duty-wwii`, `ea-sports-fc-26`, `uncharted-legacy-of-thieves`, `subnautica-2`,
   `split-fiction`, `final-fantasy-xvi`. No `FREE DLC` badge on any. `ONLINE CO-OP` badge on
   Ready or Not, WWE 2K26, Call of Duty: WWII, EA SPORTS FC 26 and Subnautica 2; `LOCAL CO-OP` on
   Split Fiction; `OFFLINE PLAY` on the rest.
3. **Apply or reject the `>RM150 → RM1.99` tier.** Six of these sit in it.
4. **Create the UNLIST drafts and map them.** Not done for any of the ten.

---

## 🔶 PROPOSED — SHOP description (shop profile, not a listing), 2026-09-08

The shop had **no written description**; nothing in `docs/` or `research/` held one. This is
the first. **Not applied** — pasting it into Seller Centre is Chaison's call (§3.5, ss-market).

⚠️ `UNSOURCED — MUST VERIFY`: **Shopee MY's character cap on the shop-description field is not
recorded anywhere in this repo and was not guessed.** Two variants exist for that reason — use
the long one if the field accepts it, the short one otherwise.

⚠️ **No automated gate covers this artifact.** `scripts/audit-listing-copy.mjs` reads titles and
`games-data.mjs`; it does not see the shop description. Both variants were instead scanned
mechanically against the claim rules (lifetime / instant / refund / guarantee / online /
multiplayer / PvP / co-op / DLC / external URL) — **0 hits each**, `FACT-V` 2026-09-08.

Claim-rule notes, so nobody "improves" these back into a violation:

- **No co-op claim, deliberately.** The §1a override permits co-op wording only where Steam lists
  `Shared/Split Screen Co-op`. The only two titles that qualify (Call of Duty WWII, Split Fiction)
  are **not among the 41 live items** (`research/2026-09-13-competitor-price-map.md`, live pull
  2026-09-13), so a shop-level co-op claim would over-claim. *Corrected 2026-09-13: this line first
  said "10 live listings", read off `lib/catalogue.ts`, which lists only the 10 games on the public
  `/games` page, not what is live on Shopee. The conclusion was unaffected.*
- **No URL**, so the Listing Violation Guide's external-URL rule cannot bite even if it extends
  from listings to the shop profile (which is itself unestablished). Retrieval links already
  reach every buyer through `buildDeliveryMessage()`.
- **"24-hour", never "instant"**; no lifetime, no refund, nothing offered for a review.
- The one claim that depends on Chaison rather than on the system is **"New titles added
  regularly"** (long variant only). Shopee had 41 live items on 2026-09-13, so it is currently
  true — it stops being true if publishing stops. *(An earlier version cited "30 ready behind the
  10 live" from `publish-readiness.mjs`; that count was stale and has been removed, not re-derived.)*

### Long variant — 956 characters

```
GameShare - original Steam games on shared accounts.

You get the login for a real Steam account that already owns the game. Install through Steam as normal and play the full base game in Offline Mode.

WHY BUY HERE
- 24-hour automatic delivery - pay, and your login arrives in Shopee chat by itself
- Original games. The account genuinely owns the title
- A step-by-step setup guide comes with every order
- Support through Shopee chat

HOW IT WORKS
1. Buy the game you want
2. Your Order ID, username and password arrive in this chat within 24 hours of payment
3. Sign in to Steam, then follow the guide to get your Steam Guard code
4. Switch to Offline Mode and play

PLEASE NOTE
- These are SHARED accounts, not personal accounts
- Please do not change the password, email or any account setting
- Single-player, in Steam Offline Mode
- New titles added regularly - follow the shop to see them first

Terima kasih! Ada soalan? Chat kami terus di sini.
```

### Short variant — 476 characters

```
GameShare - original Steam games on shared accounts.

You get the login for a real Steam account that already owns the game. Install through Steam and play the full base game in Offline Mode.

- 24-hour automatic delivery, straight into Shopee chat
- Setup guide included with every order
- Support through Shopee chat

Please note: these are SHARED accounts, not personal ones. Do not change the password or any account setting.

Terima kasih! Ada soalan? Chat kami di sini.
```
