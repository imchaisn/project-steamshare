import { createAdminClient } from "@/utils/supabase/admin";

/**
 * DB-backed IP rate limiting for the public lookup endpoint.
 *
 * Every attempt (allowed or blocked) is recorded in `lookup_attempts`,
 * then attempts from the same IP inside the rolling window are counted.
 * `code_access_log` can't be used for this — it only records codes that
 * were actually served, and a brute-force sweep of order ids produces no
 * successes at all.
 *
 * FAILS OPEN: any error in this module lets the request through. A
 * transient database problem must not take down the buyer lookup.
 */

// ── Tunables ──────────────────────────────────────────────────
/** Attempts allowed per IP inside the window. The (N+1)th is blocked. */
export const MAX_ATTEMPTS_PER_WINDOW = 10;
/** Length of the rolling window, in seconds. */
export const WINDOW_SECONDS = 10 * 60; // 10 minutes

export interface RateLimitResult {
  allowed: boolean;
  /** Seconds until the oldest attempt in the window ages out. Only set when blocked. */
  retryAfterSeconds?: number;
}

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
 * Record this attempt and decide whether it's allowed.
 * Call once per request, at the top of the handler.
 */
export async function checkRateLimit(ip: string): Promise<RateLimitResult> {
  try {
    const supabase = createAdminClient();
    const now = Date.now();
    const cutoff = new Date(now - WINDOW_SECONDS * 1000).toISOString();

    // Record first, so a blocked attacker keeps extending their own window.
    const { error: insertError } = await supabase
      .from("lookup_attempts")
      .insert({ ip });
    if (insertError) throw insertError;

    // One query: exact count over the window, plus the oldest row in it
    // (the count reflects the filter, not the limit).
    const { data, count, error } = await supabase
      .from("lookup_attempts")
      .select("created_at", { count: "exact" })
      .eq("ip", ip)
      .gte("created_at", cutoff)
      .order("created_at", { ascending: true })
      .limit(1);
    if (error) throw error;

    if ((count ?? 0) <= MAX_ATTEMPTS_PER_WINDOW) {
      return { allowed: true };
    }

    // The window clears once the oldest attempt in it ages out.
    const oldest = data?.[0]?.created_at;
    const expiresAt = oldest
      ? new Date(oldest).getTime() + WINDOW_SECONDS * 1000
      : now + WINDOW_SECONDS * 1000;
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((expiresAt - now) / 1000),
    );

    return { allowed: false, retryAfterSeconds };
  } catch (err) {
    console.error("[rate-limit] check failed, failing open:", err);
    return { allowed: true };
  }
}
