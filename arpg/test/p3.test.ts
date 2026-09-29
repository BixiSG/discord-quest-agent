import { describe, expect, it } from "vitest";
import { ACTS, ASCENDANCIES, CLASSES, TRIAL_AFTER, ZONES, ZONE_ORDER } from "../src/core/data";
import { newGame, sheetOf } from "../src/core/game";
import { ascPointsLeft, chooseAscendancy, takeAscNode } from "../src/core/passives";
import { step } from "../src/core/sim/engine";
import { MIGRATIONS, unwrap } from "../src/core/save";
import type { GameState } from "../src/core/state";

const g0 = () => newGame({ name: "P", cls: "vanguard", now: 0, seed: 12 });

/** Makes the current run finish on the next step. */
function finishRun(g: GameState): void {
    step(g);
    g.activity.run!.phase = "done";
    step(g);
}

describe("acts, trials, ascendancies", () => {
    it("content: four acts, each with a trial off the main road", () => {
        expect(ACTS.length).toBe(4);
        for (const a of ACTS) {
            expect(ZONES[a.trial]?.trial).toBe(true);
            expect(ZONE_ORDER).not.toContain(a.trial);
            expect(ZONES[a.zones[a.zones.length - 1]!]!.boss).toBeTruthy();
            expect(a.outro.length).toBeGreaterThan(10);
        }
        for (const [t, after] of Object.entries(TRIAL_AFTER)) { expect(ZONES[t]?.trial).toBe(true); expect(ZONE_ORDER).toContain(after); }
        for (const c of Object.values(CLASSES)) expect(Object.values(ASCENDANCIES).filter(a => a.cls === c.id).length).toBe(2);
        for (let i = 1; i < ZONE_ORDER.length; i++) expect(ZONES[ZONE_ORDER[i]!]!.level).toBeGreaterThanOrEqual(ZONES[ZONE_ORDER[i - 1]!]!.level);
    });
    it("clearing the chapel opens the trial; the trial grants ascendancy points and sends the hero back", () => {
        const g = g0();
        g.world.unlocked.push("a1_saltmire", "a1_chapel");
        g.activity.zone = "a1_chapel"; g.activity.run = null;
        finishRun(g);
        expect(g.world.unlocked).toContain("a1_trial");
        g.activity.zone = "a1_trial"; g.activity.run = null;
        finishRun(g);
        expect(g.hero.ascPoints).toBe(2);
        expect(g.activity.zone).not.toBe("a1_trial");
        expect(g.log.some(l => l.text.includes("Drowned Knight"))).toBe(true);
        finishRun(g); // second clear: no more points
        expect(g.hero.ascPoints).toBe(2);
    });
    it("an act's final boss gives passive points once", () => {
        const g = g0();
        g.world.unlocked.push("a1_lock");
        g.activity.zone = "a1_lock"; g.activity.autoPush = false; g.activity.run = null;
        finishRun(g);
        expect(g.hero.bonusPoints).toBe(2);
        expect(g.world.unlocked).toContain("a2_dunes");
        finishRun(g);
        expect(g.hero.bonusPoints).toBe(2);
    });
    it("ascendancy rules", () => {
        const g = g0();
        expect(chooseAscendancy(g, "bastion")).toMatch(/trial/);
        g.hero.ascPoints = 2;
        expect(chooseAscendancy(g, "lumen")).toMatch(/calling/);
        expect(chooseAscendancy(g, "bastion")).toBeNull();
        expect(chooseAscendancy(g, "reaver")).toMatch(/already/);
        const life0 = sheetOf(g).life;
        expect(takeAscNode(g, "bastion_2")).toBeNull();
        expect(sheetOf(g).life).toBeGreaterThan(life0);
        expect(takeAscNode(g, "reaver_1")).toMatch(/not in/);
        expect(takeAscNode(g, "bastion_1")).toBeNull();
        expect(ascPointsLeft(g.hero)).toBe(0);
        expect(takeAscNode(g, "bastion_3")).toMatch(/points/);
    });
    it("v2 saves migrate to v3", () => {
        const s = g0() as any;
        delete s.hero.ascNodes; delete s.hero.ascPoints;
        const env = unwrap<any>({ game: "hollowmarch", v: 2, savedAt: 0, state: s }, MIGRATIONS, 3);
        expect(env.state.hero.ascNodes).toEqual([]);
        expect(env.state.hero.ascPoints).toBe(0);
    });
});
