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

export type FulfillmentStatus =
  | "created"
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

/**
 * `orderRowId`, `steamUsername`, `gameTitle` and `steamPassword` are null for
 * the outcomes where they do not exist (no_mapping always; no_capacity always;
 * and already_exists when the pre-existing row has a null account_game_id,
 * e.g. an admin created a placeholder row by hand).
 */
export interface FulfillOrderResult {
  status: FulfillmentStatus;
  orderRowId: string | null;
  steamUsername: string | null;
  gameTitle: string | null;
  /**
   * DECRYPTED Steam password for the allocated account, for the delivery
   * message only. See ResolvedAccount.steamPassword — never log this, never
   * include it in an error string, never return it from an API route.
   */
  steamPassword: string | null;
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

/**
 * Map the purchased line items to one of our games via `shopee_listings`.
 *
 * Match rule, per the agreed contract: exact (item_id, model_id) first, then
 * fall back to the (item_id, 0) row for listings with no variations. Items
 * are tried in the order Shopee returned them and the first that maps wins —
 * Steamshare sells one game per order today, and picking the first is at
 * least deterministic. A genuinely multi-game order would need a second
 * orders row per item, which is out of scope until such an order actually
 * exists; flagged rather than half-built.
 *
 * Returns null when nothing maps. That is a NORMAL outcome (a game listed on
 * Shopee that nobody has mapped yet), not an error — it must never throw,
 * because throwing here fails the webhook and buys us a Shopee retry storm.
 */
async function mapItemsToGame(
  supabase: AdminClient,
  items: FulfillmentItem[],
): Promise<string | null> {
  if (items.length === 0) return null;

  const itemIds = Array.from(new Set(items.map((i) => i.itemId)));
  const { data, error } = await supabase
    .from("shopee_listings")
    .select("item_id, model_id, game_id")
    .in("item_id", itemIds);

  if (error) {
    throw new Error(`Failed to read shopee_listings: ${error.message}`);
  }
  if (!data || data.length === 0) return null;

  const listings = data as Array<{
    item_id: number;
    model_id: number;
    game_id: string;
  }>;

  // Keyed lookup so a multi-item order is still one round trip.
  const byKey = new Map<string, string>();
  for (const row of listings) {
    byKey.set(`${row.item_id}:${row.model_id}`, row.game_id);
  }

  for (const item of items) {
    const exact = byKey.get(`${item.itemId}:${item.modelId}`);
    if (exact) return exact;
    const noModel = byKey.get(`${item.itemId}:${NO_MODEL_ID}`);
    if (noModel) return noModel;
  }

  return null;
}

/**
 * Pick the least-loaded eligible account_games row for a game.
 *
 * "Eligible" = the owning steam_account is `active`. banned/recovering
 * accounts are excluded outright: handing a buyer a banned account is worse
 * than telling them we're out of stock.
 *
 * "Least loaded" = fewest existing verified orders pointing at that
 * account_games row, so buyers spread across accounts instead of piling onto
 * whichever row happens to sort first. Ties break on the account_games row's
 * created_at then id, purely so the choice is deterministic and reproducible
 * when debugging a specific order.
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

  const { data: existingOrders, error: ordersError } = await supabase
    .from("orders")
    .select("account_game_id")
    .eq("verified", true)
    .in(
      "account_game_id",
      candidates.map((c) => c.id),
    );

  if (ordersError) {
    throw new Error(
      `Failed to count existing orders per account: ${ordersError.message}`,
    );
  }

  const load = new Map<string, number>();
  for (const candidate of candidates) load.set(candidate.id, 0);
  for (const row of (existingOrders ?? []) as Array<{
    account_game_id: string | null;
  }>) {
    if (!row.account_game_id) continue;
    load.set(row.account_game_id, (load.get(row.account_game_id) ?? 0) + 1);
  }

  candidates.sort((a, b) => {
    const diff = (load.get(a.id) ?? 0) - (load.get(b.id) ?? 0);
    if (diff !== 0) return diff;
    if (a.created_at !== b.created_at) {
      return a.created_at < b.created_at ? -1 : 1;
    }
    return a.id < b.id ? -1 : 1;
  });

  return candidates[0].id;
}

/**
 * Fulfil one paid Shopee order.
 *
 * Safe to call repeatedly for the same orderSn — a retry returns
 * `already_exists` and mutates nothing.
 *
 * Throws only on genuine infrastructure failure (database unreachable, a
 * missing table, a missing unique index). It does NOT throw for the two
 * expected business outcomes, `no_mapping` and `no_capacity`; those are
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
  // existing row (the buyer may already be playing on that account).
  const existing = await findExistingOrder(supabase, orderSn);
  if (existing) {
    const resolved = existing.account_game_id
      ? await resolveAccountGame(supabase, existing.account_game_id)
      : null;
    return {
      status: "already_exists",
      orderRowId: existing.id,
      steamUsername: resolved?.steamUsername ?? null,
      gameTitle: resolved?.gameTitle ?? null,
      steamPassword: resolved?.steamPassword ?? null,
    };
  }

  // ── 2. Which of our games did they buy? ─────────────────────────────
  const gameId = await mapItemsToGame(supabase, items);
  if (!gameId) {
    return {
      status: "no_mapping",
      orderRowId: null,
      steamUsername: null,
      gameTitle: null,
      steamPassword: null,
    };
  }

  // ── 3. Which account can serve it? ──────────────────────────────────
  const accountGameId = await allocateAccountGame(supabase, gameId);
  if (!accountGameId) {
    return {
      status: "no_capacity",
      orderRowId: null,
      steamUsername: null,
      gameTitle: null,
      steamPassword: null,
    };
  }

  // ── 4. Insert, tolerating a concurrent duplicate ────────────────────
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
  // HARD DEPENDENCY: this needs the unique index on shopee_order_id from
  // migration 0005, which is WRITTEN BUT NOT YET APPLIED. Without it Postgres
  // rejects the ON CONFLICT target outright (42P10, "no unique or exclusion
  // constraint matching the ON CONFLICT specification"), which is caught
  // below and re-raised with that instruction rather than swallowed — a
  // silent fallback to a plain insert would reintroduce the ssp123 bug.
  const { data: inserted, error: insertError } = await supabase
    .from("orders")
    .upsert(
      {
        shopee_order_id: orderSn,
        shopee_buyer_id: null,
        buyer_username: buyerUsername,
        account_game_id: accountGameId,
        verified: true,
        source: AUTOMATED_ORDER_SOURCE,
      },
      { onConflict: "shopee_order_id", ignoreDuplicates: true },
    )
    .select("id")
    .limit(1);

  const resolved = await resolveAccountGame(supabase, accountGameId);

  if (insertError) {
    // Lost the race in a way that surfaced as an error rather than as an
    // ignored duplicate? Then a row exists and this is still just a retry.
    const raced = await findExistingOrder(supabase, orderSn);
    if (raced) {
      const racedResolved = raced.account_game_id
        ? await resolveAccountGame(supabase, raced.account_game_id)
        : null;
      return {
        status: "already_exists",
        orderRowId: raced.id,
        steamUsername: racedResolved?.steamUsername ?? null,
        gameTitle: racedResolved?.gameTitle ?? null,
        steamPassword: racedResolved?.steamPassword ?? null,
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
    // our step-1 check and here. Degrade to already_exists, never to an error.
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
    const racedResolved = raced.account_game_id
      ? await resolveAccountGame(supabase, raced.account_game_id)
      : null;
    return {
      status: "already_exists",
      orderRowId: raced.id,
      steamUsername: racedResolved?.steamUsername ?? null,
      gameTitle: racedResolved?.gameTitle ?? null,
      steamPassword: racedResolved?.steamPassword ?? null,
    };
  }

  return {
    status: "created",
    orderRowId: insertedRows[0].id,
    steamUsername: resolved.steamUsername,
    gameTitle: resolved.gameTitle,
    steamPassword: resolved.steamPassword,
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
