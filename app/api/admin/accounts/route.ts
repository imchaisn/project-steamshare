import { NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { encrypt } from "@/lib/encryption";

export async function GET() {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("steam_accounts")
    .select("id, username, status, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ accounts: data });
}

export async function POST(request: Request) {
  const { username, password, sharedSecret } = (await request.json()) as {
    username?: string;
    password?: string;
    sharedSecret?: string;
  };

  if (!username || !password || !sharedSecret) {
    return NextResponse.json(
      { error: "username, password, and sharedSecret are required" },
      { status: 400 },
    );
  }

  const [passwordEnc, sharedSecretEnc] = await Promise.all([
    encrypt(password),
    encrypt(sharedSecret),
  ]);

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("steam_accounts")
    .insert({
      username,
      password_enc: passwordEnc,
      shared_secret_enc: sharedSecretEnc,
    })
    .select("id, username, status")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data, { status: 201 });
}
