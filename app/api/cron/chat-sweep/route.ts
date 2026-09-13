import { NextResponse } from "next/server";
import { verifyApiSecret } from "@/lib/auth";
import { resolveAiMode, runChatSweep, SWEEP_DEFAULTS } from "@/lib/chat-sweep";

/**
 * Chat response sweep endpoint. Finds Shopee conversations where the buyer
 * spoke last and answers them, protecting the shop's Chat Response Rate while
 * Chaison is asleep. Reasoning and reply copy: docs/chat-response-playbook.md.
 *
 * ── WHY THIS IS NOT IN vercel.json ───────────────────────────────────────
 * It cannot be. The Vercel team plan is `hobby` (`FACT-V` 2026-09-08), and
 * Hobby caps cron at ONCE PER DAY. Against a ~12h reply window, two daily runs
 * would still leave a 12h worst-case gap — useless. The schedule therefore
 * lives in .github/workflows/chat-sweep.yml, which calls this route with
 * `x-api-secret` every 15 minutes.
 *
 * That indirection buys something real: **the GitHub workflow IS the kill
 * switch.** Disabling it stops the sweep instantly, with no redeploy. Compare
 * SHOPEE_AUTO_FULFILL, where CHECKPOINT records that flipping the Vercel env
 * var alone leaves the running deployment still auto-delivering because Vercel
 * bakes env vars into a deployment.
 *
 * ── AI-WRITTEN REPLIES ───────────────────────────────────────────────────
 * With ANTHROPIC_API_KEY set AND SHOPEE_CHAT_AI=true, replies are written by
 * Claude (lib/chat-ai.ts) and every one passes a deterministic validator before
 * it is sent; without both, the fixed templates run exactly as they did before
 * this feature existed. `?dryRun=1&ai=1` previews AI drafts without sending —
 * the verification step before SHOPEE_CHAT_AI is switched on. The rules for
 * which combination does what live in resolveAiMode(), and are tested.
 *
 * ── AUTH: THIS ROUTE GUARDS ITSELF ───────────────────────────────────────
 * `/api/cron/` is in proxy.ts PUBLIC_PREFIXES, so the proxy does not
 * authenticate this — the route must, and must fail closed. Identical posture
 * to app/api/cron/follow-up/route.ts:
 *
 *   - Neither API_SECRET nor CRON_SECRET set -> 503. Never an open endpoint.
 *   - Wrong/absent credential                -> 401.
 *
 * Both credentials already exist in Vercel production. The AI feature adds
 * exactly one variable that does not (ANTHROPIC_API_KEY), and without it the
 * route degrades to templates rather than failing.
 *
 * ── WHY IT ANSWERS 200 ON ALMOST EVERYTHING ──────────────────────────────
 * A non-2xx invites the scheduler to retry a job whose contract is "at most one
 * auto-reply per buyer message". A run that sends nothing because Shopee was
 * down is a SUCCESSFUL run with a boring summary; the detail is in the JSON
 * body. Only auth failures answer non-2xx.
 */

/**
 * Vercel Hobby caps a function at 60s. The Shopee calls stay sequential at
 * 250ms spacing (~5s for 10 conversations); the Claude calls run concurrently
 * under a hard per-call timeout in lib/chat-ai.ts, so ten drafts cost roughly
 * one call's latency, not ten.
 */
export const maxDuration = 60;

function authorized(request: Request): "ok" | "unset" | "denied" {
  const apiSecret = process.env.API_SECRET;
  const cronSecret = process.env.CRON_SECRET;
  if (!apiSecret && !cronSecret) return "unset";

  if (verifyApiSecret(request.headers.get("x-api-secret"))) return "ok";

  const auth = request.headers.get("authorization") ?? "";
  if (cronSecret && auth === `Bearer ${cronSecret}`) return "ok";

  return "denied";
}

function intParam(url: URL, name: string, fallback: number): number {
  const raw = url.searchParams.get(name);
  if (raw === null) return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

export async function GET(request: Request) {
  const gate = authorized(request);
  if (gate === "unset") {
    return NextResponse.json(
      { ok: false, error: "Neither API_SECRET nor CRON_SECRET is set; refusing to run." },
      { status: 503 },
    );
  }
  if (gate === "denied") {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);

  /**
   * `dryRun` reports what WOULD be sent without sending anything. This is how
   * the feature was verified against production before a single buyer saw a
   * message, and it is the right first call after any template change.
   */
  const dryRun = url.searchParams.get("dryRun") === "1";

  /**
   * Resolved here from THIS deployment's env and passed down, so lib code never
   * reads process.env for a decision this consequential. A query parameter can
   * only ever PREVIEW drafts; live AI sends need SHOPEE_CHAT_AI=true.
   */
  const aiMode = resolveAiMode({
    hasKey: Boolean(process.env.ANTHROPIC_API_KEY),
    envFlag: process.env.SHOPEE_CHAT_AI,
    dryRun,
    aiParam: url.searchParams.get("ai") === "1",
  });

  let summary;
  try {
    summary = await runChatSweep({
      dryRun,
      aiMode,
      limit: intParam(url, "limit", SWEEP_DEFAULTS.limit),
      minAgeMinutes: intParam(url, "minAgeMinutes", SWEEP_DEFAULTS.minAgeMinutes),
      maxAgeHours: intParam(url, "maxAgeHours", SWEEP_DEFAULTS.maxAgeHours),
      ignoreOlderThanHours: intParam(
        url,
        "ignoreOlderThanHours",
        SWEEP_DEFAULTS.ignoreOlderThanHours,
      ),
    });
  } catch (e) {
    // runChatSweep is written not to throw; this is belt-and-braces so an
    // unexpected throw still cannot turn into a scheduler retry storm.
    console.error(`[chat-sweep] unexpected throw: ${String(e)}`);
    return NextResponse.json({ ok: false, error: String(e) }, { status: 200 });
  }

  /**
   * Threads past the window want a HUMAN, not another template. Logged with an
   * ACTION REQUIRED marker so they are greppable in Vercel logs — the same
   * convention the fulfilment webhook uses for no_mapping.
   */
  if (summary.stale.length > 0) {
    console.error(
      `[chat-sweep] ACTION REQUIRED — ${summary.stale.length} conversation(s) have waited ` +
        `longer than ${intParam(url, "maxAgeHours", SWEEP_DEFAULTS.maxAgeHours)}h and need a ` +
        `personal reply: ` +
        summary.stale.map((s) => `${s.buyerName} (${s.ageHours}h)`).join(", "),
    );
  }

  /**
   * Answered, but not finished: a refund or complaint that got the fixed
   * acknowledgement, an order problem, or a draft the validator refused. The
   * buyer has heard back inside the window; a person still has to close it.
   */
  if (summary.escalations.length > 0) {
    console.error(
      `[chat-sweep] ACTION REQUIRED — ${summary.escalations.length} conversation(s) were ` +
        `answered but need a personal follow-up: ` +
        summary.escalations.map((e) => `${e.buyerName} (${e.reason})`).join(", "),
    );
  }

  const skipped = summary.results.filter((r) => r.action === "skipped_already_assisted");
  if (skipped.length > 0) {
    console.warn(
      `[chat-sweep] ${skipped.length} conversation(s) hit the auto-reply limit and the buyer ` +
        `is still writing — these need a human: ` +
        skipped.map((s) => s.buyerName).join(", "),
    );
  }

  return NextResponse.json(summary, { status: 200 });
}
