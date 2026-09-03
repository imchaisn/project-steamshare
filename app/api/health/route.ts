import { NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/admin";

/**
 * Public, unauthenticated health check. Exists specifically because a paused
 * Supabase project fails SILENTLY: /api/lookup catches the DB error and
 * returns the same generic 404 as a genuinely unknown order (by design, for
 * security — see verifyShopeeOrder()'s docstring). That's correct behavior
 * for buyers, but it means an infra outage looks identical to normal traffic
 * in every metric except "buyers stop being able to redeem" — which nobody
 * is watching in real time. This route exists so an external uptime monitor
 * (or a manual check) can tell the two apart in one request.
 *
 * Point a free uptime monitor (UptimeRobot, Better Uptime, etc.) at
 * GET /api/health on an interval and alert on non-200 — that's the actual
 * fix for "the site was down and nobody knew," not just documenting it.
 */
export async function GET() {
  const startedAt = Date.now();
  try {
    const supabase = createAdminClient();
    const { error } = await supabase.from("steam_accounts").select("id").limit(1);
    const latencyMs = Date.now() - startedAt;

    if (error) {
      return NextResponse.json(
        { status: "error", database: "unreachable", detail: error.message, latencyMs },
        { status: 503 },
      );
    }
    return NextResponse.json({ status: "ok", database: "reachable", latencyMs });
  } catch (err) {
    return NextResponse.json(
      {
        status: "error",
        database: "unreachable",
        detail: err instanceof Error ? err.message : "unknown error",
        latencyMs: Date.now() - startedAt,
      },
      { status: 503 },
    );
  }
}
