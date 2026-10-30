# Shopee Listings — Copy & Assets

Per-game listing copy and banner assets for the GameShare shop. Generated 2026-08-26.

**Sources.** Genres, DLC counts, co-op support, release dates and RM prices are pulled from Steam's
own store API (`store.steampowered.com/api/appdetails`, `cc=my`), not written from memory. Banner art
is each game's official Steam header image.

**Claims discipline.** Copy here deliberately avoids what GameShare cannot honour. Updated
2026-09-05: **auto-delivery is now true** — Shopee auto-fulfilment went live that day, so
`24H AUTO DELIVERY` is a fact, not a promise. Still say 24-hour, never *instant*. **Refund
guarantees remain off-limits** while the `/terms` window is a placeholder (open item 3) — which is
why `LIFE TIME GUARANTEE`, carried by the older Dave/Duckov titles, must not be copied onto new
listings. Likewise `DLC+` is only true if that specific account owns the DLC.

**Title convention (Chaison, 2026-09-05).** Titles must be **short and SEO-shaped**, not the
117-of-120-character walls the first listings carry. Game name **first** — it is the term buyers
search:

```
<Game> | Steam PC Game | FULL GAME | 24H AUTO DELIVERY | ORIGINAL | OFFLINE
```

Live examples, longest to shortest:

| Title | Chars |
|---|---|
| `Escape from Duckov \| Steam Game \| DLC+ \| LIFE TIME GUARANTEE \| FULL GAME \| 24 HOUR AUTO DELIVERY \| ORIGINAL \| OFFLINE` | 117 |
| `[Steam] Euro Truck Simulator 2 ETS2 PC Game \| Shared Account \| Truck Simulator \| 24H Delivery \| Offline Gameplay` | 112 |
| `Dave The Diver \| Steam Game \| DLC+ \| LIFE TIME GUARANTEE \| FULL GAME \| 24 HOUR AUTO DELIVERY \| ORIGINAL` | 103 |
| `How to Fish \| Steam PC Game \| FULL GAME \| 24H AUTO DELIVERY \| ORIGINAL \| OFFLINE` — **the target shape** | 80 |

The per-game *Title options* below predate this convention and have not been rewritten; treat the
convention above as the rule and those as raw material.

## 🚫 Never claim co-op or any online mode (Chaison, 2026-09-06)

**Buyers play in Steam Offline Mode.** That is the product — the `/tutorial` flow walks them through
going offline, and it is what keeps a shared account usable. An online mode cannot be reached from
offline mode, so **any co-op or multiplayer claim is a promise the product structurally cannot keep**,
however plainly Steam's category data lists it.

So the third badge slot is **`OFFLINE PLAY` on every game**, and no headline or body line anywhere
may mention co-op, multiplayer, "with friends", or a shared server. This overrides Steam's own
category data — that data describes the game, not what a buyer of a shared account can actually do.

Applied 2026-09-06 across all six banners that carried it (Schedule I, How to Fish, Tribes of Midgard,
Ghost of Tsushima, Fantasy Life i, Palworld), badge and copy both. Two genre labels went with it:
"Co-op Survival RPG" → "Norse Survival RPG", "Co-op Fishing Sim" → "Physics Fishing Sim".

The per-game *Title options* and *Description* blocks further down predate this rule and still contain
co-op lines; they were already superseded by `docs/listing-copy.md` and must not be copied from.

## Assets

**Current — a four-image set per game (2026-09-05).** Every game now ships **four** 800×830 images,
uploaded to Shopee in this order:

| Slot | File | What it is |
|---|---|---|
| 1 | `brand/<slug>-banner-1.png` | Main banner — Steam header art, 24-hour ribbon, 2×2 claim grid. Layout unchanged from the approved original. |
| 2–4 | `brand/<slug>-banner-[2-4].png` | One gameplay screenshot each, full width, with a headline and a one-line feature under it. Tagged `01 / 03` … `03 / 03`. |

The screenshots used to be thumbnails crammed into the bottom of the main banner, too small to read
anything from. Each now gets its own image. Every feature banner repeats the game title, because
image 3 is often the first one a buyer actually opens.

| Game | App ID | Feature banners 2 → 4 |
|---|---|---|
| DAVE THE DIVER | 1868140 | Dive the Blue Hole · Run the sushi bar · Bosses & side stories |
| Euro Truck Simulator 2 | 227300 | Haul cargo across Europe · Licensed trucks, full cockpit · Build a haulage company |
| Schedule I | 3164500 | Run the whole operation · Take over Hyland Point · Hire and manage staff |
| Escape From Duckov | 3167020 | Extraction looting · Gear up run by run · Build your hideout |
| Dokimon Quest | 2019300 | Catch 140+ Dokimon · Explore 15+ towns · Retro GBC styling |
| How to Fish | 4001890 | Cast, hook, haul it in · Physics fishing, gone wrong · Fish your way home |
| Lords of the Fallen 2014 | 265300 | Deliberate, heavy combat · Fight the Fallen Lords · A grim, hand-built world |
| Stacklands | 1948280 | Build a village from cards · Mine, farm, cook, expand · Discover every combination |
| Tribes of Midgard | 858820 | Defend the village · Fight the giants · A new world every run |
| Batman: Arkham Knight | 208650 | Be the Batman · Drive the Batmobile · Glide across Gotham |

**The bottom four were added 2026-09-05**, clearing the last of the idle inventory that had no
banners at all. Two notes on them:

- **No `FREE DLC` badge on any of them** — they run `OFFLINE PLAY` instead. DLC ownership on these
  four accounts is unconfirmed, and the claims table below calls an unowned-DLC claim a refund
  magnet. `OFFLINE PLAY` is true of every account we sell. Swap the badge only after confirming the
  account actually holds the DLC (Batman: Arkham Knight alone lists 24, Lords of the Fallen 7).
- **No co-op badge on any of them.** Tribes of Midgard originally carried one on verified Steam
  category data; it was removed 2026-09-06 under the co-op ban at the top of this file.

**App ID trap:** Tribes of Midgard is **858820**. `1004770` is a different game entirely (Maiden and
Spell) — the id was checked against Steam's store search before any art was pulled.

Superseded (kept for reference, do not upload): `*-banner.png` and
`escape-from-duckov-banner-v2.png` — the original single-image layout.

### Supplier-sourced titles (2026-09-06)

**Fifteen more games, from the supplier order tables in `local/websites/`** (`cyberspace.cyou`,
`gamersfantasy.my`). Same treatment as everything else — four Shopee banners plus a site card each,
all in `brand/`.

These are **not our own Steam accounts**, which changes two things on the art:

- **No `FREE DLC` badge on any of them.** We do not know what these accounts own.
- **`OFFLINE PLAY` on all fifteen.** Ghost of Tsushima and Fantasy Life i briefly carried a verified
  co-op badge; both were stripped 2026-09-06 under the co-op ban at the top of this file.

⚠️ **The `24 HOUR DELIVERY` ribbon is the claim to check before any of these go live.** It is
inherited from the template, and fulfilment for these runs through a **third party's** code portal,
not our own auto-delivery. Whether 24 hours holds is the supplier's behaviour, not ours.

**Name → app id.** The supplier tables label games their own way, so every id was resolved with
`scripts/resolve-appids.mjs` against Steam's index. Two are inferences, marked below — check the art
before listing either.

| Supplier's label | Steam title | App ID |
|---|---|---|
| Ghost of Tsushima | Ghost of Tsushima DIRECTOR'S CUT | 2215430 |
| DELTARUNE | DELTARUNE | 1671210 |
| Fantasy Life | FANTASY LIFE i: The Girl Who Steals Time | 2993780 |
| Into the Dead | Into the Dead: Our Darkest Days | 2239710 |
| TCG Card | TCG Card Shop Simulator | 3070070 |
| Norland | Norland | 1857090 |
| DW Origins | DYNASTY WARRIORS: ORIGINS | 2384580 |
| **All Around** | **Love Is All Around** | **2322560** ⚠️ inferred |
| Thronefall | Thronefall | 2239150 |
| Indiana Jones | Indiana Jones and the Great Circle | 2677660 |
| Orochi 3 | WARRIORS OROCHI 3 Ultimate Definitive Edition | 1879330 |
| **the Ants** | **Empire of the Ants** | **2287330** ⚠️ inferred |
| Storyteller | Storyteller | 1624540 |
| Black Myth: Wukong | Black Myth: Wukong | 2358720 |
| Resident Evil Requiem Deluxe Edition | Resident Evil Requiem | 3764200 |

- **"All Around" → Love Is All Around.** Steam has no other match; it is a Chinese live-action FMV
  dating sim, which fits a supplier whose catalogue is otherwise China-market heavy. Medium
  confidence — the art is six women in a promo lineup, so a wrong guess is obvious on sight.
- **"the Ants" → Empire of the Ants.** "The Ants: Underground Kingdom" returns nothing on Steam, and
  Empire of the Ants is the only ant game there. High confidence, still an inference.
- **"Resident Evil Requiem Deluxe Edition"** maps to the base game 3764200. The Deluxe Kit (3990820)
  is DLC and has no art of its own.

### gamersfantasy.my — eight more titles (2026-09-06)

Order the shared gamersfantasy order (id in `local/websites/gamersfantasy.my.md`, gitignored) carries **seven games on one order id**, plus Sekiro on Sekiro's own separate gamersfantasy order.
Full sets built for all eight. **Asset total is now 33 games: 132 banners + 33 cards.**

| Game | App ID | Badge | Status |
|---|---|---|---|
| Horizon Zero Dawn Remastered | 2561580 | OFFLINE PLAY | ok |
| God of War Ragnarök | 2322010 | OFFLINE PLAY | ok |
| Cyberpunk 2077 | 1091500 | OFFLINE PLAY | ok |
| METAL GEAR SOLID Δ: Snake Eater | 2417610 | OFFLINE PLAY | ⚠️ inferred id |
| Sekiro: Shadows Die Twice GOTY | 814380 | OFFLINE PLAY | ok |
| Star Wars Outlaws | 2842040 | SINGLE PLAYER | 🚫 **do not list** |
| Assassin's Creed Shadows | 3159330 | SINGLE PLAYER | 🚫 **do not list** |
| Assassin's Creed Valhalla | 2208920 | SINGLE PLAYER | 🚫 **do not list** |

🚫 **The three Ubisoft titles cannot be delivered today.** Each needs a **Ubisoft account** on top of
the Steam credentials, and we do not deliver one — the launcher prompts after the Steam game starts,
so a buyer would receive working Steam logins and still be unable to play. Confirmed independently
twice:

1. The supplier's own `instruct` field carries a second credential pair
   (`local/websites/gamersfantasy.my.md`), which `seed-suppliers.mjs` deliberately skips because
   `steam_accounts` has nowhere to put it.
2. Steam's `ext_user_account_notice` on all three reads *"Ubisoft Connect / Ubisoft Account"*. The
   other five return nothing for that field.

Their banners exist and are correct, but they carry **`SINGLE PLAYER`, not `OFFLINE PLAY`** — offline
play is precisely the claim in doubt while the Ubisoft launcher sits in the way. Do not swap that
badge back without closing the second-credential gap first.

**Two more things worth knowing before these are listed:**

- **The redemption cap is per order id, and seven games share one.** Every one of the seven redeems
  against the shared gamersfantasy order (id in `local/websites/gamersfantasy.my.md`, gitignored); the measured ceiling is ~5–6 before `REACHED LIMIT`. Buyers of one title
  exhaust the other six. (`local/websites/gamersfantasy.my.md`.)
- **Denuvo machine-activation limits.** AC Shadows carries *"5 a day machine activation limit"*, and
  Outlaws and Valhalla are Denuvo too. On a shared account, buyers on different machines burn those
  activations against each other. Not a blocker for the five that are clear, but it is a real
  shared-account constraint on the Ubisoft three on top of everything above.

**`METAL GEAR SOLID: SNAKE EATER Digital Deluxe Edition` → 2417610** (MGS Δ, the 2025 remake) rather
than 2131650 (MGS3 Master Collection). "Digital Deluxe Edition" is a Δ edition; Master Collection has
no such edition. Inferred, so check the art before listing.

### gamersfantasy.my single-game orders — five more (2026-09-06)

One order id, one game, one account each. **Asset total is now 38 games: 152 banners + 38 cards.**

| Game | App ID | Badge | Status |
|---|---|---|---|
| Marvel's Spider-Man 2 | 2651280 | OFFLINE PLAY | ok |
| Cities: Skylines II | 949230 | OFFLINE PLAY | ok |
| The Last of Us Part II Remastered | 2531310 | OFFLINE PLAY | ok |
| Palworld | 1623730 | OFFLINE PLAY | ok |
| Red Dead Redemption 2 | 1174180 | SINGLE PLAYER | 🚫 **do not list** |

🚫 **RDR2 is the second publisher-account case,** after the three Ubisoft titles. Steam's
`ext_user_account_notice` reads *"Rockstar Games"* — the same field that flagged those three, and the
other four here return nothing for it. Three independent reasons not to list it:

1. That Rockstar account, which we do not deliver.
2. The supplier's own `instruct` tells the buyer to *"setup the bypass patch in tutorial! No rockstar
   code will be given."*
3. `research/2026-09-05-shared-account-fit-filter.md:60` already classed it `DOES NOT FIT` — mandatory
   Social Club link plus a periodic online entitlement re-check, *even in story mode*. That verdict
   predates this order and was reached independently, so the supplier note is corroboration.

It carries `SINGLE PLAYER` rather than `OFFLINE PLAY`, matching the Ubisoft three. Note that RDR2 does
list online co-op on Steam — but that needs the same Rockstar account, so the co-op badge would be a
claim we cannot honour either.

**A sixth order in that section is not a sixth game.** the supplier order (id in `local/`, gitignored) returns the *same* Cyberpunk
account as the seven-game order — one Steam account, two order ids. No banner needed; it is already
covered by `cyberpunk-2077`.

**These are not wired into the website.** `/games` reads the `games` table, and none of these have a
row there, so adding them to the site needs DB rows *and* `CATALOGUE` entries in `lib/catalogue.ts`
— plus a decision about whether we want supplier-fulfilled titles on our own storefront at all. The
art is ready either way; `brand/<slug>-card.png` is the file to copy into `public/games/`.

### Site cards — `public/games/<slug>.png` (2026-09-06)

**A fifth image per game, for gameshare.space, not for Shopee.** `/games` used to reuse
`<slug>-banner-1.png`, which meant the delivery ribbon and the whole claim grid appeared inside the
image on a page that already prints all of it as real text beside the card — and an 800×830 image
forces a very deep card in a three-column grid.

The site card is **1200×675 (16:9)** and carries art and identity only: a full-bleed background, a
genre chip, the game's wordmark, and the GameShare mark. No claims, no delivery promise. Both
`/games` (`width`/`height` and the placeholder's `aspect-video`) and `lib/catalogue.ts` are wired to
this shape — changing the aspect ratio means changing all three.

Background sources, in order of preference:

1. **A gameplay screenshot** — native 1920×1080, so nothing upscales. Steam's `header_image` is only
   460×215 and would run at 2.6× on a 1200px card.
2. **`library_hero.jpg`** (`card: { art: "hero" }`) — Steam's wide illustrated key art, for a game
   with no photogenic screenshot. Stacklands is the case: every one of its screenshots is a dense
   card table with UI panels in all four corners.

The wordmark is Steam's transparent `logo.png`, present for 9 of the 10 games. Two fallbacks:

- **No logo at all** — How to Fish (4001890) has none; the card typesets the title instead.
- **`card: { useTitle: true }`** — forces the typeset title even when a logo exists. Stacklands'
  wordmark is a small mark floating in a mostly-transparent canvas, so `object-fit: contain` sizes
  it to the padding and it renders tiny at any min/max box.

Preview them with `node scripts/preview-set.mjs --cards`.

**Two source-art traps found while picking shots**, both handled by per-shot flags in the generator
and worth checking on any new game:

- **Watermarks.** Steam's own Duckov captures carry a `trial version` mark in the bottom-right
  corner. `zoom: 1.1` crops it out.
- **Non-English UI.** Duckov's inventory screenshot is entirely Chinese-language; it was dropped for
  a clean shot rather than shipped. Dokimon's pixel art uses `fit: "contain"` + `pixel: true` — a
  cover-crop ate the battle HUD's HP numbers, and default smoothing made the pixels mushy.

**Regenerating.** Art is not tracked; it is pulled from Steam's own CDN each time.

```
node scripts/fetch-art.mjs     # header + 8 screenshots per app -> scripts/art/
node scripts/resolve-appids.mjs "DW Origins"   # loose name -> Steam app id candidates
node scripts/pick-shots.mjs    # contact sheet of every screenshot -> scripts/out/sheet.png
node scripts/gen-banners.mjs   # -> scripts/out/<slug>-banner-[1-4].png
node scripts/preview-set.mjs   # every set side by side -> scripts/out/preview.png, then copy into brand/
```

`pick-shots`, `gen-banners` and `preview-set` all take an optional filter — app ids for the first,
slugs for the other two — so a single game can be re-cut without re-rendering the catalogue:

```
node scripts/gen-banners.mjs stacklands batman-arkham-knight
```

Adding a game: append an entry to `GAMES` in `gen-banners.mjs` with its app id, genre, third badge,
and three `features` — each a shot number off the contact sheet plus a `head` and `body`. Pick three
*different* sides of the game — a scene, a system, and a hook — not three views of the same thing.
Optional per-feature flags: `zoom`, `fit`, `pixel` (see the traps above).

---

## Shared block — append to every listing

```
━━━━━━━━━━━━━━━━━━━━
HOW IT WORKS
1. Complete your order and message us your Order ID
2. We activate your access within 24 hours
3. Visit gameshare.space, enter your Order ID + Steam username
4. Get your login and your Steam Guard code — play right away

WHAT YOU GET
• Login credentials for a Steam account that owns the game
• A live Steam Guard code on demand, any time you log in
• Support through Shopee chat

PLEASE NOTE
• Shared account access — not a Steam key, not a new account
• Play in Steam Offline Mode after first login
• Do not change the account password or email
• Full terms: gameshare.space/terms
━━━━━━━━━━━━━━━━━━━━
```

---

## 1. DAVE THE DIVER — App 1868140

*Adventure / Casual / RPG / Simulation · MINTROCKET · 28 Jun 2023 · RM24.50 on Steam · 5 DLC · Single-player*

**Title options**
1. `DAVE THE DIVER Steam PC | Shared Account | Full Game | 24H Delivery`
2. `[Steam] Dave The Diver PC Game — Diving & Sushi Restaurant Sim`
3. `Dave The Diver PC Steam Account | Offline Play | Murah`

**Description**
```
DAVE THE DIVER — Steam PC

Dive the Blue Hole by day, run a sushi restaurant by night.

A casual single-player adventure RPG that keeps pulling "just one more day" out of
you. Explore a sea that changes every dive, harvest your catch, then flip it into
service as your restaurant grows from a stall into the best sushi bar in town.

• Deep-sea exploration that never generates the same map twice
• Restaurant management — menu, staff, upgrades, regulars
• Dozens of side stories, mini-games and boss encounters
• Full controller support
```

## 2. Euro Truck Simulator 2 — App 227300

*Indie / Simulation · SCS Software · 12 Oct 2012 · RM54.00 on Steam · 108 DLC · Multiplayer + Online Co-op*

**Title options**
1. `Euro Truck Simulator 2 Steam PC | ETS2 Shared Account | 24H Delivery`
2. `[Steam] ETS2 Euro Truck Simulator 2 PC — Full Game + DLC`
3. `Euro Truck Simulator 2 PC Steam | Offline Play | Murah`

**Description**
```
EURO TRUCK SIMULATOR 2 — Steam PC

King of the road. Haul cargo across Europe.

The trucking sim that has held its players for over a decade. Take contracts, drive
real routes between dozens of European cities, and build a haulage company from one
truck and a bank loan into a fleet.

• Drive licensed trucks across a huge, detailed Europe
• Build your company — buy garages, hire drivers, expand the fleet
• Steam Workshop support for community mods
• Relaxing to play, deep enough to sink hundreds of hours into
```

## 3. Schedule I — App 3164500

*Action / Indie / Simulation / Strategy · TVGS · 24 Mar 2025 · RM49.00 on Steam · Early Access · Online Co-op*

**Title options**
1. `Schedule 1 Steam PC | Shared Account | Online Co-op | 24H Delivery`
2. `[Steam] Schedule I PC Game — Crime Empire Sim, Co-op`
3. `Schedule 1 PC Steam Account | Offline Play | Murah`

**Description**
```
SCHEDULE I — Steam PC

From small-time pusher to kingpin.

Build an empire in the grungy city of Hyland Point. Start on the corner, work up
through production, properties, employees and territory — and stay ahead of the
people who want what you've built.

• Run the whole operation: production, supply, distribution, expansion
• Buy properties and businesses, hire and manage staff
• Online co-op — build the empire with friends
• Early Access, actively updated by the developer
```

## 4. Escape From Duckov — App 3167020

*Action / Adventure / Indie / RPG · Team Soda · 16 Oct 2025 · RM54.62 on Steam · 1 DLC · Single-player*

**Title options**
1. `Escape From Duckov Steam PC | Shared Account | Full Game | 24H Delivery`
2. `[Steam] Escape From Duckov PC — PVE Survival Looter RPG`
3. `Escape From Duckov PC Steam Account | Offline Play | Murah`

**Description**
```
ESCAPE FROM DUCKOV — Steam PC

An extraction survival RPG — in a duck's world.

Scavenge for resources, haul your loot home, and build a hideout worth defending.
Start with nothing, upgrade your gear run by run, and outwit hostile ducks who want
what you're carrying. PVE only — no player hunting you down.

• Extraction-style looting with real risk on every run
• Base building and steady gear progression
• Steam Workshop support
• Ridiculous premise, genuinely tight gameplay loop
```

## 5. Dokimon Quest — App 2019300

*Adventure / Casual / RPG / Strategy · Yanako RPGs · 22 Nov 2024 · **FREE on Steam** · 1 DLC · Single-player*

> **⚠️ Read the flag below before listing this one.** The base game is free to download. Anyone can
> get it without buying anything, so a listing selling account access to the base game has nothing to
> sell. Only the paid DLC is sellable — and only if the account actually owns it.

**Title options** (DLC framing — do not sell the base game)
1. `Dokimon Quest DLC Steam PC | Shared Account | 24H Delivery`
2. `[Steam] Dokimon Quest + DLC PC — Monster Taming RPG`

**Description**
```
DOKIMON QUEST — Steam PC

A monster-taming RPG with GBC-era soul.

Capture and train 140+ Dokimon across 15+ towns in the Xelos region, and uncover the
mystery behind your missing childhood friend.

• 140+ creatures to catch, train and evolve
• 15+ towns to explore
• Retro Game Boy Color styling, modern quality-of-life
• Full controller support, Steam Cloud saves
```

## 6. How to Fish — App 4001890

*Action / Casual / Indie / Simulation · Dazed Games · 20 Aug 2026 · RM13.63 on Steam · 1–4 player Online Co-op*

**Title options**
1. `How to Fish Steam PC | Shared Account | 1-4 Player Co-op | 24H Delivery`
2. `[Steam] How to Fish PC Game — Physics Fishing Co-op`
3. `How to Fish PC Steam Account | Offline Play | Murah`

**Description**
```
HOW TO FISH — Steam PC

A 1–4 player physics fishing sim. Chaos included.

You were drinking and boating. You crashed into a small island. To get home, you're
going to have to learn how to fish.

• 1–4 player online co-op — built to be played with friends
• Physics-driven fishing that goes wrong in entertaining ways
• Brand new release (Aug 2026)
• Full controller support
```

---

## Claims that need your sign-off

Four claim pills appear on every banner (plus the ribbon). Two are safe; two are not, and one game
is a business problem. **Unchanged by the 2026-09-05 gameplay redesign** — the pills are smaller and
the wording shortened (`FREE DLC INCLUDED` → `FREE DLC`, `FAST DELIVERY` → `24H DELIVERY`), but every
claim below still ships and still needs your sign-off.

| Claim | Status |
|---|---|
| `100% ORIGINAL` | ✅ True — accounts hold legitimately purchased games |
| ~~`ONLINE CO-OP`~~ | 🚫 **Banned outright (Chaison, 2026-09-06).** Removed from every banner. See the rule below. |
| `24H DELIVERY` / `24 HOUR DELIVERY` ribbon | ⚠️ A promise, not a fact. Fulfilment is manual admin linking today, so 24h is only true if you actually action orders daily. Deliberately not "instant". |
| `FREE DLC` (Dave, ETS2, Duckov, Dokimon) | ⚠️ **Only true if the account owns the DLC.** ETS2 alone has 108 DLC, mostly paid. If the accounts hold base games only, this is a false claim and a refund magnet. Confirm per account — I can swap the badge to `OFFLINE PLAY` on any banner where it doesn't hold. |
| `FULL ACCOUNT` | ⚠️ **Arguably misleading.** Buyers get login credentials for a *shared* account and never get the authenticator or account ownership. In this market it reads as "credentials included, not a key", which is what you deliver — but it is the claim most likely to drive a "not as described" dispute. `STEAM OFFLINE` or `LOGIN INCLUDED` would be safer. Kept as-is for consistency with the banner you already approved — your call. |

**Dokimon Quest is free on Steam.** This is the one that isn't a wording fix. A buyer can download the
base game for nothing, so there is no base-game access to sell — only the DLC, and only if the account
owns it. Either reframe the listing as DLC-only or drop the title. It also can't carry the RM2–9
price point the rest of the catalogue is built on.
