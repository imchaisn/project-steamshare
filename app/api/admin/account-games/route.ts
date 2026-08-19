import { NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/admin";

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
