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
 *
 * Each row also names the account asked about and what the site said, because
 * a pooled order id cannot be diagnosed without them. See
 * supabase/migrations/0015_supplier_code_log_diagnostics.sql.
 */
import { createAdminClient } from "@/utils/supabase/admin";
import type { CodeResult } from "./types.ts";
import { fingerprintCode } from "./fingerprint.ts";
import { buildLedgerRow, insertLedgerRow } from "./ledger.ts";

export { fingerprintCode };

export interface LogFetchArgs {
  /** `orders.id` — our own row. Null for a non-buyer fetch. */
  orderId: string | null;
  supplierSite: string;
  supplierOrderId: string;
  /** The account the fetch asked about: on a pooled order, the pinned member. */
  username: string;
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
  username,
  result,
}: LogFetchArgs): Promise<LogFetchOutcome> {
  try {
    const supabase = createAdminClient();

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

    const row = buildLedgerRow({
      orderId,
      supplierSite,
      supplierOrderId,
      username,
      result,
      fingerprint,
      changed,
    });
    const stored = await insertLedgerRow(
      (values) => supabase.from("supplier_code_log").insert(values),
      row,
    );
    if (!stored) {
      // Not silent, unlike the catch below: until 0015 is applied this line is
      // the only record of which account failed and why.
      console.warn(
        `[supplier-fetch] diagnostics not stored: ${supplierOrderId} ${username} ${row.outcome} ${row.supplier_message ?? ""}`,
      );
    }

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
