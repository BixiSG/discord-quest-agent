// Monster archetypes. Stats multiply the level tables in scaling.ts.

import type { DamageType } from "../types";

export interface MonsterDef {
    id: string;
    name: string;
    life: number;
    damage: number;
    /** Attacks per second. */
    speed: number;
    /** Share of damage per type (sums to 1). */
    split: Partial<Record<DamageType, number>>;
    /** Spell hits can't be evaded. */
    spell?: boolean;
    armour: number;
    evasion: number;
    accuracy: number;
    res?: Partial<Record<DamageType, number>>;
    xp: number;
    boss?: boolean;
    /** Battle view: body shape and colours. */
    look: { shape: "blob" | "tall" | "crab" | "bird" | "robe" | "giant"; body: string; eye: string; size: number };
}

export const MONSTERS: Record<string, MonsterDef> = {
    drowned: { id: "drowned", name: "Drowned Wretch", life: 1.0, damage: 1.0, speed: 0.9, split: { phys: 1 }, armour: 0.6, evasion: 0.3, accuracy: 1, xp: 1,
        look: { shape: "tall", body: "#5f8f86", eye: "#f5e663", size: 1 } },
    crab: { id: "crab", name: "Shellback", life: 1.4, damage: 0.8, speed: 0.8, split: { phys: 1 }, armour: 2.2, evasion: 0.2, accuracy: 0.9, xp: 1.1,
        look: { shape: "crab", body: "#d0643a", eye: "#111111", size: 0.9 } },
    gull: { id: "gull", name: "Bone Gull", life: 0.6, damage: 0.7, speed: 1.6, split: { phys: 1 }, armour: 0.2, evasion: 2.0, accuracy: 1.2, xp: 0.9,
        look: { shape: "bird", body: "#e9e4d4", eye: "#d13b3b", size: 0.8 } },
    bogwitch: { id: "bogwitch", name: "Mire Hag", life: 0.8, damage: 1.2, speed: 0.6, split: { cold: 0.7, chaos: 0.3 }, spell: true, armour: 0.3, evasion: 0.6, accuracy: 1, xp: 1.3,
        look: { shape: "robe", body: "#4a5a3a", eye: "#9ef26a", size: 1 } },
    eel: { id: "eel", name: "Lamp Eel", life: 0.9, damage: 1.0, speed: 1.1, split: { lightning: 0.8, phys: 0.2 }, armour: 0.4, evasion: 1.2, accuracy: 1.1, xp: 1.1, res: { lightning: 40 },
        look: { shape: "blob", body: "#2f6fb8", eye: "#fff27a", size: 0.9 } },
    lampman: { id: "lampman", name: "Lanternless", life: 1.2, damage: 1.1, speed: 0.8, split: { fire: 0.6, phys: 0.4 }, armour: 1, evasion: 0.5, accuracy: 1, xp: 1.2, res: { fire: 30 },
        look: { shape: "tall", body: "#3c3c46", eye: "#ff9a2e", size: 1.05 } },
    // ---- bosses
    tidewarden: { id: "tidewarden", name: "The Tide-Warden", boss: true, life: 25, damage: 2.4, speed: 0.7, split: { phys: 0.6, cold: 0.4 },
        armour: 1.5, evasion: 0.6, accuracy: 1.2, res: { cold: 40, fire: 20, lightning: 20, chaos: 20 }, xp: 18,
        look: { shape: "giant", body: "#2c6f73", eye: "#dff7ff", size: 1.8 } },
    keeper: { id: "keeper", name: "Chapel Keeper", boss: true, life: 12, damage: 1.8, speed: 0.8, split: { phys: 0.5, chaos: 0.5 },
        armour: 1, evasion: 0.8, accuracy: 1.1, res: { chaos: 30, fire: 10, cold: 10, lightning: 10 }, xp: 10,
        look: { shape: "robe", body: "#6b4a7a", eye: "#ffd84a", size: 1.5 } },
};
