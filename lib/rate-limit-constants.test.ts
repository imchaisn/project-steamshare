import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MAX_ORDER_GAME_MULTIPLIER,
  MAX_WEIGHTED_ATTEMPTS_PER_ORDER,
  orderLimitForGameCount,
} from "./rate-limit-constants.ts";

/*
 * orderLimitForGameCount is the only piece of the limiter that a multi-game
 * order changes, and getting it wrong is a lockout for a paying buyer at one
 * extreme and a weakened enumeration control at the other. It is pure, so it
 * is tested directly — lib/rate-limit.ts itself imports the Supabase admin
 * client through the `@/` alias and cannot be loaded by `node --test`, which
 * is why these constants live in their own module (see that file's header).
 */

test("a one-game order gets exactly the unchanged base limit", () => {
  assert.equal(orderLimitForGameCount(1), MAX_WEIGHTED_ATTEMPTS_PER_ORDER);
});

test("the per-game budget is identical no matter how many games", () => {
  // This is the property that matters: a four-game buyer must get the same
  // room per game that a one-game buyer has always had, not less.
  for (const count of [1, 2, 3, 4, 8]) {
    assert.equal(
      orderLimitForGameCount(count) / count,
      MAX_WEIGHTED_ATTEMPTS_PER_ORDER,
      `${count} games should give ${MAX_WEIGHTED_ATTEMPTS_PER_ORDER} weighted attempts per game`,
    );
  }
});

test("an unresolved order stays on the base limit — anti-enumeration is untouched", () => {
  // countOrderGames() returns 1 for anything that does not resolve, and 0 or
  // a negative can only come from a bug. All must floor to the base limit,
  // never to something larger.
  for (const junk of [0, -1, -100, Number.NaN]) {
    assert.equal(
      orderLimitForGameCount(junk),
      MAX_WEIGHTED_ATTEMPTS_PER_ORDER,
      `${junk} must not widen the budget`,
    );
  }
});

test("the multiplier is capped, so the budget can never grow unbounded", () => {
  const ceiling = MAX_WEIGHTED_ATTEMPTS_PER_ORDER * MAX_ORDER_GAME_MULTIPLIER;
  assert.equal(orderLimitForGameCount(MAX_ORDER_GAME_MULTIPLIER), ceiling);
  assert.equal(orderLimitForGameCount(MAX_ORDER_GAME_MULTIPLIER + 1), ceiling);
  assert.equal(orderLimitForGameCount(10_000), ceiling);
});

test("a fractional count cannot buy a fractional reprieve", () => {
  assert.equal(orderLimitForGameCount(2.9), MAX_WEIGHTED_ATTEMPTS_PER_ORDER * 2);
});

test("the limit never decreases as games are added", () => {
  let previous = 0;
  for (let count = 1; count <= MAX_ORDER_GAME_MULTIPLIER + 3; count++) {
    const limit = orderLimitForGameCount(count);
    assert.ok(limit >= previous, `limit went down at ${count} games`);
    previous = limit;
  }
});
