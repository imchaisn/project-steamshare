/**
 * pre-purchase-check.mjs — run the gate BEFORE the money leaves.
 *
 *   node scripts/pre-purchase-check.mjs "NBA 2K27"
 *   node scripts/pre-purchase-check.mjs 4356430
 *   node scripts/pre-purchase-check.mjs --self-test
 *
 * ── WHY THIS EXISTS ──────────────────────────────────────────────────────
 * On 2026-09-08, seven supplier orders were bought and FIVE could not be sold:
 * NBA 2K27 (2K Sports Account), STAR WARS Zero Company (EA Account + internet),
 * AC Odyssey and AC Black Flag (Ubisoft account we cannot deliver), and one
 * duplicate. Every one was sold as "Own Steam Account, Offline Mode". Every one
 * would have been caught by the single HTTP call this script makes.
 *
 * The supplier's variant name is marketing, not evidence. Steam's own metadata
 * is evidence. This script is the ten-second version of that distinction.
 *
 * Needs no credentials, no .env.local, no database, and no supplier portal. It
 * talks to store.steampowered.com and nothing else — deliberately, so it is safe
 * to run anywhere and can never leak an order id.
 *
 * ── THE ONE THING A NAIVE VERSION GETS WRONG ─────────────────────────────
 * Bare Denuvo is NOT a blocker. Batman: Arkham Knight and Football Manager 26
 * both disclose Denuvo with no published cap and we sell both today. A script
 * that blocked on the word "Denuvo" would contradict a verdict this repo has
 * already taken and cost us sellable stock. Only Denuvo WITH a published machine
 * cap blocks — see classifyDrm().
 */

const API = "https://store.steampowered.com/api";
const CC = "my";

/* ── Fetch ─────────────────────────────────────────────────────────────── */

async function getJson(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30_000);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Resolve a game NAME to an app id.
 *
 * This is the common case, not a nicety: Chaison is looking at a supplier's
 * product page that gives a name and no id. Every match is printed rather than
 * silently taking the first, because check 3 of the gate exists precisely
 * because wrong ids resolve to real, unrelated games — five were caught in one
 * round ("Leisure Town" for LEGO Star Wars, "CUPHEAD" for The Evil Within).
 */
async function resolveName(term) {
  const j = await getJson(`${API}/storesearch/?term=${encodeURIComponent(term)}&cc=${CC}&l=en`);
  const items = j.items ?? [];
  if (items.length === 0) return { id: null, items };

  const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const exact = items.find((i) => norm(i.name) === norm(term));
  return { id: String((exact ?? items[0]).id), items, exact: Boolean(exact) };
}

async function getApp(appid) {
  const j = await getJson(`${API}/appdetails?appids=${appid}&cc=${CC}`);
  const row = j?.[String(appid)];
  if (!row || !row.success) return null;
  return row.data;
}

/* ── Classification ────────────────────────────────────────────────────── */

const strip = (s) => String(s ?? "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

/**
 * The two DRM classes, and the distinction is the whole point of the script.
 *
 *   BLOCK — a published machine/activation cap. Far Cry 6 discloses 5-a-day
 *           against our own ACCOUNT_MAX_BUYERS default of 5, so a full account
 *           sits exactly at the ceiling. WWE 2K26 the same.
 *   FLAG  — Denuvo with no cap. Sellable. We ship two such titles today.
 */
function classifyDrm(drmNotice) {
  const t = strip(drmNotice);
  if (!t) return { level: "none", detail: "" };

  const hasDenuvo = /denuvo/i.test(t);
  // A cap is a NUMBER near machine/device/activation wording. "Denuvo
  // Anti-tamper" and "Denuvo Antitamper" carry no digits and must not match.
  const capped = /\d+\s*[^.;]{0,40}(machine|device|pc\b|computer|activation)/i.test(t) ||
    /activation limit/i.test(t);

  if (capped) return { level: "block", detail: t, why: "a published machine/activation cap" };
  if (hasDenuvo) return { level: "flag", detail: t, why: "Denuvo with no published cap" };
  return { level: "flag", detail: t, why: "an undocumented DRM notice" };
}

/**
 * legal_notice — the field the five-check gate does not cover, and the reason
 * this script exists rather than a shell one-liner.
 *
 * `FACT-V` 2026-09-08: STAR WARS Zero Company (app 2075800) has BOTH
 * drm_notice and ext_user_account_notice EMPTY, yet its legal_notice reads
 * "Internet connection; EA Account" and "You must link your EA and Steam
 * Accounts to play". The gate as written in BRIEF-PREORDER.md would have passed
 * it as safe to buy. It was bought, and it cannot be sold.
 *
 * STRONG patterns name a publisher account outright -> block.
 * SOFT patterns are boilerplate-prone (nearly every EA/2K legal blob says
 * "internet connection") -> flag for a human, never an automatic block.
 *
 * Validated 2026-09-08 against titles we SELL today: Football Manager 26 and
 * Batman: Arkham Knight both return STRONG=0 SOFT=0, so this cannot quietly
 * block existing stock.
 */
const STRONG_PATTERNS = [
  /\b(EA|Ubisoft|Rockstar|2K|Epic Games|Blizzard|Battle\.net|Bethesda|Xbox|PSN|Origin|Social Club|Uplay)\b[^.;]{0,30}\bAccount\b/i,
  /must link your [^.;]{0,60}account/i,
  /requires? [^.;]{0,30}\b(EA|Ubisoft|Rockstar|2K)\b[^.;]{0,20}account/i,
];

const SOFT_PATTERNS = [
  /internet connection/i,
  /always[- ]online/i,
  /online activation/i,
  /limited to one [^.;]{0,40}account/i,
];

function classifyLegal(legalNotice) {
  const t = strip(legalNotice);
  if (!t) return { level: "none", quotes: [] };

  /**
   * Quote the surrounding sentence fragment. Trimmed to WORD boundaries and
   * marked with an ellipsis when clipped — a quote that starts mid-word
   * ("ilable for separate purchase...") reads as a bug and undermines the
   * evidence it is there to present.
   */
  const quote = (re) => {
    const m = t.match(new RegExp(`[^.;]{0,80}${re.source}[^.;]{0,80}`, "i"));
    if (!m) return null;
    let q = m[0].trim();
    // Only an alphanumeric neighbour means we genuinely cut through a word.
    // Testing /\S/ instead fires on punctuation the context regex legitimately
    // stopped at (";"), which ate a whole real word and left "…Account".
    const midWord = (ch) => /[A-Za-z0-9]/.test(ch ?? "");
    if (m.index > 0 && midWord(t[m.index - 1]) && /^\S+\s/.test(q)) {
      q = q.replace(/^\S+\s+/, "…");
    }
    const end = m.index + m[0].length;
    if (end < t.length && midWord(t[end]) && /\s\S+$/.test(q)) {
      q = q.replace(/\s+\S+$/, "…");
    }
    return q;
  };

  const strong = STRONG_PATTERNS.filter((r) => r.test(t)).map(quote).filter(Boolean);
  if (strong.length) return { level: "block", quotes: strong.slice(0, 2) };

  const soft = SOFT_PATTERNS.filter((r) => r.test(t)).map(quote).filter(Boolean);
  if (soft.length) return { level: "flag", quotes: soft.slice(0, 2) };

  return { level: "none", quotes: [] };
}

/** Run the gate. Returns a verdict plus per-check evidence. */
export function evaluate(d) {
  const checks = [];
  const blockers = [];
  const flags = [];

  // 1 — type
  const isGame = d.type === "game";
  checks.push({ n: 1, name: "type is 'game'", value: d.type, pass: isGame });
  if (!isGame) blockers.push(`type is "${d.type}", not a game`);

  // 2 — fullgame absent (the edition trap)
  const fg = d.fullgame;
  checks.push({
    n: 2,
    name: "fullgame absent",
    value: fg ? `PRESENT -> parent ${fg.appid} "${fg.name}"` : "(absent)",
    pass: !fg,
  });
  if (fg) {
    blockers.push(
      `this id is an edition/DLC SKU. Re-run against the PARENT: ` +
        `node scripts/pre-purchase-check.mjs ${fg.appid}`,
    );
  }

  // 3 — name (human confirms; the script cannot know intent)
  checks.push({ n: 3, name: "resolved name", value: d.name, pass: null });

  // 4 — Single-player
  const cats = (d.categories ?? []).map((c) => c.description);
  const solo = cats.includes("Single-player");
  const split = cats.some((c) => /Shared\/Split Screen(?!\s*PvP)/i.test(c));
  checks.push({ n: 4, name: "Single-player present", value: solo ? "PRESENT" : "ABSENT", pass: solo });
  if (!solo) blockers.push("no Single-player category — a solo offline buyer has nothing to play");

  // 5a — third-party account, declared in the dedicated field
  const ext = strip(d.ext_user_account_notice);
  checks.push({ n: 5, name: "ext_user_account_notice empty", value: ext || "(empty)", pass: !ext });
  if (ext) blockers.push(`third-party publisher account required: "${ext}"`);

  // 5b — DRM
  const drm = classifyDrm(d.drm_notice);
  checks.push({
    n: 5,
    name: "drm_notice empty",
    value: drm.detail || "(empty)",
    pass: drm.level === "none",
  });
  if (drm.level === "block") blockers.push(`DRM with ${drm.why}: "${drm.detail}"`);
  else if (drm.level === "flag") flags.push(`DRM disclosed — ${drm.why}: "${drm.detail}"`);

  // 5c — legal_notice (NOT in the original five checks; see classifyLegal)
  const legal = classifyLegal(d.legal_notice);
  checks.push({
    n: 5,
    name: "legal_notice clean [EXTRA]",
    value: legal.level === "none" ? "(nothing relevant)" : legal.quotes.join(" // "),
    pass: legal.level === "none",
  });
  if (legal.level === "block") {
    blockers.push(`legal_notice declares a publisher account: "${legal.quotes[0]}"`);
  } else if (legal.level === "flag") {
    flags.push(`legal_notice mentions connectivity: "${legal.quotes[0]}"`);
  }

  if (d.release_date?.coming_soon) flags.push("UNRELEASED — coming_soon is true");

  const verdict = blockers.length ? "DO_NOT_BUY" : flags.length ? "NEEDS_HUMAN" : "SAFE";
  return { verdict, blockers, flags, checks, solo, split, cats, name: d.name, appid: d.steam_appid,
    price: d.price_overview?.final_formatted ?? "n/a" };
}

/* ── Output ────────────────────────────────────────────────────────────── */

const BANNER = {
  SAFE: "🟢 SAFE TO BUY",
  NEEDS_HUMAN: "⚠️  NEEDS A HUMAN",
  DO_NOT_BUY: "🔴 DO NOT BUY",
};

function report(r) {
  console.log("");
  console.log(`${BANNER[r.verdict]}  —  ${r.name}  (app ${r.appid}, ${r.price})`);
  console.log("");

  if (r.blockers.length) {
    console.log("  WHY NOT:");
    for (const b of r.blockers) console.log(`    🔴 ${b}`);
    console.log("");
  }
  if (r.flags.length) {
    console.log("  CHECK BEFORE BUYING:");
    for (const f of r.flags) console.log(`    ⚠️  ${f}`);
    if (r.flags.some((f) => f.includes("no published cap"))) {
      console.log("       (this class IS sellable — Batman: Arkham Knight and Football");
      console.log("        Manager 26 are in it and we sell both today)");
    }
    console.log("");
  }

  console.log("  EVIDENCE");
  for (const c of r.checks) {
    const mark = c.pass === null ? "?" : c.pass ? "✅" : "❌";
    console.log(`    ${mark} ${c.n}. ${c.name.padEnd(30)} ${c.value}`);
  }
  console.log(`    ℹ  split-screen                   ${r.split ? "PRESENT — LOCAL CO-OP tail allowed" : "absent — title tail stays OFFLINE"}`);
  console.log("");
  console.log("  Confirm check 3 yourself: is the name above the game you are buying?");
  console.log("");
}

/* ── Self-test ─────────────────────────────────────────────────────────── */

/**
 * Known answers this repo has already settled. A gate that has never been shown
 * to fire is not a gate.
 */
const KNOWN = [
  { id: 4356430, name: "NBA 2K27", expect: "DO_NOT_BUY", why: "2K Sports Account" },
  { id: 3717070, name: "WWE 2K26", expect: "DO_NOT_BUY", why: "2K Account + Denuvo machine cap" },
  { id: 2075800, name: "STAR WARS Zero Company", expect: "DO_NOT_BUY", why: "EA Account in legal_notice ONLY" },
  { id: 3551340, name: "Football Manager 26", expect: "NEEDS_HUMAN", why: "bare Denuvo — sellable, we ship it" },
  { id: 208650, name: "Batman: Arkham Knight", expect: "NEEDS_HUMAN", why: "bare Denuvo — sellable, we ship it" },
  { id: 1693980, name: "Dead Space", expect: "NEEDS_HUMAN", why: "control: must show its Denuvo notice" },
  { id: 3701350, name: "Zero Company Deluxe Upgrade", expect: "DO_NOT_BUY", why: "edition SKU — fullgame present" },
];

async function selfTest() {
  console.log("\nSELF-TEST — known answers this repo has already settled\n");
  let failed = 0;
  for (const k of KNOWN) {
    const d = await getApp(k.id);
    if (!d) {
      console.log(`  ❌ ${k.name.padEnd(30)} appdetails returned success:false`);
      failed += 1;
      continue;
    }
    const r = evaluate(d);
    const ok = r.verdict === k.expect;
    if (!ok) failed += 1;
    console.log(
      `  ${ok ? "✅" : "❌"} ${k.name.padEnd(30)} got ${r.verdict.padEnd(12)} expected ${k.expect.padEnd(12)} (${k.why})`,
    );
    if (!ok) console.log(`       blockers: ${JSON.stringify(r.blockers)}\n       flags: ${JSON.stringify(r.flags)}`);
    await new Promise((res) => setTimeout(res, 300));
  }

  // The control proves the fields are READ, not merely empty.
  const ds = await getApp(1693980);
  const drmSeen = strip(ds?.drm_notice);
  console.log("");
  console.log(`  CONTROL — Dead Space drm_notice: ${JSON.stringify(drmSeen)}`);
  if (!drmSeen) {
    console.log("  ❌ CONTROL FAILED — an empty drm_notice here means the check is not reading the field.");
    failed += 1;
  } else {
    console.log("  ✅ Control fired, so an empty drm_notice elsewhere is a real empty.");
  }

  console.log(`\n${failed === 0 ? "✅ SELF-TEST PASSED" : `❌ SELF-TEST FAILED (${failed})`}\n`);
  return failed === 0;
}

/* ── Entry ─────────────────────────────────────────────────────────────── */

const args = process.argv.slice(2);

if (args.length === 0) {
  console.log(`
Run the Steam gate before buying a supplier order.

  node scripts/pre-purchase-check.mjs "NBA 2K27"
  node scripts/pre-purchase-check.mjs 4356430
  node scripts/pre-purchase-check.mjs --self-test

Reads store.steampowered.com only. No credentials, no database, no supplier portal.
`);
  process.exitCode = 0;
}

/**
 * Everything below runs inside main() so each error path can `return` a status.
 *
 * The alternative — process.exit() at each guard — trips a libuv assertion on
 * Windows ("UV_HANDLE_CLOSING") when it fires while undici's fetch handles are
 * still closing, printing what looks like a crash after a perfectly good run.
 * Setting process.exitCode and letting the loop drain gives the same status
 * with no noise. It also means no guard can fall through to the next block,
 * which a bare exitCode assignment at top level silently would.
 */
async function main() {
  if (args.length === 0) return 0;
  if (args[0] === "--self-test") return (await selfTest()) ? 0 : 1;

  const input = args.join(" ").trim();
  let appid = /^\d+$/.test(input) ? input : null;

  if (!appid) {
    const { id, items, exact } = await resolveName(input);
    if (!id) {
      console.log(`\nNo Steam result for "${input}". Check the spelling, or paste the app id.\n`);
      return 1;
    }
    appid = id;
    console.log(
      `\nResolved "${input}" -> app ${appid}` +
        (exact ? " (exact name match)" : " (BEST GUESS — not an exact match)"),
    );
    if (items.length > 1) {
      console.log("Other results — make sure the one above is right:");
      for (const it of items.slice(0, 5)) console.log(`   ${it.id}  ${it.name}`);
    }
  }

  const data = await getApp(appid);
  if (!data) {
    console.log(
      `\napp ${appid}: appdetails returned success:false. Wrong id, or region-locked for cc=${CC}.\n`,
    );
    return 1;
  }

  const result = evaluate(data);
  report(result);
  return result.verdict === "DO_NOT_BUY" ? 1 : 0;
}

process.exitCode = await main();
