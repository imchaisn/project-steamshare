/**
 * run-migrations.mjs
 * Run all Supabase migrations against the remote database.
 *
 * Usage:
 *   DB_PASSWORD=yourpassword node scripts/run-migrations.mjs
 *
 * Find the password: Supabase Dashboard → Settings → Database → Connection string → password field.
 */

import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, "..");

// ── Config ────────────────────────────────────────────────────────────────────
const PROJECT_REF  = "vwefthulbxqarttytvpl";
const DB_HOST      = `db.${PROJECT_REF}.supabase.co`;
const DB_PORT      = 5432;
const DB_NAME      = "postgres";
const DB_USER      = "postgres";
const DB_PASSWORD  = process.env.DB_PASSWORD ?? process.env.SUPABASE_DB_PASSWORD ?? "";

const MIGRATIONS = [
  "supabase/migrations/0001_init.sql",
  "supabase/migrations/0002_recovery_email.sql",
];

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

console.log(`\n🔌  Connecting to ${DB_HOST}...`);
await client.connect();
console.log("✅  Connected.\n");

let applied = 0;
for (const rel of MIGRATIONS) {
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
console.log(`🎉  Done! ${applied}/${MIGRATIONS.length} migrations applied.`);
console.log("    Project Steamshare's database is now live.\n");
