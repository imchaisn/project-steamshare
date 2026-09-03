import { NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/admin";

/**
 * Shopee Push Mechanism (webhook) receiver. Public route — Shopee calls
 * this directly, with no session cookie and no x-api-secret. Auth is
 * Shopee's own per-request signature (§2.5 of the spec below), a DIFFERENT
 * mechanism from this app's authorized() helper — do not reuse it here.
 * See proxy.ts PUBLIC_PREFIXES.
 *
 * Spec source: Personal Assistant/research/2026-09-03-shopee-auth-and-push-mechanism-spec.md
 *
 * IMPORTANT — what this route deliberately does NOT do yet: it verifies
 * the signature and logs every push to shopee_push_log for audit/
 * reconciliation (Shopee does not redeliver missed pushes — spec §2.7), but
 * it does NOT flip `orders.verified`. The spec's own "Could not verify"
 * section says the order-status enum is not documented anywhere reachable
 * this pass (only "PROCESSED" is shown as a sample) — wiring "verified=true"
 * to a guessed status value risks either granting access before payment or
 * denying it after payment. That needs the Order API detail doc
 * (`v2.order.get_order_detail`) pulled first, or empirical confirmation via
 * the sandbox Console's "Push Test Data" button. Flagged, not guessed.
 */

const enc = new TextEncoder();

function hex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function hmacSha256Hex(key: string, message: string): Promise<string> {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sigBuf = await crypto.subtle.sign("HMAC", cryptoKey, enc.encode(message));
  return hex(sigBuf);
}

export async function POST(request: Request) {
  // MUST read raw text before any JSON parsing — Shopee's own doc warns the
  // signature is computed over the exact raw bytes, not a re-serialized body.
  const rawBody = await request.text();
  const authHeader = request.headers.get("Authorization") ?? "";

  // The base string is `<registered callback URL>|<raw body>` — this has to
  // be the EXACT string configured in the Console's "Set Push" callback URL
  // field, which may not equal this request's own URL (proxies, trailing
  // slashes, etc.). Falls back to request.url if not explicitly set, but
  // that fallback is a guess — set SHOPEE_PUSH_CALLBACK_URL once the
  // callback is registered in Console.
  const callbackUrl = process.env.SHOPEE_PUSH_CALLBACK_URL ?? request.url;
  const partnerKey = process.env.SHOPEE_PARTNER_KEY ?? "";

  const baseString = `${callbackUrl}|${rawBody}`;
  const expectedSig = partnerKey ? await hmacSha256Hex(partnerKey, baseString) : "";
  const signatureValid = Boolean(partnerKey) && authHeader === expectedSig;

  let payload: {
    data?: { ordersn?: string; status?: string };
    shop_id?: number;
    code?: number;
  } = {};
  try {
    payload = JSON.parse(rawBody);
  } catch {
    // Log the unparseable body as-is below; don't throw before we've logged it.
  }

  const supabase = createAdminClient();
  await supabase.from("shopee_push_log").insert({
    push_code: payload.code ?? null,
    shop_id: payload.shop_id ?? null,
    ordersn: payload.data?.ordersn ?? null,
    order_status: payload.data?.status ?? null,
    signature_valid: signatureValid,
    raw_payload: (() => {
      try {
        return JSON.parse(rawBody);
      } catch {
        return { unparsed: rawBody };
      }
    })(),
  });

  if (!signatureValid) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  // TODO(order sync): once the Order API detail spec is pulled and the
  // status enum confirmed, look up payload.data.ordersn here, call
  // v2.order.get_order_detail for authoritative status + buyer_username +
  // item, and upsert into `orders` (verified = true) only for the confirmed
  // "paid" status. Not implemented — see the module docstring above.

  // Per spec §2.6: 2xx + EMPTY body, or Shopee will treat this as a failed
  // delivery and retry (300s / 1800s / 10800s per the push's retry_strategy).
  return new NextResponse(null, { status: 200 });
}
