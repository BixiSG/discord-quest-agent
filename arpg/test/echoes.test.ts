// Round 5: echoes and sun shards.

import { describe, expect, it } from "vitest";
import { ECHOES, ECHO_ORDER, MAP_ECHOES, PINNACLES } from "../src/core/data";
import { allShards, grantEcho, pinnacleEcho, rollMapEcho, sunShards } from "../src/core/echoes";
import { completeMap } from "../src/core/maps";
import { newGame } from "../src/core/game";
import { Rng } from "../src/core/rng";
import { validateState } from "../src/core/validate";

const g0 = () => newGame({ name: "T", cls: "vanguard", now: 0, seed: 61 });

describe("echoes and sun shards", () => {
    it("twelve pages, one per pinnacle among them", () => {
        expect(ECHO_ORDER.length).toBe(12);
        expect(MAP_ECHOES.length).toBe(8);
        for (const p of Object.keys(PINNACLES)) expect(Object.values(ECHOES).filter(e => e.pinnacle === p).length).toBe(1);
    });
    it("every third echo is an atlas point, paid once", () => {
        const g = g0();
        const pts = g.atlas.points;
        for (const id of MAP_ECHOES.slice(0, 6)) grantEcho(g, id);
        expect(grantEcho(g, MAP_ECHOES[0]!)).toBe(false);
        expect(g.atlas.points).toBe(pts + 2);
        const again = validateState(structuredClone(g));
        expect(again.atlas.points).toBe(pts + 2);
    });
    it("map bosses leave unfound echoes only; pinnacles leave theirs and a shard", () => {
        const g = g0();
        const rng = new Rng(9);
        const seen = new Set<string>();
        for (let i = 0; i < 2000; i++) { const e = rollMapEcho(g, rng); if (e) { expect(seen.has(e)).toBe(false); seen.add(e); } }
        expect(seen.size).toBe(8);
        expect(g.echoes.every(id => !ECHOES[id]!.pinnacle)).toBe(true);
        expect(sunShards(g)).toEqual([]);
        for (const p of Object.keys(PINNACLES)) completeMap(g, { tier: 16, area: "sunscar", mods: [], level: 90, pinnacle: p });
        expect(allShards(g)).toBe(true);
        expect(g.echoes.length).toBe(12);
        expect(pinnacleEcho(g, "drownedsun")).toBeNull();
    });
    it("saves where pinnacles were beaten before echoes get their pages on load", () => {
        const g = g0() as any;
        g.pinnacleKills = { ashenking: 2 };
        g.echoes = ["nope"];
        const s = validateState(g);
        expect(s.echoes).toEqual(["ashenking"]);
    });
});
