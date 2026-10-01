// The combat simulation (COMBAT.md section 11). Fixed 100 ms steps; online
// play and offline catch-up both go through advance().

import { Rng, hashSeed } from "../rng";
import { ACTS, ACT_BOSS_POINTS, CURRENCIES, CURRENCY_ORDER, MONSTERS, SKILLS, SUPPORTS, TRIAL_AFTER, TRIAL_POINTS, ZONES, ZONE_ORDER, monsterDamage, monsterDefence, monsterLife, monsterXp, xpPenalty, xpToNext, MAX_LEVEL, type MonsterDef, type ZoneDef } from "../data";
import { armourReduction, hitChance, type Sheet } from "../character";
import { rollItem, rollRelic } from "../items";
import type { GameState, MonsterState, RunState } from "../state";
import { DAMAGE_TYPES, type DamageType, type Item } from "../types";
import { codexRarity, equipUpgrades, sheetOf, receiveItem, pushLog } from "../game";
import { deriveSheet } from "../character";
import { addMap, atlasEffects, completeMap, dropTier, mapEffects, mapZone, rollMap, startMapRun, type MapEffects } from "../maps";
import { MAP_BOSS_DAMAGE, MAP_BOSS_LIFE, MASTERY_BOSS, PINNACLES } from "../data";
import { BOARD_SIZE, contractEvent, ensureContracts } from "../contracts";
import { grantCompanion, petKill, rollCompanionDrop } from "../companions";
import { blessing, tickShrine } from "../shrine";
import { addStone, autoSetStones, rollSockets, rollStone } from "../sockets";
import { tickMarket } from "../market";
import { pinnacleEcho, rollMapEcho } from "../echoes";
import { dawnEffects, hasPerk } from "../dawn";
import { LANTERN, hollowNight, lanternKill, lanternRate, tickSeason, touch } from "../season";
import { ACT_COMPANION } from "../data";
import { ref } from "../../i18n/refs";
import { checkFeats } from "../feats";
import { tickErrands } from "../errands";
import { gainMastery } from "../mastery";
import { omenCurrency, omenEffects, tickOmen } from "../omens";

export const STEP_MS = 100;
const DT = STEP_MS / 1000;
export const MAX_OFFLINE_MS = 24 * 3600e3;
const TRAVEL_S = 1.5;
const RESPAWN_S = 6;
export const FLASK_MAX = 30, FLASK_COST = 10, FLASK_S = 2;
/** Map auto-push: failed maps that lower the cap, clean maps in a row that raise it again. */
const MAP_FAILS = 2, MAP_CLEAN = 8;
/** Auto-push waits until the hero is at most this many levels below the next zone (full XP range). */
export const PUSH_LEVEL_MARGIN = 1;
/** Share of a level's experience lost on a death in a map. */
export const MAP_DEATH_XP = 0.03;
/**
 * Pinnacles enrage: after ENRAGE_S seconds their hits grow ENRAGE_PER (a share)
 * each second, so a build has to kill them, not just outlast them.
 */
export const ENRAGE_S = 90, ENRAGE_PER = 0.02;
/** How much harder a pinnacle hits `elapsed` seconds into its fight. */
export const enrage = (elapsed: number) => 1 + ENRAGE_PER * Math.max(0, elapsed - ENRAGE_S);

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
    currency?(id: string): void;
    /** A story beat, as a string key (a zone's boss text, an act's outro). */
    story?(key: string): void;
    /** A companion joined (new) or added bond to one owned (duplicate). */
    companion?(id: string, isNew: boolean): void;
    /** An ember stone went into the pouch. */
    stone?(key: string): void;
    /** An echo (lore page) was found. */
    echo?(id: string): void;
    /** A feat was earned. */
    feat?(id: string): void;
    /** A companion came back from an errand. */
    errand?(pet: string, kind: string): void;
    /** A skill reached a new mastery level. */
    mastery?(skill: string, level: number): void;
    /** A new week's omen began. */
    omen?(id: string): void;
}

export const flaskAmount = (level: number, sheet: Sheet) => (40 + 14 * level) * sheet.flaskHeal;

export function newRun(state: GameState, sheet: Sheet): RunState {
    const act = state.activity;
    // Maps are taken out of the stash when the run starts; a death loses them.
    const map = act.mode === "map" ? startMapRun(state) : undefined;
    const z = map ? mapZone(map, atlasEffects(state)) : zoneOf(act.zone);
    const rng = new Rng(hashSeed(state.seed, act.runIndex));
    const run: RunState = {
        rng: rng.state(), zone: z.id, pack: 0, packs: z.packs, boss: !!z.boss, phase: "fight", timer: 0, monsters: [],
        hero: { life: sheet.life, es: sheet.es, mana: sheet.mana, flask: FLASK_MAX, flaskLeft: 0, flaskRate: 0, cd: 0.3, esDelay: 0 },
        kills: 0, xp: 0, elapsed: 0,
    };
    if (map) run.map = map;
    const prev = act.run;
    if (prev && prev.zone === z.id) run.hero.flask = prev.hero.flask;
    spawnPack(run, z, rng, effectsOf(state, run), lanternRate(state, run));
    run.rng = rng.state();
    return run;
}

export function zoneOf(id: string): ZoneDef {
    const z = ZONES[id];
    if (!z) throw new Error("unknown zone " + id);
    return z;
}

/** The zone a run is in: a story zone, or one built from its map. */
export function runZone(state: GameState, run: RunState): ZoneDef {
    return run.map ? mapZone(run.map, atlasEffects(state)) : zoneOf(run.zone);
}

/** A run's world: the map's mods, then the dawn, then the week's omen. */
export const effectsOf = (state: GameState, run: RunState): MapEffects | null => {
    const pin = !!run.map?.pinnacle;
    return omenEffects(state, run, dawnEffects(state, run, run.map ? mapEffects(run.map, atlasEffects(state)) : null, pin), pin);
};

// A map with hero modifiers (e.g. less regeneration) gets its own stat sheet.
const mapSheets = new WeakMap<object, { rev: number; sheet: Sheet }>();
/** The stat sheet in effect for the current run. */
export function runSheet(state: GameState): Sheet {
    const run = state.activity.run;
    const eff = run ? effectsOf(state, run) : null;
    // A pinnacle leaves the week's omen outside, the hero's side of it too (the dawn loop keeps its pace).
    const bare = !!run?.map?.pinnacle && !!state.hero.omen;
    if (!run?.map || (!eff?.hero.length && !bare)) return sheetOf(state);
    const c = mapSheets.get(run.map);
    if (c && c.rev === state.hero.rev) return c.sheet;
    const sheet = deriveSheet(bare ? { ...state.hero, omen: undefined } : state.hero, eff?.hero ?? []);
    mapSheets.set(run.map, { rev: state.hero.rev, sheet });
    return sheet;
}

export function makeMonster(def: string, level: number, champion: boolean, rng: Rng, eff: MapEffects | null): MonsterState {
    const d = MONSTERS[def]!;
    const life = Math.round(monsterLife(level) * d.life * (champion ? 3 : 1) * (eff?.life ?? 1));
    return { def, level, life, maxLife: life, champion, atk: rng.range(0.4, 1.4) / d.speed };
}

/** A pack (or the boss); `lantern` is the share of monsters that carry a Hollow Night lantern. */
function spawnPack(run: RunState, z: ZoneDef, rng: Rng, eff: MapEffects | null, lantern = 0): void {
    run.monsters = [];
    if (run.pack >= run.packs) {
        if (z.boss) {
            const b = makeMonster(z.boss, run.map?.pinnacle ? z.level : z.level + 1, false, rng, eff);
            if (run.map && !run.map.pinnacle) { b.life = b.maxLife = Math.round(b.maxLife * MAP_BOSS_LIFE * (eff?.bossLife ?? 1)); }
            run.monsters.push(b);
        }
        return;
    }
    const n = rng.int(z.packSize[0], z.packSize[1]);
    const champ = rng.chance(z.champion);
    for (let i = 0; i < n; i++) {
        const m = makeMonster(rng.pick(z.monsters), z.level, champ && i === 0, rng, eff);
        if (lantern > 0 && rng.chance(lantern)) touch(m);
        run.monsters.push(m);
    }
}

/**
 * Advances the simulation to wall-clock `now`, at most `maxSteps` steps.
 * Returns true when caught up. Offline time beyond MAX_OFFLINE_MS is dropped.
 */
export function advance(state: GameState, now: number, ev: SimEvents = {}, maxSteps = Infinity): boolean {
    if (now - state.simTo > MAX_OFFLINE_MS) state.simTo = now - MAX_OFFLINE_MS;
    // A new game (or one just claimed empty) gets its contracts before it plays.
    if ((state.contracts?.list.length ?? 0) < BOARD_SIZE) ensureContracts(state);
    tickSeason(state, ev);
    tickOmen(state, { onNew: id => ev.omen?.(id) });
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
    if (!state.activity.run) state.activity.run = newRun(state, sheetOf(state));
    // Errands come home on the hero's clock, whatever the run is doing (a hero dying run after run,
    // or one fight that never ends, must not keep them away).
    if (state.errands?.some(e => e.until <= state.simTo)) tickErrands(state, (pet, kind) => ev.errand?.(pet, kind));
    const run = state.activity.run;
    let sheet = runSheet(state);
    const rng = new Rng(run.rng);
    const h = run.hero;
    const z = runZone(state, run);
    const eff = effectsOf(state, run);
    run.elapsed += DT;

    // Timers and recovery apply in every phase.
    h.life = Math.min(sheet.life, h.life + sheet.lifeRegen * DT);
    h.mana = Math.min(sheet.mana, h.mana + sheet.manaRegen * DT);
    if (h.esDelay > 0) h.esDelay -= DT;
    else h.es = Math.min(sheet.es, h.es + sheet.es * 0.2 * DT);
    h.leech = Math.min(sheet.life * 0.1, (h.leech ?? sheet.life * 0.1) + sheet.life * 0.1 * DT);
    if (h.flaskLeft > 0) { h.life = Math.min(sheet.life, h.life + h.flaskRate * DT); h.flaskLeft -= DT; }

    switch (run.phase) {
        case "dead":
            run.timer -= DT;
            if (run.timer <= 0) {
                // A hero that keeps dying still levels and kills: its feats are checked as it rises.
                checkFeats(state, { onFeat: id => ev.feat?.(id) });
                state.activity.runIndex++;
                state.activity.run = newRun(state, sheetOf(state));
            }
            break;
        case "travel":
            run.timer -= DT * sheet.moveSpeed;
            if (run.timer <= 0) {
                spawnPack(run, z, rng, eff, lanternRate(state, run));
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
                    sheet = heroAttack(state, run, sheet, rng, ev, eff);
                    h.cd += 1 / Math.max(0.1, sheet.skill.speed);
                } else h.cd = 0.2;
            }
            monstersAct(run, sheet, rng, ev, eff);
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

/** A monster's evasion, armour and resistance to a damage type, with the map's mods (veiled, armoured, warded). */
export const monsterEvasion = (m: MonsterState, eff: MapEffects | null) => monsterDefence(m.level) * MONSTERS[m.def]!.evasion * (eff?.evasion ?? 1);
/** Monster armour counts at half against the hero's hits (COMBAT.md 9). */
export const monsterArmour = (m: MonsterState, eff: MapEffects | null) => monsterDefence(m.level) * MONSTERS[m.def]!.armour * 0.5 * (eff?.armour ?? 1);
export const monsterRes = (m: MonsterState, t: DamageType, eff: MapEffects | null) => (MONSTERS[m.def]!.res?.[t] ?? 0) + (t !== "phys" && t !== "chaos" ? eff?.res ?? 0 : 0);

function heroAttack(state: GameState, run: RunState, sheet: Sheet, rng: Rng, ev: SimEvents, eff: MapEffects | null): Sheet {
    // The swing is the skill as it was cast: a kill that changes the sheet (a level, mastery, gear)
    // counts from the next one, so every target's roll and the leech use `cast`.
    const cast = sheet, sk = cast.skill;
    const alive: number[] = [];
    run.monsters.forEach((m, i) => { if (m.life > 0) alive.push(i); });
    const targets = alive.slice(0, sk.targets);
    ev.heroUse?.(sk.fx, targets);
    let dealt = 0;
    for (const i of targets) {
        const m = run.monsters[i]!;
        const roll = heroHitRoll(cast, m, rng, eff);
        if (!roll) { ev.heroMiss?.(i); continue; }
        m.life -= roll.dmg;
        dealt += roll.dmg;
        ev.heroHit?.(i, roll.dmg, roll.crit);
        if (m.life <= 0) sheet = onKill(state, run, m, sheet, rng, ev);
    }
    applyLeech(run, sheet, dealt, sk.leech);
    return sheet;
}

/** One hit of the hero's skill on `m` (through the world's monster mods): null when an attack misses. Shared with the Fray. */
export function heroHitRoll(sheet: Sheet, m: MonsterState, rng: Rng, eff: MapEffects | null): { dmg: number; crit: boolean } | null {
    const sk = sheet.skill;
    if (sk.kind === "attack" && !rng.chance(hitChance(sk.accuracy, monsterEvasion(m, eff)))) return null;
    const crit = rng.chance(sk.critChance / 100);
    let dmg = 0;
    for (const t of DAMAGE_TYPES) {
        const [lo, hi] = sk.hit[t];
        if (hi <= 0) continue;
        let x = rng.range(lo, hi);
        if (crit) x *= sk.critMulti / 100;
        if (t === "phys") x *= 1 - armourReduction(monsterArmour(m, eff), x);
        else x *= 1 - (monsterRes(m, t, eff) - sk.pen[t]) / 100;
        dmg += Math.max(0, x);
    }
    return { dmg: Math.max(1, dmg), crit };
}

/**
 * Life leeched from `dealt` damage (COMBAT.md 8: at most 10% of max life per second, a refilling budget).
 * `leech` is the casting skill's percentage (the sheet may have changed since: a kill mid-swing).
 */
export function applyLeech(run: RunState, sheet: Sheet, dealt: number, leech = sheet.skill.leech): void {
    if (leech <= 0 || dealt <= 0) return;
    const h = run.hero;
    const got = Math.min(dealt * leech / 100, h.leech ?? sheet.life * 0.1);
    h.leech = (h.leech ?? sheet.life * 0.1) - got;
    h.life = Math.min(sheet.life, h.life + got);
}

/** A monster's attack timer: seconds until it swings next. */
export const monsterSwing = (d: MonsterDef, rng: Rng, eff: MapEffects | null) => rng.range(0.85, 1.15) / (d.speed * (eff?.speed ?? 1));

/**
 * One swing of `m` at the hero: evade and block first, then damage through armour and
 * resistances, taken from energy shield before life. `mapBoss` multiplies a boss's base damage.
 * Returns what the UI needs; the hero's vitals are already changed. Shared with the Fray.
 */
export function monsterHitRoll(run: RunState, m: MonsterState, sheet: Sheet, rng: Rng, eff: MapEffects | null, mapBoss: number): { dmg: number; avoided: "evade" | "block" | null } {
    const h = run.hero;
    const d = MONSTERS[m.def]!;
    if (!d.spell) {
        const evade = Math.min(0.75, 1 - hitChance(monsterDefence(m.level) * d.accuracy, sheet.evasion));
        if (rng.chance(evade)) return { dmg: 0, avoided: "evade" };
    }
    if (rng.chance(sheet.block / 100)) return { dmg: 0, avoided: "block" };
    const base = monsterDamage(m.level) * d.damage * mapBoss * (m.champion ? 1.5 : 1) * (eff?.damage ?? 1) * rng.range(0.8, 1.2);
    let dmg = 0;
    for (const t of DAMAGE_TYPES) {
        let share = d.split[t] ?? 0;
        if (eff) for (const [et, es] of eff.extra) if (et === t) share += es;
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
    return { dmg, avoided: null };
}

function monstersAct(run: RunState, sheet: Sheet, rng: Rng, ev: SimEvents, eff: MapEffects | null): void {
    const h = run.hero;
    run.monsters.forEach((m, i) => {
        if (m.life <= 0 || h.life <= 0) return;
        const d = MONSTERS[m.def]!;
        m.atk -= DT;
        if (m.atk > 0) return;
        m.atk += monsterSwing(d, rng, eff);
        const mapBoss = d.boss && run.map ? (run.map.pinnacle ? enrage(run.elapsed) : MAP_BOSS_DAMAGE * (eff?.bossDamage ?? 1)) : 1;
        const r = monsterHitRoll(run, m, sheet, rng, eff, mapBoss);
        ev.monsterHit?.(i, r.dmg, r.avoided);
    });
}

/** Extra rewards for a kill: the Fray pays more experience and rolls better loot. */
export interface KillBonus { xp: number; rarity: number }

/**
 * Everything a kill gives: experience, flask charges, loot, currency, stones, maps, companions.
 * Shared with the Fray, which passes its own run. Returns the sheet (re-derived when gear changed).
 */
export function onKill(state: GameState, run: RunState, m: MonsterState, sheet: Sheet, rng: Rng, ev: SimEvents, killBonus?: KillBonus): Sheet {
    const d = MONSTERS[m.def]!;
    const hero = state.hero;
    const atlas = run.map ? atlasEffects(state) : null;
    let changed0 = false;
    const eff = effectsOf(state, run);
    const xp = Math.round(monsterXp(m.level) * d.xp * (m.champion ? 3 : 1) * (m.lantern ? LANTERN.xp : 1) * xpPenalty(hero.level, m.level) * sheet.xpGain * (1 + (atlas?.xp ?? 0) / 100) * (1 + blessing(state, "insight") / 100) * (killBonus?.xp ?? 1));
    run.kills++; run.xp += xp;
    state.totals.kills++;
    // The skill in use grows with every kill (a new level changes the sheet).
    if (gainMastery(state, hero.skill, d.boss ? MASTERY_BOSS : 1, (sk, l) => ev.mastery?.(sk, l))) changed0 = true;
    run.hero.flask = Math.min(FLASK_MAX, run.hero.flask + (d.boss ? 5 : 1) * sheet.flaskCharges);
    run.hero.life = Math.min(sheet.life, run.hero.life + sheet.lifeOnKill);
    ev.kill?.(m, xp);
    if (petKill(state)) changed0 = true;
    contractEvent(state, "kills");
    if (m.champion) contractEvent(state, "champions");
    if (d.boss) { contractEvent(state, "bosses"); state.totals.bosses = (state.totals.bosses ?? 0) + 1; }
    let changed = gainXp(state, xp, ev) || changed0;

    // Loot (GDD: items go straight to the stash through the filter).
    const qty = 1 + (sheet.quantity + (eff?.quantity ?? 0) + blessing(state, "plenty")) / 100;
    let drops = 0;
    if (d.boss) drops = 2 + (rng.chance(0.5 * qty) ? 1 : 0);
    else if (rng.chance((m.champion ? 0.4 : m.lantern ? LANTERN.drop : 0.07) * qty)) drops = 1;
    for (let k = 0; k < drops; k++) {
        const bonus = sheet.rarity + codexRarity(state) + blessing(state, "fortune") + (eff?.rarity ?? 0) + (m.champion ? 100 : m.lantern ? LANTERN.rarity : 0) + (d.boss ? 250 : 0) + (killBonus?.rarity ?? 0);
        const opts = d.boss && k === 0 ? { rarity: "rare" as const } : { rarityBonus: bonus };
        const pin = run.map?.pinnacle && d.boss;
        const relicChance = pin && k === 0 ? 1 : ((d.boss ? 0.04 + (atlas?.bossRelic ?? 0) / 100 : m.champion ? 0.01 : 0.003) * (1 + bonus / 200));
        const item = (rng.chance(relicChance) && rollRelic(rng, state.nextUid, m.level)) || rollItem(rng, state.nextUid, m.level, opts);
        state.nextUid++;
        if (item.rarity === "rare") { contractEvent(state, "rares"); rollSockets(rng, item); }
        const r = receiveItem(state, item);
        if (r.equipped) changed = true;
        ev.loot?.(item, r.kept, r.equipped);
    }
    // Crafting currency.
    const cRolls = run.map?.pinnacle && d.boss ? 12 : d.boss ? 3 : 1;
    const cChance = (d.boss ? 0.6 : m.champion ? 0.12 : 0.02) * qty * (1 + (atlas?.currency ?? 0) / 100) * (1 + blessing(state, "hoard") / 100) * (1 + omenCurrency(state) / 100);
    for (let k = 0; k < cRolls; k++) {
        if (!rng.chance(cChance)) continue;
        const cur = rng.weighted(CURRENCY_ORDER, id => CURRENCIES[id]!.drop)!;
        state.currency[cur] = (state.currency[cur] ?? 0) + 1;
        ev.currency?.(cur);
    }
    // Ember stones (round 5): like currency, rarer, tier by monster level.
    if (rng.chance((d.boss ? 0.03 : m.champion ? 0.004 : 0.0004) * qty * (hasPerk(state, "stonefinder") ? 1.5 : 1))) {
        const key = rollStone(rng, m.level);
        addStone(state, key, 1);
        ev.stone?.(key);
        if (state.settings.autoStones && autoSetStones(state)) changed = true;
    }
    endgameDrops(state, run, m, rng, ev);
    // Companions: rarely from bosses, more often from map bosses, often from pinnacles.
    if (d.boss) {
        const had = { ...state.companions };
        const pet = rollCompanionDrop(state, rng, m.level, run.map?.pinnacle ? 0.15 : run.map ? 0.004 : 0.003);
        if (pet) { ev.companion?.(pet, had[pet] === undefined); changed = true; }
        // The chronicle keeps 60 lines: a map boss every minute or two would bury everything else,
        // so only pinnacles and a story boss's first fall are written down.
        if (run.map ? !!run.map.pinnacle : !state.world.clears[run.zone]) pushLog(state, "boss", "log.bossFalls", { monster: ref.monster(m.def) });
    }
    if (m.lantern && lanternKill(state, rng, m.level, ev)) changed = true;
    return changed ? runSheet(state) : sheet;
}

/** Maps drop in the endgame and in the last act; sigils from map bosses. */
function endgameDrops(state: GameState, run: RunState, m: MonsterState, rng: Rng, ev: SimEvents = {}): void {
    const d = MONSTERS[m.def]!;
    const inMap = !!run.map && !run.map.pinnacle;
    // The last act drops a few maps ahead of the Cinderlands.
    const lastAct = !run.map && ZONES[run.zone]?.act === ACTS.length;
    if (!inMap && !lastAct) return;
    const atlas = atlasEffects(state);
    const tier = inMap ? run.map!.tier : 0;
    const base = d.boss ? 0.6 : m.champion ? 0.06 : 0.012;
    const chance = base * (lastAct ? 0.25 : 1) * (1 + atlas.mapDrop / 100);
    if (rng.chance(chance)) {
        const map = rollMap(rng, state.nextUid++, dropTier(rng, tier, atlas));
        if (hollowNight(state) && rng.chance(LANTERN.litMaps)) map.lit = true;
        if (addMap(state, map)) state.totals.maps = (state.totals.maps ?? 0) + 1;
    }
    if (inMap && d.boss) { const echo = rollMapEcho(state, rng); if (echo) ev.echo?.(echo); }
    if (inMap && d.boss && tier > 0) {
        const eligible = Object.values(PINNACLES).filter(p => tier >= p.minTier);
        if (eligible.length && rng.chance(0.15 * (1 + atlas.fragments / 100))) {
            const p = eligible[rng.int(0, eligible.length - 1)]!;
            state.sigils[p.sigil] = (state.sigils[p.sigil] ?? 0) + 1;
            pushLog(state, "loot", "log.sigilFound", { sigil: ref.sigil(p.id) });
        }
    }
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
        if (state.activity.capBackoff) state.activity.capBackoff = 0; // stronger now: map auto-push may climb sooner
        // The line names what the new level opens: skills and supports nobody would otherwise notice.
        const opened = [...Object.values(SKILLS).filter(s => s.level === hero.level).map(s => ref.skill(s.id)),
            ...Object.values(SUPPORTS).filter(s => s.level === hero.level).map(s => ref.support(s.id))];
        if (opened.length && hero.level > 1) pushLog(state, "level", "log.levelUpNew", { level: hero.level, list: ref.list(opened) });
        else pushLog(state, "level", "log.levelUp", { level: hero.level });
        ev.level?.(hero.level);
    }
    if (hero.level >= MAX_LEVEL) hero.xp = 0;
    // A level-up is when stash items become wearable (or better, as the build grew): wear the upgrades.
    if (up && state.settings.autoEquip) equipUpgrades(state);
    return up;
}

function heroDied(state: GameState, run: RunState, ev: SimEvents): void {
    run.phase = "dead";
    run.timer = RESPAWN_S;
    run.hero.life = 0;
    state.totals.deaths++;
    const act = state.activity;
    // A pinnacle is not a map: losing one neither breaks the run of clean maps nor counts
    // towards lowering the device's tier.
    if (!run.map?.pinnacle) { act.streak = 0; act.deaths++; }
    pushLog(state, "death", "log.died", { place: ref.place(run.zone, run.map) });
    ev.death?.(run.zone);
    if (run.map) {
        // GDD: dying in a map costs the map and 5% of a level's experience.
        state.hero.xp = Math.max(0, state.hero.xp - MAP_DEATH_XP * xpToNext(state.hero.level));
        // Auto-push for maps: two failed maps without eight clean ones between them and the
        // device keeps to a tier lower (a tier that fails even one map in five stalls the hero).
        if (act.autoPush && act.deaths >= MAP_FAILS && run.map.tier > 1 && !run.map.pinnacle) {
            act.autoCap = Math.min(act.autoCap || Infinity, run.map.tier - 1);
            act.deaths = 0;
            // Each fall back doubles the clean streak needed to climb again (until the next level-up).
            act.capBackoff = Math.min(3, (act.capBackoff ?? 0) + 1);
            pushLog(state, "zone", "log.tooDeep", { tier: ref.tier(act.autoCap) });
        }
        return;
    }
    if (act.autoPush && act.deaths >= 3 && ZONES[act.zone]?.trial) {
        // Too hard for now: back to the furthest open road.
        const road = [...ZONE_ORDER].reverse().find(id => state.world.unlocked.includes(id) && (state.world.clears[id] ?? 0) > 0) ?? ZONE_ORDER[0]!;
        ev.zone?.(act.zone, road, "retreat");
        pushLog(state, "zone", "log.fellBack", { zone: ref.zone(road) });
        act.zone = road; act.deaths = 0;
    } else if (act.autoPush && act.deaths >= 3) {
        const i = ZONE_ORDER.indexOf(act.zone);
        if (i > 0) {
            const to = ZONE_ORDER[i - 1]!;
            ev.zone?.(act.zone, to, "retreat");
            pushLog(state, "zone", "log.fellBack", { zone: ref.zone(to) });
            act.zone = to; act.deaths = 0;
        }
    }
}

/** Story beats and rewards for the first clear of a zone. */
function firstClear(state: GameState, zoneId: string, ev: SimEvents): void {
    const z = zoneOf(zoneId);
    const hero = state.hero;
    if (z.bossText) { pushLog(state, "boss", `zone.${z.id}.bossText`); ev.story?.(`zone.${z.id}.bossText`); }
    void hero;
    const actDef = ACTS.find(a => a.zones[a.zones.length - 1] === zoneId);
    if (actDef) ev.story?.(`act.${actDef.id}.outro`);
    reconcileRewards(state, ev);
}

/**
 * Grants every one-time reward the clears have earned and not yet received,
 * and opens trials whose road zone is cleared. Idempotent: the rewards ledger
 * (world.rewards) makes it safe to run on every load, which is how saves from
 * before a reward existed catch up.
 */
export function reconcileRewards(state: GameState, ev: SimEvents = {}): void {
    const w = state.world, hero = state.hero;
    w.rewards ??= [];
    const cleared = (z: string) => (w.clears[z] ?? 0) > 0;
    for (const a of ACTS) {
        const key = `act:${a.id}`;
        if (cleared(a.zones[a.zones.length - 1]!) && !w.rewards.includes(key)) {
            w.rewards.push(key);
            hero.bonusPoints = (hero.bonusPoints ?? 0) + ACT_BOSS_POINTS;
            hero.rev++;
            pushLog(state, "info", "log.actDone", { act: a.id, n: ACT_BOSS_POINTS });
        }
        // Each act boss gives a companion on its first clear (saves from before companions get theirs on load).
        const petKey = `pet:act${a.id}`, pet = ACT_COMPANION[a.id];
        if (pet && cleared(a.zones[a.zones.length - 1]!) && !w.rewards.includes(petKey)) {
            w.rewards.push(petKey);
            state.companions ??= {};
            const isNew = state.companions[pet] === undefined;
            grantCompanion(state, pet);
            ev.companion?.(pet, isNew);
        }
    }
    for (const [trial, after] of Object.entries(TRIAL_AFTER)) {
        if (cleared(after) && !w.unlocked.includes(trial)) {
            w.unlocked.push(trial);
            pushLog(state, "zone", "log.zoneOpen", { zone: ref.zone(trial) });
            ev.zone?.(after, trial, "unlock");
        }
        const key = `trial:${trial}`;
        if (cleared(trial) && !w.rewards.includes(key)) {
            w.rewards.push(key);
            hero.ascPoints = (hero.ascPoints ?? 0) + TRIAL_POINTS;
            hero.rev++;
            pushLog(state, "info", "log.trialPassed", { zone: ref.zone(trial), n: TRIAL_POINTS });
        }
    }
    // Pinnacles beaten before echoes existed leave theirs now.
    for (const id of Object.keys(state.pinnacleKills ?? {})) if ((state.pinnacleKills[id] ?? 0) > 0) pinnacleEcho(state, id);
    // The road: every zone after a cleared one is open.
    ZONE_ORDER.forEach((z, i) => {
        const next = ZONE_ORDER[i + 1];
        if (next && cleared(z) && !w.unlocked.includes(next)) w.unlocked.push(next);
    });
}

/**
 * Auto-push visits an open trial it has not passed once the hero is two levels
 * above it; after a failed attempt it waits three more levels.
 */
function tryTrial(state: GameState, ev: SimEvents): boolean {
    const w = state.world, act = state.activity, L = state.hero.level;
    w.trialTry ??= {};
    for (const a of ACTS) {
        const t = a.trial;
        if (!w.unlocked.includes(t) || (w.clears[t] ?? 0) > 0) continue;
        if (L < zoneOf(t).level + 2 || L < (w.trialTry[t] ?? 0)) continue;
        w.trialTry[t] = L + 3;
        ev.zone?.(act.zone, t, "push");
        pushLog(state, "zone", "log.attempting", { zone: ref.zone(t) });
        act.zone = t; act.streak = 0; act.deaths = 0;
        return true;
    }
    return false;
}

function finishRun(state: GameState, ev: SimEvents): void {
    const act = state.activity;
    tickShrine(state);
    tickMarket(state);
    tickSeason(state, ev);
    tickOmen(state, { onNew: id => ev.omen?.(id) });
    // Keeps idle companions busy (errands also come home mid-run: step()).
    tickErrands(state, (pet, kind) => ev.errand?.(pet, kind));
    // New gear may have empty sockets: fill them from the pouch.
    if (state.settings.autoStones && autoSetStones(state)) { /* the next run's sheet includes them */ }
    const run = act.run!;
    state.totals.runs++;
    if (run.map) {
        completeMap(state, run.map);
        if (!run.map.pinnacle) contractEvent(state, "maps", run.map.tier);
        // A "clear runs" contract taken before the maps opened would never move otherwise.
        contractEvent(state, "runs");
        // Eight clean maps in a row: earlier failures are forgiven, and a capped device allows one
        // tier more (not straight back to the top); the cap goes once it is above every map held.
        act.streak++;
        if (act.streak >= MAP_CLEAN) act.deaths = 0;
        if (act.autoCap && act.streak >= MAP_CLEAN << (act.capBackoff ?? 0)) {
            act.autoCap++;
            act.streak = 0;
            if (act.autoCap > Math.max(0, ...state.maps.map(m => m.tier))) act.autoCap = 0;
            else pushLog(state, "zone", "log.pushDeeper", { tier: ref.tier(act.autoCap) });
        }
        ev.runDone?.(run.zone);
        // Once the run's results are in (the map's tier, a pinnacle): feats.
        checkFeats(state, { onFeat: id => ev.feat?.(id) });
        act.runIndex++;
        act.run = newRun(state, sheetOf(state));
        return;
    }
    contractEvent(state, "runs");
    const first = !state.world.clears[run.zone];
    state.world.clears[run.zone] = (state.world.clears[run.zone] ?? 0) + 1;
    if (first) firstClear(state, run.zone, ev);
    act.streak++;
    act.deaths = 0;
    ev.runDone?.(run.zone);
    const i = ZONE_ORDER.indexOf(run.zone);
    const next = ZONE_ORDER[i + 1];
    if (next && !state.world.unlocked.includes(next)) {
        state.world.unlocked.push(next);
        pushLog(state, "zone", "log.zoneOpen", { zone: ref.zone(next) });
        ev.zone?.(run.zone, next, "unlock");
    }
    const z = zoneOf(run.zone);
    if (act.autoPush && z.trial && act.zone === run.zone) {
        // A finished trial sends the hero back to the furthest open road.
        const road = [...ZONE_ORDER].reverse().find(id => state.world.unlocked.includes(id));
        if (road) { ev.zone?.(act.zone, road, "push"); act.zone = road; act.streak = 0; }
    } else if (act.autoPush && act.zone === run.zone && tryTrial(state, ev)) {
        // tryTrial moved the hero.
    } else if (act.autoPush && next && state.world.unlocked.includes(next) && act.streak >= 3 && act.zone === run.zone
        && zoneOf(next).level <= state.hero.level + PUSH_LEVEL_MARGIN) {
        ev.zone?.(act.zone, next, "push");
        pushLog(state, "zone", "log.pushedOn", { zone: ref.zone(next) });
        act.zone = next;
        act.streak = 0;
    }
    checkFeats(state, { onFeat: id => ev.feat?.(id) });
    act.runIndex++;
    act.run = newRun(state, sheetOf(state));
}
