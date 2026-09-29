// Checks a loaded or imported state before the game trusts it. Small damage
// (an unknown support, a stale zone) is repaired; anything structural throws.

import { AFFIXES, ASCENDANCIES, ASC_NODES, BASES, CLASSES, MONSTERS, PASSIVES, passivePoints, RELICS, SKILLS, SUPPORTS, ZONES } from "./data";
import { SaveError } from "./save";
import type { GameState } from "./state";
import { SLOTS, type Item } from "./types";
import { DEFAULT_FILTER, type FilterRule } from "./filter";
import { newTotals } from "./state";

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
    const rarity = strs(r.rarity, s => RARITIES.includes(s)); if (rarity?.length) out.rarity = rarity as FilterRule["rarity"];
    const slots = strs(r.slots); if (slots?.length) out.slots = slots;
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
    hero.ascNodes = Array.isArray(hero.ascNodes) ? hero.ascNodes.filter(id => ASC_NODES[id]?.asc === hero.asc).slice(0, hero.ascPoints) : [];
    hero.passives = cleanPassives(hero);
    obj(hero.equipment, "equipment");
    for (const k of Object.keys(hero.equipment)) {
        if (!(SLOTS as readonly string[]).includes(k)) throw new SaveError(`bad slot ${k}`);
        checkItem(hero.equipment[k as keyof typeof hero.equipment]);
    }
    if (!Array.isArray(s.stash)) throw new SaveError("bad stash");
    s.stash.forEach(checkItem);
    num(s.stashCap, "stash size", 1, 10000);
    num(s.dust, "dust", 0);
    s.currency = s.currency && typeof s.currency === "object" ? s.currency : {};
    for (const [k, v] of Object.entries(s.currency)) if (typeof v !== "number" || !Number.isFinite(v) || v < 0) delete s.currency[k];
    const world = obj(s.world, "world") as unknown as GameState["world"];
    world.unlocked = Array.isArray(world.unlocked) ? world.unlocked.filter(z => ZONES[z]) : [];
    if (!world.unlocked.length) world.unlocked = ["a1_shore"];
    world.clears = world.clears && typeof world.clears === "object" ? world.clears : {};
    world.storySeen = Array.isArray(world.storySeen) ? world.storySeen : [];
    const act = obj(s.activity, "activity") as unknown as GameState["activity"];
    if (!ZONES[act.zone] || !world.unlocked.includes(act.zone)) { act.zone = world.unlocked[world.unlocked.length - 1]!; act.run = null; }
    if (act.run && (!ZONES[act.run.zone] || !Array.isArray(act.run.monsters) || !act.run.hero || !Array.isArray(act.run.rng))) act.run = null;
    if (act.run && act.run.monsters.some(m => !m || !MONSTERS[m.def])) act.run = null;
    num(act.runIndex, "run index", 0);
    act.streak = Number.isFinite(act.streak) ? act.streak : 0;
    act.deaths = Number.isFinite(act.deaths) ? act.deaths : 0;
    act.acc = 0;
    const set = obj(s.settings, "settings") as unknown as GameState["settings"];
    if (!["plain", "enchanted", "rare"].includes(set.keep)) set.keep = "rare";
    set.autoEquip = set.autoEquip !== false;
    set.filter = Array.isArray(set.filter) ? set.filter.map(cleanRule).filter((r): r is FilterRule => !!r) : structuredClone(DEFAULT_FILTER);
    s.totals = s.totals && typeof s.totals === "object" ? { ...newTotals(), ...s.totals } : newTotals();
    s.craftSeq = Number.isFinite(s.craftSeq) ? s.craftSeq : 0;
    s.log = Array.isArray(s.log) ? s.log.slice(-60) : [];
    return s;
}
