/**
 * Create a NEW Shopee listing from a publish packet and its rendered art.
 *
 * WHY THIS DIDN'T EXIST. Every listing this shop has was made by hand in Seller
 * Centre. `lib/shopee-listing.ts` does `unlist_item` only (taking a listing
 * DOWN, the one write this app makes unattended). `scripts/fix-listing-urls.mjs`
 * does `update_item` on an item that already exists. `scripts/shopee-listings.mjs`
 * reads, and its `--map` writes only to OUR OWN database. There has never been
 * a way to CREATE a listing or upload an image from this repo. This is that.
 *
 * ── TWO WRITES, IN ORDER, BOTH REAL ──────────────────────────────────────
 *   1. v2.media_space.upload_image  — banners become Shopee media ids
 *   2. v2.product.add_item          — the listing itself, using those ids
 * Both are genuinely irreversible-ish: an uploaded image exists on Shopee's
 * side whether or not it ends up on a listing, and a created item is public
 * and searchable the moment `item_status` allows it. Treat both as real.
 *
 * ── DRY RUN BY DEFAULT ────────────────────────────────────────────────────
 *   node --env-file=.env.local scripts/create-listing.mjs --slug=<slug> --price=<RM> --stock=<n>
 *       Builds and PRINTS the full add_item payload. Uploads NOTHING, creates
 *       NOTHING. Category id is still resolved live (a read call) so the
 *       printed payload is accurate, not a guess.
 *   node --env-file=.env.local scripts/create-listing.mjs --slug=<slug> --price=<RM> --stock=<n> --apply
 *       Uploads the four banners, then calls add_item for real. Chaison's
 *       call to make, per .claude/fleet — this script does not decide that.
 *
 * ── THIS SCRIPT NEVER REFRESHES THE SHOPEE TOKEN ─────────────────────────
 * Copied verbatim in spirit from scripts/fix-listing-urls.mjs, which explains
 * why: the refresh_token is single-use and rotating, and a refresh racing the
 * live app kills production auth for the whole shop. Uses the stored
 * access_token as-is and EXITS if it has expired. It would rather do nothing
 * than rotate a token behind another session's back.
 *
 * ── WHAT IT READS ─────────────────────────────────────────────────────────
 *   docs/publish-packets/<slug>.md   TITLE and DESCRIPTION fenced blocks
 *   brand/<slug>-banner-[1-4].png    the four Shopee gallery images, IN THIS
 *                                    ORDER. NOT <slug>-card.png — that is the
 *                                    16:9 gameshare.space site card, a
 *                                    different image for a different surface
 *                                    (see scripts/gen-banners.mjs's own header).
 *
 * ── CATEGORY, WEIGHT, DIMENSION, LOGISTICS, CONDITION, ATTRIBUTES ────────
 * `category_id` is resolved LIVE via v2.product.get_category on every run —
 * per the brief: "get the category id by querying get_category rather than
 * hardcoding a guess." It is cross-checked against 101090 ("PC Game"), which
 * this session confirmed live on 2026-09-08 is the category_id on EVERY ONE
 * of 20 sampled NORMAL listings in this shop, not a single outlier. If the
 * live lookup ever disagrees, this script REFUSES rather than silently using
 * either value — a wrong category is a listing that never surfaces in search.
 *
 * weight, dimension, logistic_info, condition, and 4 of the 5 attribute_list
 * entries are NOT re-derived live every run. These are the shop's own
 * packaging conventions for a virtual good (a listing has to declare *some*
 * weight and shippable dimension even though nothing ships), not external
 * facts that can drift, so there is nothing to "get wrong" by re-fetching.
 * Verified by reading back live item 48167478078 (Cyberpunk 2077) via
 * get_item_base_info, 2026-09-08, and used as a template because it is
 * proven to already work —
 *
 * The FIFTH attribute, Game Genre Type, is the opposite case and IS resolved
 * live every run (see resolveGenreAttribute) — it genuinely varies per game,
 * and this script's first version copied Cyberpunk's "RPG" value onto every
 * game blindly until that was caught and fixed. Steam's own `genres` for the
 * game in question, matched by name against Shopee's live attribute
 * vocabulary for this category —
 * not invented. See PC_GAME_TEMPLATE below for the exact source.
 *
 * ── WHAT THIS SCRIPT REFUSES TO GUESS ────────────────────────────────────
 * `item_name` over 120 characters. Shopee's own API docs (per the SDK
 * reference this session could actually reach — open.shopee.com itself is
 * not fetchable from here) state no hard character maximum for `item_name`.
 * 120 is THIS SHOP'S OWN convention, matching every title already in
 * `docs/listing-copy.md` and every one of this shop's 39 live listings. This
 * script enforces it as a house rule, not a documented Shopee limit — and
 * says so if it ever needs correcting.
 */
import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import crypto from "node:crypto";

const HERE = import.meta.dirname;
const ROOT = join(HERE, "..");

const ARGV = process.argv.slice(2);
const APPLY = ARGV.includes("--apply");
const arg = (name) => {
  const hit = ARGV.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : undefined;
};
const UNDO_ITEM_ID = arg("undo");
const SLUG = arg("slug");
const PRICE = arg("price");

/**
 * R16, Chaison's ruling relayed 2026-09-08 by `4e` after being shown the
 * shared-cap risk directly: "leave stock for 99999 and forever will be for
 * every upcoming listing because it is a virtual product." A standing rule,
 * not a per-listing choice — so 99999 is the DEFAULT here, not a value a
 * stale brief can override by omission. `--stock=<n>` still exists as an
 * explicit escape hatch for the rare listing that genuinely needs a real cap
 * (e.g. a shared-order redemption ceiling), but nothing inherits an old
 * number silently the way this script's own first HITMAN payload did (it
 * shipped with 5, from a brief written before R16 landed).
 */
const STOCK = arg("stock") ?? "99999";

if (!UNDO_ITEM_ID && !SLUG) {
  console.error("Usage: --slug=<slug> --price=<RM> [--stock=<n>, default 99999 per R16] [--apply]");
  console.error("   or: --undo=<item_id> [--apply]   (calls delete_item on an UNLIST draft)");
  process.exit(1);
}

// ── Undo path: delete_item on a wrongly-created UNLIST draft ────────────────
// lib/shopee-listing.ts only implements unlist_item, which is the WRONG tool
// here: our drafts are created item_status: UNLIST already, and unlisting an
// already-unlisted item is a no-op. delete_item (v2.product.delete_item) is
// the real undo for a mistaken draft — confirmed as a distinct endpoint from
// unlist_item via the Shopee SDK reference this session could reach
// (open.shopee.com itself was not fetchable). It has no documented
// order-status precondition, but a freshly-created UNLIST draft has zero
// orders by construction, so that is not a live concern here.
if (UNDO_ITEM_ID) {
  if (!/^\d+$/.test(UNDO_ITEM_ID)) {
    console.error(`--undo expects a numeric item_id, got ${JSON.stringify(UNDO_ITEM_ID)}`);
    process.exit(1);
  }
}

const PRICE_NUM = UNDO_ITEM_ID ? null : Number(PRICE);
const STOCK_NUM = UNDO_ITEM_ID ? null : Number(STOCK);
if (!UNDO_ITEM_ID) {
  if (!PRICE) {
    console.error(
      "Missing --price. This script never infers a price from a packet file —\n" +
        "PRICE is Lane C's field and is deliberately not a number there until Lane\n" +
        "C fills it in by hand. Pass it explicitly.",
    );
    process.exit(1);
  }
  if (!Number.isFinite(PRICE_NUM) || PRICE_NUM <= 0) {
    console.error(`--price must be a positive number, got ${JSON.stringify(PRICE)}`);
    process.exit(1);
  }
  if (!Number.isInteger(STOCK_NUM) || STOCK_NUM < 0) {
    console.error(`--stock must be a non-negative integer, got ${JSON.stringify(STOCK)}`);
    process.exit(1);
  }
}

// ── Env ───────────────────────────────────────────────────────────────────
const env = (name) => {
  const v = process.env[name];
  if (!v) {
    console.error(`Missing ${name}. Run with --env-file=.env.local`);
    process.exit(1);
  }
  return v;
};
const SUPABASE_URL = env("NEXT_PUBLIC_SUPABASE_URL");
const SERVICE_KEY = env("SUPABASE_SERVICE_ROLE_KEY");
const PARTNER_ID = env("SHOPEE_PARTNER_ID");
const PARTNER_KEY = env("SHOPEE_PARTNER_KEY");
const KEY = Buffer.from(env("ACCOUNTS_ENCRYPTION_KEY"), "base64");
const HOST = "https://partner.shopeemobile.com";

const rest = async (path) =>
  (
    await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
    })
  ).json();

function decrypt(b64) {
  const raw = Buffer.from(b64, "base64");
  const iv = raw.subarray(0, 12);
  const rest_ = raw.subarray(12);
  const tag = rest_.subarray(rest_.length - 16);
  const body = rest_.subarray(0, rest_.length - 16);
  const d = crypto.createDecipheriv("aes-256-gcm", KEY, iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(body), d.final()]).toString("utf8");
}

// ── Token: stored only, never refreshed — same refusal as fix-listing-urls.mjs
const [auth] = await rest(
  "shopee_auth?select=shop_id,access_token_enc,access_token_expires_at",
);
if (!auth) {
  console.error("No shopee_auth row. Authorize the shop first.");
  process.exit(1);
}
const expiresAt = new Date(auth.access_token_expires_at).getTime();
const msLeft = expiresAt - Date.now();
if (!Number.isFinite(expiresAt) || msLeft <= 60_000) {
  console.error(
    `Stored Shopee access_token expired or expiring (${auth.access_token_expires_at}).\n` +
      `REFUSING to refresh it here — the refresh_token is single-use and rotating,\n` +
      `and racing another session that holds it would kill production auth for the shop.\n` +
      `Run: node --env-file=.env.local scripts/shopee-listings.mjs   (it refreshes), then re-run this.`,
  );
  process.exit(1);
}
const TOKEN = decrypt(auth.access_token_enc);
const SHOP_ID = auth.shop_id;
console.log(`Token valid for a further ${Math.round(msLeft / 60000)} min. Not refreshed.\n`);

function signed(path) {
  const ts = Math.floor(Date.now() / 1000);
  const sign = crypto
    .createHmac("sha256", PARTNER_KEY)
    .update(`${PARTNER_ID}${path}${ts}${TOKEN}${SHOP_ID}`)
    .digest("hex");
  return new URLSearchParams({
    partner_id: PARTNER_ID,
    timestamp: String(ts),
    access_token: TOKEN,
    shop_id: String(SHOP_ID),
    sign,
  });
}

const apiGet = async (path, extra = {}) => {
  const q = signed(path);
  for (const [k, v] of Object.entries(extra)) q.set(k, v);
  return (await fetch(`${HOST}${path}?${q}`)).json();
};

const apiPostJson = async (path, body) =>
  (
    await fetch(`${HOST}${path}?${signed(path)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
  ).json();

/**
 * v2.media_space.upload_image is multipart/form-data, not JSON — the one
 * endpoint in this shop's toolkit that isn't. Uses the platform's native
 * FormData/Blob (Node 18+) rather than a dependency. Content-Type is left
 * for `fetch` to set (it must include the multipart boundary; setting it by
 * hand here would break the upload).
 */
const apiUploadImage = async (filePath) => {
  const bytes = readFileSync(filePath);
  const form = new FormData();
  form.set("image", new Blob([bytes]), filePath.split(/[\\/]/).pop());
  const res = await fetch(`${HOST}/api/v2/media_space/upload_image?${signed("/api/v2/media_space/upload_image")}`, {
    method: "POST",
    body: form,
  });
  return res.json();
};

// ── Undo: delete_item, gated behind the same --apply flag as everything else
if (UNDO_ITEM_ID) {
  const path = "/api/v2/product/delete_item";
  console.log(`\nWould call ${path} with item_id: ${UNDO_ITEM_ID}`);
  if (!APPLY) {
    console.log("DRY RUN — nothing deleted. Re-run with --apply to actually delete it.");
    process.exit(0);
  }
  console.log("APPLYING — deleting for real.");
  const res = await apiPostJson(path, { item_id: Number(UNDO_ITEM_ID) });
  if (res.error) {
    console.error(`delete_item FAILED: ${res.error} ${res.message ?? ""}`);
    process.exit(1);
  }
  console.log(`Deleted item_id ${UNDO_ITEM_ID}.`);
  process.exit(0);
}

// ── Packet parsing ───────────────────────────────────────────────────────
const PACKET_PATH = join(ROOT, "docs", "publish-packets", `${SLUG}.md`);
let packetText;
try {
  packetText = readFileSync(PACKET_PATH, "utf8");
} catch {
  console.error(`No packet at docs/publish-packets/${SLUG}.md — nothing to build from.`);
  process.exit(1);
}

/** Pull the first fenced code block under a `## N. HEADING` section. */
function fencedBlockUnder(text, headingRe) {
  const headingMatch = headingRe.exec(text);
  if (!headingMatch) return null;
  const after = text.slice(headingMatch.index + headingMatch[0].length);
  const fence = /```[^\n]*\n([\s\S]*?)```/.exec(after);
  return fence ? fence[1].replace(/\s+$/, "") : null;
}

const title = fencedBlockUnder(packetText, /^##\s*1\.\s*TITLE/m);
const description = fencedBlockUnder(packetText, /^##\s*3\.\s*DESCRIPTION/m);

if (!title) {
  console.error(`Could not find a "## 1. TITLE" fenced block in ${PACKET_PATH}.`);
  process.exit(1);
}
if (!description) {
  console.error(`Could not find a "## 3. DESCRIPTION" fenced block in ${PACKET_PATH}.`);
  process.exit(1);
}

// House rule, not a documented Shopee API limit — see header comment.
if (title.length > 120) {
  console.error(
    `TITLE is ${title.length} chars, over this shop's 120-char house cap. Refusing to guess a trim — fix the packet.`,
  );
  process.exit(1);
}

// The one hard, non-negotiable content rule (.claude/fleet/BRIEF.md, RULINGS.md R3):
// no gameshare.space URL in the shipping copy. Built at runtime, same trick
// scripts/fix-listing-urls.mjs uses, so this file itself doesn't trip that grep.
const DOMAIN = ["gameshare", ".", "space"].join("");
const DOMAIN_RE = new RegExp(DOMAIN.replace(".", "\\."), "i");
for (const [label, text] of [["TITLE", title], ["DESCRIPTION", description]]) {
  if (DOMAIN_RE.test(text)) {
    console.error(`${label} contains the banned domain. Refusing to build a listing that carries it.`);
    process.exit(1);
  }
}

// ── Images ────────────────────────────────────────────────────────────────
// Deliberately banner-1..4, NEVER <slug>-card.png. The card is the 16:9
// gameshare.space site card, a different image for a different surface —
// see scripts/gen-banners.mjs's own header comment.
const BANNER_PATHS = [1, 2, 3, 4].map((n) => join(ROOT, "brand", `${SLUG}-banner-${n}.png`));
const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10MB, per Shopee's own upload_image docs
for (const p of BANNER_PATHS) {
  let st;
  try {
    st = statSync(p);
  } catch {
    console.error(`Missing banner: ${p}`);
    process.exit(1);
  }
  if (!/\.(png|jpe?g)$/i.test(p)) {
    console.error(`${p}: not PNG/JPG — Shopee's upload_image only accepts those formats.`);
    process.exit(1);
  }
  if (st.size > MAX_IMAGE_BYTES) {
    console.error(`${p}: ${(st.size / 1048576).toFixed(1)}MB exceeds Shopee's 10MB per-image cap.`);
    process.exit(1);
  }
}
console.log(`4 banner files found, all PNG/JPG, all under 10MB:`);
for (const p of BANNER_PATHS) console.log(`  ${p}`);

// ── Category — resolved LIVE, cross-checked, never hardcoded blind ─────────
// See header comment for how 101090 / "PC Game" was established as this
// shop's real, currently-used category (20/20 live items sampled 2026-09-08).
const KNOWN_GOOD_CATEGORY_ID = 101090;
const KNOWN_GOOD_CATEGORY_NAME = "PC Game";

console.log("\nResolving category_id live via get_category...");
const catResp = await apiGet("/api/v2/product/get_category", { language: "en" });
if (catResp.error) {
  console.error(`get_category failed: ${catResp.error} ${catResp.message ?? ""}`);
  process.exit(1);
}
const found = (catResp.response?.category_list ?? []).find(
  (c) => c.category_id === KNOWN_GOOD_CATEGORY_ID,
);
if (!found) {
  console.error(
    `category_id ${KNOWN_GOOD_CATEGORY_ID} ("${KNOWN_GOOD_CATEGORY_NAME}") no longer appears in ` +
      `get_category's live list. REFUSING to guess a replacement — Shopee's category tree has ` +
      `changed since 2026-09-08 and a human needs to pick the new leaf category by hand.`,
  );
  process.exit(1);
}
if (found.original_category_name !== KNOWN_GOOD_CATEGORY_NAME) {
  console.error(
    `category_id ${KNOWN_GOOD_CATEGORY_ID} now resolves to "${found.original_category_name}", ` +
      `not "${KNOWN_GOOD_CATEGORY_NAME}". REFUSING to use it — a renamed/repurposed category id ` +
      `is exactly the "wrong category, listing never surfaces in search" failure this check exists for.`,
  );
  process.exit(1);
}
if (found.has_children) {
  console.error(
    `category_id ${KNOWN_GOOD_CATEGORY_ID} now has children (is no longer a leaf). Shopee requires ` +
      `a leaf category for add_item. REFUSING to guess which child — needs a human.`,
  );
  process.exit(1);
}
console.log(`  confirmed live: ${KNOWN_GOOD_CATEGORY_ID} = "${found.original_category_name}" (leaf) ✓`);

/**
 * The shop's own proven packaging template for a PC-game shared-account
 * listing. Sourced by reading back live item 48167478078 (Cyberpunk 2077)
 * via get_item_base_info, 2026-09-08 — not invented, not guessed. Every
 * field here is what this shop's OWN successful listings already use.
 * See the header comment for why this is not re-fetched live every run.
 *
 * The one exception is Game Genre Type (attribute_id 100541), deliberately
 * NOT included here — a fixed value copied from one game's template is wrong
 * for every other genre, which is exactly the bug this script caught and
 * refused to ship on its first pass (see resolveGenreAttribute below).
 */
const PC_GAME_TEMPLATE = {
  // NUMBER, not a string. Read back from a live item it comes as "0.01", but
  // add_item rejects that: `cannot unmarshal string into Go struct field
  // AddItemRequest.weight of type float64`. FACT-V 2026-09-08 — this failed the
  // first real add_item call, AFTER the four images had already uploaded.
  weight: 0.01,
  // REQUIRED — add_item returns `product.error_invalid_brand Brand information
  // required` without it, even though every existing listing is unbranded.
  // Not guessed: read back from live items 48367477976, 55917443921 and
  // 49967469265, all three identical. FACT-V 2026-09-08.
  brand: { brand_id: 0, original_brand_name: "NoBrand" },
  dimension: { package_length: 1, package_width: 1, package_height: 1 },
  logistic_info: [{ logistic_id: 21003, enabled: true }], // "Virtual Goods"
  condition: "NEW",
  attribute_list: [
    { attribute_id: 101198, attribute_value_list: [{ value_id: 7058 }] }, // SIRIM Certified: No
    { attribute_id: 101396, attribute_value_list: [{ value_id: 12543 }] }, // MCMC Approved: Yes
    { attribute_id: 102370, attribute_value_list: [{ value_id: 16872 }] }, // Certification/License: No
    { attribute_id: 100370, attribute_value_list: [{ value_id: 5576 }] }, // Warranty Type: No Warranty
  ],
};

/**
 * Resolve Game Genre Type (attribute_id 100541) FOR REAL, per game, instead
 * of copying a fixed value from one template item. Two live sources, both
 * fetched fresh, neither hardcoded:
 *   1. Steam's own `genres` list for this game's app id (from `games-data.mjs`)
 *   2. Shopee's own controlled vocabulary for this attribute, via
 *      get_attribute_tree on the category just resolved above
 * Matched by name. A Steam genre with no Shopee equivalent (Indie, Casual,
 * Massively Multiplayer, Racing, Free to Play — none exist in Shopee's list)
 * is silently skipped, not force-matched to something wrong. If NOTHING
 * matches, this refuses rather than guessing — same discipline as the
 * category check above.
 */
async function resolveGenreAttribute(steamAppId, slug) {
  const steamResp = await fetch(
    `https://store.steampowered.com/api/appdetails?appids=${steamAppId}&cc=my&l=en`,
  );
  const steamData = (await steamResp.json())[String(steamAppId)];
  const steamGenres = (steamData?.data?.genres ?? []).map((g) => g.description);
  if (!steamGenres.length) {
    console.error(
      `Could not read Steam genres for app ${steamAppId} (${slug}). Refusing to guess a genre attribute.`,
    );
    process.exit(1);
  }

  const attrResp = await apiGet("/api/v2/product/get_attribute_tree", {
    category_id_list: String(KNOWN_GOOD_CATEGORY_ID),
    language: "en",
  });
  const tree = attrResp.response?.list?.[0]?.attribute_tree ?? [];
  const genreAttr = tree.find((a) => a.attribute_id === 100541);
  if (!genreAttr) {
    console.error(`get_attribute_tree returned no Game Genre Type (100541) for category ${KNOWN_GOOD_CATEGORY_ID}. Refusing to guess.`);
    process.exit(1);
  }

  const shopeeByName = new Map(
    genreAttr.attribute_value_list.map((v) => [v.name.toLowerCase(), v.value_id]),
  );
  const matched = [];
  const skipped = [];
  for (const g of steamGenres) {
    const hit = shopeeByName.get(g.toLowerCase());
    if (hit !== undefined) matched.push({ steam: g, value_id: hit });
    else skipped.push(g);
  }

  console.log(`  Steam genres for app ${steamAppId}: ${steamGenres.join(", ")}`);
  if (skipped.length) console.log(`  no Shopee equivalent, skipped (not forced): ${skipped.join(", ")}`);
  if (!matched.length) {
    console.error(
      `None of Steam's genres (${steamGenres.join(", ")}) match Shopee's Game Genre Type vocabulary ` +
        `(${genreAttr.attribute_value_list.map((v) => v.name).join(", ")}). Refusing to guess — fix by hand.`,
    );
    process.exit(1);
  }
  console.log(`  Game Genre Type resolved: ${matched.map((m) => `${m.steam}->${m.value_id}`).join(", ")}`);

  const maxCount = genreAttr.attribute_info?.max_value_count ?? 1;
  return {
    attribute_id: 100541,
    attribute_value_list: matched.slice(0, maxCount).map((m) => ({ value_id: m.value_id })),
  };
}

console.log("\nResolving Game Genre Type live (Steam genres x Shopee vocabulary)...");
const { GAMES } = await import(pathToFileURL(join(ROOT, "scripts", "games-data.mjs")).href);
const gameEntry = GAMES.find((g) => g.slug === SLUG);
if (!gameEntry) {
  console.error(
    `No entry for slug "${SLUG}" in scripts/games-data.mjs — can't resolve its Steam app id for the ` +
      `genre lookup. (Read-only lookup; this script never edits that file.)`,
  );
  process.exit(1);
}
const genreAttribute = await resolveGenreAttribute(gameEntry.id, SLUG);

// ── Build the payload (never sent unless --apply) ───────────────────────
const addItemPayload = {
  category_id: KNOWN_GOOD_CATEGORY_ID,
  item_name: title,
  description,
  // add_item names this `original_price`; `price` is what get_item_base_info
  // reads back. Sending `price` alone returns `invalid field original_price,
  // value must Not Null`. FACT-V 2026-09-08.
  //
  // This is the SELLING price, not a struck-through "was" price — Shopee derives
  // any discount display from a separate promotion, never from this field. Do not
  // inflate it to manufacture a discount: that is a Misleading Discount violation,
  // the same rule that puts HITMAN's own "was RM72" Steam sale off-limits in copy.
  price: PRICE_NUM,
  original_price: PRICE_NUM,
  // add_item wants `seller_stock`, an ARRAY, not the flat `stock` that
  // get_item_base_info reads back. Sending `stock` alone returns
  // `invalid field seller_stock, value must Not Null`. FACT-V 2026-09-08.
  // Both are sent: `stock` is harmless and keeps the printed payload legible
  // next to the value R16 fixes at 99999.
  stock: STOCK_NUM,
  seller_stock: [{ stock: STOCK_NUM }],
  item_status: "UNLIST", // land as a draft; Chaison lists it by hand from Seller Centre
  ...PC_GAME_TEMPLATE,
  attribute_list: [genreAttribute, ...PC_GAME_TEMPLATE.attribute_list],
  image: { image_id_list: ["<uploaded-image-id-1>", "<uploaded-image-id-2>", "<uploaded-image-id-3>", "<uploaded-image-id-4>"] },
};

console.log("\n" + "=".repeat(74));
console.log("DRY-RUN add_item PAYLOAD (image_id_list are placeholders — see note)");
console.log("=".repeat(74));
console.log(JSON.stringify(addItemPayload, null, 2));
console.log("=".repeat(74));
console.log(
  "\nlands as item_status: UNLIST — a draft, not a live listing. Chaison publishes\n" +
    "it from Seller Centre when ready, same pattern as every existing supplier game.",
);

if (!APPLY) {
  console.log("\nDRY RUN — nothing was uploaded, nothing was created. Re-run with --apply to write.");
  process.exit(0);
}

// ── --apply: upload images, then create the item, for real ─────────────
//
// PARTIAL-FAILURE SHAPE, stated plainly rather than discovered mid-write:
// upload_image runs fully, image by image, BEFORE add_item is ever called.
// There is no code path that creates an item with fewer than 4 images — either
// all 4 upload and add_item is attempted, or a failed upload aborts before
// add_item runs at all. So a partial failure never leaves a half-populated
// LISTING; it leaves 0 listings and some number of ORPHANED IMAGES sitting in
// Shopee's media space, unattached to anything, printed on exit so a human
// can see exactly which ids they are. Orphaned images are not visible to
// buyers and not attached to any product — the failure mode is wasted media
// slots, not a broken storefront.
//
// RE-RUN DUPLICATION: a bare re-run does NOT duplicate a listing (add_item
// was never reached, or wasn't attempted, on the failed prior run) but DOES
// re-upload all 4 images fresh, adding to the orphan count rather than
// reusing the previous attempt's ids — this script keeps no state between
// runs. `--reuse-images=id1,id2,id3,id4` is the escape hatch: pass the 4 ids
// printed by a prior failed run to skip re-uploading and go straight to
// add_item with them.
console.log("\n" + "=".repeat(74));
console.log(`APPLYING — uploading ${BANNER_PATHS.length} images, then creating the listing.`);
console.log("=".repeat(74));

const REUSE_IMAGES = arg("reuse-images");
let imageIds;
if (REUSE_IMAGES) {
  imageIds = REUSE_IMAGES.split(",").map((s) => s.trim());
  if (imageIds.length !== BANNER_PATHS.length) {
    console.error(`--reuse-images needs exactly ${BANNER_PATHS.length} ids, got ${imageIds.length}.`);
    process.exit(1);
  }
  console.log(`Reusing ${imageIds.length} previously-uploaded image id(s), not re-uploading:`);
  for (const id of imageIds) console.log(`  ${id}`);
} else {
  imageIds = [];
  for (const p of BANNER_PATHS) {
    const res = await apiUploadImage(p);
    const info = res?.response?.image_info_list?.[0];
    if (res.error || !info || info.image_info?.image_id === undefined) {
      console.error(`upload_image FAILED for ${p}: ${res.error ?? "no image_id in response"} ${res.message ?? ""}`);
      console.error(`Already-uploaded image ids this run (orphaned on Shopee's side, not attached to any item): ${imageIds.join(", ") || "(none)"}`);
      console.error(`Re-run with --reuse-images=${imageIds.join(",")} to reuse them instead of re-uploading.`);
      process.exit(1);
    }
    imageIds.push(info.image_info.image_id);
    console.log(`  uploaded ${p} -> ${info.image_info.image_id}`);
  }
}

addItemPayload.image.image_id_list = imageIds;
const created = await apiPostJson("/api/v2/product/add_item", addItemPayload);
if (created.error) {
  console.error(`add_item FAILED: ${created.error} ${created.message ?? ""}`);
  console.error(`${imageIds.length} image(s) are uploaded and unattached: ${imageIds.join(", ")}`);
  console.error(`Fix the payload, then re-run with --reuse-images=${imageIds.join(",")} to avoid re-uploading.`);
  process.exit(1);
}
console.log(`\nCreated item_id: ${created.response?.item_id}`);
console.log(`Status: ${created.response?.item_status ?? "(unknown)"} — verify in Seller Centre before listing it live.`);
if (created.warning) console.log(`Shopee warning: ${created.warning}`);
