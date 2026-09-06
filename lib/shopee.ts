import { createAdminClient } from "@/utils/supabase/admin";
// PRE-0014 FALLBACK — remove with lib/order-games-compat.ts once 0014 is applied.
import { isMissingOrderGames, warnLegacyMode } from "@/lib/order-games-compat";

/**
 * One game on a verified order — one `order_games` row (migration 0014).
 *
 * A Shopee cart is split by SHOP, not by item, so four games bought together
 * arrive as ONE order id. `orders` stays one row per order id (migration
 * 0005's unique index depends on it) and the games hang off it here.
 */
export interface VerifiedOrderGame {
  /**
   * `order_games.id`. The handle the buyer's page sends back to
   * /api/lookup as `gameId` to say which game it wants a code for.
   */
  orderGameId: string;
  accountGameId: string | null;
  /** Display order, mirroring the order Shopee listed the items in. */
  position: number;
  /**
   * THE MAPPING — our order id connected to the other website's order id,
   * PER GAME.
   *
   * All of these websites are ours. The same Steam account is known to another
   * of our sites by a DIFFERENT order id; the username and password are
   * identical on both sides, so the order id is the only thing that has to be
   * carried across.
   *
   * Per-game rather than per-order since 0014, and that is the single
   * strongest reason the child table exists: one order can hold a game from
   * gamersfantasy.my alongside a game from cyberspace.cyou, and a single
   * order-level mapping cannot express that.
   *
   * Null on a game that has not been mapped, which then falls back to the
   * account's own default. See supabase/migrations/0012_orders_supplier_mapping.sql
   * for the full resolution order.
   */
  supplierSite: string | null;
  supplierOrderId: string | null;
}

export interface ShopeeVerificationResult {
  verified: boolean;
  /** `orders.id` of the matched row, for the code-access audit log. */
  orderId: string | null;
  /**
   * Every game on this order, in display order. Empty only when the order
   * exists but has no game lines — which after migration 0014's backfill and
   * post-condition should not happen, and is logged by the caller if it does.
   */
  games: VerifiedOrderGame[];
}

/**
 * Verify a Shopee order against the local `orders` table, and return every
 * game on it.
 *
 * LOCAL-VERIFICATION MODE: real Shopee Open API integration is deferred
 * until Chaison has Shopee Open Platform partner credentials (see plan
 * Global Constraints). For now, an order counts as verified only if an
 * admin has already created a matching row in `orders` with
 * `verified = true` (via the admin panel, Task 9) — this is the manual
 * bridge until live API verification replaces it. Callers don't need to
 * know which mode is active; only this function's internals change later.
 *
 * ── .maybeSingle() IS STILL LOAD-BEARING ─────────────────────────────────
 * The `orders` read below still uses .maybeSingle() on shopee_order_id
 * alone, which ERRORS on more than one match. That is exactly why migration
 * 0014 put the games in a child table instead of allowing several `orders`
 * rows to share an order id: doing the latter would have reintroduced the
 * 2026-08-26 ssp123 outage, where a duplicate row permanently broke a
 * buyer's lookup. Do not relax this to .limit(1) — the error is the alarm.
 *
 * The buyer proves ownership with the order id alone; `orders.shopee_buyer_id`
 * is still recorded for admin/audit purposes but is no longer part of the
 * lookup, because buyers can't reliably find their Shopee Buyer ID.
 */
export async function verifyShopeeOrder(
  orderId: string,
): Promise<ShopeeVerificationResult> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("orders")
    // account_game_id / supplier_* are selected ONLY for the pre-0014
    // fallback below. They are the legacy mirror and must not be read as
    // authoritative once order_games exists.
    .select("id, verified, account_game_id, supplier_site, supplier_order_id")
    .eq("shopee_order_id", orderId)
    .maybeSingle();

  if (error || !data || !data.verified) {
    return { verified: false, orderId: null, games: [] };
  }

  const legacy = data as {
    id: string;
    account_game_id: string | null;
    supplier_site: string | null;
    supplier_order_id: string | null;
  };

  const { data: gameRows, error: gamesError } = await supabase
    .from("order_games")
    .select("id, account_game_id, position, supplier_site, supplier_order_id")
    .eq("order_id", data.id)
    .order("position", { ascending: true });

  if (gamesError) {
    // PRE-0014 FALLBACK — delete with lib/order-games-compat.ts once the
    // migration is applied. Without this, deploying the multi-game code
    // before the SQL is pasted would answer "order not found" for EVERY
    // live order. Degrade to exactly the pre-0014 shape instead: one game,
    // from the order's own columns.
    if (isMissingOrderGames(gamesError)) {
      warnLegacyMode("verifyShopeeOrder");
      return {
        verified: true,
        orderId: data.id,
        games: [
          {
            // The order row's own id doubles as the game handle in legacy
            // mode. /api/lookup only ever compares it to what it handed out,
            // so any stable value works.
            orderGameId: data.id,
            accountGameId: legacy.account_game_id,
            position: 0,
            supplierSite: legacy.supplier_site ?? null,
            supplierOrderId: legacy.supplier_order_id ?? null,
          },
        ],
      };
    }
    // Fail closed. A read error here is indistinguishable to the buyer from
    // an unverified order, and answering "verified with no games" would let
    // the caller report success while handing over nothing.
    return { verified: false, orderId: null, games: [] };
  }

  const rows = (gameRows ?? []) as Array<{
    id: string;
    account_game_id: string | null;
    position: number;
    supplier_site: string | null;
    supplier_order_id: string | null;
  }>;

  // The table exists but this order has no line. 0014's backfill and its
  // post-condition make that impossible at migration time, so it means a row
  // was created afterwards by something that does not write game lines.
  // Serving the legacy mirror keeps that buyer working instead of telling
  // them their paid order does not exist; the log line is what gets it fixed.
  if (rows.length === 0) {
    console.error(
      `[shopee] ACTION REQUIRED — order ${orderId} has no order_games row. ` +
        `Serving its legacy account_game_id so the buyer is not blocked, but a ` +
        `multi-game order would be short-delivered. Add the missing game line(s).`,
    );
    return {
      verified: true,
      orderId: data.id,
      games: [
        {
          orderGameId: data.id,
          accountGameId: legacy.account_game_id,
          position: 0,
          supplierSite: legacy.supplier_site ?? null,
          supplierOrderId: legacy.supplier_order_id ?? null,
        },
      ],
    };
  }

  return {
    verified: true,
    orderId: data.id,
    games: rows.map((row) => ({
      orderGameId: row.id,
      accountGameId: row.account_game_id,
      position: row.position,
      supplierSite: row.supplier_site ?? null,
      supplierOrderId: row.supplier_order_id ?? null,
    })),
  };
}
