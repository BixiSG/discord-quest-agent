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
    // ---- Act 2: the Glass Barrens
    scorpion: { id: "scorpion", name: "Glass Scorpion", life: 1.2, damage: 1.0, speed: 1.0, split: { phys: 0.7, chaos: 0.3 }, armour: 1.8, evasion: 0.5, accuracy: 1.1, xp: 1.1,
        look: { shape: "crab", body: "#9fd8e8", eye: "#ff3b3b", size: 0.95 } },
    wraith: { id: "wraith", name: "Sand Wraith", life: 0.8, damage: 1.2, speed: 0.8, split: { fire: 0.5, phys: 0.5 }, spell: true, armour: 0.3, evasion: 1.4, accuracy: 1, xp: 1.2,
        look: { shape: "robe", body: "#d9b56b", eye: "#ffffff", size: 1 } },
    jackal: { id: "jackal", name: "Mirage Jackal", life: 0.7, damage: 0.9, speed: 1.5, split: { phys: 1 }, armour: 0.3, evasion: 1.8, accuracy: 1.2, xp: 0.9,
        look: { shape: "blob", body: "#c4884a", eye: "#fff27a", size: 0.8 } },
    bleached: { id: "bleached", name: "Bleached Pilgrim", life: 1.1, damage: 1.0, speed: 0.9, split: { phys: 0.6, lightning: 0.4 }, armour: 1, evasion: 0.6, accuracy: 1, xp: 1.1,
        look: { shape: "tall", body: "#ece3cf", eye: "#3a9bff", size: 1 } },
    wasp: { id: "wasp", name: "Prism Wasp", life: 0.5, damage: 0.8, speed: 1.8, split: { lightning: 0.7, phys: 0.3 }, armour: 0.2, evasion: 2.2, accuracy: 1.3, xp: 0.9, res: { lightning: 30 },
        look: { shape: "bird", body: "#b8f0ff", eye: "#ff5a36", size: 0.7 } },
    // ---- Act 3: the Sunfall
    hound: { id: "hound", name: "Ember Hound", life: 0.9, damage: 1.1, speed: 1.4, split: { fire: 0.6, phys: 0.4 }, armour: 0.6, evasion: 1.2, accuracy: 1.2, xp: 1.0, res: { fire: 40 },
        look: { shape: "blob", body: "#e2543b", eye: "#ffe066", size: 0.9 } },
    ashwalker: { id: "ashwalker", name: "Ash Walker", life: 1.4, damage: 1.1, speed: 0.8, split: { phys: 0.5, fire: 0.5 }, armour: 1.6, evasion: 0.4, accuracy: 1, xp: 1.2, res: { fire: 30 },
        look: { shape: "tall", body: "#5b5450", eye: "#ff9a2e", size: 1.1 } },
    cinderbat: { id: "cinderbat", name: "Cinder Bat", life: 0.5, damage: 0.8, speed: 1.9, split: { fire: 1 }, armour: 0.2, evasion: 2.0, accuracy: 1.3, xp: 0.9, res: { fire: 50 },
        look: { shape: "bird", body: "#3c2f2f", eye: "#ff5a36", size: 0.75 } },
    magmacrab: { id: "magmacrab", name: "Magma Carapace", life: 1.8, damage: 0.9, speed: 0.7, split: { fire: 0.5, phys: 0.5 }, armour: 2.6, evasion: 0.2, accuracy: 0.9, xp: 1.3, res: { fire: 50, cold: -20 },
        look: { shape: "crab", body: "#7a2e1f", eye: "#ffc233", size: 1.05 } },
    sunpriest: { id: "sunpriest", name: "Sunless Priest", life: 0.9, damage: 1.4, speed: 0.6, split: { fire: 0.4, chaos: 0.6 }, spell: true, armour: 0.4, evasion: 0.7, accuracy: 1, xp: 1.4, res: { chaos: 30 },
        look: { shape: "robe", body: "#2b2233", eye: "#ffc233", size: 1.05 } },
    // Act 4: Ashfold, the lantern town
    risen: { id: "risen", name: "Risen Bones", life: 1.5, damage: 1.0, speed: 0.8, split: { phys: 1 }, armour: 1.8, evasion: 0.3, accuracy: 1, xp: 1.2, res: { cold: 20, chaos: 20 },
        look: { shape: "tall", body: "#b0a48a", eye: "#ff5a36", size: 1 } },
    lanternghost: { id: "lanternghost", name: "Lantern Ghost", life: 0.8, damage: 1.3, speed: 0.9, split: { fire: 0.6, chaos: 0.4 }, spell: true, armour: 0.3, evasion: 1.4, accuracy: 1.1, xp: 1.2, res: { fire: 40, chaos: 30 },
        look: { shape: "robe", body: "#3a2a5a", eye: "#ffb000", size: 1.05 } },
    watchman: { id: "watchman", name: "Hollow Watchman", life: 1.1, damage: 1.2, speed: 1.0, split: { phys: 0.6, cold: 0.4 }, armour: 1.0, evasion: 0.8, accuracy: 1.3, xp: 1.1, res: { cold: 30 },
        look: { shape: "tall", body: "#2a3040", eye: "#9fe3ff", size: 1 } },
    widow: { id: "widow", name: "Hollow Widow", life: 0.9, damage: 1.3, speed: 0.8, split: { cold: 0.5, chaos: 0.5 }, spell: true, armour: 0.4, evasion: 0.9, accuracy: 1, xp: 1.2, res: { cold: 30, chaos: 20 },
        look: { shape: "robe", body: "#4a3a5a", eye: "#b9a4ff", size: 1 } },
    smith: { id: "smith", name: "Hollow Smith", life: 1.6, damage: 1.3, speed: 0.6, split: { phys: 0.7, fire: 0.3 }, armour: 1.6, evasion: 0.4, accuracy: 1, xp: 1.3, res: { fire: 30 },
        look: { shape: "tall", body: "#5a3a2a", eye: "#ffc233", size: 1.1 } },
    elder: { id: "elder", name: "Hollow Elder", life: 0.8, damage: 1.1, speed: 0.7, split: { chaos: 0.7, cold: 0.3 }, spell: true, armour: 0.5, evasion: 0.6, accuracy: 1, xp: 1.1, res: { chaos: 40 },
        look: { shape: "robe", body: "#5a5a4a", eye: "#9ef26a", size: 0.95 } },
    // ---- bosses
    tidewarden: { id: "tidewarden", name: "The Tide-Warden", boss: true, life: 25, damage: 2.0, speed: 0.7, split: { phys: 0.6, cold: 0.4 },
        armour: 1.5, evasion: 0.6, accuracy: 1.2, res: { cold: 40, fire: 20, lightning: 20, chaos: 20 }, xp: 18,
        look: { shape: "giant", body: "#2c6f73", eye: "#dff7ff", size: 1.8 } },
    keeper: { id: "keeper", name: "Chapel Keeper", boss: true, life: 12, damage: 1.6, speed: 0.8, split: { phys: 0.5, chaos: 0.5 },
        armour: 1, evasion: 0.8, accuracy: 1.1, res: { chaos: 30, fire: 10, cold: 10, lightning: 10 }, xp: 10,
        look: { shape: "robe", body: "#6b4a7a", eye: "#ffd84a", size: 1.5 } },
    drownedknight: { id: "drownedknight", name: "The Drowned Knight", boss: true, life: 14, damage: 1.7, speed: 0.9, split: { phys: 0.8, cold: 0.2 },
        armour: 2.2, evasion: 0.5, accuracy: 1.2, res: { cold: 30, fire: 15, lightning: 15, chaos: 15 }, xp: 10,
        look: { shape: "tall", body: "#4f6d7a", eye: "#9ff3ff", size: 1.7 } },
    sandwright: { id: "sandwright", name: "The Sandwright", boss: true, life: 16, damage: 1.8, speed: 0.7, split: { phys: 0.6, fire: 0.4 },
        armour: 2, evasion: 0.4, accuracy: 1.1, res: { fire: 30, cold: 15, lightning: 15, chaos: 20 }, xp: 12,
        look: { shape: "giant", body: "#c9a15a", eye: "#fff6d0", size: 1.6 } },
    mirrorwarden: { id: "mirrorwarden", name: "The Mirror Warden", boss: true, life: 18, damage: 1.9, speed: 0.9, split: { lightning: 0.5, phys: 0.5 },
        armour: 1, evasion: 1.5, accuracy: 1.3, res: { lightning: 40, fire: 25, cold: 25, chaos: 25 }, xp: 14,
        look: { shape: "tall", body: "#a8e6f5", eye: "#ffffff", size: 1.7 } },
    glassregent: { id: "glassregent", name: "The Glass Regent", boss: true, life: 28, damage: 2.1, speed: 0.75, split: { lightning: 0.4, fire: 0.3, phys: 0.3 },
        armour: 1.4, evasion: 1, accuracy: 1.3, res: { lightning: 40, fire: 30, cold: 30, chaos: 25 }, xp: 22,
        look: { shape: "robe", body: "#7fd1ff", eye: "#ffffff", size: 1.9 } },
    cindermatron: { id: "cindermatron", name: "The Cinder Matron", boss: true, life: 20, damage: 2.0, speed: 0.8, split: { fire: 0.7, chaos: 0.3 },
        armour: 1.2, evasion: 0.8, accuracy: 1.2, res: { fire: 50, cold: 20, lightning: 25, chaos: 30 }, xp: 16,
        look: { shape: "robe", body: "#b0412a", eye: "#ffe066", size: 1.8 } },
    emberjudge: { id: "emberjudge", name: "The Ember Judge", boss: true, life: 22, damage: 2.1, speed: 0.85, split: { fire: 0.5, phys: 0.5 },
        armour: 2, evasion: 0.8, accuracy: 1.3, res: { fire: 40, cold: 30, lightning: 30, chaos: 30 }, xp: 18,
        look: { shape: "tall", body: "#ff9a2e", eye: "#111111", size: 1.8 } },
    nightwatch: { id: "nightwatch", name: "The Night Watch", boss: true, life: 22, damage: 2.0, speed: 0.9, split: { phys: 0.6, cold: 0.4 },
        armour: 1.6, evasion: 1, accuracy: 1.4, res: { fire: 30, cold: 40, lightning: 30, chaos: 30 }, xp: 18,
        look: { shape: "giant", body: "#2a3a5a", eye: "#9fe3ff", size: 1.8 } },
    mayor: { id: "mayor", name: "The Mayor Who Waited", boss: true, life: 24, damage: 2.1, speed: 0.7, split: { chaos: 0.6, cold: 0.4 }, spell: true,
        armour: 1.2, evasion: 0.8, accuracy: 1.3, res: { fire: 30, cold: 30, lightning: 30, chaos: 50 }, xp: 20,
        look: { shape: "robe", body: "#4a3a6a", eye: "#9ef26a", size: 1.9 } },
    lamplighter: { id: "lamplighter", name: "The Lamplighter", boss: true, life: 34, damage: 2.3, speed: 0.75, split: { fire: 0.5, chaos: 0.3, lightning: 0.2 }, spell: true,
        armour: 1.4, evasion: 1.2, accuracy: 1.4, res: { fire: 55, cold: 35, lightning: 35, chaos: 40 }, xp: 32,
        look: { shape: "robe", body: "#3a2a5a", eye: "#ffb000", size: 2.0 } },
    // ---- pinnacles
    p_drownedsun: { id: "p_drownedsun", name: "The Drowned Sun", boss: true, life: 50, damage: 1.6, speed: 0.8, split: { cold: 0.5, fire: 0.3, phys: 0.2 },
        armour: 1.5, evasion: 1, accuracy: 1.4, res: { fire: 40, cold: 50, lightning: 40, chaos: 40 }, xp: 60,
        look: { shape: "giant", body: "#1f5a6a", eye: "#ffe066", size: 2.1 } },
    p_glasschoir: { id: "p_glasschoir", name: "The Glass Choir", boss: true, life: 46, damage: 1.1, speed: 0.8, split: { lightning: 0.6, phys: 0.4 },
        armour: 1, evasion: 1.5, accuracy: 1.5, res: { fire: 40, cold: 40, lightning: 55, chaos: 40 }, xp: 70,
        look: { shape: "robe", body: "#c8f2ff", eye: "#ff5a36", size: 2.1 } },
    p_ashenking: { id: "p_ashenking", name: "The Ashen King", boss: true, life: 32, damage: 0.85, speed: 0.75, split: { fire: 0.5, phys: 0.4, chaos: 0.1 },
        armour: 2.0, evasion: 0.8, accuracy: 1.5, res: { fire: 45, cold: 40, lightning: 40, chaos: 45 }, xp: 85,
        look: { shape: "giant", body: "#4a2a20", eye: "#ff3b1f", size: 2.2 } },
    p_hollowcrown: { id: "p_hollowcrown", name: "The Hollow Crown", boss: true, life: 25, damage: 0.52, speed: 0.8, split: { chaos: 0.3, cold: 0.35, lightning: 0.35 },
        armour: 1.6, evasion: 1, accuracy: 1.6, res: { fire: 45, cold: 45, lightning: 45, chaos: 55 }, xp: 120,
        look: { shape: "robe", body: "#1a1422", eye: "#b9a4ff", size: 2.3 } },
    lastdawn: { id: "lastdawn", name: "The Last Dawn", boss: true, life: 34, damage: 2.3, speed: 0.7, split: { fire: 0.5, lightning: 0.2, chaos: 0.3 },
        armour: 1.6, evasion: 1, accuracy: 1.4, res: { fire: 50, cold: 35, lightning: 35, chaos: 35 }, xp: 30,
        look: { shape: "giant", body: "#ffc233", eye: "#ff3b1f", size: 2.0 } },
};
