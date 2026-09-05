/**
 * seed-shopee-listings.mjs
 * Sync the Shopee listing → game mapping (table `shopee_listings`, migration
 * 0007) into Supabase from a LOCAL listings file.
 *
 * This is the table the automated fulfilment path reads to answer "the buyer
 * bought item_id X / model_id Y — which of our games is that?". Nothing else
 * can answer it: a Shopee order detail names the item, never our game.
 *
 * Idempotent: keyed on (item_id, model_id), so re-running re-points an existing
 * mapping instead of duplicating it. Safe to run after every listing change.
 *
 * This repo is PUBLIC. This script contains no credentials and no item ids by
 * design — the listings file lives outside the repo and is never committed.
 * Keep it next to fleet.json in the same local vault folder.
 *
 * Usage:
 *   DB_PASSWORD=xxx \
 *   SHOPEE_LISTINGS_FILE="C:/Users/ASUS/Desktop/SteamShare/vault/shopee-listings.json" \
 *   node scripts/seed-shopee-listings.mjs [--dry-run]
 *
 * shopee-listings.json shape — copy this, fill in your real values:
 *
 *   {
 *     "listings": [
 *       {
 *         "itemId":     "12345678901",   // Shopee item_id. String or number; a
 *                                        // string is safer, these can exceed
 *                                        // JavaScript's safe integer range.
 *         "modelId":    "0",             // Shopee model_id (variation). OPTIONAL —
 *                                        // omit or use 0 for a listing with no
 *                                        // variations. See 0007 on why 0, not null.
 *         "steamAppId": "1245620",       // must already exist in `games`; run
 *                                        // scripts/seed-fleet.mjs first
 *         "note":       "Elden Ring — 1 month"   // OPTIONAL, for your own eyes only,
 *                                                // shown in this script's summary
 *                                                // table and never written to the DB
 *       }
 *     ]
 *   }
 *
 * Games are matched on steam_app_id, not on title, because titles get edited
 * and app ids do not. This script deliberately does NOT create missing games —
 * that is seed-fleet.mjs's job, and silently inventing a game row here would
 * produce a mapping pointing at a game no Steam account actually owns.
 */

import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

const DRY = process.argv.includes("--dry-run");
const PROJECT_REF = "vwefthulbxqarttytvpl";
const DB_HOST = "aws-0-ap-northeast-1.pooler.supabase.com";
const DB_PASSWORD = process.env.DB_PASSWORD ?? process.env.SUPABASE_DB_PASSWORD ?? "";
const LISTINGS_FILE = process.env.SHOPEE_LISTINGS_FILE ?? "";

const missing = [];
if (!DB_PASSWORD) missing.push("DB_PASSWORD");
if (!LISTINGS_FILE) missing.push("SHOPEE_LISTINGS_FILE");
if (missing.length) {
  console.error(`\nMissing env var(s): ${missing.join(", ")}\n`);
  if (missing.includes("SHOPEE_LISTINGS_FILE")) {
    console.error(
      "SHOPEE_LISTINGS_FILE must point at your local listings JSON — see the\n" +
        "commented example at the top of this file for the exact shape.\n" +
        "Keep it OUTSIDE this repo (this repo is public); the same vault folder\n" +
        "as fleet.json is the right place.\n",
    );
  }
  process.exit(1);
}

const listingsPath = resolve(LISTINGS_FILE);
if (!existsSync(listingsPath)) {
  console.error(
    `\nListings file not found: ${listingsPath}\n\n` +
      "Create it, or point SHOPEE_LISTINGS_FILE somewhere else. Expected shape:\n\n" +
      '  { "listings": [ { "itemId": "12345678901", "modelId": "0", "steamAppId": "1245620", "note": "Elden Ring" } ] }\n\n' +
      "itemId comes from the Shopee Seller Centre listing URL / v2.product.get_item_list.\n" +
      "modelId is the variation id and may be omitted for listings with no variations.\n" +
      "steamAppId must already exist in `games` — run scripts/seed-fleet.mjs first.\n",
  );
  process.exit(1);
}

// This repo is public and .gitignore does not currently cover a listings file
// anywhere inside it. Rather than assume, warn loudly if the path resolves
// inside the working tree — the 2026-08-24 leak started exactly this way.
if (listingsPath.startsWith(resolve(process.cwd()))) {
  console.warn(
    `\nWARNING: ${listingsPath} is inside the repo working tree.\n` +
      "This repo is PUBLIC. Move the file outside the repo, or confirm .gitignore\n" +
      "covers it, before you commit anything.\n",
  );
}

// ── Parse + validate before touching the database ───────────────────────────
// Everything is validated up front so a bad file is rejected wholesale rather
// than half-applied and rolled back — the error messages are more useful when
// they name every problem at once.
let parsed;
try {
  parsed = JSON.parse(readFileSync(listingsPath, "utf8"));
} catch (e) {
  console.error(`\n${listingsPath} is not valid JSON: ${e.message}\n`);
  process.exit(1);
}

const listings = parsed?.listings;
if (!Array.isArray(listings) || listings.length === 0) {
  console.error(`\n${listingsPath} must contain a non-empty "listings" array.\n`);
  process.exit(1);
}

/**
 * Shopee ids are bigints. JSON.parse turns a bare number into a float64, which
 * silently loses precision past 2^53 — a 19-digit item id would be corrupted
 * before this script ever saw it. So: accept a string (preferred) or a number,
 * reject anything that is not an exact non-negative integer, and hand pg a
 * string so the value reaches Postgres byte-for-byte.
 */
function normalizeId(value, field, index) {
  if (value === undefined || value === null) return null;
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value) || value < 0) {
      throw new Error(
        `listings[${index}].${field} = ${value} is not an exact non-negative integer. ` +
          "Quote it as a JSON string to avoid float64 precision loss.",
      );
    }
    return String(value);
  }
  if (typeof value === "string" && /^\d+$/.test(value.trim())) return value.trim();
  throw new Error(`listings[${index}].${field} must be a digits-only string or integer, got ${JSON.stringify(value)}`);
}

const rows = [];
const problems = [];
for (const [i, l] of listings.entries()) {
  try {
    const itemId = normalizeId(l?.itemId, "itemId", i);
    if (itemId === null) throw new Error(`listings[${i}].itemId is required`);
    // Absent modelId means "listing has no variations" — 0, per 0007.
    const modelId = normalizeId(l?.modelId, "modelId", i) ?? "0";
    const steamAppId = typeof l?.steamAppId === "string" ? l.steamAppId.trim() : String(l?.steamAppId ?? "").trim();
    if (!steamAppId) throw new Error(`listings[${i}].steamAppId is required`);
    rows.push({ itemId, modelId, steamAppId, note: l?.note ?? "" });
  } catch (e) {
    problems.push(e.message);
  }
}

// Duplicate (item_id, model_id) inside the file itself: the DB upsert would
// happily let the last one win, which is a silent wrong-game bug. Reject it.
const seen = new Map();
for (const r of rows) {
  const key = `${r.itemId}/${r.modelId}`;
  if (seen.has(key)) problems.push(`duplicate (itemId, modelId) in file: ${key}`);
  seen.set(key, true);
}

if (problems.length) {
  console.error(`\n${listingsPath} has ${problems.length} problem(s):\n`);
  for (const p of problems) console.error(`  - ${p}`);
  console.error("");
  process.exit(1);
}

// ── Apply ───────────────────────────────────────────────────────────────────
const { default: pg } = await import("pg");
const client = new pg.Client({
  host: DB_HOST, port: 5432, database: "postgres",
  user: `postgres.${PROJECT_REF}`, password: DB_PASSWORD,
  ssl: { rejectUnauthorized: false },
});
await client.connect();

const summary = [];
try {
  await client.query("begin");

  for (const r of rows) {
    const { rows: g } = await client.query(`select id, title from games where steam_app_id=$1 limit 1`, [r.steamAppId]);
    if (!g.length) {
      // Fail the whole run rather than skip: a mapping missing from
      // shopee_listings means a paid order silently falls through to
      // `no_mapping` and the buyer waits on a message that never arrives.
      throw new Error(
        `no game with steam_app_id=${r.steamAppId} (item ${r.itemId}/${r.modelId}). ` +
          "Run scripts/seed-fleet.mjs first, or fix the app id in the listings file.",
      );
    }

    // xmax = 0 is Postgres' documented way to tell an INSERT apart from an
    // ON CONFLICT UPDATE in the same RETURNING clause: a freshly inserted
    // tuple has no updating transaction, an updated one does.
    const { rows: out } = await client.query(
      `insert into shopee_listings (item_id, model_id, game_id)
       values ($1,$2,$3)
       on conflict (item_id, model_id) do update set game_id = excluded.game_id
       returning (xmax = 0) as inserted`,
      [r.itemId, r.modelId, g[0].id],
    );

    summary.push({
      listing: `${r.itemId}/${r.modelId}`,
      game: g[0].title,
      appId: r.steamAppId,
      result: out[0].inserted ? "inserted" : "updated",
      note: r.note,
    });
  }

  if (DRY) { await client.query("rollback"); console.log("\nDRY RUN - rolled back\n"); }
  else { await client.query("commit"); console.log("\nCommitted.\n"); }
} catch (e) {
  await client.query("rollback");
  console.error("Rolled back:", e.message);
  process.exitCode = 1;
} finally {
  console.table(summary);
  await client.end();
}
