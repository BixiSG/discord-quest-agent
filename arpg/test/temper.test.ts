// Round 6: tempering relics, the late dust sink.

import { describe, expect, it } from "vitest";
import { RELICS, betterLow } from "../src/core/data";
import { temperCost, temperRelic } from "../src/core/crafting";
import { newGame, relicRollScore } from "../src/core/game";
import { validateState } from "../src/core/validate";
import type { Item } from "../src/core/types";

const g0 = () => { const g = newGame({ name: "T", cls: "arcanist", now: 0, seed: 91 }); g.dust = 1e12; return g; };
const relic = (id: string, uid: number, worst = true): Item => {
    const def = RELICS[id]!;
    return { uid, base: def.base, ilvl: 70, rarity: "relic", affixes: [], relic: id, relicRolls: def.mods.map(m => (worst === !betterLow(m) ? m.range[0] : m.range[1])) };
};

describe("temper", () => {
    it("costs dust scaled by item level, 40% more each time, and only for relics", () => {
        const g = g0();
        const it = relic("worldbreaker", 900);
        g.relics.push(it);
        const c0 = temperCost(it)!;
        expect(c0).toBe(14000);
        expect(temperRelic(g, 900)).toBeNull();
        expect(it.tempered).toBe(1);
        expect(it.locked).toBe(true);
        expect(temperCost(it)).toBe(Math.round((c0 * 1.4) / 10) * 10);
        expect(g.dust).toBe(1e12 - c0);
        const plain: Item = { uid: 901, base: "sword1", ilvl: 10, rarity: "rare", affixes: [] };
        g.stash.push(plain);
        expect(temperCost(plain)).toBeNull();
        expect(temperRelic(g, 901)).toBe("only relics can be tempered");
        g.dust = 5;
        expect(temperRelic(g, 900)).toMatch(/^needs \d+ ember dust$/);
    });

    it("never makes a roll worse and ends with every roll at its best (a downside goes down)", () => {
        for (const id of ["worldbreaker", "voidsinger", "emberknot", "hollowcrown"]) {
            const g = g0();
            const it = relic(id, 7);
            g.relics.push(it);
            let prev = relicRollScore(it), n = 0;
            while (temperCost(it) !== null && n < 500) {
                expect(temperRelic(g, 7)).toBeNull();
                const now = relicRollScore(it);
                expect(now).toBeGreaterThanOrEqual(prev);
                prev = now; n++;
            }
            expect(temperRelic(g, 7)).toBe("every roll is at its best");
            expect(relicRollScore(it)).toBe(1);
            RELICS[id]!.mods.forEach((m, i) => expect(it.relicRolls![i]).toBe(betterLow(m) ? m.range[0] : m.range[1]));
        }
    });

    it("the relic case keeps the copy with less mana cost (a downside scores low when high)", () => {
        expect(relicRollScore(relic("voidsinger", 1, false))).toBe(1);
        expect(relicRollScore(relic("voidsinger", 2, true))).toBe(0);
    });

    it("saves keep a relic's temper count and drop one anywhere else", () => {
        const g = g0();
        g.relics.push({ ...relic("worldbreaker", 50), tempered: 3.2 });
        g.stash.push({ uid: 51, base: "sword1", ilvl: 10, rarity: "rare", affixes: [], tempered: 2 });
        const s = validateState(JSON.parse(JSON.stringify(g)));
        expect(s.relics.find(x => x.uid === 50)?.tempered).toBe(3);
        expect(s.stash.find(x => x.uid === 51)?.tempered).toBeUndefined();
    });
});
