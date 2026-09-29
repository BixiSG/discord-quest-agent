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
const BOW = ["bow"];

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

    // ---- bow skills (Strider)
    twinshot: {
        id: "twinshot", name: "Twin Shot", kind: "attack", shape: "projectile",
        tags: ["attack", "projectile", "bow"], effectiveness: 80, targets: 1, manaCost: 4, level: 1,
        weapons: BOW, fx: "bolt", blurb: "Two arrows from one draw; each can pass through an enemy.",
    },
    barbrain: {
        id: "barbrain", name: "Rain of Barbs", kind: "attack", shape: "area",
        tags: ["attack", "projectile", "area", "bow"], effectiveness: 70, targets: 4, manaCost: 7, level: 6,
        weapons: BOW, fx: "nova", blurb: "Arrows fired high that come down across the whole pack.",
    },
    heartseeker: {
        id: "heartseeker", name: "Heartseeker", kind: "attack", shape: "single",
        tags: ["attack", "projectile", "bow", "strike"], effectiveness: 190, speedMult: 0.85, manaCost: 7, level: 10,
        weapons: BOW, fx: "bolt", blurb: "A slow aimed shot that finds the gaps in armour.",
        mods: [{ stat: "critChance", kind: "inc", value: 60, src: "Heartseeker" }, { stat: "critMulti", kind: "flat", value: 30, src: "Heartseeker" }],
    },
    stormvolley: {
        id: "stormvolley", name: "Storm Volley", kind: "attack", shape: "projectile",
        tags: ["attack", "projectile", "bow", "lightning"], effectiveness: 95, targets: 2, manaCost: 9, level: 18,
        weapons: BOW, fx: "bolt", blurb: "Charged arrows; half their physical damage becomes lightning.",
        mods: [{ stat: "convert.lightning", kind: "flat", value: 50, src: "Storm Volley" }],
    },
    skewer: {
        id: "skewer", name: "Skewer", kind: "attack", shape: "single",
        tags: ["attack", "melee", "strike"], effectiveness: 130, speedMult: 1.2, manaCost: 4, level: 4,
        weapons: ["dagger", "sword"], fx: "stab", blurb: "Fast stabs for when the pack is too close to shoot.",
    },

    // ---- spells (Arcanist)
    emberbolt: {
        id: "emberbolt", name: "Ember Bolt", kind: "spell", shape: "projectile",
        tags: ["spell", "projectile", "fire"], effectiveness: 100, damage: { fire: [5, 9] }, castTime: 0.75, crit: 6, targets: 0, manaCost: 5, level: 1,
        fx: "bolt", blurb: "A thrown coal of the dead sun.",
    },
    frostring: {
        id: "frostring", name: "Rime Ring", kind: "spell", shape: "area",
        tags: ["spell", "area", "cold"], effectiveness: 70, damage: { cold: [4, 7] }, castTime: 0.8, crit: 6, targets: 4, manaCost: 8, level: 4,
        fx: "nova", blurb: "A ring of frost bursts out from you and bites everything near.",
    },
    chainspark: {
        id: "chainspark", name: "Chain Spark", kind: "spell", shape: "projectile",
        tags: ["spell", "projectile", "lightning"], effectiveness: 80, damage: { lightning: [1, 15] }, castTime: 0.7, crit: 7, targets: 2, manaCost: 7, level: 8,
        fx: "bolt", blurb: "A spark that jumps from enemy to enemy.",
    },
    glacial: {
        id: "glacial", name: "Glacial Lance", kind: "spell", shape: "single",
        tags: ["spell", "cold"], effectiveness: 150, damage: { cold: [12, 18] }, castTime: 1.0, crit: 8, manaCost: 10, level: 12,
        fx: "stab", blurb: "A spear of old ice, slow to form and hard to survive.",
    },
    hexbloom: {
        id: "hexbloom", name: "Hex Bloom", kind: "spell", shape: "area",
        tags: ["spell", "area", "chaos"], effectiveness: 80, damage: { chaos: [6, 10] }, castTime: 0.9, crit: 5, targets: 3, manaCost: 11, level: 20,
        fx: "nova", blurb: "Rot flowers open in the pack. Few things resist it.",
    },
};
