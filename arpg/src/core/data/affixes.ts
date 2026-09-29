// Item affixes. Each tier is gated by item level and rolls one value per mod.
// `domains`: the affix can roll on an item whose domain set (see domainsOf in
// items.ts) contains any of these.

import type { Mod, StatId } from "../types";

export interface AffixTier { ilvl: number; ranges: [number, number][] }
export interface AffixDef {
    id: string;
    type: "prefix" | "suffix";
    /** Prefix: an adjective ("Tempered"). Suffix: "of the Tide". */
    label: string;
    group: string;
    domains: string[];
    weight: number;
    mods: { stat: StatId; kind: Mod["kind"]; tags?: string[] }[];
    tiers: AffixTier[];
    /** Display template; {0}, {1} are the rolls. */
    text: string;
}

export const AFFIX_ILVLS = [1, 11, 22, 34, 46, 58, 70, 82];

/** Builds tiers from a value at the first and the last tier level; `ratio` is the low end of each roll. */
function ladder(first: number[], last: number[], opts: { curve?: number; ratio?: number; count?: number; from?: number } = {}): AffixTier[] {
    const curve = opts.curve ?? 1.3, ratio = opts.ratio ?? 0.8;
    const ilvls = AFFIX_ILVLS.slice(opts.from ?? 0, (opts.from ?? 0) + (opts.count ?? AFFIX_ILVLS.length));
    const n = ilvls.length;
    return ilvls.map((ilvl, i) => {
        const f = n === 1 ? 1 : Math.pow(i / (n - 1), curve);
        return {
            ilvl,
            ranges: first.map((a, k) => {
                const hi = Math.max(1, Math.round(a + (last[k]! - a) * f));
                return [Math.max(1, Math.round(hi * ratio)), hi] as [number, number];
            }),
        };
    });
}

type Opt = Parameters<typeof ladder>[2];
const A = (id: string, type: AffixDef["type"], label: string, group: string, domains: string[], weight: number,
    mods: AffixDef["mods"], text: string, first: number[], last: number[], opts?: Opt): AffixDef =>
    ({ id, type, label, group, domains, weight, mods, text, tiers: ladder(first, last, opts) });

const DEF = ["body", "helmet", "gloves", "boots", "shield", "buckler", "focus"];
const JEWEL = ["amulet", "ring", "belt"];
const MELEE = ["melee"];
const CASTER = ["caster"];

const list: AffixDef[] = [
    // ---- prefixes: life and defences
    A("life", "prefix", "Hale", "life", [...DEF, ...JEWEL], 1000, [{ stat: "life", kind: "flat" }], "+{0} to maximum life", [12], [150]),
    A("mana", "prefix", "Lucid", "mana", ["amulet", "ring", "helmet", "gloves", "caster", "focus"], 700, [{ stat: "mana", kind: "flat" }], "+{0} to maximum mana", [10], [90]),
    A("es", "prefix", "Shimmering", "es", ["es", "amulet", "belt"], 800, [{ stat: "energyShield", kind: "flat" }], "+{0} to maximum energy shield", [6], [90]),
    A("ar_local", "prefix", "Tempered", "defFlat", ["ar"], 900, [{ stat: "local.armour", kind: "flat" }], "+{0} to armour", [10], [260]),
    A("ev_local", "prefix", "Slippery", "defFlat", ["ev"], 900, [{ stat: "local.evasion", kind: "flat" }], "+{0} to evasion", [10], [260]),
    A("es_local", "prefix", "Glowing", "defFlat", ["es"], 900, [{ stat: "local.energyShield", kind: "flat" }], "+{0} to energy shield (local)", [4], [60]),
    A("def_inc", "prefix", "Reinforced", "defInc", DEF, 900, [{ stat: "local.defInc", kind: "inc" }], "{0}% increased defences", [12], [100], { curve: 1 }),
    A("armour_belt", "prefix", "Studded", "armourFlat", ["belt"], 600, [{ stat: "armour", kind: "flat" }], "+{0} to armour", [15], [320]),

    // ---- prefixes: weapon damage (local)
    A("phys_local", "prefix", "Honed", "physInc", ["weapon"], 1000, [{ stat: "local.physInc", kind: "inc" }], "{0}% increased physical damage", [20], [170], { curve: 1 }),
    A("phys_add_local", "prefix", "Jagged", "physAdd", ["weapon"], 1000,
        [{ stat: "local.addMin.phys", kind: "flat" }, { stat: "local.addMax.phys", kind: "flat" }], "Adds {0} to {1} physical damage", [1, 3], [28, 50]),
    A("fire_add_local", "prefix", "Smouldering", "fireAdd", ["weapon"], 600,
        [{ stat: "local.addMin.fire", kind: "flat" }, { stat: "local.addMax.fire", kind: "flat" }], "Adds {0} to {1} fire damage", [2, 4], [40, 70]),
    A("cold_add_local", "prefix", "Rimed", "coldAdd", ["weapon"], 600,
        [{ stat: "local.addMin.cold", kind: "flat" }, { stat: "local.addMax.cold", kind: "flat" }], "Adds {0} to {1} cold damage", [2, 4], [36, 64]),
    A("light_add_local", "prefix", "Crackling", "lightAdd", ["weapon"], 600,
        [{ stat: "local.addMin.lightning", kind: "flat" }, { stat: "local.addMax.lightning", kind: "flat" }], "Adds {0} to {1} lightning damage", [1, 6], [8, 110]),
    A("spell_inc", "prefix", "Chanting", "spellInc", [...CASTER, "focus", "amulet"], 900, [{ stat: "damage", kind: "inc", tags: ["spell"] }], "{0}% increased spell damage", [10], [90], { curve: 1 }),
    A("spell_fire", "prefix", "Kindled", "spellAdd", CASTER, 500,
        [{ stat: "addMin.fire", kind: "flat", tags: ["spell"] }, { stat: "addMax.fire", kind: "flat", tags: ["spell"] }], "Adds {0} to {1} fire damage to spells", [1, 3], [22, 40]),
    A("spell_light", "prefix", "Stormborn", "spellAdd", CASTER, 500,
        [{ stat: "addMin.lightning", kind: "flat", tags: ["spell"] }, { stat: "addMax.lightning", kind: "flat", tags: ["spell"] }], "Adds {0} to {1} lightning damage to spells", [1, 4], [5, 60]),

    // ---- prefixes: global damage on jewellery/gloves/quivers
    A("atk_phys", "prefix", "Barbed", "atkPhys", ["ring", "gloves", "quiver", "amulet"], 600,
        [{ stat: "addMin.phys", kind: "flat", tags: ["attack"] }, { stat: "addMax.phys", kind: "flat", tags: ["attack"] }], "Adds {0} to {1} physical damage to attacks", [1, 2], [9, 16], { count: 6 }),
    A("atk_fire", "prefix", "Scorching", "atkFire", ["ring", "gloves", "quiver", "amulet"], 500,
        [{ stat: "addMin.fire", kind: "flat", tags: ["attack"] }, { stat: "addMax.fire", kind: "flat", tags: ["attack"] }], "Adds {0} to {1} fire damage to attacks", [1, 3], [14, 24], { count: 6 }),
    A("ele_inc", "prefix", "Prismatic", "eleInc", ["amulet", "ring", "focus", "quiver"], 600, [{ stat: "damage", kind: "inc", tags: ["elemental"] }], "{0}% increased elemental damage", [6], [36], { curve: 1 }),
    A("phys_inc", "prefix", "Brutal", "physGlobal", ["amulet", "belt"], 500, [{ stat: "damage", kind: "inc", tags: ["phys"] }], "{0}% increased physical damage", [6], [34], { curve: 1 }),

    // ---- suffixes: attributes, resistances
    A("str", "suffix", "of the Ox", "str", [...DEF, ...JEWEL, "weapon"], 800, [{ stat: "str", kind: "flat" }], "+{0} to Might", [5], [55], { curve: 1 }),
    A("dex", "suffix", "of the Heron", "dex", [...DEF, ...JEWEL, "weapon", "quiver"], 800, [{ stat: "dex", kind: "flat" }], "+{0} to Grace", [5], [55], { curve: 1 }),
    A("int", "suffix", "of the Owl", "int", [...DEF, ...JEWEL, "weapon"], 800, [{ stat: "int", kind: "flat" }], "+{0} to Wit", [5], [55], { curve: 1 }),
    A("res_fire", "suffix", "of the Hearth", "resFire", [...DEF, ...JEWEL, "quiver"], 1000, [{ stat: "res.fire", kind: "flat" }], "+{0}% fire resistance", [8], [46], { curve: 1 }),
    A("res_cold", "suffix", "of the Tide", "resCold", [...DEF, ...JEWEL, "quiver"], 1000, [{ stat: "res.cold", kind: "flat" }], "+{0}% cold resistance", [8], [46], { curve: 1 }),
    A("res_light", "suffix", "of the Squall", "resLight", [...DEF, ...JEWEL, "quiver"], 1000, [{ stat: "res.lightning", kind: "flat" }], "+{0}% lightning resistance", [8], [46], { curve: 1 }),
    A("res_chaos", "suffix", "of the Hollow", "resChaos", [...DEF, ...JEWEL], 300, [{ stat: "res.chaos", kind: "flat" }], "+{0}% chaos resistance", [5], [35], { curve: 1, from: 2, count: 6 }),

    // ---- suffixes: offence
    A("aspd_local", "suffix", "of Haste", "aspd", ["weapon"], 800, [{ stat: "local.attackSpeed", kind: "inc" }], "{0}% increased attack speed", [5], [27], { curve: 1 }),
    A("aspd", "suffix", "of Hurry", "aspdGlobal", ["gloves", "quiver", "ring", "amulet"], 500, [{ stat: "attackSpeed", kind: "inc" }], "{0}% increased attack speed", [4], [16], { curve: 1, count: 6 }),
    A("cspd", "suffix", "of Chanting", "cspd", [...CASTER, "amulet", "ring", "focus"], 600, [{ stat: "castSpeed", kind: "inc" }], "{0}% increased cast speed", [5], [28], { curve: 1 }),
    A("crit_local", "suffix", "of Precision", "crit", ["weapon"], 700, [{ stat: "local.critChance", kind: "inc" }], "{0}% increased critical chance", [10], [38], { curve: 1 }),
    A("crit", "suffix", "of Omens", "critGlobal", ["amulet", "ring", "helmet", "quiver", "focus"], 600, [{ stat: "critChance", kind: "inc" }], "{0}% increased critical chance", [8], [38], { curve: 1 }),
    A("critmulti", "suffix", "of Ruin", "critMulti", ["weapon", "amulet", "quiver", "gloves"], 500, [{ stat: "critMulti", kind: "flat" }], "+{0}% critical multiplier", [8], [38], { curve: 1 }),
    A("accuracy", "suffix", "of the Hawk", "accuracy", ["weapon", "helmet", "gloves", "ring", "amulet", "quiver"], 700, [{ stat: "accuracy", kind: "flat" }], "+{0} to accuracy", [20], [420]),
    A("leech", "suffix", "of the Leech", "leech", ["gloves", "ring", "amulet", "weapon"], 400, [{ stat: "leech", kind: "flat" }], "{0}% of attack damage leeched as life", [1], [3], { curve: 1, from: 1, count: 5, ratio: 1 }),
    A("area", "suffix", "of Reach", "area", ["amulet", "helmet", "gloves"], 300, [{ stat: "area", kind: "inc" }], "{0}% increased area of effect", [6], [20], { curve: 1, from: 2, count: 6 }),

    // ---- suffixes: sustain and utility
    A("regen", "suffix", "of Mending", "regen", [...DEF, ...JEWEL], 700, [{ stat: "lifeRegen", kind: "flat" }], "{0} life regenerated per second", [1], [45]),
    A("mana_regen", "suffix", "of Clarity", "manaRegen", ["amulet", "ring", "helmet", "caster", "focus"], 500, [{ stat: "manaRegen", kind: "flat" }], "{0} mana regenerated per second", [1], [14]),
    A("flask", "suffix", "of the Well", "flask", ["belt", "gloves"], 500, [{ stat: "flaskHeal", kind: "inc" }], "{0}% increased flask healing", [8], [40], { curve: 1, count: 6 }),
    A("block", "suffix", "of the Wall", "block", ["shield", "buckler"], 600, [{ stat: "block", kind: "flat" }], "+{0}% chance to block", [2], [8], { curve: 1, count: 6 }),
    A("move", "suffix", "of the Road", "move", ["boots"], 800, [{ stat: "moveSpeed", kind: "inc" }], "{0}% increased movement speed", [8], [30], { curve: 1, count: 6 }),
    A("rarity", "suffix", "of Plunder", "rarity", ["ring", "amulet", "helmet", "boots"], 500, [{ stat: "itemRarity", kind: "inc" }], "{0}% increased rarity of items found", [6], [26], { curve: 1, count: 6 }),
    A("life_kill", "suffix", "of the Vulture", "lifeOnKill", ["weapon", "ring", "gloves"], 400, [{ stat: "lifeOnKill", kind: "flat" }], "{0} life gained per kill", [3], [60]),
];

export const AFFIXES: Record<string, AffixDef> = Object.fromEntries(list.map(a => [a.id, a]));
if (Object.keys(AFFIXES).length !== list.length) throw new Error("duplicate affix id");

/** Rare item names: one of each list. */
export const RARE_NAMES_A = ["Grim", "Salt", "Hollow", "Tide", "Dusk", "Ember", "Gloom", "Wrack", "Brine", "Storm", "Ash", "Wither", "Lantern", "Glass", "Cinder", "Mourn", "Drift", "Bone", "Rust", "Omen"];
export const RARE_NAMES_B = ["Bite", "Song", "Ward", "Mark", "Coil", "Veil", "Fang", "Shell", "Grasp", "Knell", "Wake", "Spire", "Crest", "Wail", "Hook", "Bloom", "Scar", "Turn", "Keel", "Hush"];
