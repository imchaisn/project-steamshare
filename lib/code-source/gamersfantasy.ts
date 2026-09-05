/**
 * gamersfantasy.my adapter.
 *
 * Contract established by running it, 2026-09-06. Full evidence in
 * local/websites/gamersfantasy.my-contract.md (gitignored — real order ids).
 *
 * Simpler than cyberspace in one way and more fragile in another:
 *   - No CSRF, no session, no cookie. Only the X-Requested-With header.
 *   - But "no code yet" and "wrong username" are structurally IDENTICAL and
 *     differ only by a substring of vendor copy. See SUFFIX below.
 */
import type { CodeResult, SupplierFetch } from "./types.ts";

const ENDPOINT = "https://www.gamersfantasy.my/redeem.php";

/**
 * The only signal separating "no code yet" from "wrong username".
 *
 *   not ready      -> "Steam ID: x - Steam Code Not Found (unavailable/in progress)"
 *   wrong username -> "Steam ID: x - Steam Code Not Found"
 *
 * Same HTTP status, same content type, same JSON structure, same keys. If the
 * supplier ever rewords this copy, the two collapse. We choose the safe
 * direction deliberately: absence of the suffix falls through to
 * supplier_error, NOT to not_ready. Getting that backwards would tell a buyer
 * to "wait and retry" forever while our own stored username was stale — which
 * is not hypothetical, it is exactly the state order a real order was found
 * in on 2026-09-06.
 */
const NOT_READY_SUFFIX = "(unavailable/in progress)";

const STEAM_ALPHABET = /^[23456789BCDFGHJKMNPQRTVWXY]{5}$/;

/**
 * Pure classification of one response. Split from the HTTP call so it can be
 * tested against the verbatim bodies in the contract file without a network.
 */
export function classifyGamersfantasy(status: number, body: string): CodeResult {
  // Missing X-Requested-With returns 403 with an empty body.
  if (status === 403) return { ok: false, reason: "supplier_error" };
  if (status < 200 || status >= 300) return { ok: false, reason: "supplier_error" };

  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return { ok: false, reason: "supplier_error" };
  }

  // A bare OBJECT (not an array) means the request failed order validation —
  // {"ok":false,"errmsg":"Order not found."}. Structurally distinct from every
  // post-validation response, so no string matching is needed here.
  if (!Array.isArray(parsed)) {
    return { ok: false, reason: "supplier_error" };
  }

  const entry = parsed[0];
  if (typeof entry !== "object" || entry === null) {
    return { ok: false, reason: "supplier_error" };
  }

  const item = entry as {
    ok?: unknown;
    steamcode?: unknown;
    remainingCooldown?: unknown;
    errmsg?: unknown;
  };

  if (item.ok === true) {
    // Cooldown: ok:true but no code yet, with seconds remaining. Explicitly a
    // "try again shortly" state rather than an error.
    if (item.remainingCooldown !== undefined && !item.steamcode) {
      return { ok: false, reason: "not_ready" };
    }
    if (typeof item.steamcode === "string") {
      const code = item.steamcode.trim().toUpperCase();
      if (STEAM_ALPHABET.test(code)) return { ok: true, code };
    }
    return { ok: false, reason: "supplier_error" };
  }

  const errmsg = typeof item.errmsg === "string" ? item.errmsg : "";
  if (errmsg.includes(NOT_READY_SUFFIX)) {
    return { ok: false, reason: "not_ready" };
  }

  // NOTE — "expired" is NOT mapped for this supplier, on purpose.
  // The researcher could not produce an expired state (it needs a real Steam
  // login first), and this site's own client JS has no expiry branch at all:
  // only ok:true+steamcode, ok:true+remainingCooldown, and ok:false+errmsg.
  // Inventing an `expired` mapping here would be fabricating a response shape
  // we have never seen. If an expired code reads back as the not-ready suffix,
  // it is already handled above; anything else lands on supplier_error, which
  // is the honest answer for a state we have not characterised.
  return { ok: false, reason: "supplier_error" };
}

export const gamersfantasyFetch: SupplierFetch = async ({
  orderId,
  username,
  signal,
}) => {
  try {
    // The HTML input is id="steamusername" but the wire field the site's own
    // JS posts is `stusername`. Using the visible id would 403 nothing and
    // simply never match an order.
    const form = new URLSearchParams({
      orderid: orderId.trim(),
      stusername: username.trim(),
      action: "getsteamguardcode",
    });

    const response = await fetch(ENDPOINT, {
      method: "POST",
      signal,
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "X-Requested-With": "XMLHttpRequest",
        "User-Agent": "Mozilla/5.0",
      },
      body: form.toString(),
    });

    return classifyGamersfantasy(response.status, await response.text());
  } catch {
    return { ok: false, reason: "supplier_error" };
  }
};
