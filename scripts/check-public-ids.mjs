#!/usr/bin/env node
// Fails if ANY tracked file (docs, code, tests, migrations) contains something that works as a
// credential in a PUBLIC repo (LESSONS X1/X4): an old-convention test order id (3 letters + "123")
// or a real-era Shopee order number (26MMDD + 8 alphanumerics). An order id alone makes
// /api/lookup return an account's password and a live Guard code.
//
//   node scripts/check-public-ids.mjs                 # working tree, exit 1 on any hit
//   node scripts/check-public-ids.mjs --range A..B    # every commit in a push range (before pushing)
//
// Allowed: placeholders (EXAMPLE…, …ABCDEF…, abc123, <order_sn>, <test-order>) and pre-2026
// order numbers (Shopee-doc and fixture values).
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const PATTERNS = [
  { name: "old-convention test order id", re: /\b[a-z]{3}123\b/g },
  { name: "Shopee order number", re: /\b2[6-9][01][0-9][0-3][0-9][0-9A-Z]{8}\b/g },
];
const ALLOW = /EXAMPLE|ABCDEF|^abc123$/;
const SCANNED = /\.(md|ts|tsx|mjs|js|sql)$/;
const git = (...a) => execFileSync("git", a, { encoding: "utf8", maxBuffer: 64 << 20 });

function scan(label, text) {
  let hits = 0;
  text.split(/\r?\n/).forEach((line, i) => {
    for (const { name, re } of PATTERNS) {
      for (const m of line.matchAll(re)) {
        if (ALLOW.test(m[0])) continue;
        console.log(`FAIL ${label}:${i + 1}  ${name}: ${m[0]}`);
        hits++;
      }
    }
  });
  return hits;
}

let hits = 0;
const r = process.argv.indexOf("--range");
if (r > 0) {
  // Check every commit's full snapshot of changed files: a clean HEAD does not un-publish history.
  for (const sha of git("rev-list", process.argv[r + 1]).split("\n").filter(Boolean)) {
    const files = git("diff-tree", "--no-commit-id", "--name-only", "-r", "--diff-filter=AM", sha)
      .split("\n").filter((f) => f && SCANNED.test(f) && !f.startsWith("node_modules/"));
    for (const f of files) hits += scan(`${sha.slice(0, 7)}:${f}`, git("show", `${sha}:${f}`));
  }
} else {
  for (const f of git("ls-files").split("\n").filter((f) => f && SCANNED.test(f) && !f.startsWith("node_modules/"))) {
    try { hits += scan(f, readFileSync(f, "utf8")); } catch { /* deleted in working tree */ }
  }
}
console.log(`\n${hits} hit(s).`);
process.exit(hits ? 1 : 0);
