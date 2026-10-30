/**
 * Which games could earn money today, and what is stopping the rest.
 *
 *   node scripts/publish-readiness.mjs
 *
 * The shop's stated problem has been "N games of finished art earning nothing" for weeks, with N
 * quoted from a hand-count that goes stale every time art is generated. This derives it instead,
 * from three sources joined on the Steam app id:
 *
 *   scripts/games-data.mjs   art exists (a game is in here iff its banners were rendered)
 *   lib/catalogue.ts         PURCHASABLE. `shopeeItemId` is present only when a listing was
 *                            confirmed NORMAL by scripts/shopee-listings.mjs. Deliberately NOT
 *                            read from `shopee_listings` — a mapping row is written BEFORE a
 *                            draft is published, so it proves nothing about buyability.
 *   docs/listing-copy.md     copy written, plus any 🔴 DO NOT LIST / ⚠️ VERIFY FIRST verdict
 *
 * A blocked game is not idle inventory — it is a game that must never be listed, and counting it
 * as opportunity is how someone ends up publishing a listing that cannot be delivered.
 */
import { readFileSync } from "fs";
import { join } from "path";

const HERE = import.meta.dirname;
const copy = readFileSync(join(HERE, "..", "docs", "listing-copy.md"), "utf8");
const catalogueSrc = readFileSync(join(HERE, "..", "lib", "catalogue.ts"), "utf8");
const { GAMES } = await import("./games-data.mjs");

// Purchasable = has a shopeeItemId in CATALOGUE.
const live = new Map();
for (const m of catalogueSrc.matchAll(
  /steamAppId:\s*(\d+)[^}]*?shopeeItemId:\s*(\d+)/g,
)) {
  live.set(m[1], m[2]);
}

// Copy blocks are headed `## <label>. <Name> — App <id>`, optionally carrying a verdict marker.
//
// An app id can appear TWICE. docs/listing-copy.md has duplicate Part 4/Part 5 headings written by
// two concurrent sessions, and eight games are in there twice — left that way on Chaison's
// instruction. Four of them (Star Wars Outlaws, AC Shadows, AC Valhalla, RDR2) carry
// `🔴 DO NOT LIST` on the FIRST heading and nothing on the second.
//
// So blocks are collected as a LIST per id and the most severe verdict wins. Keeping only the last
// heading — the obvious implementation, and the one this script shipped with for ten minutes —
// silently cleared the DO NOT LIST on all four and filed them as opportunity. A safety verdict must
// never be erasable by a later duplicate that simply forgot to repeat it.
// The delimiter before `App` is an em-dash in 47 headings and a PLAIN HYPHEN in 9 (the whole
// J-series, written by a different session). Matching only the em-dash drops all nine — which
// reported six games as "needs copy written" when their copy was already there, i.e. it would have
// sent someone to redo finished work. Accept —, – and -.
const blocks = new Map();
for (const m of copy.matchAll(/^##\s+(.+?)\s+[—–-]\s+App\s+(\d+)(.*)$/gm)) {
  if (!blocks.has(m[2])) blocks.set(m[2], []);
  blocks.get(m[2]).push({ heading: m[1], tail: m[3] || "" });
}

// Verdicts stated in the 2026-09-07 SEO/roast table rather than in a heading.
const TABLE_VERDICT = [
  [/EA SPORTS FC 26/i, "DO NOT LIST"],
  [/WWE 2K26/i, "DO NOT LIST"],
  [/Split Fiction/i, "VERIFY FIRST"],
];

function verdictFor(g) {
  const list = blocks.get(String(g.id)) || [];
  // Severity order: any DO NOT LIST anywhere beats any VERIFY FIRST beats none.
  if (list.some((b) => /DO NOT LIST/i.test(b.tail))) return "DO NOT LIST";
  for (const [re, v] of TABLE_VERDICT) if (re.test(g.title) && v === "DO NOT LIST") return v;
  // The J-series states its caveat in prose — "⚠️ verify the EA account prompt first" — not as the
  // literal string VERIFY FIRST. A publisher-account prompt is the exact thing that makes a game
  // unusable in Offline Mode, so this must not be missed for want of matching a phrase.
  if (list.some((b) => /VERIFY FIRST/i.test(b.tail) || (/⚠/.test(b.tail) && /verify/i.test(b.tail))))
    return "VERIFY FIRST";
  for (const [re, v] of TABLE_VERDICT) if (re.test(g.title)) return v;
  return null;
}

// Games with copy written but NO art rendered — they never reach the buckets below, because those
// iterate games-data.mjs. Split Fiction is one: it has a ⚠️ VERIFY FIRST verdict and no banners, so
// without this it silently reads as "0 to verify", which looks like the question was settled.
const copyOnly = [...blocks.entries()]
  .filter(([id]) => !GAMES.some((g) => String(g.id) === id))
  .map(([id, list]) => ({ id, heading: list[0].heading }));

const rows = GAMES.map((g) => {
  const id = String(g.id);
  return {
    slug: g.slug,
    title: g.title,
    id,
    itemId: live.get(id) || null,
    hasCopy: blocks.has(id),
    verdict: verdictFor(g),
  };
});

const purchasable = rows.filter((r) => r.itemId);
const blocked = rows.filter((r) => !r.itemId && r.verdict === "DO NOT LIST");
const verify = rows.filter((r) => !r.itemId && r.verdict === "VERIFY FIRST");
const readyCopy = rows.filter((r) => !r.itemId && !r.verdict && r.hasCopy);
const noCopy = rows.filter((r) => !r.itemId && !r.verdict && !r.hasCopy);

const pad = (s, n) => String(s).padEnd(n);
const section = (label, list, note) => {
  console.log(`\n${label}: ${list.length}`);
  if (note) console.log(`  ${note}`);
  for (const r of list) {
    console.log(`  ${pad(r.title, 42)} ${pad(r.slug, 30)} ${r.itemId ? "item " + r.itemId : ""}`);
  }
};

console.log(`art rendered for ${GAMES.length} games; ${purchasable.length} are purchasable today.`);

section("✅ LIVE / PURCHASABLE", purchasable);
section(
  "🟢 COPY WRITTEN, NOT PURCHASABLE — the actual opportunity",
  readyCopy,
  "Art and copy both done. Needs: publish on Shopee, map (item_id, model_id), confirm NORMAL, then add to lib/catalogue.ts.",
);
section(
  "🟡 ART ONLY, NO COPY BLOCK",
  noCopy,
  "Needs a title + description in docs/listing-copy.md before anything else.",
);
section(
  "⚠️ VERIFY BEFORE LISTING",
  verify,
  "A stated risk is unresolved. Do not publish on the strength of art existing.",
);
section(
  "🔴 DO NOT LIST",
  blocked,
  "Publisher-account, DRM or activation requirements an Offline-Mode buyer cannot satisfy. NOT idle inventory.",
);

console.log(`\n📝 COPY BLOCK BUT NO ART RENDERED: ${copyOnly.length}`);
console.log("  Not in games-data.mjs, so absent from every bucket above. Run scripts/gen-banners.mjs.");
for (const c of copyOnly) console.log(`  ${pad(c.heading, 52)} App ${c.id}`);

console.log(
  `\nreal opportunity = ${readyCopy.length} ready + ${noCopy.length} needing copy = ${
    readyCopy.length + noCopy.length
  } games; ${blocked.length} permanently blocked, ${verify.length} to verify.`,
);
console.log(
  "reminder: publishing is Chaison's call, and the pre-publish payout check (scratchpad/e2e.mjs) NO LONGER EXISTS — see CHECKPOINT.md.",
);
