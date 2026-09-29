// The ember shrine (round 4): timed blessings bought with ember dust - or
// with the spare orbs that pile up late - so the late game's dust and
// currency turn into progress. Blessings run on simulation time, so the
// catch-up after time away honours them exactly like live play.

import { CURRENCIES, CURRENCY_ORDER } from "./data";
import type { GameState } from "./state";

export interface BlessingDef { id: string; name: string; text: string; /** Percent. */ value: number }

export const BLESSINGS: BlessingDef[] = [
    { id: "insight", name: "Insight", text: "{0}% more experience", value: 20 },
    { id: "fortune", name: "Fortune", text: "{0}% increased item rarity", value: 40 },
    { id: "plenty", name: "Plenty", text: "{0}% increased item quantity", value: 15 },
    { id: "hoard", name: "Hoard", text: "{0}% more currency found", value: 30 },
];
export const BLESSING: Record<string, BlessingDef> = Object.fromEntries(BLESSINGS.map(b => [b.id, b]));

/** An hour of simulation time per offering. */
export const BLESSING_MS = 3600e3;
/** Orbs of each kind kept back when spare orbs are offered. */
export const ORB_RESERVE = 50;

/** Dust (or its worth in orbs) for an hour of one blessing: grows with the hero like dust income does. */
export const blessingCost = (s: GameState) => Math.round((100 + 25 * Math.pow(s.hero.level, 1.3)) / 10) * 10;

/** A blessing's value while it runs, else 0. */
export function blessing(s: GameState, id: string): number {
    const until = s.blessings?.[id] ?? 0;
    return until > s.simTo ? BLESSING[id]?.value ?? 0 : 0;
}

/** Dust the spare orbs (above the reserve of each kind) are worth. */
export function spareOrbValue(s: GameState): number {
    let v = 0;
    for (const id of CURRENCY_ORDER) v += Math.max(0, (s.currency[id] ?? 0) - ORB_RESERVE) * CURRENCIES[id]!.cost;
    return v;
}

/** Pays `cost`: spare orbs first (most plentiful first, at their shop price) when `orbs`, then dust. */
function pay(s: GameState, cost: number, orbs: boolean): boolean {
    if ((orbs ? spareOrbValue(s) : 0) + s.dust < cost) return false;
    let left = cost;
    if (orbs) {
        const kinds = CURRENCY_ORDER.filter(id => (s.currency[id] ?? 0) > ORB_RESERVE).sort((a, b) => (s.currency[b] ?? 0) - (s.currency[a] ?? 0));
        for (const id of kinds) {
            const price = CURRENCIES[id]!.cost;
            const n = Math.min((s.currency[id] ?? 0) - ORB_RESERVE, Math.ceil(left / price));
            if (n <= 0) continue;
            s.currency[id]! -= n;
            left -= n * price;
            if (left <= 0) break;
        }
    }
    if (left > 0) s.dust -= left;
    return true;
}

/** Offers for an hour of a blessing; a running one is extended. */
export function bless(s: GameState, id: string, orbs = s.shrine?.orbs ?? true): string | null {
    if (!BLESSING[id]) return "unknown blessing";
    const cost = blessingCost(s);
    if (!pay(s, cost, orbs)) return `needs ${cost} ember dust${orbs ? " (or spare orbs)" : ""}`;
    s.blessings ??= {};
    s.blessings[id] = Math.max(s.simTo, s.blessings[id] ?? 0) + BLESSING_MS;
    return null;
}

/** Auto-renew: blessings the player keeps up are offered again when they run out, while it can be paid. */
export function tickShrine(s: GameState): void {
    const keep = s.shrine?.keep;
    if (!keep?.length) return;
    for (const id of keep) if ((s.blessings?.[id] ?? 0) <= s.simTo) bless(s, id);
}

export function setKeep(s: GameState, id: string, on: boolean): void {
    s.shrine ??= { keep: [], orbs: true };
    s.shrine.keep = on ? [...new Set([...s.shrine.keep, id])] : s.shrine.keep.filter(x => x !== id);
}
