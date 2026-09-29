// Item generation and item stats. Pure: randomness comes from the Rng passed in.

import { Rng } from "./rng";
import { AFFIXES, AFFIX_ILVLS, BASES, RARE_NAMES_A, RARE_NAMES_B, RELICS, type AffixDef, type BaseDef, type DefenceStats, type RelicDef, type WeaponStats } from "./data";
import type { AffixRoll, DamageType, Item, Mod, Rarity } from "./types";

export const MAX_AFFIXES: Record<Rarity, { prefix: number; suffix: number }> = {
    plain: { prefix: 0, suffix: 0 },
    enchanted: { prefix: 1, suffix: 1 },
    rare: { prefix: 3, suffix: 3 },
    relic: { prefix: 0, suffix: 0 },
};

export function baseOf(item: Item): BaseDef {
    const b = BASES[item.base];
    if (!b) throw new Error("unknown base " + item.base);
    return b;
}

/** Domain tags an affix's `domains` are matched against. */
export function domainsOf(b: BaseDef): Set<string> {
    const d = new Set<string>([b.slot, b.kind]);
    if (b.weapon) {
        d.add("weapon");
        d.add(b.weapon.ranged ? "ranged" : "melee");
        if (b.kind === "staff" || b.kind === "wand") d.add("caster");
    }
    if (b.defence) {
        if (b.defence.armour) d.add("ar");
        if (b.defence.evasion) d.add("ev");
        if (b.defence.energyShield) d.add("es");
    }
    return d;
}

export function affixOf(a: AffixRoll): AffixDef {
    const def = AFFIXES[a.id];
    if (!def) throw new Error("unknown affix " + a.id);
    return def;
}

export function countAffixes(item: Item): { prefix: number; suffix: number } {
    let prefix = 0, suffix = 0;
    for (const a of item.affixes) affixOf(a).type === "prefix" ? prefix++ : suffix++;
    return { prefix, suffix };
}

/** Affixes that could be added to the item right now, with their best allowed tier. */
export function eligibleAffixes(item: Item, type?: "prefix" | "suffix"): AffixDef[] {
    const b = baseOf(item);
    const dom = domainsOf(b);
    const counts = countAffixes(item);
    const max = MAX_AFFIXES[item.rarity];
    const groups = new Set(item.affixes.map(a => affixOf(a).group));
    return Object.values(AFFIXES).filter(a =>
        (!type || a.type === type) &&
        counts[a.type] < max[a.type] &&
        !groups.has(a.group) &&
        a.tiers[0]!.ilvl <= item.ilvl &&
        a.domains.some(x => dom.has(x)));
}

export function rollTier(rng: Rng, def: AffixDef, ilvl: number): AffixRoll {
    const allowed = def.tiers.map((t, i) => ({ t, i })).filter(x => x.t.ilvl <= ilvl);
    // Higher tiers are rarer: weight halves per tier above the lowest allowed.
    const pick = rng.weighted(allowed, x => Math.pow(0.62, x.i)) ?? allowed[0]!;
    return { id: def.id, tier: pick.i, rolls: pick.t.ranges.map(([lo, hi]) => rng.int(lo, hi)) };
}

/** Adds one random affix; returns false when nothing fits. */
export function addRandomAffix(rng: Rng, item: Item, type?: "prefix" | "suffix"): boolean {
    const pool = eligibleAffixes(item, type);
    const def = rng.weighted(pool, a => a.weight);
    if (!def) return false;
    item.affixes.push(rollTier(rng, def, item.ilvl));
    return true;
}

export function rareName(rng: Rng): string {
    return `${rng.pick(RARE_NAMES_A)} ${rng.pick(RARE_NAMES_B)}`;
}

/** Fills an item's affixes for its rarity (clears existing ones). */
export function rollAffixes(rng: Rng, item: Item): void {
    item.affixes = [];
    if (item.rarity === "enchanted") {
        const n = rng.chance(0.55) ? 2 : 1;
        if (n === 2) { addRandomAffix(rng, item, "prefix"); addRandomAffix(rng, item, "suffix"); }
        else addRandomAffix(rng, item);
    } else if (item.rarity === "rare") {
        const n = rng.weighted([3, 4, 5, 6], x => [30, 40, 20, 10][x - 3]!)!;
        for (let i = 0; i < n; i++) addRandomAffix(rng, item);
        item.name = rareName(rng);
    }
}

export interface RollOpts {
    rarity?: Rarity;
    /** Percent increased rarity (item rarity stat, map mods). */
    rarityBonus?: number;
    base?: string;
    /** Restrict to these slots. */
    slots?: string[];
    /** Only bases up to this level (e.g. ones the hero can wear). */
    maxBaseLevel?: number;
}

export function pickRarity(rng: Rng, bonus = 0): Rarity {
    const m = 1 + bonus / 100;
    const rare = 0.08 * m, ench = 0.35 * Math.sqrt(m);
    const r = rng.next();
    if (r < rare) return "rare";
    if (r < rare + ench) return "enchanted";
    return "plain";
}

/** Bases that can drop at an item level: the newest tier of each kind weighs most. */
export function pickBase(rng: Rng, ilvl: number, slots?: string[], maxBaseLevel = ilvl): BaseDef {
    const pool = Object.values(BASES).filter(b => b.level <= Math.min(ilvl, maxBaseLevel) && (!slots || slots.includes(b.slot)));
    const b = rng.weighted(pool, x => (x.slot === "weapon" ? 0.7 : 1) * (ilvl - x.level < 14 ? 3 : 1));
    if (!b) throw new Error("no base for ilvl " + ilvl);
    return b;
}

export function rollItem(rng: Rng, uid: number, ilvl: number, opts: RollOpts = {}): Item {
    const base = opts.base ? BASES[opts.base] : pickBase(rng, ilvl, opts.slots, opts.maxBaseLevel);
    if (!base) throw new Error("unknown base " + opts.base);
    const item: Item = { uid, base: base.id, ilvl, rarity: opts.rarity ?? pickRarity(rng, opts.rarityBonus), affixes: [] };
    rollAffixes(rng, item);
    return item;
}

export function relicOf(item: Item): RelicDef | undefined {
    return item.relic ? RELICS[item.relic] : undefined;
}

/** A relic that can drop at this item level, or null when none can. */
export function rollRelic(rng: Rng, uid: number, ilvl: number): Item | null {
    const pool = Object.values(RELICS).filter(r => r.level <= ilvl);
    const def = rng.weighted(pool, r => r.weight);
    if (!def) return null;
    return { uid, base: def.base, ilvl, rarity: "relic", affixes: [], relic: def.id, relicRolls: def.mods.map(m => rng.int(m.range[0], m.range[1])) };
}

/** Relic mod lines for display. */
export function relicLines(item: Item): string[] {
    const def = relicOf(item);
    if (!def) return [];
    return def.mods.map((m, i) => m.text.replace("{0}", String(item.relicRolls?.[i] ?? m.range[0])));
}

// ---- stats -----------------------------------------------------------------

/** Every modifier an item contributes, split into local (item's own base) and global. */
export function rawMods(item: Item): Mod[] {
    const out: Mod[] = [];
    const b = baseOf(item);
    const src = itemLabel(item);
    for (const m of b.implicit ?? []) out.push({ ...m, src });
    const relic = item.relic ? RELICS[item.relic] : undefined;
    if (relic) relic.mods.forEach((m, i) => {
        const mod: Mod = { stat: m.stat, kind: m.kind, value: item.relicRolls?.[i] ?? m.range[0], src };
        if (m.tags) mod.tags = m.tags;
        out.push(mod);
    });
    for (const a of item.affixes) {
        const def = affixOf(a);
        def.mods.forEach((m, i) => {
            const mod: Mod = { stat: m.stat, kind: m.kind, value: a.rolls[i] ?? 0, src };
            if (m.tags) mod.tags = m.tags;
            out.push(mod);
        });
    }
    return out;
}

export interface ItemStats {
    weapon?: WeaponStats & { added: Partial<Record<DamageType, [number, number]>> };
    defence?: DefenceStats;
    /** Modifiers that apply to the hero. */
    global: Mod[];
}

/** Resolves local modifiers against the base and returns what the hero gets. */
export function itemStats(item: Item): ItemStats {
    const b = baseOf(item);
    const mods = rawMods(item);
    const local = (stat: string) => mods.filter(m => m.stat === stat).reduce((s, m) => s + m.value, 0);
    const out: ItemStats = { global: mods.filter(m => !m.stat.startsWith("local.")) };
    if (b.weapon) {
        const inc = 1 + (local("local.physInc") + (item.quality ?? 0)) / 100;
        const added: Partial<Record<DamageType, [number, number]>> = {};
        for (const t of ["fire", "cold", "lightning"] as const) {
            const lo = local(`local.addMin.${t}`), hi = local(`local.addMax.${t}`);
            if (lo || hi) added[t] = [lo, hi];
        }
        out.weapon = {
            ...b.weapon,
            phys: [Math.round((b.weapon.phys[0] + local("local.addMin.phys")) * inc), Math.round((b.weapon.phys[1] + local("local.addMax.phys")) * inc)],
            aps: Math.round(b.weapon.aps * (1 + local("local.attackSpeed") / 100) * 100) / 100,
            crit: Math.round(b.weapon.crit * (1 + local("local.critChance") / 100) * 100) / 100,
            added,
        };
    }
    if (b.defence) {
        const inc = 1 + (local("local.defInc") + (item.quality ?? 0)) / 100;
        const d = b.defence;
        out.defence = {
            armour: Math.round((d.armour + local("local.armour")) * inc),
            evasion: Math.round((d.evasion + local("local.evasion")) * inc),
            energyShield: Math.round((d.energyShield + local("local.energyShield")) * inc),
        };
        if (d.block) out.defence.block = d.block;
    }
    return out;
}

export function itemLabel(item: Item): string {
    const b = baseOf(item);
    if (item.relic) return RELICS[item.relic]?.name ?? b.name;
    if (item.rarity === "rare" && item.name) return item.name;
    if (item.rarity === "enchanted") {
        const p = item.affixes.find(a => affixOf(a).type === "prefix");
        const s = item.affixes.find(a => affixOf(a).type === "suffix");
        return [p ? affixOf(p).label : "", b.name, s ? affixOf(s).label : ""].filter(Boolean).join(" ");
    }
    return b.name;
}

/** Human text for one affix roll. */
export function affixText(a: AffixRoll): string {
    const def = affixOf(a);
    return def.text.replace(/\{(\d)\}/g, (_, i) => String(a.rolls[+i] ?? "?"));
}

/** Tier number as players read it: 1 is the best tier that exists. */
export function tierLabel(a: AffixRoll): number {
    return affixOf(a).tiers.length - a.tier;
}

/** Item level needed to roll a tier (for tooltips). */
export const tierIlvl = (i: number) => AFFIX_ILVLS[i] ?? 1;

/** Ember dust from salvaging. */
export function salvageValue(item: Item): number {
    // Crafted items salvage as plain, so currency can't be turned into dust.
    const r = item.crafted ? 1 : { plain: 1, enchanted: 3, rare: 8, relic: 20 }[item.rarity];
    return Math.max(1, Math.round(r * (1 + item.ilvl / 10)));
}

/** Level requirement: the base level, raised by high affix tiers. */
export function levelReq(item: Item): number {
    let req = baseOf(item).level;
    for (const a of item.affixes) req = Math.max(req, Math.floor((affixOf(a).tiers[a.tier]?.ilvl ?? 1) * 0.8));
    return Math.min(req, 90);
}
