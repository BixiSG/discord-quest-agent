// Backdrops: parallax layer sets from the CC0 packs, one per kind of place,
// and which zone uses which. A wash of the zone's own sky colour keeps zones
// that share a set apart. Zones without a set (or before the atlas loads)
// keep the code-drawn hills.

export interface Layer {
    sprite: string;
    /** 0 = fixed to the sky, 1 = moves with the ground. */
    parallax: number;
    /** Pixels the layer's bottom sits below the ground line (negative: above). */
    drop?: number;
}
export interface SceneSet {
    layers: Layer[];
    /** Fills the sky above layers that don't reach the top. */
    sky: string;
    /** The strip the fighters stand on, and its lighter edge. */
    ground: string;
    edge: string;
}

export const SETS: Record<string, SceneSet> = {
    swamp: { sky: "#2a2b17", ground: "#1d1f10", edge: "#3f4a1c", layers: [{ sprite: "bg.swamp.0", parallax: 0.15, drop: 18 }, { sprite: "bg.swamp.1", parallax: 0.5, drop: 18 }] },
    cemetery: { sky: "#240a2c", ground: "#140a1c", edge: "#3b2352", layers: [{ sprite: "bg.cemetery.0", parallax: 0.03, drop: 40 }, { sprite: "bg.cemetery.1", parallax: 0.18, drop: 72 }, { sprite: "bg.cemetery.2", parallax: 0.45, drop: 6 }] },
    forest: { sky: "#b8792f", ground: "#2a1d14", edge: "#6b4a26", layers: [{ sprite: "bg.forest.0", parallax: 0.1, drop: 4 }, { sprite: "bg.forest.1", parallax: 0.3, drop: 4 }, { sprite: "bg.forest.2", parallax: 0.6, drop: 6 }] },
    dusk: { sky: "#8a5f8a", ground: "#20182a", edge: "#4a3552", layers: [{ sprite: "bg.dusk.0", parallax: 0.02, drop: 10 }, { sprite: "bg.dusk.1", parallax: 0.08, drop: 4 }, { sprite: "bg.dusk.2", parallax: 0.18, drop: 4 }, { sprite: "bg.dusk.3", parallax: 0.35, drop: 4 }, { sprite: "bg.dusk.4", parallax: 0.65, drop: 8 }] },
    castle: { sky: "#101f26", ground: "#0c171c", edge: "#284a4a", layers: [{ sprite: "bg.castle.0", parallax: 0.2, drop: 14 }] },
    ashfold: { sky: "#28383f", ground: "#10141a", edge: "#2a3440", layers: [{ sprite: "bg.ashfold.sky", parallax: 0, drop: 0 }, { sprite: "bg.ashfold.clouds", parallax: 0.02, drop: 0 },
        { sprite: "bg.ashfold.0", parallax: 0.06, drop: 6 }, { sprite: "bg.ashfold.1", parallax: 0.15, drop: -14 }, { sprite: "bg.ashfold.2", parallax: 0.35, drop: 4 }] },
    square: { sky: "#1c2630", ground: "#141418", edge: "#3a3a44", layers: [{ sprite: "bg.square.0", parallax: 0.1, drop: 40 }, { sprite: "bg.square.1", parallax: 0.4, drop: 24 }] },
    desert: { sky: "#e8b48a", ground: "#6e2a28", edge: "#a8584a", layers: [{ sprite: "bg.desert.0", parallax: 0.05, drop: 16 }, { sprite: "bg.desert.1", parallax: 0.15, drop: 16 }, { sprite: "bg.desert.2", parallax: 0.3, drop: 16 }, { sprite: "bg.desert.3", parallax: 0.55, drop: 16 }] },
};

const ZONE_SET: Record<string, string> = {
    a1_shore: "swamp", a1_saltmire: "swamp", a1_chapel: "castle", a1_cliffs: "dusk", a1_village: "cemetery",
    a1_floodgate: "swamp", a1_lock: "castle", a1_trial: "cemetery",
    a2_dunes: "desert", a2_mirage: "desert", a2_caravan: "desert", a2_shards: "desert", a2_oasis: "desert",
    a2_spire: "castle", a2_throne: "castle", a2_trial: "desert",
    a3_ashroad: "dusk", a3_emberwood: "forest", a3_rim: "dusk", a3_molten: "desert", a3_bellcourt: "castle",
    a3_heart: "dusk", a3_sunfall: "cemetery", a3_trial: "castle",
    a4_stair: "dusk", a4_gate: "ashfold", a4_lanes: "ashfold", a4_square: "square", a4_belfry: "castle",
    a4_undercroft: "cemetery", a4_lamphouse: "ashfold", a4_trial: "ashfold",
};
const ROTATION = ["swamp", "cemetery", "forest", "dusk", "desert", "castle"];

/** The set for a zone id (maps and pinnacles pick one from their area name, so it stays put). */
export function setFor(zoneId: string, name: string): SceneSet {
    const id = ZONE_SET[zoneId];
    if (id) return SETS[id]!;
    let h = 0;
    for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    return SETS[ROTATION[h % ROTATION.length]!]!;
}
