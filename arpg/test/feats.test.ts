// Round 8: feats, renown and titles.
import { describe, expect, it } from "vitest";
import { FEATS, FEAT_ORDER, RENOWN_DAMAGE, RENOWN_LIFE, xpToNext } from "../src/core/data";
import { checkFeats, featProgress, renownOf, setTitle } from "../src/core/feats";
import { newGame, sheetOf } from "../src/core/game";
import { relightSun } from "../src/core/dawn";
import { unwrap, wrap } from "../src/core/save";
import { validateState } from "../src/core/validate";
import { gainXp, step } from "../src/core/sim/engine";
import type { GameState } from "../src/core/state";

const g0 = (cls = "vanguard"): GameState => newGame({ name: "F", cls, now: 0, seed: 21 });

describe("feats", () => {
    it("are well formed: ids, groups, goals, renown 1-3, twelve titles, Crownbreaker last", () => {
        expect(FEAT_ORDER.length).toBe(37);
        for (const id of FEAT_ORDER) {
            const f = FEATS[id]!;
            expect(f.goal, id).toBeGreaterThan(0);
            expect([1, 2, 3]).toContain(f.renown);
            // The goal is in the text, or said in words ("the third dawn", "every relic").
            expect(f.text.includes("{n}") || f.goal === 1 || ["relicsall", "companions", "dawn3"].includes(id), id).toBe(true);
        }
        expect(FEAT_ORDER.filter(id => FEATS[id]!.title).length).toBe(12);
        expect(FEAT_ORDER[FEAT_ORDER.length - 1]).toBe("crown");
    });
    it("a new hero has none, and progress is read from the state", () => {
        const g = g0();
        expect(checkFeats(g)).toEqual([]);
        expect(g.feats).toEqual([]);
        expect(g.hero.renown).toBeUndefined();
        g.totals.kills = 4000;
        expect(featProgress(g, "kills10k")).toBe(4000);
        g.totals.kills = 1e9;
        expect(featProgress(g, "kills10k")).toBe(10000);
    });
    it("earning one writes a line, pays renown into the sheet and wears its title when none is worn", () => {
        const g = g0();
        const before = sheetOf(g);
        g.totals.kills = 10_000;
        g.world.clears.a4_lamphouse = 1;
        const events: string[] = [];
        expect(checkFeats(g, { onFeat: id => events.push(id) })).toEqual(["act4", "kills10k"]);
        expect(events).toEqual(["act4", "kills10k"]);
        expect(g.hero.renown).toBe(3);
        expect(g.title).toBe("act4");
        expect(g.log.filter(e => e.key === "log.featEarned").length).toBe(2);
        const after = sheetOf(g);
        expect(after.bag.mods("damage").find(m => m.src === "Renown")?.value).toBe(3 * RENOWN_DAMAGE);
        expect(after.bag.mods("life").find(m => m.src === "Renown")?.value).toBe(3 * RENOWN_LIFE);
        expect(after.life).toBeGreaterThan(before.life);
        // Once earned, always earned, and not again.
        g.world.clears.a4_lamphouse = 0;
        expect(checkFeats(g)).toEqual([]);
        expect(featProgress(g, "act4")).toBe(1);
    });
    it("the simulation counts bosses and earns feats as runs finish", () => {
        const g = g0();
        g.hero.level = 40; g.hero.rev++;
        g.totals.bosses = 99;
        g.world.unlocked.push("a1_saltmire", "a1_chapel");
        g.activity.zone = "a1_chapel"; g.activity.autoPush = false; g.activity.run = null;
        const got: string[] = [];
        for (let i = 0; i < 20000 && !got.includes("bosses100"); i++) step(g, { feat: id => got.push(id) });
        expect(g.totals.bosses).toBeGreaterThanOrEqual(100);
        expect(got).toContain("bosses100");
        expect(g.feats).toContain("bosses100");
    });
    it("titles: only earned titled feats, and one can go bare", () => {
        const g = g0();
        expect(setTitle(g, "act1")).toMatch(/not a title/);
        expect(setTitle(g, "crown")).toMatch(/not earned/);
        g.feats.push("crown");
        expect(setTitle(g, "crown")).toBeNull();
        expect(g.title).toBe("crown");
        expect(setTitle(g, null)).toBeNull();
        expect(g.title).toBeUndefined();
    });
    it("a save from before feats earns what it already did on load, quietly, and wears the latest title", () => {
        const g = g0();
        g.hero.level = 80;
        for (const z of ["a1_lock", "a2_throne", "a3_sunfall", "a4_lamphouse", "a1_trial", "a2_trial", "a3_trial", "a4_trial"]) g.world.clears[z] = 2;
        g.hero.dawn = { level: 2, perks: ["firstlight", "brightember"], crown: true };
        g.pinnacleKills = { drownedsun: 3 };
        g.contracts.done = 30;
        const old = structuredClone(g) as Partial<GameState>;
        delete old.feats; delete old.title;
        delete (old.totals as Partial<GameState["totals"]>).bosses; delete (old.totals as Partial<GameState["totals"]>).contracts;
        const env = unwrap<GameState>({ ...wrap(old, 0), v: 8 });
        expect(env.state.totals.bosses).toBe(4 * 2 + 4 * 2 + 3); // boss-zone clears and pinnacle kills
        expect(env.state.totals.contracts).toBe(30);
        const s = validateState(env.state);
        for (const id of ["act1", "act2", "act3", "act4", "trials", "level50", "level75", "drownedsun", "dawn1", "crown", "contracts25"]) expect(s.feats, id).toContain(id);
        expect(s.title).toBe("crown");
        expect(s.hero.renown).toBe(renownOf(s.feats));
        expect(s.log.filter(e => e.key === "log.featEarned")).toHaveLength(0);
        expect(s.log.filter(e => e.key === "log.featsBefore")).toHaveLength(1);
        // Loading again changes nothing.
        const again = validateState(structuredClone(s));
        expect(again.feats).toEqual(s.feats);
        expect(again.log.filter(e => e.key === "log.featsBefore")).toHaveLength(1);
    });
    it("validation drops unknown feats and a title that isn't earned or isn't one", () => {
        const g = g0();
        g.feats = ["act1", "nope", "act1", "crown"];
        g.title = "act1";
        const s = validateState(structuredClone(g));
        expect(s.feats).toEqual(["act1", "crown"]);
        expect(s.title).toBeUndefined();
        const h = structuredClone(g); h.feats = ["act1"]; h.title = "crown";
        expect(validateState(h).title).toBeUndefined();
    });
    it("relighting keeps feats, the title and renown", () => {
        const g = g0();
        g.feats = ["crown", "kills10k"]; g.title = "crown"; g.hero.renown = 4;
        g.pinnacleKills = { drownedsun: 1, glasschoir: 1, ashenking: 1 };
        expect(relightSun(g)).toBeNull();
        expect(g.feats).toEqual(["crown", "kills10k"]);
        expect(g.title).toBe("crown");
        expect(g.hero.renown).toBe(4);
        expect(checkFeats(g)).toContain("dawn1");
        expect(g.hero.renown).toBe(4 + FEATS.dawn1!.renown);
    });
    it("level feats follow the hero's level as it is reached", () => {
        const g = g0();
        g.hero.level = 49; g.hero.xp = 0;
        gainXp(g, xpToNext(49));
        expect(checkFeats(g)).toEqual(["level50"]);
    });
    it("every feat's progress function exists and runs on a fresh and a busy state", () => {
        const g = g0();
        for (const id of FEAT_ORDER) expect(Number.isFinite(featProgress(g, id)), id).toBe(true);
        g.echoes = ["x"]; g.codex = { tidebreaker: 1, hollowgrin: 1 }; g.companions = { saltcrab: 70000, pumpkinwisp: 0 };
        g.stones = { "ruby:4": 1 }; g.atlas.tiers = [3, 16, 21];
        expect(featProgress(g, "relicsall")).toBe(1); // the seasonal relic doesn't count
        expect(featProgress(g, "companions")).toBe(1);
        expect(featProgress(g, "bond")).toBe(20);
        expect(featProgress(g, "radiant")).toBe(1);
        expect(featProgress(g, "tier16")).toBe(16);
        expect(featProgress(g, "depth10")).toBe(5);
    });
});
