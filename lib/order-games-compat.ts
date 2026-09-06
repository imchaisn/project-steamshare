/**
 * Backward compatibility for the window where the CODE knows about
 * `order_games` (migration 0014) but the DATABASE does not yet.
 *
 * ── WHY THIS EXISTS ───────────────────────────────────────────────────────
 * This repo auto-deploys on every push to `master`, and the Supabase SQL
 * editor is the only way to apply a migration (the stored DB password is
 * stale — Postgres 28P01, CHECKPOINT.md open item 1). Those two facts
 * together mean the deploy and the migration CANNOT be ordered reliably:
 * pushing the multi-game code before the SQL is pasted would leave every
 * buyer lookup reading a table that does not exist, and answering
 * "order not found" — a total outage for every live order, not a degraded
 * feature.
 *
 * Rather than rely on a human doing two things in the right order, every
 * read and write of `order_games` degrades to the pre-0014 behaviour when
 * the table is absent: one game per order, taken from `orders.account_game_id`
 * and the order-level supplier mapping. Before the migration the site behaves
 * EXACTLY as it does today. After it, multi-game orders work. No flag day.
 *
 * ── DELETE THIS FILE once 0014 is applied and verified ───────────────────
 * It is scaffolding for one deployment, not a permanent second code path.
 * Every call site that imports it is marked with the same note. Leaving it
 * in place indefinitely means a genuine "table is missing" incident would be
 * silently absorbed as legacy mode instead of raising an alarm.
 */

/**
 * Does this PostgREST error mean `order_games` does not exist yet?
 *
 * Two distinct signals, because Supabase reports it two different ways:
 *   42P01    — Postgres `undefined_table`, raised on a direct write.
 *   PGRST205 — PostgREST cannot find the table in its cached schema, which
 *              is what a read usually returns first.
 *
 * Deliberately narrow. It matches ONLY a missing-table error, never a
 * permission error, a constraint violation or a connection failure — those
 * must still fail loudly rather than be mistaken for "pre-migration" and
 * silently degrade a buyer to one game of the four they paid for.
 */
export function isMissingOrderGames(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const e = error as { code?: string; message?: string };
  if (e.code === "42P01" || e.code === "PGRST205") return true;
  const message = typeof e.message === "string" ? e.message.toLowerCase() : "";
  if (!message.includes("order_games")) return false;
  return (
    message.includes("does not exist") ||
    message.includes("schema cache") ||
    message.includes("could not find")
  );
}

/**
 * Log the fallback once per process rather than once per request.
 *
 * A serverless instance serving a busy minute would otherwise write the same
 * line hundreds of times and bury the ACTION REQUIRED lines that matter. Once
 * per cold start is enough to answer "is production still in legacy mode?".
 */
let warned = false;
export function warnLegacyMode(where: string): void {
  if (warned) return;
  warned = true;
  console.warn(
    `[order-games-compat] ${where}: table order_games is missing, so this deployment is ` +
      `running in PRE-0014 LEGACY MODE — one game per order, exactly as before. ` +
      `Multi-game orders will silently deliver only their first game until ` +
      `supabase/migrations/0014_order_games.sql is applied.`,
  );
}
