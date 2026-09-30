// Skill mastery (round 9): points from kills made with a skill, and the levels
// they reach. Levels are copied onto the hero (hero.mastery) so the stat sheet
// stays a function of the hero, like renown.

import { MASTERY_MAX, SKILLS, masteryLevel } from "./data";
import { pushLog } from "./game";
import type { GameState } from "./state";
import { ref } from "../i18n/refs";

/** The mastery level the hero has with a skill. */
export const masteryOf = (s: GameState, skill: string) => masteryLevel(s.mastery?.[skill] ?? 0);

/**
 * Adds points to a skill's mastery. A new level goes on the hero (the sheet
 * changes) and into the chronicle; `onLevel` hears it. Returns the new level
 * when one was reached, else 0.
 */
export function gainMastery(s: GameState, skill: string, points: number, onLevel?: (skill: string, level: number) => void): number {
    if (!SKILLS[skill] || points <= 0) return 0;
    s.mastery ??= {};
    const before = masteryLevel(s.mastery[skill] ?? 0);
    if (before >= MASTERY_MAX) return 0;
    s.mastery[skill] = (s.mastery[skill] ?? 0) + points;
    const after = masteryLevel(s.mastery[skill]);
    if (after === before) return 0;
    syncMastery(s);
    pushLog(s, "level", "log.masteryUp", { skill: ref.skill(skill), n: after });
    onLevel?.(skill, after);
    return after;
}

/** Copies the mastery levels onto the hero (after a load or a relight). */
export function syncMastery(s: GameState): void {
    const levels: Record<string, number> = {};
    for (const [id, pts] of Object.entries(s.mastery ?? {})) { const l = masteryLevel(pts); if (l > 0) levels[id] = l; }
    const same = JSON.stringify(levels) === JSON.stringify(s.hero.mastery ?? {});
    if (Object.keys(levels).length) s.hero.mastery = levels; else delete s.hero.mastery;
    if (!same) s.hero.rev++;
}
