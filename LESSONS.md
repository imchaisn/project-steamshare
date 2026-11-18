# LESSONS — mistakes we already paid for

**Purpose:** every mistake this project has made once, written as a rule so no session makes it twice.
`CHECKPOINT.md` says *where we are*. This file says *what not to do*. It is append-only and does not
expire: delete a lesson only when the code or system it describes no longer exists.

**Read it like this:** read §0 every session. Before touching an area, read that area's section. Each
lesson carries an ID; cite it in commits, briefs and reviews ("respects D2, S1").

## How to add a lesson (part of `/ss-handoff`, mandatory)

When anything goes wrong (a wrong claim, a revert, a broken deploy, a buyer-visible error, a
correction from Chaison, a wasted hour), add **one line in the same commit as the fix**:

```
- **<ID>** <Rule, as an imperative.> — <what happened, one clause>. [<commit | path:line | date>]
```

Use the next free number in the right section. If the rule can be enforced by a script, test or
hook, say so in the line and file a task in CHECKPOINT §2. **A lesson enforced by a tool beats one
enforced by memory.** If the mistake repeats an existing lesson, do not add a duplicate. Append
`· repeated <date>` to it and promote it to §0.

---

## §0 The rules that cost the most (read every session)

1. **"It deploys" is not "it serves buyers."** Only `/api/health` → 200 *plus* one real end-to-end lookup counts. An outage once ran undetected behind 200s. (D7)
2. **Env var changes do nothing until you redeploy.** Vercel bakes env into the deployment. (D2)
3. **Supplier redemptions are finite (about 5–6 per order id).** Never fetch a supplier code to test, check or poll. Dev testing burned a saleable order. (S1)
4. **Every new or relisted Shopee listing must be mapped by hand in `shopee_listings`.** An unmapped one takes money and delivers nothing, silently. (P1)
5. **This repo is public, and an order id alone is a credential.** No real credential, order id, username + order pair, or derivable test-id convention goes in any tracked file. Run `node scripts/check-public-ids.mjs` before every commit, and with `--range` before every push. (X1, X4, X5)
6. **FACT-S never outranks FACT-V.** Docs and earlier sessions have been wrong ("unlimited redemptions", Shopee's own examples). Re-derive counts and claims; never inherit them. (A4)
7. **After any bulk write across listings, re-read `item_status` for every draft.** An UNLIST draft once went live silently. (P5)
8. **Build from a clean checkout before pushing.** An uncommitted component froze production on an old deploy. (D1)
9. **Subagents may write repo files despite their brief.** Diff the target after every fan-out. (A1)
10. **Deploy code before you seed data that depends on it, and keep new columns out of the money path** until the manual migration is confirmed. (D4, M6)

---

## D — Deploy, build, runtime

- **D1** Build from a clean checkout of what you push. — `AmbientField` was imported by `app/layout.tsx` but never committed, so every push failed and prod froze. [805f2b8, 6813ca6]
- **D2** Every env var change needs a redeploy, then a probe that proves the running deploy sees the new value. — kill switches looked off in the dashboard while still live. [77c8163, docs/order-fulfillment-sop.md:40]
- **D3** After seeding, prove the decrypted password round-trips. — env was never set on Vercel, and there was a seed/`.env.local` key mismatch. [58e5824]
- **D4** Deploy code before seeding data that depends on it. — 20 supplier accounts seeded under pre-0011 code caused an outage. [247c1f7]
- **D5** Set `SUPPLIER_CODE_SOURCE` and redeploy *before* publishing a supplier listing. — otherwise a supplier account returns 503. [cc6e0dd]
- **D6** Measure live latency before setting a timeout, and keep `maxDuration` above it. — a 5s timeout failed every real supplier lookup (the call takes about 5.5s), and fixtures could never catch it. [26b5132]
- **D7** Verify with `/api/health` plus one real lookup after any deploy, migration, or Supabase pause/unpause. — a paused DB made every lookup 404 while the site returned 200s. [TEAM.md:35, d74d2ec]
- **D8** Use the `www.gameshare.space` host everywhere. — the apex 308-redirects, and Shopee does not follow redirects on push. [7fc1a79]
- **D9** Never run the receipt nudge and the 24h follow-up together, because both ask for stars. — [eb41a2c, sop:25]
- **D10** A new public page must be added to `proxy.ts` public paths, with `revalidate` set. — `/games` redirected to admin login and was prerendered only once. [f62fcb1]
- **D11** Never promise a response time from a cron line. — the `*/15` chat sweep fires about every 4h, a missing GitHub secret failed 272 runs, and Hobby crons run daily. [memory chat-sweep]

## M — Database and migrations

- **M1** Use the Session Pooler. The direct DB host is IPv6-only. [802cbc1]
- **M2** Check the Supabase project ref (`vwefthulbxqarttytvpl`) before pasting SQL. — a near-miss almost built the schema in another project. [7fc1a79]
- **M3** Wrap CHECK tests in `coalesce(…)` and require `length(btrim(x))>0`. — NULL passes a CHECK (three-valued logic), and whitespace passed too. [9596a3b]
- **M4** Constraint probes run inside `begin … rollback` and pass every column explicitly. — a probe left rows in prod and depended on an earlier migration. [29afcc1]
- **M5** Never relax the unique index on `orders.shopee_order_id`. — duplicate ids made lookups 404 for every buyer (the 2026-08-26 duplicate-id outage). [d74d2ec]
- **M6** Code auto-deploys before a manual migration lands, so ship a compat fallback or retry-without-column, and delete the fallback once the migration is verified (CHECKPOINT T3). [5da3c10, 42038b8]
- **M7** Check `master` for the next free migration number before writing one. — 0015 collided across branches. [eb41a2c]
- **M8** Treat an order↔supplier mapping as all-or-nothing and fail closed. — a field-by-field merge called the wrong site. [14e5afd]
- **M9** Validate inputs before the DB does. — prose in an id field surfaced as a raw 23514 error. [a08612e]
- **M10** When a column stops being written, grep every reader. — `follow-up.ts` still filters on `orders.delivered_at` after 0014 (CHECKPOINT T16). [docs/shopee-first-chat-delivery.md:80]

## P — Shopee platform and listings

- **P1** Map every new or relisted listing in `shopee_listings` (`model_id = 0` when there are no variations). Never auto-map by item name. — a real ETS2 buyer paid and got `no_mapping`. [0b946be]
- **P2** Inbound pushes are signed with the **push** partner key, not the API key. A 401 looks exactly like a bad callback URL. [ed4b139]
- **P3** Chat: `content:{text}`, `to_id = buyer_user_id`, and a 30-day contact window (`user_is_forbidden` means policy, not a bug). A buyer who never chatted needs an order card first. [453595b, 64d1666]
- **P4** The refresh token is single-use. Persist the new pair to disk *before* the DB write, after every refresh. Standalone scripts must refresh: the token expires every 4h, `upload_image` accepts an expired token while `add_item` rejects it. [first-chat:75]
- **P5** After any bulk listing write, re-read `item_status` for every draft. — DELTARUNE went live while undeliverable. [docs/agent-loop.md:173]
- **P6** A cart is one `order_sn` with many items. Serve every line, and pick the account by *our stored* username, never the supplier's entry 0. [5da3c10, eb41a2c]
- **P7** Claim rules (enforced by `/ss-market`): no external URL in descriptions or images, no co-op/online claims, no lifetime or refund guarantee, no "instant", FREE DLC only if *that account* owns it, no review incentives, no permanent "was" price. Audit the **rendered** banner, not just the text. [ss-market SKILL.md:20-35, :286]
- **P8** Recount mechanically; never trust a count from an earlier session. — 9 of 49 title counts were wrong. [SKILL.md:151]
- **P9** An empty `description` is not an absent one. Check `description_info.extended_description` too. — the shop was reported clean while 3 listings still carried URLs. [SKILL.md:66]
- **P10** Live vouchers are near-immutable and a code locks for 30 days. Get it right before creating it. [promotions-and-bundles.md:320]
- **P11** Never list a title that needs a second publisher account (Ubisoft, Rockstar, EA, 2K) or that is free to play. We cannot deliver the second credential. [listing-copy.md:1760, shopee-listings.md:415]
- **P12** Bid Programme prices are hidden from the discount APIs, and bids only go down. Withdrawing a bid needs Chaison's go-ahead. [memory bid-programme]
- **P13** Stock is always 99999. Never propose a stock cap. [memory]
- **P14** Price tiers come from the *current list* price (`appdetails?cc=my`), not the sale price, and the app id must be checked. [shopee-listings.md:91]
- **P15** Markdown heading drift (duplicate headings, em-dash vs hyphen) silently drops sections in parsers. — 9 games and the DO NOT LIST verdicts were lost. [listing-copy.md:249]

## B — Buyer-facing messages

- **B1** Only say "everything was sent" when every game on the order went out in that request. [7476faa]
- **B2** A 5xx tells the buyer the fault is ours, never "your network". [247c1f7]
- **B3** On `REACHED LIMIT` or the Denuvo wall, never tell the buyer to retry. Tell them to message us, and never re-serve a stale code. [f551e04, 3b3cd26]
- **B4** When the UI changes, update the delivery copy *and* the test that pins it. — the message told buyers to fill a username field that no longer exists. [chat-playbook:270]
- **B5** Chat templates are capped at 500 characters, and Shopee truncates silently. [chat-playbook:216]
- **B6** Supplier waits record outcome `unavailable`, never `failure`. — `failure` is weighted 3x and locked buyers out after 6 presses. [f940c75]

## S — Supplier code source

- **S1** Redemptions are finite (about 5–6 per supplier order id). Cache 60s, keep the ledger, never refresh on a timer, never fetch to "just check". Bundles of supplier games spend one redemption per game. [f551e04, 6cc3cbb, promotions:200]
- **S2** Suppliers return HTTP 200 for every outcome. Classify by body. On gamersfantasy, "wrong username" is the same response as "no code yet". [f940c75, 8e96414]
- **S3** gamersfantasy pools accounts per order id. Resolve credentials fresh, pin the pool account once per fetch, and never adopt `prechkorder` output as new stored credentials. [510fe84, dbb2ccd, runbook:71]
- **S4** Log the username and `supplier_message` on every fetch. `supplier_error` alone is undiagnosable. [42038b8]
- **S5** When converting an account to owned (TOTP), clear its order-level supplier mapping in the same change. [78407fd]
- **S6** A `.maFile` holds only the authenticator. Store login credentials separately. [1929bad]

## X — Security

- **X1** Public repo: no real credential, order id, username + order pair, or derivable test-id convention in any tracked file. Rotating is the only fix for what has already leaked. History rewrites do not undo a scrape. [a9d350d, 3e49794, CHECKPOINT T1] · repeated 2026-11-18: the session that wrote this rule put a test id into this very file, and the "verbatim" archive re-published 33 ids. **Now enforced by a tool (X4).**
- **X4** Run `node scripts/check-public-ids.mjs` before every commit (it scans every tracked file and must exit 0). Before any push, run it with `--range origin/master..HEAD`: a clean HEAD does not un-publish an earlier commit in the range. — rule X1 was broken twice in the session that wrote it, and a local commit still held the unredacted archive (caught by the grill). [2026-11-18]
- **X5** A history rewrite of *unpushed* local commits is cheap. Squash a leak out before pushing. Once something is pushed, only rotation fixes it. [2026-11-18]
- **X2** Rate-limit per order id, not per IP. — per-IP locked out buyers behind CGNAT. [1f2e80a]
- **X3** Family View / PIN is friction, not a lock. Owning the account email is the real control. [docs/family-view-lockdown.md]

## A — Agent process (how sessions themselves went wrong)

- **A1** Diff target files after every fan-out. Subagents wrote files outside their brief. [memory]
- **A2** When Chaison overrules a rule, amend the skill or doc *in the same change*. — a session enforced an overruled co-op ban and rewrote 10 correct titles, and two sessions reverted each other. [SKILL.md 1a, listing-copy.md:3180]
- **A3** A CHECKPOINT claim is a hypothesis until re-verified. Stale claims shipped twice. [63f249c, 8f2d5f3]
- **A4** FACT-S never outranks FACT-V, and FACT-C from a supplier is not a measurement. — "unlimited redemptions" was false. [f551e04, TEAM.md §7]
- **A5** Capture full test output (titles), never a grepped count. — 3 failures from concurrent edits could not be compared later. [14e5afd]
- **A6** Reset shared caches between tests. — leaked cache state gave false passes. [6cc3cbb]
- **A7** Do not claim tests that are not automated. [4f2db3f]
- **A8** Tools that gate a ship live in `scripts/`, committed. — scratchpad-only gates were lost (CHECKPOINT T17). [SKILL.md:98]
- **A9** Mark a wrong section as WRONG, with the date and a pointer to the correction. Do not silently delete it. [promotions:24]
- **A10** Answer "what do we hold" from the supplier md first, before the DB or docs. Scope answers to this project only. [memory]
- **A11** When flagging a policy risk, put the sanctioned alternative next to it. [memory]
- **A12** `markitdown` is installed. Use `python -m markitdown` and never reinstall it. Text-only PDF reading misses claims inside images. [memory]
- **A13** A 1,600-line CHECKPOINT is unreadable at pickup. Keep it under 250 lines, put history in git, and put lessons here. — 2026-11-18 restructure. [this commit]
- **A18** Never cite a skill, agent or script as a required step unless it exists. Mark unbuilt ones "(not built: do X by hand)". — CHECKPOINT and TEAM.md sent every session to `/ss-verify-live`, which was never built (grill R6). [2026-11-18]
- **A17** A pipe test is not a live test, and a worktree session's environment differs: `$CLAUDE_PROJECT_DIR` is the *main* checkout. Never end a hook with a silent `|| true`; print a visible fallback instead. Prove a hook in a real new session. — the session brief passed its pipe test, then was NOT PRESENT in the first live session. [2026-11-18]
- **A16** Treat a side session's red flag as a stop signal until it is checked. — the grill's "don't push" message arrived while a PR button was on offer. Checking it showed the flag was right about the branch, and wrong that those ids were new: they were already public on master. [2026-11-18]
- **A15** `research/` is gitignored. A finding that a side session writes there must be copied into CHECKPOINT §2 or LESSONS, or the next session never sees it. — the grill/defender debate output was local-only. [.gitignore:63, 2026-11-18]
- **A14** Address sessions by the name `ListAgents` shows (their title), not the short `name` given at start. — briefs that named `grill-defender` did not resolve. [2026-11-18]
