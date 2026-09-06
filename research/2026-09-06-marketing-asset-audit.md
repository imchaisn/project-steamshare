# Marketing Asset & Site Audit

*Audit date 2026-09-06. Read-only pass over `brand/`, `docs/listing-copy.md`,
`docs/shopee-listings.md`, `app/`, `scripts/`, `supabase/migrations/`, plus live fetches against
`https://www.gameshare.space`. Nothing in the repo was modified.*

**Fact labels used throughout:** `FACT-V` = verified by running or fetching it (command/URL given).
`FACT-S` = sourced from a file (path:line given). `ASSUMPTION` = stated value plus its basis.
`UNSOURCED — MUST VERIFY` = needed but not established.

---

## Verdict in one paragraph

The art is done and the copy is not. **All 38 catalogued games have a complete, correct four-banner
Shopee set plus a site card in `brand/` — 152 banners + 38 cards, zero missing, zero partial**
(`FACT-V`, filesystem census below). That is the single largest piece of marketing work in this repo
and it is finished. Everything else is behind it. The declared upload source of truth,
`docs/listing-copy.md`, **contains and ships CO-OP claims on live listings** in direct violation of
the absolute co-op ban Chaison set the same day — and the ban and the violation live in two
different files that each claim authority over the other. Its own house rule
(`docs/listing-copy.md:56-61`) still *instructs* writers to end a title with `CO-OP`. Twenty-five
proposed SEO titles are written and unshipped, three of them corrupted to a single backtick
character despite the file asserting `FACT-V` that all 38 passed a mechanical check. Every one of
the 25 listing descriptions still tells buyers to enter a **Steam username** that the homepage
stopped asking for on 2026-09-06. On the website side: **`gameshare.space` is not a discovery
surface and not a conversion surface at all.** There is no robots.txt, no sitemap, no Open Graph, no
canonical, no structured data, and — the finding that matters most — **the entire `/games`
storefront, the only thing in the codebase that has ever linked a visitor to a Shopee listing, is
uncommitted local work that production redirects to the admin login** (`FACT-V`). There is no
analytics package of any kind and the `orders` table has no price, no item_id and no listing
reference, so Chaison cannot today answer "which listing sold what, when, and after which change"
even in principle.

---

## Asset inventory (table)

**Method (`FACT-V`).** Census run 2026-09-06 in the repo root:

```
ls brand/*.png | sed 's|brand/||' | grep -E -- '-(banner-[1-4]|card)\.png$' \
  | sed -E 's/-(banner-[1-4]|card)\.png$//' | sort -u \
  | while read s; do echo "$s $(ls brand/${s}-banner-[1-4].png | wc -l) $(ls brand/${s}-card.png | wc -l)"; done
```

Result: **38 distinct slugs, every one returning `banners=4 card=1`.** No slug has a partial set.
`brand/` holds 200 files total = 38×5 (190) + 7 superseded legacy banners + 3 logo files. The 38
slugs match `GAMES` in `scripts/games-data.mjs` one-for-one (`FACT-S`,
`scripts/games-data.mjs:17-553`). `docs/shopee-listings.md:190` claims "38 games: 152 banners + 38
cards" — **that claim is correct** (`FACT-V`, confirmed independently against the filesystem).

Listing state columns are `FACT-S` from `docs/listing-copy.md:117-128` (Part 1 live),
`docs/listing-copy.md:672-690` (Part 2 draft item ids), `docs/listing-copy.md:1682-1690` (Part 3),
`docs/listing-copy.md:2180-2185` (Part 4). Site-card column is `FACT-V` from `ls public/games/`.

| # | Game | Slug | Banners | Card | Listing state | item_id | Site card in `public/games/` | In `CATALOGUE` |
|---|---|---|---|---|---|---|---|---|
| 1 | DAVE THE DIVER | `dave-the-diver` | 4/4 | ✅ | **LIVE** | 46516993841 | ✅ | ✅ |
| 2 | Euro Truck Simulator 2 | `euro-truck-simulator-2` | 4/4 | ✅ | **LIVE** | 40634236344 | ✅ | ✅ |
| 3 | Escape From Duckov | `escape-from-duckov` | 4/4 | ✅ | **LIVE** | 49766310127 | ✅ | ✅ |
| 4 | How to Fish | `how-to-fish` | 4/4 | ✅ | **LIVE** | 48217427795 | ✅ | ✅ |
| 5 | Schedule I | `schedule-1` | 4/4 | ✅ | **LIVE** | 48217450246 | ✅ | ✅ |
| 6 | Dokimon Quest | `dokimon-quest` | 4/4 | ✅ | **LIVE** | 52667425632 | ✅ | ✅ |
| 7 | Lords of the Fallen 2014 | `lords-of-the-fallen-2014` | 4/4 | ✅ | **LIVE** | 45417439240 | ✅ | ✅ |
| 8 | Stacklands | `stacklands` | 4/4 | ✅ | **LIVE** | 52367419203 | ✅ | ✅ |
| 9 | Tribes of Midgard | `tribes-of-midgard` | 4/4 | ✅ | **LIVE** | 52467419241 | ✅ | ✅ |
| 10 | Batman: Arkham Knight | `batman-arkham-knight` | 4/4 | ✅ | **LIVE** | 45017441353 | ✅ | ✅ |
| 11 | Ghost of Tsushima DC | `ghost-of-tsushima` | 4/4 | ✅ | UNLIST draft | 46067470527 | ❌ | ❌ |
| 12 | DYNASTY WARRIORS: ORIGINS | `dynasty-warriors-origins` | 4/4 | ✅ | UNLIST draft | 54117441114 | ❌ | ❌ |
| 13 | FANTASY LIFE i | `fantasy-life-i` | 4/4 | ✅ | UNLIST draft | 46467470550 | ❌ | ❌ |
| 14 | Indiana Jones & the Great Circle | `indiana-jones-great-circle` | 4/4 | ✅ | UNLIST draft | 45467475301 | ❌ | ❌ |
| 15 | Resident Evil Requiem | `resident-evil-requiem` | 4/4 | ✅ | UNLIST draft ⚠️ stale username | 45667475242 | ❌ | ❌ |
| 16 | Black Myth: Wukong | `black-myth-wukong` | 4/4 | ✅ | UNLIST draft | 28845742292 | ❌ | ❌ |
| 17 | WARRIORS OROCHI 3 Ultimate | `warriors-orochi-3-ultimate` | 4/4 | ✅ | UNLIST draft | 42484247105 | ❌ | ❌ |
| 18 | Empire of the Ants | `empire-of-the-ants` | 4/4 | ✅ | UNLIST draft ⚠️ inferred id | 46067475292 | ❌ | ❌ |
| 19 | DELTARUNE | `deltarune` | 4/4 | ✅ | UNLIST draft ⚠️ went LIVE once unattended | 47167470545 | ❌ | ❌ |
| 20 | Norland | `norland` | 4/4 | ✅ | UNLIST draft | 43384247116 | ❌ | ❌ |
| 21 | Into the Dead: Our Darkest Days | `into-the-dead-our-darkest-days` | 4/4 | ✅ | UNLIST draft | 47467470500 | ❌ | ❌ |
| 22 | TCG Card Shop Simulator | `tcg-card-shop-simulator` | 4/4 | ✅ | UNLIST draft | 43984247133 | ❌ | ❌ |
| 23 | Storyteller | `storyteller` | 4/4 | ✅ | UNLIST draft | 47567470574 | ❌ | ❌ |
| 24 | Thronefall | `thronefall` | 4/4 | ✅ | UNLIST draft | 55717441172 | ❌ | ❌ |
| 25 | Love Is All Around | `love-is-all-around` | 4/4 | ✅ | UNLIST draft ⚠️ inferred id | 47067475273 | ❌ | ❌ |
| 26 | Horizon Zero Dawn Remastered | `horizon-zero-dawn-remastered` | 4/4 | ✅ | **no listing** (Part 3) | — | ❌ | ❌ |
| 27 | Star Wars Outlaws | `star-wars-outlaws` | 4/4 | ✅ | **no listing** 🚫 do not list | — | ❌ | ❌ |
| 28 | Assassin's Creed Shadows | `assassins-creed-shadows` | 4/4 | ✅ | **no listing** 🚫 do not list | — | ❌ | ❌ |
| 29 | God of War Ragnarök | `god-of-war-ragnarok` | 4/4 | ✅ | **no listing** (Part 3) | — | ❌ | ❌ |
| 30 | Assassin's Creed Valhalla | `assassins-creed-valhalla` | 4/4 | ✅ | **no listing** 🚫 do not list | — | ❌ | ❌ |
| 31 | Cyberpunk 2077 | `cyberpunk-2077` | 4/4 | ✅ | **no listing** (Part 3) | — | ❌ | ❌ |
| 32 | METAL GEAR SOLID Δ | `metal-gear-solid-delta-snake-eater` | 4/4 | ✅ | **no listing** ⚠️ inferred id | — | ❌ | ❌ |
| 33 | Sekiro: Shadows Die Twice GOTY | `sekiro-shadows-die-twice` | 4/4 | ✅ | **no listing** (own cap) | — | ❌ | ❌ |
| 34 | Marvel's Spider-Man 2 | `marvels-spider-man-2` | 4/4 | ✅ | **no listing** (Part 4) | — | ✅ **orphan** | ❌ |
| 35 | Cities: Skylines II | `cities-skylines-2` | 4/4 | ✅ | **no listing** (Part 4) | — | ✅ **orphan** | ❌ |
| 36 | The Last of Us Part II Remastered | `the-last-of-us-part-2-remastered` | 4/4 | ✅ | **no listing** (Part 4) | — | ✅ **orphan** | ❌ |
| 37 | Palworld | `palworld` | 4/4 | ✅ | **no listing** ⚠️ CO-OP wording unresolved | — | ✅ **orphan** | ❌ |
| 38 | Red Dead Redemption 2 | `red-dead-redemption-2` | 4/4 | ✅ | **no listing** 🚫 do not list | — | ❌ | ❌ |

### Totals

- **Games with a complete asset set: 38 / 38.** (`FACT-V`)
- **Games with a live, purchasable listing: 10.** (`FACT-S`, `docs/listing-copy.md:119-128`)
- **Games with assets but no live listing: 28** — 15 as UNLIST drafts, 13 with nothing uploaded.
  Five of the 28 are marked 🚫 *do not list* on delivery grounds (three Ubisoft, RDR2, plus
  Palworld's unresolved co-op wording), so the genuinely shippable backlog is **~23 games of
  finished art earning nothing**.
- **Games with listings but stale assets: 0 uploaded.** Seven superseded single-image banners
  remain on disk — `dave-the-diver-banner.png`, `dokimon-quest-banner.png`,
  `escape-from-duckov-banner.png`, `escape-from-duckov-banner-v2.png`,
  `euro-truck-simulator-2-banner.png`, `how-to-fish-banner.png`, `schedule-1-banner.png` — all
  belonging to Part 1 live listings. `docs/shopee-listings.md:94-95` marks them "kept for
  reference, do not upload" (`FACT-S`). They are clutter, not a live-listing defect.
  **`UNSOURCED — MUST VERIFY`: whether the four images actually on each live Shopee listing match
  the current `brand/<slug>-banner-[1-4].png` bytes.** No image diff exists; `scratchpad/verifycopy.mjs`
  is described as diffing text only.
- **Orphaned site cards: 4.** `public/games/{marvels-spider-man-2,cities-skylines-2,palworld,the-last-of-us-part-2-remastered}.png`
  exist but have no `CATALOGUE` entry (`FACT-V`, `lib/catalogue.ts:45-56` lists exactly 10 entries).
  On `/games` these four would render the "Art pending — add this game to CATALOGUE" placeholder
  *despite the art being present on disk* (`FACT-S`, `app/games/page.tsx:60-77`). Moot today
  because `/games` is not deployed (see below).

---

## Copy integrity violations

The governing rule is `docs/shopee-listings.md:36-52` (`FACT-S`): *"🚫 Never claim co-op or any
online mode (Chaison, 2026-09-06)… **any co-op or multiplayer claim is a promise the product
structurally cannot keep**… no headline or body line anywhere may mention co-op, multiplayer, 'with
friends', or a shared server."*

**That rule is being violated in the file that declares itself the upload source of truth, on
listings that are live and taking money right now.** Stated plainly: GameShare is currently selling
at least two Shopee listings whose titles end in `CO-OP` for a product that can only be played in
Steam Offline Mode.

### A. Live listings carrying a banned CO-OP claim

These are labelled `**Title — currently applied**`, i.e. the text on the live Shopee listing.

| File:line | Applied (LIVE) title | Violation |
|---|---|---|
| `docs/listing-copy.md:202` | `Euro Truck Simulator 2 ETS2 \| Steam PC Game \| FULL GAME \| 24H AUTO DELIVERY \| ORIGINAL \| CO-OP` | `CO-OP` tail on a live listing |
| `docs/listing-copy.md:351` | `Schedule I \| Steam PC Game \| FULL GAME \| 24H AUTO DELIVERY \| ORIGINAL \| CO-OP` | `CO-OP` tail on a live listing |
| `docs/listing-copy.md:557` | `Tribes of Midgard \| Steam PC Game \| FULL GAME \| 24H AUTO DELIVERY \| ORIGINAL \| CO-OP` | `CO-OP` tail on a live listing |

Live **descriptions** carrying it too:

| File:line | Text | Violation |
|---|---|---|
| `docs/listing-copy.md:359` | `play solo or in online co-op with friends.` | "online co-op", "with friends" |
| `docs/listing-copy.md:565` | `giants, alone or online with friends.` | "online … with friends" |
| `docs/listing-copy.md:189-190` (ETS2 desc.) | `Drive solo, or convoy online with other players.` | online multiplayer claim |

Note the direct contradiction with the same repo's own remediation record:
`docs/shopee-listings.md:47-49` states the co-op badge was *"Applied 2026-09-06 across all six
banners that carried it (Schedule I, How to Fish, Tribes of Midgard, …)"*. **The banner art was
fixed; the titles and descriptions were not.** A buyer sees `OFFLINE PLAY` on the image and `CO-OP`
in the title of the same listing.

### B. The house rule itself instructs the violation

`docs/listing-copy.md:56-61` (`FACT-S`):

```
<Game> | Steam PC Game | FULL GAME | 24H AUTO DELIVERY | ORIGINAL | <OFFLINE or CO-OP>
…
The last slot is `CO-OP` when Steam lists online co-op for that game and `OFFLINE` otherwise
```

This is the *rule*, not a legacy artefact, and it is superseded by `docs/shopee-listings.md:36-45`.
Anyone following the upload source of truth will keep producing banned titles. It is the root cause
of every row in section A.

### C. Proposed/unshipped copy that would extend the violation

| File:line | Text |
|---|---|
| `docs/listing-copy.md:196` | Proposed ETS2 title ending `\| Online Co-Op` |
| `docs/listing-copy.md:345` | Proposed Schedule I title ending `\| Online Co-Op` |
| `docs/listing-copy.md:551` | Proposed Tribes of Midgard title ending `\| Co-Op` |
| `docs/listing-copy.md:809`, `:815` | Ghost of Tsushima (Part 2 draft) — both titles end `CO-OP` |
| `docs/listing-copy.md:913`, `:919`, `:927` | FANTASY LIFE i — both titles `CO-OP`, description *"play along with friends online"* |
| `docs/listing-copy.md:1131`, `:1137` | WARRIORS OROCHI 3 — both titles `CO-OP` |
| `docs/listing-copy.md:2366`, `:2376`, `:2652`, `:2660` | Palworld — `Co-Op` tail, *"online co-op"*, *"Play solo or online with friends"* |
| `docs/listing-copy.md:2420` | RDR2 — `Co-Op` tail (also 🚫 do-not-list) |

`docs/listing-copy.md:2161-2175` **acknowledges** the contradiction ("A buyer who bought on the
strength of `CO-OP` and is then told to play offline has a fair complaint") and explicitly leaves it
**"Not resolved here"**. It is scoped as a Palworld problem. It is not — it is already shipped on
three live listings.

### D. Superseded co-op copy still sitting in `docs/shopee-listings.md`

`docs/shopee-listings.md:51-52` says the blocks below it "predate this rule and still contain co-op
lines… must not be copied from." They are still there in full:

- `:363` Schedule I metadata `· Online Co-op` · `:366` title `| Online Co-op |` · `:367` title
  `— Crime Empire Sim, Co-op` · `:382` `• Online co-op — build the empire with friends`
- `:440` How to Fish `· 1–4 player Online Co-op` · `:443` title `| 1-4 Player Co-op |` · `:444`
  `— Physics Fishing Co-op` · `:451` `A 1–4 player physics fishing sim` · `:456`
  `• 1–4 player online co-op — built to be played with friends`
- `:338` ETS2 `· Multiplayer + Online Co-op`

A warning comment above dead copy is weaker than deleting it. This is the second-most-likely source
of a future violation after (B).

### E. Banned-claims and stale-premise violations

| File:line | Finding |
|---|---|
| `docs/shopee-listings.md:28`, `:30` | The "Live examples, longest to shortest" table still presents `LIFE TIME GUARANTEE` titles for Duckov and Dave as **live**. They are not — `CHECKPOINT.md:341-343` records both removed from the shop entirely on 2026-09-06 (`FACT-S`). The table is a stale snapshot presented as current state. |
| `docs/shopee-listings.md:475` | Claims table: *"`24H DELIVERY` … A promise, not a fact. **Fulfilment is manual admin linking today**"*. Contradicted **by line 10 of the same file** and by `CHECKPOINT.md:55` — auto-fulfilment went live 2026-09-05 (`FACT-S`). One file, two mutually exclusive statements about the shop's headline claim. |
| `docs/shopee-listings.md:476-477` | `FREE DLC` and `FULL ACCOUNT` still described as claims that "still ship" and need sign-off. `docs/listing-copy.md:68` bans `DLC+`/`FREE DLC` outright. Unreconciled. |
| `docs/shopee-listings.md:12` and `docs/listing-copy.md:67` | Both ban `LIFE TIME GUARANTEE` on the stated basis that *"`/terms` is a placeholder"*. **That premise is false.** `FACT-V`: `curl https://www.gameshare.space/terms` returns 200 with a substantive refund policy — 48-hour replacement, full refund if no replacement within 7 days (`app/terms/page.tsx:70-110`). The ban may still be correct, but its stated justification is stale and will be re-litigated by anyone who checks. |
| `docs/shopee-listings.md:415-417`, `:479-482` | Dokimon Quest described as **free on Steam** and "a business problem". `docs/listing-copy.md:390-392` corrects this (RM38.50, normal paid title). The stale version is still present in full and not struck through. |
| `docs/shopee-listings.md:109-111` | Flags that the `24 HOUR DELIVERY` ribbon on all 15 supplier drafts is *"the claim to check before any of these go live"* because fulfilment runs through a third party's portal. Still unresolved, and those drafts are one publish click from selling. |

### F. The most widespread violation: the username instruction

`FACT-V`: the production homepage form contains exactly one input, labelled **"Shopee Order ID"**.
There is no username field (fetched HTML of `https://www.gameshare.space/`, 2026-09-06). This
matches `CHECKPOINT.md:22-37`, which records the username check being dropped on 2026-09-06.

Yet the upload source of truth still instructs every buyer to supply one:

- **48 occurrences of "Steam username"** in `docs/listing-copy.md` (`FACT-V`, `grep -c`), including
  the description template at `:93-94` and its copy in every per-game block —
  `:167, :218, :267, :319, :367, :420, :472, …`
- **11 occurrences of "enter both"** (`FACT-V`, `grep -c`)
- `docs/shopee-listings.md:293`: `3. Visit gameshare.space, enter your Order ID + Steam username`
- The Part 1 template also promises *"a Steam Guard code that refreshes every 30 seconds"*
  (`docs/listing-copy.md:95`) — true of the TOTP accounts, **false of every supplier-sourced
  account**, whose code is a single emailed Guard code with a ~5–6 redemption cap
  (`CHECKPOINT.md:793-812`, `FACT-S`). Publishing any of the 15 drafts with that line ships a
  factual misstatement about the delivery mechanism.

**All 10 live listing descriptions tell a buyer to have a username ready for a page that no longer
asks for one.** This is the highest-volume copy defect in the repo and the cheapest to fix.

### G. Website copy violating the co-op ban

`lib/catalogue.ts:49` — `{ steamAppId: 4001890, slug: "how-to-fish", genre: "Co-op Physics", … }`
`lib/catalogue.ts:54` — `{ steamAppId: 858820, slug: "tribes-of-midgard", genre: "Co-op Survival", … }`

These genre strings render as visible text on the `/games` cards (`FACT-S`,
`app/games/page.tsx:82`). `docs/shopee-listings.md:48-49` records these exact two labels being
rewritten on the banners — *"Co-op Survival RPG" → "Norse Survival RPG", "Co-op Fishing Sim" →
"Physics Fishing Sim"* — but the website's own copy kept the banned word. Not currently visible to
the public only because the page is not deployed.

---

## Title and keyword state — applied vs proposed

**Counted mechanically (`FACT-V`, `grep -n` over `docs/listing-copy.md`):**

| Label | Count | Meaning |
|---|---|---|
| `**Title — currently applied**` | **25** | Text that is on Shopee now — 10 live listings + 15 UNLIST drafts |
| `**Proposed title**` | **25** | Rotation-pass titles written 2026-09-06, **none applied** |
| `**Title**` (single, no applied/proposed split) | **21** | Part 3 (8), Part 4 first block (5), Part 4 duplicate block (4), Part 5 (4) — nothing uploaded, so no drift to record |

So: **0 rotated titles are live. 25 are written and sitting unshipped.** Every Part 1 and Part 2
block carries the banner *"🔸 Proposed SEO title — NOT APPLIED. This listing is LIVE on Shopee;
changing it is Chaison's call"* (`FACT-S`, e.g. `docs/listing-copy.md:192, :341, :547`). This is
outstanding work already written — it needs a decision, not authoring.

`docs/listing-copy.md:16-21` states the intent (`FACT-S`): Part 1 and Part 2 keep the applied title
and gain a proposal; Parts 3 and 4 were written fresh. That is accurate to what the file contains.

### The six rotation patterns

Each proposed title is tagged `P1`–`P6`. Observed distribution across the 25 proposals
(`FACT-V`, from the `**Proposed title** (<chars>, <pattern>)` headers):

| Pattern | Example | Observed |
|---|---|---|
| P1 | `<Game> \| Steam PC Game \| FULL GAME \| 24H AUTO DELIVERY \| ORIGINAL \| OFFLINE` (the incumbent shape) | Duckov, FANTASY LIFE i, Into the Dead, Batman |
| P2 | `<Game> Steam Account \| Original PC Game \| Full Game \| 24 Hour Delivery \| …` | ETS2, Dokimon, DW Origins, Orochi 3, Thronefall |
| P3 | `Steam PC \| <Game> \| Full Game Original \| Shared Account \| …` | Dave, Lords of the Fallen, Resident Evil Requiem, TCG Card |
| P4 | Malay-led: `<Game> \| Akaun Steam \| Game PC Original \| Full Game \| Delivery 24 Jam \| …` | How to Fish, Tribes of Midgard, Empire of the Ants, DELTARUNE |
| P5 | Murah / value-led Malay variant | Stacklands, Norland, Love Is All Around |
| P6 | `Steam PC \| <Game> \| … \| Online Co-Op` / mixed | Schedule I, Ghost of Tsushima, Black Myth, Storyteller |

The Malay vocabulary in use is `Akaun Steam`, `Game PC Original`, `Delivery 24 Jam`, `Murah`
(`FACT-S`, `docs/listing-copy.md:10-12`).

### Three proposed titles are corrupt, and the file's own `FACT-V` is wrong

`docs/listing-copy.md:27-29` asserts: *"Every title was re-checked mechanically, not by eye —
character count re-derived from the text… 38/38 pass, re-run after every addition. `FACT-V`
2026-09-06."*

**That is false.** Three Part 2 proposals have a body consisting of a single backtick character and
a declared length of 1:

| File:line | Game | Header | Body |
|---|---|---|---|
| `docs/listing-copy.md:1441-1445` | Storyteller | `**Proposed title** (1, P6)` | `` ` `` |
| `docs/listing-copy.md:1493-1497` | Thronefall | `**Proposed title** (1, P2)` | `` ` `` |
| `docs/listing-copy.md:1546-1550` | Love Is All Around | `**Proposed title** (1, P5)` | `` ` `` |

A checker that re-derives character count from the text and passes a 1-character title has not
validated anything meaningful. Only 22 of the 25 proposals actually exist. Treat the "38/38 pass"
line as unverified until the checker is re-run and its output captured.

### Length compliance

`CHECKPOINT.md:212-213` and `docs/shopee-listings.md:16-22` set the target at **~80 characters**
(`FACT-S`). The applied Part 1 titles hit it: 77–94 chars, all ten under 100. **The proposed
rotation titles are systematically longer** — 84, 85, 88, 92, 97, 98, 102, 106, 107, 109 in Part 1;
91–116 in Part 2 (`FACT-V`, from the declared char counts). Part 3 titles run 90–114 and Part 4
100–113. Applying the rotation as written would move the shop *away* from the stated title
convention, toward the 117-character walls it was created to replace. That trade — length for
keyword coverage — is not argued anywhere in the file.

### Keyword research quality — the file is honest about this

`docs/listing-copy.md:31-38` (`FACT-S`) states that Shopee listing pages are barely indexed by
general web search, that live shopee.com.my evidence exists for only ~10 of the 38 titles (ETS2,
Stacklands, Horizon Zero Dawn, Thronefall, Sekiro, AC Valhalla, Metal Gear Delta, Resident Evil
Requiem, Black Myth: Wukong, Empire of the Ants), and that for Dokimon Quest, How to Fish, Escape
From Duckov, Norland and Into the Dead **no Shopee MY listing was found at all**. Its own verdict:
*"Treat the Malay phrasing as a hypothesis to A/B, not an established win."* That is the correct
posture — and the measurement gap below means **there is currently no way to run that A/B.**

### Structural defect: `docs/listing-copy.md` contains two different Part 4 sections

`FACT-V`, heading census: `# Part 4 — gamersfantasy.my single-game orders (NO SHOPEE DRAFT YET)` at
line **2116** (games numbered H1–H5) and `# Part 4 — gamersfantasy.my single-game orders (added
2026-09-06)` at line **2478** (games numbered P21–P24, no character counts). They cover overlapping
games with different copy. Part 5 (line 2689, P25–P28) then re-covers the four do-not-list titles
already documented as G2/G3/G5/H5. A 2,921-line document that is the declared byte-for-byte upload
source of truth has **two conflicting blocks for the same five games**. Anyone uploading from it
must first work out which Part 4 is authoritative; nothing in the file says.

---

## Website as a discovery surface

All claims in this section are `FACT-V` unless marked otherwise — fetched against
`https://www.gameshare.space` on 2026-09-06.

### Live status codes

```
curl -s -o /dev/null -w "%{http_code}" https://www.gameshare.space<path>
```

| Path | Status | Note |
|---|---|---|
| `/` | **200** | Lookup page |
| `/terms` | **200** | |
| `/tutorial` | **200** | 56 KB, the largest page on the site |
| `/games` | **307 → `/admin/login?next=%2Fgames`** | **Not public** |
| `/robots.txt` | **307 → `/admin/login?next=%2Frobots.txt`** | Does not exist |
| `/sitemap.xml` | **307 → `/admin/login?next=%2Fsitemap.xml`** | Does not exist |

### What is actually served in `<head>` on `/`

Full head, verbatim from the fetch: `<meta charSet>`, `<meta name="viewport">`, font preloads,
stylesheet, script tags, `<meta name="next-size-adjust">`,
`<title>GameShare — Get your login code</title>`,
`<meta name="description" content="Enter your Shopee Order ID and Steam username to get your login
details and a live Steam Guard code.">`, `<link rel="icon">`.

**That is everything.** Specifically absent from every page fetched:

| Element | State |
|---|---|
| `og:title` / `og:description` / `og:image` / `og:url` / `og:type` | **Absent** — a link pasted into WhatsApp or Shopee chat renders with no preview card |
| `twitter:card` and friends | **Absent** |
| `<link rel="canonical">` | **Absent** on all three public pages |
| `metadataBase` | **Absent** — `grep -rn "metadataBase\|alternates\|canonical\|openGraph" app/` returns nothing (`FACT-V`) |
| JSON-LD / `application/ld+json` | **Absent** — no `Product`, `Offer`, `Organization` or `FAQPage` markup anywhere |
| `robots` meta / `x-robots-tag` | **Absent** |
| `<html lang>` | Present, `lang="en"` — the shop's buyer base is described as substantially Malay-speaking (`docs/listing-copy.md:10-12`). No `hreflang`, no Malay content on the site at all |

### Metadata correctness

The served homepage description says *"Enter your Shopee Order ID **and Steam username**"*. The
served homepage form has **one** input, `Shopee Order ID`. **The live meta description describes a
form that no longer exists** (`FACT-V`, both facts from the same fetched document). Source:
`app/layout.tsx:19-21`.

`/terms` serves `<title>Terms &amp; Refund Policy — Steamshare</title>` (`FACT-V`). The brand is
**GameShare**; `Steamshare` is the old project codename. It is live, on a page linked from every
listing description (`docs/shopee-listings.md:305`, `gameshare.space/terms`). Source:
`app/terms/page.tsx:6` and `:18` (`<h1>Steamshare Policies</h1>`).

### Heading structure and alt text

Structure is technically sound: one `<h1>` per page, `<h2>` for sections. `/tutorial` has eight
`<h2>` sections including a FAQ (`FACT-S`, `app/tutorial/page.tsx:60-389`). `/games` sets
`alt={`${game.title} — key art`}` on every card image (`FACT-S`, `app/games/page.tsx:65`) — correct,
and irrelevant while the page is unreachable.

### Ranking assessment

**Nothing on this site is set up to rank for a game-name search.** There are no per-game pages —
`/games` is a single route rendering all games in one list; there is no `app/games/[slug]/`
directory (`FACT-V`, `find app -type f` returns exactly one file under `app/games/`). No game name
appears in any `<title>`, `<meta>`, or URL. There is no robots.txt or sitemap to guide a crawler,
and the only two indexable pages are a credential form and a policy page.

**The brief's framing is right: this may be the correct current state.** The site is a
credential-retrieval utility for people who already bought. But two things are wrong regardless of
strategy: `/robots.txt` and `/sitemap.xml` **307-redirect a crawler to an admin login page** rather
than returning a clean 404 or a real file, and the homepage meta description is factually wrong
about the site's own form. Both are cheap to fix and neither commits to a content strategy.

---

## Website as a conversion surface

**Nothing on the live site routes a visitor toward a Shopee listing. Not one link.** (`FACT-V`.)

Outbound links in the served homepage HTML: `/tutorial` (twice), `/terms`. Plus the plain text
*"Need help? Message us on Shopee chat"* — which is **not a link** and names no shop. No shop URL,
no listing URL, no catalogue, no prices.

`grep -rn "shopee.com.my\|shopeeUrl" app/ components/ lib/catalogue.ts` returns **three** hits, all
in the `/games` route and its helper (`FACT-V`):
- `lib/catalogue.ts:76-78` — `shopeeUrl(itemId)` builds `https://shopee.com.my/product/1597884613/<itemId>`
- `app/games/page.tsx:88` — the `Buy on Shopee` anchor

### The `/games` storefront is uncommitted local work

This is the finding that governs the whole section.

`FACT-V`, `git ls-files app/games/` returns **empty**; `git status --short` shows:

```
 M proxy.ts
?? app/games/
?? lib/catalogue.ts
```

`public/games/` is untracked too. The `proxy.ts` diff adding `"/games"` to `PUBLIC_PREFIXES` is
**uncommitted** (`FACT-V`, `git diff proxy.ts`). The deployed `proxy.ts` therefore has no `/games`
entry, which is exactly why production 307s the path to `/admin/login` — verified by the redirect
`Location` header, not inferred.

So: the only conversion mechanism in the codebase — a browsable catalogue with `Buy on Shopee`
buttons — **exists only on Chaison's disk.** `CHECKPOINT.md:352-354` describes
`lib/catalogue.ts` as "gates the public /games Buy button" in the present tense; there is no public
`/games` button. Correct that read before acting on it.

### What the conversion surface would be if deployed

Reading `app/games/page.tsx` (`FACT-S`): a server component reading `games` (id, title,
steam_app_id) ordered by title, joined to `CATALOGUE` by app id for slug/genre/`shopeeItemId`. Games
with a `shopeeItemId` get a `Buy on Shopee` anchor (`target="_blank" rel="noopener noreferrer"`);
games without get a non-clickable `Listing soon` chip. Header copy: *"{buyable} of {games.length}
titles are on the shop right now — the rest are stocked and listing soon."*

Even deployed, its ceiling is low: 10 of ~38 games would be buyable, four Part 4 games would render
"Art pending" despite art existing on disk, and two cards would carry banned co-op genre labels
(section G). It is also **not linked from anywhere** — `grep -rn 'href="/games' app/ components/`
returns nothing (`FACT-V`), so even after deploying, no visitor arriving at `/` would ever find it.

### The funnel as it exists today

```
Shopee search → Shopee listing → buyer pays → chat message with credentials
                                                  ↓
                                gameshare.space (order id → password + Guard code)
                                                  ↓
                                            /tutorial, /terms
                                                  ↓
                                              [dead end]
```

There is no path from the website back to the shop, no cross-sell from a delivered order to the
other 9 live listings, no repeat-purchase prompt. Every buyer who lands on the site has already
demonstrated willingness to pay and is shown nothing to buy. Given `docs/listing-copy.md`'s note
that **Shopee's effective take is 32–38% on a small order and basket size is a first-class lever**
(`CHECKPOINT.md:480-483`, `FACT-S`), the missing cross-sell on the delivery page is a direct
economic omission, not a cosmetic one.

---

## The measurement gap

**Short answer: Chaison cannot answer "which listing sold what, when, and after which change." Not
approximately — the data does not exist.**

### Analytics: none

`FACT-V`, `grep -rni "analytics|@vercel/analytics|speed-insights|gtag|plausible|posthog|umami|fbq|pixel"`
over `package.json`, `app/`, `components/`, `lib/`, `next.config.ts`, `vercel.json` returns **zero
real hits** (only the English word "plausible" in code comments).

`package.json` dependencies in full (`FACT-V`): `@supabase/supabase-js`, `next@16.2.7`, `pg`,
`react`, `react-dom`. **No `@vercel/analytics`, no `@vercel/speed-insights`, no third-party
tracker.**

`ASSUMPTION`: Vercel's dashboard-level request counts may still exist for the deployment (Vercel
collects some data without the package). Basis: standard Vercel behaviour, not verified here — the
`mcp__claude_ai_Vercel__get_web_analytics` tool was available but not invoked, and Web Analytics on
Hobby requires the `@vercel/analytics` package to emit pageviews at all. **`UNSOURCED — MUST
VERIFY`: whether Vercel Web Analytics is enabled on this project.**

### What the database can and cannot answer

`orders` as created in `supabase/migrations/0001_init.sql:41-49` (`FACT-S`):
`id, shopee_order_id, shopee_buyer_id, account_game_id, verified, created_at`.

Columns added since (`FACT-V`, grep over `supabase/migrations/`): `buyer_username`, `source`,
`delivered_at`, `delivery_error`, `delivery_attempts` (0008); `follow_up_*` (0009); `shipped_at`,
`ship_error`, `ship_attempts` (0010); `supplier_site`, `supplier_order_id` (0012).

**`grep -rni "price|amount|revenue|total_" supabase/migrations/` returns exactly one hit — the word
"revenue" inside a comment in `0010_orders_auto_ship.sql:18`.** (`FACT-V`.)

| Question | Answerable? |
|---|---|
| How many orders, and when? | ✅ `orders.created_at` |
| Which **game** did an order deliver? | ✅ indirectly, via `account_game_id → account_games → games` |
| Which **Shopee listing (item_id)** was bought? | ❌ **Not stored on `orders` at all.** No `shopee_item_id` column exists |
| What did the buyer pay? | ❌ No price column anywhere in the schema |
| Revenue by title, by week? | ❌ |
| Did title change X move conversion? | ❌ No impressions, no clicks, no listing-level anything |
| Did the Malay title A/B win? | ❌ |

Migration **0014** would add `shopee_item_id` and `shopee_model_id` — **to `order_games`, not to
`orders`** (`FACT-S`, `supabase/migrations/0014_order_games.sql:104-106`), and even then only for
webhook-created rows (null for manual/seeded ones). **0014 is written and NOT APPLIED**
(`FACT-S`, `CHECKPOINT.md:85`). So the one schema change that would make listing-level attribution
possible is blocked behind Chaison's sign-off, and it still records no price.

### Reporting scripts that exist

| Script | Answers | Limits |
|---|---|---|
| `scripts/reconcile-shopee-orders.mjs` | *"Which paid Shopee orders never became an `orders` row?"* — buyers who paid and got nothing | On-demand only, no schedule. **Hard-capped at a 14-day window** (`FACT-S`, `:8-10`) because Shopee's list API allows 15 days. Exit code 0 either way — *"this is a report, not a gate"* (`:26`). Nobody is alerted |
| `scripts/shopee-listings.mjs` | *"If a buyer purchases this listing right now, do they get their game automatically?"* — coverage of listing → game → active account | Delivery-readiness, not sales. Also `CHECKPOINT.md:221-224`: it decrypts the access token directly and **does not refresh it**, so it starts failing `invalid_acceess_token` mid-run after 4 hours |
| `/admin` Orders tab | Per-order state, redemptions spent vs cap, last outcome | Operational triage, not analysis. No aggregation, no export, no time series |

**Nothing in `scripts/` reports sales, revenue, or per-listing performance.** (`FACT-V`, full
directory listing reviewed.)

### The consequence

The rotation pass produced 25 titles explicitly framed as *"a hypothesis to A/B, not an established
win"* (`docs/listing-copy.md:38`). **There is no instrument capable of resolving that A/B.** If all
25 were applied tomorrow, the only observable would be the total order count in a table with no
price and no listing id. This is the gap that makes every other marketing decision in the repo
unfalsifiable.

---

## Top 5 gaps, ranked

### 1. Live listings claim CO-OP for an offline-only product — and the house rule tells writers to keep doing it

**File to change: `docs/listing-copy.md:56-61`** (the `<OFFLINE or CO-OP>` house rule), then the
applied titles at `:202`, `:351`, `:557` and descriptions at `:189`, `:359`, `:565`.

Ranked first because it is the only gap that is simultaneously live, revenue-touching, and a
"not as described" dispute waiting to be filed. `docs/shopee-listings.md:36-45` calls a co-op claim
*"a promise the product structurally cannot keep."* Three live listings make it in their titles. The
banners were fixed on 2026-09-06 and the text was not, so the same listing shows `OFFLINE PLAY` on
the image and `CO-OP` in the title. Fixing the applied titles without deleting the house rule fixes
nothing — the rule will regenerate them. Secondary: `lib/catalogue.ts:49,:54` carry the same banned
word into website copy.

### 2. The `/games` storefront — the site's only conversion path — is uncommitted and unreachable

**File to change: `proxy.ts`** (commit the `+"/games"` line), plus `git add app/games/`,
`lib/catalogue.ts`, `public/games/`; then add a link to `/games` from `app/page.tsx`.

`FACT-V`: production 307s `/games` to `/admin/login`. Every `Buy on Shopee` link in the codebase
lives in that unreachable route. The finished art for 38 games, the catalogue, and the buy buttons
are all done — and none of it is deployed. `CHECKPOINT.md:352` describes the button as though it
were public; correct that before planning around it. This is the highest ratio of value-unlocked to
work-required in the whole audit: the work is already written.

### 3. Every live listing description instructs buyers to enter a username the site no longer asks for

**File to change: `docs/listing-copy.md:93-95`** (the description template), which propagates to 48
`Steam username` occurrences and 11 `enter both` occurrences across all 25 blocks; plus
`docs/shopee-listings.md:293`.

48 instances of a factually wrong instruction, on 10 listings taking money now and 15 drafts one
click from doing so. Same template also promises *"a Steam Guard code that refreshes every 30
seconds"* — false for all 15 supplier-sourced drafts, whose codes are emailed and capped at ~5–6
redemptions. Mechanical to fix, and it is a live buyer-confusion source today.

### 4. No measurement of any kind — no analytics package, no price column, no listing id on orders

**Files to change: `package.json`** (add `@vercel/analytics`), **`supabase/migrations/`** (a new
migration adding `shopee_item_id` and an order amount to `orders`), and **`app/layout.tsx`** (mount
the `<Analytics />` component).

Zero trackers, zero pageview data, and an `orders` table whose only money-adjacent word is inside a
comment. 25 SEO titles are written and explicitly labelled a hypothesis to A/B; there is no
instrument that could ever score them. Every marketing decision after this audit is a guess until
this changes. Note migration 0014 adds `shopee_item_id` to `order_games` but is **not applied** and
still records no price.

### 5. `docs/shopee-listings.md` contradicts itself and the co-op ban, and `docs/listing-copy.md` has two Part 4 sections

**Files to change: `docs/shopee-listings.md`** (delete the superseded per-game blocks at `:311-460`
and the stale claims table at `:464-482` rather than annotating them) and **`docs/listing-copy.md`**
(reconcile the duplicate Part 4 at lines 2116 and 2478).

`docs/shopee-listings.md:475` says fulfilment is manual on a day when `:10` of the same file says it
is automatic. `:28-30` presents `LIFE TIME GUARANTEE` titles as live months after their removal.
Superseded co-op copy sits in full below a comment saying not to copy it. Both files' ban on
`LIFE TIME GUARANTEE` rests on *"`/terms` is a placeholder"* — `FACT-V`, `/terms` is a live,
substantive refund policy. And the byte-for-byte upload source of truth contains two conflicting
Part 4 sections for the same five games, plus three proposed titles corrupted to a single backtick
under a `FACT-V` claim that all 38 passed a mechanical check. Ranked fifth only because it is
latent — it is the mechanism by which gaps 1 and 3 will keep coming back.

---

## Appendix — things checked that are NOT gaps

- **Asset completeness.** 38/38 complete sets. No action needed. (`FACT-V`)
- **Slug consistency.** `brand/` slugs match `scripts/games-data.mjs` `GAMES` exactly, 38 for 38. (`FACT-V`)
- **Heading structure and image alt text.** One `<h1>` per page, semantic `<h2>` sections, descriptive alts on `/games`. (`FACT-S`)
- **`docs/shopee-listings.md`'s asset-count claim** ("38 games: 152 banners + 38 cards", `:190`) — independently confirmed against the filesystem. (`FACT-V`)
- **`/terms` and `/tutorial` are live and serving.** 200 each; `/tutorial` is a substantial 56 KB guide. (`FACT-V`)
- **The `CATALOGUE`-is-hand-maintained decision** (`lib/catalogue.ts:9-25`) is correct and well-reasoned — a `shopee_listings` row is written before publish, so deriving "buyable" from it would put Buy buttons on drafts. Do not "improve" this.

## Appendix — open verification items

- `UNSOURCED — MUST VERIFY`: whether the four banner images on each of the 10 live Shopee listings are byte-identical to the current `brand/<slug>-banner-[1-4].png`. No image-diff tool exists in the repo.
- `UNSOURCED — MUST VERIFY`: whether Vercel Web Analytics is enabled for this project (it emits nothing without the npm package, which is absent).
- `UNSOURCED — MUST VERIFY`: the live Shopee titles themselves. Everything in this audit about "what is applied" is `FACT-S` from `docs/listing-copy.md`. `scratchpad/verifycopy.mjs` is described as the tool that diffs live listings against that file; it was not run here (it needs live Shopee credentials).
- `UNSOURCED — MUST VERIFY`: which of the two Part 4 sections in `docs/listing-copy.md` is authoritative.
