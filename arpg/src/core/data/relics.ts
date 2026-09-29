// Relics (uniques): fixed bases and modifiers, rolled within ranges.

import type { Mod } from "../types";

export interface RelicMod { stat: Mod["stat"]; kind: Mod["kind"]; range: [number, number]; tags?: string[]; text: string }
export interface RelicDef { id: string; name: string; base: string; level: number; mods: RelicMod[]; flavour: string; weight: number }

const r = (stat: Mod["stat"], kind: Mod["kind"], range: [number, number], text: string, tags?: string[]): RelicMod => (tags ? { stat, kind, range, text, tags } : { stat, kind, range, text });

const list: RelicDef[] = [
    { id: "tidebreaker", name: "The Tide's Refusal", base: "greatsword3", level: 16, weight: 100, flavour: "It was forged to hold the sea back. It still tries.",
        mods: [r("local.physInc", "inc", [120, 160], "{0}% increased physical damage"), r("res.cold", "flat", [20, 30], "+{0}% cold resistance"), r("life", "flat", [40, 60], "+{0} to maximum life")] },
    { id: "lampwick", name: "Lampwick", base: "wand2", level: 8, weight: 100, flavour: "Still warm. Still waiting for someone to come home.",
        mods: [r("damage", "inc", [40, 60], "{0}% increased spell damage", ["spell"]), r("addMin.fire", "flat", [3, 5], "Adds {0} min fire damage to spells", ["spell"]), r("addMax.fire", "flat", [9, 14], "Adds {0} max fire damage to spells", ["spell"]), r("manaRegen", "flat", [3, 5], "{0} mana regenerated per second")] },
    { id: "gullfeather", name: "Gullfeather Stride", base: "leather_boots2", level: 8, weight: 100, flavour: "The gulls never land. Now neither do you.",
        mods: [r("moveSpeed", "inc", [25, 35], "{0}% increased movement speed"), r("local.evasion", "flat", [60, 90], "+{0} to evasion"), r("dex", "flat", [15, 25], "+{0} to Grace")] },
    { id: "chapelbell", name: "The Keeper's Bell", base: "amulet_life", level: 12, weight: 80, flavour: "Rings for a service no one attends.",
        mods: [r("life", "inc", [8, 12], "{0}% increased maximum life"), r("lifeRegenPct", "flat", [1, 2], "Regenerate {0}% of life per second"), r("res.chaos", "flat", [15, 25], "+{0}% chaos resistance")] },
    { id: "saltcrown", name: "Saltcrown", base: "plate_helmet3", level: 16, weight: 90, flavour: "Heavy with the sea. Heavier with the oath.",
        mods: [r("local.defInc", "inc", [80, 120], "{0}% increased armour"), r("res.fire", "flat", [15, 25], "+{0}% fire resistance"), r("res.cold", "flat", [15, 25], "+{0}% cold resistance"), r("res.lightning", "flat", [15, 25], "+{0}% lightning resistance")] },
    { id: "emberknot", name: "Emberknot", base: "ring_ember", level: 20, weight: 80, flavour: "Two coals that never quite touch.",
        mods: [r("damage", "inc", [20, 30], "{0}% increased fire damage", ["fire"]), r("convert.fire", "flat", [20, 30], "{0}% of physical damage converted to fire"), r("res.cold", "flat", [-20, -10], "{0}% cold resistance")] },
    { id: "lastlight", name: "Last Light", base: "dagger8", level: 74, weight: 30, flavour: "The final ray of the March's sun, sharpened.",
        mods: [r("local.physInc", "inc", [180, 240], "{0}% increased physical damage"), r("local.critChance", "inc", [40, 60], "{0}% increased critical chance"), r("critMulti", "flat", [30, 45], "+{0}% critical multiplier"), r("leech", "flat", [2, 3], "{0}% of damage leeched as life")] },
    { id: "hollowheart", name: "Hollow Heart", base: "silk_body5", level: 38, weight: 60, flavour: "There is nothing in it. That is the point.",
        mods: [r("local.defInc", "inc", [150, 200], "{0}% increased energy shield"), r("energyShield", "inc", [10, 15], "{0}% increased maximum energy shield"), r("life", "more", [-20, -20], "{0}% less maximum life")] },
    { id: "stormstring", name: "Stormstring", base: "bow4", level: 26, weight: 70, flavour: "It hums before the storm does.",
        mods: [r("local.addMin.lightning", "flat", [2, 4], "Adds {0} min lightning damage"), r("local.addMax.lightning", "flat", [60, 80], "Adds {0} max lightning damage"), r("local.attackSpeed", "inc", [10, 15], "{0}% increased attack speed"), r("pierce", "flat", [1, 1], "Projectiles pierce {0} more enemy")] },
    { id: "wardenseye", name: "Warden's Eye", base: "focus_offhand4", level: 26, weight: 70, flavour: "It watched the gate for three hundred years and never blinked.",
        mods: [r("castSpeed", "inc", [12, 18], "{0}% increased cast speed"), r("damage", "inc", [30, 40], "{0}% increased cold damage", ["cold"]), r("pen.cold", "flat", [10, 15], "Hits ignore {0}% cold resistance")] },
];

export const RELICS: Record<string, RelicDef> = Object.fromEntries(list.map(x => [x.id, x]));
