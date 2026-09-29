// The one game state object. Plain JSON: it is what gets saved.

import type { RngState } from "./rng";
import type { Item, Slot } from "./types";
import type { FilterRule } from "./filter";
import type { ContractBoard } from "./contracts";
import type { MarketState } from "./market";

export interface Hero {
    name: string;
    cls: string;
    level: number;
    xp: number;
    skill: string;
    supports: string[];
    equipment: Partial<Record<Slot, Item>>;
    passives: string[];
    /** Passive points from act rewards, on top of one per level. */
    bonusPoints: number;
    asc?: string;
    /** Ascendancy nodes taken and points earned from trials. */
    ascNodes: string[];
    ascPoints: number;
    /** Bumped on every change that affects the stat sheet. */
    rev: number;
    /** The companion at the hero's side and its level (v6). */
    pet?: { id: string; level: number };
    /** Dawns (v7): how many times the sun was relit, and the perks picked (one per dawn). */
    dawn?: { level: number; perks: string[] };
}

export interface MonsterState {
    def: string;
    level: number;
    life: number;
    maxLife: number;
    champion: boolean;
    /** Seconds until its next attack. */
    atk: number;
    /** Hollow Night: carries a lantern (tougher, worth more; season.ts). */
    lantern?: boolean;
}

export interface MapItem {
    uid: number;
    tier: number;
    area: string;
    mods: string[];
    rarity: "plain" | "enchanted" | "rare";
    /** Dropped during Hollow Night: more lanterns inside, more items (season.ts). */
    lit?: boolean;
}

/** What a map run is: set at run start from the consumed map (or a pinnacle). */
export interface RunMap {
    tier: number;
    area: string;
    mods: string[];
    level: number;
    pinnacle?: string;
    lit?: boolean;
}

export interface RunState {
    rng: RngState;
    zone: string;
    /** Map runs: zone is "map" and this describes the map. */
    map?: RunMap;
    /** Index of the current pack; packs === done means the boss (if any) is up. */
    pack: number;
    packs: number;
    boss: boolean;
    phase: "fight" | "travel" | "dead" | "done";
    /** Seconds left in travel / respawn. */
    timer: number;
    monsters: MonsterState[];
    hero: { life: number; es: number; mana: number; flask: number; flaskLeft: number; flaskRate: number; cd: number; esDelay: number; leech?: number };
    /** Totals for this run, for the log. */
    kills: number;
    xp: number;
    elapsed: number;
}

/**
 * A chronicle line. `text` is English (old saves have only that); newer entries also carry a string
 * key and params (content as references, i18n/refs.ts), so they read in the game's language.
 */
export interface LogEntry { t: number; kind: "level" | "loot" | "death" | "zone" | "boss" | "info"; text: string; key?: string; params?: Record<string, string | number> }

export interface Totals { kills: number; deaths: number; runs: number; items: number; salvaged: number; dust: number; simMs: number; maps?: number; /** Stash items upkeep gave up for better drops. */ swapped?: number }

export interface GameState {
    seed: number;
    createdAt: number;
    /** Wall-clock time the simulation has caught up to. */
    simTo: number;
    hero: Hero;
    stash: Item[];
    stashCap: number;
    dust: number;
    currency: Record<string, number>;
    world: {
        unlocked: string[];
        clears: Record<string, number>;
        storySeen: string[];
        /** One-time rewards already granted ("act:1", "trial:a1_trial"). */
        rewards: string[];
        /** Trial id -> hero level at which auto-push may try it again. */
        trialTry?: Record<string, number>;
    };
    activity: {
        zone: string;
        autoPush: boolean;
        runIndex: number;
        /** Clean clears in a row in this zone (auto-push). */
        streak: number;
        deaths: number;
        run: RunState | null;
        /** Milliseconds not yet simulated (less than a step). */
        acc: number;
        /** "zone" runs activity.zone; "map" runs maps from the map stash. */
        mode: "zone" | "map";
        /** Map tier the player caps the device at; 0 = the highest available. */
        mapTier: number;
        /** A lower cap set by auto-push after deaths; 0 = none. Cleared after clean maps. */
        autoCap?: number;
        /** Times the cap came down since the last level-up (0-3): the clean streak to climb is 8 << this. */
        capBackoff?: number;
        /** A pinnacle fight to run next. */
        pinnacle?: string;
    };
    maps: MapItem[];
    mapCap: number;
    atlas: {
        points: number;
        nodes: string[];
        /** Tiers completed at least once (atlas points are granted on first completion). */
        tiers: number[];
    };
    sigils: Record<string, number>;
    pinnacleKills: Record<string, number>;
    settings: {
        /** Loot filter: minimum rarity kept (P1). */
        keep: "plain" | "enchanted" | "rare";
        autoEquip: boolean;
        filter: FilterRule[];
        /** A full stash swaps its least-worth unlocked item for a better keeper (v5). */
        upkeep: boolean;
        /** Fill empty sockets in worn gear with the best stone in the pouch (v7). */
        autoStones: boolean;
    };
    /** Relic case: the best copy of each relic, outside the stash (v5). */
    relics: Item[];
    /** Relic codex: relic id -> how many have dropped (v5). */
    codex: Record<string, number>;
    /** The contract board (v5): three standing goals with rewards. */
    contracts: ContractBoard;
    /** Companions found (v6): id -> bond (kills while out, plus duplicates). */
    companions: Record<string, number>;
    /** Ember shrine (v6): blessing id -> simulation time it runs until. */
    blessings: Record<string, number>;
    /** Shrine settings (v6): blessings kept up automatically, and whether spare orbs pay first. */
    shrine: { keep: string[]; orbs: boolean };
    /** Ember stone pouch (v7): "ruby:2" -> count. */
    stones: Record<string, number>;
    /** The Wandering Market (v7). */
    market: MarketState;
    /** Echoes found (v7): lore pages from map bosses and pinnacles. */
    echoes: string[];
    /** The player's UTC offset in minutes, recorded by the UI: seasonal events follow the local calendar. */
    tz?: number;
    /** Seasonal tallies: "hollownight2026" -> lanterns snuffed that October. */
    events?: Record<string, number>;
    totals: Totals;
    nextUid: number;
    /** Set when a kept drop had to be salvaged; cleared when space is made. */
    stashFull?: boolean;
    /** Crafts done so far: seeds the crafting RNG. */
    craftSeq: number;
    log: LogEntry[];
}

export const newTotals = (): Totals => ({ kills: 0, deaths: 0, runs: 0, items: 0, salvaged: 0, dust: 0, simMs: 0 });
