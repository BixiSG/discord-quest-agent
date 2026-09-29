import { describe, expect, it } from "vitest";
import { deriveSheet, armourReduction, hitChance } from "../src/core/character";
import { newGame, setSupports, setSkill, equip, sheetOf } from "../src/core/game";

const fresh = () => newGame({ name: "Test", cls: "vanguard", now: 0, seed: 1 });

describe("character sheet", () => {
    it("a new Vanguard has sane numbers", () => {
        const s = sheetOf(fresh());
        expect(s.problems).toEqual([]);
        expect(s.life).toBeGreaterThan(60);
        expect(s.skill.dps).toBeGreaterThan(3);
        expect(s.skill.targets).toBe(3);
        expect(s.skill.hitChance).toBeGreaterThan(0.5);
        expect(s.ehp.phys).toBeGreaterThan(s.life);
    });
    it("supports change the skill and are validated", () => {
        const g = fresh();
        const before = sheetOf(g).skill;
        expect(setSupports(g, ["heavyhand"])).toBeNull();
        const after = sheetOf(g).skill;
        expect(after.avgHit).toBeCloseTo(before.avgHit * 1.35, 1);
        expect(after.speed).toBeCloseTo(before.speed * 0.9, 3);
        expect(setSupports(g, ["ruthless"])).toMatch(/level/);
    });
    it("conversion moves physical damage to fire", () => {
        const g = fresh();
        g.hero.level = 20; g.hero.rev++;
        expect(setSkill(g, "cinderwake")).toBeNull();
        const s = sheetOf(g).skill;
        expect(s.hit.fire[1]).toBeGreaterThan(0);
        expect(s.hit.phys[1]).toBeGreaterThan(0);
    });
    it("unarmed attacks work but skills that need a weapon complain", () => {
        const g = fresh();
        delete g.hero.equipment.weapon; g.hero.rev++;
        const s = deriveSheet(g.hero);
        expect(s.problems.join()).toMatch(/weapon/);
        expect(s.skill.dps).toBeGreaterThan(0);
    });
    it("equip moves items between stash and slots", () => {
        const g = fresh();
        g.stash.push({ uid: 99, base: "plate_helmet1", ilvl: 1, rarity: "plain", affixes: [] });
        expect(equip(g, 99)).toBeNull();
        expect(g.hero.equipment.helmet?.uid).toBe(99);
        expect(sheetOf(g).armour).toBeGreaterThan(0);
    });
    it("mitigation formulas", () => {
        expect(armourReduction(0, 100)).toBe(0);
        expect(armourReduction(800, 100)).toBeCloseTo(0.5);
        expect(armourReduction(1e9, 1)).toBe(0.85);
        expect(hitChance(100, 100)).toBeCloseTo(0.75);
        expect(hitChance(1, 1e6)).toBe(0.05);
    });
});
