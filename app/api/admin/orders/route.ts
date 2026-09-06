import { NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { isSupplierSite } from "@/lib/code-source/types";
// PRE-0014 FALLBACK — remove with lib/order-games-compat.ts once 0014 is applied.
import { isMissingOrderGames, warnLegacyMode } from "@/lib/order-games-compat";

const ORDER_COLUMNS =
  "id, shopee_order_id, shopee_buyer_id, account_game_id, verified, created_at, supplier_site, supplier_order_id";

export async function GET() {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("orders")
    .select(ORDER_COLUMNS)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // How many games each order actually carries (migration 0014). Read-only,
  // and deliberately just a COUNT: `orders.account_game_id` is only a mirror
  // of the first game, so without this the Orders tab would show a four-game
  // order as if it held one — the exact blindness the multi-game rework
  // exists to remove. Full multi-game editing in /admin is a follow-up; until
  // then this at least makes a bulk order visible as one.
  const orders = (data ?? []) as Array<{ id: string }>;
  const gameCounts: Record<string, number> = {};
  if (orders.length > 0) {
    const { data: lines, error: linesError } = await supabase
      .from("order_games")
      .select("order_id")
      .in(
        "order_id",
        orders.map((o) => o.id),
      );
    if (linesError && isMissingOrderGames(linesError)) {
      // PRE-0014: every order holds exactly one game by definition. Report 1
      // rather than 0, which the panel renders as a broken order.
      warnLegacyMode("GET /api/admin/orders");
      for (const o of orders) gameCounts[o.id] = 1;
    }
    for (const line of (lines ?? []) as Array<{ order_id: string }>) {
      gameCounts[line.order_id] = (gameCounts[line.order_id] ?? 0) + 1;
    }
  }

  return NextResponse.json({ orders: data, gameCounts });
}

export async function POST(request: Request) {
  const {
    shopeeOrderId,
    shopeeBuyerId,
    accountGameId,
    verified,
    supplierSite,
    supplierOrderId,
  } = (await request.json()) as {
    shopeeOrderId?: string;
    shopeeBuyerId?: string;
    accountGameId?: string;
    verified?: boolean;
    supplierSite?: string;
    supplierOrderId?: string;
  };

  if (!shopeeOrderId || !shopeeBuyerId || !accountGameId) {
    return NextResponse.json(
      { error: "shopeeOrderId, shopeeBuyerId, and accountGameId are required" },
      { status: 400 },
    );
  }

  // The mapping is optional per order — an unmapped order falls back to the
  // account's own default. But a half-filled mapping is always an error: a site
  // with no order id, or an order id with no site, resolves to nothing and
  // would surface as a 503 to a paying buyer.
  const mapping = normaliseMapping(supplierSite, supplierOrderId);
  if ("error" in mapping) {
    return NextResponse.json({ error: mapping.error }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("orders")
    .insert({
      shopee_order_id: shopeeOrderId,
      shopee_buyer_id: shopeeBuyerId,
      account_game_id: accountGameId,
      verified: verified ?? true,
      ...mapping.value,
    })
    .select(ORDER_COLUMNS)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // ── THE GAME LINE IS NOT OPTIONAL ───────────────────────────────────────
  // Since migration 0014 the buyer lookup reads `order_games`, NOT
  // orders.account_game_id. An order created here without a game line would
  // answer "Order not found or not verified" to the buyer holding it — a
  // silently broken order created by hand, which is the worst thing this
  // endpoint could produce.
  //
  // The mapping is copied onto the line as well as the order: per-game is
  // where it is now read from, and the order-level copy is the legacy mirror.
  const { error: lineError } = await supabase.from("order_games").insert({
    order_id: (data as { id: string }).id,
    account_game_id: accountGameId,
    position: 0,
    ...mapping.value,
  });

  if (lineError) {
    // PRE-0014: no order_games table yet, so the orders row alone IS a
    // complete order and the lookup's own fallback will serve it. Keep it.
    if (isMissingOrderGames(lineError)) {
      warnLegacyMode("POST /api/admin/orders");
      return NextResponse.json(data, { status: 201 });
    }
    // Roll the order back rather than leave a broken one behind. A buyer
    // finding "order not found" on an order an admin believes they created
    // is far worse than the admin seeing this fail and retrying.
    await supabase.from("orders").delete().eq("id", (data as { id: string }).id);
    return NextResponse.json(
      {
        error:
          `The order could not be given a game line and was rolled back: ${lineError.message}. ` +
          `If this mentions order_games, migration 0014 has not been applied.`,
      },
      { status: 500 },
    );
  }

  return NextResponse.json(data, { status: 201 });
}

/**
 * Connect an existing order to another of our websites, or clear that link.
 *
 * This is the edit that matters operationally: an order is created (often
 * automatically, by the Shopee webhook) and the mapping is added afterwards,
 * once it is known which order on the other site this sale corresponds to.
 * Sending an empty supplierOrderId clears the mapping and returns the order to
 * its account's default.
 */
export async function PATCH(request: Request) {
  const { id, supplierSite, supplierOrderId, verified } =
    (await request.json()) as {
      id?: string;
      supplierSite?: string;
      supplierOrderId?: string;
      verified?: boolean;
    };

  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const update: Record<string, string | boolean | null> = {};

  if (verified !== undefined) update.verified = verified;

  if (supplierSite !== undefined || supplierOrderId !== undefined) {
    const cleared =
      supplierOrderId !== undefined && !supplierOrderId.trim() && !supplierSite;
    if (cleared) {
      update.supplier_site = null;
      update.supplier_order_id = null;
    } else {
      const mapping = normaliseMapping(supplierSite, supplierOrderId);
      if ("error" in mapping) {
        return NextResponse.json({ error: mapping.error }, { status: 400 });
      }
      Object.assign(update, mapping.value);
    }
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "nothing to update" }, { status: 400 });
  }

  const supabase = createAdminClient();

  // ── THE MAPPING HAS TO REACH THE GAME LINE ──────────────────────────────
  // Since migration 0014 the lookup resolves a code source from
  // `order_games.supplier_site/supplier_order_id`, not from the order. An
  // update that only touched `orders` would appear to work in this panel and
  // change nothing at all for the buyer.
  //
  // ONLY SAFE FOR A SINGLE-GAME ORDER. Applying one supplier mapping to all
  // four games of a bulk order would point every one of them at the same
  // supplier order, which is wrong for at least three of them. Per-game
  // mapping in /admin is a follow-up; until it exists, this refuses rather
  // than guesses.
  const touchesMapping =
    "supplier_site" in update || "supplier_order_id" in update;

  if (touchesMapping) {
    const { data: lines, error: linesError } = await supabase
      .from("order_games")
      .select("id")
      .eq("order_id", id);

    if (linesError && !isMissingOrderGames(linesError)) {
      return NextResponse.json({ error: linesError.message }, { status: 500 });
    }
    // PRE-0014: no game lines exist, so there is nothing to propagate to and
    // the order-level columns below are still the only mapping there is.

    const lineIds = ((lines ?? []) as Array<{ id: string }>).map((l) => l.id);
    if (lineIds.length > 1) {
      return NextResponse.json(
        {
          error:
            `This order carries ${lineIds.length} games, and one website mapping cannot be ` +
            `correct for all of them. Per-game mapping is not in this panel yet — set it ` +
            `directly on the order_games rows for now.`,
        },
        { status: 409 },
      );
    }

    if (lineIds.length === 1) {
      const { error: lineError } = await supabase
        .from("order_games")
        .update({
          supplier_site: update.supplier_site ?? null,
          supplier_order_id: update.supplier_order_id ?? null,
        })
        .eq("id", lineIds[0]);

      if (lineError) {
        return NextResponse.json({ error: lineError.message }, { status: 500 });
      }
    }
  }

  const { data, error } = await supabase
    .from("orders")
    .update(update)
    .eq("id", id)
    .select(ORDER_COLUMNS)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }
  return NextResponse.json(data);
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "id query param is required" }, { status: 400 });
  }

  const supabase = createAdminClient();
  // code_access_log.order_id is `on delete set null` (0001_init.sql), so this
  // preserves the audit trail — it just orphans the log rows, doesn't drop them.
  const { error } = await supabase.from("orders").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return new NextResponse(null, { status: 204 });
}

/**
 * Validate a site + order-id pair. Returns the DB fields to write, or the
 * operator-facing reason it was refused.
 */
function normaliseMapping(
  supplierSite: string | undefined,
  supplierOrderId: string | undefined,
):
  | { value: Record<string, string> }
  | { error: string } {
  const site = supplierSite?.trim() ?? "";
  const orderId = supplierOrderId?.trim() ?? "";

  if (!site && !orderId) return { value: {} };

  if (!site || !orderId) {
    return {
      error:
        "A website and that website's order id must be given together — one without the other resolves to nothing and would fail at lookup time.",
    };
  }
  if (!isSupplierSite(site)) {
    return {
      error: `Unknown website "${site}". No adapter exists for it in lib/code-source/, so its codes could never be fetched.`,
    };
  }
  return { value: { supplier_site: site, supplier_order_id: orderId } };
}
