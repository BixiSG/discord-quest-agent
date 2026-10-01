// The Fray (GDD): the player takes the hero's reins for one fight on the current
// road. A flat arena seen from three-quarters above; the hero walks where the
// keys say, the equipped skill fires on its own at whatever is in reach, monsters
// come in waves from the edges and the zone's boss last. The maths is the idle
// engine's (the same hit rolls, the same loot path), so a build that works on the
// road works here, and kiting is the only thing the player adds.
//
// Pure like the rest of the core: 60 steps a second, time and input come in as
// arguments, randomness from the fray's own Rng. Nothing here touches the idle
// run; the UI holds the idle clock still while a fray is on.

import { Rng, hashSeed, type RngState } from "./rng";
import { MONSTERS, ZONES, monsterXp, xpPenalty, type ZoneDef } from "./data";
import type { Sheet } from "./character";
import type { GameState, MonsterState, RunState } from "./state";
import { sheetOf, receiveItem, pushLog } from "./game";
import { rollItem } from "./items";
import { rollSockets } from "./sockets";
import { CURRENCIES, CURRENCY_ORDER } from "./data";
import { applyLeech, effectsOf, flaskAmount, FLASK_COST, FLASK_MAX, FLASK_S, gainXp, heroHitRoll, makeMonster, monsterHitRoll, monsterSwing, onKill, type SimEvents } from "./sim/engine";
import { lanternRate, touch } from "./season";
import { ref } from "../i18n/refs";

export const FRAY_STEP_MS = 1000 / 60;
const DT = FRAY_STEP_MS / 1000;
/** The arena in logical pixels (the renderer scales it up whole). */
export const ARENA_W = 440, ARENA_H = 280;
/** Hero walking speed in pixels per second, times the sheet's movement speed. */
export const HERO_SPEED = 66;
/** Seconds between waves when the last one is still standing (pressure). */
export const WAVE_EVERY = 12;
/** What a kill in the Fray pays over the road: experience and loot rarity. */
export const FRAY_BONUS = { xp: 1.5, rarity: 60 };
/** Spell casters stay this far from the hero and hit from this far. */
const CAST_RANGE = 96, CAST_KEEP = 72;
/** How far the hero's skill reaches: melee, area (around the hero) and projectiles. */
const REACH = { single: 28, area: 38, projectile: 128 } as const;
/** The flask drinks itself below this share of life (the player is meant to press it first)... */
const AUTO_FLASK = 0.2;
/** ...and the key only works below this share, so a held key doesn't spend the charges on scratches. */
const KEY_FLASK = 0.7;

export interface FrayInput { dx: number; dy: number; flask: boolean }

/** Where a monster is and how it moves; parallel to run.monsters. */
export interface FrayMon { x: number; y: number; vx: number; vy: number; /** Its reach in pixels. */ reach: number; /** Pixels per second. */ speed: number; /** Hits from range. */ caster: boolean }

export interface FrayState {
    rng: RngState;
    zone: string;
    /** Hero vitals, monsters, kills and experience in the idle engine's shape (onKill reads it). */
    run: RunState;
    mons: FrayMon[];
    hero: { x: number; y: number; /** 1 right, -1 left. */ face: 1 | -1; moving: boolean };
    wave: number;
    waves: number;
    /** The zone's boss is still to come. */
    bossAhead: boolean;
    bossUp: boolean;
    /** Seconds until the next wave comes regardless. */
    next: number;
    outcome: "fight" | "won" | "fallen";
    /** Seconds elapsed. */
    t: number;
    /** Milliseconds not yet stepped. */
    acc: number;
}

export interface FrayEvents extends SimEvents {
    /** A wave (or the boss) came in. */
    wave?(n: number, boss: boolean): void;
    /** The fray ended. */
    end?(outcome: "won" | "fallen", fray: FrayState): void;
}

/** The Fray's own tallies in the save. */
export interface FrayTotals { runs: number; won: number; kills: number; /** Fastest win in seconds (0: none). */ best: number }
export const newFrayTotals = (): FrayTotals => ({ runs: 0, won: 0, kills: 0, best: 0 });

/** The place a fray fights: the road's current zone (maps are left to the idle run). */
export function frayZone(state: GameState): ZoneDef {
    return ZONES[state.activity.zone] ?? ZONES.a1_shore!;
}

/** Walking speed of a monster: fliers and hounds are quick, armoured things slow; the hero outruns all but bosses' reach. */
export function monsterSpeed(def: string, champion: boolean): number {
    const d = MONSTERS[def]!;
    let v = 30 + 16 * d.speed;
    if (d.look.shape === "bird") v += 4;
    if (d.boss) v *= 0.85;
    if (champion) v *= 1.1;
    return v;
}

export function newFray(state: GameState, seed: number): FrayState {
    const z = frayZone(state);
    const sheet = sheetOf(state);
    const rng = new Rng(hashSeed(state.seed, seed, 0x4652));
    const run: RunState = {
        rng: rng.state(), zone: z.id, pack: 0, packs: z.packs, boss: !!z.boss, phase: "fight", timer: 0, monsters: [],
        hero: { life: sheet.life, es: sheet.es, mana: sheet.mana, flask: FLASK_MAX, flaskLeft: 0, flaskRate: 0, cd: 0.3, esDelay: 0 },
        kills: 0, xp: 0, elapsed: 0,
    };
    return {
        rng: rng.state(), zone: z.id, run, mons: [], hero: { x: ARENA_W / 2, y: ARENA_H / 2, face: 1, moving: false },
        wave: 0, waves: z.packs, bossAhead: !!z.boss, bossUp: false, next: 0.8, outcome: "fight", t: 0, acc: 0,
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

const dist = (ax: number, ay: number, bx: number, by: number) => Math.hypot(bx - ax, by - ay);

/** One sixtieth of a second. */
export function frayStep(state: GameState, fray: FrayState, input: FrayInput, ev: FrayEvents = {}): void {
    if (fray.outcome !== "fight") return;
    const run = fray.run, h = run.hero, hero = fray.hero;
    const z = ZONES[fray.zone]!;
    const rng = new Rng(fray.rng);
    let sheet = sheetOf(state);
    const eff = effectsOf(state, run);
    fray.t += DT; run.elapsed += DT;

    // Recovery, as on the road.
    h.life = Math.min(sheet.life, h.life + sheet.lifeRegen * DT);
    h.mana = Math.min(sheet.mana, h.mana + sheet.manaRegen * DT);
    if (h.esDelay > 0) h.esDelay -= DT;
    else h.es = Math.min(sheet.es, h.es + sheet.es * 0.2 * DT);
    h.leech = Math.min(sheet.life * 0.1, (h.leech ?? sheet.life * 0.1) + sheet.life * 0.1 * DT);
    if (h.flaskLeft > 0) { h.life = Math.min(sheet.life, h.life + h.flaskRate * DT); h.flaskLeft -= DT; }

    // The hero walks.
    let dx = input.dx, dy = input.dy;
    const len = Math.hypot(dx, dy);
    hero.moving = len > 0.01;
    if (hero.moving) {
        dx /= Math.max(1, len); dy /= Math.max(1, len);
        const v = HERO_SPEED * sheet.moveSpeed * DT;
        hero.x = Math.max(10, Math.min(ARENA_W - 10, hero.x + dx * v));
        hero.y = Math.max(10, Math.min(ARENA_H - 8, hero.y + dy * v));
        if (Math.abs(dx) > 0.2) hero.face = dx < 0 ? -1 : 1;
    }

    // Waves: the next comes when the last is down, or on the timer; the boss once every wave is.
    fray.next -= DT;
    const alive = run.monsters.filter(m => m.life > 0).length;
    if (fray.wave < fray.waves && (alive === 0 || fray.next <= 0)) spawnWave(state, fray, z, rng, ev, false);
    else if (fray.wave >= fray.waves && alive === 0 && !fray.bossUp) {
        if (fray.bossAhead) spawnWave(state, fray, z, rng, ev, true);
        else { won(state, fray, sheet, rng, ev); fray.rng = rng.state(); return; }
    } else if (fray.bossUp && alive === 0) { won(state, fray, sheet, rng, ev); fray.rng = rng.state(); return; }

    // The skill fires at what is in reach.
    h.cd -= DT;
    if (h.cd <= 0) {
        const sk = sheet.skill;
        const reach = REACH[sk.shape === "projectile" ? "projectile" : sk.shape === "area" ? "area" : "single"];
        const near: { i: number; d: number }[] = [];
        run.monsters.forEach((m, i) => {
            if (m.life <= 0) return;
            const fm = fray.mons[i]!;
            const d = dist(hero.x, hero.y, fm.x, fm.y) - (MONSTERS[m.def]!.boss ? 10 : 0);
            if (d <= reach) near.push({ i, d });
        });
        if (!near.length) h.cd = 0;
        else if (h.mana < sk.manaCost) h.cd = 0.2;
        else {
            near.sort((a, b) => a.d - b.d);
            const targets = near.slice(0, Math.max(1, sk.targets)).map(x => x.i);
            h.mana -= sk.manaCost;
            h.cd += 1 / Math.max(0.1, sk.speed);
            const first = fray.mons[targets[0]!]!;
            if (Math.abs(first.x - hero.x) > 4) hero.face = first.x < hero.x ? -1 : 1;
            ev.heroUse?.(sk.fx, targets);
            // As on the road: the whole swing is the skill as cast, even if a kill changes the sheet.
            const cast = sheet;
            let dealt = 0;
            for (const i of targets) {
                const m = run.monsters[i]!;
                const roll = heroHitRoll(cast, m, rng, eff);
                if (!roll) { ev.heroMiss?.(i); continue; }
                m.life -= roll.dmg;
                dealt += roll.dmg;
                ev.heroHit?.(i, roll.dmg, roll.crit);
                if (m.life <= 0) {
                    // onKill re-derives through the idle run's sheet; the Fray wants the plain one.
                    onKill(state, run, m, sheet, rng, ev, FRAY_BONUS);
                    sheet = sheetOf(state);
                    state.fray!.kills++;
                }
            }
            applyLeech(run, sheet, dealt, sk.leech);
        }
    }

    // Monsters close in (casters keep their distance), spread out, and swing when in reach.
    run.monsters.forEach((m, i) => {
        if (m.life <= 0) return;
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
        // Separation: a crowd spreads instead of stacking on one pixel.
        for (let j = 0; j < run.monsters.length; j++) {
            if (j === i || run.monsters[j]!.life <= 0) continue;
            const o = fray.mons[j]!;
            const ox = fm.x - o.x, oy = fm.y - o.y, od = Math.hypot(ox, oy);
            if (od < 14 && od > 0.01) { tx += ox / od * (14 - od) / 14; ty += oy / od * (14 - od) / 14; }
        }
        const tl = Math.hypot(tx, ty);
        if (tl > 1) { tx /= tl; ty /= tl; }
        fm.vx = tx * fm.speed; fm.vy = ty * fm.speed;
        fm.x = Math.max(4, Math.min(ARENA_W - 4, fm.x + fm.vx * DT));
        fm.y = Math.max(4, Math.min(ARENA_H - 2, fm.y + fm.vy * DT));
        if (h.life <= 0) return;
        m.atk -= DT;
        if (m.atk > 0) return;
        m.atk += monsterSwing(d, rng, eff);
        const inReach = dist(fm.x, fm.y, hero.x, hero.y) <= (fm.caster ? CAST_RANGE + 12 : fm.reach * 1.25);
        if (!inReach) return; // a swing at air: dodged by walking away
        const r = monsterHitRoll(run, m, sheet, rng, eff, 1);
        ev.monsterHit?.(i, r.dmg, r.avoided);
    });

    if (h.life <= 0) {
        h.life = 0;
        fray.outcome = "fallen";
        run.phase = "dead";
        state.fray!.runs++;
        pushLog(state, "death", "log.frayFell", { place: ref.zone(fray.zone), kills: run.kills });
        ev.death?.(fray.zone);
        ev.end?.("fallen", fray);
        fray.rng = rng.state();
        return;
    }
    // The flask: the player's key, or by itself when it is nearly too late.
    if (h.flaskLeft <= 0 && h.flask >= FLASK_COST && h.life < sheet.life * (input.flask ? KEY_FLASK : AUTO_FLASK)) {
        h.flask -= FLASK_COST; h.flaskLeft = FLASK_S; h.flaskRate = flaskAmount(state.hero.level, sheet) / FLASK_S;
        ev.flask?.();
    }
    fray.rng = rng.state();
}

function spawnWave(state: GameState, fray: FrayState, z: ZoneDef, rng: Rng, ev: FrayEvents, boss: boolean): void {
    const run = fray.run, eff = effectsOf(state, run);
    // Dead monsters leave the lists when a new wave comes, so the arrays stay short.
    const keep = run.monsters.map((m, i) => [m, fray.mons[i]!] as const).filter(([m]) => m.life > 0);
    run.monsters = keep.map(([m]) => m);
    fray.mons = keep.map(([, fm]) => fm);
    const lantern = lanternRate(state, run);
    const place = (fm: FrayMon) => {
        for (let k = 0; k < 6; k++) {
            const side = rng.int(0, 3);
            const x = side === 0 ? 6 : side === 1 ? ARENA_W - 6 : rng.range(10, ARENA_W - 10);
            const y = side === 2 ? 6 : side === 3 ? ARENA_H - 6 : rng.range(10, ARENA_H - 10);
            fm.x = x; fm.y = y;
            if (dist(x, y, fray.hero.x, fray.hero.y) >= 90) break;
        }
    };
    const add = (m: MonsterState) => {
        const d = MONSTERS[m.def]!;
        const fm: FrayMon = { x: 0, y: 0, vx: 0, vy: 0, reach: 14 + 8 * d.look.size + (d.boss ? 8 : 0), speed: monsterSpeed(m.def, m.champion), caster: !!d.spell };
        place(fm);
        run.monsters.push(m);
        fray.mons.push(fm);
    };
    if (boss) {
        add(makeMonster(z.boss!, z.level + 1, false, rng, eff));
        fray.bossUp = true;
        fray.bossAhead = false;
        ev.wave?.(fray.wave, true);
        return;
    }
    fray.wave++;
    fray.next = WAVE_EVERY;
    const n = rng.int(z.packSize[0], z.packSize[1]);
    const champ = rng.chance(z.champion);
    for (let i = 0; i < n; i++) {
        const m = makeMonster(rng.pick(z.monsters), z.level, champ && i === 0, rng, eff);
        if (lantern > 0 && rng.chance(lantern)) touch(m);
        add(m);
    }
    ev.wave?.(fray.wave, false);
}

/** The spoils of a won fray: a good item, some currency and a lump of experience, on top of every kill's drops. */
function won(state: GameState, fray: FrayState, sheet: Sheet, rng: Rng, ev: FrayEvents): void {
    const z = ZONES[fray.zone]!;
    fray.outcome = "won";
    fray.run.phase = "done";
    const ft = state.fray!;
    ft.runs++; ft.won++;
    const secs = Math.round(fray.t);
    if (!ft.best || secs < ft.best) ft.best = secs;
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
    fray.run.xp += xp;
    gainXp(state, xp, ev);
    pushLog(state, "info", "log.frayWon", { place: ref.zone(fray.zone), kills: fray.run.kills, secs });
    ev.end?.("won", fray);
}
