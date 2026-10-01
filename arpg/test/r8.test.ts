// Round 8: late skills and supports, supports with modifiers on the hero.
import { describe, expect, it } from "vitest";
import { SKILLS, SUPPORTS } from "../src/core/data";
import { deriveSheet, linkOf } from "../src/core/character";
import { newGame, setSkill, setSupports, sheetOf } from "../src/core/game";
import type { GameState } from "../src/core/state";

const hero = (cls: string, level: number): GameState => {
    const g = newGame({ name: "R", cls, now: 0, seed: 8 });
    g.hero.level = level; g.hero.rev++;
    return g;
};

describe("supports with modifiers on the hero", () => {
    it("Steadfast lowers damage taken while linked to an attack, and says where it comes from", () => {
        const g = hero("vanguard", 40);
        const before = sheetOf(g);
        expect(setSupports(g, ["steadfast"])).toBeNull();
        const after = sheetOf(g);
        expect(after.dmgTaken).toBeCloseTo(before.dmgTaken * 0.85);
        expect(after.ehp.phys / before.ehp.phys).toBeGreaterThan(1.15);
        expect(after.ehp.fire / before.ehp.fire).toBeCloseTo(1 / 0.85, 2);
        expect(after.bag.mods("dmgTaken").map(m => m.src)).toContain("Steadfast");
        // It adds no damage and costs only mana.
        expect(after.skill.avgHit).toBeCloseTo(before.skill.avgHit);
        expect(after.skill.manaCost).toBeGreaterThan(before.skill.manaCost);
    });
    it("a support that doesn't fit the skill, or sits in a closed slot, puts nothing on the hero", () => {
        const g = hero("arcanist", 40);
        const before = sheetOf(g);
        setSupports(g, ["steadfast"]);
        const s = sheetOf(g);
        expect(s.dmgTaken).toBeCloseTo(before.dmgTaken);
        expect(s.problems.some(p => p.includes("Steadfast does not support"))).toBe(true);
        expect(linkOf(g.hero).unfit).toEqual(["steadfast"]);
        // Five supports but only two slots at level 7: the third (Steadfast) is not linked.
        const v = hero("vanguard", 7);
        v.hero.supports = ["heavyhand", "quicken", "steadfast"];
        expect(linkOf(v.hero).used).toEqual(["heavyhand", "quicken"]);
        expect(deriveSheet(v.hero).dmgTaken).toBeCloseTo(1);
    });
    it("every support that fits no skill still names a real tag, and every self modifier is a hero stat", () => {
        const tags = new Set(Object.values(SKILLS).flatMap(s => [...s.tags, s.kind]));
        for (const s of Object.values(SUPPORTS)) {
            for (const t of s.requires) expect(tags.has(t), `${s.id}: ${t}`).toBe(true);
            for (const m of s.self ?? []) expect(["dmgTaken", "life", "armour", "evasion", "block", "energyShield", "lifeRegenPct"]).toContain(m.stat);
        }
    });
});

describe("late skills", () => {
    it("unlock at their level and deal damage with the calling's weapon", () => {
        const byWeapon: Record<string, string> = { gravecleave: "vanguard", tidalcrash: "vanguard", sunpiercer: "strider", blightarrow: "strider", sunflare: "arcanist", voidlance: "arcanist" };
        for (const [id, cls] of Object.entries(byWeapon)) {
            const def = SKILLS[id]!;
            expect(def.level).toBeGreaterThanOrEqual(28);
            const g = hero(cls, def.level - 1);
            expect(setSkill(g, id)).toMatch(/needs level/);
            g.hero.level = def.level; g.hero.rev++;
            expect(setSkill(g, id)).toBeNull();
            const s = sheetOf(g);
            expect(s.problems).toEqual([]);
            expect(s.skill.dps, id).toBeGreaterThan(0);
        }
    });
    it("conversions land where the data says: Tidal Crash half cold, Blight Arrow half chaos, Sunpiercer mostly fire", () => {
        const share = (g: GameState, t: "cold" | "chaos" | "fire") => { const h = sheetOf(g).skill.hit; const tot = Object.values(h).reduce((a, [lo, hi]) => a + lo + hi, 0); return (h[t][0] + h[t][1]) / tot; };
        const v = hero("vanguard", 40); setSkill(v, "tidalcrash");
        expect(share(v, "cold")).toBeGreaterThan(0.4);
        const s = hero("strider", 44); setSkill(s, "blightarrow");
        expect(share(s, "chaos")).toBeGreaterThan(0.4);
        setSkill(s, "sunpiercer");
        expect(share(s, "fire")).toBeGreaterThan(0.5);
    });
    it("Concentrate trades targets for damage", () => {
        const g = hero("vanguard", 40);
        setSkill(g, "tidalcrash");
        const a = sheetOf(g).skill;
        setSupports(g, ["concentrate"]);
        const b = sheetOf(g).skill;
        expect(b.targets).toBeLessThan(a.targets);
        expect(b.avgHit / a.avgHit).toBeCloseTo(1.4, 1); // hits are rounded to 0.1
        expect(b.manaCost).toBeGreaterThan(a.manaCost);
    });
});

describe("bows (round 8)", () => {
    it("Grace adds 1% increased projectile attack damage per 5, not to spells or melee", () => {
        const g = hero("strider", 30);
        const grace = sheetOf(g).bag.mods("damage").filter(m => m.src === "Grace");
        expect(grace).toHaveLength(1);
        expect(grace[0]!.tags).toEqual(["projectile", "attack"]);
        expect(grace[0]!.value).toBe(Math.floor(sheetOf(g).dex / 5));
        // 50 more Grace: a bow attack hits harder, a projectile spell (Ember Bolt) and a melee attack don't.
        const more = [{ stat: "dex" as const, kind: "flat" as const, value: 50 }];
        const bow = deriveSheet(g.hero).skill.avgHit, bow2 = deriveSheet(g.hero, more).skill.avgHit;
        expect(bow2).toBeGreaterThan(bow * 1.05);
        const a = hero("arcanist", 30);
        expect(deriveSheet(a.hero, more).skill.avgHit).toBeCloseTo(deriveSheet(a.hero).skill.avgHit);
        const v = hero("vanguard", 30);
        expect(deriveSheet(v.hero, more).skill.avgHit).toBeCloseTo(deriveSheet(v.hero).skill.avgHit);
    });
    it("Longdraw fits bows only and is worth about Ruthless", () => {
        const g = hero("strider", 30);
        const a = sheetOf(g).skill.avgHit;
        expect(setSupports(g, ["longdraw"])).toBeNull();
        expect(sheetOf(g).skill.avgHit / a).toBeCloseTo(1.3 * 1.2, 1);
        const v = hero("vanguard", 30);
        setSupports(v, ["longdraw"]);
        expect(linkOf(v.hero).unfit).toEqual(["longdraw"]);
    });
});

describe("level-up lines", () => {
    it("name the skills and supports a level opens, in the reader's language", async () => {
        const { gainXp } = await import("../src/core/sim/engine");
        const { xpToNext } = await import("../src/core/data");
        const { logText } = await import("../src/i18n/names");
        const g = hero("strider", 29);
        g.hero.xp = 0;
        gainXp(g, xpToNext(29));
        const e = g.log[g.log.length - 1]!;
        expect(e.key).toBe("log.levelUpNew");
        expect(logText(e, "en")).toBe("Reached level 30. New to learn: Sunpiercer, Sunflare, Concentrate.");
        expect(logText(e, "ru")).toContain("Пронзающий луч");
        gainXp(g, xpToNext(30));
        expect(g.log[g.log.length - 1]!.key).toBe("log.levelUp");
    });
});

describe("Ashfold map areas and round-8 map mods", () => {
    const setup = async (mods: string[], cls = "vanguard", area = "lanternlanes", tier = 5) => {
        const { setMapMode } = await import("../src/core/maps");
        const g = hero(cls, 70);
        // Real weapons: a starter's hits floor at 1 against level-52 monsters.
        g.hero.equipment.weapon = { uid: 6999, base: cls === "arcanist" ? "wand7" : "greatsword7", ilvl: 70, rarity: "plain", affixes: [] };
        g.hero.rev++;
        g.world.clears.a4_lamphouse = 1;
        g.maps.push({ uid: 7000, tier, area, mods, rarity: mods.length ? "rare" : "plain" });
        setMapMode(g, true);
        return g;
    };
    const firstHit = async (mods: string[], cls = "vanguard") => {
        const { step } = await import("../src/core/sim/engine");
        const g = await setup(mods, cls);
        let dmg = 0;
        for (let i = 0; i < 400 && !dmg; i++) step(g, { heroHit: (_t, d) => { dmg ||= d; } });
        return dmg;
    };
    it("the areas are Ashfold's monsters and bosses, with a backdrop of their own", async () => {
        const { MAP_AREAS, MONSTERS, ZONES } = await import("../src/core/data");
        const a4 = new Set(["a4_stair", "a4_gate", "a4_lanes", "a4_square", "a4_belfry", "a4_undercroft", "a4_lamphouse"].flatMap(z => [...ZONES[z]!.monsters, ZONES[z]!.boss ?? ""]));
        for (const id of ["lanternlanes", "hollowbelfry", "oildeeps"]) {
            const a = MAP_AREAS[id]!;
            expect(a.scene).toBeTruthy();
            for (const m of [...a.monsters, a.boss]) { expect(MONSTERS[m], m).toBeDefined(); expect(a4.has(m), m).toBe(true); }
        }
        const { setFor, SETS } = await import("../src/ui/gfx/scenes");
        const { mapZone } = await import("../src/core/maps");
        const { emptyAtlas } = await import("../src/core/data");
        expect(setFor(mapZone({ tier: 3, area: "lanternlanes", mods: [], level: 48 }, emptyAtlas()))).toBe(SETS.ashfold);
        // Every area keeps one backdrop at every tier (it used to be picked from the tier-suffixed name).
        for (const a of Object.values(MAP_AREAS)) {
            expect(SETS[a.scene!], a.id).toBeDefined();
            expect(setFor(mapZone({ tier: 2, area: a.id, mods: [], level: 46 }, emptyAtlas()))).toBe(setFor(mapZone({ tier: 17, area: a.id, mods: [], level: 75 }, emptyAtlas())));
        }
    });
    it("armoured and warded blunt the first hit; veiled makes attacks miss more", async () => {
        expect(await firstHit(["armoured"])).toBeLessThan(await firstHit([]));
        expect(await firstHit(["warded"], "arcanist")).toBeLessThan(await firstHit([], "arcanist"));
        const { monsterArmour, monsterEvasion, monsterRes } = await import("../src/core/sim/engine");
        const { mapEffects } = await import("../src/core/maps");
        const { emptyAtlas } = await import("../src/core/data");
        const eff = (mods: string[]) => mapEffects({ tier: 5, area: "lanternlanes", mods, level: 52 }, emptyAtlas());
        const m = { def: "watchman", level: 52, life: 1, maxLife: 1, champion: false, atk: 1 };
        expect(monsterEvasion(m, eff(["veiled"])) / monsterEvasion(m, eff([]))).toBeCloseTo(1.5);
        expect(monsterArmour(m, eff(["armoured"])) / monsterArmour(m, eff([]))).toBeCloseTo(1.6);
        expect(monsterRes(m, "cold", eff(["warded"])) - monsterRes(m, "cold", eff([]))).toBe(20);
        expect(monsterRes(m, "chaos", eff(["warded"]))).toBe(monsterRes(m, "chaos", eff([])));
        expect(monsterRes(m, "cold", null)).toBe(30);
    });
    it("swarming adds a monster to every pack; draining raises mana cost in the map only", async () => {
        const { mapZone, mapEffects } = await import("../src/core/maps");
        const { emptyAtlas } = await import("../src/core/data");
        expect(mapZone({ tier: 3, area: "oildeeps", mods: ["swarming"], level: 48 }, emptyAtlas()).packSize).toEqual([5, 7]);
        const { runSheet, step } = await import("../src/core/sim/engine");
        const g = await setup(["draining"]);
        const before = sheetOf(g).skill.manaCost;
        step(g);
        expect(runSheet(g).skill.manaCost).toBeCloseTo(before * 1.4, 0);
        expect(mapEffects(g.activity.run!.map!, emptyAtlas()).hero.map(m => m.stat)).toEqual(["manaCost"]);
    });
    it("overlord makes the map boss tougher and more dangerous", async () => {
        const { step } = await import("../src/core/sim/engine");
        const bossLife = async (mods: string[]) => {
            const g = await setup(mods);
            step(g);
            const run = g.activity.run!;
            run.pack = run.packs; run.phase = "travel"; run.timer = 0;
            step(g);
            return run.monsters[0]!.maxLife;
        };
        expect(await bossLife(["overlord"]) / await bossLife([])).toBeCloseTo(1.8, 1);
    });
});

describe("forge previews", () => {
    it("say exactly what each currency does: the same refusal, the rarity, kept/rerolled/removed affixes and the count that comes", async () => {
        const { craftPreview, applyCurrency } = await import("../src/core/crafting");
        const { rollItem, countAffixes } = await import("../src/core/items");
        const { Rng } = await import("../src/core/rng");
        const { CURRENCY_ORDER } = await import("../src/core/data");
        let checked = 0;
        for (let seed = 1; seed <= 60; seed++) {
            const rng = new Rng(seed);
            const rarity = (["plain", "enchanted", "rare"] as const)[seed % 3]!;
            const item = rollItem(rng, 1000 + seed, 10 + seed, { rarity });
            for (const cur of CURRENCY_ORDER) {
                const g = hero("vanguard", 60);
                g.stash.push(structuredClone(item));
                g.currency[cur] = 1;
                g.craftSeq = seed;
                const before = structuredClone(g.stash[0]!);
                const pv = craftPreview(before, cur);
                const err = applyCurrency(g, cur, before.uid);
                if ("err" in pv) { expect(err, `${cur} on ${rarity}`).toBe(pv.err); continue; }
                expect(err, `${cur} on ${rarity}`).toBeNull();
                const after = g.stash[0]!;
                if (pv.rarity) expect(after.rarity).toBe(pv.rarity); else expect(after.rarity).toBe(before.rarity);
                const ids = after.affixes.map(a => a.id);
                pv.affixes.forEach((f, i) => {
                    const a = before.affixes[i]!;
                    if (f === "keep") expect(after.affixes.some(x => x.id === a.id && x.tier === a.tier && x.rolls.join() === a.rolls.join()), `${cur} keeps ${a.id}`).toBe(true);
                    if (f === "reroll") expect(ids).toContain(a.id);
                    if (f === "remove") expect(ids).not.toContain(a.id);
                });
                const replaced = pv.affixes.includes("replace");
                const kept = pv.affixes.filter(f => f === "keep" || f === "reroll").length;
                const removed = before.affixes.length - after.affixes.length;
                if (pv.affixes.includes("maybe")) expect(removed).toBe(1);
                const came = replaced || !before.affixes.length ? after.affixes.length : after.affixes.length - kept;
                if (pv.add) {
                    expect(came, `${cur}: ${came} in ${pv.add.min}-${pv.add.max}`).toBeGreaterThanOrEqual(pv.add.min);
                    expect(came).toBeLessThanOrEqual(pv.add.max);
                    const c = countAffixes(after), b = replaced ? { prefix: 0, suffix: 0 } : countAffixes(before);
                    if (c.prefix > b.prefix) expect(pv.add.types).toContain("prefix");
                    if (c.suffix > b.suffix) expect(pv.add.types).toContain("suffix");
                } else if (!pv.affixes.includes("maybe")) expect(after.affixes.length).toBe(before.affixes.length - pv.affixes.filter(f => f === "remove").length);
                checked++;
            }
        }
        expect(checked).toBeGreaterThan(200);
    });
    it("the bench preview replaces a benched affix and names the new one", async () => {
        const { benchPreview, benchOptions } = await import("../src/core/crafting");
        const { rollItem } = await import("../src/core/items");
        const { Rng } = await import("../src/core/rng");
        const it = rollItem(new Rng(4), 1, 60, { rarity: "rare" });
        it.affixes[0]!.bench = true;
        const opt = benchOptions(it)[0];
        if (!opt) return;
        const pv = benchPreview(it, opt.id);
        expect("err" in pv).toBe(false);
        if (!("err" in pv)) { expect(pv.affixes[0]).toBe("remove"); expect(pv.affixes.slice(1).every(f => f === "keep")).toBe(true); expect(pv.addAffix).toBe(opt.id); }
        expect(benchPreview(it, "no_such_affix")).toEqual({ err: "that affix doesn't fit" });
    });
});

describe("the passive tree, extended", () => {
    it("171 nodes: each branch runs on to a mastery, and each calling's middle branch to a keystone of its own", async () => {
        const { PASSIVES, TREE_CLASSES, KEYSTONE_TEXT } = await import("../src/core/data");
        const nodes = Object.values(PASSIVES);
        expect(nodes.length).toBe(171);
        expect(nodes.filter(n => n.kind === "keystone").length).toBe(6);
        for (const n of nodes.filter(n => n.kind === "keystone")) expect(KEYSTONE_TEXT[n.name], n.name).toBeTruthy();
        for (const c of TREE_CLASSES) for (let b = 0; b < 3; b++) {
            for (const k of [4, 8, 12]) expect(PASSIVES[`${c.cls}_b${b}_${k}`]?.kind).toBe("notable");
            expect(PASSIVES[`${c.cls}_b${b}_12`]!.name).toBe(c.branches[b]!.mastery[0]);
        }
        TREE_CLASSES.forEach((c, i) => expect(PASSIVES[`ks${i + 3}_path`]!.links).toEqual(expect.arrayContaining([`${c.cls}_b1_12`, `keystone${i + 3}`])));
        // Nothing sits on top of anything else.
        for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++)
            expect(Math.hypot(nodes[i]!.x - nodes[j]!.x, nodes[i]!.y - nodes[j]!.y), `${nodes[i]!.id}/${nodes[j]!.id}`).toBeGreaterThan(20);
    });
    it("an allocation from before the extension is still whole, and the far keystone can be reached", async () => {
        const { validateState } = await import("../src/core/validate");
        const { allocate } = await import("../src/core/passives");
        const g = hero("vanguard", 100);
        const path = Array.from({ length: 9 }, (_, k) => `vanguard_b1_${k}`);
        g.hero.passives = [...path];
        expect(validateState(structuredClone(g)).hero.passives).toEqual(path);
        for (const id of ["vanguard_b1_9", "vanguard_b1_10", "vanguard_b1_11", "vanguard_b1_12", "ks3_path", "keystone3"]) expect(allocate(g, id), id).toBeNull();
        expect(sheetOf(g).bag.mods("attackSpeed").some(m => m.src === "Berserker's Pact")).toBe(true);
    });
});
