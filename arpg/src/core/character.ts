// Derives the hero's stat sheet from state (COMBAT.md sections 3-8).
// Never saved; recomputed when hero.rev changes.

import { StatBag, tagSet } from "./stats";
import { BASES, CLASSES, SKILLS, SUPPORTS, SUPPORT_SLOT_LEVELS, companionMod, heroBaseAccuracy, heroBaseLife, heroBaseMana, monsterDamage, monsterDefence, spellScale, type SkillDef } from "./data";
import { itemStats, levelReq } from "./items";
import { passiveMods } from "./passives";
import type { Hero } from "./state";
import { DAMAGE_TYPES, ELEMENTS, SLOTS, type DamageType, type Mod } from "./types";

export type Ranges = Record<DamageType, [number, number]>;

export interface SkillCalc {
    id: string;
    name: string;
    kind: "attack" | "spell";
    shape: SkillDef["shape"];
    fx: SkillDef["fx"];
    tags: string[];
    /** Per-hit damage per type after increases and more multipliers. */
    hit: Ranges;
    avgHit: number;
    critChance: number;
    critMulti: number;
    /** Uses per second the skill's speed allows. */
    speed: number;
    /** Uses per second mana regeneration can pay for (Infinity when free). */
    sustain: number;
    hitChance: number;
    accuracy: number;
    targets: number;
    manaCost: number;
    leech: number;
    pen: Record<DamageType, number>;
    /** Expected damage per second against one target of the hero's level. */
    dps: number;
    /** dps times targets. */
    packDps: number;
    supports: string[];
}

export interface Sheet {
    level: number;
    str: number; dex: number; int: number;
    life: number; mana: number; es: number;
    lifeRegen: number; manaRegen: number;
    armour: number; evasion: number; block: number;
    res: Record<DamageType, number>;
    resRaw: Record<DamageType, number>;
    maxRes: Record<DamageType, number>;
    moveSpeed: number;
    flaskHeal: number;
    flaskCharges: number;
    lifeOnKill: number;
    rarity: number;
    quantity: number;
    xpGain: number;
    dmgTaken: number;
    skill: SkillCalc;
    ehp: Record<DamageType, number>;
    problems: string[];
    bag: StatBag;
}

/** Share of run time spent fighting (the rest is travel), measured with the sim. */
export const FIGHT_SHARE = 0.6;
export const UNARMED = { phys: [2, 5] as [number, number], aps: 1.2, crit: 5 };

export function supportSlots(level: number): number {
    return SUPPORT_SLOT_LEVELS.filter(l => l <= level).length;
}

/** The companion at the hero's side: its one bonus. */
function petMods(hero: Hero): Mod[] {
    const m = hero.pet ? companionMod(hero.pet.id, hero.pet.level) : null;
    return m ? [m] : [];
}

/** Everything that modifies the hero, except the skill and its supports. */
export function heroMods(hero: Hero, extra: Mod[] = []): { mods: Mod[]; armour: number; evasion: number; es: number; block: number; problems: string[] } {
    const cls = CLASSES[hero.cls];
    if (!cls) throw new Error("unknown class " + hero.cls);
    const mods: Mod[] = [...extra, ...passiveMods(hero), ...petMods(hero)];
    let armour = 0, evasion = 0, es = 0, block = 0;
    const problems: string[] = [];
    mods.push({ stat: "str", kind: "flat", value: cls.str, src: cls.name });
    mods.push({ stat: "dex", kind: "flat", value: cls.dex, src: cls.name });
    mods.push({ stat: "int", kind: "flat", value: cls.int, src: cls.name });
    for (const slot of SLOTS) {
        const it = hero.equipment[slot];
        if (!it) continue;
        if (levelReq(it) > hero.level) { problems.push(`${slot}: needs level ${levelReq(it)}`); continue; }
        const st = itemStats(it);
        mods.push(...st.global);
        if (st.defence) {
            armour += st.defence.armour; evasion += st.defence.evasion; es += st.defence.energyShield;
            block += st.defence.block ?? 0;
        }
    }
    return { mods, armour, evasion, es, block, problems };
}

function zeroes(): Record<DamageType, number> { return { phys: 0, fire: 0, cold: 0, lightning: 0, chaos: 0 }; }
function zeroRanges(): Ranges { return { phys: [0, 0], fire: [0, 0], cold: [0, 0], lightning: [0, 0], chaos: [0, 0] }; }

export function armourReduction(armour: number, hit: number): number {
    if (hit <= 0) return 0;
    return Math.min(0.85, armour / (armour + 8 * hit));
}
export function hitChance(acc: number, eva: number): number {
    if (acc + eva <= 0) return 1;
    return Math.min(1, Math.max(0.05, (1.5 * acc) / (acc + eva)));
}

export function deriveSheet(hero: Hero, extra: Mod[] = []): Sheet {
    const base = heroMods(hero, extra);
    const bag = new StatBag(base.mods);
    const problems = [...base.problems];
    const cls = CLASSES[hero.cls]!;
    const L = hero.level;

    // Attributes feed other stats (GDD: Might, Grace, Wit).
    const str = Math.round(bag.calc("str")), dex = Math.round(bag.calc("dex")), int = Math.round(bag.calc("int"));
    bag.add({ stat: "life", kind: "flat", value: Math.floor(str / 2), src: "Might" });
    bag.add({ stat: "damage", kind: "inc", value: Math.floor(str / 5), tags: ["melee", "phys"], src: "Might" });
    bag.add({ stat: "accuracy", kind: "flat", value: dex * 2, src: "Grace" });
    bag.add({ stat: "evasion", kind: "inc", value: Math.floor(dex / 5), src: "Grace" });
    bag.add({ stat: "mana", kind: "flat", value: Math.floor(int / 2), src: "Wit" });
    bag.add({ stat: "energyShield", kind: "inc", value: Math.floor(int / 5), src: "Wit" });

    const life = Math.max(1, Math.round(bag.calc("life", heroBaseLife(L, cls.life))));
    const mana = Math.max(1, Math.round(bag.calc("mana", heroBaseMana(L))));
    const es = Math.round(bag.calc("energyShield", base.es));
    const armour = Math.round(bag.calc("armour", base.armour));
    const evasion = Math.round(bag.calc("evasion", base.evasion + 15 + 3 * L));
    const block = Math.min(50, bag.calc("block", base.block));
    const maxRes = zeroes(), res = zeroes(), resRaw = zeroes();
    for (const t of DAMAGE_TYPES) {
        maxRes[t] = Math.min(90, 75 + bag.flat(`maxRes.${t}`));
        resRaw[t] = Math.round(bag.flat(`res.${t}`));
        res[t] = Math.min(maxRes[t], resRaw[t]);
    }
    const lifeRegen = bag.flat("lifeRegen") + life * bag.flat("lifeRegenPct") / 100;
    const manaRegen = bag.flat("manaRegen") + mana * 0.07;

    const skill = calcSkill(hero, bag, problems, manaRegen);

    // EHP (COMBAT.md 7): pool over the share of a reference hit that gets through.
    const ref = monsterDamage(L) * 1.5;
    const pool = life + es;
    const evade = 1 - Math.max(0.25, hitChance(monsterDefence(L), evasion));
    const blk = block / 100;
    const dmgTaken = bag.incMult("dmgTaken") * bag.more("dmgTaken");
    const ehp = zeroes();
    for (const t of DAMAGE_TYPES) {
        const through = t === "phys" ? (1 - armourReduction(armour, ref)) * (1 - evade) : (1 - res[t] / 100);
        ehp[t] = Math.round(pool / Math.max(0.01, through * (1 - blk) * dmgTaken));
    }

    return {
        level: L, str, dex, int, life, mana, es, lifeRegen, manaRegen, armour, evasion, block, res, resRaw, maxRes,
        moveSpeed: bag.incMult("moveSpeed"), flaskHeal: bag.incMult("flaskHeal"), flaskCharges: bag.incMult("flaskCharges"),
        lifeOnKill: bag.flat("lifeOnKill"), rarity: bag.inc("itemRarity"), quantity: bag.inc("itemQuantity"),
        xpGain: bag.incMult("xpGain"), dmgTaken, skill, ehp, problems, bag,
    };
}

function calcSkill(hero: Hero, heroBag: StatBag, problems: string[], manaRegen: number): SkillCalc {
    const L = hero.level;
    let def = SKILLS[hero.skill];
    if (!def || def.level > L) { problems.push("skill not available"); def = SKILLS.crescent!; }
    const weaponItem = hero.equipment.weapon;
    const wst = weaponItem && levelReq(weaponItem) <= L ? itemStats(weaponItem).weapon : undefined;
    const wkind = wst ? BASES[weaponItem!.base]!.kind : "unarmed";
    let usable = true;
    if (def.kind === "attack" && def.weapons && def.weapons.length && !def.weapons.includes(wkind)) {
        problems.push(`${def.name} can't be used with ${wst ? "this weapon" : "no weapon"}`);
        usable = false;
    }

    // Skill + supports as one bag on top of the hero's.
    const bag = new StatBag();
    bag.addAll(allMods(heroBag));
    for (const m of def.mods ?? []) bag.add(m);
    const tags = new Set<string>([...def.tags, def.kind]);
    const slots = supportSlots(L);
    const used: string[] = [];
    let manaMult = 1, extraTargets = 0;
    for (const id of hero.supports.slice(0, slots)) {
        const sup = SUPPORTS[id];
        if (!sup || sup.level > L) continue;
        if (sup.requires.length && !sup.requires.some(t => tags.has(t))) { problems.push(`${sup.name} does not support ${def.name}`); continue; }
        used.push(id);
        for (const m of sup.mods) bag.add({ ...m, src: sup.name });
        manaMult *= sup.manaMult;
        extraTargets += sup.targets ?? 0;
    }

    const eff = (def.effectiveness / 100) * (usable ? 1 : 0.5);
    const isSpell = def.kind === "spell";
    const baseDmg = zeroRanges();
    let crit: number, speed: number;
    if (def.kind === "attack") {
        const w = wst ?? { ...UNARMED, added: {} as Partial<Ranges> };
        baseDmg.phys = [w.phys[0], w.phys[1]];
        for (const t of ELEMENTS) { const a = w.added[t]; if (a) baseDmg[t] = [a[0], a[1]]; }
        crit = w.crit;
        speed = w.aps * (def.speedMult ?? 1);
    } else {
        const sc = spellScale(L);
        for (const t of DAMAGE_TYPES) { const d = def.damage?.[t]; if (d) baseDmg[t] = [d[0] * sc, d[1] * sc]; }
        crit = def.crit ?? 6;
        speed = 1 / (def.castTime ?? 1);
    }
    const ctx = tagSet([...tags]);
    for (const t of DAMAGE_TYPES) {
        const c = tagSet([...tags, t]);
        // COMBAT.md 3: attacks scale weapon + added by effectiveness; spells only the added part.
        const lo = bag.flat(`addMin.${t}`, c), hi = bag.flat(`addMax.${t}`, c);
        baseDmg[t] = isSpell ? [baseDmg[t][0] + lo * eff, baseDmg[t][1] + hi * eff] : [(baseDmg[t][0] + lo) * eff, (baseDmg[t][1] + hi) * eff];
    }

    // Conversion from phys (COMBAT.md 3).
    const conv = zeroes();
    let convTotal = 0;
    for (const t of ELEMENTS) { conv[t] = Math.max(0, bag.flat(`convert.${t}`, ctx)); convTotal += conv[t]; }
    conv.chaos = Math.max(0, bag.flat("convert.chaos", ctx)); convTotal += conv.chaos;
    const scale = convTotal > 100 ? 100 / convTotal : 1;

    const hit = zeroRanges();
    const addPortion = (dest: DamageType, types: string[], lo: number, hi: number) => {
        if (lo <= 0 && hi <= 0) return;
        const c = tagSet([...tags], types);
        if (types.some(x => x === "fire" || x === "cold" || x === "lightning")) c.add("elemental");
        const mult = bag.incMult("damage", c) * bag.more("damage", c);
        hit[dest][0] += lo * mult;
        hit[dest][1] += hi * mult;
    };
    const physKeep = 1 - Math.min(1, convTotal * scale / 100);
    addPortion("phys", ["phys"], baseDmg.phys[0] * physKeep, baseDmg.phys[1] * physKeep);
    for (const t of ["fire", "cold", "lightning", "chaos"] as const) {
        const share = conv[t] * scale / 100;
        if (share > 0) addPortion(t, ["phys", t], baseDmg.phys[0] * share, baseDmg.phys[1] * share);
        addPortion(t, [t], baseDmg[t][0], baseDmg[t][1]);
    }
    for (const t of DAMAGE_TYPES) hit[t] = [Math.round(hit[t][0] * 10) / 10, Math.round(hit[t][1] * 10) / 10];

    const critChance = Math.min(95, (crit + bag.flat("baseCrit", ctx)) * bag.incMult("critChance", ctx) * bag.more("critChance", ctx));
    const critMulti = 150 + bag.flat("critMulti", ctx);
    if (def.kind === "attack") speed *= bag.incMult("attackSpeed", ctx) * bag.more("attackSpeed", ctx);
    else speed *= bag.incMult("castSpeed", ctx) * bag.more("castSpeed", ctx);

    const accuracy = Math.round(bag.calc("accuracy", heroBaseAccuracy(L), ctx));
    const hc = def.kind === "spell" ? 1 : hitChance(accuracy, monsterDefence(L));
    let targets = 1;
    if (def.shape === "area") targets = Math.max(1, Math.floor((def.targets ?? 3) * bag.incMult("area", ctx))) + extraTargets;
    else if (def.shape === "projectile") targets = 1 + (def.targets ?? 0) + extraTargets + Math.floor(bag.flat("pierce", ctx));
    const manaCost = Math.round(def.manaCost * (1 + 0.02 * (L - 1)) * manaMult * bag.incMult("manaCost") * 10) / 10;
    const pen = zeroes();
    for (const t of DAMAGE_TYPES) pen[t] = bag.flat(`pen.${t}`, ctx);

    let avgHit = 0;
    for (const t of DAMAGE_TYPES) avgHit += (hit[t][0] + hit[t][1]) / 2;
    const critFactor = 1 + (critChance / 100) * (critMulti / 100 - 1);
    // Sustained DPS: a skill can't be used faster than mana regeneration pays for it.
    // The hero fights about FIGHT_SHARE of the time; mana keeps regenerating while travelling.
    const sustain = manaCost > 0 ? manaRegen / manaCost / FIGHT_SHARE : Infinity;
    const dps = avgHit * critFactor * Math.min(speed, sustain) * hc;
    return {
        id: def.id, name: def.name, kind: def.kind, shape: def.shape, fx: def.fx, tags: [...tags],
        hit, avgHit, critChance, critMulti, speed, sustain, hitChance: hc, accuracy, targets, manaCost,
        leech: Math.min(20, bag.flat("leech", ctx)), pen, dps, packDps: dps * targets, supports: used,
    };
}

function allMods(bag: StatBag): Mod[] {
    const out: Mod[] = [];
    for (const stat of STAT_KEYS) out.push(...bag.mods(stat));
    return out;
}

// Every stat id the skill bag might read; kept in one place so copying a bag stays cheap.
const STAT_KEYS: Mod["stat"][] = [
    "damage", "critChance", "critMulti", "attackSpeed", "castSpeed", "area", "pierce", "leech", "accuracy", "manaCost", "baseCrit", "skillEffect",
    ...DAMAGE_TYPES.flatMap(t => [`addMin.${t}`, `addMax.${t}`, `pen.${t}`, `convert.${t}`] as Mod["stat"][]),
];
