/**
 * The game list every asset script shares: banners, site cards, and trailer clips.
 *
 * Extracted from gen-banners.mjs on 2026-09-06 so that fetch-trailers.mjs and
 * gen-clips.mjs read the same slugs and app ids rather than keeping a second copy
 * that drifts. Nothing about the data changed in the move.
 */
// `shot` numbers point at scripts/art/<id>-shot<n>.jpg, hand-picked off the contact
// sheet (scripts/pick-shots.mjs) to show three DIFFERENT sides of the game - a scene,
// a system, and a hook - rather than three views of the same thing.
//
// Headline + body are trimmed from the bullet lists in docs/shopee-listings.md, same
// claims discipline: nothing about "instant" delivery, no refund promises.
export const GAMES = [
  {
    id: "1868140",
    slug: "dave-the-diver",
    genre: "Adventure RPG",
    title: "DAVE THE DIVER",
    badge3: "FREE DLC\nINCLUDED",
    card: { shot: 4 },
    features: [
      { shot: 1, head: "DIVE THE BLUE HOLE", body: "A sea that never generates the same map twice. Harvest what you catch on the way down." },
      { shot: 2, head: "RUN THE SUSHI BAR", body: "Menu, staff, upgrades, regulars — grow a street stall into the best bar in town." },
      { shot: 8, head: "BOSSES &amp; SIDE STORIES", body: "Dozens of side quests, mini-games and boss encounters between dives." },
    ],
  },
  {
    id: "227300",
    slug: "euro-truck-simulator-2",
    genre: "Trucking Simulation",
    title: "EURO TRUCK SIMULATOR 2",
    badge3: "FREE DLC\nINCLUDED",
    card: { shot: 2 },
    features: [
      { shot: 2, head: "HAUL CARGO ACROSS EUROPE", body: "Take contracts and drive real routes between dozens of European cities." },
      { shot: 4, head: "LICENSED TRUCKS, FULL COCKPIT", body: "Detailed interiors and handling from the sim that has held its players for over a decade." },
      { shot: 6, head: "BUILD A HAULAGE COMPANY", body: "Buy garages, hire drivers, and expand from one truck into a whole fleet." },
    ],
  },
  {
    id: "3164500",
    slug: "schedule-1",
    genre: "Simulation / Strategy",
    title: "SCHEDULE I",
    badge3: "OFFLINE\nPLAY",
    card: { shot: 3 },
    features: [
      { shot: 1, head: "RUN THE WHOLE OPERATION", body: "Production, supply and distribution, built from the ground up." },
      { shot: 3, head: "TAKE OVER HYLAND POINT", body: "Start on the corner and work up through properties, territory and turf." },
      { shot: 6, head: "HIRE AND MANAGE STAFF", body: "Buy businesses, put people on payroll, and stay ahead of everyone who wants what you built." },
    ],
  },
  {
    id: "3167020",
    slug: "escape-from-duckov",
    genre: "PVE Survival RPG",
    title: "ESCAPE FROM DUCKOV",
    badge3: "FREE DLC\nINCLUDED",
    card: { shot: 7, zoom: 1.1 },
    features: [
      // shot1 carries a "trial version" watermark in Steam's own capture - zoom crops it out.
      // shot2 (the inventory screen) was dropped: its UI is entirely Chinese-language.
      { shot: 1, zoom: 1.1, head: "EXTRACTION LOOTING", body: "Scavenge for resources and haul it home. Every run carries real risk." },
      { shot: 6, head: "GEAR UP RUN BY RUN", body: "Upgrade your loadout between trips and outwit hostile ducks. PVE only — no players hunting you." },
      { shot: 7, zoom: 1.1, head: "BUILD YOUR HIDEOUT", body: "Turn a bare base into somewhere worth defending." },
    ],
  },
  {
    id: "2019300",
    slug: "dokimon-quest",
    genre: "Monster-Taming RPG",
    title: "DOKIMON QUEST",
    badge3: "FREE DLC\nINCLUDED",
    // The overworld frame has no HUD at its edges, so the card can crop it normally.
    card: { shot: 7, pixel: true },
    // Pixel art: `contain` so nothing is cropped (a cover-crop eats the battle HUD's
    // HP numbers), `pixel` so upscaling stays sharp instead of going soft.
    features: [
      { shot: 3, fit: "contain", pixel: true, head: "CATCH 140+ DOKIMON", body: "Capture, train and evolve creatures across the Xelos region." },
      { shot: 2, fit: "contain", pixel: true, head: "EXPLORE 15+ TOWNS", body: "Uncover the mystery behind your missing childhood friend." },
      { shot: 7, fit: "contain", pixel: true, head: "RETRO GBC STYLING", body: "Game Boy Color looks with modern quality-of-life and Steam Cloud saves." },
    ],
  },
  // ── Added 2026-09-05: the four newer accounts, previously idle inventory with no
  // banners at all. None of these carry a FREE DLC badge — DLC ownership on these
  // accounts is unconfirmed and the claims table calls that out as a refund magnet,
  // so they run OFFLINE PLAY instead, which is true of every account we sell.
  {
    id: "265300",
    slug: "lords-of-the-fallen-2014",
    genre: "Action RPG",
    title: "LORDS OF THE FALLEN 2014",
    badge3: "OFFLINE\nPLAY",
    card: { shot: 2 },
    features: [
      { shot: 4, head: "DELIBERATE, HEAVY COMBAT", body: "Every swing costs stamina. Read the enemy, commit, and punish the opening." },
      { shot: 3, head: "FIGHT THE FALLEN LORDS", body: "Bosses that gate the way forward until you learn how they move." },
      // shot7 fits the copy better but is near-black; it reads as a grey smear at
      // Shopee thumbnail size. shot2 shows the same world lit.
      { shot: 2, head: "A GRIM, HAND-BUILT WORLD", body: "Crumbling monasteries and snowbound ruins, fought through on foot." },
    ],
  },
  {
    id: "1948280",
    slug: "stacklands",
    genre: "Card Village Builder",
    title: "STACKLANDS",
    badge3: "OFFLINE\nPLAY",
    // Every Stacklands screenshot is a dense UI board with no photogenic frame, so
    // the card uses Steam's illustrated key art with the title typeset over it.
    card: { art: "hero", useTitle: true },
    features: [
      { shot: 1, head: "BUILD A VILLAGE FROM CARDS", body: "Every villager, building and idea is a card. Drag them together to make new ones." },
      { shot: 4, head: "MINE, FARM, COOK, EXPAND", body: "Combine cards into food, tools and buildings — and keep everyone fed." },
      { shot: 2, head: "DISCOVER EVERY COMBINATION", body: "No tutorial. The Cardopedia fills itself in as you find what works." },
    ],
  },
  {
    id: "858820",
    slug: "tribes-of-midgard",
    genre: "Norse Survival RPG",
    title: "TRIBES OF MIDGARD",
    badge3: "OFFLINE\nPLAY",
    card: { shot: 2 },
    features: [
      { shot: 2, head: "DEFEND THE VILLAGE", body: "Build up your base between raids and keep the Seed of Yggdrasil standing." },
      { shot: 3, head: "FIGHT THE GIANTS", body: "Jötnar close in as the days pass. Gear up and put them down before they arrive." },
      { shot: 6, head: "A NEW WORLD EVERY RUN", body: "Norse realms generated fresh each time, with new terrain and new threats." },
    ],
  },
  {
    id: "208650",
    slug: "batman-arkham-knight",
    genre: "Action Adventure",
    title: "BATMAN: ARKHAM KNIGHT",
    badge3: "OFFLINE\nPLAY",
    card: { shot: 5 },
    features: [
      { shot: 3, head: "BE THE BATMAN", body: "Gotham is evacuated and overrun on the night Scarecrow takes the city." },
      { shot: 1, head: "DRIVE THE BATMOBILE", body: "Drivable and weaponised — chase, ram, and fight from behind the wheel." },
      { shot: 5, head: "GLIDE ACROSS GOTHAM", body: "Free-roam the whole city, grapple to the rooftops, and drop into fights from above." },
    ],
  },
  {
    id: "4001890",
    slug: "how-to-fish",
    genre: "Physics Fishing Sim",
    title: "HOW TO FISH",
    badge3: "OFFLINE\nPLAY",
    card: { shot: 3 },
    features: [
      { shot: 3, head: "CAST, HOOK, HAUL IT IN", body: "A real fishing sim under the comedy — rods, bait, and fish that fight back." },
      { shot: 2, head: "PHYSICS FISHING, GONE WRONG", body: "Physics-driven casting that fails in consistently entertaining ways." },
      { shot: 4, head: "FISH YOUR WAY HOME", body: "You were drinking and boating. You crashed into a small island. Now you learn to fish." },
    ],
  },

  // ══ Supplier-sourced titles, added 2026-09-06 ═══════════════════════════════
  // These are NOT our own Steam accounts. They come from the supplier order tables
  // in local/websites/ (cyberspace.cyou, gamersfantasy.my) and are delivered through
  // the supplier's own code portal, so:
  //
  //   * badge3 is ALWAYS OFFLINE PLAY. Buyers play in Steam Offline Mode, so a co-op
  //     or multiplayer claim is one the product cannot keep, whatever Steam's category
  //     data says. Ban applied 2026-09-06 (Chaison) - see docs/shopee-listings.md.
  //   * none of them claim FREE DLC. We do not know what these accounts own.
  //
  // The `24 HOUR DELIVERY` ribbon on the main banner is inherited from the template
  // and is the one claim worth a second look here: fulfilment for these runs through
  // a third party, not through our own auto-delivery. See docs/shopee-listings.md.
  {
    id: "2215430",
    slug: "ghost-of-tsushima",
    genre: "Open-World Samurai",
    title: "GHOST OF TSUSHIMA",
    badge3: "OFFLINE\nPLAY",
    card: { shot: 7 },
    features: [
      { shot: 4, head: "FIGHT AS THE GHOST", body: "Duel head-on as a samurai or strike from the shadows. The choice shapes every encounter." },
      { shot: 7, head: "A GORGEOUS OPEN WORLD", body: "Ride Tsushima's fields, forests and shrines with the wind itself pointing the way." },
      { shot: 6, head: "THE DIRECTOR'S CUT", body: "Includes the Iki Island expansion — a whole second island to ride and fight across." },
    ],
  },
  {
    id: "1671210",
    slug: "deltarune",
    genre: "Turn-Based RPG",
    title: "DELTARUNE",
    badge3: "OFFLINE\nPLAY",
    card: { shot: 4, fit: "contain", pixel: true },
    features: [
      { shot: 1, fit: "contain", pixel: true, head: "BULLET-HELL TURN BATTLES", body: "Act in turns, then dodge in real time. Fight if you want to — or spare everyone instead." },
      { shot: 4, fit: "contain", pixel: true, head: "EXPLORE THE DARK WORLDS", body: "Kris, Susie and Ralsei, and a story that keeps going past where you expect it to." },
      { shot: 3, fit: "contain", pixel: true, head: "TALK TO EVERYTHING", body: "Shops, secrets and a cast that remembers what you did." },
    ],
  },
  {
    id: "2993780",
    slug: "fantasy-life-i",
    genre: "Life-Sim RPG",
    title: "FANTASY LIFE i",
    badge3: "OFFLINE\nPLAY",
    card: { shot: 2 },
    features: [
      { shot: 3, head: "PICK A LIFE, SWAP ANYTIME", body: "Miner, cook, carpenter, mercenary — change what you are whenever you feel like it." },
      { shot: 1, head: "BUILD YOUR OWN ISLAND", body: "Gather, craft and rebuild a town from the ground up." },
      { shot: 5, head: "CRAFT EVERYTHING YOU USE", body: "Tools, furniture and gear, made at your own bench from what you gathered." },
    ],
  },
  {
    id: "2239710",
    slug: "into-the-dead-our-darkest-days",
    genre: "Survival Strategy",
    title: "INTO THE DEAD",
    badge3: "OFFLINE\nPLAY",
    card: { shot: 5 },
    features: [
      { shot: 5, head: "SURVIVE A DEAD CITY", body: "1980s Texas, overrun. Keep your group alive through the day and through the night." },
      { shot: 1, head: "SCAVENGE EVERY ROOM", body: "Search for food, tools and weapons quietly — noise brings company." },
      { shot: 3, head: "MANAGE THE SURVIVORS", body: "Skills, injuries, hunger and morale all have to be kept in check." },
    ],
  },
  {
    id: "3070070",
    slug: "tcg-card-shop-simulator",
    genre: "Shop Simulation",
    title: "TCG CARD SHOP SIMULATOR",
    badge3: "OFFLINE\nPLAY",
    card: { shot: 3 },
    features: [
      { shot: 3, head: "OPEN PACKS, PULL RARES", body: "Order stock, open the packs yourself, and price whatever you find inside." },
      { shot: 8, head: "STOCK AND LAY OUT THE SHOP", body: "Shelves, displays and the whole floor plan are yours to arrange." },
      { shot: 1, head: "HOST TOURNAMENT TABLES", body: "Put tables out, bring players in, and grow the shop into somewhere people stay." },
    ],
  },
  {
    id: "1857090",
    slug: "norland",
    genre: "Medieval Colony Sim",
    title: "NORLAND",
    badge3: "OFFLINE\nPLAY",
    card: { shot: 1 },
    features: [
      { shot: 3, head: "RUN A MEDIEVAL KINGDOM", body: "Every noble has traits, moods and ambitions — including the ones plotting against you." },
      { shot: 2, head: "WAR, FAITH AND POLITICS", body: "Raise armies, pick a religion, and hold the realm together while it pulls apart." },
      { shot: 4, head: "A LIVING REGION", body: "Trade, diplomacy and rivals playing their own game across the map." },
    ],
  },
  {
    id: "2384580",
    slug: "dynasty-warriors-origins",
    genre: "Musou Action",
    title: "DYNASTY WARRIORS: ORIGINS",
    badge3: "OFFLINE\nPLAY",
    card: { shot: 1 },
    features: [
      { shot: 2, head: "THOUSANDS ON THE FIELD", body: "Battles rendered at full scale — armies, not set dressing." },
      { shot: 3, head: "ONE WARRIOR, WHOLE ARMIES", body: "Cut through crowds with weapons that each play completely differently." },
      { shot: 5, head: "THE THREE KINGDOMS WAR", body: "Fight through the campaigns that decided ancient China." },
    ],
  },
  {
    id: "2322560",
    slug: "love-is-all-around",
    genre: "Live-Action Romance",
    title: "LOVE IS ALL AROUND",
    badge3: "OFFLINE\nPLAY",
    card: { shot: 1 },
    features: [
      { shot: 1, head: "A LIVE-ACTION DATING SIM", body: "Full-motion video — real actors, real scenes, and your choices steering them." },
      { shot: 4, head: "EVERY CHOICE BRANCHES", body: "Decide who to answer and where the evening goes." },
      { shot: 5, head: "MANY ENDINGS TO FIND", body: "A branching story map that tracks every route you have and have not taken." },
    ],
  },
  {
    id: "2239150",
    slug: "thronefall",
    genre: "Minimalist Strategy",
    title: "THRONEFALL",
    badge3: "OFFLINE\nPLAY",
    // Thronefall's wordmark is a thin dark script that vanishes into the art at
    // any size, so the card typesets the title instead.
    card: { shot: 3, useTitle: true },
    features: [
      { shot: 1, head: "BUILD BY DAY", body: "Place walls, farms and towers while the sun is still up." },
      { shot: 5, head: "DEFEND BY NIGHT", body: "Then ride out and fight in the defence yourself when the wave arrives." },
      { shot: 2, head: "SHORT RUNS, RISING STAKES", body: "A handful of maps, escalating waves, and mutators when they get too easy." },
    ],
  },
  {
    id: "2677660",
    slug: "indiana-jones-great-circle",
    genre: "Action Adventure",
    title: "INDIANA JONES",
    badge3: "OFFLINE\nPLAY",
    card: { shot: 4 },
    features: [
      { shot: 1, head: "PLAY INDIANA JONES", body: "1937. A break-in at Marshall College pulls Indy into a mystery that circles the globe." },
      { shot: 4, head: "TRAVEL THE GREAT CIRCLE", body: "Egypt, Siam, Shanghai, the Vatican and the Himalayas." },
      { shot: 3, head: "WHIP, FISTS OR STEALTH", body: "Improvise with whatever is on the shelf, or slip past without a sound." },
    ],
  },
  {
    id: "1879330",
    slug: "warriors-orochi-3-ultimate",
    genre: "Musou Action",
    title: "WARRIORS OROCHI 3",
    badge3: "OFFLINE\nPLAY",
    card: { shot: 1 },
    features: [
      { shot: 1, head: "OVER 100 PLAYABLE WARRIORS", body: "The Dynasty Warriors and Samurai Warriors rosters together, plus guest fighters." },
      { shot: 2, head: "TAG-TEAM THREE AT A TIME", body: "Swap between three characters mid-fight and chain their attacks into each other." },
      { shot: 8, head: "FIGHT THE SERPENT KING", body: "A crossover campaign against Orochi's army, with side stages and free mode on top." },
    ],
  },
  {
    id: "2287330",
    slug: "empire-of-the-ants",
    genre: "Nature Strategy",
    title: "EMPIRE OF THE ANTS",
    // Steam lists Online PvP and no co-op at all, so this one does not get the
    // co-op badge even though it is a multiplayer game.
    badge3: "OFFLINE\nPLAY",
    ribbonRight: true, // its header art prints "EMPIRE OF THE ANTS" bottom-left
    card: { shot: 6 },
    features: [
      { shot: 6, head: "THE FOREST AT ANT SCALE", body: "Unreal Engine 5 rendering of the forest floor, close enough to see the moss." },
      { shot: 1, head: "COMMAND THE COLONY", body: "Claim territory, hold the ground you take, and out-manoeuvre rival nests." },
      { shot: 4, head: "THE SEASONS TURN", body: "The forest changes around you as the year moves on." },
    ],
  },
  {
    id: "1624540",
    slug: "storyteller",
    genre: "Story Puzzle",
    title: "STORYTELLER",
    badge3: "OFFLINE\nPLAY",
    card: { shot: 4 },
    features: [
      { shot: 1, head: "TELL THE STORY YOURSELF", body: "Drag characters into comic panels and watch the plot play itself out." },
      { shot: 7, head: "EVERY PUZZLE IS A SCENE", body: "Reach the ending the title asks for — betrayal, revenge, true love." },
      { shot: 5, head: "FAIRY TALES AND TRAGEDIES", body: "Chapters of monsters, kings and lovers, each with its own small twist." },
    ],
  },
  {
    id: "2358720",
    slug: "black-myth-wukong",
    genre: "Action RPG",
    title: "BLACK MYTH: WUKONG",
    badge3: "OFFLINE\nPLAY",
    card: { shot: 3 },
    features: [
      { shot: 2, head: "THE MONKEY KING'S STAFF", body: "Three staff stances, transformations and spells, combined however you like." },
      { shot: 3, head: "BOSSES OUT OF MYTH", body: "The yaoguai of Journey to the West, built as set-piece fights." },
      { shot: 6, head: "SIX CHAPTERS TO TRAVEL", body: "A destined one's road across mountains, temples and ruins." },
    ],
  },
  {
    id: "3764200",
    slug: "resident-evil-requiem",
    genre: "Survival Horror",
    title: "RESIDENT EVIL REQUIEM",
    badge3: "OFFLINE\nPLAY",
    // No logo.png on Steam's CDN for this app - the card typesets the title.
    card: { shot: 3 },
    features: [
      { shot: 1, head: "PLAY GRACE ASHCROFT", body: "An FBI technical analyst sent back to the city where her mother died." },
      { shot: 8, head: "SOMETHING IS HUNTING YOU", body: "Survival horror at its most direct: hide, run, or spend the little ammo you have." },
      { shot: 3, head: "A CITY THAT NEVER RECOVERED", body: "Ruins, fog, and whatever is still moving in them." },
    ],
  },

  // ══ gamersfantasy.my, added 2026-09-06 ══════════════════════════════════════
  // Seven games on order the shared gamersfantasy order (id in `local/websites/gamersfantasy.my.md`, gitignored) plus Sekiro on Sekiro's own separate gamersfantasy order.
  //
  // THREE OF THESE ARE BLOCKED FROM LISTING. Star Wars Outlaws, AC Shadows and
  // AC Valhalla each need a Ubisoft account on top of the Steam credentials, and
  // we do not deliver one - a buyer would get working Steam logins and still be
  // unable to launch. Confirmed twice over: the supplier's own `instruct` field
  // (local/websites/gamersfantasy.my.md) and Steam's `ext_user_account_notice`.
  // They carry SINGLE PLAYER rather than OFFLINE PLAY because offline play is
  // precisely the claim in doubt while the Ubisoft launcher sits in the way.
  {
    id: "2561580",
    slug: "horizon-zero-dawn-remastered",
    genre: "Open-World Action RPG",
    title: "HORIZON ZERO DAWN",
    badge3: "OFFLINE\nPLAY",
    card: { shot: 1 },
    features: [
      { shot: 7, head: "HUNT THE MACHINES", body: "Bring down towering machines with traps, arrows and whatever the ground gives you." },
      { shot: 3, head: "A WORLD RECLAIMED BY NATURE", body: "The overgrown ruins of the old world, rebuilt for the remaster." },
      { shot: 2, head: "UNCOVER ALOY'S PAST", body: "An outcast hunter tracking down what really ended civilisation." },
    ],
  },
  {
    id: "2842040",
    slug: "star-wars-outlaws",
    genre: "Open-World Action",
    title: "STAR WARS OUTLAWS",
    badge3: "SINGLE\nPLAYER", // Ubisoft Connect required - blocked, see block comment
    card: { shot: 4 },
    features: [
      { shot: 4, head: "SCOUNDREL OF THE OUTER RIM", body: "Ride your speeder across open planets between jobs." },
      { shot: 1, head: "FLY YOUR OWN SHIP", body: "Dogfights and free traversal between worlds." },
      { shot: 8, head: "PLAY THE SYNDICATES", body: "Standing with each crime family changes what work you get and who shoots at you." },
    ],
  },
  {
    id: "3159330",
    slug: "assassins-creed-shadows",
    genre: "Open-World Action RPG",
    title: "AC SHADOWS",
    badge3: "SINGLE\nPLAYER", // Ubisoft account required - blocked, see block comment
    card: { shot: 7 },
    features: [
      { shot: 3, head: "TWO PROTAGONISTS, TWO STYLES", body: "A samurai who fights head-on and a shinobi who never should." },
      { shot: 5, head: "FEUDAL JAPAN, OPEN WORLD", body: "Ride between castle towns, shrines and provinces as the seasons turn." },
      { shot: 6, head: "SHADOWS AND STEEL", body: "Light and weather decide how — and whether — you are seen." },
    ],
  },
  {
    id: "2322010",
    slug: "god-of-war-ragnarok",
    genre: "Action Adventure",
    title: "GOD OF WAR RAGNARÖK",
    badge3: "OFFLINE\nPLAY",
    card: { shot: 8 },
    features: [
      { shot: 3, head: "THE AXE AND THE BLADES", body: "Leviathan, Blades of Chaos and shield, switched mid-combo." },
      { shot: 5, head: "CROSS THE NINE REALMS", body: "Midgard, Svartalfheim and beyond, as Fimbulwinter closes in." },
      { shot: 6, head: "RAGNARÖK IS COMING", body: "Kratos and Atreus against the gods who intend to end everything." },
    ],
  },
  {
    id: "2208920",
    slug: "assassins-creed-valhalla",
    genre: "Open-World Action RPG",
    title: "AC VALHALLA",
    badge3: "SINGLE\nPLAYER", // Ubisoft Connect required - blocked, see block comment
    card: { shot: 3 },
    features: [
      { shot: 2, head: "RAID THE ENGLISH COAST", body: "Bring your crew ashore, break the gates, and take what is behind them." },
      { shot: 3, head: "SAIL AND SETTLE", body: "Grow a Viking settlement from a landing site into a home." },
      { shot: 1, head: "BRUTAL NORSE COMBAT", body: "Dual-wield axes, shields or spears, in whatever combination you like." },
    ],
  },
  {
    id: "1091500",
    slug: "cyberpunk-2077",
    genre: "Open-World RPG",
    title: "CYBERPUNK 2077",
    badge3: "OFFLINE\nPLAY",
    card: { shot: 6 },
    features: [
      { shot: 6, head: "NIGHT CITY AFTER DARK", body: "A dense open city where every district runs by its own rules." },
      { shot: 8, head: "DRIVE, SHOOT, HACK", body: "Build V around netrunning, gunplay or pure chrome." },
      { shot: 7, head: "A GHOST IN YOUR HEAD", body: "A dying merc, a stolen chip, and Johnny Silverhand riding along." },
    ],
  },
  {
    id: "2417610",
    slug: "metal-gear-solid-delta-snake-eater",
    genre: "Stealth Action",
    title: "MGS Δ: SNAKE EATER",
    badge3: "OFFLINE\nPLAY",
    card: { shot: 4 },
    features: [
      { shot: 5, head: "SURVIVE THE JUNGLE", body: "Camouflage, hunting and field surgery in between the firefights." },
      { shot: 4, head: "STEALTH FIRST, ALWAYS", body: "Every patrol can be slipped past, distracted, or quietly removed." },
      { shot: 1, head: "SNAKE EATER, REBUILT", body: "A full remake of MGS3 — the same story, rebuilt from the ground up." },
    ],
  },
  {
    id: "814380",
    slug: "sekiro-shadows-die-twice",
    genre: "Action Adventure",
    title: "SEKIRO",
    badge3: "OFFLINE\nPLAY",
    card: { shot: 4 },
    features: [
      { shot: 2, head: "POSTURE, NOT HEALTH BARS", body: "Deflect everything, break their guard, and finish it in a single strike." },
      { shot: 1, head: "GRAPPLE ACROSS SENGOKU JAPAN", body: "A prosthetic arm that turns rooftops and cliffs into routes." },
      { shot: 5, head: "DIE TWICE", body: "Resurrect where you fell and turn a lost fight around — at a price." },
    ],
  },

  // ══ gamersfantasy.my single-game orders, added 2026-09-06 ═══════════════════
  // One order id, one game, one account each - the simplest of the supplier's
  // four order shapes.
  //
  // RDR2 is the second title in the catalogue that needs a publisher account we
  // do not deliver: Steam's ext_user_account_notice says "Rockstar Games", the
  // same field that flagged the three Ubisoft titles. It also carries online
  // co-op we cannot deliver for the same reason, so its badge is SINGLE PLAYER -
  // the one claim that stays true. See docs/shopee-listings.md; the fit filter
  // had already ruled it out independently.
  {
    id: "2651280",
    slug: "marvels-spider-man-2",
    genre: "Open-World Action",
    title: "MARVEL'S SPIDER-MAN 2",
    badge3: "OFFLINE\nPLAY",
    card: { shot: 4 },
    features: [
      { shot: 3, head: "SWING ACROSS NEW YORK", body: "Web-swing and wing-suit a bigger Marvel's New York, Queens to Brooklyn." },
      { shot: 6, head: "TWO SPIDER-MEN", body: "Switch between Peter and Miles, each with their own powers and their own story." },
      { shot: 2, head: "THE SYMBIOTE THREAT", body: "Venom, and a city-wide hunt that pushes both of them past their limits." },
    ],
  },
  {
    id: "949230",
    slug: "cities-skylines-2",
    genre: "City Builder",
    title: "CITIES: SKYLINES II",
    badge3: "OFFLINE\nPLAY",
    card: { shot: 2 },
    features: [
      { shot: 2, head: "BUILD A REAL CITY", body: "Zoning, road hierarchy and services, at a scale that keeps on growing." },
      { shot: 4, head: "DOWN TO STREET LEVEL", body: "Every building, vehicle and citizen is simulated — and you can follow any of them." },
      { shot: 8, head: "TRAFFIC, POWER, PEOPLE", body: "Economy, utilities and congestion all push back on the plan." },
    ],
  },
  {
    id: "2531310",
    slug: "the-last-of-us-part-2-remastered",
    genre: "Action Adventure",
    title: "THE LAST OF US PART II",
    badge3: "OFFLINE\nPLAY",
    card: { shot: 4 },
    features: [
      { shot: 4, head: "ELLIE'S STORY", body: "A journey across a hostile Pacific Northwest, driven by revenge." },
      { shot: 2, head: "TWO SIDES OF ONE WAR", body: "Play both sides of the conflict and see what each of them cost." },
      { shot: 8, head: "BRUTAL, TENSE COMBAT", body: "Scavenge, craft, and pick your moment. Resources never quite stretch." },
    ],
  },
  {
    id: "1623730",
    slug: "palworld",
    genre: "Creature Survival",
    title: "PALWORLD",
    badge3: "OFFLINE\nPLAY", // Steam lists online co-op; we never claim it - buyers play offline
    card: { shot: 3 },
    features: [
      { shot: 7, head: "PALS RUN YOUR BASE", body: "Put them to work mining, farming and crafting while you go exploring." },
      { shot: 2, head: "FIGHT ALONGSIDE THEM", body: "Catch, train and battle Pals — and carry their gear into the fight yourself." },
      { shot: 8, head: "RAID THE TOWERS", body: "Take on Pal bosses and the syndicates holding the island's towers." },
    ],
  },
  {
    id: "1174180",
    slug: "red-dead-redemption-2",
    genre: "Action Adventure",
    title: "RED DEAD REDEMPTION 2",
    badge3: "SINGLE\nPLAYER", // Rockstar account required - do not list, see above
    card: { shot: 5 },
    features: [
      { shot: 4, head: "PLAY ARTHUR MORGAN", body: "An outlaw in 1899, riding for a gang whose time is running out." },
      { shot: 3, head: "A WORLD THAT REACTS", body: "Weather, wildlife and strangers that carry on with or without you." },
      { shot: 5, head: "RIDE ACROSS AMERICA", body: "Mountains, plains and frontier towns, crossed on horseback." },
    ],
  },

  // == gamersfantasy.my, added 2026-09-07 ======================================
  // The ten single-game orders mapped 2026-09-07 (one order id, one game, one
  // account each). Same supplier rules as the block above: badge3 is OFFLINE PLAY
  // or SINGLE PLAYER, never FREE DLC, and no co-op or online claim whatever
  // Steam's category data says.
  //
  // Every app id was resolved through scripts/resolve-appids.mjs against Steam's
  // own index and matched the supplier's product name exactly - unlike the
  // 2026-09-06 batch, this one contains no inferences.
  //
  // Store data pulled live from appdetails on 2026-09-07 turned up listing
  // blockers the supplier file had only flagged as 'needs checking'. Each one is
  // on the entry it affects. Split Fiction is absent on purpose - see the note at
  // the end of this file.
  {
    id: "1778820",
    slug: "tekken-8",
    genre: "Fighting",
    title: "TEKKEN 8",
    badge3: "OFFLINE\nPLAY",
    card: { shot: 4 },
    features: [
      { shot: 5, head: "HEAT REWARDS ATTACKING", body: "A system built to punish backing off - press the advantage or lose it." },
      { shot: 8, head: "OVER 32 FIGHTERS", body: "The full roster, from the Mishima bloodline to the returning heavyweights." },
      { shot: 2, head: "STAGES THAT REACT", body: "Rain, water and breakable ground - the arena is part of the fight." },
    ],
  },
  {
    id: "1144200",
    slug: "ready-or-not",
    genre: "Tactical Shooter",
    title: "READY OR NOT",
    badge3: "OFFLINE\nPLAY",
    card: { shot: 5 },
    features: [
      { shot: 1, head: "BREACH AND CLEAR", body: "An elite SWAT commander working rooms where one bad angle ends it." },
      { shot: 7, head: "EVERY CALL-OUT IS NEW", body: "Suburban streets, nightclubs and back offices, each with its own way in." },
      { shot: 4, head: "PICK THE LOADOUT", body: "Weapons, optics and less-lethal gear chosen before every call-out." },
    ],
  },
  {
    id: "3717070",
    slug: "wwe-2k26",
    genre: "Wrestling Sim",
    title: "WWE 2K26",
    // 2K account required, and Denuvo caps activation at 5 machines per 24h -
    // both hostile to a shared account. Do not list; see the supplier file.
    badge3: "SINGLE\nPLAYER",
    card: { shot: 6 },
    features: [
      { shot: 6, head: "400+ SUPERSTARS", body: "Superstars and Legends across the full roster." },
      { shot: 2, head: "ALL-NEW MATCH TYPES", body: "New stipulations to run, including the ones that set the ring alight." },
      { shot: 3, head: "STEP INTO 2K SHOWCASE", body: "Play through CM Punk's career in this year's Showcase mode." },
    ],
  },
  {
    id: "3551340",
    slug: "football-manager-26",
    genre: "Football Management",
    title: "FOOTBALL MANAGER 26",
    // Denuvo anti-tamper, no publisher account. No machine cap is published,
    // unlike WWE 2K26 - but it is the same class of risk on a shared account.
    badge3: "OFFLINE\nPLAY",
    card: { shot: 6 },
    features: [
      { shot: 2, head: "RUN THE MATCH", body: "Touchline calls, substitutions and shape changes as the game moves." },
      { shot: 8, head: "SET THE TACTICS", body: "Build the system, pick the roles, and drill the squad into it." },
      { shot: 5, head: "CHASE THE TROPHY", body: "A full season of league, cup and continental football to manage." },
    ],
  },
  {
    id: "476600",
    slug: "call-of-duty-wwii",
    genre: "WWII Shooter",
    title: "CALL OF DUTY: WWII",
    badge3: "OFFLINE\nPLAY",
    card: { shot: 7 },
    features: [
      { shot: 5, head: "BOOTS ON THE GROUND", body: "The campaign, from the Normandy landings into occupied Europe." },
      { shot: 6, head: "FIGHT THROUGH THE WINTER", body: "Squad-level infantry combat across a continent at war." },
      { shot: 3, head: "NAZI ZOMBIES", body: "A separate horror mode set against an undead army." },
    ],
  },
  {
    id: "3405690",
    slug: "ea-sports-fc-26",
    genre: "Football Sim",
    title: "EA SPORTS FC 26",
    // Steam's own ext_user_account_notice: "EA online activation and EA app
    // software installation and background use required." An offline-mode buyer
    // cannot start this game at all. Do not list.
    badge3: "SINGLE\nPLAYER",
    card: { shot: 6 },
    features: [
      { shot: 5, head: "PLAY THE WORLD'S GAME", body: "Licensed clubs, licensed players, and a match engine rebuilt around them." },
      { shot: 1, head: "A 48-TEAM TOURNAMENT", body: "An international tournament mode played out across 48 national sides." },
      { shot: 8, head: "PLAYER CAREER", body: "Take one footballer through a career, with ICONs and Heroes alongside." },
    ],
  },
  {
    id: "1659420",
    slug: "uncharted-legacy-of-thieves",
    genre: "Action Adventure",
    title: "UNCHARTED: LEGACY OF THIEVES",
    badge3: "OFFLINE\nPLAY",
    card: { shot: 6 },
    features: [
      { shot: 3, head: "TWO COMPLETE STORIES", body: "UNCHARTED 4: A Thief's End and The Lost Legacy, both included." },
      { shot: 5, head: "CHASE THE TREASURE", body: "Nathan Drake, one last job, and everyone it drags back in." },
      { shot: 4, head: "NOT EVERY JOB IS A GUNFIGHT", body: "Auctions, back rooms and quiet infiltration between the set pieces." },
    ],
  },
  {
    id: "1962700",
    slug: "subnautica-2",
    genre: "Underwater Survival",
    title: "SUBNAUTICA 2",
    // Steam's genre list includes Early Access - the game is out (14 May 2026)
    // but still building. Say so in the listing copy; do not imply a finished game.
    badge3: "OFFLINE\nPLAY",
    // Only 6 screenshots on the store page, so shot numbers stop at 6 here.
    card: { shot: 1 },
    features: [
      { shot: 3, head: "DIVE AN ALIEN OCEAN", body: "A whole new world under the surface, and very little of it friendly." },
      { shot: 2, head: "BUILD A BASE THAT HOLDS", body: "Habitats, power and storage, put together where the pressure allows." },
      { shot: 6, head: "GO DEEPER THAN IS SAFE", body: "The dark below the reef, where the things living there found you first." },
    ],
  },
  {
    id: "2515020",
    slug: "final-fantasy-16",
    genre: "Action RPG",
    title: "FINAL FANTASY XVI",
    badge3: "OFFLINE\nPLAY",
    card: { shot: 1 },
    features: [
      { shot: 7, head: "EIKON AGAINST EIKON", body: "Set-piece battles fought at the scale of the summons themselves." },
      { shot: 6, head: "REAL-TIME ACTION COMBAT", body: "Clive's full kit - stagger them, then take the opening." },
      { shot: 8, head: "THE REALM OF VALISTHEA", body: "A dark fantasy of Mothercrystals, Dominants and the war over both." },
    ],
  },
  {
    id: "1659040",
    slug: "hitman-world-of-assassination",
    genre: "Stealth Action",
    title: "HITMAN WORLD OF ASSASSINATION",
    // OFFLINE PLAY, not a co-op or multiplayer claim. Verified against Steam's own
    // category list 2026-09-08: Single-player present, no Shared/Split Screen of any
    // kind, no co-op or multiplayer category at all, no drm_notice, no
    // ext_user_account_notice. The edition the supplier sold is a package_groups
    // purchase tier on this same base app -- there is no separate Deluxe app id --
    // so "Deluxe Edition" is deliberately not in the title.
    badge3: "OFFLINE\nPLAY",
    // SHOT SELECTION IS DELIBERATE — four of the eight fetched shots are unusable:
    //   shot 1, shot 2  Snoop Dogg crossover promo. Limited-time event content, not
    //                   the base game. A buyer seeing it on our banner would expect
    //                   something this account does not include.
    //   shot 4          a FREELANCER title card. Freelancer is server-backed and does
    //                   NOT work offline, which this listing discloses in its own copy.
    //                   Advertising it on a banner while disclaiming it in the body is
    //                   the contradiction the claim rules exist to stop.
    //   shot 7          47 in a wetsuit against an explosion — real, but reads as an
    //                   action shooter rather than the stealth puzzle this is.
    // The four below are all base-trilogy gameplay in the locations we actually sell.
    card: { shot: 6 },
    features: [
      { shot: 8, head: "BLEND INTO THE CROWD", body: "Marrakesh, Mumbai, Chongqing. Put on the right disguise, walk in, and nobody looks twice." },
      { shot: 3, head: "PLAY IT YOUR WAY", body: "A rooftop rifle or a quiet accident downstairs - every level has dozens of ways out." },
      { shot: 5, head: "THREE FULL CAMPAIGNS", body: "The complete World of Assassination trilogy, every location, on one account." },
    ],
  },
];

// -- Split Fiction (2001120) is deliberately NOT in the list above -------------
// It arrived with the 2026-09-07 gamersfantasy batch and its art is already
// fetched, so an entry here is all it would take. It is left out because there
// is no honest value for badge3:
//
//   * Steam's category list for it has no 'Single-player' entry at all. It is
//     Multi-player / Co-op only, so SINGLE PLAYER would be false.
//   * OFFLINE PLAY would be false for the same reason.
//   * The supplier sells it as 'Own Steam Account, Play Online Lifetime' while
//     its own varname still reads 'Offline Account' - the two disagree, and the
//     disagreement is unresolved (see the supplier file).
//
// Every badge this template can print is therefore a claim the product cannot
// keep, which is the exact failure the claims rules exist to prevent. Resolve
// the variant with the supplier first; if it really is online-and-lifetime it
// needs a different badge vocabulary, not a reused one.
