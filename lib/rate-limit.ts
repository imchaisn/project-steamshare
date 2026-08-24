import { createAdminClient } from "@/utils/supabase/admin";
import { verifyApiSecret } from "@/lib/auth";

/**
 * DB-backed rate limiting for the public lookup endpoint.
 *
 * WHY NOT PURE PER-IP: our buyers are Malaysian and Malaysian mobile
 * carriers use CGNAT heavily — many unrelated buyers share one public IP.
 * A tight per-IP cap locks out real, paying customers and is close to
 * undiagnosable from a support ticket ("it just says too many attempts").
 * So per-IP is a high backstop here, not the front line.
 *
 * THE THREE CONTROLS:
 *   1. Per-order (primary). A single order id can only be looked up a
 *      bounded number of times per window. This is the control that
 *      matters: it caps the value of a leaked/shared order id, and caps
 *      brute-forcing the Steam username a known order maps to. Generous,
 *      because Guard codes rotate every 30s and a real buyer legitimately
 *      re-looks-up several times per session.
 *   2. Per-IP (backstop). High enough that a busy carrier IP can't trip
 *      it in normal use, low enough that one host can't sweep thousands
 *      of order ids.
 *   3. Outcome weighting. A buyer refreshing a valid order is not an
 *      attacker; a burst of 404s against unknown order ids is. Failed and
 *      blocked attempts cost FAILED_ATTEMPT_WEIGHT× a successful one, so
 *      an enumeration sweep exhausts its budget far faster than a real
 *      buyer ever can.
 *
 * `code_access_log` can't back any of this — it only records codes that
 * were actually served, and a brute-force sweep produces no successes at
 * all. Hence the separate `lookup_attempts` table.
 *
 * ESCAPE HATCH: see `isRateLimitExempt()` (x-api-secret bypass) and
 * `clearRateLimit()` (admin reset, exposed at /api/admin/rate-limit).
 *
 * FAILS OPEN: any error in this module lets the request through. A
 * transient database problem must never take down buyer lookups.
 *
 * REQUIRES migration 0004_rate_limit_scope.sql. Until it is applied the
 * `order_id` / `outcome` columns don't exist, every query here errors, and
 * the endpoint fails open — i.e. is effectively unlimited.
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

// ── Request helpers ───────────────────────────────────────────

/**
 * Client IP from `x-forwarded-for` (Vercel sets it). The header can be a
 * comma-separated chain of proxies — the first entry is the client.
 * Falls back to "unknown", which is still rate limited as its own bucket.
 */
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const first = forwarded?.split(",")[0]?.trim();
  return first && first.length > 0 ? first : "unknown";
}

/**
 * Escape hatch #1 — a caller holding the admin API secret skips the
 * limiter entirely and leaves no counters behind.
 *
 * Reuses `verifyApiSecret()` and the existing `API_SECRET` env var, which
 * `proxy.ts` already honours on every non-public route. /api/lookup IS a
 * public route, so proxy.ts never checks the header there — the handler
 * has to. No new secret, nothing extra to keep in sync between
 * .env.local and Vercel.
 */
export function isRateLimitExempt(request: Request): boolean {
  return verifyApiSecret(request.headers.get("x-api-secret"));
}

/**
 * Normalize an order id into a stable bucket key, so `ABC123 ` and
 * `abc123` share one bucket and an oversized string can't be used to
 * write junk into the table.
 */
export function normalizeOrderKey(
  orderId: string | null | undefined,
): string | null {
  if (typeof orderId !== "string") return null;
  const trimmed = orderId.trim().toLowerCase();
  if (!trimmed) return null;
  return trimmed.slice(0, ORDER_KEY_MAX_LENGTH);
}

// ── Internals ─────────────────────────────────────────────────

function cutoffFor(windowSeconds: number): string {
  return new Date(Date.now() - windowSeconds * 1000).toISOString();
}

/**
 * Weighted score for one bucket over its window.
 *
 * Two exact head-only counts (total, and heavy-outcome only) rather than
 * pulling rows and summing in JS: it stays exact no matter how many rows
 * an attacker piles up, and both counts run in parallel so it costs one
 * round trip. Rows predating migration 0004 carry outcome 'unknown' and
 * are counted at the light weight.
 */
async function scoreBucket(
  column: "ip" | "order_id",
  key: string,
  windowSeconds: number,
): Promise<{ score: number; attempts: number; heavyAttempts: number }> {
  const supabase = createAdminClient();
  const cutoff = cutoffFor(windowSeconds);

  const base = () =>
    supabase
      .from("lookup_attempts")
      .select("id", { count: "exact", head: true })
      .eq(column, key)
      .gte("created_at", cutoff);

  const [total, heavy] = await Promise.all([
    base(),
    base().in("outcome", [...HEAVY_OUTCOMES]),
  ]);

  if (total.error) throw total.error;
  if (heavy.error) throw heavy.error;

  const attempts = total.count ?? 0;
  const heavyAttempts = heavy.count ?? 0;
  const lightAttempts = Math.max(0, attempts - heavyAttempts);

  return {
    attempts,
    heavyAttempts,
    score:
      lightAttempts * SUCCESSFUL_ATTEMPT_WEIGHT +
      heavyAttempts * FAILED_ATTEMPT_WEIGHT,
  };
}

/**
 * Approximate seconds until a blocked bucket frees up: when its oldest
 * attempt in the window ages out. Approximate because with weighting one
 * row ageing out may not by itself drop the score under the limit — it's
 * a Retry-After hint for a human, not a guarantee.
 */
async function retryAfterFor(
  column: "ip" | "order_id",
  key: string,
  windowSeconds: number,
): Promise<number> {
  const now = Date.now();
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("lookup_attempts")
      .select("created_at")
      .eq(column, key)
      .gte("created_at", cutoffFor(windowSeconds))
      .order("created_at", { ascending: true })
      .limit(1);
    if (error) throw error;

    const oldest = data?.[0]?.created_at;
    const expiresAt = oldest
      ? new Date(oldest).getTime() + windowSeconds * 1000
      : now + windowSeconds * 1000;
    return Math.max(1, Math.ceil((expiresAt - now) / 1000));
  } catch {
    return windowSeconds;
  }
}

interface BucketSpec {
  scope: RateLimitScope;
  column: "ip" | "order_id";
  key: string;
  limit: number;
  windowSeconds: number;
}

function bucketsFor({ ip, orderId }: RateLimitKeys): BucketSpec[] {
  const buckets: BucketSpec[] = [];
  const orderKey = normalizeOrderKey(orderId);

  // Order first: it's the primary control, and when both would trip it
  // gives the more accurate reason.
  if (orderKey) {
    buckets.push({
      scope: "order",
      column: "order_id",
      key: orderKey,
      limit: MAX_WEIGHTED_ATTEMPTS_PER_ORDER,
      windowSeconds: ORDER_WINDOW_SECONDS,
    });
  }
  buckets.push({
    scope: "ip",
    column: "ip",
    key: ip,
    limit: MAX_WEIGHTED_ATTEMPTS_PER_IP,
    windowSeconds: IP_WINDOW_SECONDS,
  });

  return buckets;
}

// ── Public API ────────────────────────────────────────────────

/**
 * Decide whether this attempt is allowed, based on history only — the
 * current attempt is recorded afterwards by `recordLookupAttempt()`, once
 * its outcome is known. A bucket blocks once its weighted score reaches
 * its limit, so exactly `limit` successful attempts fit in a window.
 *
 * Never throws. Fails open.
 */
export async function checkRateLimit(
  keys: RateLimitKeys,
): Promise<RateLimitResult> {
  try {
    const buckets = bucketsFor(keys);
    const scores = await Promise.all(
      buckets.map((b) => scoreBucket(b.column, b.key, b.windowSeconds)),
    );

    for (let i = 0; i < buckets.length; i++) {
      const bucket = buckets[i];
      if (scores[i].score >= bucket.limit) {
        return {
          allowed: false,
          limitedBy: bucket.scope,
          retryAfterSeconds: await retryAfterFor(
            bucket.column,
            bucket.key,
            bucket.windowSeconds,
          ),
        };
      }
    }

    return { allowed: true };
  } catch (err) {
    console.error("[rate-limit] check failed, failing open:", err);
    return { allowed: true };
  }
}

/**
 * Record one attempt and its outcome. Call once per non-exempt request,
 * including blocked ones (outcome "blocked"), so an attacker hammering a
 * closed door keeps their own window open.
 *
 * Never throws — a failed write must not break the response.
 */
export async function recordLookupAttempt(
  keys: RateLimitKeys & { outcome: LookupOutcome },
): Promise<void> {
  try {
    const supabase = createAdminClient();
    const { error } = await supabase.from("lookup_attempts").insert({
      ip: keys.ip,
      order_id: normalizeOrderKey(keys.orderId),
      outcome: keys.outcome,
    });
    if (error) throw error;
  } catch (err) {
    console.error("[rate-limit] failed to record attempt:", err);
  }
}

/**
 * Current state of every bucket for these keys — what /api/admin/rate-limit
 * reports, so a support case can be diagnosed without opening the SQL editor.
 * Throws on DB error; admin-only, never on a buyer path.
 */
export async function describeRateLimit(
  keys: RateLimitKeys,
): Promise<ScopeStatus[]> {
  const buckets = bucketsFor(keys);
  const scores = await Promise.all(
    buckets.map((b) => scoreBucket(b.column, b.key, b.windowSeconds)),
  );

  return buckets.map((bucket, i) => ({
    scope: bucket.scope,
    key: bucket.key,
    windowSeconds: bucket.windowSeconds,
    limit: bucket.limit,
    score: scores[i].score,
    attempts: scores[i].attempts,
    heavyAttempts: scores[i].heavyAttempts,
    blocked: scores[i].score >= bucket.limit,
  }));
}

/**
 * Escape hatch #2 — clear a limit without hand-editing the database.
 * Deletes recorded attempts for an IP and/or an order id (all of them,
 * not just the current window — they serve no purpose outside it).
 * Returns the number of rows removed. Throws on error so the admin route
 * can report a real failure; buyer-facing paths never call this.
 */
export async function clearRateLimit(keys: {
  ip?: string | null;
  orderId?: string | null;
}): Promise<number> {
  const orderKey = normalizeOrderKey(keys.orderId);
  const ip = keys.ip?.trim() || null;
  if (!ip && !orderKey) {
    throw new Error("clearRateLimit requires an ip or an orderId");
  }

  const supabase = createAdminClient();
  let deleted = 0;

  for (const [column, key] of [
    ["ip", ip],
    ["order_id", orderKey],
  ] as const) {
    if (!key) continue;
    const { count, error } = await supabase
      .from("lookup_attempts")
      .delete({ count: "exact" })
      .eq(column, key);
    if (error) throw error;
    deleted += count ?? 0;
  }

  return deleted;
}
