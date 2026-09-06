/**
 * seed-bulk-test-order.mjs — build ONE test order that carries SEVERAL games.
 *
 * This is the fixture for the multi-game work (migration 0014). Shopee splits
 * a cart by SHOP, not by item, so four games bought in one checkout arrive as
 * one order_sn with four entries in item_list — and until 0014 the pipeline
 * kept only the first and silently discarded the rest. There was no order in
 * the database shaped like that to test against, so this makes one.
 *
 * ── IT CONTAINS NO CREDENTIALS, AND THAT IS LOAD-BEARING ──────────────────
 * THE REPO IS PUBLIC, and since 2026-09-06 `/api/lookup` needs ONLY an order
 * id — the username check was dropped (CHECKPOINT.md, "Buyer lookup — now
 * ORDER-ID-ONLY"). So an order id written into a tracked file IS a working
 * credential: it returns that account's password and a live Steam Guard code.
 * That is CHECKPOINT.md open item 0, whose own fix list says to change the
 * test-order-id convention so it is not derivable and not published. This
 * script must not extend that leak.
 *
 * Therefore NOTHING real is hardcoded here. The order id and the account
 * usernames are REQUIRED ARGUMENTS with no defaults — the same discipline
 * setup-supplier-test-order.mjs follows by reading its values from a
 * gitignored file. The real invocation lives in `local/BULK-TEST-ORDER.md`.
 *
 * It also invents nothing: every account, game and supplier mapping is COPIED
 * from rows already in the database. It creates no Steam accounts and stores
 * no new credentials — it only re-points existing ones at a new order.
 *
 * ⚠ SHARED REDEMPTION BUDGET. When a game copies its mapping from an existing
 * order, pressing Get Code on that card spends a redemption against the SAME
 * supplier order, and those cap at roughly 5-6 before `305 REACHED LIMIT`
 * (see local/websites/NEEDS-RESET.md — two orders are already exhausted).
 * TOTP-backed games cost nothing and can be tested freely. Point a game at a
 * dedicated supplier order if you would rather not share the budget.
 *
 * Writes through PostgREST with the service-role key, matching
 * scripts/setup-supplier-test-order.mjs — the direct DB password is stale
 * (Postgres 28P01, CHECKPOINT open item 1).
 *
 * REQUIRES MIGRATION 0014. Without it the order_games insert fails with 42P01
 * and the script aborts telling you so, rather than leaving a half-built
 * order behind.
 *
 * Usage (real values are in local/BULK-TEST-ORDER.md, gitignored):
 *   node --env-file=.env.local scripts/seed-bulk-test-order.mjs \
 *        --order-id <id> --accounts <user1,user2,user3:srcOrder,user4:srcOrder>
 *
 * --accounts is a comma-separated list of Steam usernames IN DISPLAY ORDER.
 * Append `:<an existing order id>` to copy that order's supplier mapping onto
 * the game; a bare username uses the account's own default (the TOTP path).
 *
 * Add --dry-run to resolve and print without writing anything.
 *
 * Env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

const args = process.argv.slice(2);
const flag = (name, fallback = null) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? fallback : args[i + 1];
};
const DRY = args.includes("--dry-run");

const ORDER_ID = flag("order-id");
const ACCOUNTS_ARG = flag("accounts");
const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "");
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

if (!ORDER_ID || !ACCOUNTS_ARG) {
  console.error(
    "\n❌  --order-id and --accounts are both required, and neither has a default.\n\n" +
      "   That is deliberate. The repo is PUBLIC, and /api/lookup needs only an order\n" +
      "   id since 2026-09-06 — so an order id committed here would hand anyone the\n" +
      "   password and a live Guard code for every account on it (open item 0).\n\n" +
      "   The real invocation is in local/BULK-TEST-ORDER.md (gitignored).\n\n" +
      "   node --env-file=.env.local scripts/seed-bulk-test-order.mjs \\\n" +
      "        --order-id <id> --accounts <user1,user2,user3:srcOrder>\n",
  );
  process.exit(1);
}

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error(
    "\n❌  NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.\n" +
      "   Run with:  node --env-file=.env.local scripts/seed-bulk-test-order.mjs ...\n",
  );
  process.exit(1);
}

const headers = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  "Content-Type": "application/json",
  Prefer: "return=representation",
};
const rest = (table) => `${SUPABASE_URL}/rest/v1/${table}`;

async function get(path) {
  const res = await fetch(`${rest(path)}`, { headers });
  if (!res.ok) throw new Error(`GET ${path}: ${await res.text()}`);
  return res.json();
}

/**
 * The games, parsed from --accounts, in display order.
 *
 * `supplierFrom` names an EXISTING order whose mapping this game copies, so
 * this script never has to hold a supplier order id itself.
 *
 * Keyed on username rather than game title because usernames are unique in
 * `steam_accounts` while a title can legitimately be held by several accounts
 * (Black Myth: Wukong has six).
 */
const PLAN = ACCOUNTS_ARG.split(",")
  .map((entry) => entry.trim())
  .filter(Boolean)
  .map((entry) => {
    const [username, supplierFrom] = entry.split(":").map((v) => v.trim());
    return { username, supplierFrom: supplierFrom || null };
  });

if (PLAN.length === 0) {
  console.error("\n❌  --accounts resolved to no usernames.\n");
  process.exit(1);
}

console.log(`\nBuilding multi-game test order: ${ORDER_ID}\n`);

// ── Resolve each account -> its account_games row -> its game title ────────
const lines = [];
for (const entry of PLAN) {
  const accounts = await get(
    `steam_accounts?select=id,username,status&username=eq.${encodeURIComponent(entry.username)}`,
  );
  if (!accounts.length) {
    console.error(
      `\n❌  No steam_accounts row for "${entry.username}".\n` +
        `   This script only re-points accounts that already exist — it does not create them.\n`,
    );
    process.exit(1);
  }
  const account = accounts[0];

  const accountGames = await get(
    `account_games?select=id,game_id&account_id=eq.${account.id}`,
  );
  if (!accountGames.length) {
    console.error(
      `\n❌  Account "${entry.username}" owns no games (no account_games row).\n`,
    );
    process.exit(1);
  }
  const accountGame = accountGames[0];
  const games = await get(`games?select=title&id=eq.${accountGame.game_id}`);
  const title = games[0]?.title ?? "(unknown game)";

  // Copy the supplier mapping from an existing order, so this script never
  // has to know or hold a supplier order id itself.
  let supplierSite = null;
  let supplierOrderId = null;
  if (entry.supplierFrom) {
    const source = await get(
      `orders?select=supplier_site,supplier_order_id&shopee_order_id=eq.${encodeURIComponent(entry.supplierFrom)}`,
    );
    if (!source.length || !source[0].supplier_order_id) {
      console.error(
        `\n❌  Order "${entry.supplierFrom}" has no supplier mapping to copy for ` +
          `"${entry.username}".\n   Point at a different order, or map it first.\n`,
      );
      process.exit(1);
    }
    supplierSite = source[0].supplier_site;
    supplierOrderId = source[0].supplier_order_id;
  }

  lines.push({
    ...entry,
    accountGameId: accountGame.id,
    title,
    status: account.status,
    supplierSite,
    supplierOrderId,
  });

  const warn = account.status === "active" ? "" : `  ⚠ account is ${account.status}`;
  // The supplier ORDER ID is never printed — only which site it points at.
  console.log(
    `  ${String(lines.length).padStart(2)}. ${title}\n` +
      `      ${supplierSite ?? "ours (TOTP)"}${warn}`,
  );
}

if (DRY) {
  console.log(`\n--dry-run: nothing written.\n`);
  process.exit(0);
}

// ── The order row ─────────────────────────────────────────────────────────
// account_game_id is THE LEGACY MIRROR (see 0014_order_games.sql): the first
// game only, for the admin panel. order_games below is authoritative.
//
// source stays 'manual' (the column default) on purpose. deliverGameOnce()
// refuses to auto-message a non-automated order, which is exactly right for a
// test fixture — seeding this must never send a real buyer a chat message.
const existing = await get(
  `orders?select=id&shopee_order_id=eq.${encodeURIComponent(ORDER_ID)}`,
);

let orderRowId;
if (existing.length) {
  orderRowId = existing[0].id;
  const res = await fetch(`${rest("orders")}?id=eq.${orderRowId}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({
      account_game_id: lines[0].accountGameId,
      verified: true,
      supplier_site: lines[0].supplierSite,
      supplier_order_id: lines[0].supplierOrderId,
    }),
  });
  if (!res.ok) throw new Error(`orders update: ${await res.text()}`);

  // Idempotent: rebuild the game lines from scratch rather than trying to
  // reconcile them. This is a TEST fixture, so discarding its rows is safe —
  // never do this to an order a real buyer holds.
  const del = await fetch(`${rest("order_games")}?order_id=eq.${orderRowId}`, {
    method: "DELETE",
    headers,
  });
  if (!del.ok) throw new Error(`order_games delete: ${await del.text()}`);
  console.log(`\n  reusing existing order row, game lines rebuilt`);
} else {
  const res = await fetch(rest("orders"), {
    method: "POST",
    headers,
    body: JSON.stringify({
      shopee_order_id: ORDER_ID,
      shopee_buyer_id: "bulk-test",
      account_game_id: lines[0].accountGameId,
      verified: true,
      supplier_site: lines[0].supplierSite,
      supplier_order_id: lines[0].supplierOrderId,
    }),
  });
  if (!res.ok) throw new Error(`orders insert: ${await res.text()}`);
  orderRowId = (await res.json())[0].id;
  console.log(`\n  order row created`);
}

// ── The game lines ────────────────────────────────────────────────────────
const gamesRes = await fetch(rest("order_games"), {
  method: "POST",
  headers,
  body: JSON.stringify(
    lines.map((line, index) => ({
      order_id: orderRowId,
      account_game_id: line.accountGameId,
      supplier_site: line.supplierSite,
      supplier_order_id: line.supplierOrderId,
      position: index,
    })),
  ),
});

if (!gamesRes.ok) {
  const body = await gamesRes.text();
  console.error(`\n❌  order_games insert failed: ${body}\n`);
  if (/order_games|42P01|schema cache/.test(body)) {
    console.error(
      "   That table does not exist yet. Apply supabase/migrations/0014_order_games.sql\n" +
        "   (Supabase dashboard → SQL editor — run-migrations.mjs cannot connect,\n" +
        "    the DB password is stale, open item 1), then re-run this.\n",
    );
  }
  process.exit(1);
}

console.log(`  ${lines.length} game lines written\n`);
console.log(
  `Done. Expect ${lines.length} cards at https://www.gameshare.space — each with its own\n` +
    `title, username, password and Get Code button.\n\n` +
    `TOTP games return a code instantly and spend nothing. Any game copying its\n` +
    `mapping from another order shares that order's ~5-6 redemption budget —\n` +
    `see local/websites/NEEDS-RESET.md before hammering those.\n`,
);
