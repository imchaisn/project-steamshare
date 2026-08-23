import { NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { encrypt } from "@/lib/encryption";

const ACCOUNT_STATUSES = ["active", "banned", "recovering"] as const;
type AccountStatus = (typeof ACCOUNT_STATUSES)[number];

export async function GET() {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("steam_accounts")
    .select("id, username, status, recovery_email, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ accounts: data });
}

export async function POST(request: Request) {
  const { username, password, sharedSecret, recoveryEmail, recoveryEmailPassword } =
    (await request.json()) as {
      username?: string;
      password?: string;
      sharedSecret?: string;
      recoveryEmail?: string;
      recoveryEmailPassword?: string;
    };

  if (!username || !password || !sharedSecret) {
    return NextResponse.json(
      { error: "username, password, and sharedSecret are required" },
      { status: 400 },
    );
  }

  const [passwordEnc, sharedSecretEnc, recoveryEmailPasswordEnc] = await Promise.all([
    encrypt(password),
    encrypt(sharedSecret),
    recoveryEmailPassword ? encrypt(recoveryEmailPassword) : Promise.resolve(undefined),
  ]);

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("steam_accounts")
    .insert({
      username,
      password_enc: passwordEnc,
      shared_secret_enc: sharedSecretEnc,
      ...(recoveryEmail ? { recovery_email: recoveryEmail } : {}),
      ...(recoveryEmailPasswordEnc ? { recovery_email_password_enc: recoveryEmailPasswordEnc } : {}),
    })
    .select("id, username, status")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data, { status: 201 });
}

export async function PATCH(request: Request) {
  const { id, status } = (await request.json()) as {
    id?: string;
    status?: AccountStatus;
  };

  if (!id || !status || !ACCOUNT_STATUSES.includes(status)) {
    return NextResponse.json(
      { error: "id is required and status must be one of active, banned, recovering" },
      { status: 400 },
    );
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("steam_accounts")
    .update({ status })
    .eq("id", id)
    .select("id, status")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }
  return NextResponse.json(data);
}
