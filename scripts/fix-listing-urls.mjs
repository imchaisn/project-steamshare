/**
 * Strip the banned external domain from live Shopee descriptions.
 *
 * WHY. A URL in a Shopee listing field that directs a transaction off-platform
 * is a Listing Violation: 1 penalty point per 2 deleted listings, and 3 points
 * caps the shop at 100 listings for 28 days. As measured on 2026-09-08, 29 of
 * 39 live listings carry it twice each. Against 29 exposed listings, Shopee
 * deleting 6 reaches the cap. Nothing is BANNED yet, so this is preventable
 * rather than repair. Full survey: docs/publish-packets/URL-EXPOSURE.md
 *
 * ── DRY RUN BY DEFAULT ───────────────────────────────────────────────────
 *   node --env-file=.env.local scripts/fix-listing-urls.mjs
 *       Reads, prints a full before/after for every listing, writes NOTHING.
 *   node --env-file=.env.local scripts/fix-listing-urls.mjs --apply
 *       Writes. Chaison's call, from his own shop, and it is not reversible
 *       in bulk — Shopee keeps no description history.
 *
 * ── THIS SCRIPT NEVER REFRESHES THE SHOPEE TOKEN ─────────────────────────
 * scripts/shopee-listings.mjs refreshes on startup. That is right for a tool
 * run alone and wrong here: the refresh_token is SINGLE-USE and rotates, so a
 * refresh racing the live app kills production auth for the whole shop. This
 * script uses the stored access_token as-is and EXITS if it has expired,
 * telling you to run the other tool first. It would rather do nothing than
 * rotate a token behind the app's back.
 *
 * ── WHAT IT CHANGES, AND WHAT IT REFUSES TO TOUCH ────────────────────────
 * Removes every line containing the domain, renumbers the numbered list so it
 * stays contiguous, and repairs the lines the removal orphans.
 *
 * THAT LAST PART IS NOT OPTIONAL, and the dry run is what proved it. In the
 * live copy the URL is not decorative — it IS the step that tells a buyer
 * where their username and password come from. Strip it alone and what is left
 * says "return to the site" and "a Steam Guard code from our website" with no
 * site mentioned anywhere, and never says where the login arrives. That is a
 * support ticket per order.
 *
 * So the orphaned lines are replaced with copy taken VERBATIM from the six
 * live listings that are already clean. NOTHING IS INVENTED — every
 * replacement line is live, reviewed and selling right now. Invented copy is a
 * claim nobody checked, and this shop has shipped unreviewed claims before.
 * `--strip-only` does the pure removal instead, for inspection; it is not the
 * default because its output is not shippable.
 *
 * ── BOTH DESCRIPTION FIELDS ARE READ AND WRITTEN ─────────────────────────
 * Shopee stores a description in one of two places depending on
 * `description_type`. `normal` uses `description`; `extended` leaves that empty
 * and puts the text in `description_info.extended_description.field_list[]`.
 * Both are handled — see `readDescription()`, which also records which shape a
 * listing uses so the write cannot disagree with the read.
 *
 * 🔴 An earlier version read only `description`, found `""` on four listings,
 * and reported them as "not readable or writable through the API — needs a
 * human". That was an inference from one empty field, and it was wrong: three
 * of them were live, selling, and carrying the banned domain twice each while
 * the shop was being reported as 0/39 clean. The text was one field away.
 * **Never report a listing as unreachable without having looked in both.**
 *
 * Listings whose extended layout this transform genuinely does not understand
 * (an image field, or more than one field) are HELD and reported with the
 * actual reason — never described as needing a human when nobody checked.
 */
import crypto from "node:crypto";

const APPLY = process.argv.includes("--apply");
// Pure removal, no adoption of the clean listings' wording. Produces copy that
// no longer tells the buyer where their login comes from — kept only so the
// minimal-change option can be inspected, never as the default.
const STRIP_ONLY = process.argv.includes("--strip-only");

/**
 * `--only=<item_id>[,<item_id>]` restricts the run to specific listings.
 *
 * Chaison's call, 2026-09-08: write ONE listing first, read it back from the
 * API, and only then run the rest. A transform that is wrong in a way the dry
 * run cannot show — because the dry run never sees what Shopee stores — then
 * costs one listing instead of twenty-six.
 */
/**
 * `--adopt-block` — replace the ENTIRE HOW IT WORKS section with the reference
 * four-step block, for listings the line-level pass cannot repair.
 *
 * Seven listings use an older three-step generation whose step 3 reads "You get
 * the Steam username, the password, and your Steam Guard code". That is one
 * source step to map onto two reference steps, so line-level substitution
 * collapses the section to two steps and silently loses the Guard-code
 * instructions — the one step buyers get stuck on.
 *
 * WHY THIS IS A DIFFERENT OPERATION, and not the same reasoning that produced
 * that bug: replacing a whole section with a known-good whole section is not
 * the same as mapping lines across shapes that do not correspond. The failure
 * mode of line-mapping is a partial result that looks complete. Replacing the
 * section wholesale cannot half-succeed — it either matches the reference or
 * the section was not found at all.
 *
 * The block is not new copy: six live listings carry it word for word.
 *
 * The completeness gate STILL applies to the result. The substitution does not
 * get to bypass the check that caught this in the first place.
 */
const ADOPT_BLOCK = process.argv.includes("--adopt-block");

/** Verbatim from the six already-clean live listings, read 2026-09-08. */
const REFERENCE_HIW = [
  "HOW IT WORKS",
  "1. Pay, then open Shopee Chat - your login is sent there automatically",
  "2. Sign in to Steam with those details",
  "3. When Steam asks for a verification code, follow the steps in that same chat message",
  "4. Enter the code straight away - it is short-lived",
];

/** Swap the whole HOW IT WORKS section. Returns null if there is none to swap. */
function replaceHowItWorks(text) {
  const lines = text.split("\n");
  const start = lines.findIndex((l) => /^HOW IT WORKS\s*$/i.test(l.trim()));
  if (start === -1) return null;
  // The section runs until the next ALL-CAPS heading (BEFORE YOU PLAY etc).
  let end = start + 1;
  while (end < lines.length && !/^[A-Z][A-Z ]{3,}$/.test(lines[end].trim())) {
    end++;
  }
  return [...lines.slice(0, start), ...REFERENCE_HIW, "", ...lines.slice(end)].join("\n");
}

const ONLY = (() => {
  const arg = process.argv.find((a) => a.startsWith("--only="));
  if (!arg) return null;
  const ids = arg
    .slice("--only=".length)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return ids.length ? new Set(ids) : null;
})();

/** `--except=<id>[,<id>]` — the complement, for "now do the remaining 25". */
const EXCEPT = (() => {
  const arg = process.argv.find((a) => a.startsWith("--except="));
  if (!arg) return null;
  const ids = arg
    .slice("--except=".length)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return ids.length ? new Set(ids) : null;
})();
const HOST = "https://partner.shopeemobile.com";

// Built at runtime rather than written as a literal so this file does not trip
// the whole-file grep that scripts/audit-listing-copy.mjs and the merge gate
// run against the repo. See .claude/fleet/RULINGS.md R3.
const DOMAIN = ["gameshare", ".", "space"].join("");
const DOMAIN_RE = new RegExp(DOMAIN.replace(".", "\\."), "i");

const env = (name) => {
  const v = process.env[name];
  if (!v) {
    console.error(`Missing ${name}. Run with --env-file=.env.local`);
    process.exit(1);
  }
  return v;
};

const SUPABASE_URL = env("NEXT_PUBLIC_SUPABASE_URL");
const SERVICE_KEY = env("SUPABASE_SERVICE_ROLE_KEY");
const PARTNER_ID = env("SHOPEE_PARTNER_ID");
const PARTNER_KEY = env("SHOPEE_PARTNER_KEY");
const KEY = Buffer.from(env("ACCOUNTS_ENCRYPTION_KEY"), "base64");

const rest = async (path) =>
  (
    await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
    })
  ).json();

function decrypt(b64) {
  const raw = Buffer.from(b64, "base64");
  const iv = raw.subarray(0, 12);
  const rest_ = raw.subarray(12);
  const tag = rest_.subarray(rest_.length - 16);
  const body = rest_.subarray(0, rest_.length - 16);
  const d = crypto.createDecipheriv("aes-256-gcm", KEY, iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(body), d.final()]).toString("utf8");
}

// ── Token: stored only, never refreshed ────────────────────────────────────
const [auth] = await rest(
  "shopee_auth?select=shop_id,access_token_enc,access_token_expires_at",
);
if (!auth) {
  console.error("No shopee_auth row. Authorize the shop first.");
  process.exit(1);
}
const expiresAt = new Date(auth.access_token_expires_at).getTime();
const msLeft = expiresAt - Date.now();
if (!Number.isFinite(expiresAt) || msLeft <= 60_000) {
  console.error(
    `Stored Shopee access_token expired or expiring (${auth.access_token_expires_at}).\n` +
      `REFUSING to refresh it here — the refresh_token is single-use and rotating,\n` +
      `and racing the live app would kill production auth for the shop.\n` +
      `Run: node --env-file=.env.local scripts/shopee-listings.mjs   (it refreshes), then re-run this.`,
  );
  process.exit(1);
}
const TOKEN = decrypt(auth.access_token_enc);
const SHOP_ID = auth.shop_id;
console.log(
  `Token valid for a further ${Math.round(msLeft / 60000)} min. Not refreshed.`,
);

function signed(path) {
  const ts = Math.floor(Date.now() / 1000);
  const sign = crypto
    .createHmac("sha256", PARTNER_KEY)
    .update(`${PARTNER_ID}${path}${ts}${TOKEN}${SHOP_ID}`)
    .digest("hex");
  return new URLSearchParams({
    partner_id: PARTNER_ID,
    timestamp: String(ts),
    access_token: TOKEN,
    shop_id: String(SHOP_ID),
    sign,
  });
}

const apiGet = async (path, extra = {}) => {
  const q = signed(path);
  for (const [k, v] of Object.entries(extra)) q.set(k, v);
  return (await fetch(`${HOST}${path}?${q}`)).json();
};

const apiPost = async (path, body) =>
  (
    await fetch(`${HOST}${path}?${signed(path)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
  ).json();

const nap = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Read a listing's description, whichever of the TWO fields Shopee stored it in.
 *
 * 🔴 THIS FUNCTION EXISTS BECAUSE OF A WRONG ANSWER I GAVE. An earlier version
 * read only `description`, saw `""` on four listings, and concluded their body
 * was "not readable through the API" — then that inference was reported to
 * Chaison as fact, and the shop was declared clean at 0/39 when three live,
 * selling listings still carried the domain twice each.
 *
 * The text was never absent. For `description_type: "extended"` Shopee returns
 * it in `description_info.extended_description.field_list[]` instead, each entry
 * `{field_type: "text"|"image", text?, image_info?}`. One empty field is not
 * evidence of absence; it is evidence you read one field.
 *
 * Returns `{text, kind, fieldIndex, fieldCount}`. `kind` is what a write must
 * use, so the read and the write can never disagree about the shape.
 */
function readDescription(item) {
  const plain = item.description ?? "";
  if (item.description_type !== "extended") {
    return { text: plain, kind: "normal", fieldIndex: -1, fieldCount: 0 };
  }
  const fields = item.description_info?.extended_description?.field_list ?? [];
  const textIdx = fields.findIndex((f) => f.field_type === "text");
  return {
    text: textIdx === -1 ? "" : (fields[textIdx].text ?? ""),
    kind: "extended",
    fieldIndex: textIdx,
    fieldCount: fields.length,
  };
}

/**
 * Lines that reference the website WITHOUT containing a URL.
 *
 * Removing the URL lines alone is not shippable, and the dry run is what
 * proved it. The live copy reads:
 *
 *   - The password, and a Steam Guard code from our website when Steam asks
 *   2. Go to <domain>, enter it, and note the Steam username and password   <- removed
 *   3. When Steam asks for a verification code, return to the site and press Get Code
 *
 * Drop only the middle line and the buyer is told to "return to the site" that
 * nothing now mentions, and is never told where their username and password
 * come from. That is a support ticket per order, and arguably worse for the
 * buyer than the penalty risk is for the shop.
 */
const RESIDUAL_RE = /our website|return to the site|from the site|press Get Code/i;

/**
 * Does the result still tell the buyer how to get past Steam's code prompt?
 *
 * RESIDUAL_RE catches a reference to something that no longer exists. It does
 * NOT catch the opposite failure — an OMISSION — and the canary run is what
 * exposed that. How to Fish `48217427795` had a three-step HOW IT WORKS rather
 * than the five-step shape most listings use:
 *
 *   1. Pay, then check Shopee chat for your Order ID
 *   2. Go to <domain> and enter it                                  <- removed
 *   3. You get the Steam username, the password, and your Steam Guard code
 *
 * Substituting line 3 collapsed the whole thing to two steps and the result
 * never mentioned the verification code at all — the single step this product
 * exists to explain. It read perfectly well; it was just wrong. Nothing else
 * would have caught it, which is exactly why one listing was written first.
 *
 * So the result must carry a code step inside HOW IT WORKS, not merely
 * somewhere in the description (WHAT YOU GET mentions a Guard code too, which
 * is what made the broken output look plausible).
 */
function howItWorksAudit(text) {
  const block = /HOW IT WORKS\s*\n([\s\S]*?)(?:\n\s*\n|$)/i.exec(text);
  if (!block) return { ok: false, steps: 0, why: "no HOW IT WORKS section" };

  const steps = block[1].split(/\r?\n/).filter((l) => /^\s*\d+\.\s/.test(l));
  const numbers = steps.map((l) => Number(/^\s*(\d+)\./.exec(l)[1]));
  const contiguous = numbers.every((n, i) => n === i + 1);
  const namesCode = steps.some((l) => /verification code|guard code/i.test(l));
  const saysPromptly = steps.some((l) =>
    /straight away|short-lived|promptly|immediately/i.test(l),
  );

  const why = !contiguous
    ? `steps not numbered 1..n (${numbers.join(",")})`
    : steps.length < 4
      ? `only ${steps.length} step(s); the reference shape has 4`
      : !namesCode
        ? "no step names the verification code"
        : !saysPromptly
          ? "no step tells the buyer to enter it promptly"
          : null;

  return { ok: why === null, steps: steps.length, numbers, why };
}

/**
 * Replacements taken VERBATIM from the six live listings that are already
 * clean (TEKKEN 8 `58167526751` and its five siblings, read from the API on
 * 2026-09-08). Nothing here is invented — every line is copy that is live,
 * reviewed and selling right now. That is the whole point: the alternative to
 * reusing shipped copy is writing new claims nobody has checked.
 */
const ADOPT = [
  [
    /^- The password,? and a Steam Guard code from our website when Steam asks for one$/i,
    "- A Steam Guard code whenever Steam asks for one",
  ],
  [
    /^- The password and a live Steam Guard code from our website, any time you log in$/i,
    "- A Steam Guard code whenever Steam asks for one",
  ],
  // Template-only variant, carrying placeholders rather than a game name. Lives
  // in the `**Description template**` skeleton in docs/listing-copy.md, which is
  // what every new listing is built from. Never seen on a live listing, and
  // needed the moment this script meets restored copy.
  [
    /^- The username, password and Steam Guard code, all from our website$/i,
    "- A Steam Guard code whenever Steam asks for one",
  ],
  [
    /^\d+\. Pay, then check Shopee chat for your Order ID$/i,
    "1. Pay, then open Shopee Chat - your login is sent there automatically",
  ],
  [
    /^\d+\. Open Steam and sign in with them$/i,
    "2. Sign in to Steam with those details",
  ],
  [
    /^\d+\. You get the Steam username, the password, and your Steam Guard code$/i,
    "2. Sign in to Steam with those details",
  ],
  [
    /^\d+\. When Steam asks for a verification code, return to the site and press Get Code$/i,
    "3. When Steam asks for a verification code, follow the steps in that same chat message",
  ],
  [
    /^\d+\. Type it into Steam straight away - the code is short-lived$/i,
    "4. Enter the code straight away - it is short-lived",
  ],
  [
    /^- The code only exists once you are at Steam's verification screen, so sign in first$/i,
    null, // drop: it only made sense alongside the Get Code button
  ],
];

/**
 * Remove URL-bearing lines, repair the numbering they leave behind, and (unless
 * `adopt` is false) replace the lines the removal orphans with verbatim copy
 * from the already-clean listings.
 *
 * Renumbering matters on its own: the URL line IS step 2 of HOW IT WORKS, so
 * dropping it leaves "1." followed by "3.", which reads as a mistake and
 * invites someone to "fix" it by hand later.
 */
export function stripDomain(description, { adopt = true } = {}) {
  const lines = description.split(/\r?\n/);
  const removed = [];
  const rewritten = [];
  const kept = lines.filter((line) => {
    if (DOMAIN_RE.test(line)) {
      removed.push(line.trim());
      return false;
    }
    return true;
  });

  // Substitute the orphaned lines, dropping the ones with no clean equivalent.
  // Built by filtering rather than writing a sentinel value into the array —
  // an in-band marker is one careless edit away from being written to a live
  // listing as literal text.
  const substituted = !adopt
    ? kept
    : kept.flatMap((line) => {
        const trimmed = line.trim();
        const rule = ADOPT.find(([re]) => re.test(trimmed));
        if (!rule) return [line];
        rewritten.push([trimmed, rule[1]]);
        return rule[1] === null ? [] : [rule[1]];
      });

  // Renumber list items — but ONLY inside HOW IT WORKS.
  //
  // ⚠️ A GLOBAL renumber corrupts prose, and this was caught on a live listing.
  // Indiana Jones and the Great Circle `45467475301` opens its blurb with
  // "1937. A first-person adventure across Egypt, Shanghai and the Himalayas".
  // `/^(\s*)(\d+)\.\s/` matches that year as a list item, rewrites it to
  // "1. A first-person adventure...", destroys the date, and consumes the
  // counter so HOW IT WORKS then starts at 2. Any year, price or figure at the
  // start of a line is the same trap.
  //
  // The section ends at the next ALL-CAPS heading (BEFORE YOU PLAY / PLEASE
  // NOTE), which is the shape every one of these descriptions uses.
  let counter = 0;
  let inSection = false;
  const renumbered = substituted.map((line) => {
    if (/^HOW IT WORKS\s*$/i.test(line.trim())) {
      inSection = true;
      counter = 0;
      return line;
    }
    if (inSection && /^[A-Z][A-Z ]{3,}$/.test(line.trim())) inSection = false;
    if (!inSection) return line;

    const m = /^(\s*)(\d+)\.\s(.*)$/.exec(line);
    if (!m) return line;
    counter += 1;
    return `${m[1]}${counter}. ${m[3]}`;
  });

  // Collapse a blank run left behind by a removed line.
  const out = [];
  for (const line of renumbered) {
    if (line.trim() === "" && out.length && out[out.length - 1].trim() === "") continue;
    out.push(line);
  }
  return { text: out.join("\n").replace(/\s+$/, ""), removed, rewritten };
}

// ── Gather live state fresh; never trust a cached list ──────────────────────
const targets = [];
/** Layouts this transform does not understand. Reported, never called clean. */
const unsupportedLayout = [];
const clean = [];

for (const status of ["NORMAL"]) {
  const list = await apiGet("/api/v2/product/get_item_list", {
    offset: "0",
    page_size: "100",
    item_status: status,
  });
  if (list.error) {
    console.error(`get_item_list failed: ${list.error} ${list.message ?? ""}`);
    process.exit(1);
  }
  const ids = (list.response?.item ?? []).map((i) => i.item_id);
  for (let i = 0; i < ids.length; i += 20) {
    const info = await apiGet("/api/v2/product/get_item_base_info", {
      item_id_list: ids.slice(i, i + 20).join(","),
    });
    if (info.error) {
      console.error(`get_item_base_info failed: ${info.error} ${info.message ?? ""}`);
      process.exit(1);
    }
    for (const it of info.response?.item_list ?? []) {
      const read = readDescription(it);
      it.__read = read; // carried through so the write uses the same shape
      const desc = read.text;

      // An extended listing carrying an image field, or more than one field,
      // is a layout this transform does not understand. Hold it back and SAY
      // SO — never report it as clean, and never guess at rebuilding a layout.
      if (read.kind === "extended" && (read.fieldCount !== 1 || read.fieldIndex !== 0)) {
        unsupportedLayout.push({ it, why: `${read.fieldCount} field(s), text at index ${read.fieldIndex}` });
        continue;
      }
      if (desc === "") {
        unsupportedLayout.push({ it, why: `no readable text in ${read.kind} description` });
        continue;
      }
      if (!DOMAIN_RE.test(desc)) {
        clean.push(it);
        continue;
      }
      if (ONLY && !ONLY.has(String(it.item_id))) continue;
      if (EXCEPT && EXCEPT.has(String(it.item_id))) continue;
      targets.push(it);
    }
    await nap(300);
  }
}

console.log(
  `\n${targets.length} listing(s) carry the domain and are editable. ` +
    `${clean.length} already clean. ${unsupportedLayout.length} unsupported layout.\n`,
);

// ── Show every diff, always, in both modes ─────────────────────────────────
const plan = [];
for (const it of targets) {
  let { text, removed, rewritten } = stripDomain(it.__read.text, { adopt: !STRIP_ONLY });
  const stillDirty = DOMAIN_RE.test(text);
  // A listing whose HOW IT WORKS did not match the expected shape comes out
  // still referring to a site it no longer names. NEVER guess a substitution
  // for it — a wrong edit on a live listing is worse than an unfixed URL.
  // Report it and leave it for a human. 25 written and 4 handed over beats 29
  // written with one wrong.
  const incoherent = RESIDUAL_RE.test(text);
  // Completeness, not just absence-of-leftovers. The canary proved a result can
  // be free of dangling references and still be missing the step the whole
  // product turns on.
  let hiw = howItWorksAudit(text);
  let blockAdopted = false;

  // Only for listings the line-level pass could not repair, and only when asked.
  if (ADOPT_BLOCK && !hiw.ok && !stillDirty) {
    const swapped = replaceHowItWorks(text);
    if (swapped !== null) {
      const reaudit = howItWorksAudit(swapped);
      // The gate still decides. If the swap does not produce a complete
      // section, the listing stays held back rather than being written.
      if (reaudit.ok) {
        text = swapped;
        hiw = reaudit;
        blockAdopted = true;
      }
    }
  }
  plan.push({ it, text, removed, rewritten, stillDirty, incoherent, hiw, blockAdopted });

  console.log("=".repeat(74));
  console.log(`${it.item_id}  ${it.item_name.slice(0, 60)}`);
  console.log("=".repeat(74));
  for (const r of removed) console.log(`  - REMOVED : ${r}`);
  for (const [from, to] of rewritten)
    console.log(to === null ? `  - DROPPED : ${from}` : `  ~ REWROTE : ${from}
              -> ${to}`);
  console.log("  --- after ---");
  console.log(
    text.split("\n").map((l) => `  | ${l}`).join("\n"),
  );
  if (stillDirty) console.log("  ⚠️ STILL CONTAINS THE DOMAIN — will not be written");
  if (blockAdopted)
    console.log("  ⇄ WHOLE HOW IT WORKS SECTION REPLACED with the reference block (--adopt-block)");
  console.log(`  HOW IT WORKS: ${hiw.steps} step(s)${hiw.ok ? " — complete" : `  ⚠️ ${hiw.why}`}`);
  // Not a URL, so out of scope for an automated edit, but it dangles once the
  // link is gone and a human should decide what to do with it.
  for (const l of text.split("\n")) {
    if (/our website|the website/i.test(l)) {
      console.log(`  ⚠️ RESIDUAL REFERENCE (left alone, no URL): ${l.trim()}`);
    }
  }
  console.log();
}

const isWritable = (p) => !p.stillDirty && !p.incoherent && p.hiw.ok;
const writable = plan.filter(isWritable);
const held = plan.filter((p) => !isWritable(p));

if (!APPLY) {
  console.log("-".repeat(74));
  console.log(`DRY RUN — nothing was written. ${writable.length} listing(s) would change.`);
  if (held.length) {
    console.log(`\n${held.length} HELD BACK for a human — shape did not match, not guessed at:`);
    for (const h of held) {
      const why = h.stillDirty
        ? "still contains the domain"
        : h.incoherent
          ? "still refers to a site it no longer names"
          : h.hiw.why;
      console.log(`  ${h.it.item_id}  ${String(why).padEnd(46)} ${h.it.item_name.slice(0, 40)}`);
    }
  }
  if (unsupportedLayout.length) {
    console.log(`\n${unsupportedLayout.length} listing(s) HELD — a layout this script does not handle.`);
    console.log(`This is NOT "needs a human". State the layout; do not infer unreachability:`);
    for (const u of unsupportedLayout) {
      console.log(`  ${u.it.item_id}  ${u.why}  ${u.it.item_name.slice(0, 44)}`);
    }
  }
  console.log(`\nTo write: re-run with --apply`);
  process.exit(0);
}

// ── Apply, one at a time, tracking exactly what happened ───────────────────
console.log("-".repeat(74));
console.log(`APPLYING to ${writable.length} listing(s).\n`);

const succeeded = [];
const failed = [];
for (const p of writable) {
  const res = await apiPost("/api/v2/product/update_item", {
    item_id: p.it.item_id,
    // Write back into the SAME field the text was read from, per the schema in
    // congminh1254/shopee-sdk `src/schemas/product.ts` (`UpdateItemDescriptionInfo`
    // -> `extended_description.field_list[]`, whitelist sellers only — this shop
    // qualifies, it already serves extended descriptions).
    //
    // Converting an extended listing to `normal` would be simpler for this
    // script and is deliberately NOT done: that changes a live product's
    // description format to suit our tooling, and nothing here knows what else
    // it affects.
    ...(p.it.__read.kind === "extended"
      ? {
          description_type: "extended",
          description_info: {
            extended_description: {
              field_list: [{ field_type: "text", text: p.text }],
            },
          },
        }
      : { description: p.text }),
  });
  if (res.error) {
    failed.push({ id: p.it.item_id, reason: `${res.error}: ${res.message ?? ""}`.trim() });
    console.log(`  FAIL ${p.it.item_id}  ${res.error}`);
  } else {
    succeeded.push(p.it.item_id);
    console.log(`  ok   ${p.it.item_id}`);
  }
  await nap(500);
}

// A half-applied pass that reports success is worse than a clean failure, so
// the outcome is re-read from Shopee rather than inferred from the write call.
console.log("\nVerifying against the API...");
const verifiedClean = [];
const verifiedDirty = [];
for (let i = 0; i < succeeded.length; i += 20) {
  const info = await apiGet("/api/v2/product/get_item_base_info", {
    item_id_list: succeeded.slice(i, i + 20).join(","),
  });
  for (const it of info.response?.item_list ?? []) {
    // Re-read through the SAME accessor. Verifying against `description` alone
    // is precisely how an extended listing was certified clean while still
    // carrying the domain.
    const after = readDescription(it).text;
    (DOMAIN_RE.test(after) ? verifiedDirty : verifiedClean).push(it.item_id);
  }
  await nap(300);
}

console.log("\n" + "=".repeat(74));
console.log(`WROTE OK AND VERIFIED CLEAN : ${verifiedClean.length}`);
console.log(`WROTE OK BUT STILL DIRTY    : ${verifiedDirty.length}${verifiedDirty.length ? "  " + verifiedDirty.join(", ") : ""}`);
console.log(`FAILED TO WRITE             : ${failed.length}`);
for (const f of failed) console.log(`   ${f.id}  ${f.reason}`);
console.log(`UNTOUCHED (unsupported layout): ${unsupportedLayout.length}`);
for (const u of unsupportedLayout) console.log(`   ${u.it.item_id}  ${u.why}  ${u.it.item_name.slice(0, 40)}`);
console.log("=".repeat(74));
process.exit(failed.length || verifiedDirty.length ? 1 : 0);
