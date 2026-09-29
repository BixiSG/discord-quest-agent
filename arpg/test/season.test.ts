// Hollow Night: the local calendar, lanterns only in October, the seasonal
// relic and companion kept out of the usual pools, the lantern contract, and
// saves that keep (and clean) the new fields.

import { afterEach, describe, expect, it } from "vitest";
import { COMPANIONS, RELICS } from "../src/core/data";
import { newGame } from "../src/core/game";
import { claimContract, ensureContracts, contractEvent } from "../src/core/contracts";
import { missingCompanions, rollCompanionDrop } from "../src/core/companions";
import { rollRelic } from "../src/core/items";
import { Rng } from "../src/core/rng";
import { HOLLOW_PET, HOLLOW_RELIC, civil, forceHollowNight, hollowKey, hollowNight, hollowNightsLeft, lanternKill, lanternsSnuffed, localDate } from "../src/core/season";
import { advance } from "../src/core/sim/engine";
import { validateState } from "../src/core/validate";
import type { GameState } from "../src/core/state";

const OCT5 = Date.UTC(2026, 9, 5, 12);
const SEP5 = Date.UTC(2026, 8, 5, 12);
const game = (now: number, seed = 3, tz = 180): GameState => { const g = newGame({ name: "T", cls: "vanguard", now, seed }); g.tz = tz; return g; };
/** An Rng whose every chance succeeds (for the rare drops). */
const lucky = (): Rng => { const r = new Rng(1); r.chance = () => true; return r; };

afterEach(() => forceHollowNight(null));

describe("local calendar", () => {
    it("turns days since 1970 into dates", () => {
        expect(civil(0)).toEqual({ y: 1970, m: 1, d: 1 });
        expect(civil(Date.UTC(2024, 1, 29) / 864e5)).toEqual({ y: 2024, m: 2, d: 29 });
        expect(civil(Date.UTC(2000, 2, 1) / 864e5)).toEqual({ y: 2000, m: 3, d: 1 });
        expect(civil(Date.UTC(1969, 11, 31) / 864e5)).toEqual({ y: 1969, m: 12, d: 31 });
        for (let t = Date.UTC(2025, 0, 1); t < Date.UTC(2027, 0, 1); t += 864e5 * 7) {
            const d = new Date(t);
            expect(civil(t / 864e5)).toEqual({ y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate() });
        }
    });
    it("follows the player's offset across midnight", () => {
        const kyivMidnight = Date.UTC(2026, 8, 30, 21); // 1 October, 00:00 in Kyiv (UTC+3)
        expect(localDate(kyivMidnight, 180)).toEqual({ y: 2026, m: 10, d: 1 });
        expect(localDate(kyivMidnight, 0)).toEqual({ y: 2026, m: 9, d: 30 });
        expect(localDate(kyivMidnight - 60e3, 180).m).toBe(9);
    });
    it("Hollow Night is October, local", () => {
        const g = game(Date.UTC(2026, 8, 30, 21));
        expect(hollowNight(g)).toBe(true);
        expect(hollowNightsLeft(g)).toBe(31);
        g.tz = 0;
        expect(hollowNight(g)).toBe(false);
        expect(hollowNightsLeft(g)).toBe(0);
        g.simTo = Date.UTC(2026, 9, 31, 23, 59);
        expect(hollowNight(g)).toBe(true);
        expect(hollowNightsLeft(g)).toBe(1);
        g.simTo = Date.UTC(2026, 10, 1);
        expect(hollowNight(g)).toBe(false);
        forceHollowNight(true);
        expect(hollowNight(g)).toBe(true);
    });
});

describe("lanterns", () => {
    it("burn in October: tougher monsters, snuffed and counted, the opening line once", () => {
        const g = game(OCT5);
        advance(g, OCT5 + 45 * 60e3);
        expect(lanternsSnuffed(g)).toBeGreaterThan(20);
        expect(g.events?.[hollowKey(g)]).toBe(lanternsSnuffed(g));
        expect(g.world.rewards).toContain("season:hollownight2026");
        expect(g.log.filter(e => e.key === "log.hollowBegins").length).toBe(1);
    });
    it("never touch September: no lantern, no tally, no line", () => {
        const g = game(SEP5);
        let seen = false;
        const probe = { kill: (m: { lantern?: boolean }) => { if (m.lantern) seen = true; } };
        advance(g, SEP5 + 45 * 60e3, probe);
        expect(seen).toBe(false);
        expect(g.events).toBeUndefined();
        expect(g.log.some(e => e.key === "log.hollowBegins")).toBe(false);
        expect(g.contracts.list.some(c => c.kind === "lanterns")).toBe(false);
    });
    it("can leave the Hollow Grin and a Pumpkin Wisp", () => {
        const g = game(OCT5);
        expect(lanternKill(g, lucky(), 10)).toBe(true);
        expect(g.codex[HOLLOW_RELIC]).toBe(1);
        expect(g.companions[HOLLOW_PET]).toBe(0);
        expect(g.hero.equipment.helmet?.relic === HOLLOW_RELIC || g.relics.some(r => r.relic === HOLLOW_RELIC)).toBe(true);
    });
});

describe("seasonal finds stay seasonal", () => {
    it("the relic and the companion are marked and kept out of the usual pools", () => {
        expect(RELICS[HOLLOW_RELIC]?.season).toBe("hollownight");
        expect(COMPANIONS[HOLLOW_PET]?.season).toBe("hollownight");
        const rng = new Rng(9);
        for (let i = 0; i < 3000; i++) expect(rollRelic(rng, i, 80)?.relic).not.toBe(HOLLOW_RELIC);
        const g = game(OCT5);
        expect(missingCompanions(g, 100)).not.toContain(HOLLOW_PET);
        for (let i = 0; i < 300; i++) expect(rollCompanionDrop(g, rng, 100, 1)).not.toBe(HOLLOW_PET);
    });
});

describe("the lantern contract", () => {
    const withLanterns = (): GameState => {
        for (let seed = 1; seed < 60; seed++) {
            const g = game(OCT5, seed);
            ensureContracts(g);
            if (g.contracts.list.some(c => c.kind === "lanterns")) return g;
        }
        throw new Error("no lantern contract in 60 boards");
    };
    it("is offered in October, one at a time, and pays the Grin, then the Wisp, then dust", () => {
        const g = withLanterns();
        expect(g.contracts.list.filter(c => c.kind === "lanterns").length).toBe(1);
        const i = g.contracts.list.findIndex(c => c.kind === "lanterns");
        const c = g.contracts.list[i]!;
        expect(c.extra).toBe("hollow");
        c.n = c.target - 1;
        contractEvent(g, "lanterns");
        expect(claimContract(g, i)).toBeNull();
        expect(g.codex[HOLLOW_RELIC]).toBe(1);
        // Second one: the Wisp.
        g.contracts.list[0] = { ...c, n: c.target };
        expect(claimContract(g, 0)).toBeNull();
        expect(g.companions[HOLLOW_PET]).toBe(0);
        // Third: both found, double dust.
        g.contracts.list[0] = { ...c, n: c.target };
        const dust = g.dust;
        expect(claimContract(g, 0)).toBeNull();
        expect(g.dust - dust).toBeGreaterThanOrEqual(2 * c.dust);
    });
    it("leaves the board when October ends unless finished", () => {
        const g = withLanterns();
        const i = g.contracts.list.findIndex(c => c.kind === "lanterns");
        g.simTo = Date.UTC(2026, 10, 2);
        advance(g, g.simTo + 1000);
        expect(g.contracts.list.some(c => c.kind === "lanterns")).toBe(false);
        expect(g.contracts.list.length).toBe(3);
        // A finished one stays to be claimed.
        const h = withLanterns();
        const j = h.contracts.list.findIndex(c => c.kind === "lanterns");
        h.contracts.list[j]!.n = h.contracts.list[j]!.target;
        h.simTo = Date.UTC(2026, 10, 2);
        advance(h, h.simTo + 1000);
        expect(h.contracts.list[j]!.kind).toBe("lanterns");
        void i;
    });
});

describe("saves", () => {
    it("keep the offset, the tallies, lantern-lit maps and lantern monsters; junk is cleaned", () => {
        const g = game(OCT5);
        advance(g, OCT5 + 10 * 60e3);
        g.maps.push({ uid: 999, tier: 3, area: "saltflats", mods: [], rarity: "plain", lit: true }, { uid: 1000, tier: 3, area: "saltflats", mods: [], rarity: "plain", lit: "yes" as unknown as boolean });
        g.events = { ...g.events, junk: 5, hollownight2025: 12.7 };
        const run = g.activity.run!;
        run.monsters[0]!.lantern = true;
        if (run.monsters[1]) (run.monsters[1] as { lantern?: unknown }).lantern = 1;
        const s = validateState(JSON.parse(JSON.stringify(g)));
        expect(s.tz).toBe(180);
        expect(s.events).toEqual({ hollownight2026: g.events![hollowKey(g)], hollownight2025: 12 });
        expect(s.maps.find(m => m.uid === 999)?.lit).toBe(true);
        expect(s.maps.find(m => m.uid === 1000)?.lit).toBeUndefined();
        expect(s.activity.run?.monsters[0]?.lantern).toBe(true);
        if (s.activity.run?.monsters[1]) expect(s.activity.run.monsters[1].lantern).toBeUndefined();
        const odd = validateState(JSON.parse(JSON.stringify({ ...g, tz: 9999 })));
        expect(odd.tz).toBe(840);
    });
});
