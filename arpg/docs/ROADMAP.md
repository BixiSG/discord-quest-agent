# Hollowmarch - roadmap and design notes

## Round 8 (plan)

**Status (round 8 built):** everything below is in, in en/ru/uk, plus three things asked
for on the way: two sprites that faced away from the hero, Forge previews (what a
currency, the hone or the bench would do, marked on the item), and a bigger passive tree
(171 nodes: nine masteries, three far keystones). The balance pass retuned the late melee
and bow skills and taught the bot to clear with pack skills and fight pinnacles with its
best single-target skill; measured that way, round 8 made every calling relight the sun
at 12-16 hours and then every 10-15 hours for good, so the pinnacles now grow tougher with
each dawn, compounding (see GDD, "The dawn loop after round 8"). Five monsters that wore a
tinted look-alike got sprites of their own from three more CC0 packs (see assets/CREDITS.md).

Where the game is after round 7: four acts, maps and the Depths, four pinnacles and the
Rekindling loop. A bot relights the sun at 20-30 hours for every calling. Three gaps show:

1. **Builds stop growing at level 26.** The last skill unlocks at 20 and the last support at
   26; a level-90 hero picks from the same fifteen skills as a level-26 one.
2. **The fourth trial pays for nothing.** Four trials pay eight ascendancy points; every
   ascendancy has six nodes, so the Trial of Lanterns' two points (since Act 4) buy nothing.
3. **Long-term goals are thin.** After the first dawn the loop is the same numbers again,
   nine of the ten companions sit in the collection doing nothing, and nothing records what
   the player has done beyond the totals.

Round 8, in this order:

- **Ascendancy nodes 7-8.** Two more per ascendancy, a little stronger than the first six
  (they arrive around level 49): one offence, one defence. The defence nodes of the attack
  ascendancies give what attack builds lack against pinnacles: life and less damage taken.
- **Late skills and supports.** Six skills: Gravecleave (28, melee, four targets), Sunpiercer
  (30, bow, fire, pierces), Sunflare (30, fire spell, five targets), Tidal Crash (40, slam,
  cold, six targets), Void Lance (42, chaos spell that pierces), Blight Arrow (44, bow strike,
  chaos, crits). Five supports: Frostbite and Galvanic (28, attacks: half the physical damage
  becomes cold / lightning), Concentrate (30, area: more damage, less area), Steadfast (34,
  attacks: you take less damage while it is linked - the first support with modifiers on the
  hero), Overcharge (38, spells: much more damage for mana and a little speed). The Skills tab
  shows what a defensive support is worth in EHP, not only DPS.
- **Ashfold in the Cinderlands.** Three map areas built from Act 4 (the Lantern Lanes, the
  Hollow Belfry, the Oil Deeps, with its three bosses) and six map mods: armoured, veiled,
  warded (monster defences), swarming (bigger packs), draining (skills cost more mana) and
  overlord (a stronger map boss that drops more).
- **Feats.** Forty-odd feats across the road, the hunt, the collection, the forge and the
  endgame, earned once and kept across dawns. Each pays renown (1-3), and renown is a small
  permanent bonus to damage and life. Some feats carry a title the hero can wear (the
  Crownbreaker name becomes one). Earned retroactively on load, so an old save starts with
  what it already did.
- **Companion errands.** Companions that are not at the hero's side can be sent on errands
  of two hours (the hero's time, so time away counts): scavenge (dust), forage (currency),
  delve (stones), scout (maps and sigils, endgame). What they bring grows with their level;
  every errand adds bond, so the whole collection grows. A switch keeps idle companions busy.
- **Balance** with the bot across callings once the above is in: new skills should win
  somewhere and not everywhere; the attack callings' pinnacle survival and the Strider.

Later: skill mastery (skills and supports grow with use); a weekly omen.

---

## Round 5 (as planned, for the record)

**Status (round 5 built):** the Market (Pedlar, Jeweller), sockets and ember stones, twelve
echoes, three sun shards and the Rekindling with ten dawn perks are in the game, in
en/ru/uk. Changes from the plan below: the Cartographer is not built (maps already drop
plenty); relighting needs the three pinnacles that hold a piece of the sun, not the Hollow
Crown (it ate the light; it stays the optional fight); pinnacles were retuned so an
invested level-85 build can beat them (`tools/pinnacles.ts`).

Where the game is: four acts (about 8 hours idle for the bot), maps T1-16 and the endless Depths,
an atlas tree, four pinnacles, 26 relics with a codex, nine companions, contracts, the
ember shrine, crafting (10 orbs, hone, bench), an upkeeping stash. Ru/uk localisation is
in progress. What is missing is a reason to *come back and shop*, a way to *customise
gear beyond affixes*, and an *ending*: Act 3 closes on "You hold what is left of the sun.
It is not enough to light the March. Not yet." - and nothing ever answers that.

Round 5 answers it in three layers, built in this order:

1. **The Wandering Market** - traders whose stock rotates on the hero's clock.
2. **Sockets and ember stones** - gems you set into gear, with an effect that depends on
   where they sit.
3. **The Rekindling** - an endgame story told through echoes and sun shards, ending in a
   choice to relight the sun: a rebirth (new game plus) with permanent dawn bonuses.

Everything stays idle-friendly: nothing needs to be clicked at a certain time, stock and
drops follow simulation time (so time away counts), and every system has an "automatic"
answer for players who never open its tab.

---

## 1. The Wandering Market

A caravan camps beside the road once Act 1 is done. A tenth tab, **Market** (key 0),
with three traders. Stock is rolled from the save's seed and a market counter, so it is
deterministic like the rest, and it **rotates every 2 hours of the hero's time**; a
"new stock now" button costs dust (price rises with each use in the same rotation).

| Trader | Sells | Paid with |
|---|---|---|
| **The Pedlar** | 6 pieces of gear at the highest item level reached: rares weighted towards the hero's *weakest* slots (by build-score gain), one with sockets, sometimes an unfound relic (expensive) | ember dust |
| **The Jeweller** | ember stones (tiers near the hero's), cutting (3 of a tier -> 1 of the next), a socket drilled into an item, stones pried out | dust |
| **The Cartographer** (after the Sunfall) | maps of chosen tiers, sometimes a sigil, a map "reroll" service | dust |

Prices scale with item level so the market stays a real sink late (a late rare ~5-15k dust,
a relic ~60k). Every item card in the market shows the same compare as the Gear tab, and
the Pedlar marks what would be an upgrade. The upkeep/auto-equip rules apply to bought gear
like to drops (an upgrade goes on at once, else into the stash).

Why a rotating stock: a reason to look again every few hours, without punishing anyone
who doesn't.

## 2. Sockets and ember stones

**Sockets**: gear can carry 0-3 sockets. One-handed weapons, shields, helmets, gloves and
boots up to 2; two-handers and body armour up to 3; rings, amulets and belts 1. Rares drop
with 0-2 sockets (random), relics come with their own fixed count, the Jeweller drills one
more for dust (up to the cap). Sockets live on the item (`item.sockets`, `item.stones`).

**Ember stones**: six kinds, five tiers (Chipped, Flawed, Clear, Flawless, Radiant). What a
stone does depends on where it sits - so the same stone is offence in a weapon, defence in
armour, utility in jewellery:

| Stone | In a weapon | In armour | In jewellery |
|---|---|---|---|
| Ruby | % increased fire damage | + fire resistance | + maximum life |
| Sapphire | % increased cold damage | + cold resistance | + mana regeneration |
| Topaz | % increased lightning damage | + lightning resistance | % item rarity |
| Emerald | % increased critical chance | % increased evasion | + Grace |
| Onyx | hits ignore % elemental resistance | + chaos resistance | % life leech |
| Diamond | % increased attack and cast speed | % increased armour and shield | + all resistances |

Values roughly double from Chipped to Radiant. Stones drop from champions and bosses like
currency (tier by monster level), fill a **stone pouch** (a count per kind and tier), and
cut up 3:1. Setting a stone is free; prying one out returns it (free - experimenting must be
cheap). Salvaging a socketed item returns its stones to the pouch. The item card shows the
sockets as small frames, empty or filled.

Idle answer: an "auto-set" switch fills empty sockets on worn gear with the best stone the
pouch has for that slot (by build score) whenever a stone drops or gear changes.

## 3. The Rekindling (endgame story and rebirth)

**Echoes**: map bosses and pinnacles sometimes leave an *echo* - a page of what happened
the day the sun fell, told by the people who were there (the Warden, the Regent, the bell
keeper, a child in the salt village...). Twelve echoes, collected in the Log tab as a
second chapter list. Each third echo adds a permanent atlas point. The echoes make the
pinnacles a story: the four who each took a piece of the sun.

**Sun shards**: each pinnacle's first kill gives its shard. With all four, the hero can
**relight the sun** (Menu, with a confirmation that says exactly what is kept):

- *Reset*: level, passive tree, ascendancy, gear, stash, world and atlas progress, maps.
- *Kept*: the relic case and codex, companions and their bond, echoes, the stone pouch,
  the shrine settings, totals, and one item of the player's choice ("an heirloom").
- *Gained*: a **Dawn** (1, 2, 3...). Each dawn: 10% more experience and dust, +1 starting
  passive point, the world 15% tougher and 20% richer (rarity/quantity), and a new title in
  the character sheet. A dawn also unlocks one **dawn passive** (a small separate tree of
  ten account-wide bonuses, one pick per dawn).

The story beat: the sun rises over the March for the first time in 300 years; the Kindled
wakes on the shore again - but the shore is warm this time.

Why a rebirth: it is the idle genre's long-term loop, and here the fiction earns it. It is
optional; a player can stay in the Depths forever.

---

## Later (not in round 5)

- Skill mastery: skills and supports gain levels with use (a slow % bonus), shown on the
  Skills tab - more reason to keep one build going.
- A fourth act between the Sunfall and the Cinderlands (seven zones, new monsters from the
  CC0 packs), if the rebirth loop shows the story is the part people like.
- Seasonal events (October: Hollow Night, a themed relic and map mod).
- Achievements/feats with titles.

## Build order and checks

Round 5a: market (Pedlar + Jeweller shell) and sockets/stones (data, drops, effects,
pouch, cutting, drilling, UI in Gear, Forge and Market). Round 5b: Cartographer, echoes and
sun shards. Round 5c: the rebirth. Each step: core first with vitest (determinism, save
migration, validator), `tools/probe.ts` for pacing (stones found per hour, market spend vs
dust income), then UI, headless-Chrome shots, ru/uk strings.
