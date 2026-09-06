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
 * This is the one supplier whose order id is backed by a POOL of accounts, so
 * it is the one adapter that needs an account resolved at all — see
 * RESOLVE-ONCE below. cyberspace.cyou holds one stable account per order id
 * and needs none of this.
 */
import type { CodeResult, SupplierFetch } from "./types.ts";

const ENDPOINT = "https://www.gamersfantasy.my/redeem.php";

/**
 * RESOLVE-ONCE — resolve the account when credentials are shown, then pin it.
 *
 * `types.ts`'s own header states the cross-site design assumption: "The
 * username and password are identical across our sites; only the order id
 * differs." That is FALSIFIED for this supplier. One order id
 * (2609069D9MXVAP) is backed by a pool of at least five distinct accounts,
 * and `prechkorder` returns a different member on practically every call —
 * see local/websites/gamersfantasy.my.md. cyberspace.cyou is unaffected.
 *
 * So the account is resolved EXACTLY ONCE per buyer journey, at the moment
 * credentials are revealed (resolveDisplayCredentials in ./index.ts), and
 * that same account is then pinned for the code fetch. `prechkorder` is the
 * free lookup the supplier's own homepage uses — resolving costs no
 * redemption.
 *
 * Why not resolve again at fetch time (an earlier version of this file did):
 * the buyer is logged into Steam as ONE specific pool member. Re-resolving
 * would ask for a code belonging to whichever member the site's rotation
 * happens to name at that instant, which is usually a DIFFERENT account with
 * nobody at its prompt — an answer that can only be "not ready", however long
 * you wait, while spending real quota to get it.
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

/**
 * How long to keep asking for a code that is not ready yet, and how far apart
 * the asks are. Chaison's call, 2026-09-06: "make the timeout longer, until
 * the point you can actually get the code — if you can't after perhaps 15
 * seconds, say try again."
 *
 * THE INTERVAL IS DELIBERATELY LONG, and it is not a latency knob. Every
 * attempt is a real request to the site, and this site caps redemptions per
 * order id at roughly 5-6 before returning REACHED LIMIT until a manual reset.
 * Six development fetches exhausted a real saleable order on 2026-09-06
 * (CHECKPOINT.md). At 5 s apart a full 15 s wait costs at most FOUR attempts;
 * at 1 s apart it would cost fifteen and could burn an entire order's quota on
 * a single button press. Whether a not-ready answer consumes quota the same
 * way a served code does is NOT established — so this errs toward assuming it
 * does.
 *
 * Both are env-tunable so the pace can be corrected from the Vercel dashboard
 * if real usage shows the assumption was wrong, without a code change.
 */
function retryBudgetMs(): number {
  const raw = Number.parseInt(process.env.SUPPLIER_RETRY_BUDGET_MS ?? "", 10);
  return Number.isFinite(raw) && raw >= 0 ? raw : 15000;
}

function retryIntervalMs(): number {
  const raw = Number.parseInt(process.env.SUPPLIER_RETRY_INTERVAL_MS ?? "", 10);
  return Number.isFinite(raw) && raw >= 0 ? raw : 5000;
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Keep attempting while the answer is "not ready", up to a time budget.
 *
 * Split from the HTTP call, with `sleep`/`now` injectable, so the pacing can
 * be tested without waiting real seconds or touching a network.
 *
 * ONLY `not_ready` is retried. A supplier_error means something is actually
 * wrong (bad username, network, unparseable body) and asking again the same
 * way just spends another redemption to be told the same thing.
 */
export async function retryWhileNotReady(
  attempt: () => Promise<CodeResult>,
  opts: {
    budgetMs: number;
    intervalMs: number;
    sleepFn?: (ms: number) => Promise<void>;
    nowFn?: () => number;
  },
): Promise<CodeResult> {
  const sleepFn = opts.sleepFn ?? sleep;
  const nowFn = opts.nowFn ?? Date.now;
  const deadline = nowFn() + opts.budgetMs;

  for (;;) {
    const result = await attempt();
    if (result.ok || result.reason !== "not_ready") return result;
    // Out of time: hand back the not_ready as-is, so the buyer gets "log into
    // Steam first, then press Get Code" rather than a generic error. Giving up
    // is the honest answer, not a failure of ours.
    if (nowFn() >= deadline) return result;
    await sleepFn(opts.intervalMs);
  }
}

export const gamersfantasyFetch: SupplierFetch = async ({ orderId, username, signal }) => {
  // PINNED, NOT RE-RESOLVED — and this reverses an earlier version of this
  // adapter, deliberately.
  //
  // That version called prechkorder here and used whatever account came back.
  // On a pooled order that is actively wrong: prechkorder returns a DIFFERENT
  // pool member on practically every call, while the buyer is logged into
  // Steam as exactly one of them — the one they were shown at credentials
  // time. Asking for a code belonging to a different pool member than the one
  // sitting at Steam's prompt can only ever answer "not ready", no matter how
  // long you wait, and each ask spends real quota.
  //
  // So the account is decided ONCE, when credentials are revealed
  // (resolveDisplayCredentials in ./index.ts), and carried here as `username`.
  // Whatever the site's own rotation does in the meantime is irrelevant: the
  // buyer's Steam session does not rotate.
  const attempt = async (): Promise<CodeResult> => {
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

  return retryWhileNotReady(attempt, {
    budgetMs: retryBudgetMs(),
    intervalMs: retryIntervalMs(),
  });
};
