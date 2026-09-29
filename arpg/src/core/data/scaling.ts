// Level tables (COMBAT.md sections 9 and 10). Balance changes go here.

export const MAX_LEVEL = 100;

export function monsterLife(level: number): number {
    const l = level - 1;
    return 20 * Math.pow(1.085, l) * (1 + 0.03 * l);
}
export function monsterDamage(level: number): number {
    const l = level - 1;
    return 5 * Math.pow(1.055, l) * (1 + 0.02 * l);
}
/** Monster armour, evasion and accuracy share one curve. */
export function monsterDefence(level: number): number {
    const l = level - 1;
    return 12 + 9 * l * Math.pow(1.03, l);
}
export function monsterXp(level: number): number {
    return 4 * Math.pow(level, 1.9) + 6;
}
export function xpToNext(level: number): number {
    if (level >= MAX_LEVEL) return Infinity;
    const late = level > 60 ? Math.pow(1.07, level - 60) : 1;
    return Math.round((80 * Math.pow(level, 2.8) + 120 * level) * late);
}
/** XP multiplier for a kill `monsterLevel` by a hero of `heroLevel`. */
export function xpPenalty(heroLevel: number, monsterLevel: number): number {
    const safe = 3 + Math.floor(heroLevel / 16);
    const d = Math.abs(heroLevel - monsterLevel) - safe;
    return d <= 0 ? 1 : Math.pow(5 / (5 + d), 2.5);
}
/** Spell base damage growth with hero level (attacks grow through weapons). */
export function spellScale(level: number): number {
    const l = level - 1;
    return Math.pow(1.06, l) * (1 + 0.015 * l);
}
/** Hero life before modifiers. */
export function heroBaseLife(level: number, classLife: number): number {
    return classLife + 16 * (level - 1);
}
export function heroBaseMana(level: number): number {
    return 40 + 6 * (level - 1);
}
export function heroBaseAccuracy(level: number): number {
    return 20 + 10 * (level - 1);
}
