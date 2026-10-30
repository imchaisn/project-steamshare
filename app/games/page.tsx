import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Logo } from "@/components/Logo";
import { catalogueEntry, helpLink, shopeeUrl } from "@/lib/catalogue";
import { createAdminClient } from "@/utils/supabase/admin";

export const metadata: Metadata = {
  title: "Game Library — GameShare",
  description:
    "Every game GameShare stocks shared Steam account access for. Buy on Shopee, then get your login and a live Steam Guard code here.",
};

/**
 * The library is read from the `games` table rather than from the static
 * CATALOGUE list, so a game added to the database shows up here without a code
 * change. CATALOGUE only supplies what the table cannot: art, genre, and
 * whether the game is actually purchasable today.
 *
 * A game with no CATALOGUE entry still renders, deliberately -- with no art and
 * an "art coming soon" note. Dropping it would make a newly-added game silently
 * invisible, which is the same failure mode as the unmapped Shopee listing
 * documented in CHECKPOINT.md: wrong, and quiet about it.
 */
// Without this the page is prerendered once at build, and a new `games` row
// would need a deploy after all. A failed refresh keeps serving the last good page.
export const revalidate = 3600;

export default async function GamesPage() {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("games")
    .select("id, title, steam_app_id")
    .order("title");

  if (error) {
    throw new Error(`Could not load the game library: ${error.message}`);
  }

  const games = (data ?? []).map((g) => ({ ...g, entry: catalogueEntry(g.steam_app_id) }));
  const buyable = games.filter((g) => g.entry?.shopeeItemId).length;

  return (
    <main className="bg-dopamine min-h-screen text-ink p-6">
      <div className="mx-auto w-full max-w-5xl space-y-8 py-8">
        <header className="space-y-2">
          <Link href="/" className="flex items-center gap-2 hover:opacity-80">
            <Logo size={24} />
            <span className="font-semibold tracking-tight">GameShare</span>
          </Link>
          <h1 className="text-2xl font-semibold">Game Library</h1>
          <p className="max-w-2xl text-sm text-ink-dim">
            Shared Steam account access, delivered within 24 hours of your Shopee
            order. {buyable} of {games.length} titles are on the shop right now.
          </p>
        </header>

        <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {games.map((game) => {
            const { entry } = game;
            const itemId = entry?.shopeeItemId;
            /*
             * Attaches to the `games` row, NOT to the CATALOGUE entry. See
             * lib/catalogue.ts for what this link is and the warning on it.
             */
            const help = helpLink(game.steam_app_id);
            return (
              <li
                key={game.id}
                className="flex flex-col overflow-hidden rounded-lg border border-line bg-surface-1"
              >
                {entry ? (
                  <Image
                    src={`/games/${entry.slug}.png`}
                    alt={`${game.title} — key art`}
                    width={1200}
                    height={675}
                    className="w-full"
                    sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                  />
                ) : (
                  <div className="flex aspect-video items-center justify-center border-b border-line-dim px-4 text-center text-xs text-ink-dim">
                    Art coming soon
                  </div>
                )}

                <div className="flex flex-1 flex-col gap-3 p-4">
                  <div className="space-y-1">
                    <h2 className="font-semibold leading-tight">{game.title}</h2>
                    <p className="text-xs text-ink-dim">{entry?.genre ?? "Steam PC game"}</p>
                  </div>

                  <div className="mt-auto">
                    {itemId ? (
                      <a
                        href={shopeeUrl(itemId)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-dopamine block rounded px-3 py-2 text-center text-sm font-semibold"
                      >
                        Buy on Shopee
                      </a>
                    ) : (
                      <span className="block rounded border border-line-dim px-3 py-2 text-center text-sm text-ink-dim">
                        Not on Shopee right now
                      </span>
                    )}

                    {/*
                     * rel="nofollow" so this outbound link passes no ranking
                     * signal; it is a support link, not an endorsement, and it
                     * is not something we want crawlers treating as a citation.
                     */}
                    {help ? (
                      <a
                        href={help.url}
                        target="_blank"
                        rel="nofollow noopener noreferrer"
                        className="mt-2 block text-center text-xs text-accent-light hover:underline"
                      >
                        {help.label}
                      </a>
                    ) : null}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>

        <footer className="border-t border-line pt-6 text-sm text-ink-dim">
          <p>
            Already ordered?{" "}
            <Link href="/" className="text-accent-light hover:underline">
              Get your login code
            </Link>
            {" · "}
            <Link href="/terms" className="text-accent-light hover:underline">
              Terms &amp; refund policy
            </Link>
          </p>
        </footer>
      </div>
    </main>
  );
}
