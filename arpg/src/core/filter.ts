// Loot filter: ordered rules, first enabled match decides. No match falls
// back to "keep this rarity and better" (settings.keep).

import { BASES } from "./data";
import { affixOf } from "./items";
import type { GameState } from "./state";
import type { Item, Rarity } from "./types";

export interface FilterRule {
    on: boolean;
    action: "keep" | "salvage";
    rarity?: Rarity[];
    /** Base slots ("weapon", "ring", "body"...). */
    slots?: string[];
    minIlvl?: number;
    /** Only matches items at least this many levels below the hero (base level). */
    behind?: number;
    minAffixes?: number;
    /** Matches when the item has an affix from this group. */
    group?: string;
}

export const DEFAULT_FILTER: FilterRule[] = [
    { on: true, action: "keep", rarity: ["relic"] },
    { on: true, action: "salvage", rarity: ["plain", "enchanted"], behind: 10 },
    { on: false, action: "keep", rarity: ["rare"], minAffixes: 5 },
];

export function ruleMatches(r: FilterRule, item: Item, heroLevel: number): boolean {
    const b = BASES[item.base];
    if (!b) return false;
    if (r.rarity?.length && !r.rarity.includes(item.rarity)) return false;
    if (r.slots?.length && !r.slots.includes(b.slot)) return false;
    if (r.minIlvl && item.ilvl < r.minIlvl) return false;
    if (r.behind && b.level > heroLevel - r.behind) return false;
    if (r.minAffixes && item.affixes.length < r.minAffixes) return false;
    if (r.group && !item.affixes.some(a => affixOf(a).group === r.group)) return false;
    return true;
}

const RANK: Record<Rarity, number> = { plain: 0, enchanted: 1, rare: 2, relic: 3 };

export function keepItem(state: GameState, item: Item): boolean {
    for (const r of state.settings.filter ?? []) if (r.on && ruleMatches(r, item, state.hero.level)) return r.action === "keep";
    return RANK[item.rarity] >= RANK[state.settings.keep];
}

export function describeRule(r: FilterRule): string {
    const parts: string[] = [];
    parts.push(r.rarity?.length ? r.rarity.join("/") : "any rarity");
    if (r.slots?.length) parts.push(r.slots.join("/"));
    if (r.minIlvl) parts.push(`ilvl ${r.minIlvl}+`);
    if (r.behind) parts.push(`base ${r.behind}+ levels behind`);
    if (r.minAffixes) parts.push(`${r.minAffixes}+ affixes`);
    if (r.group) parts.push(`with ${r.group}`);
    return `${r.action === "keep" ? "Keep" : "Salvage"} ${parts.join(", ")}`;
}
