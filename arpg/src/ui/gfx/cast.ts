// Who looks like what: each monster and calling mapped to atlas sprites.
// A handful of CC0 creatures cover all 29 monsters; a tint in the monster's
// own colour (from its data) keeps look-alikes apart. Anything missing here
// falls back to the code-drawn shapes in battle.ts.

export interface Cast {
    /** Idle/walk loop. */
    sprite: string;
    /** Played once when it attacks, if the art has one. */
    attack?: string;
    /** Wash of this colour over the sprite (0..1 strength). */
    tint?: string;
    strength?: number;
    /** Pixels above the ground for fliers (they bob). */
    hover?: number;
    fps?: number;
}

export const MONSTER_CAST: Record<string, Cast> = {
    // Act 1: the Drowned Road
    drowned: { sprite: "mon.thing", tint: "#5f8f86", strength: 0.25, fps: 6 },
    crab: { sprite: "mon.spider", tint: "#d0643a", strength: 0.45, fps: 10 },
    gull: { sprite: "mon.flyer", tint: "#e9e4d4", strength: 0.35, hover: 16, fps: 10 },
    bogwitch: { sprite: "mon.wizard", attack: "mon.wizard.attack", tint: "#4a5a3a", strength: 0.35, fps: 7 },
    eel: { sprite: "mon.shade", attack: "mon.shade.attack", tint: "#2f6fb8", strength: 0.45, hover: 4, fps: 8 },
    lampman: { sprite: "mon.ghoul", fps: 10 },
    // Act 2: the Glass Barrens
    scorpion: { sprite: "mon.spider", tint: "#9fe3ff", strength: 0.4, fps: 10 },
    wraith: { sprite: "mon.wraith", tint: "#d9b77a", strength: 0.45, hover: 6, fps: 6 },
    jackal: { sprite: "mon.wolf", tint: "#d9b77a", strength: 0.35, fps: 10 },
    bleached: { sprite: "mon.skeleton", fps: 8 },
    wasp: { sprite: "mon.skull2", tint: "#ffe066", strength: 0.45, hover: 18, fps: 8 },
    // Act 3: the Sunfall
    hound: { sprite: "mon.hound", fps: 12 },
    ashwalker: { sprite: "mon.ghoul", tint: "#3a3030", strength: 0.35, fps: 9 },
    cinderbat: { sprite: "mon.skull", hover: 14, fps: 10 },
    magmacrab: { sprite: "mon.gato", tint: "#ff5a36", strength: 0.35, fps: 7 },
    sunpriest: { sprite: "mon.wizard", attack: "mon.wizard.attack", tint: "#6b1f1f", strength: 0.3, fps: 7 },
    // Bosses and trials
    tidewarden: { sprite: "boss.nightmare", tint: "#2f6fb8", strength: 0.2, fps: 6 },
    keeper: { sprite: "boss.angel", attack: "boss.angel.attack", tint: "#3c2a52", strength: 0.35, hover: 6, fps: 8 },
    drownedknight: { sprite: "boss.knight", attack: "boss.knight.attack", tint: "#2f6f6a", strength: 0.35, fps: 6 },
    sandwright: { sprite: "boss.beast", tint: "#d9b77a", strength: 0.4, fps: 8 },
    mirrorwarden: { sprite: "boss.knight", attack: "boss.knight.attack", tint: "#9fe3ff", strength: 0.45, fps: 6 },
    glassregent: { sprite: "boss.angel", attack: "boss.angel.attack", tint: "#9fe3ff", strength: 0.35, hover: 6, fps: 8 },
    cindermatron: { sprite: "boss.beast", fps: 8 },
    emberjudge: { sprite: "boss.demon", tint: "#ff7a2e", strength: 0.25, fps: 7 },
    lastdawn: { sprite: "boss.demon", fps: 7 },
    // Pinnacles
    p_drownedsun: { sprite: "boss.nightmare", tint: "#0c2a66", strength: 0.35, fps: 6 },
    p_glasschoir: { sprite: "boss.angel", attack: "boss.angel.attack", tint: "#b9a4ff", strength: 0.4, hover: 6, fps: 8 },
    p_ashenking: { sprite: "boss.demon", tint: "#2a2020", strength: 0.35, fps: 7 },
    p_hollowcrown: { sprite: "boss.demon", tint: "#8b5cf6", strength: 0.4, fps: 7 },
};

export interface HeroCast { idle: string; run: string; attack: string; hurt: string; projectile?: "arrow" | "fireball" }

export const HERO_CAST: Record<string, HeroCast> = {
    vanguard: { idle: "hero.vanguard.idle", run: "hero.vanguard.run", attack: "hero.vanguard.attack", hurt: "hero.vanguard.hurt" },
    strider: { idle: "hero.strider.idle", run: "hero.strider.run", attack: "hero.strider.attack", hurt: "hero.strider.hurt", projectile: "arrow" },
    arcanist: { idle: "hero.arcanist.idle", run: "hero.arcanist.run", attack: "hero.arcanist.attack", hurt: "hero.arcanist.hurt", projectile: "fireball" },
};
