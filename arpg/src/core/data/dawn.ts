// Dawns (round 5): relighting the sun restarts the March one dawn later. Each
// dawn makes the world tougher and richer and the hero learn faster; each also
// grants one pick from these perks, kept for every dawn after.

import type { Mod } from "../types";

export interface DawnPerk {
    id: string;
    name: string;
    text: string;
    /** Stat sheet modifiers (the rest are flags read where they apply). */
    mods?: Mod[];
}

export const DAWN_PERKS: DawnPerk[] = [
    { id: "firstlight", name: "First Light", text: "20% increased experience gained", mods: [{ stat: "xpGain", kind: "inc", value: 20 }] },
    { id: "brightember", name: "Bright Ember", text: "15% increased damage", mods: [{ stat: "damage", kind: "inc", value: 15 }] },
    { id: "steadyflame", name: "Steady Flame", text: "10% increased maximum life", mods: [{ stat: "life", kind: "inc", value: 10 }] },
    { id: "keeneye", name: "Keen Eye", text: "30% increased rarity of items found", mods: [{ stat: "itemRarity", kind: "inc", value: 30 }] },
    { id: "oldroads", name: "Old Roads", text: "25% increased movement speed", mods: [{ stat: "moveSpeed", kind: "inc", value: 25 }] },
    { id: "warmhands", name: "Warm Hands", text: "25% more ember dust from salvage" },
    { id: "longmemory", name: "Long Memory", text: "Companions gain twice the bond" },
    { id: "deeppockets", name: "Deep Pockets", text: "20 more stash slots, and room for 20 more" },
    { id: "stonefinder", name: "Stonefinder", text: "Ember stones drop 50% more often" },
    { id: "tradersmark", name: "Trader's Mark", text: "The Wandering Market charges 20% less" },
];
export const DAWN_PERK: Record<string, DawnPerk> = Object.fromEntries(DAWN_PERKS.map(p => [p.id, p]));

/** Per dawn: experience and dust, and the world's toughness and riches (percent). */
export const DAWN_XP = 10, DAWN_DUST = 10, DAWN_TOUGHER = 10, DAWN_RICHER = 20;

/** The Hollow Crown answers from this dawn on (the optional goal beyond the Rekindling). */
export const CROWN_DAWN = 2;

export const DAWN_TEXT = "The pieces catch, the ember in your chest goes into the fire with them, and for a moment nothing happens. Then the sky over the crater turns grey, then pink, then gold. The sun rises over the March for the first time in three hundred years.\n\nYou wake in the surf with an ember where your heart was. The shore is warm this time.";

export const ROMAN = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];
export const dawnName = (n: number) => `Dawn ${ROMAN[n] ?? n}`;
