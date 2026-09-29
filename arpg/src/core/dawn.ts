// The Rekindling (round 5): with the three sun shards the hero can relight the
// sun. The March starts again one dawn later - a new hero on the shore - but
// what the hero has *collected* carries over: the relic case and codex,
// companions and their bond, echoes, the stone pouch, bought stash room,
// settings and totals, and one heirloom item.

import { CLASSES, DAWN_PERK, DAWN_TOUGHER, DAWN_RICHER, companionLevel } from "./data";
import { allShards } from "./echoes";
import { ECHOES_PER_POINT } from "./data";
import { newGame, pushLog, relicRollScore } from "./game";
import { hashSeed } from "./rng";
import { returnStones } from "./sockets";
import type { GameState } from "./state";
import { SLOTS, type Item } from "./types";
import type { MapEffects } from "./maps";

export const dawnOf = (s: GameState) => s.hero.dawn?.level ?? 0;
export const hasPerk = (s: GameState, id: string) => !!s.hero.dawn?.perks.includes(id);
/** Perk picks owed: one per dawn, and one for breaking the Hollow Crown. */
export const perksToPick = (s: GameState) => Math.max(0, dawnOf(s) + (s.hero.dawn?.crown ? 1 : 0) - (s.hero.dawn?.perks.length ?? 0));
/** Broke the Hollow Crown (in any dawn): the name Crownbreaker. */
export const crownbreaker = (s: GameState) => !!s.hero.dawn?.crown;

/** The Hollow Crown's first fall: one more perk pick for good, and the name Crownbreaker. */
export function crownFalls(s: GameState): void {
    if (!s.hero.dawn || s.hero.dawn.crown) return;
    s.hero.dawn.crown = true;
    pushLog(s, "boss", "log.crownFalls");
}

/** What relighting would carry over, for the confirmation. Heirloom candidates: gear in the stash or worn (not relics - they all stay). */
export function heirloomCandidates(s: GameState): Item[] {
    return [...SLOTS.map(k => s.hero.equipment[k]).filter((x): x is Item => !!x && !x.relic), ...s.stash.filter(x => !x.relic)];
}

/**
 * Relights the sun. The state object is rebuilt in place (the window keeps
 * its reference). `cls` picks the calling for the new dawn (default: the same).
 */
export function relightSun(s: GameState, opts: { heirloom?: number; cls?: string } = {}): string | null {
    if (!allShards(s)) return "needs the three sun shards";
    const cls = opts.cls && CLASSES[opts.cls] ? opts.cls : s.hero.cls;
    const dawn = dawnOf(s) + 1;
    const heir = opts.heirloom !== undefined ? heirloomCandidates(s).find(x => x.uid === opts.heirloom) : undefined;
    // Worn and stashed relics go back into the case (every relic stays): the better-rolled copy of
    // each, as the case always keeps. Everything left behind gives its stones back to the pouch (the
    // pouch is kept); the heirloom and the case's relics keep their own.
    const relics = [...s.relics];
    const left: Item[] = [];
    for (const it of [...SLOTS.map(k => s.hero.equipment[k]), ...s.stash]) {
        if (!it || it === heir) continue;
        if (!it.relic) { left.push(it); continue; }
        const i = relics.findIndex(x => x.relic === it.relic);
        if (i < 0) relics.push(it);
        else if (relicRollScore(it) > relicRollScore(relics[i]!)) { left.push(relics[i]!); relics[i] = it; }
        else left.push(it);
    }
    for (const it of left) returnStones(s, it);
    const fresh = newGame({ name: s.hero.name, cls, now: s.simTo, seed: hashSeed(s.seed, 0xda, dawn) });
    fresh.nextUid = Math.max(fresh.nextUid, s.nextUid);
    // The new starter weapon takes a fresh id: a kept item (an old starter as the heirloom) may hold its old one.
    fresh.hero.equipment.weapon!.uid = fresh.nextUid++;
    fresh.hero.dawn = { level: dawn, perks: [...(s.hero.dawn?.perks ?? [])], ...(s.hero.dawn?.crown ? { crown: true } : {}) };
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
    // The calendar goes on: the player's UTC offset, seasonal tallies and which events were announced.
    if (s.tz !== undefined) fresh.tz = s.tz;
    if (s.events) fresh.events = s.events;
    if (heir) { heir.locked = true; fresh.stash.push(heir); }
    // Echo atlas points stay earned.
    const echoPoints = Math.floor((s.echoes?.length ?? 0) / ECHOES_PER_POINT);
    fresh.atlas.points = echoPoints;
    fresh.world.rewards = [...Array.from({ length: echoPoints }, (_, i) => `echo:${i + 1}`), ...s.world.rewards.filter(r => r.startsWith("season:"))];
    for (const k of Object.keys(s) as (keyof GameState)[]) delete (s as unknown as Record<string, unknown>)[k];
    Object.assign(s, fresh);
    pushLog(s, "info", heir ? "log.sunRisesHeir" : "log.sunRises");
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

