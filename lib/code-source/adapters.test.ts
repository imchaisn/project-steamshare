/**
 * Adapter classification tests.
 *
 * Every fixture below is a VERBATIM response body captured from the live
 * supplier on 2026-09-06 and recorded in local/websites/*-contract.md. They
 * are copied here rather than invented, which is the whole point: an adapter
 * tested against a guessed response shape proves nothing.
 *
 * Two fixtures are marked INFERRED — the success bodies. Neither supplier
 * could be made to emit one without performing a real Steam login, which was
 * out of scope. They are built from each site's own client-side success check,
 * and are labelled so nobody later mistakes them for captured evidence.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { classifyCyberspace } from "./cyberspace.ts";
import { classifyGamersfantasy } from "./gamersfantasy.ts";

// ── cyberspace.cyou ─────────────────────────────────────────────
// Every business outcome arrives as HTTP 200. The "404" is a JSON value.

const CY_NOT_READY =
  '{"code": "401", "msg": "Login Code not found. Please make sure the verification code has been sent and try getting it again.", "title": "CODE NOT FOUND"}';
const CY_EXPIRED =
  '{"code": "404", "msg": "Login Code expired. Please login and then submit again.", "title": "CODE TIMEOUT"}';
const CY_BAD_ORDER = '{"code": "103", "title": "ORDER ID NOT FOUND"}';
const CY_BAD_USERNAME = '{"code": "306", "title": "EMAIL/USERNAME NOT FOUND"}';
const CY_SUCCESS = '{"code": "BCDFG", "msg": "ok", "title": "SUCCESS"}'; // INFERRED

test("cyberspace: code 401 is not_ready, not a generic error", () => {
  assert.deepEqual(classifyCyberspace(200, CY_NOT_READY), {
    ok: false,
    reason: "not_ready",
  });
});

test("cyberspace: CODE TIMEOUT is expired even though HTTP status is 200", () => {
  // The regression this pins: local/sharewebsite-problem.md records this case
  // as "404", which reads like an HTTP status but is a JSON body value. An
  // adapter branching on response.status === 404 would never reach it.
  assert.deepEqual(classifyCyberspace(200, CY_EXPIRED), {
    ok: false,
    reason: "expired",
  });
});

test("cyberspace: our own bad data is supplier_error, not something the buyer can fix", () => {
  assert.deepEqual(classifyCyberspace(200, CY_BAD_ORDER), {
    ok: false,
    reason: "supplier_error",
  });
  assert.deepEqual(classifyCyberspace(200, CY_BAD_USERNAME), {
    ok: false,
    reason: "supplier_error",
  });
});

test("cyberspace: a five-character Guard code is served", () => {
  assert.deepEqual(classifyCyberspace(200, CY_SUCCESS), {
    ok: true,
    code: "BCDFG",
  });
});

test("cyberspace: a CSRF 403 is supplier_error", () => {
  assert.deepEqual(classifyCyberspace(403, "<html>CSRF failed</html>"), {
    ok: false,
    reason: "supplier_error",
  });
});

test("cyberspace: unparseable or unrecognised bodies never crash", () => {
  for (const body of ["}{ not json", "", "{}", '{"code": "9999"}', "null"]) {
    const r = classifyCyberspace(200, body);
    assert.equal(r.ok, false, `body ${JSON.stringify(body)} should not succeed`);
  }
});

test("cyberspace: an unknown numeric status is never served as a Guard code", () => {
  // "9999" is length 4, which passes the site's own `length > 3` success test.
  // Ours additionally requires the Steam Guard alphabet, so it cannot leak out
  // to a buyer as if it were a real code.
  assert.deepEqual(classifyCyberspace(200, '{"code": "9999"}'), {
    ok: false,
    reason: "supplier_error",
  });
});

// ── gamersfantasy.my ────────────────────────────────────────────

const GF_NOT_READY =
  '[{"ok":false,"steamid":"demo-ready-user","errmsg":"Steam ID: demo-ready-user - Steam Code Not Found (unavailable\\/in progress)"}]';
const GF_WRONG_USERNAME =
  '[{"ok":false,"steamid":"demo-stale-user","errmsg":"Steam ID: demo-stale-user - Steam Code Not Found"}]';
const GF_BAD_ORDER = '{"ok":false,"errmsg":"Order not found."}';
const GF_COOLDOWN = '[{"ok":true,"remainingCooldown":42}]';
const GF_SUCCESS =
  '[{"ok":true,"steamid":"demo-ready-user","steamcode":"BCDFG"}]'; // INFERRED

test("gamersfantasy: the (unavailable/in progress) suffix is not_ready", () => {
  assert.deepEqual(classifyGamersfantasy(200, GF_NOT_READY), {
    ok: false,
    reason: "not_ready",
  });
});

test("gamersfantasy: a wrong username is supplier_error, NOT not_ready", () => {
  // The direction here is deliberate and load-bearing. These two responses are
  // structurally identical and differ only by that suffix. Mapping this case
  // to not_ready would tell a buyer to "wait and retry" forever while our
  // stored username was stale — the exact state a real gamersfantasy order was
  // found in on 2026-09-06.
  assert.deepEqual(classifyGamersfantasy(200, GF_WRONG_USERNAME), {
    ok: false,
    reason: "supplier_error",
  });
});

test("gamersfantasy: a bad order id is distinguished structurally, not by string", () => {
  assert.deepEqual(classifyGamersfantasy(200, GF_BAD_ORDER), {
    ok: false,
    reason: "supplier_error",
  });
});

test("gamersfantasy: a cooldown is not_ready, because the buyer should retry", () => {
  assert.deepEqual(classifyGamersfantasy(200, GF_COOLDOWN), {
    ok: false,
    reason: "not_ready",
  });
});

test("gamersfantasy: a five-character Guard code is served", () => {
  assert.deepEqual(classifyGamersfantasy(200, GF_SUCCESS), {
    ok: true,
    code: "BCDFG",
  });
});

test("gamersfantasy: a missing X-Requested-With 403 is supplier_error", () => {
  assert.deepEqual(classifyGamersfantasy(403, ""), {
    ok: false,
    reason: "supplier_error",
  });
});

test("gamersfantasy: unparseable or unrecognised bodies never crash", () => {
  for (const body of ["}{ not json", "", "[]", "[null]", '[{"ok":true}]']) {
    const r = classifyGamersfantasy(200, body);
    assert.equal(r.ok, false, `body ${JSON.stringify(body)} should not succeed`);
  }
});

// Captured live from cyberspace.cyou, 2026-09-06, on a real order whose
// redemption cap had been spent. Verbatim.
const CY_LIMIT =
  '{"code": "305", "msg": "The number of times you can get the login code has reached the limit. Please contact us for reset.", "title": "REACHED LIMIT"}';

test("cyberspace: REACHED LIMIT is its own outcome, not a generic error", () => {
  // This falsified the assumption the whole feature was designed on — that a
  // redemption could be pulled an unlimited number of times. It cannot. The
  // cap is per order id, and only a reset on their side clears it, so the
  // buyer must not be told to wait and retry.
  assert.deepEqual(classifyCyberspace(200, CY_LIMIT), {
    ok: false,
    reason: "limit_reached",
  });
});
