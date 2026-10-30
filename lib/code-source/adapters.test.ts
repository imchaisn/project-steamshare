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
import { classifyCyberspace, describeCyberspaceFailure } from "./cyberspace.ts";
import {
  classifyGamersfantasy,
  describeGamersfantasyFailure,
  gamersfantasyFetch,
  parsePrechkorderAccount,
  retryWhileNotReady,
} from "./gamersfantasy.ts";
import type { CodeResult } from "./types.ts";

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

// ── gamersfantasy.my: prechkorder resolution ───────────────────────
// Added 2026-09-06 alongside resolve-before-fetch (see RESOLVE-FIRST in
// gamersfantasy.ts): the same order id was observed returning four different
// usernames in one day, so every code fetch now resolves the current account
// via this response shape instead of trusting a stored value. Fixture shape
// matches a real captured response; the username/password themselves are
// placeholders, not real credentials — this repo is public.
const PRECHK_SUCCESS =
  '{"ok":true,"title":"<h3>Your Order Information<\\/h3>","itemslist":[{"uid":"1:1","oid":1,"img":"","qty":1,"name":"[PLAY NOW] Demo Game | Own Steam Account, Offline Mode","varname":"Offline Account","inputtag":false,"itemsdataresult":{"content":{"ok":["ID: demoplayer42 PASS: DemoPass!42"]},"instruct":["Steam Account Details Above"]}}]}';
const PRECHK_ORDER_NOT_FOUND = '{"ok":false,"errmsg":"Order not found."}';
const PRECHK_NO_ITEMS = '{"ok":true,"title":"<h3>Your Order Information<\\/h3>","itemslist":[]}';
const PRECHK_MALFORMED_LINE =
  '{"ok":true,"itemslist":[{"name":"Demo Game","itemsdataresult":{"content":{"ok":["Account details pending"]}}}]}';

test("prechkorder: extracts username AND password from a well-formed success body", () => {
  assert.deepEqual(parsePrechkorderAccount(PRECHK_SUCCESS), {
    username: "demoplayer42",
    password: "DemoPass!42",
  });
});

test("prechkorder: an order-not-found body resolves to null, not a crash", () => {
  assert.equal(parsePrechkorderAccount(PRECHK_ORDER_NOT_FOUND), null);
});

test("prechkorder: an empty item list resolves to null", () => {
  assert.equal(parsePrechkorderAccount(PRECHK_NO_ITEMS), null);
});

test("prechkorder: a line that doesn't match the ID/PASS shape resolves to null", () => {
  assert.equal(parsePrechkorderAccount(PRECHK_MALFORMED_LINE), null);
});

test("prechkorder: unparseable JSON resolves to null, never throws", () => {
  for (const body of ["not json", "", "null", "[]"]) {
    assert.equal(parsePrechkorderAccount(body), null, `body ${JSON.stringify(body)}`);
  }
});

// ── retryWhileNotReady: patience, bounded by real quota ────────────────────
//
// Chaison asked for the code fetch to keep trying for ~15s rather than give up
// on the first "not ready". The cost that shapes these tests: every attempt is
// a real request against an order id capped at roughly 5-6 redemptions before
// it locks out until a manual reset. So what is pinned here is not just "does
// it retry" but "does it retry a SMALL, BOUNDED number of times".
//
// A fake clock and a fake sleep keep these instant and deterministic — a real
// 15s wait in a test suite is its own kind of bug.
function fakeClock() {
  let t = 0;
  return {
    nowFn: () => t,
    sleepFn: async (ms: number) => {
      t += ms;
    },
  };
}

const NOT_READY: CodeResult = { ok: false, reason: "not_ready" };

test("retry: a code available immediately costs exactly one request", async () => {
  const clock = fakeClock();
  let calls = 0;
  const r = await retryWhileNotReady(
    async () => {
      calls++;
      return { ok: true, code: "BCDFG" };
    },
    { budgetMs: 15000, intervalMs: 5000, ...clock },
  );
  assert.deepEqual(r, { ok: true, code: "BCDFG" });
  assert.equal(calls, 1);
});

test("retry: keeps trying while not ready, and returns the code when it lands", async () => {
  const clock = fakeClock();
  let calls = 0;
  const r = await retryWhileNotReady(
    async () => {
      calls++;
      return calls < 3 ? NOT_READY : { ok: true, code: "BCDFG" };
    },
    { budgetMs: 15000, intervalMs: 5000, ...clock },
  );
  assert.deepEqual(r, { ok: true, code: "BCDFG" });
  assert.equal(calls, 3);
});

test("retry: the default pace spends FOUR requests at most across the budget", async () => {
  // THE QUOTA GUARD. 15s at 5s apart is four attempts (t=0, 5, 10, 15). A
  // one-second interval would be sixteen and could exhaust an entire order's
  // ~5-6 redemptions on a single button press — which is exactly how a real
  // saleable order was burned on 2026-09-06.
  const clock = fakeClock();
  let calls = 0;
  const r = await retryWhileNotReady(
    async () => {
      calls++;
      return NOT_READY;
    },
    { budgetMs: 15000, intervalMs: 5000, ...clock },
  );
  assert.deepEqual(r, NOT_READY, "giving up must report not_ready, not an error");
  assert.ok(calls <= 4, `spent ${calls} requests against a ~5-6 redemption cap`);
});

test("retry: a supplier_error is returned at once, never retried", async () => {
  // Asking again the same way spends another redemption to be told the same
  // thing. Only not_ready is a "come back in a moment" state.
  const clock = fakeClock();
  let calls = 0;
  const r = await retryWhileNotReady(
    async () => {
      calls++;
      return { ok: false, reason: "supplier_error" };
    },
    { budgetMs: 15000, intervalMs: 5000, ...clock },
  );
  assert.deepEqual(r, { ok: false, reason: "supplier_error" });
  assert.equal(calls, 1);
});

test("retry: a zero budget still makes exactly one attempt", async () => {
  // Turning the retry window off must not turn the fetch off with it.
  const clock = fakeClock();
  let calls = 0;
  await retryWhileNotReady(
    async () => {
      calls++;
      return NOT_READY;
    },
    { budgetMs: 0, intervalMs: 5000, ...clock },
  );
  assert.equal(calls, 1);
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

// ── What a failure records ──────────────────────────────────────
// These strings end up in supplier_code_log.supplier_message. The bodies are
// the verbatim captures above and in the contract files, except where marked.

const GF_WRONG_USERNAME_FOR_DESCRIBE =
  '[{"ok":false,"steamid":"evilfantasynine2","errmsg":"Steam ID: evilfantasynine2 - Steam Code Not Found"}]';

test("gamersfantasy description: keeps the site's own errmsg", () => {
  assert.equal(
    describeGamersfantasyFailure(200, GF_WRONG_USERNAME_FOR_DESCRIBE),
    "Steam ID: evilfantasynine2 - Steam Code Not Found",
  );
});

test("gamersfantasy description: a bare-object rejection keeps its errmsg", () => {
  assert.equal(
    describeGamersfantasyFailure(200, '{"ok":false,"errmsg":"Order not found."}'),
    "Order not found.",
  );
});

test("gamersfantasy description: REACHED LIMIT is visible rather than generic", () => {
  // INFERRED for this site: the body is the one captured live from cyberspace.
  // Whether gamersfantasy replies in the same shape is unconfirmed.
  assert.equal(
    describeGamersfantasyFailure(200, '{"code":"305","title":"REACHED LIMIT"}'),
    "305 REACHED LIMIT",
  );
});

test("gamersfantasy description: a non-2xx reports the status", () => {
  assert.equal(describeGamersfantasyFailure(403, ""), "HTTP 403");
});

test("gamersfantasy description: an unparseable body is described, never copied", () => {
  const description = describeGamersfantasyFailure(200, "<html>SECRET-PAGE</html>");
  assert.equal(description, "unparseable body (24 chars)");
});

test("gamersfantasy description: a malformed code is never written to the log", () => {
  const description = describeGamersfantasyFailure(
    200,
    '[{"ok":true,"steamcode":"AAAAAAA"}]',
  );
  assert.ok(!description.includes("AAAAAAA"));
  assert.equal(description, "ok:true with no usable code");
});

test("gamersfantasy description: long vendor copy is capped", () => {
  const description = describeGamersfantasyFailure(
    200,
    JSON.stringify([{ ok: false, errmsg: "x".repeat(1000) }]),
  );
  assert.equal(description.length, 200);
});

test("cyberspace description: keeps the error code and title", () => {
  assert.equal(describeCyberspaceFailure(200, CY_BAD_USERNAME), "306 EMAIL/USERNAME NOT FOUND");
});

test("cyberspace description: a malformed code is never written to the log", () => {
  const description = describeCyberspaceFailure(200, '{"code": "AAAAAAA", "title": "?"}');
  assert.ok(!description.includes("AAAAAAA"));
});

async function withStubbedFetch<T>(
  stub: typeof fetch,
  run: () => Promise<T>,
): Promise<T> {
  const realFetch = globalThis.fetch;
  const realBudget = process.env.SUPPLIER_RETRY_BUDGET_MS;
  globalThis.fetch = stub;
  process.env.SUPPLIER_RETRY_BUDGET_MS = "0";
  try {
    return await run();
  } finally {
    globalThis.fetch = realFetch;
    if (realBudget === undefined) delete process.env.SUPPLIER_RETRY_BUDGET_MS;
    else process.env.SUPPLIER_RETRY_BUDGET_MS = realBudget;
  }
}

const FETCH_ARGS = {
  orderId: "ORDER",
  username: "pooluser",
  signal: new AbortController().signal,
};

test("gamersfantasy fetch: a failure carries the site's message", async () => {
  const result = await withStubbedFetch(
    (async () => new Response(GF_WRONG_USERNAME_FOR_DESCRIBE)) as typeof fetch,
    () => gamersfantasyFetch(FETCH_ARGS),
  );

  assert.deepEqual(result, {
    ok: false,
    reason: "supplier_error",
    detail: "Steam ID: evilfantasynine2 - Steam Code Not Found",
  });
});

test("gamersfantasy fetch: our own timeout is told apart from a supplier reply", async () => {
  // The case the generic supplier_error hid: the 20 s abort firing inside the
  // not-ready retry window reads to the buyer exactly like a supplier outage.
  const result = await withStubbedFetch(
    (async () => {
      throw new DOMException("The operation timed out.", "TimeoutError");
    }) as typeof fetch,
    () => gamersfantasyFetch(FETCH_ARGS),
  );

  assert.deepEqual(result, {
    ok: false,
    reason: "supplier_error",
    detail: "request failed: TimeoutError",
  });
});

test("gamersfantasy fetch: a served code carries no detail", async () => {
  const result = await withStubbedFetch(
    (async () => new Response('[{"ok":true,"steamcode":"BCDFG"}]')) as typeof fetch,
    () => gamersfantasyFetch(FETCH_ARGS),
  );

  assert.deepEqual(result, { ok: true, code: "BCDFG" });
});
