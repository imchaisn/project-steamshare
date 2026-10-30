/**
 * Cut a short gameplay clip per game from its downloaded Steam trailer.
 *
 * Run scripts/fetch-trailers.mjs first. Output goes to local/video/<slug>.mp4 --
 * local/ is gitignored, and that is deliberate: this is the publisher's footage,
 * ~2-6 MB a clip, and the repo is public. It must not be committed.
 *
 * Encoding targets Shopee's product-video slot: H.264/AAC MP4, 720p, faststart,
 * 12 seconds (their window is 10-60s, and the ask was 10-15).
 *
 * START OFFSETS: CLIP_START below holds a hand-picked second for each game, read
 * off the frame strips that fetch-trailers.mjs renders. Anything not listed falls
 * back to 40% in, which skips the logo/cinematic opening most trailers have but is
 * a guess -- check the frame strip and add an entry rather than trusting it.
 *
 * Usage: FFMPEG=/path/to/ffmpeg.exe node scripts/gen-clips.mjs [slug ...]
 */
import { mkdirSync, existsSync, statSync } from "fs";
import { execFileSync, spawnSync } from "child_process";
import { join } from "path";
import { GAMES } from "./games-data.mjs";

const HERE = import.meta.dirname;
const VID = join(HERE, "art", "video");
const OUT = join(HERE, "..", "local", "video");
mkdirSync(OUT, { recursive: true });

const FFMPEG = process.env.FFMPEG;
if (!FFMPEG || !existsSync(FFMPEG)) {
  console.error("\nSet FFMPEG to an ffmpeg binary (see scripts/fetch-trailers.mjs).\n");
  process.exit(1);
}

const SECONDS = 12;

/** slug -> start second, picked off scripts/out/<slug>-strip.png. */
const CLIP_START = {
  // 81.2s trailer (Steam_No8_TGA_Trailer_SEA). Everything before ~31s is cinematic
  // with burned-in dialogue subtitles and title cards ("ENTRUSTED WITH HOPE",
  // "TEKKEN PROJECT"); the last 5s is a platform-logo end card with PS5 and Xbox
  // marks on it, which must not appear on a Shopee listing. 32s opens on the
  // densest clean gameplay run in the trailer. Subtitles do return around 40s -
  // there is no subtitle-free 12s window anywhere in this trailer, so the clip is
  // placed to put the clean gameplay first, where autoplay shows it.
  "tekken-8": 32,
};

const ONLY = process.argv.slice(2);
const picked = GAMES.filter((g) => !ONLY.length || ONLY.includes(g.slug));

for (const g of picked) {
  const src = join(VID, `${g.id}-trailer.mp4`);
  if (!existsSync(src)) {
    console.log(`${g.slug}: no trailer downloaded - run fetch-trailers.mjs first`);
    continue;
  }

  const probe = spawnSync(FFMPEG, ["-hide_banner", "-i", src], { encoding: "utf8" }).stderr ?? "";
  const d = /Duration: (\d+):(\d+):(\d+\.\d+)/.exec(probe);
  const dur = d ? Number(d[1]) * 3600 + Number(d[2]) * 60 + Number(d[3]) : 0;

  const picked_start = CLIP_START[g.slug];
  // Never run past the end: clamp so the clip always gets its full length.
  const start = Math.max(0, Math.min(picked_start ?? dur * 0.4, Math.max(0, dur - SECONDS)));

  const out = join(OUT, `${g.slug}.mp4`);
  execFileSync(
    FFMPEG,
    [
      "-hide_banner", "-loglevel", "error",
      "-ss", start.toFixed(2),
      "-i", src,
      "-t", String(SECONDS),
      // 720p, even dimensions, and audio normalised to a single stereo track so
      // every clip in the set behaves the same in a product gallery.
      "-vf", "scale=-2:720",
      "-r", "30",
      "-c:v", "libx264", "-preset", "medium", "-crf", "23", "-pix_fmt", "yuv420p",
      "-c:a", "aac", "-b:a", "128k", "-ac", "2",
      "-movflags", "+faststart",
      "-y", out,
    ],
    { stdio: "inherit" },
  );

  const mb = (statSync(out).size / 1048576).toFixed(1);
  const flag = picked_start === undefined ? "  (start GUESSED at 40% - check the strip)" : "";
  console.log(`${g.slug}: ${SECONDS}s from ${start.toFixed(1)}s, ${mb} MB${flag}`);
}
