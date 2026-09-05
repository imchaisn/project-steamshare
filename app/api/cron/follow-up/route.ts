import { NextResponse } from "next/server";
import { verifyApiSecret } from "@/lib/auth";
import { sendPendingFollowUps } from "@/lib/follow-up";

/**
 * Nightly follow-up sweep. Sends the "press Order Received + leave a rating"
 * message to every buyer delivered ~24h ago, at most once each, ever.
 *
 * Triggered by the Vercel cron declared in vercel.json. Vercel invokes cron
 * paths with a **GET**, which is why there is no POST here.
 *
 * ── AUTH: THIS ROUTE GUARDS ITSELF ───────────────────────────────────────
 * `/api/cron/` is listed in proxy.ts PUBLIC_PREFIXES, exactly like
 * /api/webhooks/shopee, because Vercel's cron invoker carries no session
 * cookie and no x-api-secret — it sends `Authorization: Bearer $CRON_SECRET`
 * and nothing else. Public in the proxy therefore means "the proxy does not
 * authenticate this; the route does", and the route MUST fail closed:
 *
 *   - CRON_SECRET unset  -> 503, never an open endpoint. Vercel only injects
 *     the bearer when that variable exists, so an unset secret means an
 *     unauthenticated cron would otherwise be able to fire this.
 *   - Wrong/absent bearer AND wrong/absent x-api-secret -> 401.
 *
 * x-api-secret is accepted alongside the bearer so Chaison can run the sweep
 * by hand with the secret he already uses everywhere else, without waiting
 * for 04:00 UTC.
 *
 * ── WHY IT ANSWERS 200 ON ALMOST EVERYTHING ──────────────────────────────
 * A failed cron invocation is noise in the Vercel dashboard and, worse, an
 * invitation to retry a job whose whole contract is "send this once". A run
 * that sends nothing because the feature is off, or because a Shopee call
 * failed, is a *successful run with a boring summary* — the per-order outcome
 * is in the JSON body and in orders.follow_up_error. Only auth failures and a
 * genuinely thrown sweep answer non-2xx.
 */

/**
 * Vercel's Hobby plan caps a function at 60s. The sweep makes two Shopee calls
 * per order and lib/shopee-chat.ts throttles itself to one call per 250ms, so
 * the default batch of 25 fits comfortably; the cap is here so a slow Shopee
 * cannot hold the function open at the platform default instead.
 */
export const maxDuration = 60;

/**
 * OFF unless SHOPEE_FOLLOW_UP is exactly "true", mirroring SHOPEE_AUTO_FULFILL
 * in app/api/webhooks/shopee/route.ts.
 *
 * ⚠ Vercel bakes env vars into a deployment. Changing this in the dashboard or
 * via `vercel env` does NOT affect the running deployment until you redeploy —
 * the same trap documented for SHOPEE_AUTO_FULFILL in CHECKPOINT.md. Both
 * steps are required, in this order:
 *   1. vercel env rm SHOPEE_FOLLOW_UP production --yes
 *      printf false | vercel env add SHOPEE_FOLLOW_UP production
 *   2. vercel redeploy <current production url> --scope imchaison-s-projects
 * Confirm with a manual x-api-secret call: `enabled: false` in the body means
 * it is really off.
 */
function followUpEnabled(): boolean {
  return process.env.SHOPEE_FOLLOW_UP === "true";
}

function authorized(request: Request): { ok: true } | { ok: false; status: number; error: string } {
  const cronSecret = process.env.CRON_SECRET;

  // x-api-secret first: it is the manual path and works even before
  // CRON_SECRET exists, which is how this gets tested the first time.
  if (verifyApiSecret(request.headers.get("x-api-secret"))) return { ok: true };

  if (!cronSecret) {
    return {
      ok: false,
      status: 503,
      error:
        "CRON_SECRET is not set, so a Vercel cron invocation cannot be authenticated and this " +
        "route refuses to run. Set CRON_SECRET in the Vercel project (any long random string) " +
        "and redeploy — Vercel then sends it as `Authorization: Bearer <secret>` automatically.",
    };
  }

  if (request.headers.get("authorization") === `Bearer ${cronSecret}`) return { ok: true };

  return { ok: false, status: 401, error: "Unauthorized." };
}

export async function GET(request: Request) {
  const auth = authorized(request);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  }

  if (!followUpEnabled()) {
    return NextResponse.json({
      ok: true,
      enabled: false,
      note:
        "Follow-ups are DISABLED. Set SHOPEE_FOLLOW_UP=true (and apply migration 0009) to turn " +
        "them on, then redeploy — Vercel bakes env vars into a deployment.",
    });
  }

  // `limit` exists for the manual path: a first live run wants to be one
  // order, not twenty-five. Clamped rather than validated — a nonsense value
  // should shrink the batch, never 400 a cron invocation.
  const requested = Number(new URL(request.url).searchParams.get("limit"));
  const limit = Number.isFinite(requested) && requested > 0 ? Math.min(requested, 100) : undefined;

  try {
    const summary = await sendPendingFollowUps({ limit });
    console.info(
      `[cron/follow-up] scanned=${summary.scanned} sent=${summary.sent} ` +
        `failed=${summary.failed} skipped=${summary.skipped}`,
    );
    return NextResponse.json({ ok: true, enabled: true, ...summary });
  } catch (err) {
    // sendPendingFollowUps is written not to throw; if it does, something
    // structural is wrong (no DB credentials, no Supabase) and a non-2xx is
    // the honest answer.
    const detail = err instanceof Error ? err.message : String(err);
    console.error(`[cron/follow-up] sweep threw: ${detail}`);
    return NextResponse.json({ ok: false, error: detail }, { status: 500 });
  }
}
