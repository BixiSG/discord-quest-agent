// Round 9: weekly omens - one per local calendar week, shared by everyone, on the hero and the world.
import { afterEach, describe, expect, it } from "vitest";
import { OMENS, OMEN_ORDER, omenOfWeek } from "../src/core/data";
import { newGame, salvageDust, salvageItem, sheetOf } from "../src/core/game";
import { forceOmen, omenAt, omenDaysLeft, omenEffects, nextOmen, tickOmen, weekAt } from "../src/core/omens";
import { validateState } from "../src/core/validate";
import { relightSun } from "../src/core/dawn";
import type { Item } from "../src/core/types";

const g0 = (now = 0) => newGame({ name: "T", cls: "vanguard", now, seed: 3 });
const DAY = 864e5;
afterEach(() => forceOmen(null));

describe("weekly omens", () => {
    it("never repeat week to week, and any seven weeks in a row hold all seven", () => {
        for (let w = 0; w < 3000; w++) expect(omenOfWeek(w + 1)).not.toBe(omenOfWeek(w));
        for (let w = 0; w < 700; w++) {
            const seen = new Set(Array.from({ length: 7 }, (_, i) => omenOfWeek(w + i)));
            expect(seen.size, `from week ${w}`).toBe(OMEN_ORDER.length);
        }
    });
    it("weeks run Monday to Sunday on the player's own clock", () => {
        // 2026-09-28 is a Monday: its local midnight at UTC+3 is 21:00 UTC the day before.
        const mon = Date.UTC(2026, 8, 28), tz = 180;
        expect(weekAt(mon - 1, 0)).toBe(weekAt(mon - 7 * DAY, 0));
        expect(weekAt(mon, 0)).toBe(weekAt(mon - 1, 0) + 1);
        expect(weekAt(mon - 3 * 3600e3, tz)).toBe(weekAt(mon, 0));
        expect(weekAt(mon - 3 * 3600e3 - 1, tz)).toBe(weekAt(mon, 0) - 1);
        const s = g0(mon); s.tz = 0;
        expect(omenDaysLeft(s)).toBe(7);
        s.simTo = mon + 6 * DAY + 1;
        expect(omenDaysLeft(s)).toBe(1);
        expect(nextOmen(s)).toBe(omenOfWeek(weekAt(s.simTo) + 1));
    });
    it("goes on the hero; a new week is written in the chronicle once and heard", () => {
        const s = g0(Date.UTC(2026, 8, 28));
        const heard: string[] = [];
        const rev = s.hero.rev;
        expect(tickOmen(s, { onNew: id => heard.push(id) })).toBe(true);
        expect(s.hero.omen).toBe(omenAt(s));
        expect(s.hero.rev).toBe(rev + 1);
        expect(s.log.some(e => e.key === "log.omen")).toBe(false); // the first omen isn't news
        expect(tickOmen(s)).toBe(false);
        s.simTo += 7 * DAY;
        tickOmen(s, { onNew: id => heard.push(id) });
        expect(heard).toEqual([s.hero.omen]);
        expect(s.log.filter(e => e.key === "log.omen").length).toBe(1);
        tickOmen(s, { onNew: id => heard.push(id) });
        expect(heard.length).toBe(1);
        // A time zone moved back over Monday midnight shows last week's omen again, without news.
        s.simTo = Date.UTC(2026, 9, 5) + 30 * 60e3; s.tz = 0; tickOmen(s);
        const n = s.log.filter(e => e.key === "log.omen").length;
        s.tz = -60; tickOmen(s, { onNew: id => heard.push(id) });
        s.tz = 0; tickOmen(s, { onNew: id => heard.push(id) });
        expect(s.log.filter(e => e.key === "log.omen").length).toBe(n);
    });
    it("stays outside the pinnacles, the hero's side too", async () => {
        const { runSheet } = await import("../src/core/sim/engine");
        const s = g0(); s.hero.level = 70; s.hero.rev++;
        forceOmen("frost"); tickOmen(s, { quiet: true });
        s.activity.run = { map: { uid: 1, tier: 16, area: "saltflats", mods: [], rarity: "plain", pinnacle: "drownedsun", level: 80 } } as never;
        expect(runSheet(s).bag.mods("damage").some(m => m.src === OMENS.frost!.name)).toBe(false);
        expect(sheetOf(s).bag.mods("damage").some(m => m.src === OMENS.frost!.name)).toBe(true);
    });
    it("a week that turns while away is in the away report", async () => {
        const { startReport } = await import("../src/core/sim/report");
        const { advance } = await import("../src/core/sim/engine");
        const sun = Date.UTC(2026, 9, 4, 12);
        const s = g0(sun); s.tz = 0;
        advance(s, sun + 1000);
        const rep = startReport(s);
        advance(s, sun + 24 * 3600e3, rep.events);
        const r = rep.finish(s);
        expect(r.omen).toBe(omenAt(s));
        expect(r.omen).not.toBe(omenOfWeek(weekAt(sun)));
    }, 30_000);
    it("changes the hero's sheet (named in its breakdown) and the monsters, never a pinnacle's", () => {
        const s = g0(); s.hero.level = 30; s.hero.rev++;
        forceOmen("clearsky"); tickOmen(s, { quiet: true });
        expect(sheetOf(s).bag.mods("xpGain").some(m => m.src === OMENS.clearsky!.name)).toBe(true);
        forceOmen("blood"); tickOmen(s, { quiet: true });
        const run = {}, pin = {};
        expect(omenEffects(s, run, null)!.life).toBeCloseTo(1.25);
        expect(omenEffects(s, run, null)!.rarity).toBe(40);
        const p = omenEffects(s, pin, null, true)!;
        expect(p.life).toBe(1);
        expect(p.rarity).toBe(40);
    });
    it("Ashfall pays more dust for salvage", () => {
        const item: Item = { uid: 900, base: "ring_iron", ilvl: 50, rarity: "rare", name: "R", affixes: [] };
        const a = g0(), b = g0();
        forceOmen("clearsky"); tickOmen(a, { quiet: true });
        const d0 = a.dust; salvageItem(a, { ...item }); const plain = a.dust - d0;
        forceOmen("ashfall"); tickOmen(b, { quiet: true });
        const d1 = b.dust; salvageItem(b, { ...item });
        expect(b.dust - d1).toBe(Math.round(plain * 1.25));
        expect(salvageDust(b, { ...item })).toBe(b.dust - d1);
    });
    it("saves: an unknown omen is dropped and this week's put back; a new dawn keeps it", () => {
        const s = g0(Date.UTC(2026, 8, 28));
        const raw = JSON.parse(JSON.stringify(s));
        raw.hero.omen = "toString"; raw.omenWeek = "x";
        const v = validateState(raw);
        expect(v.hero.omen).toBe(omenAt(v));
        expect(v.omenWeek).toBe(weekAt(v.simTo, v.tz ?? 0));
        tickOmen(s, { quiet: true });
        s.pinnacleKills = { drownedsun: 1, glasschoir: 1, ashenking: 1 };
        expect(relightSun(s)).toBeNull();
        expect(s.hero.omen).toBe(omenAt(s));
    });
});
