import { describe, expect, it } from "vitest";
import { SaveError, exportText, importText, unwrap, wrap } from "../src/core/save";

describe("save envelope", () => {
    it("round-trips through the export text, ASCII only", () => {
        const env = wrap({ name: "Émile", n: [1, 2] }, 123);
        const text = exportText(env);
        expect(/^[\x20-\x7e]+$/.test(text)).toBe(true);
        expect(unwrap(importText(text))).toEqual(env);
    });
    it("runs migrations in order", () => {
        const migs = { 1: (s: any) => ({ ...s, a: 1 }), 2: (s: any) => ({ ...s, b: s.a + 1 }) };
        const out = unwrap<any>({ game: "hollowmarch", v: 1, savedAt: 5, state: {} }, migs, 3);
        expect(out.v).toBe(3);
        expect(out.state).toEqual({ a: 1, b: 2 });
    });
    it("rejects junk, newer versions and gaps", () => {
        expect(() => unwrap(null)).toThrow(SaveError);
        expect(() => unwrap({ game: "other", v: 1 })).toThrow(SaveError);
        expect(() => unwrap({ game: "hollowmarch", v: 99, state: {} })).toThrow(/newer/);
        expect(() => unwrap({ game: "hollowmarch", v: 1, state: {} }, {}, 2)).toThrow(/migration/);
        expect(() => importText("HM1:@@@")).toThrow(SaveError);
    });
});
