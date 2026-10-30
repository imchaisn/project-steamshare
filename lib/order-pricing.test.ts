import { test } from "node:test";
import assert from "node:assert/strict";
import {
  isMissingPricingColumns,
  orderGamePricingColumns,
  readItemPricing,
} from "./order-pricing.ts";

// ── readItemPricing ──────────────────────────────────────────────────────
// Shopee's item_list entry, as get_order_detail returns it. Field names and
// the bundle-deal behaviour are from congminh1254/shopee-sdk
// src/schemas/order.ts, which transcribes the official doc page.

test("reads original price, discounted price and quantity", () => {
  assert.deepEqual(
    readItemPricing({ model_original_price: 3.99, model_discounted_price: 2.89, model_quantity_purchased: 1 }),
    { originalPrice: 3.99, discountedPrice: 2.89, quantity: 1 },
  );
});

test("accepts string-typed numbers, as Shopee returns some numeric fields", () => {
  assert.deepEqual(
    readItemPricing({ model_original_price: "9.00", model_discounted_price: "7.50", model_quantity_purchased: "2" }),
    { originalPrice: 9, discountedPrice: 7.5, quantity: 2 },
  );
});

test("a bundle-deal discounted price of 0 is unknown, not a free sale", () => {
  // Shopee documents model_discounted_price as 0 for bundle-deal items "by
  // design". Recording RM0 would report a paid order as free revenue.
  assert.deepEqual(
    readItemPricing({ model_original_price: 3.99, model_discounted_price: 0, model_quantity_purchased: 1 }),
    { originalPrice: 3.99, discountedPrice: null, quantity: 1 },
  );
});

test("absent fields are null, never 0", () => {
  assert.deepEqual(readItemPricing({}), { originalPrice: null, discountedPrice: null, quantity: null });
  assert.deepEqual(readItemPricing(null), { originalPrice: null, discountedPrice: null, quantity: null });
});

test("junk, negative and non-integer values are null", () => {
  assert.deepEqual(
    readItemPricing({ model_original_price: "abc", model_discounted_price: -1, model_quantity_purchased: 1.5 }),
    { originalPrice: null, discountedPrice: null, quantity: null },
  );
  assert.equal(readItemPricing({ model_quantity_purchased: 0 }).quantity, null);
});

// ── orderGamePricingColumns ──────────────────────────────────────────────

test("maps an item's pricing onto the order_games column names", () => {
  assert.deepEqual(
    orderGamePricingColumns({ itemId: 1, modelId: 0, originalPrice: 3.99, discountedPrice: 2.89, quantity: 1 }),
    { shopee_original_price: 3.99, shopee_discounted_price: 2.89, shopee_quantity: 1 },
  );
});

test("an item with no pricing writes nulls rather than omitting the columns", () => {
  assert.deepEqual(orderGamePricingColumns({ itemId: 1, modelId: 0 }), {
    shopee_original_price: null,
    shopee_discounted_price: null,
    shopee_quantity: null,
  });
});

// ── isMissingPricingColumns ──────────────────────────────────────────────
// Decides whether to retry the order_games insert WITHOUT the pricing
// columns. Too narrow -> every new order fails to record its game lines
// before 0016 is applied, and buyers see "order not found". Too broad -> a
// real fault is absorbed and retried as if the migration were missing.

test("matches PostgREST's column-not-found (PGRST204) for a pricing column", () => {
  assert.equal(
    isMissingPricingColumns({
      code: "PGRST204",
      message: "Could not find the 'shopee_discounted_price' column of 'order_games' in the schema cache",
    }),
    true,
  );
});

test("matches Postgres undefined_column (42703) for a pricing column", () => {
  assert.equal(
    isMissingPricingColumns({
      code: "42703",
      message: 'column "shopee_original_price" of relation "order_games" does not exist',
    }),
    true,
  );
});

test("does NOT match a missing column that is not one of ours", () => {
  // A typo elsewhere in the insert is a real bug. Retrying without pricing
  // would not fix it and would hide which column was wrong.
  assert.equal(
    isMissingPricingColumns({
      code: "PGRST204",
      message: "Could not find the 'shopee_item_idx' column of 'order_games' in the schema cache",
    }),
    false,
  );
});

test("does NOT match a missing order_games table", () => {
  // That is the pre-0014 case, handled by order-games-compat.ts.
  assert.equal(
    isMissingPricingColumns({ code: "42P01", message: 'relation "order_games" does not exist' }),
    false,
  );
});

test("does NOT match a permission error or a check violation", () => {
  assert.equal(
    isMissingPricingColumns({ code: "42501", message: "permission denied for table order_games" }),
    false,
  );
  assert.equal(
    isMissingPricingColumns({
      code: "23514",
      message: 'new row for relation "order_games" violates check constraint "order_games_shopee_price_nonnegative"',
    }),
    false,
  );
});

test("does NOT match nothing", () => {
  assert.equal(isMissingPricingColumns(null), false);
  assert.equal(isMissingPricingColumns(undefined), false);
  assert.equal(isMissingPricingColumns("PGRST204"), false);
});
