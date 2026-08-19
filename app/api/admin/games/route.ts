import { NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/admin";

export async function GET() {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("games")
    .select("id, title, steam_app_id")
    .order("title", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ games: data });
}

export async function POST(request: Request) {
  const { title, steamAppId } = (await request.json()) as {
    title?: string;
    steamAppId?: string;
  };

  if (!title || !steamAppId) {
    return NextResponse.json(
      { error: "title and steamAppId are required" },
      { status: 400 },
    );
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("games")
    .insert({ title, steam_app_id: steamAppId })
    .select("id, title, steam_app_id")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data, { status: 201 });
}
