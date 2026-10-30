/**
 * Download each game's official Steam trailer, and render a frame strip from it.
 *
 * WHAT THIS IS: Steam's `appdetails` exposes a `movies` array — the publisher's own
 * trailers, same CDN the screenshots come from. This downloads the one Steam marks
 * `highlight` (the trailer shown first on the store page) and nothing else. We do
 * not create gameplay footage; there is no way to.
 *
 * WHY HLS AND NOT MP4: Steam stopped serving plain `mp4`/`webm` URLs in the movies
 * payload. What is left is `dash_h264` (.mpd) and `hls_h264` (.m3u8). ffmpeg reads
 * both, but seeking a DASH manifest with -ss fails partway ("Error when loading
 * first fragment"), so this pulls the whole trailer over HLS with -c copy and lets
 * gen-clips.mjs cut locally.
 *
 * The frame strip exists so the 12-second window is *chosen*, not guessed: trailers
 * open on publisher logos and cinematics, and the first 12 seconds are almost never
 * gameplay.
 *
 * Output (all gitignored):
 *   scripts/art/video/<appid>-trailer.mp4   full trailer
 *   scripts/out/<slug>-strip.png            8 evenly-spaced frames, timestamped
 *
 * ffmpeg is not a project dependency. Point FFMPEG at a binary:
 *   FFMPEG=/path/to/ffmpeg.exe node scripts/fetch-trailers.mjs [slug ...]
 *
 * Usage: node scripts/fetch-trailers.mjs                 # every game
 *        node scripts/fetch-trailers.mjs sekiro-shadows-die-twice
 */
import { mkdirSync, writeFileSync, existsSync, statSync } from "fs";
import { execFileSync, spawnSync } from "child_process";
import { join } from "path";
import { GAMES } from "./games-data.mjs";

const HERE = import.meta.dirname;
const VID = join(HERE, "art", "video");
const OUT = join(HERE, "out");
mkdirSync(VID, { recursive: true });
mkdirSync(OUT, { recursive: true });

const FFMPEG = process.env.FFMPEG;
if (!FFMPEG || !existsSync(FFMPEG)) {
  console.error(
    "\nSet FFMPEG to an ffmpeg binary. ffmpeg is not installed here and is not a\n" +
      "project dependency; `npm i ffmpeg-static` outside the repo gives you one at\n" +
      "node_modules/ffmpeg-static/ffmpeg.exe\n",
  );
  process.exit(1);
}

const ff = (args) => execFileSync(FFMPEG, ["-hide_banner", "-loglevel", "error", ...args], { stdio: "inherit" });

const ONLY = process.argv.slice(2);
const picked = GAMES.filter((g) => !ONLY.length || ONLY.includes(g.slug));

for (const g of picked) {
  const mp4 = join(VID, `${g.id}-trailer.mp4`);

  if (existsSync(mp4) && statSync(mp4).size > 0) {
    console.log(`${g.slug}: trailer already downloaded`);
  } else {
    const r = await fetch(`https://store.steampowered.com/api/appdetails?appids=${g.id}&cc=my&l=en`);
    const data = (await r.json())[g.id];
    const movies = data?.data?.movies ?? [];
    if (!movies.length) {
      console.log(`${g.slug}: NO TRAILER on Steam - skipped`);
      continue;
    }
    // Steam flags the store page's lead trailer with `highlight`. Fall back to the
    // first entry, which is the same one in practice for apps that flag nothing.
    const movie = movies.find((m) => m.highlight) ?? movies[0];
    const url = movie.hls_h264 ?? movie.dash_h264;
    if (!url) {
      console.log(`${g.slug}: trailer has no h264 stream - skipped`);
      continue;
    }
    console.log(`${g.slug}: downloading "${movie.name}"`);
    ff(["-i", url, "-c", "copy", "-y", mp4]);
  }

  // Frame strip: 8 stills across the trailer, each labelled with its timestamp so a
  // start offset can be read straight off the sheet.
  // ffmpeg-static ships no ffprobe, so duration is read off ffmpeg's own stderr.
  // execFileSync returns stdout, which is empty here - spawnSync is the one that
  // hands back stderr.
  const probe = spawnSync(FFMPEG, ["-hide_banner", "-i", mp4], { encoding: "utf8" }).stderr ?? "";
  const d = /Duration: (\d+):(\d+):(\d+\.\d+)/.exec(probe);
  if (!d) {
    console.log(`  ${g.slug}: could not read duration - skipped`);
    continue;
  }
  const dur = Number(d[1]) * 3600 + Number(d[2]) * 60 + Number(d[3]);

  const n = 8;
  const times = Array.from({ length: n }, (_, i) => +((dur * (i + 0.5)) / n).toFixed(1));
  const frames = [];
  for (const [i, t] of times.entries()) {
    const f = join(OUT, `_frame-${g.slug}-${i}.jpg`);
    ff(["-ss", String(t), "-i", mp4, "-frames:v", "1", "-vf", "scale=320:-2", "-q:v", "4", "-y", f]);
    frames.push([t, f]);
  }

  writeFileSync(
    join(OUT, `${g.slug}-strip.json`),
    JSON.stringify({ slug: g.slug, duration: dur, frames: frames.map(([t]) => t) }, null, 1),
  );
  console.log(`  ${g.slug}: ${dur.toFixed(1)}s trailer, ${n} frames at ${times.join(", ")}`);
}
