// Passive tree allocation. The allocated set must stay connected to the
// hero's class start node.

import { ASCENDANCIES, ASC_NODES, CLASSES, PASSIVES, passivePoints } from "./data";
import type { GameState, Hero } from "./state";
import type { Mod } from "./types";

export function startNode(hero: Hero): string {
    return CLASSES[hero.cls]!.startNode;
}

export function pointsLeft(hero: Hero): number {
    return passivePoints(hero.level, hero.bonusPoints ?? 0) - hero.passives.length;
}

export function passiveMods(hero: Hero): Mod[] {
    const out: Mod[] = [];
    for (const id of hero.passives) {
        const n = PASSIVES[id];
        if (!n) continue;
        for (const md of n.mods) out.push({ ...md, src: n.name });
    }
    for (const id of hero.ascNodes ?? []) {
        const n = ASC_NODES[id];
        if (!n || n.asc !== hero.asc) continue;
        for (const md of n.mods) out.push({ ...md, src: n.name });
    }
    return out;
}

// ---- ascendancy ---------------------------------------------------------------

export const ascPointsLeft = (hero: Hero) => (hero.ascPoints ?? 0) - (hero.ascNodes?.length ?? 0);

export function chooseAscendancy(state: GameState, id: string): string | null {
    const a = ASCENDANCIES[id];
    if (!a || a.cls !== state.hero.cls) return "not for this calling";
    if (state.hero.asc) return "already chosen";
    if ((state.hero.ascPoints ?? 0) <= 0) return "complete a trial first";
    state.hero.asc = id;
    state.hero.rev++;
    return null;
}

export function takeAscNode(state: GameState, id: string): string | null {
    const hero = state.hero;
    const n = ASC_NODES[id];
    if (!n || n.asc !== hero.asc) return "not in your ascendancy";
    if (hero.ascNodes.includes(id)) return "already taken";
    if (ascPointsLeft(hero) <= 0) return "no ascendancy points";
    hero.ascNodes.push(id);
    hero.rev++;
    return null;
}

export function canAllocate(hero: Hero, id: string): string | null {
    const n = PASSIVES[id];
    if (!n) return "unknown node";
    if (n.kind === "start") return "start nodes are free";
    if (hero.passives.includes(id)) return "already allocated";
    if (pointsLeft(hero) <= 0) return "no points left";
    const start = startNode(hero);
    const have = new Set(hero.passives);
    if (!n.links.some(l => l === start || have.has(l))) return "not connected";
    return null;
}

export function allocate(state: GameState, id: string): string | null {
    const err = canAllocate(state.hero, id);
    if (err) return err;
    state.hero.passives.push(id);
    state.hero.rev++;
    return null;
}

/** Ember dust to refund one node. */
export const refundCost = (hero: Hero) => 5 + hero.level * 2;

/** Would removing `id` leave every other allocated node connected to the start? */
export function canRefund(hero: Hero, id: string): boolean {
    if (!hero.passives.includes(id)) return false;
    const rest = new Set(hero.passives.filter(p => p !== id));
    const start = startNode(hero);
    const seen = new Set<string>();
    const queue = [start];
    while (queue.length) {
        const cur = queue.pop()!;
        for (const l of PASSIVES[cur]?.links ?? []) if (rest.has(l) && !seen.has(l)) { seen.add(l); queue.push(l); }
    }
    return seen.size === rest.size;
}

export function refund(state: GameState, id: string): string | null {
    if (!canRefund(state.hero, id)) return "other nodes depend on it";
    const cost = refundCost(state.hero);
    if (state.dust < cost) return `needs ${cost} ember dust`;
    state.dust -= cost;
    state.hero.passives = state.hero.passives.filter(p => p !== id);
    state.hero.rev++;
    return null;
}
