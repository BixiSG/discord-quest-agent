// Seeded PRNG (sfc32) with a splitmix32 seeder. The state is four uint32s so
// it serialises as a plain array; runs store it and replay exactly.

export type RngState = [number, number, number, number];

function splitmix32(a: number): () => number {
    return () => {
        a = (a + 0x9e3779b9) | 0;
        let t = a ^ (a >>> 16);
        t = Math.imul(t, 0x21f0aaad);
        t ^= t >>> 15;
        t = Math.imul(t, 0x735a2d97);
        t ^= t >>> 15;
        return t >>> 0;
    };
}

/** Mixes any number of integers into one uint32 seed. */
export function hashSeed(...parts: number[]): number {
    let h = 0x811c9dc5;
    for (const p of parts) {
        const sm = splitmix32((h ^ (p | 0)) >>> 0);
        h = (sm() ^ Math.imul(h, 0x01000193)) >>> 0;
    }
    return h >>> 0;
}

export class Rng {
    s: RngState;
    constructor(seed: number | RngState) {
        if (Array.isArray(seed)) { this.s = [seed[0] >>> 0, seed[1] >>> 0, seed[2] >>> 0, seed[3] >>> 0]; return; }
        const sm = splitmix32(seed >>> 0);
        this.s = [sm(), sm(), sm(), sm()];
        for (let i = 0; i < 12; i++) this.u32();
    }
    /** Uniform uint32. */
    u32(): number {
        let [a, b, c, d] = this.s;
        const t = (((a + b) | 0) + d) | 0;
        d = (d + 1) | 0;
        a = b ^ (b >>> 9);
        b = (c + (c << 3)) | 0;
        c = (c << 21) | (c >>> 11);
        c = (c + t) | 0;
        this.s = [a >>> 0, b >>> 0, c >>> 0, d >>> 0];
        return t >>> 0;
    }
    /** Uniform float in [0, 1). */
    next(): number { return this.u32() / 4294967296; }
    /** Uniform float in [lo, hi). */
    range(lo: number, hi: number): number { return lo + (hi - lo) * this.next(); }
    /** Uniform integer in [lo, hi] (inclusive). */
    int(lo: number, hi: number): number { return lo + Math.floor(this.next() * (hi - lo + 1)); }
    chance(p: number): boolean { return p >= 1 || (p > 0 && this.next() < p); }
    pick<T>(arr: readonly T[]): T {
        if (!arr.length) throw new Error("pick from empty array");
        return arr[Math.floor(this.next() * arr.length)] as T;
    }
    /** Weighted pick; returns undefined when every weight is zero. */
    weighted<T>(arr: readonly T[], weight: (t: T) => number): T | undefined {
        let total = 0;
        for (const x of arr) total += Math.max(0, weight(x));
        if (total <= 0) return undefined;
        let r = this.next() * total;
        for (const x of arr) {
            r -= Math.max(0, weight(x));
            if (r < 0) return x;
        }
        return arr[arr.length - 1];
    }
    state(): RngState { return [...this.s] as RngState; }
}
