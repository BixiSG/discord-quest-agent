// Weekly omens (round 9): which omen the hero's week has, and what it does.
// Like Hollow Night, the week is the player's local one: simulation time plus
// the UTC offset the UI records, so a replay after days away lives through the
// same weeks the hero did. The omen's id is copied onto the hero (hero.omen) so
// the stat sheet stays a function of the hero; monsters and rewards read it
// from there too.

import { OMENS, omenOfWeek, type OmenDef } from "./data";
import { NO_EFFECTS, type MapEffects } from "./maps";
import { pushLog } from "./game";
import { ref } from "../i18n/refs";
import type { GameState } from "./state";

/** Local days since 1970-01-01 at time `t`. */
const localDays = (t: number, tz = 0) => Math.floor((t + tz * 60e3) / 864e5);
/** The week (Monday to Sunday, local) at time `t`: 1970-01-01 was a Thursday. */
export const weekAt = (t: number, tz = 0) => Math.floor((localDays(t, tz) + 3) / 7);

let forced: string | null = null;
/** Development and screenshots: force an omen (null: the calendar decides). */
export function forceOmen(id: string | null): void { forced = id && OMENS[id] ? id : null; }

/** This week's omen id at simulation time `t`. */
export function omenAt(s: GameState, t = s.simTo): string {
    return forced ?? omenOfWeek(weekAt(t, s.tz ?? 0));
}
/** Next week's omen id. */
export const nextOmen = (s: GameState) => (forced ? forced : omenOfWeek(weekAt(s.simTo, s.tz ?? 0) + 1));
/** Days left of this week's omen, counting today. */
export const omenDaysLeft = (s: GameState) => 7 - ((localDays(s.simTo, s.tz ?? 0) + 3) % 7);

/** The omen the hero lives under (the one on the hero). */
export const heroOmen = (s: GameState): OmenDef | undefined => (s.hero.omen ? OMENS[s.hero.omen] : undefined);

/**
 * Puts this week's omen on the hero; a new week's omen is written in the
 * chronicle once (not when `quiet`, as a save loads). Returns true when the
 * omen changed.
 */
export function tickOmen(s: GameState, opts: { quiet?: boolean; onNew?: (id: string) => void } = {}): boolean {
    const id = omenAt(s);
    const week = weekAt(s.simTo, s.tz ?? 0);
    const changed = s.hero.omen !== id;
    if (changed) { s.hero.omen = id; s.hero.rev++; }
    // Only a week later than the last one is news (a clock or time zone moved back is not).
    if (s.omenWeek === undefined || week > s.omenWeek) {
        if (!opts.quiet && s.omenWeek !== undefined) { pushLog(s, "info", "log.omen", { omen: ref.omen(id) }); opts.onNew?.(id); }
        s.omenWeek = week;
    }
    return changed;
}

/** Percent more crafting currency from the omen (salvage dust: salvageItem reads the hero's omen). */
export const omenCurrency = (s: GameState) => heroOmen(s)?.currency ?? 0;

/** The world under the omen: monsters (not pinnacles) and finds, on top of `base` (a map's mods, a dawn). */
const wrapped = new WeakMap<object, { omen: string; base: MapEffects | null; eff: MapEffects | null }>();
export function omenEffects(s: GameState, key: object, base: MapEffects | null, pinnacle = false): MapEffects | null {
    const o = heroOmen(s);
    if (!o) return base;
    const c = wrapped.get(key);
    if (c && c.omen === o.id && c.base === base) return c.eff;
    const b = base ?? NO_EFFECTS();
    const monsters = !pinnacle;
    const eff: MapEffects = {
        ...b,
        life: b.life * (monsters ? 1 + (o.life ?? 0) / 100 : 1),
        damage: b.damage * (monsters ? 1 + (o.damage ?? 0) / 100 : 1),
        speed: b.speed * (monsters ? (o.speed ?? 1) : 1),
        evasion: b.evasion * (monsters ? (o.evasion ?? 1) : 1),
        rarity: b.rarity + (o.rarity ?? 0),
        quantity: b.quantity + (o.quantity ?? 0),
    };
    wrapped.set(key, { omen: o.id, base, eff });
    return eff;
}
