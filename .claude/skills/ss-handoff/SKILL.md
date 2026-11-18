---
name: ss-handoff
description: Use at the END of every Steamshare task, before saying it is done or committing. Also use whenever a mistake, revert, wrong claim, or correction from Chaison happens, and at session start to orient. Updates CHECKPOINT.md (work queue + handoff log), records the lesson in LESSONS.md, and keeps both short, so the next session can pick up in 60 seconds.
---

# /ss-handoff — leave the repo so a cold session can continue

The orchestrator (main session) owns this. A subagent never runs it; it returns its result to the
orchestrator, which records it here.

## A. Session start (orient, about 2 minutes)

1. Read `CHECKPOINT.md` §0, §2 and §6. Read `LESSONS.md` §0, plus the section for the area you will touch.
2. `git log --oneline -10` and `git status`. If commits exist that §6 does not mention, the file
   is stale. Fix that first (go to step C3).
3. Pick the first unblocked §2 row, or the user's request. State which task ID you are on.
4. Before acting on any "live / working" claim, check its tag. `(not re-verified)` means re-verify
   first, if the task depends on it (LESSONS A3).

## B. When something goes wrong (immediately, not at the end)

Something went wrong if any of these happened: a wrong claim, a reverted edit, a failed deploy, a
buyer-visible error, a test you had to fix twice, Chaison correcting you, or a subagent writing
outside its brief.

1. Fix it.
2. Add **one line** to the right `LESSONS.md` section, using the format at the top of that file.
   It goes in the **same commit** as the fix.
3. If it repeats an existing lesson, append `· repeated <date>` to that lesson and promote it to §0.
   A repeat means the rule needs a **tool** (script, test, hook, or skill check), so add that as a
   §2 task.

## C. Task end (before saying "done" and before committing)

1. **Verify.** Code: typecheck and run tests (`node --test`, with `.env.local` loaded). Production
   change: `/ss-verify-live`. Docs only: check links and paths exist. No `FACT-V`, no "done".
2. **Update `CHECKPOINT.md`, in the same commit:**
   - §1: change the row whose state changed, with a tag and today's date.
   - §2: update the task's State and its *next concrete step*. Remove finished rows (git keeps
     them). Add any new follow-up as a row, with an Owner.
   - §6: add one entry at the top saying what changed, what is not verified, and the next task.
     Keep 5 entries; delete the oldest.
   - Bump **Last updated**.
3. **Size check:** `wc -l CHECKPOINT.md` must stay **under 250**. Over it? Move detail into the
   relevant `docs/*.md` and leave a one-line pointer.
4. **Public-repo check:** `node scripts/check-public-ids.mjs` must exit 0 (LESSONS X1, X4). No
   order id, test id or credential in any tracked file. **Before any push:**
   `node scripts/check-public-ids.mjs --range origin/master..HEAD` must also exit 0. If it fails,
   squash or rewrite the unpushed commits first (X5).
5. **Side-session output:** anything a side session wrote under the gitignored `research/` folder
   that the team needs goes into §2 or LESSONS now (LESSONS A15).
6. **Fan-out hygiene:** if subagents ran, run `git status` / `git diff --stat` and confirm they only
   touched what their brief allowed (LESSONS A1).
7. **Doc drift:** if behaviour changed, update the runbook in `docs/` that describes it, and grep
   for the old wording (`grep -rn "<old phrase>" docs/ .claude/`).
8. Commit, with a message that cites the task ID and any lesson IDs.

## Output

End with three lines: `Task: <ID> <state>` · `Verified: <FACT-V line or "not verified: why">` ·
`Next: <the §2 row a cold session should start on>`.
