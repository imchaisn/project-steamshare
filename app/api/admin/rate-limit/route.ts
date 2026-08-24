import { NextResponse } from "next/server";
import { clearRateLimit, describeRateLimit } from "@/lib/rate-limit";

/**
 * Escape hatch #2 — inspect and reset lookup rate limits without touching
 * the SQL editor.
 *
 * Auth: none re-declared here on purpose. `proxy.ts` gates everything
 * outside PUBLIC_PREFIXES, and `/api/admin/*` is not public — so this
 * route already requires either the signed admin cookie or the
 * `x-api-secret` header, exactly like every other route under
 * `app/api/admin/`.
 *
 *   GET    /api/admin/rate-limit?ip=1.2.3.4&orderId=ABC   → current counters
 *   DELETE /api/admin/rate-limit?ip=1.2.3.4               → clear that bucket
 *   DELETE /api/admin/rate-limit?orderId=ABC              → clear that bucket
 */

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const ip = searchParams.get("ip");
  const orderId = searchParams.get("orderId");

  if (!ip && !orderId) {
    return NextResponse.json(
      { error: "ip or orderId is required" },
      { status: 400 },
    );
  }

  try {
    // describeRateLimit always reports the IP bucket, so pass a key that
    // matches nothing when only an order id was asked about.
    const scopes = await describeRateLimit({ ip: ip ?? "", orderId });
    return NextResponse.json({
      scopes: ip ? scopes : scopes.filter((s) => s.scope !== "ip"),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Lookup failed" },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const ip = searchParams.get("ip");
  const orderId = searchParams.get("orderId");

  if (!ip && !orderId) {
    return NextResponse.json(
      { error: "ip or orderId is required" },
      { status: 400 },
    );
  }

  try {
    const deleted = await clearRateLimit({ ip, orderId });
    return NextResponse.json({ cleared: deleted });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Clear failed" },
      { status: 500 },
    );
  }
}
