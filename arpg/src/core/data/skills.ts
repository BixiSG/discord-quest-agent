// Active skills. Attacks use the weapon's damage times `effectiveness`;
// spells use `damage` (at hero level 1, grown by spellScale) plus added spell
// damage times `effectiveness`.

import type { DamageType, Mod } from "../types";

export type SkillShape = "single" | "area" | "projectile";

export interface SkillDef {
    id: string;
    name: string;
    kind: "attack" | "spell";
    shape: SkillShape;
    /** Tags for modifier matching: attack/spell, melee, projectile, area, damage types... */
    tags: string[];
    /** Percent of base damage used. */
    effectiveness: number;
    /** Spell damage per type at hero level 1. */
    damage?: Partial<Record<DamageType, [number, number]>>;
    /** Spells: seconds per cast. Attacks: speed multiplier over the weapon (1 = weapon speed). */
    castTime?: number;
    speedMult?: number;
    /** Spells: base critical strike chance in percent. */
    crit?: number;
    /** Area: base targets. Projectiles: base pierce. */
    targets?: number;
    manaCost: number;
    level: number;
    /** Attacks: weapon kinds that can use it (empty = any, including unarmed). */
    weapons?: string[];
    /** Extra modifiers the skill itself grants (conversion, crit...). */
    mods?: Mod[];
    blurb: string;
    /** Render hint for the battle view. */
    fx: "arc" | "slam" | "bolt" | "nova" | "stab";
}

const MELEE = ["sword", "axe", "mace", "greatsword", "greataxe", "dagger", "staff"];

export const SKILLS: Record<string, SkillDef> = {
    crescent: {
        id: "crescent", name: "Crescent Swing", kind: "attack", shape: "area",
        tags: ["attack", "melee", "area"], effectiveness: 100, targets: 3, manaCost: 4, level: 1,
        weapons: MELEE, fx: "arc", blurb: "A wide swing that hits up to three enemies in front of you.",
    },
    sunder: {
        id: "sunder", name: "Sunder", kind: "attack", shape: "single",
        tags: ["attack", "melee", "strike"], effectiveness: 185, speedMult: 0.9, manaCost: 6, level: 4,
        weapons: MELEE, fx: "stab", blurb: "One crushing blow at a single enemy. Slow, heavy, good against bosses.",
        mods: [{ stat: "critChance", kind: "inc", value: 25, src: "Sunder" }],
    },
    hatchet: {
        id: "hatchet", name: "Hatchet Toss", kind: "attack", shape: "projectile",
        tags: ["attack", "projectile"], effectiveness: 90, targets: 1, manaCost: 5, level: 8,
        weapons: ["sword", "axe", "mace", "dagger"], fx: "bolt",
        blurb: "Throws a spinning copy of your weapon that passes through one enemy.",
    },
    quake: {
        id: "quake", name: "Quake Stomp", kind: "attack", shape: "area",
        tags: ["attack", "melee", "area", "slam"], effectiveness: 150, speedMult: 0.72, targets: 5, manaCost: 9, level: 12,
        weapons: MELEE, fx: "slam", blurb: "Stamps the ground so hard the whole pack feels it.",
    },
    cinderwake: {
        id: "cinderwake", name: "Cinderwake", kind: "attack", shape: "area",
        tags: ["attack", "melee", "area", "fire"], effectiveness: 115, targets: 3, manaCost: 8, level: 18,
        weapons: MELEE, fx: "arc", blurb: "A burning arc. Half of its physical damage becomes fire.",
        mods: [{ stat: "convert.fire", kind: "flat", value: 50, src: "Cinderwake" }],
    },
};
