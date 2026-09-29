// Round 3: the contract board.

import { describe, expect, it } from "vitest";
import { BOARD_SIZE, claimContract, claimable, contractEvent, contractText, ensureContracts, rerollContract, rerollCost, rewardText } from "../src/core/contracts";
import { newGame } from "../src/core/game";
import { advance } from "../src/core/sim/engine";
import { validateState } from "../src/core/validate";

const g0 = () => newGame({ name: "T", cls: "vanguard", now: 0, seed: 11 });

describe("contract board", () => {
    it("fills to three different contracts, deterministically", () => {
        const a = g0(), b = g0();
        ensureContracts(a); ensureContracts(b);
        expect(a.contracts.list.length).toBe(BOARD_SIZE);
        expect(a.contracts.list).toEqual(b.contracts.list);
        expect(new Set(a.contracts.list.map(c => c.kind)).size).toBe(BOARD_SIZE);
        for (const c of a.contracts.list) { expect(contractText(c)).not.toMatch(/undefined/); expect(rewardText(c)).toMatch(/dust/); }
        // No maps before the endgame.
        expect(a.contracts.list.some(c => c.kind === "maps")).toBe(false);
    });
    it("fills in from play, then pays out and is replaced in place", () => {
        const g = g0();
        advance(g, 30 * 60e3);
        expect(g.contracts.list.length).toBe(BOARD_SIZE);
        expect(g.contracts.list.some(c => c.n > 0)).toBe(true);
        const i = 1;
        const c = g.contracts.list[i]!;
        expect(claimContract(g, i)).toMatch(/not finished/);
        c.n = c.target - 1;
        contractEvent(g, c.kind, 99);
        expect(c.n).toBe(c.target);
        expect(claimable(g)).toBeGreaterThanOrEqual(1);
        const dust = g.dust, cur = c.currency ? g.currency[c.currency[0]] ?? 0 : 0;
        expect(claimContract(g, i)).toBeNull();
        expect(g.dust).toBeGreaterThanOrEqual(dust + c.dust);
        if (c.currency) expect(g.currency[c.currency[0]]).toBe(cur + c.currency[1]);
        expect(g.contracts.list.length).toBe(BOARD_SIZE);
        expect(g.contracts.list[i]).not.toBe(c);
        expect(g.contracts.done).toBe(1);
    });
    it("a relic reward is one the codex is missing", () => {
        const g = g0();
        g.hero.level = 80;
        g.world.unlocked.push("a4_lamphouse");
        ensureContracts(g);
        const c = g.contracts.list[0]!;
        c.extra = "relic"; c.n = c.target;
        const before = Object.keys(g.codex).length;
        expect(claimContract(g, 0)).toBeNull();
        expect(Object.keys(g.codex).length).toBe(before + 1);
    });
    it("rerolls for dust, not a finished one", () => {
        const g = g0();
        ensureContracts(g);
        expect(rerollContract(g, 0)).toMatch(/dust/);
        g.dust = rerollCost(g);
        const old = g.contracts.list[0];
        expect(rerollContract(g, 0)).toBeNull();
        expect(g.dust).toBe(0);
        expect(g.contracts.list[0]).not.toBe(old);
        g.contracts.list[2]!.n = g.contracts.list[2]!.target;
        g.dust = 1e6;
        expect(rerollContract(g, 2)).toMatch(/claim/);
    });
    it("maps count from their tier up", () => {
        const g = g0();
        g.contracts = { list: [{ kind: "maps", target: 2, n: 0, tier: 5, dust: 10 }], seq: 0, done: 0 };
        contractEvent(g, "maps", 4);
        expect(g.contracts.list[0]!.n).toBe(0);
        contractEvent(g, "maps", 5);
        contractEvent(g, "maps", 9);
        contractEvent(g, "maps", 9);
        expect(g.contracts.list[0]!.n).toBe(2);
    });
    it("the validator cleans a damaged board and tops it up", () => {
        const g = g0() as any;
        g.contracts = { list: [{ kind: "nope", target: 5, n: 0, dust: 1 }, { kind: "kills", target: 10, n: 50, dust: 5, currency: ["fake", 2] }], seq: "x" };
        const s = validateState(g);
        expect(s.contracts.list.length).toBe(BOARD_SIZE);
        expect(s.contracts.list[0]).toMatchObject({ kind: "kills", target: 10, n: 10, dust: 5 });
        expect(s.contracts.list[0]!.currency).toBeUndefined();
        const g2 = g0() as any;
        delete g2.contracts;
        expect(validateState(g2).contracts.list.length).toBe(BOARD_SIZE);
    });
});

import { contractDust } from "../src/core/contracts";
describe("contract rewards follow the hero", () => {
    it("a contract rolled at level 1 pays by the level it is claimed at", () => {
        const g = newGame({ name: "T", cls: "vanguard", now: 0, seed: 12 });
        ensureContracts(g);
        const c = g.contracts.list[0]!;
        const low = c.dust;
        g.hero.level = 70;
        expect(contractDust(g, c)).toBeGreaterThan(low * 10);
        expect(rewardText(c, g)).toContain(String(contractDust(g, c)));
    });
});
