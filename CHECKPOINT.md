# CHECKPOINT — current state

**Last updated:** 2026-11-18 · session `workflow-streamline-docs` (T7 side session) · branch `claude/workflow-streamline-docs-a717b8`

> **Read order:** `AGENTS.md` → `TEAM.md` (§0 is the session loop) → **this file** → `LESSONS.md`
> (the rules for the area you are touching) → the `docs/*.md` runbook for the task.
>
> **Rules for this file** (the `/ss-handoff` skill enforces them at the end of every task):
> 1. **Under 250 lines. Current state only.** History is `git log`. Deep detail lives in `docs/`.
>    Mistakes go to `LESSONS.md`. The pre-2026-11-18 version is frozen at
>    `docs/archive/checkpoint-2026-09.md`; code comments cite its sections by name.
> 2. **Update it in the same commit that makes something true**, never in a later cleanup pass.
> 3. **Every "live / working / fixed" claim carries a tag:** `FACT-V <date>` (ran it),
>    `FACT-C <date>` (Chaison saw it), or `(as of <date>, not re-verified)`.
> 4. **§2 is the work queue.** A task that is not in §2 is not being tracked. Each row has one
>    concrete next step that a cold session could start on without asking.

---

## 0. Pickup in 60 seconds

- **The product:** buyers paste a Shopee order id at `www.gameshare.space`, then get Steam
  credentials plus a live Guard code. Shopee orders fulfil, message and ship themselves.
- **Before you trust anything below:** verify live by hand: `/ss-verify-live` is **not built yet** (T23). Do `GET /api/health` → 200, then one real lookup on a TOTP test order sent with `x-api-secret`. **Never a supplier code** (LESSONS S1). The `code` phase writes to production (LESSONS D12).
  Most of §1 was last verified 2026-09-07. The 2026-10-30 commits are deployed (FACT-V 2026-11-18), but their behaviour is only partly verified (T7).
- **What to do next:** the first unblocked row of §2.
- **Where the traps are:** `LESSONS.md`. Read the section for your area *before* you start.

## 1. System snapshot — what is live

| Piece | State |
|---|---|
| Buyer lookup | `POST /api/lookup {orderId, phase}`. Order id only, with no username check (Chaison 2026-09-06), so **an order id is a credential**. Two phases: `credentials`, then `code`. (FACT-V 2026-09-07) |
| Shopee auto-fulfilment | Push webhook → order detail → `shopee_listings` map → waterfall allocation (fill one account to its cap, then the next; the cap is wrong, see T20) → `orders` + `order_games` → chat message → `ship_order`. Kill switch `SHOPEE_AUTO_FULFILL`. (FACT-V 2026-09-05; auto-ship FACT-V 2026-09-06) |
| Multi-game orders | Live: one `orders` row with N `order_games` rows. Migration 0014 applied. (FACT-V 2026-09-07). Wrong-account delivery on multi-game orders fixed in `eb41a2c`: deployed (FACT-V 2026-11-18), behaviour not re-verified (T7) |
| Delivery to buyers who never chatted | `64d1666` (2026-09-08, not re-verified) |
| Shopee chat auto-reply | A GitHub Actions sweep (`b727aca`) runs and returns 200, with `aiMode: "send"`, so AI replies are on (FACT-V 2026-11-18: 79 successful runs since 2026-10-30). **No reply has ever been observed being sent**: every one of those runs reports `scanned: 47, awaitingReply: 0, sent: 0` (T30). The cron is set to `*/15` but actually fires about every 4h, so **never promise a response time from the cron line**. AI replies went live unreviewed (memory note, 2026-10-30) |
| Follow-up "please rate" message | Code live, cron `0 4 * * *` UTC. **First real send never observed.** Suspected dead since 0014: it filters on `orders.delivered_at`, which nothing sets any more (`docs/shopee-first-chat-delivery.md:80`). See T16. `eb41a2c` adds a receipt nudge that also asks for stars, so **never run both**: `SHOPEE_FOLLOW_UP=false` plus a redeploy |
| Code sources | `totp` (our own seed, offline, unlimited) is primary. `supplier` (cyberspace.cyou, gamersfantasy.my) is a **bridge**: about 5–6 redemptions per supplier order id, then `305 REACHED LIMIT`. Switch: `SUPPLIER_CODE_SOURCE=true` (FACT-V 2026-09-06) |
| Public `/games` library | Live with Buy links for 37 listings (`f62fcb1`). FACT-V 2026-11-18: the page returns 200 with 37 unique Shopee links. The Buy button is gated by the hand-maintained `lib/catalogue.ts` |
| Database | Supabase project `vwefthulbxqarttytvpl`. Migrations 0001–0016 on disk. 0001–0014 confirmed applied; **0015, 0016: applied state not recorded here**, so check before relying on them |
| Deploy | Production runs `ab72d8a`, deployed 2026-10-30 (FACT-V 2026-11-18, from GitHub's deployment record; the Vercel MCP sees no projects under this scope). Every push to `master` auto-deploys. **The repo is PUBLIC** (Vercel Hobby). Env changes need a **redeploy** (LESSONS D2) |
| Shop | About 33+ live listings, all stock 99999 (settled rule), with 3-month installment. Prices may be set by Shopee's Bid Programme (memory note) |

## 2. Active tasks — the work queue

Keep each row's state current. `Owner`: **A** = an agent can do it end to end, **C** = it needs
Chaison (a console or a decision), **A→C** = an agent prepares it and Chaison applies it.

| # | Task | Owner | State | Next concrete step |
|---|---|---|---|---|
| T1 | **Open item 0: test-order ids and real order numbers were published in a public repo** | A→C | **Agent half DONE 2026-11-18** (FACT-V: `node scripts/check-public-ids.mjs` reports 0 hits across every tracked doc, code file, test and migration; the SOP requires random ids kept in the vault). **They are still in public history**: `origin/master` (`ab72d8a`) CHECKPOINT.md holds 33. **Chaison half OPEN** | Chaison: rotate the fleet passwords (the only step that revokes what was already scraped). Agent→Chaison (**most urgent action**, per the grill): set `verified=false` on every test order and finished real order whose id appears in `origin/master` history, then re-seed test orders under random ids. This is a production write, so Chaison signs off first |
| T20 | **Allocation cap counts lifetime buyers, not active ones.** Every account eventually passes the 5-buyer cap and allocation quietly falls back (grill R9, 7/10) | A | OPEN (the defender found it and the grill confirmed it in `lib/fulfillment.ts:612-642`, 2026-11-18) | Define "active buyer" (for example delivered within N days and not refunded), count only those, add a test, then ship through `/ss-preflight` |
| T21 | **One `API_SECRET` does everything**: it passes the admin gate (reveal included), bypasses the limiter with no trail, and is copied to Actions (grill R12) | A→C | OPEN | Ship with T2. Actions uses `Bearer CRON_SECRET` (the route already accepts it); list and reveal require the cookie session; exempt lookups still log; compare with `timingSafeEqual`; then Chaison rotates the secret. **Also switch the manual verify step in §0 off `x-api-secret`** onto the narrower credential (grill follow-up) |
| T22 | **C10′ was false**: agents hold production write access (service-role and encryption keys, Vercel and Supabase CLI/MCP, push→auto-deploy), and both settings files have no allow/ask/deny rules (grill R3) | C | OPEN. TEAM.md C10′ was corrected 2026-11-18 | Chaison decides on `permissions.ask` rules for production-writing tools, and on whether write scripts default to dry-run. Permission config is his call, not an agent's |
| T23 | **`/ss-preflight` and `/ss-verify-live` are cited as mandatory but were never built** (grill R6) | A | OPEN | Build both as `.claude/skills/ss-*`, scripting what can be scripted. `/ss-verify-live` must stay read-only by default (D12) and read the latest chat-sweep summary (A3). Until then, docs say "verify live by hand (§0)" |
| T24 | The lookup limiter (20 per order per 15 min) is looser than the supplier redemption cap (5–6) (grill R10) | A | OPEN | Add a per-order cap on supplier-code fetches below the redemption cap, with a test |
| T25 | AI chat sends order ids to the model (`lib/chat-ai.ts:199-200` says they "carry no risk", stale since `314ee89`), and `[Auto Delivery]` messages are not excluded structurally (defender R7) | A | OPEN | Redact order ids before the model call, exclude delivery messages by type, log usage, add tests |
| T26 | A kill switch needs a redeploy to take effect (R8) | A | OPEN | Add a DB-row switch AND'd with the env var, switchable to off only from admin (after T2) |
| T27 | No written Shopee ruling on whether the category is allowed, and no costed second channel (R11) | C | OPEN | Chaison asks Shopee MY Seller Support for a written ruling, describing the listing plainly |
| T28 | Candidate register (tracked JSON of every past fit verdict: GTA V/VI, RDR2, Ubisoft titles…) plus a wrapper that runs `scripts/pre-purchase-check.mjs` over a list | A | OPEN (proposed by gta-research) | Build it read-only. It would have answered the GTA question without research |
| T29 | Weekly trending-game watcher: Steam top sellers and most played, plus `appdetails?cc=my` → a dated candidates file → T28 gate. Buying and listing stay Chaison's | A | OPEN (proposed by gta-research) | Copy the scheduled-Action pattern. Public read-only endpoints only (SteamDB returns 403) |
| T32 | **The session-start brief is built but NOT LIVE.** Sessions load project settings from the *main checkout* (on master, at a stale `b727aca`), which has no `.claude/settings.json`, so the hook never runs. Live re-tests 2026-11-18: NOT PRESENT twice | C | OPEN (FACT-V 2026-11-18: re-test session `local_ae7f408a` answered NOT PRESENT, with no failure message either, so the hook never ran) | Either (a) merge PR #2, then `git pull` master in the main checkout; or (b) add the same SessionStart hook to the main checkout's `.claude/settings.local.json`, from a non-worktree session (worktree sessions are blocked from editing it). Then run the one-question re-test |
| T19 | Repo is public only because of Vercel Hobby, and Hobby does not allow commercial use (grill R2, conceded by the defender) | C | OPEN | Chaison: move to Vercel Pro, or another host that allows private-repo deploys, then make the repo private |
| T2 | Open item 0b: admin panel is one unthrottled password away from the fleet | A→C | OPEN (as of 2026-09-06) | Agent: rate-limit `/api/auth/login` using `lib/rate-limit.ts` and expire sessions. Chaison: set a real `DASHBOARD_PASSWORD` in Vercel, then redeploy |
| T3 | Delete `lib/order-games-compat.ts` plus its 4 `PRE-0014 FALLBACK` imports | A | OPEN (FACT-V 2026-11-18: file and imports still present) | Remove, typecheck, run tests, deploy, verify live by hand (§0). It now *hides* a real missing-table incident |
| T4 | Alert on silently failed orders (`no_mapping` / `no_capacity`) | A | PARTIAL: `scripts/reconcile-shopee-orders.mjs` exists, but nothing runs it on a schedule | Add a cron route or a scheduled task that runs it and alerts on a miss |
| T5 | Wire `banned_item_push` (6) and `violation_item_push` (16) | A | OPEN | Handle both in `app/api/webhooks/shopee/route.ts` and alert, so a silent takedown is the top unwatched failure no longer |
| T6 | Refresh `DB_PASSWORD` so `scripts/run-migrations.mjs` works | C | OPEN since 2026-09-05 | Supabase → Settings → Database → reset, then update `.env.local`. Until then every migration is a manual SQL-editor paste |
| T7 | Verify the 2026-10-30 commits on production | A→C | **PARTIAL 2026-11-18**, read-only only. FACT-V: health 200 (DB reachable); prod = `ab72d8a`, which contains every 10-30 commit; `/games` shows 37 Buy links; chat sweep is healthy but has sent 0 replies (T30). **Not verified:** a multi-game lookup or Guard-code rotation, because every lookup is a production write (D12) | Chaison picks one: (a) OK a `credentials`-phase lookup with `x-api-secret` on a multi-game TOTP test order from the vault (no rows written); or (b) an agent runs a read-only SQL `select` checking that each `order_games` row created since 2026-10-30 went to an account that owns that game |
| T30 | **Chat sweep looks blind**: all 79 successful runs since 2026-10-30 report exactly `scanned: 47, awaitingReply: 0, sent: 0` | A→C | SUSPECTED BUG (FACT-V 2026-11-18 from the public run logs, cause not read) | Agent: read how `lib/chat-sweep.ts` lists conversations (page size, filters, cursor). Chaison: did any buyer message arrive in Seller Centre after 2026-10-30 and go unanswered? |
| T31 | Chat-sweep workflow prints the full `response.json` into **public** Actions logs. Any run that finds something prints buyer names, conversation ids, and (for stale entries) buyer id plus message text, which can hold an order id (X1) | A | OPEN. 0 of the 79 retained successful logs leak today (FACT-V 2026-11-18), but only because every run found nothing | Print counts only (`ok, scanned, awaitingReply, sent`, plus array lengths) in `.github/workflows/chat-sweep.yml`. Fix this before T30 makes the sweep see conversations |
| T8 | Confirm migrations 0015 and 0016 are applied | A→C | UNKNOWN | Read-only PostgREST probe for the new columns. If missing, Chaison pastes the SQL |
| T9 | DELTARUNE and Ghost of Tsushima: supplier order exhausted | C | BLOCKED on a reset from cyberspace.cyou | After the reset: e2e test, then publish |
| T10 | `FREE DLC INCLUDED` banner claim on 4 live listings | C | OPEN (ss-market 1b) | Per-account DLC check first, then Chaison decides |
| T11 | Refund handling (soft-delete + flag for password rotation) | A | NOT STARTED | Design: archive "Roadmap C" |
| T12 | Order reassignment for overloaded accounts | A | NOT STARTED | Design: archive "Roadmap D" |
| T13 | Sales-channel brainstorm | C | PAUSED at Q5 | Notes are uncommitted in the `product-hosting` worktree |
| T14 | GTA 5/6 shared-account fit plus a trending-game sourcing pipeline | A | **DONE 2026-11-18. GTA V: DOES NOT FIT** (Rockstar linkage like RDR2, plus Steam's own one-PC-at-a-time sign-in rule). **GTA VI: DOES NOT FIT** (console-only, launches 2026-11-19; console sharing gives about 1 buyer per account and means handing over the PSN or Microsoft login). Full report is local only in the `angry-liskov-598221` worktree's `research/` (gitignored: it holds competitor prices) | Chaison decides. The pipeline's build-first items are T28 and T29 |
| T16 | Follow-up sweep filters on `orders.delivered_at`, which is unset since 0014 | A | SUSPECTED BUG (from doc, not run) | Read `lib/follow-up.ts`. If confirmed, filter on `order_games` delivery, add a test, and decide which of follow-up and receipt nudge stays on |
| T17 | Commit the scratchpad safety tools (`e2e.mjs` publish check, `refix.mjs` draft-status check, `refresh.mjs` token refresh) | A | OPEN: they were never in the repo, so 3 gates cannot run (ss-market SKILL.md:98) | Rebuild them as `scripts/*.mjs` with secrets read from env |
| T15 | Grill/defender debate on project decisions | A | **DONE 2026-11-18**: 12 rounds, average 6.5/10. DEFENDED: R1 lookup 8, R7 AI chat 9. Core conceded: R2 (T19), R3 (T22), R6 (T23), R12 (T21). Earlier: scored so far: R1 order-id-only lookup 8/10 DEFENDED; R2 public repo on Hobby 5/10, now T19; R9 waterfall allocation 7/10, now T20. R4 (archive re-published ids) fixed by T1 | The output is in `research/grill/`, which is **gitignored, local only** (LESSONS A15). All the change-worthy rounds are now T19–T24 |

**Parked decisions (Chaison's, not tasks):** pricing level (RM0.99–1.99 now, against RM7–9 in the
research); the own storefront and payment processor (deferred until Shopee is stable, and Stripe is
very likely to refuse us); Family lockdown open questions (archive "Family lockdown"); RDR2 and the
3 Ubisoft titles must not be listed.

## 3. Open risks (ranked)

1. **Repo is public plus order id = credential** (T1). Treat fleet passwords as compromised until rotated.
2. **Admin gate** (T2). Placeholder password, no login throttle, and reveal returns plaintext.
3. **Silent order failure** (T4) and **silent Shopee takedown** (T5). Neither raises an alert.
4. **Supplier redemptions are finite.** Never fetch a supplier code to "just check" (LESSONS S1).
5. **Product category is likely prohibited on Shopee MY.** Accepted risk, but a frozen shop moots everything (archive open item 4c).
6. **Weak, patterned fleet passwords** let one buyer guess a sibling account. Rotate to random strings.

## 4. Kill switches and env (all in Vercel **production**; every change needs a REDEPLOY)

| Var | Effect |
|---|---|
| `SHOPEE_AUTO_FULFILL` | Delivery pipeline. Fastest hard stop: Shopee Console → App List → Unlink |
| `SHOPEE_AUTO_SHIP` | `ship_order` after delivery (separate from fulfilment on purpose) |
| `SHOPEE_FOLLOW_UP` + `CRON_SECRET` | Nightly rate-us message |
| `SUPPLIER_CODE_SOURCE` | Supplier-sourced codes. Off means supplier accounts cannot serve |
| `SHOPEE_PUSH_PARTNER_KEY` | **Not** the API key. Signs inbound pushes |

Turning one off: `vercel env rm X production --yes` → `printf false | vercel env add X production`
→ `vercel redeploy <prod url> --scope imchaison-s-projects`. Full procedure: archive "Turning auto-fulfilment OFF".

## 5. Where things live

| Need | Go to |
|---|---|
| Listing ↔ game mapping | `shopee_listings` table (map every new listing by hand: LESSONS P1). `scripts/shopee-listings.mjs` reads status |
| Listing copy (source of truth) | `docs/listing-copy.md` · claim rules: `.claude/skills/ss-market/SKILL.md` |
| What the suppliers hold | the supplier md under `local/websites/` (gitignored, main checkout only) |
| Fulfilment ops / messages | `docs/order-fulfillment-sop.md`, `docs/shopee-first-chat-delivery.md`, `docs/chat-response-playbook.md` |
| Onboarding | `docs/steam-account-onboarding-runbook.md`, `docs/new-website-onboarding-runbook.md` |
| Specs and plans | `docs/superpowers/specs/`, `docs/superpowers/plans/` |
| Research | `research/` (dated). Read before re-researching anything |
| Credentials | **Never in this repo.** Local vault `Desktop\SteamShare\vault\`, `.env.local` |

## 6. Session handoff log (newest first; keep the last 5, older ones live in `git log`)

- **2026-11-18 · workflow-streamline-docs (task 5):** the live re-test said the brief was NOT PRESENT
  again, with no failure line, so the hook never ran. Root cause: sessions load project settings
  from the main checkout (stale master, no `settings.json`), not from this branch. Queued as T32,
  and the A17 lesson is amended. All four side sessions are done and recorded (grill, defender,
  GTA, T7 pickup). **Next:** apply T32 (b) from a main-checkout session, re-test, then T31 → T30
  and T1.

- **2026-11-18 · T7 side session (cold-start test, run through `/ss-handoff`):** the brief was NOT
  PRESENT at start (matches A17; started before the hook fix). T7 is PARTIAL, read-only: health 200,
  prod = `ab72d8a`, `/games` 37 links, sweep 200 with 0 replies ever sent. Found T30 (sweep looks
  blind) and T31 (public logs would leak buyer data). No lookup run, because lookups write to
  production (D12). No production writes; no supplier call. Lessons D12, A3 repeated. **Next:** T31
  before T30, then Chaison's pick on T7; T1 is still the most urgent.

- **2026-11-18 · workflow-streamline-docs (task 4):** the live pickup test found the session brief
  **NOT PRESENT**. Cause: in a worktree session `$CLAUDE_PROJECT_DIR` is the main checkout, and
  `|| true` hid the failure. Fixed: the script resolves its own repo, the hook falls back to `$PWD`,
  and a failure is now loud. Simulated in 3 cases, **not yet re-tested live**. The grill finished
  (6.5/10): T21–T24 queued, the C10′ wording fixed, and pointers to unbuilt skills corrected.
  Lessons A17, A18. **Next:** a new session confirms the brief loads, then T1 (urgent) and T21+T2.

- **2026-11-18 · workflow-streamline-docs (tasks 2–3, run through `/ss-handoff`):** T1 agent half
  and T18 done. The SOP, archive, code comments, tests and migrations are free of order and test ids,
  and `scripts/check-public-ids.mjs` now blocks on every tracked file. `--range` checks each commit
  before a push. The grill caught that an earlier local commit still held the unredacted archive, so
  the branch was squashed before any push. Tests: 294/294 passed. Typecheck not run (no
  `node_modules` in the worktree). Lessons X1 (repeated), X4, A15, A16. **Not done:** password
  rotation (Chaison), T19 hosting decision. **Next:** T7, then T3.

- **2026-11-18 · workflow-streamline-docs:** archived the 1,640-line CHECKPOINT to `docs/archive/`,
  wrote this lean version, added `LESSONS.md`, TEAM.md §0 session loop and the `/ss-handoff` skill.
  Started the `grill-roaster`/`grill-defender` debate and `gta-research`. **Next:** T7 (verify the
  2026-10-30 work), then T1/T3.
