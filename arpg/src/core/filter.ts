// Loot filter: ordered rules, first enabled match decides. No match falls
// back to "keep this rarity and better" (settings.keep).

import { AFFIXES, BASES } from "./data";
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

/** Ready-made rule sets for the Menu. Each replaces the rules; "otherwise" (settings.keep) stays. */
export const FILTER_PRESETS: { id: string; name: string; blurb: string; rules: FilterRule[] }[] = [
    { id: "starter", name: "Starter", blurb: "Keep relics; salvage plain and enchanted items 10+ levels behind.", rules: DEFAULT_FILTER },
    { id: "lean", name: "Lean", blurb: "Keep relics and rares; salvage every plain and enchanted item.", rules: [
        { on: true, action: "keep", rarity: ["relic"] },
        { on: true, action: "salvage", rarity: ["plain", "enchanted"] },
    ] },
    { id: "endgame", name: "Endgame", blurb: "Only rares with 5+ affixes and relics; everything else becomes dust.", rules: [
        { on: true, action: "keep", rarity: ["relic"] },
        { on: true, action: "keep", rarity: ["rare"], minAffixes: 5 },
        { on: true, action: "salvage", rarity: ["plain", "enchanted", "rare"] },
    ] },
    { id: "resists", name: "Resist hunter", blurb: "Endgame, but also keep any rare jewellery with a resistance.", rules: [
        { on: true, action: "keep", rarity: ["relic"] },
        { on: true, action: "keep", rarity: ["rare"], slots: ["ring", "amulet", "belt"], group: "resFire" },
        { on: true, action: "keep", rarity: ["rare"], slots: ["ring", "amulet", "belt"], group: "resCold" },
        { on: true, action: "keep", rarity: ["rare"], slots: ["ring", "amulet", "belt"], group: "resLight" },
        { on: true, action: "keep", rarity: ["rare"], minAffixes: 5 },
        { on: true, action: "salvage", rarity: ["plain", "enchanted", "rare"] },
    ] },
];

/** Groups whose affix text alone would read the same as another's (weapon-local vs global). */
const GROUP_NAMES: Record<string, string> = {
    aspd: "attack speed (weapon)", aspdGlobal: "attack speed", crit: "critical chance (weapon)", critGlobal: "critical chance",
    physInc: "physical damage (weapon)", physGlobal: "physical damage", defFlat: "armour, evasion or shield (local)", armourFlat: "armour (belt)",
    spellAdd: "added damage to spells", fireAdd: "added fire damage (weapon)", coldAdd: "added cold damage (weapon)",
    lightAdd: "added lightning damage (weapon)", physAdd: "added physical damage (weapon)", defInc: "defences", leech: "life leech",
};

/** A readable name for an affix group ("resFire" -> "fire resistance"), from its first affix's text. */
export function groupLabel(group: string): string {
    if (GROUP_NAMES[group]) return GROUP_NAMES[group]!;
    const a = Object.values(AFFIXES).find(x => x.group === group);
    if (!a) return group;
    return a.text.replace(/\{\d\}/g, "").replace(/^Adds\s+to\s+/i, "added ").replace(/[+%]/g, "").replace(/\s+/g, " ").trim()
        .replace(/^(to|increased)\s+/i, "").replace(/^maximum\s+/i, "maximum ");
}

/** Affix groups for the rule editor, by label. */
export const AFFIX_GROUPS = (): { group: string; label: string }[] =>
    [...new Set(Object.values(AFFIXES).map(a => a.group))].map(group => ({ group, label: groupLabel(group) })).sort((a, b) => a.label.localeCompare(b.label));

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
    if (r.group) parts.push(`with ${groupLabel(r.group)}`);
    return `${r.action === "keep" ? "Keep" : "Salvage"} ${parts.join(", ")}`;
}
