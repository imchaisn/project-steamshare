import { NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { accountMaxBuyers } from "@/lib/fulfillment";

/**
 * Account-game links, each with how many buyers it currently holds.
 *
 * The count is what makes the waterfall visible: allocation fills one account
 * to ACCOUNT_MAX_BUYERS before moving to the next (lib/fulfillment.ts), so this
 * shows which account is currently taking buyers, which are still clean, and
 * whether any has overflowed past the cap because every account was full.
 */
export async function GET() {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("account_games")
    .select("id, account_id, game_id, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = (data ?? []) as Array<{
    id: string;
    account_id: string;
    game_id: string;
    created_at: string;
  }>;

  // Counted in TypeScript for the same reason lib/fulfillment.ts does it:
  // PostgREST cannot express LEFT JOIN + GROUP BY + ORDER BY count without an
  // RPC. The pool is a handful of accounts per game, so one indexed read plus
  // an in-memory tally is cheap.
  const sold = new Map<string, number>();
  if (rows.length > 0) {
    const { data: orders } = await supabase
      .from("orders")
      .select("account_game_id")
      .eq("verified", true)
      .in("account_game_id", rows.map((r) => r.id));

    for (const o of (orders ?? []) as Array<{ account_game_id: string | null }>) {
      if (!o.account_game_id) continue;
      sold.set(o.account_game_id, (sold.get(o.account_game_id) ?? 0) + 1);
    }
  }

  return NextResponse.json({
    accountGames: rows.map((r) => ({ ...r, buyers: sold.get(r.id) ?? 0 })),
    maxBuyers: accountMaxBuyers(),
  });
}

export async function POST(request: Request) {
  const { accountId, gameId } = (await request.json()) as {
    accountId?: string;
    gameId?: string;
  };

  if (!accountId || !gameId) {
    return NextResponse.json(
      { error: "accountId and gameId are required" },
      { status: 400 },
    );
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("account_games")
    .insert({ account_id: accountId, game_id: gameId })
    .select("id, account_id, game_id")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data, { status: 201 });
}
