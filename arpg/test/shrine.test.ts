// Round 4: the ember shrine.

import { describe, expect, it } from "vitest";
import { BLESSING_MS, ORB_RESERVE, bless, blessing, blessingCost, setKeep, spareOrbValue, tickShrine } from "../src/core/shrine";
import { CURRENCIES } from "../src/core/data";
import { newGame } from "../src/core/game";
import { validateState } from "../src/core/validate";
import { MIGRATIONS, unwrap } from "../src/core/save";

const g0 = () => newGame({ name: "T", cls: "vanguard", now: 1000, seed: 31 });

describe("ember shrine", () => {
    it("an hour of a blessing for dust, priced by level; offering again extends it", () => {
        const g = g0();
        expect(bless(g, "insight", false)).toMatch(/dust/);
        const cost = blessingCost(g);
        g.dust = cost * 2;
        expect(bless(g, "insight", false)).toBeNull();
        expect(g.dust).toBe(cost);
        expect(blessing(g, "insight")).toBe(20);
        expect(bless(g, "insight", false)).toBeNull();
        expect(g.blessings.insight).toBe(g.simTo + 2 * BLESSING_MS);
        g.simTo += 2 * BLESSING_MS;
        expect(blessing(g, "insight")).toBe(0);
        const late = g0(); late.hero.level = 70;
        expect(blessingCost(late)).toBeGreaterThan(blessingCost(g) * 10);
    });
    it("spare orbs pay first, most plentiful first, keeping a reserve of each", () => {
        const g = g0();
        g.hero.level = 40;
        const cost = blessingCost(g);
        g.currency = { kindling: ORB_RESERVE + 1000, starfall: ORB_RESERVE + 1, salt: 10 };
        expect(spareOrbValue(g)).toBe(1000 * CURRENCIES.kindling!.cost + CURRENCIES.starfall!.cost);
        expect(bless(g, "fortune", true)).toBeNull();
        expect(g.currency.kindling).toBe(ORB_RESERVE + 1000 - Math.ceil(cost / CURRENCIES.kindling!.cost));
        expect(g.currency.starfall).toBe(ORB_RESERVE + 1);
        expect(g.currency.salt).toBe(10);
        expect(g.dust).toBe(0);
    });
    it("kept-up blessings renew when they run out, while it can be paid", () => {
        const g = g0();
        setKeep(g, "plenty", true);
        g.dust = blessingCost(g);
        tickShrine(g);
        expect(blessing(g, "plenty")).toBe(15);
        g.simTo += BLESSING_MS + 1;
        tickShrine(g); // no dust left: stays off
        expect(blessing(g, "plenty")).toBe(0);
        setKeep(g, "plenty", false);
        expect(g.shrine.keep).toEqual([]);
    });
    it("old saves get an empty shrine; the validator drops unknown blessings", () => {
        const g = g0() as any;
        delete g.blessings; delete g.shrine;
        const env = unwrap<any>({ game: "hollowmarch", v: 5, savedAt: 1, state: g }, MIGRATIONS, 6);
        const s = validateState(env.state);
        expect(s.blessings).toEqual({});
        expect(s.shrine).toEqual({ keep: [], orbs: true });
        const b = g0() as any;
        b.blessings = { insight: 5000, nope: 9 };
        b.shrine = { keep: ["nope", "hoard", "hoard"], orbs: "x" };
        const s2 = validateState(b);
        expect(s2.blessings).toEqual({ insight: 5000 });
        expect(s2.shrine).toEqual({ keep: ["hoard"], orbs: true });
    });
});
