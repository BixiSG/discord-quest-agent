// Hollow Night: every October (the player's own calendar) lanterns burn in the
// March. Some monsters carry one - tougher, brighter, worth more - lantern-lit
// maps drop, a contract asks for lanterns snuffed, and a relic and a companion
// can only be found then.
//
// The core has no clock: the local date is simulation time plus the UTC offset
// the UI records (state.tz), so a replay after days away lives through the same
// dates the hero did. RNG is only drawn for the event while it is on, so every
// other day plays exactly as before.

import { RELICS } from "./data";
import { contractEvent, ensureContracts } from "./contracts";
import { grantCompanion } from "./companions";
import { pushLog, receiveItem } from "./game";
import { ref } from "../i18n/refs";
import type { Rng } from "./rng";
import type { SimEvents } from "./sim/engine";
import type { GameState, MonsterState, RunState } from "./state";
import type { Item } from "./types";

export const HOLLOW_NIGHT = "hollownight";
export const HOLLOW_RELIC = "hollowgrin";
export const HOLLOW_PET = "pumpkinwisp";
/** The month it runs (1-12). */
export const HOLLOW_MONTH = 10;

export const LANTERN = {
    /** Share of monsters that carry a lantern: anywhere, and in a lantern-lit map. */
    chance: 0.05, litChance: 0.2,
    /** More life, experience and loot than a plain monster of their kind. */
    life: 1.5, xp: 2, drop: 0.3, rarity: 100,
    /** Per lantern snuffed. */
    relic: 1 / 1200, pet: 1 / 2500,
    /** Share of maps that drop lantern-lit during the event, and their item quantity. */
    litMaps: 0.3, litQty: 40,
    /** Lanterns a contract asks for, plus a few per hero level (about half an hour of play at any stage). */
    contract: 50, contractPerLevel: 0.6,
};

/** Days since 1970-01-01 to a calendar date (month 1-12), after Howard Hinnant's civil_from_days. */
export function civil(days: number): { y: number; m: number; d: number } {
    const z = days + 719468;
    const era = Math.floor(z / 146097);
    const doe = z - era * 146097;
    const yoe = Math.floor((doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365);
    const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
    const mp = Math.floor((5 * doy + 2) / 153);
    const d = doy - Math.floor((153 * mp + 2) / 5) + 1;
    const m = mp < 10 ? mp + 3 : mp - 9;
    return { y: yoe + era * 400 + (m <= 2 ? 1 : 0), m, d };
}

/** The local calendar date at time `t` (ms) for a UTC offset of `tz` minutes. */
export const localDate = (t: number, tz = 0) => civil(Math.floor((t + tz * 60e3) / 864e5));

let forced: boolean | null = null;
/** Development and screenshots: force the event on or off (null: the calendar decides). */
export function forceHollowNight(on: boolean | null): void { forced = on; }
/** The forced setting, for UI that reads the wall clock itself (the launcher card). */
export const hollowForced = (): boolean | null => forced;

/** Is Hollow Night on at simulation time `t`? */
export function hollowNight(s: GameState, t = s.simTo): boolean {
    return forced ?? localDate(t, s.tz ?? 0).m === HOLLOW_MONTH;
}

/** Nights left, counting tonight (0 when it is off). */
export function hollowNightsLeft(s: GameState): number {
    if (!hollowNight(s)) return 0;
    const d = localDate(s.simTo, s.tz ?? 0);
    return d.m === HOLLOW_MONTH ? 32 - d.d : 31;
}

/** This year's tally key ("hollownight2026"). */
export const hollowKey = (s: GameState) => HOLLOW_NIGHT + localDate(s.simTo, s.tz ?? 0).y;
/** Lanterns snuffed this October. */
export const lanternsSnuffed = (s: GameState) => s.events?.[hollowKey(s)] ?? 0;

/**
 * Before each run: the opening line once a year while the event is on, and
 * after it, lantern contracts that can no longer move are taken off the board
 * (finished ones wait to be claimed).
 */
export function tickSeason(s: GameState, ev: SimEvents = {}): void {
    if (hollowNight(s)) {
        const key = "season:" + hollowKey(s);
        if (s.world.rewards.includes(key)) return;
        s.world.rewards.push(key);
        pushLog(s, "info", "log.hollowBegins");
        ev.story?.("hollow.story");
    } else if (s.contracts?.list.some(c => c.kind === "lanterns" && c.n < c.target)) {
        s.contracts.list = s.contracts.list.filter(c => c.kind !== "lanterns" || c.n >= c.target);
        ensureContracts(s);
    }
}

/** The share of monsters a lantern touches in this run right now (0 outside the event and at pinnacles). */
export function lanternRate(s: GameState, run: RunState | null | undefined): number {
    if (!hollowNight(s) || run?.map?.pinnacle) return 0;
    return run?.map?.lit ? LANTERN.litChance : LANTERN.chance;
}

/** Hands a freshly spawned monster its lantern. */
export function touch(m: MonsterState): void {
    m.lantern = true;
    m.life = m.maxLife = Math.round(m.maxLife * LANTERN.life);
}

/** The Hollow Grin, rolled. */
export function hollowRelic(s: GameState, rng: Rng, ilvl: number): Item {
    const def = RELICS[HOLLOW_RELIC]!;
    return { uid: s.nextUid++, base: def.base, ilvl: Math.max(def.level, ilvl), rarity: "relic", affixes: [], relic: def.id, relicRolls: def.mods.map(m => rng.int(m.range[0], m.range[1])) };
}

/**
 * A lantern-touched monster died: the tally and the contract move, and it may
 * leave the Hollow Grin or a Pumpkin Wisp behind. Returns true when the stat
 * sheet may have changed (something went on, a companion joined).
 */
export function lanternKill(s: GameState, rng: Rng, level: number, ev: SimEvents = {}): boolean {
    s.events ??= {};
    const key = hollowKey(s);
    s.events[key] = (s.events[key] ?? 0) + 1;
    contractEvent(s, "lanterns");
    let changed = false;
    if (rng.chance(LANTERN.relic)) {
        const item = hollowRelic(s, rng, level);
        pushLog(s, "loot", "log.lanternRelic", { relic: ref.relic(HOLLOW_RELIC) });
        const r = receiveItem(s, item);
        if (r.equipped) changed = true;
        ev.loot?.(item, r.kept, r.equipped);
    }
    if (rng.chance(LANTERN.pet)) {
        const isNew = s.companions?.[HOLLOW_PET] === undefined;
        grantCompanion(s, HOLLOW_PET);
        ev.companion?.(HOLLOW_PET, isNew);
        changed = true;
    }
    return changed;
}
