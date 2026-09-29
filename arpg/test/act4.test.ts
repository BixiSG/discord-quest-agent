// Round 7: Act 4 (Ashfold) between the Sunfall and the maps.

import { describe, expect, it } from "vitest";
import { ACTS, ACT_COMPANION, MONSTERS, PINNACLES, ZONES, ZONE_ORDER } from "../src/core/data";
import { newGame } from "../src/core/game";
import { endgameOpen } from "../src/core/maps";
import { SAVE_VERSION, unwrap, wrap } from "../src/core/save";
import { reconcileRewards } from "../src/core/sim/engine";
import { relightSun } from "../src/core/dawn";
import { validateState } from "../src/core/validate";

const g0 = () => newGame({ name: "A", cls: "vanguard", now: 0, seed: 44 });

describe("Act 4: Ashfold", () => {
    it("follows the Sunfall on the road, with its monsters and bosses defined", () => {
        const act = ACTS[3]!;
        expect(act.zones[0]).toBe("a4_stair");
        expect(ZONE_ORDER.indexOf("a4_stair")).toBe(ZONE_ORDER.indexOf("a3_sunfall") + 1);
        let prev = ZONES.a3_sunfall!.level;
        for (const z of act.zones) {
            const def = ZONES[z]!;
            expect(def.level).toBeGreaterThan(prev);
            prev = def.level;
            for (const m of [...def.monsters, ...(def.boss ? [def.boss] : [])]) expect(MONSTERS[m], m).toBeTruthy();
        }
        expect(prev).toBeLessThan(Math.min(...Object.values(PINNACLES).map(p => p.level)));
        expect(ACT_COMPANION[4]).toBe("wick");
    });

    it("clearing the Sunfall opens the stair; the Lamplighter opens the maps and brings Wick", () => {
        const g = g0();
        for (const z of ZONE_ORDER.slice(0, ZONE_ORDER.indexOf("a3_sunfall") + 1)) g.world.clears[z] = 1;
        reconcileRewards(g);
        expect(g.world.unlocked).toContain("a4_stair");
        expect(endgameOpen(g)).toBe(false);
        g.world.clears.a4_lamphouse = 1;
        reconcileRewards(g);
        expect(endgameOpen(g)).toBe(true);
        expect(g.companions.wick).toBe(0);
        expect(g.world.rewards).toContain("act:4");
    });

    it("a v7 save past the Sunfall keeps its maps; one that isn't does not get them", () => {
        const past = g0();
        past.world.clears.a3_sunfall = 1;
        const env = unwrap<any>({ ...wrap(past, 0), v: 7 });
        expect(env.v).toBe(SAVE_VERSION);
        const s = validateState(env.state);
        expect(s.world.rewards).toContain("endgame:early");
        expect(endgameOpen(s)).toBe(true);
        const fresh = validateState(unwrap<any>({ ...wrap(g0(), 0), v: 7 }).state);
        expect(endgameOpen(fresh)).toBe(false);
    });

    it("a new dawn walks through Ashfold again", () => {
        const g = g0();
        g.world.rewards.push("endgame:early");
        for (const p of ["drownedsun", "glasschoir", "ashenking"]) g.pinnacleKills[p] = 1;
        expect(relightSun(g)).toBeNull();
        expect(endgameOpen(g)).toBe(false);
    });
});
