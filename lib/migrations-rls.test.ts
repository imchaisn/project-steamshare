import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

/*
 * Every table must have Row Level Security turned on by SOME migration.
 *
 * The app only ever talks to Postgres through the service-role client, which
 * bypasses RLS, so a table without RLS works perfectly in every test and in
 * production. Nothing breaks. The table is simply readable AND writable by
 * anyone holding the project's anon/publishable key, and the project URL is
 * in the public README. That is a leak no other check here would catch.
 *
 * It already happened once: 0006 created shopee_auth (the shop's Shopee
 * tokens) and shopee_push_log (every order_sn, and an order_sn alone is
 * enough for /api/lookup to return credentials) with no RLS. 0016 closes it.
 *
 * Text-level on purpose: it reads the migration files, not the live database,
 * so it runs with no credentials. It cannot prove a migration was APPLIED.
 * That still needs the pg_class query in 0016's header.
 */

const MIGRATIONS_DIR = fileURLToPath(new URL("../supabase/migrations/", import.meta.url));

function allMigrationSql(): string {
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    // Strip `--` comments so a table named in prose cannot satisfy the check.
    .map((f) => readFileSync(join(MIGRATIONS_DIR, f), "utf8").replace(/--[^\n]*/g, ""))
    .join("\n");
}

function tablesMatching(sql: string, pattern: RegExp): Set<string> {
  return new Set([...sql.matchAll(pattern)].map((m) => m[1].toLowerCase()));
}

test("every table created by a migration has row level security enabled", () => {
  const sql = allMigrationSql();
  const created = tablesMatching(
    sql,
    /create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?"?(\w+)"?/gi,
  );
  const protectedTables = tablesMatching(
    sql,
    /alter\s+table\s+(?:if\s+exists\s+)?(?:only\s+)?(?:public\.)?"?(\w+)"?\s+enable\s+row\s+level\s+security/gi,
  );

  assert.ok(created.size > 0, `found no create table statements under ${MIGRATIONS_DIR}`);

  const missing = [...created].filter((t) => !protectedTables.has(t)).sort();
  assert.deepEqual(
    missing,
    [],
    `table(s) with no RLS in any migration: ${missing.join(", ")}. ` +
      `Add \`alter table <name> enable row level security;\` plus the deny-all ` +
      `policies (see 0001_init.sql), or the anon key can read and write them.`,
  );
});
