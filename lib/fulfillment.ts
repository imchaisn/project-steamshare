/**
 * Automated fulfillment — turn a paid Shopee order into a verified `orders`
 * row pointing at a real Steam account, then render the Shopee-chat message
 * that tells the buyer how to collect their code.
 *
 * This module is the write end of the push pipeline:
 *   webhook -> getOrderDetail() -> fulfillOrder() -> sendBuyerMessage()
 *
 * IDEMPOTENCY IS THE WHOLE POINT OF THIS FILE. Shopee retries any push it
 * considers failed at 300s / 1800s / 10800s, so the same order_sn WILL arrive
 * more than once. A second `orders` row for one shopee_order_id is not a
 * cosmetic duplicate — verifyShopeeOrder() (lib/shopee.ts) reads with
 * .maybeSingle(), which errors on multiple matches, so the duplicate
 * PERMANENTLY BREAKS that buyer's lookup. That happened for real on
 * 2026-08-26 with order ssp123; migration 0005 exists because of it.
 * Every path below is therefore written to be safe to run twice, and to
 * degrade a lost race into `already_exists` rather than into an error.
 *
 * All reads/writes go through createAdminClient() (service role, bypasses the
 * deny-all RLS from 0001_init.sql), same as every other server-side module.
 */

import type { createAdminClient } from "@/utils/supabase/admin";
// PRE-0014 FALLBACK — remove with lib/order-games-compat.ts once 0014 is applied.
//
// RELATIVE, with the .ts extension, NOT the `@/` alias. This module has to
// stay loadable by bare `node --test` (see the getAdminClient docblock below):
// the alias is a tsconfig path that Node cannot resolve, so a `@/` import here
// makes the whole file unloadable and takes buildDeliveryMessage's tests —
// the ones guarding what reaches a buyer — down with it.
import { isMissingOrderGames, warnLegacyMode } from "./order-games-compat.ts";

/**
 * The service-role client is pulled in lazily rather than with a top-level
 * `import { createAdminClient }`, which is what lib/shopee.ts does.
 *
 * The reason is testability, not preference: buildDeliveryMessage() below is
 * pure and is the one buyer-visible, credential-sensitive thing in this file,
 * so it needs unit tests — but this repo's tests run on bare `node --test`
 * (see lib/encryption.test.ts), and Node does not resolve the `@/` tsconfig
 * path alias. A static import would make the whole module unloadable by the
 * test runner and there is no loader/mocking dependency in this project to
 * bridge that, nor is adding one in scope. Deferring the import to call time
 * keeps the alias (and the house style at the import site) while leaving the
 * pure half of the module importable. tsc still type-checks it fully.
 */
async function getAdminClient(): Promise<AdminClient> {
  const mod = await import("@/utils/supabase/admin");
  return mod.createAdminClient();
}

/**
 * Value written to `orders.source` for rows this module creates. The column
 * defaults to 'manual' (admin-panel path); this marks the automated path so
 * ops can tell at a glance which rows a human made and which the webhook did.
 *
 * 0008_orders_auto_delivery.sql deliberately adds NO check constraint on this
 * column, because the vocabulary was not settled when it was written and a
 * guessed enum would have failed the insert in production. So this constant
 * IS the vocabulary — it is the single source of truth for that string. A
 * later migration adding `check (source in ('manual', ...))` must include
 * this exact literal, or every automated insert starts failing.
 */
export const AUTOMATED_ORDER_SOURCE = "shopee_push";

/**
 * Sentinel model id used by `shopee_listings` for a listing that has no
 * variations. Shopee sends model_id 0 for such items, and the agreed schema
 * defaults the column to 0, so this is both the fallback key and the literal
 * Shopee sends — not an invented value.
 */
const NO_MODEL_ID = 0;

/** Steam accounts in any other status must never be handed to a new buyer. */
const ELIGIBLE_ACCOUNT_STATUS = "active";

/**
 * How many buyers one Steam account may hold for one game before allocation
 * moves on to the next account.
 *
 * This product deliberately shares an account between buyers, so the limit is
 * not correctness — it is playability. Too many people on one Steam account and
 * they start knocking each other out of sessions, which arrives as "I can't log
 * in" in Shopee chat (see roadmap item D).
 *
 * 5 is a starting point, not a measured figure. Nothing yet establishes what a
 * Steam account actually tolerates; that only becomes knowable with real volume.
 * It is an env var so it can be tuned without a code change when it does.
 */
export function accountMaxBuyers(): number {
  const raw = process.env.ACCOUNT_MAX_BUYERS;
  if (raw === undefined) return 5;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 5;
}

export interface AllocationCandidate {
  id: string;
  created_at: string;
}

/**
 * Choose which account_games row a new order goes to — WATERFALL, not spread.
 *
 * Fill one account up to the cap, then move to the next. Chaison's call
 * (2026-09-06), and it replaces the previous least-loaded balancing.
 *
 * Why waterfall beats spreading here: an account only causes trouble once
 * enough buyers are on it at once, so concentrating buyers onto one account
 * until it is full leaves every other account completely clean. Spreading puts
 * a few buyers on ALL of them, so a game with six accounts has six
 * lightly-loaded accounts and no pristine spares to reassign a complaining
 * buyer to.
 *
 * Order is deterministic — oldest account_games row first, then id — so the
 * same account fills first every time and "which account is currently in use"
 * is a stable, explainable answer rather than whatever sorted first today.
 *
 * WHEN EVERY ACCOUNT IS AT THE CAP it returns the least-loaded one rather than
 * nothing. The buyer has already paid; refusing them a login to honour a
 * self-imposed limit would be the worse failure. Overflow is visible in /admin
 * as a count above the cap, which is the signal to buy another account.
 */
export function chooseAccountGame(
  candidates: AllocationCandidate[],
  load: Map<string, number>,
  cap: number,
): string | null {
  if (candidates.length === 0) return null;

  const ordered = [...candidates].sort((a, b) => {
    if (a.created_at !== b.created_at) {
      return a.created_at < b.created_at ? -1 : 1;
    }
    return a.id < b.id ? -1 : 1;
  });

  const underCap = ordered.find((c) => (load.get(c.id) ?? 0) < cap);
  if (underCap) return underCap.id;

  // Everything is full. Serve the buyer on whichever is least crowded.
  let fallback = ordered[0];
  for (const c of ordered) {
    if ((load.get(c.id) ?? 0) < (load.get(fallback.id) ?? 0)) fallback = c;
  }
  return fallback.id;
}

/**
 * `partial` (added 2026-09-06 with multi-game orders) means SOME of the order
 * was fulfilled and some was not — either a line item mapped to no game we
 * sell, or a game we do sell had no active account free.
 *
 * It is deliberately NOT an error: Chaison's call is to deliver what we can
 * immediately and flag the remainder loudly, because the buyer has already
 * paid and a partially-served buyer is strictly better off than an unserved
 * one. The webhook still ACKs and still auto-ships on `partial` — see the
 * retry-decision docblock in app/api/webhooks/shopee/route.ts.
 *
 * `no_mapping` still means ZERO items mapped, and `no_capacity` still means
 * ZERO games could be allocated. Those thresholds are unchanged, so existing
 * handling of both keeps its exact meaning.
 */
export type FulfillmentStatus =
  | "created"
  | "partial"
  | "already_exists"
  | "no_mapping"
  | "no_capacity";

/** One purchased line item, as produced by getOrderDetail() in lib/shopee-api.ts. */
export interface FulfillmentItem {
  itemId: number;
  modelId: number;
  itemName?: string | null;
}

export interface FulfillOrderInput {
  orderSn: string;
  /** Shopee masks buyer PII on some orders, so this is genuinely optional. */
  buyerUsername: string | null;
  items: FulfillmentItem[];
}

/** One game on a fulfilled order — one `order_games` row, resolved. */
export interface FulfilledGame {
  /**
   * `order_games.id`. This is the handle everything downstream uses: the
   * per-game delivery latch, and the `gameId` the buyer's page sends back to
   * /api/lookup to say which game it wants a code for.
   */
  orderGameId: string;
  gameTitle: string | null;
  steamUsername: string | null;
  /**
   * DECRYPTED Steam password for this game's allocated account, for the
   * delivery message only. See ResolvedAccount.steamPassword — never log
   * this, never include it in an error string, never return it from an API
   * route other than the buyer's own authenticated lookup.
   */
  steamPassword: string | null;
  /** Display order, mirroring the order Shopee listed the items in. */
  position: number;
}

/**
 * `orderRowId` is null for the outcomes where no row exists (no_mapping and
 * no_capacity always).
 *
 * `games` is empty for those same outcomes, and for `already_exists` when the
 * pre-existing order has order_games rows with null account_game_id (e.g. an
 * admin created placeholders by hand).
 */
export interface FulfillOrderResult {
  status: FulfillmentStatus;
  orderRowId: string | null;
  /** One entry per game actually allocated, in display order. */
  games: FulfilledGame[];
  /**
   * Line items that mapped to NO game we sell. Non-empty means a human must
   * add a `shopee_listings` row and top this buyer up — the webhook logs it
   * as ACTION REQUIRED. Never silently dropped, which is the whole point of
   * the multi-game rework.
   */
  unmatchedItems: FulfillmentItem[];
  /**
   * Games that mapped fine but had no active account free. Same ACTION
   * REQUIRED severity as unmatchedItems, different fix: buy/activate an
   * account rather than add a listing mapping.
   */
  unallocatedGameIds: string[];
}

type AdminClient = ReturnType<typeof createAdminClient>;

interface ResolvedAccount {
  accountGameId: string;
  steamUsername: string | null;
  gameTitle: string | null;
  /**
   * DECRYPTED Steam password. Null when the account row is missing, has no
   * stored password, or decryption failed.
   *
   * ⚠ This is a live shared-account credential in plaintext. It exists here
   * because Chaison decided on 2026-09-05 that the Shopee delivery message
   * should carry the password (see buildDeliveryMessage). Keep its blast
   * radius small: never log it, never put it in an error string, and never
   * return it from an API route. It has exactly one destination — the chat
   * message body.
   */
  steamPassword: string | null;
}

/**
 * Resolve an account_games row to the account username + game title the
 * buyer-facing message needs.
 *
 * Deliberately three plain queries instead of one PostgREST embed: the embed
 * shape (`steam_accounts(...)` returning an object vs. an array) depends on
 * how PostgREST infers the FK, and getting that wrong fails silently as
 * `undefined`. This runs once per order, so the extra round trips are free
 * and the behaviour is unambiguous.
 */
async function resolveAccountGame(
  supabase: AdminClient,
  accountGameId: string,
): Promise<ResolvedAccount> {
  const { data: accountGame } = await supabase
    .from("account_games")
    .select("id, account_id, game_id")
    .eq("id", accountGameId)
    .maybeSingle();

  if (!accountGame) {
    return { accountGameId, steamUsername: null, gameTitle: null, steamPassword: null };
  }

  const [{ data: account }, { data: game }] = await Promise.all([
    supabase
      .from("steam_accounts")
      .select("username, password_enc")
      .eq("id", accountGame.account_id)
      .maybeSingle(),
    supabase
      .from("games")
      .select("title")
      .eq("id", accountGame.game_id)
      .maybeSingle(),
  ]);

  // Lazy import for the same reason getAdminClient() is lazy: bare
  // `node --test` cannot resolve the `@/` tsconfig alias, and a static import
  // here would make this whole module unloadable by the test runner — which
  // would take buildDeliveryMessage's tests with it, and those are the ones
  // guarding what reaches a buyer.
  let steamPassword: string | null = null;
  if (account?.password_enc) {
    try {
      const { decrypt } = await import("@/lib/encryption");
      steamPassword = await decrypt(account.password_enc);
    } catch (err) {
      // Deliberately does NOT rethrow. A password we cannot decrypt must
      // degrade to "message without a password", never to "order not
      // fulfilled" — the orders row is what the buyer actually paid for.
      // The error text is logged WITHOUT the ciphertext: a decrypt failure
      // usually means a wrong ACCOUNTS_ENCRYPTION_KEY, and pairing that with
      // the ciphertext in a log is how key-rotation incidents get worse.
      console.error(
        `[fulfillment] could not decrypt the stored password for account_game ${accountGameId}: ` +
          `${err instanceof Error ? err.message : String(err)}. Delivery will continue without it.`,
      );
    }
  }

  return {
    accountGameId,
    steamUsername: account?.username ?? null,
    gameTitle: game?.title ?? null,
    steamPassword,
  };
}

/**
 * Look for an existing `orders` row for this order_sn.
 *
 * Uses .limit(2) + array rather than .maybeSingle() ON PURPOSE. Migration
 * 0005 (unique index on shopee_order_id alone) is WRITTEN BUT NOT YET
 * APPLIED to production, so duplicates from before the fix may still be in
 * the table. .maybeSingle() would error on those — and erroring here would
 * make the webhook look "failed" to Shopee, which triggers ANOTHER retry,
 * which is exactly the loop we're trying to break. Seeing >= 1 row is enough
 * to know this order is already fulfilled.
 */
async function findExistingOrder(
  supabase: AdminClient,
  orderSn: string,
): Promise<{ id: string; account_game_id: string | null } | null> {
  const { data, error } = await supabase
    .from("orders")
    .select("id, account_game_id")
    .eq("shopee_order_id", orderSn)
    .order("created_at", { ascending: true })
    .limit(2);

  if (error) {
    throw new Error(
      `Failed to read orders for ${orderSn}: ${error.message}`,
    );
  }
  if (!data || data.length === 0) return null;

  if (data.length > 1) {
    // Not fatal for this call, but it means the buyer's lookup is already
    // broken (see the module docstring). Surface it loudly in logs so ops
    // can merge the rows; do not attempt an automatic delete here — deleting
    // the wrong row silently revokes a paying buyer's access.
    console.error(
      `[fulfillment] orders has MORE THAN ONE row for shopee_order_id=${orderSn} — ` +
        `verifyShopeeOrder() will fail for this buyer until the duplicates are merged. ` +
        `Apply migration 0005 to stop new ones appearing.`,
    );
  }

  return data[0] as { id: string; account_game_id: string | null };
}

/** One `shopee_listings` row, as this module needs it. */
export interface ListingRow {
  item_id: number;
  model_id: number;
  game_id: string;
}

/** A line item that resolved to one of our games. */
export interface MatchedItem {
  item: FulfillmentItem;
  gameId: string;
}

export interface ItemMatchResult {
  /** In the order Shopee listed them. At most one entry per distinct game. */
  matched: MatchedItem[];
  /** Line items that resolve to no game we sell. NEVER silently dropped. */
  unmatched: FulfillmentItem[];
}

/**
 * Match purchased line items against `shopee_listings` — ALL of them.
 *
 * ── WHY THIS REPLACED "FIRST MATCH WINS" ──────────────────────────────────
 * Shopee splits a cart by SHOP, not by item, so a buyer who checks out four
 * different games from our shop produces ONE order_sn carrying four entries
 * in item_list — not four order ids. The previous mapItemsToGame() returned
 * on the first item that resolved and discarded the rest, so that buyer paid
 * for four games and received one. Nothing reported it: the fulfilment status
 * was `created`, not `no_mapping`, so the logs were green and only a Shopee
 * chat complaint would have surfaced it.
 *
 * Match rule per item is UNCHANGED and still the agreed contract: exact
 * (item_id, model_id) first, then the (item_id, 0) row for listings with no
 * variations.
 *
 * DEDUPED BY GAME, first occurrence wins. Two line items resolving to the
 * same game (a buyer who bought the standard and deluxe listings of one
 * title) get ONE allocation, because the product is access to a Steam account
 * that owns the game — a second account for the same game would be two
 * logins for one thing to play. The duplicate is reported as matched, not
 * unmatched, so it is never flagged as an ops problem.
 *
 * Pure and exported so it can be tested without a database — the DB half is
 * mapItemsToGames() below. This function must never throw: an unmappable item
 * is a NORMAL outcome (a game listed on Shopee that nobody has mapped yet).
 */
export function matchItemsToGames(
  items: FulfillmentItem[],
  listings: ListingRow[],
): ItemMatchResult {
  const byKey = new Map<string, string>();
  for (const row of listings) {
    byKey.set(`${row.item_id}:${row.model_id}`, row.game_id);
  }

  const matched: MatchedItem[] = [];
  const unmatched: FulfillmentItem[] = [];
  const seenGames = new Set<string>();

  for (const item of items) {
    const gameId =
      byKey.get(`${item.itemId}:${item.modelId}`) ??
      byKey.get(`${item.itemId}:${NO_MODEL_ID}`);

    if (!gameId) {
      unmatched.push(item);
      continue;
    }
    // A second line item for a game already matched is intentionally NOT
    // pushed to `unmatched` — it mapped fine, it just needs no second account.
    if (seenGames.has(gameId)) continue;

    seenGames.add(gameId);
    matched.push({ item, gameId });
  }

  return { matched, unmatched };
}

/**
 * The database half of matchItemsToGames(): read the candidate listings, then
 * match in memory.
 *
 * One round trip regardless of how many items the order carries. Throws only
 * on a genuine read failure — "nothing matched" comes back as an empty
 * `matched` array, which the caller turns into `no_mapping`.
 */
async function mapItemsToGames(
  supabase: AdminClient,
  items: FulfillmentItem[],
): Promise<ItemMatchResult> {
  if (items.length === 0) return { matched: [], unmatched: [] };

  const itemIds = Array.from(new Set(items.map((i) => i.itemId)));
  const { data, error } = await supabase
    .from("shopee_listings")
    .select("item_id, model_id, game_id")
    .in("item_id", itemIds);

  if (error) {
    throw new Error(`Failed to read shopee_listings: ${error.message}`);
  }

  return matchItemsToGames(items, (data ?? []) as ListingRow[]);
}

/**
 * Pick which eligible account_games row a new order for this game goes to.
 *
 * "Eligible" = the owning steam_account is `active`. banned/recovering
 * accounts are excluded outright: handing a buyer a banned account is worse
 * than telling them we're out of stock.
 *
 * The choice itself is chooseAccountGame() above — a waterfall: fill one
 * account to ACCOUNT_MAX_BUYERS, then move to the next. This function's job is
 * only to gather the candidates and their current load.
 *
 * WHY THIS IS COUNTED IN TYPESCRIPT AND NOT IN SQL: the correct query is a
 * LEFT JOIN + GROUP BY + ORDER BY count, which PostgREST cannot express;
 * doing it properly server-side needs an RPC (a SQL function in a migration),
 * and migrations are out of scope for this file. The candidate set here is a
 * handful of accounts per game, so three indexed reads and an in-memory sort
 * are cheap. If the account pool ever grows past the low hundreds, replace
 * this with an RPC rather than paginating it.
 *
 * INDEX NOTE FOR THE MIGRATION OWNER: the third query filters
 * `orders (account_game_id, verified)`. Neither 0001_init.sql nor
 * 0008_orders_auto_delivery.sql indexes orders.account_game_id (0008's
 * orders_undelivered_idx is on created_at, for the retry job), so today this
 * is a seq scan on orders. Worth a
 * `create index on orders (account_game_id) where verified` when someone is
 * next writing migration SQL. Not added here — this file writes no SQL.
 *
 * RACE NOTE, stated honestly: two orders for the same game arriving at the
 * same instant can both read the same counts and both pick the same account.
 * That is tolerable here — this product deliberately shares one account
 * between multiple buyers, so "two buyers on one account" is the normal
 * state, not a corruption. It is NOT a substitute for the idempotency
 * guarantee below, which protects against the same order being fulfilled
 * twice; that one does matter and is enforced in the database.
 */
async function allocateAccountGame(
  supabase: AdminClient,
  gameId: string,
): Promise<string | null> {
  const { data: accountGames, error: agError } = await supabase
    .from("account_games")
    .select("id, account_id, created_at")
    .eq("game_id", gameId);

  if (agError) {
    throw new Error(`Failed to read account_games: ${agError.message}`);
  }
  if (!accountGames || accountGames.length === 0) return null;

  const rows = accountGames as Array<{
    id: string;
    account_id: string;
    created_at: string;
  }>;

  const { data: accounts, error: accError } = await supabase
    .from("steam_accounts")
    .select("id")
    .eq("status", ELIGIBLE_ACCOUNT_STATUS)
    .in(
      "id",
      rows.map((r) => r.account_id),
    );

  if (accError) {
    throw new Error(`Failed to read steam_accounts: ${accError.message}`);
  }

  const activeAccountIds = new Set(
    ((accounts ?? []) as Array<{ id: string }>).map((a) => a.id),
  );
  const candidates = rows.filter((r) => activeAccountIds.has(r.account_id));
  if (candidates.length === 0) return null;

  // ── Load is counted from `order_games`, NOT from `orders` ───────────────
  // This is load-bearing, not a refactor. `orders.account_game_id` is only a
  // mirror of the FIRST game on an order (see 0014_order_games.sql, "THE
  // LEGACY MIRROR"). Counting it would make every additional game in a bulk
  // order invisible to the waterfall, so a four-game order would register as
  // one buyer and accounts would silently overfill past ACCOUNT_MAX_BUYERS —
  // which arrives as "I can't log in" in Shopee chat, the exact failure the
  // cap exists to prevent.
  //
  // Still two plain queries rather than a PostgREST embed, for the reason
  // resolveAccountGame() records: the embed's return shape depends on how
  // PostgREST infers the FK, and getting it wrong fails silently as
  // `undefined`. 0014 indexes order_games (account_game_id) for this read.
  const { data: gameRows, error: gameRowsError } = await supabase
    .from("order_games")
    .select("account_game_id, order_id")
    .in(
      "account_game_id",
      candidates.map((c) => c.id),
    );

  if (gameRowsError) {
    // PRE-0014 FALLBACK. Count from the legacy mirror instead, which is what
    // this function did before 0014 — correct while every order holds exactly
    // one game, which is true by definition when order_games does not exist.
    if (isMissingOrderGames(gameRowsError)) {
      warnLegacyMode("allocateAccountGame");
      const { data: legacyOrders, error: legacyError } = await supabase
        .from("orders")
        .select("account_game_id")
        .eq("verified", true)
        .in("account_game_id", candidates.map((c) => c.id));
      if (legacyError) {
        throw new Error(
          `Failed to count existing orders per account: ${legacyError.message}`,
        );
      }
      const legacyLoad = new Map<string, number>();
      for (const candidate of candidates) legacyLoad.set(candidate.id, 0);
      for (const row of (legacyOrders ?? []) as Array<{ account_game_id: string | null }>) {
        if (!row.account_game_id) continue;
        legacyLoad.set(row.account_game_id, (legacyLoad.get(row.account_game_id) ?? 0) + 1);
      }
      return chooseAccountGame(candidates, legacyLoad, accountMaxBuyers());
    }
    throw new Error(
      `Failed to count existing order games per account: ${gameRowsError.message}`,
    );
  }

  const rowsForCandidates = ((gameRows ?? []) as Array<{
    account_game_id: string | null;
    order_id: string;
  }>).filter((r) => r.account_game_id);

  // Only VERIFIED orders count against an account, matching the previous
  // behaviour: an unverified row is a placeholder, not a buyer occupying a
  // seat.
  const verifiedOrderIds = new Set<string>();
  const orderIds = Array.from(new Set(rowsForCandidates.map((r) => r.order_id)));
  if (orderIds.length > 0) {
    const { data: verifiedRows, error: verifiedError } = await supabase
      .from("orders")
      .select("id")
      .eq("verified", true)
      .in("id", orderIds);

    if (verifiedError) {
      throw new Error(
        `Failed to check which orders are verified: ${verifiedError.message}`,
      );
    }
    for (const row of (verifiedRows ?? []) as Array<{ id: string }>) {
      verifiedOrderIds.add(row.id);
    }
  }

  const load = new Map<string, number>();
  for (const candidate of candidates) load.set(candidate.id, 0);
  for (const row of rowsForCandidates) {
    if (!verifiedOrderIds.has(row.order_id)) continue;
    load.set(row.account_game_id!, (load.get(row.account_game_id!) ?? 0) + 1);
  }

  return chooseAccountGame(candidates, load, accountMaxBuyers());
}

/**
 * PRE-0014 FALLBACK — delete with lib/order-games-compat.ts.
 *
 * Build the one-game list from `orders.account_game_id`, which is exactly
 * what this pipeline used before `order_games` existed.
 */
async function legacyGamesFor(
  supabase: AdminClient,
  orderRowId: string,
): Promise<FulfilledGame[]> {
  const { data } = await supabase
    .from("orders")
    .select("account_game_id")
    .eq("id", orderRowId)
    .maybeSingle();

  const accountGameId = (data as { account_game_id: string | null } | null)?.account_game_id;
  if (!accountGameId) return [];

  const resolved = await resolveAccountGame(supabase, accountGameId);
  return [
    {
      // The order row id doubles as the game handle in legacy mode, matching
      // verifyShopeeOrder()'s fallback so both halves agree.
      orderGameId: orderRowId,
      gameTitle: resolved.gameTitle,
      steamUsername: resolved.steamUsername,
      steamPassword: resolved.steamPassword,
      position: 0,
    },
  ];
}

/**
 * Read every game line on an order, resolved to the username/password/title
 * the delivery message and the buyer's page need.
 *
 * Ordered by `position` so the buyer sees the games in the order Shopee
 * listed them, not in whatever order Postgres happened to return.
 *
 * The per-game account resolutions run in parallel: this is called from a
 * serverless webhook handler, and a four-game order resolving sequentially
 * would be twelve round trips end to end on a path that also has to call the
 * Shopee API afterwards.
 */
async function readOrderGames(
  supabase: AdminClient,
  orderRowId: string,
): Promise<FulfilledGame[]> {
  const { data, error } = await supabase
    .from("order_games")
    .select("id, account_game_id, position")
    .eq("order_id", orderRowId)
    .order("position", { ascending: true });

  if (error) {
    // PRE-0014 FALLBACK: synthesize the single legacy game line.
    if (isMissingOrderGames(error)) {
      warnLegacyMode("readOrderGames");
      return legacyGamesFor(supabase, orderRowId);
    }
    throw new Error(
      `Failed to read order_games for order ${orderRowId}: ${error.message}`,
    );
  }

  const rows = (data ?? []) as Array<{
    id: string;
    account_game_id: string | null;
    position: number;
  }>;

  return Promise.all(
    rows.map(async (row): Promise<FulfilledGame> => {
      if (!row.account_game_id) {
        // A placeholder line with nothing allocated yet. Returned rather than
        // skipped so the caller can see the gap; deliverOnce() refuses to
        // build a message from it (no title, no username).
        return {
          orderGameId: row.id,
          gameTitle: null,
          steamUsername: null,
          steamPassword: null,
          position: row.position,
        };
      }
      const resolved = await resolveAccountGame(supabase, row.account_game_id);
      return {
        orderGameId: row.id,
        gameTitle: resolved.gameTitle,
        steamUsername: resolved.steamUsername,
        steamPassword: resolved.steamPassword,
        position: row.position,
      };
    }),
  );
}

/**
 * Fulfil one paid Shopee order — ALL the games on it.
 *
 * Safe to call repeatedly for the same orderSn: a retry returns
 * `already_exists` and mutates nothing.
 *
 * ── ONE ORDER, MANY GAMES ─────────────────────────────────────────────────
 * Shopee splits a cart by SHOP, not by item, so four games bought together
 * arrive as ONE order_sn with four entries in item_list. `orders` stays
 * strictly one row per order_sn — migration 0005's unique index depends on
 * that and verifyShopeeOrder() would break without it — and the games hang
 * off it in `order_games` (migration 0014).
 *
 * ── THE IDEMPOTENCY CHAIN, WHICH IS STILL THE POINT OF THIS FUNCTION ──────
 * The `orders` upsert is the ONLY race guard, and it now guards the
 * order_games insert as well: we insert game lines only when the upsert
 * reports that WE created the order row. A caller that lost the race inserts
 * nothing at all and degrades to `already_exists`. That is why the order of
 * operations below is upsert-then-insert-lines and not the reverse — the
 * reverse would let two concurrent retries both write game lines.
 *
 * Throws only on genuine infrastructure failure (database unreachable, a
 * missing table, a missing unique index). It does NOT throw for the expected
 * business outcomes `no_mapping`, `no_capacity` or `partial`; those are
 * returned so the caller can log/alert and still ACK the push, because an
 * error response just earns another Shopee retry of an order we still
 * couldn't fulfil.
 */
export async function fulfillOrder({
  orderSn,
  buyerUsername,
  items,
}: FulfillOrderInput): Promise<FulfillOrderResult> {
  const supabase = await getAdminClient();

  // ── 1. Idempotency check, before anything else ──────────────────────
  // A retry must be a total no-op: no re-allocation, no mutation of the
  // existing rows (the buyer may already be playing on those accounts).
  const existing = await findExistingOrder(supabase, orderSn);
  if (existing) {
    return {
      status: "already_exists",
      orderRowId: existing.id,
      games: await readOrderGames(supabase, existing.id),
      unmatchedItems: [],
      unallocatedGameIds: [],
    };
  }

  // ── 2. Which of our games did they buy? ALL of them ─────────────────
  const { matched, unmatched } = await mapItemsToGames(supabase, items);
  if (matched.length === 0) {
    return {
      status: "no_mapping",
      orderRowId: null,
      games: [],
      unmatchedItems: unmatched,
      unallocatedGameIds: [],
    };
  }

  // ── 3. One account per game ─────────────────────────────────────────
  // Sequential, not parallel: allocateAccountGame() reads the current load
  // to run the waterfall, and concurrent reads of the same counts would let
  // two games in this same order pick the same account when they shouldn't.
  // Four games is four cheap indexed reads.
  const allocations: Array<{ gameId: string; accountGameId: string; item: FulfillmentItem }> = [];
  const unallocatedGameIds: string[] = [];
  for (const m of matched) {
    const accountGameId = await allocateAccountGame(supabase, m.gameId);
    if (!accountGameId) {
      unallocatedGameIds.push(m.gameId);
      continue;
    }
    allocations.push({ gameId: m.gameId, accountGameId, item: m.item });
  }

  if (allocations.length === 0) {
    return {
      status: "no_capacity",
      orderRowId: null,
      games: [],
      unmatchedItems: unmatched,
      unallocatedGameIds,
    };
  }

  // ── 4. Insert the order, tolerating a concurrent duplicate ──────────
  // upsert(..., { onConflict: "shopee_order_id", ignoreDuplicates: true })
  // is PostgREST's `ON CONFLICT (shopee_order_id) DO NOTHING`. Two pushes
  // for the same order landing at the same moment therefore produce exactly
  // one row; the loser inserts nothing and gets an empty representation
  // back, and we re-read to find the winner's row.
  //
  // shopee_buyer_id is left null on purpose: the automated path never learns
  // a buyer id (Shopee masks buyer PII), which is why the agreed schema
  // change makes that column nullable. buyer_username carries what we do get.
  //
  // account_game_id IS THE LEGACY MIRROR (see 0014_order_games.sql). It
  // carries the FIRST game only, for the admin panel, which is not yet
  // multi-game aware. `order_games` is authoritative for the buyer lookup,
  // for delivery, and for account load counting — nothing may read this
  // column and conclude it knows what the order contains.
  //
  // HARD DEPENDENCY: this needs the unique index on shopee_order_id from
  // migration 0005. Without it Postgres rejects the ON CONFLICT target
  // outright (42P10), which is caught below and re-raised with that
  // instruction rather than swallowed — a silent fallback to a plain insert
  // would reintroduce the ssp123 bug.
  const { data: inserted, error: insertError } = await supabase
    .from("orders")
    .upsert(
      {
        shopee_order_id: orderSn,
        shopee_buyer_id: null,
        buyer_username: buyerUsername,
        account_game_id: allocations[0].accountGameId,
        verified: true,
        source: AUTOMATED_ORDER_SOURCE,
      },
      { onConflict: "shopee_order_id", ignoreDuplicates: true },
    )
    .select("id")
    .limit(1);

  if (insertError) {
    // Lost the race in a way that surfaced as an error rather than as an
    // ignored duplicate? Then a row exists and this is still just a retry.
    const raced = await findExistingOrder(supabase, orderSn);
    if (raced) {
      return {
        status: "already_exists",
        orderRowId: raced.id,
        games: await readOrderGames(supabase, raced.id),
        unmatchedItems: [],
        unallocatedGameIds: [],
      };
    }
    throw new Error(
      `Failed to insert order ${orderSn}: ${insertError.message}. ` +
        `If this is Postgres 42P10, the unique index on orders(shopee_order_id) ` +
        `from migration 0005 has not been applied yet — apply it before enabling ` +
        `automated fulfillment, or duplicate rows will break buyer lookups.`,
    );
  }

  const insertedRows = (inserted ?? []) as Array<{ id: string }>;
  if (insertedRows.length === 0) {
    // ON CONFLICT DO NOTHING fired: someone else inserted this order between
    // our step-1 check and here. Degrade to already_exists, never to an
    // error — and critically, write NO game lines, because the winner is
    // writing them.
    const raced = await findExistingOrder(supabase, orderSn);
    if (!raced) {
      // Nothing inserted and nothing found — the conflict target matched a
      // row we cannot then read back. Something is genuinely wrong; do not
      // pretend this succeeded.
      throw new Error(
        `Order ${orderSn} was neither inserted nor found on re-read — ` +
          `refusing to report success.`,
      );
    }
    return {
      status: "already_exists",
      orderRowId: raced.id,
      games: await readOrderGames(supabase, raced.id),
      unmatchedItems: [],
      unallocatedGameIds: [],
    };
  }

  const orderRowId = insertedRows[0].id;

  // ── 5. Insert one game line per allocated game ──────────────────────
  // A PLAIN INSERT, not an upsert, and that is deliberate. The conflict
  // target would be 0014's PARTIAL unique index
  // (order_id, shopee_item_id, shopee_model_id) WHERE shopee_item_id IS NOT
  // NULL, and PostgREST cannot express the WHERE clause of a partial index in
  // an ON CONFLICT target — Postgres would reject it as 42P10. It is not
  // needed anyway: we only reach this line when the step-4 upsert reported
  // that WE created the order row, so no concurrent caller is writing these.
  // The partial index remains as a database-level backstop.
  //
  // supplier_site / supplier_order_id are left null: the automated path has
  // no per-game supplier mapping to record, so each game falls back to its
  // account's own default, exactly as before (see 0012's resolution order).
  const { error: gamesError } = await supabase.from("order_games").insert(
    allocations.map((a, index) => ({
      order_id: orderRowId,
      account_game_id: a.accountGameId,
      shopee_item_id: a.item.itemId,
      shopee_model_id: a.item.modelId,
      position: index,
    })),
  );

  if (gamesError) {
    // PRE-0014 FALLBACK. The orders row was written with the legacy mirror
    // pointing at the first game, which IS the complete pre-0014 behaviour,
    // so this order is fully fulfilled by the old definition. Report it as
    // such rather than throwing — throwing would NACK, and Shopee would
    // retry an order that is already recorded and deliverable.
    //
    // A multi-game order in this state is genuinely short-delivered, so it is
    // reported as `partial` with the dropped games named.
    if (isMissingOrderGames(gamesError)) {
      warnLegacyMode("fulfillOrder");
      const dropped = allocations.slice(1);
      if (dropped.length > 0) {
        console.error(
          `[fulfillment] ACTION REQUIRED — ordersn=${orderSn} bought ${allocations.length} ` +
            `games but migration 0014 is not applied, so only the first was recorded. ` +
            `Apply 0014, then add the remaining game line(s) by hand.`,
        );
      }
      return {
        status: dropped.length > 0 || unmatched.length > 0 || unallocatedGameIds.length > 0
          ? "partial"
          : "created",
        orderRowId,
        games: await legacyGamesFor(supabase, orderRowId),
        unmatchedItems: unmatched,
        unallocatedGameIds: [...unallocatedGameIds, ...dropped.map((d) => d.gameId)],
      };
    }
    // The order row exists but has no game lines, so the buyer's lookup
    // would answer "order not found" — the worst outcome available here.
    // Throw so the webhook NACKs and Shopee retries: the retry re-reads the
    // order in step 1, finds it, and readOrderGames() returns empty, which
    // surfaces as an undelivered order in reconciliation rather than a
    // silent success.
    throw new Error(
      `Order ${orderSn} was created but its game lines failed to insert: ` +
        `${gamesError.message}. If this is 42P01, migration 0014 ` +
        `(order_games) has not been applied.`,
    );
  }

  const games = await readOrderGames(supabase, orderRowId);

  // `partial` when anything the buyer paid for could not be served — either
  // an item mapped to no game we sell, or a game had no active account free.
  const shortfall = unmatched.length > 0 || unallocatedGameIds.length > 0;

  return {
    status: shortfall ? "partial" : "created",
    orderRowId,
    games,
    unmatchedItems: unmatched,
    unallocatedGameIds,
  };
}

/**
 * The www host, NOT the apex.
 *
 * gameshare.space issues a 308 redirect to www.gameshare.space (verified
 * 2026-09-05). Both work in a browser, but this string is pasted into a
 * Shopee chat message that a buyer may open in an in-app webview, and an
 * extra redirect hop is exactly the kind of thing those handle badly. Link
 * the canonical host directly.
 */
const SITE_URL = "https://www.gameshare.space";
const TUTORIAL_URL = `${SITE_URL}/tutorial`;
// Anchor ids verified against app/tutorial/page.tsx: the numbered <section>s
// are id="step-1" .. id="step-8". Step 4 is "Disable Steam Cloud", step 6 is
// "Play in Offline Mode" (both marked "every session"), and step 7 is
// "Troubleshooting" — re-checked 2026-09-05 when step 7 was added here.
const STEP_7_URL = `${TUTORIAL_URL}#step-7`;

export interface DeliveryMessageInput {
  gameTitle: string;
  orderSn: string;
  steamUsername: string;
  /**
   * The account password, included in the message when present.
   *
   * Optional so that a decrypt failure or a missing password_enc degrades to
   * a message WITHOUT a password line, rather than to no message at all — the
   * buyer can still complete the purchase via gameshare.space in that case.
   */
  steamPassword?: string | null;
}

/**
 * Render the Shopee-chat message sent to the buyer after fulfillment.
 *
 * ── THE PASSWORD DECISION, AND WHAT IT COSTS ─────────────────────────────
 * This message DOES carry the account password. That reverses the original
 * design and it was Chaison's explicit call on 2026-09-05, made after the
 * trade-offs below were put to him. Recorded here so nobody "fixes" it back
 * either way without knowing what they are changing.
 *
 * What we accept by including it:
 *   1. PERMANENCE. Shopee chat is a third-party record we cannot edit or
 *      redact. Every password sent this way is in Shopee's logs forever.
 *   2. BLAST RADIUS. These are SHARED accounts. A password leaked from one
 *      buyer's chat thread exposes the account for every other buyer on it,
 *      not just the one who received it.
 *   3. STALENESS. Rotating an account's password — which is the correct
 *      response to a refund or abuse — silently invalidates every delivery
 *      message already sent for that account. Those buyers must be
 *      re-messaged or pointed at the site, because their copy is now wrong.
 *      THIS IS THE ONE THAT WILL BITE FIRST; plan a rotation as a
 *      re-messaging exercise, not a one-line DB update.
 *
 * What it buys: the buyer gets everything except the Steam Guard code in one
 * message. It does NOT remove the site visit — the Guard code rotates every
 * 30 seconds and cannot exist in a static message — so the site remains the
 * authority for both the current password and the live code, which is why
 * the "Password + code" line stays even though a password is included.
 *
 * The Steam Guard code must still NEVER appear here. That is not a
 * preference: a 30-second code is worthless by the time it is read, and the
 * tests below enforce its absence.
 *
 * ── THE TEMPLATE IS CHAISON'S, VERBATIM ─────────────────────────────────
 * Wording, emoji, line breaks and the bilingual EN/BM warning were supplied
 * by Chaison on 2026-09-05 and are reproduced exactly. Do not "tidy" them:
 * the Malay line exists because a material share of buyers read it first,
 * and the emoji are scan anchors in a chat client, not decoration.
 */
export function buildDeliveryMessage({
  gameTitle,
  orderSn,
  steamUsername,
  steamPassword,
}: DeliveryMessageInput): string {
  const hasPassword = typeof steamPassword === "string" && steamPassword.length > 0;

  return [
    `[Auto Delivery]`,
    gameTitle,
    `Order ID: ${orderSn}`,
    `Username: ${steamUsername}`,
    // Omitted entirely rather than rendered empty: "Password: null" reaching
    // a buyer is worse than a message that sends them to the site for it,
    // which the very next line already does.
    ...(hasPassword ? [`Password: ${steamPassword}`] : []),
    ``,
    `🔑 Password + code: ${SITE_URL}`,
    // "Username" here too, matching the label above. These two must agree:
    // the line is an instruction to copy the fields printed directly above
    // it, so calling the same value two different names is how a buyer ends
    // up typing the wrong thing into the lookup form.
    `   (enter the Order ID + Username above)`,
    `📘 Tutorial: ${TUTORIAL_URL}`,
    `🛠️ Issues: ${STEP_7_URL}`,
    ``,
    `⚠️ EVERY session: Step 4 (Steam Cloud OFF) + Step 6 (Go Offline).`,
    `⚠️ SETIAP sesi: Langkah 4 (Steam Cloud OFF) + Langkah 6 (Go Offline).`,
  ].join("\n");
}
