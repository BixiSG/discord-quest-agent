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
- **Attributes**: Might (life, melee damage), Grace (accuracy, evasion,
  projectile attack damage), Wit (mana, energy shield).
- **Level** 1-100. One passive point per level.
- **Passive tree**: 171 nodes (round 8, from 129): three calling seats, each
  with three themed branches of 13 nodes (two notables and, at the far end, a
  stronger mastery), a shared inner ring, bridges with a keystone between each
  pair of callings, and one more keystone past each calling's middle branch
  (Berserker's Pact, Hunter's Patience, Lantern Mind). A level-100 hero has
  about 110 points, so the tree is a choice to the end.
- **Main skill** plus up to five **supports**. Supports modify the skill
  (more damage, extra targets, conversion, leech). Support slots open at
  levels 1, 1, 8, 18, 32.
- **Flask**: refills on kills, drunk automatically below half life.
- **Ascendancy**: after the first trial the hero takes one of its calling's two
  ascendancies. Each trial's first clear pays two points, a node each; every
  ascendancy has eight nodes, so the four trials buy all of it. Nodes 7 and 8
  (round 8, for the Trial of Lanterns) are a little stronger: one offence, one
  defence.

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
- **Previews** (round 8): while the pointer or keyboard focus rests on a
  currency, the hone or the bench, the item on the anvil shows what it would
  do: which affixes keep, get new values, are rerolled or removed (or the
  chance each goes), how many new ones come and of which kind, the rarity it
  becomes - or why it can't be used, in which case Use is off. The anvil
  stays in view beside the shelf while scrolling.

## Companions (round 4)

Nine small creatures of the March. One walks behind the hero in battle (a
baby-sized sprite) and gives one bonus that grows over 20 levels: armour, item
quantity, rarity, movement, critical chance, life, attack speed, cast speed or
experience. Levels come from bond - a point per kill while it is out; a
duplicate adds 4000. Each act boss gives one on its first clear; bosses, map
bosses and pinnacles rarely bring others (unfound ones first), and contracts
can pay one. The Hero tab shows the active one and the collection.

## Companion errands (round 8)

Companions that are not at the hero's side run errands of two hours of the
hero's time (three at once, so time away counts): scavenge (ember dust, about
a tenth of what two hours of play salvages), forage (crafting orbs, the rarer
ones weighted up), delve (ember stones) and, once the Cinderlands are open,
scout (maps a tier deeper than the deepest cleared, and a chance of a sigil).
What they bring grows with their level, and every errand adds 1500 bond (twice
with Long Memory), so the whole collection grows, not only the one out. "Keep
them busy" (on by default) sends a returning companion out again and fills
free errands with idle companions (scavenging). A companion away can't walk
with the hero until it is back or recalled (recalling forfeits the haul).
Errands carry over a new dawn with the companions.

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

## Feats, renown and titles (round 8)

Thirty-eight feats in five groups - the road (acts, trials, levels 50/75/90),
the hunt (monsters, bosses, lanterns, a skill's mastery 10 since round 9), the collection (relics, companions, a
level-20 bond, the echoes, a Radiant stone), the forge (quality 20, a relic
tempered five times, contracts, salvage, dust) and the Cinderlands (tiers 8
and 16, Depths 10 and 25, the three sun pinnacles, dawns I and III, the Hollow
Crown). Each is earned once and kept across dawns. A feat pays renown (1-3,
69 in all); each point is 1% increased damage and 0.5% increased maximum life.
Thirteen feats are titles (Crownbreaker among them): a new one is worn when none
is, and the Log tab's Feats chip lists them all with their progress, the
renown and a Wear button. A save from before feats earns what it already did
the first time it loads, in one chronicle line; the bosses and contracts it
counted before feats existed are estimated from what the save still shows.

## Skill mastery (round 9)

A skill grows with use. Every kill made with it adds a point (a boss ten); level n needs
1000 x n^2 points, so mastery 10 is about a day of one skill. Each level is 1.5% more
damage with that skill; from mastery 5 it costs 10% less mana, and at 10 it attacks or
casts 10% faster. Mastery is the player's: it carries over every dawn, and a save from
before it starts from zero (kills weren't counted per skill). The Skills tab tags every
skill with its mastery (the tooltip gives the bonus and how far the next level is); a new
level is a toast, a chronicle line and a line in the away report. Weaponmaster, a title,
asks for mastery 10 (38 feats, 13 titles, 69 renown).

## Weekly omens (round 9)

Each local calendar week (Monday to Sunday, the player's own clock, like Hollow Night)
has an omen: a trade-off with a reward, the same for every player that week. No omen
comes twice in a row and all seven pass in seven weeks (the order steps by three, and
each seven-week cycle starts one further on).

| Omen | The week |
|---|---|
| Blood Moon | monsters 25% more life; items found 40% rarer |
| Ashfall | 25% more fire damage; salvage gives 25% more ember dust |
| The Long Gale | 25% increased movement speed; monsters deal 15% more damage |
| The Hungry Dark | monsters 15% more life and damage; 50% more crafting currency |
| Clear Skies | 15% increased experience |
| Hard Frost | 25% more cold damage; monsters act 10% slower |
| Stormfront | 25% more lightning damage; monsters 20% harder to hit; 20% more items |

The omen sits on the hero (its modifiers are in the stat sheet, named in breakdowns);
its monster side never touches a pinnacle, so the dawn loop keeps its pace. The World tab
shows it, the days left and next week's; a new week's omen is a chronicle line and a toast.

## The Fray (round 10)

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
  the World tab card shows. Save version 11 adds them (older saves migrate).
- The simulation is 60 fixed steps a second and pure like the rest of the core
  (its own seeded Rng), so it is tested; see `test/fray.test.ts`.

## The dawn loop after round 8

Round 8 made every calling stronger (renown, errands, ascendancy nodes 7-8, late skills
and supports, masteries). Measured with `tools/dawns.ts` and a bot that clears with pack
skills and fights pinnacles with its best single-target skill, every calling relit the sun
at 12-16 hours and then every 10-15 hours for good: a dawn's perk, passive point, renown
and 20% richer drops outgrew a world only 10% tougher, and the pinnacles fell at level
70-80 in every dawn. (Before round 8: 17-28 hours, then 17-25, with the Vanguard stuck at
dawn I for want of survival.)

Two changes put the gate back. The three sun pinnacles have 15% more life. And each dawn
the pinnacles hold their piece of the sun harder, compounding, on top of the world's 10%:
life and damage x (1 + 0.1 d) x 1.15^d at dawn d (dawn I 26%, III 98%, V 202%). Measured
at 20% the loop slowed as intended (dawns I-III 10-20 hours each, dawn IV 20-45, then
days), but dawn X's pinnacles would be twelve times tougher and the last perks out of
reach; 15% is the value kept. Over two simulated weeks (seed 777) it gives dawns I-IV in
11-16 hours each for every calling, then 15-35 hours each; the Arcanist reaches dawn VIII
(136 h), the Strider VI (214 h), and the Vanguard V (73 h) - attack builds still scale
worse against late pinnacles, and a new dawn can take any calling. The Menu's dawn card
gives the pinnacles' toughness.

Round 9 (mastery, omens, Iron Vow's cost, evasion counted in EHP), 150 simulated hours
on seed 777 plus a second Strider seed: the first relight at 15-22 hours (Vanguard 15.0,
Arcanist 15.8, Strider 18.6 and 22.1), the next four dawns in 11-28 hours each, then
slower: Arcanist dawn VI at 103 h (and no VII by 150 h), Vanguard VI at 148 h, Strider V
at 84 h (seed 778). The design's 18-36 hours for the first relight is kept as a ceiling, not forced:
a sun pinnacle with 35% more life (instead of 15%) walled the weaker builds for days and
barely slowed the strong ones, and at 10% a dawn the later pinnacles fell too fast.
What moved the first relight was the EHP fix. EHP had counted evasion against physical
hits only, while the fight lets an evaded attack's elements through as none, so
auto-equip swapped the Strider's evasion for energy shield. That Strider stood at dawn
0 for 70 hours, dying in 20 seconds at level 77. With evasion counted for every type it
relights at 19-22 hours. Every calling is a little slower now, because every build keeps
more evasion. The Strider on seed 777 stalls at dawn III: the build score traded its
shield (34% block) for a bow and quiver, three times the damage at 60% of the EHP, and
neither build wins dawn III's pinnacles. That is the upgrade score's weights, 0.6 offence
to 0.4 defence, meeting a gate that asks for both. A pinnacle-aware upgrade score is
listed for round 10.

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
- **The Cinderlands** (P4): the endgame. Maps are tiers 1-16 in thirteen
  areas (round 8 added three from Ashfold: the Lantern Lanes, the Hollow
  Belfry and the Oil Deeps, with its bosses) with random mods: monster life,
  damage, speed, extra elements, more packs; round 8 added monster armour,
  evasion and elemental resistance, a monster more in every pack, a map boss
  with 80% more life and 30% more damage, and skills that cost 40% more
  mana; the curses on the hero (less regeneration, lower maximum
  resistances, more damage taken, less damage dealt). Mods raise loot
  quantity and rarity. Completing a tier grants atlas points. Past
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
- Mid-game pacing (round 10): experience to next level is 12% lower, easing in
  from level 15 to 35, held to level 50 and gone again by level 60 (acts 2-4 and
  the first maps took the longest). With auto-push moving on at one level
  below the next zone, maps open at 5.0-5.6 h for the vanguard (5.2-5.8 without
  it), 6.3-7.0 h for the arcanist (6.5-7.3) and 6.5-7.3 h for the strider
  (6.9 h to past 10 h), seeds 777-779 with round 9's content and the balance
  bot; the first relight was not re-measured.
