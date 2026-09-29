import { describe, expect, it } from "vitest";
import { BASES, CLASSES, CURRENCIES, PASSIVES, RELICS, SKILLS, SUPPORTS } from "../src/core/data";
import { newGame, sheetOf, setSkill } from "../src/core/game";
import { allocate, canRefund, pointsLeft, refund } from "../src/core/passives";
import { applyCurrency, buyCurrency, EFFECTS } from "../src/core/crafting";
import { keepItem, ruleMatches } from "../src/core/filter";
import { MIGRATIONS, unwrap } from "../src/core/save";
import { relicLines, rollRelic, itemStats, countAffixes, MAX_AFFIXES } from "../src/core/items";
import { Rng } from "../src/core/rng";
import type { Item } from "../src/core/types";

const game = (cls = "vanguard") => newGame({ name: "T", cls, now: 0, seed: 2 });

describe("passive tree", () => {
    it("links are symmetric and every node is reachable from every start", () => {
        for (const n of Object.values(PASSIVES)) for (const l of n.links) expect(PASSIVES[l]?.links, `${n.id}->${l}`).toContain(n.id);
        for (const c of Object.values(CLASSES)) {
            expect(PASSIVES[c.startNode]?.kind).toBe("start");
            const seen = new Set([c.startNode]); const q = [c.startNode];
            while (q.length) for (const l of PASSIVES[q.pop()!]!.links) if (!seen.has(l)) { seen.add(l); q.push(l); }
            expect(seen.size).toBe(Object.keys(PASSIVES).length);
        }
        expect(Object.keys(PASSIVES).length).toBeGreaterThan(120);
    });
    it("allocates adjacent nodes only, refunds keep the tree connected", () => {
        const g = game(); g.hero.level = 10; g.dust = 1000;
        expect(pointsLeft(g.hero)).toBe(9);
        const first = PASSIVES.start_vanguard!.links[0]!;
        const far = "vanguard_b0_3";
        expect(allocate(g, far)).toMatch(/connected/);
        expect(allocate(g, first)).toBeNull();
        const second = PASSIVES[first]!.links.find(l => l !== "start_vanguard")!;
        expect(allocate(g, second)).toBeNull();
        expect(canRefund(g.hero, first)).toBe(false);
        expect(refund(g, second)).toBeNull();
        expect(g.hero.passives).toEqual([first]);
        const life0 = sheetOf(g).life;
        g.hero.passives = []; g.hero.rev++;
        expect(sheetOf(g).life).toBeLessThanOrEqual(life0);
    });
});

describe("classes", () => {
    it("every class starts valid with positive DPS and every skill works on some build", () => {
        for (const c of Object.values(CLASSES)) {
            const g = game(c.id);
            const s = sheetOf(g);
            expect(s.problems, c.id).toEqual([]);
            expect(s.skill.dps).toBeGreaterThan(2);
        }
        for (const sk of Object.values(SKILLS)) {
            const cls = Object.values(CLASSES).find(c => { const w = BASES[c.startWeapon]!.kind; return sk.kind === "spell" || !sk.weapons?.length || sk.weapons.includes(w); });
            if (!cls) continue; // melee skills for non-starting weapons are covered by content tests
            const g = game(cls.id); g.hero.level = Math.max(30, sk.level); g.hero.rev++;
            expect(setSkill(g, sk.id)).toBeNull();
            expect(sheetOf(g).skill.dps, sk.id).toBeGreaterThan(0);
        }
        for (const s of Object.values(SUPPORTS)) expect(s.level).toBeGreaterThanOrEqual(1);
    });
});

describe("crafting", () => {
    const plain = (): Item => ({ uid: 500, base: "plate_body3", ilvl: 40, rarity: "plain", affixes: [] });
    it("each currency does what it says and refusals change nothing", () => {
        const g = game();
        g.stash.push(plain());
        for (const id of Object.keys(CURRENCIES)) g.currency[id] = 5;
        expect(applyCurrency(g, "reshaper", 500)).toMatch(/enchanted/);
        expect(g.currency.reshaper).toBe(5);
        expect(applyCurrency(g, "kindling", 500)).toBeNull();
        expect(g.stash[0]!.rarity).toBe("enchanted");
        expect(applyCurrency(g, "crownseal", 500)).toBeNull();
        expect(g.stash[0]!.rarity).toBe("rare");
        expect(g.stash[0]!.name).toBeTruthy();
        while (applyCurrency(g, "starfall", 500) === null);
        const c = countAffixes(g.stash[0]!);
        expect(c.prefix + c.suffix).toBeLessThanOrEqual(MAX_AFFIXES.rare.prefix + MAX_AFFIXES.rare.suffix);
        const before = g.stash[0]!.affixes.length;
        expect(applyCurrency(g, "unmaker", 500)).toBeNull();
        expect(g.stash[0]!.affixes.length).toBe(before - 1);
        expect(applyCurrency(g, "salt", 500)).toBeNull();
        expect(g.stash[0]!).toMatchObject({ rarity: "plain", affixes: [] });
        expect(g.stash[0]!.name).toBeUndefined();
        expect(Object.keys(EFFECTS).sort()).toEqual(Object.keys(CURRENCIES).sort());
    });
    it("is deterministic per save and craft count", () => {
        const a = game(), b = game();
        for (const g of [a, b]) { g.stash.push(plain()); g.currency.forgeheart = 1; applyCurrency(g, "forgeheart", 500); }
        expect(a.stash[0]).toEqual(b.stash[0]);
    });
    it("buys with dust", () => {
        const g = game(); g.dust = 12;
        expect(buyCurrency(g, "kindling", 2)).toBeNull();
        expect(g.dust).toBe(2);
        expect(buyCurrency(g, "kindling")).toMatch(/dust/);
    });
});

describe("relics", () => {
    it("reference real bases and roll in range", () => {
        for (const r of Object.values(RELICS)) {
            expect(BASES[r.base], r.id).toBeDefined();
            expect(BASES[r.base]!.level).toBeLessThanOrEqual(r.level);
            for (const m of r.mods) { expect(m.range[0]).toBeLessThanOrEqual(m.range[1]); expect(m.text).toContain("{0}"); }
        }
        const rng = new Rng(4);
        for (let i = 0; i < 200; i++) {
            const it = rollRelic(rng, i, 80)!;
            expect(it.rarity).toBe("relic");
            expect(relicLines(it).join()).not.toContain("{");
            expect(itemStats(it).global.every(m => Number.isFinite(m.value))).toBe(true);
        }
        expect(rollRelic(rng, 1, 1)).toBeNull();
    });
});

describe("loot filter", () => {
    it("first enabled rule wins, then the rarity fallback", () => {
        const g = game(); g.hero.level = 40;
        const it = (rarity: Item["rarity"], base = "sword2"): Item => ({ uid: 1, base, ilvl: 40, rarity, affixes: [] });
        expect(keepItem(g, it("relic"))).toBe(true);
        expect(keepItem(g, it("enchanted"))).toBe(false);      // behind 10 levels
        expect(keepItem(g, it("enchanted", "sword5"))).toBe(false); // fallback keep = rare
        g.settings.keep = "enchanted";
        expect(keepItem(g, it("enchanted", "sword5"))).toBe(true);
        expect(ruleMatches({ on: true, action: "keep", slots: ["ring"] }, it("rare", "ring_iron"), 40)).toBe(true);
    });
});

describe("migrations", () => {
    it("v1 saves load as v2", () => {
        const v1 = game() as any;
        delete v1.hero.bonusPoints; delete v1.settings.filter; delete v1.craftSeq;
        const env = unwrap<any>({ game: "hollowmarch", v: 1, savedAt: 1, state: v1 }, MIGRATIONS, 2);
        expect(env.state.hero.bonusPoints).toBe(0);
        expect(env.state.settings.filter.length).toBe(3);
        expect(env.state.craftSeq).toBe(0);
        expect(sheetOf(env.state).life).toBeGreaterThan(0);
    });
});
