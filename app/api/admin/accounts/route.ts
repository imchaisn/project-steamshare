import { NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { encrypt } from "@/lib/encryption";
import { isSupplierSite } from "@/lib/code-source/types";

const ACCOUNT_STATUSES = ["active", "banned", "recovering"] as const;
type AccountStatus = (typeof ACCOUNT_STATUSES)[number];

export async function GET() {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("steam_accounts")
    .select(
      "id, username, status, recovery_email, created_at, code_source, supplier_site, supplier_order_id",
    )
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ accounts: data });
}

export async function POST(request: Request) {
  const {
    username,
    password,
    sharedSecret,
    recoveryEmail,
    recoveryEmailPassword,
    codeSource,
    supplierSite,
    supplierOrderId,
  } = (await request.json()) as {
    username?: string;
    password?: string;
    sharedSecret?: string;
    recoveryEmail?: string;
    recoveryEmailPassword?: string;
    codeSource?: string;
    supplierSite?: string;
    supplierOrderId?: string;
  };

  const source = codeSource === "supplier" ? "supplier" : "totp";

  // Validated by SHAPE, mirroring migration 0011's CHECK constraint. The DB
  // constraint is the backstop; this exists so the operator gets a message
  // naming the missing field instead of a raw Postgres constraint violation.
  if (!username || !password) {
    return NextResponse.json(
      { error: "username and password are required" },
      { status: 400 },
    );
  }

  if (source === "totp" && !sharedSecret) {
    return NextResponse.json(
      { error: "sharedSecret is required for a TOTP account" },
      { status: 400 },
    );
  }

  if (source === "supplier") {
    if (!supplierSite || !supplierOrderId) {
      return NextResponse.json(
        {
          error:
            "supplierSite and supplierOrderId are required for a supplier account",
        },
        { status: 400 },
      );
    }
    if (!isSupplierSite(supplierSite)) {
      return NextResponse.json(
        {
          error: `Unknown supplier site "${supplierSite}". No adapter exists for it, so its codes could never be fetched.`,
        },
        { status: 400 },
      );
    }
  }

  const [passwordEnc, sharedSecretEnc, recoveryEmailPasswordEnc] =
    await Promise.all([
      encrypt(password),
      sharedSecret ? encrypt(sharedSecret) : Promise.resolve(undefined),
      recoveryEmailPassword
        ? encrypt(recoveryEmailPassword)
        : Promise.resolve(undefined),
    ]);

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("steam_accounts")
    .insert({
      username,
      password_enc: passwordEnc,
      code_source: source,
      ...(sharedSecretEnc ? { shared_secret_enc: sharedSecretEnc } : {}),
      ...(source === "supplier"
        ? { supplier_site: supplierSite, supplier_order_id: supplierOrderId }
        : {}),
      ...(recoveryEmail ? { recovery_email: recoveryEmail } : {}),
      ...(recoveryEmailPasswordEnc
        ? { recovery_email_password_enc: recoveryEmailPasswordEnc }
        : {}),
    })
    .select("id, username, status, code_source")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data, { status: 201 });
}

export async function PATCH(request: Request) {
  const { id, status, supplierSite, supplierOrderId, password } =
    (await request.json()) as {
      id?: string;
      status?: AccountStatus;
      supplierSite?: string;
      supplierOrderId?: string;
      password?: string;
    };

  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const update: Record<string, string> = {};

  if (status !== undefined) {
    if (!ACCOUNT_STATUSES.includes(status)) {
      return NextResponse.json(
        { error: "status must be one of active, banned, recovering" },
        { status: 400 },
      );
    }
    update.status = status;
  }

  // A supplier can rotate the order id behind an account without us
  // re-buying it, so this must be correctable in place rather than by
  // deleting and recreating the account (which would lose its game links).
  if (supplierOrderId !== undefined) {
    if (!supplierOrderId.trim()) {
      return NextResponse.json(
        { error: "supplierOrderId cannot be blank" },
        { status: 400 },
      );
    }
    update.supplier_order_id = supplierOrderId.trim();
  }

  if (supplierSite !== undefined) {
    if (!isSupplierSite(supplierSite)) {
      return NextResponse.json(
        { error: `Unknown supplier site "${supplierSite}"` },
        { status: 400 },
      );
    }
    update.supplier_site = supplierSite;
  }

  if (password !== undefined) {
    if (!password.trim()) {
      return NextResponse.json(
        { error: "password cannot be blank" },
        { status: 400 },
      );
    }
    // The lookup route reads the password live from the DB on every request,
    // so an update here reaches existing buyers immediately — no re-delivery.
    update.password_enc = await encrypt(password);
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json(
      { error: "nothing to update" },
      { status: 400 },
    );
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("steam_accounts")
    .update(update)
    .eq("id", id)
    .select("id, status, supplier_site, supplier_order_id")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }
  return NextResponse.json(data);
}
