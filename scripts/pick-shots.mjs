import { readFileSync, writeFileSync, readdirSync, mkdirSync } from "fs";
import { execFileSync } from "child_process";
import { join } from "path";

const HERE = import.meta.dirname;
const ART = join(HERE, "art");
const OUT = join(HERE, "out");
mkdirSync(OUT, { recursive: true });

const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const NAMES = {
  1868140: "DAVE",
  227300: "ETS2",
  3164500: "SCHED",
  3167020: "DUCKOV",
  2019300: "DOKI",
  4001890: "FISH",
  265300: "LOTF",
  1948280: "STACKLANDS",
  858820: "MIDGARD",
  208650: "BATMAN",
  1624540: "STORYTELLER",
  1671210: "DELTARUNE",
  1857090: "NORLAND",
  1879330: "OROCHI3",
  2215430: "TSUSHIMA",
  2239150: "THRONEFALL",
  2239710: "INTODEAD",
  2287330: "ANTS",
  2322560: "LOVEALL",
  2358720: "WUKONG",
  2384580: "DWORIGINS",
  2677660: "INDIANA",
  2993780: "FANTASYLIFE",
  3070070: "TCGSHOP",
  3764200: "REREQUIEM",
  814380: "SEKIRO",
  949230: "SKYLINES2",
  1174180: "RDR2",
  1623730: "PALWORLD",
  2531310: "TLOU2",
  2651280: "SPIDERMAN2",
  1091500: "CYBERPUNK",
  2208920: "ACVALHALLA",
  2322010: "GOWRAG",
  2417610: "MGSDELTA",
  2561580: "HORIZON",
  2842040: "OUTLAWS",
  3159330: "ACSHADOWS",
  1778820: "TEKKEN8",
  1144200: "READYORNOT",
  3717070: "WWE2K26",
  3551340: "FM26",
  476600: "CODWWII",
  3405690: "EAFC26",
  1659420: "UNCHARTED",
  1962700: "SUBNAUTICA2",
  2001120: "SPLITFICTION",
  2515020: "FF16",
};

const b64 = (p) => `data:image/jpeg;base64,${readFileSync(join(ART, p)).toString("base64")}`;
const files = readdirSync(ART).filter((f) => f.includes("-shot"));

const ONLY = process.argv.slice(2);
const rows = Object.keys(NAMES).filter((id) => !ONLY.length || ONLY.includes(id))
  .map((id) => {
    const shots = files.filter((f) => f.startsWith(id + "-shot")).sort();
    const cells = shots
      .map((f) => `<figure><img src="${b64(f)}"><figcaption>${/shot\d/.exec(f)[0]}</figcaption></figure>`)
      .join("");
    return `<div class="row"><h2>${NAMES[id]} ${id}</h2><div class="strip">${cells}</div></div>`;
  })
  .join("");

const rowCount = (rows.match(/class="row"/g) ?? []).length;
const html = `<!doctype html><meta charset="utf-8"><style>
body{margin:0;background:#111;color:#fff;font:12px system-ui;width:1600px}
.row{padding:6px 10px} h2{font-size:15px;margin:4px 0}
.strip{display:flex;gap:6px} figure{margin:0;flex:1} img{width:100%;display:block;border-radius:3px}
figcaption{text-align:center;font-size:11px;color:#aaa}
</style>${rows}`;

const f = join(OUT, "sheet.html");
writeFileSync(f, html, "utf8");
execFileSync(
  CHROME,
  [
    "--headless",
    "--disable-gpu",
    "--hide-scrollbars",
    `--window-size=1600,${Math.max(600, 60 + rowCount * 172)}`,
    `--screenshot=${join(OUT, "sheet.png")}`,
    "--virtual-time-budget=8000",
    "file:///" + f.split("\\").join("/"),
  ],
  { stdio: "ignore" },
);
console.log(join(OUT, "sheet.png"));
