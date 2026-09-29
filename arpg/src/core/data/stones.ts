// Ember stones (round 5): gems set into sockets. A stone's effect depends on
// where it sits - offence in a weapon, defence in armour, utility in jewellery.

import type { Mod } from "../types";

export type StonePlace = "weapon" | "armour" | "jewel";
export const STONE_TIERS = ["Chipped", "Flawed", "Clear", "Flawless", "Radiant"] as const;
/** Monster level from which each tier can drop. */
export const STONE_TIER_LEVEL = [1, 20, 38, 55, 70];

interface Effect { mods: { stat: Mod["stat"]; kind: Mod["kind"]; tags?: string[] }[]; values: number[]; text: string }
export interface StoneDef { id: string; name: string; color: string; effects: Record<StonePlace, Effect> }

const e = (mods: Effect["mods"], values: number[], text: string): Effect => ({ mods, values, text });
const DMG = [10, 16, 24, 34, 46], RES = [6, 9, 12, 16, 20];

const list: StoneDef[] = [
    { id: "ruby", name: "Ruby", color: "#e5383b", effects: {
        weapon: e([{ stat: "damage", kind: "inc", tags: ["fire"] }], DMG, "{0}% increased fire damage"),
        armour: e([{ stat: "res.fire", kind: "flat" }], RES, "+{0}% fire resistance"),
        jewel: e([{ stat: "life", kind: "flat" }], [12, 24, 40, 60, 85], "+{0} to maximum life") } },
    { id: "sapphire", name: "Sapphire", color: "#3a7bff", effects: {
        weapon: e([{ stat: "damage", kind: "inc", tags: ["cold"] }], DMG, "{0}% increased cold damage"),
        armour: e([{ stat: "res.cold", kind: "flat" }], RES, "+{0}% cold resistance"),
        jewel: e([{ stat: "manaRegen", kind: "flat" }], [1, 2, 3, 5, 7], "{0} mana regenerated per second") } },
    { id: "topaz", name: "Topaz", color: "#e0b800", effects: {
        weapon: e([{ stat: "damage", kind: "inc", tags: ["lightning"] }], DMG, "{0}% increased lightning damage"),
        armour: e([{ stat: "res.lightning", kind: "flat" }], RES, "+{0}% lightning resistance"),
        jewel: e([{ stat: "itemRarity", kind: "inc" }], [4, 7, 10, 14, 18], "{0}% increased rarity of items found") } },
    { id: "emerald", name: "Emerald", color: "#2f9e4f", effects: {
        weapon: e([{ stat: "critChance", kind: "inc" }], [8, 13, 19, 26, 34], "{0}% increased critical chance"),
        armour: e([{ stat: "evasion", kind: "inc" }], [6, 10, 15, 21, 28], "{0}% increased evasion"),
        jewel: e([{ stat: "dex", kind: "flat" }], [4, 8, 12, 17, 23], "+{0} to Grace") } },
    { id: "onyx", name: "Onyx", color: "#6b5a7a", effects: {
        weapon: e([{ stat: "pen.fire", kind: "flat" }, { stat: "pen.cold", kind: "flat" }, { stat: "pen.lightning", kind: "flat" }], [2, 3, 5, 7, 9], "Hits ignore {0}% elemental resistance"),
        armour: e([{ stat: "res.chaos", kind: "flat" }], [5, 8, 11, 15, 19], "+{0}% chaos resistance"),
        jewel: e([{ stat: "leech", kind: "flat" }], [0.4, 0.6, 0.9, 1.2, 1.6], "{0}% of damage leeched as life") } },
    { id: "diamond", name: "Diamond", color: "#dff6ff", effects: {
        weapon: e([{ stat: "attackSpeed", kind: "inc" }, { stat: "castSpeed", kind: "inc" }], [3, 5, 7, 9, 12], "{0}% increased attack and cast speed"),
        armour: e([{ stat: "armour", kind: "inc" }, { stat: "energyShield", kind: "inc" }], [6, 10, 15, 21, 28], "{0}% increased armour and energy shield"),
        jewel: e([{ stat: "res.fire", kind: "flat" }, { stat: "res.cold", kind: "flat" }, { stat: "res.lightning", kind: "flat" }], [3, 4, 6, 8, 10], "+{0}% to all elemental resistances") } },
];

export const STONES: Record<string, StoneDef> = Object.fromEntries(list.map(s => [s.id, s]));
export const STONE_ORDER = list.map(s => s.id);

/** A pouch key: "ruby:2" is a Clear Ruby. */
export const stoneKey = (id: string, tier: number) => `${id}:${tier}`;
export function parseStone(key: string): { id: string; tier: number } | null {
    const [id, t] = key.split(":");
    const tier = Number(t);
    return id && STONES[id] && Number.isInteger(tier) && tier >= 0 && tier < STONE_TIERS.length ? { id, tier } : null;
}
export const stoneName = (key: string) => { const p = parseStone(key); return p ? `${STONE_TIERS[p.tier]} ${STONES[p.id]!.name}` : key; };

/** The modifiers a stone gives in a place (src: the item it sits in). */
export function stoneMods(key: string, place: StonePlace, src?: string): Mod[] {
    const p = parseStone(key);
    if (!p) return [];
    const eff = STONES[p.id]!.effects[place];
    return eff.mods.map(m => { const mod: Mod = { stat: m.stat, kind: m.kind, value: eff.values[p.tier]!, ...(src ? { src } : {}) }; if (m.tags) mod.tags = m.tags; return mod; });
}
export function stoneText(key: string, place: StonePlace): string {
    const p = parseStone(key);
    return p ? STONES[p.id]!.effects[place].text.replace("{0}", String(STONES[p.id]!.effects[place].values[p.tier])) : "";
}
