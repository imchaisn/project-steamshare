import { NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { verifyShopeeOrder } from "@/lib/shopee";
import { decrypt } from "@/lib/encryption";
import { generateSteamGuardCode } from "@/lib/totp";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

export async function POST(request: Request) {
  // Rate limit first — before any DB lookup or decryption work.
  const ip = getClientIp(request);
  const rateLimit = await checkRateLimit(ip);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many attempts. Please wait and try again." },
      {
        status: 429,
        headers: { "Retry-After": String(rateLimit.retryAfterSeconds ?? 60) },
      },
    );
  }

  const { username: suppliedUsername, orderId } = (await request.json()) as {
    username?: string;
    orderId?: string;
  };

  if (!suppliedUsername || !orderId) {
    return NextResponse.json(
      { error: "orderId and username are required" },
      { status: 400 },
    );
  }

  const verification = await verifyShopeeOrder(orderId);
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

  // The supplied username must match the account this order resolves to.
  // Same generic error as a missing order, so this can't be used to probe
  // which usernames exist.
  if (
    account.username.trim().toLowerCase() !==
    suppliedUsername.trim().toLowerCase()
  ) {
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

  await supabase.from("code_access_log").insert({
    order_id: verification.orderId,
    ip,
  });

  return NextResponse.json({
    username: account.username,
    password,
    code,
  });
}
