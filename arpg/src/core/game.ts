// Game setup and player actions. Actions mutate state in place and bump
// hero.rev when the stat sheet changes.

import { returnStones } from "./sockets";
import { dawnOf, hasPerk } from "./dawn";
import { deriveSheet, type Sheet } from "./character";
import { CLASSES, DAWN_DUST, RELICS, SKILLS, SUPPORTS, ZONES, betterLow, slotsFor } from "./data";
import { baseOf, levelReq, salvageValue } from "./items";
import { logLine } from "../i18n/names";
import { ref } from "../i18n/refs";
import type { Params } from "../i18n";
import { hashSeed } from "./rng";
import { DEFAULT_FILTER, keepItem } from "./filter";
import { newTotals, type GameState, type LogEntry } from "./state";
import { SLOTS, type Item, type Rarity, type Slot } from "./types";

export const RARITY_RANK: Record<Rarity, number> = { plain: 0, enchanted: 1, rare: 2, relic: 3 };
const LOG_MAX = 60;

export function newGame(opts: { name: string; cls: string; now: number; seed?: number }): GameState {
    const cls = CLASSES[opts.cls];
    if (!cls) throw new Error("unknown class " + opts.cls);
    const seed = opts.seed ?? hashSeed(opts.now, opts.name.length);
    const state: GameState = {
        seed, createdAt: opts.now, simTo: opts.now,
        hero: { name: opts.name, cls: cls.id, level: 1, xp: 0, skill: cls.startSkill, supports: [], equipment: {}, passives: [], bonusPoints: 0, ascNodes: [], ascPoints: 0, rev: 0 },
        stash: [], stashCap: 60, dust: 0, currency: {},
        world: { unlocked: ["a1_shore"], clears: {}, storySeen: [], rewards: [] },
        activity: { zone: "a1_shore", autoPush: true, runIndex: 0, streak: 0, deaths: 0, run: null, acc: 0, mode: "zone", mapTier: 0 },
        maps: [], mapCap: 40, atlas: { points: 0, nodes: [], tiers: [] }, sigils: {}, pinnacleKills: {},
        settings: { keep: "rare", autoEquip: true, filter: structuredClone(DEFAULT_FILTER), upkeep: true, autoStones: true },
        relics: [], codex: {}, contracts: { list: [], seq: 0, done: 0 }, companions: {}, blessings: {}, shrine: { keep: [], orbs: true },
        stones: {}, market: { seq: 0, rolledAt: 0, refreshes: 0, pedlar: [], jeweller: [] }, echoes: [], fray: { runs: 0, won: 0, kills: 0, best: 0 }, totals: newTotals(), nextUid: 1, craftSeq: 0, log: [],
    };
    state.hero.equipment.weapon = { uid: state.nextUid++, base: cls.startWeapon, ilvl: 1, rarity: "plain", affixes: [] };
    pushLog(state, "info", "log.wake", { name: opts.name });
    return state;
}

// ---- sheet cache -------------------------------------------------------------

const cache = new WeakMap<object, { rev: number; sheet: Sheet }>();
export function sheetOf(state: GameState): Sheet {
    const c = cache.get(state.hero);
    if (c && c.rev === state.hero.rev) return c.sheet;
    const sheet = deriveSheet(state.hero);
    cache.set(state.hero, { rev: state.hero.rev, sheet });
    return sheet;
}

/**
 * Adds a chronicle line: a string key and params (content as references, i18n/refs.ts), with the
 * English text alongside for exports and older readers.
 */
export function pushLog(state: GameState, kind: LogEntry["kind"], key: string, params?: Params): void {
    const e: LogEntry = { t: state.simTo, kind, text: logLine(key, params, "en"), key };
    if (params) e.params = params;
    state.log.push(e);
    if (state.log.length > LOG_MAX) state.log.splice(0, state.log.length - LOG_MAX);
}

// ---- equipment ---------------------------------------------------------------

/** One number for "is this build better": offence and defence, geometric. */
export function buildScore(s: Sheet): number {
    const off = Math.sqrt(Math.max(0.01, s.skill.dps) * Math.max(0.01, s.skill.packDps));
    const def = Math.pow(s.ehp.phys * s.ehp.fire * s.ehp.cold * s.ehp.lightning, 0.25);
    return Math.pow(off, 0.6) * Math.pow(def, 0.4);
}

export function canEquip(state: GameState, item: Item, slot: Slot): string | null {
    const b = baseOf(item);
    if (!slotsFor(b).includes(slot)) return "wrong slot";
    if (levelReq(item) > state.hero.level) return `needs level ${levelReq(item)}`;
    const w = state.hero.equipment.weapon;
    if (slot === "offhand" && w) {
        const wb = baseOf(w);
        if (wb.weapon?.hands === 2 && !(wb.kind === "bow" && b.kind === "quiver")) return "two-handed weapon";
    }
    if (b.kind === "quiver" && (!w || baseOf(w).kind !== "bow")) return "needs a bow";
    return null;
}

/** Does putting a weapon in `slot` also take the off-hand off? (Same rule as putOn.) */
function dropsOffhand(state: GameState, item: Item, slot: Slot): boolean {
    const off = state.hero.equipment.offhand;
    if (slot !== "weapon" || !off) return false;
    const b = baseOf(item), ob = baseOf(off);
    return (b.weapon?.hands === 2 && !(b.kind === "bow" && ob.kind === "quiver")) || (ob.kind === "quiver" && b.kind !== "bow");
}

/** How many worn items equipping `item` in `slot` takes off. */
export function displacedCount(state: GameState, item: Item, slot: Slot): number {
    return (state.hero.equipment[slot] ? 1 : 0) + (dropsOffhand(state, item, slot) ? 1 : 0);
}

/** The worn items equipping `item` in `slot` would take off. */
function displacedItems(state: GameState, item: Item, slot: Slot): Item[] {
    const eq = state.hero.equipment;
    const out: Item[] = [];
    if (eq[slot]) out.push(eq[slot]!);
    if (dropsOffhand(state, item, slot)) out.push(eq.offhand!);
    return out;
}

// ---- stash upkeep ------------------------------------------------------------

/**
 * How much a stash item is worth keeping (upkeep gives up the lowest): item
 * level (affix tiers) and base level (damage, defences) equally, then rarity,
 * affix count and honed quality. With the hero's level, an item that needs
 * more than two levels beyond it is worth less per level missing: late,
 * levels come slowly and the best-rolled drops (which need the most) would
 * otherwise fill the stash with gear nobody can wear for hours.
 */
export function stashWorth(item: Item, heroLevel = Infinity): number {
    const far = Math.max(0, levelReq(item) - heroLevel - 2);
    return (item.ilvl + baseOf(item).level) / 2 + 12 * RARITY_RANK[item.rarity] + 2 * item.affixes.length + (item.quality ?? 0) - 3 * far;
}

/** Never given up by upkeep, auto-equip or bulk salvage. */
const guarded = (x: Item) => !!x.locked;

/** Is this item an upgrade right now? Remembered per stat-sheet revision (upkeep asks often). */
const upgradeMemo = new WeakMap<object, { rev: number; level: number; map: Map<number, boolean> }>();
function isUpgrade(state: GameState, item: Item): boolean {
    let m = upgradeMemo.get(state.hero);
    if (!m || m.rev !== state.hero.rev || m.level !== state.hero.level) { m = { rev: state.hero.rev, level: state.hero.level, map: new Map() }; upgradeMemo.set(state.hero, m); }
    let v = m.map.get(item.uid);
    if (v === undefined) { v = upgradeSlot(state, item) !== null; m.map.set(item.uid, v); }
    return v;
}

/**
 * `n` stash items upkeep may give up, cheapest first, each worth less than
 * `below`: never locked items or upgrades. Empty when there are fewer.
 */
function upkeepVictims(state: GameState, n: number, below = Infinity): Item[] {
    const L = state.hero.level;
    const pool = state.stash.filter(x => !guarded(x) && stashWorth(x, L) < below).sort((a, b) => stashWorth(a, L) - stashWorth(b, L) || a.uid - b.uid);
    const out: Item[] = [];
    for (const x of pool) {
        if (out.length >= n) break;
        if (!isUpgrade(state, x)) out.push(x);
    }
    return out.length >= n ? out : [];
}

/** Takes an item out of the stash or the relic case (wherever it is). */
function takeOut(state: GameState, x: Item): void {
    let i = state.stash.indexOf(x);
    if (i >= 0) { state.stash.splice(i, 1); return; }
    i = state.relics.indexOf(x);
    if (i >= 0) state.relics.splice(i, 1);
}

function giveUp(state: GameState, x: Item): void {
    takeOut(state, x);
    salvageItem(state, x);
    state.totals.swapped = (state.totals.swapped ?? 0) + 1;
}

// ---- relic case ------------------------------------------------------------------

/** How well a relic rolled, 0 (worst) to 1 (best), averaged over its ranged mods. */
export function relicRollScore(item: Item): number {
    const def = item.relic ? RELICS[item.relic] : undefined;
    if (!def) return 0;
    let sum = 0, n = 0;
    def.mods.forEach((m, i) => {
        const [lo, hi] = m.range;
        if (hi === lo) return;
        const v = ((item.relicRolls?.[i] ?? lo) - lo) / (hi - lo);
        sum += betterLow(m) ? 1 - v : v;
        n++;
    });
    return n ? sum / n : 1;
}

/** The relic that would lose if `item` were offered to the case (the new one or the old copy); null when the case has none. */
function caseLoser(state: GameState, item: Item): Item | null {
    const old = state.relics.find(x => x.relic === item.relic);
    if (!old) return null;
    return relicRollScore(item) > relicRollScore(old) ? old : item;
}

/** Puts a relic in the case, keeping the better copy of each; returns the one left over (or null). */
function toCase(state: GameState, item: Item): Item | null {
    const loser = caseLoser(state, item);
    if (loser === item) return item;
    if (loser) state.relics.splice(state.relics.indexOf(loser), 1);
    state.relics.push(item);
    return loser;
}

/** A relic left over by the case: kept in the stash when locked (and there is room), else salvaged. */
function leftOver(state: GameState, x: Item): void {
    if (x.locked && state.stash.length < state.stashCap) state.stash.push(x);
    else salvageItem(state, x);
}

/**
 * Equips an upgrade (a drop, or an item already taken out of the stash or the
 * case). Relics coming off go to the case; other gear goes through the loot
 * filter like a drop, except locked items, which are always kept: when the
 * stash has no room for those, upkeep makes room, and if it can't, nothing
 * changes and this returns false.
 */
function equipWithRoom(state: GameState, item: Item, slot: Slot): boolean {
    const off = displacedItems(state, item, slot);
    const keep = off.flatMap(o => {
        if (!o.relic) return o.locked ? [o] : [];
        const l = caseLoser(state, o);
        return l?.locked ? [l] : [];
    });
    const need = keep.length - (state.stashCap - state.stash.length);
    const victims = need > 0 ? upkeepVictims(state, need) : [];
    if (need > 0 && victims.length < need) return false;
    putOn(state, item, slot);
    for (const v of victims) giveUp(state, v);
    for (const o of off) {
        if (o.relic) { const l = toCase(state, o); if (l) leftOver(state, l); }
        else if (o.locked) state.stash.push(o);
        else stashOrSalvage(state, o);
    }
    return true;
}

/** Puts an item on; returns what it displaced. The item must be out of the stash and the case. */
function putOn(state: GameState, item: Item, slot: Slot): Item[] {
    const eq = state.hero.equipment;
    const off: Item[] = [];
    const prev = eq[slot];
    if (prev) off.push(prev);
    eq[slot] = item;
    const b = baseOf(item);
    if (slot === "weapon" && eq.offhand) {
        const ob = baseOf(eq.offhand);
        if (b.weapon?.hands === 2 && !(b.kind === "bow" && ob.kind === "quiver")) { off.push(eq.offhand); delete eq.offhand; }
        else if (ob.kind === "quiver" && b.kind !== "bow") { off.push(eq.offhand); delete eq.offhand; }
    }
    state.hero.rev++;
    return off;
}

/** A stash or relic-case item by uid. */
export function ownedItem(state: GameState, uid: number): Item | undefined {
    return state.stash.find(x => x.uid === uid) ?? state.relics.find(x => x.uid === uid);
}

/**
 * Equip from the stash or the relic case. Nothing the player does by hand is
 * salvaged: what comes off goes to the stash (relics to the case, the worse
 * copy to the stash). Returns an error message or null.
 */
export function equip(state: GameState, uid: number, slot?: Slot): string | null {
    const item = ownedItem(state, uid);
    if (!item) return "not in stash";
    const target = slot ?? bestSlot(state, item);
    const err = canEquip(state, item, target);
    if (err) return err;
    const fromStash = state.stash.includes(item);
    takeOut(state, item);
    const off = displacedItems(state, item, target);
    const toStash = off.filter(o => !o.relic || caseLoser(state, o)).length;
    if (state.stash.length + toStash > state.stashCap) {
        (fromStash ? state.stash : state.relics).push(item);
        return "stash full";
    }
    for (const o of putOn(state, item, target)) {
        const l = o.relic ? toCase(state, o) : o;
        if (l) state.stash.push(l);
    }
    return null;
}

export function unequip(state: GameState, slot: Slot): string | null {
    const it = state.hero.equipment[slot];
    if (!it) return null;
    if ((!it.relic || caseLoser(state, it)) && state.stash.length >= state.stashCap) return "stash full";
    delete state.hero.equipment[slot];
    const l = it.relic ? toCase(state, it) : it;
    if (l) state.stash.push(l);
    state.hero.rev++;
    return null;
}

function bestSlot(state: GameState, item: Item): Slot {
    const slots = slotsFor(baseOf(item));
    return slots.find(s => !state.hero.equipment[s]) ?? slots[0]!;
}

/** The stat sheet the hero would have with `item` in `slot` (null if it can't go there). */
export function trialSheet(state: GameState, item: Item, slot: Slot): Sheet | null {
    if (canEquip(state, item, slot)) return null;
    const hero = structuredClone(state.hero);
    const trial = { ...state, hero } as GameState;
    putOn(trial, item, slot);
    return deriveSheet(hero);
}

/** Would equipping this raise the build score? Returns the slot, or null. */
export function upgradeSlot(state: GameState, item: Item): Slot | null {
    const now = buildScore(sheetOf(state));
    let best: Slot | null = null, bestScore = now * 1.02;
    for (const slot of slotsFor(baseOf(item))) {
        const sheet = trialSheet(state, item, slot);
        if (!sheet) continue;
        const score = buildScore(sheet);
        if (score > bestScore) { best = slot; bestScore = score; }
    }
    return best;
}

/** A new drop: auto-equip, keep or salvage. Relics are entered in the codex whatever happens next. */
export function receiveItem(state: GameState, item: Item): { kept: boolean; equipped: boolean } {
    state.totals.items++;
    if (item.relic) state.codex[item.relic] = (state.codex[item.relic] ?? 0) + 1;
    if (state.settings.autoEquip) {
        const slot = upgradeSlot(state, item);
        if (slot && equipWithRoom(state, item, slot)) {
            pushLog(state, "loot", "log.equippedNew", { base: ref.base(item.base) });
            return { kept: true, equipped: true };
        }
    }
    return { kept: stashOrSalvage(state, item), equipped: false };
}

/**
 * The loot filter, then storage. Relics go to the case (the better copy of
 * each stays). Other keepers go to the stash; when it is full, upkeep gives up
 * the least-worth item for a better one.
 */
function stashOrSalvage(state: GameState, item: Item): boolean {
    if (keepItem(state, item)) {
        if (item.relic) {
            const loser = caseLoser(state, item);
            if (loser !== item && !(loser?.locked && state.stash.length >= state.stashCap)) {
                toCase(state, item);
                if (loser) leftOver(state, loser);
                return true;
            }
        } else {
            if (state.stash.length < state.stashCap) { state.stash.push(item); return true; }
            // Upkeep: the cheapest item it may give up goes if the drop is worth more. A drop worth
            // less than everything is simply salvaged; only a stash upkeep can't touch at all is "full".
            const v = state.settings.upkeep ? upkeepVictims(state, 1)[0] : undefined;
            if (v && stashWorth(v, state.hero.level) < stashWorth(item, state.hero.level)) { giveUp(state, v); state.stash.push(item); state.stashFull = false; return true; }
            if (!v && !state.stashFull) { state.stashFull = true; pushLog(state, "loot", "log.stashFull"); }
        }
    }
    salvageItem(state, item);
    return false;
}

function salvageItem(state: GameState, item: Item): void {
    returnStones(state, item);
    const d = dawnOf(state);
    const v = Math.round(salvageValue(item) * (1 + (DAWN_DUST * d) / 100) * (hasPerk(state, "warmhands") ? 1.25 : 1));
    state.dust += v;
    state.totals.salvaged++;
    state.totals.dust += v;
}

/** Salvages stash or relic-case items by uid; locked ones are skipped. Returns how many went. */
export function salvage(state: GameState, uids: number[]): number {
    let n = 0;
    for (const uid of uids) {
        const it = ownedItem(state, uid);
        if (!it || it.locked) continue;
        takeOut(state, it);
        salvageItem(state, it);
        n++;
    }
    if (n) state.stashFull = false;
    return n;
}

/** Lock or unlock a stash, relic-case or worn item. */
export function setLocked(state: GameState, uid: number, on: boolean): string | null {
    const it = ownedItem(state, uid) ?? SLOTS.map(s => state.hero.equipment[s]).find(x => x?.uid === uid);
    if (!it) return "item not found";
    if (on) it.locked = true; else delete it.locked;
    return null;
}

/** Stash items to salvage in one go: a base 10+ levels behind the hero, not locked and not an upgrade. */
export function outdatedItems(state: GameState): Item[] {
    return state.stash.filter(x => !guarded(x) && baseOf(x).level <= state.hero.level - 10 && !isUpgrade(state, x));
}

/**
 * Wears the stash and relic-case items that raise the build score, the best
 * gain first, one at a time (each changes the sheet). `only` limits the
 * candidates (a level-up checks just the items that became wearable).
 * Returns how many went on.
 */
export function equipUpgrades(state: GameState, only?: (x: Item) => boolean): number {
    let n = 0;
    for (let round = 0; round < SLOTS.length; round++) {
        const now = buildScore(sheetOf(state));
        let best: { item: Item; slot: Slot; score: number } | null = null;
        for (const item of [...state.stash, ...state.relics]) {
            if (only && !only(item)) continue;
            for (const slot of slotsFor(baseOf(item))) {
                const sheet = trialSheet(state, item, slot);
                if (!sheet) continue;
                const score = buildScore(sheet);
                if (score > now * 1.02 && (!best || score > best.score)) best = { item, slot, score };
            }
        }
        if (!best) break;
        const home = state.stash.includes(best.item) ? state.stash : state.relics;
        takeOut(state, best.item);
        if (!equipWithRoom(state, best.item, best.slot)) { home.push(best.item); break; }
        pushLog(state, "loot", home === state.stash ? "log.equippedFromStash" : "log.equippedFromCase", { item: ref.item(best.item) });
        n++;
    }
    return n;
}

export const STASH_BASE = 60, STASH_STEP = 10, STASH_MAX = 150;
/** Ember dust for the next ten stash slots; null at the maximum. */
export function stashRoomCost(state: GameState): number | null {
    const extra = hasPerk(state, "deeppockets") ? 20 : 0; // the Deep Pockets dawn perk: 20 free, 20 more room
    if (state.stashCap >= STASH_MAX + extra) return null;
    const bought = Math.max(0, Math.round((state.stashCap - STASH_BASE - extra) / STASH_STEP));
    return Math.round((250 * Math.pow(2.2, bought)) / 10) * 10;
}

export function buyStashRoom(state: GameState): string | null {
    const cost = stashRoomCost(state);
    if (cost === null) return "the stash is as big as it gets";
    if (state.dust < cost) return `needs ${cost} ember dust`;
    state.dust -= cost;
    state.stashCap = Math.min(STASH_MAX + (hasPerk(state, "deeppockets") ? 20 : 0), state.stashCap + STASH_STEP);
    state.stashFull = false;
    return null;
}

/** Relic codex bonus: +1% item rarity for every different relic found. */
export const codexRarity = (state: GameState) => Object.keys(state.codex ?? {}).length;

// ---- skills and zones --------------------------------------------------------

export function setSkill(state: GameState, id: string): string | null {
    const s = SKILLS[id];
    if (!s) return "unknown skill";
    if (s.level > state.hero.level) return `needs level ${s.level}`;
    state.hero.skill = id;
    state.hero.rev++;
    return null;
}

export function setSupports(state: GameState, ids: string[]): string | null {
    for (const id of ids) {
        const s = SUPPORTS[id];
        if (!s) return "unknown support";
        if (s.level > state.hero.level) return `${s.name} needs level ${s.level}`;
    }
    if (new Set(ids).size !== ids.length) return "duplicate support";
    state.hero.supports = [...ids];
    state.hero.rev++;
    return null;
}

export function setZone(state: GameState, id: string): string | null {
    if (!ZONES[id]) return "unknown zone";
    if (!state.world.unlocked.includes(id)) return "locked";
    const act = state.activity;
    if (act.zone === id && act.mode === "zone") return null;
    act.zone = id;
    act.mode = "zone";
    act.streak = 0;
    act.deaths = 0;
    // A map already under way is not thrown away: the road starts after it.
    if (act.run?.map) return null;
    act.runIndex++;
    act.run = null;
    return null;
}
