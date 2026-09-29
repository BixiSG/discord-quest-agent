// Checks a loaded or imported state before the game trusts it. Small damage
// (an unknown support, a stale zone) is repaired; anything structural throws.

import { COMPANIONS, ECHOES, companionLevel, parseStone, ATLAS, MAP_AREAS, MAP_MODS, PINNACLES, AFFIXES, ASCENDANCIES, ASC_NODES, BASES, CLASSES, MONSTERS, PASSIVES, passivePoints, RELICS, SKILLS, SUPPORTS, ZONES } from "./data";
import { SaveError } from "./save";
import type { GameState } from "./state";
import { SLOTS, type Item } from "./types";
import { DEFAULT_FILTER, type FilterRule } from "./filter";
import { newTotals } from "./state";
import { reconcileRewards } from "./sim/engine";
import { relicRollScore } from "./game";
import { cleanContracts } from "./contracts";
import { BLESSING } from "./shrine";
import { fitStones, socketCap } from "./sockets";
import { endgameOpen } from "./maps";

const num = (v: unknown, what: string, min = -Infinity, max = Infinity): number => {
    if (typeof v !== "number" || !Number.isFinite(v) || v < min || v > max) throw new SaveError(`bad ${what}`);
    return v;
};
const obj = (v: unknown, what: string): Record<string, unknown> => {
    if (!v || typeof v !== "object" || Array.isArray(v)) throw new SaveError(`missing ${what}`);
    return v as Record<string, unknown>;
};

function checkItem(it: unknown): Item {
    const i = obj(it, "item") as unknown as Item;
    num(i.uid, "item id"); num(i.ilvl, "item level", 1, 1000);
    if (!BASES[i.base]) throw new SaveError(`unknown item base ${String(i.base)}`);
    if (!["plain", "enchanted", "rare", "relic"].includes(i.rarity)) throw new SaveError("bad rarity");
    if (!Array.isArray(i.affixes)) throw new SaveError("bad affixes");
    for (const a of i.affixes) {
        const def = AFFIXES[a?.id];
        if (!def || !def.tiers[a.tier] || !Array.isArray(a.rolls) || a.rolls.length !== def.mods.length) throw new SaveError(`bad affix ${String(a?.id)}`);
        a.rolls.forEach((r: unknown) => num(r, "affix roll"));
    }
    for (const a of i.affixes) {
        const t = AFFIXES[a.id]!.tiers[a.tier]!;
        a.rolls = a.rolls.map((r: number, k: number) => Math.min(t.ranges[k]![1], Math.max(t.ranges[k]![0], Math.round(r))));
    }
    if (i.rarity === "relic") {
        const def = i.relic ? RELICS[i.relic] : undefined;
        if (!def) throw new SaveError(`unknown relic ${String(i.relic)}`);
        if (!Array.isArray(i.relicRolls) || i.relicRolls.length !== def.mods.length) throw new SaveError("bad relic rolls");
        i.relicRolls = i.relicRolls.map((r, k) => { num(r, "relic roll"); const [lo, hi] = def.mods[k]!.range; return Math.min(hi, Math.max(lo, Math.round(r))); });
        if (i.affixes.length) throw new SaveError("relic with affixes");
    } else if (i.relic !== undefined || i.relicRolls !== undefined) throw new SaveError("relic data on a non-relic item");
    if (i.locked !== true) delete i.locked;
    // Sockets (v7): within the item's cap, stones known or empty.
    if (i.sockets !== undefined || i.stones !== undefined) {
        const n = Number.isInteger(i.sockets) ? Math.max(0, Math.min(socketCap(i), i.sockets!)) : 0;
        i.sockets = n;
        i.stones = Array.isArray(i.stones) ? i.stones.map(k => (typeof k === "string" && parseStone(k) ? k : null)) : [];
        fitStones(i);
    }
    if (i.quality !== undefined) {
        const q = Number.isFinite(i.quality) ? Math.max(0, Math.min(20, Math.round(i.quality))) : 0;
        if (q) i.quality = q; else delete i.quality;
    }
    // One benched affix at most: extra marks are dropped (the affix stays as a normal one).
    let benched = false;
    for (const a of i.affixes) {
        if (a.bench !== true) { delete a.bench; continue; }
        if (benched) delete a.bench;
        benched = true;
    }
    return i;
}

const RARITIES = ["plain", "enchanted", "rare", "relic"];
const strs = (v: unknown, ok?: (s: string) => boolean) => Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && (!ok || ok(x))) : undefined;
const pos = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v > 0 ? Math.round(v) : undefined);

function cleanRule(v: unknown): FilterRule | null {
    if (!v || typeof v !== "object") return null;
    const r = v as Record<string, unknown>;
    if (r.action !== "keep" && r.action !== "salvage") return null;
    const out: FilterRule = { on: r.on !== false, action: r.action };
    // A condition that was set but holds nothing valid would widen the rule to match everything: drop the rule instead.
    if (r.rarity !== undefined) { const rarity = strs(r.rarity, s => RARITIES.includes(s)); if (!rarity?.length) return null; out.rarity = rarity as FilterRule["rarity"]; }
    if (r.slots !== undefined) { const slots = strs(r.slots); if (!slots?.length) return null; out.slots = slots; }
    const minIlvl = pos(r.minIlvl); if (minIlvl) out.minIlvl = minIlvl;
    const behind = pos(r.behind); if (behind) out.behind = behind;
    const minAffixes = pos(r.minAffixes); if (minAffixes) out.minAffixes = minAffixes;
    if (typeof r.group === "string") out.group = r.group;
    return out;
}

/** Known, unique, connected to the class start, and within the point budget. */
function cleanPassives(hero: GameState["hero"]): string[] {
    const wanted = new Set(strs(hero.passives, id => !!PASSIVES[id] && PASSIVES[id]!.kind !== "start") ?? []);
    const start = CLASSES[hero.cls]!.startNode;
    const kept: string[] = [];
    const seen = new Set([start]);
    const queue = [start];
    while (queue.length) {
        for (const l of PASSIVES[queue.shift()!]?.links ?? []) {
            if (wanted.has(l) && !seen.has(l)) { seen.add(l); kept.push(l); queue.push(l); }
        }
    }
    return kept.slice(0, Math.max(0, passivePoints(hero.level, hero.bonusPoints)));
}

/** Throws SaveError when unusable; repairs small problems in place. */
export function validateState(raw: unknown): GameState {
    const s = obj(raw, "state") as unknown as GameState;
    num(s.seed, "seed"); num(s.simTo, "time"); num(s.nextUid, "item counter", 0);
    const hero = obj(s.hero, "hero") as unknown as GameState["hero"];
    if (!CLASSES[hero.cls]) throw new SaveError(`unknown class ${String(hero.cls)}`);
    if (typeof hero.name !== "string") throw new SaveError("bad name");
    num(hero.level, "level", 1, 100); num(hero.xp, "xp", 0); num(hero.rev, "revision");
    hero.bonusPoints = typeof hero.bonusPoints === "number" && Number.isFinite(hero.bonusPoints) ? hero.bonusPoints : 0;
    if (!SKILLS[hero.skill]) hero.skill = CLASSES[hero.cls]!.startSkill;
    hero.supports = Array.isArray(hero.supports) ? hero.supports.filter(id => SUPPORTS[id]) : [];
    hero.ascPoints = typeof hero.ascPoints === "number" && Number.isFinite(hero.ascPoints) ? hero.ascPoints : 0;
    if (hero.asc && (!ASCENDANCIES[hero.asc] || ASCENDANCIES[hero.asc]!.cls !== hero.cls)) delete hero.asc;
    hero.ascNodes = hero.asc && Array.isArray(hero.ascNodes) ? [...new Set(hero.ascNodes.filter(id => ASC_NODES[id]?.asc === hero.asc))].slice(0, hero.ascPoints) : [];
    hero.passives = cleanPassives(hero);
    obj(hero.equipment, "equipment");
    for (const k of Object.keys(hero.equipment)) {
        if (!(SLOTS as readonly string[]).includes(k)) throw new SaveError(`bad slot ${k}`);
        checkItem(hero.equipment[k as keyof typeof hero.equipment]);
    }
    if (!Array.isArray(s.stash)) throw new SaveError("bad stash");
    s.stash.forEach(checkItem);
    // The relic case holds relics only, the better-rolled copy of each; the rest go to the stash.
    const inCase = Array.isArray(s.relics) ? s.relics : [];
    inCase.forEach(checkItem);
    s.relics = [];
    for (const it of inCase) {
        if (it.rarity !== "relic") { s.stash.push(it); continue; }
        const old = s.relics.find(x => x.relic === it.relic);
        if (!old) s.relics.push(it);
        else if (relicRollScore(it) > relicRollScore(old)) { s.relics[s.relics.indexOf(old)] = it; s.stash.push(old); }
        else s.stash.push(it);
    }
    num(s.stashCap, "stash size", 1, 10000);
    num(s.dust, "dust", 0);
    s.currency = s.currency && typeof s.currency === "object" ? s.currency : {};
    for (const [k, v] of Object.entries(s.currency)) if (typeof v !== "number" || !Number.isFinite(v) || v < 0) delete s.currency[k];
    const world = obj(s.world, "world") as unknown as GameState["world"];
    world.unlocked = Array.isArray(world.unlocked) ? world.unlocked.filter(z => ZONES[z]) : [];
    if (!world.unlocked.length) world.unlocked = ["a1_shore"];
    world.clears = world.clears && typeof world.clears === "object" ? world.clears : {};
    world.storySeen = Array.isArray(world.storySeen) ? world.storySeen : [];
    world.rewards = strs(world.rewards) ?? [];
    world.trialTry = Object.fromEntries(Object.entries(world.trialTry && typeof world.trialTry === "object" ? world.trialTry : {})
        .filter(([k, v]) => ZONES[k]?.trial && typeof v === "number" && Number.isFinite(v)));
    const act = obj(s.activity, "activity") as unknown as GameState["activity"];
    if (!ZONES[act.zone] || !world.unlocked.includes(act.zone)) { act.zone = world.unlocked[world.unlocked.length - 1]!; act.run = null; }
    if (act.run && ((!act.run.map && !ZONES[act.run.zone]) || !Array.isArray(act.run.monsters) || !act.run.hero || !Array.isArray(act.run.rng))) act.run = null;
    if (act.run && act.run.monsters.some(m => !m || !MONSTERS[m.def])) act.run = null;
    num(act.runIndex, "run index", 0);
    act.streak = Number.isFinite(act.streak) ? act.streak : 0;
    act.deaths = Number.isFinite(act.deaths) ? act.deaths : 0;
    act.acc = 0;
    const set = obj(s.settings, "settings") as unknown as GameState["settings"];
    if (!["plain", "enchanted", "rare"].includes(set.keep)) set.keep = "rare";
    set.autoEquip = set.autoEquip !== false;
    set.filter = Array.isArray(set.filter) ? set.filter.map(cleanRule).filter((r): r is FilterRule => !!r) : structuredClone(DEFAULT_FILTER);
    set.upkeep = set.upkeep !== false;
    set.autoStones = set.autoStones !== false;
    // ---- endgame (v4)
    if (act.mode !== "map" || !endgameOpen(s)) act.mode = "zone";
    if (!endgameOpen(s)) delete act.pinnacle;
    act.autoCap = Number.isInteger(act.autoCap) && act.autoCap! > 0 ? act.autoCap : 0;
    act.capBackoff = Number.isInteger(act.capBackoff) ? Math.max(0, Math.min(3, act.capBackoff!)) : 0;
    act.mapTier = Number.isInteger(act.mapTier) && act.mapTier >= 0 ? act.mapTier : 0;
    if (act.pinnacle !== undefined && !PINNACLES[act.pinnacle]) delete act.pinnacle;
    if (act.run?.map) {
        const m = act.run.map;
        if (!MAP_AREAS[m.area] || !Array.isArray(m.mods) || m.mods.some(x => !MAP_MODS[x]) || !Number.isFinite(m.tier) || !Number.isFinite(m.level)
            || (m.pinnacle !== undefined && !PINNACLES[m.pinnacle])) act.run = null;
    }
    s.maps = Array.isArray(s.maps) ? s.maps.filter(m => m && Number.isFinite(m.uid) && Number.isInteger(m.tier) && m.tier >= 1 && MAP_AREAS[m.area]
        && Array.isArray(m.mods) && m.mods.every(x => MAP_MODS[x]) && ["plain", "enchanted", "rare"].includes(m.rarity)) : [];
    s.mapCap = Number.isInteger(s.mapCap) && s.mapCap > 0 ? s.mapCap : 40;
    const atlas = s.atlas && typeof s.atlas === "object" ? s.atlas : { points: 0, nodes: [], tiers: [] };
    atlas.points = Number.isFinite(atlas.points) && atlas.points >= 0 ? atlas.points : 0;
    atlas.tiers = Array.isArray(atlas.tiers) ? [...new Set(atlas.tiers.filter(t => Number.isInteger(t) && t >= 1))] : [];
    const nodes: string[] = [];
    for (const id of Array.isArray(atlas.nodes) ? atlas.nodes : []) {
        if (ATLAS[id] && !nodes.includes(id) && ATLAS[id]!.requires.every(r => nodes.includes(r)) && nodes.length < atlas.points) nodes.push(id);
    }
    atlas.nodes = nodes;
    s.atlas = atlas;
    const counts = (o: unknown) => Object.fromEntries(Object.entries(o && typeof o === "object" ? o : {}).filter(([, v]) => typeof v === "number" && Number.isFinite(v) && v >= 0)) as Record<string, number>;
    s.sigils = counts(s.sigils);
    s.pinnacleKills = counts(s.pinnacleKills);
    // Companions: known ids, whole non-negative bond; the one out must be owned, its level from its bond.
    s.companions = Object.fromEntries(Object.entries(counts(s.companions)).filter(([k]) => COMPANIONS[k]).map(([k, v]) => [k, Math.floor(v)]));
    if (hero.pet && (!hero.pet.id || s.companions[hero.pet.id] === undefined)) delete hero.pet;
    else if (hero.pet) hero.pet = { id: hero.pet.id, level: companionLevel(s.companions[hero.pet.id]!) };
    // Echoes (v7): known, once each.
    s.echoes = [...new Set(strs(s.echoes, id => !!ECHOES[id]) ?? [])];
    // Stone pouch (v7): known stones, whole counts.
    s.stones = Object.fromEntries(Object.entries(counts(s.stones)).filter(([k, v]) => parseStone(k) && v >= 1).map(([k, v]) => [k, Math.floor(v)]));
    // Market (v7): offers must be sound, else the stock is rolled again on the next tick.
    const mk = s.market && typeof s.market === "object" ? s.market : ({} as GameState["market"]);
    const okGear = (o: unknown) => { try { const x = o as { item: Item; price: number }; checkItem(x.item); return Number.isFinite(x.price) && x.price > 0; } catch { return false; } };
    s.market = {
        seq: Number.isInteger(mk.seq) && mk.seq >= 0 ? mk.seq : 0,
        rolledAt: Number.isFinite(mk.rolledAt) ? mk.rolledAt : 0,
        refreshes: Number.isInteger(mk.refreshes) && mk.refreshes >= 0 ? mk.refreshes : 0,
        pedlar: Array.isArray(mk.pedlar) && mk.pedlar.every(okGear) ? mk.pedlar.map(o => ({ item: o.item, price: o.price, ...(o.sold ? { sold: true } : {}) })) : [],
        jeweller: Array.isArray(mk.jeweller) && mk.jeweller.every(o => o && parseStone(o.key) && Number.isFinite(o.price)) ? mk.jeweller.map(o => ({ key: o.key, price: o.price, ...(o.sold ? { sold: true } : {}) })) : [],
    };
    // Shrine: known blessings with a finite end time; kept-up ones must be known.
    s.blessings = Object.fromEntries(Object.entries(counts(s.blessings)).filter(([k]) => BLESSING[k]));
    const shr = s.shrine && typeof s.shrine === "object" ? s.shrine : { keep: [], orbs: true };
    s.shrine = { keep: [...new Set(strs(shr.keep, k => !!BLESSING[k]) ?? [])], orbs: shr.orbs !== false };
    s.codex = Object.fromEntries(Object.entries(counts(s.codex)).filter(([k, v]) => RELICS[k] && v >= 1).map(([k, v]) => [k, Math.round(v)]));
    s.totals = s.totals && typeof s.totals === "object" ? { ...newTotals(), ...s.totals } : newTotals();
    s.craftSeq = Number.isFinite(s.craftSeq) ? s.craftSeq : 0;
    s.log = Array.isArray(s.log) ? s.log.slice(-60) : [];
    reconcileRewards(s);
    cleanContracts(s);
    return s;
}
