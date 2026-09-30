// Support skills: modify the main skill when slotted.

import type { Mod } from "../types";

export interface SupportDef {
    id: string;
    name: string;
    /** The main skill must have at least one of these tags (empty = any). */
    requires: string[];
    mods: Mod[];
    /** Extra area targets or projectile pierce. */
    targets?: number;
    /**
     * Modifiers on the hero (defences, not the skill) while the support is linked to a skill it
     * fits (round 8): they join the stat sheet like gear does, so a support can be defensive.
     */
    self?: Mod[];
    manaMult: number;
    level: number;
    blurb: string;
}

const m = (stat: Mod["stat"], kind: Mod["kind"], value: number, tags?: string[]): Mod => (tags ? { stat, kind, value, tags } : { stat, kind, value });

export const SUPPORTS: Record<string, SupportDef> = {
    heavyhand: { id: "heavyhand", name: "Heavy Hand", requires: ["attack"], level: 1, manaMult: 1.3,
        mods: [m("damage", "more", 35), m("attackSpeed", "more", -10)], blurb: "35% more damage, 10% less attack speed." },
    quicken: { id: "quicken", name: "Quicken", requires: [], level: 1, manaMult: 1.2,
        mods: [m("attackSpeed", "more", 22), m("castSpeed", "more", 22), m("damage", "more", -8)], blurb: "22% more attack and cast speed, 8% less damage." },
    widesweep: { id: "widesweep", name: "Wide Sweep", requires: ["area"], level: 4, manaMult: 1.3,
        mods: [m("area", "inc", 50), m("damage", "more", -10)], blurb: "50% increased area of effect, 10% less damage." },
    bloodthirst: { id: "bloodthirst", name: "Bloodthirst", requires: ["attack"], level: 6, manaMult: 1.2,
        mods: [m("leech", "flat", 3), m("damage", "more", 5)], blurb: "3% of damage leeched as life, 5% more damage." },
    passthrough: { id: "passthrough", name: "Passthrough", requires: ["projectile"], level: 8, manaMult: 1.3, targets: 2,
        mods: [m("damage", "more", -15)], blurb: "Pierces two more enemies, 15% less damage." },
    emberedge: { id: "emberedge", name: "Ember Edge", requires: ["attack"], level: 10, manaMult: 1.2,
        mods: [m("convert.fire", "flat", 50), m("damage", "more", 20, ["fire"])], blurb: "Converts 50% of physical damage to fire; 20% more fire damage." },
    keeneye: { id: "keeneye", name: "Keen Eye", requires: [], level: 14, manaMult: 1.2,
        mods: [m("critChance", "inc", 90), m("critMulti", "flat", 25)], blurb: "90% increased critical chance, +25% critical multiplier." },
    ruthless: { id: "ruthless", name: "Ruthless", requires: ["melee"], level: 20, manaMult: 1.4,
        mods: [m("damage", "more", 30, ["melee"]), m("damage", "more", 20, ["phys"])], blurb: "30% more melee damage, 20% more physical damage." },
    longdraw: { id: "longdraw", name: "Longdraw", requires: ["bow"], level: 20, manaMult: 1.4,
        mods: [m("damage", "more", 30, ["bow"]), m("damage", "more", 20, ["projectile"])], blurb: "30% more damage with bows, 20% more projectile damage." },
    fracture: { id: "fracture", name: "Fracture", requires: ["attack"], level: 26, manaMult: 1.3,
        mods: [m("pen.fire", "flat", 15), m("pen.cold", "flat", 15), m("pen.lightning", "flat", 15), m("damage", "more", 10, ["elemental"])], blurb: "Hits ignore 15% of elemental resistances; 10% more elemental damage." },
    // ---- spell and projectile supports
    echo: { id: "echo", name: "Echoing Words", requires: ["spell"], level: 4, manaMult: 1.4,
        mods: [m("castSpeed", "more", 35), m("damage", "more", -12)], blurb: "35% more cast speed, 12% less damage." },
    potency: { id: "potency", name: "Potency", requires: ["spell"], level: 1, manaMult: 1.3,
        mods: [m("damage", "more", 30, ["spell"])], blurb: "30% more spell damage." },
    volley: { id: "volley", name: "Volley", requires: ["projectile"], level: 6, manaMult: 1.3, targets: 1,
        mods: [m("damage", "more", -10)], blurb: "One more projectile target, 10% less damage." },
    elemfocus: { id: "elemfocus", name: "Elemental Focus", requires: ["fire", "cold", "lightning"], level: 12, manaMult: 1.3,
        mods: [m("damage", "more", 30, ["elemental"])], blurb: "30% more elemental damage." },
    rot: { id: "rot", name: "Rot", requires: [], level: 22, manaMult: 1.3,
        mods: [m("convert.chaos", "flat", 25), m("damage", "more", 15, ["chaos"])], blurb: "25% of physical damage becomes chaos; 15% more chaos damage." },
    // ---- round 8: late supports
    frostbite: { id: "frostbite", name: "Frostbite", requires: ["attack"], level: 28, manaMult: 1.2,
        mods: [m("convert.cold", "flat", 50), m("damage", "more", 20, ["cold"])], blurb: "Converts 50% of physical damage to cold; 20% more cold damage." },
    galvanic: { id: "galvanic", name: "Galvanic", requires: ["attack"], level: 28, manaMult: 1.2,
        mods: [m("convert.lightning", "flat", 50), m("damage", "more", 20, ["lightning"])], blurb: "Converts 50% of physical damage to lightning; 20% more lightning damage." },
    concentrate: { id: "concentrate", name: "Concentrate", requires: ["area"], level: 30, manaMult: 1.3,
        mods: [m("damage", "more", 40), m("area", "inc", -30)], blurb: "40% more damage, 30% reduced area of effect." },
    steadfast: { id: "steadfast", name: "Steadfast", requires: ["attack"], level: 34, manaMult: 1.3,
        mods: [], self: [m("dmgTaken", "more", -15)], blurb: "You take 15% less damage while it is linked." },
    overcharge: { id: "overcharge", name: "Overcharge", requires: ["spell"], level: 38, manaMult: 1.5,
        mods: [m("damage", "more", 50, ["spell"]), m("castSpeed", "more", -8)], blurb: "50% more spell damage, 8% less cast speed." },
};

/** Character levels at which support slots open. */
export const SUPPORT_SLOT_LEVELS = [1, 1, 8, 18, 32];
