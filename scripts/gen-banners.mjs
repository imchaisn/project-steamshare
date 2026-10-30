/**
 * Generate every piece of per-game art. Renders HTML -> PNG via headless Chrome.
 *
 * FIVE images per game. Four are the Shopee set, all 800x830, uploaded in this order:
 *   <slug>-banner-1.png  main banner  — Steam header art, delivery ribbon, claim grid
 *   <slug>-banner-2.png  feature      — one big gameplay screenshot + its headline
 *   <slug>-banner-3.png  feature      — ditto
 *   <slug>-banner-4.png  feature      — ditto
 *
 * The fifth is for gameshare.space, not Shopee:
 *   <slug>-card.png      site card    — 1200x675 (16:9), art and identity only.
 *                                       Copy to public/games/<slug>.png.
 *
 * 2026-09-05: the three gameplay shots used to be thumbnails crammed into the bottom
 * of the main banner, which made them too small to read anything from. Each one is now
 * its own banner at full width, so a buyer swiping the Shopee gallery gets three proper
 * looks at the game. Every feature banner repeats the game title, because image 3 is
 * often the first one a buyer actually opens.
 *
 * Art is not tracked. Run `node scripts/fetch-art.mjs` first to populate scripts/art/
 * from Steam's own CDN (header, 8 screenshots, wordmark and wide key art per app).
 *
 * Usage:  node scripts/fetch-art.mjs && node scripts/gen-banners.mjs [slug ...]
 * Output: scripts/out/<slug>-banner-[1-4].png  -> brand/
 *         scripts/out/<slug>-card.png          -> public/games/<slug>.png
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { execFileSync } from "child_process";
import { join } from "path";

const HERE = import.meta.dirname;
const ART = join(HERE, "art");
const OUT = join(HERE, "out");
mkdirSync(OUT, { recursive: true });

const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";

// Brand tokens lifted from app/globals.css - not invented.
const VIOLET = "#7c5cff";
const MAGENTA = "#ff4fa3";
const DARK = "#241638";

// The real GameShare "Loop Controller" mark from brand/gameshare-logo.svg.
// Strokes forced to white so it reads on the gradient bar.
const LOGO = `<svg viewBox="0 0 100 100" width="34" height="34">
  <rect x="21" y="36" width="38" height="28" rx="14" fill="none" stroke="#fff" stroke-width="7"/>
  <rect x="41" y="36" width="38" height="28" rx="14" fill="none" stroke="#fff" stroke-width="7"/>
  <circle cx="30" cy="50" r="2.4" fill="#fff"/>
  <circle cx="70" cy="45" r="2.4" fill="#fff"/>
  <circle cx="70" cy="55" r="2.4" fill="#fff"/>
</svg>`;

import { GAMES } from "./games-data.mjs";

const b64 = (p) => `data:image/jpeg;base64,${readFileSync(p).toString("base64")}`;
const art = (id, tag) => b64(join(ART, `${id}-${tag}.jpg`));
const br = (s) => s.split("\n").join("<br>");

// Shared chrome: same 800x830 canvas, same gradient bar, same footer on every image.
const shell = (bodyHtml, extraCss) => `<!doctype html><html><head><meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Archivo:wght@600;700;800;900&display=swap" rel="stylesheet">
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{width:800px;height:830px;font-family:Archivo,'Arial Black',Arial,sans-serif;background:#fff;overflow:hidden}
  .bar{height:62px;background:linear-gradient(135deg,${VIOLET} 0%,${MAGENTA} 100%);
       display:flex;align-items:center;justify-content:space-between;padding:0 26px}
  .bar span{color:#fff;font-weight:900;font-size:27px;letter-spacing:.055em}
  .right{display:flex;align-items:center;gap:11px}
  ${extraCss}
</style></head><body>
  <div class="bar"><span>STEAM</span><div class="right">${LOGO}<span>GAMESHARE</span></div></div>
  ${bodyHtml}
</body></html>`;

/** Image 1 — the main banner. Layout unchanged from the approved Duckov original. */
/**
 * SEO3, 2026-09-08: `.band` used to lead with "ADD TO YOUR STEAM LIBRARY" at 27px
 * and the game's own name at 14px. The cover (banner-1) is the ONLY image a buyer
 * sees in Shopee search results, and the largest text on it was both an unbacked
 * ownership claim (buyers get a shared account, not a personal library entry) and
 * not the term buyers scan for. Drafted 2026-09-07 (docs/listing-copy.md, "Fourth
 * art finding"), evaluated this session by actually rendering both versions and
 * downscaling to real thumbnail sizes (not just reading the CSS):
 *   - At ~168-220px (a plausible desktop/tablet search-grid size) the game name is
 *     now the clearly legible, dominant text, replacing the false claim.
 *   - At ~96px (a plausible small mobile-grid size) NEITHER version's band text is
 *     legible — it degrades to a grey smudge either way, because 14-30px source
 *     text cannot survive a >8x downscale. What actually reads at that size is the
 *     game's own logo baked into Steam's key art in `.hero` (already present,
 *     unaffected by this change). So the fix is a clear win where the band text is
 *     readable at all, and neutral (not a regression) where it isn't.
 * `titleSize` steps down as the title lengthens so it never overflows 800px —
 * checked against the longest title in the catalogue (UNCHARTED: LEGACY OF
 * THIEVES, 28 chars) and the shortest (SEKIRO, 6).
 *
 * NOT YET LIVE. This changes what the next `gen-banners.mjs` run produces; it does
 * not touch `brand/`'s existing files or anything already on Shopee. Re-rendering
 * and re-uploading 41 live listings' cover images is Chaison's call — see
 * docs/publish-packets/SEARCH-THUMBNAIL.md.
 */
function mainBanner(g) {
  const badges = ["100%\nORIGINAL", "FULL\nACCOUNT", g.badge3, "FAST\nDELIVERY"];
  const tLen = g.title.length;
  const titleSize = tLen > 34 ? 19 : tLen > 27 ? 22 : tLen > 20 ? 26 : 30;
  const css = `
  .hero{position:relative;height:375px;overflow:hidden;background:${DARK}}
  .hero img{width:100%;height:100%;object-fit:cover;display:block}
  /* Bottom-left by default. Steam header art usually keeps that corner clear, but
     not always - Empire of the Ants prints its own title there, and the ribbon sat
     straight over it. ribbonRight moves it rather than cropping the art. */
  .ribbon{position:absolute;${
    g.ribbonRight ? "right:-14px;padding:9px 30px 9px 26px;" : "left:-14px;padding:9px 26px 9px 30px;"
  }bottom:26px;background:${MAGENTA};color:#fff;
          font-weight:800;font-size:17px;letter-spacing:.07em;
          transform:skewX(-12deg);box-shadow:0 4px 14px rgba(0,0,0,.3)}
  .ribbon b{display:block;transform:skewX(12deg)}
  .band{height:84px;background:${DARK};display:flex;flex-direction:column;
        align-items:center;justify-content:center;gap:7px}
  .band h1{color:#fff;font-weight:900;font-size:${titleSize}px;letter-spacing:.02em;
           text-align:center;line-height:1.05;padding:0 22px}
  .band p{color:#c7b8ec;font-weight:700;font-size:13px;letter-spacing:.10em}
  .grid{height:245px;background:#f2effc;display:grid;grid-template-columns:1fr 1fr;
        align-content:center;justify-items:center;gap:34px 0;padding-top:6px}
  .cell{display:flex;flex-direction:column;align-items:center;gap:11px}
  .dot{width:15px;height:15px;border-radius:4px;background:linear-gradient(135deg,${VIOLET},#a78bfa)}
  .cell p{color:#1b0e2e;font-weight:800;font-size:20px;line-height:1.22;text-align:center;letter-spacing:.01em}
  .foot{height:64px;background:#f2effc;display:flex;align-items:flex-start;justify-content:center}
  .foot span{color:#8b7bb8;font-weight:700;font-size:14px;letter-spacing:.06em}`;

  const body = `
  <div class="hero"><img src="${art(g.id, "header")}"><div class="ribbon"><b>24 HOUR DELIVERY</b></div></div>
  <div class="band"><h1>${g.title.toUpperCase()}</h1><p>${g.genre} &middot; SHARED STEAM ACCOUNT</p></div>
  <div class="grid">${badges.map((b) => `<div class="cell"><div class="dot"></div><p>${br(b)}</p></div>`).join("")}</div>
  <div class="foot"><span>GAMESHARE</span></div>`;

  return shell(body, css);
}

/**
 * Images 2-4 — one gameplay screenshot at full width with its feature copy.
 * The shot gets 470px of the 830 so it is the thing the eye lands on; the
 * headline sits directly under it, big enough to read as a Shopee thumbnail.
 */
function featureBanner(g, f, index) {
  const css = `
  .shot{position:relative;height:470px;overflow:hidden;background:${DARK}}
  .shot img{width:100%;height:100%;object-fit:${f.fit ?? "cover"};display:block${
    f.pixel ? ";image-rendering:pixelated" : ""
  }}
  /* Top-RIGHT, not left: most of these games park their HUD in the top-left corner. */
  .tag{position:absolute;right:0;top:22px;background:${MAGENTA};color:#fff;font-weight:900;
       font-size:15px;letter-spacing:.12em;padding:9px 22px 9px 18px;border-radius:6px 0 0 6px;
       box-shadow:0 4px 14px rgba(0,0,0,.32)}
  .copy{height:236px;background:${DARK};display:flex;flex-direction:column;
        align-items:center;justify-content:center;gap:14px;padding:0 46px;text-align:center}
  .copy .game{color:${MAGENTA};font-weight:800;font-size:15px;letter-spacing:.16em}
  .copy h1{color:#fff;font-weight:900;font-size:38px;line-height:1.12;letter-spacing:.01em}
  .copy p{color:#c7b8ec;font-weight:600;font-size:19px;line-height:1.42;max-width:660px}
  .foot{height:62px;background:#1b0e2e;display:flex;align-items:center;justify-content:center}
  .foot span{color:#8b7bb8;font-weight:800;font-size:15px;letter-spacing:.09em}`;

  // `zoom` crops in on a screenshot - used where the source capture has a watermark or
  // a HUD element sitting in the outer few percent of the frame.
  const zoom = f.zoom ? ` style="transform:scale(${f.zoom})"` : "";

  const body = `
  <div class="shot"><img src="${art(g.id, `shot${f.shot}`)}"${zoom}>
    <div class="tag">0${index} / 03</div></div>
  <div class="copy">
    <div class="game">${g.title}</div>
    <h1>${f.head}</h1>
    <p>${f.body}</p>
  </div>
  <div class="foot"><span>GAMESHARE</span></div>`;

  return shell(body, css);
}

/**
 * The /games card on gameshare.space. 1200x675 (16:9), a different job from the
 * Shopee banners: the page already prints the title, genre and every claim as
 * real text beside it, so repeating them inside the image is pure duplication.
 * The card carries art and identity only.
 *
 * Background is a native 1920x1080 screenshot - no upscaling, unlike the 460x215
 * Steam header - under Steam's own transparent wordmark. Nine of the ten games
 * have that wordmark; How to Fish does not, so its title is typeset instead.
 */
function siteCard(g) {
  const c = g.card ?? { shot: g.features[0].shot };
  const zoom = c.zoom ? `transform:scale(${c.zoom});` : "";

  // Background: a gameplay screenshot by default (native 1920x1080, no upscaling).
  // `art: "hero"` swaps in Steam's wide illustrated key art instead - the escape
  // hatch for a game with no photogenic screenshot.
  const bg = c.art === "hero" ? art(g.id, "hero") : art(g.id, `shot${c.shot}`);

  // `useTitle` overrides the wordmark where Steam's logo.png is unusable - Stacklands'
  // is a small mark floating in a mostly-transparent canvas, so object-fit:contain
  // sizes it to the padding and it renders tiny however the min/max box is set.
  const hasLogo = !c.useTitle && existsSync(join(ART, `${g.id}-logo.png`));

  const mark = hasLogo
    ? `<img class="wordmark" src="data:image/png;base64,${readFileSync(
        join(ART, `${g.id}-logo.png`),
      ).toString("base64")}">`
    : `<h1>${g.title}</h1>`;

  return `<!doctype html><html><head><meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Archivo:wght@600;700;800;900&display=swap" rel="stylesheet">
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{width:1200px;height:675px;font-family:Archivo,'Arial Black',Arial,sans-serif;
       background:${DARK};overflow:hidden;position:relative}
  .bg{position:absolute;inset:0}
  .bg img{width:100%;height:100%;object-fit:${c.fit ?? "cover"};display:block;${zoom}${
    c.pixel ? "image-rendering:pixelated;" : ""
  }}
  /* Two scrims: a flat one to stop bright art washing out the wordmark, and a
     bottom gradient so the wordmark always has dark behind it. */
  .veil{position:absolute;inset:0;background:rgba(20,10,36,.30)}
  .fade{position:absolute;inset:0;background:linear-gradient(to top,
        rgba(20,10,36,.94) 0%,rgba(20,10,36,.72) 22%,rgba(20,10,36,0) 52%)}
  .plate{position:absolute;left:52px;right:52px;bottom:46px;display:flex;
         align-items:flex-end;justify-content:space-between;gap:32px}
  /* Steam's wordmarks vary wildly in intrinsic size - Batman's is ~10x Stacklands'.
     min-* forces the small ones up (object-fit:contain scales both ways) and max-*
     caps the large ones, so every card's wordmark lands in the same visual band. */
  .wordmark{min-width:330px;max-width:560px;min-height:100px;max-height:190px;
            object-fit:contain;object-position:left bottom;
            filter:drop-shadow(0 6px 20px rgba(0,0,0,.6))}
  .plate h1{color:#fff;font-weight:900;font-size:62px;line-height:1.02;letter-spacing:.01em;
            max-width:640px;text-shadow:0 6px 20px rgba(0,0,0,.65)}
  .brand{display:flex;align-items:center;gap:10px;background:rgba(20,10,36,.72);
         border:1px solid rgba(255,255,255,.14);border-radius:999px;padding:10px 18px 10px 14px;
         flex:none}
  .brand span{color:#fff;font-weight:800;font-size:17px;letter-spacing:.07em}
  .genre{position:absolute;left:52px;top:44px;background:linear-gradient(135deg,${VIOLET},${MAGENTA});
         color:#fff;font-weight:800;font-size:16px;letter-spacing:.13em;padding:9px 18px;
         border-radius:999px;box-shadow:0 6px 18px rgba(0,0,0,.4)}
</style></head><body>
  <div class="bg"><img src="${bg}"></div>
  <div class="veil"></div>
  <div class="fade"></div>
  <div class="genre">${g.genre.toUpperCase()}</div>
  <div class="plate">
    ${mark}
    <div class="brand">${LOGO}<span>GAMESHARE</span></div>
  </div>
</body></html>`;
}

function render(name, markup, width = 800, height = 830) {
  const f = join(OUT, `${name}.html`);
  writeFileSync(f, markup, "utf8");
  execFileSync(
    CHROME,
    [
      "--headless",
      "--disable-gpu",
      "--hide-scrollbars",
      `--window-size=${width},${height}`,
      `--screenshot=${join(OUT, name + ".png")}`,
      "--virtual-time-budget=8000",
      "file:///" + f.split("\\").join("/"),
    ],
    { stdio: "ignore" },
  );
  console.log("rendered", name + ".png");
}

// Optional slug filter: `node scripts/gen-banners.mjs stacklands batman-arkham-knight`
// re-renders just those. No arguments renders the whole catalogue.
const ONLY = process.argv.slice(2);

for (const g of GAMES.filter((g) => !ONLY.length || ONLY.includes(g.slug))) {
  render(`${g.slug}-banner-1`, mainBanner(g));
  g.features.forEach((f, i) => render(`${g.slug}-banner-${i + 2}`, featureBanner(g, f, i + 1)));
  render(`${g.slug}-card`, siteCard(g), 1200, 675);
}
