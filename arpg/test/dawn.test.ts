// Round 5: the Rekindling.

import { describe, expect, it } from "vitest";
import { DAWN_TOUGHER, PINNACLES } from "../src/core/data";
import { enrage } from "../src/core/sim/engine";
import { chooseDawnPerk, dawnEffects, dawnOf, heirloomCandidates, perksToPick, relightSun } from "../src/core/dawn";
import { buyStashRoom, newGame, receiveItem, salvage, sheetOf, stashRoomCost } from "../src/core/game";
import { validateState } from "../src/core/validate";
import { grantCompanion } from "../src/core/companions";
import { addStone } from "../src/core/sockets";
import type { Item } from "../src/core/types";

const shardsHeld = () => {
    const g = newGame({ name: "Ash", cls: "vanguard", now: 0, seed: 71 });
    g.hero.level = 80; g.dust = 5e5; g.world.clears.a3_sunfall = 1;
    for (const p of Object.keys(PINNACLES)) g.pinnacleKills[p] = 1;
    return g;
};

describe("relighting the sun", () => {
    it("needs the three sun shards (the Hollow Crown is optional)", () => {
        const g = newGame({ name: "Ash", cls: "vanguard", now: 0, seed: 71 });
        expect(relightSun(g)).toMatch(/shards/);
    });
    it("a new hero on the shore; what was collected carries over, with one heirloom", () => {
        const g = shardsHeld();
        grantCompanion(g, "saltcrab");
        g.companions.saltcrab = 9000;
        g.echoes = ["bell", "warden", "saltchild", "regent"];
        addStone(g, "ruby:3", 2);
        g.hero.equipment.weapon!.sockets = 1; g.hero.equipment.weapon!.stones = ["topaz:2"];
        g.codex = { lampwick: 1 };
        const heir: Item = { uid: 900, base: "sword5", ilvl: 70, rarity: "rare", name: "Heir", affixes: [] };
        const other: Item = { uid: 901, base: "sword5", ilvl: 70, rarity: "rare", name: "Lost", affixes: [] };
        g.stash.push(heir, other);
        g.stashCap = 80;
        expect(heirloomCandidates(g).map(x => x.uid)).toContain(900);
        const ref = g;
        expect(relightSun(g, { heirloom: 900, cls: "arcanist" })).toBeNull();
        expect(g).toBe(ref); // rebuilt in place
        expect(dawnOf(g)).toBe(1);
        expect(g.hero.level).toBe(1);
        expect(g.hero.cls).toBe("arcanist");
        expect(g.hero.bonusPoints).toBe(1);
        expect(g.hero.pet?.id).toBe("saltcrab");
        expect(g.companions.saltcrab).toBe(9000);
        expect(g.echoes.length).toBe(4);
        expect(g.stones["ruby:3"]).toBe(2);
        expect(g.stones["topaz:2"]).toBe(1); // from the gear left behind
        expect(g.codex).toEqual({ lampwick: 1 });
        expect(g.stash.map(x => x.uid)).toEqual([900]);
        expect(g.stash[0]!.locked).toBe(true);
        expect(g.stashCap).toBe(80);
        expect(g.dust).toBe(0);
        expect(g.pinnacleKills).toEqual({});
        expect(g.world.unlocked).toEqual(["a1_shore"]);
        expect(g.atlas.points).toBe(1); // four echoes: one point kept
        expect(g.world.rewards).toEqual(["echo:1"]);
        expect(validateState(structuredClone(g)).hero.dawn).toEqual({ level: 1, perks: [] });
    });
    it("each dawn: a perk to pick, more experience and dust, a tougher and richer world", () => {
        const g = shardsHeld();
        relightSun(g);
        expect(perksToPick(g)).toBe(1);
        expect(chooseDawnPerk(g, "nope")).toMatch(/unknown/);
        const life0 = sheetOf(g).life;
        expect(chooseDawnPerk(g, "steadyflame")).toBeNull();
        expect(sheetOf(g).life).toBeGreaterThan(life0);
        expect(chooseDawnPerk(g, "keeneye")).toMatch(/no pick/);
        expect(sheetOf(g).bag.mods("xpGain").some(m => m.src === "Dawn I")).toBe(true);
        const eff = dawnEffects(g, {}, null)!;
        expect(eff.life).toBeCloseTo(1 + DAWN_TOUGHER / 100);
        expect(eff.rarity).toBe(20);
        const plain: Item = { uid: 950, base: "ring_iron", ilvl: 50, rarity: "rare", name: "R", affixes: [] };
        g.stash.push(plain);
        const d0 = g.dust;
        salvage(g, [plain.uid]);
        const fresh = newGame({ name: "x", cls: "vanguard", now: 0, seed: 1 });
        fresh.stash.push({ ...plain });
        salvage(fresh, [plain.uid]);
        expect(g.dust - d0).toBeGreaterThan(fresh.dust);
    });
    it("Deep Pockets: 20 slots now and 20 more room to buy", () => {
        const g = shardsHeld();
        relightSun(g);
        const cap = g.stashCap;
        chooseDawnPerk(g, "deeppockets");
        expect(g.stashCap).toBe(cap + 20);
        g.dust = 1e9;
        while (stashRoomCost(g) !== null) buyStashRoom(g);
        expect(g.stashCap).toBe(170);
        void receiveItem;
    });
});

describe("the calendar across a dawn", () => {
    it("keeps the UTC offset, the Hollow Night tallies and the announced-event marks", () => {
        const g = shardsHeld();
        g.tz = 180; g.events = { hollownight2026: 42 }; g.world.rewards.push("season:hollownight2026");
        expect(relightSun(g)).toBeNull();
        expect(g.tz).toBe(180);
        expect(g.events).toEqual({ hollownight2026: 42 });
        expect(g.world.rewards).toContain("season:hollownight2026");
        expect(g.world.rewards.some(r => r.startsWith("act:"))).toBe(false);
    });
});

describe("pinnacles enrage", () => {
    it("hit as usual for 90 seconds, then 2% harder every second", () => {
        expect(enrage(0)).toBe(1);
        expect(enrage(90)).toBe(1);
        expect(enrage(140)).toBeCloseTo(2);
        expect(enrage(240)).toBeCloseTo(4);
    });
});
