// The Wandering Market (round 5): traders camped beside the road once Act 1
// is done. Their stock rotates every two hours of the hero's time (so time
// away counts) and is rolled from the save's seed and a counter, like
// everything else. The Pedlar sells gear, the Jeweller ember stones.

import { RELICS, STONE_TIERS, parseStone } from "./data";
import { forgeCost, maxIlvl } from "./crafting";
import { receiveItem, stashWorth, upgradeSlot } from "./game";
import { rollItem } from "./items";
import { Rng, hashSeed } from "./rng";
import { addStone, rollSockets, rollStone, socketCap, fitStones } from "./sockets";
import type { GameState } from "./state";
import { hasPerk } from "./dawn";
import { SLOTS, type Item } from "./types";

export interface GearOffer { item: Item; price: number; sold?: boolean }
export interface StoneOffer { key: string; price: number; sold?: boolean }
export interface MarketState {
    /** Stock rolls so far (seeds the next). */
    seq: number;
    /** Hero time the current stock was rolled at. */
    rolledAt: number;
    /** Paid refreshes in this rotation (each costs more). */
    refreshes: number;
    pedlar: GearOffer[];
    jeweller: StoneOffer[];
}

export const ROTATION_MS = 2 * 3600e3;
const GEAR_OFFERS = 6, STONE_OFFERS = 5;
const STONE_PRICE = [120, 450, 1500, 4500, 12000];

/** The caravan camps once the Tide-Warden is beaten. */
export const marketOpen = (s: GameState) => !!s.world.clears.a1_lock;

/** Slot groups the Pedlar rolls for (rings share one). */
const OFFER_SLOTS = ["weapon", "offhand", "helmet", "body", "gloves", "boots", "belt", "amulet", "ring"];

/** The Trader's Mark dawn perk: 20% off everything. */
const discount = (s: GameState) => (hasPerk(s, "tradersmark") ? 0.8 : 1);

function gearPrice(s: GameState, it: Item): number {
    const base = forgeCost(s) * discount(s);
    if (it.relic) return Math.round(base * 50 / 10) * 10;
    return Math.round((base * (3 + 1.5 * it.affixes.length) * (1 + 0.25 * (it.sockets ?? 0))) / 10) * 10;
}

/** Slot groups where the hero is weakest: empty first, then the lowest-worth worn items. */
function weakSlots(s: GameState): string[] {
    const eq = s.hero.equipment;
    return [...SLOTS].sort((a, b) => (eq[a] ? stashWorth(eq[a]!) : -1) - (eq[b] ? stashWorth(eq[b]!) : -1))
        .map(slot => (slot === "ring1" || slot === "ring2" ? "ring" : slot));
}

function rollStock(s: GameState): void {
    const m = s.market;
    const rng = new Rng(hashSeed(s.seed, 0x6d6b74, m.seq++));
    const ilvl = maxIlvl(s);
    const weak = weakSlots(s);
    const pedlar: GearOffer[] = [];
    for (let i = 0; i < GEAR_OFFERS; i++) {
        // Two offers for the weakest slots, the rest anywhere.
        const group = i < 2 ? weak[i]! : rng.pick(OFFER_SLOTS);
        let item: Item;
        try { item = rollItem(rng, s.nextUid, ilvl, { rarity: "rare", slots: [group], maxBaseLevel: s.hero.level }); } catch { continue; }
        s.nextUid++;
        if (i === GEAR_OFFERS - 1) { item.sockets = Math.min(socketCap(item), rng.chance(0.4) ? 2 : 1); fitStones(item); }
        else rollSockets(rng, item);
        pedlar.push({ item, price: gearPrice(s, item) });
    }
    // Sometimes a relic the codex is missing, in place of one rare.
    const missing = Object.values(RELICS).filter(r => r.level <= ilvl && !r.season && !s.codex[r.id]);
    if (missing.length && rng.chance(0.25) && pedlar.length) {
        const def = rng.pick(missing);
        const item: Item = { uid: s.nextUid++, base: def.base, ilvl, rarity: "relic", affixes: [], relic: def.id, relicRolls: def.mods.map(x => rng.int(x.range[0], x.range[1])) };
        pedlar[pedlar.length - 2] = { item, price: gearPrice(s, item) };
    }
    const jeweller: StoneOffer[] = [];
    for (let i = 0; i < STONE_OFFERS; i++) {
        const key = rollStone(rng, ilvl);
        jeweller.push({ key, price: Math.round(STONE_PRICE[parseStone(key)!.tier]! * discount(s)) });
    }
    m.pedlar = pedlar;
    m.jeweller = jeweller;
}

/** New stock when the rotation is up (called as runs finish, and by the Market tab). */
export function tickMarket(s: GameState): void {
    if (!marketOpen(s)) return;
    s.market ??= { seq: 0, rolledAt: 0, refreshes: 0, pedlar: [], jeweller: [] };
    if (s.market.pedlar.length && s.simTo < s.market.rolledAt + ROTATION_MS) return;
    s.market.rolledAt = s.simTo;
    s.market.refreshes = 0;
    rollStock(s);
}

/** Dust for new stock right now: doubles with each refresh in a rotation. */
export const refreshCost = (s: GameState) => Math.round(forgeCost(s) * 4 * Math.pow(2, s.market?.refreshes ?? 0) / 10) * 10;

export function refreshMarket(s: GameState): string | null {
    if (!marketOpen(s)) return "the caravan hasn't come yet";
    const cost = refreshCost(s);
    if (s.dust < cost) return `needs ${cost} ember dust`;
    s.dust -= cost;
    s.market.refreshes++;
    rollStock(s);
    return null;
}

/** Buys gear: worn at once if it is an upgrade (with auto-equip on), else into the stash (or the relic case). */
export function buyGear(s: GameState, i: number): string | null {
    const o = s.market?.pedlar[i];
    if (!o || o.sold) return "sold out";
    if (s.dust < o.price) return `needs ${o.price} ember dust`;
    const upgrade = s.settings.autoEquip && !!upgradeSlot(s, o.item);
    if (!upgrade && !o.item.relic && s.stash.length >= s.stashCap) return "stash full";
    s.dust -= o.price;
    o.sold = true;
    const item = structuredClone(o.item);
    // Paid for: kept whatever the loot filter says.
    const filter = s.settings.filter;
    s.settings.filter = [{ on: true, action: "keep" }];
    try { receiveItem(s, item); } finally { s.settings.filter = filter; }
    s.totals.items--; // not a drop
    return null;
}

export function buyStone(s: GameState, i: number): string | null {
    const o = s.market?.jeweller[i];
    if (!o || o.sold) return "sold out";
    if (s.dust < o.price) return `needs ${o.price} ember dust`;
    s.dust -= o.price;
    o.sold = true;
    addStone(s, o.key, 1);
    return null;
}

/** Time until the next stock, in hero milliseconds. */
export const nextStockIn = (s: GameState) => Math.max(0, (s.market?.rolledAt ?? 0) + ROTATION_MS - s.simTo);

export const STONE_TIER_NAMES = STONE_TIERS;
