// Sockets and ember stones (round 5): drilling, setting, prying, cutting,
// drops, and the idle-friendly auto-set. The stone pouch is state.stones
// (key "ruby:2" -> count); a socketed item carries item.stones.

import { STONES, STONE_ORDER, STONE_TIERS, STONE_TIER_LEVEL, parseStone, stoneKey } from "./data";
import { baseOf, placeOf } from "./items";
import { buildScore, sheetOf } from "./game";
import { deriveSheet } from "./character";
import type { Rng } from "./rng";
import type { GameState } from "./state";
import { SLOTS, type Item, type Slot } from "./types";

/** Most sockets an item can have. */
export function socketCap(item: Item): number {
    const b = baseOf(item);
    if (placeOf(item) === "jewel") return 1;
    if (b.slot === "body" || b.weapon?.hands === 2) return 3;
    return 2;
}

/** Keeps item.stones the same length as item.sockets (validator, drilling). */
export function fitStones(item: Item): void {
    const n = item.sockets ?? 0;
    if (!n) { delete item.sockets; delete item.stones; return; }
    const s = (item.stones ?? []).slice(0, n);
    while (s.length < n) s.push(null);
    item.stones = s;
}

/** Sockets on a fresh rare: none (55%), one (33%) or two (12%), within the item's cap. */
export function rollSockets(rng: Rng, item: Item): void {
    const r = rng.next();
    const n = Math.min(socketCap(item), r < 0.55 ? 0 : r < 0.88 ? 1 : 2);
    if (n) { item.sockets = n; fitStones(item); }
}

/** Every stone socketed in an item goes back to the pouch (salvage, upkeep). */
export function returnStones(state: GameState, item: Item): void {
    for (const k of item.stones ?? []) if (k) addStone(state, k, 1);
    if (item.stones) item.stones = item.stones.map(() => null);
}

export function addStone(state: GameState, key: string, n: number): void {
    state.stones ??= {};
    const v = (state.stones[key] ?? 0) + n;
    if (v > 0) state.stones[key] = v; else delete state.stones[key];
}

/**
 * A stone for a monster of this level: the best tier it allows, one lower 30%
 * of the time. Radiant never drops: it is cut from three Flawless.
 */
export function rollStone(rng: Rng, level: number): string {
    let tier = 0;
    while (tier + 1 < STONE_TIERS.length - 1 && STONE_TIER_LEVEL[tier + 1]! <= level) tier++;
    if (tier > 0 && rng.chance(0.3)) tier--;
    return stoneKey(rng.pick(STONE_ORDER), tier);
}

/** Dust to drill the next socket; null at the cap. */
export function drillCost(item: Item): number | null {
    const n = item.sockets ?? 0;
    if (n >= socketCap(item)) return null;
    return Math.round((50 + item.ilvl * 8) * Math.pow(n + 1, 1.6) / 10) * 10;
}

function findItem(state: GameState, uid: number): { item: Item; slot?: Slot } | null {
    const s = state.stash.find(x => x.uid === uid) ?? state.relics.find(x => x.uid === uid);
    if (s) return { item: s };
    for (const slot of SLOTS) { const it = state.hero.equipment[slot]; if (it?.uid === uid) return { item: it, slot }; }
    return null;
}

export function drillSocket(state: GameState, uid: number): string | null {
    const f = findItem(state, uid);
    if (!f) return "item not found";
    const cost = drillCost(f.item);
    if (cost === null) return `no room for more than ${socketCap(f.item)} socket${socketCap(f.item) > 1 ? "s" : ""}`;
    if (state.dust < cost) return `needs ${cost} ember dust`;
    state.dust -= cost;
    f.item.sockets = (f.item.sockets ?? 0) + 1;
    fitStones(f.item);
    return null;
}

/** Sets a stone from the pouch into socket `i` (the one there goes back), or pries it out with null. Free both ways. */
export function setStone(state: GameState, uid: number, i: number, key: string | null): string | null {
    const f = findItem(state, uid);
    if (!f) return "item not found";
    const it = f.item;
    if (!it.sockets || i < 0 || i >= it.sockets) return "no such socket";
    fitStones(it);
    if (key !== null) {
        if (!parseStone(key)) return "unknown stone";
        if ((state.stones?.[key] ?? 0) <= 0) return "none in the pouch";
        addStone(state, key, -1);
    }
    const old = it.stones![i];
    if (old) addStone(state, old, 1);
    it.stones![i] = key;
    if (f.slot) state.hero.rev++;
    return null;
}

/** Dust to cut three stones of a tier into one of the next. */
export const cutCost = (tier: number) => [40, 150, 500, 1500][tier] ?? 0;

export function cutStones(state: GameState, key: string): string | null {
    const p = parseStone(key);
    if (!p) return "unknown stone";
    if (p.tier >= STONE_TIERS.length - 1) return "already Radiant";
    if ((state.stones?.[key] ?? 0) < 3) return "needs three of them";
    const cost = cutCost(p.tier);
    if (state.dust < cost) return `needs ${cost} ember dust`;
    state.dust -= cost;
    addStone(state, key, -3);
    addStone(state, stoneKey(p.id, p.tier + 1), 1);
    return null;
}

/**
 * Auto-set (idle play): every empty socket in worn gear gets the pouch stone
 * that raises the build score most, and a socketed stone is swapped for a
 * better one of its own kind when the pouch has it. Returns stones set.
 */
export function autoSetStones(state: GameState): number {
    if (!state.stones || !Object.keys(state.stones).length) return 0;
    let n = 0;
    for (const slot of SLOTS) {
        const it = state.hero.equipment[slot];
        if (!it?.sockets) continue;
        fitStones(it);
        for (let i = 0; i < it.sockets; i++) {
            const cur = it.stones![i];
            const curP = cur ? parseStone(cur) : null;
            // Candidates: any stone for an empty socket; only a higher tier of the same kind for a filled one.
            const keys = Object.keys(state.stones).filter(k => (state.stones![k] ?? 0) > 0 && (!curP || (parseStone(k)?.id === curP.id && parseStone(k)!.tier > curP.tier)));
            if (!keys.length) continue;
            let best: string | null = null, bestScore = buildScore(sheetOf(state));
            for (const k of keys) {
                const hero = structuredClone(state.hero);
                hero.equipment[slot]!.stones![i] = k;
                const sc = buildScore(deriveSheet(hero));
                if (sc > bestScore * 1.001 || (curP && !best)) { best = k; bestScore = Math.max(bestScore, sc); }
            }
            if (best) { setStone(state, it.uid, i, best); n++; }
        }
    }
    return n;
}

/** Everything in the pouch, best first, for the UI. */
export function pouchList(state: GameState): { key: string; n: number }[] {
    return Object.entries(state.stones ?? {}).filter(([, n]) => n > 0).map(([key, n]) => ({ key, n }))
        .sort((a, b) => parseStone(b.key)!.tier - parseStone(a.key)!.tier || STONE_ORDER.indexOf(parseStone(a.key)!.id) - STONE_ORDER.indexOf(parseStone(b.key)!.id));
}

export { STONES, placeOf };
