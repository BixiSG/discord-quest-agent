// Round 4: companions.

import { describe, expect, it } from "vitest";
import { ACT_COMPANION, COMPANIONS, COMPANION_MAX_LEVEL, DUPLICATE_BOND, bondFor, companionLevel, companionText } from "../src/core/data";
import { addBond, grantCompanion, petKill, rollCompanionDrop, setCompanion } from "../src/core/companions";
import { newGame, sheetOf } from "../src/core/game";
import { Rng } from "../src/core/rng";
import { MIGRATIONS, unwrap } from "../src/core/save";
import { reconcileRewards } from "../src/core/sim/engine";
import { validateState } from "../src/core/validate";
import { claimContract, ensureContracts } from "../src/core/contracts";

const g0 = () => newGame({ name: "T", cls: "vanguard", now: 0, seed: 21 });

describe("companions", () => {
    it("data: every companion has art, a bonus text and a level curve that climbs", () => {
        for (const c of Object.values(COMPANIONS)) {
            expect(c.sprite).toBeTruthy();
            expect(companionText(c.id, 10)).not.toMatch(/\{|undefined/);
        }
        for (let l = 2; l <= COMPANION_MAX_LEVEL; l++) expect(bondFor(l)).toBeGreaterThan(bondFor(l - 1));
        expect(companionLevel(0)).toBe(1);
        expect(companionLevel(bondFor(COMPANION_MAX_LEVEL) * 5)).toBe(COMPANION_MAX_LEVEL);
    });
    it("the first one found goes out and shows on the sheet; kills level it up", () => {
        const g = g0();
        const armour0 = sheetOf(g).armour;
        expect(grantCompanion(g, "saltcrab")).toBe(true);
        expect(g.hero.pet).toEqual({ id: "saltcrab", level: 1 });
        expect(sheetOf(g).bag.mods("armour").some(m => m.src === "Companion: Salt Crab")).toBe(true);
        let ups = 0;
        for (let i = 0; i < bondFor(3); i++) if (petKill(g)) ups++;
        expect(g.hero.pet!.level).toBe(3);
        expect(ups).toBe(2);
        expect(sheetOf(g).armour).toBeGreaterThanOrEqual(armour0);
    });
    it("a duplicate adds bond; switching keeps each one's own level", () => {
        const g = g0();
        grantCompanion(g, "saltcrab");
        expect(grantCompanion(g, "saltcrab")).toBe(false);
        expect(g.companions.saltcrab).toBe(DUPLICATE_BOND);
        expect(g.hero.pet!.level).toBe(companionLevel(DUPLICATE_BOND));
        grantCompanion(g, "bogimp");
        expect(g.hero.pet!.id).toBe("saltcrab"); // a new one doesn't push out the one already out
        expect(setCompanion(g, "bogimp")).toBeNull();
        expect(g.hero.pet).toEqual({ id: "bogimp", level: 1 });
        expect(setCompanion(g, "ashpup")).toMatch(/not found/);
        expect(setCompanion(g, null)).toBeNull();
        expect(g.hero.pet).toBeUndefined();
        expect(addBond(g, "saltcrab", 10)).toBe(false); // not out: no level-up event
    });
    it("act bosses give theirs once, also to saves from before companions", () => {
        const g = g0();
        g.world.clears.a1_lock = 1;
        reconcileRewards(g);
        reconcileRewards(g);
        expect(Object.keys(g.companions)).toEqual([ACT_COMPANION[1]]);
        expect(g.world.rewards.filter(r => r === "pet:act1").length).toBe(1);
        // A v5 save with act 1 done gets the crab on load.
        const old = g0() as any;
        old.world.clears.a1_lock = 1;
        delete old.companions;
        const env = unwrap<any>({ game: "hollowmarch", v: 5, savedAt: 1, state: old }, MIGRATIONS, 6);
        const s = validateState(env.state);
        expect(s.companions).toHaveProperty("saltcrab");
        expect(s.hero.pet?.id).toBe("saltcrab");
    });
    it("boss drops prefer unfound companions of the boss's level", () => {
        const g = g0();
        const rng = new Rng(5);
        const got = new Set<string>();
        for (let i = 0; i < 40; i++) { const id = rollCompanionDrop(g, rng, 25, 1); if (id) got.add(id); }
        for (const id of got) expect(COMPANIONS[id]!.level).toBeLessThanOrEqual(25);
        expect(got.size).toBeGreaterThanOrEqual(4);
        expect(rollCompanionDrop(g, rng, 25, 0)).toBeNull();
    });
    it("the validator drops unknown companions and fixes the one out", () => {
        const g = g0() as any;
        g.companions = { saltcrab: 5000.7, nope: 3, gullchick: -2 };
        g.hero.pet = { id: "saltcrab", level: 99 };
        let s = validateState(g);
        expect(s.companions).toEqual({ saltcrab: 5000 });
        expect(s.hero.pet).toEqual({ id: "saltcrab", level: companionLevel(5000) });
        const g2 = g0() as any;
        g2.hero.pet = { id: "ashpup", level: 3 };
        s = validateState(g2);
        expect(s.hero.pet).toBeUndefined();
    });
    it("a contract can pay a companion not met yet", () => {
        const g = g0();
        g.hero.level = 60;
        ensureContracts(g);
        const c = g.contracts.list[0]!;
        c.extra = "companion"; c.n = c.target;
        expect(claimContract(g, 0)).toBeNull();
        expect(Object.keys(g.companions).length).toBe(1);
    });
});
