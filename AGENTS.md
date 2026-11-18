<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Agent team

This repo runs an agent team. `TEAM.md` is its operating manual — roster, skill/subagent/tool
decision rule, dispatch brief template, and the return contract.

**Read order for a cold session:** this file → `TEAM.md` §0 (the orchestrator loop) →
`CHECKPOINT.md` (current state and work queue) → `LESSONS.md` (§0, plus your area) → the relevant
`docs/*.md` runbook. **End every task with `/ss-handoff`**: CHECKPOINT updated in the same commit,
and every mistake recorded in LESSONS.

The rule above outranks `TEAM.md` on anything framework-related.
