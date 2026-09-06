/**
 * cyberspace.cyou adapter.
 *
 * Contract established by running it, 2026-09-06. Full evidence in
 * local/websites/cyberspace.cyou-contract.md (gitignored — it contains real
 * order ids). Every branch below cites the observed response it handles.
 *
 * THE TRAP THIS ADAPTER AVOIDS: every business outcome — success, not-ready,
 * expired, bad order, bad username — returns **HTTP 200**. The "404" recorded
 * in local/sharewebsite-problem.md is a value inside the JSON body, NOT an
 * HTTP status. An adapter branching on `response.status === 404` would
 * silently misclassify expired codes as generic errors forever.
 */
import type { CodeResult, SupplierFetch } from "./types.ts";

const ORIGIN = "https://cyberspace.cyou";
const ENDPOINT = `${ORIGIN}/guide_code`;

/**
 * Observed body codes. All arrive with HTTP 200.
 *   "401" CODE NOT FOUND            — no Steam login attempted yet
 *   "404" CODE TIMEOUT              — code was issued and has lapsed
 *   "305" REACHED LIMIT             — this order id's redemption cap is spent
 *   "103" ORDER ID NOT FOUND        — our supplier_order_id is wrong
 *   "306" EMAIL/USERNAME NOT FOUND  — our stored username is wrong/stale
 *
 * 103 and 306 are OUR data being wrong, not the buyer's: by the time this
 * adapter runs, the buyer's order and username have already been matched
 * against our own database. So they are supplier_error (an ops problem for
 * us) rather than not_ready (something the buyer can fix).
 */
const BODY_CODES: Record<string, CodeResult> = {
  "401": { ok: false, reason: "not_ready" },
  "404": { ok: false, reason: "expired" },
  // "The number of times you can get the login code has reached the limit.
  //  Please contact us for reset." — observed live 2026-09-06 on a real order.
  // The site DOES cap redemptions per order id. Waiting does not clear it;
  // only a reset on their side does.
  "305": { ok: false, reason: "limit_reached" },
  "103": { ok: false, reason: "supplier_error" },
  "306": { ok: false, reason: "supplier_error" },
};

/** Steam Guard's alphabet. Used to sanity-check a value before serving it. */
const STEAM_ALPHABET = /^[23456789BCDFGHJKMNPQRTVWXY]{5}$/;

/**
 * Pure classification of one response. Split from the HTTP call so it can be
 * tested against the verbatim bodies in the contract file without a network.
 */
export function classifyCyberspace(status: number, body: string): CodeResult {
  // The ONE genuine non-200: a missing or invalid CSRF token returns 403 with
  // Django's HTML error page, not JSON.
  if (status === 403) return { ok: false, reason: "supplier_error" };
  if (status < 200 || status >= 300) return { ok: false, reason: "supplier_error" };

  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return { ok: false, reason: "supplier_error" };
  }

  if (typeof parsed !== "object" || parsed === null) {
    return { ok: false, reason: "supplier_error" };
  }

  const code = (parsed as { code?: unknown }).code;
  if (code === undefined || code === null) {
    return { ok: false, reason: "supplier_error" };
  }

  const asString = String(code);

  // Known error codes first. Checked before the success test because the
  // site's own front-end distinguishes them only by length, and an explicit
  // table is safer than a length heuristic for values we have actually seen.
  const known = BODY_CODES[asString];
  if (known) return known;

  // Success. The site's own JS treats `code.toString().length > 3` as success
  // and copies that value to the clipboard — the Guard code rides in the same
  // field that carries the 3-digit error code on failure. We additionally
  // require it to look like a real Steam Guard code, so an unrecognised
  // 4-digit status can never be served to a buyer as if it were a code.
  if (STEAM_ALPHABET.test(asString.toUpperCase())) {
    return { ok: true, code: asString.toUpperCase() };
  }

  // A code value we have never seen and that is not a plausible Guard code.
  return { ok: false, reason: "supplier_error" };
}

/**
 * Extract Django's masked CSRF token from the homepage HTML.
 * The token must be sent as the X-CSRFToken HEADER — the site's own JS never
 * puts it in the body, so the form-field form is unverified and not used.
 */
function extractCsrfToken(html: string): string | null {
  const match = html.match(
    /name=["']csrfmiddlewaretoken["']\s+value=["']([^"']+)["']/,
  );
  return match ? match[1] : null;
}

/** Pull the csrftoken cookie value out of the Set-Cookie headers. */
function extractCsrfCookie(response: Response): string | null {
  const cookies = response.headers.getSetCookie?.() ?? [];
  for (const cookie of cookies) {
    const match = cookie.match(/(?:^|;\s*)csrftoken=([^;]+)/);
    if (match) return match[1];
  }
  return null;
}

/**
 * Two round trips per lookup: a homepage GET for the cookie + masked token,
 * then the POST. The pair was verified reusable across 5 calls over ~90s, but
 * its outer validity is unknown, so we do not cache it — a stale token would
 * turn every supplier lookup into a 403, and a second GET costs ~200ms.
 */
export const cyberspaceFetch: SupplierFetch = async ({
  orderId,
  username,
  signal,
}) => {
  try {
    const home = await fetch(`${ORIGIN}/`, {
      signal,
      headers: { "User-Agent": "Mozilla/5.0" },
    });
    if (!home.ok) return { ok: false, reason: "supplier_error" };

    const html = await home.text();
    const token = extractCsrfToken(html);
    const cookie = extractCsrfCookie(home);
    if (!token || !cookie) return { ok: false, reason: "supplier_error" };

    const response = await fetch(ENDPOINT, {
      method: "POST",
      signal,
      headers: {
        "Content-Type": "application/json",
        "X-CSRFToken": token,
        Cookie: `csrftoken=${cookie}`,
        "User-Agent": "Mozilla/5.0",
      },
      // Trimmed client-side: the site's own front-end trims before sending and
      // there is no evidence the server does.
      body: JSON.stringify({
        order_id: orderId.trim(),
        username: username.trim(),
      }),
    });

    return classifyCyberspace(response.status, await response.text());
  } catch {
    // Includes the AbortSignal timeout. A buyer never sees a stack trace.
    return { ok: false, reason: "supplier_error" };
  }
};
