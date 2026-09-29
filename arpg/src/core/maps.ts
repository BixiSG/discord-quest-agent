// Endgame logic: the map stash, map runs, the atlas and pinnacles.

import { MAX_LEVEL, ATLAS, CURRENCIES, MAP_AREAS, MAP_MODS, MAX_TIER, PINNACLES, depthMult, emptyAtlas, mapLevel, tierName, type AtlasEffects, type ZoneDef } from "./data";
import { Rng, hashSeed } from "./rng";
import { pushLog } from "./game";
import type { GameState, MapItem, RunMap } from "./state";
import { pinnacleEcho } from "./echoes";
import type { DamageType, Mod } from "./types";

/** The endgame opens once the Sunfall is cleared. */
export const endgameOpen = (state: GameState) => !!state.world.clears.a3_sunfall;

export function atlasEffects(state: GameState): AtlasEffects {
    const e = emptyAtlas();
    for (const id of state.atlas?.nodes ?? []) {
        const n = ATLAS[id];
        if (!n) continue;
        for (const [k, v] of Object.entries(n.eff)) e[k as keyof AtlasEffects] += v ?? 0;
    }
    return e;
}

export const atlasPointsLeft = (state: GameState) => state.atlas.points - state.atlas.nodes.length;

export function canTakeAtlas(state: GameState, id: string): string | null {
    const n = ATLAS[id];
    if (!n) return "unknown node";
    if (state.atlas.nodes.includes(id)) return "already taken";
    if (atlasPointsLeft(state) <= 0) return "no atlas points";
    if (!n.requires.every(r => state.atlas.nodes.includes(r))) return "take the node before it first";
    return null;
}

export function takeAtlas(state: GameState, id: string): string | null {
    const err = canTakeAtlas(state, id);
    if (err) return err;
    state.atlas.nodes.push(id);
    return null;
}

// ---- actions -------------------------------------------------------------------

/** Switch between story zones and maps. The current run finishes first only if it is a zone run. */
export function setMapMode(state: GameState, on: boolean): string | null {
    if (on && !endgameOpen(state)) return "clear the Sunfall first";
    const act = state.activity;
    if ((act.mode === "map") === on) return null;
    act.mode = on ? "map" : "zone";
    act.streak = 0; act.deaths = 0;
    // A running map is not refunded: switching takes effect on the next run.
    if (!act.run?.map) { act.runIndex++; act.run = null; }
    return null;
}

export function setMapTier(state: GameState, tier: number): string | null {
    if (!Number.isInteger(tier) || tier < 0) return "bad tier";
    state.activity.mapTier = tier;
    state.activity.autoCap = 0;
    state.activity.streak = 0;
    return null;
}

export function queuePinnacle(state: GameState, id: string): string | null {
    const p = PINNACLES[id];
    if (!p) return "unknown pinnacle";
    if ((state.sigils[p.sigil] ?? 0) < p.cost) return `needs ${p.cost} ${p.sigilName}s`;
    if (!endgameOpen(state)) return "clear the Sunfall first";
    state.activity.pinnacle = id;
    if (state.activity.mode !== "map") setMapMode(state, true);
    return null;
}

// ---- map items -----------------------------------------------------------------

function rollMods(rng: Rng, n: number, keep: string[] = []): string[] {
    const pool = Object.keys(MAP_MODS).filter(m => !keep.includes(m));
    const out = [...keep];
    while (out.length < keep.length + n && pool.length) out.push(pool.splice(rng.int(0, pool.length - 1), 1)[0]!);
    return out;
}

export function rollMap(rng: Rng, uid: number, tier: number): MapItem {
    const r = rng.next();
    const rarity: MapItem["rarity"] = r < 0.1 ? "rare" : r < 0.4 ? "enchanted" : "plain";
    const n = rarity === "rare" ? rng.int(3, 4) : rarity === "enchanted" ? rng.int(1, 2) : 0;
    const area = rng.pick(Object.keys(MAP_AREAS).sort());
    return { uid, tier: Math.max(1, tier), area, mods: rollMods(rng, n), rarity };
}

export function mapLabel(m: { tier: number; area: string }): string {
    return `${MAP_AREAS[m.area]?.name ?? m.area} (${tierName(m.tier)})`;
}

/** Map crafting with the same currency as items. */
export function craftMap(state: GameState, currency: string, uid: number): string | null {
    const m = state.maps.find(x => x.uid === uid);
    if (!m) return "map not found";
    if (!CURRENCIES[currency]) return "unknown currency";
    if ((state.currency[currency] ?? 0) <= 0) return `no ${CURRENCIES[currency]!.name} left`;
    const rng = new Rng(hashSeed(state.seed, 0x6d6170, state.craftSeq));
    switch (currency) {
        case "kindling": if (m.rarity !== "plain") return "needs a plain map"; m.rarity = "enchanted"; m.mods = rollMods(rng, rng.int(1, 2)); break;
        case "reshaper": if (m.rarity !== "enchanted") return "needs an enchanted map"; m.mods = rollMods(rng, rng.int(1, 2)); break;
        case "graft": if (m.rarity !== "enchanted" || m.mods.length >= 2) return "needs an enchanted map with one mod"; m.mods = rollMods(rng, 1, m.mods); break;
        case "crownseal": if (m.rarity !== "enchanted") return "needs an enchanted map"; m.rarity = "rare"; m.mods = rollMods(rng, 1, m.mods); break;
        case "forgeheart": if (m.rarity !== "plain") return "needs a plain map"; m.rarity = "rare"; m.mods = rollMods(rng, rng.int(3, 4)); break;
        case "tempest": if (m.rarity !== "rare") return "needs a rare map"; m.mods = rollMods(rng, rng.int(3, 4)); break;
        case "starfall": if (m.rarity !== "rare" || m.mods.length >= 5) return "needs a rare map with room"; m.mods = rollMods(rng, 1, m.mods); break;
        case "salt": if (m.rarity === "plain") return "already plain"; m.rarity = "plain"; m.mods = []; break;
        default: return "does nothing to maps";
    }
    state.craftSeq++;
    state.currency[currency]!--;
    return null;
}

/** Adds a dropped map; a full map stash keeps the higher tiers. */
export function addMap(state: GameState, m: MapItem): boolean {
    if (state.maps.length < state.mapCap) { state.maps.push(m); return true; }
    let low = 0;
    state.maps.forEach((x, i) => { if (x.tier < state.maps[low]!.tier) low = i; });
    if (state.maps[low]!.tier >= m.tier) return false;
    state.maps[low] = m;
    return true;
}

// ---- runs ------------------------------------------------------------------------

/** The tier auto-push keeps to for experience (0 = no cap). */
export function autoXpCap(state: GameState): number {
    const act = state.activity;
    if (!act.autoPush || act.mapTier > 0 || state.hero.level >= MAX_LEVEL) return 0;
    let t = 1;
    while (mapLevel(t + 1) <= state.hero.level + 4) t++;
    return t;
}

/** Takes the next map (or a queued pinnacle) out of the stash; the Outskirts when there is none. */
export function startMapRun(state: GameState): RunMap {
    const act = state.activity;
    const pin = act.pinnacle ? PINNACLES[act.pinnacle] : undefined;
    if (pin) {
        act.pinnacle = undefined;
        if ((state.sigils[pin.sigil] ?? 0) >= pin.cost) {
            state.sigils[pin.sigil]! -= pin.cost;
            pushLog(state, "zone", `The way to ${pin.name} opens.`);
            return { tier: MAX_TIER, area: "sunscar", mods: [], level: pin.level, pinnacle: pin.id };
        }
    }
    if (state.maps.length) {
        // Auto-push also keeps to tiers the hero can learn from (monster level at most hero level + 4).
        // Not over the player's own choice, and not at max level, where XP no longer matters.
        const xpCap = autoXpCap(state);
        const caps = [act.mapTier, act.autoCap ?? 0, xpCap].filter(t => t > 0);
        const want = caps.length ? Math.min(...caps) : 0;
        const sorted = [...state.maps].sort((a, b) => b.tier - a.tier || b.mods.length - a.mods.length || a.uid - b.uid);
        const pick = want > 0 ? (sorted.find(m => m.tier <= want) ?? sorted[sorted.length - 1]!) : sorted[0]!;
        state.maps.splice(state.maps.indexOf(pick), 1);
        // With only deeper maps held, the device dampens one to the cap rather than ignore it
        // (every map dropped deep again, and the hero died there on a loop).
        const tier = want > 0 ? Math.min(pick.tier, want) : pick.tier;
        return { tier, area: pick.area, mods: [...pick.mods], level: mapLevel(tier) };
    }
    return { tier: 0, area: "cinderfield", mods: [], level: mapLevel(0) };
}

export function mapZone(m: RunMap, atlas: AtlasEffects): ZoneDef {
    const area = MAP_AREAS[m.area] ?? MAP_AREAS.cinderfield!;
    if (m.pinnacle) {
        const p = PINNACLES[m.pinnacle]!;
        return { id: "map", act: 4, name: p.name, level: p.level, packs: 0, packSize: [0, 0], monsters: area.monsters, boss: p.boss, champion: 0, palette: p.palette };
    }
    const packs = m.mods.reduce((s, id) => s + (MAP_MODS[id]?.packs ?? 0), 0) + atlas.packs;
    return {
        id: "map", act: 4, name: `${area.name} - ${tierName(m.tier)}`, level: m.level,
        packs: Math.round((m.tier === 0 ? 6 : 8) * (1 + packs / 100)), packSize: [4, 6], monsters: area.monsters,
        ...(m.tier > 0 ? { boss: area.boss } : {}), champion: 0.2, palette: area.palette,
    };
}

export interface MapEffects {
    life: number;
    damage: number;
    speed: number;
    extra: [DamageType, number][];
    hero: Mod[];
    quantity: number;
    rarity: number;
}

const effCache = new WeakMap<RunMap, MapEffects>();
export function mapEffects(m: RunMap, atlas: AtlasEffects): MapEffects {
    const c = effCache.get(m);
    if (c) return c;
    const depth = depthMult(m.tier);
    const e: MapEffects = { life: depth, damage: depth, speed: 1, extra: [], hero: [], quantity: atlas.quantity, rarity: atlas.rarity };
    const reward = 1 + atlas.modEffect / 100;
    for (const id of m.mods) {
        const d = MAP_MODS[id];
        if (!d) continue;
        if (d.life) e.life *= 1 + d.life / 100;
        if (d.damage) e.damage *= 1 + d.damage / 100;
        if (d.speed) e.speed *= 1 + d.speed / 100;
        if (d.extra) e.extra.push(d.extra);
        if (d.hero) e.hero.push(...d.hero.map(x => ({ ...x, src: "Map" })));
        e.quantity += d.qty * reward;
        e.rarity += d.rarity * reward;
    }
    // The Depths reward their danger.
    if (m.tier > MAX_TIER) { e.quantity += (m.tier - MAX_TIER) * 3; e.rarity += (m.tier - MAX_TIER) * 4; }
    effCache.set(m, e);
    return e;
}

/** First completions give atlas points; pinnacles more. */
export function completeMap(state: GameState, m: RunMap): void {
    if (m.pinnacle) {
        const first = !state.pinnacleKills[m.pinnacle];
        state.pinnacleKills[m.pinnacle] = (state.pinnacleKills[m.pinnacle] ?? 0) + 1;
        if (first) { state.atlas.points += 2; pushLog(state, "boss", `${PINNACLES[m.pinnacle]!.name} is defeated: +2 atlas points.`); }
        // Its echo and its piece of the sun (the shard is the kill itself).
        pinnacleEcho(state, m.pinnacle);
        return;
    }
    if (m.tier > 0 && !state.atlas.tiers.includes(m.tier)) {
        state.atlas.tiers.push(m.tier);
        // Every tier up to 16 gives a point; past that, every fifth Depth.
        if (m.tier <= MAX_TIER || (m.tier - MAX_TIER) % 5 === 0) {
            state.atlas.points++;
            pushLog(state, "info", `${tierName(m.tier)} completed for the first time: +1 atlas point.`);
        }
    }
}

/** Tier of a map dropped in a run at `tier` (0 = Outskirts or act 3). */
export function dropTier(rng: Rng, tier: number, atlas: AtlasEffects): number {
    const base = Math.max(1, tier);
    return rng.chance((12 + atlas.upgrade) / 100) ? base + 1 : base;
}
