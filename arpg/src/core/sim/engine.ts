// The combat simulation (COMBAT.md section 11). Fixed 100 ms steps; online
// play and offline catch-up both go through advance().

import { Rng, hashSeed } from "../rng";
import { MONSTERS, ZONES, ZONE_ORDER, monsterDamage, monsterDefence, monsterLife, monsterXp, xpPenalty, xpToNext, MAX_LEVEL, type ZoneDef } from "../data";
import { armourReduction, hitChance, type Sheet } from "../character";
import { rollItem } from "../items";
import type { GameState, MonsterState, RunState } from "../state";
import { DAMAGE_TYPES, type Item } from "../types";
import { sheetOf, receiveItem, pushLog } from "../game";

export const STEP_MS = 100;
const DT = STEP_MS / 1000;
export const MAX_OFFLINE_MS = 24 * 3600e3;
const TRAVEL_S = 1.5;
const RESPAWN_S = 6;
const FLASK_MAX = 30, FLASK_COST = 10, FLASK_S = 2;

/** Hooks for the UI and the offline report. All optional. */
export interface SimEvents {
    heroHit?(target: number, dmg: number, crit: boolean): void;
    heroMiss?(target: number): void;
    heroUse?(fx: string, targets: number[]): void;
    monsterHit?(from: number, dmg: number, avoided: "evade" | "block" | null): void;
    kill?(m: MonsterState, xp: number): void;
    loot?(item: Item, kept: boolean, equipped: boolean): void;
    level?(level: number): void;
    death?(zone: string): void;
    runDone?(zone: string): void;
    zone?(from: string, to: string, why: "push" | "retreat" | "unlock"): void;
    flask?(): void;
}

const flaskAmount = (level: number, sheet: Sheet) => (40 + 14 * level) * sheet.flaskHeal;

export function newRun(state: GameState, sheet: Sheet): RunState {
    const z = zoneOf(state.activity.zone);
    const rng = new Rng(hashSeed(state.seed, state.activity.runIndex));
    const run: RunState = {
        rng: rng.state(), zone: z.id, pack: 0, packs: z.packs, boss: !!z.boss, phase: "fight", timer: 0, monsters: [],
        hero: { life: sheet.life, es: sheet.es, mana: sheet.mana, flask: FLASK_MAX, flaskLeft: 0, flaskRate: 0, cd: 0.3, esDelay: 0 },
        kills: 0, xp: 0, elapsed: 0,
    };
    const prev = state.activity.run;
    if (prev && prev.zone === z.id) run.hero.flask = prev.hero.flask;
    spawnPack(run, z, rng);
    run.rng = rng.state();
    return run;
}

export function zoneOf(id: string): ZoneDef {
    const z = ZONES[id];
    if (!z) throw new Error("unknown zone " + id);
    return z;
}

function makeMonster(def: string, level: number, champion: boolean, rng: Rng): MonsterState {
    const d = MONSTERS[def]!;
    const life = Math.round(monsterLife(level) * d.life * (champion ? 3 : 1));
    return { def, level, life, maxLife: life, champion, atk: rng.range(0.4, 1.4) / d.speed };
}

function spawnPack(run: RunState, z: ZoneDef, rng: Rng): void {
    run.monsters = [];
    if (run.pack >= run.packs) {
        if (z.boss) run.monsters.push(makeMonster(z.boss, z.level + 1, false, rng));
        return;
    }
    const n = rng.int(z.packSize[0], z.packSize[1]);
    const champ = rng.chance(z.champion);
    for (let i = 0; i < n; i++) run.monsters.push(makeMonster(rng.pick(z.monsters), z.level, champ && i === 0, rng));
}

/**
 * Advances the simulation to wall-clock `now`, at most `maxSteps` steps.
 * Returns true when caught up. Offline time beyond MAX_OFFLINE_MS is dropped.
 */
export function advance(state: GameState, now: number, ev: SimEvents = {}, maxSteps = Infinity): boolean {
    if (now - state.simTo > MAX_OFFLINE_MS) state.simTo = now - MAX_OFFLINE_MS;
    let steps = 0;
    while (state.simTo + STEP_MS <= now) {
        if (steps >= maxSteps) return false;
        step(state, ev);
        state.simTo += STEP_MS;
        state.totals.simMs += STEP_MS;
        steps++;
    }
    return true;
}

/** One 100 ms step. */
export function step(state: GameState, ev: SimEvents = {}): void {
    let sheet = sheetOf(state);
    if (!state.activity.run) state.activity.run = newRun(state, sheet);
    const run = state.activity.run;
    const rng = new Rng(run.rng);
    const h = run.hero;
    const z = zoneOf(run.zone);
    run.elapsed += DT;

    // Timers and recovery apply in every phase.
    h.life = Math.min(sheet.life, h.life + sheet.lifeRegen * DT);
    h.mana = Math.min(sheet.mana, h.mana + sheet.manaRegen * DT);
    if (h.esDelay > 0) h.esDelay -= DT;
    else h.es = Math.min(sheet.es, h.es + sheet.es * 0.2 * DT);
    if (h.flaskLeft > 0) { h.life = Math.min(sheet.life, h.life + h.flaskRate * DT); h.flaskLeft -= DT; }

    switch (run.phase) {
        case "dead":
            run.timer -= DT;
            if (run.timer <= 0) { state.activity.runIndex++; state.activity.run = newRun(state, sheet); }
            break;
        case "travel":
            run.timer -= DT * sheet.moveSpeed;
            if (run.timer <= 0) {
                spawnPack(run, z, rng);
                run.phase = run.monsters.length ? "fight" : "done";
            }
            break;
        case "done":
            finishRun(state, ev);
            return;
        case "fight": {
            h.cd -= DT;
            if (h.cd <= 0) {
                if (h.mana >= sheet.skill.manaCost) {
                    h.mana -= sheet.skill.manaCost;
                    sheet = heroAttack(state, run, sheet, rng, ev);
                    h.cd += 1 / Math.max(0.1, sheet.skill.speed);
                } else h.cd = 0.2;
            }
            monstersAct(run, sheet, rng, ev);
            if (h.life <= 0) {
                heroDied(state, run, ev);
                break;
            }
            if (h.flaskLeft <= 0 && h.life < sheet.life * 0.5 && h.flask >= FLASK_COST) {
                h.flask -= FLASK_COST; h.flaskLeft = FLASK_S; h.flaskRate = flaskAmount(state.hero.level, sheet) / FLASK_S;
                ev.flask?.();
            }
            if (run.monsters.every(m => m.life <= 0)) {
                run.pack++;
                const last = run.pack > run.packs || (run.pack === run.packs && !run.boss);
                run.phase = last ? "done" : "travel";
                run.timer = TRAVEL_S;
            }
            break;
        }
    }
    if (state.activity.run === run) run.rng = rng.state();
}

function heroAttack(state: GameState, run: RunState, sheet: Sheet, rng: Rng, ev: SimEvents): Sheet {
    const sk = sheet.skill;
    const alive: number[] = [];
    run.monsters.forEach((m, i) => { if (m.life > 0) alive.push(i); });
    const targets = alive.slice(0, sk.targets);
    ev.heroUse?.(sk.fx, targets);
    let dealt = 0;
    for (const i of targets) {
        const m = run.monsters[i]!;
        const d = MONSTERS[m.def]!;
        if (sk.kind === "attack" && !rng.chance(hitChance(sk.accuracy, monsterDefence(m.level) * d.evasion))) { ev.heroMiss?.(i); continue; }
        const crit = rng.chance(sk.critChance / 100);
        let dmg = 0;
        for (const t of DAMAGE_TYPES) {
            const [lo, hi] = sk.hit[t];
            if (hi <= 0) continue;
            let x = rng.range(lo, hi);
            if (crit) x *= sk.critMulti / 100;
            if (t === "phys") x *= 1 - armourReduction(monsterDefence(m.level) * d.armour * 0.5, x);
            else x *= 1 - ((d.res?.[t] ?? 0) - sk.pen[t]) / 100;
            dmg += Math.max(0, x);
        }
        dmg = Math.max(1, dmg);
        m.life -= dmg;
        dealt += dmg;
        ev.heroHit?.(i, dmg, crit);
        if (m.life <= 0) sheet = onKill(state, run, m, sheet, rng, ev);
    }
    if (sk.leech > 0 && dealt > 0) {
        const h = run.hero;
        h.life = Math.min(sheet.life, h.life + Math.min(dealt * sk.leech / 100, sheet.life * 0.1));
    }
    return sheet;
}

function monstersAct(run: RunState, sheet: Sheet, rng: Rng, ev: SimEvents): void {
    const h = run.hero;
    run.monsters.forEach((m, i) => {
        if (m.life <= 0 || h.life <= 0) return;
        const d = MONSTERS[m.def]!;
        m.atk -= DT;
        if (m.atk > 0) return;
        m.atk += rng.range(0.85, 1.15) / d.speed;
        if (!d.spell) {
            const evade = Math.min(0.75, 1 - hitChance(monsterDefence(m.level) * d.accuracy, sheet.evasion));
            if (rng.chance(evade)) { ev.monsterHit?.(i, 0, "evade"); return; }
        }
        if (rng.chance(sheet.block / 100)) { ev.monsterHit?.(i, 0, "block"); return; }
        const base = monsterDamage(m.level) * d.damage * (m.champion ? 1.5 : 1) * rng.range(0.8, 1.2);
        let dmg = 0;
        for (const t of DAMAGE_TYPES) {
            const share = d.split[t];
            if (!share) continue;
            let x = base * share;
            if (t === "phys") x *= 1 - armourReduction(sheet.armour, x);
            else x *= 1 - sheet.res[t] / 100;
            dmg += x;
        }
        dmg *= sheet.dmgTaken;
        const fromEs = Math.min(h.es, dmg);
        h.es -= fromEs;
        h.life -= dmg - fromEs;
        h.esDelay = 2;
        ev.monsterHit?.(i, dmg, null);
    });
}

function onKill(state: GameState, run: RunState, m: MonsterState, sheet: Sheet, rng: Rng, ev: SimEvents): Sheet {
    const d = MONSTERS[m.def]!;
    const hero = state.hero;
    const xp = Math.round(monsterXp(m.level) * d.xp * (m.champion ? 3 : 1) * xpPenalty(hero.level, m.level) * sheet.xpGain);
    run.kills++; run.xp += xp;
    state.totals.kills++;
    run.hero.flask = Math.min(FLASK_MAX, run.hero.flask + (d.boss ? 5 : 1) * sheet.flaskCharges);
    run.hero.life = Math.min(sheet.life, run.hero.life + sheet.lifeOnKill);
    ev.kill?.(m, xp);
    let changed = gainXp(state, xp, ev);

    // Loot (GDD: items go straight to the stash through the filter).
    const qty = 1 + sheet.quantity / 100;
    let drops = 0;
    if (d.boss) drops = 2 + (rng.chance(0.5 * qty) ? 1 : 0);
    else if (rng.chance((m.champion ? 0.4 : 0.07) * qty)) drops = 1;
    for (let k = 0; k < drops; k++) {
        const bonus = sheet.rarity + (m.champion ? 100 : 0) + (d.boss ? 250 : 0);
        const opts = d.boss && k === 0 ? { rarity: "rare" as const } : { rarityBonus: bonus };
        const item = rollItem(rng, state.nextUid++, m.level, opts);
        const r = receiveItem(state, item);
        if (r.equipped) changed = true;
        ev.loot?.(item, r.kept, r.equipped);
    }
    if (d.boss) pushLog(state, "boss", `${d.name} falls.`);
    return changed ? sheetOf(state) : sheet;
}

/** Adds XP; returns true when the hero levelled up. */
export function gainXp(state: GameState, xp: number, ev: SimEvents = {}): boolean {
    const hero = state.hero;
    if (hero.level >= MAX_LEVEL) return false;
    hero.xp += xp;
    let up = false;
    while (hero.level < MAX_LEVEL && hero.xp >= xpToNext(hero.level)) {
        hero.xp -= xpToNext(hero.level);
        hero.level++;
        hero.rev++;
        up = true;
        pushLog(state, "level", `Reached level ${hero.level}.`);
        ev.level?.(hero.level);
    }
    if (hero.level >= MAX_LEVEL) hero.xp = 0;
    return up;
}

function heroDied(state: GameState, run: RunState, ev: SimEvents): void {
    run.phase = "dead";
    run.timer = RESPAWN_S;
    run.hero.life = 0;
    state.totals.deaths++;
    const act = state.activity;
    act.streak = 0;
    act.deaths++;
    pushLog(state, "death", `Died in ${zoneOf(run.zone).name}.`);
    ev.death?.(run.zone);
    if (act.autoPush && act.deaths >= 3) {
        const i = ZONE_ORDER.indexOf(act.zone);
        if (i > 0) {
            const to = ZONE_ORDER[i - 1]!;
            ev.zone?.(act.zone, to, "retreat");
            pushLog(state, "zone", `Fell back to ${zoneOf(to).name}.`);
            act.zone = to; act.deaths = 0;
        }
    }
}

function finishRun(state: GameState, ev: SimEvents): void {
    const act = state.activity;
    const run = act.run!;
    state.totals.runs++;
    state.world.clears[run.zone] = (state.world.clears[run.zone] ?? 0) + 1;
    act.streak++;
    act.deaths = 0;
    ev.runDone?.(run.zone);
    const i = ZONE_ORDER.indexOf(run.zone);
    const next = ZONE_ORDER[i + 1];
    if (next && !state.world.unlocked.includes(next)) {
        state.world.unlocked.push(next);
        pushLog(state, "zone", `${zoneOf(next).name} is open.`);
        ev.zone?.(run.zone, next, "unlock");
    }
    if (act.autoPush && next && state.world.unlocked.includes(next) && act.streak >= 3 && act.zone === run.zone) {
        ev.zone?.(act.zone, next, "push");
        pushLog(state, "zone", `Pushed on to ${zoneOf(next).name}.`);
        act.zone = next;
        act.streak = 0;
    }
    act.runIndex++;
    act.run = newRun(state, sheetOf(state));
}
