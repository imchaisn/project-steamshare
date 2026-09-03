/**
 * Generate Shopee product banners for each game, matching the approved
 * Escape From Duckov banner. Renders HTML -> PNG via headless Chrome.
 */
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { execFileSync } from "child_process";
import { join } from "path";

const HERE = import.meta.dirname;
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

const GAMES = [
  { id: "1868140", slug: "dave-the-diver",        genre: "Adventure RPG",        title: "DAVE THE DIVER",          badge3: "FREE DLC\nINCLUDED" },
  { id: "227300",  slug: "euro-truck-simulator-2",genre: "Trucking Simulation",  title: "Euro Truck Simulator 2",  badge3: "FREE DLC\nINCLUDED" },
  { id: "3164500", slug: "schedule-1",            genre: "Simulation / Strategy",title: "Schedule I",              badge3: "ONLINE\nCO-OP" },
  { id: "3167020", slug: "escape-from-duckov",    genre: "PVE Survival RPG",     title: "Escape From Duckov",      badge3: "FREE DLC\nINCLUDED" },
  { id: "2019300", slug: "dokimon-quest",         genre: "Monster-Taming RPG",   title: "Dokimon Quest",           badge3: "FREE DLC\nINCLUDED" },
  { id: "4001890", slug: "how-to-fish",           genre: "Co-op Fishing Sim",    title: "How to Fish",             badge3: "ONLINE\nCO-OP" },
];

const b64 = (p) => readFileSync(p).toString("base64");

function html(g) {
  const art = `data:image/jpeg;base64,${b64(join(HERE, "art", `${g.id}.jpg`))}`;
  const badges = ["100%\nORIGINAL", "FULL\nACCOUNT", g.badge3, "FAST\nDELIVERY"];
  return `<!doctype html><html><head><meta charset="utf-8">
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
  .hero{position:relative;height:375px;overflow:hidden;background:${DARK}}
  .hero img{width:100%;height:100%;object-fit:cover;display:block}
  .ribbon{position:absolute;left:-14px;bottom:26px;background:${MAGENTA};color:#fff;
          font-weight:800;font-size:17px;letter-spacing:.07em;padding:9px 26px 9px 30px;
          transform:skewX(-12deg);box-shadow:0 4px 14px rgba(0,0,0,.3)}
  .ribbon b{display:block;transform:skewX(12deg)}
  .band{height:84px;background:${DARK};display:flex;flex-direction:column;
        align-items:center;justify-content:center;gap:7px}
  .band h1{color:#fff;font-weight:900;font-size:27px;letter-spacing:.035em}
  .band p{color:#c7b8ec;font-weight:600;font-size:14px;letter-spacing:.02em}
  .grid{height:245px;background:#f2effc;display:grid;grid-template-columns:1fr 1fr;
        align-content:center;justify-items:center;gap:34px 0;padding-top:6px}
  .cell{display:flex;flex-direction:column;align-items:center;gap:11px}
  .dot{width:15px;height:15px;border-radius:4px;background:linear-gradient(135deg,${VIOLET},#a78bfa)}
  .cell p{color:#1b0e2e;font-weight:800;font-size:20px;line-height:1.22;text-align:center;letter-spacing:.01em}
  .foot{height:64px;background:#f2effc;display:flex;align-items:flex-start;justify-content:center}
  .foot span{color:#8b7bb8;font-weight:700;font-size:14px;letter-spacing:.06em}
</style></head><body>
  <div class="bar"><span>STEAM</span><div class="right">${LOGO}<span>GAMESHARE</span></div></div>
  <div class="hero"><img src="${art}"><div class="ribbon"><b>24 HOUR DELIVERY</b></div></div>
  <div class="band"><h1>ADD TO YOUR STEAM LIBRARY</h1><p>${g.genre} &middot; ${g.title}</p></div>
  <div class="grid">${badges.map((b) => `<div class="cell"><div class="dot"></div><p>${b.replace(/\n/g, "<br>")}</p></div>`).join("")}</div>
  <div class="foot"><span>gameshare.space</span></div>
</body></html>`;
}

for (const g of GAMES) {
  const f = join(OUT, `${g.slug}.html`);
  writeFileSync(f, html(g), "utf8");
  execFileSync(CHROME, [
    "--headless", "--disable-gpu", "--hide-scrollbars",
    "--window-size=800,830",
    `--screenshot=${join(OUT, g.slug + ".png")}`,
    `--virtual-time-budget=6000`,
    `file:///${f.replace(/\\/g, "/")}`,
  ], { stdio: "ignore" });
  console.log("rendered", g.slug + ".png");
}
