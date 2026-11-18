#!/usr/bin/env node
// Session-start brief. Wired as a SessionStart hook in .claude/settings.json; its stdout is
// injected into the new session's context so a cold session starts oriented (TEAM.md §0).
// Prints CHECKPOINT §0 (pickup), §2 (work queue), §6 (handoff log) and LESSONS §0 (top rules).
// Read-only, no network, never fails the session: any error prints a one-line pointer instead.
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = process.env.CLAUDE_PROJECT_DIR || join(dirname(fileURLToPath(import.meta.url)), "..");

/** Return the body of the `## <n>.`/`## §<n>` section, up to the next `## ` heading. */
function section(text, startsWith) {
  const lines = text.split(/\r?\n/);
  const i = lines.findIndex((l) => l.startsWith(startsWith));
  if (i < 0) return "";
  const out = [lines[i]];
  for (let j = i + 1; j < lines.length && !lines[j].startsWith("## "); j++) out.push(lines[j]);
  return out.join("\n").trim();
}

try {
  const cp = readFileSync(join(root, "CHECKPOINT.md"), "utf8");
  const ls = readFileSync(join(root, "LESSONS.md"), "utf8");
  const updated = (cp.match(/\*\*Last updated:\*\*[^\n]*/) || [""])[0];
  const lineCount = cp.split(/\r?\n/).length;
  const parts = [
    "=== STEAMSHARE SESSION BRIEF (auto, from CHECKPOINT.md + LESSONS.md) ===",
    updated,
    lineCount > 250 ? `WARNING: CHECKPOINT.md is ${lineCount} lines (cap 250) — trim it via /ss-handoff C3.` : "",
    section(cp, "## 0."),
    section(cp, "## 2."),
    section(cp, "## 6."),
    section(ls, "## §0"),
    "End every task with /ss-handoff. Record every mistake in LESSONS.md in the same commit as its fix.",
  ];
  process.stdout.write(parts.filter(Boolean).join("\n\n") + "\n");
} catch (err) {
  process.stdout.write(`Session brief unavailable (${err.message}). Read AGENTS.md → TEAM.md §0 → CHECKPOINT.md → LESSONS.md.\n`);
}
