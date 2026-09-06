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
 *
 * Resolves the account before every fetch (added 2026-09-06) — see
 * RESOLVE-FIRST below. This is the one supplier adapter that does this;
 * cyberspace.cyou's account is stable and does not need it.
 */
import type { CodeResult, SupplierFetch } from "./types.ts";

const ENDPOINT = "https://www.gamersfantasy.my/redeem.php";

/**
 * RESOLVE-FIRST — why this adapter never trusts `steam_accounts.username`.
 *
 * `types.ts`'s own header states the cross-site design assumption: "The
 * username and password are identical across our sites; only the order id
 * differs." That is FALSIFIED for this supplier. Live checks on 2026-09-06
 * queried the same gamersfantasy.my order id (2609069D9MXVAP) repeatedly in
 * one day and got back FOUR different usernames (evilfantasynine1, 2, 4, then
 * 3) — see local/websites/gamersfantasy.my.md. This site can reassign which
 * underlying account answers for an order id; the assumption holds for
 * cyberspace.cyou (repeatedly confirmed stable) but not here.
 *
 * A stored username can therefore go stale between when we recorded it and
 * when a buyer redeems. Since "wrong username" and "no code yet" are
 * indistinguishable on this portal's OTHER endpoint (see NOT_READY_SUFFIX
 * below), a stale stored value would silently masquerade as "not ready yet"
 * forever — exactly the failure this resolves.
 *
 * The fix: call `prechkorder` (the same free lookup the supplier's own
 * homepage uses, no redemption spent) immediately before every code fetch,
 * and use WHATEVER username it returns right now. The account handed to a
 * buyer at delivery time and the account resolved here can still disagree if
 * the supplier reassigns in between — that gap is a known, currently
 * unresolved risk on top of this fix, not something this function can close
 * on its own.
 */
export interface PrechkorderAccount {
  username: string;
  password: string;
}

/**
 * Pure parse of a `prechkorder` response body. Split out for the same reason
 * as classifyGamersfantasy below: testable against a captured fixture with no
 * network involved. Returns null for anything that isn't a clean single-item
 * success — an order lookup failure here should read as "could not resolve",
 * never throw.
 */
export function parsePrechkorderAccount(body: string): PrechkorderAccount | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return null;
  }

  if (
    typeof parsed !== "object" ||
    parsed === null ||
    (parsed as { ok?: unknown }).ok !== true
  ) {
    return null;
  }

  const itemslist = (parsed as { itemslist?: unknown }).itemslist;
  const item = Array.isArray(itemslist) ? itemslist[0] : null;
  const okLines = (
    item as { itemsdataresult?: { content?: { ok?: unknown } } } | null
  )?.itemsdataresult?.content?.ok;
  const line = Array.isArray(okLines) ? okLines[0] : null;
  if (typeof line !== "string") return null;

  // Line shape: "ID: <username> PASS: <password>".
  const match = line.match(/ID:\s*(\S+)\s+PASS:\s*(.+)$/i);
  return match ? { username: match[1].trim(), password: match[2].trim() } : null;
}

async function fetchPrechkorderAccount(
  orderId: string,
  signal: AbortSignal,
): Promise<PrechkorderAccount | null> {
  let response: Response;
  try {
    response = await fetch(ENDPOINT, {
      method: "POST",
      signal,
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "X-Requested-With": "XMLHttpRequest",
        "User-Agent": "Mozilla/5.0",
      },
      body: new URLSearchParams({
        orderid: orderId.trim(),
        action: "prechkorder",
      }).toString(),
    });
  } catch {
    return null;
  }

  return parsePrechkorderAccount(await response.text());
}

/**
 * Exposed so the buyer-facing "reveal credentials" step (app/api/lookup's
 * `phase: "credentials"`) can show the account CURRENTLY assigned to a pooled
 * order id, instead of whatever this order id's steam_accounts row happened
 * to record when we last seeded it. Order `2609069D9MXVAP` is confirmed to
 * draw from a pool of at least 5 accounts — see
 * local/websites/gamersfantasy.my.md — and prechkorder is the only thing that
 * knows which one is current. Costs no redemption; safe to call on every page
 * load, not just before a code fetch.
 */
export async function resolveCurrentAccount(
  orderId: string,
  signal: AbortSignal,
): Promise<PrechkorderAccount | null> {
  return fetchPrechkorderAccount(orderId, signal);
}

async function resolveCurrentUsername(
  orderId: string,
  signal: AbortSignal,
): Promise<{ ok: true; username: string } | { ok: false }> {
  const account = await fetchPrechkorderAccount(orderId, signal);
  return account ? { ok: true, username: account.username } : { ok: false };
}

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

export const gamersfantasyFetch: SupplierFetch = async ({ orderId, signal }) => {
  // See RESOLVE-FIRST above — the stored account username is never used for
  // this supplier. `username` is intentionally not destructured from the
  // SupplierFetch args.
  const resolved = await resolveCurrentUsername(orderId, signal);
  if (!resolved.ok) return { ok: false, reason: "supplier_error" };

  try {
    // The HTML input is id="steamusername" but the wire field the site's own
    // JS posts is `stusername`. Using the visible id would 403 nothing and
    // simply never match an order.
    const form = new URLSearchParams({
      orderid: orderId.trim(),
      stusername: resolved.username,
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
