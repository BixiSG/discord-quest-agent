// The packed language tables of the shipped build: the inflater against node's
// zlib (stored, fixed and dynamic blocks), and a packed table reading back the
// same strings as the source one.
import { constants, deflateRawSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { inflateRaw } from "../src/i18n/inflate";
import { lazyRecord, unpack } from "../src/i18n/pack";
import { RU, RU_GENDER } from "../src/i18n/ru";
import { UK } from "../src/i18n/uk";
import { Rng } from "../src/core/rng";

const bytes = (b: Buffer): Uint8Array => new Uint8Array(b.buffer, b.byteOffset, b.length);

describe("inflateRaw", () => {
    const text = Buffer.from(JSON.stringify({ RU, UK }), "utf8");
    const rng = new Rng(7);
    const noise = Buffer.from(Array.from({ length: 70000 }, () => Math.floor(rng.next() * 256)));
    const cases: [string, Buffer][] = [["empty", Buffer.alloc(0)], ["one byte", Buffer.from("a")], ["tables", text], ["noise", noise],
        ["runs", Buffer.from("ab".repeat(40000) + "z".repeat(1000))]];
    for (const [name, input] of cases) {
        it(`${name}: stored, fixed and dynamic blocks`, () => {
            for (const opts of [{ level: 0 }, { level: 1 }, { level: 9 }, { level: 9, strategy: constants.Z_FIXED }, { level: 6, strategy: constants.Z_RLE }]) {
                const out = inflateRaw(bytes(deflateRawSync(input, opts)));
                expect(Buffer.from(out).equals(input)).toBe(true);
            }
        });
    }
    it("throws on truncated data", () => {
        const z = deflateRawSync(text, { level: 9 });
        expect(() => inflateRaw(bytes(z.subarray(0, z.length >> 1)))).toThrow(/inflate/);
    });
});

describe("packed tables", () => {
    const pack = (v: unknown): string => deflateRawSync(Buffer.from(JSON.stringify(v), "utf8"), { level: 9 }).toString("base64");

    it("unpack reads back the Cyrillic tables exactly", () => {
        expect(unpack(pack({ t: RU, g: RU_GENDER }))).toEqual({ t: RU, g: RU_GENDER });
    });

    it("lazyRecord builds once, on first touch, and reads like a plain record", () => {
        let built = 0;
        const rec = lazyRecord(() => { built++; return { a: "x", b: "y" } as Record<string, string>; });
        expect(built).toBe(0);
        expect(rec["a"]).toBe("x");
        expect(rec["zz"]).toBeUndefined();
        expect(rec["toString"]).toBeUndefined();
        expect("b" in rec).toBe(true);
        expect(Object.keys(rec)).toEqual(["a", "b"]);
        expect(Object.entries(rec)).toEqual([["a", "x"], ["b", "y"]]);
        expect(Object.values(rec)).toEqual(["x", "y"]);
        expect(built).toBe(1);
    });
});
