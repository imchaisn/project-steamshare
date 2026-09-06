import { test } from "node:test";
import assert from "node:assert/strict";
import { buildTrackingNumber } from "./shopee-logistics.ts";

// shipOrder() itself talks to Shopee on every path and this repo has no test
// double for that boundary — same limitation lib/fulfillment.test.ts and
// lib/follow-up.ts document for their own Supabase/Shopee calls. This covers
// the one pure decision in the module: what we send as tracking_number when
// there is no real carrier. See the module docblock in lib/shopee-logistics.ts
// for why this value is a best guess, not a confirmed one.

test("uses the order_sn itself as the tracking number", () => {
  assert.equal(buildTrackingNumber("250906ABCDEFGH"), "250906ABCDEFGH");
});

test("does not fabricate anything beyond the order_sn it was given", () => {
  const sn = "220301QQY0WASP";
  assert.equal(buildTrackingNumber(sn), sn);
});
