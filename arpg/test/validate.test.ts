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
