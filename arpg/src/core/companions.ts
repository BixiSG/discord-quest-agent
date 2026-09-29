// Companions (round 4): owning, choosing and growing them. The collection is
// state.companions (id -> bond); the one out is hero.pet, with its level kept
// there too so the stat sheet stays a function of the hero alone.

import { COMPANIONS, COMPANION_ORDER, DUPLICATE_BOND, bondFor, companionLevel, COMPANION_MAX_LEVEL } from "./data";
import { pushLog } from "./game";
import { hasPerk } from "./dawn";
import type { Rng } from "./rng";
import type { GameState } from "./state";

/**
 * A companion joins: a new one is added to the collection (and goes out if
 * none is), a duplicate adds bond to the one already owned. Returns whether
 * it was new.
 */
export function grantCompanion(state: GameState, id: string): boolean {
    const def = COMPANIONS[id];
    if (!def) return false;
    state.companions ??= {};
    const owned = state.companions[id] !== undefined;
    if (!owned) {
        state.companions[id] = 0;
        pushLog(state, "loot", `A ${def.name} joins you.`);
        if (!state.hero.pet) setCompanion(state, id);
        return true;
    }
    addBond(state, id, DUPLICATE_BOND);
    pushLog(state, "loot", `Another ${def.name}: your ${def.name} grows closer.`);
    return false;
}

/** Sends a companion out (or calls it back with null). */
export function setCompanion(state: GameState, id: string | null): string | null {
    if (id === null) { if (state.hero.pet) { delete state.hero.pet; state.hero.rev++; } return null; }
    if (!COMPANIONS[id]) return "unknown companion";
    if (state.companions?.[id] === undefined) return "not found yet";
    state.hero.pet = { id, level: companionLevel(state.companions[id]!) };
    state.hero.rev++;
    return null;
}

/** Adds bond; keeps the active companion's level in step. Returns true when the active one levelled up. */
export function addBond(state: GameState, id: string, n: number): boolean {
    const bond = (state.companions[id] ?? 0) + n;
    state.companions[id] = bond;
    const pet = state.hero.pet;
    if (!pet || pet.id !== id || pet.level >= COMPANION_MAX_LEVEL || bond < bondFor(pet.level + 1)) return false;
    pet.level = companionLevel(bond);
    state.hero.rev++;
    pushLog(state, "level", `${COMPANIONS[id]!.name} reached level ${pet.level}.`);
    return true;
}

/** Every kill while a companion is out adds one bond. Returns true when it levelled up. */
export function petKill(state: GameState): boolean {
    const pet = state.hero.pet;
    return pet ? addBond(state, pet.id, hasPerk(state, "longmemory") ? 2 : 1) : false;
}

/**
 * A boss may bring a companion: act and zone bosses rarely, map bosses more
 * often, pinnacles often. Unfound ones come first. Returns the id or null.
 */
export function rollCompanionDrop(state: GameState, rng: Rng, level: number, chance: number): string | null {
    if (!rng.chance(chance)) return null;
    const pool = COMPANION_ORDER.filter(id => COMPANIONS[id]!.level <= level);
    if (!pool.length) return null;
    const unfound = pool.filter(id => state.companions?.[id] === undefined);
    const id = unfound.length && rng.chance(0.7) ? rng.pick(unfound) : rng.pick(pool);
    grantCompanion(state, id);
    return id;
}

/** Companions the hero could still find at this level (contract rewards). */
export const missingCompanions = (state: GameState, level: number) =>
    COMPANION_ORDER.filter(id => COMPANIONS[id]!.level <= level && state.companions?.[id] === undefined);
