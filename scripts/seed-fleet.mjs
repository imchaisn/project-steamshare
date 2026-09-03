/**
 * seed-fleet.mjs
 * Sync the whole Steam account fleet into Supabase from a LOCAL fleet file.
 *
 * Idempotent: re-running updates existing rows rather than duplicating them.
 * Matches accounts on username (case-insensitive), games on steam_app_id,
 * links + orders on their unique constraints.
 *
 * This repo is PUBLIC. This script contains no credentials by design — the fleet
 * file lives outside the repo and is never committed.
 *
 * Usage:
 *   DB_PASSWORD=xxx ACCOUNTS_ENCRYPTION_KEY=xxx \
 *   FLEET_FILE="C:/Users/ASUS/Desktop/SteamShare/vault/fleet.json" \
 *   MAFILES_DIR="C:/Users/ASUS/Desktop/SteamShare/SDA.1.0.15/maFiles" \
 *   node scripts/seed-fleet.mjs [--dry-run]
 *
 * fleet.json shape: { accounts: [{ username, password, email, game, appId, testOrderId }] }
 * `shared_secret` is read from the matching .maFile, never from the fleet file.
 */

import { readFileSync, readdirSync } from "fs";
import { join } from "path";

const DRY = process.argv.includes("--dry-run");
const PROJECT_REF = "vwefthulbxqarttytvpl";
const DB_HOST = "aws-0-ap-northeast-1.pooler.supabase.com";
const DB_PASSWORD = process.env.DB_PASSWORD ?? process.env.SUPABASE_DB_PASSWORD ?? "";
const ENC_KEY = process.env.ACCOUNTS_ENCRYPTION_KEY ?? "";
const FLEET_FILE = process.env.FLEET_FILE ?? "";
const MAFILES_DIR = process.env.MAFILES_DIR ?? "";
const TEST_BUYER_ID = "internal-test";

const missing = [];
if (!DB_PASSWORD) missing.push("DB_PASSWORD");
if (!ENC_KEY) missing.push("ACCOUNTS_ENCRYPTION_KEY");
if (!FLEET_FILE) missing.push("FLEET_FILE");
if (!MAFILES_DIR) missing.push("MAFILES_DIR");
if (missing.length) {
  console.error(`\nMissing env var(s): ${missing.join(", ")}\n`);
  process.exit(1);
}

// ── Encryption: mirrors lib/encryption.ts exactly (AES-256-GCM, base64(iv||ct)) ──
const IV_LENGTH = 12;
async function importKey() {
  const km = Uint8Array.from(Buffer.from(ENC_KEY, "base64"));
  if (km.length !== 32) throw new Error("ACCOUNTS_ENCRYPTION_KEY must decode to 32 bytes");
  return crypto.subtle.importKey("raw", km, "AES-GCM", false, ["encrypt", "decrypt"]);
}
async function encrypt(plaintext) {
  const key = await importKey();
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const buf = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(plaintext));
  const out = new Uint8Array(iv.length + buf.byteLength);
  out.set(iv, 0);
  out.set(new Uint8Array(buf), iv.length);
  return Buffer.from(out).toString("base64");
}

// ── Guard shared_secrets, keyed by lowercased account_name ──────────────────────
const secrets = new Map();
for (const f of readdirSync(MAFILES_DIR).filter((n) => n.endsWith(".maFile"))) {
  const j = JSON.parse(readFileSync(join(MAFILES_DIR, f), "utf8"));
  if (j.account_name && j.shared_secret) secrets.set(j.account_name.toLowerCase(), j.shared_secret);
}

const fleet = JSON.parse(readFileSync(FLEET_FILE, "utf8")).accounts;

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

  for (const a of fleet) {
    const key = a.username.toLowerCase();
    const sharedSecret = secrets.get(key);
    if (!sharedSecret) { summary.push([a.username, "SKIPPED - no shared_secret in maFiles"]); continue; }
    if (!a.password) { summary.push([a.username, "SKIPPED - no password in fleet file"]); continue; }

    const pwEnc = await encrypt(a.password);
    const ssEnc = await encrypt(sharedSecret);

    // steam_accounts — match case-insensitively on username
    const { rows: existing } = await client.query(
      `select id from steam_accounts where lower(username) = $1 limit 1`, [key],
    );
    let accountId, action;
    if (existing.length) {
      accountId = existing[0].id;
      await client.query(
        `update steam_accounts
            set username=$2, password_enc=$3, shared_secret_enc=$4, recovery_email=$5, updated_at=now()
          where id=$1`,
        [accountId, a.username, pwEnc, ssEnc, a.email ?? null],
      );
      action = "updated";
    } else {
      const { rows } = await client.query(
        `insert into steam_accounts (username, password_enc, shared_secret_enc, recovery_email, status)
         values ($1,$2,$3,$4,'active') returning id`,
        [a.username, pwEnc, ssEnc, a.email ?? null],
      );
      accountId = rows[0].id;
      action = "inserted";
    }

    if (!a.game || !a.appId) { summary.push([a.username, `${action} (no game assigned)`]); continue; }

    // games — one row per app id
    const { rows: g } = await client.query(`select id from games where steam_app_id=$1 limit 1`, [a.appId]);
    const gameId = g.length
      ? g[0].id
      : (await client.query(`insert into games (title, steam_app_id) values ($1,$2) returning id`, [a.game, a.appId])).rows[0].id;

    const { rows: ag } = await client.query(
      `insert into account_games (account_id, game_id) values ($1,$2)
       on conflict (account_id, game_id) do update set account_id=excluded.account_id
       returning id`,
      [accountId, gameId],
    );

    if (a.testOrderId) {
      await client.query(
        `insert into orders (shopee_order_id, shopee_buyer_id, account_game_id, verified)
         values ($1,$2,$3,true)
         on conflict (shopee_order_id, shopee_buyer_id)
         do update set account_game_id=excluded.account_game_id, verified=true`,
        [a.testOrderId, TEST_BUYER_ID, ag[0].id],
      );
    }
    summary.push([a.username, `${action} + ${a.game} + order ${a.testOrderId ?? "(none)"}`]);
  }

  if (DRY) { await client.query("rollback"); console.log("\nDRY RUN - rolled back\n"); }
  else { await client.query("commit"); console.log("\nCommitted.\n"); }
} catch (e) {
  await client.query("rollback");
  console.error("Rolled back:", e.message);
  process.exitCode = 1;
} finally {
  console.table(summary.map(([u, r]) => ({ account: u, result: r })));
  await client.end();
}
