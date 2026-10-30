import { existsSync } from "node:fs";
import { afterEach, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { CATALOGUE, catalogueEntry, helpLink } from "./catalogue.ts";

/** Black Myth: Wukong. */
const WUKONG = 2358720;
const HELP_URL = "https://example.com/help";

beforeEach(() => {
  process.env.WUKONG_HELP_URL = HELP_URL;
});

afterEach(() => {
  delete process.env.WUKONG_HELP_URL;
});

test("finds the Wukong help link by numeric app id", () => {
  assert.equal(helpLink(WUKONG)?.url, HELP_URL);
});

test("renders no help link when the env var is unset", () => {
  delete process.env.WUKONG_HELP_URL;
  assert.equal(helpLink(WUKONG), undefined);
});

test("finds a catalogue entry when the app id arrives as a STRING", () => {
  assert.equal(catalogueEntry("4348910")?.slug, "probably-stolen");
});

test("every catalogue entry has its card art and a unique app id", () => {
  for (const { slug } of CATALOGUE) {
    assert.equal(existsSync(`public/games/${slug}.png`), true, slug);
  }
  assert.equal(new Set(CATALOGUE.map((e) => e.steamAppId)).size, CATALOGUE.length);
});

test("finds it when the app id arrives as a STRING", () => {
  /*
   * PostgREST serialises Postgres bigint as a JSON *string*, so
   * `games.steam_app_id` reaches the page as "2358720", never 2358720. The
   * generated row type still says number, so TypeScript raises nothing.
   *
   * catalogueEntry() documents this exact trap and the outage it caused: a
   * Map<number, ...> lookup missed on every row and every card silently fell
   * back to its empty state. A lookup here that skipped Number() would fail
   * the same way — the link would simply never render, on a page that looks
   * perfectly fine.
   */
  assert.deepEqual(helpLink(String(WUKONG)), helpLink(WUKONG));
});

test("returns undefined for a game with no help link", () => {
  assert.equal(helpLink(227300), undefined); // Euro Truck Simulator 2
});
