# TEAM.md — Agent Team, Roles & Agentic Workflow

**Project:** Steamshare / GameShare — `gameshare.space`
**Owner / sole human:** Chaison
**Adapted:** 5 September 2026, from `Project Creative Finance/TEAM.md`
**Purpose:** Operating manual for the agent team on this repo — who exists, what each is for, how work is handed over, and where state lives. This file covers *how agents work here*. It does not restate project status; that lives in `CHECKPOINT.md`.

> **Read order for a cold session:** `AGENTS.md` (Next.js 16 breaking-changes rule — outranks this file) → `TEAM.md` (this file) → `CHECKPOINT.md` (current state) → the relevant `docs/*.md` runbook.

---

## 0. What was adapted from the source manual

The parent project is **research-and-decision**: no production system, output is judgement, and the expensive failure is re-running completed research. This one is **live software**: real buyers pull credentials right now, and the expensive failure is a change that silently stops serving them. The constraints carry over; a few invert.

| Source rule | Here |
|---|---|
| C1 — no message bus; handoff is files on disk | **Intact.** `CHECKPOINT.md` + `docs/` are the only channel. |
| C2 — subagents start with zero context | **Intact.** §6 brief template is mandatory. |
| C3 — vague briefs duplicate work | **Intact.** |
| C4 — orchestrator loses its place after compaction | **Already solved.** `CHECKPOINT.md` predates this file and does the job. No second `LEDGER.md` — two state files means one goes stale. |
| C5 — multi-agent costs ~15x | **Bites harder.** Most work here is sequential edits to one codebase, the worst case for fan-out. |
| C6 — agent-description bloat degrades delegation | **Roster capped at 3, not 5.** See §3 for the two seats cut. |
| C7 — skill keeps detail, subagent returns a verdict | **Intact.** Basis of §2 vs §3. |
| C9 — a separate critic counters self-preferential bias | **Upgraded.** This product hands real credentials to strangers. |
| C10 — agents can't self-serve the project's core data | **Same force, different target.** See C10′. |
| `tools/*.py` | **Retargeted to `scripts/*.mjs`.** Node repo; a Python layer buys nothing. |

### C10′ — the constraint everything else follows from

**An agent cannot reach any system this project runs on.** Not scraping defences — authentication, browser-only consoles, and physical possession.

Shopee Open Platform Console · Shopee Seller Centre · Steam / Steam Guard / SDA · the Supabase dashboard · the Vercel dashboard · **and a real buyer's experience**. Every one is Chaison-only.

This is not theoretical. A production outage once ran undetected because the site built, deployed, and returned 200s throughout while every buyer lookup failed. Nothing inside this repo could see it.

**Therefore: an agent that says "it works" without a `FACT-V` tag (§7) has established nothing.**

---

## 1. The roster at a glance

```
                       CHAISON  (human — sole console access,
                           |     sole decision authority)
                           v
                  +-------------------+
                  |   MAIN SESSION    |  orchestrator. Owns CHECKPOINT.md.
                  +---------+---------+  Writes the code. Dispatches.
                            |
     +----------------------+---------------------------+
     |                      |                           |
 IN-CONTEXT SKILLS     ISOLATED SUBAGENTS         SHARED MEMORY
 (detail is kept)      (verdict comes back)       (the only handoff channel)
     |                      |                           |
 /ss-preflight         ss-researcher (xN parallel)  CHECKPOINT.md
 /ss-migrate           ss-verifier                  docs/*.md
 /ss-verify-live       ss-adversary                 scripts/*.mjs
 /ss-market
```

**Three agents. Four skills. One state file.**

---

## 2. Skills — work that runs IN the main context

Use a skill when the **detail must stay live** for the next step, or when the step **must ask Chaison something** — a subagent cannot ask him anything (C2), and under C10′ he holds every load-bearing fact. Location: `.claude/skills/<name>/SKILL.md`.

### `/ss-preflight` — the cheap gate
Refuse a bad ship in two minutes, before anything reaches production. This is what makes the 15x fan-out cost (C5) affordable.
**Does:** typecheck → tests (with `.env.local` loaded; they hard-fail without it) → migration-list parity (files on disk vs the `MIGRATIONS` array in `scripts/run-migrations.mjs`) → env parity (`.env.local.example` vs `.env.local` vs Vercel) → inventory of uncommitted work.
**Output:** `SHIP` / `HOLD` / `NEED-DATA` + the failing line.
**Hard rule:** `HOLD` ends it. No deploy, no migration.

### `/ss-migrate` — the live schema change
**Does:** confirm ordering dependencies (some migrations abort unless their predecessor is applied — read the file headers, the guards are deliberate); confirm the migration is in `run-migrations.mjs`'s list; **obtain Chaison's explicit sign-off**; run; then `/ss-verify-live`.
**Hard rule:** a schema change against production is **never** an unattended action — not because tooling can't, but because under C10′ no agent can see the blast radius.

### `/ss-verify-live` — prove buyers are actually served
"It deploys" and "it serves buyers" are different claims, and only one matters.
**Does:** `GET /api/health` (200 required — it checks real DB connectivity, so a 503 here is the honest signal a generic 404 can never give); then one real end-to-end lookup against a known test order; confirm the Guard code **differs across two calls ~35s apart**, proving live TOTP rather than a cached value.
**Output:** a `FACT-V` line, with date, for `CHECKPOINT.md`.
**Run it after:** any deploy, any migration, and any Supabase pause/unpause.

---

### `/ss-market` — Shopee marketing, SEO and listing copy
Growing sales on Shopee MY: the weekly routine, listing copy, keyword passes, vouchers, and the
decision on whether a growth lever is worth the money.
**Why a skill, not an agent:** almost every real answer needs a number only Chaison can read from
Seller Centre (C10'), and a subagent cannot ask him anything.
**Enforces:** the claim rules — no co-op/online claims (buyers are in Offline Mode), no lifetime or
refund guarantees, no "instant", and no gameshare.space URL in a listing description, which is a
Shopee Listing Violation carrying penalty points.
**Backed by:** `research/2026-09-06-shopee-growth-levers.md`,
`research/2026-09-06-marketing-asset-audit.md`,
`research/2026-09-06-marketing-skill-ecosystem.md`.
**Hard rule:** changing a LIVE listing is Chaison's call, never an agent's.

---

## 3. Agents — work that runs in ISOLATION

Location: `.claude/agents/<name>.md`.

| Agent | Model | Mandate | Returns |
|---|---|---|---|
| **ss-researcher** | sonnet (haiku for mechanical indexing) | Generic parallel research worker. Reads external docs — Shopee Open Platform guides, `node_modules/next/dist/docs/`, policy pages — and returns a written file. **Specialisation comes from the brief, never a new agent file** (C6). | A file + a summary under 400 words |
| **ss-verifier** | sonnet | Adversarial audit of **our own claims**. Does the code do what `CHECKPOINT.md` says? Which `docs/` files are stale? Which `TODO(unconfirmed)` / `SPEC AMBIGUITY` markers in `lib/` are still open? **Never merged with implementation** (C9). | `research/verification-report.md` |
| **ss-adversary** | opus | Red team. Mandate is to **break the system**, not review style. Surface: credential exposure, the public repo, rate-limit bypass, order-id enumeration, cross-account password guessing, webhook signature forgery, refund-then-keep-playing, admin-panel access. | `SAFE TO SHIP` / `SHIP WITH CONDITIONS` / `DO NOT SHIP` |

### The two seats that were cut

- **No orchestrator agent.** In the source manual the orchestrator is a dispatched subagent. Here the main session *is* the orchestrator — it holds the code, the edits, and the conversation with Chaison. Spawning a second one duplicates a seat already filled, which the source's own §9 names as a documented failure mode. The role is real; the agent file is not.
- **No planner agent.** Planning here must ask Chaison things, and its detail must survive into implementation. By §4's own rule that makes it a **skill or main-session work**, not a subagent. Cut rather than mis-classified.

**Only the main session dispatches.** No nested spawning.

---

## 4. Skill, subagent, or tool? The decision rule

| Ask | Answer | Why |
|---|---|---|
| Is the step **deterministic**? | **Tool** (`scripts/*.mjs`) | Migrations, seeding, status audits, parity checks. Never ask a model to do these — a tool that silently omits a file from its own list is exactly the failure this layer exists to make visible. |
| Is it **judgement** that must **ask Chaison** mid-task? | **Skill** | A subagent cannot ask him anything, and C10′ means he holds the facts. |
| Is it **judgement** that **reads a lot and returns a little**? | **Subagent** | See the isolation rule below. |
| Is it the **sequence** of all that? | **Workflow** — here, `docs/*.md`. The existing SOP and runbook files already are these. |

### The isolation rule
Main context is re-sent every turn. Read 40k tokens of API docs at turn 5 and you pay for them again at turns 6, 7, 8. A subagent reads them once, in a throwaway context, and returns 400 words. **Any task that reads a lot and returns a little belongs in a subagent, regardless of which model runs it.**

**The counterweight, stated honestly:** isolation moves cost from recurring to one-off; it does not reduce the total, which runs ~15x (C5). It wins on long research sessions and loses on short edit sessions. **Most work here is short edit sessions on one codebase** — sequential and shared-state, a bad fit for fan-out. Default to the main session. **Fan out for research and review, not for implementation** — parallel agents editing shared files produce merge conflicts, not speed.

### The model ladder
| Model | Right for | Never for |
|---|---|---|
| `haiku` | Mechanical, fixed-shape output — indexing, extraction, tabulating | **Any gate that can block a ship.** Cheap models lose *precision*, not recall: they catch real problems but false-positive on clean code. |
| `sonnet` | Research and verification. The default. | |
| `opus` | Architecture, security red-teaming, anything touching credentials or money | |

`ss-researcher` takes a **per-dispatch model override** — that is how specialisation happens without adding agents and breaching the description budget (C6).

---

## 5. The workflow

```
   A change is proposed, or a gap is found
                    |
                    v
          +-------------------+
          |   /ss-preflight   |   in-context, ~2 min, no agents dispatched
          +---------+---------+
                    |
        +-----------+------------+-----------------+
        v                        v                 v
      HOLD                  NEED-DATA            SHIP
        |                        |                 |
     fix & re-run      back to Chaison —      does it touch
                       C10' means he holds    credentials, money,
                       every console fact     schema, or auth?
                                                   |
                                    +--------------+--------------+
                                    v                             v
                                   no                            yes
                                    |                  ===== FAN-OUT =====
                                    |                  (one dispatch message)
                                    |               +---------+---------+
                                    |               v                   v
                                    |          ss-verifier         ss-adversary
                                    |          (does it match      (does it
                                    |           what we claim?)     break?)
                                    |               +---------+---------+
                                    |                         |
                                    +------------+------------+
                                                 v
                                        commit -> deploy
                                                 v
                                        /ss-verify-live   <- MANDATORY
                                                 v
                                    CHECKPOINT.md updated with FACT-V
                                                 v
                                       CHAISON DECIDES  <- never an agent
```

### Ship criteria — any one of these is a `HOLD`

- Typecheck fails, or any test in `lib/*.test.ts` fails
- A migration on disk is missing from `run-migrations.mjs`'s `MIGRATIONS` array
- A migration applied out of its declared dependency order
- A schema change against production without Chaison's explicit sign-off
- An env var required by new code is set in `.env.local` but not in Vercel
- A real credential in any tracked file (**this repo is public**)
- **Process kill:** a claim of "working", "fixed", or "live" with no `FACT-V` behind it

---

## 6. The dispatch brief — mandatory template

A subagent knows nothing (C2). A short brief causes duplicated work (C3). All seven sections, every time:

```markdown
OBJECTIVE
  One paragraph. What must be true when you are done.

CONTEXT YOU NEED (you start with no history — this is everything)
  Restate the system: Next.js 16.2.7 App Router, Supabase Postgres, deployed on
  Vercel at gameshare.space, serving live Steam Guard TOTP codes to buyers who
  paste a Shopee order id. THE REPO IS PUBLIC. Name which file is ground truth
  for this question. Assume the agent has never heard of this project.

WHAT TO DETERMINE
  Numbered. Specific. Each item independently checkable.

SOURCES
  Exact paths. For Next.js, node_modules/next/dist/docs/ — this version has
  breaking changes against training data (see AGENTS.md). For Shopee, the guide
  number and section.

STANDARDS
  Fact-labelling per §7. Cite, or mark UNSOURCED. Report failures honestly.

OUT OF SCOPE — covered by another agent, do not duplicate
  Name the other agents' territory explicitly.

OUTPUT
  Exact file path to write. Exact section headings required.
  Then: return under N words leading with <the single most decision-relevant finding>.
```

---

## 7. The return contract and fact labelling

### Return contract
One status word, then detail in the file, then **15 lines or fewer** in the reply:

| Status | Meaning |
|---|---|
| `DONE` | Objective met, output written, nothing outstanding |
| `DONE_WITH_CONCERNS` | Output written, but findings the main session must weigh — listed |
| `BLOCKED` | Could not proceed. State exactly what blocked it |
| `NEEDS_CONTEXT` | The brief was insufficient. State exactly what is missing |

`ss-adversary` additionally returns `SAFE TO SHIP` / `SHIP WITH CONDITIONS` / `DO NOT SHIP`.

### Fact labelling — every claim carries a tag

The source manual tags numbers because agents cannot fetch property data. Here the same rule applies to **system state**, because under C10′ an agent cannot observe production. An untagged claim about what is live is a guess.

| Tag | Meaning |
|---|---|
| `FACT-V` | **Verified by running it.** Command, output, and date attached. The highest tier here — in a software project an executed check beats a citation. |
| `FACT-C` | Supplied by Chaison from a console no agent can reach. Ground truth; overrides desk research on conflict. |
| `FACT-S` | Sourced from documentation. **A URL or exact file path must be attached.** |
| `ASSUMPTION` | State the value and its basis. |
| `UNSOURCED — MUST VERIFY` | Needed, not established. Never stated confidently. |

**Absolute rule: `FACT-S` never outranks `FACT-V`.** Shopee's own documentation has already proven internally inconsistent — see the `SPEC AMBIGUITY` note in `lib/shopee-auth.ts`, where one Shopee page shows a different host in its table than in its own runnable example. Read docs to form a hypothesis; run the call to establish a fact.

**Corollary this project keeps paying for:** *"the site loads"* is not evidence that buyers are served. Only a completed lookup is.

---

## 8. Shared memory — where handoff happens

```
AGENTS.md / CLAUDE.md   <- Next.js 16 breaking-changes rule. OUTRANKS this file.
TEAM.md                 <- this file. Read second.
CHECKPOINT.md           <- persistent state. THE ledger. Read before any work (C4).

docs/                   <- Layer 1: runbooks and SOPs (workflows)
scripts/*.mjs           <- Layer 3: deterministic tools
supabase/migrations/    <- numbered, ordered, dependency-guarded
lib/                    <- domain logic + colocated *.test.ts
.claude/agents/         <- the 3 agents
.claude/skills/ss-*/    <- the 3 skills
```

**`CHECKPOINT.md` discipline.** Living status file, current state only — not a history log. Update it in the same change that makes it true, never in a later cleanup pass. It is the single thing keeping a compacted session oriented (C4).

---

## 9. Standing rules for every dispatched agent

1. **Report failures plainly.** A page you could not fetch is reported as unfetched, never reconstructed from memory. Reconstruction is the primary way research tasks fail — and third-party API docs are exactly what a model will confidently hallucinate.
2. **Cite, or mark `UNSOURCED — MUST VERIFY`.** There is no third option.
3. **Never claim production works without running against production** (§7).
4. **Do not soften a finding to be agreeable.** A vulnerability is described as a vulnerability. Working code that breaks next month is described as breaking next month.
5. **Constructive by default.** Where something is blocked, name the nearest working alternative. "Not possible" without an alternative is an incomplete answer.
6. **Chaison's console reports are ground truth** and override any inference drawn from the repo.
7. **Agents never decide.** They produce a verdict and the evidence. Chaison decides.

---

## 10. What this team deliberately does NOT have, and why

| Not built | Why |
|---|---|
| A separate agent per domain (Shopee API, security, database, frontend) | C6 — description bloat degrades delegation. One `ss-researcher` plus a sharp brief beats ten thin specialists. |
| An orchestrator agent | The main session already holds that seat. Duplicating it is a documented failure mode. |
| A planner agent | Planning must ask Chaison things and its detail must persist. That makes it a skill by §4, not a subagent. |
| Parallel fan-out for implementation | Implementation is sequential edits to shared files. Fan-out produces merge conflicts, not speed. |
| A Python `tools/` layer | Node repo. `scripts/*.mjs` already is Layer 3. |
| A separate `LEDGER.md` | `CHECKPOINT.md` already does it, and two state files means one goes stale. |
| Nested subagent spawning | Workers spawning their own reviewers duplicates a seat the main session already scheduled. |
| An agent with production console access | Not a policy choice — the consoles are browser-authenticated and Chaison-only. C10′. |

---

## 11. Build status

| Component | Status |
|---|---|
| `CHECKPOINT.md` as ledger | **Live.** Predates this file; needs no change. |
| `docs/*.md` as Layer 1 workflows | **Built**, unlabelled until now. |
| `scripts/*.mjs` as Layer 3 tools | **Partly built** — `run-migrations.mjs`, `seed-fleet.mjs`, `seed-shopee-listings.mjs`. |
| `/ss-preflight`, `/ss-migrate`, `/ss-verify-live` | **Not built.** |
| `/ss-market` | **BUILT 2026-09-06** — `.claude/skills/ss-market/SKILL.md`. Shopee marketing, SEO, listing copy, growth levers. Backed by the three `research/2026-09-06-*` files. |
| `ss-researcher` | **BUILT 2026-09-06** — `.claude/agents/ss-researcher.md`. Generic worker; specialisation comes from the brief (C6). |
| `ss-verifier`, `ss-adversary` | **Not built.** |
| Fact-labelling convention (§7) | **Adopted from this commit.** Applies going forward; existing `CHECKPOINT.md` entries are not retro-tagged. |
