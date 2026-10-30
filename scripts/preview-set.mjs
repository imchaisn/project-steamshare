/**
 * Contact sheet of the rendered banner set - one row of 4 per game, so the whole
 * upload order can be checked at a glance before anything is copied into brand/.
 * Run after gen-banners.mjs. Output: scripts/out/preview.png
 */
import { readFileSync, writeFileSync } from "fs";
import { execFileSync } from "child_process";
import { join } from "path";

const HERE = import.meta.dirname;
const OUT = join(HERE, "out");
const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";

const SLUGS = [
  "dave-the-diver",
  "euro-truck-simulator-2",
  "schedule-1",
  "escape-from-duckov",
  "dokimon-quest",
  "how-to-fish",
  "lords-of-the-fallen-2014",
  "stacklands",
  "tribes-of-midgard",
  "batman-arkham-knight",
  "ghost-of-tsushima",
  "deltarune",
  "fantasy-life-i",
  "into-the-dead-our-darkest-days",
  "tcg-card-shop-simulator",
  "norland",
  "dynasty-warriors-origins",
  "love-is-all-around",
  "thronefall",
  "indiana-jones-great-circle",
  "warriors-orochi-3-ultimate",
  "empire-of-the-ants",
  "storyteller",
  "black-myth-wukong",
  "resident-evil-requiem",
  "horizon-zero-dawn-remastered",
  "star-wars-outlaws",
  "assassins-creed-shadows",
  "god-of-war-ragnarok",
  "assassins-creed-valhalla",
  "cyberpunk-2077",
  "metal-gear-solid-delta-snake-eater",
  "sekiro-shadows-die-twice",
  "marvels-spider-man-2",
  "cities-skylines-2",
  "the-last-of-us-part-2-remastered",
  "palworld",
  "red-dead-redemption-2",

  // gamersfantasy.my, added 2026-09-07. Split Fiction came in with this batch but
  // has no games-data entry - see the note at the end of scripts/games-data.mjs.
  "tekken-8",
  "ready-or-not",
  "wwe-2k26",
  "football-manager-26",
  "call-of-duty-wwii",
  "ea-sports-fc-26",
  "uncharted-legacy-of-thieves",
  "subnautica-2",
  "final-fantasy-16",
];

const b64 = (p) => `data:image/png;base64,${readFileSync(join(OUT, p)).toString("base64")}`;

// `--cards` previews the 16:9 gameshare.space cards instead of the Shopee sets,
// three to a row, roughly the width they render at in the /games grid.
const args = process.argv.slice(2);
const CARDS = args.includes("--cards");
const ONLY = args.filter((a) => !a.startsWith("--"));
const picked = SLUGS.filter((s) => !ONLY.length || ONLY.includes(s));

const rows = CARDS
  ? chunk(picked, 3)
      .map(
        (group) =>
          `<div class="row">${group
            .map((slug) => `<figure><img src="${b64(`${slug}-card.png`)}"><figcaption>${slug}-card</figcaption></figure>`)
            .join("")}</div>`,
      )
      .join("")
  : picked
      .map((slug) => {
        const cells = [1, 2, 3, 4]
          .map((n) => `<figure><img src="${b64(`${slug}-banner-${n}.png`)}"><figcaption>${slug}-banner-${n}</figcaption></figure>`)
          .join("");
        return `<div class="row">${cells}</div>`;
      })
      .join("");

function chunk(xs, n) {
  const out = [];
  for (let i = 0; i < xs.length; i += n) out.push(xs.slice(i, i + n));
  return out;
}

// The sheet is rendered in one screenshot, so the window has to be tall enough to
// hold every row - 25 games is far past the fixed height this started with.
const rowCount = (rows.match(/class="row"/g) ?? []).length;

const html = `<!doctype html><meta charset="utf-8"><style>
body{margin:0;background:#111;color:#fff;font:12px system-ui;width:1500px}
.row{display:flex;gap:10px;padding:8px 10px}
figure{margin:0;flex:1} img{width:100%;display:block;border-radius:4px}
figcaption{text-align:center;font-size:11px;color:#aaa;padding-top:3px}
</style>${rows}`;

const f = join(OUT, "preview.html");
writeFileSync(f, html, "utf8");
execFileSync(
  CHROME,
  [
    "--headless",
    "--disable-gpu",
    "--hide-scrollbars",
    `--window-size=1500,${Math.max(600, 40 + rowCount * (CARDS ? 300 : 700))}`,
    `--screenshot=${join(OUT, "preview.png")}`,
    "--virtual-time-budget=10000",
    "file:///" + f.split("\\").join("/"),
  ],
  { stdio: "ignore" },
);
console.log(join(OUT, "preview.png"));
