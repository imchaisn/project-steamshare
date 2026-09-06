import { NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { verifyShopeeOrder, type VerifiedOrderGame } from "@/lib/shopee";
import { decrypt } from "@/lib/encryption";
import { lookupCode, resolveDisplayCredentials } from "@/lib/code-source";
import { logSupplierFetch } from "@/lib/code-source/log";
import { failureResponseFor } from "@/lib/code-source/outcome";
import {
  checkRateLimit,
  getClientIp,
  isRateLimitExempt,
  recordLookupAttempt,
  type LookupOutcome,
} from "@/lib/rate-limit";

/**
 * A lookup that goes to one of our other websites takes ~5.5 s there (measured
 * 2026-09-06), plus our own DB reads — and a gamersfantasy.my code fetch now
 * retries a not-ready answer for up to 15 s on top of that. The platform
 * default would kill the function mid-flight and return ITS error page, losing
 * both the buyer-facing message and the rate-limit outcome we record. 35 s
 * leaves SUPPLIER_TIMEOUT_MS (20 s) room to fire first, so every failure is
 * still one we shaped.
 *
 * Costs nothing on the common path: a code minted from our own Guard seed
 * never touches the network and returns in milliseconds.
 *
 * MULTI-GAME NOTE: the `credentials` phase resolves every game on the order,
 * and for supplier-backed games that means one order-lookup call each. Those
 * run in PARALLEL (see resolveOrderGames) precisely so a four-game order does
 * not serialise four ~5.5 s round trips into a timeout. The `code` phase
 * still touches exactly ONE game — the one the buyer pressed — so its timing
 * is unchanged no matter how many games the order holds.
 */
export const maxDuration = 35;

/** Same generic message for every non-resolving lookup, so it can't be used to probe. */
const NOT_FOUND = "Order not found or not verified";

/**
 * `phase` splits what used to be one atomic call, added 2026-09-06 for the
 * staged buyer flow (check -> reveal credentials -> get code).
 *
 * "credentials" stops before ever contacting a supplier for a CODE: no code
 * fetch, no redemption spent. This exists because the buyer needs the username
 * and password just to REACH Steam's login screen — for a supplier-sourced
 * account, requiring a successful code fetch first (the old all-in-one
 * behaviour) would have meant the buyer could never get the code, because
 * they could never get to Steam's prompt without the credentials the code
 * fetch was gating.
 *
 * "code" (or the field omitted entirely) keeps the original all-in-one
 * behaviour, so any existing caller that never sends `phase` is unaffected.
 */
type Phase = "credentials" | "code";

/** The steam_accounts columns this route needs, per game. */
interface ResolvedGameAccount {
  orderGameId: string;
  position: number;
  gameTitle: string | null;
  supplierSite: string | null;
  supplierOrderId: string | null;
  account: {
    id: string;
    username: string;
    password_enc: string;
    shared_secret_enc: string | null;
    status: string | null;
    code_source: string | null;
    supplier_site: string | null;
    supplier_order_id: string | null;
  };
}

/**
 * Resolve one `order_games` line to its Steam account and game title.
 *
 * Returns null when the line has no allocation, or the account/game rows are
 * missing. A null is DROPPED from the buyer's list rather than surfaced: a
 * game we cannot resolve is one we cannot serve, and showing an empty card
 * would only confuse. The gap is visible to ops in the admin Orders tab and
 * in scripts/reconcile-shopee-orders.mjs.
 */
async function resolveGame(
  supabase: ReturnType<typeof createAdminClient>,
  game: VerifiedOrderGame,
): Promise<ResolvedGameAccount | null> {
  if (!game.accountGameId) return null;

  const { data: accountGame, error: agError } = await supabase
    .from("account_games")
    .select("account_id, game_id")
    .eq("id", game.accountGameId)
    .maybeSingle();

  if (agError || !accountGame) return null;

  const [{ data: account, error: accountError }, { data: gameRow }] = await Promise.all([
    supabase
      .from("steam_accounts")
      .select(
        "id, username, password_enc, shared_secret_enc, status, code_source, supplier_site, supplier_order_id",
      )
      .eq("id", accountGame.account_id)
      .maybeSingle(),
    supabase.from("games").select("title").eq("id", accountGame.game_id).maybeSingle(),
  ]);

  if (accountError || !account) return null;

  return {
    orderGameId: game.orderGameId,
    position: game.position,
    gameTitle: (gameRow as { title: string } | null)?.title ?? null,
    supplierSite: game.supplierSite,
    supplierOrderId: game.supplierOrderId,
    account: account as ResolvedGameAccount["account"],
  };
}

/**
 * Verify the order and resolve every game on it.
 *
 * The per-game resolutions run in parallel — they are independent reads, and
 * a four-game order resolving them serially would triple the time before the
 * buyer sees anything.
 */
async function resolveOrder(orderId: string) {
  const verification = await verifyShopeeOrder(orderId);
  if (!verification.verified || verification.games.length === 0) {
    return { ok: false as const };
  }

  const supabase = createAdminClient();
  const resolved = (
    await Promise.all(verification.games.map((g) => resolveGame(supabase, g)))
  ).filter((g): g is ResolvedGameAccount => g !== null);

  if (resolved.length === 0) return { ok: false as const };

  return { ok: true as const, verification, supabase, games: resolved };
}

export async function POST(request: Request) {
  const ip = getClientIp(request);
  // Admin/programmatic callers holding API_SECRET skip the limiter entirely
  // and leave no counters behind. See lib/rate-limit.ts, escape hatch #1.
  const exempt = isRateLimitExempt(request);

  // Parse the body BEFORE the limiter, so the order id can be used as the
  // primary rate-limit key. A malformed body simply yields no order key and
  // is limited on IP alone.
  let body: {
    orderId?: string;
    refresh?: boolean;
    phase?: Phase;
    username?: string;
    gameId?: string;
  } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    body = {};
  }
  const orderId = body.orderId;
  const phase: Phase = body.phase === "credentials" ? "credentials" : "code";

  /** Record this attempt's outcome, then return the response. */
  const finish = async (outcome: LookupOutcome, response: NextResponse) => {
    if (!exempt) await recordLookupAttempt({ ip, orderId, outcome });
    return response;
  };

  if (!exempt) {
    const rateLimit = await checkRateLimit({ ip, orderId });
    if (!rateLimit.allowed) {
      const message =
        rateLimit.limitedBy === "order"
          ? "Too many lookups for this order. Please wait a few minutes and try again, or contact support."
          : "Too many attempts from your network. Please wait a few minutes and try again, or contact support.";
      return finish(
        "blocked",
        NextResponse.json(
          { error: message },
          {
            status: 429,
            headers: {
              "Retry-After": String(rateLimit.retryAfterSeconds ?? 60),
            },
          },
        ),
      );
    }
  }

  if (!orderId) {
    return finish(
      "failure",
      NextResponse.json({ error: "orderId is required" }, { status: 400 }),
    );
  }

  const resolved = await resolveOrder(orderId);
  if (!resolved.ok) {
    return finish(
      "failure",
      NextResponse.json({ error: NOT_FOUND }, { status: 404 }),
    );
  }
  const { verification, supabase, games } = resolved;

  // Chaison's call, 2026-09-06: the lookup is order-id-only. A supplied
  // username used to have to match the account before a supplier was ever
  // contacted — that check is now GONE. Knowing (or guessing) a GameShare
  // order id alone is sufficient to pull that account's password and code;
  // nothing here still requires proof the caller is the actual buyer.
  // Order verified + account active still gate everything below, so it isn't
  // fully open, but the specific messages returned are no longer protected
  // from anyone who has an order id, only from someone with neither.
  if (phase === "credentials") {
    // ── ACCOUNT STATUS IS NOW PER GAME ──────────────────────────────────
    // A four-game order whose second game sits on a `recovering` account
    // must still serve the other three. Previously one bad account failed
    // the whole lookup, which was correct when an order held exactly one
    // game and is wrong now. Games we cannot serve are returned with
    // `unavailable: true` so the page can say so in place of that one card,
    // rather than being dropped (which would look like the buyer never
    // bought it).
    const serveable = games.filter((g) => g.account.status === "active");

    if (serveable.length === 0) {
      // The order is genuine — this buyer is hitting an ops problem, not
      // enumerating. Recorded at the light weight.
      return finish(
        "unavailable",
        NextResponse.json(
          { error: "Account temporarily unavailable, contact support" },
          { status: 403 },
        ),
      );
    }

    const cards = await Promise.all(
      games.map(async (game) => {
        if (game.account.status !== "active") {
          return {
            gameId: game.orderGameId,
            title: game.gameTitle,
            unavailable: true as const,
          };
        }

        // For a supplier that pools several accounts behind one order id
        // (confirmed for gamersfantasy.my — see
        // local/websites/gamersfantasy.my.md), the stored steam_accounts row
        // can be stale the moment it's read. This resolves the account
        // CURRENTLY in use, the same way the code fetch below already does,
        // so a buyer is never shown one account and then have the code
        // fetched for a different one. Returns null (falls back to the stored
        // row) for TOTP accounts and for suppliers with no resolver — see
        // CREDENTIAL_RESOLVERS in lib/code-source/index.ts.
        //
        // PER-GAME MAPPING: each card resolves against ITS OWN game line's
        // supplier mapping, which is the whole reason migration 0014 moved
        // those columns off `orders`. One order can legitimately hold a
        // gamersfantasy.my game next to a cyberspace.cyou game.
        const live = await resolveDisplayCredentials(game.account, {
          supplierSite: game.supplierSite,
          supplierOrderId: game.supplierOrderId,
        });
        if (live) {
          return {
            gameId: game.orderGameId,
            title: game.gameTitle,
            username: live.username,
            password: live.password,
          };
        }
        return {
          gameId: game.orderGameId,
          title: game.gameTitle,
          username: game.account.username,
          password: await decrypt(game.account.password_enc),
        };
      }),
    );

    const first = cards.find((c) => "username" in c) as
      | { username: string; password: string }
      | undefined;

    return finish(
      "success",
      NextResponse.json({
        games: cards,
        // LEGACY MIRROR of the first serveable game. Kept so callers written
        // against the single-game response — /ss-verify-live, the seed
        // scripts, anything of Chaison's not in this repo — keep working
        // unchanged. New callers should read `games`.
        username: first?.username,
        password: first?.password,
      }),
    );
  }

  // phase === "code" from here.
  //
  // WHICH GAME. A multi-game order has one Get Code button per game, and the
  // page sends that game's `order_games.id` back as `gameId`. Falling back to
  // the first game keeps every pre-multi-game caller working: a request with
  // no gameId behaves exactly as it did when an order could only hold one.
  const requestedGameId = body.gameId?.trim();
  const game = requestedGameId
    ? games.find((g) => g.orderGameId === requestedGameId)
    : games[0];

  if (!game) {
    // A gameId that is not on THIS order. Not an enumeration vector — the
    // caller already proved they hold a verified order id — but it must not
    // silently serve a different game's code than the button they pressed.
    return finish(
      "failure",
      NextResponse.json({ error: NOT_FOUND }, { status: 404 }),
    );
  }

  if (game.account.status !== "active") {
    return finish(
      "unavailable",
      NextResponse.json(
        { error: "Account temporarily unavailable, contact support" },
        { status: 403 },
      ),
    );
  }

  // THE PINNED ACCOUNT. On a pooled supplier order (gamersfantasy.my), the
  // credentials phase resolved ONE specific pool member and showed it to this
  // buyer, who is now logged into Steam as that account. The page sends it
  // back here so the code is fetched for the SAME account. Without this, the
  // fetch would target account.username — a different pool member, with
  // nobody at its Steam prompt — and could only ever answer "not ready".
  // See RESOLVE-ONCE in lib/code-source/gamersfantasy.ts.
  //
  // Not a security control and not treated as one: the username is no longer
  // verified against anything (see the note above), so this only steers WHICH
  // of this order's own accounts is asked about. An order still cannot reach
  // an account it was not allocated.
  const pinnedUsername = body.username?.trim();
  const targetAccount = pinnedUsername
    ? { ...game.account, username: pinnedUsername }
    : game.account;

  // The mapping is passed in explicitly, and it is now THIS GAME'S mapping:
  // if this game line is connected to another of our websites' order ids,
  // that link decides where its code comes from. Unmapped games fall back to
  // the account's own default.
  //
  // `refresh` is the buyer saying "I logged in again, give me the NEWEST code".
  // It bypasses the cache and therefore always spends a redemption, which is
  // why it is opt-in: an ordinary press should be free when the value has not
  // changed. See lib/code-source/cache.ts.
  const lookup = await lookupCode(
    targetAccount,
    { forceRefresh: body.refresh === true },
    {
      supplierSite: game.supplierSite,
      supplierOrderId: game.supplierOrderId,
    },
  );
  const codeResult = lookup.result;

  // Ledger: one row per REAL request to the other site. A cache hit is not
  // recorded, because it spent nothing — counting it would hide how many
  // redemptions an order has left. Never throws; the buyer already has their
  // code by this point.
  let ledger: { changed: boolean | null; spent: number | null } = {
    changed: null,
    spent: null,
  };
  if (lookup.hitSite && lookup.site && lookup.supplierOrderId) {
    ledger = await logSupplierFetch({
      orderId: verification.orderId!,
      supplierSite: lookup.site,
      supplierOrderId: lookup.supplierOrderId,
      result: codeResult,
    });
  }

  if (!codeResult.ok) {
    // Never "failure": see lib/code-source/outcome.ts. Recording these at the
    // heavy weight would lock a waiting buyer out after six retries.
    const { outcome, status, error } = failureResponseFor(codeResult.reason);
    return finish(outcome, NextResponse.json({ error }, { status }));
  }

  // Decrypted again here (also decrypted above for phase "credentials")
  // rather than threaded between calls, since the two phases are separate
  // requests — keeping each phase self-contained is worth one extra decrypt.
  const password = await decrypt(game.account.password_enc);

  await supabase.from("code_access_log").insert({
    order_id: verification.orderId,
    ip,
  });

  return finish(
    "success",
    NextResponse.json({
      // Echo which game this code is for, so a page with four Get Code
      // buttons in flight can never paint a code into the wrong card.
      gameId: game.orderGameId,
      title: game.gameTitle,
      // The pinned account, so what's echoed back matches the code served.
      username: targetAccount.username,
      password,
      code: codeResult.code,
      // Whether this differs from the last code we served for this order, so
      // the page can tell a buyer "this is the same code as before" rather
      // than leaving them wondering why nothing looks new. Null when the code
      // came from cache or is not from another of our sites.
      codeChanged: ledger.changed,
    }),
  );
}
