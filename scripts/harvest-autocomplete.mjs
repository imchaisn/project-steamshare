/**
 * harvest-autocomplete.mjs — read Shopee MY's public search-suggestion endpoint.
 *
 * WHY THIS EXISTS. Our Malay keyword choices "rest on general Malaysian commerce
 * vocabulary rather than observed search data" (.claude/skills/ss-market/SKILL.md).
 * The real demand sources — Top Keywords and the Ads Keyword Planner — are behind
 * Chaison's Seller Centre login and no agent can reach them. Shopee's own search
 * autocomplete is the one demand signal that is publicly queryable, and this reads it.
 *
 * WHAT IT IS, AND IS NOT. The endpoint returns an ORDERED list of completions plus a
 * relevance score per entry. It does NOT return search volume. Ordering is a ranking
 * signal, not a volume number, and nothing here should ever be reported as a volume.
 *
 *   GET https://shopee.com.my/api/v4/search/search_hint?keyword=<term>
 *   -> { keywords: [ { keyword, position, rnum, search_info: "<json string>" } ] }
 *
 * `search_info` is a JSON *string* holding `rank_scores` and `rewrite` (the term
 * Shopee normalised the query to). `rnum` has been 0 on every term observed so far —
 * do not read it as a result count without evidence.
 *
 * COURTESY. Public search box, queried at human pace: one request per second, a hard
 * cap on total queries, and an immediate stop on 403 or any non-200. It does not
 * touch the Seller API and needs no token or login.
 *
 * Usage:
 *   node scripts/harvest-autocomplete.mjs                 # full seed set
 *   node scripts/harvest-autocomplete.mjs --out FILE.json # write raw results
 *   node scripts/harvest-autocomplete.mjs "steam account" # ad-hoc terms
 */
import { writeFileSync } from "fs";
import { GAMES } from "./games-data.mjs";

const ENDPOINT = "https://shopee.com.my/api/v4/search/search_hint";
const DELAY_MS = 1000;
const MAX_QUERIES = 200;

/** Shared-account vocabulary — the question this repo has been guessing at. */
const VOCAB = [
  "steam account", "akaun steam", "shared account", "akaun steam murah",
  "steam account murah", "game pc", "game pc murah", "game pc original",
  "steam", "steam murah", "steam original", "steam offline", "steam pc",
  "akaun", "akaun game", "game steam", "game steam murah", "steam game",
  "original", "murah", "pc game", "digital game", "game digital",
  "steam key", "steam wallet", "steam gift card", "akaun steam offline",
  "steam account offline", "share account", "account sharing", "steam share",
];

const argv = process.argv.slice(2);
const outIdx = argv.indexOf("--out");
const OUT = outIdx > -1 ? argv[outIdx + 1] : null;
// Drop both `--out` and the path that follows it, or the path is harvested as a term.
const argTerms = argv.filter(
  (a, i) => !a.startsWith("--") && !(outIdx > -1 && i === outIdx + 1),
);

/** Catalogue seeds: the game title as a buyer would start typing it. */
const gameTerms = GAMES.map((g) => g.title.toLowerCase());

const terms = argTerms.length ? argTerms : [...VOCAB, ...gameTerms];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function hint(term) {
  const res = await fetch(`${ENDPOINT}?keyword=${encodeURIComponent(term)}`, {
    headers: {
      Accept: "application/json",
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
      Referer: "https://shopee.com.my/",
    },
  });
  if (res.status === 403) throw new Error("BLOCKED: 403 — stopping, as instructed");
  if (!res.ok) throw new Error(`STOP: HTTP ${res.status} on "${term}"`);
  const body = await res.json();
  const out = [];
  for (const k of body.keywords ?? []) {
    let info = {};
    try {
      info = JSON.parse(k.search_info ?? "{}");
    } catch {
      /* search_info is a JSON string; a parse failure just means no score */
    }
    out.push({
      suggestion: k.keyword,
      position: k.position,
      rnum: k.rnum,
      score: Array.isArray(info.rank_scores) ? info.rank_scores[0] : null,
      rewrite: info.rewrite ?? null,
    });
  }
  return out;
}

const results = [];
let queries = 0;
for (const term of terms.slice(0, MAX_QUERIES)) {
  try {
    const suggestions = await hint(term);
    queries++;
    results.push({ term, ok: true, count: suggestions.length, suggestions });
    const top = suggestions.slice(0, 5).map((s) => s.suggestion).join(" · ");
    console.log(`${String(suggestions.length).padStart(2)}  ${term.padEnd(38)} ${top}`);
  } catch (err) {
    console.error(`!! ${term}: ${err.message}`);
    results.push({ term, ok: false, error: String(err.message) });
    break;
  }
  await sleep(DELAY_MS);
}

console.log(`\n${queries} queries, ${results.filter((r) => r.ok).length} succeeded.`);
if (OUT) {
  writeFileSync(OUT, JSON.stringify({ harvestedAt: new Date().toISOString(), results }, null, 2));
  console.log(`raw -> ${OUT}`);
}
