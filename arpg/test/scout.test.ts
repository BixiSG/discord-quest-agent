// Round 4: pinnacle scouting and the map auto-push back-off.

import { describe, expect, it } from "vitest";
import { newGame } from "../src/core/game";
import { scoutPinnacle } from "../src/core/scout";
import { gainXp } from "../src/core/sim/engine";
import { xpToNext } from "../src/core/data";

describe("scouting a pinnacle", () => {
    it("fights on a copy: a fresh hero loses every time and nothing in the real state changes", () => {
        const g = newGame({ name: "T", cls: "vanguard", now: 0, seed: 41 });
        g.world.clears.a3_sunfall = 1;
        const before = JSON.stringify(g);
        const r = scoutPinnacle(g, "drownedsun", 2);
        expect(r).toEqual({ wins: 0, trials: 2, seconds: 0 });
        expect(JSON.stringify(g)).toBe(before);
        expect(scoutPinnacle(g, "nope").trials).toBe(0);
    });
});

describe("map auto-push back-off", () => {
    it("a level-up clears the back-off", () => {
        const g = newGame({ name: "T", cls: "vanguard", now: 0, seed: 41 });
        g.activity.capBackoff = 3;
        gainXp(g, xpToNext(g.hero.level));
        expect(g.activity.capBackoff).toBe(0);
    });
});
