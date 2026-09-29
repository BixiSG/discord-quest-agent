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
times in a row without dying and is at most two levels below it (so it keeps
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

## Contracts (round 3)

Three standing goals on the World tab: slay monsters, champions or bosses,
clear runs (maps in the endgame, from a tier near the deepest cleared), find
rares. They fill in while the hero plays, sized to about half an hour each at
any stage, and pay dust scaled to the level plus currency weighted towards
the rarer orbs; some add a relic the codex is missing, three maps or a sigil.
A finished contract waits to be claimed; one you don't want can be rerolled
for dust.

## World

- **Act 1 - The Drowned Road** (P1): six zones and the boss, the Tide-Warden.
- **Act 2 - The Glass Barrens**, **Act 3 - The Sunfall** (P3), each with
  story text between zones and an ascendancy trial.
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
tier. With only deeper maps held, the device dampens one to the cap rather
than run it deep (it used to ignore the cap then, and the hero died on a
loop).

## Idle rules

- Online: the simulation steps at 10 Hz while the game window is open.
- Offline: on open, the time since the last save (capped at 24 h) is run
  through the same simulation, as fast as possible, in slices that yield to
  the UI. The report lists runs, kills, deaths, levels, XP, items kept and
  salvaged, and currency found.
- Nothing is simulated or drawn while the window is closed.
