/**
 * run-migrations.mjs
 * Run Supabase migrations against the remote database.
 *
 * Usage:
 *   DB_PASSWORD=yourpassword node scripts/run-migrations.mjs             # everything
 *   DB_PASSWORD=yourpassword node scripts/run-migrations.mjs 0005 0007 0008
 *
 * Find the password: Supabase Dashboard → Settings → Database → Connection string → password field.
 *
 * ── WHY THE NUMBER ARGUMENTS EXIST ──────────────────────────────────────────
 * The no-argument form replays 0001-0004 against a live database and relies on
 * the `err.message.includes("already exists")` catch below to skip them. That
 * heuristic is weaker than it looks: it matches on an error STRING, so a
 * migration that fails for an unrelated reason whose message happens to
 * contain those words is silently treated as success, and one that is genuinely
 * already applied but reports it differently aborts the run. On a database with
 * live buyer orders in it, neither outcome is acceptable.
 *
 * Passing explicit numbers runs exactly those files and nothing else, which is
 * how the Shopee auto-fulfilment schema should be applied:
 *
 *   node scripts/run-migrations.mjs 0005 0007 0008
 *
 * ORDER MATTERS AND IS NOT NEGOTIABLE — 0005 before 0008. 0008 makes
 * orders.shopee_buyer_id nullable, which under the original composite
 * unique(shopee_order_id, shopee_buyer_id) constraint would let UNLIMITED rows
 * share one shopee_order_id (NULLs never collide in a unique constraint) and
 * permanently break verifyShopeeOrder() for those buyers. 0008 has a guard that
 * aborts if 0005's single-column unique index is missing, and the list below is
 * kept in numeric order so the arguments are applied in file order regardless
 * of the order you type them in.
 */

import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, "..");

// ── Config ────────────────────────────────────────────────────────────────────
// Session pooler (IPv4-compatible) — direct connection only supports IPv6,
// which isn't resolvable from this network. See Supabase Connect > Session pooler.
const PROJECT_REF  = "vwefthulbxqarttytvpl";
const DB_HOST      = "aws-0-ap-northeast-1.pooler.supabase.com";
const DB_PORT      = 5432;
const DB_NAME      = "postgres";
const DB_USER      = `postgres.${PROJECT_REF}`;
const DB_PASSWORD  = process.env.DB_PASSWORD ?? process.env.SUPABASE_DB_PASSWORD ?? "";

const MIGRATIONS = [
  "supabase/migrations/0001_init.sql",
  "supabase/migrations/0002_recovery_email.sql",
  "supabase/migrations/0003_rate_limit.sql",
  "supabase/migrations/0004_rate_limit_scope.sql",
  "supabase/migrations/0005_orders_order_id_unique.sql",
  "supabase/migrations/0006_shopee_auth.sql",
  "supabase/migrations/0007_shopee_listings.sql",
  "supabase/migrations/0008_orders_auto_delivery.sql",
];

// ── Select which migrations to run ───────────────────────────────────────────
// Arguments are matched against the leading number of each filename, so `0005`
// selects 0005_orders_order_id_unique.sql. An argument that matches nothing is
// a typo, and a typo here means a migration you believed you applied silently
// did not run — so it aborts rather than quietly running a shorter list.
const SELECTORS = process.argv.slice(2).filter((a) => !a.startsWith("-"));

let selected = MIGRATIONS;
if (SELECTORS.length > 0) {
  const unmatched = SELECTORS.filter(
    (s) => !MIGRATIONS.some((m) => m.split("/").pop().startsWith(`${s}_`)),
  );
  if (unmatched.length > 0) {
    console.error(`\n❌  No migration matches: ${unmatched.join(", ")}\n`);
    console.error("   Available:");
    for (const m of MIGRATIONS) console.error(`     ${m.split("/").pop().split("_")[0]}  ${m}`);
    console.error("");
    process.exit(1);
  }
  // Filter MIGRATIONS rather than mapping over SELECTORS, so the run order is
  // always the file order (0005 before 0008) no matter how they were typed.
  selected = MIGRATIONS.filter((m) =>
    SELECTORS.some((s) => m.split("/").pop().startsWith(`${s}_`)),
  );
}

if (!DB_PASSWORD) {
  console.error("\n❌  DB_PASSWORD is required.\n");
  console.error("   Set it like this:");
  console.error("   DB_PASSWORD=yourpassword node scripts/run-migrations.mjs\n");
  console.error("   Find it: Supabase Dashboard → Settings → Database → URI → password field\n");
  process.exit(1);
}

// ── Run migrations via pg ─────────────────────────────────────────────────────
// We use a dynamic import so the script works even if `pg` isn't installed yet.
let pg;
try {
  pg = await import("pg");
} catch {
  console.log("📦  Installing pg (node-postgres)...");
  const { execSync } = await import("child_process");
  execSync("npm install pg --no-save", { cwd: PROJECT_ROOT, stdio: "inherit" });
  pg = await import("pg");
}

const { default: { Client } } = pg;

const client = new Client({
  host:     DB_HOST,
  port:     DB_PORT,
  database: DB_NAME,
  user:     DB_USER,
  password: DB_PASSWORD,
  ssl:      { rejectUnauthorized: false },
});

console.log(`\n📋  Will apply ${selected.length} migration(s), in this order:`);
for (const rel of selected) console.log(`      ${rel}`);

console.log(`\n🔌  Connecting to ${DB_HOST}...`);
await client.connect();
console.log("✅  Connected.\n");

let applied = 0;
for (const rel of selected) {
  const abs = join(PROJECT_ROOT, rel);
  const sql = readFileSync(abs, "utf8");
  console.log(`▶  Applying ${rel}...`);
  try {
    await client.query(sql);
    console.log(`✅  ${rel} applied.\n`);
    applied++;
  } catch (err) {
    // If tables already exist, that's fine
    if (err.message.includes("already exists")) {
      console.log(`⏭   ${rel} — already applied (skipped).\n`);
    } else {
      console.error(`❌  ${rel} failed: ${err.message}\n`);
      await client.end();
      process.exit(1);
    }
  }
}

await client.end();
console.log(`🎉  Done! ${applied}/${selected.length} migration(s) applied.`);
console.log("    Project Steamshare's database is now live.\n");
