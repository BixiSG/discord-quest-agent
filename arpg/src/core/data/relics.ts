// Relics (uniques): fixed bases and modifiers, rolled within ranges.

import type { Mod } from "../types";

export interface RelicMod { stat: Mod["stat"]; kind: Mod["kind"]; range: [number, number]; tags?: string[]; text: string }
export interface RelicDef {
    id: string; name: string; base: string; level: number; mods: RelicMod[]; flavour: string; weight: number;
    /** Found only during this seasonal event (season.ts), never in the usual drop pools. */
    season?: string;
}

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

    // ---- round 3: every slot family, levels 25-76 ----
    { id: "pilgrimsknot", name: "Pilgrim's Knot", base: "belt_chain", level: 25, weight: 80, flavour: "Tied once for every shrine that never answered.",
        mods: [r("life", "flat", [50, 70], "+{0} to maximum life"), r("flaskHeal", "inc", [30, 50], "{0}% increased flask healing"), r("flaskCharges", "inc", [20, 30], "{0}% increased flask charges gained")] },
    { id: "brineclutch", name: "Brineclutch", base: "leather_gloves4", level: 26, weight: 70, flavour: "Wet to the wrist. Always.",
        mods: [r("attackSpeed", "inc", [10, 15], "{0}% increased attack speed"), r("lifeOnKill", "flat", [8, 15], "{0} life gained on kill"), r("res.cold", "flat", [20, 30], "+{0}% cold resistance")] },
    { id: "tidecaller", name: "Tidecaller's Loop", base: "ring_tide", level: 30, weight: 70, flavour: "Turn it once and the floor is wet.",
        mods: [r("addMin.cold", "flat", [4, 7], "Adds {0} min cold damage to attacks", ["attack"]), r("addMax.cold", "flat", [12, 18], "Adds {0} max cold damage to attacks", ["attack"]), r("res.cold", "flat", [20, 30], "+{0}% cold resistance"), r("mana", "flat", [30, 40], "+{0} to maximum mana")] },
    { id: "bellwright", name: "The Bellwright's Toll", base: "mace5", level: 38, weight: 60, flavour: "Every blow rings. Something always answers.",
        mods: [r("local.physInc", "inc", [140, 180], "{0}% increased physical damage"), r("area", "inc", [20, 30], "{0}% increased area of effect"), r("str", "flat", [20, 30], "+{0} to Might")] },
    { id: "glassveil", name: "Glassveil", base: "silk_helmet5", level: 38, weight: 60, flavour: "You see the barrens as the barrens see you: in pieces.",
        mods: [r("local.defInc", "inc", [100, 140], "{0}% increased energy shield"), r("castSpeed", "inc", [8, 12], "{0}% increased cast speed"), r("mana", "flat", [40, 60], "+{0} to maximum mana"), r("res.lightning", "flat", [20, 30], "+{0}% lightning resistance")] },
    { id: "hollowcrown", name: "The Hollow Crown", base: "amulet_ember", level: 40, weight: 45, flavour: "Every king of the March wore it. None of them for long.",
        mods: [r("str", "flat", [12, 18], "+{0} to Might"), r("dex", "flat", [12, 18], "+{0} to Grace"), r("int", "flat", [12, 18], "+{0} to Wit"), r("res.chaos", "flat", [15, 20], "+{0}% chaos resistance"), r("itemRarity", "inc", [15, 25], "{0}% increased rarity of items found")] },
    { id: "lanternheart", name: "Lanternheart", base: "ring_glass", level: 45, weight: 50, flavour: "It burns from the inside, and so will you.",
        mods: [r("lifeRegenPct", "flat", [1, 2], "Regenerate {0}% of life per second"), r("life", "inc", [6, 10], "{0}% increased maximum life"), r("res.fire", "flat", [-15, -10], "{0}% fire resistance")] },
    { id: "dunestrider", name: "Dunestrider Wraps", base: "leather_boots6", level: 50, weight: 55, flavour: "The sand forgets your steps before you finish them.",
        mods: [r("moveSpeed", "inc", [25, 35], "{0}% increased movement speed"), r("local.evasion", "flat", [150, 220], "+{0} to evasion"), r("res.fire", "flat", [25, 35], "+{0}% fire resistance"), r("dex", "flat", [20, 30], "+{0} to Grace")] },
    { id: "laststand", name: "Warden's Last Stand", base: "shield_offhand6", level: 50, weight: 50, flavour: "The gate fell. The shield did not.",
        mods: [r("local.defInc", "inc", [120, 160], "{0}% increased armour"), r("block", "flat", [5, 8], "+{0}% chance to block"), r("life", "flat", [60, 90], "+{0} to maximum life"), r("res.chaos", "flat", [20, 30], "+{0}% chaos resistance")] },
    { id: "sunshard", name: "Sunshard Quiver", base: "quiver6", level: 50, weight: 55, flavour: "Each arrow a splinter of the fallen sun.",
        mods: [r("addMin.fire", "flat", [8, 12], "Adds {0} min fire damage to attacks", ["attack"]), r("addMax.fire", "flat", [20, 30], "Adds {0} max fire damage to attacks", ["attack"]), r("pierce", "flat", [1, 1], "Projectiles pierce {0} more enemy"), r("critChance", "inc", [20, 30], "{0}% increased critical chance")] },
    { id: "saltwedding", name: "Salt Wedding Band", base: "ring_void", level: 55, weight: 40, flavour: "Promised to the sea. The sea keeps its promises.",
        mods: [r("itemQuantity", "inc", [8, 12], "{0}% increased quantity of items found"), r("itemRarity", "inc", [20, 30], "{0}% increased rarity of items found"), r("xpGain", "inc", [5, 8], "{0}% increased experience gained")] },
    { id: "voidsinger", name: "Voidsinger", base: "wand7", level: 62, weight: 35, flavour: "It hums the note the world stopped on.",
        mods: [r("damage", "inc", [70, 100], "{0}% increased spell damage", ["spell"]), r("critChance", "inc", [30, 50], "{0}% increased spell critical chance", ["spell"]), r("manaCost", "inc", [20, 30], "{0}% increased mana cost")] },
    { id: "cinderoath", name: "The Cinder Oath", base: "staff7", level: 62, weight: 35, flavour: "Sworn in ash. Kept in fire.",
        mods: [r("addMin.fire", "flat", [20, 30], "Adds {0} min fire damage to spells", ["spell"]), r("addMax.fire", "flat", [45, 65], "Adds {0} max fire damage to spells", ["spell"]), r("damage", "inc", [40, 60], "{0}% increased fire damage", ["fire"]), r("pen.fire", "flat", [10, 15], "Hits ignore {0}% fire resistance"), r("res.cold", "flat", [-20, -10], "{0}% cold resistance")] },
    { id: "drownedheart", name: "Heart of the Drowned", base: "plate_body7", level: 62, weight: 35, flavour: "It stopped beating long ago. It stopped sinking just now.",
        mods: [r("local.defInc", "inc", [160, 220], "{0}% increased armour"), r("life", "inc", [8, 12], "{0}% increased maximum life"), r("maxRes.cold", "flat", [3, 4], "+{0}% maximum cold resistance"), r("lifeRegen", "flat", [20, 35], "{0} life regenerated per second")] },
    { id: "worldbreaker", name: "Worldbreaker", base: "greataxe8", level: 74, weight: 25, flavour: "The March cracked once. This is what cracked it.",
        mods: [r("local.physInc", "inc", [200, 260], "{0}% increased physical damage"), r("critMulti", "flat", [40, 60], "+{0}% critical multiplier"), r("area", "inc", [25, 35], "{0}% increased area of effect"), r("leech", "flat", [1, 2], "{0}% of damage leeched as life")] },
    { id: "lastember", name: "The Last Ember", base: "amulet_ember", level: 76, weight: 20, flavour: "When it goes out, so does the March.",
        mods: [r("damage", "inc", [25, 35], "{0}% increased damage"), r("attackSpeed", "inc", [8, 10], "{0}% increased attack speed"), r("castSpeed", "inc", [8, 10], "{0}% increased cast speed"), r("life", "inc", [8, 10], "{0}% increased maximum life")] },

    // ---- seasonal: Hollow Night (October), from lantern-touched monsters and lantern contracts
    { id: "hollowgrin", name: "The Hollow Grin", base: "leather_helmet1", level: 1, weight: 0, season: "hollownight", flavour: "Carved for the night the sun did not come back. It kept the candle anyway.",
        mods: [r("itemRarity", "inc", [15, 25], "{0}% increased rarity of items found"), r("xpGain", "inc", [4, 8], "{0}% increased experience gained"), r("res.fire", "flat", [15, 25], "+{0}% fire resistance"), r("lifeOnKill", "flat", [4, 10], "{0} life gained on kill")] },
];

export const RELICS: Record<string, RelicDef> = Object.fromEntries(list.map(x => [x.id, x]));

/** A relic roll that is better low (a downside such as more mana cost); every other roll is better high. */
export const betterLow = (m: RelicMod) => m.stat === "manaCost";
