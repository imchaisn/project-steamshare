/**
 * Deterministic claim + title audit for the Shopee shop.
 *
 *   node scripts/audit-listing-copy.mjs          report only
 *   node scripts/audit-listing-copy.mjs --fix    also correct wrong stated char counts
 *
 * Exits 1 if anything actionable is found, so it can gate a listing change.
 *
 * WHY THIS IS A COMMITTED TOOL AND NOT A SCRATCH SCRIPT
 * -----------------------------------------------------
 * This audit was first written as a throwaway in a temp directory on 2026-09-07 — the same
 * session that discovered the entire `scratchpad/` directory had vanished, taking `verifycopy.mjs`
 * (the copy-drift detector), `e2e.mjs` (the pre-publish payout check) and `refix.mjs` (the
 * re-listed-draft check) with it. All three are still cited across CHECKPOINT.md and docs/ as
 * though they exist; none were ever committed, so none are recoverable. An audit that lives
 * outside git is an audit that will be missing the next time someone needs it.
 *
 * WHAT IT CHECKS, AND WHY EACH ONE EARNED ITS PLACE
 * ------------------------------------------------
 * 1. Titles over Shopee's 120-character cap.
 * 2. Stated character counts that disagree with the actual text. Not pedantry: the 2026-09-07 run
 *    found 9 of 49 stated counts wrong (18%), deltas -5 to +2. The shop's strategy is to FILL the
 *    120 cap, so a title believed to sit at 107 that really sits at 109 has 11 characters of
 *    headroom, not 13.
 * 3. Corrupt/empty/multiline titles.
 * 4. Co-op wording. This is the one that keeps regressing. Chaison's 2026-09-07 override permits a
 *    co-op claim ONLY where Steam lists Shared/Split Screen Co-op — an offline buyer cannot reach
 *    online co-op. Two titles legitimately carry one (Call of Duty: WWII, Split Fiction). This
 *    check REPORTS them for eyeballing; it does not fail the run, because they are correct.
 * 5. Every buyer-visible string in games-data.mjs against the claim rules. The `FREE DLC INCLUDED`
 *    badge on four LIVE listings was found this way and by no other means — previous passes read
 *    titles and code, never the rendered artifact or its data.
 * 6. External URLs in shipping copy. The shop's #1 tracked violation risk had no deterministic
 *    gate until 2026-09-07: Shopee MY's Listing Violation Guide treats an external URL that
 *    directs transactions off-platform as a Listing Violation — 1 penalty point per 2 deleted
 *    listings, and 3 points caps the shop at 100 listings for 28 days. The description template
 *    prints the shop domain twice, so every description built from it inherits both. This check
 *    reads ONLY the shipping blocks — title, keyword line, description body — never prose,
 *    headings or tables, because the surrounding document legitimately names the domain in order
 *    to name the rule, and a whole-file grep therefore trips on the very notes warning against it.
 */
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

const HERE = import.meta.dirname;
const COPY = join(HERE, "..", "docs", "listing-copy.md");
const CAP = 120;
const FIX = process.argv.includes("--fix");

// ---------------------------------------------------------------- titles

// Label forms in use: `**Title**`, `**Title — currently applied**`, `**Proposed title**`,
// each optionally followed by `(<count>, <priority>)`. The em-dash is intentional.
const LABEL = /^\*\*(Title|Title — currently applied|Proposed title)\*\*\s*(?:\((\d+)([^)]*)\))?\s*$/;

function parseTitles(lines) {
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const m = LABEL.exec(lines[i].trim());
    if (!m) continue;
    let j = i + 1;
    while (j < lines.length && lines[j].trim() === "") j++;
    if (j >= lines.length || !lines[j].trim().startsWith("```")) continue;
    j++;
    const buf = [];
    while (j < lines.length && !lines[j].trim().startsWith("```")) buf.push(lines[j++]);
    out.push({
      index: i,
      line: i + 1,
      kind: m[1],
      stated: m[2] ? Number(m[2]) : null,
      rest: m[3] ?? "",
      title: buf.join("\n").trim(),
    });
  }
  return out;
}

const raw = readFileSync(COPY, "utf8");
// Preserve whatever line ending the file already uses — rewriting CRLF as LF (or the reverse)
// would rewrite all ~3700 lines and bury a two-character fix in a whole-file diff.
const eol = raw.includes("\r\n") ? "\r\n" : "\n";
const lines = raw.split(/\r?\n/);
const titles = parseTitles(lines);

const overCap = [];
const misCount = [];
const corrupt = [];
const coop = [];
const COOP_RE = /\bco-?op\b|\bmultiplayer\b|\bonline\b|\bpvp\b/i;

/**
 * Titles whose co-op wording is VERIFIED correct, with the evidence.
 *
 * This used to be a sentence printed at the bottom of the report naming two
 * games. That is not checkable, and it went stale: WARRIORS OROCHI 3 carries a
 * legitimate `LOCAL CO-OP` and was reported as suspect for a day because the
 * sentence had never been updated. A reviewer who "fixes" a correct listing to
 * satisfy a stale note has been made worse off by the audit.
 *
 * The entitlement test is Steam's category list containing the EXACT string
 * `Shared/Split Screen Co-op` (Chaison's override, 2026-09-07 — an offline
 * buyer can reach local co-op and cannot reach online co-op).
 *
 * ⚠️ IT MUST BE THE EXACT STRING, NOT A LOOSE MATCH. `/shared\/split screen/i`
 * also matches `Shared/Split Screen PvP`, which WARRIORS OROCHI 3 and Call of
 * Duty: WWII both additionally carry — so the loose form would authorise a
 * co-op claim on a PvP-only title. That is how a co-op claim gets onto a game
 * with no local co-op at all.
 *
 * To add a title: fetch `store.steampowered.com/api/appdetails?appids=<id>`,
 * confirm the exact category string is present, then record the app id and the
 * date you checked. No entry without an app id.
 */
const COOP_VERIFIED = [
  { match: "warriors orochi 3", app: 1879330, checked: "2026-09-08" },
  { match: "call of duty wwii", app: 476600, checked: "2026-09-08" },
  { match: "split fiction", app: 2001120, checked: "2026-09-08" },
];

const coopVerifiedFor = (title) => {
  const t = title.toLowerCase();
  return COOP_VERIFIED.find((v) => t.includes(v.match)) ?? null;
};

for (const e of titles) {
  const n = e.title.length;
  if (!e.title || n < 8 || e.title.includes("\n")) {
    corrupt.push({ e, n });
    continue;
  }
  if (n > CAP) overCap.push({ e, n });
  if (e.stated !== null && e.stated !== n) misCount.push({ e, n });
  if (COOP_RE.test(e.title)) coop.push({ e, n });
}

// -------------------------------------------------- external URLs (§6)

// Two shapes, because both appear in the live copy: an explicit scheme or `www.` prefix, and a
// bare `host.tld` with an optional path (`gameshare.space/tutorial`). The TLD list is closed on
// purpose — an open `\.\w+` pattern matches "e.g", ordinary sentence-ending abbreviations and
// version numbers, and a check that cries wolf gets switched off.
const TLD = "com|net|org|io|co|my|space|shop|store|gg|app|site|link|xyz|info";
const URL_RE = new RegExp(
  `(?:https?:\\/\\/|www\\.)[^\\s<>"'\`)\\]]+` +
    `|\\b(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\\.)+(?:${TLD})\\b(?:\\/[^\\s<>"'\`)\\]]*)?`,
  "gi",
);

// The shipping blocks, and nothing else. A label line, then the first fenced block under it.
const DESC_LABEL = /^\*\*(Description|Description template)\*\*/;
// `**Keywords:** a, b, c` and `**Keywords** (P5): a, b, c` — the copy sits on the label line.
const KEYWORD_LABEL = /^\*\*Keywords:?\*\*\s*(?:\([^)]*\)\s*:?)?\s*(.*)$/;

function parseDescriptions(src) {
  const out = [];
  for (let i = 0; i < src.length; i++) {
    if (!DESC_LABEL.test(src[i].trim())) continue;
    // The label sentence can wrap onto the next line or two before the fence opens — the
    // `**Description template**` block at the top of the file does exactly that, and skipping
    // only blank lines silently missed it, which is the one block every other description is
    // copied from. Scan a short way for the fence, giving up at a heading or the next label.
    let j = i + 1;
    while (
      j < src.length &&
      j - i <= 6 &&
      !src[j].trim().startsWith("```") &&
      !src[j].startsWith("#") &&
      !DESC_LABEL.test(src[j].trim()) &&
      !LABEL.test(src[j].trim())
    ) {
      j++;
    }
    if (j >= src.length || !src[j].trim().startsWith("```")) continue;
    j++;
    const start = j;
    while (j < src.length && !src[j].trim().startsWith("```")) j++;
    const kind = DESC_LABEL.exec(src[i].trim())[1];
    out.push({ kind, label: `${kind}@L${i + 1}`, start, body: src.slice(start, j) });
  }
  return out;
}

const urlHits = [];
const scan = (block, line, text) => {
  for (const m of String(text).matchAll(URL_RE)) {
    // Copy reads `Go to www.example.com, enter it` — the sentence comma is not part of the URL.
    urlHits.push({ block, line, hit: m[0].replace(/[.,;:!?)]+$/, "") });
  }
};

for (const e of titles) scan(`${e.kind}@L${e.line}`, e.line + 2, e.title);

for (let i = 0; i < lines.length; i++) {
  const m = KEYWORD_LABEL.exec(lines[i].trim());
  if (m && m[1]) scan(`Keywords@L${i + 1}`, i + 1, m[1]);
}

const descriptions = parseDescriptions(lines);
for (const d of descriptions) {
  d.body.forEach((text, k) => scan(d.label, d.start + k + 1, text));
}

// ------------------------------------------------------- banner claims

const RULES = [
  ["ONLINE/CO-OP", /\b(online|multiplayer|co-?op|pvp|with friends|server|matchmaking|crossplay|cross-platform)\b/i],
  ["LIFETIME/GUARANTEE", /\b(lifetime|life time|guarantee|guaranteed|warranty|forever|permanent)\b/i],
  ["REFUND", /\brefund/i],
  ["INSTANT", /\b(instant|instantly|immediately)\b/i],
  ["DLC/FREE-EXTRA", /\b(dlc|bonus)\b/i],
];

const { GAMES } = await import("./games-data.mjs");
const claimHits = [];
for (const g of GAMES) {
  const surfaces = [
    ["title", g.title],
    ["genre", g.genre],
    ["badge3", (g.badge3 || "").replace(/\n/g, " ")],
    ...g.features.flatMap((f, i) => [
      [`feat${i + 1}.head`, f.head],
      [`feat${i + 1}.body`, f.body],
    ]),
  ];
  for (const [where, text] of surfaces) {
    if (!text) continue;
    for (const [rule, re] of RULES) {
      const m = re.exec(text);
      if (m) claimHits.push({ slug: g.slug, where, rule, hit: m[0], text });
    }
  }
}

// ---------------------------------------------------------------- fix

let fixed = 0;
if (FIX && misCount.length) {
  for (const { e, n } of misCount) {
    lines[e.index] = `**${e.kind}** (${n}${e.rest})`;
    fixed++;
  }
  writeFileSync(COPY, lines.join(eol), "utf8");
}

// -------------------------------------------------------------- report

const p = (s = "") => console.log(s);
p(`listing-copy.md: ${titles.length} title entries, ${titles.filter((t) => t.stated !== null).length} with a stated count`);
p(`games-data.mjs:  ${GAMES.length} games`);
p();

p(`OVER ${CAP}-CHAR CAP: ${overCap.length}`);
overCap.forEach(({ e, n }) => p(`  L${e.line} ${n} chars  ${e.title.slice(0, 90)}`));

p(`CORRUPT/EMPTY/MULTILINE: ${corrupt.length}`);
corrupt.forEach(({ e, n }) => p(`  L${e.line} ${n} chars  ${JSON.stringify(e.title.slice(0, 60))}`));

p(`STATED COUNT != ACTUAL: ${misCount.length}${fixed ? ` (${fixed} corrected)` : ""}`);
misCount.forEach(({ e, n }) =>
  p(`  L${e.line} stated=${e.stated} actual=${n} (${n - e.stated > 0 ? "+" : ""}${n - e.stated})  ${e.title.slice(0, 70)}`),
);

p();
const coopSuspect = coop.filter(({ e }) => !coopVerifiedFor(e.title));
const coopOk = coop.filter(({ e }) => coopVerifiedFor(e.title));

p(`CO-OP / ONLINE WORDING: ${coopSuspect.length} suspect, ${coopOk.length} verified — review, do not auto-fix`);
coopSuspect.forEach(({ e }) => p(`  SUSPECT   L${e.line}  ${e.title.slice(0, 100)}`));
coopOk.forEach(({ e }) => {
  const v = coopVerifiedFor(e.title);
  p(`  verified  L${e.line}  app ${v.app} (${v.checked})  ${e.title.slice(0, 74)}`);
});
p(`  Allowed ONLY where Steam's categories contain the EXACT string "Shared/Split Screen Co-op"`);
p(`  (Chaison override, 2026-09-07). Not a loose match — "Shared/Split Screen PvP" is not co-op.`);
p(`  "verified" rows carry the app id that was checked. To add one, see COOP_VERIFIED in this file.`);

p();
p(`BANNER CLAIM FLAGS: ${claimHits.length}`);
for (const h of claimHits) p(`  ${h.rule.padEnd(20)} ${h.slug} [${h.where}] "${h.hit}"`);
if (claimHits.length) {
  p(`  NOTE: gameplay language ("free-roam", "free mode") is a false positive. A DLC or`);
  p(`  extra-content promise is NOT — it is a per-ACCOUNT fact nobody has verified per account.`);
}

p();
p(`EXTERNAL URL IN SHIPPING COPY: ${urlHits.length} in ${new Set(urlHits.map((h) => h.block)).size} block(s)`);
const shownUrls = urlHits.slice(0, 120);
shownUrls.forEach((h) => p(`  L${h.line} [${h.block}] ${h.hit}`));
if (urlHits.length > shownUrls.length) p(`  ... and ${urlHits.length - shownUrls.length} more`);
if (urlHits.length) {
  p(`  Shopee MY: an external URL directing transactions off-platform is a Listing Violation —`);
  p(`  1 penalty point per 2 deleted listings, 3 points caps the shop at 100 listings for 28 days.`);
  p(`  Retrieval instructions belong in the Shopee chat message, which is already automated.`);
  p(`  Prose, headings and tables are NOT scanned, so every hit above is copy that reaches Shopee.`);
}

const actionable =
  overCap.length + corrupt.length + (misCount.length - fixed) + claimHits.length + urlHits.length;
p();
p(actionable === 0 ? "CLEAN — nothing actionable." : `${actionable} actionable finding(s).`);
process.exit(actionable === 0 ? 0 : 1);
