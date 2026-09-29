// The one game state object. Plain JSON: it is what gets saved.

import type { RngState } from "./rng";
import type { Item, Slot } from "./types";
import type { FilterRule } from "./filter";

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
}

export interface MonsterState {
    def: string;
    level: number;
    life: number;
    maxLife: number;
    champion: boolean;
    /** Seconds until its next attack. */
    atk: number;
}

export interface RunState {
    rng: RngState;
    zone: string;
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

export interface LogEntry { t: number; kind: "level" | "loot" | "death" | "zone" | "boss" | "info"; text: string }

export interface Totals { kills: number; deaths: number; runs: number; items: number; salvaged: number; dust: number; simMs: number }

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
    };
    settings: {
        /** Loot filter: minimum rarity kept (P1). */
        keep: "plain" | "enchanted" | "rare";
        autoEquip: boolean;
        filter: FilterRule[];
    };
    totals: Totals;
    nextUid: number;
    /** Set when a kept drop had to be salvaged; cleared when space is made. */
    stashFull?: boolean;
    /** Crafts done so far: seeds the crafting RNG. */
    craftSeq: number;
    log: LogEntry[];
}

export const newTotals = (): Totals => ({ kills: 0, deaths: 0, runs: 0, items: 0, salvaged: 0, dust: 0, simMs: 0 });
