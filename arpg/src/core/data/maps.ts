// The Cinderlands: maps, map mods, the atlas tree and pinnacle bosses.
// Tiers 1-16 are maps; past 16 the Depths scale forever.

import type { DamageType, Mod } from "../types";

export const MAX_TIER = 16;

/** Monster level of a map tier; past tier 16 each Depth adds a level, forever. */
export function mapLevel(tier: number): number {
    return tier <= MAX_TIER ? 42 + tier * 2 : 74 + (tier - MAX_TIER);
}
/** Extra monster life and damage multiplier in the Depths (tier > 16). */
export function depthMult(tier: number): number {
    return tier <= MAX_TIER ? 1 : Math.pow(1.06, tier - MAX_TIER);
}
export const tierName = (tier: number) => (tier === 0 ? "Outskirts" : tier <= MAX_TIER ? `Tier ${tier}` : `Depth ${tier - MAX_TIER}`);

export interface MapArea {
    id: string;
    name: string;
    monsters: string[];
    boss: string;
    palette: [string, string, string];
}

export const MAP_AREAS: Record<string, MapArea> = Object.fromEntries(([
    ["cinderfield", "Cinderfield", ["ashwalker", "hound", "cinderbat"], "cindermatron", ["#4a3a36", "#6a4a3a", "#ffb35c"]],
    ["saltflats", "Salt Flats", ["crab", "scorpion", "bleached"], "sandwright", ["#d9d2c3", "#bfb5a0", "#ffffff"]],
    ["drownedspire", "Drowned Spire", ["drowned", "eel", "bogwitch"], "tidewarden", ["#1f3b45", "#335866", "#9ff3ff"]],
    ["glassmaze", "Glass Maze", ["wasp", "scorpion", "wraith"], "mirrorwarden", ["#b8e6f5", "#86b7c7", "#ff5a36"]],
    ["lanternrow", "Lantern Row", ["lampman", "drowned", "sunpriest"], "keeper", ["#26262e", "#3e3a36", "#ffd84a"]],
    ["bonecoast", "Bone Coast", ["gull", "crab", "drowned"], "drownedknight", ["#8aa0ab", "#cfc6b0", "#e9e4d4"]],
    ["ashcathedral", "Ash Cathedral", ["sunpriest", "ashwalker", "wraith"], "emberjudge", ["#2b2233", "#5b4a4a", "#ffc233"]],
    ["moltenweir", "Molten Weir", ["magmacrab", "hound", "eel"], "cindermatron", ["#2e1a16", "#7a2e1f", "#ff5a36"]],
    ["mirrorsea", "Mirror Sea", ["eel", "wasp", "jackal"], "glassregent", ["#6fb3cf", "#4d8aa3", "#ffffff"]],
    ["sunscar", "The Sunscar", ["hound", "sunpriest", "magmacrab", "cinderbat"], "lastdawn", ["#120c0c", "#3a1a10", "#ffe066"]],
] as [string, string, string[], string, [string, string, string]][]).map(([id, name, monsters, boss, palette]) => [id, { id, name, monsters, boss, palette }]));

export interface MapModDef {
    id: string;
    text: string;
    /** More monster life / damage / attack speed, in percent. */
    life?: number;
    damage?: number;
    speed?: number;
    /** Share of monster damage added as this type. */
    extra?: [DamageType, number];
    /** Modifiers on the hero while in the map. */
    hero?: Mod[];
    /** More packs, in percent. */
    packs?: number;
    /** Reward: increased item quantity and rarity, in percent. */
    qty: number;
    rarity: number;
}

const list: MapModDef[] = [
    { id: "hardy", text: "Monsters have 40% more life", life: 40, qty: 8, rarity: 10 },
    { id: "savage", text: "Monsters deal 30% more damage", damage: 30, qty: 8, rarity: 12 },
    { id: "frenzied", text: "Monsters attack 20% faster", speed: 20, qty: 7, rarity: 8 },
    { id: "searing", text: "Monsters deal 40% extra damage as fire", extra: ["fire", 0.4], qty: 7, rarity: 10 },
    { id: "freezing", text: "Monsters deal 40% extra damage as cold", extra: ["cold", 0.4], qty: 7, rarity: 10 },
    { id: "shocking", text: "Monsters deal 40% extra damage as lightning", extra: ["lightning", 0.4], qty: 7, rarity: 10 },
    { id: "rotting", text: "Monsters deal 25% extra damage as chaos", extra: ["chaos", 0.25], qty: 8, rarity: 10 },
    { id: "crowded", text: "40% more monster packs", packs: 40, qty: 12, rarity: 6 },
    { id: "parched", text: "You regenerate 60% less life", hero: [{ stat: "lifeRegen", kind: "more", value: -60 }, { stat: "lifeRegenPct", kind: "more", value: -60 }], qty: 6, rarity: 8 },
    { id: "exposed", text: "-12% to all maximum resistances", hero: (["fire", "cold", "lightning"] as const).map(t => ({ stat: `maxRes.${t}` as const, kind: "flat" as const, value: -12 })), qty: 10, rarity: 12 },
    { id: "brittle", text: "You take 15% more damage", hero: [{ stat: "dmgTaken", kind: "more", value: 15 }], qty: 9, rarity: 10 },
    { id: "dulled", text: "You deal 15% less damage", hero: [{ stat: "damage", kind: "more", value: -15 }], qty: 9, rarity: 10 },
];
export const MAP_MODS: Record<string, MapModDef> = Object.fromEntries(list.map(m => [m.id, m]));

// ---- atlas tree ------------------------------------------------------------

export interface AtlasEffects {
    mapDrop: number;      // % increased map drop chance
    quantity: number;     // % increased item quantity in maps
    rarity: number;       // % increased item rarity in maps
    currency: number;     // % increased currency drops in maps
    packs: number;        // % more packs
    xp: number;           // % increased experience in maps
    modEffect: number;    // % increased map mod rewards
    fragments: number;    // % increased fragment drop chance
    upgrade: number;      // % chance for a dropped map to be a tier higher
    bossRelic: number;    // % chance for map bosses to drop a relic
}
export const emptyAtlas = (): AtlasEffects => ({ mapDrop: 0, quantity: 0, rarity: 0, currency: 0, packs: 0, xp: 0, modEffect: 0, fragments: 0, upgrade: 0, bossRelic: 0 });

export interface AtlasNode { id: string; name: string; text: string; eff: Partial<AtlasEffects>; requires: string[] }

export const ATLAS: Record<string, AtlasNode> = Object.fromEntries(([
    ["a_cart", "Cartographer", "20% increased map drop chance", { mapDrop: 20 }, []],
    ["a_cart2", "Surveyor", "25% increased map drop chance", { mapDrop: 25 }, ["a_cart"]],
    ["a_climb", "Ladder of Ash", "10% chance for dropped maps to be a tier higher", { upgrade: 10 }, ["a_cart"]],
    ["a_climb2", "Stair of Stars", "15% chance for dropped maps to be a tier higher", { upgrade: 15 }, ["a_climb"]],
    ["a_qty", "Plunder", "10% increased item quantity in maps", { quantity: 10 }, []],
    ["a_qty2", "Hoard", "15% increased item quantity in maps", { quantity: 15 }, ["a_qty"]],
    ["a_rar", "Gilded Paths", "25% increased item rarity in maps", { rarity: 25 }, ["a_qty"]],
    ["a_rar2", "Crowned Paths", "35% increased item rarity in maps", { rarity: 35 }, ["a_rar"]],
    ["a_cur", "Emberfall", "30% increased currency drops in maps", { currency: 30 }, ["a_qty"]],
    ["a_cur2", "Starfall Veins", "40% increased currency drops in maps", { currency: 40 }, ["a_cur"]],
    ["a_packs", "Teeming", "15% more monster packs in maps", { packs: 15 }, []],
    ["a_xp", "Hard Lessons", "15% increased experience in maps", { xp: 15 }, ["a_packs"]],
    ["a_xp2", "Harder Lessons", "20% increased experience in maps", { xp: 20 }, ["a_xp"]],
    ["a_mods", "Dangerous Ground", "30% increased rewards from map mods", { modEffect: 30 }, ["a_packs"]],
    ["a_mods2", "Deadly Ground", "40% increased rewards from map mods", { modEffect: 40 }, ["a_mods"]],
    ["a_frag", "Sigil Seeker", "40% increased sigil drop chance", { fragments: 40 }, ["a_mods"]],
    ["a_frag2", "Sigil Hunter", "60% increased sigil drop chance", { fragments: 60 }, ["a_frag"]],
    ["a_boss", "Relic Hunter", "Map bosses have a 6% chance to drop a relic", { bossRelic: 6 }, ["a_rar"]],
] as [string, string, string, Partial<AtlasEffects>, string[]][]).map(([id, name, text, eff, requires]) => [id, { id, name, text, eff, requires }]));

// ---- pinnacles ---------------------------------------------------------------

export interface PinnacleDef {
    id: string;
    name: string;
    boss: string;
    sigil: string;
    sigilName: string;
    /** Sigils needed to open the fight. */
    cost: number;
    level: number;
    /** Sigils drop from map bosses at this tier or higher. */
    minTier: number;
    palette: [string, string, string];
    text: string;
}

export const PINNACLES: Record<string, PinnacleDef> = Object.fromEntries(([
    ["drownedsun", "The Drowned Sun", "p_drownedsun", "tide_sigil", "Tide Sigil", 3, 80, 6, ["#0f2a33", "#1f4a55", "#ffe066"], "A second sun rose from the sea and never learned to shine."],
    ["glasschoir", "The Glass Choir", "p_glasschoir", "prism_sigil", "Prism Sigil", 3, 84, 10, ["#a8e6f5", "#6fa3b8", "#ffffff"], "A thousand shards singing one note. The note is your name."],
    ["ashenking", "The Ashen King", "p_ashenking", "ash_sigil", "Ash Sigil", 3, 88, 14, ["#1c1414", "#4a2a20", "#ff5a36"], "He was crowned the day the sun fell and has ruled the ash since."],
    ["hollowcrown", "The Hollow Crown", "p_hollowcrown", "hollow_sigil", "Hollow Sigil", 4, 96, 18, ["#0a0a0f", "#2a2233", "#b9a4ff"], "At the bottom of the Depths, the thing that ate the sun's light waits to be fed again."],
] as [string, string, string, string, string, number, number, number, [string, string, string], string][]).map(([id, name, boss, sigil, sigilName, cost, level, minTier, palette, text]) =>
    [id, { id, name, boss, sigil, sigilName, cost, level, minTier, palette, text }]));
