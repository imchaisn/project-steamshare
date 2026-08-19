import { NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { verifyShopeeOrder } from "@/lib/shopee";
import { decrypt } from "@/lib/encryption";
import { generateSteamGuardCode } from "@/lib/totp";

export async function POST(request: Request) {
  const { buyerId, orderId } = (await request.json()) as {
    buyerId?: string;
    orderId?: string;
  };

  if (!buyerId || !orderId) {
    return NextResponse.json(
      { error: "buyerId and orderId are required" },
      { status: 400 },
    );
  }

  const verification = await verifyShopeeOrder(orderId, buyerId);
  if (!verification.verified || !verification.accountGameId) {
    return NextResponse.json(
      { error: "Order not found or not verified" },
      { status: 404 },
    );
  }

  const supabase = createAdminClient();
  const { data: accountGame, error: agError } = await supabase
    .from("account_games")
    .select("account_id")
    .eq("id", verification.accountGameId)
    .maybeSingle();

  if (agError || !accountGame) {
    return NextResponse.json(
      { error: "Order not found or not verified" },
      { status: 404 },
    );
  }

  const { data: account, error: accountError } = await supabase
    .from("steam_accounts")
    .select("id, username, password_enc, shared_secret_enc, status")
    .eq("id", accountGame.account_id)
    .maybeSingle();

  if (accountError || !account) {
    return NextResponse.json(
      { error: "Order not found or not verified" },
      { status: 404 },
    );
  }

  if (account.status !== "active") {
    return NextResponse.json(
      { error: "Account temporarily unavailable, contact support" },
      { status: 403 },
    );
  }

  const [password, sharedSecret] = await Promise.all([
    decrypt(account.password_enc),
    decrypt(account.shared_secret_enc),
  ]);
  const code = await generateSteamGuardCode(sharedSecret);

  const orderRow = await supabase
    .from("orders")
    .select("id")
    .eq("shopee_order_id", orderId)
    .eq("shopee_buyer_id", buyerId)
    .maybeSingle();

  await supabase.from("code_access_log").insert({
    order_id: orderRow.data?.id ?? null,
    ip: request.headers.get("x-forwarded-for") ?? "unknown",
  });

  return NextResponse.json({
    username: account.username,
    password,
    code,
  });
}
