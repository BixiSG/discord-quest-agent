// Round 3: the Forge's sinks - hone, bench, forge until upgrade, reroll until upgrade.

import { describe, expect, it } from "vitest";
import { benchCraft, benchDust, benchOptions, BENCH_GRAFTS, craftUntilUpgrade, forgeCost, forgeUntilUpgrade, hone, honeCost, MAX_QUALITY, applyCurrency } from "../src/core/crafting";
import { newGame, sheetOf } from "../src/core/game";
import { itemStats } from "../src/core/items";
import type { Item } from "../src/core/types";

const g0 = () => newGame({ name: "T", cls: "vanguard", now: 0, seed: 5 });

describe("hone", () => {
    it("adds quality point by point to weapons and armour, at rising dust cost", () => {
        const g = g0();
        const w = g.hero.equipment.weapon!;
        const phys0 = itemStats(w).weapon!.phys[1];
        const dps0 = sheetOf(g).skill.dps;
        g.dust = 1e6;
        const costs: number[] = [];
        for (let i = 0; i < MAX_QUALITY; i++) { costs.push(honeCost(w)!); expect(hone(g, w.uid)).toBeNull(); }
        expect(w.quality).toBe(MAX_QUALITY);
        expect(w.locked).toBe(true);
        expect(honeCost(w)).toBeNull();
        expect(hone(g, w.uid)).toMatch(/already/);
        for (let i = 1; i < costs.length; i++) expect(costs[i]).toBeGreaterThan(costs[i - 1]!);
        expect(itemStats(w).weapon!.phys[1]).toBeGreaterThanOrEqual(Math.round(phys0 * 1.18));
        expect(sheetOf(g).skill.dps).toBeGreaterThan(dps0);
    });
    it("refuses jewellery and a short purse", () => {
        const g = g0();
        const ring: Item = { uid: 50, base: "ring_iron", ilvl: 5, rarity: "plain", affixes: [] };
        g.stash.push(ring);
        g.dust = 1e6;
        expect(hone(g, 50)).toMatch(/only weapons and armour/);
        g.dust = 0;
        expect(hone(g, g.hero.equipment.weapon!.uid)).toMatch(/dust/);
    });
});

describe("bench", () => {
    it("adds a chosen affix, one benched affix per item, for Graft and dust", () => {
        const g = g0();
        const it: Item = { uid: 60, base: "ring_iron", ilvl: 40, rarity: "rare", name: "X", affixes: [{ id: "life", tier: 0, rolls: [20] }] };
        g.stash.push(it);
        g.currency.graft = BENCH_GRAFTS * 2;
        g.dust = benchDust(it) * 2;
        expect(benchOptions(it).some(a => a.id === "res_fire")).toBe(true);
        expect(benchOptions(it).some(a => a.id === "life")).toBe(false); // group already on the item
        expect(benchCraft(g, 60, "res_fire")).toBeNull();
        expect(it.affixes.find(a => a.bench)?.id).toBe("res_fire");
        expect(it.locked).toBe(true);
        // A second bench craft replaces the first one.
        expect(benchCraft(g, 60, "res_cold")).toBeNull();
        expect(it.affixes.filter(a => a.bench).map(a => a.id)).toEqual(["res_cold"]);
        expect(it.affixes.length).toBe(2);
        expect(g.currency.graft).toBe(0);
        expect(benchCraft(g, 60, "res_fire")).toMatch(/Graft/);
    });
    it("refuses plain items, affixes that don't fit, a full item", () => {
        const g = g0();
        g.currency.graft = 99; g.dust = 1e6;
        const plain: Item = { uid: 61, base: "ring_iron", ilvl: 40, rarity: "plain", affixes: [] };
        g.stash.push(plain);
        expect(benchCraft(g, 61, "res_fire")).toMatch(/enchanted or rare/);
        const ench: Item = { uid: 62, base: "ring_iron", ilvl: 40, rarity: "enchanted", affixes: [{ id: "res_cold", tier: 0, rolls: [10] }] };
        g.stash.push(ench);
        expect(benchCraft(g, 62, "res_fire")).toMatch(/doesn't fit/); // enchanted: one suffix, taken
        expect(benchCraft(g, 62, "move")).toMatch(/doesn't fit/); // boots only
        expect(benchCraft(g, 62, "life")).toBeNull();
    });
});

describe("forge and reroll until upgrade", () => {
    it("forges until an upgrade is worn, salvaging the misses", () => {
        const g = g0();
        g.hero.level = 20;
        g.dust = forgeCost(g) * 10;
        const before = g.hero.equipment.helmet;
        const r = forgeUntilUpgrade(g, "helmet", 10);
        expect(r.err).toBeNull();
        expect(r.made).toBeGreaterThan(0);
        expect(g.stash.length).toBe(0);
        if (r.item) expect(g.hero.equipment.helmet?.uid).toBe(r.item.uid);
        else expect(g.hero.equipment.helmet).toBe(before);
        expect(forgeUntilUpgrade({ ...g0(), dust: 0 }, "helmet").err).toMatch(/dust/);
    });
    it("rerolls a stash item until it beats what is worn, or the currency runs out", () => {
        const g = g0();
        g.settings.autoEquip = false;
        g.hero.level = 30;
        const it: Item = { uid: 70, base: "ring_iron", ilvl: 30, rarity: "enchanted", affixes: [{ id: "int", tier: 0, rolls: [5] }] };
        g.stash.push(it);
        g.currency.reshaper = 5;
        const r = craftUntilUpgrade(g, "reshaper", 70, 20);
        expect(r.err).toBeNull();
        expect(r.used).toBeGreaterThan(0);
        expect(r.used).toBeLessThanOrEqual(5);
        if (!r.upgrade) expect(g.currency.reshaper).toBe(0);
        expect(craftUntilUpgrade(g, "kindling", 70).err).toMatch(/rerolls/);
    });
    it("currency on an item locks it", () => {
        const g = g0();
        const it: Item = { uid: 80, base: "ring_iron", ilvl: 10, rarity: "plain", affixes: [] };
        g.stash.push(it);
        g.currency.kindling = 1;
        expect(applyCurrency(g, "kindling", 80)).toBeNull();
        expect(it.locked).toBe(true);
    });
});
