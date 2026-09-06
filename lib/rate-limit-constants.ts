/**
 * Rate-limiter tunables and types.
 *
 * Split out of lib/rate-limit.ts on 2026-09-06 for one reason: rate-limit.ts
 * imports the Supabase admin client through the `@/` path alias, which the
 * node:test runner cannot resolve. That made every constant in it untestable,
 * including the outcome weights — the exact values a wrong mapping silently
 * turns into a lockout for a paying buyer (see lib/code-source/outcome.ts).
 *
 * Nothing here performs I/O, so it imports cleanly from a test.
 * lib/rate-limit.ts re-exports all of it; existing import sites are unchanged.
 */

// ── Tunables ──────────────────────────────────────────────────
// All windows are rolling and evaluated per request.

/**
 * Weighted attempts allowed against ONE order id per window.
 * 20 over 15 min ≈ one lookup every 45s — more than a real buyer needs
 * even if they refresh on every 30s Guard rotation for the whole window.
 * With failures at 3× it also means only ~6 wrong-username guesses per
 * 15 min against a known-good order id.
 */
export const MAX_WEIGHTED_ATTEMPTS_PER_ORDER = 20;
/** Rolling window for the per-order limit, in seconds. */
export const ORDER_WINDOW_SECONDS = 15 * 60; // 15 minutes

/**
 * Weighted attempts allowed from ONE IP per window.
 * 300 over 15 min = 20/min. A shared carrier IP at realistic volume
 * (even ~30 concurrent buyers × 6 lookups each) sits an order of
 * magnitude under this. An enumeration sweep is all failures, so at 3×
 * it exhausts after ~100 requests per 15 min — which makes sweeping the
 * (very large) Shopee order-id keyspace from one host pointless.
 */
export const MAX_WEIGHTED_ATTEMPTS_PER_IP = 300;
/** Rolling window for the per-IP limit, in seconds. */
export const IP_WINDOW_SECONDS = 15 * 60; // 15 minutes

/** Cost of an attempt that resolved to a real, verified order. */
export const SUCCESSFUL_ATTEMPT_WEIGHT = 1;
/**
 * Cost of an attempt that resolved to nothing (unknown order id, wrong
 * username, malformed request) or that was itself blocked. 3× burns an
 * attacker's budget three times faster while leaving a real buyer who
 * mistypes their username twice plenty of room.
 */
export const FAILED_ATTEMPT_WEIGHT = 3;

/** Order ids longer than this are truncated before use as a bucket key. */
export const ORDER_KEY_MAX_LENGTH = 64;

/**
 * Hard ceiling on the per-order multiplier below.
 *
 * The multiplier exists to serve real bulk buyers, not to become a way to
 * raise the limit arbitrarily. 10 is far above any plausible cart (a Shopee
 * order carrying ten different game listings from one shop has never
 * happened here) while keeping the worst-case per-order budget bounded and
 * statable: 200 weighted attempts per 15 minutes.
 */
export const MAX_ORDER_GAME_MULTIPLIER = 10;

/**
 * The per-order limit, scaled by how many games the order actually contains.
 *
 * ── WHY THIS EXISTS ───────────────────────────────────────────────────────
 * MAX_WEIGHTED_ATTEMPTS_PER_ORDER was sized for a one-game order: ~one lookup
 * every 45s, more than a real buyer needs. Multi-game orders (migration 0014)
 * break that sizing. A four-game buyer spends one attempt checking the order
 * and then at least one per game getting a code — and supplier-backed games
 * legitimately answer `not_ready` until the buyer has actually attempted the
 * Steam login, so each of those is retried several times. A buyer working
 * through four games in one sitting can therefore exhaust a budget built for
 * one, and get locked out of an order they have paid for.
 *
 * Scaling by the number of games keeps the per-game budget identical to what
 * a single-game buyer has always had.
 *
 * ── WHY IT DOES NOT WEAKEN ANTI-ENUMERATION ───────────────────────────────
 * The game count comes from OUR database, never from the request, so a caller
 * cannot inflate their own limit by claiming a bigger order. An order id that
 * does not resolve has no games, so it stays on the base limit of 20 — the
 * enumeration budget this control was built for is untouched.
 */
export function orderLimitForGameCount(gameCount: number): number {
  const multiplier = Math.min(
    MAX_ORDER_GAME_MULTIPLIER,
    Math.max(1, Math.floor(gameCount) || 1),
  );
  return MAX_WEIGHTED_ATTEMPTS_PER_ORDER * multiplier;
}

// ── Types ─────────────────────────────────────────────────────

/**
 * What a lookup attempt turned into.
 *   success     — order verified and a code was served.
 *   unavailable — order verified, but the account is banned/recovering.
 *                 A real buyer hitting an ops problem, NOT an attacker.
 *   failure     — order/username did not resolve, or the request was
 *                 malformed. This is the brute-force signal.
 *   blocked     — the limiter rejected it. Counted heavily so that
 *                 hammering a closed door extends the block.
 */
export type LookupOutcome = "success" | "unavailable" | "failure" | "blocked";

/** Outcomes costing FAILED_ATTEMPT_WEIGHT rather than SUCCESSFUL_ATTEMPT_WEIGHT. */
export const HEAVY_OUTCOMES: readonly LookupOutcome[] = ["failure", "blocked"];

export type RateLimitScope = "order" | "ip";

export interface RateLimitResult {
  allowed: boolean;
  /** Which control rejected it. Only set when blocked. */
  limitedBy?: RateLimitScope;
  /** Approximate seconds until the window frees up. Only set when blocked. */
  retryAfterSeconds?: number;
}

export interface RateLimitKeys {
  ip: string;
  /** Raw order id as supplied by the caller. Absent for malformed requests. */
  orderId?: string | null;
}

export interface ScopeStatus {
  scope: RateLimitScope;
  key: string;
  windowSeconds: number;
  limit: number;
  /** Weighted score over the window, excluding the current request. */
  score: number;
  attempts: number;
  heavyAttempts: number;
  blocked: boolean;
}
