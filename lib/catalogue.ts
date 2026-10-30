/**
 * catalogue.ts — presentation data for the public /games page.
 *
 * The `games` table holds only id/title/steam_app_id, which is not enough to
 * render a shelf: there is no slug (so no way to find the banner art), no
 * genre, and no notion of whether a buyer can actually purchase the game
 * today. This module supplies that layer, keyed by Steam app id.
 *
 * ── WHY `shopeeItemId` IS HARDCODED AND NOT READ FROM `shopee_listings` ────
 * It would be the obvious source and it is the wrong one. A mapping row proves
 * only that someone wrote a row -- it is written by hand, and it is written
 * BEFORE a listing is published (a draft is created UNLIST, mapped, and only
 * later listed). Deriving "you can buy this" from it would put a Buy button on
 * a game that is still an unpublished draft and send buyers to a dead URL.
 *
 * This bit exactly that way on 2026-09-06: the table held mappings for all 10
 * games while only 4 were actually purchasable. As of 2026-10-30, 37 of the 40
 * mapped NORMAL listings carry an id. The entries with no id are games with card
 * art and no live listing, plus the three held back below -- and the next new
 * game will be a mapped draft first, and must NOT get an id here until it is
 * confirmed NORMAL.
 *
 * The ids below are the ones `scripts/shopee-listings.mjs` reported as NORMAL.
 * VERIFY AGAINST THAT REPORT before adding one -- do not copy an id out of
 * `shopee_listings`.
 */

/** The shop these item ids belong to. Buy links are built from it. */
const SHOP_ID = 1597884613;

export interface CatalogueEntry {
  /** Matches `games.steam_app_id`, and the `id` field in scripts/gen-banners.mjs. */
  steamAppId: number;
  /**
   * Art filename stem: public/games/<slug>.png, which is the 1200x675 site card
   * from scripts/out/<slug>-card.png -- NOT the 800x830 Shopee banner. The two are
   * deliberately different images: the Shopee banner carries the delivery ribbon and
   * the claim grid, all of which this page already renders as real text.
   */
  slug: string;
  genre: string;
  /** Present only when a NORMAL listing was confirmed live. Absent = not purchasable. */
  shopeeItemId?: number;
}

export const CATALOGUE: CatalogueEntry[] = [
  { steamAppId: 1868140, slug: "dave-the-diver", genre: "Adventure RPG", shopeeItemId: 46516993841 },
  { steamAppId: 227300, slug: "euro-truck-simulator-2", genre: "Trucking Simulation", shopeeItemId: 40634236344 },
  { steamAppId: 3167020, slug: "escape-from-duckov", genre: "Extraction Shooter", shopeeItemId: 49766310127 },
  { steamAppId: 4001890, slug: "how-to-fish", genre: "Co-op Physics", shopeeItemId: 48217427795 },
  { steamAppId: 3164500, slug: "schedule-1", genre: "Management Sim", shopeeItemId: 48217450246 },
  { steamAppId: 2019300, slug: "dokimon-quest", genre: "Monster-Taming RPG", shopeeItemId: 52667425632 },
  { steamAppId: 265300, slug: "lords-of-the-fallen-2014", genre: "Action RPG", shopeeItemId: 45417439240 },
  { steamAppId: 1948280, slug: "stacklands", genre: "Card Village Builder", shopeeItemId: 52367419203 },
  { steamAppId: 858820, slug: "tribes-of-midgard", genre: "Co-op Survival", shopeeItemId: 52467419241 },
  { steamAppId: 208650, slug: "batman-arkham-knight", genre: "Action Adventure", shopeeItemId: 45017441353 },
  { steamAppId: 4348910, slug: "probably-stolen", genre: "Cyberpunk Shopkeeper Sim", shopeeItemId: 42835663419 },
  { steamAppId: 2358720, slug: "black-myth-wukong", genre: "Action RPG", shopeeItemId: 28845742292 },
  { steamAppId: 949230, slug: "cities-skylines-2", genre: "City Builder", shopeeItemId: 49967469265 },
  { steamAppId: 2384580, slug: "dynasty-warriors-origins", genre: "Musou Action", shopeeItemId: 54117441114 },
  { steamAppId: 2287330, slug: "empire-of-the-ants", genre: "Nature Strategy", shopeeItemId: 46067475292 },
  { steamAppId: 2993780, slug: "fantasy-life-i", genre: "Life-Sim RPG", shopeeItemId: 46467470550 },
  { steamAppId: 2515020, slug: "final-fantasy-16", genre: "Action RPG", shopeeItemId: 53217526672 },
  { steamAppId: 3551340, slug: "football-manager-26", genre: "Football Management", shopeeItemId: 42734284125 },
  { steamAppId: 2215430, slug: "ghost-of-tsushima", genre: "Open-World Samurai", shopeeItemId: 46067470527 },
  { steamAppId: 2561580, slug: "horizon-zero-dawn-remastered", genre: "Open-World Action RPG", shopeeItemId: 55917443921 },
  { steamAppId: 2677660, slug: "indiana-jones-great-circle", genre: "Action Adventure", shopeeItemId: 45467475301 },
  { steamAppId: 2239710, slug: "into-the-dead-our-darkest-days", genre: "Survival Strategy", shopeeItemId: 47467470500 },
  { steamAppId: 2322560, slug: "love-is-all-around", genre: "Live-Action Romance", shopeeItemId: 47067475273 },
  { steamAppId: 2651280, slug: "marvels-spider-man-2", genre: "Open-World Action", shopeeItemId: 49667469218 },
  { steamAppId: 1857090, slug: "norland", genre: "Medieval Colony Sim", shopeeItemId: 43384247116 },
  { steamAppId: 1623730, slug: "palworld", genre: "Creature Survival", shopeeItemId: 51367462110 },
  { steamAppId: 1144200, slug: "ready-or-not", genre: "Tactical Shooter", shopeeItemId: 52317526733 },
  { steamAppId: 3764200, slug: "resident-evil-requiem", genre: "Survival Horror", shopeeItemId: 45667475242 },
  { steamAppId: 814380, slug: "sekiro-shadows-die-twice", genre: "Action Adventure", shopeeItemId: 48367477976 },
  { steamAppId: 1624540, slug: "storyteller", genre: "Story Puzzle", shopeeItemId: 47567470574 },
  { steamAppId: 1962700, slug: "subnautica-2", genre: "Underwater Survival", shopeeItemId: 50067527543 },
  { steamAppId: 3070070, slug: "tcg-card-shop-simulator", genre: "Shop Simulation", shopeeItemId: 43984247133 },
  { steamAppId: 1778820, slug: "tekken-8", genre: "Fighting", shopeeItemId: 58167526751 },
  { steamAppId: 2531310, slug: "the-last-of-us-part-2-remastered", genre: "Action Adventure", shopeeItemId: 42734260249 },
  { steamAppId: 2239150, slug: "thronefall", genre: "Minimalist Strategy", shopeeItemId: 55717441172 },
  { steamAppId: 1659420, slug: "uncharted-legacy-of-thieves", genre: "Action Adventure", shopeeItemId: 44967560560 },
  { steamAppId: 1879330, slug: "warriors-orochi-3-ultimate", genre: "Musou Action", shopeeItemId: 42484247105 },
  // Live on Shopee, Buy held back until the gamersfantasy bundle fix is deployed:
  // Cyberpunk 48167478078, God of War Ragnarok 41084248457, MGS Delta 41584248488.
  { steamAppId: 1091500, slug: "cyberpunk-2077", genre: "Open-World RPG" },
  { steamAppId: 2322010, slug: "god-of-war-ragnarok", genre: "Action Adventure" },
  { steamAppId: 2417610, slug: "metal-gear-solid-delta-snake-eater", genre: "Stealth Action" },
  // In the `games` table with card art, but no NORMAL listing: not purchasable.
  { steamAppId: 3159330, slug: "assassins-creed-shadows", genre: "Open-World Action RPG" },
  { steamAppId: 2208920, slug: "assassins-creed-valhalla", genre: "Open-World Action RPG" },
  { steamAppId: 476600, slug: "call-of-duty-wwii", genre: "WWII Shooter" },
  { steamAppId: 1671210, slug: "deltarune", genre: "Turn-Based RPG" },
  { steamAppId: 3405690, slug: "ea-sports-fc-26", genre: "Football Sim" },
  { steamAppId: 1174180, slug: "red-dead-redemption-2", genre: "Action Adventure" },
  { steamAppId: 2842040, slug: "star-wars-outlaws", genre: "Open-World Action" },
  { steamAppId: 3717070, slug: "wwe-2k26", genre: "Wrestling Sim" },
];

const BY_APP_ID = new Map(CATALOGUE.map((e) => [e.steamAppId, e]));

/**
 * Accepts a string because that is what actually arrives. `games.steam_app_id`
 * is a Postgres bigint, and PostgREST serialises bigint as a JSON *string* to
 * avoid the 2^53 precision cliff -- so supabase-js hands back "1868140", not
 * 1868140. The generated row type says number, which means TypeScript raises
 * nothing and a Map<number, ...> lookup misses on every single row.
 *
 * That failed silently and looked plausible: every card fell back to its
 * "art pending" placeholder and every game read as "Listing soon", which is a
 * believable empty state rather than an obvious bug. Normalise here so callers
 * cannot reintroduce it.
 */
export function catalogueEntry(steamAppId: string | number): CatalogueEntry | undefined {
  return BY_APP_ID.get(Number(steamAppId));
}

export function shopeeUrl(itemId: number): string {
  return `https://shopee.com.my/product/${SHOP_ID}/${itemId}`;
}

/**
 * Per-game help links, rendered on that game's card on /games.
 *
 * ── WHY THIS IS SEPARATE FROM CatalogueEntry ─────────────────────────────
 * A help link is not presentation data and does not imply a game is stocked,
 * arted, or purchasable. Keying off the Steam app id lets a help link attach to
 * ANY row in the `games` table, catalogued or not.
 *
 * ── WHY WUKONG HAS ONE ───────────────────────────────────────────────────
 * Black Myth: Wukong ships with Denuvo, which caps how many machines may
 * activate one account inside a rolling window. A buyer who finished the
 * download and then gets "Something went wrong" on launch has hit that cap —
 * the account is not broken and there is nothing to fix on our side. The
 * remedy is to try a different account, which this link self-serves. Chaison
 * chose this on 2026-09-09. It is NOT a precedent: ask him before adding
 * another link that hands out account access.
 *
 * ── WHY THE URL IS AN ENV VAR ────────────────────────────────────────────
 * This repo is public and git history is permanent, so the URL never goes in
 * source. Unset means no link renders. Vercel bakes env vars into a deployment,
 * so removing it takes effect only after a redeploy.
 */
export interface HelpLink {
  /** Buyer-facing anchor text. Names the SYMPTOM, not the mechanism. */
  label: string;
  url: string;
}

const HELP_LINKS: Record<number, { label: string; urlEnv: string }> = {
  2358720: {
    // Buyers do not know the word "Denuvo"; they know the game will not start.
    label: "Game won't launch? Try a backup account",
    urlEnv: "WUKONG_HELP_URL",
  },
};

/**
 * Accepts a string for the same reason catalogueEntry() does: PostgREST hands
 * back `games.steam_app_id` as a JSON string, so a raw lookup misses on every
 * row and the link silently never renders. Normalise here, not at the call site.
 */
export function helpLink(steamAppId: string | number): HelpLink | undefined {
  const link = HELP_LINKS[Number(steamAppId)];
  const url = link && process.env[link.urlEnv];
  return url ? { label: link.label, url } : undefined;
}
