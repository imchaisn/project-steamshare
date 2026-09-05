/**
 * seed-suppliers.mjs — load supplier-hosted accounts into steam_accounts.
 *
 * These are accounts bought from third-party portals (cyberspace.cyou,
 * gamersfantasy.my) where the Steam Guard seed belongs to the supplier, not to
 * us. Their code is fetched at lookup time by lib/code-source/, using the
 * supplier_order_id stored on the account. See
 * docs/superpowers/specs/2026-09-06-cross-supplier-code-retrieval-design.md.
 *
 * CONTAINS NO CREDENTIALS. It reads them from local/websites/<domain>.md,
 * which is gitignored — exactly the arrangement scripts/seed-fleet.mjs uses.
 * This file is tracked and the repo is PUBLIC; never inline a value here.
 *
 * Writes through PostgREST with the service-role key rather than a direct
 * Postgres connection, because the DB password is currently broken (see
 * CHECKPOINT.md, open item 1) and PostgREST is the path that actually works.
 *
 * Usage:
 *   node scripts/seed-suppliers.mjs --dry-run     # parse and print, write nothing
 *   node scripts/seed-suppliers.mjs               # upsert
 *
 * Env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ACCOUNTS_ENCRYPTION_KEY
 */

import { readFileSync, readdirSync } from "fs";
import { join } from "path";

const DRY = process.argv.includes("--dry-run");
const WEBSITES_DIR = process.env.WEBSITES_DIR ?? "local/websites";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const ENC_KEY = process.env.ACCOUNTS_ENCRYPTION_KEY ?? "";

/** Sites we have an adapter for. Mirrors SUPPLIER_SITES in lib/code-source/types.ts. */
const KNOWN_SITES = new Set(["cyberspace.cyou", "gamersfantasy.my"]);

const missing = [];
if (!ENC_KEY) missing.push("ACCOUNTS_ENCRYPTION_KEY");
if (!DRY && !SUPABASE_URL) missing.push("NEXT_PUBLIC_SUPABASE_URL");
if (!DRY && !SERVICE_KEY) missing.push("SUPABASE_SERVICE_ROLE_KEY");
if (missing.length) {
  console.error(`\nMissing env var(s): ${missing.join(", ")}\n`);
  process.exit(1);
}

// ── Encryption: mirrors lib/encryption.ts exactly (AES-256-GCM, base64(iv||ct)) ──
const IV_LENGTH = 12;
async function importKey() {
  const km = Uint8Array.from(Buffer.from(ENC_KEY, "base64"));
  if (km.length !== 32)
    throw new Error("ACCOUNTS_ENCRYPTION_KEY must decode to 32 bytes");
  return crypto.subtle.importKey("raw", km, "AES-GCM", false, [
    "encrypt",
    "decrypt",
  ]);
}
async function encrypt(plaintext) {
  const key = await importKey();
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const buf = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(plaintext),
  );
  const out = new Uint8Array(iv.length + buf.byteLength);
  out.set(iv, 0);
  out.set(new Uint8Array(buf), iv.length);
  return Buffer.from(out).toString("base64");
}

// ── Parse local/websites/<domain>.md ────────────────────────────────────────
//
// Two table shapes appear in those files:
//
//   1. The main table, one row per account:
//        | Order ID | Game | Username | Password | Verification code |
//
//   2. A per-game rotation block, where SEVERAL accounts share ONE supplier
//      order id carried in the heading above them:
//        ## Black Myth: Wukong — multiple rotational accounts
//        Order ID `2412186NHGYD9Y` has several linked accounts...
//        | # | Username | Password |
//
//      Shape 2 is why the supplier order id lives on the account rather than
//      on the buyer's order: six usernames legitimately share one of them.

function splitRow(line) {
  return line
    .split("|")
    .slice(1, -1)
    .map((c) => c.trim().replace(/^`|`$/g, ""));
}

function parseSiteFile(domain, text) {
  const rows = [];
  const lines = text.split(/\r?\n/);
  let headers = null;
  let rotationOrderId = null;

  for (const line of lines) {
    // A heading resets table context; capture any order id it names, which is
    // what binds a rotation block's usernames to their shared supplier order.
    if (line.startsWith("#")) {
      headers = null;
      rotationOrderId = null;
      continue;
    }

    // Prose above a rotation table naming its shared order id.
    const orderMention = line.match(/Order ID\s+`([^`]+)`/i);
    if (orderMention) {
      rotationOrderId = orderMention[1];
      continue;
    }

    if (!line.trim().startsWith("|")) continue;
    if (/^\|[\s|:-]+\|$/.test(line.trim())) continue; // separator row

    const cells = splitRow(line);
    if (!headers) {
      headers = cells.map((c) => c.toLowerCase());
      continue;
    }

    const get = (name) => {
      const i = headers.findIndex((h) => h.includes(name));
      return i === -1 ? "" : (cells[i] ?? "");
    };

    const username = get("username");
    const password = get("password");
    if (!username || !password) continue;

    const orderId = get("order id") || rotationOrderId;
    if (!orderId) continue;

    rows.push({
      supplier_site: domain,
      supplier_order_id: orderId,
      username,
      password,
      game: get("game") || null,
    });
  }
  return rows;
}

// ── Collect ────────────────────────────────────────────────────────────────
const files = readdirSync(WEBSITES_DIR).filter(
  (n) =>
    n.endsWith(".md") &&
    n !== "README.md" &&
    !n.endsWith("-contract.md"), // researcher contract notes, not credential tables
);

const accounts = [];
const skipped = [];
for (const f of files) {
  const domain = f.replace(/\.md$/, "");
  if (!KNOWN_SITES.has(domain)) {
    skipped.push(`${f} — no adapter in lib/code-source/ for "${domain}"`);
    continue;
  }
  accounts.push(...parseSiteFile(domain, readFileSync(join(WEBSITES_DIR, f), "utf8")));
}

// A username is the join key on the supplier's side, so a duplicate here means
// two rows disagree about which order a single account belongs to.
const seen = new Map();
const duplicates = [];
for (const a of accounts) {
  const key = a.username.toLowerCase();
  if (seen.has(key)) duplicates.push(a.username);
  else seen.set(key, a);
}

console.log(`\nParsed ${accounts.length} supplier account(s) from ${files.length} file(s):\n`);
for (const a of accounts) {
  console.log(
    `  ${a.supplier_site.padEnd(18)} ${a.supplier_order_id.padEnd(18)} ${a.username.padEnd(16)} ${a.game ?? ""}`,
  );
}
if (skipped.length) {
  console.log(`\nSkipped:\n${skipped.map((s) => `  ${s}`).join("\n")}`);
}
if (duplicates.length) {
  console.error(`\nDUPLICATE usernames — refusing to write: ${duplicates.join(", ")}\n`);
  process.exit(1);
}

if (DRY) {
  console.log(`\n--dry-run: nothing written.\n`);
  process.exit(0);
}

// ── Upsert through PostgREST ───────────────────────────────────────────────
const rest = `${SUPABASE_URL.replace(/\/$/, "")}/rest/v1/steam_accounts`;
const headers = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  "Content-Type": "application/json",
};

let inserted = 0;
let updated = 0;

for (const a of accounts) {
  const passwordEnc = await encrypt(a.password);

  const lookup = await fetch(
    `${rest}?select=id&username=eq.${encodeURIComponent(a.username)}`,
    { headers },
  );
  if (!lookup.ok) {
    console.error(`  lookup failed for ${a.username}: ${await lookup.text()}`);
    continue;
  }
  const existing = await lookup.json();

  const payload = {
    username: a.username,
    password_enc: passwordEnc,
    code_source: "supplier",
    supplier_site: a.supplier_site,
    supplier_order_id: a.supplier_order_id,
    // shared_secret_enc stays null — we do not hold this account's Guard seed.
    // Migration 0011's CHECK permits that only for code_source='supplier'.
  };

  if (existing.length) {
    const res = await fetch(`${rest}?id=eq.${existing[0].id}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify(payload),
    });
    if (res.ok) updated++;
    else console.error(`  update failed for ${a.username}: ${await res.text()}`);
  } else {
    const res = await fetch(rest, {
      method: "POST",
      headers,
      body: JSON.stringify({ ...payload, status: "active" }),
    });
    if (res.ok) inserted++;
    else console.error(`  insert failed for ${a.username}: ${await res.text()}`);
  }
}

console.log(`\nDone. inserted=${inserted} updated=${updated}\n`);
console.log(
  "NOTE: these accounts have no game linked yet. Link them in /admin under\n" +
    "Account-Game before any Shopee listing can allocate them.\n",
);
