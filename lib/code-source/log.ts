/**
 * The redemption ledger — one row per REAL fetch from one of our other sites.
 *
 * Answers the two questions we could not answer before, both of which cost
 * real inventory to learn:
 *
 *   "How many redemptions has this order spent?"  — the cap is ~5-6 and an
 *   exhausted order returns REACHED LIMIT until reset by hand. On 2026-09-06
 *   an order was burnt out with no warning because nothing counted.
 *
 *   "Did the code actually change?"  — a Guard code is emailed once per Steam
 *   login and stays the same on every fetch until it expires. A change means
 *   the buyer logged in again; no change means they simply pressed twice.
 *
 * A CACHE HIT IS NOT LOGGED. This ledger counts what we spent on the other
 * site, not what we served to a buyer. Logging cache hits here would inflate
 * the count and hide how many redemptions are actually left.
 *
 * The code itself is never stored — only a short fingerprint. See
 * supabase/migrations/0013_supplier_code_log.sql for why.
 */
import { createAdminClient } from "@/utils/supabase/admin";
import type { CodeResult } from "./types.ts";
import { fingerprintCode } from "./fingerprint.ts";

export { fingerprintCode };

export interface LogFetchArgs {
  /** `orders.id` — our own row. Null for a non-buyer fetch. */
  orderId: string | null;
  supplierSite: string;
  supplierOrderId: string;
  result: CodeResult;
}

export interface LogFetchOutcome {
  /** Whether this code differs from the last successful fetch for this order. */
  changed: boolean | null;
  /** Redemptions recorded against this supplier order, including this one. */
  spent: number | null;
}

/**
 * Record one fetch. Never throws: a ledger failure must not cost a buyer their
 * code, so every error is swallowed and reported as an unknown result. The
 * money path already succeeded by the time this runs.
 */
export async function logSupplierFetch({
  orderId,
  supplierSite,
  supplierOrderId,
  result,
}: LogFetchArgs): Promise<LogFetchOutcome> {
  try {
    const supabase = createAdminClient();
    const outcome = result.ok ? "success" : result.reason;

    let fingerprint: string | null = null;
    let changed: boolean | null = null;

    if (result.ok) {
      fingerprint = await fingerprintCode(result.code);

      // Compare against the last SUCCESSFUL fetch for this same order on this
      // same site. Failures are skipped — a not-ready in between does not mean
      // the code changed.
      const { data: previous } = await supabase
        .from("supplier_code_log")
        .select("code_fingerprint")
        .eq("supplier_site", supplierSite)
        .eq("supplier_order_id", supplierOrderId)
        .eq("outcome", "success")
        .order("fetched_at", { ascending: false })
        .limit(1);

      const last = previous?.[0]?.code_fingerprint ?? null;
      // First ever success counts as a change: there was nothing before it.
      changed = last === null ? true : last !== fingerprint;
    }

    await supabase.from("supplier_code_log").insert({
      order_id: orderId,
      supplier_site: supplierSite,
      supplier_order_id: supplierOrderId,
      outcome,
      code_fingerprint: fingerprint,
      code_changed: changed,
    });

    const { count } = await supabase
      .from("supplier_code_log")
      .select("id", { count: "exact", head: true })
      .eq("supplier_site", supplierSite)
      .eq("supplier_order_id", supplierOrderId);

    return { changed, spent: count ?? null };
  } catch {
    // Deliberately silent. The buyer already has their code.
    return { changed: null, spent: null };
  }
}
