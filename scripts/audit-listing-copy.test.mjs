// Self-test for the §6 URL regex in scripts/audit-listing-copy.mjs.
// The pattern below is copied verbatim from that file; if it drifts, this test is meaningless.
const TLD = "com|net|org|io|co|my|space|shop|store|gg|app|site|link|xyz|info";
const URL_RE = new RegExp(
  `(?:https?:\\/\\/|www\\.)[^\\s<>"'\`)\\]]+` +
    `|\\b(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\\.)+(?:${TLD})\\b(?:\\/[^\\s<>"'\`)\\]]*)?`,
  "gi",
);

const strip = (s) => s.replace(/[.,;:!?)]+$/, "");

const cases = [
  // MUST flag — these are the shapes actually present in the live copy
  ["Go to www.gameshare.space, enter it", "www.gameshare.space"],
  ["Full guide: www.gameshare.space/tutorial", "www.gameshare.space/tutorial"],
  ["2. Go to www.gameshare.space and enter it", "www.gameshare.space"],
  ["Visit https://shopee.com.my/gameshare today", "https://shopee.com.my/gameshare"],
  ["bare gameshare.space/tutorial link", "gameshare.space/tutorial"],
  ["contact us at gameshare.space", "gameshare.space"],
  // MUST NOT flag — real lines from descriptions, titles and keyword sets
  ["Play in Offline Mode", null],
  ["Turn Steam Cloud OFF - it can overwrite other players' saves", null],
  ["- Support through Shopee chat", null],
  ["- This is a SHARED account, not a personal account", null],
  ["A Steam Guard code whenever Steam asks for one", null],
  ["Marvels Spider-Man 2 | Steam PC Game | FULL GAME | 24H AUTO DELIVERY | ORIGINAL | OFFLINE", null],
  ["SEKIRO: SHADOWS DIE TWICE - GOTY EDITION — Steam shared account", null],
  ["sekiro, goty edition, steam account, original pc game, full game, offline", null],
  ["Peter and Miles share one New York, e.g. Queens and Brooklyn", null],
  ["1. Pay, then open your Shopee chat with us", null],
  ["Type it into Steam straight away - the code is short-lived", null],
];

let failed = 0;
for (const [input, want] of cases) {
  URL_RE.lastIndex = 0;
  const m = [...input.matchAll(URL_RE)].map((x) => strip(x[0]));
  const got = m.length ? m[0] : null;
  const ok = got === want;
  if (!ok) {
    failed++;
    console.log(`FAIL  ${JSON.stringify(input)}\n      want ${JSON.stringify(want)}  got ${JSON.stringify(got)}`);
  }
}
// ─────────────────────────────────────────────────────────────────────────────
// Self-test for the §4 co-op allowlist. Same caveat as above: COOP_VERIFIED and
// coopVerifiedFor are copied verbatim from scripts/audit-listing-copy.mjs, so if
// they drift this test is meaningless.
//
// Why this suite exists: the allowlist used to be a sentence in the report
// naming two games, and it went stale. WARRIORS OROCHI 3 has a legitimate
// `LOCAL CO-OP` and was reported as suspect, which invites a reviewer to
// "correct" a listing that was already right.
// ─────────────────────────────────────────────────────────────────────────────

const COOP_VERIFIED = [
  { match: "warriors orochi 3", app: 1879330, checked: "2026-09-08" },
  { match: "call of duty wwii", app: 476600, checked: "2026-09-08" },
  { match: "split fiction", app: 2001120, checked: "2026-09-08" },
];
const coopVerifiedFor = (title) => {
  const t = title.toLowerCase();
  return COOP_VERIFIED.find((v) => t.includes(v.match)) ?? null;
};

const coopCases = [
  // Verified — real title lines from listing-copy.md. Must NOT be reported suspect.
  ["WARRIORS OROCHI 3 Ultimate | Steam PC Game | FULL GAME | 24H AUTO DELIVERY | ORIGINAL | LOCAL CO-OP", 1879330],
  ["Call of Duty WWII COD WW2 Steam PC Game | War Shooter | Akaun Steam | 24H Auto Delivery | Offline Local Co-Op", 476600],
  ["Split Fiction Steam PC Game | 2 Player Split Screen Co-op Hazelight | Akaun Steam | 24H Auto Delivery | LOCAL CO-OP", 2001120],
  // Not verified — a co-op claim on any of these must still surface for review.
  ["TEKKEN 8 Steam PC Game | Fighting Game | Akaun Steam | ONLINE", null],
  ["Palworld | Akaun Steam | Game PC Original | Multiplayer", null],
  ["Some Unlisted Game | Steam PC Game | LOCAL CO-OP", null],
];

for (const [title, wantApp] of coopCases) {
  const got = coopVerifiedFor(title);
  const ok = (got?.app ?? null) === wantApp;
  if (!ok) {
    failed++;
    console.log(`FAIL  co-op ${JSON.stringify(title.slice(0, 60))}\n      want app ${wantApp}  got ${got?.app ?? null}`);
  }
}

// The distinction the whole rule turns on. Both of these titles carry
// "Shared/Split Screen PvP" on Steam as well as the co-op category, so a loose
// regex cannot tell an entitled title from a PvP-only one.
const STRICT = "Shared/Split Screen Co-op";
const LOOSE = /shared\/split screen/i;
const pvpOnlyCategories = ["Multi-player", "PvP", "Shared/Split Screen PvP", "Shared/Split Screen"];

if (pvpOnlyCategories.includes(STRICT)) {
  failed++;
  console.log("FAIL  strict test wrongly authorised a PvP-only category list");
}
if (!pvpOnlyCategories.some((c) => LOOSE.test(c))) {
  failed++;
  console.log("FAIL  the loose regex was expected to match PvP-only categories — premise of this test is broken");
}

const total = cases.length + coopCases.length + 2;
console.log(failed === 0 ? `PASS — all ${total} cases` : `${failed} of ${total} FAILED`);
process.exit(failed === 0 ? 0 : 1);
