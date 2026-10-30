/**
 * The shape of one supplier_code_log row, and how it is written.
 *
 * Split from ./log.ts so it can be tested without a database: log.ts owns the
 * queries, this owns what goes in the row and what to do when the database is
 * behind the code.
 */
import type { CodeResult } from "./types.ts";

export interface LedgerRow extends Record<string, unknown> {
  order_id: string | null;
  supplier_site: string;
  supplier_order_id: string;
  outcome: string;
  code_fingerprint: string | null;
  code_changed: boolean | null;
  username: string;
  supplier_message: string | null;
}

export function buildLedgerRow(args: {
  orderId: string | null;
  supplierSite: string;
  supplierOrderId: string;
  username: string;
  result: CodeResult;
  fingerprint: string | null;
  changed: boolean | null;
}): LedgerRow {
  return {
    order_id: args.orderId,
    supplier_site: args.supplierSite,
    supplier_order_id: args.supplierOrderId,
    outcome: args.result.ok ? "success" : args.result.reason,
    code_fingerprint: args.fingerprint,
    code_changed: args.changed,
    username: args.username,
    supplier_message: args.result.ok ? null : (args.result.detail ?? null),
  };
}

/** PostgREST's and Postgres's codes for a column that does not exist. */
const MISSING_COLUMN_CODES = ["PGRST204", "42703"];

/**
 * Write the row. Returns whether the diagnostic columns were stored.
 *
 * This repo auto-deploys on push and 0015 can only be applied by hand in the
 * Supabase SQL editor (same constraint as lib/order-games-compat.ts), so this
 * code may run before those columns exist. The row must still land when that
 * happens: it is the redemption count, and losing it to a diagnostics column
 * would undercount exactly what this table exists to count.
 */
export async function insertLedgerRow(
  insert: (
    row: Record<string, unknown>,
  ) => PromiseLike<{ error: { code?: string } | null }>,
  row: LedgerRow,
): Promise<boolean> {
  const { error } = await insert(row);
  if (!error) return true;
  if (!MISSING_COLUMN_CODES.includes(error.code ?? "")) return false;

  const withoutDiagnostics: Record<string, unknown> = { ...row };
  delete withoutDiagnostics.username;
  delete withoutDiagnostics.supplier_message;
  await insert(withoutDiagnostics);
  return false;
}
