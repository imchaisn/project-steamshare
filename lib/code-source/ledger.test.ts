/**
 * The ledger row, and what happens when the database is behind the code.
 *
 * The degraded path matters more than the happy one: this repo auto-deploys on
 * push and 0015 can only be applied by hand, so for some window the code will
 * be writing columns that do not exist yet. Losing the row in that window would
 * silently undercount redemptions.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildLedgerRow, insertLedgerRow, type LedgerRow } from "./ledger.ts";

const BASE = {
  orderId: "order-1",
  supplierSite: "gamersfantasy.my",
  supplierOrderId: "SUPPLIER-1",
  username: "pooluser",
};

test("a failure records which account was asked and what the site said", () => {
  const row = buildLedgerRow({
    ...BASE,
    result: { ok: false, reason: "supplier_error", detail: "Steam Code Not Found" },
    fingerprint: null,
    changed: null,
  });

  assert.equal(row.outcome, "supplier_error");
  assert.equal(row.username, "pooluser");
  assert.equal(row.supplier_message, "Steam Code Not Found");
});

test("a success records the account and no supplier message", () => {
  const row = buildLedgerRow({
    ...BASE,
    result: { ok: true, code: "BCDFG" },
    fingerprint: "abc123",
    changed: true,
  });

  assert.equal(row.outcome, "success");
  assert.equal(row.username, "pooluser");
  assert.equal(row.supplier_message, null);
  assert.equal(row.code_fingerprint, "abc123");
});

test("the code itself never reaches the row", () => {
  const row = buildLedgerRow({
    ...BASE,
    result: { ok: true, code: "BCDFG" },
    fingerprint: "abc123",
    changed: true,
  });

  assert.ok(!JSON.stringify(row).includes("BCDFG"));
});

const ROW: LedgerRow = buildLedgerRow({
  ...BASE,
  result: { ok: false, reason: "not_ready", detail: "still waiting" },
  fingerprint: null,
  changed: null,
});

test("a healthy insert writes once and reports the diagnostics were stored", async () => {
  const calls: Record<string, unknown>[] = [];
  const stored = await insertLedgerRow(async (row) => {
    calls.push(row);
    return { error: null };
  }, ROW);

  assert.equal(stored, true);
  assert.equal(calls.length, 1);
});

for (const code of ["PGRST204", "42703"]) {
  test(`a missing column (${code}) still records the redemption, without the new columns`, async () => {
    const calls: Record<string, unknown>[] = [];
    const stored = await insertLedgerRow(async (row) => {
      calls.push(row);
      return calls.length === 1 ? { error: { code } } : { error: null };
    }, ROW);

    assert.equal(stored, false);
    assert.equal(calls.length, 2);
    assert.ok(!("username" in calls[1]));
    assert.ok(!("supplier_message" in calls[1]));
    assert.equal(calls[1].outcome, "not_ready");
    assert.equal(calls[1].supplier_order_id, "SUPPLIER-1");
  });
}

test("any other insert error is not retried", async () => {
  const calls: Record<string, unknown>[] = [];
  const stored = await insertLedgerRow(async (row) => {
    calls.push(row);
    return { error: { code: "23502" } };
  }, ROW);

  assert.equal(stored, false);
  assert.equal(calls.length, 1);
});
