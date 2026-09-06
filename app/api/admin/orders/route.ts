import { NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { isSupplierSite } from "@/lib/code-source/types";

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
  return NextResponse.json({ orders: data });
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
