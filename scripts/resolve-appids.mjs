/**
 * Resolve a loose game name to a Steam app id.
 *
 * The supplier order tables in local/websites/ record games the way the supplier
 * labels them -- "DW Origins", "Orochi 3", "TCG Card" -- which are not Steam titles.
 * Guessing an app id from a name like that is how Tribes of Midgard nearly shipped
 * with Maiden and Spell's art (see docs/shopee-listings.md). This prints candidates
 * so the pick is made against Steam's own index, not from memory.
 *
 * Usage: node scripts/resolve-appids.mjs "DW Origins" "Orochi 3" ...
 */
const terms = process.argv.slice(2);

for (const term of terms) {
  const url = `https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(term)}&cc=my&l=en`;
  const r = await fetch(url);
  const j = await r.json();
  const hits = (j.items ?? []).slice(0, 4);
  console.log(`\n${term}`);
  if (!hits.length) {
    console.log("  (no results)");
    continue;
  }
  for (const h of hits) console.log(`  ${String(h.id).padEnd(9)} ${h.name}`);
}
