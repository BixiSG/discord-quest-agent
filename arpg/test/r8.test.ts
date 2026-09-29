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
