// The Rekindling (round 5): with all four sun shards the hero can relight the
// sun. The March starts again one dawn later - a new hero on the shore - but
// what the hero has *collected* carries over: the relic case and codex,
// companions and their bond, echoes, the stone pouch, bought stash room,
// settings and totals, and one heirloom item.

import { CLASSES, DAWN_PERK, DAWN_TOUGHER, DAWN_RICHER, companionLevel } from "./data";
import { allShards } from "./echoes";
import { ECHOES_PER_POINT } from "./data";
import { newGame, pushLog } from "./game";
import { hashSeed } from "./rng";
import type { GameState } from "./state";
import { SLOTS, type Item } from "./types";
import type { MapEffects } from "./maps";

export const dawnOf = (s: GameState) => s.hero.dawn?.level ?? 0;
export const hasPerk = (s: GameState, id: string) => !!s.hero.dawn?.perks.includes(id);
/** Perk picks owed: one per dawn. */
export const perksToPick = (s: GameState) => Math.max(0, dawnOf(s) - (s.hero.dawn?.perks.length ?? 0));

/** What relighting would carry over, for the confirmation. Heirloom candidates: gear in the stash or worn (not relics - they all stay). */
export function heirloomCandidates(s: GameState): Item[] {
    return [...SLOTS.map(k => s.hero.equipment[k]).filter((x): x is Item => !!x && !x.relic), ...s.stash.filter(x => !x.relic)];
}

/**
 * Relights the sun. The state object is rebuilt in place (the window keeps
 * its reference). `cls` picks the calling for the new dawn (default: the same).
 */
export function relightSun(s: GameState, opts: { heirloom?: number; cls?: string } = {}): string | null {
    if (!allShards(s)) return "needs all four sun shards";
    const cls = opts.cls && CLASSES[opts.cls] ? opts.cls : s.hero.cls;
    const dawn = dawnOf(s) + 1;
    const heir = opts.heirloom !== undefined ? heirloomCandidates(s).find(x => x.uid === opts.heirloom) : undefined;
    // Worn relics go back into the case (all relics stay); the case keeps the better copy.
    const relics = [...s.relics];
    for (const k of SLOTS) {
        const it = s.hero.equipment[k];
        if (!it?.relic) continue;
        const old = relics.find(x => x.relic === it.relic);
        if (!old) relics.push(it);
    }
    const fresh = newGame({ name: s.hero.name, cls, now: s.simTo, seed: hashSeed(s.seed, 0xda, dawn) });
    fresh.nextUid = Math.max(fresh.nextUid, s.nextUid);
    fresh.hero.dawn = { level: dawn, perks: [...(s.hero.dawn?.perks ?? [])] };
    fresh.hero.bonusPoints = dawn;
    if (s.hero.pet && s.companions[s.hero.pet.id] !== undefined) fresh.hero.pet = { id: s.hero.pet.id, level: companionLevel(s.companions[s.hero.pet.id]!) };
    fresh.relics = relics;
    fresh.codex = s.codex;
    fresh.companions = s.companions;
    fresh.echoes = s.echoes;
    fresh.stones = s.stones;
    fresh.shrine = s.shrine;
    fresh.settings = s.settings;
    fresh.totals = s.totals;
    fresh.stashCap = s.stashCap;
    fresh.craftSeq = s.craftSeq;
    if (heir) { heir.locked = true; fresh.stash.push(heir); }
    // Echo atlas points stay earned.
    const echoPoints = Math.floor((s.echoes?.length ?? 0) / ECHOES_PER_POINT);
    fresh.atlas.points = echoPoints;
    fresh.world.rewards = Array.from({ length: echoPoints }, (_, i) => `echo:${i + 1}`);
    for (const k of Object.keys(s) as (keyof GameState)[]) delete (s as unknown as Record<string, unknown>)[k];
    Object.assign(s, fresh);
    pushLog(s, "info", `The sun rises over the March. ${heir ? "An heirloom came with you." : ""}`.trim());
    return null;
}

/** Takes the dawn perk owed (one per dawn). */
export function chooseDawnPerk(s: GameState, id: string): string | null {
    if (!DAWN_PERK[id]) return "unknown perk";
    if (!perksToPick(s)) return "no pick waiting";
    if (s.hero.dawn!.perks.includes(id)) return "already chosen";
    s.hero.dawn!.perks.push(id);
    if (id === "deeppockets") s.stashCap += 20;
    s.hero.rev++;
    return null;
}

/** The world a dawn later: tougher monsters, richer drops, on top of any map's own mods. */
const wrapped = new WeakMap<object, { dawn: number; base: MapEffects | null; eff: MapEffects }>();
export function dawnEffects(s: GameState, key: object, base: MapEffects | null): MapEffects | null {
    const d = dawnOf(s);
    if (!d) return base;
    const c = wrapped.get(key);
    if (c && c.dawn === d && c.base === base) return c.eff;
    const b = base ?? { life: 1, damage: 1, speed: 1, extra: [], hero: [], quantity: 0, rarity: 0 };
    const eff: MapEffects = { ...b, life: b.life * (1 + (DAWN_TOUGHER * d) / 100), damage: b.damage * (1 + (DAWN_TOUGHER * d) / 100),
        quantity: b.quantity + DAWN_RICHER * d, rarity: b.rarity + DAWN_RICHER * d };
    wrapped.set(key, { dawn: d, base, eff });
    return eff;
}

