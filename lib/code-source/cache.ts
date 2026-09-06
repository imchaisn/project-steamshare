/**
 * A short-lived cache for codes fetched from our other websites.
 *
 * WHY THIS EXISTS
 *
 * Every fetch is a redemption against that order id on the other site, and
 * redemptions are finite — an order that has spent them returns
 * `{"code":"305","title":"REACHED LIMIT"}` until it is reset by hand. On
 * 2026-09-06 six development fetches exhausted a real saleable order.
 *
 * WHY CACHING IS SAFE HERE
 *
 * The code is NOT a rotating TOTP. It is a single Steam Guard code emailed by
 * Steam when somebody attempts a login, and the site serves that same value on
 * every request until it expires. Verified: one code came back byte-identical
 * across six separate fetches spanning several minutes. So serving a repeat
 * press from cache returns exactly what a fresh fetch would have returned —
 * it costs a redemption to learn nothing new.
 *
 * A NEW code only appears after a NEW login attempt, which is a deliberate act
 * by the buyer. That is why the TTL is short: it must be comfortably below the
 * code's own expiry, and it must not outlive a buyer's decision to log in
 * again to get a fresh one.
 *
 * ONLY SUCCESSES ARE CACHED. A not-ready or expired result must never be
 * cached — the buyer's next press is precisely the moment their state may have
 * changed, and serving them a stale "not ready" would strand them.
 *
 * LIMITATION, STATED PLAINLY: this is per-process memory. On Vercel each warm
 * lambda instance keeps its own copy, so the same buyer pressing twice is only
 * guaranteed to hit it if both requests land on the same instance. It reliably
 * collapses rapid repeat presses, which is the case that burns quota; it is
 * not a distributed cache. If redemptions still run down faster than expected,
 * the fix is to move this into Postgres, not to lengthen the TTL.
 */

/**
 * How long a fetched code may be reused. Deliberately short.
 *
 * The code's real expiry on the other site is UNMEASURED — see
 * local/websites/cyberspace.cyou-contract.md. 60s is chosen to sit far below
 * any plausible expiry rather than to maximise cache hits: serving a buyer a
 * dead code is worse than spending one redemption.
 *
 * Override with SUPPLIER_CODE_CACHE_MS. Set to 0 to disable caching entirely.
 */
export function cacheTtlMs(): number {
  const raw = process.env.SUPPLIER_CODE_CACHE_MS;
  if (raw === undefined) return 60_000;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 60_000;
}

interface Entry {
  code: string;
  storedAt: number;
}

const store = new Map<string, Entry>();

/** One order on one site. Two sites could legitimately use the same order id. */
function keyFor(site: string, orderId: string): string {
  return `${site}::${orderId.trim()}`;
}

/**
 * A previously fetched code for this order, if one is still fresh.
 * Returns null when caching is disabled, nothing is stored, or it has aged out.
 */
export function getCachedCode(
  site: string,
  orderId: string,
  now: number = Date.now(),
): string | null {
  const ttl = cacheTtlMs();
  if (ttl === 0) return null;

  const key = keyFor(site, orderId);
  const hit = store.get(key);
  if (!hit) return null;

  if (now - hit.storedAt >= ttl) {
    // Drop it rather than leave it to be re-checked on every future request.
    store.delete(key);
    return null;
  }
  return hit.code;
}

/** Remember a successfully fetched code. Never call this for a failure. */
export function setCachedCode(
  site: string,
  orderId: string,
  code: string,
  now: number = Date.now(),
): void {
  if (cacheTtlMs() === 0) return;
  store.set(keyFor(site, orderId), { code, storedAt: now });
}

/**
 * Forget this order's cached code, so the next request goes to the site.
 * Used when a buyer reports the code did not work — the likeliest cause is
 * that they attempted a fresh login and a newer code now exists.
 */
export function invalidateCachedCode(site: string, orderId: string): void {
  store.delete(keyFor(site, orderId));
}

/** Test seam only. */
export function clearCodeCache(): void {
  store.clear();
}
