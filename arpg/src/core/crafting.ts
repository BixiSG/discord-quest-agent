// Crafting currency effects (GDD table). Every use draws from a fresh RNG
// seeded by (save seed, craft counter), so crafting is deterministic too.

import { CURRENCIES, ZONES, mapLevel } from "./data";
import { paidRoom, receivePaid, salvageItem, upgradeSlot, wearableOffhands } from "./game";
import { Rng, hashSeed } from "./rng";
import { MAX_AFFIXES, rollItem, addRandomAffix, affixOf, baseOf, countAffixes, eligibleAffixes, rareName, relicOf, rollAffixes, rollTier } from "./items";
import { AFFIXES, betterLow, type AffixDef, type RelicDef } from "./data";
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

/** Finds an item by uid in the stash, the relic case or on the hero. */
export function findItem(state: GameState, uid: number): { item: Item; slot?: Slot } | null {
    const s = state.stash.find(x => x.uid === uid) ?? state.relics.find(x => x.uid === uid);
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
    // Worked at the Forge: locked, so upkeep and bulk salvage leave it alone.
    copy.locked = true;
    Object.assign(found.item, copy);
    if (!copy.name) delete found.item.name;
    state.currency[currency]!--;
    if (found.slot) state.hero.rev++;
    return null;
}

/** Reroll currencies "Use until upgrade" repeats. */
export const REROLLS = ["reshaper", "tempest", "temper"];

/**
 * Uses a reroll currency on a stash item again and again, up to `tries`
 * times, until the item would raise the build score (the currency runs out
 * or the tries do otherwise). Returns the uses and whether it got there.
 */
export function craftUntilUpgrade(state: GameState, currency: string, uid: number, tries = 20): { err: string | null; used: number; upgrade: boolean } {
    if (!REROLLS.includes(currency)) return { err: "only rerolls repeat", used: 0, upgrade: false };
    if (!state.stash.some(x => x.uid === uid) && !state.relics.some(x => x.uid === uid)) return { err: "only stash items", used: 0, upgrade: false };
    let used = 0;
    for (; used < tries; ) {
        const err = applyCurrency(state, currency, uid);
        if (err) return { err: used ? null : err, used, upgrade: false };
        used++;
        const it = findItem(state, uid)!.item;
        if (upgradeSlot(state, it)) return { err: null, used, upgrade: true };
    }
    return { err: null, used, upgrade: false };
}

// ---- hone and bench ----------------------------------------------------------

export const MAX_QUALITY = 20;

/** Ember dust to hone an item one point of quality further; null when it can't take more. */
export function honeCost(item: Item): number | null {
    const b = baseOf(item);
    if (!b.weapon && !b.defence) return null;
    const q = item.quality ?? 0;
    if (q >= MAX_QUALITY) return null;
    return Math.round((20 + item.ilvl * 2) * (1 + q * 0.5));
}

/** Hone: +1% quality, which is increased local damage on weapons and defences on armour. */
export function hone(state: GameState, uid: number): string | null {
    const found = findItem(state, uid);
    if (!found) return "item not found";
    const b = baseOf(found.item);
    if (!b.weapon && !b.defence) return "only weapons and armour take quality";
    const cost = honeCost(found.item);
    if (cost === null) return `already at ${MAX_QUALITY}% quality`;
    if (state.dust < cost) return `needs ${cost} ember dust`;
    state.dust -= cost;
    found.item.quality = (found.item.quality ?? 0) + 1;
    found.item.locked = true;
    if (found.slot) state.hero.rev++;
    return null;
}

export const BENCH_GRAFTS = 3;
export const benchDust = (item: Item) => 10 + item.ilvl * 3;

/** Affixes the bench can put on an item: what fits once its benched affix (if any) is gone. */
export function benchOptions(item: Item): AffixDef[] {
    if (item.rarity !== "enchanted" && item.rarity !== "rare") return [];
    const copy = structuredClone(item);
    copy.affixes = copy.affixes.filter(a => !a.bench);
    return eligibleAffixes(copy);
}

/**
 * The bench: adds a chosen affix (a random tier the item level allows) to an
 * enchanted or rare item with room. One benched affix per item: a new one
 * replaces the old. Costs Graft and ember dust.
 */
export function benchCraft(state: GameState, uid: number, affixId: string): string | null {
    const found = findItem(state, uid);
    if (!found) return "item not found";
    const item = found.item;
    if (item.rarity !== "enchanted" && item.rarity !== "rare") return "needs an enchanted or rare item";
    const def = AFFIXES[affixId];
    if (!def || !benchOptions(item).some(a => a.id === affixId)) return "that affix doesn't fit";
    if ((state.currency.graft ?? 0) < BENCH_GRAFTS) return `needs ${BENCH_GRAFTS} Graft`;
    const dust = benchDust(item);
    if (state.dust < dust) return `needs ${dust} ember dust`;
    const rng = new Rng(hashSeed(state.seed, 0x62656e63, state.craftSeq));
    const roll = rollTier(rng, def, item.ilvl);
    item.affixes = [...item.affixes.filter(a => !a.bench), { ...roll, bench: true }];
    state.currency.graft! -= BENCH_GRAFTS;
    state.dust -= dust;
    state.craftSeq++;
    item.crafted = true;
    item.locked = true;
    if (found.slot) state.hero.rev++;
    return null;
}

// ---- temper (relics) -----------------------------------------------------------

/** The rolls of a relic that can still get better. */
function temperOpen(item: Item, def: RelicDef): number[] {
    return def.mods.flatMap((m, i) => {
        const v = item.relicRolls?.[i] ?? m.range[0];
        return (betterLow(m) ? v > m.range[0] : v < m.range[1]) ? [i] : [];
    });
}

/** Ember dust to temper a relic once more; null when it isn't a relic or every roll is at its best. */
export function temperCost(item: Item): number | null {
    const def = relicOf(item);
    if (!def || !temperOpen(item, def).length) return null;
    return Math.round((200 * Math.max(20, item.ilvl) * Math.pow(1.4, item.tempered ?? 0)) / 10) * 10;
}

/**
 * Temper, the late dust sink: one roll of a relic (a random one of those with
 * room) is rolled again between where it is and its best, so it never gets
 * worse. Each temper of that relic costs 40% more; the relic locks.
 */
export function temperRelic(state: GameState, uid: number): string | null {
    const found = findItem(state, uid);
    if (!found) return "item not found";
    const item = found.item;
    const def = relicOf(item);
    if (!def) return "only relics can be tempered";
    const open = temperOpen(item, def);
    if (!open.length) return "every roll is at its best";
    const cost = temperCost(item)!;
    if (state.dust < cost) return `needs ${cost} ember dust`;
    const rng = new Rng(hashSeed(state.seed, 0x74656d70, state.craftSeq));
    const i = rng.pick(open), m = def.mods[i]!;
    item.relicRolls ??= def.mods.map(x => x.range[0]);
    const cur = item.relicRolls[i]!;
    item.relicRolls[i] = betterLow(m) ? rng.int(m.range[0], cur - 1) : rng.int(cur + 1, m.range[1]);
    state.dust -= cost;
    state.craftSeq++;
    item.tempered = (item.tempered ?? 0) + 1;
    item.locked = true;
    if (found.slot) state.hero.rev++;
    return null;
}

/** Highest item level the hero has reached: story zones and map tiers opened so far. */
export function maxIlvl(state: GameState): number {
    const zones = state.world.unlocked.map(z => ZONES[z]?.level ?? 1);
    const maps = (state.atlas?.tiers ?? []).map(t => mapLevel(t + 1));
    return Math.max(1, Math.min(state.hero.level + 2, Math.max(...zones, ...maps)));
}

/** Ember dust to forge a rare for a slot. */
export const forgeCost = (state: GameState) => Math.round(40 + 6 * state.hero.level);

/**
 * The dust sink: forge a random rare for an equipment slot at the highest
 * item level reached. Paid for, so it never meets the loot filter: worn at once
 * when it is an upgrade (auto-equip on), else kept in the stash.
 */
export function forgeRare(state: GameState, slot: string): { err: string | null; item?: Item; equipped?: boolean } {
    const cost = forgeCost(state);
    if (state.dust < cost) return { err: `needs ${cost} ember dust` };
    const item = forgeRoll(state, slot);
    if (!item) return { err: "nothing to forge for that slot" };
    const r = receivePaid(state, item);
    if (r.err) return { err: r.err };
    state.nextUid++;
    state.craftSeq++;
    state.dust -= cost;
    return { err: null, item, equipped: r.equipped };
}

/** The next forged rare for a slot group (deterministic: the save's seed and the craft counter). */
function forgeRoll(state: GameState, slot: string): Item | null {
    const slots = slot === "ring1" || slot === "ring2" ? ["ring"] : [slot];
    // An off-hand the weapon allows (none behind a two-hander).
    const kinds = slot === "offhand" ? wearableOffhands(state) : undefined;
    if (kinds === null) return null;
    const rng = new Rng(hashSeed(state.seed, 0x666f7267, state.craftSeq));
    // A base the hero can wear; the item level (affix tiers) may still run two levels ahead.
    try {
        const item = rollItem(rng, state.nextUid, maxIlvl(state), { rarity: "rare", slots, maxBaseLevel: state.hero.level, ...(kinds ? { kinds } : {}) });
        item.crafted = true;
        return item;
    } catch { return null; }
}

/**
 * Forges rares for a slot until one is an upgrade, up to `tries`: it is worn at
 * once (or, with auto-equip off, kept in the stash) and forging stops; the
 * misses are salvaged on the spot. Returns how many were made.
 */
export function forgeUntilUpgrade(state: GameState, slot: string, tries = 10): { err: string | null; made: number; item?: Item; equipped?: boolean } {
    let made = 0;
    for (; made < tries; ) {
        const cost = forgeCost(state);
        if (state.dust < cost) return { err: made ? null : `needs ${cost} ember dust`, made };
        const item = forgeRoll(state, slot);
        if (!item) return { err: "nothing to forge for that slot", made };
        const up = !!upgradeSlot(state, item);
        // An upgrade that can be neither worn nor kept: stop before paying for it.
        if (up && !state.settings.autoEquip && !paidRoom(state, item)) return { err: made ? null : "stash full", made };
        state.nextUid++;
        state.craftSeq++;
        state.dust -= cost;
        made++;
        if (up) {
            const r = receivePaid(state, item);
            if (!r.err) return { err: null, made, item, equipped: r.equipped };
        }
        salvageItem(state, item);
    }
    return { err: null, made };
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
