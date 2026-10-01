// Round 10: the Fray (src/core/fray.ts), and its second round: hordes, motes, boons, the roll, maps.

import { describe, expect, it } from "vitest";
import {
    ALIVE_CAP, ARENA_H, ARENA_W, BOONS, BOON_MAX, FRAY_BONUS, FRAY_STEP_MS, HERO_SPEED, HORDE, HORDE_BONUS, HORDE_LIFE, MOTE_CAP, MOTE_DRIFT, MOTE_FLASK,
    ROLL_CD, ROLL_S, ROLL_SPEED, SPAWN_CLEAR, SURGE_GROWTH, SURGE_KILLS, WAVE_EVERY,
    boonCount, dropMote, frayAdvance, frayMapPreview, fraySheet, frayStep, frayZone, frayZoneOf, monsterSpeed, newFray, newFrayTotals,
    type FrayEvents, type FrayInput, type FrayState,
} from "../src/core/fray";
import { MAP_AREAS, MAP_BOSS_LIFE, MONSTERS, PINNACLES, ZONES, ZONE_ORDER, monsterXp } from "../src/core/data";
import { newGame, sheetOf } from "../src/core/game";
import { advance, effectsOf, makeMonster, onKill, type KillBonus } from "../src/core/sim/engine";
import { Rng } from "../src/core/rng";
import { MIGRATIONS } from "../src/core/save";
import { validateState } from "../src/core/validate";
import type { GameState, MapItem } from "../src/core/state";
import { botTune } from "../tools/bot";

const HOUR = 3600e3;
const STILL: FrayInput = { dx: 0, dy: 0, flask: false, roll: false, pick: 0 };
const inp = (p: Partial<FrayInput> = {}): FrayInput => ({ ...STILL, ...p });
const g0 = (seed = 11, cls = "vanguard") => newGame({ name: "F", cls, now: 0, seed });
const inZone = (g: GameState, zone: string) => { g.activity.zone = zone; return g; };
const alive = (f: FrayState) => f.run.monsters.filter(m => m.life > 0).length;

/** Steps the fray for up to `secs` seconds' worth of steps (or until it ends); an offer is answered with the first boon. */
function fight(g: GameState, f: FrayState, secs: number, input: FrayInput | ((f: FrayState) => FrayInput) = STILL, ev: FrayEvents = {}): void {
    for (let i = 0; i < secs * 60 && f.outcome === "fight"; i++) {
        const x = typeof input === "function" ? input(f) : input;
        frayStep(g, f, f.offer && !x.pick ? { ...x, pick: 1 } : x, ev);
    }
}
/** Monsters that neither die nor swing (the wave machinery on its own). */
const freeze = (f: FrayState) => { for (const m of f.run.monsters) if (m.life > 0) { m.life = m.maxLife = 1e12; m.atk = 1e9; } };
/** Clears every living monster after each step, outside combat. */
const sweep = (g: GameState, f: FrayState, ev: FrayEvents = {}, max = 600 * 60) => {
    for (let i = 0; i < max && f.outcome === "fight"; i++) {
        frayStep(g, f, STILL, ev);
        for (const m of f.run.monsters) m.life = 0;
    }
};
/** Walks at the monsters, casters first (they stand off and shoot), answering offers with the first boon. */
const hunt = (f: FrayState): FrayInput => {
    let best: { x: number; y: number } | null = null, bd = Infinity;
    f.run.monsters.forEach((m, i) => {
        if (m.life <= 0) return;
        const fm = f.mons[i]!, d = Math.hypot(fm.x - f.hero.x, fm.y - f.hero.y) - (fm.caster ? 1000 : 0);
        if (d < bd) { bd = d; best = fm; }
    });
    const b = best as { x: number; y: number } | null;
    const far = b && Math.hypot(b.x - f.hero.x, b.y - f.hero.y) > 16;
    return { ...STILL, flask: true, pick: f.offer ? 1 : 0, ...(far ? { dx: b!.x - f.hero.x, dy: b!.y - f.hero.y } : {}) };
};

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
    it("same state, same seed, same inputs (walking, rolling, picking): identical JSON", () => {
        const a = g0(), b = g0();
        const fa = newFray(a, 7), fb = newFray(b, 7);
        const walk = (f: FrayState): FrayInput => ({ dx: Math.sin(f.t), dy: Math.cos(f.t * 0.7), flask: f.t > 20, roll: Math.round(f.t * 60) % 90 === 0, pick: f.offer ? 2 : 0 });
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
        fight(g, f, 600);
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
        const f = newFray(inZone(g, "a1_chapel"), 1);
        expect(f.zone).toBe("a1_chapel");
        expect(f.mode).toBe("road");
        expect(frayZone(inZone(g, "nowhere")).id).toBe("a1_shore");
        expect(newFrayTotals()).toEqual({ runs: 0, won: 0, kills: 0, best: 0 });
    });
});

describe("hordes", () => {
    it("every wave is the zone's pack size times HORDE; the total counts the boss", () => {
        for (const id of ["a1_shore", "a1_chapel", "a2_oasis"]) {
            const z = ZONES[id]!, f = newFray(inZone(g0(), id), 3);
            expect(f.plan.length).toBe(z.packs);
            expect(f.waves).toBe(z.packs);
            for (const n of f.plan) {
                expect(n % HORDE).toBe(0);
                expect(n).toBeGreaterThanOrEqual(z.packSize[0] * HORDE);
                expect(n).toBeLessThanOrEqual(z.packSize[1] * HORDE);
            }
            expect(f.total).toBe(f.plan.reduce((a, b) => a + b, 0) + (z.boss ? 1 : 0));
        }
    });
    it("the first wave starts within a second and streams in at a tenth of it a second, from the edges, clear of the hero", () => {
        const g = g0(), f = newFray(g, 4);
        let at = -1;
        for (let i = 0; i < 12 * 60; i++) {
            const n0 = f.run.monsters.length;
            frayStep(g, f, STILL, { wave: n => { if (n === 1) at = f.t; } });
            freeze(f);
            for (let j = n0; j < f.run.monsters.length; j++) {
                const fm = f.mons[j]!;
                const edge = Math.min(fm.x, ARENA_W - fm.x, fm.y, ARENA_H - fm.y);
                expect(edge).toBeLessThanOrEqual(8);
                expect(Math.hypot(fm.x - f.hero.x, fm.y - f.hero.y)).toBeGreaterThanOrEqual(SPAWN_CLEAR - 3);
            }
            if (at > 0 && Math.abs(f.t - at - 5) < 0.5 / 60) expect(Math.abs(f.released - f.plan[0]! / 2)).toBeLessThanOrEqual(2);
        }
        expect(at).toBeGreaterThan(0);
        expect(at).toBeLessThanOrEqual(1);
        expect(f.released).toBeGreaterThanOrEqual(f.plan[0]!); // all in after ten seconds
        expect(f.run.monsters.length).toBe(f.mons.length);
    });
    it("the stream pauses while ALIVE_CAP monsters stand", () => {
        const g = g0(), f = newFray(g, 2);
        f.plan = [400, 400]; f.waves = 2; f.total = 800;
        let most = 0;
        for (let i = 0; i < 20 * 60; i++) { frayStep(g, f, STILL); freeze(f); most = Math.max(most, alive(f)); }
        expect(most).toBe(ALIVE_CAP);
        expect(f.released).toBe(ALIVE_CAP);
        expect(f.pending).toBe(400 - ALIVE_CAP);
        expect(f.wave).toBe(1);
    });
    it("the next wave: at once when the last is in and thinned, else WAVE_EVERY seconds after it is in", () => {
        const times = (thin: boolean) => {
            const g = g0(), f = newFray(g, 5);
            f.plan = [36, 36]; f.waves = 2; f.total = 72;
            let inAt = -1, next = -1;
            for (let i = 0; i < 40 * 60 && next < 0; i++) {
                frayStep(g, f, STILL, { wave: n => { if (n === 2) next = f.t; } });
                if (thin) for (const m of f.run.monsters) m.life = 0; else freeze(f);
                if (inAt < 0 && f.wave === 1 && f.pending === 0) inAt = f.t;
            }
            return next - inAt;
        };
        expect(times(true)).toBeLessThanOrEqual(2 / 60 + 1e-9);
        expect(Math.abs(times(false) - WAVE_EVERY)).toBeLessThanOrEqual(2 / 60);
    });
    it("the boss comes after the last wave once fewer than ten stand; its death wins, stragglers or not", () => {
        const g = inZone(g0(), "a1_chapel"), f = newFray(g, 6);
        f.plan = [24]; f.waves = 1; f.total = 25;
        const seen: [number, boolean][] = [];
        let end = "";
        const ev: FrayEvents = { wave: (n, boss) => seen.push([n, boss]), end: o => { end = o; } };
        for (let i = 0; i < 16 * 60; i++) { frayStep(g, f, STILL, ev); freeze(f); }
        expect(f.pending).toBe(0);
        expect(alive(f)).toBe(24);
        expect(f.bossUp).toBe(false);
        f.run.monsters.slice(0, 15).forEach(m => { m.life = 0; });
        frayStep(g, f, STILL, ev);
        expect(f.bossUp).toBe(true);
        expect(seen).toEqual([[1, false], [1, true]]);
        expect(f.released).toBe(f.total);
        const boss = f.run.monsters.find(m => MONSTERS[m.def]!.boss)!;
        expect(boss.def).toBe(ZONES.a1_chapel!.boss);
        freeze(f);
        boss.life = 0;
        frayStep(g, f, STILL, ev);
        expect(end).toBe("won");
        expect(alive(f)).toBe(9);
    });
    it("swept clean: every wave, no boss on the shore, then the win", () => {
        const g = g0(), f = newFray(g, 6);
        const seen: [number, boolean][] = [];
        sweep(g, f, { wave: (n, boss) => seen.push([n, boss]) });
        expect(f.outcome).toBe("won");
        expect(seen).toEqual(Array.from({ length: ZONES.a1_shore!.packs }, (_, i) => [i + 1, false]));
        expect(f.released).toBe(f.total);
    });
    it("the dead leave the lists when a wave starts (the lists stay parallel)", () => {
        const g = g0(), f = newFray(g, 8);
        let checked = 0;
        for (let i = 0; i < 120 * 60 && f.outcome === "fight"; i++) {
            frayStep(g, f, inp({ pick: f.offer ? 1 : 0 }), {
                wave: () => {
                    checked++;
                    expect(f.run.monsters.every(m => m.life > 0)).toBe(true);
                    expect(f.mons.length).toBe(f.run.monsters.length);
                },
            });
            f.run.monsters.forEach((m, j) => { if (j % 2 === 0) m.life = 0; else { m.atk = 1e9; } });
        }
        expect(checked).toBeGreaterThanOrEqual(3);
    });
    it("horde monsters have HORDE_LIFE of their life; a wave's champion is whole", () => {
        const g = g0(), f = newFray(g, 4);
        let started = false;
        while (!started) frayStep(g, f, STILL, { wave: () => { started = true; } });
        f.champ = true;
        fight(g, f, 3);
        const eff = effectsOf(g, f.run);
        const champ = f.run.monsters[0]!;
        expect(champ.champion).toBe(true);
        expect(f.mons[0]!.horde).toBe(false);
        expect(champ.maxLife).toBe(makeMonster(champ.def, champ.level, true, new Rng(1), eff).maxLife);
        const horde = f.run.monsters.filter((m, i) => f.mons[i]!.horde);
        expect(horde.length).toBeGreaterThan(5);
        for (const m of horde) expect(m.maxLife).toBe(Math.max(1, Math.round(makeMonster(m.def, m.level, false, new Rng(1), eff).maxLife * HORDE_LIFE)));
    });
    it("a horde monster hits for less than half of a whole one's", () => {
        let checked = 0;
        for (const seed of [1, 2, 3, 4, 5, 6]) {
            const g = g0(seed), f = newFray(g, seed);
            fight(g, f, 2);
            const i = f.mons.findIndex(fm => fm.horde);
            const set = (gg: GameState, ff: FrayState, horde: boolean) => {
                ff.run.monsters.forEach((m, j) => { m.life = m.maxLife = 1e12; m.atk = j === i ? 1e-6 : 1e9; const fm = ff.mons[j]!; if (j !== i) { fm.x = 4; fm.y = 4; } });
                ff.mons[i]!.x = ff.hero.x + 4; ff.mons[i]!.y = ff.hero.y; ff.mons[i]!.horde = horde;
                let dmg = -1;
                frayStep(gg, ff, STILL, { monsterHit: (j, d, av) => { if (j === i && !av) dmg = d; } });
                return dmg;
            };
            const g2 = structuredClone(g), f2 = structuredClone(f);
            const small = set(g, f, true), whole = set(g2, f2, false);
            if (small < 0) continue;
            checked++;
            expect(small / whole, `seed ${seed}`).toBeGreaterThan(0.25);
            expect(small / whole, `seed ${seed}`).toBeLessThanOrEqual(0.4500001);
        }
        expect(checked).toBeGreaterThan(0);
    });
    it("the skill hits a crowd: an area skill up to three times its targets, more with Sweep", () => {
        const g = twoHours(), f = newFray(g, 1);
        const sk = fraySheet(g, f).skill;
        expect(sk.shape).toBe("area");
        f.plan = [60]; f.waves = 1; f.total = 60;
        for (let i = 0; i < 11 * 60; i++) { frayStep(g, f, STILL); freeze(f); }
        const ring = (ff: FrayState) => ff.mons.forEach((fm, j) => { fm.x = ff.hero.x + 6 * Math.cos(j); fm.y = ff.hero.y + 6 * Math.sin(j); });
        const cast = (gg: GameState, ff: FrayState) => {
            ring(ff); ff.run.hero.cd = 0; ff.run.hero.mana = 1e6;
            let n = -1;
            frayStep(gg, ff, STILL, { heroUse: (_fx, t) => { n = t.length; } });
            return n;
        };
        const g2 = structuredClone(g), f2 = structuredClone(f);
        expect(f.run.monsters.length).toBeGreaterThan(sk.targets * 3 + 6);
        expect(cast(g, f)).toBe(Math.max(8, sk.targets * 3));
        f2.boons = ["swarm"];
        expect(cast(g2, f2)).toBe(Math.max(8, (sk.targets + 2) * 3));
    });
});

describe("a fight to the end", () => {
    it("a fresh hero standing still on the shore wins or falls within ten minutes", () => {
        for (const seed of [1, 2, 3]) {
            const g = g0(seed), f = newFray(g, seed);
            fight(g, f, 600);
            expect(f.outcome, `seed ${seed}`).not.toBe("fight");
        }
    });
    it("a hero two hours into the idle game wins its road zone hunting the monsters (casters first), most seeds", () => {
        const base = twoHours();
        const results: string[] = [];
        for (const seed of [1, 2, 3]) {
            const g = structuredClone(base), f = newFray(g, seed);
            fight(g, f, 600, hunt);
            results.push(`${f.outcome}@${Math.round(f.t)}s wave ${f.wave}/${f.waves} kills ${f.run.kills}/${f.total} boons ${f.boons.length} life ${Math.round(f.run.hero.life)}`);
        }
        console.log(`level ${base.hero.level} in ${base.activity.zone}:`, results);
        expect(results.filter(r => r.startsWith("won")).length).toBeGreaterThanOrEqual(2);
    });
    it("the same hero standing still in its road zone falls, every seed (the casters shoot it down)", () => {
        const base = twoHours();
        for (const seed of [1, 2, 3]) {
            const g = structuredClone(base), f = newFray(g, seed);
            fight(g, f, 600);
            expect(f.outcome, `seed ${seed} at ${Math.round(f.t)} s`).toBe("fallen");
        }
    });
});

describe("the roll", () => {
    it("ROLL_S at ROLL_SPEED times walking speed, in the input's direction", () => {
        const g = g0(), f = newFray(g, 1);
        const x0 = f.hero.x;
        let rolled = 0;
        frayStep(g, f, inp({ dx: 1, roll: true }), { roll: () => { rolled++; } });
        let steps = 1;
        while (f.hero.roll > 0) { frayStep(g, f, inp({ dx: 1 })); steps++; }
        expect(rolled).toBe(1);
        expect(steps).toBe(Math.ceil(ROLL_S * 60));
        const rollDist = f.hero.x - x0, x1 = f.hero.x;
        for (let i = 0; i < steps; i++) frayStep(g, f, inp({ dx: 1 }));
        expect(rollDist / (f.hero.x - x1)).toBeCloseTo(ROLL_SPEED, 6);
    });
    it("standing still it rolls the way the hero faces", () => {
        const g = g0(), f = newFray(g, 1);
        f.hero.face = -1;
        const x0 = f.hero.x;
        frayStep(g, f, inp({ roll: true }));
        expect(f.hero.rollDx).toBe(-1);
        expect(f.hero.x).toBeLessThan(x0);
    });
    it("then ROLL_CD before the next one; Nimble shortens it", () => {
        const cd = (boons: string[]) => {
            const g = g0(), f = newFray(g, 1);
            f.boons = boons;
            frayStep(g, f, inp({ roll: true }));
            let steps = 1, rolls = 1;
            while (rolls < 2 && steps < 300) { frayStep(g, f, inp({ roll: true }), { roll: () => { rolls++; } }); steps++; }
            return (steps - 1) / 60;
        };
        expect(Math.abs(cd([]) - (ROLL_S + ROLL_CD))).toBeLessThanOrEqual(1.5 / 60);
        expect(Math.abs(cd(["nimble"]) - (ROLL_S + ROLL_CD * 0.7))).toBeLessThanOrEqual(1.5 / 60);
    });
    it("no monster lands a hit during a roll (each swing is an evade); after it they do again", () => {
        const g = g0(), f = newFray(g, 3);
        fight(g, f, 3);
        expect(f.run.monsters.length).toBeGreaterThanOrEqual(6);
        const crowd = () => f.run.monsters.forEach((m, j) => {
            m.life = m.maxLife = 1e12; m.atk = 0;
            f.mons[j]!.x = f.hero.x + 4 * Math.cos(j); f.mons[j]!.y = f.hero.y + 4 * Math.sin(j);
        });
        const h = f.run.hero;
        h.life = sheetOf(g).life; h.es = 0;
        const hits: [number, string | null][] = [];
        const ev: FrayEvents = { monsterHit: (_i, d, av) => hits.push([d, av]) };
        crowd();
        frayStep(g, f, inp({ dx: 1, roll: true }), ev);
        while (f.hero.roll > 0) { crowd(); frayStep(g, f, inp({ dx: 1 }), ev); }
        expect(hits.length).toBeGreaterThan(20);
        expect(hits.every(([d, av]) => d === 0 && av === "evade")).toBe(true);
        expect(h.life).toBeGreaterThanOrEqual(sheetOf(g).life - 1e-9);
        hits.length = 0;
        for (let k = 0; k < 3; k++) { crowd(); frayStep(g, f, STILL, ev); }
        expect(hits.some(([d]) => d > 0)).toBe(true);
    });
});

describe("kiting", () => {
    it("the hero outruns every monster but bosses", () => {
        for (const [id, d] of Object.entries(MONSTERS)) {
            if (d.boss) continue;
            expect(monsterSpeed(id, false), id).toBeLessThan(HERO_SPEED);
        }
    });
    /** Walks away from the nearest living monster, steering off walls it is within 30 px of. */
    const fleeOpen = (f: FrayState): FrayInput => {
        let b: { x: number; y: number } | null = null, bd = Infinity;
        f.run.monsters.forEach((m, i) => { if (m.life <= 0) return; const fm = f.mons[i]!, d = Math.hypot(fm.x - f.hero.x, fm.y - f.hero.y); if (d < bd) { bd = d; b = fm; } });
        const n = b as { x: number; y: number } | null;
        if (!n) return STILL;
        const d = Math.hypot(f.hero.x - n.x, f.hero.y - n.y) || 1;
        let dx = (f.hero.x - n.x) / d, dy = (f.hero.y - n.y) / d;
        if (f.hero.x < 30) dx += 1; if (f.hero.x > ARENA_W - 30) dx -= 1;
        if (f.hero.y < 30) dy += 1; if (f.hero.y > ARENA_H - 30) dy -= 1;
        return { ...STILL, dx, dy };
    };
    it("kiting clear of the walls takes fewer hits than standing still, over three seeds", () => {
        const hits = (input: FrayInput | ((f: FrayState) => FrayInput), seed: number) => {
            const g = g0(seed), f = newFray(g, seed);
            let n = 0;
            fight(g, f, 30, input, { monsterHit: (_i, d) => { if (d > 0) n++; } });
            return n;
        };
        const still = [1, 2, 3].map(s => hits(STILL, s)), away = [1, 2, 3].map(s => hits(fleeOpen, s));
        expect(away.reduce((a, b) => a + b, 0), `still ${still} away ${away}`).toBeLessThan(still.reduce((a, b) => a + b, 0));
    });
});

describe("motes", () => {
    it("a kill's experience lies on the floor until it is walked over; the hero's only moves on a pickup", () => {
        const g = inZone(twoHours(), "a2_shards"), f = newFray(g, 2);
        let killed = 0, picked = 0, motes = 0;
        for (let i = 0; i < 24 * 60 && f.outcome === "fight"; i++) {
            const lv = g.hero.level, xp = g.hero.xp;
            let moved = false;
            frayStep(g, f, inp({ pick: f.offer ? 1 : 0 }), { kill: (_m, x) => { killed += x; }, mote: x => { picked += x; motes++; moved = true; } });
            if (!moved) { expect(g.hero.level).toBe(lv); expect(g.hero.xp).toBe(xp); }
        }
        expect(motes).toBeGreaterThan(20);
        expect(killed).toBeGreaterThan(0);
        expect(f.run.xp).toBe(picked);
        expect(killed).toBe(picked + f.motes.reduce((a, m) => a + m.xp, 0));
    });
    it("motes drift to the hero within the magnet's reach, are picked up underfoot, and fade after 25 s", () => {
        const g = g0(), f = newFray(g, 1);
        const h = f.hero, xp0 = g.hero.xp;
        f.motes.push({ x: h.x + 40, y: h.y, xp: 7, t: 0 }, { x: h.x - 60, y: h.y, xp: 9, t: 0 }, { x: h.x, y: h.y + 100, xp: 3, t: -30 });
        const got: number[] = [];
        frayStep(g, f, STILL, { mote: x => got.push(x) });
        expect(f.motes.length).toBe(2);
        expect(f.motes[0]!.x).toBeCloseTo(h.x + 40 - MOTE_DRIFT / 60, 6);
        expect(f.motes[1]!.x).toBe(h.x - 60);
        for (let i = 0; i < 30; i++) frayStep(g, f, STILL, { mote: x => got.push(x) });
        expect(got).toEqual([7]);
        expect(f.run.xp).toBe(7);
        expect(f.surge).toBe(7);
        expect(g.hero.xp).toBe(xp0 + 7);
        expect(f.motes[0]!.x).toBe(h.x - 60);
        // Lodestone: the far one comes too.
        f.boons = ["magnet"];
        for (let i = 0; i < 60; i++) frayStep(g, f, STILL, { mote: x => got.push(x) });
        expect(got).toEqual([7, 9]);
    });
    it("past MOTE_CAP the oldest merges into its nearest neighbour; nothing is lost", () => {
        const g = g0(), f = newFray(g, 1);
        for (let i = 0; i < MOTE_CAP; i++) dropMote(f, { x: 20 + (i % 30) * 10, y: 20 + Math.floor(i / 30) * 10, xp: i + 1, t: i });
        dropMote(f, { x: 0, y: 0, xp: 0, flask: true, t: 999 });
        const sum = f.motes.reduce((a, m) => a + m.xp, 0);
        expect(f.motes.length).toBe(MOTE_CAP);
        expect(f.motes.some(m => m.t === 0)).toBe(false);
        expect(f.motes.some(m => m.flask)).toBe(true);
        expect(sum).toBe(MOTE_CAP * (MOTE_CAP + 1) / 2);
    });
    it("a flask mote gives MOTE_FLASK charges back; champions and bosses drop one", () => {
        const g = g0(), f = newFray(g, 1);
        f.run.hero.flask = 5;
        const got: [number, boolean][] = [];
        f.motes.push({ x: f.hero.x, y: f.hero.y, xp: 0, flask: true, t: 0 });
        frayStep(g, f, STILL, { mote: (x, fl) => got.push([x, fl]) });
        expect(got).toEqual([[0, true]]);
        expect(f.run.hero.flask).toBe(5 + MOTE_FLASK);
        // A real boss kill in the chapel.
        const g2 = inZone(twoHours(), "a1_chapel"), f2 = newFray(g2, 1);
        let bigKill = false, flaskMote = false;
        for (let i = 0; i < 600 * 60 && f2.outcome === "fight" && !flaskMote; i++) {
            bigKill = false;
            frayStep(g2, f2, hunt(f2), { kill: m => { if (m.champion || MONSTERS[m.def]!.boss) bigKill = true; }, mote: (_x, fl) => { if (fl) flaskMote = true; } });
            if (bigKill && f2.motes.some(m => m.flask)) flaskMote = true;
        }
        expect(flaskMote).toBe(true);
    });
});

describe("boons", () => {
    it("the first surge is six horde kills of the zone's level", () => {
        const f = newFray(inZone(g0(), "a1_chapel"), 1);
        expect(f.surgeNeed).toBeCloseTo(SURGE_KILLS * monsterXp(ZONES.a1_chapel!.level) * 0.3 * 1.5, 9);
    });
    it("a full surge offers three distinct boons and holds the fight until one is picked", () => {
        const g = g0(), f = newFray(g, 1);
        f.surge = f.surgeNeed;
        let offered: string[] = [];
        frayStep(g, f, STILL, { offer: ids => { offered = ids; } });
        expect(f.offer).toHaveLength(3);
        expect(new Set(f.offer).size).toBe(3);
        expect(f.offer!.every(id => BOONS.includes(id))).toBe(true);
        expect(offered).toEqual(f.offer);
        const held = JSON.stringify(f), gs = JSON.stringify(g);
        for (let i = 0; i < 30; i++) frayStep(g, f, inp({ dx: 1, roll: true }));
        frayStep(g, f, inp({ pick: 0 }));
        expect(JSON.stringify(f)).toBe(held);
        expect(JSON.stringify(g)).toBe(gs);
        const t0 = f.t, need = f.surgeNeed, id = f.offer![1]!;
        let took = "";
        frayStep(g, f, inp({ pick: 2 }), { boon: b => { took = b; } });
        expect(took).toBe(id);
        expect(f.boons).toEqual([id]);
        expect(boonCount(f, id)).toBe(1);
        expect(f.offer).toBeNull();
        expect(f.surgeNeed).toBeCloseTo(need * SURGE_GROWTH, 9);
        expect(f.surge).toBeCloseTo(0, 9);
        expect(f.t).toBeGreaterThan(t0);
    });
    it("a boon at BOON_MAX stacks is not offered again", () => {
        const g = g0(), f = newFray(g, 1);
        f.boons = BOONS.slice(0, 6).flatMap(id => Array(BOON_MAX).fill(id) as string[]);
        f.surge = f.surgeNeed;
        frayStep(g, f, STILL);
        expect([...f.offer!].sort()).toEqual(BOONS.slice(6).sort());
        f.offer = null;
        f.boons = BOONS.flatMap(id => Array(BOON_MAX).fill(id) as string[]);
        f.surge = f.surgeNeed * 5;
        frayStep(g, f, STILL);
        expect(f.offer).toBeNull();
        expect(f.surge).toBe(f.surgeNeed);
    });
    it("the sheet: Vigour (and its heal), Haste, Sweep, Red Thirst", () => {
        const g = g0(), f = newFray(g, 1);
        const base = sheetOf(g);
        f.boons = ["vigor", "vigor", "haste", "haste", "haste", "swarm", "leech", "leech"];
        const s = fraySheet(g, f);
        expect(s.life).toBeCloseTo(base.life * 1.24, 9);
        expect(s.moveSpeed).toBeCloseTo(base.moveSpeed * 1.36, 9);
        expect(s.skill.targets).toBe(base.skill.targets + 2);
        expect(s.skill.leech).toBe(base.skill.leech + 4);
        expect(sheetOf(g)).toBe(base); // the hero's own sheet is untouched
        // Picking Vigour heals the 12% it adds.
        f.run.hero.life = 10;
        f.offer = ["vigor", "fury", "reach"];
        frayStep(g, f, inp({ pick: 1 }));
        expect(fraySheet(g, f).life).toBeCloseTo(base.life * 1.36, 9);
        expect(f.run.hero.life).toBeGreaterThanOrEqual(10 + base.life * 0.12);
        expect(f.run.hero.life).toBeLessThan(10 + base.life * 0.12 + 2);
    });
    it("Fury: 15% more damage a stack; Reach: the skill reaches 20% further", () => {
        const g = g0(), f = newFray(g, 2);
        fight(g, f, 2);
        const setup = (ff: FrayState, at: number) => {
            ff.run.monsters.forEach((m, j) => { m.life = m.maxLife = 1e12; m.atk = 1e9; ff.mons[j]!.x = 4; ff.mons[j]!.y = 4; });
            ff.mons[0]!.x = ff.hero.x + at; ff.mons[0]!.y = ff.hero.y;
            ff.run.hero.cd = 0; ff.run.hero.mana = 1e6;
        };
        const hit = (gg: GameState, ff: FrayState) => { let d = -1; frayStep(gg, ff, STILL, { heroHit: (i, dmg) => { if (i === 0) d = dmg; } }); return d; };
        let compared = false;
        for (let k = 0; k < 20 && !compared; k++) {
            const ga = structuredClone(g), fa = structuredClone(f), gb = structuredClone(g), fb = structuredClone(f);
            fb.boons = ["fury", "fury"];
            setup(fa, 10); setup(fb, 10);
            const a = hit(ga, fa), b = hit(gb, fb);
            if (a > 0) { expect(b / a).toBeCloseTo(1.15 * 1.15, 9); compared = true; }
            fight(g, f, 0.1);
        }
        expect(compared).toBe(true);
        // Reach: a monster just out of the skill's reach is hit with one stack.
        const shape = fraySheet(g, f).skill.shape;
        const reach = shape === "projectile" ? 140 : shape === "area" ? 44 : 30;
        const used = (boons: string[]) => {
            const gg = structuredClone(g), ff = structuredClone(f);
            ff.boons = boons;
            setup(ff, reach * 1.1);
            let n = 0;
            frayStep(gg, ff, STILL, { heroUse: () => { n++; } });
            return n;
        };
        expect(used([])).toBe(0);
        expect(used(["reach"])).toBe(1);
    });
});

describe("maps", () => {
    const area = Object.keys(MAP_AREAS).sort()[0]!;
    const withMaps = (tiers: number[], mods: string[] = [], g = g0()) => {
        g.world.rewards.push("endgame:early");
        g.activity.autoPush = false; // a level-1 hero's auto-push would keep to tier 1 (startMapRun's experience cap)
        g.maps = tiers.map((tier, i): MapItem => ({ uid: 9000 + i, tier, area, mods: [...mods], rarity: mods.length ? "enchanted" : "plain" }));
        return g;
    };
    it("no map in the stash: no preview, no fray, nothing taken", () => {
        const g = withMaps([]);
        const before = JSON.stringify(g);
        expect(frayMapPreview(g)).toBeNull();
        expect(newFray(g, 1, { map: true })).toBeNull();
        expect(JSON.stringify(g)).toBe(before);
    });
    it("the preview names the device's pick without taking it; the fray takes it out of the stash", () => {
        const g = withMaps([3, 5]);
        const pv = frayMapPreview(g)!;
        expect(pv.tier).toBe(5);
        expect(g.maps).toContain(pv);
        expect(g.maps.length).toBe(2);
        const f = newFray(g, 1, { map: true })!;
        expect(f.mode).toBe("map");
        expect(f.zone).toBe("map");
        expect(f.run.map).toMatchObject({ tier: 5, area });
        expect(g.maps.map(m => m.tier)).toEqual([3]);
        expect(frayZoneOf(g, f).level).toBe(f.run.map!.level);
        // A device capped below every map held fights the map at the cap: the preview says so (a copy).
        const c = withMaps([5]);
        c.activity.mapTier = 4;
        const cp = frayMapPreview(c)!;
        expect(cp.tier).toBe(4);
        expect(c.maps[0]!.tier).toBe(5);
        expect(newFray(c, 1, { map: true })!.run.map!.tier).toBe(4);
    });
    it("a queued pinnacle stays queued: the Fray takes maps only", () => {
        const g = withMaps([2]);
        const pin = Object.values(PINNACLES)[0]!;
        g.activity.pinnacle = pin.id;
        g.sigils[pin.sigil] = 99;
        expect(frayMapPreview(g)!.tier).toBe(2);
        const f = newFray(g, 1, { map: true })!;
        expect(f.run.map!.pinnacle).toBeUndefined();
        expect(g.activity.pinnacle).toBe(pin.id);
        expect(g.sigils[pin.sigil]).toBe(99);
    });
    it("the map's mods reach the monsters, the boss and the hero", () => {
        const g = withMaps([4], ["hardy", "brittle", "overlord"]);
        const f = newFray(g, 1, { map: true })!;
        const eff = effectsOf(g, f.run)!;
        expect(eff.life).toBeGreaterThan(1.39);
        expect(eff.bossLife).toBeCloseTo(1.8, 9);
        expect(fraySheet(g, f).dmgTaken).toBeGreaterThan(sheetOf(g).dmgTaken);
        fight(g, f, 3);
        const m = f.run.monsters.find((_, i) => f.mons[i]!.horde)!;
        expect(m.level).toBe(f.run.map!.level);
        expect(m.maxLife).toBe(Math.max(1, Math.round(makeMonster(m.def, m.level, false, new Rng(1), eff).maxLife * HORDE_LIFE)));
        // Sweep to the boss.
        const z = frayZoneOf(g, f);
        while (!f.bossUp && f.outcome === "fight") { frayStep(g, f, STILL); for (const x of f.run.monsters) x.life = 0; }
        const boss = f.run.monsters.find(x => MONSTERS[x.def]!.boss)!;
        expect(boss.def).toBe(z.boss);
        expect(boss.maxLife).toBe(Math.round(makeMonster(z.boss!, z.level + 1, false, new Rng(1), eff).maxLife * MAP_BOSS_LIFE * eff.bossLife));
    });
    it("a won map fray completes the map: the atlas tier, the maps contract, the log", () => {
        const g = withMaps([5]);
        g.contracts.list[0] = { kind: "maps", target: 3, n: 0, tier: 1, dust: 1 };
        const f = newFray(g, 1, { map: true })!;
        let end = "";
        sweep(g, f, { end: o => { end = o; } });
        expect(end).toBe("won");
        expect(g.atlas.tiers).toContain(5);
        expect(g.contracts.list[0]!.n).toBe(1);
        expect(g.log.find(x => x.key === "log.frayWon")?.params?.place).toBe(`@map:${area}:5:`);
        expect(g.maps.length).toBe(0);
    });
    it("a fall in a map loses the map and nothing else", () => {
        const g = withMaps([8, 1]);
        const f = newFray(g, 1, { map: true })!;
        const lv = g.hero.level, xp = g.hero.xp;
        let lostXp = false;
        fight(g, f, 600, STILL, { level: () => { /* a level-up is fine */ } });
        expect(f.outcome).toBe("fallen");
        if (g.hero.level === lv && g.hero.xp < xp) lostXp = true;
        expect(lostXp).toBe(false);
        expect(g.maps.map(m => m.tier)).toEqual([1]);
        expect(g.atlas.tiers).not.toContain(8);
        expect(g.log.find(x => x.key === "log.frayFell")?.params?.place).toBe(`@map:${area}:8:`);
    });
});

describe("rewards", () => {
    it("a won fray: the end event, the tallies, spoils, experience and the log", () => {
        const g = g0(1), f = newFray(g, 1);
        // A win without combat: the waves are cleared as they come.
        const lv0 = g.hero.level, xp0 = g.hero.xp;
        const loot: string[] = [];
        let end = "", endLoot = -1;
        sweep(g, f, { loot: it => loot.push(it.base), end: o => { end = o; endLoot = loot.length; } });
        expect(end).toBe("won");
        expect(f.outcome).toBe("won");
        expect(g.fray).toEqual({ runs: 1, won: 1, kills: 0, best: Math.round(f.t) });
        expect(endLoot).toBeGreaterThanOrEqual(1); // the spoils item, before the end event
        expect(g.hero.level > lv0 || g.hero.xp > xp0).toBe(true);
        const e = g.log.find(x => x.key === "log.frayWon");
        expect(e?.params).toMatchObject({ place: "@zone:a1_shore", kills: 0, secs: Math.round(f.t) });
    });
    it("a won fray in real combat pays kills, sweeps up the motes left and keeps the fastest time", () => {
        const g = inZone(twoHours(), "a2_shards");
        const won0 = g.fray?.won ?? 0;
        let kills = 0;
        const f = newFray(g, 2);
        const ft0 = g.fray!.kills;
        fight(g, f, 600, STILL, { kill: () => { kills++; } });
        expect(f.outcome).toBe("won");
        expect(g.fray!.won).toBe(won0 + 1);
        expect(g.fray!.kills - ft0).toBe(kills);
        expect(f.run.kills).toBe(f.total);
        expect(f.motes).toEqual([]);
        expect(g.fray!.best).toBeLessThanOrEqual(Math.round(f.t));
        // A slower second win does not overwrite the best.
        g.fray!.best = 1;
        const f2 = newFray(g, 3);
        fight(g, f2, 600);
        expect(f2.outcome).toBe("won");
        expect(g.fray!.best).toBe(1);
    });
    it("a fallen fray: the end event, a run without a win, the log", () => {
        const g = inZone(g0(1), ZONE_ORDER[12]!), f = newFray(g, 1);
        let end = "", died = "";
        fight(g, f, 600, STILL, { end: o => { end = o; }, death: z => { died = z; } });
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
        frayStep(g, f, inp({ flask: true }), { flask: () => { throw new Error("drank at 90%"); } });
        f.run.hero.life = max * 0.6;
        expect(f.run.hero.flask).toBeGreaterThanOrEqual(10);
        let drank = 0;
        frayStep(g, f, inp({ flask: true }), { flask: () => { drank++; } });
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
        frayStep(g, f, inp({ flask: true }), { flask: () => { drank++; } });
        expect(drank).toBe(0);
        f.run.hero.life = 1; f.run.hero.flask = 9;
        frayStep(g, f, inp({ flask: true }), { flask: () => { drank++; } });
        expect(drank).toBe(0);
    });
});

describe("the idle engine's kill rewards (KillBonus)", () => {
    const base = () => { const g = g0(); g.hero.level = 10; g.hero.rev++; return g; };
    /** `n` kills of a level-10 monster through onKill with `bonus`; what moved. */
    const kills = (bonus: KillBonus | undefined, n: number, def = "drowned", g = base()) => {
        const run = newFray(g, 1).run;
        const rng = new Rng(77);
        let drops = 0, paid = 0;
        const ev = { loot: () => { drops++; }, currency: () => { drops++; }, kill: (_m: unknown, xp: number) => { paid += xp; } };
        const k0 = g.totals.kills;
        for (let i = 0; i < n; i++) {
            const m = makeMonster(def, 10, false, rng, null);
            m.life = 0;
            onKill(g, run, m, sheetOf(g), rng, ev, bonus);
        }
        return { g, run, rng: rng.state(), drops, paid, counted: g.totals.kills - k0 };
    };
    it("FRAY_BONUS pays half again the experience", () => {
        const plain = kills(undefined, 1).paid, fray = kills(FRAY_BONUS, 1).paid;
        expect(plain).toBeGreaterThan(0);
        expect(fray).toBeGreaterThanOrEqual(Math.floor(plain * 1.5) - 1);
        expect(fray).toBeLessThanOrEqual(Math.ceil(plain * 1.5) + 1);
    });
    it("a neutral bonus changes nothing at all (the idle engine's path is the same)", () => {
        const a = kills(undefined, 300), b = kills({ xp: 1, rarity: 0 }, 300), c = kills({ xp: 1, rarity: 0, drop: 1 }, 300);
        expect(JSON.stringify(b.g)).toBe(JSON.stringify(a.g));
        expect(JSON.stringify(c.g)).toBe(JSON.stringify(a.g));
        expect(b.rng).toEqual(a.rng);
    });
    it("tally: only that share of kills counts for the totals; bosses always do", () => {
        const r = kills({ xp: 1, rarity: 0, tally: 0.2 }, 1000);
        expect(r.run.kills).toBe(1000);
        expect(r.counted).toBeGreaterThan(140);
        expect(r.counted).toBeLessThan(260);
        const boss = Object.keys(MONSTERS).find(id => MONSTERS[id]!.boss)!;
        expect(kills({ xp: 1, rarity: 0, tally: 0 }, 5, boss).counted).toBe(5);
        expect(kills({ xp: 1, rarity: 0, tally: 0 }, 50).counted).toBe(0);
    });
    it("drop multiplies the drop chances", () => {
        const full = kills({ xp: 1, rarity: 0 }, 3000).drops, fifth = kills({ xp: 1, rarity: 0, drop: 0.2 }, 3000).drops;
        expect(full).toBeGreaterThan(100);
        expect(fifth / full).toBeGreaterThan(0.1);
        expect(fifth / full).toBeLessThan(0.32);
    });
    it("xpSink takes the experience instead of the hero", () => {
        const g = base(), lv = g.hero.level, xp = g.hero.xp;
        let sunk = 0;
        const r = kills({ xp: 1, rarity: 0, xpSink: x => { sunk += x; } }, 20, "drowned", g);
        expect(sunk).toBe(r.paid);
        expect(sunk).toBeGreaterThan(0);
        expect(g.hero.level).toBe(lv);
        expect(g.hero.xp).toBe(xp);
        expect(r.run.xp).toBe(0);
    });
    it("the Fray's horde terms: less experience, a fifth of the drops, a fifth of the tallies", () => {
        expect(HORDE_BONUS).toMatchObject({ xp: 1.5 * 0.3, rarity: 60, drop: 0.2, tally: 0.2 });
        expect(FRAY_BONUS).toEqual({ xp: 1.5, rarity: 60 });
    });
});

describe("the step's cost", () => {
    it(`${ALIVE_CAP} monsters alive: 600 steps well under 1.5 s`, () => {
        const g = g0(), f = newFray(g, 1);
        f.plan = [400]; f.waves = 1; f.total = 400;
        // Fill the arena with monsters that cannot die; they swing at a hero kept standing.
        const max = sheetOf(g).life;
        for (let i = 0; i < 8 * 60 && alive(f) < ALIVE_CAP; i++) { frayStep(g, f, STILL); for (const m of f.run.monsters) m.life = m.maxLife = 1e12; f.run.hero.life = max; }
        expect(alive(f)).toBe(ALIVE_CAP);
        const t0 = performance.now();
        for (let i = 0; i < 600; i++) {
            frayStep(g, f, inp({ dx: Math.sin(i / 30), dy: Math.cos(i / 40) }));
            f.run.hero.life = max;
        }
        const ms = performance.now() - t0;
        console.log(`${ALIVE_CAP} alive: ${(ms / 600).toFixed(3)} ms a step`);
        expect(f.outcome).toBe("fight");
        expect(alive(f)).toBe(ALIVE_CAP);
        expect(ms).toBeLessThan(1500);
    });
});

describe("the Fray in the save", () => {
    it("MIGRATIONS[10] adds empty tallies and keeps existing ones", () => {
        const s = JSON.parse(JSON.stringify(g0())) as any;
        delete s.fray;
        expect(MIGRATIONS[10]!(s).fray).toEqual({ runs: 0, won: 0, kills: 0, best: 0 });
        const t = { fray: { runs: 3, won: 2, kills: 40, best: 95 } };
        expect(MIGRATIONS[10]!(t).fray).toEqual({ runs: 3, won: 2, kills: 40, best: 95 });
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
