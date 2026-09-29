import { describe, expect, it } from "vitest";
import { StatBag, tagSet } from "../src/core/stats";

describe("StatBag", () => {
    it("applies flat, then summed inc, then multiplied more", () => {
        const b = new StatBag([
            { stat: "life", kind: "flat", value: 10 },
            { stat: "life", kind: "inc", value: 20 },
            { stat: "life", kind: "inc", value: 30 },
            { stat: "life", kind: "more", value: 10 },
            { stat: "life", kind: "more", value: 10 },
        ]);
        expect(b.calc("life", 90)).toBeCloseTo(100 * 1.5 * 1.21);
    });
    it("only applies tagged modifiers when every tag matches", () => {
        const b = new StatBag([
            { stat: "damage", kind: "inc", value: 50, tags: ["spell"] },
            { stat: "damage", kind: "inc", value: 20, tags: ["melee", "phys"] },
            { stat: "damage", kind: "inc", value: 10 },
        ]);
        expect(b.inc("damage", tagSet(["attack", "melee"]))).toBe(10);
        expect(b.inc("damage", tagSet(["attack", "melee", "phys"]))).toBe(30);
        expect(b.inc("damage", tagSet(["spell"]))).toBe(60);
        expect(b.inc("damage")).toBe(10);
    });
    it("floors increase multipliers at zero", () => {
        const b = new StatBag([{ stat: "attackSpeed", kind: "inc", value: -150 }]);
        expect(b.incMult("attackSpeed")).toBe(0);
    });
});
