// Round 9: skill mastery - points from kills with a skill, levels on the hero, kept across dawns.
import { describe, expect, it } from "vitest";
import { MASTERY_BOSS, MASTERY_MAX, masteryLevel, masteryMods, masteryNeed } from "../src/core/data";
import { deriveSheet } from "../src/core/character";
import { newGame, sheetOf } from "../src/core/game";
import { gainMastery, masteryOf } from "../src/core/mastery";
import { relightSun } from "../src/core/dawn";
import { validateState } from "../src/core/validate";
import { MIGRATIONS, SAVE_VERSION, unwrap } from "../src/core/save";
import { checkFeats } from "../src/core/feats";
import { step } from "../src/core/sim/engine";

const g0 = (seed = 3) => newGame({ name: "T", cls: "vanguard", now: 0, seed });

describe("skill mastery", () => {
    it("levels need 1000 x level squared points, up to ten", () => {
        expect(masteryLevel(0)).toBe(0);
        expect(masteryLevel(999)).toBe(0);
        expect(masteryLevel(1000)).toBe(1);
        expect(masteryLevel(masteryNeed(5))).toBe(5);
        expect(masteryLevel(masteryNeed(5) - 1)).toBe(4);
        expect(masteryLevel(1e12)).toBe(MASTERY_MAX);
    });
    it("gives the skill more damage per level, less mana cost from five, speed at ten", () => {
        expect(masteryMods(0, "attack")).toEqual([]);
        expect(masteryMods(4, "attack").map(m => m.stat)).toEqual(["damage"]);
        expect(masteryMods(5, "spell").map(m => m.stat)).toEqual(["damage", "manaCost"]);
        expect(masteryMods(10, "spell").map(m => m.stat)).toEqual(["damage", "manaCost", "castSpeed"]);
        expect(masteryMods(10, "attack").map(m => m.stat)).toContain("attackSpeed");
    });
    it("only the skill it belongs to gets stronger, through the hero's levels", () => {
        const s = g0(); s.hero.level = 20; s.hero.rev++;
        const dps0 = sheetOf(s).skill.dps;
        const other = s.hero.skill === "crescent" ? "sunder" : "crescent";
        expect(gainMastery(s, other, masteryNeed(3))).toBe(3);
        expect(sheetOf(s).skill.dps).toBeCloseTo(dps0);
        expect(deriveSheet({ ...s.hero, skill: other, rev: -1 }).skill.dps).toBeGreaterThan(deriveSheet({ ...s.hero, mastery: {}, skill: other, rev: -1 }).skill.dps);
        expect(gainMastery(s, s.hero.skill, masteryNeed(6))).toBe(6);
        expect(sheetOf(s).skill.dps).toBeCloseTo(dps0 * 1.09, 1);
        expect(s.log.some(e => e.key === "log.masteryUp")).toBe(true);
    });
    it("kills with the skill in use add points (a boss more), and a new level is heard", () => {
        const s = g0(5);
        const heard: [string, number][] = [];
        for (let i = 0; i < 60000 && (s.mastery[s.hero.skill] ?? 0) < 1000; i++) step(s, { mastery: (sk, n) => heard.push([sk, n]) });
        expect(s.mastery[s.hero.skill]).toBeGreaterThanOrEqual(1000);
        expect(s.totals.kills).toBeLessThanOrEqual(s.mastery[s.hero.skill]!);
        expect(heard).toEqual([[s.hero.skill, 1]]);
        expect(s.hero.mastery?.[s.hero.skill]).toBe(1);
        expect(MASTERY_BOSS).toBeGreaterThan(1);
    });
    it("carries over a new dawn; the feat asks for mastery ten", () => {
        const s = g0();
        gainMastery(s, "quake", masteryNeed(MASTERY_MAX));
        expect(checkFeats(s)).toContain("mastery");
        s.pinnacleKills = { drownedsun: 1, glasschoir: 1, ashenking: 1 };
        expect(relightSun(s)).toBeNull();
        expect(masteryOf(s, "quake")).toBe(MASTERY_MAX);
        expect(s.hero.mastery?.quake).toBe(MASTERY_MAX);
        // Past the top, points stop counting.
        const pts = s.mastery.quake!;
        expect(gainMastery(s, "quake", 500)).toBe(0);
        expect(s.mastery.quake).toBe(pts);
    });
    it("saves: v9 gains an empty mastery; validation keeps known skills and rebuilds the hero's levels", () => {
        expect(SAVE_VERSION).toBe(10);
        const s = g0();
        const raw = JSON.parse(JSON.stringify(s));
        delete raw.mastery; delete raw.hero.mastery;
        const env = unwrap<any>({ game: "hollowmarch", v: 9, savedAt: 0, state: raw }, MIGRATIONS);
        expect(env.state.mastery).toEqual({});
        const bad = JSON.parse(JSON.stringify(s));
        bad.mastery = { quake: masteryNeed(4) + 5.7, toString: 99999, nope: 5000, crescent: -3, sunder: "x" };
        bad.hero.mastery = { quake: 10, sunder: 9 };
        const v = validateState(bad);
        expect(v.mastery).toEqual({ quake: masteryNeed(4) + 5 });
        expect(v.hero.mastery).toEqual({ quake: 4 });
    });
});
