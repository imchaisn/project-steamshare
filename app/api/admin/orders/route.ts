import { NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/admin";

export async function GET() {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("orders")
    .select("id, shopee_order_id, shopee_buyer_id, account_game_id, verified, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ orders: data });
}

export async function POST(request: Request) {
  const { shopeeOrderId, shopeeBuyerId, accountGameId, verified } = (await request.json()) as {
    shopeeOrderId?: string;
    shopeeBuyerId?: string;
    accountGameId?: string;
    verified?: boolean;
  };

  if (!shopeeOrderId || !shopeeBuyerId || !accountGameId) {
    return NextResponse.json(
      { error: "shopeeOrderId, shopeeBuyerId, and accountGameId are required" },
      { status: 400 },
    );
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("orders")
    .insert({
      shopee_order_id: shopeeOrderId,
      shopee_buyer_id: shopeeBuyerId,
      account_game_id: accountGameId,
      verified: verified ?? true,
    })
    .select("id, shopee_order_id, shopee_buyer_id, account_game_id, verified")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data, { status: 201 });
}
