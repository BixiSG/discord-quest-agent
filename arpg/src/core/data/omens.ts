// Weekly omens (round 9): each calendar week the March has an omen - a
// modifier on the whole world with a reward in it. The same week brings the
// same omen to every player; no omen comes twice in a row, and all seven pass
// in seven weeks. Pinnacles are out of the monsters' side of it (the dawn loop
// keeps its pace).

import type { Mod } from "../types";

export interface OmenDef {
    id: string;
    name: string;
    text: string;
    /** On the hero, for the week. */
    hero?: Mod[];
    /** Monsters (not pinnacles): percent more life and damage; speed and evasion multipliers. */
    life?: number;
    damage?: number;
    speed?: number;
    evasion?: number;
    /** Rewards: item rarity and quantity (percent, added to the finder's), crafting currency and salvage dust (percent more). */
    rarity?: number;
    quantity?: number;
    currency?: number;
    dust?: number;
}

const m = (stat: Mod["stat"], kind: Mod["kind"], value: number, tags?: string[]): Mod => (tags ? { stat, kind, value, tags } : { stat, kind, value });

const list: OmenDef[] = [
    { id: "blood", name: "Blood Moon", text: "Monsters have 25% more life; items found are 40% rarer.", life: 25, rarity: 40 },
    { id: "ashfall", name: "Ashfall", text: "25% more fire damage; salvage gives 25% more ember dust.", hero: [m("damage", "more", 25, ["fire"])], dust: 25 },
    { id: "gale", name: "The Long Gale", text: "25% increased movement speed; monsters deal 15% more damage.", hero: [m("moveSpeed", "inc", 25)], damage: 15 },
    { id: "hunger", name: "The Hungry Dark", text: "Monsters have 15% more life and deal 15% more damage; 50% more crafting currency drops.", life: 15, damage: 15, currency: 50 },
    { id: "clearsky", name: "Clear Skies", text: "15% increased experience gained.", hero: [m("xpGain", "inc", 15)] },
    { id: "frost", name: "Hard Frost", text: "25% more cold damage; monsters act 10% slower.", hero: [m("damage", "more", 25, ["cold"])], speed: 0.9 },
    { id: "storm", name: "Stormfront", text: "25% more lightning damage; monsters are 20% harder to hit; 20% more items found.", hero: [m("damage", "more", 25, ["lightning"])], evasion: 1.2, quantity: 20 },
];

export const OMENS: Record<string, OmenDef> = Object.fromEntries(list.map(x => [x.id, x]));
export const OMEN_ORDER = list.map(x => x.id);

/**
 * The omen of week `w` (weeks counted from the Monday before 1970-01-01): the
 * order steps by three, which is coprime to seven, so neighbours always differ
 * and any seven weeks in a row hold all seven omens.
 */
export const omenOfWeek = (w: number) => OMEN_ORDER[(((3 * w) % OMEN_ORDER.length) + OMEN_ORDER.length) % OMEN_ORDER.length]!;
