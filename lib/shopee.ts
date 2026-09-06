import { createAdminClient } from "@/utils/supabase/admin";

export interface ShopeeVerificationResult {
  verified: boolean;
  accountGameId: string | null;
  /** `orders.id` of the matched row, for the code-access audit log. */
  orderId: string | null;
  /**
   * THE MAPPING — our order id connected to the other website's order id.
   *
   * All of these websites are ours. The same Steam account is known to another
   * of our sites by a DIFFERENT order id; the username and password are
   * identical on both sides, so the order id is the only thing that has to be
   * carried across. When these are set, this buyer's code is fetched from that
   * site using that order id.
   *
   * Null on an order that has not been mapped, which then falls back to the
   * account's own default. See supabase/migrations/0012_orders_supplier_mapping.sql.
   */
  supplierSite: string | null;
  supplierOrderId: string | null;
}

/**
 * Verify a Shopee order against the local `orders` table.
 *
 * LOCAL-VERIFICATION MODE: real Shopee Open API integration is deferred
 * until Chaison has Shopee Open Platform partner credentials (see plan
 * Global Constraints). For now, an order counts as verified only if an
 * admin has already created a matching row in `orders` with
 * `verified = true` (via the admin panel, Task 9) — this is the manual
 * bridge until live API verification replaces it. Callers don't need to
 * know which mode is active; only this function's internals change later.
 *
 * The buyer proves ownership with the order id alone here; the caller then
 * checks the supplied Steam username against the account this order resolves
 * to. `orders.shopee_buyer_id` is still recorded for admin/audit purposes but
 * is no longer part of the lookup, because buyers can't reliably find their
 * Shopee Buyer ID.
 */
export async function verifyShopeeOrder(
  orderId: string,
): Promise<ShopeeVerificationResult> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("orders")
    .select("id, account_game_id, verified, supplier_site, supplier_order_id")
    .eq("shopee_order_id", orderId)
    .maybeSingle();

  if (error || !data || !data.verified) {
    return {
      verified: false,
      accountGameId: null,
      orderId: null,
      supplierSite: null,
      supplierOrderId: null,
    };
  }

  return {
    verified: true,
    accountGameId: data.account_game_id,
    orderId: data.id,
    supplierSite: data.supplier_site ?? null,
    supplierOrderId: data.supplier_order_id ?? null,
  };
}
