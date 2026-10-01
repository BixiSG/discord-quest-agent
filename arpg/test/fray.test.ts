// Round 8: the Fray (src/core/fray.ts).

import { describe, expect, it } from "vitest";
import { ARENA_H, ARENA_W, FRAY_BONUS, FRAY_STEP_MS, HERO_SPEED, frayAdvance, frayStep, frayZone, monsterSpeed, newFray, newFrayTotals, type FrayEvents, type FrayInput, type FrayState } from "../src/core/fray";
import { MONSTERS, ZONES, ZONE_ORDER } from "../src/core/data";
import { newGame, sheetOf } from "../src/core/game";
import { advance, makeMonster, onKill } from "../src/core/sim/engine";
import { Rng } from "../src/core/rng";
import { MIGRATIONS } from "../src/core/save";
import { validateState } from "../src/core/validate";
import type { GameState } from "../src/core/state";
import { botTune } from "../tools/bot";

const HOUR = 3600e3;
const STILL: FrayInput = { dx: 0, dy: 0, flask: false };
const g0 = (seed = 11, cls = "vanguard") => newGame({ name: "F", cls, now: 0, seed });
const inZone = (g: GameState, zone: string) => { g.activity.zone = zone; return g; };

/** Steps the fray for up to `secs` simulated seconds (or until it ends); `input` may depend on the fray. */
function fight(g: GameState, f: FrayState, secs: number, input: FrayInput | ((f: FrayState) => FrayInput) = STILL, ev: FrayEvents = {}): void {
    for (let i = 0; i < secs * 60 && f.outcome === "fight"; i++) frayStep(g, f, typeof input === "function" ? input(f) : input, ev);
}

// One hero levelled by the idle sim for two hours, the way tools/make-save.ts plays it (built once, cloned per test).
let levelled: GameState | null = null;
const twoHours = (): GameState => {
    if (!levelled) {
        const g = newGame({ name: "Ashling", cls: "vanguard", now: 0, seed: 4242 });
        botTune(g);
        for (let t = 0; t < 2 * HOUR;) { t = Math.min(2 * HOUR, t + 10 * 60e3); advance(g, t); botTune(g); }
        levelled = g;
    }
    return structuredClone(levelled);
};

describe("the fray is deterministic", () => {
    it("same state, same seed, same inputs: identical JSON", () => {
        const a = g0(), b = g0();
        const fa = newFray(a, 7), fb = newFray(b, 7);
        const walk = (f: FrayState): FrayInput => ({ dx: Math.sin(f.t), dy: Math.cos(f.t * 0.7), flask: f.t > 20 });
        fight(a, fa, 60, walk);
        fight(b, fb, 60, walk);
        expect(JSON.stringify(fa)).toBe(JSON.stringify(fb));
        expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    });
    it("frayAdvance steps by wall clock, at most a quarter second per call", () => {
        const a = g0(), b = g0();
        const fa = newFray(a, 3), fb = newFray(b, 3);
        for (let t = 0; t < 2000; t += 100) { frayAdvance(a, fa, t + 100, t, STILL); frayAdvance(b, fb, t + 100, t, STILL); }
        expect(JSON.stringify(fa)).toBe(JSON.stringify(fb));
        // Two seconds of wall clock: 120 steps, give or take the one the float remainder carries over.
        expect(Math.abs(fa.t * 60 - 120)).toBeLessThan(1.001);
        expect(fa.acc).toBeGreaterThanOrEqual(0);
        expect(fa.acc).toBeLessThan(FRAY_STEP_MS);
        // The same steps taken one by one give the same fight.
        const s = g0(), fs = newFray(s, 3);
        for (let i = 0; i < Math.round(fa.t * 60); i++) frayStep(s, fs, STILL);
        expect(JSON.stringify(fs.run)).toBe(JSON.stringify(fa.run));
        const c = g0(), fc = newFray(c, 3);
        frayAdvance(c, fc, 10_000, 0, STILL); // a ten-second stall
        expect(fc.t).toBeCloseTo(15 * FRAY_STEP_MS / 1000, 6);
    });
    it("a different seed gives a different fight", () => {
        const a = g0(), b = g0();
        const fa = newFray(a, 1), fb = newFray(b, 2);
        fight(a, fa, 5); fight(b, fb, 5);
        expect(JSON.stringify(fa.mons)).not.toBe(JSON.stringify(fb.mons));
    });
});

describe("the idle run is left alone", () => {
    it("simTo, the run and the run index stay; the fray tallies move", () => {
        const g = g0();
        advance(g, 5 * 60e3);
        const act0 = JSON.stringify(g.activity), simTo0 = g.simTo, runs0 = g.totals.runs;
        const ft0 = { ...g.fray! };
        const f = newFray(g, 5);
        fight(g, f, 400);
        expect(f.outcome).not.toBe("fight");
        expect(JSON.stringify(g.activity)).toBe(act0);
        expect(g.simTo).toBe(simTo0);
        expect(g.totals.runs).toBe(runs0);
        expect(g.fray!.runs).toBe(ft0.runs + 1);
        expect(g.fray!.kills).toBeGreaterThan(ft0.kills);
        expect(g.fray!.won).toBe(ft0.won + (f.outcome === "won" ? 1 : 0));
    });
    it("fights the road's current zone, the shore when the zone is unknown", () => {
        const g = g0();
        expect(frayZone(g).id).toBe("a1_shore");
        expect(newFray(inZone(g, "a1_chapel"), 1).zone).toBe("a1_chapel");
        expect(frayZone(inZone(g, "nowhere")).id).toBe("a1_shore");
        expect(newFrayTotals()).toEqual({ runs: 0, won: 0, kills: 0, best: 0 });
    });
});

describe("waves", () => {
    // Clears every living monster after each step, outside combat, to walk the wave structure.
    const sweep = (g: GameState, f: FrayState, ev: FrayEvents, max = 60 * 60) => {
        for (let i = 0; i < max && f.outcome === "fight"; i++) {
            frayStep(g, f, STILL, ev);
            for (const m of f.run.monsters) m.life = 0;
        }
    };
    it("the first wave comes within a second, in the arena, away from the hero", () => {
        const g = g0(), f = newFray(g, 4);
        const waves: number[] = [];
        let at = -1;
        fight(g, f, 1, STILL, { wave: n => { waves.push(n); if (at < 0) at = f.t; } });
        expect(waves[0]).toBe(1);
        expect(at).toBeGreaterThan(0);
        expect(at).toBeLessThanOrEqual(1);
        expect(f.run.monsters.length).toBe(f.mons.length);
        expect(f.run.monsters.length).toBeGreaterThanOrEqual(ZONES.a1_shore!.packSize[0]);
        for (const m of f.mons) {
            expect(m.x).toBeGreaterThanOrEqual(0); expect(m.x).toBeLessThanOrEqual(ARENA_W);
            expect(m.y).toBeGreaterThanOrEqual(0); expect(m.y).toBeLessThanOrEqual(ARENA_H);
        }
    });
    it("a zone with a boss: every wave, then the boss last, then the win", () => {
        const g = inZone(g0(), "a1_chapel"), f = newFray(g, 6);
        const seen: [number, boolean][] = [];
        let end = "";
        sweep(g, f, { wave: (n, boss) => seen.push([n, boss]), end: o => { end = o; } });
        const z = ZONES.a1_chapel!;
        expect(f.waves).toBe(z.packs);
        expect(f.wave).toBe(f.waves);
        expect(seen.map(s => s[0])).toEqual([...Array.from({ length: z.packs }, (_, i) => i + 1), z.packs]);
        expect(seen.filter(s => s[1]).length).toBe(1);
        expect(seen[seen.length - 1]![1]).toBe(true);
        expect(f.run.monsters.some(m => m.def === z.boss)).toBe(true);
        expect(end).toBe("won");
    });
    it("a zone without a boss: every wave and no boss", () => {
        const g = g0(), f = newFray(g, 6);
        const seen: [number, boolean][] = [];
        sweep(g, f, { wave: (n, boss) => seen.push([n, boss]) });
        expect(f.wave).toBe(f.waves);
        expect(seen.length).toBe(ZONES.a1_shore!.packs);
        expect(seen.some(s => s[1])).toBe(false);
        expect(f.run.monsters.some(m => MONSTERS[m.def]!.boss)).toBe(false);
        expect(f.outcome).toBe("won");
    });
    it("the dead leave the lists when the next wave comes", () => {
        const g = g0(), f = newFray(g, 8);
        fight(g, f, 1);
        expect(f.run.monsters.length).toBeGreaterThanOrEqual(2);
        const corpse = f.run.monsters[0]!, standing = f.run.monsters[1]!;
        corpse.life = 0; // one falls, one at least still stands: the timer brings wave 2
        standing.life = standing.maxLife = 1e9;
        let checked = false;
        fight(g, f, 13, STILL, {
            wave: n => {
                if (n !== 2) return;
                checked = true;
                expect(f.run.monsters).not.toContain(corpse);
                expect(f.run.monsters).toContain(standing);
                expect(f.run.monsters.every(m => m.life > 0)).toBe(true);
                expect(f.mons.length).toBe(f.run.monsters.length);
                // The positions moved with their monsters: the standing one is still where it was drawn.
                expect(f.mons[f.run.monsters.indexOf(standing)]!.speed).toBe(monsterSpeed(standing.def, standing.champion));
            },
        });
        expect(checked).toBe(true);
    });
});

describe("a fight to the end", () => {
    it("a fresh hero standing still on the shore wins or falls within 400 seconds", () => {
        for (const seed of [1, 2, 3]) {
            const g = g0(seed), f = newFray(g, seed);
            fight(g, f, 400);
            expect(f.outcome, `seed ${seed}`).not.toBe("fight");
        }
    });
    /** A plain player: walks at the nearest living monster (casters keep their distance from a standing hero). */
    const chase = (f: FrayState): FrayInput => {
        let best: { x: number; y: number } | null = null, bd = Infinity;
        f.run.monsters.forEach((m, i) => {
            if (m.life <= 0) return;
            const fm = f.mons[i]!, d = Math.hypot(fm.x - f.hero.x, fm.y - f.hero.y);
            if (d < bd) { bd = d; best = fm; }
        });
        const b = best as { x: number; y: number } | null;
        return b && bd > 16 ? { dx: b.x - f.hero.x, dy: b.y - f.hero.y, flask: false } : STILL;
    };
    it("a hero two hours into the idle game wins its road zone walking at the monsters, most seeds", () => {
        const base = twoHours();
        const results: string[] = [];
        for (const seed of [1, 2, 3]) {
            const g = structuredClone(base), f = newFray(g, seed);
            fight(g, f, 400, chase);
            results.push(`${f.outcome}@${Math.round(f.t)}s wave ${f.wave}/${f.waves} kills ${f.run.kills} life ${Math.round(f.run.hero.life)}`);
        }
        console.log(`level ${base.hero.level} in ${base.activity.zone}:`, results);
        expect(results.filter(r => r.startsWith("won")).length).toBeGreaterThanOrEqual(2);
    });
    it("the same hero standing still wins a road zone without casters (a2_shards), every seed", () => {
        const base = inZone(twoHours(), "a2_shards");
        for (const seed of [1, 2, 3]) {
            const g = structuredClone(base), f = newFray(g, seed);
            fight(g, f, 400);
            expect(f.outcome, `seed ${seed} at ${Math.round(f.t)} s`).toBe("won");
        }
    });
    it("a walking hero with an area skill catches casters; a standing one does not", () => {
        // Casters keep 72-96 px from a standing hero and hit from 108 px; area skills reach 38 px.
        const g = twoHours(), f = newFray(g, 1);
        expect(sheetOf(g).skill.shape).not.toBe("projectile");
        const killed: string[] = [];
        let closest = Infinity;
        for (let i = 0; i < 400 * 60 && f.outcome === "fight"; i++) {
            frayStep(g, f, chase(f), { kill: m => { killed.push(m.def); } });
            f.run.monsters.forEach((m, j) => { if (m.life > 0 && f.mons[j]!.caster) closest = Math.min(closest, Math.hypot(f.mons[j]!.x - f.hero.x, f.mons[j]!.y - f.hero.y)); });
        }
        expect(killed.filter(d => MONSTERS[d]!.spell).length, `closest caster ${Math.round(closest)} px, ${f.outcome} at ${Math.round(f.t)} s`).toBeGreaterThan(0);
    });
});

describe("kiting", () => {
    it("the hero outruns every monster but bosses", () => {
        for (const [id, d] of Object.entries(MONSTERS)) {
            if (d.boss) continue;
            expect(monsterSpeed(id, false), id).toBeLessThan(HERO_SPEED);
        }
    });
    const nearest = (f: FrayState) => {
        let best: { x: number; y: number } | null = null, bd = Infinity;
        f.run.monsters.forEach((m, i) => {
            if (m.life <= 0) return;
            const fm = f.mons[i]!, d = Math.hypot(fm.x - f.hero.x, fm.y - f.hero.y);
            if (d < bd) { bd = d; best = fm; }
        });
        return best as { x: number; y: number } | null;
    };
    /** Walks straight away from the nearest living monster (recomputed every step). */
    const flee = (f: FrayState): FrayInput => {
        const b = nearest(f);
        return b ? { dx: f.hero.x - b.x, dy: f.hero.y - b.y, flask: false } : STILL;
    };
    /** The same, but steers off a wall it is within 30 px of (a player does not run into a corner). */
    const fleeOpen = (f: FrayState): FrayInput => {
        const b = nearest(f);
        if (!b) return STILL;
        const d = Math.hypot(f.hero.x - b.x, f.hero.y - b.y) || 1;
        let dx = (f.hero.x - b.x) / d, dy = (f.hero.y - b.y) / d;
        if (f.hero.x < 30) dx += 1; if (f.hero.x > ARENA_W - 30) dx -= 1;
        if (f.hero.y < 30) dy += 1; if (f.hero.y > ARENA_H - 30) dy -= 1;
        return { dx, dy, flask: false };
    };
    /** Landed monster hits (dmg > 0) on a fresh hero on the shore over 60 s. */
    const hits = (input: FrayInput | ((f: FrayState) => FrayInput), seed: number) => {
        const g = g0(seed), f = newFray(g, seed);
        let n = 0;
        fight(g, f, 60, input, { monsterHit: (_i, d) => { if (d > 0) n++; } });
        return n;
    };
    it("walking away from the nearest monster takes fewer hits than standing still", () => {
        // Straight away can end in a corner (seed 1: 47 hits against 46), so the sum over three seeds.
        const still = [1, 2, 3].map(s => hits(STILL, s)), away = [1, 2, 3].map(s => hits(flee, s));
        const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
        expect(sum(away), `still ${still} away ${away}`).toBeLessThan(sum(still));
        expect(away.filter((x, i) => x < still[i]!).length).toBeGreaterThanOrEqual(2);
    });
    it("kiting clear of the walls takes fewer hits than standing still, every seed", () => {
        for (const seed of [1, 2, 3, 4, 5, 6]) {
            const still = hits(STILL, seed), away = hits(fleeOpen, seed);
            expect(away, `seed ${seed}: still ${still}`).toBeLessThan(still);
        }
    });
});

describe("rewards", () => {
    it("a won fray: the end event, the tallies, spoils, experience and the log", () => {
        const g = g0(1), f = newFray(g, 1);
        // A win without combat: the waves are cleared as they come (as in the wave tests).
        const lv0 = g.hero.level, xp0 = g.hero.xp;
        const loot: string[] = [];
        let end = "", endLoot = -1;
        const ev: FrayEvents = { loot: it => loot.push(it.base), end: o => { end = o; endLoot = loot.length; } };
        for (let i = 0; i < 3600 && f.outcome === "fight"; i++) { frayStep(g, f, STILL, ev); for (const m of f.run.monsters) m.life = 0; }
        expect(end).toBe("won");
        expect(f.outcome).toBe("won");
        expect(g.fray).toEqual({ runs: 1, won: 1, kills: 0, best: Math.round(f.t) });
        expect(endLoot).toBeGreaterThanOrEqual(1); // the spoils item, before the end event
        expect(g.hero.level > lv0 || g.hero.xp > xp0).toBe(true);
        const e = g.log.find(x => x.key === "log.frayWon");
        expect(e?.params).toMatchObject({ kills: 0, secs: Math.round(f.t) });
    });
    it("a won fray in real combat pays kills and keeps the fastest time", () => {
        const g = g0(2);
        const lv0 = g.hero.level, xp0 = g.hero.xp;
        let kills = 0;
        const f = newFray(g, 2);
        fight(g, f, 400, STILL, { kill: () => { kills++; } });
        if (f.outcome !== "won") throw new Error(`a fresh hero fell on the shore (seed 2) after ${Math.round(f.t)} s`);
        expect(g.fray!.won).toBe(1);
        expect(g.fray!.kills).toBe(kills);
        expect(kills).toBeGreaterThan(0);
        expect(g.fray!.best).toBe(Math.round(f.t));
        expect(g.hero.level > lv0 || g.hero.xp > xp0).toBe(true);
        // A slower second win does not overwrite the best.
        g.fray!.best = 1;
        const f2 = newFray(g, 3);
        fight(g, f2, 400);
        expect(f2.outcome).toBe("won");
        expect(g.fray!.won).toBe(2);
        expect(g.fray!.best).toBe(1);
    });
    it("a fallen fray: the end event, a run without a win, the log", () => {
        const g = inZone(g0(1), ZONE_ORDER[12]!), f = newFray(g, 1);
        let end = "", died = "";
        fight(g, f, 400, STILL, { end: o => { end = o; }, death: z => { died = z; } });
        expect(f.outcome).toBe("fallen");
        expect(end).toBe("fallen");
        expect(died).toBe(ZONE_ORDER[12]);
        expect(f.run.hero.life).toBe(0);
        expect(g.fray!.runs).toBe(1);
        expect(g.fray!.won).toBe(0);
        expect(g.fray!.best).toBe(0);
        expect(g.log.some(x => x.key === "log.frayFell")).toBe(true);
        expect(g.log.some(x => x.key === "log.frayWon")).toBe(false);
        // Nothing more happens once it is over.
        const after = JSON.stringify(f);
        frayStep(g, f, STILL);
        frayAdvance(g, f, 1000, 0, STILL);
        expect(JSON.stringify(f)).toBe(after);
    });
});

describe("the flask", () => {
    it("the key drinks it once life is down a third (a held key must not waste charges on scratches)", () => {
        const g = g0(), f = newFray(g, 1);
        const max = sheetOf(g).life;
        f.run.hero.life = max * 0.9;
        frayStep(g, f, { dx: 0, dy: 0, flask: true }, { flask: () => { throw new Error("drank at 90%"); } });
        f.run.hero.life = max * 0.6;
        expect(f.run.hero.flask).toBeGreaterThanOrEqual(10);
        let drank = 0;
        frayStep(g, f, { dx: 0, dy: 0, flask: true }, { flask: () => { drank++; } });
        expect(drank).toBe(1);
        expect(f.run.hero.flaskLeft).toBeGreaterThan(0);
        expect(f.run.hero.flask).toBe(20);
        expect(f.run.hero.flaskRate).toBeGreaterThan(0);
    });
    it("without the key it waits until life is low, then drinks by itself", () => {
        const g = g0(), f = newFray(g, 1);
        const max = sheetOf(g).life;
        f.run.hero.life = max * 0.9;
        let drank = 0;
        frayStep(g, f, STILL, { flask: () => { drank++; } });
        expect(drank).toBe(0);
        f.run.hero.life = max * 0.1;
        frayStep(g, f, STILL, { flask: () => { drank++; } });
        expect(drank).toBe(1);
    });
    it("full life or too few charges: no drink", () => {
        const g = g0(), f = newFray(g, 1);
        let drank = 0;
        frayStep(g, f, { dx: 0, dy: 0, flask: true }, { flask: () => { drank++; } });
        expect(drank).toBe(0);
        f.run.hero.life = 1; f.run.hero.flask = 9;
        frayStep(g, f, { dx: 0, dy: 0, flask: true }, { flask: () => { drank++; } });
        expect(drank).toBe(0);
    });
});

describe("the idle engine's kill rewards", () => {
    it("onKill with FRAY_BONUS pays half again the experience", () => {
        const g = g0();
        g.hero.level = 10; g.hero.rev++;
        const kill = (bonus: boolean) => {
            const s = structuredClone(g);
            const run = newFray(s, 1).run;
            const rng = new Rng(77);
            const m = makeMonster("drowned", 10, false, rng, null);
            m.life = 0;
            let paid = -1;
            onKill(s, run, m, sheetOf(s), rng, { kill: (_m, xp) => { paid = xp; } }, bonus ? FRAY_BONUS : undefined);
            expect(run.xp).toBe(paid);
            expect(run.kills).toBe(1);
            return paid;
        };
        const plain = kill(false), fray = kill(true);
        expect(plain).toBeGreaterThan(0);
        expect(fray).toBeGreaterThan(plain);
        expect(fray).toBeGreaterThanOrEqual(Math.floor(plain * FRAY_BONUS.xp) - 1);
        expect(fray).toBeLessThanOrEqual(Math.ceil(plain * FRAY_BONUS.xp) + 1);
    });
});

describe("the Fray in the save", () => {
    it("MIGRATIONS[8] adds empty tallies and keeps existing ones", () => {
        const s = JSON.parse(JSON.stringify(g0())) as any;
        delete s.fray;
        expect(MIGRATIONS[8]!(s).fray).toEqual({ runs: 0, won: 0, kills: 0, best: 0 });
        const t = { fray: { runs: 3, won: 2, kills: 40, best: 95 } };
        expect(MIGRATIONS[8]!(t).fray).toEqual({ runs: 3, won: 2, kills: 40, best: 95 });
    });
    it("validateState keeps good tallies and zeroes bad ones", () => {
        const good = g0() as any;
        good.fray = { runs: 3, won: 2, kills: 40, best: 95 };
        expect(validateState(structuredClone(good)).fray).toEqual({ runs: 3, won: 2, kills: 40, best: 95 });
        const bad = g0() as any;
        bad.fray = { runs: "3", won: -1, kills: NaN, best: Infinity, extra: 1 };
        expect(validateState(structuredClone(bad)).fray).toEqual({ runs: 0, won: 0, kills: 0, best: 0 });
        for (const junk of [undefined, null, "fray", 5, []]) {
            const s = g0() as any;
            s.fray = junk;
            expect(validateState(structuredClone(s)).fray).toEqual({ runs: 0, won: 0, kills: 0, best: 0 });
        }
        const frac = g0() as any;
        frac.fray = { runs: 2.7, won: 1, kills: 9, best: 61.4 };
        expect(validateState(structuredClone(frac)).fray).toEqual({ runs: 2, won: 1, kills: 9, best: 61 });
    });
});
