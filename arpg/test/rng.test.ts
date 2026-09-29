import { describe, expect, it } from "vitest";
import { Rng, hashSeed } from "../src/core/rng";

describe("Rng", () => {
    it("is deterministic and resumable from its state", () => {
        const a = new Rng(42), b = new Rng(42);
        const xs = Array.from({ length: 20 }, () => a.u32());
        expect(Array.from({ length: 20 }, () => b.u32())).toEqual(xs);
        const c = new Rng(7); c.next(); const snap = c.state();
        const d = new Rng(snap);
        expect(d.next()).toBe(c.next());
    });
    it("stays in range and is roughly uniform", () => {
        const r = new Rng(1);
        const buckets = new Array(10).fill(0);
        for (let i = 0; i < 20000; i++) { const x = r.next(); expect(x).toBeGreaterThanOrEqual(0); expect(x).toBeLessThan(1); buckets[Math.floor(x * 10)]++; }
        for (const b of buckets) expect(Math.abs(b - 2000)).toBeLessThan(200);
        for (let i = 0; i < 1000; i++) { const n = r.int(3, 5); expect(n).toBeGreaterThanOrEqual(3); expect(n).toBeLessThanOrEqual(5); }
    });
    it("weighted pick respects zero weights", () => {
        const r = new Rng(3);
        for (let i = 0; i < 200; i++) expect(r.weighted(["a", "b", "c"], x => (x === "b" ? 1 : 0))).toBe("b");
        expect(r.weighted([1, 2], () => 0)).toBeUndefined();
    });
    it("hashSeed separates nearby inputs", () => {
        expect(hashSeed(1, 2)).not.toBe(hashSeed(2, 1));
        expect(hashSeed(1, 2)).toBe(hashSeed(1, 2));
    });
});
