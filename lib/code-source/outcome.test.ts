import { test } from "node:test";
import assert from "node:assert/strict";
import { failureResponseFor } from "./outcome.ts";
import {
  HEAVY_OUTCOMES,
  MAX_WEIGHTED_ATTEMPTS_PER_ORDER,
  FAILED_ATTEMPT_WEIGHT,
} from "../rate-limit-constants.ts";

/**
 * THE REGRESSION GUARD.
 *
 * MAX_WEIGHTED_ATTEMPTS_PER_ORDER is 20 and FAILED_ATTEMPT_WEIGHT is 3. If any
 * of these reasons were recorded as "failure", a buyer pressing retry while
 * waiting for Steam to prompt them would exhaust their own 15-minute budget
 * after SIX presses — locked out, as a punishment for doing exactly what our
 * own error message told them to do.
 */
test("no supplier failure is ever recorded at the heavy weight", () => {
  for (const reason of ["not_ready", "expired", "supplier_error"] as const) {
    const { outcome } = failureResponseFor(reason);
    assert.ok(
      !HEAVY_OUTCOMES.includes(outcome),
      `${reason} maps to "${outcome}", which is rate-limited at ${FAILED_ATTEMPT_WEIGHT}x`,
    );
    assert.equal(outcome, "unavailable");
  }
});

test("a buyer can retry more than six times without being locked out", () => {
  // Spells out the arithmetic the guard above protects, so a future change to
  // either constant fails here with an explanation rather than silently
  // shrinking the buyer's retry budget.
  const { outcome } = failureResponseFor("not_ready");
  const weight = HEAVY_OUTCOMES.includes(outcome) ? FAILED_ATTEMPT_WEIGHT : 1;
  const presses = Math.floor(MAX_WEIGHTED_ATTEMPTS_PER_ORDER / weight);
  assert.ok(
    presses > 6,
    `a waiting buyer gets only ${presses} presses before lockout`,
  );
});

test("not_ready tells the buyer to log into Steam first", () => {
  const { status, error } = failureResponseFor("not_ready");
  assert.equal(status, 409);
  assert.match(error, /log in to steam/i);
});

test("expired tells the buyer to attempt the login again", () => {
  const { status, error } = failureResponseFor("expired");
  assert.equal(status, 409);
  assert.match(error, /expired/i);
});

test("supplier_error stays generic and never names the supplier", () => {
  const { status, error } = failureResponseFor("supplier_error");
  assert.equal(status, 503);
  // A buyer must never learn their account came from a third party, and
  // naming the site would leak our supply chain to competitors.
  assert.doesNotMatch(error, /cyberspace|gamersfantasy|supplier/i);
});

test("no failure reuses the generic not-found copy used for unverified orders", () => {
  // The route's anti-enumeration message must stay reserved for
  // pre-verification failures. Reusing it here would make a real ops problem
  // look like a bad order id to the buyer.
  for (const reason of ["not_ready", "expired", "supplier_error"] as const) {
    assert.doesNotMatch(
      failureResponseFor(reason).error,
      /order not found or not verified/i,
    );
  }
});
