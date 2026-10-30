# Agent Loops — what they are, and what one would cost here

**Status:** research only. Nothing in this file has been built or run.
**Written:** 2026-09-06. **Revised same day** after a grill pass + two dispatched research agents
(Vercel runtime limits; prompt-injection and approval gates). Revision notes at §7.
**Read after:** `AGENTS.md` → `TEAM.md` → `CHECKPOINT.md`.

> **Scope is NOT yet decided.** Chaison asked for an agent loop "for upcoming" without naming
> the target. §6 lists the candidates and the one question that gates all of them. **That
> decision is his** (TEAM.md §9.7). Everything before §6 is mechanism and safety, which holds
> whichever target wins.

---

## 0. First, disambiguate — "agent" now means two different things in this repo

`TEAM.md` already describes an agent team. It is **not** an agent loop, and conflating the two
will produce the wrong build.

| | `TEAM.md` dispatch model | An agent loop (this file) |
|---|---|---|
| Who decides the next step | The main session, then Chaison | **The model**, autonomously, per iteration |
| Termination | The task ends | `stop_reason: "end_turn"`, or a cap you enforce |
| Human in the path | Every ship (§5 ship criteria) | **Only where you build a gate** |
| Runs | While Chaison is in the session | Potentially unattended, on a schedule |
| Failure blast radius | A bad commit, caught by `/ss-preflight` | **Whatever its tools can reach**, N times, unwatched |

The existing team is agents *dispatched by a human orchestrator*. An agent loop is a program
that keeps calling the model until the model says it is finished. The second one is what has
money and credentials on the other side of it here.

**`TEAM.md` is prior art, not a competing idea.** §9.7 ("agents never decide — they produce a
verdict and the evidence") and C10′ (no agent reaches any production console) already encode
*approve-each-action* autonomy. §3.3's ladder is the published name for a rule this repo
already runs on.

---

## 1. The mechanism

A loop, four steps, repeated:

1. Send `messages` + `tools` to the model.
2. Model replies with `stop_reason: "tool_use"` (it wants a tool run) or `"end_turn"` (done).
3. Your code executes the requested tool(s), appends the results, resends.
4. Repeat from 2.

That is the whole idea. It is the ReAct pattern — Thought → Action → Observation → repeat
(`FACT-S`, Yao et al. 2023, https://arxiv.org/pdf/2210.03629). It is also literally what
Claude Code does in this repo.

```typescript
let messages: Anthropic.MessageParam[] = [{ role: "user", content: goal }];

for (let i = 0; i < MAX_ITERATIONS; i++) {          // §4.1 — never unbounded
  const res = await client.messages.create({ model, max_tokens, tools, messages });
  if (res.stop_reason === "end_turn") break;

  messages.push({ role: "assistant", content: res.content });   // FULL content, not just text

  if (res.stop_reason === "pause_turn") continue;               // §4.2 — not an error

  const calls = res.content.filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
  const results = await Promise.all(calls.map(async (t) => ({
    type: "tool_result" as const,
    tool_use_id: t.id,
    content: await executeTool(t.name, t.input),                // §3.2 — the gate lives here
  })));

  messages.push({ role: "user", content: results });            // ALL results, ONE message
}
```

Two invariants that break the conversation silently if missed (`FACT-S`,
`shared/tool-use-concepts.md` in the bundled `claude-api` skill):

- **Append the model's full `response.content`**, not the extracted text. Dropping it loses the
  `tool_use` blocks the next turn refers back to.
- **All results from one turn go back in a single `user` message.** Splitting them across
  messages trains the model to stop making parallel calls.

---

## 2. Where the loop can physically run — the constraint the first draft missed

**A Vercel function on Hobby is capped at 300 seconds, and that is a hard ceiling.** Not a
default that can be raised: Hobby has no extended-duration tier (Pro/Enterprise go to 800s/1800s).
Streaming does **not** extend it — the cap includes streamed response time — and `waitUntil`
does not escape it either (`FACT-S`, https://vercel.com/docs/functions/limitations#max-duration).

A multi-iteration loop is exactly the shape that blows through a per-invocation wall.

| Approach | You write | Where the loop lives | Verdict here |
|---|---|---|---|
| **Manual loop** | The `for` loop above | One Vercel invocation | Only if the whole run fits in 300s. |
| **Tool Runner** (`client.beta.messages.toolRunner()`) | Just the tool functions | One Vercel invocation | ✅ **Right API**, but inherits the same 300s wall. Fine for short runs. |
| **Tool Runner inside Vercel Workflows** (`'use workflow'` / `'use step'`) | Tools + step boundaries | Many invocations, replayed | ✅ **The answer for anything long.** Overall run duration unlimited; each *step* is bounded by 300s, which one model-call-plus-tool-call fits inside easily. On Hobby: 50k events/mo included (`FACT-S`, https://vercel.com/docs/workflows, https://vercel.com/docs/workflows/pricing). |
| **Claude Agent SDK** | A prompt + options | Our infra | Overkill — ships file/bash/grep tools we'd spend the build disabling. |
| **Managed Agents** | Agent config | **Anthropic's** infra | Sidesteps the wall entirely. Adds a platform we don't otherwise need. |

**Two things that do NOT work on Hobby, so don't design around them:**

- **Cron-chaining one iteration per firing.** Hobby cron fires **once per day**, ±59 min
  (`FACT-S`, https://vercel.com/docs/cron-jobs/usage-and-pricing). It cannot drive
  iteration-to-iteration resumption. `vercel.json` currently holds exactly one daily cron.
- **Holding a long request open by streaming.** See the cap note above.

**Recommendation: Tool Runner, wrapped in Workflows if the run exceeds one invocation.** The
Tool Runner gives the loop plus the per-iteration hook that §3.2 depends on; Workflows gives
duration. Note the cost shape either way: a loop re-sends the whole conversation every
iteration, so turn 1's context is paid for on every subsequent turn. **Prompt caching is not
optional at this shape.**

> **Housekeeping found while checking this:** the comment at
> `app/api/cron/follow-up/route.ts:37-42` asserts *"Vercel's Hobby plan caps a function at 60s."*
> Current docs say 300s. The value itself (`maxDuration = 60`) is safely under either number, so
> this is comment drift, not a bug — worth correcting in passing, not worth its own change.

---

## 3. Safety — the part that decides whether the loop is allowed to exist

### 3.1 This system already has the lethal trifecta

An agent is exposed to exfiltration when three things are true at once (`FACT-S`,
https://simonwillison.net/2025/Jun/16/the-lethal-trifecta/; OWASP LLM01,
https://owasp.org/www-project-top-10-for-large-language-model-applications/):

| Leg | Present here? |
|---|---|
| **Access to private data** | Yes — `steam_accounts` credentials, Supabase reads, order data |
| **Exposure to untrusted content** | Yes — Shopee buyer chat text, listing descriptions, and sharpest of all the **supplier JSON** from `cyberspace.cyou` / `gamersfantasy.my`, which is parsed HTTP response text from outside this system |
| **Ability to communicate externally** | Yes — the Shopee chat-send tool |

All three. Any one alone is fine. **The mitigation is to remove a leg, and the cheapest leg to
remove is the third** — a loop that cannot autonomously send a Shopee message or ship an order
loses nothing it needs, because §6's recommended target never wanted those tools.

Note what "just tell the model to ignore instructions in the data" is worth: nothing you can
rely on. Models cannot reliably distinguish instruction provenance from content, and OWASP
states outright that no fool-proof prevention exists. A prompt is advice. A refused tool call
is a control.

**The hard rule that follows — architecture, not prompting:**

> **A tool that reads untrusted content and a tool that acts externally MUST NOT live in the
> same loop.** The watchdog that reads Shopee listing data and writes a report does not get
> `send_chat` or `ship_order`. Ever. Splitting them is the whole defense.

Where a loop genuinely must reason over untrusted text, the published pattern is
**dual-LLM / privilege separation** (`FACT-S`,
https://simonwillison.net/2023/Apr/25/dual-llm-pattern/ and
https://arxiv.org/html/2506.08837v2): a *quarantined* model reads the untrusted content and
holds no tools; a *privileged* model holds the tools and never sees raw untrusted text — only
structured, validated output crossing the boundary.

### 3.2 The approval gate — where it physically goes

The Tool Runner's **per-iteration hook is the interception point**. Mechanically the pattern is
pause → serialize the pending call → resume only on a human decision (`FACT-S`,
https://openai.github.io/openai-agents-python/human_in_the_loop/,
https://learn.microsoft.com/en-us/agent-framework/agents/tools/tool-approval). That is the
`executeTool` call in §1's sketch: it returns a refusal instead of a result when the gate says no.

Per-tool policy, three levels — always-allow / needs-approval / block:

| Action | Level | Why |
|---|---|---|
| Read order status, SKU, `shopee_listings` | **always-allow** | Reversible, cheap, no buyer-visible effect |
| **Fetch a supplier code** | **needs-approval** | **Spends one of ~5-6 finite redemptions** (CHECKPOINT.md, "Redemptions are FINITE"). Dev testing already exhausted a real saleable order once. |
| **Send a Shopee chat message** | **needs-approval** | Buyer-visible, permanent in Shopee's logs, cannot be unsent |
| **`ship_order`** | **needs-approval** | Moves a real order's lifecycle state |
| **Publish / unlist a listing** | **needs-approval** | A silently re-listed draft already sold something undeliverable once (CHECKPOINT.md, "An UNLIST draft went LIVE") |
| Anything reading `steam_accounts` credentials | **block** | Open items 0 and 0b are unresolved. Do not widen that surface. |

**The redemption cap is the sharpest constraint.** A loop's natural response to a failed fetch
is to retry; six retries burns the entire order. `local/websites/WHEN-TO-FETCH-CODE.md` states
the human rule — *fetch only when a buyer is at Steam's prompt and has asked*. A loop must
inherit it as a refused call, not a prompt instruction.

**Open, unsourced:** what approval UX looks like for a **single operator on a phone**. Published
sources describe team dashboards, not one person approving from Shopee chat on mobile. Presumed
shape is one message per pending call — tool name, args, approve/deny — but that is
`UNSOURCED — MUST VERIFY`, not a finding.

### 3.3 The autonomy ladder

Read-only → suggest → supervised execution → monitored autonomy → full autonomy (`FACT-S`,
https://www.mindstudio.ai/blog/ai-agent-permission-ladder-autonomy-levels). The graduation rule
is the useful part: **raise a level only after a high acceptance rate, a low correction rate,
reliable rollback, and stable audit logs at the current level.**

This repo is already at level 2 by policy (TEAM.md §9.7). Nothing here proposes skipping levels.

---

## 4. Failure modes to design against

### 4.1 Runaway iteration
Always cap. `MAX_ITERATIONS` plus a token budget. An unbounded loop with a paid API on one side
and a rate-limited supplier on the other is the expensive version of this mistake.

### 4.2 `pause_turn` is not an error
Server-side tools hitting their internal iteration limit return `stop_reason: "pause_turn"`.
Resend the assistant content **verbatim** to resume — do not inject "continue", and do not treat
it as a failure (`FACT-S`, `shared/tool-use-concepts.md`).

### 4.3 Prompt-cache invalidation
Editing the system prompt, changing the tool set, or switching models mid-run invalidates the
cache. At this loop's re-send shape that is a real cost line, not a rounding error. Keep the
system prompt and tool list byte-stable for the life of a run.

### 4.4 Tool inputs are untrusted
Tool arguments are model output. Anything reaching a shell, a path, or a SQL string is validated
at the boundary — same standard as buyer input. See §3.1 for why the model's own compliance is
not a control.

### 4.5 The failure this project already knows
CHECKPOINT.md's C10′ corollary: *"the site loads" is not evidence that buyers are served.* An
agent loop reporting `DONE` is evidence of nothing at all. Any loop touching production needs a
`FACT-V` check on the far side of it (TEAM.md §7) — **and the loop cannot be the thing that
produces its own `FACT-V`.**

### 4.6 Context growth
Long loops fill their window with old tool results. Three mechanisms (`FACT-S`,
`shared/agent-design.md`): **context editing** (prune stale results mid-run), **compaction**
(server-side summarisation near the limit), **memory tool** (state surviving a restart). Reach
for the first first; the third only if a run must survive a process restart.

---

## 5. Testing and observability — NOT YET ESTABLISHED

Both were researched and neither came back with a source solid enough to write as guidance.
Recorded here as open work, not as a plan:

- **Testing a non-deterministic loop.** The defensible shape is to mock the Anthropic client and
  replay a fixed script of `tool_use` blocks, asserting on the **tool-call sequence and
  arguments** rather than model prose — deterministic, and it fits the existing `lib/*.test.ts`
  convention. Tool functions stay unit-tested exactly as today. Genuine non-deterministic runs
  stay hand-reviewed and gated by §4.5. **`UNSOURCED — MUST VERIFY`** — no authoritative eval
  methodology was confirmed this session.
- **Per-iteration logging.** Candidate fields: `stop_reason`, token usage, tool name / input /
  latency, and the refusal decision when a gate fires. Vercel Workflows supplies per-step
  tracing for free if we go that route (`FACT-S`, https://vercel.com/docs/workflows#observability).
  The field list itself is **`UNSOURCED — MUST VERIFY`**.

---

## 6. What this would actually be FOR — OPEN, Chaison's call

**The one question everything else depends on: is "upcoming" (a) the unbuilt `TEAM.md` agent
team, (b) a runtime product feature, or (c) a change to how we run sessions?**

If **(c)**, this file is the wrong artifact and `TEAM.md` is the one to edit.

Relevant evidence found while grilling this doc:
- **`TEAM.md` §11 lists the entire agent team as _Not built_** — all three skills, all three agents.
- **The unbuilt roadmap items are C (refund handling) and D (account overload reassignment)** —
  CHECKPOINT.md:1077.
- **CHECKPOINT repeatedly names failures nothing watches for**: `banned_item_push` /
  `violation_item_push` unwired ("the highest-impact failure mode nothing currently watches
  for"), the DELTARUNE draft that went `NORMAL` on its own, and an unmapped listing whose only
  trace when a real buyer paid was "a Vercel log line nobody was watching".

Three candidates, ascending by damage-per-bad-iteration:

| # | Candidate | Tools | Trifecta legs | Verdict |
|---|---|---|---|---|
| 1 | **Listing copy / banner generation** | Read Steam metadata, read `docs/listing-copy.md`, write a draft file | 1 of 3 | Safe warm-up. Blast radius = one file on disk. |
| 2 | **Ops watchdog** — read-only sweep for the failures above | Shopee reads, Supabase reads, write a report | 2 of 3 (no external send) | ✅ **Recommended first real target.** |
| 3 | **Buyer support / fulfilment agent** | Supplier fetch, chat send, order state | **3 of 3** | **Not yet.** Every §3.2 gate must exist and have a `FACT-V` first. |

**Recommendation: #2, triggered after bulk listing writes — not on a cron.** Hobby gives one
cron firing per day, and the moment of danger is not 04:00; it is immediately after a bulk
operation. CHECKPOINT already states the human version of this rule: *"after ANY bulk write
across listings, re-read `item_status` for every draft."* A post-operation watchdog automates a
rule that already exists, fires exactly when risk peaks, and needs no cron at all.

It also doubles as `ss-verifier` from TEAM.md §3 — *"does the code do what CHECKPOINT.md
says?"* is the same loop with different read tools.

---

## 7. Revision notes — what the first draft got wrong

| Draft claim | Corrected to |
|---|---|
| "Tool Runner, on our Vercel functions" — duration unaddressed | Hard 300s Hobby ceiling; Workflows for anything longer (§2) |
| Watchdog implicitly cron-driven | Hobby cron is daily-only; post-bulk-write trigger is better anyway (§6) |
| §3 gates present but threat unnamed | Lethal trifecta named and legged-out; hard tool-separation rule (§3.1) |
| No injection defense beyond "validate inputs" | Dual-LLM / privilege separation (§3.1) |
| Gates demanded, mechanism unspecified | Tool Runner per-iteration hook is the interception point (§3.2) |
| §5 sequencing by instinct | Cited autonomy ladder + graduation rule (§3.3) |
| Human oversight framed as new | `TEAM.md` §9.7 / C10′ are prior art (§0) |
| Testing/observability absent | Present as explicitly unsourced open work (§5) |

## 8. Sources

All `FACT-S`. Nothing below has been run against this system.

| Source | What it settles |
|---|---|
| https://www.anthropic.com/engineering/building-effective-agents | Workflow vs. agentic loop; when a loop is the wrong tool |
| https://www.anthropic.com/engineering/writing-tools-for-agents | Tool design; why tool quality drives loop reliability |
| https://arxiv.org/pdf/2210.03629 | ReAct — the Thought/Action/Observation formalisation |
| https://simonwillison.net/2025/Jun/16/the-lethal-trifecta/ | The three-leg exfiltration condition (§3.1) |
| https://simonwillison.net/2023/Apr/25/dual-llm-pattern/ · https://arxiv.org/html/2506.08837v2 | Privilege separation for untrusted content |
| https://owasp.org/www-project-top-10-for-large-language-model-applications/ | LLM01 prompt injection; no fool-proof prevention |
| https://www.anthropic.com/research/trustworthy-agents | Per-tool permission levels; plan-then-approve |
| https://openai.github.io/openai-agents-python/human_in_the_loop/ · https://learn.microsoft.com/en-us/agent-framework/agents/tools/tool-approval | Approval interception mechanics |
| https://www.mindstudio.ai/blog/ai-agent-permission-ladder-autonomy-levels | Autonomy ladder + graduation rule |
| https://vercel.com/docs/functions/limitations · /workflows · /cron-jobs/usage-and-pricing | Duration cap, Workflows, Hobby cron cadence |
| Bundled `claude-api` skill — `shared/agent-design.md`, `shared/tool-use-concepts.md` | Build-approach matrix, context management, `pause_turn`, batching |

**Caveat per TEAM.md §7:** `FACT-S` never outranks `FACT-V`. Everything above is documented, not
demonstrated. The first thing any build of this produces should be a `FACT-V` line.
