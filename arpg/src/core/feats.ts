// Feats (round 8): progress is read from the state as it is, so a save from
// before feats existed earns what it already did the first time it loads.
// Earned feats live in state.feats and are kept across dawns; their renown is
// copied onto the hero (hero.renown) so the stat sheet stays a function of the
// hero, like the companion's level.

import { ACTS, COMPANIONS, COMPANION_MAX_LEVEL, FEATS, FEAT_ORDER, MAX_TIER, RELICS, parseStone, companionLevel, masteryLevel } from "./data";
import { crownbreaker, dawnOf } from "./dawn";
import { pushLog } from "./game";
import type { GameState } from "./state";
import { SLOTS, type Item } from "./types";
import { ref } from "../i18n/refs";

const clear = (s: GameState, zone: string) => ((s.world.clears[zone] ?? 0) > 0 ? 1 : 0);
/** Everything the player owns: worn, stashed and cased. */
const owned = (s: GameState): Item[] => [...SLOTS.map(k => s.hero.equipment[k]).filter((x): x is Item => !!x), ...s.stash, ...s.relics];
const deepestTier = (s: GameState) => Math.max(0, ...(s.atlas?.tiers ?? []));

/** How far along each feat is, in the units of its goal. */
const PROGRESS: Record<string, (s: GameState) => number> = {
    act1: s => clear(s, "a1_lock"),
    act2: s => clear(s, "a2_throne"),
    act3: s => clear(s, "a3_sunfall"),
    act4: s => clear(s, "a4_lamphouse"),
    trials: s => ACTS.filter(a => clear(s, a.trial)).length,
    level50: s => s.hero.level,
    level75: s => s.hero.level,
    level90: s => s.hero.level,
    kills10k: s => s.totals.kills,
    kills100k: s => s.totals.kills,
    kills1m: s => s.totals.kills,
    bosses100: s => s.totals.bosses ?? 0,
    bosses1000: s => s.totals.bosses ?? 0,
    lanterns: s => Object.values(s.events ?? {}).reduce((a, b) => a + b, 0),
    mastery: s => Math.max(0, ...Object.values(s.mastery ?? {}).map(masteryLevel)),
    relics10: s => Object.keys(s.codex).length,
    relics20: s => Object.keys(s.codex).length,
    relicsall: s => Object.keys(s.codex).filter(id => RELICS[id] && !RELICS[id]!.season).length,
    companions: s => Object.keys(s.companions).filter(id => COMPANIONS[id] && !COMPANIONS[id]!.season).length,
    bond: s => Math.max(0, ...Object.values(s.companions).map(b => Math.min(COMPANION_MAX_LEVEL, companionLevel(b)))),
    echoes: s => s.echoes.length,
    radiant: s => (Object.keys(s.stones).some(k => parseStone(k)?.tier === 4) || owned(s).some(it => it.stones?.some(k => k && parseStone(k)?.tier === 4)) ? 1 : 0),
    hone: s => Math.max(0, ...owned(s).map(it => it.quality ?? 0)),
    temper: s => Math.max(0, ...owned(s).map(it => it.tempered ?? 0)),
    contracts25: s => s.totals.contracts ?? 0,
    contracts100: s => s.totals.contracts ?? 0,
    salvage: s => s.totals.salvaged,
    dust: s => s.totals.dust,
    tier8: s => Math.min(MAX_TIER, deepestTier(s)),
    tier16: s => Math.min(MAX_TIER, deepestTier(s)),
    depth10: s => Math.max(0, deepestTier(s) - MAX_TIER),
    depth25: s => Math.max(0, deepestTier(s) - MAX_TIER),
    drownedsun: s => ((s.pinnacleKills.drownedsun ?? 0) > 0 ? 1 : 0),
    glasschoir: s => ((s.pinnacleKills.glasschoir ?? 0) > 0 ? 1 : 0),
    ashenking: s => ((s.pinnacleKills.ashenking ?? 0) > 0 ? 1 : 0),
    dawn1: s => dawnOf(s),
    dawn3: s => dawnOf(s),
    crown: s => (crownbreaker(s) ? 1 : 0),
};

/** A feat's progress, capped at its goal (the goal itself once it is earned). */
export function featProgress(s: GameState, id: string): number {
    const def = FEATS[id];
    if (!def) return 0;
    if (s.feats.includes(id)) return def.goal;
    return Math.min(def.goal, Math.max(0, PROGRESS[id]?.(s) ?? 0));
}

/** Renown from the feats earned. */
export const renownOf = (feats: readonly string[]) => feats.reduce((a, id) => a + (FEATS[id]?.renown ?? 0), 0);

/**
 * Earns every feat whose goal is met. Each is written to the chronicle, unless
 * `quiet` (a save loading for the first time since feats existed: one line
 * for all of them instead). A title earned while none is worn goes on.
 * Keeps hero.renown in step. Returns the feats earned now.
 */
export function checkFeats(s: GameState, opts: { quiet?: boolean; onFeat?: (id: string) => void } = {}): string[] {
    s.feats ??= [];
    const earned: string[] = [];
    for (const id of FEAT_ORDER) {
        if (s.feats.includes(id)) continue;
        const def = FEATS[id]!;
        if ((PROGRESS[id]?.(s) ?? 0) < def.goal) continue;
        s.feats.push(id);
        earned.push(id);
        if (!opts.quiet) pushLog(s, "info", "log.featEarned", { feat: ref.feat(id), n: def.renown });
        opts.onFeat?.(id);
    }
    if (earned.length) {
        // A newly earned title is worn when none is; on load, the latest titled feat of the list.
        const titled = earned.filter(id => FEATS[id]!.title);
        if (!s.title && titled.length) s.title = titled[titled.length - 1];
        if (opts.quiet) pushLog(s, "info", "log.featsBefore", { n: earned.length, renown: renownOf(earned) });
    }
    const renown = renownOf(s.feats);
    if ((s.hero.renown ?? 0) !== renown) {
        if (renown) s.hero.renown = renown; else delete s.hero.renown;
        s.hero.rev++;
    }
    return earned;
}

/** Wears a title (a titled feat earned), or none with null. */
export function setTitle(s: GameState, id: string | null): string | null {
    if (id === null) { delete s.title; return null; }
    const def = FEATS[id];
    if (!def?.title) return "not a title";
    if (!s.feats.includes(id)) return "not earned yet";
    s.title = id;
    return null;
}
