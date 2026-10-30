/**
 * Download Steam header art + gameplay screenshots for every banner game.
 * Writes scripts/art/<appid>-header.jpg and <appid>-shot{1,2,3}.jpg.
 * Art is gitignored working material, not a tracked asset.
 */
import { mkdirSync, writeFileSync, existsSync } from "fs";
import { join } from "path";

const IDS = [
  // ── Our own Steam accounts (the fleet in local/websites/../ACCOUNT-TRACKER) ──
  "1868140", "227300", "3164500", "3167020", "2019300", "4001890",
  // Added 2026-09-05 — the four newer accounts that were idle inventory with no
  // banners. Note 858820 is Tribes of Midgard; 1004770 is a different game entirely.
  "265300", "1948280", "858820", "208650",

  // ── Supplier-sourced titles, added 2026-09-06 ────────────────────────────────
  // From the order tables in local/websites/ (cyberspace.cyou, gamersfantasy.my).
  // Those tables label games the supplier's way -- "DW Origins", "Orochi 3",
  // "TCG Card" -- so every id here was resolved through scripts/resolve-appids.mjs
  // against Steam's own index, never from the name alone. The mapping, including
  // the two that are inferences rather than exact matches, is in
  // docs/shopee-listings.md under "Supplier-sourced titles".
  "2215430", // Ghost of Tsushima DIRECTOR'S CUT
  "1671210", // DELTARUNE
  "2993780", // FANTASY LIFE i: The Girl Who Steals Time
  "2239710", // Into the Dead: Our Darkest Days
  "3070070", // TCG Card Shop Simulator
  "1857090", // Norland
  "2384580", // DYNASTY WARRIORS: ORIGINS
  "2322560", // Love Is All Around        <- inferred, see doc
  "2239150", // Thronefall
  "2677660", // Indiana Jones and the Great Circle
  "1879330", // WARRIORS OROCHI 3 Ultimate Definitive Edition
  "2287330", // Empire of the Ants        <- inferred, see doc
  "1624540", // Storyteller
  "2358720", // Black Myth: Wukong
  "3764200", // Resident Evil Requiem

  // ── gamersfantasy.my, added 2026-09-06 ──────────────────────────────────────
  // Order the shared gamersfantasy order (id in `local/websites/gamersfantasy.my.md`, gitignored) carries seven games on one order id; Sekiro's own separate gamersfantasy order is
  // Sekiro. Three of the seven are Ubisoft titles that need a second account we
  // do not deliver - see docs/shopee-listings.md before listing any of them.
  "2561580", // Horizon Zero Dawn Remastered
  "2842040", // Star Wars Outlaws                     <- Ubisoft Connect required
  "3159330", // Assassin's Creed Shadows              <- Ubisoft account required
  "2322010", // God of War Ragnarok
  "2208920", // Assassin's Creed Valhalla             <- Ubisoft Connect required
  "1091500", // Cyberpunk 2077
  "2417610", // METAL GEAR SOLID Delta: Snake Eater   <- inferred, see doc
  "814380", //  Sekiro: Shadows Die Twice GOTY Edition

  // The single-game gamersfantasy orders, added 2026-09-06.
  "2651280", // Marvel's Spider-Man 2
  "949230", //  Cities: Skylines II
  "2531310", // The Last of Us Part II Remastered
  "1623730", // Palworld
  "1174180", // Red Dead Redemption 2   <- Rockstar account required; do not list

  // ── gamersfantasy.my, added 2026-09-07 ──────────────────────────────────────
  // Ten more single-game orders (one order id, one game, one account each). Every
  // id below came from scripts/resolve-appids.mjs against Steam's own index and
  // matched the supplier's product name exactly - no inferences in this batch.
  // Four carry a publisher-account or DRM condition that blocks listing; the
  // reason is on the line and the detail is in scripts/games-data.mjs.
  "1778820", // TEKKEN 8
  "1144200", // Ready or Not          <- supplier sells the "Home Invasion Bundle" (base game + DLC)
  "3717070", // WWE 2K26              <- 2K account + Denuvo 5-machine/24h limit; do not list
  "3551340", // Football Manager 26   <- Denuvo anti-tamper
  "476600", //  Call of Duty: WWII
  "3405690", // EA SPORTS FC 26       <- EA app + online activation required; do not list
  "1659420", // UNCHARTED: Legacy of Thieves Collection
  "1962700", // Subnautica 2          <- Early Access, only 6 screenshots on Steam
  "2001120", // Split Fiction         <- no single-player mode at all; do not list
  "2515020", // FINAL FANTASY XVI

  // ── gamersfantasy.my, added 2026-09-08 ──────────────────────────────────────
  // Two batches bought today. Only the id below is listable; the rest of the batch
  // failed the deliverability gate and is deliberately absent, because downloading
  // art for a title we must not sell is the waste the gate exists to prevent:
  //   NBA 2K27 (4356430)            - 2K Sports Account, same class as WWE 2K26
  //   STAR WARS Zero Company        - EA Account + "internet required to play";
  //                                   note the supplier's "Deluxe Edition" is
  //                                   3701350, type dlc, fullgame -> 2075800
  //   AC Odyssey, AC Black Flag     - Ubisoft account we do not deliver; halted
  //                                   by Chaison 2026-09-08 along with Rockstar
  // Crimson Desert and Nioh 3 are still in the gate and are not added until they pass.
  // Ghost of Tsushima needs no entry - 2215430 is already above, and the second
  // supplier account resolves to that same app (RULINGS R14).
  "1659040", // HITMAN World of Assassination
  //            Base app, NOT an edition SKU: fullgame is null and Part One /
  //            standard / Deluxe are package_groups tiers on this one id. Its
  //            header_image is a seasonal alt capsule (header_alt_assets_13.jpg),
  //            so a later --force re-run can silently change banner-1.
];
const ART = join(import.meta.dirname, "art");
mkdirSync(ART, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Steam's store API rate-limits (429) once the catalogue got large enough that a
 * full re-run made 30+ appdetails calls back to back. Retry with backoff rather
 * than dying halfway and leaving the art directory half-populated.
 */
const get = async (url, tries = 6) => {
  for (let i = 0; i < tries; i++) {
    const r = await fetch(url);
    if (r.ok) return r;
    if (r.status !== 429 || i === tries - 1) throw new Error(`${r.status} ${url}`);
    const wait = 15000 * (i + 1);
    console.log(`  429 from Steam - waiting ${wait / 1000}s`);
    await sleep(wait);
  }
};

// Optional app-id filter: `node scripts/fetch-art.mjs 1623730 949230`.
// With no arguments every app is considered, but one that already has its header
// downloaded is skipped - re-fetching 30+ apps to add one is what triggered the
// rate limit above. Pass --force to refresh art that is already present.
const ARGS = process.argv.slice(2);
const FORCE = ARGS.includes("--force");
const ONLY = ARGS.filter((a) => !a.startsWith("--"));

for (const id of IDS.filter((i) => !ONLY.length || ONLY.includes(i))) {
  if (!FORCE && existsSync(join(ART, `${id}-header.jpg`))) {
    continue;
  }
  const r = await get(`https://store.steampowered.com/api/appdetails?appids=${id}&cc=my&l=en`);
  const d = (await r.json())[id];
  if (!d?.success) throw new Error(`appdetails failed for ${id}`);
  const g = d.data;
  const shots = (g.screenshots ?? []).slice(0, 8).map((s) => s.path_full);
  console.log(`${id}\t${g.name}\t${shots.length} shots`);
  // NEVER take g.header_image directly. Steam swaps that field to a SEASONAL ALT
  // CAPSULE during a promotion, and appdetails serves whatever is current. On
  // 2026-09-08 HITMAN's header_image was header_alt_assets_13.jpg — a Snoop Dogg
  // crossover capsule with "PLAY FOR FREE NOW" printed across it. It rendered
  // straight into banner-1: the wrong game's marketing AND a free-to-play claim,
  // on a paid listing. `project-steamshare-c7` predicted the swap risk; the free
  // claim was worse than predicted.
  //
  // The canonical capsule at /header.jpg is stable and is what a buyer recognises,
  // so prefer it and fall back to header_image only if it is genuinely missing.
  const canonicalHeader = `https://cdn.akamai.steamstatic.com/steam/apps/${id}/header.jpg`;
  let headerUrl = canonicalHeader;
  try {
    const probe = await fetch(canonicalHeader, { method: "HEAD", redirect: "follow" });
    if (!probe.ok) headerUrl = g.header_image;
  } catch {
    headerUrl = g.header_image;
  }
  if (headerUrl !== canonicalHeader) {
    console.log(`  ! ${id}: canonical header.jpg unavailable, falling back to header_image — EYEBALL banner-1 before publishing`);
  }
  const jobs = [["header", headerUrl], ...shots.map((u, i) => [`shot${i + 1}`, u])];
  for (const [tag, url] of jobs) {
    const img = await get(url);
    writeFileSync(join(ART, `${id}-${tag}.jpg`), Buffer.from(await img.arrayBuffer()));
  }

  // The transparent wordmark Steam uses on a library page. Not part of appdetails
  // and not present for every app (How to Fish, 4001890, has none), so this is a
  // best-effort fetch - the site-card renderer falls back to typesetting the title.
  const logo = await fetch(`https://cdn.cloudflare.steamstatic.com/steam/apps/${id}/logo.png`);
  if (logo.ok) {
    writeFileSync(join(ART, `${id}-logo.png`), Buffer.from(await logo.arrayBuffer()));
  } else {
    console.log(`  no logo.png for ${id} (${logo.status}) - card will typeset the title`);
  }

  // Wide illustrated key art (1920x620), the background of a Steam library page.
  // Useful as a card background for games whose screenshots are all dense UI -
  // Stacklands is entirely card tables, with no photogenic frame to pick.
  const hero = await fetch(`https://cdn.cloudflare.steamstatic.com/steam/apps/${id}/library_hero.jpg`);
  if (hero.ok) {
    writeFileSync(join(ART, `${id}-hero.jpg`), Buffer.from(await hero.arrayBuffer()));
  }
}
console.log("done");
