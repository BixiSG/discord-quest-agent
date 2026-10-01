// Item bases, generated from per-kind ladders so every kind has a base at each
// tier level. Weapon damage and defences follow the curves below.

import type { Mod, Slot } from "../types";

export interface WeaponStats { phys: [number, number]; aps: number; crit: number; hands: 1 | 2; ranged: boolean }
export interface DefenceStats { armour: number; evasion: number; energyShield: number; block?: number }

export interface BaseDef {
    id: string;
    name: string;
    slot: Slot | "ring";
    kind: string;
    level: number;
    weapon?: WeaponStats;
    defence?: DefenceStats;
    implicit?: Mod[];
}

export const TIER_LEVELS = [1, 8, 16, 26, 38, 50, 62, 74];

const weaponAvg = (lvl: number) => (4 + 0.9 * lvl) * Math.pow(1.018, lvl);
const defence = (lvl: number) => (8 + 2.6 * lvl) * Math.pow(1.02, lvl);

interface WeaponKind { kind: string; hands: 1 | 2; aps: number; crit: number; dmg: number; spread: number; ranged?: boolean; names: string[]; implicit?: (lvl: number) => Mod[] }
const WEAPONS: WeaponKind[] = [
    { kind: "sword", hands: 1, aps: 1.5, crit: 5, dmg: 1.0, spread: 0.45,
        names: ["Rusted Blade", "Ferry Sabre", "Tidesteel Blade", "Reedcutter", "Glasscut Sabre", "Lantern Blade", "Sunforged Blade", "Emberheart Edge"],
        implicit: () => [{ stat: "accuracy", kind: "flat", value: 40 }] },
    { kind: "axe", hands: 1, aps: 1.35, crit: 5, dmg: 1.12, spread: 0.6,
        names: ["Driftwood Hatchet", "Bearded Axe", "Netmender Axe", "Keelsplitter", "Saltcrust Axe", "Dunebiter", "Sunset Cleaver", "Ashen Reaver"] },
    { kind: "mace", hands: 1, aps: 1.25, crit: 5, dmg: 1.2, spread: 0.3,
        names: ["Knotted Club", "Anchor Mace", "Barnacle Maul", "Bellwright Mace", "Glass Morningstar", "Pilgrim Flail", "Dawnhammer", "Cinder Sceptre"] },
    { kind: "dagger", hands: 1, aps: 1.7, crit: 7, dmg: 0.8, spread: 0.7,
        names: ["Gutting Knife", "Scaler", "Eelbone Dirk", "Mistkiss Dagger", "Glass Stiletto", "Oath Knife", "Sunshard Kris", "Last Light"],
        implicit: () => [{ stat: "critChance", kind: "inc", value: 30 }] },
    { kind: "greatsword", hands: 2, aps: 1.25, crit: 5, dmg: 2.0, spread: 0.45,
        names: ["Bent Zweihander", "Harbour Greatsword", "Tidebreaker", "Seawall Blade", "Glass Colossus", "Oathkeeper", "Sunfall Greatsword", "Worldember"],
        implicit: () => [{ stat: "accuracy", kind: "flat", value: 80 }] },
    { kind: "greataxe", hands: 2, aps: 1.12, crit: 5, dmg: 2.3, spread: 0.6,
        names: ["Woodsplitter", "Whaler Axe", "Leviathan Axe", "Wreckbreaker", "Dune Executioner", "Pyre Axe", "Horizon Cleaver", "Endember Axe"] },
    { kind: "staff", hands: 2, aps: 1.2, crit: 6, dmg: 1.7, spread: 0.4,
        names: ["Crooked Staff", "Tidecaller Staff", "Coral Staff", "Lighthouse Staff", "Mirage Staff", "Eclipse Staff", "Solar Staff", "Ember Crozier"],
        implicit: (lvl) => [{ stat: "damage", kind: "inc", value: 10 + Math.round(lvl / 3), tags: ["spell"] }] },
    { kind: "bow", hands: 2, aps: 1.3, crit: 6, dmg: 2.0, spread: 0.55, ranged: true,
        names: ["Fishing Bow", "Gull Bow", "Reed Longbow", "Cliff Bow", "Glasswing Bow", "Storm Bow", "Dawnstring", "Emberflight"] },
    { kind: "wand", hands: 1, aps: 1.4, crit: 7, dmg: 0.75, spread: 0.5, ranged: true,
        names: ["Driftwood Wand", "Candle Wand", "Pearl Wand", "Lantern Wand", "Prism Wand", "Omen Wand", "Corona Wand", "Ember Wand"],
        implicit: (lvl) => [{ stat: "damage", kind: "inc", value: 8 + Math.round(lvl / 4), tags: ["spell"] }] },
];

interface ArmourKind { kind: string; slot: Slot; mult: number; ar: number; ev: number; es: number; block?: number; names: string[] }
const PLATE = ["Dented", "Harbour", "Barnacled", "Seawall", "Glass", "Pilgrim", "Dawnforged", "Ember"];
const LEATHER = ["Patched", "Sealskin", "Oiled", "Cliffrunner", "Sandstrider", "Duskstalker", "Horizon", "Ashwalker"];
const SILK = ["Frayed", "Chapel", "Tidewoven", "Lantern", "Mirage", "Eclipse", "Solar", "Kindled"];
const ARMOURS: ArmourKind[] = [];
const armourSet = (slot: Slot, mult: number, noun: string[]) => {
    ARMOURS.push({ kind: "plate", slot, mult, ar: 1.4, ev: 0, es: 0, names: PLATE.map(p => `${p} ${noun[0]}`) });
    ARMOURS.push({ kind: "leather", slot, mult, ar: 0, ev: 1.4, es: 0, names: LEATHER.map(p => `${p} ${noun[1]}`) });
    ARMOURS.push({ kind: "silk", slot, mult, ar: 0, ev: 0, es: 0.3, names: SILK.map(p => `${p} ${noun[2]}`) });
    ARMOURS.push({ kind: "brigand", slot, mult, ar: 0.8, ev: 0.8, es: 0, names: PLATE.map((_, i) => `${LEATHER[i]} ${noun[3]}`) });
};
// [plate, leather, silk, hybrid] nouns per slot.
const NOUNS: Record<string, string[]> = {
    body: ["Cuirass", "Jerkin", "Robe", "Brigandine"],
    helmet: ["Helm", "Hood", "Circlet", "Sallet"],
    gloves: ["Gauntlets", "Gloves", "Wraps", "Bracers"],
    boots: ["Greaves", "Boots", "Slippers", "Treads"],
};
armourSet("body", 1.0, NOUNS.body!);
armourSet("helmet", 0.55, NOUNS.helmet!);
armourSet("gloves", 0.42, NOUNS.gloves!);
armourSet("boots", 0.42, NOUNS.boots!);
ARMOURS.push({ kind: "shield", slot: "offhand", mult: 0.8, ar: 1.4, ev: 0, es: 0, block: 22, names: PLATE.map(p => `${p} Tower Shield`) });
ARMOURS.push({ kind: "buckler", slot: "offhand", mult: 0.6, ar: 0, ev: 1.4, es: 0, block: 16, names: LEATHER.map(p => `${p} Buckler`) });
ARMOURS.push({ kind: "focus", slot: "offhand", mult: 0.6, ar: 0, ev: 0, es: 0.3, names: SILK.map(p => `${p} Focus`) });

const r = (x: number) => Math.max(1, Math.round(x));

function build(): Record<string, BaseDef> {
    const out: Record<string, BaseDef> = {};
    const add = (b: BaseDef) => { if (out[b.id]) throw new Error("duplicate base " + b.id); out[b.id] = b; };
    for (const w of WEAPONS) {
        TIER_LEVELS.forEach((lvl, i) => {
            const avg = weaponAvg(lvl) * w.dmg;
            const b: BaseDef = {
                id: `${w.kind}${i + 1}`, name: w.names[i]!, slot: "weapon", kind: w.kind, level: lvl,
                weapon: { phys: [r(avg * (1 - w.spread / 2)), r(avg * (1 + w.spread / 2))], aps: w.aps, crit: w.crit, hands: w.hands, ranged: !!w.ranged },
            };
            const imp = w.implicit?.(lvl);
            if (imp) b.implicit = imp;
            add(b);
        });
    }
    for (const a of ARMOURS) {
        TIER_LEVELS.forEach((lvl, i) => {
            const d = defence(lvl) * a.mult;
            const def: DefenceStats = { armour: a.ar ? r(d * a.ar) : 0, evasion: a.ev ? r(d * a.ev) : 0, energyShield: a.es ? r(d * a.es) : 0 };
            if (a.block) def.block = a.block;
            add({ id: `${a.kind}_${a.slot}${i + 1}`, name: a.names[i]!, slot: a.slot, kind: a.kind, level: lvl, defence: def });
        });
    }
    const QUIVERS = ["Frayed Quiver", "Gull Quiver", "Reed Quiver", "Cliff Quiver", "Glass Quiver", "Storm Quiver", "Dawn Quiver", "Ember Quiver"];
    TIER_LEVELS.forEach((lvl, i) => add({ id: `quiver${i + 1}`, name: QUIVERS[i]!, slot: "offhand", kind: "quiver", level: lvl,
        implicit: [{ stat: "damage", kind: "inc", value: 10 + 2 * i, tags: ["projectile"] }] }));

    const JEWELS: [string, BaseDef["slot"], string, number, Mod[]][] = [
        ["amulet_might", "amulet", "Iron Torc", 1, [{ stat: "str", kind: "flat", value: 20 }]],
        ["amulet_grace", "amulet", "Shell Pendant", 1, [{ stat: "dex", kind: "flat", value: 20 }]],
        ["amulet_wit", "amulet", "Pearl Locket", 1, [{ stat: "int", kind: "flat", value: 20 }]],
        ["amulet_life", "amulet", "Coral Charm", 12, [{ stat: "lifeRegen", kind: "flat", value: 4 }]],
        ["amulet_ember", "amulet", "Ember Reliquary", 40, [{ stat: "damage", kind: "inc", value: 12 }]],
        ["ring_iron", "ring", "Iron Band", 1, [{ stat: "life", kind: "flat", value: 15 }]],
        ["ring_tide", "ring", "Tide Ring", 5, [{ stat: "res.cold", kind: "flat", value: 15 }]],
        ["ring_ember", "ring", "Coal Ring", 5, [{ stat: "res.fire", kind: "flat", value: 15 }]],
        ["ring_storm", "ring", "Storm Ring", 5, [{ stat: "res.lightning", kind: "flat", value: 15 }]],
        ["ring_mana", "ring", "Moonstone Ring", 10, [{ stat: "mana", kind: "flat", value: 25 }]],
        ["ring_glass", "ring", "Glass Ring", 30, [{ stat: "addMin.phys", kind: "flat", value: 2, tags: ["attack"] }, { stat: "addMax.phys", kind: "flat", value: 5, tags: ["attack"] }]],
        ["ring_void", "ring", "Hollow Ring", 45, [{ stat: "res.chaos", kind: "flat", value: 13 }]],
        ["belt_rope", "belt", "Rope Belt", 1, [{ stat: "life", kind: "flat", value: 20 }]],
        ["belt_leather", "belt", "Tanner Belt", 10, [{ stat: "armour", kind: "flat", value: 60 }]],
        ["belt_chain", "belt", "Chain Belt", 25, [{ stat: "energyShield", kind: "flat", value: 20 }]],
        ["belt_plate", "belt", "Plated Sash", 45, [{ stat: "flaskHeal", kind: "inc", value: 25 }]],
    ];
    for (const [id, slot, name, level, implicit] of JEWELS) add({ id, name, slot, kind: slot, level, implicit });
    return out;
}

export const BASES: Record<string, BaseDef> = build();

/** Equipment slots a base can go into. */
export function slotsFor(b: BaseDef): Slot[] {
    return b.slot === "ring" ? ["ring1", "ring2"] : [b.slot];
}
