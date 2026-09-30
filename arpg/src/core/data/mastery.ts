// Skill mastery (round 9): a skill grows with use. Every kill made with it adds
// a point (a boss ten); levels 1-10 each need more. Mastery is the player's,
// kept across dawns like feats, and it only helps the skill it belongs to.

import type { Mod } from "../types";

export const MASTERY_MAX = 10;
/** Points a boss kill is worth (any other kill: one). */
export const MASTERY_BOSS = 10;
/** Per level: percent more damage with the skill. */
export const MASTERY_DAMAGE = 1.5;
/** At this level: percent less mana cost; at the top: percent increased attack or cast speed. */
export const MASTERY_MANA_AT = 5, MASTERY_MANA = 10, MASTERY_SPEED = 10;

/** Points needed to reach `level` (from zero): 1000 x level squared. */
export const masteryNeed = (level: number) => 1000 * level * level;

/** The level a skill has with `points`. */
export function masteryLevel(points: number): number {
    let l = 0;
    while (l < MASTERY_MAX && points >= masteryNeed(l + 1)) l++;
    return l;
}

/** What a mastery level gives the skill (attack or spell decides the speed). */
export function masteryMods(level: number, kind: "attack" | "spell"): Mod[] {
    if (level <= 0) return [];
    const src = "Mastery";
    const out: Mod[] = [{ stat: "damage", kind: "more", value: MASTERY_DAMAGE * level, src }];
    if (level >= MASTERY_MANA_AT) out.push({ stat: "manaCost", kind: "inc", value: -MASTERY_MANA, src });
    if (level >= MASTERY_MAX) out.push({ stat: kind === "attack" ? "attackSpeed" : "castSpeed", kind: "inc", value: MASTERY_SPEED, src });
    return out;
}
