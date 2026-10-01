// The Fray (GDD): the player takes the hero's reins for one fight on the current
// road, or on a map from the device. A flat arena seen from three-quarters above;
// the hero walks (and rolls) where the keys say, the equipped skill fires on its
// own at whatever is in reach, hordes stream in from the edges wave by wave and
// the zone's boss comes last. Kills leave motes of experience to walk over, and a
// full surge of them offers a boon for this fight (a survivors-like level-up).
// The maths is the idle engine's (the same hit rolls, the same loot path), so a
// build that works on the road works here; kiting and rolling are what the player
// adds.
//
// Pure like the rest of the core: 60 steps a second, time and input come in as
// arguments, randomness from the fray's own Rng. Nothing here touches the idle
// run; the UI holds the idle clock still while a fray is on.

import { Rng, hashSeed, type RngState } from "./rng";
import { CURRENCIES, CURRENCY_ORDER, MONSTERS, ZONES, monsterXp, xpPenalty, type ZoneDef } from "./data";
import type { Sheet } from "./character";
import type { GameState, MapItem, MonsterState, RunMap, RunState } from "./state";
import { receiveItem, pushLog } from "./game";
import { rollItem } from "./items";
import { rollSockets } from "./sockets";
import { applyLeech, bossDamageMult, effectsOf, flaskAmount, FLASK_COST, FLASK_MAX, FLASK_S, gainXp, heroHitRoll, makeBoss, makeMonster, monsterHitRoll, monsterSwing, onKill, sheetFor, type KillBonus, type SimEvents } from "./sim/engine";
import { atlasEffects, completeMap, mapZone, startMapRun } from "./maps";
import { contractEvent } from "./contracts";
import { checkFeats } from "./feats";
import { lanternRate, touch } from "./season";
import { ref } from "../i18n/refs";

export const FRAY_STEP_MS = 1000 / 60;
const DT = FRAY_STEP_MS / 1000;
/** The arena in logical pixels (the renderer scales and pans it). */
export const ARENA_W = 640, ARENA_H = 400;
/** Hero walking speed in pixels per second, times the sheet's movement speed. */
export const HERO_SPEED = 66;

/** A wave is the zone's pack size times this many monsters. */
export const HORDE = 12;
/** A wave streams in over this many seconds (waveSize / WAVE_RELEASE_S a second). */
export const WAVE_RELEASE_S = 10;
/** Once a wave is all in, the next comes when fewer than WAVE_NEXT_ALIVE stand, or after WAVE_EVERY seconds. */
export const WAVE_EVERY = 8;
export const WAVE_NEXT_ALIVE = 25;
/** After the last wave, the boss comes once fewer than this many stand. */
export const BOSS_ALIVE = 10;
/** The stream pauses while this many monsters stand. */
export const ALIVE_CAP = 160;
/** Monsters enter at the edges, at least this far from the hero. */
export const SPAWN_CLEAR = 90;
/** Horde monsters (not champions, bosses or lantern-bearers) have this share of their life and deal this share of their damage. */
export const HORDE_LIFE = 0.3, HORDE_DAMAGE = 0.45;
/** What a champion's or boss's kill pays over the road: experience and loot rarity. */
export const FRAY_BONUS: KillBonus = { xp: 1.5, rarity: 60 };
/** A horde kill: the experience follows the life, a fifth of the drop chances, and one in five counts for the tallies. */
export const HORDE_BONUS: KillBonus = { xp: 1.5 * HORDE_LIFE, rarity: 60, drop: 0.2, tally: 0.2 };

/** Motes: picked up within MOTE_PICK px, drift to the hero within the magnet radius at MOTE_DRIFT px/s, fade after MOTE_LIFE_S. */
export const MOTE_PICK = 12, MOTE_MAGNET = 48, MOTE_DRIFT = 90, MOTE_LIFE_S = 25;
/** At most this many motes lie about; the oldest merges into its nearest neighbour. */
export const MOTE_CAP = 240;
/** Flask charges a flask mote (champions, bosses) gives back. */
export const MOTE_FLASK = 10;

/** The boons a full surge offers (three at a time), at most BOON_MAX stacks each. */
export const BOONS: readonly string[] = ["haste", "fury", "reach", "magnet", "vigor", "leech", "nimble", "swarm"];
export const BOON_MAX = 3;
/** The first surge is this many horde kills of the zone's level; each pick multiplies it by SURGE_GROWTH. */
export const SURGE_KILLS = 6, SURGE_GROWTH = 1.6;

/** The dodge roll: ROLL_S seconds at ROLL_SPEED times walking speed, untouchable, then ROLL_CD seconds before the next. */
export const ROLL_S = 0.22, ROLL_CD = 0.8, ROLL_SPEED = 3.5;

/** How far the hero's skill reaches: melee, area (around the hero) and projectiles (bosses count 10 px nearer). */
export const FRAY_REACH = { single: 30, area: 44, projectile: 140 } as const;
/** Spell casters stay CAST_KEEP-CAST_RANGE px from the hero and hit from CAST_RANGE + 12. */
export const CAST_RANGE = 96, CAST_KEEP = 72;
/** The flask drinks itself below this share of life (the player is meant to press it first)... */
const AUTO_FLASK = 0.2;
/** ...and the key only works below this share, so a held key doesn't spend the charges on scratches. */
const KEY_FLASK = 0.7;
/** Monsters push apart within this many pixels. */
const SEP = 14;
/** The dead leave the lists when a wave starts, or when more than this many lie in them (at a step's start). */
const COMPACT_DEAD = 48;

/**
 * What the player does this step. `roll` is edge-triggered (true for one step);
 * `pick` (1-3) chooses from a boon offer, 0 otherwise.
 */
export interface FrayInput { dx: number; dy: number; flask: boolean; roll: boolean; pick: 0 | 1 | 2 | 3 }

/** Where a monster is and how it moves; parallel to run.monsters. */
export interface FrayMon {
    x: number; y: number; vx: number; vy: number;
    /** Its reach in pixels. */ reach: number;
    /** Pixels per second. */ speed: number;
    /** Hits from range. */ caster: boolean;
    /** A horde monster: less life, less damage, smaller rewards. */ horde: boolean;
}

/** A mote of experience on the floor (or, `flask`, of flask charges). `t` is the fray time it fell. */
export interface FrayMote { x: number; y: number; xp: number; flask?: boolean; t: number }

export interface FrayState {
    rng: RngState;
    /** The zone's id ("map" in a map). */
    zone: string;
    mode: "road" | "map";
    /** Hero vitals, monsters, kills and experience in the idle engine's shape (onKill reads it); `run.map` in a map. */
    run: RunState;
    mons: FrayMon[];
    hero: {
        x: number; y: number; /** 1 right, -1 left. */ face: 1 | -1; moving: boolean;
        /** Seconds left in a roll (0: not rolling) and until the next roll is ready. */ roll: number; rollCd: number;
        /** The roll's direction (unit vector). */ rollDx: number; rollDy: number;
    };
    wave: number;
    waves: number;
    /** The zone's boss is still to come. */
    bossAhead: boolean;
    bossUp: boolean;
    /** Seconds until the next wave comes regardless (counts once the current wave is all in). */
    next: number;
    outcome: "fight" | "won" | "fallen";
    /** Seconds elapsed. */
    t: number;
    /** Milliseconds not yet stepped. */
    acc: number;
    /** Monsters in each wave (rolled at the start). */
    plan: number[];
    /** Monsters planned this fray: every wave plus the boss. */
    total: number;
    /** Monsters released so far (the boss included). */
    released: number;
    /** Monsters of the current wave still to come, whether its champion is, and the stream's fractional debt. */
    pending: number;
    champ: boolean;
    stream: number;
    motes: FrayMote[];
    /** Experience picked up towards the next boon, and how much it takes. */
    surge: number;
    surgeNeed: number;
    /** Boons on offer (the fight holds until one is picked), null when none. */
    offer: string[] | null;
    /** Boons taken, in order (an id per stack). */
    boons: string[];
}

export interface FrayEvents extends SimEvents {
    /** A wave (or the boss) began to come in. */
    wave?(n: number, boss: boolean): void;
    /** The fray ended. */
    end?(outcome: "won" | "fallen", fray: FrayState): void;
    /** A mote was picked up: its experience, and whether it was a flask mote. */
    mote?(xp: number, flask: boolean): void;
    /** The hero rolled. */
    roll?(): void;
    /** A surge filled: these boons are on offer. */
    offer?(ids: string[]): void;
    /** A boon was taken. */
    boon?(id: string): void;
}

/** The Fray's own tallies in the save. */
export interface FrayTotals { runs: number; won: number; kills: number; /** Fastest win in seconds (0: none). */ best: number }
export const newFrayTotals = (): FrayTotals => ({ runs: 0, won: 0, kills: 0, best: 0 });

/** The road's place a fray fights: the current zone. */
export function frayZone(state: GameState): ZoneDef {
    return ZONES[state.activity.zone] ?? ZONES.a1_shore!;
}

const mapZones = new WeakMap<RunMap, ZoneDef>();
/** The zone a fray is fought in: the road's, or the one built from its map. */
export function frayZoneOf(state: GameState, fray: FrayState): ZoneDef {
    const map = fray.run.map;
    if (!map) return ZONES[fray.zone] ?? ZONES.a1_shore!;
    let z = mapZones.get(map);
    if (!z) { z = mapZone(map, atlasEffects(state)); mapZones.set(map, z); }
    return z;
}

/** Stacks of a boon taken this fray. */
export const boonCount = (fray: FrayState, id: string) => fray.boons.reduce((n, b) => n + (b === id ? 1 : 0), 0);

/** Walking speed of a monster: fliers and hounds are quick, armoured things slow; the hero outruns all but bosses' reach. */
export function monsterSpeed(def: string, champion: boolean): number {
    const d = MONSTERS[def]!;
    let v = 30 + 16 * d.speed;
    if (d.look.shape === "bird") v += 4;
    if (d.boss) v *= 0.85;
    if (champion) v *= 1.1;
    return v;
}

// ---- maps ----------------------------------------------------------------------

/** Runs `f` with any queued pinnacle set aside: the Fray takes maps, never the pinnacle (it stays queued for the device). */
function sansPinnacle<T>(state: GameState, f: () => T): T {
    const act = state.activity, pin = act.pinnacle;
    delete act.pinnacle;
    try { return f(); } finally { if (pin !== undefined) act.pinnacle = pin; }
}

/**
 * The map a map fray would take (the device's choice, startMapRun's), without taking it; null when
 * the stash has none. A map the device dampens to its cap comes back as a copy at the tier fought.
 */
export function frayMapPreview(state: GameState): MapItem | null {
    if (!state.maps.length) return null;
    const maps = [...state.maps];
    const act = { ...state.activity };
    delete act.pinnacle;
    const run = startMapRun({ ...state, maps, activity: act });
    const item = state.maps.find(m => !maps.includes(m));
    if (!item) return null;
    return item.tier === run.tier ? item : { ...item, tier: run.tier };
}

// ---- the fray ------------------------------------------------------------------

/**
 * A new fray on the road's current zone, or (`map`) on the next map from the device: the map
 * leaves the stash now, as on the road, and is gone if the fray is lost or left. With `map`
 * and no map in the stash, returns null (nothing is taken). A queued pinnacle stays queued.
 */
export function newFray(state: GameState, seed: number, opts?: { map?: false }): FrayState;
export function newFray(state: GameState, seed: number, opts: { map?: boolean }): FrayState | null;
export function newFray(state: GameState, seed: number, opts: { map?: boolean } = {}): FrayState | null {
    let map: RunMap | undefined;
    if (opts.map) {
        if (!state.maps.length) return null;
        map = sansPinnacle(state, () => startMapRun(state));
    }
    state.fray ??= newFrayTotals();
    const z = map ? mapZone(map, atlasEffects(state)) : frayZone(state);
    const rng = new Rng(hashSeed(state.seed, seed, 0x4652));
    const run: RunState = {
        rng: rng.state(), zone: z.id, pack: 0, packs: z.packs, boss: !!z.boss, phase: "fight", timer: 0, monsters: [],
        hero: { life: 0, es: 0, mana: 0, flask: FLASK_MAX, flaskLeft: 0, flaskRate: 0, cd: 0.3, esDelay: 0 },
        kills: 0, xp: 0, elapsed: 0,
    };
    if (map) run.map = map;
    const sheet = sheetFor(state, run);
    run.hero.life = sheet.life; run.hero.es = sheet.es; run.hero.mana = sheet.mana;
    const plan = Array.from({ length: z.packs }, () => rng.int(z.packSize[0], z.packSize[1]) * HORDE);
    return {
        rng: rng.state(), zone: z.id, mode: map ? "map" : "road", run, mons: [],
        hero: { x: ARENA_W / 2, y: ARENA_H / 2, face: 1, moving: false, roll: 0, rollCd: 0, rollDx: 1, rollDy: 0 },
        wave: 0, waves: z.packs, bossAhead: !!z.boss, bossUp: false, next: 0.8, outcome: "fight", t: 0, acc: 0,
        plan, total: plan.reduce((a, b) => a + b, 0) + (z.boss ? 1 : 0), released: 0, pending: 0, champ: false, stream: 0,
        motes: [], surge: 0, surgeNeed: SURGE_KILLS * monsterXp(z.level) * HORDE_BONUS.xp, offer: null, boons: [],
    };
}

/** Steps the fray up to wall-clock `now` (at most a quarter second at once: a stall is not a free pass). */
export function frayAdvance(state: GameState, fray: FrayState, now: number, last: number, input: FrayInput, ev: FrayEvents = {}): void {
    if (fray.outcome !== "fight") return;
    fray.acc += Math.min(250, Math.max(0, now - last));
    while (fray.acc >= FRAY_STEP_MS && fray.outcome === "fight") {
        fray.acc -= FRAY_STEP_MS;
        frayStep(state, fray, input, ev);
    }
}

// The hero's sheet in the fray: the run's (map hero-mods) with the boons on top, cached per fray.
const fraySheets = new WeakMap<FrayState, { base: Sheet; n: number; sheet: Sheet }>();
/** The stat sheet in effect in a fray: the run's (with a map's hero mods) and the boons taken. */
export function fraySheet(state: GameState, fray: FrayState): Sheet {
    const base = sheetFor(state, fray.run);
    if (!fray.boons.length) return base;
    const c = fraySheets.get(fray);
    if (c && c.base === base && c.n === fray.boons.length) return c.sheet;
    const n = (id: string) => boonCount(fray, id);
    const sheet: Sheet = {
        ...base,
        life: base.life * (1 + 0.12 * n("vigor")),
        moveSpeed: base.moveSpeed * (1 + 0.12 * n("haste")),
        skill: { ...base.skill, targets: base.skill.targets + 2 * n("swarm"), leech: base.skill.leech + 2 * n("leech") },
    };
    fraySheets.set(fray, { base, n: fray.boons.length, sheet });
    return sheet;
}

const dist = (ax: number, ay: number, bx: number, by: number) => Math.hypot(bx - ax, by - ay);

// Scratch for the separation grid (cells of 16 px; reused between steps, never part of the state).
const CELL = 16, GW = Math.ceil(ARENA_W / CELL), GH = Math.ceil(ARENA_H / CELL);
const cellHead = new Int32Array(GW * GH);
let cellNext = new Int32Array(256);
const cellX = (x: number) => Math.min(GW - 1, Math.max(0, Math.floor(x / CELL)));
const cellY = (y: number) => Math.min(GH - 1, Math.max(0, Math.floor(y / CELL)));

/** One sixtieth of a second. While boons are on offer, nothing moves until `input.pick` chooses one. */
export function frayStep(state: GameState, fray: FrayState, input: FrayInput, ev: FrayEvents = {}): void {
    if (fray.outcome !== "fight") return;
    if (fray.offer) {
        const k = input.pick ?? 0;
        if (k < 1 || k > fray.offer.length) return;
        takeBoon(state, fray, fray.offer[k - 1]!, ev);
    }
    const run = fray.run, h = run.hero, hero = fray.hero;
    const z = frayZoneOf(state, fray);
    const rng = new Rng(fray.rng);
    let sheet = fraySheet(state, fray);
    const eff = effectsOf(state, run);
    fray.t += DT; run.elapsed += DT;

    // Recovery, as on the road.
    h.life = Math.min(sheet.life, h.life + sheet.lifeRegen * DT);
    h.mana = Math.min(sheet.mana, h.mana + sheet.manaRegen * DT);
    if (h.esDelay > 0) h.esDelay -= DT;
    else h.es = Math.min(sheet.es, h.es + sheet.es * 0.2 * DT);
    h.leech = Math.min(sheet.life * 0.1, (h.leech ?? sheet.life * 0.1) + sheet.life * 0.1 * DT);
    if (h.flaskLeft > 0) { h.life = Math.min(sheet.life, h.life + h.flaskRate * DT); h.flaskLeft -= DT; }

    // The hero walks, or rolls.
    let dx = input.dx, dy = input.dy;
    const len = Math.hypot(dx, dy);
    const nimble = boonCount(fray, "nimble");
    hero.rollCd = Math.max(0, hero.rollCd - DT);
    if (input.roll && hero.roll <= 0 && hero.rollCd <= 0) {
        if (len > 0.01) { hero.rollDx = dx / len; hero.rollDy = dy / len; } else { hero.rollDx = hero.face; hero.rollDy = 0; }
        hero.roll = ROLL_S;
        hero.rollCd = ROLL_S + ROLL_CD * Math.pow(0.7, nimble);
        ev.roll?.();
    }
    const rolling = hero.roll > 0;
    if (rolling) {
        const v = HERO_SPEED * ROLL_SPEED * (1 + 0.25 * nimble) * sheet.moveSpeed * DT;
        hero.x = Math.max(10, Math.min(ARENA_W - 10, hero.x + hero.rollDx * v));
        hero.y = Math.max(10, Math.min(ARENA_H - 8, hero.y + hero.rollDy * v));
        if (Math.abs(hero.rollDx) > 0.2) hero.face = hero.rollDx < 0 ? -1 : 1;
        hero.moving = true;
    } else {
        hero.moving = len > 0.01;
        if (hero.moving) {
            dx /= Math.max(1, len); dy /= Math.max(1, len);
            const v = HERO_SPEED * sheet.moveSpeed * DT;
            hero.x = Math.max(10, Math.min(ARENA_W - 10, hero.x + dx * v));
            hero.y = Math.max(10, Math.min(ARENA_H - 8, hero.y + dy * v));
            if (Math.abs(dx) > 0.2) hero.face = dx < 0 ? -1 : 1;
        }
    }

    // Waves: a stream from the edges, the next once this one is in and thinned (or on the timer), the boss last.
    let alive = 0, dead = 0, bossAlive = false;
    for (const m of run.monsters) {
        if (m.life > 0) { alive++; if (MONSTERS[m.def]!.boss) bossAlive = true; } else dead++;
    }
    if (dead > COMPACT_DEAD) compact(fray);
    const allIn = fray.wave >= fray.waves && fray.pending <= 0;
    if (allIn && (fray.bossUp ? !bossAlive : !fray.bossAhead && alive === 0)) {
        won(state, fray, sheet, rng, ev);
        fray.rng = rng.state();
        return;
    }
    if (fray.pending > 0) {
        if (alive < ALIVE_CAP) {
            fray.stream += fray.plan[fray.wave - 1]! / WAVE_RELEASE_S * DT;
            const lantern = lanternRate(state, run);
            while (fray.stream >= 1 && fray.pending > 0 && alive < ALIVE_CAP) {
                fray.stream -= 1;
                release(fray, z, rng, eff, lantern);
                alive++;
            }
        }
        if (fray.pending <= 0) { fray.next = WAVE_EVERY; fray.stream = 0; }
    } else if (fray.wave < fray.waves) {
        fray.next -= DT;
        if (fray.wave === 0 ? fray.next <= 0 : alive < WAVE_NEXT_ALIVE || fray.next <= 0) startWave(fray, z, rng, ev);
    } else if (fray.bossAhead && alive < BOSS_ALIVE) {
        add(fray, makeBoss(z, run, rng, eff), false, rng);
        fray.released++;
        fray.bossUp = true;
        fray.bossAhead = false;
        ev.wave?.(fray.wave, true);
    }

    // The skill fires at what is in reach.
    h.cd -= DT;
    if (h.cd <= 0) {
        const sk = sheet.skill;
        const shape = sk.shape === "projectile" ? "projectile" : sk.shape === "area" ? "area" : "single";
        const reach = FRAY_REACH[shape] * (1 + 0.2 * boonCount(fray, "reach"));
        const cap = shape === "area" ? Math.max(8, sk.targets * 3) : shape === "projectile" ? Math.max(4, sk.targets + 2) : Math.max(2, sk.targets);
        const near: { i: number; d: number }[] = [];
        const slack = reach + 10;
        for (let i = 0; i < run.monsters.length; i++) {
            const m = run.monsters[i]!;
            if (m.life <= 0) continue;
            const fm = fray.mons[i]!;
            const ox = fm.x - hero.x, oy = fm.y - hero.y;
            if (ox > slack || ox < -slack || oy > slack || oy < -slack) continue;
            const d = Math.hypot(ox, oy) - (MONSTERS[m.def]!.boss ? 10 : 0);
            if (d <= reach) near.push({ i, d });
        }
        if (!near.length) h.cd = 0;
        else if (h.mana < sk.manaCost) h.cd = 0.2;
        else {
            near.sort((a, b) => a.d - b.d || a.i - b.i);
            const targets = near.slice(0, cap).map(x => x.i);
            h.mana -= sk.manaCost;
            h.cd += 1 / Math.max(0.1, sk.speed);
            const first = fray.mons[targets[0]!]!;
            if (Math.abs(first.x - hero.x) > 4) hero.face = first.x < hero.x ? -1 : 1;
            ev.heroUse?.(sk.fx, targets);
            // As on the road: the whole swing is the skill as cast, even if a kill changes the sheet.
            const cast = sheet;
            const more = Math.pow(1.15, boonCount(fray, "fury")) * (shape === "single" ? 1.5 : 1);
            let dealt = 0;
            for (const i of targets) {
                const m = run.monsters[i]!, fm = fray.mons[i]!;
                const roll = heroHitRoll(cast, m, rng, eff);
                if (!roll) { ev.heroMiss?.(i); continue; }
                const dmg = roll.dmg * more;
                m.life -= dmg;
                dealt += dmg;
                ev.heroHit?.(i, dmg, roll.crit);
                if (m.life <= 0) {
                    // The experience falls as a mote where the monster stood; champions and bosses leave a flask mote too.
                    const sink = (xp: number) => { if (xp > 0) dropMote(fray, { x: fm.x, y: fm.y, xp, t: fray.t }); };
                    onKill(state, run, m, sheet, rng, ev, { ...(fm.horde ? HORDE_BONUS : FRAY_BONUS), xpSink: sink });
                    if (m.champion || MONSTERS[m.def]!.boss) dropMote(fray, { x: fm.x + 4, y: fm.y + 2, xp: 0, flask: true, t: fray.t });
                    sheet = fraySheet(state, fray);
                    state.fray!.kills++;
                }
            }
            applyLeech(run, sheet, dealt, cast.skill.leech);
        }
    }

    // Monsters close in (casters keep their distance), spread out, and swing when in reach.
    const n = run.monsters.length;
    if (cellNext.length < n) cellNext = new Int32Array(Math.max(n, cellNext.length * 2));
    cellHead.fill(-1);
    for (let i = 0; i < n; i++) {
        if (run.monsters[i]!.life <= 0) continue;
        const fm = fray.mons[i]!, c = cellY(fm.y) * GW + cellX(fm.x);
        cellNext[i] = cellHead[c]!;
        cellHead[c] = i;
    }
    for (let i = 0; i < n; i++) {
        const m = run.monsters[i]!;
        if (m.life <= 0) continue;
        const fm = fray.mons[i]!;
        const d = MONSTERS[m.def]!;
        const dd = dist(fm.x, fm.y, hero.x, hero.y);
        let tx = 0, ty = 0;
        if (dd > 0.5) {
            const ux = (hero.x - fm.x) / dd, uy = (hero.y - fm.y) / dd;
            // Casters stop at range and back off slowly when crowded: a walking hero catches them, a standing one is shot.
            const want = fm.caster ? (dd > CAST_RANGE ? 1 : dd < CAST_KEEP ? -0.35 : 0) : dd > fm.reach * 0.8 ? 1 : 0;
            tx = ux * want; ty = uy * want;
        }
        // Separation: a crowd spreads instead of stacking on one pixel (neighbours from the 3x3 cells around).
        const gx = cellX(fm.x), gy = cellY(fm.y);
        for (let cy = Math.max(0, gy - 1); cy <= Math.min(GH - 1, gy + 1); cy++) {
            for (let cx = Math.max(0, gx - 1); cx <= Math.min(GW - 1, gx + 1); cx++) {
                for (let j = cellHead[cy * GW + cx]!; j >= 0; j = cellNext[j]!) {
                    if (j === i) continue;
                    const o = fray.mons[j]!;
                    const ox = fm.x - o.x, oy = fm.y - o.y;
                    if (ox >= SEP || ox <= -SEP || oy >= SEP || oy <= -SEP) continue;
                    const od = Math.hypot(ox, oy);
                    if (od < SEP && od > 0.01) { tx += ox / od * (SEP - od) / SEP; ty += oy / od * (SEP - od) / SEP; }
                }
            }
        }
        const tl = Math.hypot(tx, ty);
        if (tl > 1) { tx /= tl; ty /= tl; }
        fm.vx = tx * fm.speed; fm.vy = ty * fm.speed;
        fm.x = Math.max(4, Math.min(ARENA_W - 4, fm.x + fm.vx * DT));
        fm.y = Math.max(4, Math.min(ARENA_H - 2, fm.y + fm.vy * DT));
        if (h.life <= 0) continue;
        m.atk -= DT;
        if (m.atk > 0) continue;
        m.atk += monsterSwing(d, rng, eff);
        const inReach = dist(fm.x, fm.y, hero.x, hero.y) <= (fm.caster ? CAST_RANGE + 12 : fm.reach * 1.25);
        if (!inReach) continue; // a swing at air: dodged by walking away
        if (rolling) { ev.monsterHit?.(i, 0, "evade"); continue; } // rolled through it
        const r = monsterHitRoll(run, m, sheet, rng, eff, fm.horde ? HORDE_DAMAGE : bossDamageMult(run, m, eff));
        ev.monsterHit?.(i, r.dmg, r.avoided);
    }
    if (rolling) hero.roll = Math.max(0, hero.roll - DT);

    if (h.life <= 0) {
        h.life = 0;
        fray.outcome = "fallen";
        run.phase = "dead";
        state.fray!.runs++;
        // In a map the map is gone with the fall (it left the stash at the start); no other penalty.
        pushLog(state, "death", "log.frayFell", { place: ref.place(run.zone, run.map), kills: run.kills });
        ev.death?.(fray.zone);
        checkFeats(state, { onFeat: id => ev.feat?.(id) });
        ev.end?.("fallen", fray);
        fray.rng = rng.state();
        return;
    }
    // The flask: the player's key, or by itself when it is nearly too late.
    if (h.flaskLeft <= 0 && h.flask >= FLASK_COST && h.life < sheet.life * (input.flask ? KEY_FLASK : AUTO_FLASK)) {
        h.flask -= FLASK_COST; h.flaskLeft = FLASK_S; h.flaskRate = flaskAmount(state.hero.level, sheet) / FLASK_S;
        ev.flask?.();
    }

    // Motes: drift to a hero within the magnet's reach, picked up underfoot, fade with age.
    const magnet = MOTE_MAGNET * (1 + 0.6 * boonCount(fray, "magnet"));
    let w = 0, levelled = false;
    for (const mo of fray.motes) {
        if (fray.t - mo.t > MOTE_LIFE_S) continue;
        let ox = hero.x - mo.x, oy = hero.y - mo.y, d = Math.hypot(ox, oy);
        if (d > MOTE_PICK && d <= magnet) {
            const s = Math.min(d, MOTE_DRIFT * DT);
            mo.x += ox / d * s; mo.y += oy / d * s;
            ox = hero.x - mo.x; oy = hero.y - mo.y; d = Math.hypot(ox, oy);
        }
        if (d <= MOTE_PICK) {
            if (mo.flask) h.flask = Math.min(FLASK_MAX, h.flask + MOTE_FLASK);
            if (mo.xp > 0) {
                run.xp += mo.xp;
                fray.surge += mo.xp;
                if (gainXp(state, mo.xp, ev)) levelled = true;
            }
            ev.mote?.(mo.xp, !!mo.flask);
            continue;
        }
        fray.motes[w++] = mo;
    }
    fray.motes.length = w;
    if (levelled) sheet = fraySheet(state, fray);

    // A full surge: three boons on offer, and the fight holds until one is picked.
    if (!fray.offer && fray.surge >= fray.surgeNeed) {
        const pool = BOONS.filter(id => boonCount(fray, id) < BOON_MAX);
        if (pool.length) {
            const offer: string[] = [];
            while (offer.length < 3 && pool.length) offer.push(pool.splice(rng.int(0, pool.length - 1), 1)[0]!);
            fray.offer = offer;
            ev.offer?.(offer);
        } else fray.surge = fray.surgeNeed;
    }
    fray.rng = rng.state();
}

/** Takes a boon from the offer: its stack, the next surge further off, vigour's heal. */
function takeBoon(state: GameState, fray: FrayState, id: string, ev: FrayEvents): void {
    fray.boons.push(id);
    fray.offer = null;
    fray.surge = Math.max(0, fray.surge - fray.surgeNeed);
    fray.surgeNeed *= SURGE_GROWTH;
    if (id === "vigor") {
        const h = fray.run.hero;
        h.life = Math.min(fraySheet(state, fray).life, h.life + sheetFor(state, fray.run).life * 0.12);
    }
    ev.boon?.(id);
}

/** Drops a mote; past the cap the oldest experience mote merges into its nearest neighbour. */
export function dropMote(fray: FrayState, mote: FrayMote): void {
    const ms = fray.motes;
    ms.push(mote);
    while (ms.length > MOTE_CAP) {
        const i = ms.findIndex(m => !m.flask);
        if (i < 0) { ms.shift(); continue; }
        const a = ms[i]!;
        let j = -1, bd = Infinity;
        for (let k = 0; k < ms.length; k++) {
            const b = ms[k]!;
            if (k === i || b.flask) continue;
            const d = (b.x - a.x) * (b.x - a.x) + (b.y - a.y) * (b.y - a.y);
            if (d < bd) { bd = d; j = k; }
        }
        if (j >= 0) ms[j]!.xp += a.xp;
        ms.splice(i, 1);
    }
}

/** The dead leave the lists (only at a step's start or a wave's, so indices hold within a step's events). */
function compact(fray: FrayState): void {
    const run = fray.run;
    let w = 0;
    for (let i = 0; i < run.monsters.length; i++) {
        if (run.monsters[i]!.life <= 0) continue;
        run.monsters[w] = run.monsters[i]!;
        fray.mons[w] = fray.mons[i]!;
        w++;
    }
    run.monsters.length = w;
    fray.mons.length = w;
}

function startWave(fray: FrayState, z: ZoneDef, rng: Rng, ev: FrayEvents): void {
    compact(fray);
    fray.wave++;
    fray.pending = fray.plan[fray.wave - 1]!;
    fray.champ = rng.chance(z.champion);
    fray.stream = 1; // the first comes at once
    fray.next = WAVE_EVERY;
    ev.wave?.(fray.wave, false);
}

/** Puts a monster in at an edge, clear of the hero. */
function add(fray: FrayState, m: MonsterState, horde: boolean, rng: Rng): void {
    const d = MONSTERS[m.def]!;
    const fm: FrayMon = { x: 0, y: 0, vx: 0, vy: 0, reach: 14 + 8 * d.look.size + (d.boss ? 8 : 0), speed: monsterSpeed(m.def, m.champion), caster: !!d.spell, horde };
    for (let k = 0; k < 8; k++) {
        const side = rng.int(0, 3);
        fm.x = side === 0 ? 6 : side === 1 ? ARENA_W - 6 : rng.range(10, ARENA_W - 10);
        fm.y = side === 2 ? 6 : side === 3 ? ARENA_H - 6 : rng.range(10, ARENA_H - 10);
        if (dist(fm.x, fm.y, fray.hero.x, fray.hero.y) >= SPAWN_CLEAR) break;
    }
    fray.run.monsters.push(m);
    fray.mons.push(fm);
}

/** One monster of the current wave streams in: the wave's champion first, a lantern-bearer now and then, the rest horde. */
function release(fray: FrayState, z: ZoneDef, rng: Rng, eff: ReturnType<typeof effectsOf>, lantern: number): void {
    const champion = fray.champ;
    fray.champ = false;
    let def = rng.pick(z.monsters);
    // A horde is mostly fodder that walks in: a caster picked for it is picked again once (a third as many
    // casters), or forty of them standing off at range shoot a hero down before it can reach one.
    if (!champion && MONSTERS[def]!.spell) def = rng.pick(z.monsters);
    const m = makeMonster(def, z.level, champion, rng, eff);
    let horde = !champion;
    // Lanterns about as many per fray as on the road: a lantern-bearer is a whole monster, not a horde one.
    if (horde && lantern > 0 && rng.chance(lantern / HORDE)) { touch(m); horde = false; }
    if (horde) m.life = m.maxLife = Math.max(1, Math.round(m.maxLife * HORDE_LIFE));
    add(fray, m, horde, rng);
    fray.pending--;
    fray.released++;
}

/** The spoils of a won fray: the motes still on the floor, a good item, some currency and a lump of experience; a map is completed. */
function won(state: GameState, fray: FrayState, sheet: Sheet, rng: Rng, ev: FrayEvents): void {
    const run = fray.run;
    const z = frayZoneOf(state, fray);
    fray.outcome = "won";
    run.phase = "done";
    const ft = state.fray!;
    ft.runs++; ft.won++;
    const secs = Math.round(fray.t);
    if (!ft.best || secs < ft.best) ft.best = secs;
    // What lies on the floor comes to the winner (the boss's own mote among it).
    const floor = fray.motes.reduce((a, m) => a + m.xp, 0);
    fray.motes = [];
    if (floor > 0) { run.xp += floor; fray.surge += floor; gainXp(state, floor, ev); ev.mote?.(floor, false); }
    const item = rollItem(rng, state.nextUid++, z.level, { rarityBonus: 200 + sheet.rarity + FRAY_BONUS.rarity });
    if (item.rarity === "rare") rollSockets(rng, item);
    const r = receiveItem(state, item);
    ev.loot?.(item, r.kept, r.equipped);
    for (let k = 0; k < 2; k++) {
        if (!rng.chance(0.5)) continue;
        const cur = rng.weighted(CURRENCY_ORDER, id => CURRENCIES[id]!.drop)!;
        state.currency[cur] = (state.currency[cur] ?? 0) + 1;
        ev.currency?.(cur);
    }
    const xp = Math.round(monsterXp(z.level) * 6 * xpPenalty(state.hero.level, z.level) * sheet.xpGain);
    run.xp += xp;
    gainXp(state, xp, ev);
    if (run.map) {
        completeMap(state, run.map);
        if (!run.map.pinnacle) contractEvent(state, "maps", run.map.tier);
    }
    pushLog(state, "info", "log.frayWon", { place: ref.place(run.zone, run.map), kills: run.kills, secs });
    checkFeats(state, { onFeat: id => ev.feat?.(id) });
    ev.end?.("won", fray);
}
