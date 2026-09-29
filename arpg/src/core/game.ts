// Game setup and player actions. Actions mutate state in place and bump
// hero.rev when the stat sheet changes.

import { deriveSheet, type Sheet } from "./character";
import { BASES, CLASSES, SKILLS, SUPPORTS, ZONES, slotsFor } from "./data";
import { baseOf, levelReq, salvageValue } from "./items";
import { hashSeed } from "./rng";
import { DEFAULT_FILTER, keepItem } from "./filter";
import { newTotals, type GameState, type LogEntry } from "./state";
import type { Item, Rarity, Slot } from "./types";

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
        world: { unlocked: ["a1_shore"], clears: {}, storySeen: [] },
        activity: { zone: "a1_shore", autoPush: true, runIndex: 0, streak: 0, deaths: 0, run: null, acc: 0 },
        settings: { keep: "rare", autoEquip: true, filter: structuredClone(DEFAULT_FILTER) },
        totals: newTotals(), nextUid: 1, craftSeq: 0, log: [],
    };
    state.hero.equipment.weapon = { uid: state.nextUid++, base: cls.startWeapon, ilvl: 1, rarity: "plain", affixes: [] };
    pushLog(state, "info", `${opts.name} wakes on the shore.`);
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

export function pushLog(state: GameState, kind: LogEntry["kind"], text: string): void {
    state.log.push({ t: state.simTo, kind, text });
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

/** Puts an item on; whatever it displaces goes to the stash. The item must not be in the stash. */
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

/** Equip from the stash. Returns an error message or null. */
export function equip(state: GameState, uid: number, slot?: Slot): string | null {
    const i = state.stash.findIndex(x => x.uid === uid);
    if (i < 0) return "not in stash";
    const item = state.stash[i]!;
    const target = slot ?? bestSlot(state, item);
    const err = canEquip(state, item, target);
    if (err) return err;
    const eq = state.hero.equipment;
    const b = baseOf(item);
    const out = (eq[target] ? 1 : 0) + (target === "weapon" && eq.offhand && (b.weapon?.hands === 2 || baseOf(eq.offhand).kind === "quiver") ? 1 : 0);
    if (state.stash.length - 1 + out > state.stashCap) return "stash full";
    state.stash.splice(i, 1);
    state.stash.push(...putOn(state, item, target));
    return null;
}

export function unequip(state: GameState, slot: Slot): string | null {
    const it = state.hero.equipment[slot];
    if (!it) return null;
    if (state.stash.length >= state.stashCap) return "stash full";
    delete state.hero.equipment[slot];
    state.stash.push(it);
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

/** A new drop: auto-equip, keep or salvage. */
export function receiveItem(state: GameState, item: Item): { kept: boolean; equipped: boolean } {
    state.totals.items++;
    if (state.settings.autoEquip) {
        const slot = upgradeSlot(state, item);
        // Gear taken off must fit in the stash: never salvage something the player wore.
        const displaced = slot ? (state.hero.equipment[slot] ? 1 : 0) + (slot === "weapon" && state.hero.equipment.offhand ? 1 : 0) : 0;
        if (slot && state.stash.length + displaced <= state.stashCap) {
            for (const old of putOn(state, item, slot)) state.stash.push(old);
            pushLog(state, "loot", `Equipped a new ${BASES[item.base]!.name}.`);
            return { kept: true, equipped: true };
        }
    }
    return { kept: stashOrSalvage(state, item), equipped: false };
}

function stashOrSalvage(state: GameState, item: Item): boolean {
    if (keepItem(state, item)) {
        if (state.stash.length < state.stashCap) { state.stash.push(item); return true; }
        if (!state.stashFull) { state.stashFull = true; pushLog(state, "loot", "Stash full: items the filter keeps are being salvaged."); }
    }
    salvageItem(state, item);
    return false;
}

function salvageItem(state: GameState, item: Item): void {
    const v = salvageValue(item);
    state.dust += v;
    state.totals.salvaged++;
    state.totals.dust += v;
}

export function salvage(state: GameState, uids: number[]): number {
    let n = 0;
    for (const uid of uids) {
        const i = state.stash.findIndex(x => x.uid === uid);
        if (i < 0) continue;
        salvageItem(state, state.stash.splice(i, 1)[0]!);
        n++;
    }
    if (n) state.stashFull = false;
    return n;
}

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
    if (state.activity.zone === id) return null;
    state.activity.zone = id;
    state.activity.streak = 0;
    state.activity.deaths = 0;
    state.activity.runIndex++;
    state.activity.run = null;
    return null;
}
