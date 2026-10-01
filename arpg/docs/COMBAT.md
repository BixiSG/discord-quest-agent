# Hollowmarch - combat math

All formulas live in `src/core/` and are covered by tests. Numbers here are
the source of truth; the code cites the section.

## 1. Modifiers

Every source of power (class, level, passives, items, skills, supports,
ascendancies, map mods) produces **modifiers**:

    { stat, kind: "flat" | "inc" | "more", value, tags? }

A modifier with `tags` applies only when every one of its tags is in the
context's tag set (for damage: the skill's tags plus the damage type).

    final = (base + sum(flat)) * (1 + sum(inc) / 100) * prod(1 + more / 100)

`inc` adds up, `more` multiplies. Negative values are "reduced" / "less".

## 2. Damage types

`phys`, `fire`, `cold`, `lightning`, `chaos`. Fire, cold and lightning are
**elemental** (the tag `elemental` is added to their context).

## 3. Hit damage

For each damage type T:

- Attacks: `base_T = weapon_T * effectiveness + added_T(attack) * effectiveness`
- Spells: `base_T = skill_T * spellScale(L) + added_T(spell) * effectiveness`,
  with `spellScale(L) = 1.06^(L-1) * (1 + 0.015 (L-1))` (weapons carry the
  same growth for attacks through their bases).

Hero life before modifiers is `classLife + 20 (L-1)`.

Unarmed attacks use 2-5 phys at 1.2 attacks per second.

**Conversion**: a skill or support may convert a share of phys to one
element. Shares add up and are scaled down if they exceed 100%. Converted
damage is scaled by the modifiers of both the source and the new type (its
tag set holds both).

Then per portion: `avg = (min+max)/2 * (1 + inc/100) * more`.

**Critical strikes**: `chance = baseCrit * (1 + incCrit/100)`, capped at
95%. `multiplier = 1.5 + critMulti/100`. Expected factor
`1 + chance * (multiplier - 1)`.

## 4. Speed

- Attacks: `weapon APS * (1 + incAttackSpeed/100) * more`
- Spells: `1 / castTime * (1 + incCastSpeed/100) * more`

## 5. Accuracy and evasion

    hitChance(acc, eva) = clamp(1.5 * acc / (acc + eva), 0.05, 1)

The hero's base accuracy is `20 + 12 (L-1) * 1.03^(L-1)`, the same curve as
monster evasion, plus 2 per Grace and flat accuracy from gear. Spells always
hit. The player's chance to evade a monster attack is
`1 - hitChance(monsterAcc, playerEva)`, capped at 75%.

## 6. Targets

Area skills hit `floor(baseTargets * (1 + incArea/100))` monsters per use;
projectile skills hit `1 + pierce + chains` (capped at the pack size).
Single-target skills hit one.

## 7. Mitigation (player and monster)

- Armour vs a phys hit of size D: `reduction = A / (A + 8 * D)`, capped at 85%.
- Resistances: `min(res, maxRes)` with `maxRes = 75` (+ modifiers, hard cap
  90). Penetration lowers the target's resistance for that hit only.
- Block: chance capped at 50%; a blocked hit deals no damage.
- Energy shield takes damage before life and starts recharging (20% of max
  per second) after 2 s without taking damage.

## 8. Recovery

Mana regenerates 7% of maximum per second plus flat regeneration. Skill mana
cost grows 2% per hero level and is multiplied by each support's multiplier.
Sheet DPS uses `min(speed, manaRegen / manaCost / 0.6)` uses per second (the
hero fights about 60% of the time and regenerates while travelling), so a
mana-starved build shows what it really does.

- Life regeneration: flat per second plus percent of max life.
- Leech: a share of damage dealt returns as life, at most 10% of max life
  per second.
- Flask: 1 charge per kill (5 per boss), holds 30, a drink costs 10 and heals
  its amount over 2 s. Drunk automatically below 50% life when not already
  active.

## 9. Monsters

Each monster has an archetype (`brute`, `skirmisher`, `caster`, ...) with
multipliers over the level tables in `src/core/data/scaling.ts`:

    life(L)   = 20 * 1.085^(L-1) * (1 + 0.03 (L-1))
    damage(L) = 5  * 1.055^(L-1) * (1 + 0.02 (L-1))
    armour(L) = evasion(L) = accuracy(L) = 12 + 9 (L-1) * 1.03^(L-1)

Monster armour counts at half against the hero's hits. Packs have 2-6 normal
monsters, sometimes a **champion** (x3 life, x1.5 damage, x3 XP). Bosses
spawn one level above their zone with their own multipliers in
`data/monsters.ts` (the Tide-Warden: x25 life, x2.0 damage; the Chapel
Keeper: x12 life, x1.6 damage) and 10-40% resistances.

## 10. Experience

    xpToNext(L)  = round(3 * (80 * L^2.8 + 120 * L) * (L > 60 ? 1.07^(L-60) : 1))
    monsterXp(L) = 4 * L^1.9 + 6

From level 15 to 60 the requirement is also cut by a mid-game discount: 12%
at most, easing in linearly from level 15 to 35, held to level 50, easing out
to nothing by level 60.

Kills more than `3 + floor(L/16)` levels away from the hero give less XP:
the excess distance `d` scales it by `(5 / (5 + d))^2.5`.

## 11. The simulation step

The sim advances in fixed 100 ms steps. In a step:

1. Timers tick: skill cooldown, flask, ES recharge delay, respawn.
2. If the hero is ready and a pack is alive, the hero uses the skill: rolls
   hit, crit and damage per target from the seeded RNG, applies leech.
3. Every living monster whose attack timer is up attacks: evade, block,
   mitigation, ES, life.
4. Regen and flask healing apply; the flask auto-drinks.
5. Dead pack -> travel time (1.5 s), next pack. All packs dead -> boss or
   run complete -> loot and next run.

Runs are seeded from `(saveSeed, runIndex)`, so a run replays exactly.

## 12. The Fray

The player-steered fight (`src/core/fray.ts`) uses the same hit, mitigation and
loot maths as sections 3-8 and 10; it differs in positions and timing.

1. Time: 60 steps a second (`FRAY_STEP_MS`), at most 250 ms of wall clock
   per advance. The arena is 440 x 280 px.
2. Hero speed: `HERO_SPEED` 66 px/s x the sheet's movement speed, clamped to
   the arena.
3. Hero reach: 28 px melee, 38 px area (round the hero), 128 px projectiles
   (bosses count 10 px nearer). The skill fires at the nearest `targets`
   monsters in reach on its own cooldown and mana, like on the road.
4. Monster speed: `30 + 16 x attack speed` px/s, +4 for birds, x0.85 for
   bosses, x1.1 for champions. Monster reach is `14 + 8 x size` px (+8 for
   bosses); it walks until within 0.8 of that and swings when within 1.25 of
   it, a swing at air being a dodge.
5. Casters walk to 96 px, stand between 72 and 96, and back off at 0.35 of
   their speed when closer; they hit from up to 108 px.
6. Waves: the first at 0.8 s, one per road pack (the zone's pack size and
   champion chance), the next when the last is down or after `WAVE_EVERY` 12 s;
   the zone's boss (one level above the zone) once the last wave is down.
7. Flask: the key drinks it below 70% life, it drinks itself below 20%; the
   charges and healing are the road's (section 8).
8. Bonuses: each kill pays x1.5 experience and +60 loot rarity. A win adds one
   item at +200 rarity (plus the hero's, +60), two chances at 50% for a
   currency drop, and experience equal to six kills of the zone's level. A fall
   ends the fray with no death penalty.
