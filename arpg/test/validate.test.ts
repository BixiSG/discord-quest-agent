import { describe, expect, it } from "vitest";
import { validateState } from "../src/core/validate";
import { SaveError } from "../src/core/save";
import { newGame, sheetOf, receiveItem } from "../src/core/game";
import { advance } from "../src/core/sim/engine";

const g0 = () => newGame({ name: "V", cls: "vanguard", now: 0, seed: 8 });

describe("validateState", () => {
    it("accepts a real game, also after play", () => {
        const g = g0(); advance(g, 30 * 60e3);
        expect(() => validateState(JSON.parse(JSON.stringify(g)))).not.toThrow();
    });
    it("rejects junk", () => {
        for (const bad of [null, {}, { ...g0(), hero: null }, { ...g0(), seed: "x" }, { ...g0(), stash: [{ uid: 1, base: "nope", ilvl: 1, rarity: "plain", affixes: [] }] }])
            expect(() => validateState(structuredClone(bad))).toThrow(SaveError);
    });
    it("repairs small damage", () => {
        const g = g0() as any;
        g.hero.skill = "gone"; g.hero.supports = ["heavyhand", "gone"]; g.activity.zone = "a9_nowhere"; g.hero.passives = ["nope"];
        const s = validateState(g);
        expect(s.hero.skill).toBe("crescent");
        expect(s.hero.supports).toEqual(["heavyhand"]);
        expect(s.activity.zone).toBe("a1_shore");
        expect(s.hero.passives).toEqual([]);
        expect(sheetOf(s).life).toBeGreaterThan(0);
    });
});

describe("stash limits", () => {
    it("auto-equip never salvages worn gear when the stash is full", () => {
        const g = g0();
        g.stashCap = 0;
        const weapon = g.hero.equipment.weapon!;
        const big = { uid: 77, base: "sword1", ilvl: 1, rarity: "rare" as const, name: "Big", affixes: [{ id: "phys_local", tier: 0, rolls: [500] }] };
        receiveItem(g, big);
        expect(g.hero.equipment.weapon).toBe(weapon);
        g.stashCap = 60;
        receiveItem(g, { ...big, uid: 78 });
        expect(g.hero.equipment.weapon?.uid).toBe(78);
        expect(g.stash.map(x => x.uid)).toContain(weapon.uid);
        expect(g.stashFull).toBe(true);
    });
});

import { applyCurrency } from "../src/core/crafting";
import { salvageValue } from "../src/core/items";

describe("P2 review fixes", () => {
    it("drops broken filter rules and bad relic data, trims passives", () => {
        const g = g0() as any;
        g.settings.filter = [null, { action: "nope" }, { on: true, action: "keep", rarity: ["rare", 5] }];
        g.hero.level = 5;
        g.hero.passives = Array(50).fill("keystone0").concat(["start_vanguard", "vanguard_in0"]);
        const s = validateState(g);
        expect(s.settings.filter).toEqual([{ on: true, action: "keep", rarity: ["rare"] }]);
        expect(s.hero.passives).toEqual(["vanguard_in0"]);
        const r = g0() as any;
        r.stash.push({ uid: 5, base: "ring_ember", ilvl: 30, rarity: "relic", relic: "emberknot", relicRolls: ["x", 1, 1], affixes: [] });
        expect(() => validateState(r)).toThrow(SaveError);
        const r2 = g0() as any;
        r2.stash.push({ uid: 5, base: "ring_ember", ilvl: 30, rarity: "rare", relic: "emberknot", affixes: [] });
        expect(() => validateState(r2)).toThrow(SaveError);
    });
    it("crafted items salvage as plain", () => {
        const g = g0();
        g.stash.push({ uid: 9, base: "plate_body6", ilvl: 70, rarity: "plain", affixes: [] });
        g.currency.kindling = 1;
        const plain = salvageValue(g.stash[0]!);
        expect(applyCurrency(g, "kindling", 9)).toBeNull();
        expect(salvageValue(g.stash[0]!)).toBe(plain);
    });
    it("a full stash still takes upgrades, giving up its weakest item", () => {
        const g = g0();
        g.stashCap = 2;
        const worn = g.hero.equipment.weapon!.uid;
        g.stash.push({ uid: 101, base: "sword1", ilvl: 1, rarity: "plain", affixes: [] }, { uid: 102, base: "ring_iron", ilvl: 5, rarity: "rare", affixes: [], name: "X" });
        const r = receiveItem(g, { uid: 103, base: "sword1", ilvl: 1, rarity: "rare", name: "Big", affixes: [{ id: "phys_local", tier: 0, rolls: [500] }] });
        expect(r.equipped).toBe(true);
        expect(g.stash.map(x => x.uid).sort()).toEqual([102, worn].sort());
    });
});
