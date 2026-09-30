// Companion errands (round 8): companions that are not at the hero's side can
// be sent on errands of two hours of the hero's time (so time away counts).
// What they bring back grows with their level, and every errand adds bond, so
// the whole collection grows, not only the one out. Rewards are rolled when
// the companion comes back, from the save's seed and an errand counter.

import { COMPANIONS, CURRENCIES, CURRENCY_ORDER, DAWN_DUST, PINNACLES, companionLevel } from "./data";
import { addBond } from "./companions";
import { forgeCost } from "./crafting";
import { dawnOf, hasPerk } from "./dawn";
import { pushLog } from "./game";
import { addMap, endgameOpen, rollMap } from "./maps";
import { Rng, hashSeed } from "./rng";
import { addStone, autoSetStones, rollStone } from "./sockets";
import type { GameState } from "./state";
import { ref } from "../i18n/refs";

export type ErrandKind = "scavenge" | "forage" | "delve" | "scout";
export const ERRAND_KINDS: ErrandKind[] = ["scavenge", "forage", "delve", "scout"];

export interface Errand {
    pet: string;
    kind: ErrandKind;
    /** Hero time it comes back at. */
    until: number;
}

/** Two hours of the hero's time; three at once; bond each errand adds. */
export const ERRAND_MS = 2 * 3600e3, ERRAND_SLOTS = 3, ERRAND_BOND = 1500;

/** Errands open once there is a companion to spare (one walks with the hero). */
export const errandsOpen = (s: GameState) => Object.keys(s.companions ?? {}).length >= 2;
/** Scouting brings maps: the Cinderlands must be open. */
export const kindOpen = (s: GameState, kind: ErrandKind) => kind !== "scout" || endgameOpen(s);
export const onErrand = (s: GameState, pet: string) => (s.errands ?? []).some(e => e.pet === pet);
/** A companion of the game that the player has found (own keys only: never "toString" and the like). */
export const owns = (s: GameState, pet: string) => Object.hasOwn(COMPANIONS, pet) && Object.hasOwn(s.companions ?? {}, pet);
/** Companions owned, not out with the hero and not away. */
export const idleCompanions = (s: GameState) => Object.keys(s.companions ?? {}).filter(id => owns(s, id) && s.hero.pet?.id !== id && !onErrand(s, id));

export function sendErrand(s: GameState, pet: string, kind: ErrandKind): string | null {
    if (!owns(s, pet)) return "not found yet";
    if (!ERRAND_KINDS.includes(kind)) return "unknown errand";
    if (!kindOpen(s, kind)) return "clear Ashfold first";
    if (s.hero.pet?.id === pet) return "walks with the hero";
    if (onErrand(s, pet)) return "already on an errand";
    s.errands ??= [];
    if (s.errands.length >= ERRAND_SLOTS) return "every errand is taken";
    s.errands.push({ pet, kind, until: s.simTo + ERRAND_MS });
    return null;
}

/** Calls a companion back early: nothing is brought back. */
export function recallErrand(s: GameState, pet: string): string | null {
    const i = (s.errands ?? []).findIndex(e => e.pet === pet);
    if (i < 0) return "not on an errand";
    s.errands.splice(i, 1);
    return null;
}

/** What an errand of this kind brings at a companion level: [low, high] of its count, for the UI. */
export function errandYield(s: GameState, kind: ErrandKind, level: number): number {
    switch (kind) {
        case "scavenge": return Math.round(forgeCost(s) * (4 + 0.5 * level) * (1 + (DAWN_DUST * dawnOf(s)) / 100));
        case "forage": return 3 + Math.floor(level / 3);
        case "delve": return 1 + Math.floor(level / 7);
        case "scout": return 1 + Math.floor(level / 7);
    }
}

/** The tier scouted maps are: one deeper than the deepest cleared. */
export const scoutTier = (s: GameState) => Math.max(0, ...(s.atlas?.tiers ?? [])) + 1;

/** Brings one errand's haul home, of `kind` (the errand's own, unless it can no longer be run). Returns the count brought (dust, orbs, stones or maps). */
function bringBack(s: GameState, e: Errand, kind: ErrandKind): number {
    const rng = new Rng(hashSeed(s.seed, 0xe44a, s.errandSeq = (s.errandSeq ?? 0) + 1));
    const level = companionLevel(s.companions[e.pet] ?? 0);
    const n = errandYield(s, kind, level);
    const pet = ref.companion(e.pet);
    switch (kind) {
        case "scavenge":
            s.dust += n; s.totals.dust += n;
            pushLog(s, "loot", "log.errandDust", { pet, n });
            break;
        case "forage":
            // The rarer orbs weigh more than in drops (as contracts pay them).
            for (let k = 0; k < n; k++) {
                const id = rng.weighted(CURRENCY_ORDER, x => 1 / Math.sqrt(CURRENCIES[x]!.drop))!;
                s.currency[id] = (s.currency[id] ?? 0) + 1;
            }
            pushLog(s, "loot", "log.errandOrbs", { pet, n });
            break;
        case "delve":
            for (let k = 0; k < n; k++) addStone(s, rollStone(rng, s.hero.level), 1);
            if (s.settings.autoStones) autoSetStones(s);
            pushLog(s, "loot", "log.errandStones", { pet, n });
            break;
        case "scout": {
            const tier = scoutTier(s);
            let got = 0;
            for (let k = 0; k < n; k++) if (addMap(s, rollMap(rng, s.nextUid++, tier))) got++;
            s.totals.maps = (s.totals.maps ?? 0) + got;
            pushLog(s, "loot", "log.errandMaps", { pet, n: got, tier: ref.tier(tier) });
            const eligible = Object.values(PINNACLES).filter(p => tier >= p.minTier);
            if (eligible.length && rng.chance(0.05 + 0.01 * level)) {
                const p = rng.pick(eligible);
                s.sigils[p.sigil] = (s.sigils[p.sigil] ?? 0) + 1;
                pushLog(s, "loot", "log.errandSigil", { pet, sigil: ref.sigil(p.id) });
            }
            return got;
        }
    }
    return n;
}

/**
 * Companions whose errand is done come back with it (called as runs finish).
 * With "keep them busy" on, each goes again at once, and idle companions
 * take free errands (scavenging). Returns who came back.
 */
export function tickErrands(s: GameState, onBack?: (pet: string, kind: ErrandKind) => void): string[] {
    s.errands ??= [];
    const back: string[] = [];
    for (const e of [...s.errands]) {
        if (e.until > s.simTo) continue;
        s.errands.splice(s.errands.indexOf(e), 1);
        if (!owns(s, e.pet)) continue;
        // A scout sent before a new dawn finds the Cinderlands dark: it scavenges on the way back.
        const kind = kindOpen(s, e.kind) ? e.kind : "scavenge";
        bringBack(s, e, kind);
        addBond(s, e.pet, ERRAND_BOND * (hasPerk(s, "longmemory") ? 2 : 1));
        back.push(e.pet);
        onBack?.(e.pet, kind);
        if (s.settings.errandKeep && s.hero.pet?.id !== e.pet && kindOpen(s, e.kind)) s.errands.push({ pet: e.pet, kind: e.kind, until: s.simTo + ERRAND_MS });
    }
    if (s.settings.errandKeep) for (const pet of idleCompanions(s)) if (s.errands.length < ERRAND_SLOTS) sendErrand(s, pet, "scavenge");
    return back;
}
