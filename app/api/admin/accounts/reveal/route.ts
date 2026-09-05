import { NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { decrypt } from "@/lib/encryption";

/**
 * Reveal one account's plaintext credentials on demand.
 *
 * WHY THIS IS A SEPARATE, PER-ACCOUNT POST
 *
 * The operator needs the username, password and supplier order id together in
 * order to key them into a supplier's portal by hand — that is the whole point
 * of the request. But adding the password to the list GET would ship every
 * stored password in the fleet on every admin page load, into the browser
 * cache and every intermediary. One account at a time, only when explicitly
 * asked for, keeps the blast radius to the account actually being worked on.
 *
 * POST rather than GET for the same reason: credentials must not ride in a URL
 * that lands in history or a proxy log.
 *
 * Gated by proxy.ts along with every other /api/admin route.
 */
export async function POST(request: Request) {
  let body: { id?: string } = {};
  try {
    body = (await request.json()) as { id?: string };
  } catch {
    body = {};
  }

  if (!body.id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("steam_accounts")
    .select("username, password_enc, code_source, supplier_site, supplier_order_id")
    .eq("id", body.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }

  return NextResponse.json({
    username: data.username,
    password: await decrypt(data.password_enc),
    codeSource: data.code_source ?? "totp",
    supplierSite: data.supplier_site,
    supplierOrderId: data.supplier_order_id,
  });
}
