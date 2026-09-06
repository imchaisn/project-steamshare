import { NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/admin";

/**
 * The redemption ledger, for the admin panel.
 *
 * Two things this exists to surface, both of which cost real inventory before
 * anything counted them:
 *
 *   - how many redemptions each order on our other sites has SPENT. The cap is
 *     roughly 5-6, and an exhausted order returns REACHED LIMIT until reset by
 *     hand, so this count is the only early warning that exists.
 *   - when the code actually CHANGED, as opposed to a buyer pressing twice.
 *     A Guard code is emailed once per Steam login and stays the same until it
 *     expires, so "changed" means somebody logged in again.
 *
 * Read-only. Gated by proxy.ts like every other /api/admin route.
 */
export async function GET() {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("supplier_code_log")
    .select(
      "id, order_id, supplier_site, supplier_order_id, outcome, code_fingerprint, code_changed, fetched_at",
    )
    .order("fetched_at", { ascending: false })
    .limit(200);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Rolled up per supplier order, which is the unit the cap applies to. Done
  // here rather than in SQL so the outcome vocabulary stays in one place.
  const bySupplierOrder = new Map<
    string,
    {
      supplierSite: string;
      supplierOrderId: string;
      spent: number;
      lastOutcome: string;
      lastFetchedAt: string;
      lastChangedAt: string | null;
      exhausted: boolean;
    }
  >();

  for (const row of data ?? []) {
    const key = `${row.supplier_site}::${row.supplier_order_id}`;
    const existing = bySupplierOrder.get(key);
    if (!existing) {
      bySupplierOrder.set(key, {
        supplierSite: row.supplier_site,
        supplierOrderId: row.supplier_order_id,
        spent: 1,
        // Rows arrive newest-first, so the first one seen is the latest.
        lastOutcome: row.outcome,
        lastFetchedAt: row.fetched_at,
        lastChangedAt: row.code_changed ? row.fetched_at : null,
        exhausted: row.outcome === "limit_reached",
      });
      continue;
    }
    existing.spent += 1;
    if (!existing.lastChangedAt && row.code_changed) {
      existing.lastChangedAt = row.fetched_at;
    }
  }

  return NextResponse.json({
    fetches: data,
    // The at-a-glance view: which orders are running down.
    orders: [...bySupplierOrder.values()].sort((a, b) =>
      b.lastFetchedAt.localeCompare(a.lastFetchedAt),
    ),
    // OBSERVED, not documented — see CHECKPOINT.md. Shown so the operator reads
    // "4 of about 6" rather than a bare number with no scale.
    observedCap: 6,
    // Only the most recent 200 rows are read, so a very busy order's count is a
    // floor, not a total. Said plainly rather than silently understating it.
    windowLimit: 200,
  });
}
