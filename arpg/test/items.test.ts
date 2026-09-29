import { describe, expect, it } from "vitest";
import { Rng } from "../src/core/rng";
import { AFFIXES } from "../src/core/data";
import { MAX_AFFIXES, affixText, countAffixes, itemStats, levelReq, rollItem, affixOf, domainsOf, baseOf } from "../src/core/items";

describe("items", () => {
    it("respects affix limits, groups, domains and item level", () => {
        const rng = new Rng(11);
        for (let i = 0; i < 3000; i++) {
            const ilvl = rng.int(1, 85);
            const it = rollItem(rng, i, ilvl);
            const c = countAffixes(it);
            expect(c.prefix).toBeLessThanOrEqual(MAX_AFFIXES[it.rarity].prefix);
            expect(c.suffix).toBeLessThanOrEqual(MAX_AFFIXES[it.rarity].suffix);
            const groups = it.affixes.map(a => affixOf(a).group);
            expect(new Set(groups).size).toBe(groups.length);
            const dom = domainsOf(baseOf(it));
            for (const a of it.affixes) {
                const def = AFFIXES[a.id]!;
                expect(def.domains.some(d => dom.has(d))).toBe(true);
                expect(def.tiers[a.tier]!.ilvl).toBeLessThanOrEqual(ilvl);
                def.tiers[a.tier]!.ranges.forEach(([lo, hi], k) => { expect(a.rolls[k]).toBeGreaterThanOrEqual(lo); expect(a.rolls[k]).toBeLessThanOrEqual(hi); });
                expect(affixText(a)).not.toMatch(/\{/);
            }
            if (it.rarity === "rare") { expect(it.affixes.length).toBeGreaterThanOrEqual(3); expect(it.name).toBeTruthy(); }
            expect(baseOf(it).level).toBeLessThanOrEqual(ilvl);
            expect(levelReq(it)).toBeLessThanOrEqual(ilvl);
        }
    });
    it("applies local weapon modifiers to the weapon", () => {
        const it = { uid: 1, base: "sword1", ilvl: 1, rarity: "enchanted" as const, affixes: [
            { id: "phys_local", tier: 0, rolls: [100] }, { id: "aspd_local", tier: 0, rolls: [10] }] };
        const w = itemStats(it).weapon!;
        const base = itemStats({ ...it, affixes: [] }).weapon!;
        expect(w.phys[1]).toBe(Math.round(base.phys[1] * 2));
        expect(w.aps).toBeCloseTo(base.aps * 1.1, 2);
        expect(itemStats(it).global.length).toBe(1); // the sword implicit only
    });
    it("same seed, same item", () => {
        expect(rollItem(new Rng(5), 1, 40)).toEqual(rollItem(new Rng(5), 1, 40));
    });
});
