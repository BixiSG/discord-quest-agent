# Hollowmarch - game design

An idle action RPG in the spirit of the big loot-and-build ARPGs, cut down so
it plays itself inside a Discord window. You make the build; the hero does the
fighting. Everything here is original: names, lore, art and numbers.

## Pitch

The sun of the March went out three hundred years ago. What is left of it
fell as embers, and whoever holds an ember does not stay dead. You are one of
the Kindled: a corpse the ember brought back, walking the drowned roads of
the Hollowmarch towards the place where the sun fell.

## Pillars

1. **Build first.** The fun is in the numbers: gear with random affixes, a
   passive tree, skills and supports. Every choice shows up in the character
   sheet as DPS and EHP, so the player can see what a change is worth.
2. **Plays itself.** Combat is automatic. The player picks where to farm and
   what to wear; the hero clears packs, drinks flasks and dies on their own.
   Closing the window never costs progress: time away is simulated on return
   and summed up in a "while you were away" report.
3. **Honest progress.** Offline and online run the same deterministic
   simulation, so there is no separate "idle formula" to exploit or distrust.
4. **Fits in a corner.** Nothing runs or draws while the window is closed.
   The Discord panel only shows a small launcher card.

## Core loop

    pick a zone -> the hero runs it (packs, then the boss) -> loot + XP
        ^                                                         |
        +--- equip, craft, spend points, push to the next zone <--+

A **run** is one clear of a zone: a number of monster packs and, in boss
zones, the boss. Runs repeat until the player changes zone. With auto-push on,
the hero moves to the next zone once it has cleared the current one three
times in a row without dying and is at most one level below it (so it keeps
earning full experience); in maps it keeps to tiers whose monsters are at
most four levels above the hero.

## The hero

- **Class** (P1: Vanguard; P2: Strider, Arcanist). Sets base attributes,
  starting skill and the start node on the passive tree.
- **Attributes**: Might (life, melee damage), Grace (accuracy, evasion),
  Wit (mana, energy shield).
- **Level** 1-100. One passive point per level.
- **Main skill** plus up to five **supports**. Supports modify the skill
  (more damage, extra targets, conversion, leech). Support slots open at
  levels 1, 1, 8, 18, 32.
- **Flask**: refills on kills, drunk automatically below half life.

## Items

Ten slots: weapon, off-hand, helmet, body, gloves, boots, belt, amulet and
two rings. Each item has a base (with an implicit on some), an item level
(the level of the monster that dropped it) and a rarity:

| rarity | affixes | colour |
|---|---|---|
| plain | none | white |
| enchanted | 1-2 (max 1 prefix, 1 suffix) | blue |
| rare | 3-6 (max 3 prefix, 3 suffix) | yellow |
| relic (unique) | fixed | orange |

Affixes come in **tiers** gated by item level; higher tiers roll bigger
numbers. Prefixes are mostly offence and life, suffixes mostly resistances,
attributes and speed. One affix per group per item.

Loot goes straight to the stash (no pick-up). The loot filter decides what
is kept and what is salvaged into **ember dust**, which buys crafting
currency at the forge.

### Keeping the stash moving (round 3)

An idle hero finds thousands of items a day, so the stash has to look after
itself:

- **Upkeep** (on by default): a keeper that meets a full stash replaces the
  least-worth item there if it is worth more (item level and base level,
  then rarity, affix count, quality). Upkeep never takes a locked item or an
  upgrade. Gear that auto-equip takes off meets the loot filter like a drop.
- **Locks**: a locked item is never salvaged by upkeep, auto-equip or bulk
  salvage. Working an item at the Forge (currency, hone, bench) locks it.
- **Relic case**: relics live outside the stash, the better-rolled copy of
  each; a worse copy is salvaged. The **codex** counts every relic found and
  gives +1% item rarity per different relic.
- Level-ups wear stash upgrades: items that needed the level, or that the
  grown build now prefers.
- Bulk tools: Equip upgrades, Salvage outdated (bases 10+ levels behind),
  plain, enchanted, or the items marked with shift-click.
- Stash room costs dust: +10 slots per purchase, 60 up to 150.

## Crafting currency (P2)

| name | effect |
|---|---|
| Kindling | plain -> enchanted |
| Reshaper | reroll an enchanted item's affixes |
| Graft | add an affix to an enchanted item with room |
| Crown Seal | enchanted -> rare, adds one affix |
| Forgeheart | plain -> rare |
| Tempest Shard | reroll every affix of a rare |
| Starfall | add one affix to a rare with room |
| Salt of Undoing | strip every affix, back to plain |
| Unmaker | remove one random affix |
| Temper Oil | reroll the numbers, keep the affixes |

## The Forge beyond currency (round 3)

Dust and currency pile up late, so the Forge has sinks that scale:

- **Hone**: quality 0-20 on a weapon or armour piece, +1% increased local
  physical damage or defences per point, dust per point rising with the item
  level and the quality already there.
- **Bench**: add a chosen affix (a random tier the item level allows) to an
  enchanted or rare item with room, for 3 Graft and dust. One benched affix
  per item; benching again replaces it.
- **Forge until upgrade**: up to 10 rares for a slot, stopping at the first
  one worth wearing; misses are salvaged on the spot.
- **Reroll until upgrade**: Reshaper, Tempest Shard or Temper Oil on a stash
  item again and again (up to 20) until it beats what is worn.

## Companions (round 4)

Nine small creatures of the March. One walks behind the hero in battle (a
baby-sized sprite) and gives one bonus that grows over 20 levels: armour, item
quantity, rarity, movement, critical chance, life, attack speed, cast speed or
experience. Levels come from bond - a point per kill while it is out; a
duplicate adds 4000. Each act boss gives one on its first clear; bosses, map
bosses and pinnacles rarely bring others (unfound ones first), and contracts
can pay one. The Hero tab shows the active one and the collection.

## The ember shrine (round 4)

Timed blessings for the late game's dust and spare orbs: an hour of Insight
(20% more experience), Fortune (40% rarity), Plenty (15% quantity) or Hoard
(30% more currency), priced by level (about 2.4k dust at level 32, 7k at 76).
Orbs above 50 of a kind can pay first at their shop price; Keep up renews a
blessing when it runs out. Blessings run on simulation time.

## Contracts (round 3)

Three standing goals on the World tab: slay monsters, champions or bosses,
clear runs (maps in the endgame, from a tier near the deepest cleared), find
rares. They fill in while the hero plays, sized to about half an hour each at
any stage, and pay dust scaled to the level plus currency weighted towards
the rarer orbs; some add a relic the codex is missing, three maps or a sigil.
A finished contract waits to be claimed (its dust follows the hero's level at
claim time); one you don't want can be rerolled for dust.

## Sockets and ember stones (round 5)

Gear carries 0-3 sockets (two-handers and body armour 3, other gear 2,
jewellery 1); rares drop with 0-2 and the Forge drills one more for dust.
Six stones in five tiers set into them, and a stone's effect depends on where
it sits:

| Stone | In a weapon | In armour | In jewellery |
|---|---|---|---|
| Ruby | increased fire damage | fire resistance | maximum life |
| Sapphire | increased cold damage | cold resistance | mana regeneration |
| Topaz | increased lightning damage | lightning resistance | item rarity |
| Emerald | increased critical chance | increased evasion | Grace |
| Onyx | ignores elemental resistance | chaos resistance | life leech |
| Diamond | attack and cast speed | armour and energy shield | all elemental resistances |

Stones drop rarely (tier by monster level, never Radiant - that is cut from
three Flawless) and live in a pouch; setting and prying out are free, salvage
returns them, and auto-set fills empty sockets in worn gear with the stone
that helps the build most.

## The Wandering Market (round 5)

After the Tide-Warden a caravan camps by the road (the Market tab, key 0).
The Pedlar sells six pieces of gear at the highest item level reached - two
for the weakest slots, one socketed, sometimes an unfound relic - and the
Jeweller five stones. Stock rotates every two hours of the hero's time; a
refresh now costs dust, doubling within a rotation. Bought gear is worn at
once if it is an upgrade.

## Echoes and the Rekindling (round 5)

Twelve echoes tell what happened the day the sun fell: eight from map bosses
(3% each, unfound first), one from each pinnacle's first kill. Every third is
an atlas point. Three pinnacles - the Drowned Sun, the Glass Choir, the Ashen
King - each hold a piece of the sun; with all three the hero can **relight the
sun**. The March starts again one dawn later: a new hero (any calling) on a
warm shore. Kept: the relic case and codex, companions and their bond, echoes,
the stone pouch (with the stones of gear left behind), bought stash room,
settings, totals and one heirloom. Each dawn: 10% more experience and dust, a
passive point, a world 10% tougher and 20% richer, and one of ten perks (kept
for every dawn after). The Hollow Crown, which ate the light, is the optional
fight beyond.

## Hollow Night (October, round 6)

A seasonal event on the player's own calendar: October 1-31, local date. The
core has no clock, so the date is simulation time plus the UTC offset the UI
records (`state.tz`); offline replay lives through the same dates, and the
event draws RNG only while it is on (every other day plays as before).

- One monster in twenty carries a lantern (a jack-o'-lantern over its head,
  pumpkin tint): 50% more life, double experience, a 30% drop chance with
  +100% rarity. Not at pinnacles.
- Maps that drop during the event are lantern-lit three times in ten: one
  monster in five carries a lantern, +40% item quantity.
- Each lantern snuffed: 1 in 1200 for **The Hollow Grin** (a level-1 hood relic:
  rarity, experience, fire resistance, life on kill), 1 in 2500 for the
  **Pumpkin Wisp** (companion: 0.5% increased damage per level). Both are
  seasonal: never in the usual relic, market, boss or contract pools.
- The contract board offers one lantern contract at a time (50 + 0.6 per level
  lanterns); it pays dust, currency and a keepsake: the Grin, else the Wisp,
  else double dust. Unfinished lantern contracts leave the board in November.
- The World tab shows a Hollow Night card (nights left, lanterns snuffed, the
  two finds); the quest-panel card carries a ribbon; a story beat opens it.

## Pinnacles: enrage and the dawn loop (round 6)

Pinnacles enrage: after 90 seconds their hits grow 2% a second, so a build
has to kill them, not outlast them. Before, a tanky caster (block, armour,
regeneration) beat all three sun pinnacles at level 65-75 in fights of five
to nine minutes and relit the sun every 15-20 hours, while two-handed attack
builds never beat the Ashen King at level 88. The King is now a DPS check
attack builds can pass (fire resistance 45, less chaos, damage 0.85, life
32), the Glass Choir evades less (1.5), and a dawn makes the world 10% tougher
instead of 15%. `tools/dawns.ts` (160 h, 3 callings x 2 seeds): first relight
at 18-36 h for every calling but one weak Strider seed; the loop then slows
at dawn II-IV (a world 20-40% tougher), where the Hollow Crown waits.

The Hollow Crown answers only from dawn II. It is the hardest fight in the
game (level 96, life 25, damage 0.52, a third of it chaos); breaking it once
gives one more dawn perk for good and the name Crownbreaker, kept across
dawns. Measured with `tools/pinnacles.ts <save> invest level=88` on dawn II-III
heroes: an invested caster wins 3/3, un-invested heroes lose, and two-handed
attack builds still fall short (they die before the enrage window closes) -
the next balance item is attack builds' survival against pinnacles, and the
Strider overall.

## The Fray (round 8)

The idle hero fights on its own; the Fray lets the player take the reins for one
fight. It is opened from the World tab card or the F key and is fought on the
road's current zone (maps stay in the device). The window becomes an arena and
the tabs step aside until the fight is over.

- A three-quarter top-down arena, 440 x 280 logical pixels, an isometric
  diamond floor in the zone's colours. WASD or the arrows walk the hero.
- The equipped skill fires on its own at whatever is in reach: 28 px for
  melee, 38 px for area skills (around the hero), 128 px for projectiles. Space
  drinks the flask, but only below 70% life; it also drinks itself under 20%.
- Monsters come in waves, one per pack of the road, the next after 12 seconds or
  when the last is down, spawning at the edges and walking at the hero. They
  swing only when the hero is in reach, so walking away dodges. Casters stop at
  72-96 px and back off slowly: a walking hero catches them, a standing one gets
  shot. The zone's boss comes last, after the final wave.
- The maths is the road's (the same hit, armour and resistance rolls, the same
  loot path), so a build that works on the road works here; kiting is what the
  player adds. Each kill pays 1.5x experience and +60 loot rarity.
- A win adds spoils: one item rolled at +200 rarity, up to two currency drops
  and a lump of experience, and is logged in the chronicle. A fall ends the
  fray and costs nothing: what was earned stays, there is no death penalty and
  no respawn wait. Leaving (Esc twice) counts as a fray fought, not won.
- The idle clock stands still while a fray is on, so nothing is caught up
  afterwards: the road neither gains nor loses by it. Esc pauses and a second
  Esc within 3 seconds leaves; P pauses; losing window focus pauses; Enter or Esc
  return from the end screen. Folding to the mini strip or closing the window
  leaves the fight; the strip has no arena, so the Fray is not available there.
- The save keeps tallies (`state.fray`: fought, won, kills, fastest win), which
  the World tab card shows. Save version 9 adds them (older saves migrate).
- The simulation is 60 fixed steps a second and pure like the rest of the core
  (its own seeded Rng), so it is tested; see `test/fray.test.ts`.

## Pinnacles: scouting (round 4)

The Atlas can scout a pinnacle: five fights on a copy of the hero, nothing
spent, reported as wins, time and a verdict (ready, risky, not yet).

## World

- **Act 1 - The Drowned Road** (P1): six zones and the boss, the Tide-Warden.
- **Act 2 - The Glass Barrens**, **Act 3 - The Sunfall** (P3), each with
  story text between zones and an ascendancy trial.
- **Act 4 - Ashfold** (round 7): the last town of the March, where the
  lamplighters kept every lantern lit for three hundred years so the sun could
  find its way back, and went hollow doing it. Seven zones (levels 42-50),
  the Trial of Lanterns, three bosses (the Night Watch, the Mayor Who Waited,
  the Lamplighter), two relics (the Lamplighter's Hook, the Watch Coat) and
  the companion Wick. Its monsters are the hollow townsfolk, risen bones and
  lantern ghosts; casters' spells burst on the hero (dark bolt, fire bomb,
  spark). The Lamplighter opens the Cinderlands; heroes who were past the
  Sunfall before Act 4 keep their maps (save v8, `endgame:early`), and a new
  dawn walks through Ashfold again.
- **The Cinderlands** (P4): the endgame. Maps are tiers 1-16 with random
  mods (monster life, damage, extra elements, player curses). Mods raise
  loot quantity and rarity. Completing a tier grants atlas points. Past
  tier 16 the **Depths** scale forever. Four pinnacle bosses need fragments
  that drop in high tiers.

## Deaths

Dying ends the run and costs a short respawn wait. In maps it also costs the
map and 3% of the XP towards the next level. Auto-push drops back one zone
after three deaths in a row, and visits each open trial once the hero is two
levels above it. In maps, two failed maps without eight clean ones between
them cap the device a tier lower; eight clean maps in a row raise the cap one
tier, and each drop doubles that streak (16, 32, 64) until the next level-up. With only deeper maps held, the device dampens one to the cap rather
than run it deep (it used to ignore the cap then, and the hero died on a
loop).

## Idle rules

- Online: the simulation steps at 10 Hz while the game window is open.
- Offline: on open, the time since the last save (capped at 24 h) is run
  through the same simulation, as fast as possible, in slices that yield to
  the UI. The report lists runs, kills, deaths, levels, XP, items kept and
  salvaged, and currency found.
- Nothing is simulated or drawn while the window is closed.
- Mid-game pacing (round 8): experience to next level is 12% lower, easing in
  from level 15 to 35, held to level 50 and gone again by level 60 (acts 2-4 and
  the first maps took the longest). With auto-push moving on at one level
  below the next zone, maps open at about 5.0 h for the vanguard (was 5.4-5.9)
  and 6.3-6.8 h for the arcanist (was 6.8-7.4) on seed 777; the first relight
  stays at 16-32 h.
