// Round 8: companion errands.
import { describe, expect, it } from "vitest";
import { ERRAND_BOND, ERRAND_MS, ERRAND_SLOTS, errandYield, idleCompanions, recallErrand, scoutTier, sendErrand, tickErrands } from "../src/core/errands";
import { setCompanion } from "../src/core/companions";
import { newGame } from "../src/core/game";
import { relightSun } from "../src/core/dawn";
import { validateState } from "../src/core/validate";
import { advance } from "../src/core/sim/engine";
import type { GameState } from "../src/core/state";
import { companionLevel } from "../src/core/data";

const g0 = (): GameState => {
    const g = newGame({ name: "E", cls: "vanguard", now: 0, seed: 31 });
    g.hero.level = 40; g.hero.rev++;
    g.companions = { saltcrab: 0, bogimp: 5000, lanternwisp: 0, dunepup: 0 };
    g.hero.pet = { id: "saltcrab", level: 1 };
    g.settings.errandKeep = false;
    return g;
};
const time = (g: GameState, ms: number) => { g.simTo += ms; };

describe("companion errands", () => {
    it("send: owned, not the one out, once each, three at a time, scouting only with the Cinderlands", () => {
        const g = g0();
        expect(sendErrand(g, "prismlynx", "scavenge")).toMatch(/not found/);
        expect(sendErrand(g, "saltcrab", "scavenge")).toMatch(/walks with the hero/);
        expect(sendErrand(g, "bogimp", "scout")).toMatch(/Ashfold/);
        expect(sendErrand(g, "bogimp", "scavenge")).toBeNull();
        expect(sendErrand(g, "bogimp", "forage")).toMatch(/already/);
        expect(sendErrand(g, "lanternwisp", "forage")).toBeNull();
        expect(sendErrand(g, "dunepup", "delve")).toBeNull();
        g.companions.ashpup = 0;
        expect(sendErrand(g, "ashpup", "delve")).toMatch(/every errand/);
        expect(g.errands).toHaveLength(ERRAND_SLOTS);
        expect(idleCompanions(g)).toEqual(["ashpup"]);
        expect(setCompanion(g, "bogimp")).toMatch(/errand/);
        expect(recallErrand(g, "bogimp")).toBeNull();
        expect(recallErrand(g, "bogimp")).toMatch(/not on/);
        expect(setCompanion(g, "bogimp")).toBeNull();
    });
    it("come back after two hours of the hero's time with their haul and bond", () => {
        const g = g0();
        sendErrand(g, "bogimp", "scavenge");
        sendErrand(g, "lanternwisp", "forage");
        sendErrand(g, "dunepup", "delve");
        time(g, ERRAND_MS - 1000);
        expect(tickErrands(g)).toEqual([]);
        const dust = g.dust, orbs = Object.values(g.currency).reduce((a, b) => a + b, 0), stones = Object.values(g.stones).reduce((a, b) => a + b, 0);
        time(g, 1000);
        const back: string[] = [];
        expect(tickErrands(g, pet => back.push(pet))).toEqual(["bogimp", "lanternwisp", "dunepup"]);
        expect(back).toHaveLength(3);
        expect(g.dust - dust).toBe(errandYield(g, "scavenge", companionLevel(5000))); // its level as it comes back
        expect(Object.values(g.currency).reduce((a, b) => a + b, 0) - orbs).toBe(errandYield(g, "forage", 1));
        expect(Object.values(g.stones).reduce((a, b) => a + b, 0) - stones).toBe(errandYield(g, "delve", 1));
        expect(g.companions.bogimp).toBe(5000 + ERRAND_BOND);
        expect(g.companions.dunepup).toBe(ERRAND_BOND);
        expect(g.errands).toEqual([]);
        expect(g.log.filter(e => e.key?.startsWith("log.errand")).length).toBe(3);
    });
    it("scouts bring maps a tier deeper than the deepest cleared", () => {
        const g = g0();
        g.world.clears.a4_lamphouse = 1;
        g.atlas.tiers = [1, 2, 3, 4, 5];
        expect(scoutTier(g)).toBe(6);
        sendErrand(g, "bogimp", "scout");
        time(g, ERRAND_MS);
        tickErrands(g);
        expect(g.maps.length).toBe(errandYield(g, "scout", companionLevel(5000)));
        expect(g.maps.every(m => m.tier === 6)).toBe(true);
    });
    it("keep them busy: back ones go again, idle ones fill free errands", () => {
        const g = g0();
        g.settings.errandKeep = true;
        sendErrand(g, "bogimp", "forage");
        tickErrands(g);
        expect(g.errands.map(e => `${e.pet}:${e.kind}`).sort()).toEqual(["bogimp:forage", "dunepup:scavenge", "lanternwisp:scavenge"]);
        time(g, ERRAND_MS);
        tickErrands(g);
        expect(g.errands.map(e => `${e.pet}:${e.kind}`).sort()).toEqual(["bogimp:forage", "dunepup:scavenge", "lanternwisp:scavenge"]);
        expect(g.errands.every(e => e.until === g.simTo + ERRAND_MS)).toBe(true);
    });
    it("run on simulation time: a day away brings a dozen hauls, the same for the same seed", () => {
        const run = () => {
            const g = g0();
            g.settings.errandKeep = true;
            advance(g, 24 * 3600e3);
            return g;
        };
        const a = run(), b = run();
        expect(a.companions).toEqual(b.companions);
        expect(a.dust).toBe(b.dust);
        expect(a.errandSeq).toBeGreaterThanOrEqual(30); // three companions, twelve two-hour errands each
    });
    it("validation keeps sound errands only, and relighting keeps them", () => {
        const g = g0();
        g.errands = [
            { pet: "bogimp", kind: "forage", until: g.simTo + 1000 },
            { pet: "bogimp", kind: "delve", until: 5 },
            { pet: "saltcrab", kind: "delve", until: 5 },
            { pet: "nobody", kind: "delve", until: 5 },
            { pet: "dunepup", kind: "sleep" as never, until: 5 },
            { pet: "lanternwisp", kind: "scavenge", until: g.simTo + 1e12 },
        ];
        const s = validateState(structuredClone(g));
        expect(s.errands.map(e => e.pet)).toEqual(["bogimp", "lanternwisp"]);
        expect(s.errands[1]!.until).toBe(s.simTo + ERRAND_MS);
        s.pinnacleKills = { drownedsun: 1, glasschoir: 1, ashenking: 1 };
        expect(relightSun(s)).toBeNull();
        expect(s.errands.map(e => e.pet)).toEqual(["bogimp", "lanternwisp"]);
    });
});
