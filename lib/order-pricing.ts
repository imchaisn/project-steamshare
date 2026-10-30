/**
 * What a buyer actually paid, per game line — read from Shopee's order detail
 * and stored on `order_games` (migration 0016).
 *
 * ── WHY THIS EXISTS ───────────────────────────────────────────────────────
 * `orders` and `order_games` recorded WHICH listing sold but never AT WHAT
 * PRICE, so "which listing sold what, when, and after which change" was
 * unanswerable (.claude/skills/ss-market/SKILL.md §5). Every title, voucher or
 * ad experiment was guesswork. The prices were already arriving: they sit on
 * the same `item_list` entries getOrderDetail() parses for item_id/model_id.
 * Nothing new is requested from Shopee.
 *
 * ── SOURCE ────────────────────────────────────────────────────────────────
 * congminh1254/shopee-sdk src/schemas/order.ts, which transcribes the
 * v2.order.get_order_detail doc page (open.shopee.com refuses non-browser
 * clients from this environment — see lib/shopee-api.ts):
 *   model_original_price     — "The original price of the item in the listing currency."
 *   model_discounted_price   — "The after-discount price of the item in the listing currency.
 *                               ... In case of bundle deal item, this value will return 0 as by
 *                               design bundle deal discount will not be breakdown to item/model level."
 *   model_quantity_purchased — "The number of identical items purchased at the same time by the
 *                               same buyer from one listing/item."
 *
 * ── THE ZERO RULE ─────────────────────────────────────────────────────────
 * A 0 price is stored as NULL, never as 0. For a bundle-deal item Shopee
 * returns 0 on purpose, and a 0 in the table would read as a free sale and
 * drag every revenue figure down. NULL means "not known from this payload";
 * the true bundle price needs get_escrow_detail, which is not called here.
 */

/** The pricing fields of one raw `item_list` entry. Shopee types some numbers as strings. */
export interface RawItemPricing {
  model_original_price?: number | string | null;
  model_discounted_price?: number | string | null;
  model_quantity_purchased?: number | string | null;
}

export interface ItemPricing {
  /** Listing price before discount, MYR. null when absent or not positive. */
  originalPrice: number | null;
  /** Price actually charged, MYR. null when absent, not positive, or a bundle deal (Shopee sends 0). */
  discountedPrice: number | null;
  /** Units of this listing on the line. null when absent or not a positive integer. */
  quantity: number | null;
}

/** A purchased line item carrying pricing — structurally ShopeeOrderItem / FulfillmentItem. */
export type PricedLineItem = { itemId: number; modelId: number } & Partial<ItemPricing>;

/** The order_games columns added by migration 0016. The names are matched in error text below. */
export const PRICING_COLUMNS = [
  "shopee_original_price",
  "shopee_discounted_price",
  "shopee_quantity",
] as const;

function toPositiveNumber(value: number | string | null | undefined): number | null {
  let parsed: number;
  if (typeof value === "number") parsed = value;
  else if (typeof value === "string" && value.trim() !== "") parsed = Number(value);
  else return null;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function readItemPricing(raw: RawItemPricing | null | undefined): ItemPricing {
  const quantity = toPositiveNumber(raw?.model_quantity_purchased);
  return {
    originalPrice: toPositiveNumber(raw?.model_original_price),
    discountedPrice: toPositiveNumber(raw?.model_discounted_price),
    quantity: quantity !== null && Number.isInteger(quantity) ? quantity : null,
  };
}

/** The pricing half of one order_games insert row. Always all three keys, so a row never silently omits one. */
export function orderGamePricingColumns(item: PricedLineItem): {
  shopee_original_price: number | null;
  shopee_discounted_price: number | null;
  shopee_quantity: number | null;
} {
  return {
    shopee_original_price: item.originalPrice ?? null,
    shopee_discounted_price: item.discountedPrice ?? null,
    shopee_quantity: item.quantity ?? null,
  };
}

/**
 * Does this error mean the pricing columns do not exist yet (0016 not applied)?
 *
 * The deploy and the migration cannot be ordered reliably here (see
 * lib/order-games-compat.ts, "WHY THIS EXISTS"), and without this check a
 * deploy that lands before the SQL would fail every new order's game-line
 * insert — an "order not found" outage for every new buyer. On a match,
 * fulfillOrder() retries the insert without pricing.
 *
 * Deliberately narrow: the message must name one of OUR columns.
 *   PGRST204 — PostgREST: column not found in its schema cache (what supabase-js inserts get).
 *   42703    — Postgres undefined_column, on a direct write.
 * A missing column that is not ours is a real bug and must still fail loudly.
 * A missing TABLE (42P01) is the pre-0014 case, handled by order-games-compat.ts.
 */
export function isMissingPricingColumns(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const e = error as { code?: unknown; message?: unknown };
  const message = typeof e.message === "string" ? e.message : "";
  if (!PRICING_COLUMNS.some((column) => message.includes(column))) return false;
  if (e.code === "PGRST204" || e.code === "42703") return true;
  const lower = message.toLowerCase();
  return lower.includes("could not find") || lower.includes("does not exist");
}

/** Log the pre-0016 fallback once per process, not once per order. */
let warned = false;
export function warnPricingLegacyMode(where: string): void {
  if (warned) return;
  warned = true;
  console.warn(
    `[order-pricing] ${where}: order_games has no pricing columns, so this deployment is ` +
      `recording game lines WITHOUT price. Orders are unaffected. Apply ` +
      `supabase/migrations/0016_order_games_pricing.sql to start recording prices.`,
  );
}
