import { describe, expect, it } from "vitest";
import { advance, STEP_MS, MAX_OFFLINE_MS } from "../src/core/sim/engine";
import { newGame } from "../src/core/game";

const HOUR = 3600e3;

describe("simulation", () => {
    it("is deterministic: same seed and time, same state", () => {
        const a = newGame({ name: "A", cls: "vanguard", now: 0, seed: 9 });
        const b = newGame({ name: "A", cls: "vanguard", now: 0, seed: 9 });
        advance(a, 20 * 60e3);
        advance(b, 20 * 60e3);
        expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    });
    it("slicing the catch-up gives the same result as one call", () => {
        const a = newGame({ name: "A", cls: "vanguard", now: 0, seed: 3 });
        const b = newGame({ name: "A", cls: "vanguard", now: 0, seed: 3 });
        advance(a, 10 * 60e3);
        while (!advance(b, 10 * 60e3, {}, 777));
        expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    });
    it("a fresh hero makes progress in the first hour", () => {
        const g = newGame({ name: "A", cls: "vanguard", now: 0, seed: 5 });
        advance(g, HOUR);
        expect(g.hero.level).toBeGreaterThanOrEqual(5);
        expect(g.totals.runs).toBeGreaterThan(10);
        expect(g.world.unlocked.length).toBeGreaterThan(2);
        expect(g.simTo).toBe(HOUR);
    });
    it("caps offline time", () => {
        const g = newGame({ name: "A", cls: "vanguard", now: 0, seed: 5 });
        advance(g, 3 * MAX_OFFLINE_MS, {}, 10);
        expect(g.simTo).toBe(2 * MAX_OFFLINE_MS + 10 * STEP_MS);
    });
});
