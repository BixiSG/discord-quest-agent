// Crafting currency effects (GDD table). Every use draws from a fresh RNG
// seeded by (save seed, craft counter), so crafting is deterministic too.

import { CURRENCIES } from "./data";
import { Rng, hashSeed } from "./rng";
import { MAX_AFFIXES, addRandomAffix, affixOf, countAffixes, eligibleAffixes, rareName, rollAffixes } from "./items";
import type { GameState } from "./state";
import type { Item, Slot } from "./types";
import { SLOTS } from "./types";

type Effect = (item: Item, rng: Rng) => string | null;

const hasRoom = (item: Item) => { const c = countAffixes(item), m = MAX_AFFIXES[item.rarity]; return c.prefix < m.prefix || c.suffix < m.suffix; };

export const EFFECTS: Record<string, Effect> = {
    kindling: (it, rng) => { if (it.rarity !== "plain") return "needs a plain item"; it.rarity = "enchanted"; rollAffixes(rng, it); return null; },
    reshaper: (it, rng) => { if (it.rarity !== "enchanted") return "needs an enchanted item"; rollAffixes(rng, it); return null; },
    graft: (it, rng) => {
        if (it.rarity !== "enchanted") return "needs an enchanted item";
        if (!hasRoom(it) || !eligibleAffixes(it).length) return "no room for another affix";
        addRandomAffix(rng, it); return null;
    },
    crownseal: (it, rng) => {
        if (it.rarity !== "enchanted") return "needs an enchanted item";
        it.rarity = "rare"; it.name = rareName(rng); addRandomAffix(rng, it); return null;
    },
    forgeheart: (it, rng) => { if (it.rarity !== "plain") return "needs a plain item"; it.rarity = "rare"; rollAffixes(rng, it); return null; },
    tempest: (it, rng) => { if (it.rarity !== "rare") return "needs a rare item"; const name = it.name; rollAffixes(rng, it); if (name) it.name = name; return null; },
    starfall: (it, rng) => {
        if (it.rarity !== "rare") return "needs a rare item";
        if (!hasRoom(it) || !eligibleAffixes(it).length) return "no room for another affix";
        addRandomAffix(rng, it); return null;
    },
    salt: it => {
        if (it.rarity === "relic") return "relics can't be undone";
        if (it.rarity === "plain") return "already plain";
        it.rarity = "plain"; it.affixes = []; delete it.name; return null;
    },
    unmaker: (it, rng) => {
        if (it.rarity !== "enchanted" && it.rarity !== "rare") return "needs an enchanted or rare item";
        if (!it.affixes.length) return "no affixes";
        it.affixes.splice(rng.int(0, it.affixes.length - 1), 1); return null;
    },
    temper: (it, rng) => {
        if (it.rarity === "relic") {
            // Relics reroll their ranges.
            return "relics can't be tempered";
        }
        if (!it.affixes.length) return "no affixes";
        for (const a of it.affixes) {
            const t = affixOf(a).tiers[a.tier];
            if (t) a.rolls = t.ranges.map(([lo, hi]) => rng.int(lo, hi));
        }
        return null;
    },
};

/** Finds an item by uid in the stash or on the hero. */
export function findItem(state: GameState, uid: number): { item: Item; slot?: Slot } | null {
    const s = state.stash.find(x => x.uid === uid);
    if (s) return { item: s };
    for (const slot of SLOTS) { const it = state.hero.equipment[slot]; if (it?.uid === uid) return { item: it, slot }; }
    return null;
}

export function applyCurrency(state: GameState, currency: string, uid: number): string | null {
    const eff = EFFECTS[currency];
    if (!eff || !CURRENCIES[currency]) return "unknown currency";
    if ((state.currency[currency] ?? 0) <= 0) return `no ${CURRENCIES[currency]!.name} left`;
    const found = findItem(state, uid);
    if (!found) return "item not found";
    // Work on a copy so a refused craft changes nothing.
    const copy = structuredClone(found.item);
    const rng = new Rng(hashSeed(state.seed, 0x6372, state.craftSeq));
    const err = eff(copy, rng);
    if (err) return err;
    state.craftSeq++;
    copy.crafted = true;
    Object.assign(found.item, copy);
    if (!copy.name) delete found.item.name;
    state.currency[currency]!--;
    if (found.slot) state.hero.rev++;
    return null;
}

export function buyCurrency(state: GameState, currency: string, n = 1): string | null {
    const def = CURRENCIES[currency];
    if (!def) return "unknown currency";
    const cost = def.cost * n;
    if (state.dust < cost) return `needs ${cost} ember dust`;
    state.dust -= cost;
    state.currency[currency] = (state.currency[currency] ?? 0) + n;
    return null;
}
