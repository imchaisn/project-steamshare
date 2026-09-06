import { test } from "node:test";
import assert from "node:assert/strict";
import { isMissingOrderGames } from "./order-games-compat.ts";

/*
 * This predicate decides whether to SILENTLY DEGRADE to one game per order.
 * Both directions of a wrong answer are bad, and asymmetrically so:
 *
 *   too NARROW -> the pre-0014 deploy answers "order not found" to every
 *                 live buyer, which is a total outage.
 *   too BROAD  -> a real database fault (permissions, a constraint, a dropped
 *                 connection) is mistaken for "the migration has not run yet",
 *                 and a buyer who paid for four games is quietly handed one
 *                 with no error anywhere.
 *
 * The second is the one that hides. These tests pin it.
 */

test("matches Postgres undefined_table (42P01)", () => {
  assert.equal(isMissingOrderGames({ code: "42P01", message: 'relation "order_games" does not exist' }), true);
});

test("matches PostgREST's schema-cache miss (PGRST205)", () => {
  // What a READ usually returns first, before Postgres is even reached.
  assert.equal(
    isMissingOrderGames({
      code: "PGRST205",
      message: "Could not find the table 'public.order_games' in the schema cache",
    }),
    true,
  );
});

test("matches a message-only schema-cache miss with no code", () => {
  assert.equal(
    isMissingOrderGames({ message: "Could not find the table 'public.order_games' in the schema cache" }),
    true,
  );
});

test("does NOT match a permission error on the same table", () => {
  // The dangerous case: RLS or a revoked grant. Degrading here would serve
  // one game of four and log nothing that looks wrong.
  assert.equal(
    isMissingOrderGames({ code: "42501", message: "permission denied for table order_games" }),
    false,
  );
});

test("does NOT match a constraint violation on the same table", () => {
  assert.equal(
    isMissingOrderGames({
      code: "23514",
      message: 'new row for relation "order_games" violates check constraint "order_games_supplier_mapping_shape"',
    }),
    false,
  );
});

test("does NOT match a connection failure", () => {
  assert.equal(isMissingOrderGames({ message: "fetch failed" }), false);
  assert.equal(isMissingOrderGames({ code: "ECONNREFUSED", message: "connect ECONNREFUSED" }), false);
});

test("does NOT match a DIFFERENT table being missing", () => {
  // A missing `orders` table is a catastrophe, not a reason to serve one game.
  assert.equal(
    isMissingOrderGames({ message: 'relation "orders" does not exist' }),
    false,
    "only order_games may trigger the fallback when there is no 42P01 code",
  );
});

test("handles null, undefined and non-objects without throwing", () => {
  for (const junk of [null, undefined, "42P01", 42, true, []]) {
    assert.equal(isMissingOrderGames(junk), false, `${JSON.stringify(junk)} must not trigger the fallback`);
  }
});

test("an empty error object does not trigger the fallback", () => {
  assert.equal(isMissingOrderGames({}), false);
});

test("is case-insensitive on the message", () => {
  assert.equal(
    isMissingOrderGames({ message: 'Relation "ORDER_GAMES" Does Not Exist' }),
    true,
  );
});
