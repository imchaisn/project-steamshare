/**
 * zoho-auth.mjs
 * One-time Zoho OAuth setup: trade a self-client grant code for a refresh
 * token, and write that token into .env.local.
 *
 * Usage:
 *
 *   node --env-file=.env.local scripts/zoho-auth.mjs
 *       Reads ZOHO_DC, ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET and ZOHO_GRANT_CODE
 *       from .env.local, exchanges the code, and writes ZOHO_REFRESH_TOKEN back
 *       into the same file. Run once. After that the refresh token is permanent
 *       and scripts/zoho-mail.mjs mints its own hourly access tokens from it.
 *
 * Get the grant code at api-console.zoho.com -> your Self Client -> Generate
 * Code, with these scopes:
 *
 *   ZohoMail.organization.accounts.ALL,ZohoMail.organization.READ,ZohoMail.accounts.READ
 *
 * ── WHY THIS EXISTS RATHER THAN A CURL ONE-LINER ────────────────────────────
 * The equivalent curl is four -d flags and works fine on a POSIX shell. On
 * Windows it is a trap: PowerShell 5.1 aliases `curl` to Invoke-WebRequest,
 * which takes completely different flags, and the usual bash `\` line
 * continuations are a parse error there. Both failures surface as opaque
 * argument errors, not as "you used the wrong curl".
 *
 * The real reason though is the clock. A grant code expires 3-10 minutes after
 * you generate it, so every minute lost to shell quoting is a minute of a
 * budget that ends with you going back to the API console to make a new code.
 * Reading the values from a file removes the quoting problem entirely.
 *
 * ── WHY IT WRITES THE TOKEN TO DISK ITSELF ──────────────────────────────────
 * The response is one long line of JSON with the refresh token buried in it.
 * Hand-copying it invites a truncated paste, which fails later at the first
 * real API call with `invalid_client` — an error that points at the client
 * secret, not at the token you actually mangled. Patching the file directly
 * means the value that gets stored is exactly the value Zoho returned.
 *
 * .env* is gitignored, so nothing here is at risk of being committed.
 */

import { readFileSync, writeFileSync } from "node:fs";

const ENV_PATH = ".env.local";

// Zoho is a per-region service: an org lives in exactly one data center and its
// tokens are worthless against any other. The accounts host below must match
// the one the org was created in, which is the domain you log into Zoho Mail
// with. A mismatch returns `invalid_client`, which reads as a bad secret and
// sends you looking in the wrong place, so validate the DC up front.
const ACCOUNTS_HOST = {
  com: "accounts.zoho.com",
  eu: "accounts.zoho.eu",
  in: "accounts.zoho.in",
  "com.au": "accounts.zoho.com.au",
  jp: "accounts.zoho.jp",
  ca: "accounts.zohocloud.ca",
  sa: "accounts.zoho.sa",
};

const {
  ZOHO_DC = "com",
  ZOHO_CLIENT_ID,
  ZOHO_CLIENT_SECRET,
  ZOHO_GRANT_CODE,
} = process.env;

const missing = Object.entries({
  ZOHO_CLIENT_ID,
  ZOHO_CLIENT_SECRET,
  ZOHO_GRANT_CODE,
})
  .filter(([, v]) => !v)
  .map(([k]) => k);

if (missing.length) {
  console.error(`\nMissing env var(s): ${missing.join(", ")}`);
  console.error(`Add them to ${ENV_PATH}, then run:`);
  console.error(`  node --env-file=${ENV_PATH} scripts/zoho-auth.mjs\n`);
  process.exit(1);
}

const host = ACCOUNTS_HOST[ZOHO_DC];
if (!host) {
  console.error(`\nZOHO_DC=${ZOHO_DC} is not a Zoho data center.`);
  console.error(`Use one of: ${Object.keys(ACCOUNTS_HOST).join(", ")}`);
  console.error(`It is the domain you log into Zoho Mail with.\n`);
  process.exit(1);
}

const res = await fetch(`https://${host}/oauth/v2/token`, {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({
    grant_type: "authorization_code",
    client_id: ZOHO_CLIENT_ID,
    client_secret: ZOHO_CLIENT_SECRET,
    code: ZOHO_GRANT_CODE,
  }),
});

const body = await res.json().catch(() => null);

// Zoho answers a rejected exchange with HTTP 200 and an {error: "..."} body,
// so res.ok proves nothing on its own. Check for the token itself.
if (!body?.refresh_token) {
  console.error(`\nToken exchange failed (HTTP ${res.status}).`);
  console.error(JSON.stringify(body, null, 2));

  const hint = {
    invalid_code:
      "The grant code expired or was already used. Codes are single-use and " +
      "last 3-10 minutes. Generate a fresh one and re-run within the window.",
    invalid_client:
      `Wrong client credentials, or wrong data center. You used ${host} — ` +
      "confirm that matches the domain you log into Zoho Mail with.",
    invalid_scope:
      "The scopes on the grant code do not cover this request. Regenerate " +
      "the code with the scope list at the top of this file.",
  }[body?.error];

  if (hint) console.error(`\n${hint}`);
  console.error("");
  process.exit(1);
}

// Patch .env.local in place: fill in ZOHO_REFRESH_TOKEN and blank the grant
// code, which is single-use and now spent — leaving it behind would make a
// re-run fail with `invalid_code` and look like a token problem.
let env = readFileSync(ENV_PATH, "utf8");

const setKey = (text, key, value) =>
  new RegExp(`^${key}=.*$`, "m").test(text)
    ? text.replace(new RegExp(`^${key}=.*$`, "m"), `${key}=${value}`)
    : `${text.replace(/\s*$/, "")}\n${key}=${value}\n`;

env = setKey(env, "ZOHO_REFRESH_TOKEN", body.refresh_token);
env = setKey(env, "ZOHO_GRANT_CODE", "");

writeFileSync(ENV_PATH, env);

const masked = `${body.refresh_token.slice(0, 12)}...${body.refresh_token.slice(-4)}`;
console.log(`\n✅ Refresh token stored in ${ENV_PATH}`);
console.log(`   ZOHO_REFRESH_TOKEN=${masked}`);
console.log(`   Access token valid ${body.expires_in}s; refresh token does not expire.`);
console.log(`   Revoke at https://${host}/ → Security → OAuth → Connected Apps.\n`);
console.log(`Next: scripts/zoho-mail.mjs (mailbox create/list) — ask Claude to build it.\n`);
